-- =========================================================
-- Ticketspot — eventos nuevos (ejecutar UNA vez en el SQL Editor de Supabase)
-- Es seguro correrlo varias veces: no duplica eventos.
-- =========================================================

-- 1) Los 3 eventos originales tenían fechas de 2026 que ya pasaron:
--    se mueven a 2027 para que no se vendan boletos de eventos pasados.
update public.events set event_date = '2027-05-24', date_label = '24 de mayo, 2027' where slug = 'concierto-estelar';
update public.events set event_date = '2027-06-02', date_label = '2 de junio, 2027'  where slug = 'obra-teatro-vip';
update public.events set event_date = '2027-06-14', date_label = '14 de junio, 2027' where slug = 'festival-urban-beats';

-- 2) Eventos nuevos
insert into public.events
  (slug, title, heading, description, summary, image_url, location, event_date, date_label, entry_info, general_price, vip_price)
values
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
