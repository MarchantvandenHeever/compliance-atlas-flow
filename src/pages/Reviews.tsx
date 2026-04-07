import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, AlertTriangle, MessageSquare, Loader2, Eye } from 'lucide-react';
import { useAuditInstances } from '@/hooks/useAuditData';
import { useProjects } from '@/hooks/useProjects';
import { useReviewComments, useAddReviewComment, useRequestAmendments, useApproveAudit, useStartReview } from '@/hooks/useReviewData';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import ProjectFilter from '@/components/ProjectFilter';

export default function Reviews() {
  const { data: allAudits } = useAuditInstances();
  const { data: projects } = useProjects();
  const { profile } = useAuth();
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [commentItemId, setCommentItemId] = useState<string | null>(null);

  const addComment = useAddReviewComment();
  const requestAmendments = useRequestAmendments();
  const approveAudit = useApproveAudit();
  const startReview = useStartReview();
  const { data: reviewComments } = useReviewComments(selectedAudit || undefined);

  // Filter audits needing review
  const reviewableStatuses = ['submitted', 'under_review'];
  const filteredAudits = (allAudits || [])
    .filter(a => reviewableStatuses.includes(a.status))
    .filter(a => !selectedProject || a.project_id === selectedProject)
    .sort((a, b) => new Date(b.submitted_at || b.updated_at).getTime() - new Date(a.submitted_at || a.updated_at).getTime());

  const handleAddComment = async () => {
    if (!selectedAudit || !newComment.trim()) return;
    await addComment.mutateAsync({
      audit_id: selectedAudit,
      checklist_item_id: commentItemId,
      comment: newComment.trim(),
    });
    setNewComment('');
    setCommentItemId(null);
  };

  const handleRequestAmendments = async () => {
    if (!selectedAudit) return;
    if (!confirm('Request amendments for this audit? The auditor will be notified.')) return;
    await requestAmendments.mutateAsync({
      auditId: selectedAudit,
      generalComment: generalNote || undefined,
    });
    setGeneralNote('');
    setSelectedAudit(null);
  };

  const handleApprove = async () => {
    if (!selectedAudit) return;
    if (!confirm('Approve this audit? It will become available to the client.')) return;
    await approveAudit.mutateAsync(selectedAudit);
    setSelectedAudit(null);
  };

  const handleStartReview = async (auditId: string) => {
    await startReview.mutateAsync(auditId);
    setSelectedAudit(auditId);
  };

  const openComments = reviewComments?.filter(c => c.status === 'open') || [];
  const resolvedComments = reviewComments?.filter(c => c.status === 'resolved') || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Audit Reviews</h2>
          <p className="text-sm text-muted-foreground">Review submitted audits, request amendments, or approve for client</p>
        </div>
        <ProjectFilter projects={projects || []} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

      {/* Pending Reviews Queue */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
        <div className="p-4 border-b flex items-center gap-2">
          <ClipboardCheck size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Pending Reviews ({filteredAudits.length})</h3>
        </div>
        {filteredAudits.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No audits pending review.</div>
        ) : (
          <div className="divide-y">
            {filteredAudits.map(audit => {
              const project = projects?.find(p => p.id === audit.project_id);
              const isSelected = selectedAudit === audit.id;
              return (
                <div key={audit.id} className={`px-4 py-3.5 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <ClipboardCheck size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{project?.name || 'Audit'} — {audit.period}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{audit.type} audit</span>
                        <span>Submitted {audit.submitted_at ? new Date(audit.submitted_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${audit.status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {audit.status === 'under_review' ? 'Under Review' : 'Submitted'}
                    </span>
                    <Link to={`/audit?projectId=${audit.project_id}&templateId=${audit.template_id}&auditId=${audit.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Eye size={12} /> View
                    </Link>
                    {audit.status === 'submitted' ? (
                      <button onClick={() => handleStartReview(audit.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        Start Review
                      </button>
                    ) : (
                      <button onClick={() => setSelectedAudit(isSelected ? null : audit.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted/50 transition-colors">
                        {isSelected ? 'Close' : 'Review'}
                      </button>
                    )}
                  </div>

                  {/* Review Panel */}
                  {isSelected && audit.status === 'under_review' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 border-t pt-4 space-y-4">
                      {/* Add Comment */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Add Review Comment</label>
                        <div className="flex gap-2">
                          <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder="Flag a specific issue or add a general note..." rows={2}
                            className="flex-1 px-3 py-2 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <button onClick={handleAddComment} disabled={!newComment.trim() || addComment.isPending}
                            className="self-end inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                            {addComment.isPending ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Existing Comments */}
                      {openComments.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Open Comments ({openComments.length})</p>
                          <div className="space-y-2">
                            {openComments.map(c => (
                              <div key={c.id} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm">
                                <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="break-words">{c.comment}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {resolvedComments.length > 0 && (
                        <details>
                          <summary className="text-xs font-medium text-muted-foreground cursor-pointer">Resolved ({resolvedComments.length})</summary>
                          <div className="space-y-2 mt-2">
                            {resolvedComments.map(c => (
                              <div key={c.id} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm opacity-70">
                                <CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                                <p className="break-words">{c.comment}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* General Note for Amendment */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">General Note (optional, sent with amendment request)</label>
                        <textarea value={generalNote} onChange={e => setGeneralNote(e.target.value)}
                          placeholder="Overall feedback for the auditor..." rows={2}
                          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 pt-2 border-t">
                        <button onClick={handleRequestAmendments} disabled={requestAmendments.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
                          {requestAmendments.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                          Request Amendments
                        </button>
                        <button onClick={handleApprove} disabled={approveAudit.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                          {approveAudit.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Approve Audit
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
