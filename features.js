// NXHN — Giai đoạn 4: giao diện follow, bình luận, chat, thông báo, nhóm, ảnh, báo cáo, quản trị.
// Chỉ gọi lớp NXHN.* (quyền thật ở RLS/SQL). Dùng textContent, không dùng innerHTML.
(() => {
try { NXHN; sb; } catch (e) { return; } // index.html chưa cấu hình → không chạy
const IMG = 'image/jpeg,image/png,image/webp,image/gif';
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [x, v] of Object.entries(a)) (x in e ? (e[x] = v) : e.setAttribute(x, v));
  e.append(...k.flat().filter((c) => c != null && c !== false));
  return e;
};
const when = (t) => new Date(t).toLocaleString('vi-VN');
const busy = async (b, fn) => { b.disabled = true; try { return await fn(); } finally { b.disabled = false; } };
const btn = (text, fn, cls = 'btn-secondary') => h('button', { className: `btn ${cls} btn-small`, type: 'button', textContent: text, onclick: (e) => fn(e.currentTarget) });
const names = new Map();
const nm = async (ids) => {
  const need = [...new Set(ids)].filter((i) => i && !names.has(i));
  if (!need.length) return;
  const r = await sb.from('profiles').select('id,username').in('id', need);
  (r.data || []).forEach((p) => names.set(p.id, p.username));
};
const N = (id) => handle(names.get(id));
// Icon SVG thống nhất (nét 2px, bo tròn) và nút chỉ có icon (có tooltip + aria-label).
const SVGNS = 'http://www.w3.org/2000/svg';
const ICON = {
  back: 'M15 18l-6-6 6-6', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', image: 'M4 5h16v14H4zM8 10h.01M20 15l-5-5L6 19',
  more: 'M12 5h.01M12 12h.01M12 19h.01', plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  home: 'M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5', explore: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z', bell: 'M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
};
const ico = (n) => {
  const s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  p.setAttribute('d', ICON[n] || ICON.more); s.append(p); return s;
};
const ibtn = (icon, label, fn, cls = '') => h('button', { className: 'ibtn ' + cls, type: 'button', title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); fn(e.currentTarget); } }, ico(icon));
// Avatar: cùng một tài khoản luôn cùng chữ cái + màu (màu sinh từ id) ở danh sách chat, khung chat, hồ sơ, Khám phá.
const hue = (s) => { let n = 0; for (const c of String(s || '?')) n = (n * 31 + c.charCodeAt(0)) % 360; return n; };
const av0 = (name, cls = '', key = name) => {
  const e = h('span', { className: 'avatar ' + cls, 'aria-hidden': 'true', textContent: (name || '?').replace('@', '').charAt(0).toUpperCase() });
  if (!cls.includes('anon-av')) { const k = hue(key); e.style.background = `hsl(${k} 42% 22%)`; e.style.color = `hsl(${k} 85% 74%)`; }
  return e;
};
const avt = (id, cls = '') => av0(names.get(id) || '?', cls, id);
const nameLink = (id, label) => h('button', { className: 'name-link', type: 'button', textContent: label == null ? N(id) : label, onclick: () => openProfile(id) });
const skel = (n = 3) => Array.from({ length: n }, () => h('li', { className: 'skel', 'aria-hidden': 'true' }));
const hm = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const ago = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? hm(t) : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); };
const followBtn = (id) => btn(fol.has(id) ? 'Bỏ follow' : 'Follow', (b) => busy(b, async () => {
  if (await (fol.has(id) ? NXHN.unfollow(user.id, id) : NXHN.follow(user.id, id))) { fol.has(id) ? fol.delete(id) : fol.add(id); b.textContent = fol.has(id) ? 'Bỏ follow' : 'Follow'; }
}));
let cid = null, oldest = null, ch = null, timer = 0, me = null, fol = new Set(), mine = new Map(), isAdm = false, isGroup = false, peer = null, sending = false, ch2 = null, replyTo = null, reqId = crypto.randomUUID();

Object.assign(NXHN, {
  people: (from, q) => { // q: tìm theo username (Khám phá)
    let s = sb.from('profiles').select('id,username,bio').neq('id', user.id).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (q) s = s.ilike('username', like(q));
    return s.then(ok);
  },
  userPosts: (id, before) => {
    let q = sb.from('posts').select('*').eq('author_id', id).is('community_id', null).order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    return q.then(ok);
  },
  following: () => sb.from('follows').select('followee_id').eq('follower_id', user.id).limit(1000).then(ok),
  remove: (table, id) => sb.from(table).delete().eq('id', id).then(ok), // RLS chỉ cho xóa của mình
  conversations: () => sb.from('conversations').select('id,is_group,title,created_at').order('created_at', { ascending: false }).limit(PAGE).then(ok),
  members: (ids) => sb.from('conversation_members').select('conversation_id,user_id').in('conversation_id', ids).then(ok),
  communities: () => sb.from('communities').select('id,name,description,is_private').order('created_at', { ascending: false }).limit(PAGE).then(ok),
  myCommunities: () => sb.from('community_members').select('community_id,role').eq('user_id', user.id).then(ok),
  communityPosts: (cid, before) => {
    let q = sb.from('posts').select('*').eq('community_id', cid).order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    return q.then(ok);
  },
  leaveCommunity: (cid) => sb.from('community_members').delete().match({ community_id: cid, user_id: user.id }).then(ok),
  markAllRead: () => sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).then(ok),
  unread: () => sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then((r) => r.count || 0),
  openReports: (from = 0) => sb.from('reports').select('id,target_type,target_id,reason').eq('status', 'open').order('created_at').range(from, from + PAGE - 1).then(ok),
  isAdmin: () => sb.from('profiles').select('role').eq('id', user.id).single().then((r) => !!r.data && r.data.role === 'admin'),
});

// Danh sách phân trang: get(con trỏ) → hàng; draw(ul, hàng); next(con trỏ, hàng) → con trỏ mới.
const feed = (get, draw, next, emptyText) => {
  const ul = h('ul', { className: 'timeline' }), none = h('p', { className: 'empty', hidden: true, textContent: emptyText });
  const err = h('div', { className: 'empty', hidden: true }, h('p', { textContent: 'Không tải được dữ liệu.' }), btn('Thử lại', () => load(true)));
  const more = h('button', { className: 'btn btn-secondary', type: 'button', hidden: true, textContent: 'Tải thêm' });
  let cur = null, seq = 0;
  const clear = () => { seq++; ul.replaceChildren(); cur = null; more.hidden = true; none.hidden = true; err.hidden = true; };
  const load = async (reset) => {
    if (reset) { clear(); ul.append(...skel()); }
    const my = seq, rows = await get(cur);
    if (my !== seq) return; // đã có lượt tải mới hơn (gõ tìm kiếm nhanh)
    ul.querySelectorAll('.skel').forEach((x) => x.remove());
    if (!Array.isArray(rows)) { err.hidden = false; return; }
    err.hidden = true;
    await draw(ul, rows);
    if (rows.length) cur = next(cur, rows);
    more.hidden = rows.length < PAGE; none.hidden = ul.children.length > 0;
  };
  more.onclick = () => busy(more, () => load(false));
  return { el: h('div', {}, ul, none, err, more), load, clear };
};
const rep = (type, id) => btn('Báo cáo', async (b) => {
  const r = (prompt('Lý do báo cáo (tối đa 1000 ký tự):') || '').trim();
  if (r && await busy(b, () => NXHN.report(user.id, type, id, r))) say('Đã gửi báo cáo.');
});

