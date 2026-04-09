
-- Create enum for report review status
CREATE TYPE public.report_review_status AS ENUM (
  'pending_review',
  'under_review',
  'amendments_requested',
  'approved',
  'disapproved'
);

-- Create report_reviews table
CREATE TABLE public.report_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  reviewer_id UUID,
  status public.report_review_status NOT NULL DEFAULT 'pending_review',
  general_comment TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report reviews" ON public.report_reviews FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Reviewers can manage report reviews" ON public.report_reviews FOR ALL USING (has_role(auth.uid(), 'reviewer'::app_role));
CREATE POLICY "Auditors can view report reviews" ON public.report_reviews FOR SELECT USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Auditors can update report reviews" ON public.report_reviews FOR UPDATE USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Org members can view report reviews" ON public.report_reviews FOR SELECT USING (
  audit_id IN (
    SELECT ai.id FROM audit_instances ai
    JOIN projects p ON ai.project_id = p.id
    WHERE p.organisation_id = get_user_org(auth.uid())
  )
);

CREATE TRIGGER update_report_reviews_updated_at
  BEFORE UPDATE ON public.report_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create report_review_comments table
CREATE TABLE public.report_review_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_review_id UUID NOT NULL REFERENCES public.report_reviews(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  section TEXT,
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report review comments" ON public.report_review_comments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Reviewers can manage report review comments" ON public.report_review_comments FOR ALL USING (has_role(auth.uid(), 'reviewer'::app_role));
CREATE POLICY "Auditors can view report review comments" ON public.report_review_comments FOR SELECT USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Auditors can update report review comment status" ON public.report_review_comments FOR UPDATE USING (has_role(auth.uid(), 'eco_auditor'::app_role)) WITH CHECK (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Org members can view report review comments" ON public.report_review_comments FOR SELECT USING (
  report_review_id IN (
    SELECT rr.id FROM report_reviews rr
    JOIN audit_instances ai ON rr.audit_id = ai.id
    JOIN projects p ON ai.project_id = p.id
    WHERE p.organisation_id = get_user_org(auth.uid())
  )
);

CREATE TRIGGER update_report_review_comments_updated_at
  BEFORE UPDATE ON public.report_review_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create report_versions table
CREATE TABLE public.report_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_review_id UUID NOT NULL REFERENCES public.report_reviews(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'pdf',
  uploaded_by UUID NOT NULL,
  upload_type TEXT NOT NULL DEFAULT 'generated',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report versions" ON public.report_versions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Reviewers can manage report versions" ON public.report_versions FOR ALL USING (has_role(auth.uid(), 'reviewer'::app_role));
CREATE POLICY "Auditors can manage report versions" ON public.report_versions FOR ALL USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Org members can view report versions" ON public.report_versions FOR SELECT USING (
  report_review_id IN (
    SELECT rr.id FROM report_reviews rr
    JOIN audit_instances ai ON rr.audit_id = ai.id
    JOIN projects p ON ai.project_id = p.id
    WHERE p.organisation_id = get_user_org(auth.uid())
  )
);

-- Create storage bucket for report files
INSERT INTO storage.buckets (id, name, public) VALUES ('report-files', 'report-files', false);

-- Storage policies for report-files bucket
CREATE POLICY "Authenticated users can upload report files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-files');

CREATE POLICY "Authenticated users can view report files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-files');

CREATE POLICY "Authenticated users can update report files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'report-files');
