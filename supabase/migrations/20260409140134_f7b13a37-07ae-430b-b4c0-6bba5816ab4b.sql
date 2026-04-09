
-- Create enum for project team roles
CREATE TYPE public.project_team_role AS ENUM ('auditor', 'reviewer', 'client');

-- Create project team members table
CREATE TABLE public.project_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_role project_team_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (project_id, user_id, project_role)
);

-- Enable RLS
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage
CREATE POLICY "Admins can manage team members"
  ON public.project_team_members
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON public.project_team_members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Org members can view team members for their org projects
CREATE POLICY "Org members can view project teams"
  ON public.project_team_members
  FOR SELECT
  USING (project_id IN (
    SELECT id FROM public.projects
    WHERE organisation_id = public.get_user_org(auth.uid())
  ));

-- Create a helper function to check project team membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID, _role project_team_role DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_team_members
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND (_role IS NULL OR project_role = _role)
  )
$$;

-- Create a function to get project IDs for a user by role
CREATE OR REPLACE FUNCTION public.get_user_projects(_user_id UUID, _role project_team_role DEFAULT NULL)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT project_id FROM public.project_team_members
  WHERE user_id = _user_id
    AND (_role IS NULL OR project_role = _role)
$$;
