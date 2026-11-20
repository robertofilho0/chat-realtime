import { Injectable } from '@nestjs/common';

/**
 * Presença em memória. Conta conexões por usuário, para que várias abas
 * do mesmo usuário apareçam como uma pessoa online só.
 */
@Injectable()
export class PresenceService {
  private readonly connections = new Map<string, number>();
  private readonly rooms = new Map<string, Map<string, number>>();

  /** Retorna true se o usuário acabou de ficar online. */
  connect(username: string): boolean {
    const count = (this.connections.get(username) ?? 0) + 1;
    this.connections.set(username, count);
    return count === 1;
  }

  /** Retorna true se o usuário ficou offline (fechou a última aba). */
  disconnect(username: string): boolean {
    const count = (this.connections.get(username) ?? 1) - 1;
    if (count <= 0) this.connections.delete(username);
    else this.connections.set(username, count);
    return count <= 0;
  }

  join(room: string, username: string): void {
    const members = this.rooms.get(room) ?? new Map<string, number>();
    members.set(username, (members.get(username) ?? 0) + 1);
    this.rooms.set(room, members);
  }

  leave(room: string, username: string): void {
    const members = this.rooms.get(room);
    if (!members) return;
    const count = (members.get(username) ?? 1) - 1;
    if (count <= 0) members.delete(username);
    else members.set(username, count);
    if (members.size === 0) this.rooms.delete(room);
  }

  online(): string[] {
    return [...this.connections.keys()].sort();
  }

  usersInRoom(room: string): string[] {
    return [...(this.rooms.get(room)?.keys() ?? [])].sort();
  }

  reset(): void {
    this.connections.clear();
    this.rooms.clear();
  }
}
