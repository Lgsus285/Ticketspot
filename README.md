# Ticketspot — Proyecto final

Plataforma de venta de boletos conectada a **Supabase** (base de datos +
autenticación), con pago simulado, generación de código **QR**, recibo en
**PDF** y envío del recibo **por correo** (usando una Edge Function de
Supabase + Resend).

---

## Estructura del proyecto

```
Ticketspot/
├── html/
│   ├── index.html            -> portada con 3 eventos destacados
│   ├── eventos.html          -> catálogo completo (dinámico)
│   ├── detalle.html          -> detalle + selección de boleto
│   ├── login.html            -> login/registro con Supabase Auth
│   ├── checkout.html         -> pago simulado + recibo
│   └── mis-boletos.html      -> historial de compras
├── js/
│   ├── config.js              -> URL y llave de tu proyecto Supabase
│   ├── supabaseClient.js
│   ├── nav-auth.js
│   ├── index.js
│   ├── eventos.js
│   ├── detalle.js
│   ├── login.js
│   ├── checkout.js            -> validación de tarjeta, QR, PDF, correo
│   └── misboletos.js
├── imagenes/                  -> tus imágenes originales (sin tocar)
├── style.css
└── supabase/
    ├── schema.sql              -> tablas, RLS y tus 3 eventos
    └── functions/
        └── send-receipt/
            └── index.ts        -> Edge Function que envía el correo
```
