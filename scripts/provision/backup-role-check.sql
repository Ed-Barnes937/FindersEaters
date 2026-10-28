-- Run as `backup`: true only when the role can read every table and can write
-- or create nothing. provision.sh expects exactly `t`.
select pg_has_role(current_user, 'pg_read_all_data', 'member')
  and not pg_has_role(current_user, 'pg_write_all_data', 'member')
  and not has_database_privilege(current_database(), 'create')
  and not has_schema_privilege('public', 'create')
  and not exists (
    select from pg_roles
    where rolname = current_user and (rolsuper or rolcreaterole or rolcreatedb)
  )
  and not exists (
    select from pg_auth_members m join pg_roles r on r.oid = m.roleid
    where m.member = (select oid from pg_roles where rolname = current_user)
      and r.rolname = 'neon_superuser'
  )
