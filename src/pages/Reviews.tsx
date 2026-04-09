import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, MessageSquare,
  Loader2, Eye, ChevronDown, ChevronRight, ArrowLeft, XCircle
} from 'lucide-react';
import { useAuditInstances, useAuditResponses, useAuditSectionOverrides } from '@/hooks/useAuditData';
import { useTemplateSections, useTemplateObjectives, useTemplateItems } from '@/hooks/useTemplates';
import { useProjects } from '@/hooks/useProjects';
import {
  useReviewComments, useAddReviewComment, useResolveReviewComment,
  useRequestAmendments, useApproveAudit, useStartReview,
  useMarkItemReviewed, useUnmarkItemReviewed,
} from '@/hooks/useReviewData';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProjectIds } from '@/hooks/useProjectTeam';
import ProjectFilter from '@/components/ProjectFilter';
import { getStatusDotClass } from '@/lib/compliance';

function AuditReviewDetail({
  audit,
  projectName,
  onClose,
}: {
  audit: any;
  projectName: string;
  onClose: () => void;
}) {
  const { data: dbSections } = useTemplateSections(audit.template_id);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbObjectives } = useTemplateObjectives(sectionIds);
  const objectiveIds = dbObjectives?.map(o => o.id);
  const { data: dbItems } = useTemplateItems(objectiveIds);
  const { data: dbResponses } = useAuditResponses(audit.id);
  const { data: dbSectionOverrides } = useAuditSectionOverrides(audit.id);
  const { data: reviewComments } = useReviewComments(audit.id);
  const addComment = useAddReviewComment();
  const resolveComment = useResolveReviewComment();
  const requestAmendments = useRequestAmendments();
  const approveAudit = useApproveAudit();
  const markReviewed = useMarkItemReviewed();
  const unmarkReviewed = useUnmarkItemReviewed();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [itemComment, setItemComment] = useState<Record<string, string>>({});
  const [generalComment, setGeneralComment] = useState('');
  const [showGeneralComment, setShowGeneralComment] = useState(false);

  const responsesMap = useMemo(() => {
    const map: Record<string, any> = {};
    dbResponses?.forEach(r => { map[r.checklist_item_id] = r; });
    return map;
  }, [dbResponses]);

  const commentsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    reviewComments?.forEach(c => {
      if (c.status === 'reviewed') return; // skip reviewed markers from comment map
      const key = c.checklist_item_id || '__general__';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [reviewComments]);

  // Track which items have been marked as reviewed
  const reviewedItemIds = useMemo(() => {
    const set = new Set<string>();
    reviewComments?.forEach(c => {
      if (c.status === 'reviewed' && c.checklist_item_id) set.add(c.checklist_item_id);
    });
    return set;
  }, [reviewComments]);

  const inactiveSections = useMemo(() => {
    const set = new Set<string>();
    dbSectionOverrides?.forEach(o => { if (!o.is_active) set.add(o.section_id); });
    return set;
  }, [dbSectionOverrides]);

  const sections = dbSections?.map(s => ({ id: s.id, name: s.name, source: s.source })) || [];
  const objectives = dbObjectives?.map(o => ({ id: o.id, sectionId: o.section_id, name: o.name })) || [];
  const items = dbItems?.map(i => ({ id: i.id, objectiveId: i.objective_id, description: i.description })) || [];

  // Count total active items for review progress
  const totalActiveItems = useMemo(() => {
    return items.filter(i => {
      const obj = objectives.find(o => o.id === i.objectiveId);
      if (!obj) return false;
      return !inactiveSections.has(obj.sectionId);
    }).length;
  }, [items, objectives, inactiveSections]);

  const reviewProgress = totalActiveItems > 0 ? Math.round((reviewedItemIds.size / totalActiveItems) * 100) : 0;

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleAddItemComment = async (itemId: string | null) => {
    const key = itemId || '__general__';
    const text = itemId ? itemComment[itemId] : generalComment;
    if (!text?.trim()) return;
    await addComment.mutateAsync({
      audit_id: audit.id,
      checklist_item_id: itemId,
      comment: text.trim(),
    });
    if (itemId) {
      setItemComment(prev => ({ ...prev, [itemId]: '' }));
    } else {
      setGeneralComment('');
    }
  };

  const handleRequestAmendments = async () => {
    const openCount = reviewComments?.filter(c => c.status === 'open').length || 0;
    if (openCount === 0 && !generalComment.trim()) {
      if (!confirm('No open comments. Request amendments anyway?')) return;
    }
    // Add general comment first if present
    if (generalComment.trim()) {
      await addComment.mutateAsync({
        audit_id: audit.id,
        checklist_item_id: null,
        comment: generalComment.trim(),
      });
    }
    await requestAmendments.mutateAsync({
      auditId: audit.id,
      generalComment: generalComment.trim() || undefined,
    });
    setGeneralComment('');
    onClose();
  };

  const handleApprove = async () => {
    const unreviewedCount = totalActiveItems - reviewedItemIds.size;
    if (unreviewedCount > 0) {
      if (!confirm(`${unreviewedCount} item(s) have not been marked as reviewed. Approve anyway?`)) return;
    }
    const openCount = reviewComments?.filter(c => c.status === 'open').length || 0;
    if (openCount > 0) {
      if (!confirm(`There are ${openCount} unresolved comment(s). Approve anyway?`)) return;
    }
    // Add general comment if present
    if (generalComment.trim()) {
      await addComment.mutateAsync({
        audit_id: audit.id,
        checklist_item_id: null,
        comment: generalComment.trim(),
      });
    }
    await approveAudit.mutateAsync(audit.id);
    onClose();
  };

  const statusLabel = (s: string | null) => {
    if (s === 'C') return <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Compliant</span>;
    if (s === 'NC') return <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Non-Compliant</span>;
    if (s === 'NA') return <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">N/A</span>;
    return <span className="text-xs text-muted-foreground italic">Not assessed</span>;
  };

  const openGeneralComments = commentsMap['__general__']?.filter(c => c.status === 'open') || [];
  const resolvedGeneralComments = commentsMap['__general__']?.filter(c => c.status === 'resolved') || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back to queue
        </button>
        <div className="flex-1" />
        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">Under Review</span>
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-lg font-semibold">{projectName} — {audit.period}</h3>
        <p className="text-sm text-muted-foreground">{audit.type} audit · Submitted {audit.submitted_at ? new Date(audit.submitted_at).toLocaleDateString() : '—'}</p>
        {/* Review Progress */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${reviewProgress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {reviewedItemIds.size}/{totalActiveItems} items reviewed ({reviewProgress}%)
          </span>
        </div>
      </div>

      {/* Audit Content */}
      <div className="space-y-3">
        {sections.map(section => {
          const isInactive = inactiveSections.has(section.id);
          const sectionObjectives = objectives.filter(o => o.sectionId === section.id);
          const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className={`bg-card border rounded-lg overflow-hidden ${isInactive ? 'opacity-60' : ''}`}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="text-sm font-semibold flex-1">{section.name}</span>
                {isInactive && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded">Inactive Phase</span>
                )}
                <span className="text-xs text-muted-foreground">{section.source}</span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {isInactive ? (
                      <div className="px-4 py-3 text-sm text-orange-600 bg-orange-50 border-t">
                        This phase was marked inactive and not assessed in this audit.
                      </div>
                    ) : (
                      <div className="border-t divide-y">
                        {sectionObjectives.map(obj => {
                          const objItems = items.filter(i => i.objectiveId === obj.id);
                          return (
                            <div key={obj.id} className="px-4 py-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{obj.name}</p>
                              <div className="space-y-2">
                                {objItems.map(item => {
                                  const response = responsesMap[item.id];
                                  const itemComments = commentsMap[item.id] || [];
                                  const openItemComments = itemComments.filter(c => c.status === 'open');
                                  const resolvedItemComments = itemComments.filter(c => c.status === 'resolved');
                                  const isItemReviewed = reviewedItemIds.has(item.id);

                                  const handleToggleReviewed = () => {
                                    if (isItemReviewed) {
                                      unmarkReviewed.mutate({ auditId: audit.id, checklistItemId: item.id });
                                    } else {
                                      markReviewed.mutate({ auditId: audit.id, checklistItemId: item.id });
                                    }
                                  };

                                  return (
                                    <div key={item.id} className={`rounded-md border bg-background ${isItemReviewed ? 'border-green-300 bg-green-50/30' : ''}`}>
                                      <div className="flex items-start gap-3 px-3 py-2.5">
                                        {/* Reviewed checkbox */}
                                        <button
                                          onClick={handleToggleReviewed}
                                          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                            isItemReviewed
                                              ? 'bg-green-600 border-green-600 text-white'
                                              : 'border-muted-foreground/40 hover:border-primary'
                                          }`}
                                          title={isItemReviewed ? 'Unmark as reviewed' : 'Mark as reviewed'}
                                        >
                                          {isItemReviewed && <CheckCircle2 size={12} />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium">{item.description}</p>
                                          {/* Auditor Evidence Section - always visible */}
                                          <div className="mt-2 rounded-md bg-muted/40 border border-muted px-3 py-2 space-y-1.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Auditor Evidence</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div>
                                                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Comments / Observations</p>
                                                <p className="text-xs text-foreground">
                                                  {response?.comments || <span className="italic text-muted-foreground">No comments provided</span>}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Recommended Actions</p>
                                                <p className="text-xs text-foreground">
                                                  {response?.actions || <span className="italic text-muted-foreground">No actions specified</span>}
                                                </p>
                                              </div>
                                            </div>
                                            {/* Photo evidence count */}
                                            {response?.response_photos && response.response_photos.length > 0 && (
                                              <p className="text-[10px] text-primary font-medium">
                                                📷 {response.response_photos.length} photo(s) attached
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {response?.status === 'NC' && response?.nc_severity && (
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                              response.nc_severity === 'high' ? 'bg-red-100 text-red-800' :
                                              response.nc_severity === 'low' ? 'bg-blue-100 text-blue-800' :
                                              'bg-amber-100 text-amber-800'
                                            }`}>
                                              {(response.nc_severity as string).toUpperCase()}
                                            </span>
                                          )}
                                          {isItemReviewed && (
                                            <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Reviewed</span>
                                          )}
                                          {statusLabel(response?.status || null)}
                                        </div>
                                      </div>

                                      {/* Existing comments on this item */}
                                      {openItemComments.length > 0 && (
                                        <div className="px-3 pb-2 space-y-1.5">
                                          {openItemComments.map(c => (
                                            <div key={c.id} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs">
                                              <AlertTriangle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                              <p className="flex-1 break-words">{c.comment}</p>
                                              <button
                                                onClick={() => resolveComment.mutate({ commentId: c.id, auditId: audit.id })}
                                                className="text-green-600 hover:text-green-700 flex-shrink-0"
                                                title="Resolve"
                                              >
                                                <CheckCircle2 size={12} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {resolvedItemComments.length > 0 && (
                                        <div className="px-3 pb-2">
                                          <details>
                                            <summary className="text-[10px] text-muted-foreground cursor-pointer">Resolved ({resolvedItemComments.length})</summary>
                                            <div className="space-y-1 mt-1">
                                              {resolvedItemComments.map(c => (
                                                <div key={c.id} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs opacity-70">
                                                  <CheckCircle2 size={10} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                  <p className="break-words">{c.comment}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </details>
                                        </div>
                                      )}

                                      {/* Add comment to this specific item */}
                                      <div className="px-3 pb-2">
                                        <div className="flex gap-1.5">
                                          <input
                                            value={itemComment[item.id] || ''}
                                            onChange={e => setItemComment(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            placeholder="Add reviewer comment on this item…"
                                            className="flex-1 px-2 py-1 rounded border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                                          />
                                          <button
                                            onClick={() => handleAddItemComment(item.id)}
                                            disabled={!itemComment[item.id]?.trim() || addComment.isPending}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                                          >
                                            {addComment.isPending ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
                                            Flag
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* General Comment & Final Actions */}
      <div className="bg-card border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-semibold">Review Summary</h4>

        {/* Existing general comments */}
        {openGeneralComments.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">General Comments (Open)</p>
            {openGeneralComments.map(c => (
              <div key={c.id} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="flex-1 break-words">{c.comment}</p>
                <button
                  onClick={() => resolveComment.mutate({ commentId: c.id, auditId: audit.id })}
                  className="text-green-600 hover:text-green-700 flex-shrink-0"
                  title="Resolve"
                >
                  <CheckCircle2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {resolvedGeneralComments.length > 0 && (
          <details>
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer">Resolved General Comments ({resolvedGeneralComments.length})</summary>
            <div className="space-y-1 mt-2">
              {resolvedGeneralComments.map(c => (
                <div key={c.id} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm opacity-70">
                  <CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="break-words">{c.comment}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Add general comment */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">General Comment</label>
          <textarea
            value={generalComment}
            onChange={e => setGeneralComment(e.target.value)}
            placeholder="Overall feedback or observations for the auditor…"
            rows={3}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <button
            onClick={handleRequestAmendments}
            disabled={requestAmendments.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {requestAmendments.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            Request Amendments
          </button>
          <button
            onClick={handleApprove}
            disabled={approveAudit.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {approveAudit.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Approve Audit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reviews() {
  const { data: allAudits } = useAuditInstances();
  const { data: projects } = useProjects();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { data: myReviewerProjectIds } = useMyProjectIds('reviewer');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

  const startReview = useStartReview();

  const reviewableStatuses = ['submitted', 'under_review'];
  const filteredAudits = (allAudits || [])
    .filter(a => reviewableStatuses.includes(a.status))
    .filter(a => !selectedProject || a.project_id === selectedProject)
    // Non-admin reviewers only see audits for their assigned projects
    .filter(a => isAdmin || !myReviewerProjectIds || myReviewerProjectIds.includes(a.project_id))
    .sort((a, b) => new Date(b.submitted_at || b.updated_at).getTime() - new Date(a.submitted_at || a.updated_at).getTime());

  const handleStartReview = async (audit: any) => {
    await startReview.mutateAsync(audit.id);
    setSelectedAudit(audit);
  };

  // If an audit is selected for detailed review, show the detail view
  if (selectedAudit) {
    const project = projects?.find(p => p.id === selectedAudit.project_id);
    return (
      <div className="max-w-5xl mx-auto">
        <AuditReviewDetail
          audit={selectedAudit}
          projectName={project?.name || 'Audit'}
          onClose={() => setSelectedAudit(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Audit Reviews</h2>
          <p className="text-sm text-muted-foreground">Review submitted audits, request amendments, or approve for client</p>
        </div>
        <ProjectFilter projects={projects || []} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

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
              return (
                <div key={audit.id} className="px-4 py-3.5 hover:bg-muted/20 transition-colors">
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
                    {audit.status === 'submitted' ? (
                      <button
                        onClick={() => handleStartReview(audit)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Start Review
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedAudit(audit)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Eye size={12} /> Continue Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
