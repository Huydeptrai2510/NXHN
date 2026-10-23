// NXHN: đăng nhập / đăng ký bằng @username + mật khẩu. Hàm MỚI, không đụng login-by-user-id (hàm cũ vẫn chạy cho bản web cũ).
// Deploy: supabase functions deploy username-auth --no-verify-jwt
// Secrets có sẵn: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Tùy chọn: INTERNAL_EMAIL_DOMAIN (mặc định users.nxhn.invalid), ALLOW_LEGACY_UUID ("false" = tắt đăng nhập bằng UUID cũ), ALLOWED_ORIGIN.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: cors });
const USERNAME = /^[a-z0-9_]{3,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BAD = "Username hoặc mật khẩu không đúng.";
const norm = (v: unknown) => (typeof v === "string" ? v.trim().replace(/^@+/, "").toLowerCase() : "");
const like = (s: string) => s.replace(/[\\%_]/g, "\\$&"); // thoát ký tự đại diện của ilike

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"),
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing function secrets");
    return json({ error: "Dịch vụ đăng nhập chưa được cấu hình." }, 500);
  }

  let body: { action?: unknown; username?: unknown; password?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "Dữ liệu quá lớn." }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: "Dữ liệu gửi lên không hợp lệ." }, 400); }

  const signup = body.action === "signup", username = norm(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || username.length > 40 || password.length < 8 || password.length > 256) {
    return json({ error: signup ? "Username hoặc mật khẩu không hợp lệ." : BAD }, 400);
  }

  // service-role chỉ tồn tại trong hàm này, không bao giờ gửi về trình duyệt.
  const opt = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceKey, opt), anon = createClient(url, anonKey, opt);
  const out = (s: { access_token: string; refresh_token: string; token_type: string; expires_in: number; expires_at?: number }) =>
    json({ access_token: s.access_token, refresh_token: s.refresh_token, token_type: s.token_type, expires_in: s.expires_in, expires_at: s.expires_at });
  const signIn = async (id: string) => {
    const { data: u, error } = await admin.auth.admin.getUserById(id);
    const email = u?.user?.email; // email nội bộ chỉ dùng trong hàm này
    if (error || !email) return null;
    const { data, error: e2 } = await anon.auth.signInWithPassword({ email, password });
    return e2 || !data.session ? null : data.session;
  };

  try {
    if (!signup) {
      let id: string | null = null;
      if (UUID.test(username) && Deno.env.get("ALLOW_LEGACY_UUID") !== "false") id = username; // chuyển tiếp cho tài khoản cũ
      else {
        const { data } = await admin.from("profiles").select("id").ilike("username", like(username)).limit(2);
        if (data && data.length === 1) id = data[0].id; // không có / trùng → từ chối cùng một thông báo
      }
      const s = id ? await signIn(id) : null;
      return s ? out(s) : json({ error: BAD }, 401);
    }

    // Đăng ký: username + mật khẩu; email nội bộ ngẫu nhiên, xác nhận sẵn, không gửi thư.
    if (!USERNAME.test(username)) return json({ error: "Username gồm 3–20 ký tự: a–z, 0–9, gạch dưới." }, 400);
    const used = await admin.from("profiles").select("id").ilike("username", like(username)).limit(1);
    if (used.error) throw used.error;
    if (used.data?.length) return json({ error: "Username này đã được sử dụng." }, 409);

    const email = `${crypto.randomUUID()}@${Deno.env.get("INTERNAL_EMAIL_DOMAIN") || "users.nxhn.invalid"}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      console.error("createUser failed", created.error?.message);
      return json({ error: "Không tạo được tài khoản lúc này." }, 500);
    }
    const id = created.data.user.id;
    const { error: pe } = await admin.from("profiles").upsert({ id, username, display_name: username }, { onConflict: "id" });
    if (pe) {
      await admin.auth.admin.deleteUser(id); // hoàn tác đúng tài khoản vừa tạo
      console.error("profile upsert failed", pe.code);
      return pe.code === "23505" ? json({ error: "Username này đã được sử dụng." }, 409) : json({ error: "Không tạo được hồ sơ." }, 500);
    }
    const s = await signIn(id);
    return s ? out(s) : json({ error: "Đã tạo tài khoản, hãy đăng nhập." }, 202);
  } catch (e) {
    console.error("auth failed", e instanceof Error ? e.message : "unknown"); // không log mật khẩu/token
    return json({ error: "Không thể xử lý lúc này. Vui lòng thử lại." }, 500);
  }
});
