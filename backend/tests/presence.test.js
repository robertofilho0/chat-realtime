import presence from '../src/realtime/presence.js';

afterEach(() => presence.reset());

describe('Presença', () => {
  it('conta várias conexões do mesmo usuário como uma', () => {
    expect(presence.connect('ana')).toBe(true);
    expect(presence.connect('ana')).toBe(false);
    expect(presence.online()).toEqual(['ana']);
    expect(presence.disconnect('ana')).toBe(false);
    expect(presence.disconnect('ana')).toBe(true);
    expect(presence.online()).toEqual([]);
  });

  it('controla os usuários de cada sala', () => {
    presence.join('geral', 'bruno');
    presence.join('geral', 'ana');
    presence.join('dev', 'ana');
    expect(presence.usersInRoom('geral')).toEqual(['ana', 'bruno']);
    presence.leave('geral', 'ana');
    expect(presence.usersInRoom('geral')).toEqual(['bruno']);
    expect(presence.usersInRoom('dev')).toEqual(['ana']);
  });
});
