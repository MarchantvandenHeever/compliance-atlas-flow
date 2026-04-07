import { motion } from 'framer-motion';
import { defaultTemplate } from '@/data/checklistData';
import { FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight, Upload, Settings2 } from 'lucide-react';
import { useState } from 'react';

export default function Templates() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Checklist Templates</h2>
          <p className="text-sm text-muted-foreground">Manage and version checklist master files</p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Upload size={14} /> Import Checklist
        </button>
      </div>

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
                  <h3 className="text-base font-semibold">{defaultTemplate.name}</h3>
                  <CheckCircle2 size={14} className="text-success" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Version {defaultTemplate.version} • {defaultTemplate.items.length} items • {defaultTemplate.sections.length} sections • Created {defaultTemplate.createdAt}
                </p>
              </div>
            </div>
            <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="divide-y">
          {defaultTemplate.sections.map(section => {
            const items = defaultTemplate.items.filter(i => i.sectionId === section.id);
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    section.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {section.source}
                  </span>
                  <span className="text-sm font-medium flex-1">{section.name}</span>
                  <span className="text-xs text-muted-foreground">{items.length} items</span>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-3">
                    <div className="bg-muted/20 rounded-md divide-y divide-border">
                      {items.map(item => (
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
