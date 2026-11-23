// =========================================================
// Portada: evento destacado (banner) + próximos eventos.
// =========================================================

async function cargarPortada() {
  const grid = document.getElementById("featured-grid");
  const { data: eventos, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    grid.innerHTML = `<p class="msg msg-error">No se pudieron cargar los eventos: ${esc(error.message)}</p>`;
    return;
  }
  if (!eventos || eventos.length === 0) {
    grid.innerHTML = `<p class="empty">Todavía no hay eventos cargados.</p>`;
    return;
  }

  const destacado = eventos.find((e) => e.featured) || eventos[0];
  const hero = document.getElementById("hero");
  const img = document.getElementById("hero-image");
  img.src = destacado.image_url;
  img.alt = `Afiche de ${destacado.title}`;
  img.style.objectPosition = destacado.image_position || "center";
  document.getElementById("hero-kicker").textContent = `${destacado.category || "Evento"} · ${fechaCorta(destacado)}`;
  document.getElementById("hero-title").textContent = destacado.title;
  document.getElementById("hero-meta").textContent = destacado.location || "";
  document.getElementById("hero-link").href = `detalle.html?event=${encodeURIComponent(destacado.slug)}`;
  hero.hidden = false;

  const resto = eventos.filter((e) => e.id !== destacado.id).slice(0, 6);
  grid.innerHTML = resto.map(tarjetaEvento).join("");
}

document.addEventListener("DOMContentLoaded", cargarPortada);
