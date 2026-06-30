
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_nearby_drivers(double precision, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_ride_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_ride_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride(uuid, numeric, numeric, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_drivers(double precision, double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_ride_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ride_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) TO authenticated;
