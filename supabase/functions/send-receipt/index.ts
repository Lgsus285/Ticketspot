// =========================================================
// Edge Function: send-receipt
// Recibe los datos de una compra y envía un correo con el
// recibo (usando la API de Resend), incluyendo el QR en el
// cuerpo del correo y el PDF como adjunto.
//
// Variables de entorno necesarias (se configuran como
// "secrets" del proyecto de Supabase, NO en el código):
//   RESEND_API_KEY  -> tu llave de la API de Resend
//   FROM_EMAIL      -> remitente, ej: "Ticketspot <onboarding@resend.dev>"
// =========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      to,
      buyer_name,
      event_title,
      ticket_type,
      quantity,
      total,
      ticket_code,
      qr_data_url,
      pdf_base64,
    } = body;

    if (!to || !ticket_code || !event_title) {
      return new Response(
        JSON.stringify({ error: "Faltan datos del pedido para enviar el recibo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Ticketspot <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "RESEND_API_KEY no está configurada como secret en el proyecto de Supabase.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = `
      <div style="font-family: Arial, sans-serif; color:#111; max-width: 480px;">
        <h2 style="margin-bottom:4px;">¡Gracias por tu compra${buyer_name ? ", " + buyer_name : ""}!</h2>
        <p style="color:#555;">Este es el recibo de tu compra en <strong>Ticketspot</strong>.</p>
        <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Evento</td><td><strong>${event_title}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Tipo de boleto</td><td>${ticket_type}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Cantidad</td><td>${quantity}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Total</td><td><strong>$${total}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#555;">Código de boleto</td><td>${ticket_code}</td></tr>
        </table>
        <p>Presenta este código QR en la entrada del evento (también viene adjunto en el PDF):</p>
        ${qr_data_url ? `<img src="${qr_data_url}" alt="Código QR" width="160" height="160" style="border-radius:12px;" />` : ""}
        <p style="color:#999; font-size: 12px; margin-top: 24px;">
          Este correo fue generado por un proyecto académico. El pago fue simulado
          y no representa un cargo real.
        </p>
      </div>
    `;

    const attachments = [];
    if (pdf_base64) {
      attachments.push({
        filename: `recibo-${ticket_code}.pdf`,
        content: pdf_base64,
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Tu recibo de Ticketspot — ${event_title}`,
        html,
        attachments,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ error: resendResult }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: resendResult.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
