import { Module } from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { ContactsController } from './contacts.controller'
import { DevicesModule } from '../devices/devices.module'

@Module({
  imports: [DevicesModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
