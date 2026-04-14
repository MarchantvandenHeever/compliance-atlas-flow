
-- Add DELETE policy for projects (admin only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Admins can delete projects'
  ) THEN
    -- Already covered by "Admins can manage projects" ALL policy
    NULL;
  END IF;
END $$;

-- Add ON DELETE CASCADE to audit_instances -> projects FK
ALTER TABLE public.audit_instances
  DROP CONSTRAINT IF EXISTS audit_instances_project_id_fkey,
  ADD CONSTRAINT audit_instances_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to audit_item_responses -> audit_instances FK
ALTER TABLE public.audit_item_responses
  DROP CONSTRAINT IF EXISTS audit_item_responses_audit_id_fkey,
  ADD CONSTRAINT audit_item_responses_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to response_photos -> audit_item_responses FK
ALTER TABLE public.response_photos
  DROP CONSTRAINT IF EXISTS response_photos_response_id_fkey,
  ADD CONSTRAINT response_photos_response_id_fkey
    FOREIGN KEY (response_id) REFERENCES public.audit_item_responses(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to corrective_actions -> audit_instances FK
ALTER TABLE public.corrective_actions
  DROP CONSTRAINT IF EXISTS corrective_actions_audit_id_fkey,
  ADD CONSTRAINT corrective_actions_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to review_comments -> audit_instances FK
ALTER TABLE public.review_comments
  DROP CONSTRAINT IF EXISTS review_comments_audit_id_fkey,
  ADD CONSTRAINT review_comments_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to audit_revision_log -> audit_instances FK
ALTER TABLE public.audit_revision_log
  DROP CONSTRAINT IF EXISTS audit_revision_log_audit_id_fkey,
  ADD CONSTRAINT audit_revision_log_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to audit_section_overrides -> audit_instances FK
ALTER TABLE public.audit_section_overrides
  DROP CONSTRAINT IF EXISTS audit_section_overrides_audit_id_fkey,
  ADD CONSTRAINT audit_section_overrides_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to notifications -> audit_instances FK
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_audit_id_fkey,
  ADD CONSTRAINT notifications_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to report_reviews -> audit_instances FK
ALTER TABLE public.report_reviews
  DROP CONSTRAINT IF EXISTS report_reviews_audit_id_fkey,
  ADD CONSTRAINT report_reviews_audit_id_fkey
    FOREIGN KEY (audit_id) REFERENCES public.audit_instances(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to report_review_comments -> report_reviews FK
ALTER TABLE public.report_review_comments
  DROP CONSTRAINT IF EXISTS report_review_comments_report_review_id_fkey,
  ADD CONSTRAINT report_review_comments_report_review_id_fkey
    FOREIGN KEY (report_review_id) REFERENCES public.report_reviews(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to report_versions -> report_reviews FK
ALTER TABLE public.report_versions
  DROP CONSTRAINT IF EXISTS report_versions_report_review_id_fkey,
  ADD CONSTRAINT report_versions_report_review_id_fkey
    FOREIGN KEY (report_review_id) REFERENCES public.report_reviews(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to project_team_members -> projects FK
ALTER TABLE public.project_team_members
  DROP CONSTRAINT IF EXISTS project_team_members_project_id_fkey,
  ADD CONSTRAINT project_team_members_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to project_templates -> projects FK
ALTER TABLE public.project_templates
  DROP CONSTRAINT IF EXISTS project_templates_project_id_fkey,
  ADD CONSTRAINT project_templates_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
