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
   'Ciudad de Panamá', '2027-06-14', '14 de junio, 2027',
   'Inscripción general y paquete VIP con zona de hidratación exclusiva', 45.00, 90.00),

  ('concierto-estelar', 'Concierto Estelar', 'Concierto Estelar: una noche con todos sus éxitos — by Farruko',
   'Vive una jornada llena de éxitos y energía en vivo con el Concierto Estelar, donde los artistas más populares del momento se reúnen para ofrecer un espectáculo inolvidable.',
   'Desde baladas emotivas hasta ritmos contagiosos, este evento promete una experiencia musical única que hará vibrar a todos los asistentes.',
   '../imagenes/estelar_ESTELAR.jpg',
   'Arena Central, Ciudad de Panamá', '2027-05-24', '24 de mayo, 2027',
   'Disfruta de asientos cercanos o áreas VIP exclusivas', 60.00, 120.00),

  ('obra-teatro-vip', 'Teatro Clásico', 'Teatro Clásico: una obra maestra del teatro',
   'Una obra maestra del teatro con actuaciones excepcionales.',
   'Disfruta de una producción exclusiva con una puesta en escena moderna y elegante, interpretada por un elenco de primer nivel.',
   '../imagenes/PACHFLORESQ.jpg',
   'Teatro Municipal, Ciudad de Panamá', '2027-06-02', '2 de junio, 2027',
   'Localidades numeradas y zonas VIP disponibles', 30.00, 70.00),

  ('jazz-casco-viejo', 'Noche de Jazz', 'Noche de Jazz: música en vivo en el Casco Viejo',
   'Una velada íntima de jazz con músicos locales e invitados.',
   'Disfruta de una noche de jazz y blues en el corazón del Casco Viejo, con ambiente acogedor y buena música.',
   '../imagenes/jazz-casco-viejo.jpg',
   'Casco Viejo, Ciudad de Panamá', '2026-12-05', '5 de diciembre, 2026',
   'Mesas numeradas y zona VIP frente al escenario', 35.00, 80.00),

  ('salsa-panama', 'Gran Noche de Salsa', 'Gran Noche de Salsa: orquestas en vivo',
   'Las mejores orquestas de salsa para bailar toda la noche.',
   'Una pista de baile enorme, orquestas en vivo y shows de baile profesional. Ven con tu pareja o con tus amigos.',
   '../imagenes/salsa-panama.jpg',
   'Centro de Convenciones, Ciudad de Panamá', '2026-12-19', '19 de diciembre, 2026',
   'Entrada general de pie y mesas VIP con servicio', 30.00, 75.00),

  ('fin-de-ano-2026', 'Fiesta de Fin de Año', 'Fiesta de Fin de Año: recibe el 2027 en grande',
   'La fiesta más grande para despedir el año con música y cuenta regresiva.',
   'DJs, música en vivo, fuegos artificiales y brindis de medianoche para recibir el año nuevo.',
   '../imagenes/fin-de-ano.jpg',
   'Salón de Eventos Central, Ciudad de Panamá', '2026-12-31', '31 de diciembre, 2026',
   'Entrada general con brindis y paquete VIP con cena', 55.00, 140.00),

  ('stand-up-comedy', 'Stand-Up Comedy', 'Stand-Up Comedy: una noche para reír',
   'Los comediantes más divertidos del país en un solo escenario.',
   'Una noche de humor con un elenco de comediantes nacionales. Ideal para ir en grupo.',
   '../imagenes/stand-up-comedy.jpg',
   'Teatro Municipal, Ciudad de Panamá', '2027-01-09', '9 de enero, 2027',
   'Butacas generales y primera fila VIP', 20.00, 45.00),

  ('panama-sabe', 'Panamá Sabe', 'Panamá Sabe: festival gastronómico',
   'Un festival con lo mejor de la cocina panameña e internacional.',
   'Más de 40 puestos de comida, chefs invitados, cocteles y música en vivo durante todo el día.',
   '../imagenes/panama-sabe.jpg',
   'Parque Urracá, Ciudad de Panamá', '2027-01-23', '23 de enero, 2027',
   'Entrada general con 5 degustaciones y pase VIP con barra libre de cocteles', 25.00, 70.00),

  ('tech-summit-2027', 'Panamá Tech Summit', 'Panamá Tech Summit: tecnología e innovación',
   'Conferencias, talleres y networking con líderes de tecnología.',
   'Un día completo de charlas sobre inteligencia artificial, startups y desarrollo de software, con espacio para hacer contactos.',
   '../imagenes/tech-summit.jpg',
   'Centro de Convenciones, Ciudad de Panamá', '2027-03-12', '12 de marzo, 2027',
   'Pase general a las charlas y pase VIP con talleres y almuerzo', 40.00, 110.00)
on conflict (slug) do nothing;
