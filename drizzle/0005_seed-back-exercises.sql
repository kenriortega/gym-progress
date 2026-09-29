insert into "exercises" ("name", "muscle_group")
values
  ('Jalón con barra', 'Espalda'),
  ('Remo sentado en cable', 'Espalda')
on conflict do nothing;
