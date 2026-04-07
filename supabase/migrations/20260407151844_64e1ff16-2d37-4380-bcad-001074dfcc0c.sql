
-- Add revision tracking columns to audit_instances
ALTER TABLE public.audit_instances
  ADD COLUMN revision_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_revised_at timestamp with time zone;

-- Create revision log table
CREATE TABLE public.audit_revision_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id uuid NOT NULL REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  revised_by uuid NOT NULL,
  revision_number integer NOT NULL,
  reason text,
  previous_status text NOT NULL,
  revised_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_revision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revision logs"
  ON public.audit_revision_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auditors can manage revision logs"
  ON public.audit_revision_log FOR ALL
  USING (has_role(auth.uid(), 'eco_auditor'::app_role));

CREATE POLICY "Org members can view revision logs"
  ON public.audit_revision_log FOR SELECT TO authenticated
  USING (audit_id IN (
    SELECT ai.id FROM audit_instances ai
    JOIN projects p ON ai.project_id = p.id
    WHERE p.organisation_id = get_user_org(auth.uid())
  ));

CREATE INDEX idx_revision_log_audit ON public.audit_revision_log(audit_id);