// Ảnh đính kèm: gom nhiều bài/tin nhắn vào một lượt truy vấn + một lượt ký URL (URL hết hạn sau 5 phút).
let pin = true; // true = đang bám đáy khung chat (tin mới nhất)
const toEnd = () => { mlist.scrollTop = mlist.scrollHeight; };
// Xem ảnh gốc: chạm ảnh nhỏ → khung toàn màn hình (vừa màn hình); chạm ảnh lần nữa để xem kích thước gốc.
const zoom = (src) => {
  const full = h('img', { src, alt: 'Ảnh đính kèm' });
  const key = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); removeEventListener('keydown', key); };
  const box = h('div', { className: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Xem ảnh', onclick: (e) => { if (e.target === box) close(); } },
    h('button', { className: 'btn btn-secondary btn-small lb-close', type: 'button', textContent: 'Đóng', onclick: close }), h('div', { className: 'lb-scroll' }, full));
  full.onclick = () => box.classList.toggle('actual');
  addEventListener('keydown', key); document.body.append(box); box.querySelector('button').focus();
};
const mkImg = (u, path, inChat) => {
  const im = h('img', { src: u, alt: 'Ảnh đính kèm (chạm để xem ảnh gốc)', title: 'Chạm để xem ảnh gốc', loading: inChat ? 'eager' : 'lazy', tabIndex: 0 });
  im.dataset.p = path;
  const open = async () => zoom((await NXHN.signedUrl(path)) || u);
  im.onload = () => { if (inChat && pin) toEnd(); };
  im.onclick = open;
  im.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } };
  im.onerror = () => {
    const b = btn('Không tải được ảnh — thử lại', async () => { const u2 = await NXHN.signedUrl(path); if (u2) b.replaceWith(mkImg(u2, path, inChat)); });
    im.replaceWith(b);
  };
  return im;
};
let q = [], qt = 0;
const queueImg = (node, key, id) => { q.push([node, key, id]); clearTimeout(qt); qt = setTimeout(flushImg, 0); };
const flushImg = async () => {
  const items = q; q = [];
  for (const key of ['post_id', 'message_id']) {
    const its = items.filter((i) => i[1] === key);
    if (!its.length) continue;
    const r = await sb.from('attachments').select(`${key},storage_path`).in(key, its.map((i) => i[2]));
    const rows = r.data || [];
    if (!rows.length) continue;
    const s = await sb.storage.from('media').createSignedUrls(rows.map((a) => a.storage_path), 300);
    const url = Object.fromEntries((s.data || []).map((x) => [x.path, x.signedUrl]));
    rows.forEach((a) => {
      const u = url[a.storage_path];
      if (!u) return;
      // gắn cho MỌI node còn trong DOM của tin/bài này (tránh gắn nhầm vào node đã bị thay khi tải lại danh sách)
      its.filter((i) => i[2] === a[key] && i[0].isConnected && ![...i[0].children].some((c) => c.dataset && c.dataset.p === a.storage_path))
        .forEach((n) => n[0].append(mkImg(u, a.storage_path, !!n[0].closest('.messages'))));
    });
  }
};

// ---- Bình luận ----
const comments = (pid) => {
  const f = feed((c) => NXHN.loadComments(pid, c), async (ul, rows) => {
    await nm(rows.map((r) => r.author_id));
    rows.forEach((r) => ul.append(h('li', { className: 'comment' },
      h('span', { className: 'who' }, avt(r.author_id), nameLink(r.author_id)), ' ', h('time', { className: 'post-time', textContent: when(r.created_at) }),
      h('p', { className: 'post-body', textContent: r.body }),
      r.author_id === user.id
        ? btn('Xóa', async (b) => { if (confirm('Xóa bình luận này?') && await busy(b, () => NXHN.remove('comments', r.id))) f.load(true); }, 'btn-danger')
        : rep('comment', r.id))));
  }, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có bình luận.');
  const ta = h('textarea', { rows: 2, maxLength: 2000, required: true, placeholder: 'Viết bình luận…', 'aria-label': 'Bình luận' });
  const send = h('button', { className: 'btn btn-primary btn-small', type: 'submit', textContent: 'Gửi' });
  const form = h('form', { className: 'form', onsubmit: (e) => { e.preventDefault(); busy(send, async () => { if (await NXHN.addComment(pid, user.id, ta.value.trim())) { ta.value = ''; say(''); f.load(true); } }); } }, ta, send);
  f.load(true);
  return h('div', { className: 'comments' }, f.el, form);
};
window.decoratePost = (li, p) => { // được renderPost() trong index.html gọi
  let box = null;
  const au = li.querySelector('.post-author'); // tên tác giả → mở hồ sơ đúng tài khoản
  if (au && p.author_id) {
    if (p.author && p.author.username) names.set(p.author_id, p.author.username);
    au.classList.add('name-link'); au.tabIndex = 0; au.setAttribute('role', 'button');
    au.onclick = () => openProfile(p.author_id);
    au.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openProfile(p.author_id); } };
    au.before(avt(p.author_id));
  }
  const media = h('div', { className: 'media' });
  const bar = h('div', { className: 'actions' }, btn('Bình luận', () => { if (box) box.hidden = !box.hidden; else li.append((box = comments(p.id))); }));
  bar.append(p.author_id === user.id
    ? btn('Xóa', async (b) => { if (confirm('Xóa bài viết này?') && await busy(b, () => NXHN.remove('posts', p.id))) li.remove(); }, 'btn-danger')
    : rep('post', p.id));
  li.append(media, bar); queueImg(media, 'post_id', p.id);
};
const pform = $('post-form'), pfile = h('input', { type: 'file', accept: IMG, 'aria-label': 'Ảnh đính kèm (tùy chọn)' });
pform.querySelector('.actions').prepend(pfile);
pform.onsubmit = (e) => {
  e.preventDefault();
  return lock(['btn-post'], async () => {
    const p = await NXHN.createPost(user.id, $('post-body').value.trim());
    if (!p) return;
    if (pfile.files[0]) await NXHN.uploadImage(user.id, pfile.files[0], { post_id: p.id });
    $('post-body').value = ''; pfile.value = ''; say(''); loadMore(true);
  });
};

// ---- Khung điều hướng ----
const app = $('app-view'), views = {}, loaders = {}, tabBtn = {}, tabLbl = {};
const TABICON = { home: 'home', explore: 'explore', chat: 'chat', notifs: 'bell', groups: 'users', settings: 'gear', admin: 'shield' };
const home = h('div', { id: 'view-home', className: 'view' });
[...app.children].slice(1).forEach((c) => home.append(c));
app.append(home);
const tabs = h('nav', { className: 'tabs', 'aria-label': 'Điều hướng' });
app.children[0].after(tabs);
const go = (key, quiet) => {
  for (const k in views) { views[k].hidden = k !== key; tabBtn[k].setAttribute('aria-current', k === key ? 'page' : 'false'); }
  if (!quiet) { say(''); loaders[key](); }
};
const addView = (key, label, load) => {
  const v = key === 'home' ? home : h('div', { id: 'view-' + key, className: 'view', hidden: true });
  if (key !== 'home') app.append(v);
  views[key] = v; loaders[key] = load;
  tabBtn[key] = h('button', { className: 'tab', type: 'button', title: label, onclick: () => go(key) }, ico(TABICON[key] || 'home'), (tabLbl[key] = h('span', { className: 'tab-lbl', textContent: label })));
  tabs.append(tabBtn[key]);
  return v;
};
addView('home', 'Trang chủ', () => loadMore(true));
const settingsView = addView('settings', 'Cài đặt', () => {});
settingsView.append($('profile-form'));

