
CREATE POLICY "Authenticated can insert templates"
ON public.checklist_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can insert sections"
ON public.checklist_sections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can insert items"
ON public.checklist_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
