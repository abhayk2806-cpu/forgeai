// ForgeAI — Supabase Configuration

const SUPABASE_URL  = 'https://hutpurgvhbiouxmqkmpz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dHB1cmd2aGJpb3V4bXFrbXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTI2NTMsImV4cCI6MjA4OTMyODY1M30.3eYMP2vePoNjpLdOM7IfQ4b9isBrwxfME3r9ljbmIIQ';

const _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
window.supabase = _supabaseClient;
