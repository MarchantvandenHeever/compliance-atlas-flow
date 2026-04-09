import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useReportReview(auditId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['report-review', auditId],
    queryFn: async () => {
      if (!auditId) return null;
      const { data, error } = await supabase
        .from('report_reviews')
        .select('*')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!auditId,
  });
}

export function useReportReviewComments(reportReviewId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['report-review-comments', reportReviewId],
    queryFn: async () => {
      if (!reportReviewId) return [];
      const { data, error } = await supabase
        .from('report_review_comments')
        .select('*')
        .eq('report_review_id', reportReviewId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!reportReviewId,
  });
}

export function useReportVersions(reportReviewId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['report-versions', reportReviewId],
    queryFn: async () => {
      if (!reportReviewId) return [];
      const { data, error } = await supabase
        .from('report_versions')
        .select('*')
        .eq('report_review_id', reportReviewId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!reportReviewId,
  });
}

export function useCreateReportReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auditId, reviewerId }: { auditId: string; reviewerId?: string }) => {
      const { data, error } = await supabase
        .from('report_reviews')
        .insert({
          audit_id: auditId,
          reviewer_id: reviewerId || null,
          status: 'pending_review' as any,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['report-review', vars.auditId] });
      toast.success('Report submitted for review');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReportReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      auditId,
      status,
      generalComment,
    }: {
      reviewId: string;
      auditId: string;
      status: string;
      generalComment?: string;
    }) => {
      const updates: any = { status };
      if (generalComment !== undefined) updates.general_comment = generalComment;
      if (status === 'approved' || status === 'disapproved') {
        updates.reviewed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('report_reviews')
        .update(updates)
        .eq('id', reviewId);
      if (error) throw error;

      // Notify auditor
      const { data: audit } = await supabase
        .from('audit_instances')
        .select('auditor_id')
        .eq('id', auditId)
        .single();

      if (audit?.auditor_id) {
        const msgMap: Record<string, string> = {
          approved: 'Your report has been approved.',
          disapproved: 'Your report has been disapproved.',
          amendments_requested: generalComment
            ? `Report amendments requested: ${generalComment}`
            : 'Amendments have been requested for your report.',
          under_review: 'Your report is now under review.',
        };
        if (msgMap[status]) {
          await supabase.from('notifications').insert({
            user_id: audit.auditor_id,
            type: `report_${status}`,
            audit_id: auditId,
            message: msgMap[status],
          });
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['report-review', vars.auditId] });
      toast.success('Report review status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddReportReviewComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      reportReviewId,
      section,
      comment,
    }: {
      reportReviewId: string;
      section?: string;
      comment: string;
    }) => {
      const { error } = await supabase
        .from('report_review_comments')
        .insert({
          report_review_id: reportReviewId,
          reviewer_id: user?.id || '',
          section: section || null,
          comment,
          status: 'open',
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['report-review-comments', vars.reportReviewId] });
      toast.success('Comment added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveReportReviewComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, reportReviewId }: { commentId: string; reportReviewId: string }) => {
      const { error } = await supabase
        .from('report_review_comments')
        .update({ status: 'resolved' })
        .eq('id', commentId);
      if (error) throw error;
      return reportReviewId;
    },
    onSuccess: (reportReviewId) => {
      qc.invalidateQueries({ queryKey: ['report-review-comments', reportReviewId] });
      toast.success('Comment resolved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddReportVersion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      reportReviewId,
      file,
      format,
      uploadType,
      storagePath,
    }: {
      reportReviewId: string;
      file?: File;
      format: string;
      uploadType: string;
      storagePath?: string;
    }) => {
      // Get current max version
      const { data: versions } = await supabase
        .from('report_versions')
        .select('version_number')
        .eq('report_review_id', reportReviewId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (versions?.[0]?.version_number || 0) + 1;

      let finalPath = storagePath;
      if (file && !finalPath) {
        const ext = file.name.split('.').pop() || format;
        finalPath = `reviews/${reportReviewId}/v${nextVersion}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('report-files')
          .upload(finalPath, file, { upsert: true });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from('report_versions')
        .insert({
          report_review_id: reportReviewId,
          version_number: nextVersion,
          storage_path: finalPath || '',
          format,
          uploaded_by: user?.id || '',
          upload_type: uploadType,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['report-versions', data.report_review_id] });
      toast.success('Report version saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDownloadReportVersion() {
  return useMutation({
    mutationFn: async (storagePath: string) => {
      const { data, error } = await supabase.storage
        .from('report-files')
        .download(storagePath);
      if (error) throw error;
      return data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