// ---- Khám phá: tìm người dùng, mở hồ sơ, follow, nhắn tin (thay mục "Mọi người") ----
const pv = addView('explore', 'Khám phá', async () => {
  const r = await NXHN.following();
  fol = new Set((Array.isArray(r) ? r : []).map((x) => x.followee_id));
  pf.load(true);
});
const sq = h('input', { type: 'search', maxLength: 30, placeholder: 'Tìm theo @username…', 'aria-label': 'Tìm người dùng', autocomplete: 'off', autocapitalize: 'none', spellcheck: false });
const pf = feed((c) => NXHN.people(c || 0, sq.value.trim().replace(/^@+/, '')), async (ul, rows) => {
  rows.forEach((r) => {
    names.set(r.id, r.username);
    ul.append(h('li', { className: 'post person' },
      h('button', { className: 'plain', type: 'button', 'aria-label': 'Xem hồ sơ ' + handle(r.username), onclick: () => openProfile(r.id) }, avt(r.id, 'lg')),
      h('div', { className: 'person-main' }, nameLink(r.id), h('p', { className: 'person-bio', textContent: r.bio || 'Chưa có giới thiệu.' })),
      h('div', { className: 'person-act' }, followBtn(r.id), ibtn('chat', 'Nhắn tin', (b) => dm(r.id, b)))));
  });
}, (c, rows) => (c || 0) + rows.length, 'Không tìm thấy ai.');
pv.append(h('h2', { textContent: 'Khám phá' }), h('div', { className: 'search' }, ico('search'), sq), pf.el);

