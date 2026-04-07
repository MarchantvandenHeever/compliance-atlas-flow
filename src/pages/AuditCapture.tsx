import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Camera, Save, Filter, Search } from 'lucide-react';
import { defaultTemplate } from '@/data/checklistData';
import { ComplianceStatus, AuditItemResponse } from '@/types';
import { calculateCompliance, getStatusDotClass } from '@/lib/compliance';
import StatusBadge from '@/components/StatusBadge';

const STATUS_OPTIONS: { value: ComplianceStatus; label: string; shortLabel: string; color: string }[] = [
  { value: 'C', label: 'Compliant', shortLabel: 'C', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { value: 'NC', label: 'Non-Compliant', shortLabel: 'NC', color: 'bg-red-500 hover:bg-red-600 text-white' },
  { value: 'N/A', label: 'N/A / Noted', shortLabel: 'N/A', color: 'bg-gray-400 hover:bg-gray-500 text-white' },
];

export default function AuditCapture() {
  const [responses, setResponses] = useState<Record<string, Partial<AuditItemResponse>>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(defaultTemplate.sections.map(s => s.id)));
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'EA' | 'EMPr'>('all');

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }, []);

  const toggleRow = useCallback((itemId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }, []);

  const setStatus = useCallback((itemId: string, status: ComplianceStatus) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status, lastEditedAt: new Date().toISOString(), editedBy: 'Brain Green' }
    }));
  }, []);

  const setComment = useCallback((itemId: string, comments: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], comments }
    }));
  }, []);

  const setAction = useCallback((itemId: string, actions: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], actions }
    }));
  }, []);

  const filteredSections = useMemo(() => {
    return defaultTemplate.sections
      .filter(s => sourceFilter === 'all' || s.source === sourceFilter)
      .map(section => ({
        ...section,
        items: defaultTemplate.items.filter(item => {
          if (item.sectionId !== section.id) return false;
          if (searchQuery && !item.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
          if (statusFilter !== 'all') {
            const response = responses[item.id];
            if (statusFilter === null && response?.status) return false;
            if (statusFilter && response?.status !== statusFilter) return false;
          }
          return true;
        })
      }))
      .filter(s => s.items.length > 0);
  }, [sourceFilter, searchQuery, statusFilter, responses]);

  const allResponses = useMemo(() => {
    return Object.values(responses).filter(r => r.status) as AuditItemResponse[];
  }, [responses]);

  const metrics = calculateCompliance(allResponses, defaultTemplate.items.length);

  const completionPct = Math.round(((metrics.compliantCount + metrics.nonCompliantCount + metrics.notedCount) / metrics.totalItems) * 100);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Audit Capture</h2>
          <p className="text-sm text-muted-foreground">March 2026 — Monthly Audit</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {completionPct}% complete • {metrics.compliancePercentage}% compliant
          </span>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Save size={14} /> Save Draft
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
            type="text"
            placeholder="Search conditions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value as 'all' | 'EA' | 'EMPr')}
          className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none"
        >
          <option value="all">All Sources</option>
          <option value="EA">EA Only</option>
          <option value="EMPr">EMPr Only</option>
        </select>
        <select
          value={statusFilter || 'all'}
          onChange={e => setStatusFilter(e.target.value === 'all' ? 'all' : e.target.value as ComplianceStatus)}
          className="px-3 py-2 rounded-md border bg-card text-sm focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="C">Compliant</option>
          <option value="NC">Non-Compliant</option>
          <option value="N/A">N/A / Noted</option>
        </select>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {filteredSections.map(section => {
          const isExpanded = expandedSections.has(section.id);
          const sectionResponses = section.items.map(i => responses[i.id]).filter(r => r?.status);
          const sectionComplete = sectionResponses.length;
          const sectionTotal = section.items.length;

          return (
            <div key={section.id} className="bg-card border rounded-lg overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  section.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                }`}>
                  {section.source}
                </span>
                <span className="text-sm font-medium flex-1">{section.name}</span>
                <span className="text-xs text-muted-foreground">{sectionComplete}/{sectionTotal}</span>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(sectionComplete / sectionTotal) * 100}%` }} />
                </div>
              </button>

              {/* Items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t divide-y">
                      {section.items.map(item => {
                        const response = responses[item.id];
                        const isRowExpanded = expandedRows.has(item.id);

                        return (
                          <div key={item.id} className="group">
                            {/* Main row */}
                            <div className="flex items-start gap-2 px-4 py-3 hover:bg-muted/20">
                              {/* Status dot */}
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getStatusDotClass(response?.status as ComplianceStatus || null)}`} />

                              {/* Ref */}
                              <span className="text-xs text-muted-foreground w-10 flex-shrink-0 pt-0.5">{item.conditionRef}</span>

                              {/* Description */}
                              <button
                                onClick={() => toggleRow(item.id)}
                                className="flex-1 text-left text-sm leading-relaxed min-w-0"
                              >
                                <span className={`${isRowExpanded ? '' : 'line-clamp-2'}`}>{item.description}</span>
                              </button>

                              {/* Status buttons */}
                              <div className="flex gap-1 flex-shrink-0">
                                {STATUS_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setStatus(item.id, opt.value)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      response?.status === opt.value
                                        ? opt.color
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    }`}
                                    title={opt.label}
                                  >
                                    {opt.shortLabel}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Expanded detail */}
                            <AnimatePresence>
                              {isRowExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-3 pl-16 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Audit Evidence / Comments</label>
                                      <textarea
                                        value={response?.comments || ''}
                                        onChange={e => setComment(item.id, e.target.value)}
                                        placeholder="Enter audit observations..."
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Actions / Recommendations</label>
                                      <textarea
                                        value={response?.actions || ''}
                                        onChange={e => setAction(item.id, e.target.value)}
                                        placeholder="Enter corrective actions..."
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo Evidence</label>
                                      <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                        <Camera size={14} /> Attach Photo
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
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
