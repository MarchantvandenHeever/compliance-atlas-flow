import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Save, Search, Loader2 } from 'lucide-react';
import { useTemplateSections, useTemplateObjectives, useTemplateItems } from '@/hooks/useTemplates';
import { useAuditResponses, useSaveAuditResponses } from '@/hooks/useAuditData';
import { calculateCompliance, getStatusDotClass } from '@/lib/compliance';
import { ComplianceStatus, AuditItemResponse } from '@/types';
import PhotoUpload from '@/components/PhotoUpload';
import { useSearchParams } from 'react-router-dom';
import { defaultTemplate } from '@/data/checklistData';

const STATUS_OPTIONS: { value: ComplianceStatus; label: string; shortLabel: string; color: string }[] = [
  { value: 'C', label: 'Compliant', shortLabel: 'C', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { value: 'NC', label: 'Non-Compliant', shortLabel: 'NC', color: 'bg-red-500 hover:bg-red-600 text-white' },
  { value: 'N/A', label: 'N/A / Noted', shortLabel: 'N/A', color: 'bg-gray-400 hover:bg-gray-500 text-white' },
];

export default function AuditCapture() {
  const [searchParams] = useSearchParams();
  const auditId = searchParams.get('auditId');
  const templateId = searchParams.get('templateId');

  const { data: dbSections } = useTemplateSections(templateId || undefined);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbObjectives } = useTemplateObjectives(sectionIds);
  const objectiveIds = dbObjectives?.map(o => o.id);
  const { data: dbItems } = useTemplateItems(objectiveIds);
  const { data: dbResponses } = useAuditResponses(auditId || undefined);
  const saveResponses = useSaveAuditResponses();

  // Build flat items list for compliance calculation
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
          id: r.id,
          status: status as ComplianceStatus,
          comments: r.comments || '',
          actions: r.actions || '',
          photos: r.response_photos?.map((p: any) => ({
            id: p.id, url: '', caption: p.caption || '', timestamp: p.upload_date, gpsLocation: p.gps_location,
          })) || [],
        };
      });
      setResponses(prev => ({ ...mapped, ...prev }));
    }
  }, [dbResponses]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'EA' | 'EMPr'>('all');

  useMemo(() => {
    if (sections.length && expandedSections.size === 0) {
      setExpandedSections(new Set(sections.map(s => s.id)));
      if (objectives.length) {
        setExpandedObjectives(new Set(objectives.map(o => o.id)));
      }
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

  const setStatus = useCallback((itemId: string, status: ComplianceStatus) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status, lastEditedAt: new Date().toISOString() }
    }));
  }, []);

  const setComment = useCallback((itemId: string, comments: string) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], comments } }));
  }, []);

  const setAction = useCallback((itemId: string, actions: string) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], actions } }));
  }, []);

  const handlePhotosChange = useCallback((itemId: string, photos: any[]) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], photos } }));
  }, []);

  // Filter items based on search, source, status
  const getFilteredItems = useCallback((objectiveId: string) => {
    return items.filter(item => {
      if ('objectiveId' in item && item.objectiveId !== objectiveId) return false;
      if ('sectionId' in item && item.sectionId !== objectiveId) return false;
      if (searchQuery && !item.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        const response = responses[item.id];
        if (statusFilter === null && response?.status) return false;
        if (statusFilter && response?.status !== statusFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter, responses]);

  const allResponses = useMemo(() => {
    return Object.values(responses).filter(r => r.status) as AuditItemResponse[];
  }, [responses]);

  const metrics = calculateCompliance(allResponses, items.length);
  const completionPct = Math.round(((metrics.compliantCount + metrics.nonCompliantCount + metrics.notedCount) / metrics.totalItems) * 100);

  const handleSaveDraft = async () => {
    if (!auditId) {
      const { toast } = await import('sonner');
      toast.info('Create an audit from the Projects page to save to database. Local state preserved.');
      return;
    }
    const responsesToSave = Object.entries(responses)
      .filter(([_, r]) => r.status)
      .map(([checklistItemId, r]) => ({
        checklist_item_id: checklistItemId,
        status: (r.status === 'N/A' ? 'NA' : r.status) as 'C' | 'NC' | 'NA' | null,
        comments: r.comments || '',
        actions: r.actions || '',
      }));
    await saveResponses.mutateAsync({ auditId, responses: responsesToSave });
  };

  // Determine if we have the 3-level structure
  const has3Level = objectives.length > 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Audit Capture</h2>
          <p className="text-sm text-muted-foreground">
            {auditId ? 'Audit in progress' : 'Demo mode — create audit from Projects to persist'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {completionPct}% complete • {metrics.compliancePercentage}% compliant
          </span>
          <button
            onClick={handleSaveDraft}
            disabled={saveResponses.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveResponses.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
        </div>
      </div>

      {/* Live Metrics Bar */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full status-dot-compliant" />
          <span className="text-muted-foreground">C:</span>
          <span className="font-semibold text-foreground">{metrics.compliantCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full status-dot-nc" />
          <span className="text-muted-foreground">NC:</span>
          <span className="font-semibold text-foreground">{metrics.nonCompliantCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full status-dot-noted" />
          <span className="text-muted-foreground">N/A:</span>
          <span className="font-semibold text-foreground">{metrics.notedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Unanswered:</span>
          <span className="font-semibold text-foreground">{metrics.unansweredCount}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-muted-foreground">Compliance:</span>
          <span className="font-bold text-primary text-sm">{metrics.compliancePercentage}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" placeholder="Search conditions..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)}
          className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none">
          <option value="all">All Sources</option>
          <option value="EA">EA Only</option>
          <option value="EMPr">EMPr Only</option>
        </select>
        <select value={statusFilter || 'all'} onChange={e => setStatusFilter(e.target.value === 'all' ? 'all' : e.target.value as ComplianceStatus)}
          className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="C">Compliant</option>
          <option value="NC">Non-Compliant</option>
          <option value="N/A">N/A / Noted</option>
        </select>
      </div>

      {/* Checklist — 3-level or 2-level */}
      <div className="space-y-2">
        {sections
          .filter(s => sourceFilter === 'all' || s.source === sourceFilter)
          .map(section => {
            const isExpanded = expandedSections.has(section.id);
            const sectionObjectives = has3Level
              ? objectives.filter(o => o.sectionId === section.id)
              : [{ id: section.id, name: section.name, sectionId: section.id, source: section.source, order: 0 }];

            const sectionItemCount = sectionObjectives.reduce((acc, obj) => acc + getFilteredItems(obj.id).length, 0);
            if (sectionItemCount === 0 && (searchQuery || statusFilter !== 'all')) return null;

            const sectionResponded = sectionObjectives.reduce((acc, obj) => {
              return acc + getFilteredItems(obj.id).filter(i => responses[i.id]?.status).length;
            }, 0);

            return (
              <div key={section.id} className="bg-card border rounded-lg overflow-hidden">
                <button onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${section.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                    {section.source}
                  </span>
                  <span className="text-sm font-semibold flex-1">{section.name}</span>
                  <span className="text-xs text-muted-foreground">{sectionResponded}/{sectionItemCount}</span>
                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${sectionItemCount ? (sectionResponded / sectionItemCount) * 100 : 0}%` }} />
                  </div>
                </button>

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
                                <button onClick={() => toggleObjective(obj.id)}
                                  className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/10 transition-colors text-left border-b bg-muted/5">
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
                                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getStatusDotClass(response?.status as ComplianceStatus || null)}`} />
                                          <span className="text-xs text-muted-foreground w-10 flex-shrink-0 pt-0.5">{item.conditionRef}</span>
                                          <button onClick={() => toggleRow(item.id)} className="flex-1 text-left text-sm leading-relaxed min-w-0">
                                            <span className={`${isRowExpanded ? '' : 'line-clamp-2'}`}>{item.description}</span>
                                          </button>
                                          <div className="flex gap-1 flex-shrink-0">
                                            {STATUS_OPTIONS.map(opt => (
                                              <button key={opt.value} onClick={() => setStatus(item.id, opt.value)}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                                  response?.status === opt.value ? opt.color : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                                }`} title={opt.label}>
                                                {opt.shortLabel}
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        <AnimatePresence>
                                          {isRowExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                              <div className="px-4 pb-3 pl-16 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Audit Evidence / Comments</label>
                                                  <textarea value={response?.comments || ''} onChange={e => setComment(item.id, e.target.value)}
                                                    placeholder="Enter audit observations..." rows={3}
                                                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Actions / Recommendations</label>
                                                  <textarea value={response?.actions || ''} onChange={e => setAction(item.id, e.target.value)}
                                                    placeholder="Enter corrective actions..." rows={3}
                                                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                                                </div>
                                                <div className="md:col-span-2">
                                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo Evidence</label>
                                                  <PhotoUpload
                                                    responseId={response?.id || item.id}
                                                    photos={response?.photos?.map(p => ({
                                                      url: p.url, caption: p.caption, gpsLocation: p.gpsLocation,
                                                      exifDate: p.timestamp, storagePath: '',
                                                    })) || []}
                                                    onPhotosChange={(photos) => handlePhotosChange(item.id, photos.map(p => ({
                                                      id: '', url: p.url, caption: p.caption, timestamp: p.exifDate || '',
                                                      gpsLocation: p.gpsLocation,
                                                    })))}
                                                    disabled={false}
                                                  />
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