// ---- Group chat: ẩn danh, menu ngữ cảnh, mời thành viên, hồ sơ, quản trị tài khoản (quyền thật ở hàm SQL nxhn-groupchat.sql) ----
const rpc = (n, a) => sb.rpc(n, a).then(({ data, error }) => (error ? fail(error.code === 'P0001' ? { userMessage: error.message } : error) : (data ?? true)));
const like = (s) => '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
const deb = (fn) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, 300); }; };
sq.oninput = deb(() => pf.load(true));
Object.assign(NXHN, {
  sendMessage: (c, s, body, reply) => sb.from('messages').insert({ conversation_id: c, sender_id: s, body, ...(reply ? { reply_to: reply } : {}) }).select().single().then(ok),
  loadMessages: async (c, before) => {
    const run = (cols) => { let q = sb.from('messages').select(cols).eq('conversation_id', c).order('created_at', { ascending: false }).limit(PAGE); if (before) q = q.lt('created_at', before); return q; };
    let r = await run('id,body,sender_id,created_at,kind,reply_to,deleted_at');
    if (r.error) r = await run('id,body,sender_id,created_at,kind,reply_to');
    if (r.error) r = await run('id,body,sender_id,created_at'); // chưa chạy SQL mới → chat cũ vẫn hoạt động
    const rows = ok(r);
    if (!Array.isArray(rows)) return rows;
    const ids = [...new Set(rows.map((m) => m.reply_to).filter(Boolean))];
    if (ids.length) {
      let rr = await sb.from('messages').select('id,body,deleted_at').in('id', ids);
      if (rr.error) rr = await sb.from('messages').select('id,body').in('id', ids);
      const by = Object.fromEntries((rr.data || []).map((x) => [x.id, x]));
      rows.forEach((m) => { m.reply = by[m.reply_to] || null; });
    }
    return rows;
  },
  // Xóa cho mọi người: ưu tiên hàm SQL delete_message (giữ "dấu vết" để mọi thành viên cùng thấy "Tin nhắn đã được xóa"); chưa chạy SQL → xóa hẳn như cũ.
  deleteMessage: async (id) => {
    const at = await sb.from('attachments').select('storage_path').eq('message_id', id);
    const r = await sb.rpc('delete_message', { p_id: id });
    if (r.error) {
      if (r.error.code === 'P0001') return fail({ userMessage: r.error.message });
      const d = await sb.from('messages').delete().eq('id', id).select('id');
      if (d.error) return fail(d.error);
      if (!d.data || !d.data.length) return fail({ code: '42501' });
    }
    const paths = (at.data || []).map((a) => a.storage_path);
    if (paths.length) sb.storage.from('media').remove(paths); // dọn file ảnh (nếu được phép)
    return true;
  },
  lastMsgs: async (ids) => { // tin mới nhất mỗi cuộc trò chuyện, một lượt truy vấn
    const run = (cols) => sb.from('messages').select(cols).in('conversation_id', ids).order('created_at', { ascending: false }).limit(Math.min(300, ids.length * 10));
    let r = await run('conversation_id,body,sender_id,created_at,kind,deleted_at');
    if (r.error) r = await run('conversation_id,body,sender_id,created_at,kind');
    if (r.error) r = await run('conversation_id,body,sender_id,created_at');
    const out = {}; (r.data || []).forEach((m) => { if (!out[m.conversation_id]) out[m.conversation_id] = m; });
    return out;
  },
  anonLeft: () => rpc('anon_balance'),
  sendAnon: (c, body, reply, req) => rpc('send_anon_message', { p_conv: c, p_body: body, p_reply: reply || null, p_req: req }),
  invitable: (c, s) => rpc('search_invitable', { p_conv: c, p_q: s }),
  invite: (c, u) => rpc('invite_to_conversation', { p_conv: c, p_user: u }),
  admUsers: (s) => rpc('admin_search_users', { p_q: s }),
  admGrant: (u) => rpc('admin_grant_anon', { p_user: u }),
  admBan: (u, b) => rpc('admin_set_banned', { p_user: u, p_banned: b }),
  admDel: (u) => rpc('admin_delete_user', { p_user: u }),
  admSender: (m) => rpc('admin_anon_sender', { p_message: m }),
  admGroups: (s) => sb.from('communities').select('id,name,description,is_private,community_members(count)').ilike('name', like(s)).order('created_at', { ascending: false }).limit(PAGE).then(ok),
});
const modal = (...k) => {
  const key = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); removeEventListener('keydown', key); };
  const box = h('div', { className: 'lightbox modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === box) close(); } }, h('div', { className: 'card sheet' }, ibtn('x', 'Đóng', close, 'sheet-x'), ...k));
  addEventListener('keydown', key); document.body.append(box); close.sheet = box.firstChild; return close;
};
let lpAt = 0; // vừa nhấn giữ mở menu → bỏ qua cú chạm nhả tay trên tên/avatar (không mở nhầm hồ sơ)
const openProfile = (id) => { if (id && Date.now() - lpAt > 700) profile(id); };
const dm = async (id, b, after) => {
  const c = await busy(b, () => NXHN.createConversation([id]));
  if (c) { if (after) after(); go('chat', true); openConv(c, handle(names.get(id)), false, id); }
};
const profile = async (id) => {
  const close = modal(), sh = close.sheet, x = sh.firstChild, self = id === user.id;
  sh.classList.add('profile'); sh.append(h('div', { className: 'skel tall' }), h('div', { className: 'skel' }));
  const sel = (c) => sb.from('profiles').select(c).eq('id', id).maybeSingle(); // chỉ cột công khai, không email/dữ liệu nội bộ
  const [r0, fr] = await Promise.all([sel('id,username,bio,display_name'), self ? null : sb.from('follows').select('followee_id').match({ follower_id: user.id, followee_id: id }).maybeSingle()]);
  const r = r0.error ? await sel('id,username,bio') : r0, p = r.data;
  if (!p) return sh.replaceChildren(x, h('p', { className: 'empty', textContent: r.error ? 'Không tải được hồ sơ. Hãy thử lại.' : 'Tài khoản không tồn tại hoặc bạn không có quyền xem.' }));
  names.set(id, p.username);
  if (fr) { if (fr.data) fol.add(id); else fol.delete(id); }
  const k = hue(id), dn = p.display_name && p.display_name !== p.username ? p.display_name : null;
  const cover = h('div', { className: 'cover' }); cover.style.background = `linear-gradient(135deg, hsl(${k} 45% 22%), hsl(${(k + 60) % 360} 50% 12%))`;
  const report = async () => { const t = (prompt('Lý do báo cáo (tối đa 1000 ký tự):') || '').trim(); if (t && await NXHN.report(user.id, 'profile', id, t)) say('Đã gửi báo cáo.'); };
  const acts = self ? [btn('Chỉnh sửa hồ sơ', () => { close(); go('settings'); }, 'btn-primary')]
    : [btn('Nhắn tin', (b) => dm(id, b, close), 'btn-primary'), followBtn(id), ibtn('more', 'Tùy chọn', (b) => { const q2 = b.getBoundingClientRect(); menu(q2.right - 170, q2.bottom + 4, [['Báo cáo hồ sơ', report]]); })];
  const pfd = feed((cur) => NXHN.userPosts(id, cur), async (ul, rows) => { rows.forEach((r2) => ul.append(renderPost({ ...r2, author: { username: p.username } }))); }, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có bài viết công khai.');
  sh.replaceChildren(x, cover, h('div', { className: 'profile-top' }, avt(id, 'huge'), h('div', { className: 'profile-act' }, acts)),
    h('h2', { className: 'profile-name', textContent: dn || handle(p.username) }), dn ? h('p', { className: 'post-time', textContent: handle(p.username) }) : null,
    h('p', { className: 'post-body', textContent: p.bio || 'Chưa có giới thiệu.' }), h('h3', { className: 'sec', textContent: 'Bài viết' }), pfd.el);
  pfd.load(true);
};
// Menu ngữ cảnh: chuột phải (máy tính) hoặc nhấn giữ 0,5 giây (cảm ứng).
let ctx = null, lp = 0;
const closeCtx = () => { if (ctx) { ctx.remove(); ctx = null; } };
const menu = (x, y, items) => {
  closeCtx();
  const me2 = (ctx = h('div', { className: 'ctx', role: 'menu' }, items.filter(Boolean).map(([t, fn, cls]) => h('button', { className: 'ctx-item ' + (cls || ''), type: 'button', role: 'menuitem', textContent: t, onclick: () => { closeCtx(); fn(); } }))));
  document.body.append(me2);
  me2.style.left = Math.max(4, Math.min(x, innerWidth - me2.offsetWidth - 4)) + 'px';
  me2.style.top = Math.max(4, Math.min(y, innerHeight - me2.offsetHeight - 4)) + 'px';
  me2.style.pointerEvents = 'none'; setTimeout(() => { me2.style.pointerEvents = ''; }, 350); // tránh bấm nhầm khi nhả tay
  me2.firstChild.focus();
};
addEventListener('pointerdown', (e) => { if (ctx && !ctx.contains(e.target)) closeCtx(); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });
const goneRow = (id) => h('li', { className: 'msg gone', 'data-id': id }, h('span', { textContent: 'Tin nhắn đã được xóa' }));
const markGone = (id) => { // thay đúng vị trí tin cũ bằng thông báo trung tính; không hiện lại nội dung/ảnh
  const li = mlist.querySelector(`[data-id="${id}"]`);
  if (!li || li.classList.contains('gone')) return;
  const nx = li.nextElementSibling;
  li.replaceWith(goneRow(id));
  if (nx && nx._m && nx.classList.contains('cont')) nx.replaceWith(msgRow(nx._m, null)); // cụm tin liền sau cần avatar/tên riêng
};
const delMsg = async (m) => {
  if (!confirm('Xóa tin nhắn này cho mọi người? Không thể hoàn tác.')) return;
  if (await NXHN.deleteMessage(m.id)) markGone(m.id);
};
const msgItems = (li, m) => {
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id;
  return [
    ['Sao chép', () => navigator.clipboard.writeText(m.body).then(() => say('Đã sao chép.'), () => say('Không sao chép được.'))],
    ['Trả lời', () => setReply(m)],
    own ? null : ['Báo cáo', async () => { const r = (prompt('Lý do báo cáo (tối đa 1000 ký tự):') || '').trim(); if (r && await NXHN.report(user.id, 'message', m.id, r)) say('Đã gửi báo cáo.'); }],
    own ? ['Xóa tin nhắn', () => delMsg(m), 'danger'] : null,
    isAdm && anon ? ['Xem người gửi (quản trị)', async () => { const u = await NXHN.admSender(m.id); if (u && u !== true) alert('Người gửi: ' + handle(u)); }] : null,
  ];
};
const arm = (li, m) => {
  const open = (x, y) => menu(x, y, msgItems(li, m));
  li.addEventListener('contextmenu', (e) => { e.preventDefault(); open(e.clientX, e.clientY); });
  li.addEventListener('touchstart', (e) => { const t = e.touches[0]; clearTimeout(lp); lp = setTimeout(() => { lpAt = Date.now(); open(t.clientX, t.clientY); }, 500); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => li.addEventListener(ev, () => clearTimeout(lp), { passive: true }));
};
// Trả lời + chế độ ẩn danh
const rbar = h('div', { className: 'reply-bar', hidden: true });
const setReply = (m) => {
  replyTo = m; rbar.hidden = !m;
  rbar.replaceChildren(...(m ? [h('span', { textContent: 'Trả lời: ' + m.body.slice(0, 60) }), btn('✕', () => setReply(null))] : []));
  if (m) mtext.focus();
};
const anonChk = h('input', { type: 'checkbox' }), anonLbl = h('label', { className: 'check anon-opt', hidden: true }, anonChk, h('span'));
let left = 0;
anonChk.onchange = () => { mfile.disabled = anonChk.checked; if (anonChk.checked) mfile.value = ''; syncFile(); };
const showLeft = async () => {
  const n = await NXHN.anonLeft();
  left = typeof n === 'number' ? n : 0;
  anonLbl.lastChild.textContent = left < 1 ? ' Ẩn danh: hết lượt, mỗi ngày nhận thêm 1 lượt' : ` Ẩn danh (còn ${left}/5 lượt, chỉ gửi chữ)`;
  anonChk.disabled = left < 1; if (left < 1) anonChk.checked = false;
  mfile.disabled = anonChk.checked; syncFile();
};
const plus = ibtn('plus', 'Mời thành viên', () => invitePanel()); plus.hidden = true;
const invitePanel = () => {
  const q = h('input', { placeholder: 'Tìm theo tên hoặc username…', maxLength: 30, 'aria-label': 'Tìm người để mời' }), ul = h('ul', { className: 'timeline' });
  const run = async () => {
    const r = await NXHN.invitable(cid, q.value.trim());
    ul.replaceChildren(...(Array.isArray(r) ? r : []).map((p) => h('li', { className: 'post who' }, av0(p.username, '', p.id), h('b', { textContent: handle(p.username) }),
      btn('Mời', async (b) => { if (await busy(b, () => NXHN.invite(cid, p.id))) { say('Đã thêm ' + handle(p.username) + ' vào nhóm.'); run(); } }, 'btn-primary'))));
    if (!ul.children.length) ul.append(h('li', { className: 'empty', textContent: 'Không còn ai để mời.' }));
  };
  q.oninput = deb(run); modal(h('h2', { textContent: 'Mời thành viên' }), q, ul); run();
};
// Quản trị: tài khoản + cộng đồng (backend tự kiểm tra role = admin)
const adminPanel = () => {
  const q = h('input', { placeholder: 'Tìm tài khoản theo username/tên…', maxLength: 30, 'aria-label': 'Tìm tài khoản' }), ul = h('ul', { className: 'timeline' });
  const gq = h('input', { placeholder: 'Tìm cộng đồng theo tên…', maxLength: 60, 'aria-label': 'Tìm cộng đồng' }), gu = h('ul', { className: 'timeline' });
  const users = async () => {
    const r = await NXHN.admUsers(q.value.trim());
    ul.replaceChildren(...(Array.isArray(r) ? r : []).map((u) => {
      const li = h('li', { className: 'post' }, h('span', { className: 'who' }, av0(u.username, '', u.id), h('b', { textContent: handle(u.username) + (u.display_name && u.display_name !== u.username ? ' · ' + u.display_name : '') })),
        h('p', { className: 'post-body', textContent: `${u.role === 'admin' ? 'Quản trị · ' : ''}${u.banned ? 'ĐÃ KHÓA' : 'Hoạt động'} · Lượt ẩn danh: ${u.balance}/5` }));
      if (u.role !== 'admin') li.append(h('div', { className: 'actions' },
        btn('Tặng 1 lượt', async (b) => { if (await busy(b, () => NXHN.admGrant(u.id))) { say('Đã tặng 1 lượt.'); users(); } }),
        btn(u.banned ? 'Mở khóa' : 'Khóa', async (b) => { if (confirm((u.banned ? 'Mở khóa ' : 'Khóa ') + handle(u.username) + '?') && await busy(b, () => NXHN.admBan(u.id, !u.banned))) users(); }),
        btn('Xóa', async (b) => { if (confirm('XÓA VĨNH VIỄN ' + handle(u.username) + '? Không thể hoàn tác.') && await busy(b, () => NXHN.admDel(u.id))) users(); }, 'btn-danger')));
      return li;
    }));
    if (!ul.children.length) ul.append(h('li', { className: 'empty', textContent: 'Không tìm thấy tài khoản.' }));
  };
  const grp = async () => {
    const [cs, ms] = await Promise.all([NXHN.admGroups(gq.value.trim()), NXHN.myCommunities()]);
    const role = new Map((Array.isArray(ms) ? ms : []).map((m) => [m.community_id, m.role]));
    gu.replaceChildren(...(Array.isArray(cs) ? cs : []).map((c) => h('li', { className: 'post' },
      h('b', { textContent: c.name }), ' ', h('span', { className: 'tag', textContent: c.is_private ? 'Riêng tư' : 'Công khai' }),
      h('span', { className: 'post-time', textContent: `${(c.community_members && c.community_members[0] && c.community_members[0].count) || 0} thành viên` }),
      h('p', { className: 'post-body', textContent: c.description }),
      role.has(c.id) ? (role.get(c.id) === 'owner' ? h('em', { textContent: 'Bạn là chủ nhóm.' }) : btn('Rời nhóm', async (b) => { if (await busy(b, () => NXHN.leaveCommunity(c.id))) grp(); }))
        : c.is_private ? h('em', { textContent: 'Nhóm riêng tư — cần lời mời, quản trị không tự vào được.' })
        : btn('Join', async (b) => { if (await busy(b, () => NXHN.joinCommunity(c.id, user.id))) grp(); }, 'btn-primary'))));
    if (!gu.children.length) gu.append(h('li', { className: 'empty', textContent: 'Không tìm thấy nhóm.' }));
  };
  q.oninput = deb(users); gq.oninput = deb(grp);
  return { el: h('div', {}, h('h2', { textContent: 'Tài khoản' }), q, ul, h('h2', { textContent: 'Cộng đồng' }), gq, gu), load: () => { users(); grp(); } };
};

// ---- Chat ----
const cv = addView('chat', 'Chat', () => { convList(); if (cid) { pin = true; requestAnimationFrame(toEnd); } });
const clist = h('ul', { className: 'convs' }), mlist = h('ul', { className: 'messages' });
const olderBtn = btn('Tin cũ hơn', (b) => busy(b, () => loadMsgs(true)));
olderBtn.hidden = true; olderBtn.classList.add('older');
// Thanh nhập: ô tự cao tới giới hạn, Enter gửi / Shift+Enter xuống dòng (chỉ khi có chuột/bàn phím; trên điện thoại Enter = xuống dòng).
const mtext = h('textarea', { rows: 1, maxLength: 4000, placeholder: 'Nhập tin nhắn…', 'aria-label': 'Tin nhắn', enterKeyHint: 'send' });
const mfile = h('input', { type: 'file', accept: IMG, hidden: true, 'aria-label': 'Ảnh đính kèm (tùy chọn)' });
const attachBtn = ibtn('image', 'Đính kèm ảnh', () => mfile.click());
const fname = h('span', { className: 'fname' });
const fchip = h('div', { className: 'file-chip', hidden: true }, ico('image'), fname, ibtn('x', 'Bỏ ảnh', () => { mfile.value = ''; syncFile(); }));
const syncFile = () => { const f = mfile.files[0]; attachBtn.disabled = mfile.disabled; fchip.hidden = !f; fname.textContent = f ? f.name : ''; };
mfile.onchange = syncFile;
const msend = h('button', { className: 'btn btn-primary send-btn', type: 'submit', title: 'Gửi', 'aria-label': 'Gửi tin nhắn', disabled: true }, ico('send'));
const upd = () => { msend.disabled = sending || !mtext.value.trim(); };
const fit = () => { mtext.style.height = 'auto'; mtext.style.height = Math.min(mtext.scrollHeight, 140) + 'px'; };
const fine = matchMedia('(pointer: fine)');
mtext.oninput = () => { fit(); upd(); };
mtext.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && fine.matches) { e.preventDefault(); if (!msend.disabled) mform.requestSubmit(); } };
mtext.onfocus = () => setTimeout(() => { if (pin) toEnd(); }, 300); // bàn phím ảo bật lên → giữ tin cuối trong tầm nhìn
if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (pin && cid) toEnd(); });
const showImg = async (node, path) => { // hiện ảnh vừa gửi ngay trong bubble, không cần tải lại
  const has = () => [...node.children].some((c) => c.dataset && c.dataset.p === path);
  if (!node || has()) return;
  const u = await NXHN.signedUrl(path);
  if (u && node.isConnected && !has()) node.append(mkImg(u, path, true));
};
const addMsg = (m) => { // thêm đúng một tin (không dựng lại cả hội thoại); bỏ qua nếu đã có → không trùng
  if (mlist.querySelector(`[data-id="${m.id}"]`)) return null;
  mlist.querySelectorAll('.msgs-empty').forEach((x) => x.remove());
  const li = msgRow(m, mlist.lastElementChild && mlist.lastElementChild._m);
  mlist.append(li);
  if (pin) toEnd();
  return li;
};
const mform = h('form', { className: 'chat-form', onsubmit: async (e) => {
  e.preventDefault();
  const body = mtext.value.trim(), rid = replyTo && replyTo.id, file = mfile.files[0], c0 = cid;
  if (!c0 || !body || sending) return;
  sending = true; upd();
  try {
    if (anonChk.checked) {
      if (left < 1) return say('Bạn đã hết lượt ẩn danh.');
      if (!(await NXHN.sendAnon(c0, body, rid, reqId))) return; // reqId giữ nguyên khi gửi lại → server không trừ lượt hai lần
      reqId = crypto.randomUUID(); showLeft();
      pin = true; mtext.value = ''; fit(); setReply(null); say('');
      if (cid === c0) await loadMsgs(false);
      return;
    }
    const m = await NXHN.sendMessage(c0, user.id, body, rid);
    if (!m) return;
    if (replyTo) m.reply = { id: replyTo.id, body: replyTo.body };
    pin = true; mtext.value = ''; mfile.value = ''; fit(); syncFile(); setReply(null); say('');
    if (cid === c0) addMsg(m); // hiện ngay, không chờ tải ảnh
    if (file) {
      say('Đang gửi ảnh…');
      const a = await NXHN.uploadImage(user.id, file, { message_id: m.id });
      if (a && a.storage_path) { await showImg(mlist.querySelector(`[data-id="${m.id}"] .media`), a.storage_path); say(''); }
    }
  } finally { sending = false; upd(); }
} }, fchip, anonLbl, attachBtn, mtext, msend, mfile);
upd();
const back = ibtn('back', 'Quay lại danh sách chat', () => { cid = null; oldest = null; peer = null; chatBox.removeAttribute('data-open'); convList(); }, 'back-btn');
const ctitle = h('span', { className: 'ct-name' }), csub = h('span', { className: 'ct-sub' }), cav = h('span', { className: 'ct-av' });
const members = async () => {
  const ul = h('ul', { className: 'timeline' }, ...skel(2));
  modal(h('h2', { textContent: 'Thành viên' }), ul);
  const ms = await NXHN.members([cid]), ids = [...new Set((Array.isArray(ms) ? ms : []).map((m) => m.user_id))];
  await nm(ids);
  ul.replaceChildren(...ids.map((id) => h('li', { className: 'post person' }, h('button', { className: 'plain', type: 'button', 'aria-label': 'Xem hồ sơ ' + N(id), onclick: () => openProfile(id) }, avt(id, 'lg')),
    h('div', { className: 'person-main' }, nameLink(id, id === user.id ? N(id) + ' (bạn)' : undefined)))));
};
const cinfo = h('button', { className: 'plain ct-info', type: 'button', 'aria-label': 'Xem thông tin cuộc trò chuyện', onclick: () => (isGroup ? members() : openProfile(peer)) }, ctitle, csub);
const head = h('div', { className: 'chat-head' }, back, cav, cinfo, plus,
  ibtn('more', 'Tùy chọn', (b) => { const r = b.getBoundingClientRect(); menu(r.right - 180, r.bottom + 4, [isGroup ? ['Thành viên', members] : (peer ? ['Xem hồ sơ', () => openProfile(peer)] : null), isGroup ? ['Mời thành viên', () => invitePanel()] : null]); }));
