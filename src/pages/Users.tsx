import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserPlus, X, Building2 } from 'lucide-react';
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

  const getUserRoles = (userId: string): AppRole[] =>
    (roles || []).filter(r => r.user_id === userId).map(r => r.role);

  const loading = loadingProfiles || loadingRoles;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
      </div>

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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
