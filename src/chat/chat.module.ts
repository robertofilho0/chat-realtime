import { Global, Module } from '@nestjs/common';
import { RoomsController } from '../rooms/rooms.controller.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

@Global()
@Module({
  controllers: [RoomsController],
  providers: [RoomsService, PresenceService, ChatGateway],
  exports: [PresenceService],
})
export class ChatModule {}
