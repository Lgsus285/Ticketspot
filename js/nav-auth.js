// =========================================================
// Controla qué enlaces del menú se muestran según si hay
// una sesión activa (Login vs Mis boletos / Cerrar sesión).
// =========================================================

async function initNavAuth() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const loginLink = document.querySelector('[data-nav="login"]');
  const misBoletosLink = document.querySelector('[data-nav="mis-boletos"]');
  const logoutLink = document.querySelector('[data-nav="logout"]');

  const hayUsuario = !!session;

  if (loginLink) loginLink.style.display = hayUsuario ? "none" : "";
  if (misBoletosLink) misBoletosLink.style.display = hayUsuario ? "" : "none";
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
