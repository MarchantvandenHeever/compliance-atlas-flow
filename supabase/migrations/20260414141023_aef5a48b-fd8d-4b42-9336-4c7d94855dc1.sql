
-- 1. Fix checklist INSERT policies: restrict to admin only
DROP POLICY IF EXISTS "Authenticated can insert items" ON public.checklist_items;
CREATE POLICY "Admins can insert items" ON public.checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can insert objectives" ON public.checklist_objectives;
CREATE POLICY "Admins can insert objectives" ON public.checklist_objectives
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can insert sections" ON public.checklist_sections;
CREATE POLICY "Admins can insert sections" ON public.checklist_sections
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can insert templates" ON public.checklist_templates;
CREATE POLICY "Admins can insert templates" ON public.checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix notifications INSERT policy: restrict to admins, auditors, reviewers (they create notifications for workflow actions)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authorized users can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'eco_auditor'::app_role)
    OR has_role(auth.uid(), 'reviewer'::app_role)
  );

-- 3. Fix audit-photos storage: restrict DELETE to file owner or admin/auditor
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'audit-photos'
    AND (
      owner = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'eco_auditor'::app_role)
    )
  );

-- 4. Fix report-files storage policies: scope to org membership
DROP POLICY IF EXISTS "Authenticated users can read report files" ON storage.objects;
CREATE POLICY "Org members can read report files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-files'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'eco_auditor'::app_role)
      OR has_role(auth.uid(), 'reviewer'::app_role)
      OR owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload report files" ON storage.objects;
CREATE POLICY "Authorized users can upload report files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-files'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'eco_auditor'::app_role)
      OR has_role(auth.uid(), 'reviewer'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update report files" ON storage.objects;
CREATE POLICY "Authorized users can update report files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'report-files'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'eco_auditor'::app_role)
      OR has_role(auth.uid(), 'reviewer'::app_role)
    )
  );

-- 5. Make audit-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'audit-photos';

-- 6. Fix audit-photos SELECT policy for authenticated access only
DROP POLICY IF EXISTS "Anyone can view audit photos" ON storage.objects;
CREATE POLICY "Authenticated users can view audit photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-photos');
