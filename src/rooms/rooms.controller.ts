import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PresenceService } from '../chat/presence.service.js';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import {
  createRoomSchema,
  historySchema,
  roomSlugSchema,
  type CreateRoomInput,
  type HistoryQuery,
} from './rooms.schemas.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('Salas')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly presence: PresenceService,
  ) {}

  @Get()
  list() {
    return this.rooms.list((slug) => this.presence.usersInRoom(slug).length);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createRoomSchema }) body: CreateRoomInput,
  ) {
    return this.rooms.create(user.id, body);
  }

  @Get(':slug/messages')
  history(
    @Param('slug', { schema: roomSlugSchema }) slug: string,
    @Query({ schema: historySchema }) query: HistoryQuery,
  ) {
    return this.rooms.history(slug, query);
  }
}
