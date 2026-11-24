// =========================================================
// Utilidades compartidas por todas las páginas.
// =========================================================

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Escapa texto antes de ponerlo dentro de innerHTML.
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dinero(n) {
  return "$" + Number(n || 0).toFixed(2);
}

// "2027-03-20" -> "20 mar 2027" (sin usar Date para evitar problemas de zona horaria)
function fechaCorta(evento) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(evento.event_date || "");
  if (!m) return evento.date_label || "";
  return `${parseInt(m[3], 10)} ${MESES[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

// Las imágenes de la base de datos se guardan como "../imagenes/archivo.jpg" (páginas dentro de html/).
// Si las páginas están en la raíz del sitio, se quita el "../" para que sigan cargando.
function rutaImagen(url) {
  const ruta = String(url || "");
  return /\/html\//.test(window.location.pathname) ? ruta : ruta.replace(/^\.\.\//, "");
}

// ---------- Asientos ----------
// Un asiento se identifica como SECCION|FILA|NUMERO, ej. "PLA-CEN|B|5".
const NOMBRES_SECCION = {
  "VIP-IZQ": "VIP izquierda",
  "VIP-CEN": "VIP centro",
  "VIP-DER": "VIP derecha",
  "PLA-IZQ": "Platea izquierda",
  "PLA-CEN": "Platea centro",
  "PLA-DER": "Platea derecha",
  PISTA: "Pista VIP",
  "LAT-IZQ": "Lateral izquierdo",
  "LAT-DER": "Lateral derecho",
  "FON-IZQ": "Fondo izquierdo",
  "FON-CEN": "Fondo centro",
  "FON-DER": "Fondo derecho",
};

const SECCIONES_VIP = ["VIP-IZQ", "VIP-CEN", "VIP-DER", "PISTA"];

const FORMATO_ASIENTO = /^[A-Z-]{3,8}\|[A-Z]{1,2}\|[0-9]{1,3}$/;

function partesAsiento(id) {
  const [seccion, fila, numero] = String(id).split("|");
  return { seccion, fila, numero };
}

function nivelDeAsiento(id) {
  return SECCIONES_VIP.includes(partesAsiento(id).seccion) ? "vip" : "general";
}

function precioDeAsiento(evento, id) {
  return nivelDeAsiento(id) === "vip" ? Number(evento.vip_price) : Number(evento.general_price);
}

function etiquetaAsiento(id) {
  const { seccion, fila, numero } = partesAsiento(id);
  return `${NOMBRES_SECCION[seccion] || seccion} · Fila ${fila} · Asiento ${numero}`;
}

// Genera un identificador único para el boleto (crypto.randomUUID si existe).
function generarUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Solo se permiten destinos internos al redirigir tras el login.
function destinoSeguro(valor) {
  if (!valor) return "eventos.html";
  const limpio = valor.trim();
  const externo = /^[a-z][a-z0-9+.-]*:/i.test(limpio) || limpio.startsWith("//") || limpio.startsWith("\\");
  return externo ? "eventos.html" : limpio;
}

// Contenido del código QR de un boleto.
function contenidoQr(orden, evento, comprador, asientos) {
  return JSON.stringify({
    app: "Ticketspot",
    codigo: orden.ticket_code,
    evento: evento.title,
    tipo: orden.ticket_type,
    cantidad: orden.quantity,
    asientos: asientos && asientos.length ? asientos : undefined,
    comprador,
  });
}

// Descarga un PDF (jsPDF) como archivo, usando un Blob.
function descargarPdf(doc, nombreArchivo) {
  const url = URL.createObjectURL(doc.output("blob"));
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Dibuja el recibo en PDF. `asientos` es una lista de textos (puede ir vacía).
function crearPdfRecibo({ orden, evento, comprador, correo, asientos, qrDataUrl }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(20);
  doc.text("Ticketspot — Recibo de compra", 40, 50);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text("Este recibo confirma tu compra en Ticketspot.", 40, 72);
  doc.setDrawColor(200);
  doc.line(40, 90, 555, 90);

  const tipo = { vip: "VIP", general: "General", mixto: "VIP y General" }[orden.ticket_type] || orden.ticket_type;
  const filas = [
    ["Evento", evento.title],
    ["Fecha", evento.date_label || String(evento.event_date || "")],
    ["Lugar", evento.location || ""],
    ["Comprador", comprador],
    ["Correo", correo],
    ["Tipo de boleto", tipo],
    ["Cantidad", String(orden.quantity)],
    ["Total pagado", dinero(orden.total)],
    ["Código de boleto", orden.ticket_code],
    ["Fecha de compra", new Date(orden.created_at).toLocaleString("es-PA")],
  ];

  doc.setFontSize(12);
  doc.setTextColor(20);
  let y = 120;
  filas.forEach(([k, v]) => {
    doc.setFont(undefined, "bold");
    doc.text(k + ":", 40, y);
    doc.setFont(undefined, "normal");
    const partes = doc.splitTextToSize(String(v), 200);
    doc.text(partes, 150, y);
    y += 20 * partes.length;
  });

  if (asientos && asientos.length) {
    y += 8;
    doc.setFont(undefined, "bold");
    doc.text("Asientos:", 40, y);
    doc.setFont(undefined, "normal");
    asientos.forEach((a) => {
      y += 18;
      doc.text("• " + a, 150, y);
    });
  }

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 395, 110, 150, 150);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Presenta este código QR en la entrada.", 395, 275);
  }

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Proyecto académico — el pago fue simulado y no representa una transacción real.", 40, 800);
  return doc;
}

// "Platea centro · B5" (versión corta para listas)
function etiquetaCorta(id) {
  const { seccion, fila, numero } = partesAsiento(id);
  return `${NOMBRES_SECCION[seccion] || seccion} · ${fila}${numero}`;
}

// Tarjeta de evento (portada y catálogo)
function tarjetaEvento(ev) {
  return `
    <a class="event-card" href="detalle.html?event=${encodeURIComponent(ev.slug)}">
      <div class="thumb"><img src="${esc(rutaImagen(ev.image_url))}" alt="Afiche de ${esc(ev.title)}" style="object-position:${esc(ev.image_position || "center")}" loading="lazy" /></div>
      <div class="event-card-body">
        <span class="event-cat">${esc(ev.category || "Evento")}</span>
        <h3>${esc(ev.title)}</h3>
        <p class="event-date">${esc(fechaCorta(ev))}</p>
        <p class="event-place">${esc(ev.location || "")}</p>
        <p class="event-price"><small>Desde</small> ${dinero(ev.general_price)}</p>
      </div>
    </a>`;
}
