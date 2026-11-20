/* Cliente web de demonstração do Chat Realtime (sem framework). */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const state = {
    token: localStorage.getItem('token'),
    user: null,
    room: 'geral',
    cursor: null,
    socket: null,
  };

  async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
    });
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(body?.details?.[0]?.mensagem || body?.error || 'Erro inesperado');
    return body;
  }

  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  const showError = (target, message) => {
    $(target).textContent = message || '';
  };

  // ---------- Autenticação ----------
  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset.action || 'login';
    const data = Object.fromEntries(new FormData(event.target));
    try {
      const result = await api(`/auth/${action}`, { method: 'POST', body: JSON.stringify(data) });
      state.token = result.token;
      localStorage.setItem('token', result.token);
      await enterChat();
    } catch (err) {
      showError('#auth-error', err.message);
    }
  });

  $('#logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    state.socket?.disconnect();
    location.reload();
  });

  // ---------- Renderização ----------
  function renderMessage(message, { prepend = false } = {}) {
    const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const node = el(
      'div',
      { className: `message${message.username === state.user.username ? ' mine' : ''}` },
      el('div', { className: 'meta', textContent: `${message.username} · ${time}` }),
      el('div', { textContent: message.content }),
    );
    const box = $('#messages');
    if (prepend) $('#load-more').after(node);
    else {
      box.append(node);
      box.scrollTop = box.scrollHeight;
    }
  }

  function renderUsers(target, countTarget, users) {
    $(target).replaceChildren(...users.map((u) => el('li', { textContent: u })));
    $(countTarget).textContent = users.length;
  }

  async function renderRooms() {
    const rooms = await api('/rooms');
    $('#rooms').replaceChildren(
      ...rooms.map((room) => {
        const li = el(
          'li',
          { className: room.slug === state.room ? 'active' : '' },
          `# ${room.name}`,
          el('span', { className: 'badge', textContent: room.onlineCount }),
        );
        li.addEventListener('click', () => switchRoom(room.slug));
        return li;
      }),
    );
  }

  async function loadHistory({ older = false } = {}) {
    const query = new URLSearchParams({
      limit: 30,
      ...(older && state.cursor ? { before: state.cursor } : {}),
    });
    const { data, hasMore, nextCursor } = await api(`/rooms/${state.room}/messages?${query}`);
    if (older) [...data].reverse().forEach((m) => renderMessage(m, { prepend: true }));
    else data.forEach((m) => renderMessage(m));
    state.cursor = nextCursor;
    $('#load-more').hidden = !hasMore;
  }

  $('#load-more').addEventListener('click', () => loadHistory({ older: true }));

  // ---------- Salas ----------
  async function switchRoom(slug) {
    if (state.socket && state.room !== slug) state.socket.emit('room:leave', state.room);
    state.room = slug;
    state.cursor = null;
    $('#room-title').textContent = `#${slug}`;
    $('#messages').replaceChildren($('#load-more'));
    showError('#chat-error');

    state.socket.emit('room:join', slug, (res) => {
      if (!res.ok) return showError('#chat-error', res.error);
      renderUsers('#room-users', '#room-count', res.users);
    });
    await loadHistory();
    await renderRooms();
  }

  $('#new-room').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = event.target.name.value.trim();
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    try {
      await api('/rooms', { method: 'POST', body: JSON.stringify({ slug, name }) });
      event.target.reset();
      await switchRoom(slug);
    } catch (err) {
      showError('#chat-error', err.message);
    }
  });

  // ---------- Mensagens e digitação ----------
  let typingTimer;
  $('#composer').content.addEventListener('input', () => {
    state.socket.emit('typing', { room: state.room, typing: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(
      () => state.socket.emit('typing', { room: state.room, typing: false }),
      1500,
    );
  });

  $('#composer').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.target.content;
    if (!input.value.trim()) return;
    state.socket.emit('message:send', { room: state.room, content: input.value }, (res) => {
      showError('#chat-error', res.ok ? '' : res.error);
      if (res.ok) input.value = '';
    });
  });

  const typingUsers = new Set();

  // ---------- Conexão ----------
  async function enterChat() {
    state.user = await api('/auth/me');
    $('#auth').hidden = true;
    $('#chat').hidden = false;
    $('#me').textContent = `@${state.user.username}`;

    const socket = io({ auth: { token: state.token } });
    state.socket = socket;

    socket.on('connect_error', (err) =>
      showError('#chat-error', `Falha na conexão: ${err.message}`),
    );
    socket.on('connect', () => switchRoom(state.room));
    socket.on('presence:list', (users) => renderUsers('#online', '#online-count', users));
    socket.on('message:new', (message) => {
      if (message.room === state.room) renderMessage(message);
    });
    socket.on('room:users', ({ room, users }) => {
      if (room === state.room) renderUsers('#room-users', '#room-count', users);
    });
    socket.on('typing', ({ room, username, typing }) => {
      if (room !== state.room) return;
      if (typing) typingUsers.add(username);
      else typingUsers.delete(username);
      const list = [...typingUsers];
      $('#typing').textContent = list.length ? `${list.join(', ')} está digitando…` : '';
    });

    const refreshOnline = async () => {
      const rooms = await api('/rooms').catch(() => null);
      if (rooms) await renderRooms();
    };
    socket.on('user:online', refreshOnline);
    socket.on('user:offline', refreshOnline);
    socket.on('user:online', (u) => {
      const items = new Set(
        [...document.querySelectorAll('#online li')].map((li) => li.textContent),
      );
      items.add(u);
      renderUsers('#online', '#online-count', [...items].sort());
    });
    socket.on('user:offline', (u) => {
      const items = [...document.querySelectorAll('#online li')]
        .map((li) => li.textContent)
        .filter((x) => x !== u);
      renderUsers('#online', '#online-count', items);
    });
  }

  if (state.token) {
    enterChat().catch(() => {
      localStorage.removeItem('token');
      state.token = null;
    });
  }
})();
