import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { defaultTemplate } from '@/data/checklistData';
import { FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight, Upload, Settings2, Loader2 } from 'lucide-react';
import { useTemplates, useTemplateSections, useTemplateItems, useImportChecklist } from '@/hooks/useTemplates';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Templates() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { data: dbTemplates, isLoading } = useTemplates();
  const importChecklist = useImportChecklist();
  const fileRef = useRef<HTMLInputElement>(null);

  // Use first active DB template or fallback
  const activeTemplate = dbTemplates?.find(t => t.is_active) || dbTemplates?.[0];
  const { data: dbSections } = useTemplateSections(activeTemplate?.id);
  const sectionIds = dbSections?.map(s => s.id);
  const { data: dbItems } = useTemplateItems(sectionIds);

  // Determine display data
  const hasDbData = !!dbSections?.length;
  const displaySections = hasDbData
    ? dbSections!.map(s => ({ id: s.id, name: s.name, source: s.source as 'EA' | 'EMPr', order: s.sort_order }))
    : defaultTemplate.sections;
  const displayItems = hasDbData
    ? dbItems?.map(i => ({ id: i.id, sectionId: i.section_id, conditionRef: i.condition_ref || '', description: i.description, source: i.source as 'EA' | 'EMPr', order: i.sort_order })) || []
    : defaultTemplate.items;
  const templateName = activeTemplate?.name || defaultTemplate.name;
  const templateVersion = activeTemplate?.version || defaultTemplate.version;

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
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) { toast.error('Spreadsheet appears empty'); return; }

      // Parse: expect columns like: Section, Ref, Description, Source
      // Auto-detect header row
      const headerRow = rows.findIndex(r => 
        r.some(c => typeof c === 'string' && /ref|condition|description|section/i.test(c))
      );
      const startRow = headerRow >= 0 ? headerRow + 1 : 1;
      const headers = rows[headerRow >= 0 ? headerRow : 0].map(h => String(h || '').toLowerCase());

      const sectionCol = headers.findIndex(h => /section|category|objective/i.test(h));
      const refCol = headers.findIndex(h => /ref|condition|number|no\./i.test(h));
      const descCol = headers.findIndex(h => /desc|requirement|condition|item/i.test(h));
      const sourceCol = headers.findIndex(h => /source|type|origin/i.test(h));

      if (descCol < 0) { toast.error('Could not find description column'); return; }

      const sectionsMap = new Map<string, { name: string; source: 'EA' | 'EMPr'; items: Array<{ ref: string; desc: string; source: 'EA' | 'EMPr' }> }>();
      let currentSection = 'General';

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[descCol]) continue;

        const sectionName = sectionCol >= 0 && row[sectionCol] ? String(row[sectionCol]) : currentSection;
        currentSection = sectionName;
        const source: 'EA' | 'EMPr' = sourceCol >= 0 && /empr/i.test(String(row[sourceCol] || '')) ? 'EMPr' : 'EA';
        const ref = refCol >= 0 ? String(row[refCol] || '') : '';
        const desc = String(row[descCol]);

        if (!sectionsMap.has(sectionName)) {
          sectionsMap.set(sectionName, { name: sectionName, source, items: [] });
        }
        sectionsMap.get(sectionName)!.items.push({ ref, desc, source });
      }

      const sectionsArr = Array.from(sectionsMap.values());
      const sectionInserts = sectionsArr.map((s, i) => ({ name: s.name, source: s.source, sort_order: i }));
      const itemInserts = sectionsArr.flatMap((s, si) =>
        s.items.map((item, ii) => ({
          sectionIndex: si,
          condition_ref: item.ref,
          description: item.desc,
          source: item.source,
          sort_order: ii,
        }))
      );

      await importChecklist.mutateAsync({
        name: file.name.replace(/\.\w+$/, ''),
        sections: sectionInserts,
        items: itemInserts,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse checklist');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Checklist Templates</h2>
          <p className="text-sm text-muted-foreground">Manage and version checklist master files</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importChecklist.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {importChecklist.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import Checklist
          </button>
        </div>
      </div>

      {/* Template list from DB */}
      {dbTemplates && dbTemplates.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {dbTemplates.map(t => (
            <span key={t.id} className={`text-xs px-2 py-1 rounded-md border ${t.is_active ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}>
              {t.name} v{t.version}
            </span>
          ))}
        </div>
      )}

      {/* Active Template */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
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
    </div>
  );
}
