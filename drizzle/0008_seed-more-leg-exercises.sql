insert into "exercises" ("name", "muscle_group")
values
  ('Sentadilla hack', 'Piernas'),
  ('Prensa de piernas', 'Piernas')
on conflict do nothing;
