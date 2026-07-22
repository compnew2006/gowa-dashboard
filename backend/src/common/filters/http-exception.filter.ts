import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * Global exception filter that normalises every error into the gowa-style
 * envelope `{ code, message, results }` so the frontend's `api-error.ts`
 * reads it uniformly.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'internal_error'
    let message = 'An unexpected error occurred.'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>
        message = (r.message as string | string[] | undefined) ?
          Array.isArray(r.message) ? r.message.join('; ') : (r.message as string)
          : exception.message
        code = (r.code as string | undefined) ?? code
      }
      code = (code === 'internal_error' ? this.statusToCode(status) : code)
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack)
    } else {
      this.logger.error('Unknown exception shape', exception as object)
    }

    response.status(status).json({
      code,
      message,
      results: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400: return 'bad_request'
      case 401: return 'unauthorized'
      case 403: return 'forbidden'
      case 404: return 'not_found'
      case 409: return 'conflict'
      case 422: return 'validation_failed'
      case 429: return 'rate_limited'
      case 500: return 'internal_error'
      default: return 'error'
    }
  }
}
