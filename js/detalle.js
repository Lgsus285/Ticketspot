// =========================================================
// Detalle de un evento (?event=slug). Si el evento tiene asientos
// numerados lleva al mapa; si no, permite elegir tipo y cantidad.
// =========================================================

const slugDetalle = new URLSearchParams(window.location.search).get("event") || "";
let eventoActual = null;
let tipoSeleccionado = "general";

const $ = (id) => document.getElementById(id);

async function cargarEvento() {
  const { data: evento, error } = await supabaseClient.from("events").select("*").eq("slug", slugDetalle).single();

  if (error || !evento) {
    $("event-title").textContent = "Evento no encontrado";
    $("event-summary").textContent = "No pudimos encontrar este evento. Vuelve al catálogo para ver los disponibles.";
    $("crumb").textContent = "No encontrado";
    $("buy-panel").hidden = true;
    return;
  }
  eventoActual = evento;

  document.title = `${evento.title} | Ticketspot`;
  $("crumb").textContent = evento.title;
  $("event-cat").textContent = evento.category || "Evento";
  $("event-title").textContent = evento.title;
  $("event-summary").textContent = evento.summary || evento.description || "";
  $("event-image").src = rutaImagen(evento.image_url);
  $("event-image").alt = `Afiche de ${evento.title}`;
  $("event-date").textContent = evento.date_label || fechaCorta(evento);
  $("event-location").textContent = evento.location || "";
  $("event-entry").textContent = evento.entry_info || "";

  if (evento.layout === "general") {
    $("panel-general").hidden = false;
    $("panel-seats").hidden = true;
    document.querySelector("#ticket-general span").textContent = dinero(evento.general_price);
    document.querySelector("#ticket-vip span").textContent = dinero(evento.vip_price);
    marcarSeleccion();
    actualizarResumen();
  } else {
    $("panel-general").hidden = true;
    $("panel-seats").hidden = false;
    $("seat-prices").innerHTML = `
      <li><span>VIP</span><strong>${dinero(evento.vip_price)}</strong></li>
      <li><span>General</span><strong>${dinero(evento.general_price)}</strong></li>`;
    $("seats-link").href = `asientos.html?event=${encodeURIComponent(evento.slug)}`;
  }
}

function marcarSeleccion() {
  document.querySelectorAll(".ticket-option").forEach((b) => b.classList.toggle("selected", b.dataset.type === tipoSeleccionado));
}

// Cantidad válida (1 a 10); corrige el campo si el usuario escribió otra cosa.
function leerCantidad() {
  const input = $("ticket-quantity");
  const cantidad = Math.min(10, Math.max(1, parseInt(input.value, 10) || 1));
  if (input.value !== "" && String(cantidad) !== input.value) input.value = cantidad;
  return cantidad;
}

function precioUnitario() {
  if (!eventoActual) return 0;
  return Number(tipoSeleccionado === "vip" ? eventoActual.vip_price : eventoActual.general_price);
}

function actualizarResumen() {
  const cantidad = leerCantidad();
  $("price-summary").textContent = `${cantidad} boleto(s) × ${dinero(precioUnitario())} = ${dinero(precioUnitario() * cantidad)}`;
}

document.querySelectorAll(".ticket-option").forEach((b) =>
  b.addEventListener("click", () => {
    tipoSeleccionado = b.dataset.type;
    marcarSeleccion();
    actualizarResumen();
  })
);
$("ticket-quantity").addEventListener("input", actualizarResumen);

$("buy-button").addEventListener("click", async () => {
  if (!eventoActual) return;
  const destino = `checkout.html?event=${encodeURIComponent(eventoActual.slug)}&type=${tipoSeleccionado}&qty=${leerCantidad()}`;
  const { data: { session } } = await supabaseClient.auth.getSession();
  window.location.href = session ? destino : `login.html?redirect=${encodeURIComponent(destino)}`;
});

document.addEventListener("DOMContentLoaded", cargarEvento);
