-- Authenticated users can delete templates (admins already have ALL, but add explicit for safety)
CREATE POLICY "Authenticated can delete templates"
ON public.checklist_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can delete sections"
ON public.checklist_sections FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can delete items"
ON public.checklist_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));