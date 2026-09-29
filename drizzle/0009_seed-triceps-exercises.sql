insert into "exercises" ("name", "muscle_group")
values
  ('Extensión de tríceps sobre la cabeza con cuerda', 'Tríceps'),
  ('Extensión de tríceps en polea con barra recta', 'Tríceps'),
  ('Extensión de tríceps en polea con agarre inverso', 'Tríceps')
on conflict do nothing;
