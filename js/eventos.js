// =========================================================
// Carga el catálogo completo de eventos desde la tabla "events"
// de Supabase y dibuja las tarjetas dentro de #event-grid.
// =========================================================

async function cargarEventos() {
  const contenedor = document.getElementById("event-grid");
  if (!contenedor) return;

  contenedor.innerHTML = `<p style="color:var(--text-secondary);">Cargando eventos...</p>`;

  const { data: eventos, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    contenedor.innerHTML = `<p style="color:#ff8a94;">No se pudieron cargar los eventos: ${error.message}</p>`;
    return;
  }

  if (!eventos || eventos.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--text-secondary);">Todavía no hay eventos cargados en la base de datos.</p>`;
    return;
  }

  contenedor.innerHTML = eventos
    .map(
      (evento) => `
      <article class="event-card">
        <img src="${evento.image_url}" alt="${evento.title}" />
        <div class="event-card-content">
          <h3>${evento.title}</h3>
          <p>${evento.description || ""}</p>
          <p class="event-price">Desde $${Number(evento.general_price).toFixed(2)}</p>
          <a class="btn btn-secondary" href="detalle.html?event=${encodeURIComponent(evento.slug)}">Ver detalles</a>
        </div>
      </article>
    `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", cargarEventos);
