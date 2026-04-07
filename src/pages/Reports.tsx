import { motion } from 'framer-motion';
import { FileText, Download, Plus, Calendar, User, Eye } from 'lucide-react';

const reports = [
  { id: 'r-5', title: 'Construction Audit Report 5', period: 'Mar 2026', status: 'Draft', author: 'Brain Green', reviewer: 'Charl Kruger', date: '01 Apr 2026', compliance: 100 },
  { id: 'r-4', title: 'Construction Audit Report 4', period: 'Feb 2026', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '03 Mar 2026', compliance: 99 },
  { id: 'r-3', title: 'Construction Audit Report 3', period: 'Jan 2026', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '30 Jan 2026', compliance: 98 },
  { id: 'r-2', title: 'Construction Audit Report 2', period: 'Dec 2025', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '12 Dec 2025', compliance: 97 },
  { id: 'r-1', title: 'Construction Audit Report 1', period: 'Nov 2025', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '01 Dec 2025', compliance: 95 },
];

export default function Reports() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and manage audit reports</p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={14} /> Generate Report
        </button>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Monthly Audit Report</h4>
          <p className="text-xs text-muted-foreground mb-3">Full compliance report with appendices, charts, and photo evidence.</p>
          <button className="text-xs text-primary font-medium hover:underline">Generate PDF →</button>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Weekly NC Summary</h4>
          <p className="text-xs text-muted-foreground mb-3">Concise 1-2 page summary of non-conformances for contractor distribution.</p>
          <button className="text-xs text-primary font-medium hover:underline">Generate Summary →</button>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Data Export</h4>
          <p className="text-xs text-muted-foreground mb-3">Export checklist data, charts, and compliance tables as CSV/Excel.</p>
          <button className="text-xs text-primary font-medium hover:underline">Export Data →</button>
        </div>
      </div>

      {/* Reports List */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Report History</h3>
        </div>
        <div className="divide-y">
          {reports.map((report, i) => (
            <div key={report.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{report.title}</p>
                <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {report.date}</span>
                  <span className="flex items-center gap-1"><User size={11} /> {report.author}</span>
                  <span>{report.compliance}% compliant</span>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                report.status === 'Draft' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
              }`}>
                {report.status}
              </span>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Preview">
                  <Eye size={14} />
                </button>
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Download PDF">
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
