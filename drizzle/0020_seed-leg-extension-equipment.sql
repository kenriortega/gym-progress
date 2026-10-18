-- La extensión de cuádriceps lleva leva, no polea: su figura explica por qué el
-- mismo pin pesa distinto según el ángulo de la rodilla.
update "exercises"
set "equipment_key" = 'leg-extension'
where "user_id" is null
  and "equipment_key" is null
  and lower("name") = lower('Extensión de cuádriceps');
