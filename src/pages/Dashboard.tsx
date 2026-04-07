import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Minus, TrendingUp, ClipboardCheck, Calendar, AlertTriangle, FileCheck, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import MetricCard from '@/components/MetricCard';
import { sampleAuditData, defaultTemplate } from '@/data/checklistData';
import { useAuditInstances } from '@/hooks/useAuditData';
import { useProjects } from '@/hooks/useProjects';
import { Link } from 'react-router-dom';

const COLORS = ['#0096A6', '#ef4444', '#9ca3af'];

export default function Dashboard() {
  const { data: projects } = useProjects();
  const { data: audits } = useAuditInstances();

  // Use DB data summary or fallback to sample
  const projectName = projects?.[0]?.name || sampleAuditData.project.name;
  const auditCount = audits?.length || 0;
  const draftCount = audits?.filter(a => a.status === 'draft').length || 0;
  const submittedCount = audits?.filter(a => a.status === 'submitted').length || 0;

  // Recent audits sorted by most recent first
  const recentAudits = audits
    ?.slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5) || [];

  const currentMetrics = sampleAuditData.monthlyTrend[sampleAuditData.monthlyTrend.length - 1];
  const prevMetrics = sampleAuditData.monthlyTrend[sampleAuditData.monthlyTrend.length - 2];
  const pieData = [
    { name: 'Compliant', value: currentMetrics.compliant },
    { name: 'Non-Compliant', value: currentMetrics.nonCompliant },
    { name: 'Noted / N/A', value: currentMetrics.noted },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold font-display">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {projectName} — {currentMetrics.month}
          {auditCount > 0 && <span className="ml-2 text-primary">({auditCount} audits, {draftCount} drafts)</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Compliance" value={`${currentMetrics.compliance}%`}
          subtitle={`+${currentMetrics.compliance - prevMetrics.compliance}% vs prev month`}
          icon={TrendingUp} variant="primary" />
        <MetricCard title="Compliant" value={currentMetrics.compliant}
          subtitle={`of ${currentMetrics.compliant + currentMetrics.nonCompliant} assessed`}
          icon={CheckCircle2} variant="success" />
        <MetricCard title="Non-Compliant" value={currentMetrics.nonCompliant}
          subtitle="Open NCs this period" icon={XCircle} variant="danger" />
        <MetricCard title="Noted / N/A" value={currentMetrics.noted}
          subtitle="Items not applicable" icon={Minus} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-card rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Compliance Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={sampleAuditData.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="compliance" stroke="#0096A6" strokeWidth={2.5} dot={{ fill: '#0096A6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-4">Status Breakdown</h3>
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
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/audit" className="bg-card border rounded-lg p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><ClipboardCheck size={20} /></div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">Start New Audit</p>
              <p className="text-xs text-muted-foreground">{defaultTemplate.items.length} checklist items</p>
            </div>
          </div>
        </Link>
        <Link to="/findings" className="bg-card border rounded-lg p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive"><AlertTriangle size={20} /></div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">View Open Findings</p>
              <p className="text-xs text-muted-foreground">{currentMetrics.nonCompliant} non-conformances</p>
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

      {/* Recent Audits from DB */}
      {recentAudits.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><FileCheck size={16} className="text-primary" /> Recent Audits</h3>
            <span className="text-xs text-muted-foreground">{auditCount} total • {draftCount} drafts • {submittedCount} submitted</span>
          </div>
          <div className="divide-y">
            {recentAudits.map(audit => {
              const project = projects?.find(p => p.id === audit.project_id);
              const statusStyles: Record<string, string> = {
                draft: 'bg-amber-100 text-amber-700',
                submitted: 'bg-green-100 text-green-700',
                approved: 'bg-primary/10 text-primary',
              };
              return (
                <Link
                  key={audit.id}
                  to={`/audit?projectId=${audit.project_id}&templateId=${audit.template_id}&auditId=${audit.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {project?.name || 'Unknown Project'} — {audit.period}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audit.type} audit • Updated {new Date(audit.updated_at).toLocaleDateString()}
                      {audit.submitted_at && ` • Submitted ${new Date(audit.submitted_at).toLocaleDateString()}`}
                      {(audit as any).revision_count > 0 && ` • Rev ${(audit as any).revision_count}`}
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

      {/* Sample Audit History (fallback) */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border">
        <div className="p-4 border-b"><h3 className="text-sm font-semibold">Sample Audit History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Period</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Compliant</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Non-Compliant</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Noted</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Compliance %</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {sampleAuditData.monthlyTrend.slice().reverse().map((row, i) => (
                <tr key={row.month} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{row.month}</td>
                  <td className="px-4 py-3 text-center"><span className="text-success font-medium">{row.compliant}</span></td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${row.nonCompliant > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{row.nonCompliant}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.noted}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${row.compliance}%` }} />
                      </div>
                      <span className="text-xs font-medium">{row.compliance}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                      i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>{i === 0 ? 'Current' : 'Submitted'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
