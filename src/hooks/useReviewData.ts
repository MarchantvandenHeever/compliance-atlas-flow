import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useReviewComments(auditId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['review-comments', auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from('review_comments')
        .select('*')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!auditId,
  });
}

export function useAddReviewComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: {
      audit_id: string;
      checklist_item_id?: string | null;
      comment: string;
    }) => {
      const { error } = await supabase
        .from('review_comments')
        .insert({
          audit_id: params.audit_id,
          checklist_item_id: params.checklist_item_id || null,
          reviewer_id: user?.id || '',
          comment: params.comment,
          status: 'open',
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['review-comments', vars.audit_id] });
      toast.success('Comment added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveReviewComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, auditId }: { commentId: string; auditId: string }) => {
      const { error } = await supabase
        .from('review_comments')
        .update({ status: 'resolved' })
        .eq('id', commentId);
      if (error) throw error;
      return auditId;
    },
    onSuccess: (auditId) => {
      qc.invalidateQueries({ queryKey: ['review-comments', auditId] });
      toast.success('Comment resolved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', auditId);
      if (error) throw error;

      // Create notifications for all reviewers
      const { data: reviewers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'reviewer');

      if (reviewers?.length) {
        const notifications = reviewers.map(r => ({
          user_id: r.user_id,
          type: 'review_requested',
          audit_id: auditId,
          message: 'A new audit has been submitted for your review.',
        }));
        await supabase.from('notifications').insert(notifications);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit submitted for review');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRequestAmendments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auditId, generalComment }: { auditId: string; generalComment?: string }) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ status: 'amendments_requested' })
        .eq('id', auditId);
      if (error) throw error;

      // Get auditor_id from audit
      const { data: audit } = await supabase
        .from('audit_instances')
        .select('auditor_id')
        .eq('id', auditId)
        .single();

      if (audit?.auditor_id) {
        await supabase.from('notifications').insert({
          user_id: audit.auditor_id,
          type: 'amendments_requested',
          audit_id: auditId,
          message: generalComment
            ? `Amendments requested: ${generalComment}`
            : 'The reviewer has requested amendments to your audit.',
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Amendments requested');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ status: 'approved' })
        .eq('id', auditId);
      if (error) throw error;

      const { data: audit } = await supabase
        .from('audit_instances')
        .select('auditor_id')
        .eq('id', auditId)
        .single();

      if (audit?.auditor_id) {
        await supabase.from('notifications').insert({
          user_id: audit.auditor_id,
          type: 'audit_approved',
          audit_id: auditId,
          message: 'Your audit has been reviewed and approved.',
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
      toast.success('Audit approved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase
        .from('audit_instances')
        .update({ status: 'under_review' })
        .eq('id', auditId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-instances'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
