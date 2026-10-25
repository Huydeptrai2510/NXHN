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
const names = new Map(), avPath = new Map(), avUrl = new Map(), avDone = new Set();
// Avatar lưu ở profiles.avatar_path (nhóm: conversations.avatar_path, khóa 'g:<id>'). URL ký 1 giờ, dùng chung cho mọi vị trí hiển thị.
const applyAv = (e) => {
  const u = avUrl.get(avPath.get(e.dataset.uid));
  if (!u || e.dataset.av === u) return;
  e.dataset.av = u; e.replaceChildren(h('img', { src: u, alt: '', draggable: false }));
};
const paint = () => document.querySelectorAll('.avatar[data-uid]').forEach(applyAv);
const signAv = async (paths) => {
  const need = [...new Set(paths)].filter((p) => p && !avUrl.has(p));
  if (!need.length) return;
  const s = await sb.storage.from('media').createSignedUrls(need, 3600);
  (s.data || []).forEach((x) => { if (x.signedUrl) avUrl.set(x.path, x.signedUrl); });
};
const nm = async (ids) => {
  const need = [...new Set(ids)].filter((i) => i && !avDone.has(i));
  if (!need.length) return;
  let r = await sb.from('profiles').select('id,username,avatar_path').in('id', need);
  if (r.error) r = await sb.from('profiles').select('id,username').in('id', need); // chưa chạy SQL mới → vẫn hiện tên
  (r.data || []).forEach((p) => { names.set(p.id, p.username); if (p.avatar_path) avPath.set(p.id, p.avatar_path); });
  need.forEach((i) => avDone.add(i));
  await signAv([...avPath.values()]); paint();
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
  gear: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  sticker: 'M12 3a9 9 0 109 9V3zM9 10h.01M15 10h.01M8.5 14.5c1.7 2 5.3 2 7 0', info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8h.01',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9', reply: 'M9 14L4 9l5-5M4 9h10a6 6 0 016 6v3', pin: 'M12 17v5M8 3h8l-1.5 6 3 3.5H6.5l3-3.5z', bookmark: 'M6 3h12v18l-6-4-6 4z', flag: 'M5 21V4M5 4h13l-2 4 2 4H5', copy: 'M9 9h11v11H9zM5 15V4h11', medal: 'M12 15a6 6 0 100-12 6 6 0 000 12zM8.2 13.3L7 22l5-3 5 3-1.2-8.7', poll: 'M3 20h18M6 20v-9M12 20V4M18 20v-6', check: 'M5 12l5 5 9-10', at: 'M16 12a4 4 0 11-8 0 4 4 0 018 0zM16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94', user: 'M20 21v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1M12 11a4 4 0 100-8 4 4 0 000 8z',
};
const ico = (n) => {
  const s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  p.setAttribute('d', ICON[n] || ICON.more); s.append(p); return s;
};
const ibtn = (icon, label, fn, cls = '') => h('button', { className: 'ibtn ' + cls, type: 'button', title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); fn(e.currentTarget); } }, ico(icon));
// Nút chọn ảnh thống nhất: ô file gốc được ẩn (vẫn dùng được bằng bàn phím), hiện nút gọn + tên tệp + nút bỏ chọn.
const pickBtn = (inp, text = 'Chọn ảnh', none = 'Chưa chọn ảnh') => {
  inp.classList.add('file-native');
  const name = h('span', { className: 'file-name', textContent: none });
  const x = ibtn('x', 'Bỏ ảnh đã chọn', () => { inp.value = ''; inp.dispatchEvent(new Event('change')); }, 'file-x');
  const sync = () => { const f = inp.files && inp.files[0]; name.textContent = f ? f.name : none; x.hidden = !f; };
  inp.addEventListener('change', sync); sync();
  const box = h('div', { className: 'file-row' }, h('label', { className: 'file-pick' }, inp, h('span', { className: 'file-btn' }, ico('image'), text), name), x);
  box.sync = sync; return box;
};
// Avatar: cùng một tài khoản luôn cùng chữ cái + màu (màu sinh từ id) ở danh sách chat, khung chat, hồ sơ, Khám phá.
const hue = (s) => { let n = 0; for (const c of String(s || '?')) n = (n * 31 + c.charCodeAt(0)) % 360; return n; };
const av0 = (name, cls = '', key = name) => {
  const e = h('span', { className: 'avatar ' + cls, 'aria-hidden': 'true', textContent: (name || '?').replace('@', '').charAt(0).toUpperCase() });
  if (!cls.includes('anon-av')) { const k = hue(key); e.style.background = `hsl(${k} 42% 22%)`; e.style.color = `hsl(${k} 85% 74%)`; }
  return e;
};
const avt = (id, cls = '') => { const e = av0(names.get(id) || '?', cls, id); e.dataset.uid = id; applyAv(e); return e; };
const gav = (id, title, cls = '') => { const e = av0(title || 'Nhóm', 'grp ' + cls, id); e.dataset.uid = 'g:' + id; applyAv(e); return e; };
const nameLink = (id, label) => h('button', { className: 'name-link', type: 'button', textContent: label == null ? N(id) : label, onclick: () => openProfile(id) });
const skel = (n = 3) => Array.from({ length: n }, () => h('li', { className: 'skel', 'aria-hidden': 'true' }));
const hm = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const ago = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? hm(t) : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); };
// Quan hệ: Theo dõi → Đang theo dõi → Bạn bè (hai bên cùng theo dõi; tính ở máy chủ bằng my_friend_ids/friend_count).
const relLabel = (id) => (frd.has(id) ? 'Bạn bè' : fol.has(id) ? 'Đang theo dõi' : 'Theo dõi');
const syncRel = () => document.querySelectorAll('button[data-rel]').forEach((b) => {
  const id = b.dataset.rel; b.textContent = relLabel(id);
  b.classList.toggle('btn-primary', !fol.has(id)); b.classList.toggle('btn-secondary', fol.has(id));
});
const loadRel = async () => {
  const [r, f] = await Promise.all([NXHN.following(), NXHN.friends()]);
  if (Array.isArray(r)) fol = new Set(r.map((x) => x.followee_id));
  if (Array.isArray(f)) frd = new Set(f);
  syncRel(); return Array.isArray(r);
};
const followBtn = (id) => {
  const b = btn(relLabel(id), (b2) => busy(b2, async () => {
    if (fol.has(id) && !(await confirmBox(`Bỏ theo dõi ${N(id)}?` + (frd.has(id) ? ' Hai bạn sẽ không còn là bạn bè.' : ''), 'Bỏ theo dõi', true))) return;
    if (await (fol.has(id) ? NXHN.unfollow(user.id, id) : NXHN.follow(user.id, id))) {
      fol.has(id) ? fol.delete(id) : fol.add(id);
      syncRel(); await loadRel();
    }
  }), fol.has(id) ? 'btn-secondary' : 'btn-primary');
  b.dataset.rel = id; return b;
};
const rpc = (n, a) => sb.rpc(n, a).then(({ data, error }) => (error ? fail(error.code === 'P0001' ? { userMessage: error.message } : /PGRST202|42883/.test(error.code || '') ? { userMessage: `Chưa áp dụng SQL nâng cấp (hàm ${n}).` } : error) : (data ?? true)));
const deb = (fn) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, 300); }; };
let cid = null, oldest = null, ch = null, ch2 = null, ch3 = null, ch4 = null, timer = 0, actT = 0, lastAct = 0, me = null, fol = new Set(), frd = new Set(), isAdm = false, isGroup = false, peer = null, sending = false, replyTo = null, reqId = crypto.randomUUID();

Object.assign(NXHN, {
  findUser: (u) => sb.from('profiles').select('id,username,bio').neq('id', user.id).eq('username', u).limit(1).then(ok), // chỉ khớp chính xác @username
  byIds: (ids) => sb.from('profiles').select('id,username,bio').in('id', ids).order('username').limit(500).then(ok),
  friends: async () => {
    const r = await sb.rpc('my_friend_ids');
    if (!r.error && Array.isArray(r.data)) return r.data.map((x) => (x && typeof x === 'object' ? Object.values(x)[0] : x));
    const [a, b] = await Promise.all([NXHN.following(), sb.from('follows').select('follower_id').eq('followee_id', user.id).limit(1000)]); // chưa chạy SQL mới
    if (!Array.isArray(a) || b.error) return null;
    const mineSet = new Set(a.map((x) => x.followee_id));
    return (b.data || []).map((x) => x.follower_id).filter((i) => mineSet.has(i));
  },
  friendCount: async (id) => { const r = await sb.rpc('friend_count', { p_user: id }); return r.error || typeof r.data !== 'number' ? null : r.data; },
  userPosts: (id, before) => {
    let q = sb.from('posts').select('*').eq('author_id', id).is('community_id', null).order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    return q.then(ok);
  },
  following: () => sb.from('follows').select('followee_id').eq('follower_id', user.id).limit(1000).then(ok),
  remove: (table, id) => sb.from(table).delete().eq('id', id).then(ok), // RLS chỉ cho xóa của mình
  conversations: async () => {
    const run = (c) => sb.from('conversations').select(c).order('created_at', { ascending: false }).limit(PAGE);
    let r = await run('id,is_group,title,created_at,avatar_path,owner_id');
    if (r.error) r = await run('id,is_group,title,created_at');
    return ok(r);
  },
  members: (ids) => sb.from('conversation_members').select('conversation_id,user_id').in('conversation_id', ids).then(ok),
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
    rows.forEach((r) => ul.append(h('li', { className: 'comment' }, avt(r.author_id),
      h('div', { className: 'comment-main' },
        h('div', { className: 'comment-bubble' }, nameLink(r.author_id), h('p', { className: 'post-body', textContent: r.body })),
        h('div', { className: 'comment-meta' }, h('time', { className: 'post-time', textContent: when(r.created_at) }),
          r.author_id === user.id
            ? h('button', { className: 'plain link-btn danger', type: 'button', textContent: 'Xóa', onclick: async () => { if (await confirmBox('Xóa bình luận này?', 'Xóa', true) && await NXHN.remove('comments', r.id)) f.load(true); } })
            : h('button', { className: 'plain link-btn', type: 'button', textContent: 'Báo cáo', onclick: () => reportBox('comment', r.id) }))))));
  }, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có bình luận.');
  const ta = h('textarea', { rows: 2, maxLength: 2000, required: true, placeholder: 'Viết bình luận…', 'aria-label': 'Bình luận' });
  const send = h('button', { className: 'btn btn-primary btn-small', type: 'submit', textContent: 'Gửi' });
  const form = h('form', { className: 'form', onsubmit: (e) => { e.preventDefault(); busy(send, async () => { if (await NXHN.addComment(pid, user.id, ta.value.trim())) { ta.value = ''; say(''); f.load(true); } }); } }, ta, send);
  f.load(true);
  return h('div', { className: 'comments' }, f.el, form);
};
window.decoratePost = (li, p) => { // được renderPost() trong index.html gọi
  let box = null;
  const au = li.querySelector('.post-author'), tm = li.querySelector('.post-time');
  if (au && p.author_id) {
    if (p.author && p.author.username) names.set(p.author_id, p.author.username);
    au.classList.add('name-link'); au.tabIndex = 0; au.setAttribute('role', 'button');
    au.onclick = () => openProfile(p.author_id);
    au.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openProfile(p.author_id); } };
    const own = p.author_id === user.id;
    const more = ibtn('more', 'Tùy chọn bài viết', (b) => {
      const r = b.getBoundingClientRect();
      menu(r.right - 200, r.bottom + 4, [own
        ? ['Xóa bài viết', async () => { if (await confirmBox('Xóa bài viết này? Không thể hoàn tác.', 'Xóa', true) && await NXHN.remove('posts', p.id)) li.remove(); }, 'danger']
        : ['Báo cáo bài viết', () => reportBox('post', p.id)],
        !own && isAdm ? ['Xóa bài viết (quản trị)', async () => { if (await confirmBox(`Xóa bài viết của ${N(p.author_id)}? Không thể hoàn tác.`, 'Xóa', true, 'Xóa bài viết') && await NXHN.admDelPost(p.id)) { li.remove(); say('Đã xóa bài viết.'); } }, 'danger'] : null]);
    });
    li.prepend(h('div', { className: 'post-head' }, avt(p.author_id), h('div', { className: 'post-who' }, au, tm), more));
    nm([p.author_id]);
  }
  const media = h('div', { className: 'media' });
  const bar = h('div', { className: 'post-bar' }, h('button', { className: 'plain act-link', type: 'button', textContent: 'Bình luận', onclick: () => { if (box) box.hidden = !box.hidden; else li.append((box = comments(p.id))); } }));
  li.append(media, bar); queueImg(media, 'post_id', p.id);
};
const pform = $('post-form'), pfile = h('input', { type: 'file', accept: IMG, 'aria-label': 'Ảnh đính kèm (tùy chọn)' });
const pfp = pickBtn(pfile, 'Thêm ảnh'); pform.querySelector('.actions').prepend(pfp);
pform.onsubmit = (e) => {
  e.preventDefault();
  return lock(['btn-post'], async () => {
    const p = await NXHN.createPost(user.id, $('post-body').value.trim());
    if (!p) return;
    if (pfile.files[0]) await NXHN.uploadImage(user.id, pfile.files[0], { post_id: p.id });
    $('post-body').value = ''; pfile.value = ''; pfp.sync(); say(''); loadMore(true);
  });
};

// ---- Khung điều hướng: chỉ icon (tooltip + aria-label). Thông báo/Cài đặt/Tài khoản nằm ở header ----
const app = $('app-view'), views = {}, loaders = {}, tabBtn = {}, hdr = $('hdr-tools');
const home = h('div', { id: 'view-home', className: 'view' });
[...app.children].slice(1).forEach((c) => home.append(c));
app.append(home);
const tabs = h('nav', { className: 'tabs', 'aria-label': 'Điều hướng chính' });
app.children[0].after(tabs);
const go = (key, quiet) => {
  for (const k in views) { views[k].hidden = k !== key; if (tabBtn[k]) tabBtn[k].setAttribute('aria-current', k === key ? 'page' : 'false'); }
  bellBtn.setAttribute('aria-current', key === 'notifs' ? 'page' : 'false'); gearBtn.setAttribute('aria-current', key === 'settings' ? 'page' : 'false');
  if (!quiet) { say(''); loaders[key](); }
};
const addView = (key, label, load, icon) => {
  const v = key === 'home' ? home : h('div', { id: 'view-' + key, className: 'view', hidden: true });
  if (key !== 'home') app.append(v);
  views[key] = v; loaders[key] = load;
  if (icon) { tabBtn[key] = h('button', { className: 'tab', type: 'button', title: label, 'aria-label': label, 'data-tip': label, onclick: () => go(key) }, ico(icon)); tabs.append(tabBtn[key]); }
  return v;
};
addView('home', 'Khám phá', () => loadMore(true), 'explore');
addView('settings', 'Cài đặt', () => {}).append($('profile-form'));
$('profile-form').querySelector('.actions').prepend(btn('Đổi ảnh đại diện', () => avatarBox()));

// Header: chuông (badge chưa đọc), bánh răng, avatar → menu tài khoản
const bellBadge = h('span', { className: 'bell-badge', hidden: true });
const bellBtn = ibtn('bell', 'Thông báo', () => go('notifs'), 'hbtn'); bellBtn.append(bellBadge);
const gearBtn = ibtn('gear', 'Cài đặt', () => go('settings'), 'hbtn');
const accBtn = h('button', { className: 'plain acc-btn', type: 'button', title: 'Tài khoản', 'aria-label': 'Menu tài khoản', 'aria-haspopup': 'menu', onclick: (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  menu(r.right - 200, r.bottom + 6, [['Hồ sơ của tôi', () => profile(user.id)], ['Cài đặt', () => go('settings')], ['Đăng xuất', () => NXHN.signOut(), 'danger']]);
} });
hdr.append(bellBtn, gearBtn, accBtn);

