import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Plus, Calendar, User, Eye, Loader2, Upload, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuditInstances } from '@/hooks/useAuditData';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Reports() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const { data: audits } = useAuditInstances();
  const { data: projects } = useProjects();
  const { profile } = useAuth();

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

  const staticReports = [
    { id: 'r-5', title: 'Construction Audit Report 5', period: 'Mar 2026', status: 'Draft', author: 'Brain Green', reviewer: 'Charl Kruger', date: '01 Apr 2026', compliance: 100 },
    { id: 'r-4', title: 'Construction Audit Report 4', period: 'Feb 2026', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '03 Mar 2026', compliance: 99 },
    { id: 'r-3', title: 'Construction Audit Report 3', period: 'Jan 2026', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '30 Jan 2026', compliance: 98 },
    { id: 'r-2', title: 'Construction Audit Report 2', period: 'Dec 2025', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '12 Dec 2025', compliance: 97 },
    { id: 'r-1', title: 'Construction Audit Report 1', period: 'Nov 2025', status: 'Submitted', author: 'Brain Green', reviewer: 'Charl Kruger', date: '01 Dec 2025', compliance: 95 },
  ];

  const dbReports = audits?.map((a) => ({
    id: a.id,
    title: `${(projects?.find(p => p.id === a.project_id) as any)?.name || 'Audit'} - ${a.period}`,
    period: a.period,
    status: a.status === 'draft' ? 'Draft' : a.status === 'submitted' ? 'Submitted' : 'Approved',
    author: profile?.display_name || 'Auditor',
    reviewer: '',
    date: new Date(a.created_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }),
    compliance: 0,
    auditId: a.id,
    projectId: a.project_id,
  })) || [];

  const allReports = [...dbReports, ...staticReports];

  const generatePDF = async (report: typeof allReports[0]) => {
    setGenerating(report.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/generate-report`;

      const reqBody: any = {
        reportTitle: report.title,
        reportNumber: `Report ${allReports.indexOf(report) + 1}`,
        period: report.period,
        author: report.author,
        reviewer: report.reviewer,
      };
      if (clientLogoUrl) reqBody.clientLogoUrl = clientLogoUrl;
      if ('auditId' in report) {
        reqBody.auditId = (report as any).auditId;
        reqBody.projectId = (report as any).projectId;
      }

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
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `CES_Audit_${report.period.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success('Report downloaded successfully');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const generateMonthlyReport = async () => {
    setGenerating('new');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/generate-report`;

      const reqBody: any = {
        reportTitle: 'Monthly Environmental Audit Report',
        reportNumber: 'Report ' + (allReports.length + 1),
        period: new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
        author: profile?.display_name || 'ECO Auditor',
        reviewer: 'Reviewer',
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

      if (!response.ok) throw new Error('Failed to generate');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `CES_Monthly_Report_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success('Monthly report generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and manage audit reports</p>
        </div>
        <button onClick={generateMonthlyReport} disabled={generating === 'new'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {generating === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Generate Report
        </button>
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
              <p className="text-xs text-muted-foreground">Upload a client logo to appear on the cover page alongside the CES logo.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Monthly Audit Report</h4>
          <p className="text-xs text-muted-foreground mb-3">Full compliance report with appendices, charts, and photo evidence.</p>
          <button onClick={generateMonthlyReport} className="text-xs text-primary font-medium hover:underline">Generate PDF →</button>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Weekly NC Summary</h4>
          <p className="text-xs text-muted-foreground mb-3">Concise summary of non-conformances for contractor distribution.</p>
          <button className="text-xs text-primary font-medium hover:underline">Generate Summary →</button>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-1">Data Export</h4>
          <p className="text-xs text-muted-foreground mb-3">Export checklist data and compliance tables as CSV/Excel.</p>
          <button className="text-xs text-primary font-medium hover:underline">Export Data →</button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg">
        <div className="p-4 border-b"><h3 className="text-sm font-semibold">Report History</h3></div>
        <div className="divide-y">
          {allReports.map((report) => (
            <div key={report.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{report.title}</p>
                <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {report.date}</span>
                  <span className="flex items-center gap-1"><User size={11} /> {report.author}</span>
                  {report.compliance > 0 && <span>{report.compliance}% compliant</span>}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                report.status === 'Draft' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
              }`}>{report.status}</span>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Preview">
                  <Eye size={14} />
                </button>
                <button onClick={() => generatePDF(report)} disabled={generating === report.id}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50" title="Download PDF">
                  {generating === report.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
