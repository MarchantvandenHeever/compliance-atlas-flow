import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Shield, UserPlus, X, Building2, Mail, Copy, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ALL_ROLES: AppRole[] = ['admin', 'eco_auditor', 'reviewer', 'client_viewer'];

const roleBadgeColor: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  eco_auditor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reviewer: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  client_viewer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const roleLabel = (r: AppRole) => r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addingRole, setAddingRole] = useState<Record<string, AppRole | ''>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole | ''>('');
  const [inviteOrgId, setInviteOrgId] = useState<string>('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: organisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast({ title: 'Role assigned successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error assigning role', description: e.message, variant: 'destructive' }),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast({ title: 'Role removed successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error removing role', description: e.message, variant: 'destructive' }),
  });

  const assignClient = useMutation({
    mutationFn: async ({ userId, organisationId }: { userId: string; organisationId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ organisation_id: organisationId })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      toast({ title: 'Client assignment updated' });
    },
    onError: (e: Error) => toast({ title: 'Error assigning client', description: e.message, variant: 'destructive' }),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast({ title: 'User deleted successfully' });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: 'Error deleting user', description: e.message, variant: 'destructive' }),
  });

  const getUserRoles = (userId: string): AppRole[] =>
    (roles || []).filter(r => r.user_id === userId).map(r => r.role);

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteDisplayName) {
      toast({ title: 'Email and display name are required', variant: 'destructive' });
      return;
    }
    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail,
          displayName: inviteDisplayName,
          role: inviteRole || undefined,
          organisationId: inviteOrgId || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      if (result.error) throw new Error(result.error);

      setInviteResult({ email: inviteEmail, tempPassword: result.tempPassword });
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast({ title: 'User invited successfully' });
    } catch (e: any) {
      toast({ title: 'Error inviting user', description: e.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteDisplayName('');
    setInviteRole('');
    setInviteOrgId('');
    setInviteResult(null);
    setInviteOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const loading = loadingProfiles || loadingRoles;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInviteForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{inviteResult ? 'User Created' : 'Invite New User'}</DialogTitle>
            <DialogDescription>
              {inviteResult
                ? 'Share the temporary credentials below with the new user. They will be prompted to change their password on first login.'
                : 'Create a new user account with a temporary password.'}
            </DialogDescription>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-sm">{inviteResult.email}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(inviteResult.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Temporary Password</p>
                    <p className="font-mono font-medium text-sm">{inviteResult.tempPassword}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(inviteResult.tempPassword)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={resetInviteForm} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Display Name</Label>
                <Input
                  id="invite-name"
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Role (optional)</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Organisation (optional)</Label>
                <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organisation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organisations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {org.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetInviteForm}>Cancel</Button>
                <Button onClick={handleInviteUser} disabled={inviting || !inviteEmail || !inviteDisplayName}>
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Create User
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Users ({profiles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Assign Role</TableHead>
                   <TableHead>Client Organisation</TableHead>
                   <TableHead className="w-[60px]"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles || []).map(profile => {
                  const userRoles = getUserRoles(profile.user_id);
                  const availableRoles = ALL_ROLES.filter(r => !userRoles.includes(r));
                  const selectedRole = addingRole[profile.user_id] || '';
                  const isClientViewer = userRoles.includes('client_viewer');
                  const assignedOrg = organisations.find(o => o.id === profile.organisation_id);

                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.display_name || 'Unnamed User'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length === 0 && (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          )}
                          {userRoles.map(role => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className={`${roleBadgeColor[role]} cursor-pointer group`}
                              onClick={() => {
                                if (profile.user_id === user?.id && role === 'admin') {
                                  toast({ title: 'Cannot remove your own admin role', variant: 'destructive' });
                                  return;
                                }
                                removeRole.mutate({ userId: profile.user_id, role });
                              }}
                            >
                              {roleLabel(role)}
                              <X className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {availableRoles.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={selectedRole}
                              onValueChange={(v) => setAddingRole(prev => ({ ...prev, [profile.user_id]: v as AppRole }))}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue placeholder="Select role..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRoles.map(r => (
                                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              disabled={!selectedRole || addRole.isPending}
                              onClick={() => {
                                if (selectedRole) {
                                  addRole.mutate({ userId: profile.user_id, role: selectedRole as AppRole });
                                  setAddingRole(prev => ({ ...prev, [profile.user_id]: '' }));
                                }
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isClientViewer ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={profile.organisation_id || 'none'}
                              onValueChange={(v) => {
                                assignClient.mutate({
                                  userId: profile.user_id,
                                  organisationId: v === 'none' ? null : v,
                                });
                              }}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="Assign client..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="text-muted-foreground">No client</span>
                                </SelectItem>
                                {organisations.map(org => (
                                  <SelectItem key={org.id} value={org.id}>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-3 w-3 text-muted-foreground" />
                                      {org.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assignedOrg && (
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {assignedOrg.name}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                       </TableCell>
                       <TableCell>
                         {profile.user_id !== user?.id && (
                           <Button
                             size="icon"
                             variant="ghost"
                             className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                             onClick={() => setDeleteTarget({ userId: profile.user_id, name: profile.display_name || 'this user' })}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         )}
                       </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will remove all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.userId)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
