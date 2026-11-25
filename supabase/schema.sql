-- =========================================================
-- Ticketspot — base de datos completa (Supabase / PostgreSQL)
-- =========================================================
-- Cómo usarlo: SQL Editor > New query > pega TODO este archivo > Run.
-- Es seguro correrlo varias veces y sirve tanto para una base nueva
-- como para actualizar la que ya tienes (no borra tus compras).
-- OJO: restaura los eventos de ejemplo; si editaste a mano alguno de ellos,
-- vuelve a quedar como en este archivo. Los eventos que agregues tú con otro
-- "slug" no se tocan.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Eventos
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

-- Columnas nuevas (si la tabla ya existía)
alter table public.events add column if not exists category text not null default 'Eventos';
-- layout: 'general' (sin asientos), 'teatro' (platea numerada) o 'arena' (pista + gradas)
alter table public.events add column if not exists layout text not null default 'general';
alter table public.events add column if not exists image_position text not null default 'center';
alter table public.events add column if not exists featured boolean not null default false;

alter table public.events drop constraint if exists events_layout_check;
alter table public.events add constraint events_layout_check check (layout in ('general', 'teatro', 'arena'));

-- ---------------------------------------------------------
-- Compras
-- ---------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id),
  ticket_type text not null,
  quantity int not null default 1 check (quantity > 0 and quantity <= 10),
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  buyer_name text not null,
  buyer_email text not null,
  ticket_code text unique not null,
  status text not null default 'pagado',
  created_at timestamptz not null default now()
);

-- 'mixto' = compra con asientos VIP y generales a la vez
alter table public.orders drop constraint if exists orders_ticket_type_check;
alter table public.orders add constraint orders_ticket_type_check check (ticket_type in ('general', 'vip', 'mixto'));

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_event_id_idx on public.orders (event_id);

-- ---------------------------------------------------------
-- Asientos vendidos. La restricción UNIQUE (event_id, seat_id) es lo que
-- garantiza que dos personas NUNCA puedan comprar el mismo asiento.
-- ---------------------------------------------------------
create table if not exists public.order_seats (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_id uuid not null references public.events (id),
  section text not null,
  seat_id text not null,            -- formato SECCION|FILA|NUMERO, ej. PLA-CEN|B|5
  tier text not null check (tier in ('general', 'vip')),
  price numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (event_id, seat_id)
);
create index if not exists order_seats_order_idx on public.order_seats (order_id);

-- Qué sección es VIP o General en cada tipo de recinto (para calcular el precio en el servidor)
create table if not exists public.layout_sections (
  layout text not null,
  section text not null,
  tier text not null check (tier in ('general', 'vip')),
  primary key (layout, section)
);

insert into public.layout_sections (layout, section, tier) values
  ('teatro', 'VIP-IZQ', 'vip'), ('teatro', 'VIP-CEN', 'vip'), ('teatro', 'VIP-DER', 'vip'),
  ('teatro', 'PLA-IZQ', 'general'), ('teatro', 'PLA-CEN', 'general'), ('teatro', 'PLA-DER', 'general'),
  ('arena', 'PISTA', 'vip'),
  ('arena', 'LAT-IZQ', 'general'), ('arena', 'FON-IZQ', 'general'), ('arena', 'FON-CEN', 'general'),
  ('arena', 'FON-DER', 'general'), ('arena', 'LAT-DER', 'general')
on conflict (layout, section) do update set tier = excluded.tier;

-- ---------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_seats enable row level security;
alter table public.layout_sections enable row level security;

drop policy if exists "Eventos visibles para todos" on public.events;
create policy "Eventos visibles para todos" on public.events for select using (true);

drop policy if exists "Los usuarios ven sus propias compras" on public.orders;
create policy "Los usuarios ven sus propias compras" on public.orders for select using (auth.uid() = user_id);

-- Ya NO se puede insertar compras directamente desde el navegador: solo con la
-- función crear_compra (más abajo), que calcula el precio en el servidor.
drop policy if exists "Los usuarios crean sus propias compras" on public.orders;

-- Cualquiera puede ver qué asientos están ocupados (no incluye datos de personas)
drop policy if exists "Asientos ocupados visibles" on public.order_seats;
create policy "Asientos ocupados visibles" on public.order_seats for select using (true);

