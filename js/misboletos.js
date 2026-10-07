// =========================================================
// Muestra el historial de compras del usuario logueado,
// con su código QR y la opción de volver a descargar el PDF.
// =========================================================

async function cargarMisBoletos() {
  const contenedor = document.getElementById("boletos-lista");
  if (!contenedor) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html?redirect=mis-boletos.html";
    return;
  }

  contenedor.innerHTML = `<p style="color:var(--text-secondary);">Cargando tus boletos...</p>`;

  const { data: ordenes, error } = await supabaseClient
    .from("orders")
    .select("*, events(title, date_label, location, image_url)")
    .order("created_at", { ascending: false });

  if (error) {
    contenedor.innerHTML = `<p style="color:#ff8a94;">No se pudieron cargar tus boletos: ${error.message}</p>`;
    return;
  }

  if (!ordenes || ordenes.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--text-secondary);">Todavía no has comprado ningún boleto.</p>`;
    return;
  }

  contenedor.innerHTML = "";

  for (const orden of ordenes) {
    const evento = orden.events || {};
    const tarjeta = document.createElement("article");
    tarjeta.className = "boleto-card";
    tarjeta.innerHTML = `
      <img src="${evento.image_url || ""}" alt="${evento.title || ""}" />
      <div class="boleto-card-content">
        <h3>${evento.title || "Evento"}</h3>
        <p style="color:var(--text-secondary);">${evento.date_label || ""} · ${evento.location || ""}</p>
        <p><strong>Tipo:</strong> ${orden.ticket_type === "vip" ? "VIP" : "General"} · <strong>Cantidad:</strong> ${orden.quantity}</p>
        <p><strong>Total:</strong> $${Number(orden.total).toFixed(2)} · <strong>Estado:</strong> ${orden.status}</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">Código: ${orden.ticket_code}</p>
        <div class="boleto-qr" data-code="${orden.ticket_code}"></div>
        <button class="btn-secondary" type="button" data-order-id="${orden.id}">Descargar recibo (PDF)</button>
      </div>
    `;
    contenedor.appendChild(tarjeta);

    const contenidoQr = JSON.stringify({
      app: "Ticketspot",
      codigo: orden.ticket_code,
      evento: evento.title,
      tipo: orden.ticket_type,
      cantidad: orden.quantity,
      comprador: orden.buyer_name,
    });
    const qrDataUrl = await QRCode.toDataURL(contenidoQr, { width: 160, margin: 1 });
    const qrDiv = tarjeta.querySelector(".boleto-qr");
    qrDiv.innerHTML = `<img src="${qrDataUrl}" alt="QR" style="width:140px;height:140px;border-radius:12px;" />`;

    const boton = tarjeta.querySelector("button[data-order-id]");
    boton.addEventListener("click", () => regenerarPdf(orden, evento, qrDataUrl));
  }
}

function regenerarPdf(orden, evento, qrDataUrl) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(20);
  doc.text("Ticketspot — Recibo de compra", 40, 50);

  doc.setDrawColor(220);
  doc.line(40, 70, 555, 70);

  const filas = [
    ["Evento", evento.title || ""],
    ["Fecha", evento.date_label || ""],
    ["Lugar", evento.location || ""],
    ["Comprador", orden.buyer_name],
    ["Correo", orden.buyer_email],
    ["Tipo de boleto", orden.ticket_type === "vip" ? "VIP" : "General"],
    ["Cantidad", String(orden.quantity)],
    ["Total pagado", `$${Number(orden.total).toFixed(2)}`],
    ["Código de boleto", orden.ticket_code],
    ["Fecha de compra", new Date(orden.created_at).toLocaleString("es-PA")],
  ];

  doc.setFontSize(13);
  let y = 100;
  filas.forEach(([etiqueta, valor]) => {
    doc.setFont(undefined, "bold");
    doc.text(etiqueta + ":", 40, y);
    doc.setFont(undefined, "normal");
    doc.text(String(valor), 190, y);
    y += 22;
  });

  doc.addImage(qrDataUrl, "PNG", 400, 90, 150, 150);
  doc.save(`recibo-${orden.ticket_code}.pdf`);
}

document.addEventListener("DOMContentLoaded", cargarMisBoletos);
