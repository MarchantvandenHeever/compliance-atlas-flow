import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Minus, TrendingUp, ClipboardCheck, Calendar, AlertTriangle, FileCheck, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import MetricCard from '@/components/MetricCard';
import ProjectFilter from '@/components/ProjectFilter';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Link } from 'react-router-dom';
import DashboardExport from '@/components/DashboardExport';

const COLORS = ['#0096A6', '#ef4444', '#9ca3af'];

export default function Dashboard() {
  const [selectedProject, setSelectedProject] = useState('');
  const { projects, audits, auditMetrics, totals, trendData, ncFindings } = useDashboardData(selectedProject || undefined);

  const auditCount = audits.length;
  const draftCount = audits.filter(a => a.status === 'draft').length;
  const submittedCount = audits.filter(a => a.status === 'submitted').length;

  const recentAudits = audits
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const pieData = [
    { name: 'Compliant', value: totals.compliant },
    { name: 'Non-Compliant', value: totals.nonCompliant },
    { name: 'N/A', value: totals.noted },
  ].filter(d => d.value > 0);

  const prevMetric = auditMetrics[1];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {auditCount} audits • {draftCount} drafts • {submittedCount} submitted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DashboardExport auditMetrics={auditMetrics} trendData={trendData} totals={totals} selectedProject={selectedProject} projects={projects} pageTitle="Dashboard" />
          <ProjectFilter projects={projects} selectedProjectId={selectedProject} onChange={setSelectedProject} />
        </div>
      </div>

      {/* Summary Metric Cards — real data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Compliance" value={`${totals.compliance}%`}
          subtitle={prevMetric ? `${totals.compliance >= prevMetric.compliance ? '+' : ''}${totals.compliance - prevMetric.compliance}% vs prev` : 'Latest audit'}
          icon={TrendingUp} variant="primary" />
        <MetricCard title="Compliant" value={totals.compliant}
          subtitle={`of ${totals.assessed} assessed`}
          icon={CheckCircle2} variant="success" />
        <MetricCard title="Non-Compliant" value={totals.nonCompliant}
          subtitle="Open NCs" icon={XCircle} variant="danger" />
        <MetricCard title="N/A" value={totals.noted}
          subtitle="Not applicable" icon={Minus} variant="default" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-card rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-4">Compliance Trend</h3>
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
            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No completed audits yet</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/audits" className="bg-card border rounded-lg p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><ClipboardCheck size={20} /></div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">Start New Audit</p>
              <p className="text-xs text-muted-foreground">Open audit capture</p>
            </div>
          </div>
        </Link>
        <Link to="/findings" className="bg-card border rounded-lg p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive"><AlertTriangle size={20} /></div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">View Findings</p>
              <p className="text-xs text-muted-foreground">{ncFindings.length} non-conformances</p>
            </div>
          </div>
        </Link>
        <Link to="/analytics" className="bg-card border rounded-lg p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Calendar size={20} /></div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">View Full Analytics</p>
              <p className="text-xs text-muted-foreground">Trends & comparisons</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Audits */}
      {recentAudits.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><FileCheck size={16} className="text-primary" /> Recent Audits</h3>
          </div>
          <div className="divide-y">
            {recentAudits.map(audit => {
              const project = projects.find(p => p.id === audit.project_id);
              const statusStyles: Record<string, string> = {
                draft: 'bg-amber-100 text-amber-700',
                submitted: 'bg-green-100 text-green-700',
                approved: 'bg-primary/10 text-primary',
              };
              return (
                <Link key={audit.id}
                   to={`/audits/capture?projectId=${audit.project_id}&templateId=${audit.template_id}&auditId=${audit.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {project?.name || 'Unknown'} — {audit.period}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audit.type} • {new Date(audit.updated_at).toLocaleDateString()}
                      {audit.submitted_at && ` • Submitted ${new Date(audit.submitted_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[audit.status] || 'bg-muted text-muted-foreground'}`}>
                    {audit.status}
                  </span>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Completed Audit Results Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card rounded-lg border">
        <div className="p-4 border-b"><h3 className="text-sm font-semibold">Completed Audit Results</h3></div>
        {auditMetrics.length > 0 ? (
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
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {auditMetrics.map(({ audit, project, compliant, nonCompliant, noted, compliance }) => (
                  <tr key={audit.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{project?.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{audit.period}</td>
                    <td className="px-4 py-3 text-center text-success font-medium">{compliant}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${nonCompliant > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{nonCompliant}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{noted}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${compliance}%` }} />
                        </div>
                        <span className="text-xs font-medium">{compliance}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        audit.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
                      }`}>{audit.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/audit?projectId=${audit.project_id}&templateId=${audit.template_id}&auditId=${audit.id}`}
                        className="text-xs text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No completed audits yet. Submit an audit to see results here.
          </div>
        )}
      </motion.div>
    </div>
  );
}