// ---- Mọi người: Tìm kiếm / Đã theo dõi / Bạn bè ----
const pv = addView('people', 'Mọi người', () => pTab(ptab), 'users');
let ptab = 'search', pseq = 0;
const sq = h('input', { type: 'search', maxLength: 31, placeholder: 'Nhập chính xác @username…', 'aria-label': 'Tìm theo @username', autocomplete: 'off', autocapitalize: 'none', spellcheck: false });
const plist = h('ul', { className: 'timeline' }), pnone = h('p', { className: 'empty', hidden: true });
const PT = [['search', 'Tìm kiếm'], ['following', 'Đã theo dõi'], ['friends', 'Bạn bè']];
const segBtns = PT.map(([k, t]) => h('button', { type: 'button', role: 'tab', textContent: t, onclick: () => pTab(k) }));
const personRow = (r) => {
  names.set(r.id, r.username);
  return h('li', { className: 'post person' },
    h('button', { className: 'plain', type: 'button', 'aria-label': 'Xem hồ sơ ' + handle(r.username), onclick: () => openProfile(r.id) }, avt(r.id, 'lg')),
    h('div', { className: 'person-main' }, nameLink(r.id), h('p', { className: 'person-bio', textContent: r.bio || 'Chưa có giới thiệu.' })),
    h('div', { className: 'person-act' }, followBtn(r.id), ibtn('chat', 'Nhắn tin', (b) => dm(r.id, b))));
};
const pTab = async (t) => {
  ptab = t; const my = ++pseq, q = normUser(sq.value);
  segBtns.forEach((b, i) => b.setAttribute('aria-selected', PT[i][0] === t ? 'true' : 'false'));
  sq.placeholder = t === 'search' ? 'Nhập chính xác @username…' : 'Lọc theo @username…';
  pnone.hidden = true;
  if (t === 'search' && !q) { plist.replaceChildren(); pnone.textContent = 'Nhập chính xác @username để tìm một tài khoản. Hệ thống không gợi ý người lạ.'; pnone.hidden = false; await loadRel(); return; }
  plist.replaceChildren(...skel());
  let rows = [];
  if (t === 'search') {
    const [r] = await Promise.all([NXHN.findUser(q), loadRel()]);
    if (my !== pseq) return;
    rows = Array.isArray(r) ? r : [];
    pnone.textContent = Array.isArray(r) ? `Không tìm thấy tài khoản @${q}.` : 'Không tìm được lúc này, hãy thử lại.';
  } else {
    await loadRel();
    if (my !== pseq) return;
    const ids = [...(t === 'friends' ? frd : fol)];
    const r = ids.length ? await NXHN.byIds(ids) : [];
    if (my !== pseq) return;
    rows = (Array.isArray(r) ? r : []).filter((p) => !q || p.username.includes(q));
    pnone.textContent = q ? 'Không có kết quả.' : t === 'friends' ? 'Chưa có bạn bè. Khi hai người cùng theo dõi nhau, họ sẽ xuất hiện ở đây.' : 'Bạn chưa theo dõi ai.';
  }
  plist.replaceChildren(...rows.map(personRow)); pnone.hidden = rows.length > 0;
};
sq.oninput = deb(() => pTab(ptab));
pv.append(h('h2', { textContent: 'Mọi người' }), h('div', { className: 'seg', role: 'tablist' }, segBtns), h('div', { className: 'search' }, ico('search'), sq), plist, pnone);

