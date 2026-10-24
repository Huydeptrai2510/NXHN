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
let cid = null, oldest = null, ch = null, timer = 0, me = null, fol = new Set(), mine = new Map(), isAdm = false, isGroup = false, replyTo = null, reqId = crypto.randomUUID();

Object.assign(NXHN, {
  people: (from) => sb.from('profiles').select('id,username,bio').neq('id', user.id).order('created_at', { ascending: false }).range(from, from + PAGE - 1).then(ok),
  following: () => sb.from('follows').select('followee_id').eq('follower_id', user.id).limit(1000).then(ok),
  remove: (table, id) => sb.from(table).delete().eq('id', id).then(ok), // RLS chỉ cho xóa của mình
  conversations: () => sb.from('conversations').select('id,is_group,title').order('created_at', { ascending: false }).limit(PAGE).then(ok),
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
  const more = h('button', { className: 'btn btn-secondary', type: 'button', hidden: true, textContent: 'Tải thêm' });
  let cur = null;
  const clear = () => { ul.replaceChildren(); cur = null; more.hidden = true; none.hidden = true; };
  const load = async (reset) => {
    if (reset) clear();
    const rows = await get(cur);
    if (!Array.isArray(rows)) return;
    await draw(ul, rows);
    if (rows.length) cur = next(cur, rows);
    more.hidden = rows.length < PAGE; none.hidden = ul.children.length > 0;
  };
  more.onclick = () => busy(more, () => load(false));
  return { el: h('div', {}, ul, none, more), load, clear };
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
      const n = its.find((i) => i[2] === a[key]), u = url[a.storage_path];
      if (!n || !u) return;
      const inChat = !!n[0].closest('.messages');
      const im = h('img', { src: u, alt: 'Ảnh đính kèm (chạm để xem ảnh gốc)', title: 'Chạm để xem ảnh gốc', loading: inChat ? 'eager' : 'lazy', tabIndex: 0 });
      const open = async () => zoom((await NXHN.signedUrl(a.storage_path)) || u);
      im.onload = () => { if (inChat && pin) toEnd(); };
      im.onclick = open;
      im.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } };
      im.onerror = () => im.replaceWith(h('em', { textContent: 'Không tải được ảnh.' }));
      n[0].append(im);
    });
  }
};

