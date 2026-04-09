import { useState } from 'react';
import { Users, Plus, X, UserCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectTeam, useAddProjectTeamMember, useRemoveProjectTeamMember, ProjectTeamRole } from '@/hooks/useProjectTeam';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_LABELS: Record<ProjectTeamRole, string> = {
  auditor: 'Auditor',
  reviewer: 'Reviewer',
  client: 'Client',
};

const ROLE_COLORS: Record<ProjectTeamRole, string> = {
  auditor: 'bg-blue-100 text-blue-700',
  reviewer: 'bg-purple-100 text-purple-700',
  client: 'bg-teal-100 text-teal-700',
};

interface Props {
  projectId: string;
  projectName: string;
}

export default function ProjectTeamPanel({ projectId, projectName }: Props) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { data: team, isLoading } = useProjectTeam(projectId);
  const addMember = useAddProjectTeamMember();
  const removeMember = useRemoveProjectTeamMember();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectTeamRole>('auditor');

  // Fetch all profiles for assignment dropdown
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const handleAdd = async () => {
    if (!selectedUserId) return;
    await addMember.mutateAsync({
      project_id: projectId,
      user_id: selectedUserId,
      project_role: selectedRole,
    });
    setSelectedUserId('');
  };

  const getDisplayName = (userId: string) =>
    profiles?.find(p => p.user_id === userId)?.display_name || userId.slice(0, 8);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users size={14} /> Team
          {team?.length ? <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full ml-1">{team.length}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} /> Project Team — {projectName}
          </DialogTitle>
        </DialogHeader>

        {/* Current team members */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : !team?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team members assigned</p>
          ) : (
            team.map(member => (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <UserCircle size={20} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{getDisplayName(member.user_id)}</p>
                  <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded ${ROLE_COLORS[member.project_role]}`}>
                    {ROLE_LABELS[member.project_role]}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => removeMember.mutate({ id: member.id, projectId })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add member (admin only) */}
        {isAdmin && (
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Assign Team Member</p>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles || []).map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.display_name || p.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as ProjectTeamRole)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleAdd}
              disabled={!selectedUserId || addMember.isPending}
            >
              <Plus size={14} /> Assign
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
