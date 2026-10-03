insert into "exercises" ("name", "muscle_group")
values
  ('Plancha abdominal', 'Abdomen'),
  ('Plancha lateral', 'Abdomen'),
  ('Encogimientos en banco', 'Abdomen'),
  ('Elevación de piernas colgado', 'Abdomen'),
  ('Elevación de piernas en paralelas', 'Abdomen'),
  ('Rueda abdominal', 'Abdomen'),
  ('Crunch en polea alta', 'Abdomen'),
  ('Giro ruso con disco', 'Abdomen'),
  ('Rodillas al pecho en banco', 'Abdomen'),
  ('Dead bug', 'Abdomen')
on conflict do nothing;
