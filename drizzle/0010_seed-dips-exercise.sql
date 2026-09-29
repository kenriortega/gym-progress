insert into "exercises" ("name", "muscle_group")
values ('Fondos en paralelas', 'Tríceps')
on conflict do nothing;
