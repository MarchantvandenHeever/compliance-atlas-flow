import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieIcon, Target } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import ProjectFilter from '@/components/ProjectFilter';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const COLORS = ['#0096A6', '#ef4444', '#9ca3af', '#f59e0b'];

export default function Analytics() {
  const [selectedProject, setSelectedProject] = useState('');
  const { user } = useAuth();
  const { projects, auditMetrics, totals, trendData, completedAudits } = useDashboardData(selectedProject || undefined);

  const prevMetric = auditMetrics[1];
  const completedIds = completedAudits.map(a => a.id);

  // Fetch detailed responses with checklist item + section info for source breakdown
  const { data: detailedResponses } = useQuery({
    queryKey: ['analytics-detailed', completedIds],
    queryFn: async () => {
      if (!completedIds.length) return [];
      const { data, error } = await supabase
        .from('audit_item_responses')
        .select('audit_id, status, checklist_item_id, checklist_items(source, objective_id, checklist_objectives(name, section_id, checklist_sections(name)))')
        .in('audit_id', completedIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user && completedIds.length > 0,
  });

  // Source breakdown (EA vs EMPr) from latest audit
  const sourceBreakdown = useMemo(() => {
    if (!detailedResponses?.length || !auditMetrics.length) return [];
    const latestId = auditMetrics[0].audit.id;
    const latest = detailedResponses.filter(r => r.audit_id === latestId);
    const groups: Record<string, { compliant: number; nonCompliant: number; noted: number }> = {};
    latest.forEach(r => {
      const source = (r.checklist_items as any)?.source || 'Unknown';
      if (!groups[source]) groups[source] = { compliant: 0, nonCompliant: 0, noted: 0 };
      if (r.status === 'C') groups[source].compliant++;
      if (r.status === 'NC') groups[source].nonCompliant++;
      if (r.status === 'NA') groups[source].noted++;
    });
    return Object.entries(groups).map(([name, v]) => ({ name: `${name} Checklist`, ...v }));
  }, [detailedResponses, auditMetrics]);

  // Compliance by section from latest audit
  const sectionCompliance = useMemo(() => {
    if (!detailedResponses?.length || !auditMetrics.length) return [];
    const latestId = auditMetrics[0].audit.id;
    const latest = detailedResponses.filter(r => r.audit_id === latestId);
    const sections: Record<string, { name: string; c: number; total: number }> = {};
    latest.forEach(r => {
      const secName = (r.checklist_items as any)?.checklist_objectives?.checklist_sections?.name || 'Unknown';
      if (!sections[secName]) sections[secName] = { name: secName, c: 0, total: 0 };
      sections[secName].total++;
      if (r.status === 'C') sections[secName].c++;
    });
    return Object.values(sections)
      .map(s => ({ name: s.name.length > 25 ? s.name.slice(0, 25) + '…' : s.name, compliance: s.total > 0 ? Math.round((s.c / s.total) * 100) : 0, items: s.total }))
      .sort((a, b) => a.compliance - b.compliance)
      .slice(0, 10);
  }, [detailedResponses, auditMetrics]);

  const overallPie = [
    { name: 'Compliant', value: totals.compliant },
    { name: 'Non-Compliant', value: totals.nonCompliant },
    { name: 'N/A', value: totals.noted },
  ].filter(d => d.value > 0);

  const hasData = auditMetrics.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Analytics & Trends</h2>
          <p className="text-sm text-muted-foreground">Comprehensive compliance analysis from completed audits</p>
        </div>
        <ProjectFilter projects={projects} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

      {!hasData ? (
        <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
          <p className="text-sm">No completed audits found. Submit an audit to see analytics here.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Overall Compliance" value={`${totals.compliance}%`}
              subtitle={prevMetric ? `${totals.compliance >= prevMetric.compliance ? '+' : ''}${totals.compliance - prevMetric.compliance}% vs prev` : 'Latest audit'}
              icon={TrendingUp} variant="primary" />
            <MetricCard title="Items Assessed" value={totals.assessed}
              subtitle={`${auditMetrics.length} completed audits`}
              icon={BarChart3} variant="default" />
            <MetricCard title="Compliant" value={totals.compliant}
              subtitle={`${totals.assessed > 0 ? Math.round((totals.compliant / totals.assessed) * 100) : 0}% of assessed`}
              icon={Target} variant="success" />
            <MetricCard title="Non-Compliant" value={totals.nonCompliant}
              subtitle={`${totals.assessed > 0 ? Math.round((totals.nonCompliant / totals.assessed) * 100) : 0}% of assessed`}
              icon={PieIcon} variant="danger" />
          </div>

          {/* Trend & Source */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Compliance Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="compliance" stroke="#0096A6" strokeWidth={2.5} dot={{ fill: '#0096A6', r: 4 }} name="Compliance %" />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">EA vs EMPr Compliance</h3>
              {sourceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sourceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="compliant" fill="#0096A6" name="Compliant" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nonCompliant" fill="#ef4444" name="Non-Compliant" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
              )}
            </motion.div>
          </div>

          {/* Section compliance & Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2 bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Compliance by Phase (Latest Audit)</h3>
              {sectionCompliance.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, sectionCompliance.length * 36)}>
                  <BarChart data={sectionCompliance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="compliance" fill="#0096A6" radius={[0, 4, 4, 0]} name="Compliance %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4">Overall Status Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={overallPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                    {overallPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {overallPie.map((item, i) => (
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

          {/* Audit Comparison Table */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border rounded-lg">
            <div className="p-4 border-b"><h3 className="text-sm font-semibold">Audit Comparison</h3></div>
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
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Δ Change</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {auditMetrics.map((m, i) => {
                    const delta = i < auditMetrics.length - 1 ? m.compliance - auditMetrics[i + 1].compliance : 0;
                    return (
                      <tr key={m.audit.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{m.project?.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.audit.period}</td>
                        <td className="px-4 py-3 text-center text-success font-medium">{m.compliant}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${m.nonCompliant > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{m.nonCompliant}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{m.noted}</td>
                        <td className="px-4 py-3 text-center font-semibold">{m.compliance}%</td>
                        <td className="px-4 py-3 text-center">
                          {i < auditMetrics.length - 1 ? (
                            <span className={`text-xs font-medium ${delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {delta > 0 ? '+' : ''}{delta}%
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/audit?projectId=${m.audit.project_id}&templateId=${m.audit.template_id}&auditId=${m.audit.id}`}
                            className="text-xs text-primary hover:underline">View</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
