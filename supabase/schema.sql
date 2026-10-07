-- =========================================================
-- Ticketspot — esquema de base de datos para Supabase
-- =========================================================
-- Cómo usarlo:
--   1. Entra a tu proyecto en https://supabase.com/dashboard
--   2. Ve a "SQL Editor" > "New query"
--   3. Pega todo este archivo y dale "Run"
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Tabla: events (catálogo de eventos)
-- ---------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  heading text,
  description text,
  summary text,
  image_url text,
  location text,
  event_date date,
  date_label text,
  entry_info text,
  general_price numeric(10,2) not null default 0,
  vip_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: orders (compras / boletos ya pagados)
-- ---------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id),
  ticket_type text not null check (ticket_type in ('general', 'vip')),
  quantity int not null default 1 check (quantity > 0 and quantity <= 10),
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  buyer_name text not null,
  buyer_email text not null,
  ticket_code text unique not null,
  status text not null default 'pagado',
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_event_id_idx on public.orders (event_id);

-- ---------------------------------------------------------
-- Seguridad a nivel de fila (Row Level Security)
-- ---------------------------------------------------------
alter table public.events enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Eventos visibles para todos" on public.events;
create policy "Eventos visibles para todos"
  on public.events
  for select
  using (true);

drop policy if exists "Los usuarios ven sus propias compras" on public.orders;
create policy "Los usuarios ven sus propias compras"
  on public.orders
  for select
  using (auth.uid() = user_id);

drop policy if exists "Los usuarios crean sus propias compras" on public.orders;
create policy "Los usuarios crean sus propias compras"
  on public.orders
  for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Datos de ejemplo — tus 3 eventos reales, con las rutas a las
-- imágenes que ya tienes en la carpeta /imagenes del proyecto.
-- Los slugs son los mismos que ya usabas en los enlaces de index.html.
-- ---------------------------------------------------------
insert into public.events
  (slug, title, heading, description, summary, image_url, location, event_date, date_label, entry_info, general_price, vip_price)
values
  ('festival-urban-beats', '500 KM Panamá', '500 KM Panamá: una carrera para toda la ciudad',
   'Una jornada deportiva sin pausa con corredores invitados.',
   'Participa o anima en una de las carreras más grandes del país, con rutas por los puntos más icónicos de la ciudad.',
   '../imagenes/500KMJUNIO.jpg',
   'Ciudad de Panamá', '2026-06-14', '14 de junio, 2026',
   'Inscripción general y paquete VIP con zona de hidratación exclusiva', 45.00, 90.00),

  ('concierto-estelar', 'Concierto Estelar', 'Concierto Estelar: una noche con todos sus éxitos — by Farruko',
   'Vive una jornada llena de éxitos y energía en vivo con el Concierto Estelar, donde los artistas más populares del momento se reúnen para ofrecer un espectáculo inolvidable.',
   'Desde baladas emotivas hasta ritmos contagiosos, este evento promete una experiencia musical única que hará vibrar a todos los asistentes.',
   '../imagenes/estelar_ESTELAR.jpg',
   'Arena Central, Ciudad de Panamá', '2026-05-24', '24 de mayo, 2026',
   'Disfruta de asientos cercanos o áreas VIP exclusivas', 60.00, 120.00),

  ('obra-teatro-vip', 'Teatro Clásico', 'Teatro Clásico: una obra maestra del teatro',
   'Una obra maestra del teatro con actuaciones excepcionales.',
   'Disfruta de una producción exclusiva con una puesta en escena moderna y elegante, interpretada por un elenco de primer nivel.',
   '../imagenes/PACHFLORESQ.jpg',
   'Teatro Municipal, Ciudad de Panamá', '2026-06-02', '2 de junio, 2026',
   'Localidades numeradas y zonas VIP disponibles', 30.00, 70.00)
on conflict (slug) do nothing;
