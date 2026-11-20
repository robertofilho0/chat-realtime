import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { AccessPayload } from './token.js';

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 4);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private async respond(user: User) {
    const payload: AccessPayload = { sub: user.id, username: user.username };
    return {
      token: await this.jwt.signAsync(payload),
      user: toPublicUser(user),
    };
  }

  async register({ password, ...data }: RegisterInput) {
    if (
      await this.prisma.user.findUnique({ where: { username: data.username } })
    ) {
      throw new ConflictException('Este username já está em uso');
    }
    const passwordHash = await bcrypt.hash(
      password,
      this.config.get('BCRYPT_ROUNDS', { infer: true }),
    );
    return this.respond(
      await this.prisma.user.create({ data: { ...data, passwordHash } }),
    );
  }

  async login({ username, password }: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Credenciais inválidas');
    return this.respond(user);
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toPublicUser(user);
  }

  /** Usado pelo gateway WebSocket para autenticar o handshake. */
  verify(token: string) {
    return this.jwt.verifyAsync<AccessPayload>(token);
  }
}
