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
  const r = await sb.from('profiles').select('id,display_name').in('id', need);
  (r.data || []).forEach((p) => names.set(p.id, p.display_name));
};
const N = (id) => names.get(id) || 'Người dùng';
let cid = null, oldest = null, ch = null, timer = 0, me = null, fol = new Set(), mine = new Map();

Object.assign(NXHN, {
  people: (from) => sb.from('profiles').select('id,display_name,bio').neq('id', user.id).order('created_at', { ascending: false }).range(from, from + PAGE - 1).then(ok),
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
      const im = h('img', { src: u, alt: 'Ảnh đính kèm', loading: 'lazy' });
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
    names.set(r.id, r.display_name);
    const fb = btn(fol.has(r.id) ? 'Bỏ follow' : 'Follow', (b) => busy(b, async () => {
      if (await (fol.has(r.id) ? NXHN.unfollow(user.id, r.id) : NXHN.follow(user.id, r.id))) {
        fol.has(r.id) ? fol.delete(r.id) : fol.add(r.id);
        b.textContent = fol.has(r.id) ? 'Bỏ follow' : 'Follow';
      }
    }));
    ul.append(h('li', { className: 'post' }, h('b', { textContent: r.display_name }), h('p', { className: 'post-body', textContent: r.bio }),
      h('div', { className: 'actions' }, fb,
        btn('Nhắn tin', async (b) => { const id = await busy(b, () => NXHN.createConversation([r.id])); if (id) { go('chat', true); openConv(id, r.display_name); } }),
        rep('profile', r.id))));
  });
}, (c, rows) => (c || 0) + rows.length, 'Chưa có người dùng khác.');
pv.append(pf.el);

// ---- Chat ----
const cv = addView('chat', 'Chat', () => convList());
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
    const m = await NXHN.sendMessage(cid, user.id, mtext.value.trim());
    if (!m) return;
    if (mfile.files[0]) await NXHN.uploadImage(user.id, mfile.files[0], { message_id: m.id });
    mtext.value = ''; mfile.value = ''; say(''); loadMsgs(false);
  });
} }, mtext, mfile, msend);
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
      if (id) openConv(id, title.value.trim() || 'Nhóm');
    });
  } }, title, box, ok2);
  return h('details', { className: 'card', ontoggle: async (e) => {
    if (!e.target.open || box.children.length) return;
    const r = await NXHN.people(0);
    (Array.isArray(r) ? r : []).forEach((p) => box.append(h('label', { className: 'check' }, h('input', { type: 'checkbox', value: p.id }), ' ' + p.display_name)));
  } }, h('summary', { textContent: 'Tạo nhóm chat' }), f);
};
const chatBox = h('div', { className: 'chat' }, h('div', { className: 'chat-list' }, newGroup(), clist), h('div', { className: 'chat-pane' }, back, ctitle, olderBtn, mlist, mform));
cv.append(chatBox);
const convList = async () => {
  const cs = await NXHN.conversations();
  if (!Array.isArray(cs)) return;
  const ms = cs.length ? await NXHN.members(cs.map((c) => c.id)) : [], mem = Array.isArray(ms) ? ms : [];
  await nm(mem.map((m) => m.user_id));
  clist.replaceChildren(...cs.map((c) => {
    const t = c.title || mem.filter((m) => m.conversation_id === c.id && m.user_id !== user.id).map((m) => N(m.user_id)).join(', ') || 'Cuộc trò chuyện';
    return h('li', { className: 'post' }, h('button', { className: 'link-btn', type: 'button', textContent: (c.is_group ? 'Nhóm: ' : '') + t, onclick: () => openConv(c.id, t) }));
  }));
  if (!cs.length) clist.append(h('li', { className: 'empty', textContent: 'Chưa có cuộc trò chuyện. Vào tab Mọi người và bấm Nhắn tin.' }));
};
const openConv = (id, title) => {
  cid = id;
  oldest = null; // Không dùng mốc phân trang của cuộc trò chuyện trước.
  ctitle.textContent = title;
  chatBox.dataset.open = '1';
  mlist.replaceChildren();
  loadMsgs(false);
};
const msgRow = (m) => {
  const mineMsg = m.sender_id === user.id, media = h('div', { className: 'media' });
  const li = h('li', { className: 'msg' + (mineMsg ? ' mine' : ''), 'data-id': m.id },
    h('b', { textContent: mineMsg ? 'Bạn' : N(m.sender_id) }), ' ', h('time', { className: 'post-time', textContent: when(m.created_at) }),
    h('p', { className: 'post-body', textContent: m.body }), media,
    mineMsg ? btn('Xóa', async (b) => { if (confirm('Xóa tin nhắn này?') && await busy(b, () => NXHN.remove('messages', m.id))) li.remove(); }, 'btn-danger') : rep('message', m.id));
  queueImg(media, 'message_id', m.id);
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
    mlist.replaceChildren(...nodes);
    // Đưa cuộc trò chuyện về tin mới nhất; ảnh tải xong cũng giữ đáy khung.
    requestAnimationFrame(() => { mlist.scrollTop = mlist.scrollHeight; });
    mlist.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => {
      if (Math.abs(mlist.scrollHeight - mlist.scrollTop - mlist.clientHeight) < 180) mlist.scrollTop = mlist.scrollHeight;
    }, { once: true }));
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
    rows.forEach((r) => ul.append(renderPost({ ...r, author: { display_name: N(r.author_id) } })));
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
    const sel = h('select', { 'aria-label': 'Chọn người để thêm' }, ps.map((p) => h('option', { value: p.id, textContent: p.display_name })));
    cbox.append(h('div', { className: 'actions' }, sel, btn('Thêm thành viên', (b) => busy(b, async () => { if (await NXHN.joinCommunity(c.id, sel.value)) say('Đã thêm thành viên.'); }))));
  });
  f.load(true);
};

