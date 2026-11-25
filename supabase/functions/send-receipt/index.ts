// =========================================================
// Edge Function: send-receipt
// Envía por correo el recibo de una compra (con el QR dentro del
// correo y el PDF adjunto) usando la API de Resend.
//
// Seguridad: la función NO confía en los datos que manda el navegador.
// Con el token del usuario que hizo la petición, consulta la compra en la
// base de datos (las reglas RLS solo dejan ver compras propias) y el correo
// se envía al comprador registrado en esa compra.
//
// Servicio de correo (elige UNO; los secrets NO van en el código):
//
//  A) Brevo  -> GRATIS, 300 correos/día, envía a CUALQUIER persona con solo
//               verificar tu correo remitente (no necesitas dominio propio).
//       BREVO_API_KEY       -> tu llave de API de Brevo (empieza con xkeysib-)
//       BREVO_SENDER_EMAIL  -> correo remitente ya verificado en Brevo
//       BREVO_SENDER_NAME   -> (opcional) nombre, por defecto "Ticketspot"
//
//  B) Resend -> sin dominio propio solo puede enviar a tu propio correo.
//       RESEND_API_KEY, FROM_EMAIL
//
// Si existen las variables de Brevo se usa Brevo; si no, Resend.
// (SUPABASE_URL y SUPABASE_ANON_KEY ya existen automáticamente.)
// =========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// En la petición previa (OPTIONS) el navegador lista las cabeceras que quiere enviar.
// Las aceptamos tal cual, así funciona con cualquier versión del cliente de Supabase
// (las versiones nuevas agregan cabeceras que una lista fija dejaría fuera).
const corsPreflight = (req: Request) => ({
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") ?? corsHeaders["Access-Control-Allow-Headers"],
  "Access-Control-Max-Age": "86400",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SECCIONES: Record<string, string> = {
  "VIP-IZQ": "VIP izquierda", "VIP-CEN": "VIP centro", "VIP-DER": "VIP derecha",
  "PLA-IZQ": "Platea izquierda", "PLA-CEN": "Platea centro", "PLA-DER": "Platea derecha",
  PISTA: "Pista VIP", "LAT-IZQ": "Lateral izquierdo", "LAT-DER": "Lateral derecho",
  "FON-IZQ": "Fondo izquierdo", "FON-CEN": "Fondo centro", "FON-DER": "Fondo derecho",
};
const etiquetaAsiento = (id: string) => {
  const [sec, fila, num] = String(id).split("|");
  return `${SECCIONES[sec] ?? sec} · Fila ${fila} · Asiento ${num}`;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsPreflight(req) });
  }

  try {
    const { ticket_code, qr_data_url, pdf_base64 } = await req.json();
    if (!ticket_code) return json({ error: "Falta el código del boleto." }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Debes iniciar sesión." }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Ticketspot <onboarding@resend.dev>";
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL");
    const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") ?? "Ticketspot";
    const usarBrevo = !!(BREVO_API_KEY && BREVO_SENDER_EMAIL);

    if (!usarBrevo && !RESEND_API_KEY) {
      return json({
        error:
          "Falta configurar el servicio de correo: BREVO_API_KEY + BREVO_SENDER_EMAIL (gratis, envía a cualquiera) o RESEND_API_KEY.",
      }, 500);
    }

    // 1) Buscar la compra con el token del usuario (RLS: solo ve las suyas)
    const select = "buyer_email,buyer_name,ticket_type,quantity,total,ticket_code,events(title,date_label,location),order_seats(seat_id)";
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?ticket_code=eq.${encodeURIComponent(ticket_code)}&select=${select}`,
      { headers: { apikey: SUPABASE_ANON_KEY ?? "", Authorization: authHeader } }
    );
    const orders = orderRes.ok ? await orderRes.json() : [];
    if (!Array.isArray(orders) || orders.length === 0) {
      return json({ error: "No se encontró esa compra para tu usuario." }, 403);
    }
    const o = orders[0];
    const ev = o.events ?? {};

    // 2) Adjuntos. Resend permite el QR "inline" (cid); Brevo lo recibe como archivo adjunto.
    const attachments: Record<string, string>[] = [];
    let qrHtml = "";
    const qrMatch = /^data:image\/png;base64,(.+)$/.exec(qr_data_url ?? "");
    if (qrMatch) {
      if (usarBrevo) {
        attachments.push({ name: "qr-boleto.png", content: qrMatch[1] });
        qrHtml = `<p><strong>Tu código QR va adjunto en este correo (qr-boleto.png) y también dentro del PDF.</strong></p>`;
      } else {
        attachments.push({
          filename: "qr-boleto.png",
          content: qrMatch[1],
          content_type: "image/png",
          content_id: "qr-boleto",
        });
        qrHtml = `<img src="cid:qr-boleto" alt="Código QR" width="180" height="180" style="border-radius:12px;" />`;
      }
    }
    if (pdf_base64) {
      attachments.push(
        usarBrevo
          ? { name: `recibo-${o.ticket_code}.pdf`, content: pdf_base64 }
          : { filename: `recibo-${o.ticket_code}.pdf`, content: pdf_base64, content_type: "application/pdf" }
      );
    }

    const tipo = ({ vip: "VIP", general: "General", mixto: "VIP y General" } as Record<string, string>)[o.ticket_type] ?? o.ticket_type;
    const asientos: string[] = (o.order_seats ?? []).map((s: { seat_id: string }) => etiquetaAsiento(s.seat_id));
    const filaAsientos = asientos.length
      ? `<tr><td style="padding:4px 12px 4px 0; color:#555; vertical-align:top;">Asientos</td><td>${asientos.map(esc).join("<br>")}</td></tr>`
      : "";
    const html = `
      <div style="font-family: Arial, sans-serif; color:#111; max-width: 480px;">
        <h2 style="margin-bottom:4px;">¡Gracias por tu compra${o.buyer_name ? ", " + esc(o.buyer_name) : ""}!</h2>
        <p style="color:#555;">Este es el recibo de tu compra en <strong>Ticketspot</strong>.</p>
        <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Evento</td><td><strong>${esc(ev.title)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Fecha</td><td>${esc(ev.date_label)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Lugar</td><td>${esc(ev.location)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Tipo de boleto</td><td>${tipo}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Cantidad</td><td>${esc(o.quantity)}</td></tr>
          ${filaAsientos}
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Total</td><td><strong>$${Number(o.total).toFixed(2)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Código de boleto</td><td>${esc(o.ticket_code)}</td></tr>
        </table>
        <p>Presenta este código QR en la entrada del evento (también va en el PDF adjunto):</p>
        ${qrHtml}
        <p style="color:#999; font-size: 12px; margin-top: 24px;">
          Correo generado por un proyecto académico. El pago fue simulado y no representa un cargo real.
        </p>
      </div>
    `;

    // 3) Enviar (siempre al correo registrado en la compra)
    const asunto = `Tu recibo de Ticketspot — ${ev.title ?? "compra"}`;

    if (usarBrevo) {
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: o.buyer_email, name: o.buyer_name || undefined }],
          subject: asunto,
          htmlContent: html,
          attachment: attachments,
        }),
      });
      const brevoResult = await brevoRes.json().catch(() => ({}));
      if (!brevoRes.ok) return json({ error: brevoResult }, 502);
      return json({ ok: true, proveedor: "brevo", id: brevoResult.messageId });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [o.buyer_email], subject: asunto, html, attachments }),
    });
    const resendResult = await resendResponse.json();
    if (!resendResponse.ok) return json({ error: resendResult }, 502);
    return json({ ok: true, proveedor: "resend", id: resendResult.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
