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
// Secrets que debes configurar en Supabase (NO van en el código):
//   RESEND_API_KEY  -> tu llave de la API de Resend
//   FROM_EMAIL      -> remitente, ej: "Ticketspot <onboarding@resend.dev>"
// (SUPABASE_URL y SUPABASE_ANON_KEY ya existen automáticamente.)
// =========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY no está configurada como secret en Supabase." }, 500);
    }

    // 1) Buscar la compra con el token del usuario (RLS: solo ve las suyas)
    const select = "buyer_email,buyer_name,ticket_type,quantity,total,ticket_code,events(title,date_label,location)";
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

    // 2) Adjuntos: QR dentro del correo (CID) + PDF
    const attachments: Record<string, string>[] = [];
    let qrHtml = "";
    const qrMatch = /^data:image\/png;base64,(.+)$/.exec(qr_data_url ?? "");
    if (qrMatch) {
      attachments.push({
        filename: "qr-boleto.png",
        content: qrMatch[1],
        content_type: "image/png",
        content_id: "qr-boleto",
      });
      qrHtml = `<img src="cid:qr-boleto" alt="Código QR" width="180" height="180" style="border-radius:12px;" />`;
    }
    if (pdf_base64) {
      attachments.push({
        filename: `recibo-${o.ticket_code}.pdf`,
        content: pdf_base64,
        content_type: "application/pdf",
      });
    }

    const tipo = o.ticket_type === "vip" ? "VIP" : "General";
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

    // 3) Enviar con Resend (siempre al correo registrado en la compra)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [o.buyer_email],
        subject: `Tu recibo de Ticketspot — ${ev.title ?? "compra"}`,
        html,
        attachments,
      }),
    });
    const resendResult = await resendResponse.json();
    if (!resendResponse.ok) return json({ error: resendResult }, 502);

    return json({ ok: true, id: resendResult.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
