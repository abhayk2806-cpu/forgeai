// ConversionOS — Supabase Configuration

const SUPABASE_URL  = 'https://scunqqruwxajzcegmtcg.supabase.co';
const SUPABASE_ANON = 'sb_publishable_g7ua18iyflpu4wbY18NBZQ_7vkSX4w1';

const _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window.supabase = _supabaseClient;
