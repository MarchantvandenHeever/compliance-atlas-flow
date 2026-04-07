import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/hooks/useProjects';
import { useTemplates } from '@/hooks/useTemplates';
import { useSetProjectTemplates } from '@/hooks/useProjectTemplates';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Loader2, X } from 'lucide-react';

export default function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', location: '', description: '', audit_frequency: 'monthly' });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const createProject = useCreateProject();
  const setProjectTemplates = useSetProjectTemplates();
  const { data: templates } = useTemplates();

  const { data: orgs } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedOrg = orgs?.find(o => o.id === form.client);
    const project = await createProject.mutateAsync({
      ...form,
      client: selectedOrg?.name || form.client,
      organisation_id: selectedOrg?.id,
      template_id: selectedTemplateIds[0] || undefined,
    });
    // Save all templates via join table
    if (selectedTemplateIds.length > 0 && project?.id) {
      await setProjectTemplates.mutateAsync({ projectId: project.id, templateIds: selectedTemplateIds });
    }
    setOpen(false);
    setForm({ name: '', client: '', location: '', description: '', audit_frequency: 'monthly' });
    setSelectedTemplateIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus size={14} /> New Project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project Name *</label>
            <Input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Zonnebloem 132kV" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client *</label>
            <select required value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">Select a client…</option>
              {orgs?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Location</label>
            <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Mpumalanga Province" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Audit Frequency</label>
            <select value={form.audit_frequency} onChange={e => setForm(p => ({ ...p, audit_frequency: e.target.value }))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Templates</label>
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
              {templates?.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedTemplateIds.includes(t.id)} onChange={() => toggleTemplate(t.id)} className="rounded" />
                  {t.name} <span className="text-muted-foreground text-xs">v{t.version}</span>
                </label>
              ))}
              {!templates?.length && <p className="text-xs text-muted-foreground p-2">No templates available. Import one first.</p>}
            </div>
            {selectedTemplateIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedTemplateIds.map(id => {
                  const t = templates?.find(t => t.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {t?.name || id}
                      <button type="button" onClick={() => toggleTemplate(id)}><X size={10} /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={createProject.isPending}>
            {createProject.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Create Project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
