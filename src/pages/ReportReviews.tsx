import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, AlertTriangle, XCircle, MessageSquare, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useMyProjectIds } from '@/hooks/useProjectTeam';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReportReviewPanel, { ReportReviewStatusBadge } from '@/components/ReportReviewPanel';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'amendments_requested', label: 'Amendments Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'disapproved', label: 'Disapproved' },
];

export default function ReportReviews() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { data: projects } = useProjects();
  const { data: myReviewerProjectIds } = useMyProjectIds('reviewer');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['all-report-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_reviews')
        .select('*, audit_instances(id, period, type, project_id, auditor_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filteredReviews = reviews?.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const audit = r.audit_instances as any;
    if (projectFilter !== 'all') {
      if (audit?.project_id !== projectFilter) return false;
    }
    // Non-admin reviewers only see reviews for their assigned projects
    if (!isAdmin && myReviewerProjectIds && audit?.project_id) {
      if (!myReviewerProjectIds.includes(audit.project_id)) return false;
    }
    return true;
  }) || [];

  const getProjectName = (projectId: string) =>
    projects?.find(p => p.id === projectId)?.name || 'Unknown Project';

  const statusCounts = reviews?.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Report Reviews</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage and review generated audit reports
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUS_OPTIONS.filter(s => s.value !== 'all').map(s => {
          const count = statusCounts[s.value] || 0;
          const icons: Record<string, any> = {
            pending_review: Clock,
            under_review: MessageSquare,
            amendments_requested: AlertTriangle,
            approved: CheckCircle,
            disapproved: XCircle,
          };
          const colors: Record<string, string> = {
            pending_review: 'text-amber-600',
            under_review: 'text-blue-600',
            amendments_requested: 'text-orange-600',
            approved: 'text-green-600',
            disapproved: 'text-red-600',
          };
          const Icon = icons[s.value];
          return (
            <motion.button
              key={s.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                statusFilter === s.value ? 'ring-2 ring-primary bg-muted/30' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={colors[s.value]} />
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter size={14} className="mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p>No report reviews found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReviews.map((review, i) => {
            const audit = review.audit_instances as any;
            const projectName = audit ? getProjectName(audit.project_id) : 'Unknown';
            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {audit?.type?.charAt(0).toUpperCase() + audit?.type?.slice(1)} — {audit?.period}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(review.created_at).toLocaleDateString()}
                      {review.reviewed_at && ` · Reviewed ${new Date(review.reviewed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <ReportReviewStatusBadge status={review.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedReview({ review, audit, projectName })}
                  >
                    {review.status === 'pending_review' ? 'Start Review' :
                     review.status === 'under_review' ? 'Continue Review' : 'View'}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review panel dialog */}
      {selectedReview && (
        <ReportReviewPanel
          auditId={selectedReview.audit?.id || ''}
          projectName={selectedReview.projectName}
          period={selectedReview.audit?.period || ''}
          open={!!selectedReview}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  );
}
