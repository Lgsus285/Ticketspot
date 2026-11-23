// =========================================================
// Historial de compras del usuario: boleto con QR, asientos y PDF.
// Requiere common.js, qrcode.min.js y jspdf.umd.min.js.
// =========================================================

async function cargarMisBoletos() {
  const cont = document.getElementById("boletos-lista");

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html?redirect=mis-boletos.html";
    return;
  }

  cont.innerHTML = `<p class="empty">Cargando tus boletos...</p>`;

  const { data: ordenes, error } = await supabaseClient
    .from("orders")
    .select("*, events(title, date_label, location, image_url), order_seats(seat_id)")
    .order("created_at", { ascending: false });

  if (error) {
    cont.innerHTML = `<p class="msg msg-error">No se pudieron cargar tus boletos: ${esc(error.message)}</p>`;
    return;
  }
  if (!ordenes || ordenes.length === 0) {
    cont.innerHTML = `<p class="empty">Todavía no has comprado ningún boleto. <a href="eventos.html" style="color:var(--accent);">Ver eventos</a></p>`;
    return;
  }

  cont.innerHTML = "";
  for (const orden of ordenes) {
    const evento = orden.events || {};
    const ids = (orden.order_seats || []).map((s) => s.seat_id);
    const tipo = { vip: "VIP", general: "General", mixto: "VIP y General" }[orden.ticket_type] || orden.ticket_type;

    const tarjeta = document.createElement("article");
    tarjeta.className = "ticket";
    tarjeta.innerHTML = `
      <div class="ticket-top">
        <h3>${esc(evento.title || "Evento")}</h3>
        <p>${esc(evento.date_label || "")} · ${esc(evento.location || "")}</p>
      </div>
      <div class="ticket-cut"></div>
      <div class="ticket-bottom">
        <div class="boleto-qr"></div>
        <div class="ticket-data">
          <span><strong>${esc(tipo)}</strong> · ${orden.quantity} ${orden.quantity === 1 ? "entrada" : "entradas"}</span>
          ${ids.length ? `<span>${ids.map((id) => esc(etiquetaCorta(id))).join("<br>")}</span>` : ""}
          <span>Total ${dinero(orden.total)}</span>
          <span class="code">${esc(orden.ticket_code)}</span>
        </div>
      </div>
      <div class="ticket-actions"><button class="btn-secondary btn-block" type="button" data-order-id="${esc(orden.id)}">Descargar recibo (PDF)</button></div>`;
    cont.appendChild(tarjeta);

    let qrDataUrl = "";
    const qrDiv = tarjeta.querySelector(".boleto-qr");
    try {
      qrDataUrl = await QRCode.toDataURL(contenidoQr(orden, evento, orden.buyer_name, ids), { width: 160, margin: 1 });
      qrDiv.innerHTML = `<img src="${qrDataUrl}" alt="Código QR" width="112" height="112" />`;
    } catch (err) {
      console.error("Error generando el QR:", err);
      qrDiv.innerHTML = `<p class="note">No se pudo generar el QR.</p>`;
    }

    tarjeta.querySelector("button[data-order-id]").addEventListener("click", () => {
      try {
        const doc = crearPdfRecibo({
          orden, evento, comprador: orden.buyer_name, correo: orden.buyer_email,
          asientos: ids.map(etiquetaAsiento), qrDataUrl,
        });
        descargarPdf(doc, `recibo-${orden.ticket_code}.pdf`);
      } catch (err) {
        console.error("Error generando el PDF:", err);
        alert("No se pudo generar el PDF: " + (err.message || err));
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", cargarMisBoletos);
