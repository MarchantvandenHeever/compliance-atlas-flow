import { ComplianceStatus } from '@/types';
import { getStatusColor, getStatusLabel } from '@/lib/compliance';

interface StatusBadgeProps {
  status: ComplianceStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  if (!status) return <span className="text-xs text-muted-foreground italic">Not assessed</span>;

  return (
    <span className={`
      inline-flex items-center rounded-md border font-medium
      ${getStatusColor(status)}
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
    `}>
      {getStatusLabel(status)}
    </span>
  );
}
