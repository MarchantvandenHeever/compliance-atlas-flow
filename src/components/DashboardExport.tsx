import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { AuditMetric } from '@/hooks/useDashboardData';

interface DashboardExportProps {
  auditMetrics: AuditMetric[];
  trendData: Array<{ period: string; compliance: number; compliant: number; nonCompliant: number; noted: number }>;
  totals: { compliant: number; nonCompliant: number; noted: number; assessed: number; compliance: number };
  selectedProject?: string;
  projects: Array<{ id: string; name: string; client: string }>;
  pageTitle: string;
}

export default function DashboardExport({ auditMetrics, trendData, totals, selectedProject, projects, pageTitle }: DashboardExportProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const projectName = selectedProject
    ? projects.find(p => p.id === selectedProject)?.name || 'Selected Project'
    : 'All Projects';

  const dateStr = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF('p', 'mm', 'a4') as any;
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      // Header
      doc.setFillColor(0, 150, 166);
      doc.rect(0, 0, pageW, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`${pageTitle} Report`, 14, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${projectName} • ${dateStr}`, 14, 24);
      doc.text('Environmental Compliance Overview', 14, 30);
      y = 42;

      // Summary metrics
      doc.setTextColor(22, 56, 71);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary Metrics', 14, y);
      y += 8;

      const metricsData = [
        ['Overall Compliance', `${totals.compliance}%`],
        ['Items Assessed', String(totals.assessed)],
        ['Compliant Items', String(totals.compliant)],
        ['Non-Compliant Items', String(totals.nonCompliant)],
        ['N/A Items', String(totals.noted)],
      ];

      doc.autoTable({
        startY: y,
        head: [['Metric', 'Value']],
        body: metricsData,
        theme: 'grid',
        headStyles: { fillColor: [0, 150, 166], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 12;

      // Audit comparison table
      if (auditMetrics.length > 0) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Audit Comparison', 14, y);
        y += 8;

        const tableBody = auditMetrics.map((m, i) => {
          const delta = i < auditMetrics.length - 1 ? m.compliance - auditMetrics[i + 1].compliance : 0;
          const deltaStr = i < auditMetrics.length - 1 ? `${delta > 0 ? '+' : ''}${delta}%` : '—';
          return [
            m.project?.name || '—',
            m.audit.period,
            String(m.compliant),
            String(m.nonCompliant),
            String(m.noted),
            `${m.compliance}%`,
            deltaStr,
          ];
        });

        doc.autoTable({
          startY: y,
          head: [['Project', 'Period', 'C', 'NC', 'N/A', 'Compliance', 'Δ Change']],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [0, 150, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
          },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 12;
      }

      // Trend data table
      if (trendData.length > 1) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Compliance Trend Data', 14, y);
        y += 8;

        doc.autoTable({
          startY: y,
          head: [['Period', 'Compliance %', 'Compliant', 'Non-Compliant', 'N/A']],
          body: trendData.map(t => [t.period, `${t.compliance}%`, String(t.compliant), String(t.nonCompliant), String(t.noted)]),
          theme: 'grid',
          headStyles: { fillColor: [0, 150, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Generated ${dateStr} • Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text('CES Environmental Compliance', pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }

      doc.save(`${pageTitle.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(null);
    }
  };

  const exportDocx = async () => {
    setExporting('docx');
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber, HeadingLevel } = docx;

      const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
      const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
      const headerShading = { fill: '0096A6', type: ShadingType.CLEAR, color: 'auto' };
      const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

      const makeHeaderCell = (text: string, width: number) =>
        new TableCell({
          borders, width: { size: width, type: WidthType.DXA },
          shading: headerShading, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18, font: 'Arial' })] })],
        });

      const makeCell = (text: string, width: number, opts?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) =>
        new TableCell({
          borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({
            alignment: opts?.align,
            children: [new TextRun({ text, size: 18, font: 'Arial', bold: opts?.bold })],
          })],
        });

      const children: any[] = [];

      // Title
      children.push(new Paragraph({
        children: [new TextRun({ text: `${pageTitle} Report`, bold: true, size: 36, font: 'Arial', color: '0096A6' })],
        spacing: { after: 100 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: `${projectName} • ${dateStr}`, size: 20, font: 'Arial', color: '666666' })],
        spacing: { after: 300 },
      }));

      // Summary table
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Summary Metrics', bold: true, size: 26, font: 'Arial' })] }));

      const summaryRows = [
        ['Overall Compliance', `${totals.compliance}%`],
        ['Items Assessed', String(totals.assessed)],
        ['Compliant Items', String(totals.compliant)],
        ['Non-Compliant Items', String(totals.nonCompliant)],
        ['N/A Items', String(totals.noted)],
      ];
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5000, 4360],
        rows: [
          new TableRow({ children: [makeHeaderCell('Metric', 5000), makeHeaderCell('Value', 4360)] }),
          ...summaryRows.map(([k, v]) => new TableRow({ children: [makeCell(k, 5000, { bold: true }), makeCell(v, 4360, { align: AlignmentType.CENTER })] })),
        ],
      }));
      children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

      // Audit comparison
      if (auditMetrics.length > 0) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Audit Comparison', bold: true, size: 26, font: 'Arial' })] }));
        const colW = [2200, 1400, 800, 800, 800, 1200, 1000];
        const headers = ['Project', 'Period', 'C', 'NC', 'N/A', 'Compliance', 'Δ Change'];
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: colW,
          rows: [
            new TableRow({ children: headers.map((h, i) => makeHeaderCell(h, colW[i])) }),
            ...auditMetrics.map((m, i) => {
              const delta = i < auditMetrics.length - 1 ? m.compliance - auditMetrics[i + 1].compliance : 0;
              const deltaStr = i < auditMetrics.length - 1 ? `${delta > 0 ? '+' : ''}${delta}%` : '—';
              const vals = [m.project?.name || '—', m.audit.period, String(m.compliant), String(m.nonCompliant), String(m.noted), `${m.compliance}%`, deltaStr];
              return new TableRow({ children: vals.map((v, j) => makeCell(v, colW[j], j >= 2 ? { align: AlignmentType.CENTER } : undefined)) });
            }),
          ],
        }));
        children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
      }

      // Trend data
      if (trendData.length > 1) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Compliance Trend Data', bold: true, size: 26, font: 'Arial' })] }));
        const tColW = [2400, 1700, 1700, 1700, 1860];
        const tHeaders = ['Period', 'Compliance %', 'Compliant', 'Non-Compliant', 'N/A'];
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: tColW,
          rows: [
            new TableRow({ children: tHeaders.map((h, i) => makeHeaderCell(h, tColW[i])) }),
            ...trendData.map(t => {
              const vals = [t.period, `${t.compliance}%`, String(t.compliant), String(t.nonCompliant), String(t.noted)];
              return new TableRow({ children: vals.map((v, j) => makeCell(v, tColW[j], j >= 1 ? { align: AlignmentType.CENTER } : undefined)) });
            }),
          ],
        }));
      }

      const doc = new Document({
        styles: {
          default: { document: { run: { font: 'Arial', size: 20 } } },
        },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          headers: {
            default: new Header({
              children: [new Paragraph({
                children: [new TextRun({ text: 'CES Environmental Compliance', size: 16, color: '999999', font: 'Arial' })],
                alignment: AlignmentType.RIGHT,
              })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                children: [
                  new TextRun({ text: `Generated ${dateStr} • Page `, size: 16, color: '999999', font: 'Arial' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999', font: 'Arial' }),
                ],
              })],
            }),
          },
          children,
        }],
      });

      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pageTitle.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Word report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate Word report');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting('xlsx');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        [`${pageTitle} Report — ${projectName}`],
        [`Generated: ${dateStr}`],
        [],
        ['Metric', 'Value'],
        ['Overall Compliance', `${totals.compliance}%`],
        ['Items Assessed', totals.assessed],
        ['Compliant Items', totals.compliant],
        ['Non-Compliant Items', totals.nonCompliant],
        ['N/A Items', totals.noted],
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Audit comparison sheet
      if (auditMetrics.length > 0) {
        const compData = [
          ['Project', 'Period', 'Compliant', 'Non-Compliant', 'N/A', 'Compliance %', 'Δ Change'],
          ...auditMetrics.map((m, i) => {
            const delta = i < auditMetrics.length - 1 ? m.compliance - auditMetrics[i + 1].compliance : null;
            return [
              m.project?.name || '—',
              m.audit.period,
              m.compliant,
              m.nonCompliant,
              m.noted,
              m.compliance,
              delta !== null ? delta : '—',
            ];
          }),
        ];
        const compWs = XLSX.utils.aoa_to_sheet(compData);
        compWs['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 14 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, compWs, 'Audit Comparison');
      }

      // Trend data sheet
      if (trendData.length > 0) {
        const tData = [
          ['Period', 'Compliance %', 'Compliant', 'Non-Compliant', 'N/A'],
          ...trendData.map(t => [t.period, t.compliance, t.compliant, t.nonCompliant, t.noted]),
        ];
        const tWs = XLSX.utils.aoa_to_sheet(tData);
        tWs['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, tWs, 'Compliance Trend');
      }

      XLSX.writeFile(wb, `${pageTitle.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate Excel report');
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!exporting}>
          {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Export Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportPdf} disabled={!!exporting}>
          <FileText size={16} className="mr-2 text-destructive" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportDocx} disabled={!!exporting}>
          <FileText size={16} className="mr-2 text-primary" />
          Export as Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} disabled={!!exporting}>
          <FileSpreadsheet size={16} className="mr-2 text-success" />
          Export as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
