import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, checklist_templates(name, version)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (project: {
      name: string;
      client: string;
      location?: string;
      description?: string;
      audit_frequency?: string;
      template_id?: string;
      organisation_id?: string;
    }) => {
      const orgId = project.organisation_id || profile?.organisation_id;
      if (!orgId) throw new Error('No organisation found. Please select a client or contact your admin.');
      const { organisation_id: _, ...rest } = project;
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...rest, organisation_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
