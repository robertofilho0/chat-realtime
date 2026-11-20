/**
 * Controle de presença em memória.
 * Conta conexões por usuário, para que várias abas do mesmo usuário
 * apareçam como uma pessoa online só.
 */
class Presence {
  constructor() {
    this.connections = new Map(); // username -> nº de sockets
    this.rooms = new Map(); // room -> Map(username -> nº de sockets)
  }

  connect(username) {
    const count = (this.connections.get(username) || 0) + 1;
    this.connections.set(username, count);
    return count === 1; // true se ficou online agora
  }

  disconnect(username) {
    const count = (this.connections.get(username) || 1) - 1;
    if (count <= 0) this.connections.delete(username);
    else this.connections.set(username, count);
    return count <= 0; // true se ficou offline
  }

  join(room, username) {
    const members = this.rooms.get(room) || new Map();
    members.set(username, (members.get(username) || 0) + 1);
    this.rooms.set(room, members);
  }

  leave(room, username) {
    const members = this.rooms.get(room);
    if (!members) return;
    const count = (members.get(username) || 1) - 1;
    if (count <= 0) members.delete(username);
    else members.set(username, count);
    if (members.size === 0) this.rooms.delete(room);
  }

  online() {
    return [...this.connections.keys()].sort();
  }

  usersInRoom(room) {
    return [...(this.rooms.get(room)?.keys() || [])].sort();
  }

  reset() {
    this.connections.clear();
    this.rooms.clear();
  }
}

export default new Presence();
