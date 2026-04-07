
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'eco_auditor', 'reviewer', 'client_viewer');
CREATE TYPE public.audit_type AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE public.audit_status AS ENUM ('draft', 'submitted', 'approved');
CREATE TYPE public.compliance_status AS ENUM ('C', 'NC', 'NA');
CREATE TYPE public.action_status AS ENUM ('open', 'in_progress', 'closed');
CREATE TYPE public.action_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'on_hold');
CREATE TYPE public.checklist_source AS ENUM ('EA', 'EMPr');

-- Organisations
CREATE TABLE public.organisations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0096A6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  organisation_id UUID REFERENCES public.organisations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table per security best practices)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's org
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  location TEXT,
  audit_frequency TEXT DEFAULT 'monthly',
  status project_status NOT NULL DEFAULT 'active',
  template_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Checklist Templates
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- Add FK on projects
ALTER TABLE public.projects ADD CONSTRAINT fk_projects_template FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id);

-- Checklist Sections
CREATE TABLE public.checklist_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source checklist_source NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.checklist_sections ENABLE ROW LEVEL SECURITY;

-- Checklist Items
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.checklist_sections(id) ON DELETE CASCADE,
  condition_ref TEXT,
  description TEXT NOT NULL,
  source checklist_source NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Audit Instances
CREATE TABLE public.audit_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id),
  period TEXT NOT NULL,
  type audit_type NOT NULL DEFAULT 'monthly',
  status audit_status NOT NULL DEFAULT 'draft',
  auditor_id UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_instances ENABLE ROW LEVEL SECURITY;

-- Audit Item Responses
CREATE TABLE public.audit_item_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id),
  status compliance_status,
  comments TEXT,
  actions TEXT,
  last_edited_by UUID REFERENCES auth.users(id),
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_item_responses ENABLE ROW LEVEL SECURITY;

-- Response Photos
CREATE TABLE public.response_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES public.audit_item_responses(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  gps_location TEXT,
  exif_date TIMESTAMPTZ,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_size INT
);
ALTER TABLE public.response_photos ENABLE ROW LEVEL SECURITY;

-- Corrective Actions
CREATE TABLE public.corrective_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.audit_instances(id),
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_items(id),
  description TEXT NOT NULL,
  assigned_to TEXT,
  target_date DATE,
  status action_status NOT NULL DEFAULT 'open',
  severity action_severity NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_audit_instances_updated_at BEFORE UPDATE ON public.audit_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_corrective_actions_updated_at BEFORE UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: users can read all profiles in their org, update own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles: only admins can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Organisations: members can view
CREATE POLICY "Org members can view" ON public.organisations FOR SELECT TO authenticated USING (
  id = public.get_user_org(auth.uid())
);
CREATE POLICY "Admins can manage orgs" ON public.organisations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Projects: org members can view, admins/auditors can manage
CREATE POLICY "Org members can view projects" ON public.projects FOR SELECT TO authenticated USING (
  organisation_id = public.get_user_org(auth.uid())
);
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auditors can manage projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'eco_auditor'));

-- Checklist templates: org members can view
CREATE POLICY "Authenticated users can view templates" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.checklist_templates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Checklist sections: readable by authenticated
CREATE POLICY "Authenticated can view sections" ON public.checklist_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sections" ON public.checklist_sections FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Checklist items: readable by authenticated
CREATE POLICY "Authenticated can view items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage items" ON public.checklist_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Audit instances: org members can view, auditors can create/edit
CREATE POLICY "Org members can view audits" ON public.audit_instances FOR SELECT TO authenticated USING (
  project_id IN (SELECT id FROM public.projects WHERE organisation_id = public.get_user_org(auth.uid()))
);
CREATE POLICY "Auditors can manage audits" ON public.audit_instances FOR ALL USING (public.has_role(auth.uid(), 'eco_auditor'));
CREATE POLICY "Admins can manage audits" ON public.audit_instances FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Audit item responses
CREATE POLICY "Org members can view responses" ON public.audit_item_responses FOR SELECT TO authenticated USING (
  audit_id IN (SELECT id FROM public.audit_instances WHERE project_id IN (SELECT id FROM public.projects WHERE organisation_id = public.get_user_org(auth.uid())))
);
CREATE POLICY "Auditors can manage responses" ON public.audit_item_responses FOR ALL USING (public.has_role(auth.uid(), 'eco_auditor'));
CREATE POLICY "Admins can manage responses" ON public.audit_item_responses FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Response photos
CREATE POLICY "Org members can view photos" ON public.response_photos FOR SELECT TO authenticated USING (
  response_id IN (SELECT id FROM public.audit_item_responses WHERE audit_id IN (SELECT id FROM public.audit_instances WHERE project_id IN (SELECT id FROM public.projects WHERE organisation_id = public.get_user_org(auth.uid()))))
);
CREATE POLICY "Auditors can manage photos" ON public.response_photos FOR ALL USING (public.has_role(auth.uid(), 'eco_auditor'));
CREATE POLICY "Admins can manage photos" ON public.response_photos FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Corrective actions
CREATE POLICY "Org members can view actions" ON public.corrective_actions FOR SELECT TO authenticated USING (
  audit_id IN (SELECT id FROM public.audit_instances WHERE project_id IN (SELECT id FROM public.projects WHERE organisation_id = public.get_user_org(auth.uid())))
);
CREATE POLICY "Auditors can manage actions" ON public.corrective_actions FOR ALL USING (public.has_role(auth.uid(), 'eco_auditor'));
CREATE POLICY "Admins can manage actions" ON public.corrective_actions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for audit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('audit-photos', 'audit-photos', true);

CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "Anyone can view audit photos" ON storage.objects FOR SELECT USING (bucket_id = 'audit-photos');
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audit-photos');