// ---- Hộp thoại thống nhất: modal giữa màn hình, xác nhận, báo cáo, chọn ảnh, chọn thành viên ----
const MAXIMG = 5 * 1024 * 1024, OKIMG = IMG.split(',');
const IMG_MARK = '[ảnh]', STK_MARK = '[nhãn dán]', POLL_MARK = '[bình chọn]'; // nội dung đánh dấu cho tin chỉ có ảnh / nhãn dán (không có chữ của người dùng)
const stickers = new Map(), cstate = new Map();
let curOwner = null, pfiles = [], anonOn = false, left = 0;
const modal = (...k) => {
  const key = (e) => { if (e.key === 'Escape' && [...document.querySelectorAll('.modal')].pop() === box) close(); };
  const close = () => { box.remove(); removeEventListener('keydown', key); };
  const box = h('div', { className: 'lightbox modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === box) close(); } }, h('div', { className: 'card sheet' }, ibtn('x', 'Đóng', close, 'sheet-x'), ...k));
  addEventListener('keydown', key); document.body.append(box); close.sheet = box.firstChild; return close;
};
const dlg = (close) => { close.sheet.classList.add('dialog'); return close; };
const infoBox = (title, text) => { const c = modal(h('h2', { textContent: title }), h('p', { className: 'dlg-msg', textContent: text }), h('div', { className: 'actions dlg-act' }, btn('Đóng', () => c(), 'btn-primary'))); dlg(c); };
// askBox: false nếu hủy/đóng; true (hoặc { note } khi có ô nhập) nếu xác nhận.
const askBox = ({ title = 'Xác nhận', msg = '', label = 'Xác nhận', danger = false, input = '', select = null }) => new Promise((res) => {
  let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
  const ta = input ? h('textarea', { rows: 3, maxLength: 500, placeholder: input, 'aria-label': input }) : null;
  const sl = select ? h('select', { 'aria-label': 'Thời hạn' }, select.map(([v, t]) => h('option', { value: v, textContent: t }))) : null;
  const close = modal(h('h2', { textContent: title }), msg ? h('p', { className: 'dlg-msg', textContent: msg }) : null, ta, sl && h('div', { className: 'field' }, sl),
    h('div', { className: 'actions dlg-act' }, btn('Hủy', () => { close(); fin(false); }), btn(label, () => { close(); fin(ta || sl ? { note: ta ? ta.value.trim() : '', sel: sl ? sl.value : '' } : true); }, danger ? 'btn-danger' : 'btn-primary')));
  dlg(close);
  const mo = new MutationObserver(() => { if (!close.sheet.isConnected) { mo.disconnect(); fin(false); } }); mo.observe(document.body, { childList: true });
});
const confirmBox = (msg, label, danger, title) => askBox({ msg, label, danger, title }).then(Boolean);
const REASONS = ['Spam hoặc quảng cáo', 'Quấy rối hoặc xúc phạm', 'Nội dung nhạy cảm hoặc bạo lực', 'Giả mạo hoặc lừa đảo', 'Khác'];
// Gửi báo cáo; trả về chuỗi lỗi (rỗng nếu thành công) để hiện ngay trong hộp thoại.
const sendReport = async (type, id, reason) => {
  if (!id || !reason || reason.length < 2) return 'Hãy chọn lý do báo cáo.';
  let r = await sb.rpc('report_content', { p_type: type, p_id: id, p_reason: reason });
  if (r.error && /PGRST202|42883|Could not find/.test((r.error.code || '') + ' ' + (r.error.message || ''))) r = await sb.from('reports').insert({ reporter_id: user.id, target_type: type, target_id: id, reason });
  if (!r.error) return '';
  console.error(r.error);
  const c = String(r.error.code || r.error.status || '');
  return c === 'P0001' ? r.error.message
    : c === '23514' ? 'Máy chủ chưa hỗ trợ loại báo cáo này: hãy chạy file nxhn_chat_upgrade.sql.'
    : c === '23505' ? 'Bạn đã báo cáo nội dung này rồi.'
    : c === '42501' ? 'Máy chủ từ chối: bạn không có quyền gửi báo cáo này (chính sách RLS của bảng reports).'
    : c === '23503' ? 'Nội dung này không còn tồn tại.'
    : c === '54000' ? 'Bạn thao tác quá nhanh, hãy thử lại sau ít phút.'
    : `Không gửi được (${c || 'lỗi'}): ${r.error.message || ''}`.trim();
};
const reportBox = (type, id) => {
  const what = { post: 'bài viết', comment: 'bình luận', message: 'tin nhắn', profile: 'tài khoản' }[type] || 'nội dung';
  const sel = h('select', { 'aria-label': 'Lý do báo cáo' }, REASONS.map((x) => h('option', { value: x, textContent: x })));
  const det = h('textarea', { rows: 3, maxLength: 700, placeholder: 'Mô tả thêm (tùy chọn)', 'aria-label': 'Mô tả thêm' });
  const err = h('p', { className: 'form-err', hidden: true });
  const go2 = h('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Gửi báo cáo' });
  const close = modal(h('h2', { textContent: 'Báo cáo ' + what }), h('form', { className: 'form', onsubmit: (e) => {
    e.preventDefault();
    busy(go2, async () => {
      err.hidden = true;
      const reason = (sel.value + (det.value.trim() ? ': ' + det.value.trim() : '')).slice(0, 1000);
      const why = await sendReport(type, id, reason);
      if (!why) { close(); say('Đã gửi báo cáo.'); } else { err.textContent = why; err.hidden = false; }
    });
  } }, h('div', { className: 'field' }, h('label', { textContent: 'Lý do' }), sel), h('div', { className: 'field' }, det), err, h('div', { className: 'actions dlg-act' }, btn('Hủy', () => close()), go2)));
  dlg(close);
};
// Tải ảnh lên kho 'media' (thư mục riêng của người dùng); trả về đường dẫn hoặc null.
const upFile = async (file, prefix) => {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file && file.type];
  if (!ext) return fail({ userMessage: 'Chỉ nhận ảnh JPEG, PNG, WebP, GIF.' });
  if (file.size > MAXIMG) return fail({ userMessage: 'Ảnh tối đa 5 MB.' });
  const path = `${user.id}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from('media').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) {
    const m = (up.error.message || '') + ' ' + (up.error.statusCode || up.error.status || '');
    return fail(/row-level|violates|not allowed|unauthorized|403/i.test(m) ? { userMessage: 'Kho ảnh từ chối tải lên (thiếu quyền storage cho thư mục của bạn).' }
      : /bucket not found|404/i.test(m) ? { userMessage: 'Chưa có kho ảnh “media” trên Supabase.' } : up.error);
  }
  return path;
};
const noSql = (e, what) => (e && /PGRST20[45]|42703|42P01|PGRST205/.test((e.code || '') + ' ' + (e.message || '')) ? { userMessage: `Chưa áp dụng SQL nâng cấp (${what}).` } : e);
// Chọn ảnh → xem trước → Hủy/Lưu (có loading + lỗi). onSave(file) trả true nếu thành công.
const imageBox = ({ title, label = 'Lưu', shape = '', extra = null, onSave }) => {
  const inp = h('input', { type: 'file', accept: IMG, 'aria-label': 'Chọn ảnh' });
  const hint = () => h('span', { className: 'hint', textContent: 'Chạm để chọn ảnh' });
  const prev = h('div', { className: 'img-prev ' + shape }, hint());
  const err = h('p', { className: 'form-err', hidden: true });
  const ok3 = h('button', { className: 'btn btn-primary', type: 'button', textContent: label, disabled: true });
  let url = null;
  const close = modal(h('h2', { textContent: title }), prev, pickBtn(inp, 'Chọn ảnh từ thiết bị'), extra && extra.el, err, h('div', { className: 'actions dlg-act' }, btn('Hủy', () => close()), ok3));
  dlg(close);
  prev.onclick = () => inp.click();
  const show = (m) => { err.textContent = m || ''; err.hidden = !m; };
  inp.onchange = () => {
    const f = inp.files[0]; show(''); ok3.disabled = true;
    if (url) { URL.revokeObjectURL(url); url = null; }
    if (!f) return prev.replaceChildren(hint());
    if (!OKIMG.includes(f.type)) { prev.replaceChildren(hint()); return show('Chỉ nhận ảnh JPEG, PNG, WebP, GIF.'); }
    if (f.size > MAXIMG) { prev.replaceChildren(hint()); return show('Ảnh tối đa 5 MB.'); }
    url = URL.createObjectURL(f); prev.replaceChildren(h('img', { src: url, alt: 'Xem trước' })); ok3.disabled = false;
    if (extra && extra.onFile) extra.onFile(prev);
  };
  ok3.onclick = async () => {
    ok3.disabled = true; ok3.textContent = 'Đang tải lên…';
    const r = await onSave(inp.files[0]);
    if (r) close();
    else { // hiện đúng lý do (toast chỉ tồn tại 4 giây) ngay trong hộp thoại
      ok3.disabled = false; ok3.textContent = label;
      const t = $('status').textContent, why = /^Lỗi:/.test(t) ? t.replace(/^Lỗi:\s*/, '') : '';
      show(why ? 'Không lưu được: ' + why : 'Không lưu được, hãy thử lại.');
    }
  };
  return close;
};
const avatarBox = () => imageBox({ title: 'Đổi ảnh đại diện', shape: 'round', onSave: async (f) => {
  const path = await upFile(f, 'avatar'); if (!path) return false;
  let r = await sb.rpc('set_my_avatar', { p_path: path });
  if (r.error && /PGRST202|42883|find the function/i.test((r.error.code || '') + ' ' + (r.error.message || ''))) // chưa chạy SQL mới → thử cập nhật trực tiếp
    r = await sb.from('profiles').update({ avatar_path: path }).eq('id', user.id).select('id').single();
  if (r.error) { sb.storage.from('media').remove([path]); fail(r.error.code === 'P0001' ? { userMessage: r.error.message } : noSql(r.error, 'cột avatar_path và hàm set_my_avatar')); return false; }
  const old = avPath.get(user.id); avPath.set(user.id, path); await signAv([path]); paint();
  if (old && old !== path) sb.storage.from('media').remove([old]);
  say('Đã cập nhật ảnh đại diện.'); return true;
} });
const groupAvatarBox = () => { const c0 = cid; return imageBox({ title: 'Đổi ảnh nhóm', shape: 'square', onSave: async (f) => {
  const path = await upFile(f, 'gavatar'); if (!path) return false;
  const r = await rpc('set_conversation_avatar', { p_conv: c0, p_path: path });
  if (!r) { sb.storage.from('media').remove([path]); return false; }
  avPath.set('g:' + c0, path); await signAv([path]); paint(); convList(); say('Đã đổi ảnh nhóm.'); return true;
} }); };
// Chọn thành viên (tạo nhóm / thêm thành viên): khóa theo id, chỉ gồm bạn bè + người đã theo dõi, không trùng.
const picker = ({ title, label, exclude = new Set(), named = false, onDone }) => {
  const sel = new Map(); let pool = [], running = false;
  const name = named ? h('input', { maxLength: 100, placeholder: 'Tên nhóm', 'aria-label': 'Tên nhóm' }) : null;
  const q = h('input', { type: 'search', maxLength: 30, placeholder: 'Tìm trong bạn bè và người đã theo dõi…', 'aria-label': 'Tìm thành viên' });
  const chips = h('div', { className: 'chips' }), cnt = h('span', { className: 'cnt' }), list = h('ul', { className: 'pick-list' });
  const ok5 = h('button', { className: 'btn btn-primary', type: 'button', textContent: label, disabled: true });
  const sync = () => { cnt.textContent = `Đã chọn ${sel.size}`; ok5.disabled = running || !sel.size || (named && !name.value.trim()); };
  const draw = () => {
    const f = normUser(q.value);
    list.replaceChildren(...pool.filter((p) => !f || p.username.includes(f)).map((p) => {
      const inG = exclude.has(p.id);
      const cb = h('input', { type: 'checkbox', checked: sel.has(p.id), disabled: inG, 'aria-label': handle(p.username), onchange: () => { if (cb.checked) sel.set(p.id, p.username); else sel.delete(p.id); drawChips(); sync(); } });
      return h('li', {}, h('label', { className: 'pick-row' + (inG ? ' dis' : '') }, cb, avt(p.id), h('span', { className: 'pick-name', textContent: handle(p.username) }), inG ? h('span', { className: 'tag', textContent: 'Đã trong nhóm' }) : null));
    }));
    if (!list.children.length) list.append(h('li', { className: 'empty', textContent: pool.length ? 'Không có kết quả.' : 'Chưa có bạn bè hoặc người đã theo dõi để chọn.' }));
  };
  const drawChips = () => chips.replaceChildren(...[...sel].map(([id, u]) => h('span', { className: 'chip' }, handle(u), ibtn('x', 'Bỏ ' + handle(u), () => { sel.delete(id); drawChips(); draw(); sync(); }))));
  q.oninput = draw; if (name) name.oninput = sync;
  const close = modal(h('h2', { textContent: title }), name && h('div', { className: 'field' }, name), q, chips, list, h('div', { className: 'actions dlg-act' }, cnt, btn('Hủy', () => close()), ok5));
  dlg(close);
  ok5.onclick = async () => {
    if (running) return; running = true; ok5.disabled = true; ok5.textContent = 'Đang xử lý…'; // chặn bấm nhiều lần → không tạo trùng
    const done = await onDone([...sel.keys()], name ? name.value.trim() : '');
    running = false; ok5.textContent = label;
    if (done) close(); else sync();
  };
  (async () => {
    list.replaceChildren(...skel(3));
    await loadRel();
    const ids = [...new Set([...fol, ...frd])].filter((i) => i !== user.id);
    const r = ids.length ? await NXHN.byIds(ids) : [];
    pool = Array.isArray(r) ? r : []; pool.forEach((p) => names.set(p.id, p.username));
    await nm(ids); draw(); sync();
  })();
};

// ---- API chat ----
Object.assign(NXHN, {
  sendMessage: (c, s, body, reply) => sb.from('messages').insert({ conversation_id: c, sender_id: s, body, ...(reply ? { reply_to: reply } : {}) }).select().single().then(ok),
  sendSticker: async (c, s, sid, reply) => {
    const r = await sb.from('messages').insert({ conversation_id: c, sender_id: s, body: STK_MARK, sticker_id: sid, ...(reply ? { reply_to: reply } : {}) }).select().single();
    return r.error ? fail(noSql(r.error, 'nhãn dán')) : r.data;
  },
  loadMessages: async (c, before) => {
    const cut = cstate.get(c) && cstate.get(c).cleared_at; // đã xóa hội thoại phía mình → chỉ lấy tin mới hơn mốc đó
    const run = (cols) => { let q = sb.from('messages').select(cols).eq('conversation_id', c).order('created_at', { ascending: false }).limit(PAGE); if (before) q = q.lt('created_at', before); if (cut) q = q.gt('created_at', cut); return q; };
    let r = await run('id,body,sender_id,created_at,kind,reply_to,deleted_at,sticker_id');
    if (r.error) r = await run('id,body,sender_id,created_at,kind,reply_to,deleted_at');
    if (r.error) r = await run('id,body,sender_id,created_at,kind,reply_to');
    if (r.error) r = await run('id,body,sender_id,created_at'); // chưa chạy SQL mới → chat cũ vẫn hoạt động
    const rows = ok(r);
    if (!Array.isArray(rows)) return rows;
    const ids = [...new Set(rows.map((m) => m.reply_to).filter(Boolean))];
    if (ids.length) { const by = await NXHN.replies(ids); rows.forEach((m) => { m.reply = by[m.reply_to] || null; }); }
    return rows;
  },
  replies: async (ids) => {
    let rr = await sb.from('messages').select('id,body,sender_id,kind,deleted_at,sticker_id').in('id', ids);
    if (rr.error) rr = await sb.from('messages').select('id,body,sender_id,kind,deleted_at').in('id', ids);
    if (rr.error) rr = await sb.from('messages').select('id,body').in('id', ids);
    return Object.fromEntries((rr.data || []).map((x) => [x.id, x]));
  },
  // Xóa cho mọi người: ưu tiên hàm SQL delete_message (giữ "dấu vết"); chưa chạy SQL → xóa hẳn như cũ.
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
    if (paths.length) sb.storage.from('media').remove(paths);
    return true;
  },
  dropMessage: async (id) => { // dọn tin ảnh vừa tạo khi tải ảnh thất bại (không để lại tin rỗng)
    const d = await sb.from('messages').delete().eq('id', id).select('id');
    if (!d.error && d.data && d.data.length) return true;
    return !(await sb.rpc('delete_message', { p_id: id })).error;
  },
  lastMsgs: async (ids) => {
    const run = (cols) => sb.from('messages').select(cols).in('conversation_id', ids).order('created_at', { ascending: false }).limit(Math.min(300, ids.length * 10));
    let r = await run('conversation_id,body,sender_id,created_at,kind,deleted_at');
    if (r.error) r = await run('conversation_id,body,sender_id,created_at,kind');
    if (r.error) r = await run('conversation_id,body,sender_id,created_at');
    const out = {}; (r.data || []).forEach((m) => { if (!out[m.conversation_id]) out[m.conversation_id] = m; });
    return out;
  },
  convStates: async () => {
    const r = await sb.from('conversation_user_state').select('conversation_id,cleared_at,bg_path,bg_blur').eq('user_id', user.id);
    cstate.clear(); (r.data || []).forEach((s) => cstate.set(s.conversation_id, s));
  },
  setConvState: async (id, patch) => {
    const r = await sb.from('conversation_user_state').upsert({ conversation_id: id, user_id: user.id, ...patch }, { onConflict: 'conversation_id,user_id' });
    if (r.error) return fail(noSql(r.error, 'bảng conversation_user_state'));
    cstate.set(id, { ...(cstate.get(id) || {}), conversation_id: id, ...patch }); return true;
  },
  stickers: (c) => sb.from('conversation_stickers').select('id,name,storage_path,created_by,conversation_id').eq('conversation_id', c).order('created_at', { ascending: false }).limit(60).then(ok),
  createSticker: (c, path, name) => sb.from('conversation_stickers').insert({ conversation_id: c, created_by: user.id, storage_path: path, name: name || null }).select().single().then(ok),
  delSticker: async (id) => { // quyền (người tạo / trưởng nhóm / quản trị) do RLS kiểm tra
    const d = await sb.from('conversation_stickers').delete().eq('id', id).select('id,storage_path');
    if (d.error) return fail(d.error);
    if (!d.data || !d.data.length) return fail({ code: '42501' });
    if (d.data[0].storage_path) sb.storage.from('media').remove([d.data[0].storage_path]);
    return true;
  },
  kick: (c, u) => rpc('kick_member', { p_conv: c, p_user: u }),
  rename: (c, t) => rpc('rename_conversation', { p_conv: c, p_title: t }),
  admPosts: (before) => rpc('admin_list_posts', { p_before: before || null, p_limit: PAGE }),
  admDelPost: (id) => rpc('admin_delete_post', { p_id: id }),
  transferLead: (c, u) => rpc('transfer_leader', { p_conv: c, p_user: u }),
  anonLeft: () => rpc('anon_balance'),
  sendAnon: (c, body, reply, req) => rpc('send_anon_message', { p_conv: c, p_body: body, p_reply: reply || null, p_req: req }),
  invite: (c, u) => rpc('invite_to_conversation', { p_conv: c, p_user: u }),
  admUsers: (s) => rpc('admin_search_users', { p_q: s }),
  admGrant: (u) => rpc('admin_grant_anon', { p_user: u }),
  admBan: (u, b) => rpc('admin_set_banned', { p_user: u, p_banned: b }),
  admDel: (u) => rpc('admin_delete_user', { p_user: u }),
  admSender: (m) => rpc('admin_anon_sender', { p_message: m }),
});
// ---- Nâng cấp chat: ghim, kho lưu trữ, nhãn dán cá nhân, quyền gửi tin (cần chạy nxhn_chat_upgrade.sql) ----
const MISSING = /PGRST20[245]|PGRST202|42P01|42883|42703|Could not find/;
const soft = (r, what) => {
  if (!r.error) return r.data == null ? true : r.data;
  const m = (r.error.code || '') + ' ' + (r.error.message || '');
  return fail(MISSING.test(m) ? { userMessage: `Máy chủ chưa có ${what}: hãy chạy nxhn_chat_upgrade.sql rồi nxhn_chat_upgrade_2.sql.` } : r.error.code === 'P0001' ? { userMessage: r.error.message } : r.error);
};
const saved = new Set(), mine = new Map(), pinIds = new Set();
let perm = { can_send: true }, preloaded = false;
Object.assign(NXHN, {
  loadSaved: async () => { const r = await sb.from('saved_items').select('message_id').limit(1000); saved.clear(); (r.data || []).forEach((x) => saved.add(x.message_id)); },
  saveMsg: async (id, on) => {
    const r = on ? await sb.from('saved_items').upsert({ user_id: user.id, message_id: id }, { onConflict: 'user_id,message_id', ignoreDuplicates: true }) : await sb.from('saved_items').delete().eq('user_id', user.id).eq('message_id', id);
    const v = soft(r, 'kho lưu trữ'); if (v) { if (on) saved.add(id); else saved.delete(id); } return v;
  },
  savedList: async () => soft(await sb.from('saved_items').select('message_id,created_at').order('created_at', { ascending: false }).limit(60), 'kho lưu trữ'),
  msgsByIds: async (ids) => {
    if (!ids.length) return [];
    let r = await sb.from('messages').select('id,body,sender_id,kind,deleted_at,sticker_id,conversation_id,created_at').in('id', ids);
    if (r.error) r = await sb.from('messages').select('id,body,sender_id,conversation_id,created_at').in('id', ids);
    return r.data || [];
  },
  pinList: async (c) => { const r = await sb.from('message_pins').select('message_id').eq('conversation_id', c).order('created_at', { ascending: false }).limit(20); return r.error ? [] : (r.data || []).map((x) => x.message_id); },
  pinSet: (id, on) => sb.rpc('set_pin', { p_msg: id, p_on: on }).then((r) => soft(r, 'tính năng ghim')),
  myStickers: async () => {
    const r = await sb.from('user_stickers').select('sticker_id,created_at').order('created_at', { ascending: false }).limit(120), ids = (r.data || []).map((x) => x.sticker_id);
    mine.clear(); if (!ids.length) return [];
    const s = await sb.from('conversation_stickers').select('id,name,storage_path,created_by,conversation_id').in('id', ids), by = new Map((s.data || []).map((x) => [x.id, x]));
    ids.forEach((id) => { if (by.has(id)) mine.set(id, by.get(id)); }); return [...mine.values()];
  },
  saveSticker: async (sid, on) => soft(on ? await sb.from('user_stickers').upsert({ user_id: user.id, sticker_id: sid }, { onConflict: 'user_id,sticker_id', ignoreDuplicates: true }) : await sb.from('user_stickers').delete().eq('user_id', user.id).eq('sticker_id', sid), 'nhãn dán cá nhân'),
  chatPerm: async (c) => { const r = await sb.rpc('chat_perm', { p_conv: c }); return r.error || !r.data ? { can_send: true } : r.data; },
  setAnnounce: (c, on) => sb.rpc('set_announce_only', { p_conv: c, p_on: on }).then((r) => soft(r, 'chế độ chỉ trưởng nhóm gửi tin')),
  restrict: (c, u, on, reason, mins) => sb.rpc('set_chat_restriction', { p_conv: c, p_user: u, p_on: on, p_reason: reason || null, p_minutes: mins || null }).then((r) => soft(r, 'tính năng khóa chat')),
  restrictions: async (c) => { const r = await sb.from('conversation_restrictions').select('user_id,until').eq('conversation_id', c); return new Set((r.data || []).filter((x) => !x.until || new Date(x.until) > new Date()).map((x) => x.user_id)); },
});
const permNote = h('p', { className: 'anon-note perm-note', hidden: true });
const pinBar = h('button', { className: 'plain pin-bar', type: 'button', hidden: true, onclick: () => pinBox() });
const canPin = () => !isGroup || curOwner === user.id; // server kiểm tra lại (set_pin)
const paintPins = () => { pinBar.hidden = !pinIds.size; pinBar.textContent = `Đã ghim ${pinIds.size} tin nhắn · Xem`; mlist.querySelectorAll('.msg[data-id]').forEach((li) => li.classList.toggle('pinned', pinIds.has(li.dataset.id))); };
const loadPins = async (c0) => { const ids = await NXHN.pinList(c0); if (c0 !== cid) return; pinIds.clear(); ids.forEach((i) => pinIds.add(i)); paintPins(); };
const togglePin = async (m) => { const on = !pinIds.has(m.id); if (!(await NXHN.pinSet(m.id, on))) return; if (on) pinIds.add(m.id); else pinIds.delete(m.id); paintPins(); say(on ? 'Đã ghim tin nhắn.' : 'Đã bỏ ghim.'); };
const ensureMine = () => { if (preloaded) return; preloaded = true; NXHN.loadSaved(); NXHN.myStickers(); };
const applyPerm = () => {
  blocked = isGroup && perm.can_send === false;
  permNote.hidden = !blocked;
  permNote.textContent = blocked ? (perm.announce_only ? 'Nhóm đang ở chế độ chỉ trưởng nhóm được gửi tin. Bạn vẫn xem được tin nhắn.' : 'Bạn đang bị hạn chế gửi tin trong nhóm này' + (perm.reason ? ': ' + perm.reason : '') + '.') : '';
  mtext.disabled = plusBtn.disabled = blocked; mform.classList.toggle('blocked', blocked);
  if (blocked) setAnon(false); else paintAnon();
  upd();
};
const refreshPerm = async () => {
  const c0 = cid;
  if (!c0 || !isGroup) { perm = { can_send: true }; applyPerm(); return; }
  const p = await NXHN.chatPerm(c0); if (c0 !== cid) return;
  perm = p && typeof p === 'object' ? p : { can_send: true }; applyPerm();
};
addEventListener('focus', () => { if (cid && isGroup) refreshPerm(); });
const toggleRestrict = async (c0, id, on) => {
  let note = '', mins = null;
  if (on) { const r = await askBox({ title: 'Khóa chat thành viên', msg: `${N(id)} sẽ không gửi được tin nhắn trong nhóm này nhưng vẫn xem được nội dung.`, label: 'Khóa chat', danger: true, input: 'Lý do (tùy chọn)', select: [['', 'Không giới hạn thời gian'], ['10', '10 phút'], ['60', '1 giờ'], ['1440', '1 ngày'], ['10080', '7 ngày']] }); if (!r) return; note = r.note || ''; mins = +r.sel || null; }
  if (await NXHN.restrict(c0, id, on, note, mins)) { say(on ? 'Đã khóa chat thành viên.' : 'Đã mở khóa chat.'); if (c0 === cid) renderInfo(); }
};
const openAt = (c, id) => { go('chat'); if (cid === c) return jumpTo(id); const b = clist.querySelector(`.conv[data-id="${c}"]`); if (!b) return say('Hãy mở cuộc trò chuyện chứa tin nhắn này.'); b.click(); setTimeout(() => jumpTo(id), 1000); };
// Danh sách tin tham chiếu (ghim / lưu): chỉ lấy ID rồi tra tin gốc → không sao chép nội dung; tin đã xóa/mất quyền hiện thông báo trung tính
const msgListBox = async ({ title, ids, empty, rm }) => {
  const ul = h('ul', { className: 'timeline mlist-box' }, ...skel(2));
  const close = modal(h('h2', { textContent: title }), ul); dlg(close);
  const rows = await NXHN.msgsByIds(ids), by = new Map(rows.map((m) => [m.id, m]));
  await nm(rows.map((m) => m.sender_id).filter(Boolean));
  ul.replaceChildren(...ids.map((id) => { const m = by.get(id); return h('li', { className: 'saved-row' },
    h('span', { className: 'sr-main' }, h('b', { textContent: m ? qname(m) : 'Tin nhắn' }), h('span', { className: 'sr-t', textContent: m ? qtext(m) : 'Nội dung gốc không còn hoặc bạn không còn quyền xem.' }), m ? h('time', { className: 'post-time', textContent: when(m.created_at) }) : null),
    h('span', { className: 'sr-act' },
      m && !m.deleted_at ? h('button', { className: 'plain link-btn', type: 'button', textContent: 'Đến tin', onclick: () => { close(); openAt(m.conversation_id, m.id); } }) : null,
      rm ? h('button', { className: 'plain link-btn danger', type: 'button', textContent: rm.label, onclick: async (e) => { const b = e.currentTarget; if (await rm.fn(id)) b.closest('li').remove(); } }) : null)); }));
  if (!ids.length) ul.append(h('li', { className: 'empty', textContent: empty }));
};
const savedBox = async () => {
  const rows = await NXHN.savedList(); if (!Array.isArray(rows)) return;
  msgListBox({ title: 'Kho lưu trữ', ids: rows.map((r) => r.message_id), empty: 'Chưa lưu tin nhắn nào. Mở menu của tin nhắn → “Lưu tin nhắn”.', rm: { label: 'Bỏ lưu', fn: async (id) => !!(await NXHN.saveMsg(id, false)) } });
};
const pinBox = () => msgListBox({ title: 'Tin nhắn đã ghim', ids: [...pinIds], empty: 'Chưa có tin nhắn nào được ghim.', rm: canPin() ? { label: 'Bỏ ghim', fn: async (id) => { if (!(await NXHN.pinSet(id, false))) return false; pinIds.delete(id); paintPins(); return true; } } : null });
const myStkPanel = () => {
  const grid = h('div', { className: 'stk-grid' });
  const close = modal(h('h2', { textContent: 'Nhãn dán của tôi' }), grid); dlg(close);
  (async () => {
    grid.replaceChildren(...skel(3));
    const rows = await NXHN.myStickers(); await signAv(rows.map((s) => s.storage_path));
    grid.replaceChildren(...rows.map((s) => h('div', { className: 'stk-item' },
      h('button', { className: 'plain stk-pick', type: 'button', title: s.name || 'Nhãn dán', 'aria-label': 'Gửi nhãn dán ' + (s.name || ''), onclick: () => { close(); sendSticker(s); } }, h('img', { className: 'sticker', src: avUrl.get(s.storage_path), alt: s.name || 'Nhãn dán', draggable: false })),
      ibtn('x', 'Bỏ lưu nhãn dán', async () => { if (await NXHN.saveSticker(s.id, false)) { mine.delete(s.id); say('Đã bỏ lưu.'); close(); myStkPanel(); } }, 'stk-del'))));
    if (!rows.length) grid.append(h('p', { className: 'empty', textContent: 'Chưa có nhãn dán nào. Mở menu của một nhãn dán trong chat → “Lưu nhãn dán”.' }));
  })();
};
const loadStickers = async (rows) => {
  const ids = [...new Set(rows.map((m) => m.sticker_id).filter((i) => i && !stickers.has(i)))];
  if (ids.length) { const r = await sb.from('conversation_stickers').select('id,name,storage_path,created_by,conversation_id').in('id', ids); (r.data || []).forEach((s) => stickers.set(s.id, s)); }
  await signAv(rows.map((m) => m.sticker_id && stickers.get(m.sticker_id)).filter(Boolean).map((s) => s.storage_path));
};

// ---- Hồ sơ (của mình và của người khác dùng chung một giao diện) ----
let lpAt = 0; // vừa nhấn giữ mở menu → bỏ qua cú chạm nhả tay trên tên/avatar (không mở nhầm hồ sơ)
const openProfile = (id) => { if (id && Date.now() - lpAt > 700) profile(id); };
const dm = async (id, b, after) => {
  const c = await busy(b, () => NXHN.createConversation([id]));
  if (c) { if (after) after(); go('chat', true); openConv(c, handle(names.get(id)), false, id); }
};
const profile = async (id) => {
  const close = modal(), sh = close.sheet, x = sh.firstChild, self = id === user.id;
  sh.classList.add('profile'); sh.append(h('div', { className: 'skel tall' }), h('div', { className: 'skel' }));
  const sel = (c) => sb.from('profiles').select(c).eq('id', id).maybeSingle(); // chỉ cột công khai
  const [r0, , fc] = await Promise.all([sel('id,username,bio,display_name'), loadRel(), NXHN.friendCount(id)]);
  const r = r0.error ? await sel('id,username,bio') : r0, p = r.data;
  if (!p) return sh.replaceChildren(x, h('p', { className: 'empty', textContent: r.error ? 'Không tải được hồ sơ. Hãy thử lại.' : 'Tài khoản không tồn tại hoặc bạn không có quyền xem.' }));
  names.set(id, p.username); await nm([id]);
  const k = hue(id), dn = p.display_name && p.display_name !== p.username ? p.display_name : null, cnt = fc == null ? (self ? frd.size : null) : fc;
  const cover = h('div', { className: 'cover' }); cover.style.background = `linear-gradient(135deg, hsl(${k} 45% 22%), hsl(${(k + 60) % 360} 50% 12%))`;
  const acts = self ? [btn('Chỉnh sửa hồ sơ', () => { close(); go('settings'); }, 'btn-primary'), btn('Đổi ảnh đại diện', () => avatarBox()), ibtn('medal', 'Thành tựu', () => achBox(id))]
    : [btn('Nhắn tin', (b) => dm(id, b, close), 'btn-primary'), followBtn(id), ibtn('medal', 'Thành tựu', () => achBox(id)), ibtn('more', 'Tùy chọn', (b) => { const q2 = b.getBoundingClientRect(); menu(q2.right - 190, q2.bottom + 4, [['Báo cáo hồ sơ', () => reportBox('profile', id)]]); })];
  const pfd = feed((cur) => NXHN.userPosts(id, cur), async (ul, rows) => { rows.forEach((r2) => ul.append(renderPost({ ...r2, author: { username: p.username } }))); }, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có bài viết công khai.');
  const strip = h('div', { className: 'badge-strip', hidden: true });
  sh.replaceChildren(x, cover, h('div', { className: 'profile-top' }, avt(id, 'huge'), h('div', { className: 'profile-act' }, acts)),
    h('h2', { className: 'profile-name', textContent: dn || handle(p.username) }), h('p', { className: 'post-time handle', textContent: handle(p.username) + (cnt == null ? '' : ` · ${cnt} bạn bè`) }),
    h('p', { className: 'post-body', textContent: p.bio || 'Chưa có giới thiệu.' }), strip, h('h3', { className: 'sec', textContent: 'Bài viết' }), pfd.el);
  pfd.load(true);
  NXHN.ach(self ? null : id).then((a) => { // dải huy hiệu: chỉ hiện khi có danh hiệu và được phép xem
    const e = a && Array.isArray(a.defs) ? a.defs.filter((x) => x.earned_at) : [];
    if (!e.length) return;
    strip.hidden = false;
    strip.replaceChildren(...e.slice(0, 6).map((x) => h('span', { className: 'badge-chip', title: x.name + ' — ' + x.description, textContent: x.icon })), ...(e.length > 6 ? [lk('+' + (e.length - 6), () => achBox(id))] : []));
  });
};

// ---- Menu ngữ cảnh: chuột phải (máy tính) hoặc nhấn giữ 0,5 giây (cảm ứng) ----
let ctx = null, lp = 0;
const closeCtx = () => { if (ctx) { ctx.remove(); ctx = null; } };
const menu = (x, y, items) => {
  closeCtx();
  const me2 = (ctx = h('div', { className: 'ctx', role: 'menu' }, items.filter(Boolean).map(([t, fn, cls, icon]) => h('button', { className: 'ctx-item ' + (cls || ''), type: 'button', role: 'menuitem', onclick: () => { closeCtx(); fn(); } }, icon ? ico(icon) : null, h('span', { textContent: t })))));
  document.body.append(me2);
  me2.style.left = Math.max(4, Math.min(x, innerWidth - me2.offsetWidth - 4)) + 'px';
  me2.style.top = Math.max(4, Math.min(y, innerHeight - me2.offsetHeight - 4)) + 'px';
  me2.style.pointerEvents = 'none'; setTimeout(() => { me2.style.pointerEvents = ''; }, 350);
  me2.firstChild.focus();
};
addEventListener('pointerdown', (e) => { if (ctx && !ctx.contains(e.target)) closeCtx(); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });

// ---- Tin nhắn ----
const qname = (m) => (m.kind === 'anon' ? 'Ẩn danh' : m.sender_id === user.id ? 'Bạn' : m.sender_id ? N(m.sender_id) : 'Tin nhắn');
const qtext = (m) => (!m ? '' : m.deleted_at ? 'Tin nhắn đã được xóa' : m.sticker_id || m.body === STK_MARK ? 'Nhãn dán' : m.body === IMG_MARK ? 'Ảnh' : m.body === POLL_MARK ? 'Bình chọn' : m.body);
const goneRow = (id) => h('li', { className: 'msg gone', 'data-id': id }, h('span', { textContent: 'Tin nhắn đã được xóa' }));
const markGone = (id) => { // thay đúng vị trí tin cũ bằng thông báo trung tính; không hiện lại nội dung/ảnh
  saved.delete(id); if (pinIds.delete(id)) paintPins();
  mlist.querySelectorAll(`.quote[data-q="${id}"]`).forEach((q) => { const s = q.querySelector('span'); if (s) s.textContent = 'Tin nhắn đã được xóa'; const r2 = q.closest('.msg'); if (r2 && r2._m && r2._m.reply) r2._m.reply.deleted_at = r2._m.reply.deleted_at || new Date().toISOString(); });
  const li = mlist.querySelector(`[data-id="${id}"]`);
  if (!li || li.classList.contains('gone')) return;
  const nx = li.nextElementSibling;
  li.replaceWith(goneRow(id));
  if (nx && nx._m && nx.classList.contains('cont')) nx.replaceWith(msgRow(nx._m, null));
};
const delMsg = async (m) => {
  if (!(await confirmBox('Xóa tin nhắn này cho mọi người? Không thể hoàn tác.', 'Xóa', true, 'Xóa tin nhắn'))) return;
  if (await NXHN.deleteMessage(m.id)) markGone(m.id);
};
const msgItems = (li, m) => {
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id, stk = !!m.sticker_id || m.body === STK_MARK, txt = !stk && m.body !== IMG_MARK && m.body !== POLL_MARK;
  const sv = saved.has(m.id), pn = pinIds.has(m.id), sid = m.sticker_id;
  return [
    txt ? ['Sao chép', () => navigator.clipboard.writeText(m.body).then(() => say('Đã sao chép.'), () => say('Không sao chép được.')), '', 'copy'] : null,
    ['Trả lời', () => setReply(m), '', 'reply'],
    [sv ? 'Bỏ lưu tin nhắn' : 'Lưu tin nhắn', async () => { if (await NXHN.saveMsg(m.id, !sv)) say(sv ? 'Đã bỏ lưu.' : 'Đã lưu vào kho lưu trữ.'); }, '', 'bookmark'],
    sid && !anon ? [mine.has(sid) ? 'Bỏ lưu nhãn dán' : 'Lưu nhãn dán', async () => { const on = !mine.has(sid); if (await NXHN.saveSticker(sid, on)) { if (on) mine.set(sid, stickers.get(sid) || { id: sid }); else mine.delete(sid); say(on ? 'Đã lưu nhãn dán của bạn.' : 'Đã bỏ lưu nhãn dán.'); } }, '', 'sticker'] : null,
    canPin() ? [pn ? 'Bỏ ghim' : 'Ghim tin nhắn', () => togglePin(m), '', 'pin'] : null,
    own ? null : ['Báo cáo tin nhắn', () => reportBox('message', m.id), '', 'flag'],
    own ? ['Xóa tin nhắn', () => delMsg(m), 'danger', 'trash'] : null,
    isAdm && anon ? ['Xem người gửi (quản trị)', async () => { const u = await NXHN.admSender(m.id); if (u && u !== true) infoBox('Người gửi tin ẩn danh', handle(u)); }, '', 'user'] : null,
  ];
};
const arm = (li, m) => {
  const open = (x, y) => menu(x, y, msgItems(li, m));
  li.addEventListener('contextmenu', (e) => { e.preventDefault(); open(e.clientX, e.clientY); });
  li.addEventListener('touchstart', (e) => { const t = e.touches[0]; clearTimeout(lp); lp = setTimeout(() => { lpAt = Date.now(); open(t.clientX, t.clientY); }, 500); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => li.addEventListener(ev, () => clearTimeout(lp), { passive: true }));
};
const jumpTo = (id) => {
  const t = mlist.querySelector(`[data-id="${id}"]`);
  if (!t) return say('Tin nhắn gốc nằm ở phần cũ hơn — hãy bấm “Tin cũ hơn”.');
  t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400);
};
// Trả lời (lưu reply_to = id tin gốc; tin ẩn danh chỉ hiện "Ẩn danh")
const rbar = h('div', { className: 'reply-bar', hidden: true });
const setReply = (m) => {
  replyTo = m; rbar.hidden = !m;
  rbar.replaceChildren(...(m ? [h('span', { className: 'rb-t' }, h('b', { textContent: 'Trả lời ' + qname(m) }), h('span', { textContent: qtext(m).slice(0, 80) })), ibtn('x', 'Hủy trả lời', () => setReply(null))] : []));
  if (m) mtext.focus();
};

// Ẩn danh: nút dạng viên nhộng, viền nét đứt chuyển động khi bật; trạng thái luôn hiện rõ
const anonNote = h('p', { className: 'anon-note', hidden: true });
const anonBtn = h('button', { className: 'ibtn comp-btn anon-btn', type: 'button', role: 'switch', 'aria-checked': 'false', hidden: true, onclick: () => setAnon(!anonOn) }, ico('shield'));
const paintAnon = () => {
  const s = anonOn ? (isAdm ? 'Tin nhắn tiếp theo gửi ẩn danh · không giới hạn lượt' : `Tin nhắn tiếp theo gửi ẩn danh · còn ${left}/5 lượt hôm nay`) : left < 1 && !isAdm ? 'Ẩn danh: đã hết lượt hôm nay' : 'Bật chế độ ẩn danh';
  anonBtn.classList.toggle('on', anonOn); anonBtn.setAttribute('aria-checked', String(anonOn));
  anonBtn.disabled = blocked || (left < 1 && !anonOn && !isAdm);
  anonBtn.title = s; anonBtn.setAttribute('aria-label', s);
  anonNote.hidden = !anonOn; anonNote.textContent = anonOn ? s + ' (chỉ chữ).' : '';
  mform.classList.toggle('anon-on', anonOn); mtext.placeholder = anonOn ? 'Tin nhắn ẩn danh (chỉ chữ)…' : 'Nhập tin nhắn…';
};
const setAnon = (on) => { anonOn = !!on && (left > 0 || isAdm); if (anonOn) clearFiles(); paintAnon(); syncFile(); };
const showLeft = async () => { const n = await NXHN.anonLeft(); left = typeof n === 'number' ? n : 0; if (left < 1 && !isAdm) anonOn = false; paintAnon(); syncFile(); };

// ---- Chat ----
const cv = addView('chat', 'Chat', () => { convList(); if (cid) { pin = true; requestAnimationFrame(toEnd); } }, 'chat');
const clist = h('ul', { className: 'convs' }), mlist = h('ul', { className: 'messages' });
const olderBtn = btn('Tin cũ hơn', (b) => busy(b, () => loadMsgs(true)));
olderBtn.hidden = true; olderBtn.classList.add('older');
// Thanh nhập: Enter gửi / Shift+Enter xuống dòng (chỉ khi có chuột/bàn phím; trên điện thoại Enter = xuống dòng).
const mtext = h('textarea', { rows: 1, maxLength: 4000, placeholder: 'Nhập tin nhắn…', 'aria-label': 'Tin nhắn', enterKeyHint: 'send' });
const mfile = h('input', { type: 'file', accept: IMG, multiple: true, hidden: true, 'aria-label': 'Chọn ảnh để gửi' });
const attachBtn = ibtn('image', 'Gửi ảnh', () => mfile.click());
const stkBtn = ibtn('sticker', 'Nhãn dán của nhóm', () => stkPanel()); stkBtn.hidden = true;
const fchip = h('div', { className: 'file-chip', hidden: true });
const msend = h('button', { className: 'btn btn-primary send-btn', type: 'submit', title: 'Gửi', 'aria-label': 'Gửi tin nhắn', disabled: true }, ico('send'));
let blocked = false; // bị khóa chat / nhóm chỉ trưởng nhóm được gửi (server vẫn kiểm tra lại)
const upd = () => { msend.disabled = blocked || sending || !(mtext.value.trim() || (pfiles.length && !anonOn)); };
const syncFile = () => { // ảnh chọn xong: xem trước nhỏ, gửi riêng (không kèm chữ)
  attachBtn.disabled = anonOn; stkBtn.disabled = anonOn;
  fchip.hidden = !pfiles.length;
  fchip.replaceChildren(...pfiles.map((f, i) => h('span', { className: 'thumb' }, h('img', { src: f._u || (f._u = URL.createObjectURL(f)), alt: f.name }),
    ibtn('x', 'Bỏ ảnh ' + f.name, () => { URL.revokeObjectURL(f._u); pfiles.splice(i, 1); syncFile(); }, 'thumb-x'))), pfiles.length ? h('span', { className: 'fhint', textContent: 'Ảnh được gửi riêng, không kèm chữ.' }) : null);
  upd();
};
const clearFiles = () => { pfiles.forEach((f) => f._u && URL.revokeObjectURL(f._u)); pfiles = []; mfile.value = ''; syncFile(); };
mfile.onchange = () => {
  const add = [...mfile.files]; mfile.value = '';
  for (const f of add) {
    if (!OKIMG.includes(f.type)) { say('Chỉ nhận ảnh JPEG, PNG, WebP, GIF.'); continue; }
    if (f.size > MAXIMG) { say('Ảnh tối đa 5 MB.'); continue; }
    if (pfiles.length >= 5) { say('Tối đa 5 ảnh mỗi lần gửi.'); break; }
    pfiles.push(f);
  }
  syncFile();
};
const fit = () => { mtext.style.height = 'auto'; mtext.style.height = Math.min(mtext.scrollHeight, 140) + 'px'; };
const fine = matchMedia('(pointer: fine)');
mtext.oninput = () => { fit(); upd(); };
mtext.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && fine.matches) { e.preventDefault(); if (!msend.disabled) mform.requestSubmit(); } };
mtext.onfocus = () => setTimeout(() => { if (pin) toEnd(); }, 300);
if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (pin && cid) toEnd(); });
const showImg = async (node, path) => { // hiện ảnh vừa gửi ngay trong bubble
  const has = () => [...node.children].some((c) => c.dataset && c.dataset.p === path);
  if (!node || has()) return;
  const u = await NXHN.signedUrl(path);
  if (u && node.isConnected && !has()) node.append(mkImg(u, path, true));
};
const addMsg = (m) => { // thêm đúng một tin; bỏ qua nếu đã có → không trùng
  if (mlist.querySelector(`[data-id="${m.id}"]`)) return null;
  mlist.querySelectorAll('.msgs-empty').forEach((x) => x.remove());
  const li = msgRow(m, mlist.lastElementChild && mlist.lastElementChild._m);
  mlist.append(li);
  if (pin) toEnd();
  return li;
};
const sendImages = async (c0, files, rid) => { // chỉ gửi ảnh: một tin duy nhất, không chữ; lỗi → dọn tin, giữ ảnh đã chọn để thử lại
  say('Đang gửi ảnh…');
  const m = await NXHN.sendMessage(c0, user.id, IMG_MARK, rid);
  if (!m) return;
  const paths = [];
  for (const f of files) { const a = await NXHN.uploadImage(user.id, f, { message_id: m.id }); if (a && a.storage_path) paths.push(a.storage_path); else break; }
  if (paths.length < files.length) {
    if (paths.length) sb.storage.from('media').remove(paths);
    await NXHN.dropMessage(m.id); say('Lỗi: Gửi ảnh chưa thành công, hãy thử lại.'); return;
  }
  if (replyTo) m.reply = replyTo;
  clearFiles(); pin = true; setReply(null); say('');
  if (cid === c0) { addMsg(m); const med = mlist.querySelector(`[data-id="${m.id}"] .media`); if (med) await Promise.all(paths.map((p) => showImg(med, p))); }
};
const sendSticker = async (s) => {
  if (sending || !cid) return;
  sending = true; upd();
  try {
    const m = await NXHN.sendSticker(cid, user.id, s.id, replyTo && replyTo.id);
    if (!m) return;
    stickers.set(s.id, s); await signAv([s.storage_path]);
    if (replyTo) m.reply = replyTo;
    pin = true; setReply(null); say(''); addMsg(m);
  } finally { sending = false; upd(); }
};
const plusBtn = ibtn('plus', 'Thêm: ảnh, nhãn dán, bình chọn', (b) => {
  const r = b.getBoundingClientRect(), anonOnly = () => say('Tin nhắn ẩn danh chỉ gửi được chữ.');
  menu(r.left, r.top, [
    ['Chọn hình ảnh', () => (anonOn ? anonOnly() : mfile.click()), '', 'image'],
    isGroup ? ['Nhãn dán của nhóm', () => (anonOn ? anonOnly() : stkPanel()), '', 'sticker'] : null,
    ['Nhãn dán của tôi', () => (anonOn ? anonOnly() : myStkPanel()), '', 'bookmark'],
    isGroup ? ['Tạo bình chọn', () => (anonOn ? anonOnly() : pollCreate()), '', 'poll'] : null,
  ]);
  if (ctx) ctx.style.top = Math.max(4, r.top - ctx.offsetHeight - 6) + 'px';
}, 'comp-btn');
plusBtn.setAttribute('aria-haspopup', 'menu');
const mform = h('form', { className: 'chat-form', onsubmit: async (e) => {
  e.preventDefault();
  if (sending || !cid) return;
  const c0 = cid, rid = replyTo && replyTo.id, files = anonOn ? [] : pfiles.slice(), body = mtext.value.trim();
  if (!files.length && !body) return;
  sending = true; upd();
  try {
    if (files.length) return await sendImages(c0, files, rid); // có ảnh → chỉ gửi ảnh, chữ đang soạn được giữ nguyên
    if (anonOn) {
      if (left < 1 && !isAdm) return say('Bạn đã hết lượt ẩn danh.');
      if (isAdm && left < 1) await NXHN.admGrant(user.id); // quản trị: tự nạp lượt bằng hàm admin_grant_anon có sẵn → dùng không giới hạn
      if (!(await NXHN.sendAnon(c0, body, rid, reqId))) { refreshPerm(); return; } // reqId giữ nguyên khi gửi lại → server không trừ lượt hai lần
      reqId = crypto.randomUUID(); showLeft();
      pin = true; mtext.value = ''; fit(); setReply(null); say('');
      if (cid === c0) await loadMsgs(false);
      return;
    }
    const m = await NXHN.sendMessage(c0, user.id, body, rid);
    if (!m) { refreshPerm(); return; }
    if (replyTo) m.reply = replyTo;
    pin = true; mtext.value = ''; fit(); setReply(null); say('');
    if (cid === c0) addMsg(m);
  } finally { sending = false; upd(); }
} }, fchip, anonNote, permNote, plusBtn, anonBtn, mtext, msend, mfile);
upd();
const closeChat = () => { cid = null; oldest = null; peer = null; chatBox.removeAttribute('data-open'); chatBox.removeAttribute('data-info'); convList(); };
const back = ibtn('back', 'Quay lại danh sách chat', closeChat, 'back-btn');
const ctitle = h('span', { className: 'ct-name' }), csub = h('span', { className: 'ct-sub' }), cav = h('span', { className: 'ct-av' });
const toggleInfo = (force) => { const on = force === undefined ? !chatBox.hasAttribute('data-info') : force; chatBox.toggleAttribute('data-info', on); if (on) renderInfo(); };
const cinfo = h('button', { className: 'plain ct-info', type: 'button', 'aria-label': 'Xem thông tin cuộc trò chuyện', onclick: () => toggleInfo() }, ctitle, csub);
const head = h('div', { className: 'chat-head' }, back, cav, cinfo, ibtn('info', 'Thông tin cuộc trò chuyện', () => toggleInfo()),
  ibtn('more', 'Tùy chọn', (b) => { const r = b.getBoundingClientRect(); menu(r.right - 200, r.bottom + 4, [['Thông tin', () => toggleInfo(true)], isGroup ? ['Thêm thành viên', () => invitePicker()] : null, isGroup && curOwner === user.id ? ['Đổi tên nhóm', () => renameBox()] : null, ['Xóa cuộc trò chuyện', () => clearConv(cid, ctitle.textContent), 'danger']]); }));
const renameBox = () => {
  const c0 = cid, inp = h('input', { maxLength: 100, value: ctitle.textContent, 'aria-label': 'Tên nhóm' });
  const err = h('p', { className: 'form-err', hidden: true });
  const ok6 = h('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Lưu' });
  const close = modal(h('h2', { textContent: 'Đổi tên nhóm' }), h('form', { className: 'form', onsubmit: (e) => {
    e.preventDefault();
    const t = inp.value.trim();
    if (!t) { err.textContent = 'Hãy nhập tên nhóm.'; err.hidden = false; return; }
    if (t === ctitle.textContent) return close();
    busy(ok6, async () => {
      if (!(await NXHN.rename(c0, t))) return;
      close(); say('Đã đổi tên nhóm.');
      if (cid === c0) { ctitle.textContent = t; if (chatBox.hasAttribute('data-info')) renderInfo(); }
      convList();
    });
  } }, h('div', { className: 'field' }, inp), err, h('div', { className: 'actions dlg-act' }, btn('Hủy', () => close()), ok6)));
  dlg(close); inp.focus();
};
const newGroup = () => picker({ title: 'Tạo nhóm', label: 'Tạo nhóm', named: true, onDone: async (ids, name) => {
  const id = await NXHN.createConversation(ids, name);
  if (!id || id === true) return false;
  await convList(); openConv(id, name, true); say('Đã tạo nhóm.'); return true;
} });
const invitePicker = async () => {
  const c0 = cid, ms = await NXHN.members([c0]), cur = new Set((Array.isArray(ms) ? ms : []).map((m) => m.user_id));
  picker({ title: 'Thêm thành viên', label: 'Thêm vào nhóm', exclude: cur, onDone: async (ids) => {
    let n = 0; for (const id of ids) { if (await NXHN.invite(c0, id)) n++; }
    if (n) { say(`Đã thêm ${n} thành viên.`); if (c0 === cid && chatBox.hasAttribute('data-info')) renderInfo(); convList(); }
    return n > 0;
  } });
};
// Xóa cuộc trò chuyện = chỉ xóa lịch sử ở phía mình (mốc cleared_at theo từng người); người khác giữ nguyên
const clearConv = async (id, title) => {
  if (!(await askBox({ title: 'Xóa cuộc trò chuyện', msg: `Lịch sử với “${title}” sẽ bị xóa khỏi tài khoản của bạn. Những người khác vẫn giữ nguyên tin nhắn. Nếu có tin nhắn mới, cuộc trò chuyện sẽ hiện lại.`, label: 'Xóa', danger: true }))) return;
  if (!(await NXHN.setConvState(id, { cleared_at: new Date().toISOString() }))) return;
  if (cid === id) closeChat(); else await convList();
  say('Đã xóa cuộc trò chuyện.');
};
// Nhãn dán của nhóm
const stkPanel = () => {
  const c0 = cid, grid = h('div', { className: 'stk-grid' });
  const close = modal(h('h2', { textContent: 'Nhãn dán của nhóm' }), grid, h('div', { className: 'actions dlg-act' }, btn('Tạo nhãn dán', () => { close(); stickerBox(); }, 'btn-primary')));
  dlg(close);
  const stkImgEl = (s) => h('img', { className: 'sticker', src: avUrl.get(s.storage_path), alt: s.name || 'Nhãn dán', draggable: false });
  (async () => {
    grid.replaceChildren(...skel(3));
    const r = await NXHN.stickers(c0), rows = Array.isArray(r) ? r : [];
    rows.forEach((s) => stickers.set(s.id, s)); await signAv(rows.map((s) => s.storage_path));
    grid.replaceChildren(...rows.map((s) => h('div', { className: 'stk-item' },
      h('button', { className: 'plain stk-pick', type: 'button', title: s.name || 'Nhãn dán', 'aria-label': 'Gửi nhãn dán ' + (s.name || ''), onclick: () => { close(); sendSticker(s); } }, stkImgEl(s)),
      s.created_by === user.id || curOwner === user.id || isAdm ? ibtn('trash', 'Xóa nhãn dán', async () => { if (await confirmBox('Xóa nhãn dán này khỏi nhóm? Tin nhắn cũ dùng nhãn dán này sẽ hiện “Nhãn dán đã bị xóa”.', 'Xóa', true) && await NXHN.delSticker(s.id)) { stickers.delete(s.id); say('Đã xóa nhãn dán.'); close(); stkPanel(); } }, 'stk-del') : null)));
    if (!rows.length) grid.append(h('p', { className: 'empty', textContent: 'Nhóm chưa có nhãn dán. Hãy tạo nhãn dán đầu tiên.' }));
  })();
};
const stickerBox = () => {
  const c0 = cid, nameIn = h('input', { maxLength: 40, placeholder: 'Tên nhãn dán (tùy chọn)', 'aria-label': 'Tên nhãn dán' });
  imageBox({ title: 'Tạo nhãn dán', label: 'Tạo nhãn dán', shape: 'square', extra: { el: h('div', { className: 'field' }, nameIn) }, onSave: async (f) => {
    const path = await upFile(f, 'stk'); if (!path) return false;
    const s = await NXHN.createSticker(c0, path, nameIn.value.trim());
    if (!s || s === true) { sb.storage.from('media').remove([path]); return false; }
    stickers.set(s.id, s); say('Đã tạo nhãn dán.'); if (c0 === cid) stkPanel(); return true;
  } });
};
// Ảnh nền cuộc trò chuyện: riêng từng người, từng cuộc trò chuyện; làm mờ để chữ vẫn dễ đọc
const bgEl = h('div', { className: 'chat-bg' }), bgWrap = h('div', { className: 'chat-bgwrap', 'aria-hidden': 'true', hidden: true }, bgEl);
const applyBg = async (id) => {
  const s = cstate.get(id), path = s && s.bg_path;
  bgEl.style.backgroundImage = ''; bgWrap.hidden = !path;
  if (!path) return;
  await signAv([path]);
  const u = avUrl.get(path);
  if (u && cid === id) { bgEl.style.backgroundImage = `url("${u}")`; bgEl.style.setProperty('--bgblur', (s.bg_blur == null ? 8 : s.bg_blur) + 'px'); }
};
const bgBox = () => {
  const id = cid, s0 = cstate.get(id) || {};
  const rng = h('input', { type: 'range', min: 0, max: 20, step: 1, value: s0.bg_blur == null ? 8 : s0.bg_blur, 'aria-label': 'Độ mờ ảnh nền' });
  const wrap = h('div', { className: 'field' }, h('label', { textContent: 'Độ mờ ảnh nền' }), rng, h('small', { className: 'field-help', textContent: 'Chỉ áp dụng cho bạn, trong cuộc trò chuyện này.' }));
  const blur = (prev) => { const im = prev && prev.querySelector('img'); if (im) im.style.filter = `blur(${rng.value}px)`; };
  let pv2 = null; rng.oninput = () => blur(pv2);
  imageBox({ title: 'Ảnh nền cuộc trò chuyện', extra: { el: wrap, onFile: (p) => { pv2 = p; blur(p); } }, onSave: async (f) => {
    const path = await upFile(f, 'bg'); if (!path) return false;
    if (!(await NXHN.setConvState(id, { bg_path: path, bg_blur: +rng.value }))) { sb.storage.from('media').remove([path]); return false; }
    if (s0.bg_path && s0.bg_path !== path) sb.storage.from('media').remove([s0.bg_path]);
    if (cid === id) await applyBg(id);
    say('Đã đặt ảnh nền.'); if (chatBox.hasAttribute('data-info')) renderInfo(); return true;
  } });
};
const removeBg = async () => {
  const id = cid, s = cstate.get(id);
  if (!s || !s.bg_path || !(await confirmBox('Gỡ ảnh nền của cuộc trò chuyện này?', 'Gỡ nền', false, 'Gỡ ảnh nền'))) return;
  if (await NXHN.setConvState(id, { bg_path: null, bg_blur: null })) { sb.storage.from('media').remove([s.bg_path]); await applyBg(id); renderInfo(); }
};
// Panel thông tin (cột thứ ba trên màn hình rộng, lớp phủ trên màn hình hẹp)
const infoEl = h('aside', { className: 'chat-info', 'aria-label': 'Thông tin cuộc trò chuyện' });
const kickOut = async (c0, id) => { if (!(await confirmBox(`Xóa ${N(id)} khỏi nhóm?`, 'Xóa khỏi nhóm', true))) return; if (await NXHN.kick(c0, id)) { say('Đã xóa thành viên.'); if (c0 === cid) renderInfo(); convList(); } };
const transferTo = async (c0, id) => {
  if (!(await confirmBox(`Chuyển quyền trưởng nhóm cho ${N(id)}? Bạn sẽ trở thành thành viên thường.`, 'Chuyển quyền', false, 'Chuyển quyền trưởng nhóm'))) return;
  if (await NXHN.transferLead(c0, id)) { curOwner = id; convInfo.set(c0, { ...(convInfo.get(c0) || {}), owner: id }); say('Đã chuyển quyền trưởng nhóm.'); renderInfo(); }
};
const renderInfo = async () => {
  const c0 = cid, grp = isGroup, title = ctitle.textContent, lead = grp && curOwner === user.id, s = cstate.get(c0), mem = h('ul', { className: 'timeline' });
  const act = (t, fn, cls = 'btn-secondary') => btn(t, fn, cls);
  infoEl.replaceChildren(
    h('div', { className: 'info-top' }, h('b', { textContent: 'Thông tin' }), ibtn('x', 'Đóng thông tin', () => toggleInfo(false))),
    h('div', { className: 'info-head' }, grp ? gav(c0, title) : avt(peer || '?'), h('b', { textContent: title }), grp ? h('span', { className: 'ct-sub', textContent: ((convInfo.get(c0) || {}).count || '') + ' thành viên' }) : null),
    h('div', { className: 'info-act' },
      h('h4', { textContent: 'Chung' }),
      grp ? act('Thêm thành viên', () => invitePicker()) : act('Xem hồ sơ', () => openProfile(peer)),
      grp ? act('Nhãn dán của nhóm', () => stkPanel()) : null,
      act('Tin nhắn đã ghim', () => pinBox()),
      act('Đặt ảnh nền', () => bgBox()), s && s.bg_path ? act('Gỡ ảnh nền', () => removeBg()) : null,
      lead ? h('h4', { textContent: 'Quản trị nhóm' }) : null,
      lead ? act('Đổi tên nhóm', () => renameBox()) : null,
      lead ? act('Đổi ảnh nhóm', () => groupAvatarBox()) : null,
      lead ? act(perm.announce_only ? 'Cho mọi người gửi tin' : 'Chỉ trưởng nhóm được gửi tin', async () => { if (await NXHN.setAnnounce(c0, !perm.announce_only)) { await refreshPerm(); renderInfo(); } }) : null,
      h('h4', { textContent: 'Hành động nguy hiểm' }),
      act('Xóa cuộc trò chuyện', () => clearConv(c0, title), 'btn-danger')),
    grp ? h('h3', { className: 'sec', textContent: 'Thành viên' }) : null, grp ? mem : null);
  if (!grp) return;
  mem.append(...skel(2));
  const ms = await NXHN.members([c0]), ids = [...new Set((Array.isArray(ms) ? ms : []).map((m) => m.user_id))];
  await nm(ids);
  if (c0 !== cid) return;
  const restr = lead ? await NXHN.restrictions(c0) : new Set();
  if (c0 !== cid) return;
  convInfo.set(c0, { ...(convInfo.get(c0) || {}), count: ids.length });
  ids.sort((a, b) => (a === curOwner ? -1 : b === curOwner ? 1 : N(a).localeCompare(N(b))));
  mem.replaceChildren(...ids.map((id) => h('li', { className: 'member' }, avt(id),
    h('span', { className: 'person-main' }, nameLink(id, id === user.id ? N(id) + ' (bạn)' : undefined), id === curOwner ? h('span', { className: 'tag lead-tag', textContent: 'Trưởng nhóm' }) : null, restr.has(id) ? h('span', { className: 'tag lock-tag', textContent: 'Bị khóa chat' }) : null),
    lead && id !== user.id ? ibtn('more', 'Quản lý thành viên', (b) => { const r = b.getBoundingClientRect(); menu(r.right - 210, r.bottom + 4, [['Chuyển quyền trưởng nhóm', () => transferTo(c0, id)], [restr.has(id) ? 'Mở khóa chat' : 'Khóa chat', () => toggleRestrict(c0, id, !restr.has(id))], ['Xóa khỏi nhóm', () => kickOut(c0, id), 'danger']]); }) : null)));
};
const chatBox = h('div', { className: 'chat' },
  h('div', { className: 'chat-list' }, h('div', { className: 'list-head' }, h('b', { textContent: 'Đoạn chat' }), ibtn('bookmark', 'Kho lưu trữ', () => savedBox()), ibtn('plus', 'Tạo nhóm', () => newGroup())), clist),
  h('div', { className: 'chat-pane' }, bgWrap, head, pinBar, olderBtn, mlist, rbar, mform),
  infoEl,
  h('div', { className: 'chat-empty' }, ico('chat'), h('p', { textContent: 'Chọn một cuộc trò chuyện để bắt đầu.' })));
cv.append(chatBox);
mlist.addEventListener('scroll', () => { pin = mlist.scrollHeight - mlist.scrollTop - mlist.clientHeight < 80; }, { passive: true });
const convInfo = new Map();
const convList = async () => {
  const [, cs] = await Promise.all([NXHN.convStates(), NXHN.conversations()]);
  if (!Array.isArray(cs)) { if (!clist.children.length) clist.append(h('li', { className: 'empty', textContent: 'Không tải được danh sách chat.' })); return; }
  cs.forEach((c) => { if (c.avatar_path) avPath.set('g:' + c.id, c.avatar_path); });
  const ms = cs.length ? await NXHN.members(cs.map((c) => c.id)) : [], mem = Array.isArray(ms) ? ms : [];
  const last = cs.length ? await NXHN.lastMsgs(cs.map((c) => c.id)) : {};
  await nm([...mem.map((m) => m.user_id), ...Object.values(last).map((l) => l.sender_id)]);
  await signAv(cs.map((c) => c.avatar_path)); paint();
  const vis = ({ c, l }) => { const st = cstate.get(c.id); return !st || !st.cleared_at || (l && new Date(l.created_at) > new Date(st.cleared_at)); };
  const rows = cs.map((c) => {
    const all = mem.filter((m) => m.conversation_id === c.id), others = all.filter((m) => m.user_id !== user.id).map((m) => m.user_id);
    convInfo.set(c.id, { peer: c.is_group ? null : others[0] || null, count: all.length, owner: c.owner_id || null });
    return { c, l: last[c.id], t: c.title || others.map(N).join(', ') || 'Cuộc trò chuyện' };
  }).filter(vis).sort((a, b) => new Date(b.l ? b.l.created_at : b.c.created_at) - new Date(a.l ? a.l.created_at : a.c.created_at));
  const cur0 = rows.find((r) => r.c.id === cid); // tên/chủ nhóm đổi bởi người khác → cập nhật khung chat đang mở
  if (cur0 && cur0.c.is_group) { ctitle.textContent = cur0.t; curOwner = cur0.c.owner_id || curOwner; }
  const prev = ({ c, l }) => !l ? 'Chưa có tin nhắn' : l.deleted_at ? 'Tin nhắn đã được xóa'
    : (l.kind === 'anon' ? 'Ẩn danh: ' : l.sender_id === user.id ? 'Bạn: ' : (c.is_group && l.sender_id ? N(l.sender_id) + ': ' : '')) + (l.body === STK_MARK ? 'Đã gửi một nhãn dán' : l.body === IMG_MARK ? 'Đã gửi một ảnh' : l.body === POLL_MARK ? 'Đã tạo một bình chọn' : l.body);
  clist.replaceChildren(...rows.map((r) => {
    const del = () => clearConv(r.c.id, r.t);
    const li = h('li', { className: 'conv-li' },
      h('button', { className: 'conv' + (r.c.id === cid ? ' active' : ''), type: 'button', 'data-id': r.c.id, onclick: () => openConv(r.c.id, r.t, r.c.is_group) },
        r.c.is_group ? gav(r.c.id, r.t, 'lg') : avt(convInfo.get(r.c.id).peer || '?', 'lg'),
        h('span', { className: 'conv-main' },
          h('span', { className: 'conv-top' }, h('b', { className: 'conv-name', textContent: r.t }), h('time', { className: 'conv-time', textContent: r.l ? ago(r.l.created_at) : '' })),
          h('span', { className: 'conv-prev', textContent: prev(r) }))),
      ibtn('more', 'Tùy chọn cuộc trò chuyện', (b) => { const q2 = b.getBoundingClientRect(); menu(q2.right - 200, q2.bottom + 4, [['Xóa cuộc trò chuyện', del, 'danger']]); }, 'conv-more'));
    li.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(e.clientX, e.clientY, [['Xóa cuộc trò chuyện', del, 'danger']]); });
    return li;
  }));
  if (!rows.length) clist.append(h('li', { className: 'empty', textContent: 'Chưa có cuộc trò chuyện. Vào Mọi người để tìm bạn và nhắn tin.' }));
};
const openConv = (id, title, grp, pid) => {
  const ci = convInfo.get(id) || {};
  cid = id; pin = true; isGroup = !!grp; peer = grp ? null : (pid || ci.peer || null); curOwner = ci.owner || null;
  stkBtn.hidden = anonBtn.hidden = !isGroup; anonOn = false; paintAnon(); setReply(null); clearFiles(); if (isGroup) showLeft();
  pinIds.clear(); paintPins(); perm = { can_send: true }; applyPerm(); loadPins(id); refreshPerm(); ensureMine(); NXHN.readConv(id);
  oldest = null;
  ctitle.textContent = title;
  csub.textContent = isGroup ? (ci.count ? ci.count + ' thành viên' : 'Nhóm chat') : ''; csub.hidden = !csub.textContent;
  cav.replaceChildren(isGroup ? gav(id, title) : avt(peer || '?'));
  chatBox.dataset.open = '1'; chatBox.removeAttribute('data-info');
  clist.querySelectorAll('.conv').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  mtext.value = ''; fit(); upd(); applyBg(id);
  mlist.replaceChildren(...skel(3));
  loadMsgs(false);
};
const msgRow = (m, prev) => {
  if (m.deleted_at) return goneRow(m.id);
  if (m.kind === 'system') return h('li', { className: 'msg gone sys', 'data-id': m.id }, h('span', { textContent: m.body }));
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id, stk = !!m.sticker_id || m.body === STK_MARK, imgOnly = m.body === IMG_MARK, isPoll = m.body === POLL_MARK;
  const media = stk || isPoll ? null : h('div', { className: 'media' });
  // tin liên tiếp của cùng một người (trong 5 phút) chỉ hiện avatar/tên ở tin đầu cụm
  const cont = !anon && !!prev && !prev.deleted_at && prev.kind !== 'anon' && prev.kind !== 'system' && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 300000;
  const side = own ? null : h('span', { className: 'msg-av' }, cont ? null : anon ? av0('?', 'anon-av') // ẩn danh: không avatar/tên cá nhân
    : h('button', { className: 'plain', type: 'button', 'aria-label': 'Xem hồ sơ ' + N(m.sender_id), onclick: () => openProfile(m.sender_id) }, avt(m.sender_id)));
  const sd = m.sticker_id ? stickers.get(m.sticker_id) : null;
  const content = stk ? (sd && avUrl.get(sd.storage_path)
    ? h('img', { className: 'sticker', src: avUrl.get(sd.storage_path), alt: sd.name || 'Nhãn dán', draggable: false, oncontextmenu: (e) => e.preventDefault() })
    : h('p', { className: 'post-body muted', textContent: 'Nhãn dán đã bị xóa' })) : imgOnly ? null : isPoll ? pollCard(m) : h('p', { className: 'post-body', textContent: m.body });
  const quote = m.reply ? h('button', { className: 'quote', 'data-q': m.reply_to, type: 'button', onclick: (e) => { e.stopPropagation(); jumpTo(m.reply_to); } }, h('b', { textContent: qname(m.reply) }), h('span', { textContent: qtext(m.reply).slice(0, 80) }))
    : m.reply_to ? h('div', { className: 'quote', textContent: 'Tin nhắn gốc không còn' }) : null;
  const bub = h('div', { className: 'bubble' + (stk ? ' stk' : '') + (isPoll ? ' poll-b' : '') },
    cont || own ? null : anon ? h('b', { className: 'msg-name', textContent: 'Ẩn danh' }) : (isGroup ? h('span', { className: 'msg-name' }, nameLink(m.sender_id)) : null),
    quote, content, media,
    h('time', { className: 'post-time', dateTime: m.created_at, textContent: hm(m.created_at), title: when(m.created_at) }));
  const li = h('li', { className: 'msg ' + (anon ? 'anon' : own ? 'mine' : 'other') + (cont ? ' cont' : '') + (pinIds.has(m.id) ? ' pinned' : ''), 'data-id': m.id });
  const more = ibtn('more', 'Tùy chọn tin nhắn', (b) => { const r = b.getBoundingClientRect(); menu(r.left, r.bottom + 2, msgItems(li, m)); }, 'msg-more');
  li.append(...(own ? [more, bub] : [side, bub, more]));
  li._m = m;
  if (media && !anon) queueImg(media, 'message_id', m.id);
  arm(li, m);
  return li;
};
const loadMsgs = async (older) => {
  const c0 = cid, rows = await NXHN.loadMessages(c0, older ? oldest : null);
  if (c0 !== cid) return;
  mlist.querySelectorAll('.skel').forEach((x) => x.remove());
  if (!Array.isArray(rows)) {
    if (!older && !mlist.children.length) mlist.append(h('li', { className: 'msgs-empty empty' }, 'Không tải được tin nhắn. ', btn('Thử lại', () => loadMsgs(false))));
    return;
  }
  await Promise.all([nm([...rows.map((m) => m.sender_id), ...rows.map((m) => m.reply && m.reply.sender_id)]), loadStickers(rows)]);
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
    if (stick) { toEnd(); requestAnimationFrame(toEnd); }
  }
  if (rows.length) oldest = rows[0].created_at;
  olderBtn.hidden = rows.length < PAGE;
};
// ---- Bình chọn, thành tựu, thông báo thông minh (cần chạy nxhn_chat_upgrade_2.sql) ----
const nosql = (r) => !!r.error && MISSING.test((r.error.code || '') + ' ' + (r.error.message || ''));
const rd = (r) => (r.error ? (nosql(r) ? 'nosql' : null) : r.data); // 'nosql' = chưa chạy SQL, null = lỗi tải
const badge = async () => {
  const n = await NXHN.unread();
  bellBadge.textContent = n > 99 ? '99+' : String(n); bellBadge.hidden = !n;
  bellBtn.setAttribute('aria-label', n ? `Thông báo (${n} chưa đọc)` : 'Thông báo');
};
const badgeSoon = deb(badge);
Object.assign(NXHN, {
  createPoll: (c, f) => sb.rpc('create_poll', { p_conv: c, p_question: f.question, p_options: f.options.map((o) => o.label), p_multi: f.multi, p_anon: f.anon, p_edit_mode: f.mode, p_minutes: f.minutes || null }).then((r) => soft(r, 'bình chọn')),
  editPoll: (d, f) => sb.rpc('edit_poll', { p_poll: d.id, p_rev: d.rev, p_question: f.question, p_options: f.options, p_multi: f.multi, p_edit_mode: f.mode, p_minutes: f.minutes }).then((r) => soft(r, 'bình chọn')),
  closePoll: (id, on) => sb.rpc('set_poll_closed', { p_poll: id, p_closed: on }).then((r) => soft(r, 'bình chọn')),
  vote: (id, opts) => sb.rpc('vote_poll', { p_poll: id, p_options: opts }).then((r) => soft(r, 'bình chọn')),
  pollView: async (ids) => { const d = rd(await sb.rpc('poll_view', { p_msgs: ids })); return d === 'nosql' || d === null ? d : (Array.isArray(d) ? d : []); },
  ach: async (uid) => rd(await sb.rpc('achievements_get', { p_user: uid || null })),
  achPublic: (on) => sb.rpc('set_achievements_public', { p_on: on }).then((r) => soft(r, 'thành tựu')),
  readConv: (c) => sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('conversation_id', c).is('read_at', null).select('id').then((r) => { if (!r.error && r.data && r.data.length) badgeSoon(); }),
  // f: all | unread | chat | act. Chưa chạy SQL (thiếu cột/loại mới) → tự lùi về truy vấn cũ.
  loadNotifications: async (before, f = 'all') => {
    const T = { chat: ['message', 'reply', 'mention', 'invite'], act: ['follow', 'comment', 'achievement'] };
    const tries = f === 'chat' ? [T.chat] : f === 'act' ? [T.act, ['follow', 'comment']] : [null];
    let r = null;
    for (const ts of tries) for (const c of ['id,type,actor_id,post_id,read_at,created_at,conversation_id,message_id,meta', 'id,type,actor_id,post_id,read_at,created_at']) {
      let qq = sb.from('notifications').select(c).order('created_at', { ascending: false }).limit(PAGE);
      if (before) qq = qq.lt('created_at', before);
      if (f === 'unread') qq = qq.is('read_at', null);
      if (ts) qq = qq.in('type', ts);
      r = await qq; if (!r.error) return r.data || [];
    }
    return f === 'chat' && r.error.code === '22P02' ? [] : ok(r);
  },
});
const lk = (t, fn) => h('button', { className: 'plain link-btn', type: 'button', textContent: t, onclick: fn });

// ---- Bình chọn: số phiếu và quyền do máy chủ tính; giao diện chỉ hiển thị kết quả máy chủ trả về ----
const pq = new Set(); let pqt = 0;
const pollLoad = (id) => { // gom nhiều bình chọn trong cùng khung chat vào một lượt gọi
  pq.add(id); clearTimeout(pqt);
  pqt = setTimeout(async () => {
    const ids = [...pq]; pq.clear();
    const r = await NXHN.pollView(ids);
    ids.forEach((i) => { const d = Array.isArray(r) ? r.find((x) => x.message_id === i) : r; mlist.querySelectorAll(`.poll[data-m="${i}"]`).forEach((el) => drawPoll(el, d)); });
  }, 30);
};
const pollCard = (m) => { const el = h('div', { className: 'poll', 'data-m': m.id }, h('div', { className: 'skel' })); pollLoad(m.id); return el; };
const castVote = async (el, d, o) => {
  if (el._busy) return; el._busy = true; el.classList.add('busy');
  const cur = new Set(d.mine), had = cur.has(o.id);
  if (!d.multi) cur.clear();
  if (d.multi && had) cur.delete(o.id); else if (!had) cur.add(o.id); // chọn một: bấm lại phương án đang chọn = rút phiếu
  await NXHN.vote(d.id, [...cur]);
  el._busy = false; el.classList.remove('busy'); pollLoad(d.message_id);
};
const togglePoll = async (d, close) => {
  const msg = close ? 'Đóng bình chọn này? Thành viên sẽ không bỏ phiếu thêm được.' : 'Mở lại bình chọn? Các phiếu đã bầu được giữ nguyên và thời hạn cũ sẽ được gỡ.';
  if (!(await confirmBox(msg, close ? 'Đóng bình chọn' : 'Mở lại', close, close ? 'Đóng bình chọn' : 'Mở lại bình chọn'))) return;
  if (await NXHN.closePoll(d.id, close)) pollLoad(d.message_id);
};
const votersBox = async (d) => {
  await nm([...new Set(d.options.flatMap((o) => o.voters || []))]);
  dlg(modal(h('h2', { textContent: 'Người đã bỏ phiếu' }), ...d.options.map((o) => h('div', { className: 'voters' }, h('b', { textContent: `${o.label} (${o.votes})` }),
    h('p', { className: 'post-time handle', textContent: (o.voters || []).map(N).join(', ') || 'Chưa có phiếu' })))));
};
const drawPoll = (el, d) => {
  if (!d || typeof d !== 'object') {
    el.replaceChildren(h('div', {}, h('p', { className: 'post-body muted', textContent: d === 'nosql' ? 'Máy chủ chưa có tính năng bình chọn: hãy chạy nxhn_chat_upgrade_2.sql.' : d === null ? 'Không tải được bình chọn.' : 'Bình chọn không còn tồn tại.' }),
      d === null ? lk('Thử lại', () => { el.replaceChildren(h('div', { className: 'skel' })); pollLoad(el.dataset.m); }) : null));
    return;
  }
  const closed = d.closed || (d.closes_at && new Date(d.closes_at) <= new Date()), sel = new Set(d.mine);
  el.classList.toggle('poll-multi', !!d.multi);
  const opts = d.options.map((o) => {
    const on = sel.has(o.id), pct = d.total ? Math.round((o.votes / d.total) * 100) : 0;
    const b = h('button', { className: 'poll-opt' + (on ? ' on' : ''), type: 'button', role: d.multi ? 'checkbox' : 'radio', 'aria-checked': String(on), disabled: !!closed, onclick: () => castVote(el, d, o) },
      h('span', { className: 'poll-fill' }), h('span', { className: 'poll-mark' }, on ? ico('check') : null), h('span', { className: 'poll-label', textContent: o.label }),
      h('span', { className: 'poll-n', textContent: d.total ? `${o.votes} · ${pct}%` : '0' }));
    b.firstChild.style.width = pct + '%';
    return b;
  });
  el.replaceChildren(
    h('div', { className: 'poll-meta' }, h('span', { textContent: 'Bình chọn' }), h('span', { textContent: d.multi ? 'Chọn nhiều' : 'Chọn một' }), h('span', { textContent: d.anonymous ? 'Ẩn danh' : 'Công khai' })),
    h('p', { className: 'poll-q', textContent: d.question }), ...opts,
    h('div', { className: 'poll-foot' },
      h('span', { textContent: `${d.total} người đã bỏ phiếu` + (closed ? ' · Đã đóng' : d.closes_at ? ' · Đóng lúc ' + when(d.closes_at) : '') }),
      !d.anonymous && d.total ? lk('Xem người bỏ phiếu', () => votersBox(d)) : null,
      d.can_edit && !closed ? lk('Chỉnh sửa', () => pollEdit(d)) : null,
      d.can_close ? lk(closed ? 'Mở lại' : 'Đóng bình chọn', () => togglePoll(d, !closed)) : null));
};
// Biểu mẫu dùng chung cho tạo và sửa. Đã có phiếu → khóa phần làm sai lệch kết quả (máy chủ kiểm tra lại).
const DL = [['', 'Giữ nguyên thời hạn'], ['0', 'Không giới hạn'], ['60', '1 giờ'], ['1440', '24 giờ'], ['4320', '3 ngày'], ['10080', '7 ngày']];
const pollForm = ({ title, label, d, onSave }) => {
  const lock = !!d && d.total > 0, mgr = !d || d.can_close;
  const qi = h('input', { maxLength: 200, value: d ? d.question : '', placeholder: 'Câu hỏi bình chọn', 'aria-label': 'Câu hỏi bình chọn', disabled: lock });
  const rows = h('div', { className: 'poll-edit' }), err = h('p', { className: 'form-err', hidden: true });
  const add = btn('Thêm phương án', () => { addRow().focus(); }, 'btn-secondary');
  const sync = () => { const n = rows.children.length; add.disabled = n >= 10; rows.querySelectorAll('.ibtn').forEach((b) => { b.disabled = n <= 2; }); };
  const addRow = (o) => {
    const inp = h('input', { maxLength: 100, value: o ? o.label : '', placeholder: 'Phương án', 'aria-label': 'Phương án', disabled: !!(o && lock) });
    const row = h('div', { className: 'poll-row' }, inp, ibtn('x', 'Xóa phương án', () => { if (o && o.votes) return say('Phương án đã có phiếu nên không thể xóa.'); row.remove(); sync(); }));
    row._o = o || null; row._i = inp; rows.append(row); sync(); return inp;
  };
  (d ? d.options : [null, null]).forEach((o) => addRow(o));
  const multi = h('input', { type: 'checkbox', checked: !!(d && d.multi), disabled: !!(d && d.multi && lock) });
  const anon = h('input', { type: 'checkbox', checked: !!(d && d.anonymous), disabled: !!d });
  const mode = h('select', { 'aria-label': 'Ai được chỉnh sửa bình chọn', disabled: !mgr }, [['creator', 'Chỉ người tạo và trưởng nhóm'], ['members', 'Mọi thành viên trong nhóm']].map(([v, t]) => h('option', { value: v, textContent: t, selected: d ? d.edit_mode === v : v === 'creator' })));
  const dl = h('select', { 'aria-label': 'Thời hạn bình chọn' }, DL.filter(([v]) => d || v !== '').map(([v, t]) => h('option', { value: v, textContent: t, selected: d ? v === '' : v === '0' })));
  const ok7 = h('button', { className: 'btn btn-primary', type: 'submit', textContent: label });
  const close = modal(h('h2', { textContent: title }), h('form', { className: 'form', onsubmit: (ev) => {
    ev.preventDefault(); err.hidden = true;
    const f = { question: qi.value.trim(), options: [...rows.children].map((r) => ({ id: r._o ? r._o.id : null, label: r._i.value.trim() })), multi: multi.checked, anon: anon.checked, mode: mode.value, minutes: dl.value === '' ? null : +dl.value };
    const low = f.options.map((o) => o.label.toLowerCase());
    const why = !f.question ? 'Hãy nhập câu hỏi.' : f.options.some((o) => !o.label) ? 'Phương án không được để trống.' : new Set(low).size < low.length ? 'Các phương án không được trùng nhau.' : '';
    if (why) { err.textContent = why; err.hidden = false; return; }
    busy(ok7, async () => { if (await onSave(f)) close(); });
  } },
  h('div', { className: 'field' }, h('label', { textContent: 'Câu hỏi' }), qi),
  h('div', { className: 'field' }, h('label', { textContent: 'Phương án (2–10)' }), rows, add),
  h('label', { className: 'check' }, multi, 'Cho phép chọn nhiều phương án'),
  d ? null : h('label', { className: 'check' }, anon, 'Ẩn danh: không ai thấy ai đã bầu gì'),
  h('div', { className: 'field' }, h('label', { textContent: 'Ai được chỉnh sửa bình chọn' }), mode),
  h('div', { className: 'field' }, h('label', { textContent: 'Thời hạn' }), dl),
  lock ? h('p', { className: 'field-help', textContent: 'Đã có phiếu bầu: không đổi được câu hỏi, nội dung phương án hay tắt chế độ chọn nhiều. Vẫn thêm được phương án, xóa phương án chưa có phiếu và đổi thời hạn.' }) : null,
  err, h('div', { className: 'actions dlg-act' }, btn('Hủy', () => close()), ok7)));
  dlg(close);
};
const pollEdit = (d) => pollForm({ title: 'Chỉnh sửa bình chọn', label: 'Lưu thay đổi', d, onSave: async (f) => {
  const r = await NXHN.editPoll(d, f); pollLoad(d.message_id);
  if (r) say('Đã cập nhật bình chọn.');
  return !!r;
} });
const pollCreate = () => { const c0 = cid; pollForm({ title: 'Tạo bình chọn', label: 'Tạo bình chọn', onSave: async (f) => {
  const id = await NXHN.createPoll(c0, f); if (!id || id === true) return false;
  const [m] = await NXHN.msgsByIds([id]);
  if (m && cid === c0) { pin = true; addMsg(m); }
  say('Đã tạo bình chọn.'); return true;
} }); };

// ---- Thành tựu và danh hiệu (điều kiện, tên, ngưỡng nằm ở bảng achievement_defs trên máy chủ) ----
const AG = { activity: 'Hoạt động', chat: 'Nhắn tin', community: 'Bạn bè và cộng đồng', personal: 'Nhãn dán và cá nhân hóa', special: 'Đặc biệt' };
const achBox = async (uid) => {
  const self = uid === user.id, body = h('div', {}, h('div', { className: 'skel tall' }));
  const close = modal(h('h2', { textContent: self ? 'Thành tựu của tôi' : 'Thành tựu của ' + N(uid) }), body); dlg(close);
  if (self) { const n = rd(await sb.rpc('check_achievements')); if (Array.isArray(n) && n.length) { say(`Bạn vừa đạt danh hiệu ${n[0].icon} ${n[0].name}`); badgeSoon(); } }
  const a = await NXHN.ach(self ? null : uid);
  if (!a || a === 'nosql' || !Array.isArray(a.defs)) return body.replaceChildren(h('p', { className: 'empty', textContent: a === 'nosql' ? 'Máy chủ chưa có tính năng thành tựu: hãy chạy nxhn_chat_upgrade_2.sql.' : 'Không tải được thành tựu, hãy thử lại.' }));
  if (!a.self && !a.public) return body.replaceChildren(h('p', { className: 'empty', textContent: 'Người này không công khai thành tựu.' }));
  const got = a.defs.filter((x) => x.earned_at).length;
  const fmt = (x) => (/_h$/.test(x.metric) ? Math.round((+x.value || 0) * 10) / 10 : Math.floor(+x.value || 0));
  const prog = (x) => (a.self && x.metric !== 'manual' && x.value != null ? h('div', { className: 'ach-prog' },
    h('div', { className: 'ach-bar' }, h('i', { style: `width:${Math.min(100, Math.round(((+x.value || 0) / x.threshold) * 100))}%` })),
    h('span', { className: 'post-time', textContent: `${fmt(x)}/${x.threshold}` })) : null);
  const groups = [...new Set([...Object.keys(AG), ...a.defs.map((x) => x.grp)])];
  body.replaceChildren(h('div', {},
    h('p', { className: 'ach-sum', textContent: a.self ? `Đã đạt ${got}/${a.defs.length} danh hiệu` : `${got} danh hiệu` }),
    a.self ? h('label', { className: 'check' }, h('input', { type: 'checkbox', checked: !!a.public, onchange: async (e) => {
      const on = e.target.checked;
      if (await NXHN.achPublic(on)) say(on ? 'Người khác có thể xem thành tựu của bạn.' : 'Đã ẩn thành tựu của bạn.'); else e.target.checked = !on;
    } }), 'Cho phép người khác xem thành tựu của tôi') : null,
    ...groups.map((g) => { const L = a.defs.filter((x) => x.grp === g); return L.length ? h('div', {}, h('h3', { className: 'sec', textContent: AG[g] || g }),
      h('ul', { className: 'ach-list' }, L.map((x) => h('li', { className: 'ach' + (x.earned_at ? '' : ' off') }, h('span', { className: 'ach-ic', textContent: x.icon }),
        h('div', { className: 'ach-main' }, h('b', { textContent: x.name }), h('span', { textContent: x.description }),
          x.earned_at ? h('span', { className: 'post-time', textContent: 'Đạt ngày ' + new Date(x.earned_at).toLocaleDateString('vi-VN') }) : prog(x)))))) : null; })));
};
// Ghi nhận hoạt động thật: chỉ khi tab đang hiển thị và có thao tác trong 2 phút gần nhất; máy chủ giới hạn tốc độ và trần mỗi ngày
['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
const pingAct = async () => {
  if (!user || document.visibilityState !== 'visible' || Date.now() - lastAct > 120000) return;
  const r = await sb.rpc('ping_activity');
  if (r.error) { if (nosql(r)) clearInterval(actT); return; }
  if (Array.isArray(r.data) && r.data.length) { say(`Bạn vừa đạt danh hiệu ${r.data[0].icon} ${r.data[0].name}`); badgeSoon(); }
};

// ---- Trung tâm thông báo ----
const postBox = async (id) => {
  if (!id) return say('Bài viết không còn tồn tại.');
  const r = await sb.from('posts').select('*').eq('id', id).maybeSingle();
  if (r.error) return fail(r.error);
  if (!r.data) return say('Bài viết không còn hoặc bạn không có quyền xem.');
  await nm([r.data.author_id]);
  const close = modal(), li = renderPost({ ...r.data, author: { username: names.get(r.data.author_id) } });
  li.classList.add('post-solo'); close.sheet.append(li);
  const b = li.querySelector('.act-link'); if (b) b.click(); // mở sẵn bình luận
};
const gotoConv = async (c, mid) => {
  if (!c) return say('Thông báo này không còn liên kết tới cuộc trò chuyện.');
  go('chat', true); await convList();
  const b = clist.querySelector(`.conv[data-id="${c}"]`);
  if (!b) return say('Cuộc trò chuyện không còn hoặc bạn đã không còn trong nhóm.');
  if (cid !== c) b.click();
  if (mid) setTimeout(() => jumpTo(mid), cid === c ? 100 : 1200);
};
const readConvSoon = deb(() => { if (cid) NXHN.readConv(cid); });
const NI = { message: 'chat', reply: 'reply', mention: 'at', invite: 'users', follow: 'user', comment: 'chat', achievement: 'medal' };
const notifRow = (r, cv) => {
  const n = (r.meta && +r.meta.n) || 1, who = r.actor_id ? N(r.actor_id) : 'Một người ẩn danh', tt = cv && cv.is_group && cv.title ? cv.title : '', at = tt ? ' trong ' + tt : '';
  const txt = ({
    follow: `${who} đã theo dõi bạn`, comment: `${who} đã bình luận bài viết của bạn`, reply: `${who} đã trả lời tin nhắn của bạn${at}`,
    mention: `${who} đã nhắc đến bạn${at}`, invite: `${who} đã thêm bạn vào nhóm${tt ? ' ' + tt : ''}`,
    message: n > 1 ? `${n} tin nhắn mới${at}${r.actor_id ? ', gần nhất từ ' + who : ''}` : `${who} đã gửi tin nhắn mới${at}`,
    achievement: `Bạn vừa đạt danh hiệu ${(r.meta && r.meta.icon) || '🏅'} ${(r.meta && r.meta.name) || 'mới'}`,
  })[r.type] || 'Bạn có thông báo mới';
  const read = () => {
    if (r.read_at) return; r.read_at = new Date().toISOString(); li.classList.remove('unread');
    const x = li.querySelector('.nf-read'); if (x) x.remove();
    NXHN.markRead(r.id).then(() => badgeSoon());
  };
  const open = () => {
    read();
    if (r.type === 'follow') return r.actor_id && openProfile(r.actor_id);
    if (r.type === 'comment') return postBox(r.post_id);
    if (r.type === 'achievement') return achBox(user.id);
    return gotoConv(r.conversation_id, r.message_id);
  };
  const li = h('li', { className: 'post notif' + (r.read_at ? '' : ' unread'), tabIndex: 0, role: 'link', onclick: open, onkeydown: (e) => { if (e.key === 'Enter') open(); } },
    r.actor_id && r.type !== 'achievement' ? avt(r.actor_id) : h('span', { className: 'notif-ico' }, ico(NI[r.type] || 'bell')),
    h('div', { className: 'notif-main' }, h('p', { className: 'notif-t', textContent: txt }), h('time', { className: 'post-time', textContent: when(r.created_at) })),
    r.read_at ? null : h('button', { className: 'plain link-btn nf-read', type: 'button', textContent: 'Đã đọc', onclick: (e) => { e.stopPropagation(); read(); } }));
  return li;
};
let nfilter = 'all';
const nv = addView('notifs', 'Thông báo', () => { nf.load(true); badge(); });
const nf = feed((c) => NXHN.loadNotifications(c, nfilter), async (ul, rows) => {
  await nm(rows.map((r) => r.actor_id));
  const cids = [...new Set(rows.map((r) => r.conversation_id).filter(Boolean))], cs = new Map();
  if (cids.length) { const r = await sb.from('conversations').select('id,title,is_group').in('id', cids); (r.data || []).forEach((x) => cs.set(x.id, x)); }
  rows.forEach((r) => ul.append(notifRow(r, cs.get(r.conversation_id))));
}, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có thông báo.');
const NFT = [['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['chat', 'Tin nhắn'], ['act', 'Hoạt động']];
const nfBtns = NFT.map(([k, t]) => h('button', { type: 'button', role: 'tab', textContent: t, onclick: () => { nfilter = k; paintNf(); nf.load(true); } }));
const paintNf = () => nfBtns.forEach((b, i) => b.setAttribute('aria-selected', String(NFT[i][0] === nfilter)));
paintNf();
nv.append(h('div', { className: 'nf-head' }, h('h2', { textContent: 'Thông báo' }), btn('Đánh dấu tất cả đã đọc', async (b) => { if (await busy(b, () => NXHN.markAllRead())) { nf.load(true); badge(); } })),
  h('div', { className: 'seg', role: 'tablist' }, nfBtns), nf.el);
const nfList = deb(() => { if (!nv.hidden) nf.load(true); });
const nfEvent = (e) => { // realtime: chỉ làm mới danh sách khi có thông báo mới / gộp thêm (không làm mới khi chỉ đổi trạng thái đã đọc)
  const n = e.new || {};
  badgeSoon();
  if (e.eventType === 'INSERT' || (e.eventType === 'UPDATE' && !n.read_at)) nfList();
  if (e.eventType === 'INSERT' && n.type === 'achievement') say('Bạn vừa đạt một danh hiệu mới! Mở Thông báo để xem.');
};

// ---- Quản trị (nút chỉ hiện với admin; quyền thật ở hàm SQL / RLS) ----
const adminPanel = () => {
  const q = h('input', { placeholder: 'Tìm tài khoản theo username/tên…', maxLength: 30, 'aria-label': 'Tìm tài khoản' }), ul = h('ul', { className: 'timeline' });
  const users = async () => {
    const r = await NXHN.admUsers(q.value.trim());
    ul.replaceChildren(...(Array.isArray(r) ? r : []).map((u) => {
      const li = h('li', { className: 'post' }, h('span', { className: 'who' }, av0(u.username, '', u.id), h('b', { textContent: handle(u.username) + (u.display_name && u.display_name !== u.username ? ' · ' + u.display_name : '') })),
        h('p', { className: 'post-body', textContent: `${u.role === 'admin' ? 'Quản trị · ' : ''}${u.banned ? 'ĐÃ KHÓA' : 'Hoạt động'} · Lượt ẩn danh: ${u.balance}/5` }));
      if (u.role !== 'admin') li.append(h('div', { className: 'actions' },
        btn('Cấp danh hiệu Tiên Phong', async (b) => { if (await busy(b, () => rpc('admin_grant_achievement', { p_user: u.id, p_code: 'founding_member' }))) say('Đã cấp danh hiệu.'); }),
        btn('Tặng 1 lượt', async (b) => { if (await busy(b, () => NXHN.admGrant(u.id))) { say('Đã tặng 1 lượt.'); users(); } }),
        btn(u.banned ? 'Mở khóa' : 'Khóa', async (b) => { if (await confirmBox((u.banned ? 'Mở khóa ' : 'Khóa ') + handle(u.username) + '?', u.banned ? 'Mở khóa' : 'Khóa', !u.banned) && await busy(b, () => NXHN.admBan(u.id, !u.banned))) users(); }),
        btn('Xóa', async (b) => { if (await confirmBox('Xóa vĩnh viễn ' + handle(u.username) + '? Không thể hoàn tác.', 'Xóa vĩnh viễn', true, 'Xóa tài khoản') && await busy(b, () => NXHN.admDel(u.id))) users(); }, 'btn-danger')));
      return li;
    }));
    if (!ul.children.length) ul.append(h('li', { className: 'empty', textContent: 'Không tìm thấy tài khoản.' }));
  };
  q.oninput = deb(users);
  return { el: h('div', {}, h('h2', { textContent: 'Tài khoản' }), q, ul), load: users };
};
const av = addView('admin', 'Quản trị', () => { ap.load(); apf.load(true); af.load(true); }, 'shield');
const af = feed((c) => NXHN.openReports(c || 0), async (ul, rows) => {
  for (const r of rows) {
    const t = { post: 'posts', comment: 'comments', message: 'messages' }[r.target_type];
    const res = t ? await sb.from(t).select('body').eq('id', r.target_id).maybeSingle() : await sb.from('profiles').select('username').eq('id', r.target_id).maybeSingle();
    const c = res.data, shown = c ? (c.body === IMG_MARK ? '(ảnh)' : c.body === STK_MARK ? '(nhãn dán)' : c.body === POLL_MARK ? '(bình chọn)' : c.body || handle(c.username)) : '(không còn)';
    const li = h('li', { className: 'post' }, h('b', { textContent: `Báo cáo: ${r.target_type}` }),
      h('p', { className: 'post-body', textContent: 'Lý do: ' + r.reason }), h('p', { className: 'post-body', textContent: 'Nội dung: ' + shown }));
    const act = (a) => async (b) => {
      const del = a === 'remove_content';
      const ans = await askBox({ title: del ? 'Xóa nội dung vi phạm' : 'Bỏ qua báo cáo', msg: del ? 'Nội dung bị báo cáo sẽ bị xóa. Không thể hoàn tác.' : 'Báo cáo được đóng, nội dung giữ nguyên.', label: del ? 'Xóa nội dung' : 'Bỏ qua', danger: del, input: 'Ghi chú (tùy chọn)' });
      if (!ans) return;
      if (await busy(b, () => NXHN.resolveReport(r.id, a, ans.note))) li.remove();
    };
    li.append(h('div', { className: 'actions' }, btn('Bỏ qua', act('dismiss')), r.target_type === 'profile' ? null : btn('Xóa nội dung', act('remove_content'), 'btn-danger')));
    ul.append(li);
  }
}, (c, rows) => (c || 0) + rows.length, 'Không có báo cáo đang mở.');
const apf = feed((c) => NXHN.admPosts(c), async (ul, rows) => {
  rows.forEach((r) => {
    const li = h('li', { className: 'post' },
      h('div', { className: 'post-who' }, h('b', { textContent: handle(r.author_username) }), h('time', { className: 'post-time', textContent: when(r.created_at) })),
      h('p', { className: 'post-body', textContent: (r.body || '').slice(0, 400) }),
      h('div', { className: 'actions' }, btn('Xóa bài viết', async (b) => {
        if (await confirmBox(`Xóa bài viết của ${handle(r.author_username)}? Không thể hoàn tác.`, 'Xóa', true, 'Xóa bài viết') && await busy(b, () => NXHN.admDelPost(r.id))) { li.remove(); say('Đã xóa bài viết.'); }
      }, 'btn-danger')));
    ul.append(li);
  });
}, (c, rows) => rows[rows.length - 1].created_at, 'Chưa có bài viết nào.');
const ap = adminPanel(); av.append(ap.el, h('h2', { textContent: 'Bài đăng' }), apf.el, h('h2', { textContent: 'Báo cáo đang mở' }), af.el);
tabs.append(tabBtn.people, tabBtn.home, tabBtn.chat, tabBtn.admin); // thứ tự: Mọi người, Khám phá, Chat, Quản trị

// ---- Vòng đời đăng nhập/đăng xuất ----
const refreshList = deb(() => { if (!cid || fine.matches) convList(); });
const live = () => {
  ch = sb.channel('nxhn-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (e) => {
      const m = e.new;
      if (m.conversation_id === cid && !(m.sender_id === user.id && sending)) { // tin của chính mình đang gửi → tự thêm ở onsubmit (tránh trùng)
        await nm([m.sender_id]);
        if (m.reply_to) { const by = await NXHN.replies([m.reply_to]); m.reply = by[m.reply_to] || null; if (m.reply && m.reply.sender_id) await nm([m.reply.sender_id]); }
        if (m.sticker_id) await loadStickers([m]);
        if (m.conversation_id === cid && addMsg(m) && m.kind !== 'anon' && m.sender_id !== user.id && m.body === IMG_MARK) {
          setTimeout(() => { const med = mlist.querySelector(`[data-id="${m.id}"] .media:empty`); if (med) queueImg(med, 'message_id', m.id); }, 4000);
        }
      }
      if (m.conversation_id === cid && m.sender_id !== user.id) readConvSoon();
      refreshList();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (e) => { if (e.new && e.new.deleted_at) markGone(e.new.id); refreshList(); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (e) => { if (e.old && e.old.id) markGone(e.old.id); refreshList(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, nfEvent)
    .subscribe();
  // kênh riêng: nếu bảng chưa nằm trong publication thì chỉ kênh đó lỗi, chat vẫn chạy
  ch2 = sb.channel('nxhn-att')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attachments' }, (e) => {
      const id = e.new && e.new.message_id, med = id && mlist.querySelector(`[data-id="${id}"] .media`);
      if (med) queueImg(med, 'message_id', id);
    })
    .subscribe();
  ch3 = sb.channel('nxhn-meta') // đồng bộ avatar cá nhân/nhóm cho các thành viên đang online
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (e) => {
      const p = e.new;
      if (p && p.id && p.avatar_path && p.avatar_path !== avPath.get(p.id)) { avPath.set(p.id, p.avatar_path); signAv([p.avatar_path]).then(paint); }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => { refreshList(); refreshPerm(); })
    .subscribe();
  // bình chọn: kênh riêng (bảng polls chưa có thì chỉ kênh này lỗi, chat vẫn chạy); chỉ một lần đăng ký mỗi phiên đăng nhập
  ch4 = sb.channel('nxhn-poll')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'polls' }, (e) => { const mid = e.new && e.new.message_id; if (mid && mlist.querySelector(`.poll[data-m="${mid}"]`)) pollLoad(mid); })
    .subscribe();
};
const reset = () => {
  saved.clear(); mine.clear(); pinIds.clear(); preloaded = false; perm = { can_send: true };
  names.clear(); avPath.clear(); avUrl.clear(); avDone.clear(); stickers.clear(); cstate.clear(); fol.clear(); frd.clear(); convInfo.clear();
  cid = null; peer = null; curOwner = null; clearInterval(timer); clearInterval(actT); pq.clear();
  [ch, ch2, ch3, ch4].forEach((c) => { if (c) sb.removeChannel(c); }); ch = ch2 = ch3 = ch4 = null;
  [clist, mlist, plist, infoEl].forEach((x) => x.replaceChildren()); [nf, af, apf].forEach((f) => f.clear()); nfilter = 'all'; paintNf();
  sq.value = ''; mtext.value = ''; fit(); clearFiles(); anonOn = false; left = 0; paintAnon(); setReply(null);
  chatBox.removeAttribute('data-open'); chatBox.removeAttribute('data-info'); applyBg(null);
  bellBadge.hidden = true; hdr.hidden = true; accBtn.replaceChildren(); tabBtn.admin.hidden = true; isAdm = false; ptab = 'search'; pnone.hidden = true;
  go('home', true);
};
reset();
sb.auth.onAuthStateChange((_e, s) => setTimeout(async () => {
  const id = s ? s.user.id : null;
  if (id === me) return;
  me = id; reset();
  if (!id) return;
  hdr.hidden = false; nm([id]).then(() => accBtn.replaceChildren(avt(id)));
  loadRel(); live(); badge(); timer = setInterval(badge, 60000); actT = setInterval(pingAct, 60000); setTimeout(pingAct, 5000);
  if (await NXHN.isAdmin()) { isAdm = true; tabBtn.admin.hidden = false; }
}, 0));
})();
