-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Alimentos de México, pre/post-entreno y fases
-- Correr DESPUÉS de 0015_protocolos_checklist.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Alimentos: otros nombres y búsqueda sin acentos ──────────
-- `alias`: otros nombres del mismo alimento, separados por coma
-- ("plátano" = "banana"). `busqueda`: nombre + alias en minúsculas, sin
-- acentos ni signos; es lo que compara la app al buscar (el ilike de
-- Postgres no ignora acentos: "platano" no encontraba "Plátano").
alter table ingredients add column if not exists alias text;
alter table ingredients add column if not exists busqueda text generated always as (
  regexp_replace(
    lower(translate(nombre || ', ' || coalesce(alias, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '[^a-z0-9,]+', ' ', 'g'
  )
) stored;

-- Nombres de México para la base (los de antes quedan como alias)
update ingredients set nombre = 'Plátano', alias = 'banana, banano, guineo' where fuente = 'usda' and nombre = 'Banana';
update ingredients set nombre = 'Aguacate', alias = 'palta, aguacate hass, pulpa de aguacate' where fuente = 'usda' and nombre = 'Palta';
update ingredients set nombre = 'Camote (cocido)', alias = 'camote hervido, camote, batata hervida, batata cocida, boniato hervido' where fuente = 'usda' and nombre = 'Batata (hervida)';
update ingredients set nombre = 'Fresa', alias = 'fresas, frutilla, frutillas' where fuente = 'usda' and nombre = 'Frutilla';
update ingredients set nombre = 'Frijoles negros (cocidos)', alias = 'frijol negro cocido, porotos negros cocidos, frijoles de la olla' where fuente = 'usda' and nombre = 'Porotos negros (cocidos)';
update ingredients set nombre = 'Crema de cacahuate', alias = 'mantequilla de cacahuate, manteca de mani, mantequilla de mani, peanut butter' where fuente = 'usda' and nombre = 'Manteca de maní';
update ingredients set nombre = 'Carne de res magra (cocida)', alias = 'carne vacuna magra cocida, bistec cocido, res cocida' where fuente = 'usda' and nombre = 'Carne vacuna magra (cocida)';
update ingredients set nombre = 'Carne molida de res 90/10 (cocida)', alias = 'carne picada cocida, carne molida cocida' where fuente = 'usda' and nombre = 'Carne picada 90% magra (cocida)';
update ingredients set nombre = 'Atún en agua (escurrido)', alias = 'atun al natural, atun en lata, atun enlatado' where fuente = 'usda' and nombre = 'Atún al natural (escurrido)';

-- Sinónimos de lo que ya estaba
update ingredients set alias = v.alias
from (values
  ('Papa (hervida)', 'papa cocida, papas cocidas, patata hervida'),
  ('Tomate', 'jitomate, tomate rojo'),
  ('Huevo entero', 'huevo, huevos, huevo cocido, huevo duro, huevos enteros'),
  ('Clara de huevo', 'claras, claras de huevo, claras liquidas, claras de huevo en carton'),
  ('Yogur griego descremado', 'yogur griego 0%, yogur griego sin grasa, yogur griego light, yogurt griego natural sin grasa'),
  ('Yogur natural entero', 'yogurt natural'),
  ('Leche descremada', 'leche light, leche deslactosada light, leche sin grasa'),
  ('Pechuga de pollo (cruda)', 'pollo crudo, pechuga cruda, pechuga de pollo cruda'),
  ('Pechuga de pollo (cocida)', 'pollo cocido, pollo a la plancha, pechuga asada'),
  ('Pescado blanco (cocido)', 'tilapia cocida, merluza cocida, filete de pescado cocido'),
  ('Salmón (cocido)', 'salmon a la plancha, salmon horneado'),
  ('Arroz blanco (cocido)', 'arroz cocido, arroz blanco'),
  ('Brócoli', 'brocoli al vapor, brocoli cocido'),
  ('Espinaca', 'espinacas'),
  ('Avena', 'hojuelas de avena, avena en hojuelas, avena cruda'),
  ('Miel', 'miel de abeja, miel de abeja pura'),
  ('Aceite de oliva', 'aceite de oliva extra virgen, aceite'),
  ('Lechuga', 'lechuga romana'),
  ('Zanahoria', 'zanahorias'),
  ('Pepino', 'pepinos'),
  ('Arándanos', 'moras azules, blueberries'),
  ('Frutos rojos (mix)', 'frutos rojos congelados, frutos rojos, berries, mix de frutos rojos'),
  ('Proteína whey (promedio)', 'whey, proteina en polvo, proteina de suero, scoop de proteina'),
  ('Semillas de chía', 'chia'),
  ('Pan integral', 'pan de caja integral'),
  ('Pan blanco', 'pan de caja'),
  ('Manzana (con cáscara)', 'manzana'),
  ('Queso mozzarella', 'queso oaxaca, quesillo'),
  ('Chocolate amargo 70-85%', 'chocolate oscuro'),
  ('Calabaza (cocida)', 'calabaza de castilla cocida, zapallo cocido')
) as v(nombre, alias)
where ingredients.fuente <> 'off' and ingredients.nombre = v.nombre;

-- Alimentos nuevos (macros por 100 g; USDA FoodData Central SR Legacy o,
-- en 'manual', promedio de etiquetas de México)
insert into ingredients (nombre, fuente, kcal_100, prot_100, carb_100, grasa_100, alias) values
  -- Frutas
  ('Mango',                          'usda',   60,  0.8, 15.0,  0.4, 'mango ataulfo, mango manila'),
  ('Papaya',                         'usda',   43,  0.5, 10.8,  0.3, 'papaya maradol'),
  ('Piña',                           'usda',   50,  0.5, 13.1,  0.1, 'anana'),
  ('Sandía',                         'usda',   30,  0.6,  7.6,  0.2, null),
  ('Melón',                          'usda',   34,  0.8,  8.2,  0.2, 'melon chino'),
  ('Guayaba',                        'usda',   68,  2.6, 14.3,  1.0, null),
  ('Mandarina',                      'usda',   53,  0.8, 13.3,  0.3, null),
  ('Durazno',                        'usda',   39,  0.9,  9.5,  0.3, 'melocoton'),
  ('Toronja',                        'usda',   42,  0.8, 10.7,  0.1, 'pomelo'),
  ('Zarzamora',                      'usda',   43,  1.4,  9.6,  0.5, 'zarzamoras, moras'),
  ('Dátiles',                        'usda',  277,  1.8, 75.0,  0.2, 'datil, datiles medjool'),
  ('Pasas',                          'usda',  299,  3.1, 79.2,  0.5, 'uvas pasas'),
  ('Limón',                          'usda',   29,  1.1,  9.3,  0.3, 'jugo de limon'),
  -- Verduras
  ('Calabacita',                     'usda',   17,  1.2,  3.1,  0.3, 'calabacitas, zucchini, zapallito'),
  ('Jícama',                         'usda',   38,  0.7,  8.8,  0.1, null),
  ('Espárragos',                     'usda',   20,  2.2,  3.9,  0.1, 'esparrago'),
  ('Champiñones',                    'usda',   22,  3.1,  3.3,  0.3, 'champinon, hongos, setas'),
  ('Coliflor',                       'usda',   25,  1.9,  5.0,  0.3, null),
  ('Pimiento morrón',                'usda',   26,  1.0,  6.0,  0.3, 'pimiento, morron, chile morron'),
  ('Ejotes',                         'usda',   31,  1.8,  7.0,  0.2, 'ejote, judias verdes, chauchas'),
  ('Nopales',                        'usda',   16,  1.3,  3.3,  0.1, 'nopal'),
  ('Chayote',                        'usda',   19,  0.8,  4.5,  0.1, null),
  ('Apio',                           'usda',   16,  0.7,  3.0,  0.2, null),
  ('Rábano',                         'usda',   16,  0.7,  3.4,  0.1, 'rabanos'),
  ('Kale',                           'usda',   49,  4.3,  8.8,  0.9, 'col rizada'),
  ('Repollo',                        'usda',   25,  1.3,  5.8,  0.1, 'col'),
  ('Berenjena',                      'usda',   25,  1.0,  5.9,  0.2, null),
  ('Elote (cocido)',                 'usda',   96,  3.4, 21.0,  1.5, 'maiz cocido, granos de elote, choclo'),
  ('Chícharos (cocidos)',            'usda',   84,  5.4, 15.6,  0.2, 'chicharos, arvejas, guisantes'),
  ('Verduras mixtas',                'manual', 25,  1.6,  4.6,  0.3, 'verduras picadas, verduras salteadas, vegetales mixtos, vegetales verdes, verduras al vapor, verduras verdes'),
  ('Ensalada verde',                 'manual', 16,  1.0,  3.2,  0.2, 'ensalada, ensalada verde grande, ensalada mixta'),
  ('Pico de gallo',                  'manual', 25,  1.0,  5.5,  0.2, 'salsa mexicana, salsa fresca'),
  ('Salsa casera (roja o verde)',    'manual', 30,  1.2,  5.8,  0.5, 'salsa roja, salsa verde, salsa picante'),
  -- Proteínas (crudas: muchos planes pesan en crudo)
  ('Pescado blanco (crudo)',         'usda',   82, 17.8,  0.0,  0.7, 'pescado crudo, merluza cruda, bacalao crudo, basa cruda, filete de pescado crudo'),
  ('Tilapia (cruda)',                'usda',   96, 20.1,  0.0,  1.7, 'mojarra cruda'),
  ('Salmón (crudo)',                 'usda',  208, 20.4,  0.0, 13.4, 'salmon fresco'),
  ('Atún fresco (crudo)',            'usda',  109, 24.4,  0.0,  0.5, 'atun fresco, atun aleta amarilla'),
  ('Camarón (crudo)',                'usda',   85, 20.1,  0.0,  0.5, 'camarones, gambas'),
  ('Bistec de res magro (crudo)',    'usda',  135, 21.5,  0.0,  5.0, 'bistec, filete de res, res cruda, carne de res cruda, sirloin'),
  ('Carne molida de res 90/10 (cruda)', 'usda', 176, 20.0, 0.0, 10.0, 'carne molida cruda, carne picada cruda'),
  ('Carne molida de pavo (cruda)',   'usda',  150, 18.7,  0.0,  8.3, 'pavo molido'),
  ('Pechuga de pavo (cruda)',        'usda',  114, 23.7,  0.1,  1.5, 'pavo crudo'),
  ('Jamón de pavo',                  'manual',105, 15.0,  4.0,  3.0, 'jamon'),
  ('Muslo de pollo sin piel (crudo)','usda',  121, 19.7,  0.0,  4.1, 'pierna de pollo cruda, muslo de pollo crudo'),
  ('Lomo de cerdo (crudo)',          'usda',  120, 21.0,  0.0,  3.4, 'filete de cerdo, cerdo crudo'),
  ('Sardinas en lata (escurridas)',  'usda',  208, 24.6,  0.0, 11.5, 'sardina, sardinas'),
  ('Proteína whey isolate',          'manual',370, 87.0,  3.0,  1.5, 'whey isolate, isolate, proteina aislada, proteina isolate, whey protein isolate'),
  -- Lácteos
  ('Yogur griego natural entero',    'usda',   97,  9.0,  4.0,  5.0, 'yogurt griego entero'),
  ('Kéfir natural',                  'usda',   41,  3.8,  4.5,  0.9, 'kefir, kefir liquido, kefir sin azucar'),
  ('Queso panela',                   'manual',240, 19.0,  3.0, 17.0, 'panela'),
  ('Queso fresco',                   'usda',  299, 18.1,  3.0, 23.8, null),
  ('Requesón',                       'usda',  138, 11.4,  5.1,  7.9, 'ricotta'),
  ('Leche semidescremada',           'usda',   50,  3.3,  4.8,  2.0, 'leche 2%, leche semi'),
  ('Leche de almendra sin azúcar',   'manual', 15,  0.6,  0.6,  1.1, 'bebida de almendra, leche de almendras'),
  ('Leche de soya',                  'usda',   54,  3.3,  6.3,  1.8, 'leche de soja, bebida de soya'),
  -- Cereales y tubérculos
  ('Galletas de arroz',              'usda',  387,  8.2, 81.5,  2.8, 'galleta de arroz, rice cakes, tortitas de arroz'),
  ('Tortilla de maíz',               'usda',  218,  5.7, 44.6,  2.9, 'tortillas de maiz, tortilla'),
  ('Tortilla de harina',             'usda',  306,  8.2, 50.0,  8.0, 'tortillas de harina'),
  ('Bolillo',                        'usda',  277,  8.6, 50.4,  4.3, 'telera, pan frances'),
  ('Quinoa (cocida)',                'usda',  120,  4.4, 21.3,  1.9, 'quinua cocida'),
  ('Amaranto (inflado)',             'manual',380, 13.0, 69.0,  6.5, 'amaranto, alegria'),
  ('Granola',                        'manual',450, 10.0, 66.0, 16.0, null),
  ('Cereal de maíz (hojuelas)',      'usda',  357,  7.5, 84.1,  0.4, 'corn flakes, hojuelas de maiz'),
  ('Camote (horneado)',              'usda',   90,  2.0, 20.7,  0.2, 'camote al horno, camote asado, batata al horno'),
  ('Papa (al horno)',                'usda',   93,  2.5, 21.2,  0.1, 'papa horneada, papa asada'),
  ('Frijoles pintos (cocidos)',      'usda',  143,  9.0, 26.2,  0.7, 'frijoles bayos, frijol pinto, porotos cocidos'),
  ('Arroz blanco (crudo)',           'usda',  365,  7.1, 80.0,  0.7, 'arroz crudo'),
  ('Pasta (cruda)',                  'usda',  371, 13.0, 74.7,  1.5, 'pasta seca, espagueti crudo'),
  -- Grasas y semillas
  ('Semillas de girasol',            'usda',  584, 20.8, 20.0, 51.5, 'pipas de girasol, semilla de girasol'),
  ('Semillas de calabaza',           'usda',  559, 30.2, 10.7, 49.1, 'pepitas, pepita de calabaza, pipas de calabaza'),
  ('Cacahuates',                     'usda',  567, 25.8, 16.1, 49.2, 'cacahuate, mani'),
  ('Nuez de la India',               'usda',  553, 18.2, 30.2, 43.9, 'anacardos, castanas de caju'),
  ('Pistaches',                      'usda',  560, 20.2, 27.2, 45.3, 'pistachos'),
  ('Linaza',                         'usda',  534, 18.3, 28.9, 42.2, 'semillas de linaza, semillas de lino'),
  ('Aceite de aguacate',             'usda',  884,  0.0,  0.0,100.0, null),
  ('Aceite de coco',                 'usda',  892,  0.0,  0.0, 99.1, null),
  ('Aceite en aerosol',              'manual',884,  0.0,  0.0,100.0, 'aceite en spray, spray de aceite'),
  ('Mantequilla',                    'usda',  717,  0.9,  0.1, 81.1, null),
  ('Crema de almendra',              'usda',  614, 21.0, 18.8, 55.5, 'mantequilla de almendra'),
  ('Aceitunas',                      'usda',  115,  0.8,  6.3, 10.7, 'olivas'),
  -- Otros
  ('Vinagre de manzana',             'usda',   21,  0.0,  0.9,  0.0, 'vinagre'),
  ('Mermelada',                      'usda',  278,  0.4, 68.9,  0.1, 'jalea'),
  ('Cacao en polvo',                 'usda',  228, 19.6, 57.9, 13.7, 'cocoa, cacao'),
  ('Hummus',                         'usda',  166,  7.9, 14.3,  9.6, null),
  ('Guacamole',                      'manual',155,  2.0,  8.5, 14.0, null)
on conflict (lower(nombre)) where fuente <> 'off' do nothing;

-- ── 2. Comidas pre y post-entreno ───────────────────────────────
-- Planes con 6 comidas (pre-entreno, post-entreno, desayuno, comida,
-- colación y cena) ya no se pisan en el mismo momento.
alter table meal_plan_items drop constraint if exists meal_plan_items_momento_check;
alter table meal_plan_items add constraint meal_plan_items_momento_check
  check (momento in ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack', 'pre_entreno', 'post_entreno'));
alter table meal_logs drop constraint if exists meal_logs_momento_check;
alter table meal_logs add constraint meal_logs_momento_check
  check (momento in ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack', 'pre_entreno', 'post_entreno'));

-- meal_plans.horarios (de la 0015, sin uso hasta ahora): la hora de cada
-- comida del menú por tipo de día, cuando el plan del entrenador la fija
-- ({"entreno": {"desayuno": "09:30", ...}, "descanso": {...}}). Tiene
-- prioridad sobre los horarios del cuestionario.

alter table protocolo_items drop constraint if exists protocolo_items_ancla_check;
alter table protocolo_items add constraint protocolo_items_ancla_check
  check (ancla in ('hora_fija', 'al_despertar', 'antes_entreno', 'durante_entreno', 'despues_entreno',
                   'con_desayuno', 'con_almuerzo', 'con_merienda', 'con_cena', 'con_snack',
                   'con_pre_entreno', 'con_post_entreno', 'antes_dormir', 'en_el_dia'));

-- ── 3. Fases del protocolo ──────────────────────────────────────
-- fases: [{"nombre": "Fase 1", "desde_dia": 1, "nota": "..."}, ...] en
-- orden; cada una dura hasta que empieza la siguiente (la última sigue).
-- El día 1 es protocolos.fecha_inicio. Cada ítem dice desde qué fase (y
-- opcionalmente hasta cuál) se usa.
alter table protocolos add column if not exists fases jsonb not null default '[]'::jsonb;
alter table protocolo_items add column if not exists fase_desde smallint check (fase_desde between 1 and 12);
alter table protocolo_items add column if not exists fase_hasta smallint check (fase_hasta between 1 and 12);

-- ── 4. Lecturas de la IA guardadas ──────────────────────────────
-- Lo que la IA leyó de un texto del entrenador (menú o protocolo), por
-- huella del texto: el mismo texto da siempre el mismo resultado (la IA
-- no es idéntica de una vez a otra) y no se gasta el límite gratis. El
-- entrenador puede pedir que lo lea de nuevo.
create table if not exists ia_lecturas (
  clave text primary key,          -- sha256 de tipo + versión + texto normalizado
  tipo text not null check (tipo in ('menu', 'protocolo')),
  resultado jsonb not null,        -- la respuesta de la IA, antes de sanearla
  created_at timestamptz not null default now()
);

alter table ia_lecturas enable row level security;
drop policy if exists ia_lecturas_entrenador on ia_lecturas;
create policy ia_lecturas_entrenador on ia_lecturas for all to authenticated
  using (public.is_entrenador()) with check (public.is_entrenador());
