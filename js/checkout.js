// =========================================================
// Checkout: valida la sesión, muestra el resumen del pedido,
// simula el cobro con una tarjeta, guarda la orden en Supabase,
// genera el código QR y el PDF del recibo, y llama a la Edge
// Function que envía el recibo por correo.
// =========================================================

const paramsCheckout = new URLSearchParams(window.location.search);
const slug = paramsCheckout.get("event");
const tipoBoleto = paramsCheckout.get("type") === "vip" ? "vip" : "general";
const cantidad = Math.max(1, Math.min(10, parseInt(paramsCheckout.get("qty"), 10) || 1));

let sesionActual = null;
let eventoActual = null;

const resumenEl = document.getElementById("checkout-resumen");
const formEl = document.getElementById("checkout-form");
const errorEl = document.getElementById("checkout-error");
const exitoEl = document.getElementById("checkout-exito");
const botonPagar = document.getElementById("btn-pagar");

function mostrarError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.style.display = msg ? "block" : "none";
}

// ---------- 1. Verificar sesión y cargar el evento ----------
async function iniciarCheckout() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    const destino = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(destino)}`;
    return;
  }
  sesionActual = session;

  if (!slug) {
    mostrarError("No se indicó ningún evento para comprar.");
    if (formEl) formEl.style.display = "none";
    return;
  }

  const { data: evento, error } = await supabaseClient
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !evento) {
    mostrarError("No se pudo encontrar el evento seleccionado.");
    if (formEl) formEl.style.display = "none";
    return;
  }

  eventoActual = evento;
  pintarResumen();

  const nombreInput = document.getElementById("buyer-name");
  const correoInput = document.getElementById("buyer-email");
  if (nombreInput) nombreInput.value = session.user.user_metadata?.full_name || "";
  if (correoInput) correoInput.value = session.user.email || "";
}

function pintarResumen() {
  if (!resumenEl || !eventoActual) return;
  const precioUnit = tipoBoleto === "vip" ? Number(eventoActual.vip_price) : Number(eventoActual.general_price);
  const total = precioUnit * cantidad;

  resumenEl.innerHTML = `
    <h3>${eventoActual.title}</h3>
    <p style="color:var(--text-secondary);">${eventoActual.date_label || ""} · ${eventoActual.location || ""}</p>
    <div class="checkout-linea"><span>Tipo de boleto</span><strong>${tipoBoleto === "vip" ? "VIP" : "General"}</strong></div>
    <div class="checkout-linea"><span>Cantidad</span><strong>${cantidad}</strong></div>
    <div class="checkout-linea"><span>Precio unitario</span><strong>$${precioUnit.toFixed(2)}</strong></div>
    <div class="checkout-linea checkout-total"><span>Total a pagar</span><strong>$${total.toFixed(2)}</strong></div>
  `;
}

// ---------- 2. Validación de tarjeta (formato, no cobra nada real) ----------
function soloDigitos(str) {
  return (str || "").replace(/\D/g, "");
}

// Algoritmo de Luhn: valida que el número de tarjeta tenga un formato
// consistente (el mismo chequeo que usan las tarjetas reales), pero
// aquí NO se contacta ningún banco ni pasarela: es 100% simulado.
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

function validarFormulario(datos) {
  if (!datos.buyerName) return "Escribe el nombre del comprador.";
  if (!/^\S+@\S+\.\S+$/.test(datos.buyerEmail)) return "Escribe un correo válido.";
  if (!datos.cardName) return "Escribe el nombre tal como aparece en la tarjeta.";

  const numero = soloDigitos(datos.cardNumber);
  if (numero.length < 13 || numero.length > 19 || !pasaLuhn(numero)) {
    return "El número de tarjeta no es válido.";
  }

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(datos.cardExpiry.trim());
  if (!match) return "La fecha de expiración debe tener el formato MM/AA.";
  const mes = parseInt(match[1], 10);
  const anio = 2000 + parseInt(match[2], 10);
  if (mes < 1 || mes > 12) return "El mes de expiración no es válido.";
  const ahora = new Date();
  const finDeMes = new Date(anio, mes, 0);
  if (finDeMes < new Date(ahora.getFullYear(), ahora.getMonth(), 1)) {
    return "La tarjeta ya está vencida.";
  }

  const cvv = soloDigitos(datos.cardCvv);
  if (cvv.length < 3 || cvv.length > 4) return "El CVV no es válido.";

  return null;
}

// Genera un identificador único para el boleto. Usa crypto.randomUUID()
// cuando está disponible (requiere https o localhost); si no, cae en un
// generador manual para que también funcione abriendo el archivo directo.
function generarUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Formatea el número de tarjeta en grupos de 4 mientras se escribe.
const inputCardNumber = document.getElementById("card-number");
if (inputCardNumber) {
  inputCardNumber.addEventListener("input", () => {
    const digitos = soloDigitos(inputCardNumber.value).slice(0, 19);
    inputCardNumber.value = digitos.replace(/(.{4})/g, "$1 ").trim();
  });
}

const inputCardExpiry = document.getElementById("card-expiry");
if (inputCardExpiry) {
  inputCardExpiry.addEventListener("input", () => {
    let digitos = soloDigitos(inputCardExpiry.value).slice(0, 4);
    if (digitos.length >= 3) digitos = digitos.slice(0, 2) + "/" + digitos.slice(2);
    inputCardExpiry.value = digitos;
  });
}

// ---------- 3. Enviar el formulario: "cobrar", guardar orden, generar QR/PDF, enviar correo ----------
if (formEl) {
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

    const errorValidacion = validarFormulario(datos);
    if (errorValidacion) {
      mostrarError(errorValidacion);
      return;
    }

    botonPagar.disabled = true;
    botonPagar.textContent = "Procesando pago...";

    // Simulación del cobro: aquí NO se conecta ninguna pasarela real,
    // solo se simula una pequeña espera como lo haría un banco.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const precioUnit = tipoBoleto === "vip" ? Number(eventoActual.vip_price) : Number(eventoActual.general_price);
    const total = precioUnit * cantidad;
    const ticketCode = generarUUID();

    const { data: orden, error: errorOrden } = await supabaseClient
      .from("orders")
      .insert({
        user_id: sesionActual.user.id,
        event_id: eventoActual.id,
        ticket_type: tipoBoleto,
        quantity: cantidad,
        unit_price: precioUnit,
        total,
        buyer_name: datos.buyerName,
        buyer_email: datos.buyerEmail,
        ticket_code: ticketCode,
        status: "pagado",
      })
      .select()
      .single();

    if (errorOrden) {
      botonPagar.disabled = false;
      botonPagar.textContent = "Pagar";
      mostrarError("No se pudo registrar la compra: " + errorOrden.message);
      return;
    }

    await finalizarCompra(orden, datos);
  });
}

// ---------- 4. Generar QR + PDF y mostrar/enviar el recibo ----------
async function finalizarCompra(orden, datos) {
  const contenidoQr = JSON.stringify({
    app: "Ticketspot",
    codigo: orden.ticket_code,
    evento: eventoActual.title,
    tipo: tipoBoleto,
    cantidad: orden.quantity,
    comprador: datos.buyerName,
  });

  const qrDataUrl = await QRCode.toDataURL(contenidoQr, { width: 240, margin: 1 });

  const pdfBase64 = generarPdfRecibo(orden, datos, qrDataUrl);

  formEl.style.display = "none";
  exitoEl.style.display = "block";
  exitoEl.innerHTML = `
    <h2>¡Compra confirmada!</h2>
    <p>Tu boleto para <strong>${eventoActual.title}</strong> quedó registrado.</p>
    <img src="${qrDataUrl}" alt="Código QR del boleto" style="width:200px;height:200px;border-radius:16px;margin:1rem 0;" />
    <p style="color:var(--text-secondary);">Código de boleto: <strong>${orden.ticket_code}</strong></p>
    <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1rem;">
      <button id="btn-descargar-pdf" type="button" class="btn-primary">Descargar recibo (PDF)</button>
      <a href="mis-boletos.html" class="btn-secondary">Ver mis boletos</a>
    </div>
    <p id="estado-envio-correo" style="margin-top:1rem; color:var(--text-secondary);">Enviando el recibo a ${datos.buyerEmail}...</p>
  `;

  document.getElementById("btn-descargar-pdf").addEventListener("click", () => {
    descargarPdfBase64(pdfBase64, `recibo-${orden.ticket_code}.pdf`);
  });

  enviarReciboPorCorreo(orden, datos, qrDataUrl, pdfBase64);
}

function generarPdfRecibo(orden, datos, qrDataUrl) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(20);
  doc.text("Ticketspot — Recibo de compra", 40, 50);

  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text("Este recibo confirma tu compra en la plataforma Ticketspot.", 40, 72);

  doc.setDrawColor(220);
  doc.line(40, 90, 555, 90);

  doc.setFontSize(13);
  doc.setTextColor(20);
  const filas = [
    ["Evento", eventoActual.title],
    ["Fecha", eventoActual.date_label || String(eventoActual.event_date || "")],
    ["Lugar", eventoActual.location || ""],
    ["Comprador", datos.buyerName],
    ["Correo", datos.buyerEmail],
    ["Tipo de boleto", tipoBoleto === "vip" ? "VIP" : "General"],
    ["Cantidad", String(orden.quantity)],
    ["Precio unitario", `$${Number(orden.unit_price).toFixed(2)}`],
    ["Total pagado", `$${Number(orden.total).toFixed(2)}`],
    ["Código de boleto", orden.ticket_code],
    ["Fecha de compra", new Date(orden.created_at).toLocaleString("es-PA")],
  ];

  let y = 120;
  filas.forEach(([etiqueta, valor]) => {
    doc.setFont(undefined, "bold");
    doc.text(etiqueta + ":", 40, y);
    doc.setFont(undefined, "normal");
    doc.text(String(valor), 190, y);
    y += 22;
  });

  doc.addImage(qrDataUrl, "PNG", 400, 110, 150, 150);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Presenta este código QR en la entrada del evento.", 400, 275);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(
    "Proyecto académico — este pago fue simulado y no representa una transacción real.",
    40,
    780
  );

  return doc.output("datauristring").split(",")[1];
}

function descargarPdfBase64(base64, nombreArchivo) {
  const link = document.createElement("a");
  link.href = "data:application/pdf;base64," + base64;
  link.download = nombreArchivo;
  link.click();
}

async function enviarReciboPorCorreo(orden, datos, qrDataUrl, pdfBase64) {
  const estadoEl = document.getElementById("estado-envio-correo");
  try {
    const { error } = await supabaseClient.functions.invoke("send-receipt", {
      body: {
        to: datos.buyerEmail,
        buyer_name: datos.buyerName,
        event_title: eventoActual.title,
        ticket_type: tipoBoleto === "vip" ? "VIP" : "General",
        quantity: orden.quantity,
        total: Number(orden.total).toFixed(2),
        ticket_code: orden.ticket_code,
        qr_data_url: qrDataUrl,
        pdf_base64: pdfBase64,
      },
    });

    if (error) throw error;
    if (estadoEl) {
      estadoEl.textContent = `Recibo enviado a ${datos.buyerEmail}.`;
    }
  } catch (err) {
    if (estadoEl) {
      estadoEl.textContent =
        "No se pudo enviar el recibo por correo (puedes descargarlo arriba en PDF). " +
        (err.message || "");
    }
    console.error("Error al invocar send-receipt:", err);
  }
}

document.addEventListener("DOMContentLoaded", iniciarCheckout);
