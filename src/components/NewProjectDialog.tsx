import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/hooks/useProjects';
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Loader2 } from 'lucide-react';

export default function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', location: '', description: '', audit_frequency: 'monthly', template_id: '' });
  const createProject = useCreateProject();
  const { data: templates } = useTemplates();

  const { data: orgs } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedOrg = orgs?.find(o => o.id === form.client);
    await createProject.mutateAsync({
      ...form,
      client: selectedOrg?.name || form.client,
      organisation_id: selectedOrg?.id,
      template_id: form.template_id || undefined,
    });
    setOpen(false);
    setForm({ name: '', client: '', location: '', description: '', audit_frequency: 'monthly', template_id: '' });
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Audit Frequency</label>
              <select value={form.audit_frequency} onChange={e => setForm(p => ({ ...p, audit_frequency: e.target.value }))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select value={form.template_id} onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                <option value="">No template</option>
                {templates?.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
              </select>
            </div>
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
