-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Datos iniciales
-- Correr DESPUÉS de 0001_esquema.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── Entrenador ──────────────────────────────────────────────────
-- El correo que se registre con esta dirección recibe el rol
-- 'entrenador' (panel de clientes). Cambialo por el tuyo si hace falta.
insert into entrenadores (email) values ('erivers_eo@icloud.com')
on conflict (email) do nothing;

-- ── Ingredientes base (macros por 100 g) ────────────────────────
-- Valores de referencia de USDA FoodData Central (SR Legacy). Todo lo
-- demás se busca en Open Food Facts desde la app y se cachea acá.
insert into ingredients (nombre, fuente, kcal_100, prot_100, carb_100, grasa_100) values
  -- Frutas
  ('Manzana (con cáscara)',            'usda',  52,  0.3, 13.8,  0.2),
  ('Banana',                           'usda',  89,  1.1, 22.8,  0.3),
  ('Naranja',                          'usda',  47,  0.9, 11.8,  0.1),
  ('Pera',                             'usda',  57,  0.4, 15.2,  0.1),
  ('Kiwi',                             'usda',  61,  1.1, 14.7,  0.5),
  ('Uvas',                             'usda',  69,  0.7, 18.1,  0.2),
  ('Frutilla',                         'usda',  32,  0.7,  7.7,  0.3),
  ('Arándanos',                        'usda',  57,  0.7, 14.5,  0.3),
  ('Frambuesa',                        'usda',  52,  1.2, 11.9,  0.7),
  ('Frutos rojos (mix)',               'manual', 47,  0.9, 11.4,  0.4),
  ('Palta',                            'usda', 160,  2.0,  8.5, 14.7),
  -- Proteínas animales
  ('Pechuga de pollo (cruda)',         'usda', 120, 22.5,  0.0,  2.6),
  ('Pechuga de pollo (cocida)',        'usda', 165, 31.0,  0.0,  3.6),
  ('Carne vacuna magra (cocida)',      'usda', 200, 28.0,  0.0,  9.5),
  ('Carne picada 90% magra (cocida)',  'usda', 217, 26.0,  0.0, 12.0),
  ('Huevo entero',                     'usda', 143, 12.6,  0.7,  9.5),
  ('Clara de huevo',                   'usda',  52, 10.9,  0.7,  0.2),
  ('Atún al natural (escurrido)',      'usda', 116, 25.5,  0.0,  0.8),
  ('Salmón (cocido)',                  'usda', 206, 22.1,  0.0, 12.4),
  ('Pescado blanco (cocido)',          'usda',  96, 21.0,  0.0,  1.3),
  -- Lácteos
  ('Leche entera',                     'usda',  61,  3.2,  4.8,  3.3),
  ('Leche descremada',                 'usda',  34,  3.4,  5.0,  0.1),
  ('Yogur natural entero',             'usda',  61,  3.5,  4.7,  3.3),
  ('Yogur griego descremado',          'usda',  59, 10.2,  3.6,  0.4),
  ('Queso cottage',                    'usda',  84, 11.0,  4.3,  2.3),
  ('Queso port salut',                 'usda', 352, 23.8,  0.6, 28.2),
  ('Queso mozzarella',                 'usda', 300, 22.2,  2.2, 22.4),
  ('Proteína whey (promedio)',         'manual', 400, 75.0,  8.0,  6.0),
  -- Cereales, legumbres y tubérculos
  ('Avena',                            'usda', 389, 16.9, 66.3,  6.9),
  ('Arroz blanco (cocido)',            'usda', 130,  2.7, 28.2,  0.3),
  ('Arroz integral (cocido)',          'usda', 123,  2.7, 25.6,  1.0),
  ('Pasta (cocida)',                   'usda', 158,  5.8, 30.9,  0.9),
  ('Papa (hervida)',                   'usda',  86,  1.7, 20.0,  0.1),
  ('Batata (hervida)',                 'usda',  76,  1.4, 17.7,  0.1),
  ('Pan integral',                     'usda', 247, 12.5, 41.0,  3.4),
  ('Pan blanco',                       'usda', 266,  8.9, 49.4,  3.3),
  ('Lentejas (cocidas)',               'usda', 116,  9.0, 20.1,  0.4),
  ('Garbanzos (cocidos)',              'usda', 164,  8.9, 27.4,  2.6),
  ('Porotos negros (cocidos)',         'usda', 132,  8.9, 23.7,  0.5),
  ('Tofu firme',                       'usda', 144, 17.3,  2.8,  8.7),
  -- Grasas y frutos secos
  ('Aceite de oliva',                  'usda', 884,  0.0,  0.0, 100.0),
  ('Manteca de maní',                  'usda', 588, 25.1, 19.6, 50.4),
  ('Almendras',                        'usda', 579, 21.2, 21.6, 49.9),
  ('Nueces',                           'usda', 654, 15.2, 13.7, 65.2),
  ('Semillas de chía',                 'usda', 486, 16.5, 42.1, 30.7),
  -- Verduras
  ('Brócoli',                          'usda',  34,  2.8,  6.6,  0.4),
  ('Espinaca',                         'usda',  23,  2.9,  3.6,  0.4),
  ('Tomate',                           'usda',  18,  0.9,  3.9,  0.2),
  ('Zanahoria',                        'usda',  41,  0.9,  9.6,  0.2),
  ('Lechuga',                          'usda',  15,  1.4,  2.9,  0.2),
  ('Cebolla',                          'usda',  40,  1.1,  9.3,  0.1),
  ('Pepino',                           'usda',  15,  0.7,  3.6,  0.1),
  ('Calabaza (cocida)',                'usda',  40,  0.9, 10.5,  0.1),
  -- Otros
  ('Azúcar',                           'usda', 387,  0.0, 100.0, 0.0),
  ('Miel',                             'usda', 304,  0.3, 82.4,  0.0),
  ('Chocolate amargo 70-85%',          'usda', 598,  7.8, 45.9, 42.6)
on conflict (lower(nombre)) where fuente <> 'off' do nothing;
