import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------
   Supabase project credentials
   Find these in: Supabase Dashboard → Project Settings → API
   - Project URL      → SUPABASE_URL
   - anon / public key → SUPABASE_ANON_KEY
   The anon key is safe to expose in frontend code — it's the public
   client key, not a secret. Row Level Security (RLS) is what actually
   protects your data once you add tables later.
------------------------------------------------------------------ */
const SUPABASE_URL = "https://kvldkwneqmwkkksqyxal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3n6CzQeGmlvY_UBEFbVa4A_DVx0jRE9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