const newGroup = () => {
  const box = h('div', { className: 'checks' }), title = h('input', { maxLength: 100, placeholder: 'Tên nhóm', 'aria-label': 'Tên nhóm' });
  const ok2 = h('button', { className: 'btn btn-primary btn-small', type: 'submit', textContent: 'Tạo nhóm' });
  const f = h('form', { className: 'form', onsubmit: (e) => {
    e.preventDefault();
    busy(ok2, async () => {
      const ids = [...box.querySelectorAll('input:checked')].map((i) => i.value);
      const id = await NXHN.createConversation(ids, title.value.trim());
      if (id) openConv(id, title.value.trim() || 'Nhóm', true);
    });
  } }, title, box, ok2);
  return h('details', { className: 'card', ontoggle: async (e) => {
    if (!e.target.open || box.children.length) return;
    const r = await NXHN.people(0);
    (Array.isArray(r) ? r : []).forEach((p) => box.append(h('label', { className: 'check' }, h('input', { type: 'checkbox', value: p.id }), ' ' + handle(p.username))));
  } }, h('summary', { textContent: 'Tạo nhóm chat' }), f);
};
const chatBox = h('div', { className: 'chat' },
  h('div', { className: 'chat-list' }, newGroup(), clist),
  h('div', { className: 'chat-pane' }, head, olderBtn, mlist, rbar, mform),
  h('div', { className: 'chat-empty' }, ico('chat'), h('p', { textContent: 'Chọn một cuộc trò chuyện để bắt đầu.' })));
