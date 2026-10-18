-- Assign the stable apparatus key to the system exercises that already have an
-- interactive figure. Keyed by name only this once: after this, the figure
-- follows `equipment_key`, so renaming the exercise keeps it.
update "exercises"
set "equipment_key" = 'lat-pulldown'
where "user_id" is null
  and lower("name") = lower('Jalón con barra')
  and "equipment_key" is null;
