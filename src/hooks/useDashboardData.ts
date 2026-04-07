import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditInstances } from './useAuditData';
import { useProjects } from './useProjects';

export interface AuditMetric {
  audit: any;
  project: any;
  compliant: number;
  nonCompliant: number;
  noted: number;
  assessed: number;
  compliance: number;
}

export function useDashboardData(selectedProjectId?: string) {
  const { user } = useAuth();
  const { data: projects } = useProjects();
  const { data: allAudits } = useAuditInstances();

  // Filter audits by project if selected
  const audits = useMemo(() => {
    if (!allAudits) return [];
    if (selectedProjectId) return allAudits.filter(a => a.project_id === selectedProjectId);
    return allAudits;
  }, [allAudits, selectedProjectId]);

  const completedAudits = useMemo(() =>
    audits.filter(a => a.status === 'submitted' || a.status === 'approved'),
    [audits]
  );

  const completedAuditIds = useMemo(() => completedAudits.map(a => a.id), [completedAudits]);

  // Fetch responses with checklist_item_id to join with items for source info
  const { data: allResponses } = useQuery({
    queryKey: ['dashboard-responses-full', completedAuditIds],
    queryFn: async () => {
      if (!completedAuditIds.length) return [];
      const { data, error } = await supabase
        .from('audit_item_responses')
        .select('audit_id, checklist_item_id, status, comments, actions')
        .in('audit_id', completedAuditIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user && completedAuditIds.length > 0,
  });

  // Build per-audit metrics
  const auditMetrics: AuditMetric[] = useMemo(() => {
    if (!allResponses || !audits.length) return [];
    return completedAudits
      .sort((a, b) => new Date(b.submitted_at || b.updated_at).getTime() - new Date(a.submitted_at || a.updated_at).getTime())
      .map(audit => {
        const responses = allResponses.filter(r => r.audit_id === audit.id);
        const compliant = responses.filter(r => r.status === 'C').length;
        const nonCompliant = responses.filter(r => r.status === 'NC').length;
        const noted = responses.filter(r => r.status === 'NA').length;
        const assessed = compliant + nonCompliant + noted;
        const compliance = assessed > 0 ? Math.round((compliant / assessed) * 100) : 0;
        const project = projects?.find(p => p.id === audit.project_id);
        return { audit, project, compliant, nonCompliant, noted, assessed, compliance };
      });
  }, [allResponses, completedAudits, audits, projects]);

  // Aggregate totals across all completed audits (or latest per project)
  const totals = useMemo(() => {
    const latest = auditMetrics[0];
    if (!latest) return { compliant: 0, nonCompliant: 0, noted: 0, assessed: 0, compliance: 0 };
    // Show latest audit's metrics as "current"
    return latest;
  }, [auditMetrics]);

  // NC findings from responses
  const ncFindings = useMemo(() => {
    if (!allResponses) return [];
    return allResponses.filter(r => r.status === 'NC');
  }, [allResponses]);

  // Trend data: one point per completed audit sorted chronologically
  const trendData = useMemo(() => {
    return [...auditMetrics].reverse().map(m => ({
      period: m.audit.period,
      compliance: m.compliance,
      compliant: m.compliant,
      nonCompliant: m.nonCompliant,
      noted: m.noted,
    }));
  }, [auditMetrics]);

  return {
    projects: projects || [],
    audits,
    completedAudits,
    auditMetrics,
    totals,
    ncFindings,
    trendData,
    allResponses: allResponses || [],
  };
}
