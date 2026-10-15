/*
 * Public browser configuration. The anon/publishable key is designed to be
 * used in the browser; database and Storage access are protected by RLS.
 * Never put a Supabase service_role or secret key in this file.
 */
window.SUPABASE_CONFIG = {
  url: "https://vzmxnjsiidwhhrdundge.supabase.co",
  anonKey: "sb_publishable_rw64shZovOxatQGPJS7sTg_BQZzmuyM",
  adminEmail: "rotangshopksu@gmail.com",
  bucket: "product-images"
};

window.supabaseClient = null;
if (window.supabase?.createClient &&
    !window.SUPABASE_CONFIG.url.includes("YOUR_PROJECT_ID") &&
    !window.SUPABASE_CONFIG.anonKey.includes("YOUR_SUPABASE")) {
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
}
