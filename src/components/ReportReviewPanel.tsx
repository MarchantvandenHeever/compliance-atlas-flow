import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, MessageSquare, Upload, Download, Clock,
  FileText, History, AlertTriangle, Loader2, Send, ChevronDown, ChevronUp,
} from 'lucide-react';
import PhotoEvidenceGallery from '@/components/PhotoEvidenceGallery';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import {
  useReportReview,
  useReportReviewComments,
  useReportVersions,
  useUpdateReportReviewStatus,
  useAddReportReviewComment,
  useResolveReportReviewComment,
  useAddReportVersion,
  useDownloadReportVersion,
} from '@/hooks/useReportReview';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
  amendments_requested: { label: 'Amendments Requested', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  disapproved: { label: 'Disapproved', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export function ReportReviewStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending_review;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${config.color}`}>
      <Icon size={12} /> {config.label}
    </span>
  );
}

interface ReportReviewPanelProps {
  auditId: string;
  projectName: string;
  period: string;
  open: boolean;
  onClose: () => void;
}

export default function ReportReviewPanel({ auditId, projectName, period, open, onClose }: ReportReviewPanelProps) {
  const { user, hasRole } = useAuth();
  const isReviewer = hasRole('reviewer') || hasRole('admin');
  const isAuditor = hasRole('eco_auditor') || hasRole('admin');

  const { data: review } = useReportReview(auditId);
  const { data: comments } = useReportReviewComments(review?.id);
  const { data: versions } = useReportVersions(review?.id);

  // Fetch audit photos for evidence gallery
  const [auditPhotos, setAuditPhotos] = useState<any[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);

  useState(() => {
    if (!auditId) return;
    supabase
      .from('audit_item_responses')
      .select('id, checklist_item_id, response_photos(*)')
      .eq('audit_id', auditId)
      .then(({ data }) => {
        const allPhotos = (data || []).flatMap((r: any) => r.response_photos || []);
        setAuditPhotos(allPhotos);
      });
  });

  const updateStatus = useUpdateReportReviewStatus();
  const addComment = useAddReportReviewComment();
  const resolveComment = useResolveReportReviewComment();
  const addVersion = useAddReportVersion();
  const downloadVersion = useDownloadReportVersion();

  const [newComment, setNewComment] = useState('');
  const [commentSection, setCommentSection] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  if (!review) return null;

  const status = review.status as string;
  const isLocked = status === 'approved';
  const openComments = comments?.filter(c => c.status === 'open') || [];
  const resolvedComments = comments?.filter(c => c.status === 'resolved') || [];

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({
      reviewId: review.id,
      auditId,
      status: newStatus,
      generalComment: newStatus === 'amendments_requested' ? generalComment : undefined,
    });
    if (newStatus === 'amendments_requested') setGeneralComment('');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate({
      reportReviewId: review.id,
      section: commentSection || undefined,
      comment: newComment,
    });
    setNewComment('');
    setCommentSection('');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !review) return;
    setUploading(true);
    try {
      const format = file.name.endsWith('.docx') ? 'docx' : 'pdf';
      const uploadType = isReviewer ? 'reviewer_upload' : 'auditor_resubmit';
      await addVersion.mutateAsync({
        reportReviewId: review.id,
        file,
        format,
        uploadType,
      });
      // If auditor resubmits, set status back to pending_review
      if (uploadType === 'auditor_resubmit' && status === 'amendments_requested') {
        updateStatus.mutate({
          reviewId: review.id,
          auditId,
          status: 'pending_review',
        });
      }
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  const handleDownloadVersion = async (storagePath: string, format: string, versionNum: number) => {
    try {
      const blob = await downloadVersion.mutateAsync(storagePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_v${versionNum}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} /> Report Review — {projectName} ({period})
          </DialogTitle>
        </DialogHeader>

        {/* Status */}
        <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current Status</p>
            <ReportReviewStatusBadge status={status} />
          </div>
          {isLocked && (
            <Badge variant="outline" className="border-green-500 text-green-700">
              <CheckCircle size={12} className="mr-1" /> Finalised
            </Badge>
          )}
        </div>

        {/* Reviewer Actions */}
        {isReviewer && !isLocked && (
          <div className="space-y-3 border rounded-lg p-3">
            <p className="text-sm font-semibold">Reviewer Actions</p>
            <div className="flex flex-wrap gap-2">
              {status === 'pending_review' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('under_review')}>
                  <MessageSquare size={14} className="mr-1" /> Start Review
                </Button>
              )}
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleStatusChange('approved')}>
                <CheckCircle size={14} className="mr-1" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleStatusChange('disapproved')}>
                <XCircle size={14} className="mr-1" /> Disapprove
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea placeholder="General comment or amendment details..."
                value={generalComment} onChange={e => setGeneralComment(e.target.value)} rows={2} />
              <Button size="sm" variant="outline"
                onClick={() => handleStatusChange('amendments_requested')}
                disabled={!generalComment.trim()}>
                <AlertTriangle size={14} className="mr-1" /> Request Amendments
              </Button>
            </div>
          </div>
        )}

        {/* Auditor resubmit section */}
        {isAuditor && status === 'amendments_requested' && (
          <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/50 space-y-2">
            <p className="text-sm font-semibold text-orange-700">Amendments Requested</p>
            {review.general_comment && (
              <p className="text-sm text-orange-600">"{review.general_comment}"</p>
            )}
            <p className="text-xs text-muted-foreground">
              Address the comments below, then upload the revised report to resubmit.
            </p>
            <input ref={uploadRef} type="file" accept=".pdf,.docx" onChange={handleUpload} className="hidden" />
            <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
              Upload Revised Report
            </Button>
          </div>
        )}

        {/* Comments */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            Comments ({openComments.length} open, {resolvedComments.length} resolved)
          </p>

          {/* Add comment */}
          {(isReviewer || isAuditor) && !isLocked && (
            <div className="flex gap-2">
              <Input placeholder="Section (optional)" value={commentSection}
                onChange={e => setCommentSection(e.target.value)} className="w-40" />
              <Input placeholder="Add a comment..." value={newComment}
                onChange={e => setNewComment(e.target.value)} className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
              <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                <Send size={14} />
              </Button>
            </div>
          )}

          {/* Comment list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments?.map(c => (
              <div key={c.id}
                className={`text-sm border rounded-md p-2 ${c.status === 'resolved' ? 'bg-muted/30 opacity-60' : 'bg-background'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {c.section && <Badge variant="outline" className="mr-1 text-[10px]">{c.section}</Badge>}
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                  {c.status === 'open' && isAuditor && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs"
                      onClick={() => resolveComment.mutate({ commentId: c.id, reportReviewId: review.id })}>
                      Resolve
                    </Button>
                  )}
                </div>
                <p>{c.comment}</p>
                {c.status === 'resolved' && (
                  <Badge variant="outline" className="mt-1 text-[10px] text-green-600">Resolved</Badge>
                )}
              </div>
            ))}
            {(!comments || comments.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">No comments yet.</p>
            )}
          </div>
        </div>

        {/* Version History */}
        <div className="space-y-2">
          <button onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1 text-sm font-semibold hover:text-primary transition-colors">
            <History size={14} /> Version History ({versions?.length || 0})
            {showVersions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showVersions && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {versions?.map(v => (
                <div key={v.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                  <div>
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {v.upload_type === 'generated' ? '📄 Generated' :
                       v.upload_type === 'reviewer_upload' ? '📝 Reviewer Upload' : '🔄 Auditor Resubmit'}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7"
                    onClick={() => handleDownloadVersion(v.storage_path, v.format, v.version_number)}>
                    <Download size={14} />
                  </Button>
                </div>
              ))}
              {(!versions || versions.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-2">No versions yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Upload for reviewer (offline review) */}
        {isReviewer && !isLocked && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">
              Download the report for offline review, then upload the reviewed version here.
            </p>
            <input ref={uploadRef} type="file" accept=".pdf,.docx" onChange={handleUpload} className="hidden" />
            <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
              Upload Reviewed Report
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
