insert into "exercises" ("name", "muscle_group")
values ('Press plano con mancuernas', 'Pecho')
on conflict do nothing;