cv.append(chatBox);
mlist.addEventListener('scroll', () => { pin = mlist.scrollHeight - mlist.scrollTop - mlist.clientHeight < 80; }, { passive: true });
const convInfo = new Map();
const convList = async () => {
  const cs = await NXHN.conversations();
  if (!Array.isArray(cs)) { if (!clist.children.length) clist.append(h('li', { className: 'empty', textContent: 'Không tải được danh sách chat.' })); return; }
  const ms = cs.length ? await NXHN.members(cs.map((c) => c.id)) : [], mem = Array.isArray(ms) ? ms : [];
  const last = cs.length ? await NXHN.lastMsgs(cs.map((c) => c.id)) : {};
  await nm([...mem.map((m) => m.user_id), ...Object.values(last).map((l) => l.sender_id)]);
  const rows = cs.map((c) => {
    const all = mem.filter((m) => m.conversation_id === c.id), others = all.filter((m) => m.user_id !== user.id).map((m) => m.user_id);
    convInfo.set(c.id, { peer: c.is_group ? null : others[0] || null, count: all.length });
    return { c, l: last[c.id], t: c.title || others.map(N).join(', ') || 'Cuộc trò chuyện' };
  }).sort((a, b) => new Date(b.l ? b.l.created_at : b.c.created_at) - new Date(a.l ? a.l.created_at : a.c.created_at));
  const prev = ({ c, l }) => !l ? 'Chưa có tin nhắn' : l.deleted_at ? 'Tin nhắn đã được xóa'
    : (l.kind === 'anon' ? 'Ẩn danh: ' : l.sender_id === user.id ? 'Bạn: ' : (c.is_group && l.sender_id ? N(l.sender_id) + ': ' : '')) + l.body;
  clist.replaceChildren(...rows.map((r) => h('li', {}, h('button', { className: 'conv' + (r.c.id === cid ? ' active' : ''), type: 'button', 'data-id': r.c.id, onclick: () => openConv(r.c.id, r.t, r.c.is_group) },
    r.c.is_group ? av0(r.t, 'grp lg') : avt(convInfo.get(r.c.id).peer || '?', 'lg'),
    h('span', { className: 'conv-main' },
      h('span', { className: 'conv-top' }, h('b', { className: 'conv-name', textContent: r.t }), h('time', { className: 'conv-time', textContent: r.l ? ago(r.l.created_at) : '' })),
      h('span', { className: 'conv-prev', textContent: prev(r) }))))));
  if (!cs.length) clist.append(h('li', { className: 'empty', textContent: 'Chưa có cuộc trò chuyện. Vào Khám phá để tìm người và nhắn tin.' }));
};
const openConv = (id, title, grp, pid) => {
  const ci = convInfo.get(id) || {};
  cid = id; pin = true; isGroup = !!grp; peer = grp ? null : (pid || ci.peer || null);
  plus.hidden = anonLbl.hidden = !isGroup; anonChk.checked = false; setReply(null); if (isGroup) showLeft(); syncFile();
  oldest = null; // Không dùng mốc phân trang của cuộc trò chuyện trước.
  ctitle.textContent = title;
  csub.textContent = isGroup ? (ci.count ? ci.count + ' thành viên' : 'Nhóm chat') : ''; csub.hidden = !csub.textContent;
  cav.replaceChildren(isGroup ? av0(title, 'grp') : avt(peer || '?'));
  chatBox.dataset.open = '1';
  clist.querySelectorAll('.conv').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  mtext.value = ''; fit(); upd();
  mlist.replaceChildren(...skel(3));
  loadMsgs(false);
};
const msgRow = (m, prev) => {
  if (m.deleted_at) return goneRow(m.id);
  if (m.kind === 'system') return h('li', { className: 'msg gone sys', 'data-id': m.id }, h('span', { textContent: m.body })); // thành viên vào/rời nhóm…
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id, media = h('div', { className: 'media' });
  // nhóm trực quan: tin liên tiếp của cùng một người (trong 5 phút) chỉ hiện avatar/tên ở tin đầu cụm
  const cont = !anon && !!prev && !prev.deleted_at && prev.kind !== 'anon' && prev.kind !== 'system' && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 300000;
  const side = own ? null : h('span', { className: 'msg-av' }, cont ? null : anon ? av0('?', 'anon-av')
    : h('button', { className: 'plain', type: 'button', 'aria-label': 'Xem hồ sơ ' + N(m.sender_id), onclick: () => openProfile(m.sender_id) }, avt(m.sender_id)));
  const bub = h('div', { className: 'bubble' },
    cont || own ? null : anon ? h('b', { className: 'msg-name', textContent: 'Ẩn danh' }) : (isGroup ? h('span', { className: 'msg-name' }, nameLink(m.sender_id)) : null),
    m.reply ? h('blockquote', { className: 'quote', textContent: (m.reply.deleted_at ? 'Tin nhắn đã được xóa' : m.reply.body).slice(0, 80) }) : null,
    h('p', { className: 'post-body', textContent: m.body }), media,
    h('time', { className: 'post-time', dateTime: m.created_at, textContent: hm(m.created_at), title: when(m.created_at) }));
  const li = h('li', { className: 'msg ' + (anon ? 'anon' : own ? 'mine' : 'other') + (cont ? ' cont' : ''), 'data-id': m.id });
  const more = ibtn('more', 'Tùy chọn tin nhắn', (b) => { const r = b.getBoundingClientRect(); menu(r.left, r.bottom + 2, msgItems(li, m)); }, 'msg-more');
  li.append(...(own ? [more, bub] : [side, bub, more]));
  li._m = m;
  if (!anon) queueImg(media, 'message_id', m.id);
  arm(li, m);
  return li;
};
const loadMsgs = async (older) => {
  const c0 = cid, rows = await NXHN.loadMessages(c0, older ? oldest : null);
  if (c0 !== cid) return; // đã chuyển sang cuộc trò chuyện khác
  mlist.querySelectorAll('.skel').forEach((x) => x.remove());
  if (!Array.isArray(rows)) {
    if (!older && !mlist.children.length) mlist.append(h('li', { className: 'msgs-empty empty' }, 'Không tải được tin nhắn. ', btn('Thử lại', () => loadMsgs(false))));
    return;
  }
  await nm(rows.map((m) => m.sender_id));
  if (c0 !== cid) return;
  rows.reverse(); // API trả mới → cũ; hiển thị cũ → mới
  const nodes = rows.map((m, i) => msgRow(m, rows[i - 1]));
  if (older) {
    const oldHeight = mlist.scrollHeight;
    mlist.prepend(...nodes);
    mlist.scrollTop = mlist.scrollHeight - oldHeight;
  } else {
    const stick = pin;
    mlist.replaceChildren(...nodes);
    if (!nodes.length) mlist.append(h('li', { className: 'msgs-empty empty', textContent: 'Chưa có tin nhắn. Hãy gửi lời chào!' }));
    if (stick) { toEnd(); requestAnimationFrame(toEnd); } // vào chat → tin mới nhất; ảnh tải xong (onload) giữ đáy
  }
  if (rows.length) oldest = rows[0].created_at;
  olderBtn.hidden = rows.length < PAGE;
};

