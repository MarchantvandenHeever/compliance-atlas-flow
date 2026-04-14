import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Building2, Activity, ArrowRight, Loader2, PlayCircle, Archive, Trash2, RotateCcw, FolderArchive, FolderOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects, useUpdateProjectStatus, useDeleteProject } from '@/hooks/useProjects';
import { useAuditInstances, useCreateAudit } from '@/hooks/useAuditData';
import { useAllProjectTemplates } from '@/hooks/useProjectTemplates';
import { useAuth } from '@/contexts/AuthContext';
import NewProjectDialog from '@/components/NewProjectDialog';
import ProjectTeamPanel from '@/components/ProjectTeamPanel';
import ProjectTemplatesDialog from '@/components/ProjectTemplatesDialog';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Projects() {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const { data: activeProjects, isLoading: loadingActive } = useProjects('active');
  const { data: onHoldProjects } = useProjects('on_hold');
  const { data: archivedProjects, isLoading: loadingArchived } = useProjects('completed');
  const { data: audits } = useAuditInstances();
  const { data: allPT } = useAllProjectTemplates();
  const createAudit = useCreateAudit();
  const updateStatus = useUpdateProjectStatus();
  const deleteProject = useDeleteProject();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [creatingAuditFor, setCreatingAuditFor] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'delete' | 'reopen'; projectId: string; projectName: string } | null>(null);

  const isAdmin = hasRole('admin');

  // Combine active + on_hold for the "Active" tab
  const liveProjects = [...(activeProjects || []), ...(onHoldProjects || [])];

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
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'archive') {
      await updateStatus.mutateAsync({ projectId: confirmAction.projectId, status: 'completed' });
    } else if (confirmAction.type === 'reopen') {
      await updateStatus.mutateAsync({ projectId: confirmAction.projectId, status: 'active' });
    } else if (confirmAction.type === 'delete') {
      await deleteProject.mutateAsync(confirmAction.projectId);
    }
    setConfirmAction(null);
  };

  const isLoading = tab === 'active' ? loadingActive : loadingArchived;
  const projects = tab === 'active' ? liveProjects : (archivedProjects || []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage environmental compliance projects</p>
        </div>
        <NewProjectDialog />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'archived')}>
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <FolderOpen size={14} /> Active ({liveProjects.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-1.5">
            <FolderArchive size={14} /> Archived ({archivedProjects?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {tab === 'active' ? 'No active projects. Create one to get started.' : 'No archived projects yet.'}
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map(project => {
                const projectAudits = audits?.filter(a => a.project_id === project.id) || [];
                const latestAudit = projectAudits[0];
                const pts = getProjectTemplates(project.id);
                const isArchived = project.status === 'completed';

                return (
                  <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`bg-card border rounded-lg overflow-hidden ${isArchived ? 'opacity-80' : ''}`}>
                    <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                              project.status === 'active' ? 'bg-success/10 text-success' :
                              project.status === 'completed' ? 'bg-muted text-muted-foreground' :
                              'bg-warning/10 text-warning'
                            }`}>{project.status === 'completed' ? 'archived' : project.status}</span>
                            <span className="text-xs text-muted-foreground">{project.audit_frequency}</span>
                            {pts.map((pt, idx) => (
                              <span key={pt.id} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {pts.length > 1 ? `${idx + 1}. ` : ''}{(pt.checklist_templates as any)?.name}
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

                        <div className="flex items-center gap-2 flex-wrap">
                          {!isArchived && (
                            <>
                              <ProjectTemplatesDialog projectId={project.id} projectName={project.name} />
                              <ProjectTeamPanel projectId={project.id} projectName={project.name} />
                              {latestAudit && (
                                <Link to={`/audits/capture?auditId=${latestAudit.id}&templateId=${latestAudit.template_id}&projectId=${project.id}`}
                                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                                  Continue Audit <ArrowRight size={14} />
                                </Link>
                              )}
                              {pts.length > 0 ? (
                                <button
                                  onClick={() => handleStartAudit(project.id, pts[0].template_id)}
                                  disabled={creatingAuditFor === project.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                  {creatingAuditFor === project.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                                  New Audit
                                </button>
                              ) : (
                                <button
                                  onClick={() => toast.error('Assign templates to this project first.')}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium"
                                >
                                  <PlayCircle size={14} /> New Audit
                                </button>
                              )}
                            </>
                          )}

                          {/* Admin actions */}
                          {isAdmin && !isArchived && (
                            <button
                              onClick={() => setConfirmAction({ type: 'archive', projectId: project.id, projectName: project.name })}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors text-muted-foreground"
                              title="Archive project"
                            >
                              <Archive size={14} /> Archive
                            </button>
                          )}
                          {isAdmin && isArchived && (
                            <button
                              onClick={() => setConfirmAction({ type: 'reopen', projectId: project.id, projectName: project.name })}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                              title="Reopen project"
                            >
                              <RotateCcw size={14} /> Reopen
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmAction({ type: 'delete', projectId: project.id, projectName: project.name })}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
                              title="Delete project"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {projectAudits.length > 0 && (
                      <div className="border-t px-5 py-3 bg-muted/20">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground font-medium">
                            {isArchived ? 'Final Audits:' : 'Recent Audits:'}
                          </span>
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
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'archive' && 'Archive Project'}
              {confirmAction?.type === 'reopen' && 'Reopen Project'}
              {confirmAction?.type === 'delete' && 'Delete Project'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'archive' && (
                <>Are you sure you want to archive <strong>{confirmAction.projectName}</strong>? The project and all its audits and reports will be preserved as read-only records. You can reopen it later if needed.</>
              )}
              {confirmAction?.type === 'reopen' && (
                <>Are you sure you want to reopen <strong>{confirmAction?.projectName}</strong>? This will move it back to active projects where new audits can be created.</>
              )}
              {confirmAction?.type === 'delete' && (
                <>Are you sure you want to permanently delete <strong>{confirmAction?.projectName}</strong>? This action cannot be undone and will remove all associated audits, responses, and reports.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction?.type === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmAction?.type === 'archive' && 'Archive'}
              {confirmAction?.type === 'reopen' && 'Reopen'}
              {confirmAction?.type === 'delete' && 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
