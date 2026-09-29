insert into "exercises" ("name", "muscle_group")
values
  ('Press de hombros con mancuernas', 'Hombros'),
  ('Elevaciones laterales con mancuernas', 'Hombros'),
  ('Elevaciones frontales con mancuernas', 'Hombros'),
  ('Pájaros con mancuernas', 'Hombros'),
  ('Press Arnold con mancuernas', 'Hombros')
on conflict do nothing;
