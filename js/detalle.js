// =========================================================
// Carga el detalle de un evento desde Supabase (buscado por "slug"
// en el query string ?event=slug), maneja la selección de tipo de
// boleto y cantidad, y al confirmar redirige a checkout.html
// (pidiendo login primero si hace falta).
// =========================================================

const paramsDetalle = new URLSearchParams(window.location.search);
const eventSlug = paramsDetalle.get("event") || "concierto-estelar";

let eventoActual = null;
let tipoSeleccionado = "general";

const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
};

const setHtml = (id, html) => {
  const element = document.getElementById(id);
  if (element) element.innerHTML = html;
};

async function cargarEvento() {
  const { data: evento, error } = await supabaseClient
    .from("events")
    .select("*")
    .eq("slug", eventSlug)
    .single();

  if (error || !evento) {
    setText("event-heading", "Evento no encontrado");
    setText("event-description", "No pudimos encontrar este evento en la base de datos.");
    const opciones = document.querySelector(".ticket-options");
    if (opciones) opciones.style.display = "none";
    const boton = document.getElementById("buy-button");
    if (boton) boton.style.display = "none";
    return;
  }

  eventoActual = evento;

  setText("event-label", "Evento destacado");
  setText("event-heading", evento.heading || evento.title);
  setText("event-description", evento.description || "");
  setText("event-title", evento.title);
  setText("event-summary", evento.summary || "");

  const eventImage = document.getElementById("event-image");
  if (eventImage) {
    eventImage.src = evento.image_url;
    eventImage.alt = evento.title;
  }

  setHtml("event-date", `<strong>Fecha:</strong> ${evento.date_label || evento.event_date || ""}`);
  setHtml("event-location", `<strong>Ubicación:</strong> ${evento.location || ""}`);
  setHtml("event-entry", `<strong>Entrada:</strong> ${evento.entry_info || ""}`);

  const btnGeneral = document.getElementById("ticket-general");
  const btnVip = document.getElementById("ticket-vip");
  if (btnGeneral) btnGeneral.textContent = `General - $${Number(evento.general_price).toFixed(2)}`;
  if (btnVip) btnVip.textContent = `VIP - $${Number(evento.vip_price).toFixed(2)}`;

  actualizarSeleccionVisual();
  actualizarResumenPrecio();
}

function actualizarSeleccionVisual() {
  document.querySelectorAll(".ticket-option").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.type === tipoSeleccionado);
  });
}

function precioUnitario() {
  if (!eventoActual) return 0;
  return tipoSeleccionado === "vip" ? Number(eventoActual.vip_price) : Number(eventoActual.general_price);
}

function actualizarResumenPrecio() {
  const cantidadInput = document.getElementById("ticket-quantity");
  const cantidad = cantidadInput ? Math.max(1, parseInt(cantidadInput.value, 10) || 1) : 1;
  const total = precioUnitario() * cantidad;
  const resumen = document.getElementById("price-summary");
  if (resumen) {
    resumen.textContent = `${cantidad} boleto(s) × $${precioUnitario().toFixed(2)} = $${total.toFixed(2)}`;
  }
}

document.querySelectorAll(".ticket-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    tipoSeleccionado = btn.dataset.type;
    actualizarSeleccionVisual();
    actualizarResumenPrecio();
  });
});

const cantidadInput = document.getElementById("ticket-quantity");
if (cantidadInput) {
  cantidadInput.addEventListener("input", actualizarResumenPrecio);
}

const buyButton = document.getElementById("buy-button");
if (buyButton) {
  buyButton.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!eventoActual) return;

    const cantidad = cantidadInput ? Math.max(1, parseInt(cantidadInput.value, 10) || 1) : 1;
    const destino = `checkout.html?event=${encodeURIComponent(eventoActual.slug)}&type=${tipoSeleccionado}&qty=${cantidad}`;

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session) {
      window.location.href = `login.html?redirect=${encodeURIComponent(destino)}`;
      return;
    }

    window.location.href = destino;
  });
}

document.addEventListener("DOMContentLoaded", cargarEvento);
