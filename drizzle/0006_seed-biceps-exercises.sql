insert into "exercises" ("name", "muscle_group")
values
  ('Curl martillo con mancuernas', 'Bíceps'),
  ('Curl predicador', 'Bíceps')
on conflict do nothing;
