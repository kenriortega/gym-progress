-- La prensa de 45° no lleva pila: los discos van en los brazos del carro. Su
-- figura explica otra cosa — los pestillos y el seno de la rampa.
update "exercises"
set "equipment_key" = 'leg-press'
where "user_id" is null
  and "equipment_key" is null
  and lower("name") = lower('Prensa de piernas');
