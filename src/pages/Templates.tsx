import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight, Upload,
  Loader2, Trash2, Eye, MoreVertical,
} from 'lucide-react';
import { useTemplates, useTemplateSections, useTemplateObjectives, useTemplateItems, useImportChecklist, useDeleteTemplate } from '@/hooks/useTemplates';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function Templates() {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { data: dbTemplates, isLoading } = useTemplates();
  const importChecklist = useImportChecklist();
  const deleteTemplate = useDeleteTemplate();
  const fileRef = useRef<HTMLInputElement>(null);

  const viewingTemplate = selectedTemplateId
    ? dbTemplates?.find(t => t.id === selectedTemplateId)
    : dbTemplates?.[0];

  const { data: dbSections } = useTemplateSections(viewingTemplate?.id);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbObjectives } = useTemplateObjectives(sectionIds);
  const objectiveIds = dbObjectives?.map(o => o.id);
  const { data: dbItems } = useTemplateItems(objectiveIds);

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleObjective = (id: string) => {
    setExpandedObjectives(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });

      // 3-level structure: Phase → Objective → Task
      type TaskItem = { ref: string; desc: string; source: 'EA' | 'EMPr' };
      type ObjItem = { name: string; source: 'EA' | 'EMPr'; tasks: TaskItem[] };
      type PhaseItem = { name: string; source: 'EA' | 'EMPr'; objectives: ObjItem[] };
      const phasesMap = new Map<string, PhaseItem>();
      const skipSheetPattern = /contents|summary|cover|index|^toc$/i;

      for (const sheetName of wb.SheetNames) {
        if (skipSheetPattern.test(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) continue;

        const sheetSource: 'EA' | 'EMPr' = /empr/i.test(sheetName) ? 'EMPr' : 'EA';

        // Find header row
        const headerIdx = rows.findIndex(r =>
          r.some(c => typeof c === 'string' && /description|phase|objective/i.test(String(c).trim()))
        );
        if (headerIdx < 0) continue;

        const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        const phaseCol = headers.findIndex(h => /^phase$/i.test(h));
        const objCol = headers.findIndex(h => /^objective$/i.test(h));
        const descCol = headers.findIndex(h => /^description$|requirement|condition\s+desc/i.test(h));
        const refCol = headers.findIndex(h => /condition\s*no|ref|number|^no\.?$|^score$/i.test(h));

        if (descCol < 0) continue;

        // Track current phase/objective names for rows that leave those cells blank
        let currentPhaseName = '';
        let currentObjName = '';

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          const rawPhase = phaseCol >= 0 ? String(row[phaseCol] || '').trim() : '';
          const rawObj = objCol >= 0 ? String(row[objCol] || '').trim() : '';
          const descVal = String(row[descCol] || '').trim();
          const refVal = refCol >= 0 ? String(row[refCol] || '').trim() : '';

          // Update current phase/objective when a new value appears
          if (rawPhase) currentPhaseName = rawPhase;
          if (rawObj) currentObjName = rawObj;

          // If no phase name yet, use the sheet name
          if (!currentPhaseName) currentPhaseName = sheetName;

          // Skip rows that are only phase/objective headers with no description
          if (!descVal) continue;

          // If the description looks like an objective header and no explicit objective column exists
          if (objCol < 0 && !rawObj && /^objective\s+\d/i.test(descVal)) {
            currentObjName = descVal;
            continue;
          }

          if (!currentObjName) currentObjName = 'General';

          // Get or create phase
          if (!phasesMap.has(currentPhaseName)) {
            phasesMap.set(currentPhaseName, { name: currentPhaseName, source: sheetSource, objectives: [] });
          }
          const phase = phasesMap.get(currentPhaseName)!;

          // Get or create objective within phase
          let objective = phase.objectives.find(o => o.name === currentObjName);
          if (!objective) {
            objective = { name: currentObjName, source: sheetSource, tasks: [] };
            phase.objectives.push(objective);
          }

          objective.tasks.push({ ref: refVal, desc: descVal, source: sheetSource });
        }
      }

      const phasesArr = Array.from(phasesMap.values()).filter(p => p.objectives.length > 0);

      if (phasesArr.length === 0) {
        toast.error('No checklist data found. Ensure sheets contain a "Description" column header.');
        return;
      }

      // Flatten to indexed arrays for the mutation
      const phases = phasesArr.map((p, i) => ({ name: p.name, source: p.source, sort_order: i }));
      const objectives: Array<{ phaseIndex: number; name: string; source: 'EA' | 'EMPr'; sort_order: number }> = [];
      const tasks: Array<{ objectiveIndex: number; condition_ref: string; description: string; source: 'EA' | 'EMPr'; sort_order: number }> = [];

      phasesArr.forEach((phase, pi) => {
        phase.objectives.forEach((obj, oi) => {
          const objGlobalIdx = objectives.length;
          objectives.push({ phaseIndex: pi, name: obj.name, source: obj.source, sort_order: oi });
          obj.tasks.forEach((task, ti) => {
            tasks.push({ objectiveIndex: objGlobalIdx, condition_ref: task.ref, description: task.desc, source: task.source, sort_order: ti });
          });
        });
      });

      await importChecklist.mutateAsync({ name: file.name.replace(/\.\w+$/, ''), phases, objectives, tasks });
      toast.success(`Imported ${phases.length} phases, ${objectives.length} objectives, ${tasks.length} tasks`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse checklist');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTemplate.mutateAsync(deleteTarget.id);
    if (selectedTemplateId === deleteTarget.id) setSelectedTemplateId(null);
    setDeleteTarget(null);
  };

  const totalItems = dbItems?.length || 0;
  const totalObjectives = dbObjectives?.length || 0;
  const totalPhases = dbSections?.length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Template Repository</h2>
          <p className="text-sm text-muted-foreground">Import, manage, and assign checklist templates to projects</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={importChecklist.isPending} size="sm">
            {importChecklist.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import Template
          </Button>
        </div>
      </div>

      {/* Template Repository List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : !dbTemplates?.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
          <FileSpreadsheet className="mx-auto mb-3 text-muted-foreground" size={40} />
          <h3 className="text-sm font-semibold mb-1">No templates yet</h3>
          <p className="text-xs text-muted-foreground mb-4">Import an Excel checklist to create your first template</p>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dbTemplates.map(t => {
            const isViewing = viewingTemplate?.id === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-lg p-4 cursor-pointer transition-all ${
                  isViewing ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'
                }`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isViewing ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                    }`}>
                      <FileSpreadsheet size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        v{t.version} • {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <button className="p-1 rounded hover:bg-muted transition-colors">
                        <MoreVertical size={14} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTemplateId(t.id); }}>
                        <Eye size={14} /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: t.id, name: t.name }); }}
                      >
                        <Trash2 size={14} /> Delete Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {t.is_active && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                      <CheckCircle2 size={10} /> Active
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Template Detail View — 3-Level Hierarchy */}
      {viewingTemplate && dbSections && dbSections.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{viewingTemplate.name}</h3>
                  <CheckCircle2 size={14} className="text-success" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Version {viewingTemplate.version} • {totalPhases} phases • {totalObjectives} objectives • {totalItems} tasks
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y">
            {dbSections.map(phase => {
              const phaseObjectives = dbObjectives?.filter(o => o.section_id === phase.id) || [];
              const isPhaseExpanded = expandedPhases.has(phase.id);
              const phaseItemCount = phaseObjectives.reduce((acc, obj) => {
                return acc + (dbItems?.filter(i => i.objective_id === obj.id).length || 0);
              }, 0);

              return (
                <div key={phase.id}>
                  <button onClick={() => togglePhase(phase.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors text-left">
                    {isPhaseExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      phase.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                    }`}>{phase.source}</span>
                    <span className="text-sm font-semibold flex-1">{phase.name}</span>
                    <span className="text-xs text-muted-foreground">{phaseObjectives.length} obj • {phaseItemCount} tasks</span>
                  </button>

                  {isPhaseExpanded && (
                    <div className="pl-8 divide-y border-t">
                      {phaseObjectives.map(obj => (
                          <div key={obj.id} className="px-5 py-2.5">
                            <span className="text-sm font-medium text-foreground/80">{obj.name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove the template and all its phases, objectives, and tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteTemplate.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
