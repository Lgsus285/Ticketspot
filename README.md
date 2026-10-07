# Ticketspot — Proyecto final

Plataforma de venta de boletos conectada a **Supabase** (base de datos +
autenticación), con pago simulado, generación de código **QR**, recibo en
**PDF** y envío del recibo **por correo** (usando una Edge Function de
Supabase + Resend).

> **Nota sobre el nombre:** tus archivos originales mezclaban "Spoticket" y
> "Ticketspot" en distintas páginas. Dejé todo unificado como **Ticketspot**
> (el nombre de tu carpeta/zip). Si prefieres el otro nombre, es un
> buscar-y-reemplazar rápido en los `.html`.

---

## 1. Qué tenía tu proyecto y qué se arregló/agregó

| Antes | Ahora |
|---|---|
| `eventos.html` estaba completamente vacío | Catálogo completo cargado dinámicamente desde Supabase |
| `login.html` tenía el HTML roto (`<head>` sin `<body>`, doble `<body>`, sin formulario) | Login y registro reales con **Supabase Auth**, HTML corregido |
| `detalle.html` tenía divs sin cerrar y sin JS que lo conectara | HTML corregido + conectado a Supabase + selección de boleto y cantidad funcionando |
| No existía ninguna carpeta `js/` (los `<script>` apuntaban a archivos que no existían) | Carpeta `js/` completa con toda la lógica |
| No existía pago | `checkout.html` con formulario de tarjeta (validado con el algoritmo de Luhn), 100% simulado |
| No existía recibo | PDF generado en el navegador (jsPDF) con los datos de la compra y un **QR** |
| No existía envío de correo | Edge Function `send-receipt` que envía el recibo por correo con Resend |
| No existía historial de compras | `mis-boletos.html` con todas las compras del usuario logueado |
| Bug en `style.css`: faltaba una coma y `.login-card` nunca recibía estilo | Corregido |

Tus 3 eventos originales (500 KM Panamá, Concierto Estelar, Teatro Clásico)
y tus imágenes locales de `/imagenes` se mantuvieron tal cual.

---

## 2. Crear tu proyecto de Supabase

1. Entra a **https://supabase.com** y crea una cuenta (gratis).
2. Crea un **New project** (elige una contraseña de base de datos y guárdala).
3. Espera a que termine de aprovisionarse (1-2 minutos).
4. Ve a **SQL Editor > New query**, pega todo el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   Esto crea las tablas `events` y `orders`, activa la seguridad a nivel de
   fila (RLS) y siembra tus 3 eventos.
5. Ve a **Authentication > Providers > Email** y, para que las pruebas sean
   más rápidas, **desactiva "Confirm email"** (así el registro deja al
   usuario logueado de inmediato). Si lo dejas activado, el registro
   funciona igual, solo que el usuario debe confirmar su correo primero.
6. Ve a **Settings > API** y copia:
   - **Project URL**
   - **anon public key**

---

## 3. Conectar el front-end a tu proyecto

Abre `js/config.js` y reemplaza los valores:

```js
window.SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
window.SUPABASE_ANON_KEY = "TU-LLAVE-ANON-PUBLICA";
```

### Probarlo localmente

No abras los archivos con doble clic (`file://`). Usa un servidor local:

```bash
cd Ticketspot
npx serve .
# o
python3 -m http.server 5500
```

Y entra a `http://localhost:5500/html/index.html` (o el puerto indicado).

---

## 4. Cómo funciona el flujo de compra

1. **`index.html` / `eventos.html`** — traen los eventos de la tabla
   `events` y pintan las tarjetas (la portada solo muestra los primeros 3).
2. **`detalle.html?event=slug`** — trae el evento por su `slug`, deja elegir
   tipo de boleto (General/VIP) y cantidad. Al presionar **"Confirmar
   compra"**, si no hay sesión te manda a `login.html` y te regresa
   automáticamente después.
3. **`checkout.html`** — resumen del pedido (el precio se vuelve a leer de
   la base de datos, nunca se confía en la URL) y formulario de tarjeta:
   - Validado con el **algoritmo de Luhn**, fecha de expiración y CVV.
   - **No se conecta a ningún banco.** Se simula ~1.4s de "procesamiento" y
     se marca como pagado.
   - Se inserta la orden en `orders` (protegida por RLS).
   - Se genera el **QR** (librería `qrcode`) y el **PDF** (librería
     `jsPDF`) con los datos de la compra.
   - Se llama a la Edge Function `send-receipt` para enviar el recibo por
     correo.
4. **`mis-boletos.html`** — historial de compras del usuario, con QR y PDF
   descargables de nuevo en cualquier momento.

---

## 5. Configurar el envío de correo (Edge Function + Resend)

### 5.1. Crear cuenta en Resend

1. Entra a **https://resend.com**, crea una cuenta gratis (100 correos/día).
2. Ve a **API Keys** y crea una nueva llave (`re_xxxxxxxxx`).
3. **Importante:** mientras no verifiques tu propio dominio en Resend, solo
   podrás enviar correos **a la misma dirección con la que te registraste**
   usando el remitente de pruebas `onboarding@resend.dev`. Para probar el
   flujo completo, usa tu propio correo como "comprador" en el checkout.

### 5.2. Instalar la CLI de Supabase y desplegar la función

```bash
npm install -g supabase
supabase login
cd Ticketspot
supabase link --project-ref TU_PROJECT_REF   # está en Settings > General
supabase functions deploy send-receipt
```

### 5.3. Configurar los secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set FROM_EMAIL="Ticketspot <onboarding@resend.dev>"
```

### Alternativa sin terminal

En tu proyecto de Supabase: **Edge Functions > Create a new function**,
llámala `send-receipt`, pega el contenido de
`supabase/functions/send-receipt/index.ts`, y agrega los secrets desde
**Edge Functions > Manage secrets**.

---

## 6. Estructura del proyecto

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

---

## 7. Qué ya se probó (para que confíes en que funciona)

- El `schema.sql` se ejecutó contra un PostgreSQL real, sin errores.
- Se simularon dos usuarios y se confirmó que cada uno **solo ve sus
  propias órdenes** (RLS funcionando).
- Se confirmó que los 3 eventos quedan con el mismo `slug` que ya usaban
  los enlaces de tu `index.html` original (`festival-urban-beats`,
  `concierto-estelar`, `obra-teatro-vip`), y que las 4 imágenes que
  referencian los HTML existen en tu carpeta `/imagenes`.
- El algoritmo de Luhn se probó con números de tarjeta de prueba reales e
  inválidos.
- Todos los `.js` se verificaron sin errores de sintaxis, y los 6 HTML
  tienen las etiquetas balanceadas (se corrigieron los divs sin cerrar de
  tu `detalle.html` original y la estructura rota de `login.html`).

Lo único que no se puede probar desde aquí es la llamada real a
Supabase/Resend, porque requiere tu propio proyecto y tus propias llaves.
