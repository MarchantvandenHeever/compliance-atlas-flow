import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
}

const variantStyles = {
  default: 'bg-card border',
  success: 'bg-card border border-l-4 border-l-success',
  danger: 'bg-card border border-l-4 border-l-destructive',
  warning: 'bg-card border border-l-4 border-l-warning',
  primary: 'bg-card border border-l-4 border-l-primary',
};

const iconVariants = {
  default: 'text-muted-foreground bg-muted',
  success: 'text-success bg-success/10',
  danger: 'text-destructive bg-destructive/10',
  warning: 'text-warning bg-warning/10',
  primary: 'text-primary bg-primary/10',
};

export default function MetricCard({ title, value, subtitle, icon: Icon, variant = 'default' }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg p-4 ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1 font-display">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconVariants[variant]}`}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );
}
