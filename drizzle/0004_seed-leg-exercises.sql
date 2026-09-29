insert into "exercises" ("name", "muscle_group")
values
  ('Extensión de cuádriceps', 'Piernas'),
  ('Zancadas (asaltos)', 'Piernas'),
  ('Sentadilla búlgara', 'Piernas'),
  ('Curl femoral acostado', 'Piernas'),
  ('Curl femoral de pie en máquina', 'Piernas'),
  ('Hip thrust', 'Glúteos'),
  ('Glúteos en máquina', 'Glúteos'),
  ('Peso muerto rumano', 'Piernas')
on conflict do nothing;
