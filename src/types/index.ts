export type ComplianceStatus = 'C' | 'NC' | 'N/A' | null;

export interface ChecklistItem {
  id: string;
  sectionId: string;
  conditionRef: string;
  description: string;
  source: 'EA' | 'EMPr';
  order: number;
}

export interface ChecklistSection {
  id: string;
  templateId: string;
  name: string;
  source: 'EA' | 'EMPr';
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  isActive: boolean;
  sections: ChecklistSection[];
  items: ChecklistItem[];
}

export interface AuditItemResponse {
  id: string;
  auditId: string;
  checklistItemId: string;
  status: ComplianceStatus;
  comments: string;
  actions: string;
  photos: PhotoEvidence[];
  lastEditedAt: string;
  editedBy: string;
}

export interface PhotoEvidence {
  id: string;
  url: string;
  caption: string;
  timestamp: string;
  gpsLocation?: string;
}

export interface AuditInstance {
  id: string;
  projectId: string;
  templateId: string;
  period: string; // e.g. "2026-03"
  type: 'daily' | 'weekly' | 'monthly';
  status: 'draft' | 'submitted' | 'approved';
  createdAt: string;
  submittedAt?: string;
  auditor: string;
  responses: AuditItemResponse[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  auditFrequency: string;
  status: 'active' | 'completed' | 'on-hold';
  templateId: string;
  description: string;
}

export interface ComplianceMetrics {
  compliantCount: number;
  nonCompliantCount: number;
  notedCount: number;
  unansweredCount: number;
  totalItems: number;
  compliancePercentage: number;
}

export interface CorrectiveAction {
  id: string;
  auditId: string;
  checklistItemId: string;
  description: string;
  assignedTo: string;
  targetDate: string;
  status: 'open' | 'in-progress' | 'closed';
  severity: 'low' | 'medium' | 'high';
}
