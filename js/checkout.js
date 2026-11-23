// =========================================================
// Checkout: resume el pedido, simula el cobro con tarjeta, registra la
// compra con la función segura crear_compra (el PRECIO lo calcula la base
// de datos), genera el QR y el PDF y pide el envío del recibo por correo.
// Requiere common.js, qrcode.min.js y jspdf.umd.min.js.
// =========================================================

const paramsCheckout = new URLSearchParams(window.location.search);
const slugCompra = paramsCheckout.get("event");
const tipoBoleto = paramsCheckout.get("type") === "vip" ? "vip" : "general";
const cantidad = Math.max(1, Math.min(10, parseInt(paramsCheckout.get("qty"), 10) || 1));
const asientosParam = (paramsCheckout.get("seats") || "").split(",").map((s) => s.trim()).filter(Boolean);

let sesionActual = null;
let eventoActual = null;
let asientos = []; // ids de asientos (eventos con mapa)
let enviando = false; // true mientras se procesa un pago (evita doble clic)
let ordenCreada = false;

const resumenEl = document.getElementById("checkout-resumen");
const formEl = document.getElementById("checkout-form");
const errorEl = document.getElementById("checkout-error");
const exitoEl = document.getElementById("checkout-exito");
const botonPagar = document.getElementById("btn-pagar");

function mostrarError(msg, enlaceHtml = "") {
  errorEl.innerHTML = esc(msg) + enlaceHtml;
  errorEl.hidden = !msg;
}

function ocultarFormulario() {
  formEl.hidden = true;
}

