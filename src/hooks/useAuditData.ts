import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useAuditInstances(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audit-instances', projectId],
    queryFn: async () => {
      let q = supabase
        .from('audit_instances')
        .select('*, projects(name, client)')
        .order('created_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAuditResponses(auditId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audit-responses', auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from('audit_item_responses')
        .select('*, response_photos(*)')
        .eq('audit_id', auditId);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!auditId,
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (audit: {
      project_id: string;
      template_id: string;
      period: string;
      type: 'daily' | 'weekly' | 'monthly';
    }) => {
      const { data, error } = await supabase
        .from('audit_instances')
        .insert({ ...audit, auditor_id: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveAuditResponses() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ auditId, responses }: {
      auditId: string;
      responses: Array<{
        checklist_item_id: string;
        status: 'C' | 'NC' | 'NA' | null;
        comments?: string;
        actions?: string;
      }>;
    }) => {
      const upserts = responses.map(r => ({
        audit_id: auditId,
        checklist_item_id: r.checklist_item_id,
        status: r.status,
        comments: r.comments || null,
        actions: r.actions || null,
        last_edited_by: user?.id || null,
        last_edited_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('audit_item_responses')
        .upsert(upserts, { onConflict: 'audit_id,checklist_item_id', ignoreDuplicates: false });

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['audit-responses', vars.auditId] });
      toast.success('Draft saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
