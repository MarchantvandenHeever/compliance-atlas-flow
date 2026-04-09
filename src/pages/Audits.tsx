import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck, Search, Eye, Edit, Calendar, Filter } from 'lucide-react';
import { useAuditInstances, useCreateAudit } from '@/hooks/useAuditData';
import { useProjects } from '@/hooks/useProjects';
import { useAllProjectTemplates } from '@/hooks/useProjectTemplates';
import { useMyProjectIds } from '@/hooks/useProjectTeam';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  submitted: 'bg-blue-100 text-blue-800 border-blue-300',
  under_review: 'bg-purple-100 text-purple-800 border-purple-300',
  amendments_requested: 'bg-orange-100 text-orange-800 border-orange-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function Audits() {
  const navigate = useNavigate();
  const { data: audits, isLoading } = useAuditInstances();
  const { data: projects } = useProjects();
  const { data: allPT } = useAllProjectTemplates();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { data: myProjectIds } = useMyProjectIds();
  const createAudit = useCreateAudit();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  // New audit dialog state
  const [newOpen, setNewOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newPeriod, setNewPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [newType, setNewType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Templates for selected project
  const projectTemplates = useMemo(() => {
    if (!newProjectId || !allPT) return [];
    return allPT.filter((pt: any) => pt.project_id === newProjectId);
  }, [newProjectId, allPT]);

  const roleFilteredAudits = useMemo(() => {
    if (!audits) return [];
    // Admins see all; others see only their assigned projects
    if (isAdmin || !myProjectIds) return audits;
    return audits.filter((a: any) => myProjectIds.includes(a.project_id));
  }, [audits, isAdmin, myProjectIds]);

  const filtered = useMemo(() => {
    return roleFilteredAudits.filter((a: any) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (projectFilter !== 'all' && a.project_id !== projectFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const projName = (a.projects?.name || '').toLowerCase();
        const projClient = (a.projects?.client || '').toLowerCase();
        if (!projName.includes(q) && !projClient.includes(q) && !a.period.includes(q)) return false;
      }
      return true;
    });
  }, [roleFilteredAudits, statusFilter, projectFilter, search]);

  // Summary counts
  const counts = useMemo(() => {
    const src = roleFilteredAudits;
    return {
      total: src.length,
      draft: src.filter((a: any) => a.status === 'draft').length,
      submitted: src.filter((a: any) => a.status === 'submitted').length,
      approved: src.filter((a: any) => a.status === 'approved').length,
      underReview: src.filter((a: any) => ['under_review', 'amendments_requested'].includes(a.status)).length,
    };
  }, [roleFilteredAudits]);

  const handleCreate = async () => {
    if (!newProjectId || !newTemplateId || !newPeriod) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      const result = await createAudit.mutateAsync({
        project_id: newProjectId,
        template_id: newTemplateId,
        period: newPeriod,
        type: newType,
      });
      setNewOpen(false);
      toast.success('Audit created');
      navigate(`/audits/capture?projectId=${newProjectId}&templateId=${newTemplateId}&auditId=${result.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create audit');
    }
  };

  const openAudit = (a: any) => {
    navigate(`/audits/capture?projectId=${a.project_id}&templateId=${a.template_id}&auditId=${a.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audits</h1>
          <p className="text-sm text-muted-foreground">Manage and review all audit instances</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} /> New Audit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Audit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Project</label>
                <Select value={newProjectId} onValueChange={(v) => { setNewProjectId(v); setNewTemplateId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.client}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Template</label>
                <Select value={newTemplateId} onValueChange={setNewTemplateId} disabled={!newProjectId}>
                  <SelectTrigger><SelectValue placeholder={newProjectId ? "Select template" : "Select project first"} /></SelectTrigger>
                  <SelectContent>
                    {projectTemplates.map((pt: any) => (
                      <SelectItem key={pt.template_id} value={pt.template_id}>{pt.template_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Period</label>
                  <Input type="month" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleCreate} disabled={createAudit.isPending}>
                {createAudit.isPending ? 'Creating…' : 'Create Audit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-foreground' },
          { label: 'Draft', value: counts.draft, color: 'text-yellow-600' },
          { label: 'Submitted', value: counts.submitted, color: 'text-blue-600' },
          { label: 'In Review', value: counts.underReview, color: 'text-purple-600' },
          { label: 'Approved', value: counts.approved, color: 'text-green-600' },
        ].map((c) => (
          <Card key={c.label} className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter(c.label === 'Total' ? 'all' : c.label === 'In Review' ? 'under_review' : c.label.toLowerCase())}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search audits…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><Filter size={14} className="mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="amendments_requested">Amendments</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {(projects || []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading audits…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck size={48} className="mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No audits found</p>
            <Button variant="outline" className="mt-4" onClick={() => setNewOpen(true)}>
              <Plus size={16} className="mr-2" /> Create your first audit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((audit: any) => (
            <Card key={audit.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openAudit(audit)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{audit.name || audit.projects?.name || 'Unknown Project'}</p>
                  <p className="text-xs text-muted-foreground">{audit.projects?.client || ''} · {audit.period} · {audit.type}</p>
                </div>
                <Badge variant="outline" className={`${statusColors[audit.status] || ''} text-xs`}>
                  {statusLabel(audit.status)}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  {new Date(audit.created_at).toLocaleDateString('en-ZA')}
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); openAudit(audit); }}>
                  {audit.status === 'draft' ? <><Edit size={14} /> Continue</> : <><Eye size={14} /> View</>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
