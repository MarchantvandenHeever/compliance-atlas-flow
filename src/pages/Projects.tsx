import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Building2, Activity, ArrowRight, Loader2, PlayCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useAuditInstances, useCreateAudit } from '@/hooks/useAuditData';
import { useAllProjectTemplates } from '@/hooks/useProjectTemplates';
import NewProjectDialog from '@/components/NewProjectDialog';
import { toast } from 'sonner';

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const { data: audits } = useAuditInstances();
  const { data: allPT } = useAllProjectTemplates();
  const createAudit = useCreateAudit();
  const navigate = useNavigate();
  const [creatingAuditFor, setCreatingAuditFor] = useState<string | null>(null);
  const [selectingTemplateFor, setSelectingTemplateFor] = useState<string | null>(null);

  const getProjectTemplates = (projectId: string) =>
    allPT?.filter(pt => pt.project_id === projectId) || [];

  const handleStartAudit = async (projectId: string, templateId: string) => {
    setCreatingAuditFor(projectId);
    try {
      const period = new Date().toISOString().slice(0, 7);
      const result = await createAudit.mutateAsync({
        project_id: projectId,
        template_id: templateId,
        period,
        type: 'monthly',
      });
      navigate(`/audits/capture?auditId=${result.id}&templateId=${templateId}&projectId=${projectId}`);
    } finally {
      setCreatingAuditFor(null);
      setSelectingTemplateFor(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage environmental compliance projects</p>
        </div>
        <NewProjectDialog />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          {(projects || []).map(project => {
            const projectAudits = audits?.filter(a => a.project_id === project.id) || [];
            const latestAudit = projectAudits[0];
            const pts = getProjectTemplates(project.id);

            return (
              <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          project.status === 'active' ? 'bg-success/10 text-success' :
                          project.status === 'completed' ? 'bg-muted text-muted-foreground' :
                          'bg-warning/10 text-warning'
                        }`}>{project.status}</span>
                        <span className="text-xs text-muted-foreground">{project.audit_frequency}</span>
                        {pts.map(pt => (
                          <span key={pt.id} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {(pt.checklist_templates as any)?.name}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-lg font-semibold font-display">{project.name}</h3>
                      {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Building2 size={13} /><span>{project.client}</span></div>
                        {project.location && <div className="flex items-center gap-1.5"><MapPin size={13} /><span>{project.location}</span></div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {latestAudit && (
                        <Link to={`/audits/capture?auditId=${latestAudit.id}&templateId=${latestAudit.template_id}&projectId=${project.id}`}
                          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                          Continue Audit <ArrowRight size={14} />
                        </Link>
                      )}
                      {selectingTemplateFor === project.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            autoFocus
                            onChange={e => { if (e.target.value) handleStartAudit(project.id, e.target.value); }}
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                          >
                            <option value="">Pick template…</option>
                            {pts.map(pt => (
                              <option key={pt.template_id} value={pt.template_id}>
                                {(pt.checklist_templates as any)?.name}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => setSelectingTemplateFor(null)} className="text-xs text-muted-foreground">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (pts.length === 0) { toast.error('Assign templates to this project first.'); return; }
                            if (pts.length === 1) { handleStartAudit(project.id, pts[0].template_id); return; }
                            setSelectingTemplateFor(project.id);
                          }}
                          disabled={creatingAuditFor === project.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {creatingAuditFor === project.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                          New Audit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {projectAudits.length > 0 && (
                  <div className="border-t px-5 py-3 bg-muted/20">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground font-medium">Recent Audits:</span>
                      {projectAudits.slice(0, 3).map(a => (
                        <Link key={a.id} to={`/audits/capture?auditId=${a.id}&templateId=${a.template_id}&projectId=${project.id}`}
                          className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <Activity size={12} className="text-primary" />
                          <span>{a.period}</span>
                          <span className={`font-medium px-1 py-0.5 rounded text-[10px] ${
                            a.status === 'draft' ? 'bg-warning/10 text-warning' :
                            a.status === 'submitted' ? 'bg-primary/10 text-primary' :
                            'bg-success/10 text-success'
                          }`}>{a.status}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
          {!projects?.length && (
            <div className="text-center text-xs text-muted-foreground pt-2">
              <Link to="/audits" className="text-primary hover:underline">Open audits →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