// ---- Thông báo ----
const badge = async () => { const n = await NXHN.unread(); tabBtn.notifs.dataset.n = n ? String(n > 99 ? '99+' : n) : ''; };
const nv = addView('notifs', 'Thông báo', () => { nf.load(true); badge(); });
const nf = feed((c) => NXHN.loadNotifications(c), async (ul, rows) => {
  await nm(rows.map((r) => r.actor_id));
  rows.forEach((r) => {
    const li = h('li', { className: 'post' }, r.read_at ? null : h('b', { className: 'tag', textContent: 'Mới ' }),
      nameLink(r.actor_id), ` ${r.type === 'follow' ? 'đã follow bạn' : 'đã bình luận bài viết của bạn'} `, h('time', { className: 'post-time', textContent: when(r.created_at) }));
    if (!r.read_at) li.append(btn('Đã đọc', async (b) => { if (await busy(b, () => NXHN.markRead(r.id))) { li.firstChild.remove(); b.remove(); badge(); } }));
    ul.append(li);
  });
}, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có thông báo.');
nv.append(btn('Đánh dấu tất cả đã đọc', async (b) => { if (await busy(b, () => NXHN.markAllRead())) { nf.load(true); badge(); } }), nf.el);

// ---- Cộng đồng ----
const gv = addView('groups', 'Nhóm', () => { cbox.hidden = true; gl.hidden = false; gform.hidden = false; groups(); });
const gl = h('ul', { className: 'timeline' }), cbox = h('div', { hidden: true });
const gname = h('input', { minLength: 3, maxLength: 60, required: true, placeholder: 'Tên cộng đồng (3–60 ký tự)', 'aria-label': 'Tên cộng đồng' });
const gdesc = h('textarea', { rows: 2, maxLength: 500, placeholder: 'Mô tả', 'aria-label': 'Mô tả cộng đồng' });
const gpriv = h('input', { type: 'checkbox' }), gsend = h('button', { className: 'btn btn-primary btn-small', type: 'submit', textContent: 'Tạo cộng đồng' });
const gform = h('form', { className: 'card form', onsubmit: (e) => {
  e.preventDefault();
  busy(gsend, async () => { if (await NXHN.createCommunity(user.id, gname.value.trim(), gdesc.value.trim(), gpriv.checked)) { gform.reset(); say('Đã tạo cộng đồng.'); groups(); } });
} }, h('h2', { textContent: 'Tạo cộng đồng' }), gname, gdesc, h('label', { className: 'check' }, gpriv, ' Riêng tư (chỉ thành viên xem được)'), gsend);
gv.append(gform, gl, cbox);
const groups = async () => {
  const [cs, ms] = await Promise.all([NXHN.communities(), NXHN.myCommunities()]);
  if (!Array.isArray(cs)) return;
  mine = new Map((Array.isArray(ms) ? ms : []).map((m) => [m.community_id, m.role]));
  gl.replaceChildren(...cs.map((c) => h('li', { className: 'post' }, h('b', { textContent: c.name }), c.is_private ? ' (riêng tư)' : '', h('p', { className: 'post-body', textContent: c.description }),
    h('div', { className: 'actions' }, btn('Mở', () => openGroup(c)),
      mine.has(c.id)
        ? (mine.get(c.id) === 'owner' ? null : btn('Rời nhóm', async (b) => { if (await busy(b, () => NXHN.leaveCommunity(c.id))) groups(); }))
        : (c.is_private ? null : btn('Tham gia', async (b) => { if (await busy(b, () => NXHN.joinCommunity(c.id, user.id))) groups(); }))))));
  if (!cs.length) gl.append(h('li', { className: 'empty', textContent: 'Chưa có cộng đồng nào.' }));
};
const openGroup = (c) => {
  gl.hidden = true; gform.hidden = true; cbox.hidden = false; cbox.replaceChildren();
  const f = feed((cur) => NXHN.communityPosts(c.id, cur), async (ul, rows) => {
    await nm(rows.map((r) => r.author_id));
    rows.forEach((r) => ul.append(renderPost({ ...r, author: { username: names.get(r.author_id) } })));
  }, (cur, rows) => rows[rows.length - 1].created_at, 'Chưa có bài trong cộng đồng.');
  const ta = h('textarea', { rows: 3, maxLength: 5000, required: true, placeholder: 'Viết trong cộng đồng…', 'aria-label': 'Bài viết trong cộng đồng' });
  const s = h('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Đăng vào cộng đồng' });
  const form = h('form', { className: 'card form', onsubmit: (e) => {
    e.preventDefault();
    busy(s, async () => { if (await NXHN.createPost(user.id, ta.value.trim(), c.id)) { ta.value = ''; say(''); f.load(true); } });
  } }, ta, s);
  cbox.append(btn('← Các cộng đồng', () => { cbox.hidden = true; gl.hidden = false; gform.hidden = false; }), h('h2', { textContent: c.name }),
    mine.has(c.id) ? form : h('p', { className: 'empty', textContent: 'Tham gia cộng đồng để đăng bài.' }), f.el);
  if (mine.get(c.id) === 'owner') NXHN.people(0).then((ps) => {
    if (!Array.isArray(ps)) return;
    const sel = h('select', { 'aria-label': 'Chọn người để thêm' }, ps.map((p) => h('option', { value: p.id, textContent: handle(p.username) })));
    cbox.append(h('div', { className: 'actions' }, sel, btn('Thêm thành viên', (b) => busy(b, async () => { if (await NXHN.joinCommunity(c.id, sel.value)) say('Đã thêm thành viên.'); }))));
  });
  f.load(true);
};

