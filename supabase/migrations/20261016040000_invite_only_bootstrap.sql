-- =====================================================================
-- Every account, including the very first one, must be invited.
-- The first administrator is created by inviting their email with role
-- 'admin' during deployment (scripts/invite-admin.mjs); their first Google
-- sign-in then creates an administrator account directly. This removes
-- the earlier "first account of an empty league is allowed" exception,
-- so there is no window in which a stranger could claim the league.
-- =====================================================================

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if user_email <> '' and exists (select 1 from public.invites where email = user_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email has not been invited to the league. Ask a league administrator to invite you.'
  ));
end;
$$;
