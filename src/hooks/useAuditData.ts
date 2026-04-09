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

export function useAuditSectionOverrides(auditId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audit-section-overrides', auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from('audit_section_overrides')
        .select('*')
        .eq('audit_id', auditId);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!auditId,
  });
}

export function useSaveAuditSectionOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auditId, overrides }: {
      auditId: string;
      overrides: Array<{ section_id: string; is_active: boolean }>;
    }) => {
      const upserts = overrides.map(o => ({
        audit_id: auditId,
        section_id: o.section_id,
        is_active: o.is_active,
      }));
      const { error } = await supabase
        .from('audit_section_overrides')
        .upsert(upserts, { onConflict: 'audit_id,section_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['audit-section-overrides', vars.auditId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAuditName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auditId, name }: { auditId: string; name: string }) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ name })
        .eq('id', auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit name updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit submitted successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReopenAudit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ auditId, reason }: { auditId: string; reason?: string }) => {
      // Get current audit to know revision count and status
      const { data: audit, error: fetchErr } = await supabase
        .from('audit_instances')
        .select('revision_count, status')
        .eq('id', auditId)
        .single();
      if (fetchErr) throw fetchErr;

      const newRevision = (audit.revision_count || 0) + 1;

      // Log the revision
      const { error: logErr } = await supabase
        .from('audit_revision_log')
        .insert({
          audit_id: auditId,
          revised_by: user?.id || '',
          revision_number: newRevision,
          reason: reason || null,
          previous_status: audit.status,
        });
      if (logErr) throw logErr;

      // Reopen the audit
      const { error } = await supabase
        .from('audit_instances')
        .update({
          status: 'draft',
          revision_count: newRevision,
          last_revised_at: new Date().toISOString(),
        })
        .eq('id', auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit reopened for revision');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevisionLog(auditId?: string) {
  return useQuery({
    queryKey: ['revision-log', auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from('audit_revision_log')
        .select('*')
        .eq('audit_id', auditId)
        .order('revised_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!auditId,
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
        photos?: Array<{
          id?: string;
          url: string;
          caption: string;
          gpsLocation?: string;
          exifDate?: string;
          storagePath: string;
        }>;
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

      const { data: savedResponses, error } = await supabase
        .from('audit_item_responses')
        .upsert(upserts, { onConflict: 'audit_id,checklist_item_id', ignoreDuplicates: false })
        .select('id, checklist_item_id');

      if (error) throw error;

      // Build a map of checklist_item_id -> response row id
      const responseIdMap: Record<string, string> = {};
      savedResponses?.forEach(r => { responseIdMap[r.checklist_item_id] = r.id; });

      // Persist photos to response_photos for each response that has photos
      for (const r of responses) {
        const responseId = responseIdMap[r.checklist_item_id];
        if (!responseId || !r.photos?.length) continue;

        // Get existing photos for this response
        const { data: existingPhotos } = await supabase
          .from('response_photos')
          .select('id, storage_path')
          .eq('response_id', responseId);

        const existingPaths = new Set(existingPhotos?.map(p => p.storage_path) || []);
        const newPhotos = r.photos.filter(p => p.storagePath && !existingPaths.has(p.storagePath));

        if (newPhotos.length > 0) {
          const photoInserts = newPhotos.map(p => ({
            response_id: responseId,
            storage_path: p.storagePath,
            caption: p.caption || null,
            gps_location: p.gpsLocation || null,
            exif_date: p.exifDate || null,
          }));

          const { error: photoErr } = await supabase
            .from('response_photos')
            .insert(photoInserts);
          if (photoErr) console.error('Photo save error:', photoErr);
        }

        // Update captions for existing photos
        for (const p of r.photos) {
          if (p.id && p.id !== '') {
            await supabase.from('response_photos')
              .update({ caption: p.caption || null })
              .eq('id', p.id);
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['audit-responses', vars.auditId] });
      toast.success('Draft saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
