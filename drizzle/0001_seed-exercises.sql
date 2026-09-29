insert into "exercises" ("name", "muscle_group")
values
  ('Press banca', 'Pecho'),
  ('Press inclinado con mancuernas', 'Pecho'),
  ('Sentadilla', 'Piernas'),
  ('Peso muerto', 'Espalda'),
  ('Remo con barra', 'Espalda'),
  ('Dominadas', 'Espalda'),
  ('Press militar', 'Hombros'),
  ('Curl de bíceps', 'Bíceps'),
  ('Extensión de tríceps', 'Tríceps'),
  ('Elevación de gemelos', 'Piernas')
on conflict do nothing;
