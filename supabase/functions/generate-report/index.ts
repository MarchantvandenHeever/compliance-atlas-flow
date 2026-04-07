import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// CES Brand colors
const TEAL = [0, 150, 166] as const;       // #0096A6
const SLATE = [22, 56, 71] as const;        // #163847
const AQUA = [169, 214, 216] as const;      // #A9D6D8
const LIGHT_BG = [247, 248, 248] as const;  // #F7F8F8
const GREEN = [34, 139, 34] as const;
const RED = [220, 38, 38] as const;
const GREY = [156, 163, 175] as const;

interface ReportRequest {
  auditId?: string;
  projectId?: string;
  period?: string;
  reportTitle?: string;
  reportNumber?: string;
  author?: string;
  reviewer?: string;
  clientLogoUrl?: string;
}

// Fetch image as base64 data URL
async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const ct = res.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${b64}`;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ReportRequest = await req.json();
    const {
      reportTitle = "Construction Environmental Audit Report",
      reportNumber = "Report 1",
      period = new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      author = "ECO Auditor",
      reviewer = "Reviewer",
      projectId,
      auditId,
      clientLogoUrl,
    } = body;

    // Fetch CES logo
    const cesLogoUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/audit-photos/branding/ces-logo.png`;
    const cesLogoData = await fetchImageBase64(cesLogoUrl);

    // Fetch client logo if provided
    let clientLogoData: string | null = null;
    if (clientLogoUrl) {
      clientLogoData = await fetchImageBase64(clientLogoUrl);
    }

    // Fetch audit data if auditId provided
    let auditData: any = null;
    let responses: any[] = [];
    let sections: any[] = [];
    let items: any[] = [];
    let photos: any[] = [];
    let projectData: any = null;

    if (auditId) {
      const { data: audit } = await supabase
        .from("audit_instances")
        .select("*, projects(*)")
        .eq("id", auditId)
        .single();
      auditData = audit;
      projectData = audit?.projects;

      const { data: resp } = await supabase
        .from("audit_item_responses")
        .select("*, response_photos(*)")
        .eq("audit_id", auditId);
      responses = resp || [];
      photos = responses.flatMap((r: any) => (r.response_photos || []).map((p: any) => ({ ...p, responseId: r.id })));

      if (audit?.template_id) {
        const { data: secs } = await supabase
          .from("checklist_sections")
          .select("*")
          .eq("template_id", audit.template_id)
          .order("sort_order");
        sections = secs || [];

        const sectionIds = sections.map((s: any) => s.id);
        if (sectionIds.length > 0) {
          const { data: itms } = await supabase
            .from("checklist_items")
            .select("*")
            .in("section_id", sectionIds)
            .order("sort_order");
          items = itms || [];
        }
      }
    } else if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      projectData = project;
    }

    // Calculate compliance metrics
    const compliantCount = responses.filter((r: any) => r.status === "C").length;
    const ncCount = responses.filter((r: any) => r.status === "NC").length;
    const naCount = responses.filter((r: any) => r.status === "NA").length;
    const totalAssessed = compliantCount + ncCount;
    const compliancePercent = totalAssessed > 0
      ? Math.round((compliantCount / totalAssessed) * 100)
      : 0;

    // Generate PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let pageNum = 0;

    // Helper: add page number footer
    const addFooter = () => {
      pageNum++;
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(`Page ${pageNum}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("CES Environmental and Social Advisory Services", margin, pageH - 10);
      doc.text("CONFIDENTIAL", pageW - margin, pageH - 10, { align: "right" });
    };

    // Helper: draw a horizontal rule
    const drawHR = (y: number) => {
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
    };

    // ==================== COVER PAGE ====================
    // Full-page dark background
    doc.setFillColor(...SLATE);
    doc.rect(0, 0, pageW, pageH, "F");

    // Teal accent bar
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, pageW, 8, "F");

    // CES Logo
    if (cesLogoData) {
      doc.addImage(cesLogoData, "PNG", margin, 20, 50, 15);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("CES", margin, 35);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Environmental and Social Advisory Services", margin, 42);
    }

    // Client logo (top right)
    if (clientLogoData) {
      doc.addImage(clientLogoData, "PNG", pageW - margin - 40, 20, 40, 15);
    }

    // Report title block
    doc.setFillColor(...TEAL);
    doc.rect(margin, 70, contentW, 50, "F");
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    const titleLines = doc.splitTextToSize(reportTitle, contentW - 20);
    doc.text(titleLines, margin + 10, 90);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(reportNumber, margin + 10, 112);

    // Project info box
    const projName = projectData?.name || "Project";
    const projClient = projectData?.client || "Client";
    const projLocation = projectData?.location || "Location";

    doc.setFillColor(30, 70, 90);
    doc.rect(margin, 135, contentW, 60, "F");

    doc.setFontSize(10);
    doc.setTextColor(...AQUA);
    doc.text("PROJECT", margin + 10, 148);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(projName, margin + 10, 157);

    doc.setFontSize(9);
    doc.setTextColor(...AQUA);
    doc.text("CLIENT", margin + 10, 170);
    doc.setTextColor(255, 255, 255);
    doc.text(projClient, margin + 10, 178);

    doc.setTextColor(...AQUA);
    doc.text("LOCATION", margin + 10, 188);
    doc.setTextColor(255, 255, 255);
    doc.text(projLocation, margin + 10, 195);

    // Metadata at bottom
    doc.setFontSize(9);
    doc.setTextColor(...AQUA);
    const metaY = pageH - 60;
    doc.text("Audit Period", margin, metaY);
    doc.text("Author", margin + 60, metaY);
    doc.text("Reviewer", margin + 120, metaY);
    doc.text("Issue Date", pageW - margin - 30, metaY);

    doc.setTextColor(255, 255, 255);
    doc.text(period, margin, metaY + 7);
    doc.text(author, margin + 60, metaY + 7);
    doc.text(reviewer, margin + 120, metaY + 7);
    doc.text(new Date().toLocaleDateString("en-ZA"), pageW - margin - 30, metaY + 7);

    // Bottom teal bar
    doc.setFillColor(...TEAL);
    doc.rect(0, pageH - 8, pageW, 8, "F");

    // ==================== TABLE OF CONTENTS ====================
    doc.addPage();
    addFooter();

    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text("Table of Contents", margin, 35);
    drawHR(40);

    const tocItems = [
      { num: "1", title: "Introduction", page: 3 },
      { num: "2", title: "Project Description", page: 3 },
      { num: "3", title: "Audit Methodology", page: 4 },
      { num: "4", title: "Summary of Findings", page: 4 },
      { num: "5", title: "Compliance Summary", page: 5 },
      { num: "6", title: "Conclusions and Recommendations", page: 6 },
      { num: "A", title: "Appendix A - Full Audit Checklist", page: 7 },
      { num: "B", title: "Appendix B - Photo Evidence", page: "-" },
    ];

    let tocY = 52;
    doc.setFontSize(11);
    for (const item of tocItems) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEAL);
      doc.text(item.num, margin, tocY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SLATE);
      doc.text(item.title, margin + 12, tocY);
      doc.setTextColor(...GREY);
      doc.text(String(item.page), pageW - margin, tocY, { align: "right" });

      // Dotted line
      doc.setDrawColor(...GREY);
      doc.setLineDashPattern([1, 1], 0);
      const titleWidth = doc.getTextWidth(item.title);
      doc.line(margin + 12 + titleWidth + 3, tocY, pageW - margin - 10, tocY);
      doc.setLineDashPattern([], 0);
      tocY += 10;
    }

    // ==================== SECTION 1: INTRODUCTION ====================
    doc.addPage();
    addFooter();
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageW, pageH, "F");

    let y = 30;
    const sectionHeader = (num: string, title: string) => {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEAL);
      doc.text(`${num}. ${title}`, margin, y);
      y += 3;
      drawHR(y);
      y += 10;
    };

    sectionHeader("1", "Introduction");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    const introText = `This report presents the findings of the environmental compliance audit conducted for the ${projName} project during the ${period} audit period. The audit was performed in accordance with the conditions of the Environmental Authorisation (EA) and the Environmental Management Programme (EMPr) applicable to the project.\n\nThe purpose of this audit is to assess compliance with the environmental conditions and commitments, identify non-conformances, and recommend corrective actions where necessary.`;
    const introLines = doc.splitTextToSize(introText, contentW);
    doc.text(introLines, margin, y);
    y += introLines.length * 5 + 10;

    // ==================== SECTION 2: PROJECT DESCRIPTION ====================
    sectionHeader("2", "Project Description");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);

    // Project info table
    (doc as any).autoTable({
      startY: y,
      head: [["Field", "Detail"]],
      body: [
        ["Project Name", projName],
        ["Client", projClient],
        ["Location", projLocation],
        ["Audit Period", period],
        ["Audit Type", auditData?.type || "Monthly"],
        ["Auditor", author],
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });

    // ==================== SECTION 3: METHODOLOGY ====================
    doc.addPage();
    addFooter();
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    sectionHeader("3", "Audit Methodology");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    const methodText = `The audit was conducted through a systematic review of the EA conditions and EMPr commitments. Each compliance condition was assessed against site observations, documentation review, and stakeholder engagement.\n\nCompliance was rated using the following scale:\n\n• C (Compliant) - The condition has been met\n• NC (Non-Compliant) - The condition has not been met\n• N/A (Not Applicable) - The condition is not applicable to the current phase\n\nThe compliance percentage is calculated as: Compliant / (Compliant + Non-Compliant) × 100, excluding N/A items from the denominator.`;
    const methodLines = doc.splitTextToSize(methodText, contentW);
    doc.text(methodLines, margin, y);
    y += methodLines.length * 5 + 15;

    // ==================== SECTION 4: SUMMARY OF FINDINGS ====================
    sectionHeader("4", "Summary of Findings");

    // NC items
    const ncResponses = responses.filter((r: any) => r.status === "NC");
    if (ncResponses.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      doc.text(`A total of ${ncResponses.length} non-conformance(s) were identified during this audit period.`, margin, y);
      y += 10;

      const ncTableData = ncResponses.map((r: any) => {
        const item = items.find((i: any) => i.id === r.checklist_item_id);
        const section = item ? sections.find((s: any) => s.id === item.section_id) : null;
        return [
          item?.condition_ref || "-",
          (item?.description || "").substring(0, 80) + ((item?.description || "").length > 80 ? "..." : ""),
          section?.name || "-",
          r.comments || "-",
          r.actions || "-",
        ];
      });

      (doc as any).autoTable({
        startY: y,
        head: [["Ref", "Condition", "Section", "Comments", "Actions"]],
        body: ncTableData,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 35 },
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      doc.text("No non-conformances were identified during this audit period.", margin, y);
    }

    // ==================== SECTION 5: COMPLIANCE SUMMARY ====================
    doc.addPage();
    addFooter();
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    sectionHeader("5", "Compliance Summary");

    // Compliance metrics cards
    const cardW = contentW / 4 - 3;
    const cards = [
      { label: "Compliance", value: `${compliancePercent}%`, color: TEAL },
      { label: "Compliant", value: String(compliantCount), color: GREEN },
      { label: "Non-Compliant", value: String(ncCount), color: RED },
      { label: "N/A / Noted", value: String(naCount), color: GREY },
    ];

    cards.forEach((card, i) => {
      const cx = margin + i * (cardW + 4);
      doc.setFillColor(...(card.color as [number, number, number]));
      doc.roundedRect(cx, y, cardW, 28, 3, 3, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(card.value, cx + cardW / 2, y + 14, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, cx + cardW / 2, y + 22, { align: "center" });
    });
    y += 40;

    // Compliance breakdown table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text("Compliance Breakdown by Section", margin, y);
    y += 8;

    const sectionStats = sections.map((s: any) => {
      const sectionItems = items.filter((i: any) => i.section_id === s.id);
      const sectionResponses = responses.filter((r: any) =>
        sectionItems.some((i: any) => i.id === r.checklist_item_id)
      );
      const sC = sectionResponses.filter((r: any) => r.status === "C").length;
      const sNC = sectionResponses.filter((r: any) => r.status === "NC").length;
      const sNA = sectionResponses.filter((r: any) => r.status === "NA").length;
      const sTotal = sC + sNC;
      const sPct = sTotal > 0 ? Math.round((sC / sTotal) * 100) : 0;
      return [s.name, s.source, String(sC), String(sNC), String(sNA), `${sPct}%`];
    });

    if (sectionStats.length > 0) {
      (doc as any).autoTable({
        startY: y,
        head: [["Section", "Source", "C", "NC", "N/A", "Compliance %"]],
        body: sectionStats,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
        columnStyles: {
          0: { cellWidth: 55 },
          5: { fontStyle: "bold", halign: "center" },
        },
      });
    }

    // Compliance bar chart (manual drawing)
    y = (doc as any).lastAutoTable?.finalY + 15 || y + 15;

    if (y > pageH - 80) {
      doc.addPage();
      addFooter();
      doc.setFillColor(...LIGHT_BG);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 30;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text("Compliance Distribution", margin, y);
    y += 8;

    // Simple bar chart
    const barH = 12;
    const barMaxW = contentW - 30;
    const total = compliantCount + ncCount + naCount || 1;

    const bars = [
      { label: "C", count: compliantCount, color: GREEN },
      { label: "NC", count: ncCount, color: RED },
      { label: "N/A", count: naCount, color: GREY },
    ];

    bars.forEach((bar) => {
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.text(bar.label, margin, y + barH / 2 + 1);

      const w = Math.max((bar.count / total) * barMaxW, 1);
      doc.setFillColor(...(bar.color as [number, number, number]));
      doc.roundedRect(margin + 20, y, w, barH, 2, 2, "F");

      doc.setTextColor(255, 255, 255);
      if (w > 15) {
        doc.text(`${bar.count}`, margin + 20 + w / 2, y + barH / 2 + 1, { align: "center" });
      }
      y += barH + 4;
    });

    // ==================== SECTION 6: CONCLUSIONS ====================
    y += 10;
    if (y > pageH - 60) {
      doc.addPage();
      addFooter();
      doc.setFillColor(...LIGHT_BG);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 30;
    }

    sectionHeader("6", "Conclusions and Recommendations");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);

    const conclusionText = ncCount > 0
      ? `The audit identified ${ncCount} non-conformance(s) during the ${period} audit period, resulting in an overall compliance rate of ${compliancePercent}%. It is recommended that the identified non-conformances be addressed within the stipulated timeframes and that corrective actions be implemented and verified during the next audit cycle.`
      : `The audit found full compliance during the ${period} audit period, with an overall compliance rate of ${compliancePercent}%. It is recommended that the current environmental management practices be maintained and that ongoing monitoring continues as per the EMPr requirements.`;

    const concLines = doc.splitTextToSize(conclusionText, contentW);
    doc.text(concLines, margin, y);

    // ==================== APPENDIX A: FULL CHECKLIST ====================
    doc.addPage();
    addFooter();
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEAL);
    doc.text("Appendix A - Full Audit Checklist", margin, y);
    y += 3;
    drawHR(y);
    y += 10;

    // Build full checklist table
    const checklistRows: any[] = [];
    for (const section of sections) {
      // Add section header row
      checklistRows.push([
        { content: `${section.source} - ${section.name}`, colSpan: 5, styles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 } },
      ]);

      const sectionItems = items.filter((i: any) => i.section_id === section.id);
      for (const item of sectionItems) {
        const response = responses.find((r: any) => r.checklist_item_id === item.id);
        const statusText = response?.status || "-";
        const statusColor = response?.status === "C" ? GREEN : response?.status === "NC" ? RED : GREY;

        checklistRows.push([
          item.condition_ref || "-",
          (item.description || "").substring(0, 100),
          { content: statusText, styles: { textColor: statusColor, fontStyle: "bold", halign: "center" } },
          response?.comments || "-",
          response?.actions || "-",
        ]);
      }
    }

    if (checklistRows.length > 0) {
      (doc as any).autoTable({
        startY: y,
        head: [["Ref", "Condition", "Status", "Comments", "Actions"]],
        body: checklistRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 250, 250] },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 55 },
          2: { cellWidth: 15 },
          3: { cellWidth: 40 },
          4: { cellWidth: 35 },
        },
        didDrawPage: () => {
          addFooter();
          doc.setFillColor(...LIGHT_BG);
          doc.rect(0, 0, pageW, pageH, "F");
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      doc.text("No checklist data available for this audit.", margin, y);
    }

    // ==================== APPENDIX B: PHOTO EVIDENCE ====================
    if (photos.length > 0) {
      doc.addPage();
      addFooter();
      doc.setFillColor(...LIGHT_BG);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 30;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEAL);
      doc.text("Appendix B - Photo Evidence", margin, y);
      y += 3;
      drawHR(y);
      y += 10;

      // Photo table listing
      const photoRows = photos.map((p: any, idx: number) => [
        String(idx + 1),
        p.caption || "No caption",
        p.gps_location || "N/A",
        p.exif_date ? new Date(p.exif_date).toLocaleDateString("en-ZA") : p.upload_date ? new Date(p.upload_date).toLocaleDateString("en-ZA") : "N/A",
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [["#", "Caption", "GPS Location", "Date"]],
        body: photoRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
      });
    }

    // Generate PDF output
    const pdfBytes = doc.output("arraybuffer");

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CES_Audit_Report_${period.replace(/\s/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate report", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
