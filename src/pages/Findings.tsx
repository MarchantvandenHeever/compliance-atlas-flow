import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle2, User, Calendar, Filter, ArrowUpDown } from 'lucide-react';

interface Finding {
  id: string;
  conditionRef: string;
  description: string;
  section: string;
  source: 'EA' | 'EMPr';
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'closed';
  assignedTo: string;
  targetDate: string;
  auditPeriod: string;
  comments: string;
  actions: string;
}

const sampleFindings: Finding[] = [
  {
    id: 'f-1',
    conditionRef: '24',
    description: 'Any spills must receive the necessary clean-up action. Bioremediation kits are to be kept on-site.',
    section: 'Objective 5: Hazardous Substances',
    source: 'EMPr',
    severity: 'high',
    status: 'closed',
    assignedTo: 'Site Manager',
    targetDate: '2026-02-28',
    auditPeriod: 'Jan 2026',
    comments: 'Oil spill from vandalized transformer on-site.',
    actions: 'Waste spill specialist appointed. Clean-up completed and waste removed.',
  },
  {
    id: 'f-2',
    conditionRef: '14',
    description: 'Stormwater management measures must be implemented to prevent erosion and sedimentation.',
    section: 'Objective 3: Water Resource Protection',
    source: 'EMPr',
    severity: 'medium',
    status: 'closed',
    assignedTo: 'EO',
    targetDate: '2025-12-15',
    auditPeriod: 'Nov 2025',
    comments: 'Minor erosion noted near access road.',
    actions: 'Erosion control measures installed. Area rehabilitated.',
  },
  {
    id: 'f-3',
    conditionRef: '9',
    description: 'All construction workers must undergo environmental awareness induction training.',
    section: 'Objective 2: Environmental Awareness',
    source: 'EMPr',
    severity: 'medium',
    status: 'closed',
    assignedTo: 'Contractor',
    targetDate: '2025-12-01',
    auditPeriod: 'Nov 2025',
    comments: 'Two workers on-site without induction records.',
    actions: 'Induction training completed for all staff. Records updated.',
  },
  {
    id: 'f-4',
    conditionRef: '75',
    description: 'Separate waste bins/skips must be provided for general waste and hazardous waste.',
    section: 'Objective 14: Waste Management',
    source: 'EMPr',
    severity: 'low',
    status: 'closed',
    assignedTo: 'Site Manager',
    targetDate: '2025-12-10',
    auditPeriod: 'Nov 2025',
    comments: 'Waste bins not clearly labelled.',
    actions: 'Labels added to all waste receptacles on-site.',
  },
];

const severityColors = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive',
};

const statusIcons = {
  open: <AlertTriangle size={14} className="text-destructive" />,
  'in-progress': <Clock size={14} className="text-warning" />,
  closed: <CheckCircle2 size={14} className="text-success" />,
};

export default function Findings() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = filterStatus === 'all'
    ? sampleFindings
    : sampleFindings.filter(f => f.status === filterStatus);

  const openCount = sampleFindings.filter(f => f.status === 'open').length;
  const inProgressCount = sampleFindings.filter(f => f.status === 'in-progress').length;
  const closedCount = sampleFindings.filter(f => f.status === 'closed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold font-display">Findings & Actions</h2>
        <p className="text-sm text-muted-foreground">Track non-conformances and corrective actions</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border hover:bg-muted/50'}`}
        >
          All ({sampleFindings.length})
        </button>
        <button
          onClick={() => setFilterStatus('open')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'open' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card border hover:bg-muted/50'}`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setFilterStatus('in-progress')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'in-progress' ? 'bg-warning text-warning-foreground border-warning' : 'bg-card border hover:bg-muted/50'}`}
        >
          In Progress ({inProgressCount})
        </button>
        <button
          onClick={() => setFilterStatus('closed')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'closed' ? 'bg-success text-success-foreground border-success' : 'bg-card border hover:bg-muted/50'}`}
        >
          Closed ({closedCount})
        </button>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filtered.map((finding, i) => (
          <motion.div
            key={finding.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{statusIcons[finding.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${finding.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                    {finding.source}
                  </span>
                  <span className="text-xs text-muted-foreground">Ref: {finding.conditionRef}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${severityColors[finding.severity]}`}>
                    {finding.severity}
                  </span>
                </div>
                <p className="text-sm font-medium">{finding.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{finding.section}</p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/30 rounded-md p-2.5">
                    <p className="font-medium text-muted-foreground mb-1">Observation</p>
                    <p>{finding.comments}</p>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2.5">
                    <p className="font-medium text-muted-foreground mb-1">Corrective Action</p>
                    <p>{finding.actions}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><User size={12} /> {finding.assignedTo}</div>
                  <div className="flex items-center gap-1"><Calendar size={12} /> Target: {finding.targetDate}</div>
                  <div className="flex items-center gap-1"><Clock size={12} /> Audit: {finding.auditPeriod}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No findings match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
