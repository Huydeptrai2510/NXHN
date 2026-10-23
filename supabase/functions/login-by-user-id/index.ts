// NXHN: đăng nhập bằng UUID người dùng mà không tiết lộ email của tài khoản.
// Triển khai: supabase functions deploy login-by-user-id --no-verify-jwt
// Secrets cần có: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing required Supabase function secrets.");
    return json({ error: "Dịch vụ đăng nhập chưa được cấu hình." }, 500);
  }

  let body: { user_id?: unknown; password?: unknown };
  try { body = await req.json(); }
  catch { return json({ error: "Dữ liệu gửi lên không hợp lệ." }, 400); }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!UUID.test(userId) || password.length < 8 || password.length > 256) {
    return json({ error: "ID người dùng hoặc mật khẩu không đúng." }, 400);
  }

  // Chỉ server dùng service-role key; tuyệt đối không gửi khóa này về trình duyệt.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: lookupError } = await admin.auth.admin.getUserById(userId);
    const email = userData.user?.email;
    // Trả cùng một thông báo để không tiết lộ ID nào có tài khoản.
    if (lookupError || !email) return json({ error: "ID người dùng hoặc mật khẩu không đúng." }, 401);

    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "ID người dùng hoặc mật khẩu không đúng." }, 401);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    console.error("ID login failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Không thể đăng nhập lúc này. Vui lòng thử lại." }, 500);
  }
});
