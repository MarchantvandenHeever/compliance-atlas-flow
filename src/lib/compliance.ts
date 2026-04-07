import { AuditItemResponse, ComplianceMetrics, ComplianceStatus } from '@/types';

export function calculateCompliance(responses: AuditItemResponse[], totalItems: number): ComplianceMetrics {
  const compliantCount = responses.filter(r => r.status === 'C').length;
  const nonCompliantCount = responses.filter(r => r.status === 'NC').length;
  const notedCount = responses.filter(r => r.status === 'N/A').length;
  const unansweredCount = totalItems - compliantCount - nonCompliantCount - notedCount;
  const totalAssessed = compliantCount + nonCompliantCount;
  const compliancePercentage = totalAssessed > 0 ? Math.round((compliantCount / totalAssessed) * 100) : 0;

  return {
    compliantCount,
    nonCompliantCount,
    notedCount,
    unansweredCount,
    totalItems,
    compliancePercentage,
  };
}

export function getStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'C': return 'status-compliant';
    case 'NC': return 'status-non-compliant';
    case 'N/A': return 'status-noted';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: ComplianceStatus): string {
  switch (status) {
    case 'C': return 'Compliant';
    case 'NC': return 'Non-Compliant';
    case 'N/A': return 'N/A / Noted';
    default: return 'Not Assessed';
  }
}

export function getStatusDotClass(status: ComplianceStatus): string {
  switch (status) {
    case 'C': return 'status-dot-compliant';
    case 'NC': return 'status-dot-nc';
    case 'N/A': return 'status-dot-noted';
    default: return 'bg-muted-foreground/30';
  }
}
