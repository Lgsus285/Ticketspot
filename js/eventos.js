// =========================================================
// Catálogo: lista de eventos con filtro por categoría y búsqueda.
// =========================================================

let todos = [];
let categoriaActual = "Todos";
let consulta = "";

function pintarCategorias() {
  const cont = document.getElementById("chips");
  const cats = ["Todos", ...new Set(todos.map((e) => e.category || "Eventos"))];
  cont.innerHTML = cats
    .map((c) => `<button type="button" class="chip${c === categoriaActual ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
  cont.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => {
      categoriaActual = b.dataset.cat;
      pintarCategorias();
      pintarEventos();
    })
  );
}

function pintarEventos() {
  const grid = document.getElementById("event-grid");
  const q = consulta.trim().toLowerCase();
  const lista = todos.filter((e) => {
    const okCat = categoriaActual === "Todos" || (e.category || "Eventos") === categoriaActual;
    const texto = `${e.title} ${e.location || ""} ${e.category || ""} ${e.description || ""}`.toLowerCase();
    return okCat && (!q || texto.includes(q));
  });
  grid.innerHTML = lista.length
    ? lista.map(tarjetaEvento).join("")
    : `<p class="empty">No encontramos eventos con ese filtro.</p>`;
}

async function cargarEventos() {
  const grid = document.getElementById("event-grid");
  const { data, error } = await supabaseClient.from("events").select("*").order("event_date", { ascending: true });
  if (error) {
    grid.innerHTML = `<p class="msg msg-error">No se pudieron cargar los eventos: ${esc(error.message)}</p>`;
    return;
  }
  todos = data || [];
  if (!todos.length) {
    grid.innerHTML = `<p class="empty">Todavía no hay eventos cargados.</p>`;
    return;
  }
  pintarCategorias();
  pintarEventos();
  document.getElementById("search").addEventListener("input", (e) => {
    consulta = e.target.value;
    pintarEventos();
  });
}

document.addEventListener("DOMContentLoaded", cargarEventos);
