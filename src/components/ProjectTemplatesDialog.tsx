import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTemplates } from '@/hooks/useTemplates';
import { useProjectTemplates, useSetProjectTemplates } from '@/hooks/useProjectTemplates';
import { Settings2, ArrowUp, ArrowDown, X, GripVertical, Loader2 } from 'lucide-react';

interface Props {
  projectId: string;
  projectName: string;
}

export default function ProjectTemplatesDialog({ projectId, projectName }: Props) {
  const [open, setOpen] = useState(false);
  const { data: allTemplates } = useTemplates();
  const { data: projectTemplates } = useProjectTemplates(projectId);
  const setProjectTemplates = useSetProjectTemplates();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sync from DB when dialog opens
  useEffect(() => {
    if (open && projectTemplates) {
      setSelectedIds(projectTemplates.map(pt => pt.template_id));
    }
  }, [open, projectTemplates]);

  const toggleTemplate = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const moveTemplate = (index: number, direction: 'up' | 'down') => {
    setSelectedIds(prev => {
      const arr = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return arr;
    });
  };

  const handleSave = async () => {
    await setProjectTemplates.mutateAsync({ projectId, templateIds: selectedIds });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 size={14} /> Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Templates — {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Available Templates</label>
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto mt-1">
              {allTemplates?.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleTemplate(t.id)} className="rounded" />
                  {t.name} <span className="text-muted-foreground text-xs">v{t.version}</span>
                </label>
              ))}
              {!allTemplates?.length && <p className="text-xs text-muted-foreground p-2">No templates available.</p>}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Template Order</p>
              <div className="space-y-1">
                {selectedIds.map((id, idx) => {
                  const t = allTemplates?.find(t => t.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-muted/30 border rounded-md px-2 py-1.5 text-sm">
                      <GripVertical size={12} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-primary w-5">{idx + 1}.</span>
                      <span className="flex-1 truncate">{t?.name || id}</span>
                      <button type="button" onClick={() => moveTemplate(idx, 'up')} disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ArrowUp size={12} /></button>
                      <button type="button" onClick={() => moveTemplate(idx, 'down')} disabled={idx === selectedIds.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ArrowDown size={12} /></button>
                      <button type="button" onClick={() => toggleTemplate(id)}
                        className="p-0.5 rounded hover:bg-destructive/10"><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={setProjectTemplates.isPending}>
            {setProjectTemplates.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Templates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
