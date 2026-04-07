import { motion } from 'framer-motion';
import { sampleAuditData } from '@/data/checklistData';
import { MapPin, Calendar, Building2, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const project = sampleAuditData.project;
const latestTrend = sampleAuditData.monthlyTrend[sampleAuditData.monthlyTrend.length - 1];

export default function Projects() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage environmental compliance projects</p>
        </div>
        <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          + New Project
        </button>
      </div>

      {/* Project Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 text-success">Active</span>
                <span className="text-xs text-muted-foreground">{project.auditFrequency}</span>
              </div>
              <h3 className="text-lg font-semibold font-display">{project.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>

              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>{project.client}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  <span>{project.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>Next audit: April 2026</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="4"
                      strokeDasharray={`${(latestTrend.compliance / 100) * 175.9} 175.9`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{latestTrend.compliance}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{latestTrend.month}</p>
              </div>

              <Link to="/audit" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                Open Audit <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Audit history preview */}
        <div className="border-t px-5 py-3 bg-muted/20">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground font-medium">Recent Audits:</span>
            {sampleAuditData.monthlyTrend.slice(-3).map(t => (
              <div key={t.month} className="flex items-center gap-1.5">
                <Activity size={12} className="text-primary" />
                <span>{t.month}</span>
                <span className="font-medium">{t.compliance}%</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
