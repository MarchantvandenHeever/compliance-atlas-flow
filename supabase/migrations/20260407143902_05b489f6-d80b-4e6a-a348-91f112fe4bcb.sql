
-- Create join table for many-to-many project <-> template
CREATE TABLE public.project_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, template_id)
);

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project_templates" ON public.project_templates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auditors can manage project_templates" ON public.project_templates FOR ALL USING (has_role(auth.uid(), 'eco_auditor'::app_role));
CREATE POLICY "Org members can view project_templates" ON public.project_templates FOR SELECT TO authenticated USING (
  project_id IN (SELECT id FROM projects WHERE organisation_id = get_user_org(auth.uid()))
);

-- Migrate existing single template_id values into the join table
INSERT INTO public.project_templates (project_id, template_id)
SELECT id, template_id FROM public.projects WHERE template_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Delete "All Conditions" sections and their children
DELETE FROM public.checklist_items WHERE objective_id IN (
  SELECT co.id FROM public.checklist_objectives co
  JOIN public.checklist_sections cs ON co.section_id = cs.id
  WHERE LOWER(cs.name) LIKE '%all condition%'
);
DELETE FROM public.checklist_objectives WHERE section_id IN (
  SELECT id FROM public.checklist_sections WHERE LOWER(name) LIKE '%all condition%'
);
DELETE FROM public.checklist_sections WHERE LOWER(name) LIKE '%all condition%';