// ---- Quản trị (nút chỉ hiện với admin; quyền thật ở hàm SQL resolve_report) ----
const av = addView('admin', 'Quản trị', () => af.load(true));
const af = feed((c) => NXHN.openReports(c || 0), async (ul, rows) => {
  for (const r of rows) {
    const t = { post: 'posts', comment: 'comments', message: 'messages' }[r.target_type];
    const res = t ? await sb.from(t).select('body').eq('id', r.target_id).maybeSingle() : await sb.from('profiles').select('display_name').eq('id', r.target_id).maybeSingle();
    const c = res.data, li = h('li', { className: 'post' }, h('b', { textContent: `Báo cáo: ${r.target_type}` }),
      h('p', { className: 'post-body', textContent: 'Lý do: ' + r.reason }), h('p', { className: 'post-body', textContent: 'Nội dung: ' + (c ? (c.body || c.display_name) : '(không còn)') }));
    const act = (a) => async (b) => {
      const note = prompt('Ghi chú (tùy chọn):');
      if (note === null || (a === 'remove_content' && !confirm('Xóa nội dung này?'))) return;
      if (await busy(b, () => NXHN.resolveReport(r.id, a, note.trim()))) li.remove();
    };
    li.append(h('div', { className: 'actions' }, btn('Bỏ qua', act('dismiss')), r.target_type === 'profile' ? null : btn('Xóa nội dung', act('remove_content'), 'btn-danger')));
    ul.append(li);
  }
}, (c, rows) => (c || 0) + rows.length, 'Không có báo cáo đang mở.');
av.append(af.el);

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
  tabBtn.notifs.textContent = 'Thông báo'; tabBtn.admin.hidden = true;
  go('home', true);
};
reset();
sb.auth.onAuthStateChange((_e, s) => setTimeout(async () => {
  const id = s ? s.user.id : null;
  if (id === me) return;
  me = id; reset();
  if (!id) return;
  live(); badge(); timer = setInterval(badge, 60000);
  if (await NXHN.isAdmin()) tabBtn.admin.hidden = false;
}, 0));
})();