// ---- Bình luận ----
const comments = (pid) => {
  const f = feed((c) => NXHN.loadComments(pid, c), async (ul, rows) => {
    await nm(rows.map((r) => r.author_id));
    rows.forEach((r) => ul.append(h('li', { className: 'comment' },
      h('b', { textContent: N(r.author_id) }), ' ', h('time', { className: 'post-time', textContent: when(r.created_at) }),
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
const app = $('app-view'), views = {}, loaders = {}, tabBtn = {};
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
  tabBtn[key] = h('button', { className: 'tab', type: 'button', textContent: label, onclick: () => go(key) });
  tabs.append(tabBtn[key]);
  return v;
};
addView('home', 'Trang chủ', () => loadMore(true));
const settingsView = addView('settings', 'Cài đặt', () => {});
settingsView.append($('profile-form'));

// ---- Mọi người: follow, nhắn tin ----
const pv = addView('people', 'Mọi người', async () => {
  const r = await NXHN.following();
  fol = new Set((Array.isArray(r) ? r : []).map((x) => x.followee_id));
  pf.load(true);
});
const pf = feed((c) => NXHN.people(c || 0), async (ul, rows) => {
  rows.forEach((r) => {
    names.set(r.id, r.username);
    const fb = btn(fol.has(r.id) ? 'Bỏ follow' : 'Follow', (b) => busy(b, async () => {
      if (await (fol.has(r.id) ? NXHN.unfollow(user.id, r.id) : NXHN.follow(user.id, r.id))) {
        fol.has(r.id) ? fol.delete(r.id) : fol.add(r.id);
        b.textContent = fol.has(r.id) ? 'Bỏ follow' : 'Follow';
      }
    }));
    ul.append(h('li', { className: 'post' }, h('b', { textContent: handle(r.username) }), h('p', { className: 'post-body', textContent: r.bio }),
      h('div', { className: 'actions' }, fb,
        btn('Nhắn tin', async (b) => { const id = await busy(b, () => NXHN.createConversation([r.id])); if (id) { go('chat', true); openConv(id, handle(r.username)); } }),
        rep('profile', r.id))));
  });
}, (c, rows) => (c || 0) + rows.length, 'Chưa có người dùng khác.');
pv.append(pf.el);

// ---- Group chat: ẩn danh, menu ngữ cảnh, mời thành viên, hồ sơ, quản trị tài khoản (quyền thật ở hàm SQL nxhn-groupchat.sql) ----
const rpc = (n, a) => sb.rpc(n, a).then(({ data, error }) => (error ? fail(error.code === 'P0001' ? { userMessage: error.message } : error) : (data ?? true)));
const like = (s) => '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
const deb = (fn) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, 300); }; };
Object.assign(NXHN, {
  sendMessage: (c, s, body, reply) => sb.from('messages').insert({ conversation_id: c, sender_id: s, body, ...(reply ? { reply_to: reply } : {}) }).select().single().then(ok),
  loadMessages: async (c, before) => {
    const run = (cols) => { let q = sb.from('messages').select(cols).eq('conversation_id', c).order('created_at', { ascending: false }).limit(PAGE); if (before) q = q.lt('created_at', before); return q; };
    let r = await run('id,body,sender_id,created_at,kind,reply_to');
    if (r.error) r = await run('id,body,sender_id,created_at'); // chưa chạy SQL mới → chat cũ vẫn hoạt động
    const rows = ok(r);
    if (!Array.isArray(rows)) return rows;
    const ids = [...new Set(rows.map((m) => m.reply_to).filter(Boolean))];
    if (ids.length) {
      const by = Object.fromEntries(((await sb.from('messages').select('id,body').in('id', ids)).data || []).map((x) => [x.id, x]));
      rows.forEach((m) => { m.reply = by[m.reply_to] || null; });
    }
    return rows;
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
const av0 = (name, cls = '') => h('span', { className: 'avatar ' + cls, 'aria-hidden': 'true', textContent: (name || '?').replace('@', '').charAt(0).toUpperCase() });
const modal = (...k) => {
  const key = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); removeEventListener('keydown', key); };
  const box = h('div', { className: 'lightbox modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === box) close(); } }, h('div', { className: 'card sheet' }, ...k, btn('Đóng', close)));
  addEventListener('keydown', key); document.body.append(box); return close;
};
const profile = async (id) => {
  const p = await NXHN.getProfile(id);
  if (!p || p === true) return;
  const close = modal(av0(p.username, 'big'), h('h2', { textContent: handle(p.username) }), h('p', { className: 'post-body', textContent: p.bio || 'Chưa có giới thiệu.' }),
    id === user.id ? null : btn('Nhắn tin', async (b) => { const c = await busy(b, () => NXHN.createConversation([id])); if (c) { close(); go('chat', true); openConv(c, handle(p.username)); } }, 'btn-primary'));
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
const msgItems = (li, m) => {
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id;
  return [
    ['Sao chép', () => navigator.clipboard.writeText(m.body).then(() => say('Đã sao chép.'), () => say('Không sao chép được.'))],
    ['Trả lời', () => setReply(m)],
    own ? null : ['Báo cáo', async () => { const r = (prompt('Lý do báo cáo (tối đa 1000 ký tự):') || '').trim(); if (r && await NXHN.report(user.id, 'message', m.id, r)) say('Đã gửi báo cáo.'); }],
    own ? ['Xóa', async () => { if (confirm('Xóa tin nhắn này?') && await NXHN.remove('messages', m.id)) li.remove(); }, 'danger'] : null,
    isAdm && anon ? ['Xem người gửi (quản trị)', async () => { const u = await NXHN.admSender(m.id); if (u && u !== true) alert('Người gửi: ' + handle(u)); }] : null,
  ];
};
const arm = (li, m) => {
  const open = (x, y) => menu(x, y, msgItems(li, m));
  li.addEventListener('contextmenu', (e) => { e.preventDefault(); open(e.clientX, e.clientY); });
  li.addEventListener('touchstart', (e) => { const t = e.touches[0]; clearTimeout(lp); lp = setTimeout(() => open(t.clientX, t.clientY), 500); }, { passive: true });
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
anonChk.onchange = () => { mfile.disabled = anonChk.checked; if (anonChk.checked) mfile.value = ''; };
const showLeft = async () => {
  const n = await NXHN.anonLeft();
  left = typeof n === 'number' ? n : 0;
  anonLbl.lastChild.textContent = left < 1 ? ' Ẩn danh: hết lượt, mỗi ngày nhận thêm 1 lượt' : ` Ẩn danh (còn ${left}/5 lượt, chỉ gửi chữ)`;
  anonChk.disabled = left < 1; if (left < 1) anonChk.checked = false;
  mfile.disabled = anonChk.checked;
};
const plus = h('button', { className: 'btn btn-secondary btn-small', type: 'button', textContent: '+', title: 'Mời thành viên', 'aria-label': 'Mời thành viên', hidden: true, onclick: () => invitePanel() });
const invitePanel = () => {
  const q = h('input', { placeholder: 'Tìm theo tên hoặc username…', maxLength: 30, 'aria-label': 'Tìm người để mời' }), ul = h('ul', { className: 'timeline' });
  const run = async () => {
    const r = await NXHN.invitable(cid, q.value.trim());
    ul.replaceChildren(...(Array.isArray(r) ? r : []).map((p) => h('li', { className: 'post who' }, av0(p.username), h('b', { textContent: handle(p.username) }),
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
      const li = h('li', { className: 'post' }, h('span', { className: 'who' }, av0(u.username), h('b', { textContent: handle(u.username) + (u.display_name && u.display_name !== u.username ? ' · ' + u.display_name : '') })),
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
const clist = h('ul', { className: 'timeline' }), mlist = h('ul', { className: 'messages' });
const olderBtn = btn('Tin cũ hơn', (b) => busy(b, () => loadMsgs(true)));
olderBtn.hidden = true;
const mtext = h('input', { maxLength: 4000, required: true, placeholder: 'Nhập tin nhắn…', 'aria-label': 'Tin nhắn' });
const mfile = h('input', { type: 'file', accept: IMG, 'aria-label': 'Ảnh đính kèm (tùy chọn)' });
const msend = h('button', { className: 'btn btn-primary', type: 'submit', textContent: 'Gửi' });
const mform = h('form', { className: 'chat-form', onsubmit: (e) => {
  e.preventDefault();
  if (!cid) return;
  busy(msend, async () => {
    const body = mtext.value.trim(), rid = replyTo && replyTo.id;
    if (!body) return;
    if (anonChk.checked) {
      if (left < 1) return say('Bạn đã hết lượt ẩn danh.');
      if (!(await NXHN.sendAnon(cid, body, rid, reqId))) return; // reqId giữ nguyên khi gửi lại → server không trừ lượt hai lần
      reqId = crypto.randomUUID(); showLeft();
    } else {
      const m = await NXHN.sendMessage(cid, user.id, body, rid);
      if (!m) return;
      if (mfile.files[0]) await NXHN.uploadImage(user.id, mfile.files[0], { message_id: m.id });
    }
    pin = true; mtext.value = ''; mfile.value = ''; setReply(null); say(''); loadMsgs(false);
  });
} }, mtext, mfile, anonLbl, msend);
const back = btn('← Danh sách chat', () => { cid = null; oldest = null; chatBox.removeAttribute('data-open'); convList(); });
back.classList.add('back-btn');
const ctitle = h('h2');
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
const chatBox = h('div', { className: 'chat' }, h('div', { className: 'chat-list' }, newGroup(), clist), h('div', { className: 'chat-pane' }, back, h('div', { className: 'chat-head' }, ctitle, plus), olderBtn, mlist, rbar, mform));
cv.append(chatBox);
mlist.addEventListener('scroll', () => { pin = mlist.scrollHeight - mlist.scrollTop - mlist.clientHeight < 80; }, { passive: true });
const convList = async () => {
  const cs = await NXHN.conversations();
  if (!Array.isArray(cs)) return;
  const ms = cs.length ? await NXHN.members(cs.map((c) => c.id)) : [], mem = Array.isArray(ms) ? ms : [];
  await nm(mem.map((m) => m.user_id));
  clist.replaceChildren(...cs.map((c) => {
    const t = c.title || mem.filter((m) => m.conversation_id === c.id && m.user_id !== user.id).map((m) => N(m.user_id)).join(', ') || 'Cuộc trò chuyện';
    return h('li', { className: 'post' }, h('button', { className: 'link-btn', type: 'button', textContent: (c.is_group ? 'Nhóm: ' : '') + t, onclick: () => openConv(c.id, t, c.is_group) }));
  }));
  if (!cs.length) clist.append(h('li', { className: 'empty', textContent: 'Chưa có cuộc trò chuyện. Vào tab Mọi người và bấm Nhắn tin.' }));
};
const openConv = (id, title, grp) => {
  cid = id; pin = true; isGroup = !!grp; plus.hidden = anonLbl.hidden = !isGroup; anonChk.checked = false; setReply(null); if (isGroup) showLeft();
  oldest = null; // Không dùng mốc phân trang của cuộc trò chuyện trước.
  ctitle.textContent = title;
  chatBox.dataset.open = '1';
  mlist.replaceChildren();
  loadMsgs(false);
};
const msgRow = (m) => {
  const anon = m.kind === 'anon', own = !anon && m.sender_id === user.id, media = h('div', { className: 'media' });
  const li = h('li', { className: 'msg' + (anon ? ' anon' : own ? ' mine' : ''), 'data-id': m.id },
    anon ? h('span', { className: 'who' }, av0('?', 'anon-av'), h('b', { textContent: 'Ẩn danh' }))
      : h('span', { className: 'who' }, av0(N(m.sender_id)), h('button', { className: 'name-link', type: 'button', textContent: own ? 'Bạn' : N(m.sender_id), onclick: () => profile(m.sender_id) })),
    ' ', h('time', { className: 'post-time', textContent: when(m.created_at) }),
    m.reply ? h('blockquote', { className: 'quote', textContent: m.reply.body.slice(0, 80) }) : null,
    h('p', { className: 'post-body', textContent: m.body }), media);
  if (!anon) queueImg(media, 'message_id', m.id);
  arm(li, m);
  return li;
};
const loadMsgs = async (older) => {
  const rows = await NXHN.loadMessages(cid, older ? oldest : null);
  if (!Array.isArray(rows)) return;
  await nm(rows.map((m) => m.sender_id));
  rows.reverse(); // API trả mới → cũ; hiển thị cũ → mới
  const nodes = rows.map(msgRow);
  if (older) {
    const oldHeight = mlist.scrollHeight;
    mlist.prepend(...nodes);
    mlist.scrollTop = mlist.scrollHeight - oldHeight;
  } else {
    const stick = pin;
    mlist.replaceChildren(...nodes);
    if (stick) { toEnd(); requestAnimationFrame(toEnd); } // vào chat → tin mới nhất; ảnh tải xong (onload) giữ đáy
  }
  if (rows.length) oldest = rows[0].created_at;
  olderBtn.hidden = rows.length < PAGE;
};

// ---- Thông báo ----
const badge = async () => { const n = await NXHN.unread(); tabBtn.notifs.textContent = n ? `Thông báo (${n})` : 'Thông báo'; };
const nv = addView('notifs', 'Thông báo', () => { nf.load(true); badge(); });
const nf = feed((c) => NXHN.loadNotifications(c), async (ul, rows) => {
  await nm(rows.map((r) => r.actor_id));
  rows.forEach((r) => {
    const li = h('li', { className: 'post' }, r.read_at ? null : h('b', { className: 'tag', textContent: 'Mới ' }),
      `${N(r.actor_id)} ${r.type === 'follow' ? 'đã follow bạn' : 'đã bình luận bài viết của bạn'} `, h('time', { className: 'post-time', textContent: when(r.created_at) }));
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

// ---- Vòng đời đăng nhập/đăng xuất ----
const live = () => {
  ch = sb.channel('nxhn-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (e) => {
      if (e.new.conversation_id === cid && !mlist.querySelector(`[data-id="${e.new.id}"]`)) loadMsgs(false);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => badge())
    .subscribe();
};
const reset = () => {
  names.clear(); fol.clear(); mine.clear(); cid = null; clearInterval(timer);
  if (ch) { sb.removeChannel(ch); ch = null; }
  [clist, mlist, gl, cbox].forEach((x) => x.replaceChildren());
  [pf, nf, af].forEach((f) => f.clear());
  chatBox.removeAttribute('data-open'); cbox.hidden = true; gl.hidden = false; gform.hidden = false;
  tabBtn.notifs.textContent = 'Thông báo'; tabBtn.admin.hidden = true; isAdm = false; setReply(null);
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
