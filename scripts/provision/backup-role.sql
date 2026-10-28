-- The read-only `backup` role the nightly pg_dump logs in as
-- (docs/spec/operations.md sections 2 and 5.2). Made in SQL rather than in
-- Neon's console, because console roles join neon_superuser. Safe to rerun:
-- it creates the role or resets its password. provision.sh replaces
-- __PASSWORD__ with a generated hex string and pipes this to psql as the
-- database owner, so the password never appears in a process list.
do $$
begin
  if not exists (select from pg_roles where rolname = 'backup') then
    create role backup login password '__PASSWORD__';
  else
    alter role backup login password '__PASSWORD__';
  end if;
end
$$;

grant pg_read_all_data to backup;
