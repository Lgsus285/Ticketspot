// =========================================================
// Mapa de asientos: dibuja el recinto del evento, bloquea los asientos
// ya vendidos (tabla order_seats) y deja elegir hasta 8.
// Requiere common.js y layouts.js.
// =========================================================

const MAX_ASIENTOS = 8;
const SVG_NS = "http://www.w3.org/2000/svg";
const slugAsientos = new URLSearchParams(window.location.search).get("event") || "";

let evento = null;
let mapa = null; // geometría del recinto
let vendidos = new Set();
const seleccion = new Map(); // id -> asiento
const elementos = new Map(); // id -> elemento SVG

const el = (id) => document.getElementById(id);

function mostrarMensaje(texto) {
  const m = el("seat-msg");
  m.textContent = texto;
  m.hidden = !texto;
}

function precioAsiento(asiento) {
  return Number(asiento.tier === "vip" ? evento.vip_price : evento.general_price);
}

async function cargarVendidos() {
  const { data, error } = await supabaseClient.from("order_seats").select("seat_id").eq("event_id", evento.id);
  if (error) {
    mostrarMensaje("No se pudo consultar la disponibilidad: " + error.message);
    return false;
  }
  vendidos = new Set((data || []).map((r) => r.seat_id));
  return true;
}

function crear(tag, attrs = {}, texto) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function dibujarMapa() {
  const svg = el("seat-map");
  svg.setAttribute("viewBox", `0 0 ${mapa.width} ${mapa.height}`);
  svg.innerHTML = "";
  elementos.clear();

  const s = mapa.stage;
  svg.appendChild(crear("rect", { x: s.x, y: s.y, width: s.w, height: s.h, rx: 3, class: "map-stage" }));
  svg.appendChild(crear("text", { x: s.x + s.w / 2, y: s.y + s.h / 2 + 5, class: "map-stage-label" }, s.text));

  mapa.labels.forEach((l) => {
    const t = crear("text", { x: l.x, y: l.y, class: "map-label" }, l.text);
    if (l.anchor) t.style.textAnchor = l.anchor;
    svg.appendChild(t);
  });
  mapa.rowLabels.forEach((l) => svg.appendChild(crear("text", { x: l.x, y: l.y, class: "map-row" }, l.text)));

  const tam = mapa.seatSize;
  mapa.seats.forEach((a) => {
    const redondo = mapa.kind === "arena";
    const nodo = redondo
      ? crear("circle", { cx: a.x, cy: a.y, r: tam / 2 })
      : crear("rect", { x: a.x - tam / 2, y: a.y - tam / 2, width: tam, height: tam, rx: 3 });
    const ocupado = vendidos.has(a.id);
    nodo.setAttribute("class", `seat tier-${a.tier}${ocupado ? " sold" : ""}`);
    nodo.setAttribute("data-id", a.id);
    nodo.setAttribute("role", "button");
    nodo.setAttribute("tabindex", ocupado ? "-1" : "0");
    nodo.setAttribute("aria-label", `${etiquetaAsiento(a.id)}, ${dinero(precioAsiento(a))}${ocupado ? ", ocupado" : ""}`);
    if (ocupado) nodo.setAttribute("aria-disabled", "true");
    nodo.appendChild(crear("title", {}, `${etiquetaAsiento(a.id)} — ${ocupado ? "Ocupado" : dinero(precioAsiento(a))}`));
    nodo.addEventListener("click", () => alternar(a));
    nodo.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        alternar(a);
      }
    });
    svg.appendChild(nodo);
    elementos.set(a.id, nodo);
  });
  seleccion.forEach((_, id) => elementos.get(id)?.classList.add("selected"));
}

function alternar(asiento) {
  mostrarMensaje("");
  if (vendidos.has(asiento.id)) return;
  const nodo = elementos.get(asiento.id);
  if (seleccion.has(asiento.id)) {
    seleccion.delete(asiento.id);
    nodo.classList.remove("selected");
  } else {
    if (seleccion.size >= MAX_ASIENTOS) {
      mostrarMensaje(`Puedes elegir máximo ${MAX_ASIENTOS} asientos por compra.`);
      return;
    }
    seleccion.set(asiento.id, asiento);
    nodo.classList.add("selected");
  }
  actualizarPanel();
}

function actualizarPanel() {
  const lista = [...seleccion.values()].sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));
  el("seat-empty").hidden = lista.length > 0;
  el("seat-list").innerHTML = lista
    .map((a) => `<li><span>${esc(etiquetaCorta(a.id))}</span><span class="s-price">${dinero(precioAsiento(a))}</span><button type="button" data-quitar="${esc(a.id)}" aria-label="Quitar ${esc(etiquetaCorta(a.id))}">Quitar</button></li>`)
    .join("");
  el("seat-list").querySelectorAll("[data-quitar]").forEach((b) =>
    b.addEventListener("click", () => alternar(seleccion.get(b.dataset.quitar)))
  );
  el("seat-total").textContent = dinero(lista.reduce((t, a) => t + precioAsiento(a), 0));
  el("seat-continue").disabled = lista.length === 0;
}

async function refrescarDisponibilidad() {
  if (!(await cargarVendidos())) return;
  let perdidos = 0;
  mapa.seats.forEach((a) => {
    const nodo = elementos.get(a.id);
    const ocupado = vendidos.has(a.id);
    nodo.classList.toggle("sold", ocupado);
    nodo.setAttribute("tabindex", ocupado ? "-1" : "0");
    if (ocupado && seleccion.has(a.id)) {
      seleccion.delete(a.id);
      nodo.classList.remove("selected");
      perdidos++;
    }
  });
  if (perdidos) {
    mostrarMensaje(`${perdidos} de tus asientos fueron comprados por otra persona y se quitaron de tu selección.`);
    actualizarPanel();
  }
}

el("seat-continue").addEventListener("click", async () => {
  if (!seleccion.size) return;
  const ids = [...seleccion.keys()];
  const destino = `checkout.html?event=${encodeURIComponent(evento.slug)}&seats=${ids.map(encodeURIComponent).join(",")}`;
  const { data: { session } } = await supabaseClient.auth.getSession();
  window.location.href = session ? destino : `login.html?redirect=${encodeURIComponent(destino)}`;
});

async function iniciar() {
  const { data, error } = await supabaseClient.from("events").select("*").eq("slug", slugAsientos).single();
  if (error || !data) {
    el("seat-title").textContent = "Evento no encontrado";
    el("seat-sub").textContent = "Vuelve al catálogo para elegir otro evento.";
    el("seat-continue").hidden = true;
    return;
  }
  evento = data;

  if (evento.layout === "general") {
    window.location.href = `detalle.html?event=${encodeURIComponent(evento.slug)}`;
    return;
  }

  document.title = `Asientos — ${evento.title} | Ticketspot`;
  el("crumb-event").textContent = evento.title;
  el("crumb-event").href = `detalle.html?event=${encodeURIComponent(evento.slug)}`;
  el("seat-title").textContent = evento.title;
  el("seat-sub").textContent = `${evento.date_label || fechaCorta(evento)} · ${evento.location || ""}`;
  el("seat-prices").innerHTML = `
    <li><span>VIP</span><strong>${dinero(evento.vip_price)}</strong></li>
    <li><span>General</span><strong>${dinero(evento.general_price)}</strong></li>`;

  mapa = buildSeatLayout(evento.layout);
  await cargarVendidos();
  dibujarMapa();
  actualizarPanel();
  setInterval(refrescarDisponibilidad, 20000);
}

document.addEventListener("DOMContentLoaded", iniciar);
