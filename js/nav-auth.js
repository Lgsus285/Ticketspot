// Controla los enlaces del menú según la sesión y el rol del usuario.
async function initNavAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  const loginLink = document.querySelector('[data-nav="login"]');
  const misBoletosLink = document.querySelector('[data-nav="mis-boletos"]');
  const adminLink = document.querySelector('[data-nav="admin"]');
  const logoutLink = document.querySelector('[data-nav="logout"]');

  const hayUsuario = !!session;
  const esAdmin = session?.user?.app_metadata?.role === "admin";

  if (loginLink) loginLink.style.display = hayUsuario ? "none" : "";
  if (misBoletosLink) misBoletosLink.style.display = hayUsuario ? "" : "none";
  // El enlace administrativo solo aparece para la cuenta autorizada en Supabase.
  if (adminLink) adminLink.style.display = esAdmin ? "" : "none";
  if (logoutLink) logoutLink.style.display = hayUsuario ? "" : "none";

  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.dataset.bound = "true";
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", initNavAuth);
