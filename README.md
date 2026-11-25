# Ticketspot — Proyecto final

Venta de boletos con **Supabase** (base de datos + login), selección de asientos en mapa,
pago simulado, **QR**, recibo en **PDF** y envío del recibo **por correo**.

<<<<<<< HEAD
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
=======
## Qué incluye
- **Diseño sobrio**: fondo claro, un solo color de acento, sin degradados ni efectos de brillo.
- **Catálogo** con filtro por categoría y buscador, y banner del evento destacado.
- **Mapa de asientos** para eventos con asiento numerado: teatro (platea con pasillos) y arena
  (pista VIP + gradas alrededor del escenario). Los asientos vendidos se bloquean; máximo 8 por compra.
- **Eventos sin asiento** (carreras, festivales): se elige tipo (General/VIP) y cantidad.
- **Pago simulado** (tarjeta validada con Luhn; no se cobra nada real).
- **Boleto con QR** y recibo en PDF (con los asientos), historial en "Mis boletos".
- **Correo con el recibo** mediante una Edge Function (Brevo gratis o Resend).

## Seguridad de la compra
- El **precio lo calcula la base de datos** (función `crear_compra`); el navegador no puede mandar un total falso.
- Un asiento **no se puede vender dos veces**: la tabla `order_seats` tiene una restricción única por (evento, asiento),
  y la compra y sus asientos se guardan en una sola transacción (si uno falla, no se guarda nada).
- Ya no se puede insertar compras directamente desde el navegador; solo con la función.

## Instalación

### 1. Base de datos (un solo archivo)
En Supabase: **SQL Editor > New query**, pega TODO `supabase/schema.sql` y dale **Run**.
Sirve para una base nueva y para **actualizar la que ya tienes** (no borra tus compras ni tus eventos propios).
Es seguro correrlo más de una vez. Restaura los 11 eventos de ejemplo.

> Hazlo **antes** de usar los archivos nuevos: sin este paso, el pago mostrará un aviso pidiendo correr `schema.sql`.

### 2. Conectar el sitio
`js/config.js`: pon tu `SUPABASE_URL` (sin `/rest/v1/` al final) y tu llave `anon`/publishable.

### 3. Probar en local
Abre `html/index.html` con la extensión **Live Server** de VS Code. Flujo: Eventos > un evento > asientos
(o cantidad) > Pago (`4242 4242 4242 4242`, `12/28`, CVV `123`) > QR y PDF.

### 4. Correo con el recibo (opcional hasta que lo configuremos)
Ver sección **Correo** abajo.

## Eventos
Cada evento tiene `layout`: `general` (sin asientos), `teatro` o `arena`; y `category`, `featured`, `image_position`.
Para agregar uno: **Table Editor > events > Insert row** (la imagen va en la carpeta `imagenes/`, `image_url` = `../imagenes/archivo.jpg`).
Si el layout es `teatro` o `arena`, el mapa se genera solo.

**Sobre las imágenes:** los afiches de 500 KM, Pacho Flores, Manda la Plena Moh, El Público y Arcángel son los tuyos
(de otros organizadores; sirven para la demo del curso, no para publicar). Los 6 restantes son afiches tipográficos
generados; reemplázalos por fotos reales con el mismo nombre de archivo. Los afiches reales traen su propia fecha
impresa (2026); en el sitio los eventos usan fechas de 2027.

## Correo (Edge Function `send-receipt`)
La función verifica que la compra sea del usuario con sesión y envía el recibo (QR + PDF) al correo de esa compra.
Elige un servicio y guarda su llave como *secret* en Supabase (**nunca** dentro de archivos del proyecto):

- **Brevo** (gratis, envía a cualquiera, 300/día): `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (correo verificado en Brevo > Senders), `BREVO_SENDER_NAME` (opcional).
  En la API Key de Brevo: acceso **Restringido** y **Emails transaccionales = Todos** (con "Leer" no puede enviar).
- **Resend** (sin dominio propio solo envía a tu correo): `RESEND_API_KEY`, `FROM_EMAIL`.

### Opción A — desde el panel de Supabase (sin terminal, recomendada)
1. **Edge Functions > Secrets**: agrega cada secret con su valor.
2. **Edge Functions > Functions > Deploy a new function > Via Editor**.
3. Ponle de nombre exactamente `send-receipt`, borra el código de ejemplo, pega el contenido de
   `supabase/functions/send-receipt/index.ts` y pulsa **Deploy**.
Los cambios de secrets se aplican al instante; no hace falta volver a desplegar.

### Opción B — con la terminal (requiere Node 20 o más nuevo)
`npm install -g supabase` **ya no es compatible**. Usa `npx`, desde la carpeta del proyecto (la que contiene `supabase/`):
```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF     # lo ves en la URL de tu proyecto; pide la contraseña de la base
npx supabase secrets set BREVO_API_KEY=tu_clave BREVO_SENDER_EMAIL=tu_correo@gmail.com BREVO_SENDER_NAME=Ticketspot
npx supabase functions deploy send-receipt
```

### Probar
Compra un boleto: el checkout debe decir "Recibo enviado a ...". Si falla, muestra el motivo real. Revisa también Spam.

## Estructura
```
(raíz)  index.html, eventos.html, detalle.html, asientos.html, checkout.html, mis-boletos.html, login.html, style.css
js/    common.js (utilidades) · layouts.js (mapas) · asientos.js · checkout.js · ...
       qrcode.min.js y jspdf.umd.min.js incluidos (no dependen de internet)
supabase/schema.sql · supabase/functions/send-receipt/index.ts
```

## Nombre de la función de correo
El sitio llama por defecto a la función `super-action` (como quedó creada en el panel de Supabase). Si la tuya se llama
distinto, agrega en `js/config.js`: `window.EMAIL_FUNCTION_NAME = "nombre-de-tu-funcion";`

## Publicar en Render (sitio estático)
Publish Directory: `.` · Build Command: vacío · las páginas están en la raíz, así que `/eventos.html` funciona directo.

## Pruebas realizadas
- `schema.sql` en PostgreSQL real: instalación nueva, segunda corrida, y actualización de una base antigua con compras previas.
- Función `crear_compra` en PostgreSQL real: asiento repetido (no deja compra a medias), precio decidido por el servidor,
  formato inválido/inyección, asientos de otro recinto, más de 8, repetidos, cantidad fuera de rango, inserciones directas
  bloqueadas, sin sesión, y que cada usuario solo vea sus compras.
- Las páginas en un navegador simulado (110 pruebas): catálogo y filtros, 11 detalles, mapas, selección y bloqueo de asientos,
  asiento comprado por otra persona mientras miras el mapa, login/registro, checkout, QR, PDF, historial y menú.
- Los mapas se cruzaron contra la base: mismo VIP/General por sección que `layout_sections`.
- Edge Function (25 pruebas con Brevo/Resend simulados).
>>>>>>> a2d702e (Implementacion del panel administrativo)
