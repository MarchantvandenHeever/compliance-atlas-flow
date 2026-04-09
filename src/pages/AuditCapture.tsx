import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Save, Search, Loader2, Send, Lock, RotateCcw, History, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useMultiTemplateSections, useTemplateObjectives, useTemplateItems } from '@/hooks/useTemplates';
import { useAuditResponses, useSaveAuditResponses, useAuditSectionOverrides, useSaveAuditSectionOverrides, useCreateAudit, useAuditInstances, useReopenAudit, useRevisionLog } from '@/hooks/useAuditData';
import { useSubmitForReview, useReviewComments, useResolveReviewComment } from '@/hooks/useReviewData';
import { useProjects } from '@/hooks/useProjects';
import { useAllProjectTemplates } from '@/hooks/useProjectTemplates';
import { calculateCompliance, getStatusDotClass } from '@/lib/compliance';
import { ComplianceStatus, AuditItemResponse } from '@/types';
import PhotoUpload from '@/components/PhotoUpload';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { defaultTemplate } from '@/data/checklistData';

const STATUS_OPTIONS: { value: ComplianceStatus; label: string; shortLabel: string; color: string }[] = [
  { value: 'C', label: 'Compliant', shortLabel: 'C', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { value: 'NC', label: 'Non-Compliant', shortLabel: 'NC', color: 'bg-red-500 hover:bg-red-600 text-white' },
  { value: 'N/A', label: 'N/A / Noted', shortLabel: 'N/A', color: 'bg-gray-400 hover:bg-gray-500 text-white' },
];

export default function AuditCapture() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auditId = searchParams.get('auditId');
  const templateId = searchParams.get('templateId');
  const projectId = searchParams.get('projectId');

  const { data: projects } = useProjects();
  const { data: allPT } = useAllProjectTemplates();

  const currentProject = projects?.find(p => p.id === projectId);

  const { data: dbSections } = useTemplateSections(templateId || undefined);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbObjectives } = useTemplateObjectives(sectionIds);
  const objectiveIds = dbObjectives?.map(o => o.id);
  const { data: dbItems } = useTemplateItems(objectiveIds);
  const { data: dbResponses } = useAuditResponses(auditId || undefined);
  const { data: dbSectionOverrides } = useAuditSectionOverrides(auditId || undefined);
  const saveResponses = useSaveAuditResponses();
  const saveSectionOverrides = useSaveAuditSectionOverrides();
  const createAudit = useCreateAudit();
  const submitForReview = useSubmitForReview();
  const { data: reviewComments } = useReviewComments(auditId || undefined);
  const resolveComment = useResolveReviewComment();
  const reopenAudit = useReopenAudit();
  const { data: auditInstances } = useAuditInstances(projectId || undefined);
  const { data: revisionLog } = useRevisionLog(auditId || undefined);

  const currentAuditInstance = auditInstances?.find(a => a.id === auditId);
  const isLocked = currentAuditInstance?.status === 'submitted' || currentAuditInstance?.status === 'approved' || currentAuditInstance?.status === 'under_review';
  const isAmendmentsRequested = currentAuditInstance?.status === 'amendments_requested' as any;
  const revisionCount = (currentAuditInstance as any)?.revision_count || 0;
  const lastRevisedAt = (currentAuditInstance as any)?.last_revised_at;

  const [inactiveSections, setInactiveSections] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    if (dbItems?.length) return dbItems.map(i => ({
      id: i.id, objectiveId: i.objective_id, conditionRef: i.condition_ref || '', description: i.description,
      source: i.source as 'EA' | 'EMPr', order: i.sort_order,
    }));
    return defaultTemplate.items;
  }, [dbItems]);

  const sections = useMemo(() => {
    if (dbSections?.length) return dbSections.map(s => ({
      id: s.id, name: s.name, source: s.source as 'EA' | 'EMPr', order: s.sort_order,
    }));
    return defaultTemplate.sections;
  }, [dbSections]);

  const objectives = useMemo(() => {
    if (dbObjectives?.length) return dbObjectives.map(o => ({
      id: o.id, sectionId: o.section_id, name: o.name, source: o.source as 'EA' | 'EMPr', order: o.sort_order,
    }));
    return [];
  }, [dbObjectives]);

  const [responses, setResponses] = useState<Record<string, Partial<AuditItemResponse>>>({});

  useMemo(() => {
    if (dbResponses?.length) {
      const mapped: Record<string, Partial<AuditItemResponse>> = {};
      dbResponses.forEach(r => {
        const status = r.status === 'NA' ? 'N/A' : r.status;
        mapped[r.checklist_item_id] = {
          id: r.id, status: status as ComplianceStatus, comments: r.comments || '', actions: r.actions || '',
          photos: r.response_photos?.map((p: any) => ({ id: p.id, url: '', caption: p.caption || '', timestamp: p.upload_date, gpsLocation: p.gps_location, storagePath: p.storage_path || '' })) || [],
        };
      });
      setResponses(prev => ({ ...mapped, ...prev }));
    }
  }, [dbResponses]);

  // Load section overrides from DB
  useMemo(() => {
    if (dbSectionOverrides?.length) {
      const inactive = new Set<string>();
      dbSectionOverrides.forEach(o => { if (!o.is_active) inactive.add(o.section_id); });
      setInactiveSections(inactive);
    }
  }, [dbSectionOverrides]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'EA' | 'EMPr'>('all');

  useMemo(() => {
    if (sections.length && expandedSections.size === 0) {
      setExpandedSections(new Set(sections.map(s => s.id)));
      if (objectives.length) setExpandedObjectives(new Set(objectives.map(o => o.id)));
    }
  }, [sections, objectives]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleObjective = useCallback((id: string) => {
    setExpandedObjectives(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleRow = useCallback((itemId: string) => {
    setExpandedRows(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  }, []);

  const toggleSectionActive = useCallback((sectionId: string) => {
    setInactiveSections(prev => {
      const n = new Set(prev);
      n.has(sectionId) ? n.delete(sectionId) : n.add(sectionId);
      return n;
    });
  }, []);

  const setStatus = useCallback((itemId: string, status: ComplianceStatus) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], status, lastEditedAt: new Date().toISOString() } }));
  }, []);
  const setComment = useCallback((itemId: string, comments: string) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], comments } }));
  }, []);
  const setAction = useCallback((itemId: string, actions: string) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], actions } }));
  }, []);
  const handlePhotosChange = useCallback((itemId: string, photos: any[]) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], photos: photos.map(p => ({ ...p, storagePath: p.storagePath || '' })) } }));
  }, []);

  const getFilteredItems = useCallback((objectiveId: string) => {
    return items.filter(item => {
      if ('objectiveId' in item && item.objectiveId !== objectiveId) return false;
      if ('sectionId' in item && (item as any).sectionId !== objectiveId) return false;
      if (searchQuery && !item.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        const response = responses[item.id];
        if (statusFilter === null && response?.status) return false;
        if (statusFilter && response?.status !== statusFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter, responses]);

  const has3Level = objectives.length > 0;

  // Get active item IDs (exclude items in inactive sections)
  const activeItemIds = useMemo(() => {
    if (!has3Level && !objectives.length) return new Set(items.map(i => i.id));
    const activeSectionIds = sections.filter(s => !inactiveSections.has(s.id)).map(s => s.id);
    const activeObjIds = objectives.filter(o => activeSectionIds.includes(o.sectionId)).map(o => o.id);
    return new Set(items.filter(i => 'objectiveId' in i ? activeObjIds.includes((i as any).objectiveId) : true).map(i => i.id));
  }, [items, sections, objectives, inactiveSections, has3Level]);

  // Build global item number map for active items (sequential numbering for cross-referencing with photos)
  const itemNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    let num = 1;
    for (const section of sections.filter(s => !inactiveSections.has(s.id))) {
      const sectionObjs = objectives.filter(o => o.sectionId === section.id);
      if (sectionObjs.length > 0) {
        for (const obj of sectionObjs) {
          for (const item of items.filter(i => (i as any).objectiveId === obj.id)) {
            map[item.id] = num++;
          }
        }
      } else {
        for (const item of items.filter(i => (i as any).sectionId === section.id)) {
          map[item.id] = num++;
        }
      }
    }
    return map;
  }, [items, sections, objectives, inactiveSections]);

  const allResponses = useMemo(() => Object.values(responses).filter(r => r.status) as AuditItemResponse[], [responses]);
  const activeResponses = useMemo(() => {
    return Object.entries(responses).filter(([id, r]) => r.status && activeItemIds.has(id)).map(([_, r]) => r) as AuditItemResponse[];
  }, [responses, activeItemIds]);
  const activeItemCount = useMemo(() => items.filter(i => activeItemIds.has(i.id)).length, [items, activeItemIds]);
  const metrics = calculateCompliance(activeResponses, activeItemCount);
  const completionPct = activeItemCount > 0 ? Math.round(((metrics.compliantCount + metrics.nonCompliantCount + metrics.notedCount) / metrics.totalItems) * 100) : 0;

  const handleSaveDraft = async () => {
    let currentAuditId = auditId;

    // Auto-create audit if none exists yet
    if (!currentAuditId) {
      if (!projectId || !templateId) {
        const { toast } = await import('sonner');
        toast.info('Select a project and template first.');
        return;
      }
      try {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const newAudit = await createAudit.mutateAsync({
          project_id: projectId,
          template_id: templateId,
          period,
          type: 'monthly',
        });
        currentAuditId = newAudit.id;
        // Update URL with new auditId so subsequent saves use it
        const params = new URLSearchParams(searchParams);
        params.set('auditId', currentAuditId);
        navigate(`/audits/capture?${params.toString()}`, { replace: true });
      } catch {
        return; // error toast already shown by useCreateAudit
      }
    }

    const responsesToSave = Object.entries(responses)
      .filter(([_, r]) => r.status)
      .map(([checklistItemId, r]) => ({
        checklist_item_id: checklistItemId,
        status: (r.status === 'N/A' ? 'NA' : r.status) as 'C' | 'NC' | 'NA' | null,
        comments: r.comments || '', actions: r.actions || '',
        photos: r.photos?.map(p => ({
          id: p.id || '',
          url: p.url || '',
          caption: p.caption || '',
          gpsLocation: p.gpsLocation,
          exifDate: p.timestamp,
          storagePath: (p as any).storagePath || '',
        })) || [],
      }));

    const overrides = sections.map(s => ({ section_id: s.id, is_active: !inactiveSections.has(s.id) }));
    await Promise.all([
      saveResponses.mutateAsync({ auditId: currentAuditId, responses: responsesToSave }),
      saveSectionOverrides.mutateAsync({ auditId: currentAuditId, overrides }),
    ]);
  };

  const handleSubmitAudit = async () => {
    if (!auditId && !projectId) return;
    await handleSaveDraft();
    const id = auditId || searchParams.get('auditId');
    if (!id) return;
    if (!confirm('Submit this audit for review? A reviewer will be notified.')) return;
    await submitForReview.mutateAsync(id);
  };

  const handleReopenAudit = async () => {
    if (!auditId) return;
    const reason = prompt('Reason for revision (optional):');
    if (reason === null) return; // cancelled
    await reopenAudit.mutateAsync({ auditId, reason: reason || undefined });
  };

  const projectTemplates = projectId ? (allPT?.filter(pt => pt.project_id === projectId) || []) : [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Project & Template Navigation */}
      <div className="flex flex-wrap items-center gap-3 bg-card border rounded-lg px-4 py-2.5">
        <label className="text-xs font-medium text-muted-foreground">Project:</label>
        <select
          value={projectId || ''}
          onChange={e => {
            if (e.target.value) navigate(`/audits/capture?projectId=${e.target.value}`);
            else navigate('/audits');
          }}
          className="h-8 rounded-md border bg-background px-2 text-sm min-w-[180px]"
        >
          <option value="">Select project…</option>
          {projects?.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
        </select>

        {projectId && projectTemplates.length > 0 && (
          <>
            <label className="text-xs font-medium text-muted-foreground ml-2">Template:</label>
            <select
              value={templateId || ''}
              onChange={e => {
                const params = new URLSearchParams();
                params.set('projectId', projectId);
                params.set('templateId', e.target.value);
                navigate(`/audits/capture?${params.toString()}`);
              }}
              className="h-8 rounded-md border bg-background px-2 text-sm min-w-[180px]"
            >
              <option value="">Pick template…</option>
              {projectTemplates.map(pt => (
                <option key={pt.template_id} value={pt.template_id}>
                  {(pt.checklist_templates as any)?.name}
                </option>
              ))}
            </select>
          </>
        )}

        {projectId && templateId && (() => {
          const templateAudits = auditInstances?.filter(a => a.template_id === templateId) || [];
          if (templateAudits.length === 0) return null;
          return (
            <>
              <label className="text-xs font-medium text-muted-foreground ml-2">Audit:</label>
              <select
                value={auditId || ''}
                onChange={e => {
                  const params = new URLSearchParams();
                  params.set('projectId', projectId);
                  params.set('templateId', templateId);
                  if (e.target.value) params.set('auditId', e.target.value);
                  navigate(`/audits/capture?${params.toString()}`);
                }}
                className="h-8 rounded-md border bg-background px-2 text-sm min-w-[180px]"
              >
                <option value="">+ New audit</option>
                {templateAudits.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.period} — {a.status}{a.status === 'draft' ? ' (continue)' : ''}
                  </option>
                ))}
              </select>
            </>
          );
        })()}
      </div>

      {isAmendmentsRequested && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <MessageSquare size={14} />
            <span className="font-medium">Amendments requested by reviewer — address the comments below then resubmit.</span>
          </div>
          {reviewComments && reviewComments.filter(c => c.status === 'open').length > 0 && (
            <div className="space-y-2">
              {reviewComments.filter(c => c.status === 'open').map(c => (
                <div key={c.id} className="flex items-start gap-2 bg-white border rounded-md px-3 py-2 text-sm">
                  <MessageSquare size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="flex-1 break-words">{c.comment}</p>
                  <button onClick={() => resolveComment.mutate({ commentId: c.id, auditId: c.audit_id })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex-shrink-0">
                    <CheckCircle2 size={10} /> Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLocked && (
        <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock size={14} />
            <span className="font-medium">
              {currentAuditInstance?.status === 'approved' ? 'This audit has been approved.' :
               currentAuditInstance?.status === 'under_review' ? 'This audit is under review.' :
               'This audit has been submitted and is locked.'}
            </span>
            {revisionCount > 0 && <span className="text-xs opacity-75">• Revision {revisionCount}{lastRevisedAt ? ` (${new Date(lastRevisedAt).toLocaleDateString()})` : ''}</span>}
          </div>
          {(currentAuditInstance?.status === 'submitted' || currentAuditInstance?.status === 'approved') && (
            <button onClick={handleReopenAudit} disabled={reopenAudit.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {reopenAudit.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Reopen for Revision
            </button>
          )}
        </div>
      )}

      {/* Revision Log */}
      {revisionLog && revisionLog.length > 0 && (
        <details className="bg-card border rounded-lg overflow-hidden">
          <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">
            <History size={14} className="text-muted-foreground" />
            Revision History ({revisionLog.length})
          </summary>
          <div className="border-t divide-y">
            {revisionLog.map(log => (
              <div key={log.id} className="px-4 py-2 text-xs flex items-center gap-4">
                <span className="font-medium text-foreground">Rev {log.revision_number}</span>
                <span className="text-muted-foreground">{new Date(log.revised_at).toLocaleString()}</span>
                <span className="text-muted-foreground">from <span className="font-medium">{log.previous_status}</span></span>
                {log.reason && <span className="text-muted-foreground italic">— {log.reason}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">
            {currentProject ? currentProject.name : 'Audit Capture'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isLocked ? `Submitted${currentAuditInstance?.submitted_at ? ` on ${new Date(currentAuditInstance.submitted_at).toLocaleDateString()}` : ''}${revisionCount > 0 ? ` • Rev ${revisionCount}` : ''}` : auditId ? `Audit in progress${revisionCount > 0 ? ` (Revision ${revisionCount})` : ''}` : projectId ? 'Select a template and start an audit' : 'Demo mode — create audit from Projects to persist'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {completionPct}% complete • {metrics.compliancePercentage}% compliant
          </span>
          {!isLocked && !isAmendmentsRequested && (
            <>
              <button onClick={handleSaveDraft} disabled={saveResponses.isPending || createAudit.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {(saveResponses.isPending || createAudit.isPending) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Draft
              </button>
              <button onClick={handleSubmitAudit} disabled={submitForReview.isPending || saveResponses.isPending || completionPct === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {submitForReview.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit for Review
              </button>
            </>
          )}
          {isAmendmentsRequested && (
            <>
              <button onClick={handleSaveDraft} disabled={saveResponses.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saveResponses.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
              </button>
              <button onClick={handleSubmitAudit} disabled={submitForReview.isPending || saveResponses.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {submitForReview.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Resubmit for Review
              </button>
            </>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium">
              <Lock size={14} /> Locked
            </span>
          )}
        </div>
      </div>

      {/* Live Metrics Bar */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full status-dot-compliant" /><span className="text-muted-foreground">C:</span><span className="font-semibold text-foreground">{metrics.compliantCount}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full status-dot-nc" /><span className="text-muted-foreground">NC:</span><span className="font-semibold text-foreground">{metrics.nonCompliantCount}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full status-dot-noted" /><span className="text-muted-foreground">N/A:</span><span className="font-semibold text-foreground">{metrics.notedCount}</span></div>
        <div className="flex items-center gap-1.5"><span className="text-muted-foreground">Unanswered:</span><span className="font-semibold text-foreground">{metrics.unansweredCount}</span></div>
        <div className="ml-auto flex items-center gap-1.5"><span className="text-muted-foreground">Compliance:</span><span className="font-bold text-primary text-sm">{metrics.compliancePercentage}%</span></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search conditions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)} className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none">
          <option value="all">All Sources</option><option value="EA">EA Only</option><option value="EMPr">EMPr Only</option>
        </select>
        <select value={statusFilter || 'all'} onChange={e => setStatusFilter(e.target.value === 'all' ? 'all' : e.target.value as ComplianceStatus)} className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none">
          <option value="all">All Statuses</option><option value="C">Compliant</option><option value="NC">Non-Compliant</option><option value="N/A">N/A / Noted</option>
        </select>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {sections.filter(s => sourceFilter === 'all' || s.source === sourceFilter).map(section => {
          const isExpanded = expandedSections.has(section.id);
          const isSectionInactive = inactiveSections.has(section.id);
          const sectionObjectives = has3Level
            ? objectives.filter(o => o.sectionId === section.id)
            : [{ id: section.id, name: section.name, sectionId: section.id, source: section.source, order: 0 }];
          const sectionItemCount = sectionObjectives.reduce((acc, obj) => acc + getFilteredItems(obj.id).length, 0);
          if (sectionItemCount === 0 && (searchQuery || statusFilter !== 'all')) return null;
          const sectionResponded = sectionObjectives.reduce((acc, obj) => acc + getFilteredItems(obj.id).filter(i => responses[i.id]?.status).length, 0);

          return (
            <div key={section.id} className={`bg-card border rounded-lg overflow-hidden ${isSectionInactive ? 'opacity-60' : ''}`}>
              <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <button onClick={() => toggleSection(section.id)} className="flex items-center gap-3 flex-1 text-left">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${section.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>{section.source}</span>
                  <span className={`text-sm font-semibold flex-1 ${isSectionInactive ? 'line-through text-muted-foreground' : ''}`}>{section.name}</span>
                </button>
                {isSectionInactive && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">Inactive</span>}
                <span className="text-xs text-muted-foreground">{sectionResponded}/{sectionItemCount}</span>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${sectionItemCount ? (sectionResponded / sectionItemCount) * 100 : 0}%` }} /></div>
                {!isLocked && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSectionActive(section.id); }}
                  className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${isSectionInactive ? 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary' : 'bg-primary/10 text-primary hover:bg-muted hover:text-muted-foreground'}`}
                  title={isSectionInactive ? 'Mark phase as active' : 'Mark phase as inactive'}
                >
                  {isSectionInactive ? 'Activate' : 'Deactivate'}
                </button>
                )}
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t">
                      {sectionObjectives.map(obj => {
                        const objItems = getFilteredItems(obj.id);
                        if (objItems.length === 0) return null;
                        const isObjExpanded = has3Level ? expandedObjectives.has(obj.id) : true;
                        return (
                          <div key={obj.id}>
                            {has3Level && (
                              <button onClick={() => toggleObjective(obj.id)} className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/10 transition-colors text-left border-b bg-muted/5">
                                {isObjExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span className="text-sm font-medium flex-1 text-foreground/80">{obj.name}</span>
                                <span className="text-xs text-muted-foreground">{objItems.length} tasks</span>
                              </button>
                            )}
                            {isObjExpanded && (
                              <div className="divide-y">
                                {objItems.map(item => {
                                  const response = responses[item.id];
                                  const isRowExpanded = expandedRows.has(item.id);
                                  return (
                                    <div key={item.id} className="group">
                                      <div className="flex items-start gap-2 px-4 py-3 hover:bg-muted/20">
                                        <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5 mt-0.5 flex-shrink-0 min-w-[24px] text-center">#{itemNumberMap[item.id]}</span>
                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getStatusDotClass(response?.status as ComplianceStatus || null)}`} />
                                        <span className="text-xs text-muted-foreground w-10 flex-shrink-0 pt-0.5">{item.conditionRef}</span>
                                        <button onClick={() => toggleRow(item.id)} className="flex-1 text-left text-sm leading-relaxed min-w-0">
                                          <span className={`${isRowExpanded ? '' : 'line-clamp-2'}`}>{item.description}</span>
                                        </button>
                                        {/* Reviewed flag */}
                                        {reviewComments?.some(c => c.checklist_item_id === item.id && c.status === 'reviewed') && (
                                          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5">
                                            <CheckCircle2 size={10} /> Reviewed
                                          </span>
                                        )}
                                        <div className="flex gap-1 flex-shrink-0">
                                          {STATUS_OPTIONS.map(opt => (
                                            <button key={opt.value} onClick={() => !isLocked && setStatus(item.id, opt.value)} disabled={isLocked}
                                              className={`px-2 py-1 rounded text-xs font-medium transition-all ${response?.status === opt.value ? opt.color : 'bg-muted/50 text-muted-foreground hover:bg-muted'} ${isLocked ? 'cursor-not-allowed' : ''}`} title={opt.label}>
                                              {opt.shortLabel}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      {/* Inline review comments for this item */}
                                      {(() => {
                                        const itemComments = reviewComments?.filter(c => c.checklist_item_id === item.id && c.status === 'open');
                                        if (!itemComments?.length) return null;
                                        return (
                                          <div className="mx-4 mb-1 mt-0 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-md px-3 py-2">
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <MessageSquare size={12} className="text-amber-600" />
                                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Reviewer Comments</span>
                                            </div>
                                            {itemComments.map(c => (
                                              <div key={c.id} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 mt-1">
                                                <span className="flex-1">"{c.comment}"</span>
                                                {!isLocked && (
                                                  <button onClick={() => resolveComment.mutate({ commentId: c.id, auditId: auditId! })}
                                                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 flex-shrink-0">
                                                    <CheckCircle2 size={10} /> Resolve
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                      <AnimatePresence>
                                        {isRowExpanded && (
                                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="px-4 pb-3 pl-16 grid grid-cols-1 md:grid-cols-2 gap-3">
                                              <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Audit Evidence / Comments</label>
                                                <textarea value={response?.comments || ''} onChange={e => setComment(item.id, e.target.value)} placeholder="Enter audit observations..." rows={3} disabled={isLocked}
                                                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                                              </div>
                                              <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actions / Recommendations</label>
                                                <textarea value={response?.actions || ''} onChange={e => setAction(item.id, e.target.value)} placeholder="Enter corrective actions..." rows={3} disabled={isLocked}
                                                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                                              </div>
                                              <div className="md:col-span-2">
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo Evidence (Item #{itemNumberMap[item.id]})</label>
                                                <PhotoUpload responseId={response?.id || item.id}
                                                  photos={response?.photos?.map(p => ({ id: p.id, url: p.url, caption: p.caption, gpsLocation: p.gpsLocation, exifDate: p.timestamp, storagePath: (p as any).storagePath || '' })) || []}
                                                  onPhotosChange={(photos) => handlePhotosChange(item.id, photos.map(p => ({ id: p.id || '', url: p.url, caption: p.caption, timestamp: p.exifDate || '', gpsLocation: p.gpsLocation, storagePath: p.storagePath })))}
                                                  disabled={isLocked} />
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
