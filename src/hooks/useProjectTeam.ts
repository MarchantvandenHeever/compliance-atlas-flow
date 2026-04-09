import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ProjectTeamRole = 'auditor' | 'reviewer' | 'client';

export interface ProjectTeamMember {
  id: string;
  project_id: string;
  user_id: string;
  project_role: ProjectTeamRole;
  assigned_at: string;
  assigned_by: string | null;
}

export function useProjectTeam(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-team', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_team_members')
        .select('*')
        .eq('project_id', projectId)
        .order('assigned_at', { ascending: true });
      if (error) throw error;
      return data as ProjectTeamMember[];
    },
    enabled: !!user && !!projectId,
  });
}

export function useAllProjectTeams() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['all-project-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_team_members')
        .select('*')
        .order('assigned_at', { ascending: true });
      if (error) throw error;
      return data as ProjectTeamMember[];
    },
    enabled: !!user,
  });
}

/** Get project IDs where the current user has a specific role */
export function useMyProjectIds(role?: ProjectTeamRole) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-project-ids', user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from('project_team_members')
        .select('project_id')
        .eq('user_id', user.id);
      if (role) q = q.eq('project_role', role);
      const { data, error } = await q;
      if (error) throw error;
      return [...new Set(data.map(d => d.project_id))];
    },
    enabled: !!user,
  });
}

export function useAddProjectTeamMember() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      user_id: string;
      project_role: ProjectTeamRole;
    }) => {
      const { error } = await supabase
        .from('project_team_members')
        .insert({
          project_id: params.project_id,
          user_id: params.user_id,
          project_role: params.project_role,
          assigned_by: user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-team', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['all-project-teams'] });
      qc.invalidateQueries({ queryKey: ['my-project-ids'] });
      toast.success('Team member assigned');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveProjectTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('project_team_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ['project-team', projectId] });
      qc.invalidateQueries({ queryKey: ['all-project-teams'] });
      qc.invalidateQueries({ queryKey: ['my-project-ids'] });
      toast.success('Team member removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Get project reviewers for notification targeting */
export async function getProjectReviewers(projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from('project_team_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('project_role', 'reviewer');
  return data?.map(d => d.user_id) || [];
}
