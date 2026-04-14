import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, User, Loader2, Upload, Image, FileDown, Eye, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuditInstances } from '@/hooks/useAuditData';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ProjectFilter from '@/components/ProjectFilter';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReportReview, useCreateReportReview, useAddReportVersion } from '@/hooks/useReportReview';
import ReportReviewPanel, { ReportReviewStatusBadge } from '@/components/ReportReviewPanel';
import { useQuery } from '@tanstack/react-query';

function AuditReportRow({
  audit,
  project,
  profile,
  clientLogoUrl,
  generating,
  setGenerating,
}: {
  audit: any;
  project: any;
  profile: any;
  clientLogoUrl: string;
  generating: string | null;
  setGenerating: (id: string | null) => void;
}) {
  const { user, hasRole } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);
  const { data: review } = useReportReview(audit.id);
  const createReview = useCreateReportReview();
  const addVersion = useAddReportVersion();

  const generateReport = async (format: 'pdf' | 'docx') => {
    setGenerating(audit.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const functionName = format === 'docx' ? 'generate-report-docx' : 'generate-report';
      const url = `https://${projectId}.supabase.co/functions/v1/${functionName}`;

      const reqBody: any = {
        reportTitle: `${project?.name || 'Audit'} - ${audit.period}`,
        reportNumber: `Audit ${audit.period}`,
        period: audit.period,
        author: profile?.display_name || 'ECO Auditor',
        reviewer: '',
        auditId: audit.id,
        projectId: audit.project_id,
      };
      if (clientLogoUrl) reqBody.clientLogoUrl = clientLogoUrl;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate report');
      }

      const blob = await response.blob();

      // Save to storage and create review record
      const storagePath = `generated/${audit.id}/${Date.now()}.${format}`;
      const { error: uploadError } = await supabase.storage
        .from('report-files')
        .upload(storagePath, blob, { upsert: true });

      let reviewRecord = review;
      if (!reviewRecord) {
        reviewRecord = await createReview.mutateAsync({ auditId: audit.id });
      }

      if (!uploadError && reviewRecord) {
        await addVersion.mutateAsync({
          reportReviewId: reviewRecord.id,
          format,
          uploadType: 'generated',
          storagePath,
        });
      }

      // Also download for user
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${(project?.name || 'Report').replace(/\s+/g, '_')}_${audit.period.replace(/\s/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success(`${format.toUpperCase()} report generated and saved for review`);
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const handleSubmitForReview = async () => {
    if (!review) {
      await createReview.mutateAsync({ auditId: audit.id });
      toast.success('Report submitted for review');
    } else {
      setReviewOpen(true);
    }
  };

  const reviewStatus = review?.status as string | undefined;

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          <FileText size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{project?.name || 'Audit'} — {audit.period}</p>
          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar size={11} /> {audit.submitted_at ? new Date(audit.submitted_at).toLocaleDateString() : '—'}</span>
            <span className="flex items-center gap-1"><User size={11} /> {profile?.display_name || 'Auditor'}</span>
            <span>{audit.type} audit</span>
            {audit.revision_count > 0 && <span>Rev {audit.revision_count}</span>}
          </div>
        </div>

        {/* Audit status */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${audit.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {audit.status === 'approved' ? '✅ Audit Approved' : '⏳ Audit Pending'}
        </span>

        {/* Report review status */}
        {reviewStatus && <ReportReviewStatusBadge status={reviewStatus} />}

        {/* Review button */}
        {review ? (
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setReviewOpen(true)}>
            <Eye size={12} className="mr-1" /> Review
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-xs" onClick={handleSubmitForReview}
            disabled={createReview.isPending}>
            <Send size={12} className="mr-1" /> Submit for Review
          </Button>
        )}

        <Link to={`/audits/capture?projectId=${audit.project_id}&templateId=${audit.template_id}&auditId=${audit.id}`}
          className="text-xs text-primary hover:underline">View Audit</Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button disabled={generating === audit.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {generating === audit.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
              Export
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => generateReport('pdf')}>
              <Download size={14} className="mr-2" /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => generateReport('docx')}>
              <FileText size={14} className="mr-2" /> Download Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReportReviewPanel
        auditId={audit.id}
        projectName={project?.name || 'Audit'}
        period={audit.period}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </>
  );
}

export default function Reports() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const { data: allAudits } = useAuditInstances();
  const { data: projects } = useProjects();
  const { profile } = useAuth();

  const audits = selectedProject
    ? allAudits?.filter(a => a.project_id === selectedProject) || []
    : allAudits || [];

  const completedAudits = audits
    .filter(a => a.status === 'submitted' || a.status === 'approved')
    .sort((a, b) => new Date(b.submitted_at || b.updated_at).getTime() - new Date(a.submitted_at || a.updated_at).getTime());

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const path = `branding/client-logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('audit-photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('audit-photos').getPublicUrl(path);
      setClientLogoUrl(urlData.publicUrl);
      toast.success('Client logo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate, review, and manage audit reports</p>
        </div>
        <ProjectFilter projects={projects || []} selectedProjectId={selectedProject} onChange={setSelectedProject} />
      </div>

      {/* Client Logo Upload */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Image size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Client Logo for Reports</h4>
              <p className="text-xs text-muted-foreground">Upload a client logo to appear on the cover page.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {clientLogoUrl && (
              <img src={clientLogoUrl} alt="Client logo" className="h-10 w-auto rounded border bg-white p-1" />
            )}
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-muted/50 disabled:opacity-50 transition-colors">
              {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {clientLogoUrl ? 'Change Logo' : 'Upload Logo'}
            </button>
            {clientLogoUrl && (
              <button onClick={() => setClientLogoUrl('')} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
            )}
          </div>
        </div>
      </div>

      {/* Completed Audits for Report Generation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
        <div className="p-4 border-b"><h3 className="text-sm font-semibold">Audit Reports — Generate & Review</h3></div>
        {completedAudits.length > 0 ? (
          <div className="divide-y">
            {completedAudits.map(audit => {
              const project = projects?.find(p => p.id === audit.project_id);
              return (
                <AuditReportRow
                  key={audit.id}
                  audit={audit}
                  project={project}
                  profile={profile}
                  clientLogoUrl={clientLogoUrl}
                  generating={generating}
                  setGenerating={setGenerating}
                />
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No completed audits found. Submit an audit to generate reports.
          </div>
        )}
      </motion.div>
    </div>
  );
}
