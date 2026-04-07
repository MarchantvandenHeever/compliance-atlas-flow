import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Building2, Loader2, Trash2, Upload } from 'lucide-react';
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

export default function ClientOnboarding() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#2563eb');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createOrg = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Organisation name is required');

      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `org-logos/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('audit-photos').upload(path, logoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('audit-photos').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('organisations').insert({
        name: newName.trim(),
        primary_color: newColor,
        logo_url: logoUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisations'] });
      toast.success('Client organisation created');
      setNewName('');
      setNewColor('#2563eb');
      setLogoFile(null);
      setDialogOpen(false);
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Client Onboarding</h2>
          <p className="text-sm text-muted-foreground">Manage client organisations, logos, and branding</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus size={14} className="mr-1" /> New Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Client Organisation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Organisation Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Eskom Holdings" />
              </div>
              <div className="space-y-1.5">
                <Label>Brand Colour</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={newColor} onChange={e => setNewColor(e.target.value)} className="w-28 font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Client Logo</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload size={14} className="mr-1" /> Choose File
                      <input type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </label>
                  </Button>
                  {logoFile && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{logoFile.name}</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
              <Button size="sm" onClick={() => createOrg.mutate()} disabled={createOrg.isPending}>
                {createOrg.isPending && <Loader2 size={14} className="mr-1 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                  </div>
                  <button onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1">
                    <Trash2 size={14} />
                  </button>
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
