
-- Create checklist_objectives table (middle level: Phase → Objective → Task)
CREATE TABLE public.checklist_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.checklist_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source public.checklist_source NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.checklist_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view objectives"
ON public.checklist_objectives FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert objectives"
ON public.checklist_objectives FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage objectives"
ON public.checklist_objectives FOR ALL TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can delete objectives"
ON public.checklist_objectives FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add objective_id to checklist_items
ALTER TABLE public.checklist_items
ADD COLUMN objective_id UUID REFERENCES public.checklist_objectives(id) ON DELETE CASCADE;

-- Migrate existing data: create a default objective per section, link items
INSERT INTO public.checklist_objectives (id, section_id, name, source, sort_order)
SELECT gen_random_uuid(), cs.id, 'General', cs.source, 0
FROM public.checklist_sections cs;

-- Link existing items to the default objective of their section
UPDATE public.checklist_items ci
SET objective_id = co.id
FROM public.checklist_objectives co
WHERE co.section_id = ci.section_id AND co.name = 'General';

-- Make objective_id NOT NULL now that data is migrated
ALTER TABLE public.checklist_items ALTER COLUMN objective_id SET NOT NULL;

-- Drop old section_id FK from items (items now go through objectives)
ALTER TABLE public.checklist_items DROP COLUMN section_id;
