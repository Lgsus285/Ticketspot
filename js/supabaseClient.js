// =========================================================
// Cliente de Supabase compartido por todas las páginas.
// Requiere que antes se hayan cargado, en este orden:
//   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 (variable global "supabase")
//   2. config.js (define window.SUPABASE_URL y window.SUPABASE_ANON_KEY)
// =========================================================

if (!window.SUPABASE_URL || window.SUPABASE_URL.includes("TU-PROYECTO")) {
  console.warn(
    "[Ticketspot] Todavía no configuraste js/config.js con la URL y la llave de tu proyecto de Supabase."
  );
}

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
