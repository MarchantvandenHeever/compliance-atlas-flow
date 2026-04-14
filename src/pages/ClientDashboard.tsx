import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2, XCircle, Minus, TrendingUp, FolderKanban,
  FileCheck, Clock, FileText, BarChart3, Download, Lock
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import MetricCard from '@/components/MetricCard';
import ProjectFilter from '@/components/ProjectFilter';
import StatusBadge from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const COLORS = ['#0096A6', '#ef4444', '#9ca3af'];

export default function ClientDashboard() {
  const { user, profile } = useAuth();
  const [selectedProject, setSelectedProject] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch projects for this client's organisation
  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', profile?.organisation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organisation_id', profile!.organisation_id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id,
  });

  // Fetch approved audits only
  const { data: approvedAudits = [] } = useQuery({
    queryKey: ['client-approved-audits', profile?.organisation_id, selectedProject],
    queryFn: async () => {
      let query = supabase
        .from('audit_instances')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (selectedProject) {
        query = query.eq('project_id', selectedProject);
      } else {
        const projectIds = projects.map(p => p.id);
        if (projectIds.length > 0) query = query.in('project_id', projectIds);
        else return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id && projects.length > 0,
  });

  // Fetch all audits (for status overview, not detailed data)
  const { data: allAudits = [] } = useQuery({
    queryKey: ['client-all-audits', profile?.organisation_id, selectedProject],
    queryFn: async () => {
      let query = supabase
        .from('audit_instances')
        .select('id, project_id, period, type, status, created_at, updated_at, name')
        .order('created_at', { ascending: false });

      if (selectedProject) {
        query = query.eq('project_id', selectedProject);
      } else {
        const projectIds = projects.map(p => p.id);
        if (projectIds.length > 0) query = query.in('project_id', projectIds);
        else return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organisation_id && projects.length > 0,
  });

  // Fetch responses for approved audits
  const { data: approvedResponses = [] } = useQuery({
    queryKey: ['client-approved-responses', approvedAudits.map(a => a.id)],
    queryFn: async () => {
      const auditIds = approvedAudits.map(a => a.id);
      if (auditIds.length === 0) return [];
      const { data, error } = await supabase
        .from('audit_item_responses')
        .select('audit_id, status, nc_severity')
        .in('audit_id', auditIds);
      if (error) throw error;
      return data;
    },
    enabled: approvedAudits.length > 0,
  });

  // Fetch approved report reviews
  const { data: approvedReports = [] } = useQuery({
    queryKey: ['client-approved-reports', approvedAudits.map(a => a.id)],
    queryFn: async () => {
      const auditIds = approvedAudits.map(a => a.id);
      if (auditIds.length === 0) return [];
      const { data, error } = await supabase
        .from('report_reviews')
        .select('*, report_versions(*)')
        .in('audit_id', auditIds)
        .eq('status', 'approved');
      if (error) throw error;
      return data;
    },
    enabled: approvedAudits.length > 0,
  });

  // Compute metrics from approved audit responses
  const auditMetrics = useMemo(() => {
    return approvedAudits.map(audit => {
      const responses = approvedResponses.filter(r => r.audit_id === audit.id);
      const compliant = responses.filter(r => r.status === 'C').length;
      const nonCompliant = responses.filter(r => r.status === 'NC').length;
      const noted = responses.filter(r => r.status === 'NA').length;
      const assessed = compliant + nonCompliant;
      const compliance = assessed > 0 ? Math.round((compliant / assessed) * 100) : 0;
      const project = projects.find(p => p.id === audit.project_id);
      return { audit, project, compliant, nonCompliant, noted, compliance };
    });
  }, [approvedAudits, approvedResponses, projects]);

  const totals = useMemo(() => {
    const latest = auditMetrics[0];
    return latest
      ? { compliance: latest.compliance, compliant: latest.compliant, nonCompliant: latest.nonCompliant, noted: latest.noted, assessed: latest.compliant + latest.nonCompliant }
      : { compliance: 0, compliant: 0, nonCompliant: 0, noted: 0, assessed: 0 };
  }, [auditMetrics]);

  const trendData = useMemo(() => {
    return auditMetrics.slice().reverse().map(m => ({
      period: m.audit.period,
      compliance: m.compliance,
    }));
  }, [auditMetrics]);

  const pieData = [
    { name: 'Compliant', value: totals.compliant },
    { name: 'Non-Compliant', value: totals.nonCompliant },
    { name: 'N/A', value: totals.noted },
  ].filter(d => d.value > 0);

  const hasApprovedData = approvedAudits.length > 0;

  const handleDownloadReport = async (storagePath: string, format: string) => {
    const { data, error } = await supabase.storage
      .from('report-files')
      .download(storagePath);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Client Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} • {approvedAudits.length} approved audit{approvedAudits.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ProjectFilter projects={projects} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><FolderKanban size={14} /> Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5" disabled={!hasApprovedData}><BarChart3 size={14} /> Analytics</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5" disabled={!hasApprovedData}><FileText size={14} /> Reports</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Project summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Projects" value={projects.length} subtitle="Active projects" icon={FolderKanban} variant="primary" />
            <MetricCard title="Total Audits" value={allAudits.length} subtitle="All statuses" icon={FileCheck} variant="default" />
            <MetricCard title="Approved" value={approvedAudits.length} subtitle="Ready for review" icon={CheckCircle2} variant="success" />
            <MetricCard title="Pending" value={allAudits.filter(a => a.status !== 'approved').length} subtitle="In progress" icon={Clock} variant="default" />
          </div>

          {/* Project list */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FolderKanban size={16} className="text-primary" /> Projects</h3>
            </div>
            <div className="divide-y">
              {projects.map(project => {
                const projectAudits = allAudits.filter(a => a.project_id === project.id);
                const approved = projectAudits.filter(a => a.status === 'approved').length;
                const statusColor: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  completed: 'bg-primary/10 text-primary',
                  on_hold: 'bg-amber-100 text-amber-700',
                };
                return (
                  <div key={project.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.location || 'No location'} • {projectAudits.length} audits ({approved} approved)
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColor[project.status] || 'bg-muted text-muted-foreground'}`}>
                      {project.status}
                    </span>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No projects assigned to your organisation.</div>
              )}
            </div>
          </motion.div>

          {/* Audit status overview */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileCheck size={16} className="text-primary" /> Audit Status</h3>
            </div>
            <div className="divide-y">
              {allAudits.slice(0, 10).map(audit => {
                const project = projects.find(p => p.id === audit.project_id);
                const isApproved = audit.status === 'approved';
                const statusStyles: Record<string, string> = {
                  draft: 'bg-amber-100 text-amber-700',
                  submitted: 'bg-blue-100 text-blue-700',
                  under_review: 'bg-purple-100 text-purple-700',
                  amendments_requested: 'bg-orange-100 text-orange-700',
                  approved: 'bg-green-100 text-green-700',
                };
                return (
                  <div key={audit.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project?.name || 'Unknown'} — {audit.period}</p>
                      <p className="text-xs text-muted-foreground">{audit.type} • {new Date(audit.updated_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[audit.status] || 'bg-muted text-muted-foreground'}`}>
                      {audit.status.replace(/_/g, ' ')}
                    </span>
                    {!isApproved && (
                      <span title="Details available after approval"><Lock size={14} className="text-muted-foreground" /></span>
                    )}
                  </div>
                );
              })}
              {allAudits.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No audits found for your projects.</div>
              )}
            </div>
          </motion.div>
        </TabsContent>

        {/* ===== ANALYTICS TAB (only approved data) ===== */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {!hasApprovedData ? (
            <div className="bg-card rounded-lg border p-12 text-center">
              <Lock size={32} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold">No Approved Audits Yet</h3>
              <p className="text-xs text-muted-foreground mt-1">Analytics will be available once audits are approved.</p>
            </div>
          ) : (
            <>
              {/* Metric cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Compliance" value={`${totals.compliance}%`} subtitle="Latest approved audit" icon={TrendingUp} variant="primary" />
                <MetricCard title="Compliant" value={totals.compliant} subtitle={`of ${totals.assessed} assessed`} icon={CheckCircle2} variant="success" />
                <MetricCard title="Non-Compliant" value={totals.nonCompliant} subtitle="Open NCs" icon={XCircle} variant="danger" />
                <MetricCard title="N/A" value={totals.noted} subtitle="Not applicable" icon={Minus} variant="default" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="lg:col-span-2 bg-card rounded-lg border p-5">
                  <h3 className="text-sm font-semibold mb-4">Compliance Trend (Approved Audits)</h3>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="compliance" stroke="#0096A6" strokeWidth={2.5} dot={{ fill: '#0096A6', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No trend data</div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-card rounded-lg border p-5">
                  <h3 className="text-sm font-semibold mb-4">Status Breakdown</h3>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                            {pieData.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2 mt-2">
                        {pieData.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                              <span className="text-muted-foreground">{item.name}</span>
                            </div>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
                  )}
                </motion.div>
              </div>

              {/* Audit comparison table */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg border">
                <div className="p-4 border-b"><h3 className="text-sm font-semibold">Approved Audit Results</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Project</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Period</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">C</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">NC</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">N/A</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditMetrics.map(({ audit, project, compliant, nonCompliant, noted, compliance }) => (
                        <tr key={audit.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{project?.name || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{audit.period}</td>
                          <td className="px-4 py-3 text-center text-success font-medium">{compliant}</td>
                          <td className="px-4 py-3 text-center text-destructive font-medium">{nonCompliant}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{noted}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${compliance}%` }} />
                              </div>
                              <span className="text-xs font-medium">{compliance}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* ===== REPORTS TAB (only approved) ===== */}
        <TabsContent value="reports" className="space-y-6 mt-4">
          {!hasApprovedData ? (
            <div className="bg-card rounded-lg border p-12 text-center">
              <Lock size={32} className="mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold">No Approved Reports</h3>
              <p className="text-xs text-muted-foreground mt-1">Reports will be available once audits are approved.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2"><FileText size={16} className="text-primary" /> Approved Reports</h3>
              </div>
              <div className="divide-y">
                {approvedReports.length > 0 ? approvedReports.map(report => {
                  const audit = approvedAudits.find(a => a.id === report.audit_id);
                  const project = projects.find(p => p.id === audit?.project_id);
                  const latestVersion = report.report_versions
                    ?.sort((a: any, b: any) => b.version_number - a.version_number)?.[0];
                  return (
                    <div key={report.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{project?.name || 'Unknown'} — {audit?.period}</p>
                        <p className="text-xs text-muted-foreground">
                          Approved {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : ''}
                          {latestVersion && ` • v${latestVersion.version_number} (${latestVersion.format})`}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700">
                        Approved
                      </span>
                      {latestVersion && (
                        <button
                          onClick={() => handleDownloadReport(latestVersion.storage_path, latestVersion.format)}
                          className="text-primary hover:text-primary/80 p-1"
                          title="Download report"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  );
                }) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No approved reports available yet. Reports will appear here once the review process is complete.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
