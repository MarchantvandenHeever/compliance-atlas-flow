import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { defaultTemplate } from '@/data/checklistData';
import {
  FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight, Upload,
  Loader2, Trash2, Eye, MoreVertical,
} from 'lucide-react';
import { useTemplates, useTemplateSections, useTemplateItems, useImportChecklist, useDeleteTemplate } from '@/hooks/useTemplates';
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { data: dbTemplates, isLoading } = useTemplates();
  const importChecklist = useImportChecklist();
  const deleteTemplate = useDeleteTemplate();
  const fileRef = useRef<HTMLInputElement>(null);

  // View selected or first template
  const viewingTemplate = selectedTemplateId
    ? dbTemplates?.find(t => t.id === selectedTemplateId)
    : dbTemplates?.[0];

  const { data: dbSections } = useTemplateSections(viewingTemplate?.id);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbItems } = useTemplateItems(sectionIds);

  const hasDbData = !!dbSections?.length;
  const displaySections = hasDbData
    ? dbSections!.map(s => ({ id: s.id, name: s.name, source: s.source as 'EA' | 'EMPr', order: s.sort_order }))
    : !dbTemplates?.length ? defaultTemplate.sections : [];
  const displayItems = hasDbData
    ? dbItems?.map(i => ({ id: i.id, sectionId: i.section_id, conditionRef: i.condition_ref || '', description: i.description, source: i.source as 'EA' | 'EMPr', order: i.sort_order })) || []
    : !dbTemplates?.length ? defaultTemplate.items : [];
  const templateName = viewingTemplate?.name || (!dbTemplates?.length ? defaultTemplate.name : '');
  const templateVersion = viewingTemplate?.version || (!dbTemplates?.length ? defaultTemplate.version : 1);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });

      const sectionsMap = new Map<string, { name: string; source: 'EA' | 'EMPr'; items: Array<{ ref: string; desc: string; source: 'EA' | 'EMPr' }> }>();
      const skipSheetPattern = /contents|summary|cover|index|^toc$/i;

      for (const sheetName of wb.SheetNames) {
        if (skipSheetPattern.test(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) continue;

        const sheetSource: 'EA' | 'EMPr' = /empr/i.test(sheetName) ? 'EMPr' : 'EA';

        const headerIdx = rows.findIndex(r =>
          r.some(c => typeof c === 'string' && /^description$|condition\s*no|ref/i.test(String(c).trim()))
        );
        if (headerIdx < 0) continue;

        const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        const descCol = headers.findIndex(h => /^description$|requirement|condition\s+desc/i.test(h));
        const refCol = headers.findIndex(h => /condition\s*no|ref|number|^no\.?$/i.test(h));
        const scoreCol = headers.findIndex(h => /^score$|^rating$/i.test(h));

        if (descCol < 0) continue;

        let currentSection = sheetName;
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const descVal = String(row[descCol] || '').trim();
          if (!descVal) continue;
          const refVal = refCol >= 0 ? String(row[refCol] || '').trim() : '';
          const scoreVal = scoreCol >= 0 ? String(row[scoreCol] || '').trim() : '';

          const isSectionHeader =
            !refVal && !scoreVal &&
            (/^objective\s+\d/i.test(descVal) || /^section\s+\d/i.test(descVal) ||
              (descVal === descVal.toUpperCase() && descVal.length > 10 && !/^[a-z]\)/i.test(descVal)));

          if (isSectionHeader) { currentSection = descVal; continue; }

          if (!sectionsMap.has(currentSection)) {
            sectionsMap.set(currentSection, { name: currentSection, source: sheetSource, items: [] });
          }
          sectionsMap.get(currentSection)!.items.push({ ref: refVal, desc: descVal, source: sheetSource });
        }
      }

      if (sectionsMap.size === 0) {
        toast.error('No checklist data found. Ensure sheets contain a "Description" column header.');
        return;
      }

      const sectionsArr = Array.from(sectionsMap.values());
      const sectionInserts = sectionsArr.map((s, i) => ({ name: s.name, source: s.source, sort_order: i }));
      const itemInserts = sectionsArr.flatMap((s, si) =>
        s.items.map((item, ii) => ({ sectionIndex: si, condition_ref: item.ref, description: item.desc, source: item.source, sort_order: ii }))
      );

      await importChecklist.mutateAsync({
        name: file.name.replace(/\.\w+$/, ''),
        sections: sectionInserts,
        items: itemInserts,
      });
      toast.success(`Imported ${sectionsArr.length} sections with ${itemInserts.length} items`);
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

      {/* Template Detail View */}
      {viewingTemplate && displaySections.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{templateName}</h3>
                  <CheckCircle2 size={14} className="text-success" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Version {templateVersion} • {displayItems.length} items • {displaySections.length} sections
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y">
            {displaySections.map(section => {
              const sItems = displayItems.filter(i => i.sectionId === section.id);
              const isExpanded = expandedSections.has(section.id);

              return (
                <div key={section.id}>
                  <button onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors text-left">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      section.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                    }`}>{section.source}</span>
                    <span className="text-sm font-medium flex-1">{section.name}</span>
                    <span className="text-xs text-muted-foreground">{sItems.length} items</span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-3">
                      <div className="bg-muted/20 rounded-md divide-y divide-border">
                        {sItems.map(item => (
                          <div key={item.id} className="px-3 py-2 text-xs flex gap-3">
                            <span className="text-muted-foreground w-8 flex-shrink-0">{item.conditionRef}</span>
                            <span className="text-foreground">{item.description}</span>
                          </div>
                        ))}
                      </div>
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
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove the template and all its sections and items. Projects using this template will need a new one assigned.
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
