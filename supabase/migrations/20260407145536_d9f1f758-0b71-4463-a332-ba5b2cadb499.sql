
CREATE TABLE public.audit_section_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id uuid NOT NULL REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.checklist_sections(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audit_id, section_id)
);

ALTER TABLE public.audit_section_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage section overrides" ON public.audit_section_overrides FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auditors can manage section overrides" ON public.audit_section_overrides FOR ALL USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Org members can view section overrides" ON public.audit_section_overrides FOR SELECT TO authenticated USING (
  audit_id IN (SELECT id FROM audit_instances WHERE project_id IN (SELECT id FROM projects WHERE organisation_id = get_user_org(auth.uid())))
);
