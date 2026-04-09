import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle2, User, Calendar, ExternalLink } from 'lucide-react';
import ProjectFilter from '@/components/ProjectFilter';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const severityColors = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive',
};

const statusIcons = {
  open: <AlertTriangle size={14} className="text-destructive" />,
  in_progress: <Clock size={14} className="text-warning" />,
  closed: <CheckCircle2 size={14} className="text-success" />,
};

export default function Findings() {
  const [selectedProject, setSelectedProject] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { user } = useAuth();
  const { projects, completedAudits } = useDashboardData(selectedProject || undefined);

  const completedIds = completedAudits.map(a => a.id);

  // Fetch NC responses with item details
  const { data: ncResponses } = useQuery({
    queryKey: ['findings-nc', completedIds],
    queryFn: async () => {
      if (!completedIds.length) return [];
      const { data, error } = await supabase
        .from('audit_item_responses')
        .select('*, checklist_items(description, condition_ref, source, checklist_objectives(name, checklist_sections(name)))')
        .in('audit_id', completedIds)
        .eq('status', 'NC');
      if (error) throw error;
      return data;
    },
    enabled: !!user && completedIds.length > 0,
  });

  // Fetch corrective actions for these audits
  const { data: correctiveActions } = useQuery({
    queryKey: ['findings-actions', completedIds],
    queryFn: async () => {
      if (!completedIds.length) return [];
      const { data, error } = await supabase
        .from('corrective_actions')
        .select('*')
        .in('audit_id', completedIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user && completedIds.length > 0,
  });

  // Build findings list combining NC responses with corrective actions
  const findings = useMemo(() => {
    if (!ncResponses) return [];
    return ncResponses.map(r => {
      const action = correctiveActions?.find(a => a.audit_id === r.audit_id && a.checklist_item_id === r.checklist_item_id);
      const audit = completedAudits.find(a => a.id === r.audit_id);
      const project = projects.find(p => p.id === audit?.project_id);
      const item = r.checklist_items as any;
      return {
        id: r.id,
        auditId: r.audit_id,
        projectId: audit?.project_id,
        templateId: audit?.template_id,
        conditionRef: item?.condition_ref || '',
        description: item?.description || '',
        section: item?.checklist_objectives?.checklist_sections?.name || '',
        objective: item?.checklist_objectives?.name || '',
        source: (item?.source || 'EMPr') as 'EA' | 'EMPr',
        comments: r.comments || '',
        actions: r.actions || '',
        period: audit?.period || '',
        projectName: project?.name || '',
        severity: (action?.severity || 'medium') as 'low' | 'medium' | 'high',
        status: (action?.status || 'open') as 'open' | 'in_progress' | 'closed',
        assignedTo: action?.assigned_to || '',
        targetDate: action?.target_date || '',
      };
    });
  }, [ncResponses, correctiveActions, completedAudits, projects]);

  const filtered = filterStatus === 'all' ? findings : findings.filter(f => f.status === filterStatus);
  const openCount = findings.filter(f => f.status === 'open').length;
  const inProgressCount = findings.filter(f => f.status === 'in_progress').length;
  const closedCount = findings.filter(f => f.status === 'closed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Findings & Actions</h2>
          <p className="text-sm text-muted-foreground">Non-conformances from completed audits</p>
        </div>
        <ProjectFilter projects={projects} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

      {/* Summary filters */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border hover:bg-muted/50'}`}>
          All ({findings.length})
        </button>
        <button onClick={() => setFilterStatus('open')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'open' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card border hover:bg-muted/50'}`}>
          Open ({openCount})
        </button>
        <button onClick={() => setFilterStatus('in_progress')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'in_progress' ? 'bg-warning text-warning-foreground border-warning' : 'bg-card border hover:bg-muted/50'}`}>
          In Progress ({inProgressCount})
        </button>
        <button onClick={() => setFilterStatus('closed')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${filterStatus === 'closed' ? 'bg-success text-success-foreground border-success' : 'bg-card border hover:bg-muted/50'}`}>
          Closed ({closedCount})
        </button>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filtered.map((finding, i) => (
          <motion.div key={finding.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{statusIcons[finding.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${finding.source === 'EA' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                    {finding.source}
                  </span>
                  {finding.conditionRef && <span className="text-xs text-muted-foreground">Ref: {finding.conditionRef}</span>}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${severityColors[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{finding.projectName} • {finding.period}</span>
                </div>
                <p className="text-sm font-medium">{finding.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{finding.section}{finding.objective ? ` > ${finding.objective}` : ''}</p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {finding.comments && (
                    <div className="bg-muted/30 rounded-md p-2.5">
                      <p className="font-medium text-muted-foreground mb-1">Observation</p>
                      <p>{finding.comments}</p>
                    </div>
                  )}
                  {finding.actions && (
                    <div className="bg-muted/30 rounded-md p-2.5">
                      <p className="font-medium text-muted-foreground mb-1">Corrective Action</p>
                      <p>{finding.actions}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {finding.assignedTo && <div className="flex items-center gap-1"><User size={12} /> {finding.assignedTo}</div>}
                  {finding.targetDate && <div className="flex items-center gap-1"><Calendar size={12} /> Target: {finding.targetDate}</div>}
                  <Link to={`/audits/capture?projectId=${finding.projectId}&templateId=${finding.templateId}&auditId=${finding.auditId}`}
                    className="flex items-center gap-1 text-primary hover:underline ml-auto">
                    <ExternalLink size={12} /> View in Audit
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{findings.length === 0 ? 'No non-conformances found in completed audits.' : 'No findings match the current filter.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
