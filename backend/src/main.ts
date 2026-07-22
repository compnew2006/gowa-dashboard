import 'dotenv/config'
import { NestFactory, Reflector } from '@nestjs/core'
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import axios, { AxiosError } from 'axios'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { JwtService } from '@nestjs/jwt'
import { DevicesService } from './modules/devices/devices.service'
import { AuditService } from './modules/audit/audit.service'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api/v1')

  app.use(helmet())
  app.use(cookieParser())

  // Raw-body capture for webhook HMAC verification.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/v1/webhooks')) {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        ;(req as Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks)
      })
    }
    next()
  })

  app.enableCors({
    origin: config.get<string>('CORS_ALLOWED_ORIGINS')
      ? config.get<string>('CORS_ALLOWED_ORIGINS')!.split(',')
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-gowa-signature'],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

  // Register the proxy BEFORE the global prefix is applied to it, using the
  // raw Express instance exposed by Nest's HttpAdapter. We mount it via
  // app.use() so it sits ahead of the Nest router in the middleware chain.
  const jwt = app.get(JwtService)
  const devices = app.get(DevicesService)
  const audit = app.get(AuditService)
  const upstream = (config.get<string>('GOWA_UPSTREAM_URL') || 'http://127.0.0.1:3080').replace(/\/+$/, '')
  const proxyLogger = new Logger('GowaProxy')

  const proxyHandler = async (req: Request, res: Response): Promise<void> => {
    // 1. Verify JWT.
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      res.status(401).json({ code: 'unauthorized', message: 'Missing Bearer token.', results: null })
      return
    }
    let payload: { sub: string; workspaceId: string }
    try {
      payload = jwt.verify(token) as typeof payload
    } catch {
      res.status(401).json({ code: 'unauthorized', message: 'Invalid or expired token.', results: null })
      return
    }

    // 2. Require X-Device-Id.
    const deviceId = (req.headers['x-device-id'] as string) || (req.query['device_id'] as string)
    if (!deviceId) {
      res.status(400).json({
        code: 'bad_request',
        message: 'X-Device-Id header (or ?device_id=) is required.',
        results: null,
      })
      return
    }

    // 3. Decrypt gowa creds from the vault.
    let basicAuth: string
    try {
      const creds = await devices.resolveCredentials(payload.workspaceId, deviceId)
      basicAuth = Buffer.from(`${creds.basicAuthUser}:${creds.basicAuthPassword}`).toString('base64')
    } catch (err) {
      res.status(404).json({
        code: 'not_found',
        message: (err as Error).message,
        results: null,
      })
      return
    }

    // 4. Forward to gowa. Because we mount at /api/v1/proxy, req.url is the
    // remainder (e.g. "/devices?limit=3" or "/app/info").
    const gowaPath = req.url.startsWith('/') ? req.url : `/${req.url}`
    const targetUrl = `${upstream}${gowaPath}`
    const forwardHeaders: Record<string, string> = {
      Authorization: `Basic ${basicAuth}`,
      'X-Device-Id': deviceId,
      Accept: (req.headers.accept as string) || 'application/json',
    }
    if (req.headers['content-type']) {
      forwardHeaders['Content-Type'] = req.headers['content-type'] as string
    }

    try {
      const upstreamRes = await axios.request({
        url: targetUrl,
        method: req.method as any,
        headers: forwardHeaders,
        data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : (req.body as any),
        validateStatus: () => true,
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 45_000,
      })
      const ctRaw = upstreamRes.headers['content-type']
      const ct = (Array.isArray(ctRaw) ? ctRaw[0] : ctRaw) || 'application/json'
      res.status(upstreamRes.status)
      res.setHeader('Content-Type', typeof ct === 'string' ? ct : 'application/json')
      const clRaw = upstreamRes.headers['content-length']
      if (clRaw) {
        const cl = Array.isArray(clRaw) ? clRaw[0] : clRaw
        res.setHeader('Content-Length', String(cl))
      }
      res.end(Buffer.from(upstreamRes.data))

      // Audit-log mutating proxy calls (POST/PUT/PATCH/DELETE). Best-effort;
      // failures never break the response (already sent).
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
        audit
          .record({
            workspaceId: payload.workspaceId,
            userId: payload.sub,
            action: `proxy.${req.method.toLowerCase()}`,
            targetType: 'gowa',
            targetId: deviceId,
            payload: {
              path: gowaPath,
              method: req.method,
              upstreamStatus: upstreamRes.status,
              jid: typeof req.body?.jid === 'string' ? req.body.jid : undefined,
            },
            ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0',
            userAgent: req.headers['user-agent'] ?? 'proxy',
          })
          .catch((e) => proxyLogger.warn(`audit record failed: ${(e as Error).message}`))
      }
    } catch (err) {
      const axiosErr = err as AxiosError
      if (axiosErr.code === 'ECONNREFUSED') {
        proxyLogger.error(`gowa unreachable at ${upstream}`)
        res.status(502).json({
          code: 'upstream_unreachable',
          message: `gowa backend not reachable at ${upstream}.`,
          results: null,
        })
        return
      }
      proxyLogger.error(`Proxy error: ${(err as Error).message}`)
      res.status(502).json({
        code: 'proxy_error',
        message: (err as Error).message,
        results: null,
      })
      return
    }
  }

  // Mount the proxy on the raw Express instance. The `app.use(path, handler)`
  // form registers BEFORE Nest's router for matching paths, so /api/v1/proxy/**
  // never reaches Nest's 404 handler.
  const expressInstance = app.getHttpAdapter().getInstance() as import('express').Express
  expressInstance.use('/api/v1/proxy', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next()
    return proxyHandler(req, res)
  })
  proxyLogger.log(`Proxy mounted: /api/v1/proxy/** -> ${upstream}`)

  const port = config.get<number>('PORT') ?? 4000
  await app.listen(port, '0.0.0.0')
  const url = await app.getUrl()
  new Logger('Bootstrap').log(`🚀 gowa-crm backend running on ${url}/api/v1`)
}

bootstrap().catch((err: unknown) => {
  new Logger('Bootstrap').error(`Failed to start: ${(err as Error).message}`, (err as Error).stack)
  process.exit(1)
})
