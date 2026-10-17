-- Super Admins may remove permissions from (non-super-admin) roles via the UI.
-- The RLS policy on role_permissions restricts this to Super Admins.
grant delete on hv.role_permissions to herdvest_app;
