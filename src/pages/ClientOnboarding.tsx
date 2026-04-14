import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Building2, Loader2, Trash2, Upload, Pencil, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

type OrgFormData = {
  name: string;
  primary_color: string;
  website_url: string;
  logoFile: File | null;
  existingLogoUrl: string | null;
};

const emptyForm: OrgFormData = {
  name: '',
  primary_color: '#2563eb',
  website_url: '',
  logoFile: null,
  existingLogoUrl: null,
};

export default function ClientOnboarding() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<OrgFormData>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (org: any) => {
    setEditingId(org.id);
    setForm({
      name: org.name,
      primary_color: org.primary_color || '#2563eb',
      website_url: org.website_url || '',
      logoFile: null,
      existingLogoUrl: org.logo_url,
    });
    setDialogOpen(true);
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `org-logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('audit-photos').upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('audit-photos').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const saveOrg = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Organisation name is required');

      let logoUrl = form.existingLogoUrl;
      if (form.logoFile) {
        logoUrl = await uploadLogo(form.logoFile);
      }

      const payload = {
        name: form.name.trim(),
        primary_color: form.primary_color,
        logo_url: logoUrl,
        website_url: form.website_url.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from('organisations').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organisations').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisations'] });
      toast.success(editingId ? 'Organisation updated' : 'Organisation created');
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOrg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('organisations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisations'] });
      toast.success('Organisation deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoFillFromWebsite = async () => {
    const url = form.website_url.trim();
    if (!url) {
      toast.error('Enter a website URL first');
      return;
    }

    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-org-website', {
        body: { url },
      });
      if (error) throw error;
      if (!data) throw new Error('No data returned');

      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        primary_color: data.primaryColor || prev.primary_color,
      }));

      if (data.logoUrl) {
        setForm(prev => ({ ...prev, existingLogoUrl: data.logoUrl }));
      }

      toast.success('Auto-filled from website');
    } catch (e: any) {
      console.error('Auto-fill error:', e);
      toast.error('Could not auto-fill. Please enter details manually.');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Client Onboarding</h2>
          <p className="text-sm text-muted-foreground">Manage client organisations, logos, and branding</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" /> New Client</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : !orgs?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No client organisations yet. Click "New Client" to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map(org => (
            <Card key={org.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded object-contain bg-muted p-1" />
                  ) : (
                    <div className="w-10 h-10 rounded flex items-center justify-center text-primary-foreground text-sm font-bold"
                      style={{ backgroundColor: org.primary_color || 'hsl(var(--primary))' }}>
                      {org.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm">{org.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </CardDescription>
                    {(org as any).website_url && (
                      <a href={(org as any).website_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                        <Globe size={10} /> {(org as any).website_url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(org)}
                      className="text-muted-foreground hover:text-primary p-1">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                      className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: org.primary_color || 'transparent' }} />
                  <span>{org.primary_color || 'No brand colour'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditingId(null); } else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Client Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Website URL</Label>
              <div className="flex gap-2">
                <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="https://example.co.za" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={autoFillFromWebsite} disabled={fetching}>
                  {fetching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span className="ml-1 hidden sm:inline">Auto-fill</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Enter a URL and click Auto-fill to populate details from the website</p>
            </div>
            <div className="space-y-1.5">
              <Label>Organisation Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Eskom Holdings" />
            </div>
            <div className="space-y-1.5">
              <Label>Brand Colour</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-28 font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Client Logo</Label>
              <div className="flex items-center gap-2">
                {(form.existingLogoUrl && !form.logoFile) && (
                  <img src={form.existingLogoUrl} alt="Current logo" className="w-8 h-8 rounded object-contain bg-muted p-0.5" />
                )}
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload size={14} className="mr-1" /> {form.existingLogoUrl ? 'Replace' : 'Choose File'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setForm(f => ({ ...f, logoFile: e.target.files?.[0] || null }))} />
                  </label>
                </Button>
                {form.logoFile && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{form.logoFile.name}</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={() => saveOrg.mutate()} disabled={saveOrg.isPending}>
              {saveOrg.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organisation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This may affect associated projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteOrg.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