// ---------- 1. Sesión, evento y pedido ----------
async function iniciarCheckout() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const destino = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(destino)}`;
    return;
  }
  sesionActual = session;

  if (!slugCompra) {
    mostrarError("No se indicó ningún evento para comprar.");
    ocultarFormulario();
    return;
  }

  const { data: evento, error } = await supabaseClient.from("events").select("*").eq("slug", slugCompra).single();
  if (error || !evento) {
    mostrarError("No se pudo encontrar el evento seleccionado.");
    ocultarFormulario();
    return;
  }
  eventoActual = evento;

  if (evento.layout !== "general") {
    const volver = ` <a href="asientos.html?event=${encodeURIComponent(evento.slug)}">Elegir asientos</a>`;
    const validos =
      asientosParam.length > 0 &&
      asientosParam.length <= 8 &&
      new Set(asientosParam).size === asientosParam.length &&
      asientosParam.every((id) => FORMATO_ASIENTO.test(id) && NOMBRES_SECCION[partesAsiento(id).seccion]);
    if (!validos) {
      mostrarError("Debes elegir tus asientos antes de pagar.", volver);
      ocultarFormulario();
      return;
    }
    asientos = asientosParam;
  }

  pintarResumen();
  document.getElementById("buyer-name").value = session.user.user_metadata?.full_name || "";
  document.getElementById("buyer-email").value = session.user.email || "";
}

function calcularPedido() {
  if (asientos.length) {
    const items = asientos.map((id) => ({ id, precio: precioDeAsiento(eventoActual, id) }));
    return { cantidad: items.length, total: items.reduce((t, i) => t + i.precio, 0), items };
  }
  const unit = Number(tipoBoleto === "vip" ? eventoActual.vip_price : eventoActual.general_price);
  return { cantidad, total: unit * cantidad, unit, items: [] };
}

function pintarResumen() {
  const p = calcularPedido();
  let detalle;
  if (p.items.length) {
    detalle = p.items.map((i) => `<div class="line"><span>${esc(etiquetaAsiento(i.id))}</span><strong>${dinero(i.precio)}</strong></div>`).join("");
  } else {
    detalle = `
      <div class="line"><span>Tipo de boleto</span><strong>${tipoBoleto === "vip" ? "VIP" : "General"}</strong></div>
      <div class="line"><span>Cantidad</span><strong>${p.cantidad}</strong></div>
      <div class="line"><span>Precio unitario</span><strong>${dinero(p.unit)}</strong></div>`;
  }
  resumenEl.innerHTML = `
    <h3>${esc(eventoActual.title)}</h3>
    <p style="color:var(--muted); margin:0.2rem 0 1rem;">${esc(eventoActual.date_label || "")} · ${esc(eventoActual.location || "")}</p>
    ${detalle}
    <div class="line total"><span>Total a pagar</span><span>${dinero(p.total)}</span></div>`;
}

// ---------- 2. Validación de la tarjeta (solo formato; no se cobra nada) ----------
const soloDigitos = (s) => (s || "").replace(/\D/g, "");

// Algoritmo de Luhn: el mismo chequeo matemático que usan las tarjetas reales.
function pasaLuhn(numero) {
  let suma = 0;
  let alterna = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = parseInt(numero.charAt(i), 10);
    if (alterna) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    alterna = !alterna;
  }
  return suma % 10 === 0;
}

function validarFormulario(d) {
  if (!d.buyerName) return "Escribe el nombre del comprador.";
  if (!/^\S+@\S+\.\S+$/.test(d.buyerEmail)) return "Escribe un correo válido.";
  if (!d.cardName) return "Escribe el nombre tal como aparece en la tarjeta.";
  const numero = soloDigitos(d.cardNumber);
  if (numero.length < 13 || numero.length > 19 || !pasaLuhn(numero)) return "El número de tarjeta no es válido.";
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(d.cardExpiry.trim());
  if (!m) return "La fecha de expiración debe tener el formato MM/AA.";
  const mes = parseInt(m[1], 10);
  const anio = 2000 + parseInt(m[2], 10);
  if (mes < 1 || mes > 12) return "El mes de expiración no es válido.";
  const hoy = new Date();
  if (new Date(anio, mes, 0) < new Date(hoy.getFullYear(), hoy.getMonth(), 1)) return "La tarjeta ya está vencida.";
  const cvv = soloDigitos(d.cardCvv);
  if (cvv.length < 3 || cvv.length > 4) return "El CVV no es válido.";
  return null;
}

document.getElementById("card-number").addEventListener("input", (e) => {
  e.target.value = soloDigitos(e.target.value).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
});
document.getElementById("card-expiry").addEventListener("input", (e) => {
  let v = soloDigitos(e.target.value).slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
  e.target.value = v;
});

// ---------- 3. Pagar ----------
function traducirErrorCompra(msg) {
  if (/ya fueron vendidos/i.test(msg)) {
    return { texto: "Uno o más asientos acaban de ser comprados por otra persona.", enlace: ` <a href="asientos.html?event=${encodeURIComponent(eventoActual.slug)}">Elegir otros asientos</a>` };
  }
  if (/crear_compra|schema cache|Could not find the function/i.test(msg)) {
    return { texto: "La base de datos aún no tiene la función de compra. Ejecuta el archivo supabase/schema.sql en el SQL Editor de Supabase.", enlace: "" };
  }
  return { texto: "No se pudo registrar la compra: " + msg, enlace: "" };
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarError("");

  const datos = {
    buyerName: document.getElementById("buyer-name").value.trim(),
    buyerEmail: document.getElementById("buyer-email").value.trim(),
    cardName: document.getElementById("card-name").value.trim(),
    cardNumber: document.getElementById("card-number").value,
    cardExpiry: document.getElementById("card-expiry").value,
    cardCvv: document.getElementById("card-cvv").value,
  };
  const problema = validarFormulario(datos);
  if (problema) {
    mostrarError(problema);
    return;
  }

  if (ordenCreada || enviando) return;
  enviando = true;
  botonPagar.disabled = true;
  botonPagar.textContent = "Procesando pago...";

  try {
    // Simulación del cobro: NO se conecta ninguna pasarela real.
    await new Promise((r) => setTimeout(r, 1400));

    const { data: orden, error } = await supabaseClient.rpc("crear_compra", {
      p_event_id: eventoActual.id,
      p_ticket_type: asientos.length ? null : tipoBoleto,
      p_quantity: asientos.length ? null : cantidad,
      p_seats: asientos.length ? asientos : null,
      p_buyer_name: datos.buyerName,
      p_buyer_email: datos.buyerEmail,
      p_ticket_code: generarUUID(),
    });

    if (error) {
      const t = traducirErrorCompra(error.message || String(error));
      mostrarError(t.texto, t.enlace);
      return;
    }

    ordenCreada = true;
    await finalizarCompra(orden, datos);
  } catch (err) {
    console.error("Error en el checkout:", err);
    mostrarError("Ocurrió un error inesperado al procesar el pago: " + (err?.message || err));
  } finally {
    enviando = false;
    if (!ordenCreada) {
      botonPagar.disabled = false;
      botonPagar.textContent = "Pagar";
    }
  }
});

// ---------- 4. QR + PDF + correo ----------
async function finalizarCompra(orden, datos) {
  const etiquetas = asientos.map(etiquetaAsiento);
  let qrDataUrl = "";
  let pdfBase64 = "";
  let aviso = "";
  let doc = null;

  try {
    if (typeof QRCode === "undefined") throw new Error("La librería de QR no cargó.");
    qrDataUrl = await QRCode.toDataURL(contenidoQr(orden, eventoActual, datos.buyerName, asientos), { width: 240, margin: 1 });
  } catch (err) {
    console.error("Error generando el QR:", err);
    aviso += "No se pudo generar el QR: " + (err.message || err) + " ";
  }

  try {
    if (!window.jspdf) throw new Error("La librería de PDF no cargó.");
    doc = crearPdfRecibo({ orden, evento: eventoActual, comprador: datos.buyerName, correo: datos.buyerEmail, asientos: etiquetas, qrDataUrl });
    pdfBase64 = doc.output("datauristring").split("base64,")[1];
  } catch (err) {
    console.error("Error generando el PDF:", err);
    aviso += "No se pudo generar el PDF: " + (err.message || err) + " ";
  }

  formEl.hidden = true;
  exitoEl.hidden = false;
  exitoEl.innerHTML = `
    <h2>Compra confirmada</h2>
    <p>Tu entrada para <strong>${esc(eventoActual.title)}</strong> quedó registrada.</p>
    ${aviso ? `<p class="msg msg-error" style="margin-top:0.8rem;">${esc(aviso)}</p>` : ""}
    ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="Código QR del boleto" />` : ""}
    ${etiquetas.length ? `<ul class="seat-list" style="max-height:none;">${etiquetas.map((t) => `<li style="grid-template-columns:1fr;"><span>${esc(t)}</span></li>`).join("")}</ul>` : ""}
    <p style="color:var(--muted); font-size:0.88rem; word-break:break-all;">Código: ${esc(orden.ticket_code)}</p>
    <div class="actions">
      <button id="btn-descargar-pdf" type="button" class="btn-primary">Descargar recibo (PDF)</button>
      <a href="mis-boletos.html" class="btn-secondary">Ver mis boletos</a>
    </div>
    <p id="estado-envio-correo" class="note">Enviando el recibo a ${esc(datos.buyerEmail)}...</p>`;

  document.getElementById("btn-descargar-pdf").addEventListener("click", () => {
    if (!doc) {
      alert("El PDF no está disponible. Revisa la consola (F12) para ver el error.");
      return;
    }
    descargarPdf(doc, `recibo-${orden.ticket_code}.pdf`);
  });

  enviarReciboPorCorreo(orden, datos, qrDataUrl, pdfBase64);
}

async function enviarReciboPorCorreo(orden, datos, qrDataUrl, pdfBase64) {
  const estadoEl = document.getElementById("estado-envio-correo");
  try {
    const { error } = await supabaseClient.functions.invoke("super-action", {
      body: { ticket_code: orden.ticket_code, qr_data_url: qrDataUrl, pdf_base64: pdfBase64 },
    });
    if (error) throw error;
    estadoEl.textContent = `Recibo enviado a ${datos.buyerEmail}.`;
  } catch (err) {
    let detalle = err.message || "";
    try {
      if (err.context && typeof err.context.json === "function") {
        const cuerpo = await err.context.json();
        const motivo = cuerpo.error ?? cuerpo;
        detalle = typeof motivo === "string" ? motivo : motivo.message || JSON.stringify(motivo);
      }
    } catch (_) {
      /* se queda el mensaje genérico */
    }
    estadoEl.textContent = "No se pudo enviar el recibo por correo (puedes descargarlo en PDF). " + detalle;
    console.error("Error al invocar send-receipt:", err);
  }
}

document.addEventListener("DOMContentLoaded", iniciarCheckout);
