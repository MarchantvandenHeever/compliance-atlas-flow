import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProjectTemplates(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-templates', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_templates')
        .select('*, checklist_templates(id, name, version)')
        .eq('project_id', projectId);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

export function useAllProjectTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*, checklist_templates(id, name, version)');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSetProjectTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, templateIds }: { projectId: string; templateIds: string[] }) => {
      // Remove existing
      await supabase.from('project_templates').delete().eq('project_id', projectId);
      // Insert new
      if (templateIds.length > 0) {
        const { error } = await supabase
          .from('project_templates')
          .insert(templateIds.map(tid => ({ project_id: projectId, template_id: tid })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] });
      qc.invalidateQueries({ queryKey: ['project-templates-all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