drop policy if exists "Secciones visibles" on public.layout_sections;
create policy "Secciones visibles" on public.layout_sections for select using (true);

-- ---------------------------------------------------------
-- Función de compra: valida todo y guarda compra + asientos en UNA transacción.
-- Si un asiento ya está vendido, no se guarda nada.
-- ---------------------------------------------------------
create or replace function public.crear_compra(
  p_event_id uuid,
  p_ticket_type text,     -- 'general' | 'vip' (solo eventos sin asientos)
  p_quantity int,         -- (solo eventos sin asientos)
  p_seats text[],         -- (solo eventos con asientos) ej. {'PLA-CEN|B|5','PLA-CEN|B|6'}
  p_buyer_name text,
  p_buyer_email text,
  p_ticket_code text
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events%rowtype;
  v_order public.orders%rowtype;
  v_seat text;
  v_section text;
  v_tier text;
  v_price numeric(10,2);
  v_total numeric(10,2) := 0;
  v_qty int;
  v_unit numeric(10,2);
  v_type text;
  v_tiers text[] := '{}';
  v_prices numeric(10,2)[] := '{}';
  v_sections text[] := '{}';
  v_idx int;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para comprar.';
  end if;
  if coalesce(trim(p_buyer_name), '') = '' or p_buyer_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'Nombre o correo del comprador no válido.';
  end if;
  if coalesce(p_ticket_code, '') = '' then
    raise exception 'Falta el código del boleto.';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'El evento no existe.';
  end if;

  if coalesce(array_length(p_seats, 1), 0) > 0 then
    -- ===== Evento con asientos =====
    if v_event.layout = 'general' then
      raise exception 'Este evento no tiene asientos numerados.';
    end if;
    v_qty := array_length(p_seats, 1);
    if v_qty > 8 then
      raise exception 'Puedes comprar máximo 8 asientos por compra.';
    end if;
    if (select count(distinct s) from unnest(p_seats) s) <> v_qty then
      raise exception 'Hay asientos repetidos en la compra.';
    end if;

    foreach v_seat in array p_seats loop
      if v_seat !~ '^[A-Z-]{3,8}\|[A-Z]{1,2}\|[0-9]{1,3}$' then
        raise exception 'Asiento no válido: %', v_seat;
      end if;
      v_section := split_part(v_seat, '|', 1);
      select tier into v_tier from public.layout_sections where layout = v_event.layout and section = v_section;
      if v_tier is null then
        raise exception 'Asiento no válido para este recinto: %', v_seat;
      end if;
      v_price := case when v_tier = 'vip' then v_event.vip_price else v_event.general_price end;
      v_total := v_total + v_price;
      v_tiers := v_tiers || v_tier;
      v_prices := v_prices || v_price;
      v_sections := v_sections || v_section;
    end loop;

    v_type := case
      when (select count(distinct t) from unnest(v_tiers) t) > 1 then 'mixto'
      else v_tiers[1]
    end;
    v_unit := round(v_total / v_qty, 2);
  else
    -- ===== Evento sin asientos: tipo y cantidad =====
    if v_event.layout <> 'general' then
      raise exception 'Debes elegir tus asientos para este evento.';
    end if;
    if p_ticket_type not in ('general', 'vip') then
      raise exception 'Tipo de boleto no válido.';
    end if;
    if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
      raise exception 'La cantidad debe estar entre 1 y 10.';
    end if;
    v_qty := p_quantity;
    v_type := p_ticket_type;
    v_unit := case when p_ticket_type = 'vip' then v_event.vip_price else v_event.general_price end;
    v_total := v_unit * v_qty;
  end if;

  insert into public.orders
    (user_id, event_id, ticket_type, quantity, unit_price, total, buyer_name, buyer_email, ticket_code, status)
  values
    (v_user, p_event_id, v_type, v_qty, v_unit, v_total, trim(p_buyer_name), trim(p_buyer_email), p_ticket_code, 'pagado')
  returning * into v_order;

  if coalesce(array_length(p_seats, 1), 0) > 0 then
    begin
      for v_idx in 1 .. array_length(p_seats, 1) loop
        insert into public.order_seats (order_id, event_id, section, seat_id, tier, price)
        values (v_order.id, p_event_id, v_sections[v_idx], p_seats[v_idx], v_tiers[v_idx], v_prices[v_idx]);
      end loop;
    exception when unique_violation then
      raise exception 'Uno o más asientos ya fueron vendidos. Elige otros asientos.';
    end;
  end if;

  return v_order;
end;
$$;

-- Permisos de lectura explícitos (Supabase suele darlos solo, pero así no dependemos de eso)
grant select on public.events, public.order_seats, public.layout_sections to anon, authenticated;
grant select on public.orders to authenticated;

revoke all on function public.crear_compra(uuid, text, int, text[], text, text, text) from public, anon;
grant execute on function public.crear_compra(uuid, text, int, text[], text, text, text) to authenticated;

-- ---------------------------------------------------------
-- Eventos de ejemplo. Las imágenes están en la carpeta /imagenes del proyecto.
-- ---------------------------------------------------------
insert into public.events
  (slug, title, heading, description, summary, image_url, image_position, location, event_date, date_label,
   entry_info, general_price, vip_price, category, layout, featured)
values
  ('arcangel', 'Arcángel en concierto', 'Arcángel en concierto: una noche de música urbana',
   'El artista llega a Panamá con un show en vivo.',
   'Pista VIP numerada al frente del escenario y gradas alrededor. Las puertas abren dos horas antes del inicio.',
   '../imagenes/estelar_ESTELAR.jpg', 'right center',
   'Arena Central, Ciudad de Panamá', '2027-03-20', '20 de marzo, 2027',
   'Pista VIP y gradas con asiento numerado', 45.00, 120.00, 'Conciertos', 'arena', true),

  ('concierto-estelar', 'Manda la Plena Moh: el concierto', 'Manda la Plena Moh: una noche con todos sus éxitos — by Farruko',
   'Vive una jornada llena de éxitos y energía en vivo.',
   'Desde baladas emotivas hasta ritmos contagiosos, un concierto para cantar y bailar de principio a fin.',
   '../imagenes/MANDSFAA.jpg', 'center',
   'Plaza Amador, Ciudad de Panamá', '2027-08-15', '15 de agosto, 2027',
   'Pista VIP y gradas con asiento numerado', 60.00, 120.00, 'Conciertos', 'arena', false),

  ('obra-teatro-vip', 'El Público', 'El Público: Federico García Lorca — Teatro Clásico de Sevilla',
   'Una obra de Federico García Lorca con puesta en escena contemporánea.',
   'El Teatro Clásico de Sevilla presenta una de las obras más atrevidas de Lorca, con un elenco de primer nivel.',
   '../imagenes/EL-PUBLICO-500.jpg', 'center 72%',
   'Teatro Municipal, Ciudad de Panamá', '2027-06-02', '2 de junio, 2027',
   'Butacas numeradas: primeras filas VIP y platea general', 30.00, 70.00, 'Teatro', 'teatro', false),

  ('pacho-flores', 'Pacho Flores y la Orquesta Filarmónica', 'Pacho Flores con la Orquesta Filarmónica de Panamá',
   'Una noche de música clásica con uno de los trompetistas más reconocidos del mundo.',
   'Concierto con la Orquesta Filarmónica de Panamá, bajo la dirección de Joshua Dos Santos.',
   '../imagenes/PACHFLORESQ.jpg', 'center',
   'Teatro Nacional, Ciudad de Panamá', '2027-06-17', '17 de junio, 2027',
   'Butacas numeradas: primeras filas VIP y platea general', 35.00, 80.00, 'Conciertos', 'teatro', false),

  ('festival-urban-beats', '500 KM Panamá', '500 KM Panamá: regresa la carrera',
   'La carrera de resistencia más grande del país vuelve al autódromo.',
   'Una jornada completa de automovilismo con las categorías GT, pits abiertos y zona de comida.',
   '../imagenes/500KMJUNIO.jpg', 'center',
   'Autódromo Panamá', '2027-06-06', '6 de junio, 2027',
   'Acceso general a gradas y pase VIP con acceso a los boxes', 45.00, 90.00, 'Deportes', 'general', false),

  ('jazz-casco-viejo', 'Noche de Jazz', 'Noche de Jazz: música en vivo en el Casco Viejo',
   'Una velada íntima de jazz con músicos locales e invitados.',
   'Una noche de jazz y blues en el corazón del Casco Viejo, con ambiente acogedor y buena música.',
   '../imagenes/jazz-casco-viejo.jpg', 'center',
   'Casco Viejo, Ciudad de Panamá', '2026-12-05', '5 de diciembre, 2026',
   'Mesas numeradas y zona VIP frente al escenario', 35.00, 80.00, 'Conciertos', 'teatro', false),

  ('salsa-panama', 'Gran Noche de Salsa', 'Gran Noche de Salsa: orquestas en vivo',
   'Las mejores orquestas de salsa para bailar toda la noche.',
   'Una pista de baile enorme, orquestas en vivo y shows de baile profesional.',
   '../imagenes/salsa-panama.jpg', 'center',
   'Centro de Convenciones, Ciudad de Panamá', '2026-12-19', '19 de diciembre, 2026',
   'Entrada general de pie y mesas VIP con servicio', 30.00, 75.00, 'Conciertos', 'general', false),

  ('fin-de-ano-2026', 'Fiesta de Fin de Año', 'Fiesta de Fin de Año: recibe el 2027 en grande',
   'La fiesta más grande para despedir el año con música y cuenta regresiva.',
   'DJs, música en vivo, fuegos artificiales y brindis de medianoche para recibir el año nuevo.',
   '../imagenes/fin-de-ano.jpg', 'center',
   'Salón de Eventos Central, Ciudad de Panamá', '2026-12-31', '31 de diciembre, 2026',
   'Entrada general con brindis y paquete VIP con cena', 55.00, 140.00, 'Festivales', 'general', false),

  ('stand-up-comedy', 'Stand-Up Comedy', 'Stand-Up Comedy: una noche para reír',
   'Los comediantes más divertidos del país en un solo escenario.',
   'Una noche de humor con un elenco de comediantes nacionales. Ideal para ir en grupo.',
   '../imagenes/stand-up-comedy.jpg', 'center',
   'Teatro Municipal, Ciudad de Panamá', '2027-01-09', '9 de enero, 2027',
   'Butacas numeradas: primera fila VIP', 20.00, 45.00, 'Teatro', 'teatro', false),

  ('panama-sabe', 'Panamá Sabe', 'Panamá Sabe: festival gastronómico',
   'Un festival con lo mejor de la cocina panameña e internacional.',
   'Más de 40 puestos de comida, chefs invitados, cocteles y música en vivo durante todo el día.',
   '../imagenes/panama-sabe.jpg', 'center',
   'Parque Urracá, Ciudad de Panamá', '2027-01-23', '23 de enero, 2027',
   'Entrada general con 5 degustaciones y pase VIP con barra de cocteles', 25.00, 70.00, 'Festivales', 'general', false),

  ('tech-summit-2027', 'Panamá Tech Summit', 'Panamá Tech Summit: tecnología e innovación',
   'Conferencias, talleres y networking con líderes de tecnología.',
   'Un día completo de charlas sobre inteligencia artificial, startups y desarrollo de software.',
   '../imagenes/tech-summit.jpg', 'center',
   'Centro de Convenciones, Ciudad de Panamá', '2027-03-12', '12 de marzo, 2027',
   'Asiento numerado en el auditorio: primeras filas VIP con taller incluido', 40.00, 110.00, 'Conferencias', 'teatro', false)
on conflict (slug) do update set
  title = excluded.title, heading = excluded.heading, description = excluded.description, summary = excluded.summary,
  image_url = excluded.image_url, image_position = excluded.image_position, location = excluded.location,
  event_date = excluded.event_date, date_label = excluded.date_label, entry_info = excluded.entry_info,
  general_price = excluded.general_price, vip_price = excluded.vip_price, category = excluded.category,
  layout = excluded.layout, featured = excluded.featured;

-- Pide a la API de Supabase que recargue su lista de tablas y funciones
-- (evita el error "Could not find the table ... in the schema cache").
notify pgrst, 'reload schema';
