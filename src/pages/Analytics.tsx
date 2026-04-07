import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { sampleAuditData, defaultTemplate } from '@/data/checklistData';
import { TrendingUp, BarChart3, PieChart as PieIcon, Target } from 'lucide-react';
import MetricCard from '@/components/MetricCard';

const COLORS = ['#0096A6', '#ef4444', '#9ca3af', '#f59e0b'];

const current = sampleAuditData.monthlyTrend[sampleAuditData.monthlyTrend.length - 1];
const prev = sampleAuditData.monthlyTrend[sampleAuditData.monthlyTrend.length - 2];

const eaSections = defaultTemplate.sections.filter(s => s.source === 'EA');
const emprSections = defaultTemplate.sections.filter(s => s.source === 'EMPr');
const eaItems = defaultTemplate.items.filter(i => i.source === 'EA').length;
const emprItems = defaultTemplate.items.filter(i => i.source === 'EMPr').length;

const sourceBreakdown = [
  { name: 'EA Checklist', compliant: 20, nonCompliant: 0, total: eaItems },
  { name: 'EMPr Checklist', compliant: 58, nonCompliant: 0, total: emprItems },
];

const categoryCompliance = defaultTemplate.sections
  .filter(s => s.source === 'EMPr')
  .slice(0, 8)
  .map((s, i) => ({
    name: s.name.replace('Objective ', 'Obj ').replace(/:.+/, ''),
    compliance: 95 + Math.floor(Math.random() * 6),
    items: defaultTemplate.items.filter(item => item.sectionId === s.id).length,
  }));

const overallPie = [
  { name: 'Compliant', value: current.compliant },
  { name: 'Non-Compliant', value: current.nonCompliant },
  { name: 'Noted', value: current.noted },
];

export default function Analytics() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold font-display">Analytics & Trends</h2>
        <p className="text-sm text-muted-foreground">Comprehensive compliance analysis — {current.month}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Overall Compliance" value={`${current.compliance}%`} subtitle={`${current.compliance >= prev.compliance ? '+' : ''}${current.compliance - prev.compliance}% vs ${prev.month}`} icon={TrendingUp} variant="primary" />
        <MetricCard title="Total Items" value={defaultTemplate.items.length} subtitle={`${eaItems} EA + ${emprItems} EMPr`} icon={BarChart3} variant="default" />
        <MetricCard title="EA Compliance" value="100%" subtitle={`${eaItems} items assessed`} icon={Target} variant="success" />
        <MetricCard title="EMPr Compliance" value="100%" subtitle={`${emprItems} items assessed`} icon={PieIcon} variant="success" />
      </div>

      {/* Monthly Trend & Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Compliance Trend (Nov 2025 – Mar 2026)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={sampleAuditData.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="compliance" stroke="#0096A6" strokeWidth={2.5} dot={{ fill: '#0096A6', r: 4 }} name="Compliance %" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">EA vs EMPr Compliance</h3>
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
        </motion.div>
      </div>

      {/* Compliance by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2 bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Compliance by EMPr Objective</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryCompliance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="compliance" fill="#0096A6" radius={[0, 4, 4, 0]} name="Compliance %" />
            </BarChart>
          </ResponsiveContainer>
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

      {/* Monthly Comparison Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Monthly Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Compliant</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Non-Compliant</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Noted</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Compliance %</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Δ Change</th>
              </tr>
            </thead>
            <tbody>
              {sampleAuditData.monthlyTrend.map((row, i) => {
                const delta = i > 0 ? row.compliance - sampleAuditData.monthlyTrend[i - 1].compliance : 0;
                return (
                  <tr key={row.month} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.month}</td>
                    <td className="px-4 py-3 text-center text-success font-medium">{row.compliant}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={row.nonCompliant > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{row.nonCompliant}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.noted}</td>
                    <td className="px-4 py-3 text-center font-semibold">{row.compliance}%</td>
                    <td className="px-4 py-3 text-center">
                      {i > 0 ? (
                        <span className={`text-xs font-medium ${delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {delta > 0 ? '+' : ''}{delta}%
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