// ---- Quản trị (nút chỉ hiện với admin; quyền thật ở hàm SQL resolve_report) ----
const av = addView('admin', 'Quản trị', () => { ap.load(); af.load(true); });
const af = feed((c) => NXHN.openReports(c || 0), async (ul, rows) => {
  for (const r of rows) {
    const t = { post: 'posts', comment: 'comments', message: 'messages' }[r.target_type];
    const res = t ? await sb.from(t).select('body').eq('id', r.target_id).maybeSingle() : await sb.from('profiles').select('username').eq('id', r.target_id).maybeSingle();
    const c = res.data, li = h('li', { className: 'post' }, h('b', { textContent: `Báo cáo: ${r.target_type}` }),
      h('p', { className: 'post-body', textContent: 'Lý do: ' + r.reason }), h('p', { className: 'post-body', textContent: 'Nội dung: ' + (c ? (c.body || handle(c.username)) : '(không còn)') }));
    const act = (a) => async (b) => {
      const note = prompt('Ghi chú (tùy chọn):');
      if (note === null || (a === 'remove_content' && !confirm('Xóa nội dung này?'))) return;
      if (await busy(b, () => NXHN.resolveReport(r.id, a, note.trim()))) li.remove();
    };
    li.append(h('div', { className: 'actions' }, btn('Bỏ qua', act('dismiss')), r.target_type === 'profile' ? null : btn('Xóa nội dung', act('remove_content'), 'btn-danger')));
    ul.append(li);
  }
}, (c, rows) => (c || 0) + rows.length, 'Không có báo cáo đang mở.');
const ap = adminPanel(); av.append(ap.el, h('h2', { textContent: 'Báo cáo đang mở' }), af.el);
tabBtn.admin.before(tabBtn.settings); // Cài đặt đứng cuối (trước Quản trị)

// ---- Vòng đời đăng nhập/đăng xuất ----
const refreshList = deb(() => { if (!cid || fine.matches) convList(); }); // cập nhật dòng xem trước + giờ khi có tin mới/xóa
const live = () => {
  ch = sb.channel('nxhn-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (e) => {
      const m = e.new;
      if (m.conversation_id === cid && !(m.sender_id === user.id && sending)) { // tin của chính mình đang gửi → bỏ qua, tự thêm ở onsubmit (tránh trùng/đua dữ liệu)
        await nm([m.sender_id]);
        if (m.reply_to) { const r = await sb.from('messages').select('id,body').eq('id', m.reply_to).maybeSingle(); if (r.data) m.reply = r.data; }
        if (m.conversation_id === cid && addMsg(m) && m.kind !== 'anon' && m.sender_id !== user.id) {
          // ảnh được tải lên SAU khi tin được tạo → kiểm tra lại một lần nữa (phòng khi realtime của attachments chưa bật)
          setTimeout(() => { const med = mlist.querySelector(`[data-id="${m.id}"] .media:empty`); if (med) queueImg(med, 'message_id', m.id); }, 4000);
        }
      }
      refreshList();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (e) => { if (e.new && e.new.deleted_at) markGone(e.new.id); refreshList(); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (e) => { if (e.old && e.old.id) markGone(e.old.id); refreshList(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => badge())
    .subscribe();
  // kênh riêng cho ảnh: nếu bảng attachments chưa nằm trong publication thì chỉ kênh này lỗi, chat vẫn chạy
  ch2 = sb.channel('nxhn-att')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attachments' }, (e) => {
      const id = e.new && e.new.message_id, med = id && mlist.querySelector(`[data-id="${id}"] .media`);
      if (med) queueImg(med, 'message_id', id);
    })
    .subscribe();
};
const reset = () => {
  names.clear(); fol.clear(); mine.clear(); convInfo.clear(); cid = null; peer = null; clearInterval(timer);
  if (ch) { sb.removeChannel(ch); ch = null; }
  if (ch2) { sb.removeChannel(ch2); ch2 = null; }
  [clist, mlist, gl, cbox].forEach((x) => x.replaceChildren());
  [pf, nf, af].forEach((f) => f.clear());
  sq.value = ''; mtext.value = ''; fit(); upd();
  chatBox.removeAttribute('data-open'); cbox.hidden = true; gl.hidden = false; gform.hidden = false;
  tabBtn.notifs.dataset.n = ''; tabBtn.admin.hidden = true; isAdm = false; setReply(null);
  go('home', true);
};
reset();
sb.auth.onAuthStateChange((_e, s) => setTimeout(async () => {
  const id = s ? s.user.id : null;
  if (id === me) return;
  me = id; reset();
  if (!id) return;
  live(); badge(); timer = setInterval(badge, 60000);
  if (await NXHN.isAdmin()) { isAdm = true; tabBtn.admin.hidden = false; }
}, 0));
})();
