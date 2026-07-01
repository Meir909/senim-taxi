
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification', 'verification', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ver_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY ver_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='verification' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY ver_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY ver_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);
