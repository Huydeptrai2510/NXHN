# NXHN — Nói Xã Hội Nghe · Lộ trình 01 (Backend, nền móng, logic)

## Cấu hình
1. Tạo dự án Supabase **mới** → SQL Editor → chạy `database.sql`.
2. Authentication → bật Email. (Tùy chọn: tắt "Confirm email" khi thử nghiệm.)
3. Mở `index.html`, điền `SUPABASE_URL` và `SUPABASE_ANON_KEY` (khóa **công khai**). Không dùng `service_role`.
4. Cấp admin bằng SQL (dòng cuối `database.sql`). Client không thể tự cấp.
5. Chạy: mở bằng static server hoặc đẩy lên GitHub Pages. GitHub Pages chỉ là nơi chứa frontend, không phải backend.

Đã có người dùng thật → chỉ dùng migration có thứ tự, không chạy lại `database.sql`.

## Quyết định đã chốt
- Quan hệ xã hội: **follow một chiều** (bảng `follows`). Không có `friendships`.
- Dòng thời gian = bài của mình + người mình follow, phân trang theo con trỏ `created_at` (20 bài/trang).
- Xóa dữ liệu: xóa tài khoản → xóa hồ sơ, bài, bình luận, follow, thành viên, thông báo, tệp đính kèm (bản ghi). Tin nhắn giữ lại (`sender_id` = NULL). Nhóm giữ lại (`created_by` = NULL). Xóa bản ghi `attachments` **không** tự xóa tệp trong Storage — cần tác vụ dọn dẹp phía máy chủ (chưa có).
- Giới hạn tần suất (trigger SQL, mỗi phút/người): bài 10, bình luận 20, tin nhắn 30, follow 30, báo cáo 5, upload 10, tạo chat 5. Cột `created_at` không cho client ghi nên không né được.
- Ảnh: bucket `media` riêng tư, tối đa 5 MB, JPEG/PNG/WebP/GIF, đường dẫn `<user_id>/<uuid>.<ext>`.
- Admin chỉ đọc được tin nhắn **đang bị báo cáo**, xử lý báo cáo qua hàm `resolve_report` (có nhật ký `moderation_actions`).

## Bàn giao sang Giai đoạn 2 (CSS)

### Cấu trúc database
`profiles`, `follows`, `posts`, `comments`, `communities`, `community_members`, `conversations`, `conversation_members`, `messages`, `attachments`, `notifications`, `reports`, `moderation_actions`. Mọi bảng đã bật RLS; client chỉ có quyền cột tối thiểu.

### Hợp đồng dữ liệu
- RPC: `timeline(p_before, p_limit)`, `create_conversation(p_member_ids, p_title)`, `resolve_report(p_report_id, p_action, p_note)`.
- Hàm giao diện được phép gọi: `NXHN.signUp/signIn/signOut`, `getProfile`, `updateProfile`, `createPost`, `timeline`, `addComment`, `loadComments`, `follow`, `unfollow`, `createConversation`, `sendMessage`, `loadMessages`, `uploadImage`, `signedUrl`, `loadNotifications`, `markRead`, `createCommunity`, `joinCommunity`, `report`, `resolveReport`.
- ID: `status`, `auth-view`, `auth-form`, `auth-email`, `auth-password`, `btn-signin`, `btn-signup`, `app-view`, `me-name`, `btn-signout`, `profile-form`, `profile-display-name`, `profile-bio`, `post-form`, `post-body`, `timeline`, `timeline-empty`, `btn-more`, `feature-status`.
- Class/thuộc tính do JS tạo: `post`, `post-author`, `post-time`, `post-body`, `data-post-id`.
- Mã lỗi thường gặp: `23505` (trùng), `42501` (không đủ quyền / vi phạm RLS), `54000` (quá nhanh).

### Trạng thái thực tế
- Có giao diện: auth, hồ sơ, đăng bài, dòng thời gian.
- Chỉ có hàm (chưa có UI): bình luận, follow, chat, upload, thông báo, cộng đồng, báo cáo/quản trị.
- Chưa làm: hết hạn tin nhắn/tệp, tin nhắn ẩn danh, cuộc gọi, tìm kiếm nâng cao, ảnh đại diện, thêm thành viên vào chat nhóm, rời chat nhóm, sửa bài/bình luận, xóa tài khoản từ client.
- **Chưa chạy thử trên Supabase thật.** Mọi mục dưới đây phải kiểm tra trước khi nghiệm thu.

### Giới hạn bảo mật
- Ẩn nút trên giao diện không phải bảo mật; quyền thật ở RLS và hàm SQL.
- Giai đoạn CSS không được đổi tên ID/hàm ở trên, không sửa logic hay quyền truy cập, không đưa secret vào frontend.
- Bảng mới thêm sau này phải bật RLS và `revoke` quyền mặc định, nếu không sẽ bị Supabase cấp quyền rộng.
- Đếm giới hạn tần suất có thể sai lệch nhẹ khi nhiều yêu cầu đến cùng lúc.

### Câu hỏi cần chốt trước khi làm tính năng hết hạn
Hạn 28 ngày (tin nhắn) / 14 ngày (tệp) tính từ lúc nào; tin ghim có ngoại lệ không và ghim thế nào; tệp được nhiều tin tham chiếu xử lý ra sao; có báo trước 3 ngày không; ghi nhận lỗi dọn dẹp ở đâu. Không cam kết dữ liệu bị xóa khỏi bản sao lưu nếu chưa kiểm tra chính sách lưu trữ của Supabase.

## Checklist nghiệm thu (dùng ≥ 3 tài khoản A, B, C và 1 admin)
- [ ] Đăng ký/đăng nhập/đăng xuất; tải lại trang vẫn giữ phiên.
- [ ] A sửa hồ sơ B → 0 dòng bị sửa. A tự đặt `role='admin'` → bị từ chối.
- [ ] A đăng bài với `author_id` = B → bị chặn (`42501`). Chèn `created_at` tùy ý → bị chặn.
- [ ] C (ngoài chat A–B) không đọc được tin nhắn của chat đó.
- [ ] C không đọc được bài nhóm riêng tư, không tự tham gia nhóm riêng tư.
- [ ] C không `createSignedUrl` được ảnh của chat A–B; bucket không công khai.
- [ ] Upload file >5 MB hoặc không phải ảnh → bị từ chối.
- [ ] Đăng bài thứ 11 trong 1 phút → lỗi `54000`.
- [ ] Người thường gọi `resolve_report` → `42501`; admin gọi được và có dòng trong `moderation_actions`.
- [ ] Danh sách bài, bình luận, tin nhắn, thông báo đều có giới hạn trang.
- [ ] Repo không chứa `service_role` hay mật khẩu database.
