-- La columna de poleas es un solo aparato que sirve cuatro ejercicios: cambia
-- dónde fijas la polea y qué agarre cuelgas, no la máquina. Por eso comparten
-- equipment_key y una sola figura.
update "exercises"
set "equipment_key" = 'cable-station'
where "user_id" is null
  and "equipment_key" is null
  and lower("name") in (
    lower('Crunch en polea alta'),
    lower('Extensión de tríceps en polea con barra recta'),
    lower('Extensión de tríceps en polea con agarre inverso'),
    lower('Extensión de tríceps sobre la cabeza con cuerda')
  );
