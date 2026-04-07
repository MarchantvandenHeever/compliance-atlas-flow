import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// CES Brand colors
const TEAL = [0, 150, 166] as const;
const SLATE = [22, 56, 71] as const;
const AQUA = [169, 214, 216] as const;
const LIGHT_BG = [247, 248, 248] as const;
const GREEN = [34, 139, 34] as const;
const RED = [220, 38, 38] as const;
const GREY = [156, 163, 175] as const;
const AMBER = [217, 119, 6] as const;

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

    const cesLogoUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/audit-photos/branding/ces-logo.png`;
    const cesLogoData = await fetchImageBase64(cesLogoUrl);

    let clientLogoData: string | null = null;
    if (clientLogoUrl) {
      clientLogoData = await fetchImageBase64(clientLogoUrl);
    }

    let auditData: any = null;
    let responses: any[] = [];
    let sections: any[] = [];
    let items: any[] = [];
    let photos: any[] = [];
    let projectData: any = null;
    let previousAuditData: any = null;
    let previousResponses: any[] = [];

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

      const { data: sectionOverrides } = await supabase
        .from("audit_section_overrides")
        .select("*")
        .eq("audit_id", auditId);

      if (audit?.template_id) {
        const { data: secs } = await supabase
          .from("checklist_sections")
          .select("*")
          .eq("template_id", audit.template_id)
          .order("sort_order");
        sections = secs || [];

        const inactiveSectionIds = new Set(
          (sectionOverrides || []).filter((o: any) => !o.is_active).map((o: any) => o.section_id)
        );
        sections = sections.map((s: any) => ({ ...s, _inactive: inactiveSectionIds.has(s.id) }));

        const allSectionIds = sections.map((s: any) => s.id);

        if (allSectionIds.length > 0) {
          const { data: objs } = await supabase
            .from("checklist_objectives")
            .select("*")
            .in("section_id", allSectionIds)
            .order("sort_order");

          const objectiveIds = (objs || []).map((o: any) => o.id);
          if (objectiveIds.length > 0) {
            const { data: itms } = await supabase
              .from("checklist_items")
              .select("*")
              .in("objective_id", objectiveIds)
              .order("sort_order");
            items = (itms || []).map((i: any) => {
              const obj = (objs || []).find((o: any) => o.id === i.objective_id);
              return { ...i, section_id: obj?.section_id, _objectiveName: obj?.name };
            });
          }
        }
      }

      // ---- Fetch previous audit for the same project ----
      if (audit?.project_id) {
        const { data: prevAudits } = await supabase
          .from("audit_instances")
          .select("*")
          .eq("project_id", audit.project_id)
          .in("status", ["submitted", "approved"])
          .neq("id", auditId)
          .order("submitted_at", { ascending: false })
          .limit(1);

        if (prevAudits && prevAudits.length > 0) {
          previousAuditData = prevAudits[0];
          const { data: prevResp } = await supabase
            .from("audit_item_responses")
            .select("*")
            .eq("audit_id", previousAuditData.id);
          previousResponses = prevResp || [];
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

    // Determine active vs inactive items
    const activeSections = sections.filter((s: any) => !s._inactive);
    const inactiveSections = sections.filter((s: any) => s._inactive);
    const activeSectionIds = new Set(activeSections.map((s: any) => s.id));
    const activeItems = items.filter((i: any) => activeSectionIds.has(i.section_id));
    const activeItemIds = new Set(activeItems.map((i: any) => i.id));

    // Calculate compliance metrics (only active sections)
    const activeResponses = responses.filter((r: any) => activeItemIds.has(r.checklist_item_id));
    const compliantCount = activeResponses.filter((r: any) => r.status === "C").length;
    const ncCount = activeResponses.filter((r: any) => r.status === "NC").length;
    const naCount = activeResponses.filter((r: any) => r.status === "NA").length;
    const totalAssessed = compliantCount + ncCount;
    const compliancePercent = totalAssessed > 0 ? Math.round((compliantCount / totalAssessed) * 100) : 0;

    // Previous audit metrics
    let prevCompliant = 0, prevNC = 0, prevNA = 0, prevCompliancePercent = 0;
    if (previousResponses.length > 0) {
      // Filter to same active items where possible
      const prevActive = previousResponses.filter((r: any) => activeItemIds.has(r.checklist_item_id));
      prevCompliant = prevActive.filter((r: any) => r.status === "C").length;
      prevNC = prevActive.filter((r: any) => r.status === "NC").length;
      prevNA = prevActive.filter((r: any) => r.status === "NA").length;
      const prevTotal = prevCompliant + prevNC;
      prevCompliancePercent = prevTotal > 0 ? Math.round((prevCompliant / prevTotal) * 100) : 0;
    }

    // Generate PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let pageNum = 0;

    const addFooter = () => {
      pageNum++;
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(`Page ${pageNum}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("CES Environmental and Social Advisory Services", margin, pageH - 10);
      doc.text("CONFIDENTIAL", pageW - margin, pageH - 10, { align: "right" });
    };

    const drawHR = (y: number) => {
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
    };

    const ensureSpace = (needed: number): number => {
      let cy = (doc as any).lastAutoTable?.finalY || 0;
      if (cy < 30) cy = 30;
      if (cy > pageH - needed) {
        doc.addPage();
        addFooter();
        doc.setFillColor(...LIGHT_BG);
        doc.rect(0, 0, pageW, pageH, "F");
        return 30;
      }
      return cy;
    };

    // ==================== COVER PAGE ====================
    doc.setFillColor(...SLATE);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, pageW, 8, "F");

    if (cesLogoData) {
      doc.addImage(cesLogoData, "PNG", margin, 20, 50, 15);
    } else {
      doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
      doc.text("CES", margin, 35);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text("Environmental and Social Advisory Services", margin, 42);
    }

    if (clientLogoData) {
      doc.addImage(clientLogoData, "PNG", pageW - margin - 40, 20, 40, 15);
    }

    doc.setFillColor(...TEAL);
    doc.rect(margin, 70, contentW, 50, "F");
    doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    const titleLines = doc.splitTextToSize(reportTitle, contentW - 20);
    doc.text(titleLines, margin + 10, 90);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text(reportNumber, margin + 10, 112);

    // Review status badge
    const reviewStatus = auditData?.status === "approved" ? "REVIEWED AND APPROVED" : "PENDING REVIEW";
    const reviewColor = auditData?.status === "approved" ? GREEN : AMBER;
    doc.setFillColor(...(reviewColor as [number, number, number]));
    doc.roundedRect(margin, 125, contentW, 8, 2, 2, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(reviewStatus, pageW / 2, 130.5, { align: "center" });

    const projName = projectData?.name || "Project";
    const projClient = projectData?.client || "Client";
    const projLocation = projectData?.location || "Location";

    doc.setFillColor(30, 70, 90);
    doc.rect(margin, 138, contentW, 60, "F");
    doc.setFontSize(10); doc.setTextColor(...AQUA); doc.text("PROJECT", margin + 10, 151);
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text(projName, margin + 10, 160);
    doc.setFontSize(9); doc.setTextColor(...AQUA); doc.text("CLIENT", margin + 10, 173);
    doc.setTextColor(255, 255, 255); doc.text(projClient, margin + 10, 181);
    doc.setTextColor(...AQUA); doc.text("LOCATION", margin + 10, 191);
    doc.setTextColor(255, 255, 255); doc.text(projLocation, margin + 10, 198);

    doc.setFontSize(9); doc.setTextColor(...AQUA);
    const metaY = pageH - 60;
    doc.text("Audit Period", margin, metaY);
    doc.text("Author", margin + 45, metaY);
    doc.text("Reviewer", margin + 90, metaY);
    doc.text("Review Status", margin + 135, metaY);
    doc.setTextColor(255, 255, 255);
    doc.text(period, margin, metaY + 7);
    doc.text(author, margin + 45, metaY + 7);
    doc.text(reviewer, margin + 90, metaY + 7);
    doc.text(reviewStatus, margin + 135, metaY + 7);
    doc.setFillColor(...TEAL);
    doc.rect(0, pageH - 8, pageW, 8, "F");

    // ==================== TABLE OF CONTENTS ====================
    doc.addPage(); addFooter();
    doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("Table of Contents", margin, 35); drawHR(40);

    const hasPrevious = !!previousAuditData;
    const tocItems = [
      { num: "1", title: "Introduction" },
      { num: "2", title: "Project Description" },
      { num: "3", title: "Audit Methodology" },
      { num: "4", title: "Summary of Findings" },
      { num: "5", title: "Compliance Summary" },
      ...(hasPrevious ? [{ num: "6", title: "Audit Comparison — Changes from Previous Audit" }] : []),
      { num: hasPrevious ? "7" : "6", title: "Conclusions and Recommendations" },
      { num: "A", title: "Appendix A - Full Audit Checklist" },
      { num: "B", title: "Appendix B - Photo Evidence" },
    ];

    let tocY = 52;
    doc.setFontSize(11);
    for (const item of tocItems) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL); doc.text(item.num, margin, tocY);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE); doc.text(item.title, margin + 12, tocY);
      doc.setDrawColor(...GREY); doc.setLineDashPattern([1, 1], 0);
      const tw = doc.getTextWidth(item.title);
      doc.line(margin + 12 + tw + 3, tocY, pageW - margin - 5, tocY);
      doc.setLineDashPattern([], 0);
      tocY += 10;
    }

    // ==================== SECTION 1: INTRODUCTION ====================
    doc.addPage(); addFooter();
    doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
    let y = 30;

    const sectionHeader = (num: string, title: string) => {
      if (y > pageH - 40) {
        doc.addPage(); addFooter();
        doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
        y = 30;
      }
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
      doc.text(`${num}. ${title}`, margin, y); y += 3; drawHR(y); y += 10;
    };

    sectionHeader("1", "Introduction");
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
    const introText = `This report presents the findings of the environmental compliance audit conducted for the ${projName} project during the ${period} audit period. The audit was performed in accordance with the conditions of the Environmental Authorisation (EA) and the Environmental Management Programme (EMPr) applicable to the project.\n\nThe purpose of this audit is to assess compliance with the environmental conditions and commitments, identify non-conformances, and recommend corrective actions where necessary.`;
    const introLines = doc.splitTextToSize(introText, contentW);
    doc.text(introLines, margin, y); y += introLines.length * 5 + 10;

    // ==================== SECTION 2: PROJECT DESCRIPTION ====================
    sectionHeader("2", "Project Description");
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);

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
        ...(auditData?.revision_count > 0 ? [["Revision", `Rev ${auditData.revision_count}`]] : []),
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });

    // ==================== SECTION 3: METHODOLOGY ====================
    doc.addPage(); addFooter();
    doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    sectionHeader("3", "Audit Methodology");
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
    let methodText = `The audit was conducted through a systematic review of the EA conditions and EMPr commitments. Each compliance condition was assessed against site observations, documentation review, and stakeholder engagement.\n\nCompliance was rated using the following scale:\n\n• C (Compliant) - The condition has been met\n• NC (Non-Compliant) - The condition has not been met\n• N/A (Not Applicable) - The condition is not applicable to the current phase\n\nThe compliance percentage is calculated as: Compliant / (Compliant + Non-Compliant) × 100, excluding N/A items from the denominator.`;

    if (inactiveSections.length > 0) {
      const inactiveNames = inactiveSections.map((s: any) => s.name).join(", ");
      methodText += `\n\nThe following phase(s) were marked as inactive and were therefore not considered as part of this audit: ${inactiveNames}. Items within inactive phases are excluded from the compliance calculations.`;
    }

    const methodLines = doc.splitTextToSize(methodText, contentW);
    doc.text(methodLines, margin, y); y += methodLines.length * 5 + 15;

    // ==================== SECTION 4: SUMMARY OF FINDINGS ====================
    sectionHeader("4", "Summary of Findings");

    // Helper to build item table rows
    const buildItemTable = (filteredResponses: any[]) => {
      return filteredResponses.map((r: any) => {
        const item = items.find((i: any) => i.id === r.checklist_item_id);
        const section = item ? sections.find((s: any) => s.id === item.section_id) : null;
        return [
          item?.condition_ref || "-",
          item?.description || "-",
          section?.name || "-",
          r.comments || "-",
          r.actions || "-",
        ];
      });
    };

    // 4.1 Non-Compliant Items
    const ncResponses = activeResponses.filter((r: any) => r.status === "NC");
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("4.1 Non-Compliant Items", margin, y); y += 8;

    if (ncResponses.length > 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text(`A total of ${ncResponses.length} non-conformance(s) were identified during this audit period.`, margin, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Ref", "Condition", "Section", "Comments", "Actions"]],
        body: buildItemTable(ncResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
    } else {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text("No non-conformances were identified during this audit period.", margin, y);
    }

    // 4.2 Compliant Items
    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : y + 15;
    if (y > pageH - 50) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

    const cResponses = activeResponses.filter((r: any) => r.status === "C");
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("4.2 Compliant Items", margin, y); y += 8;

    if (cResponses.length > 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text(`A total of ${cResponses.length} item(s) were found to be compliant.`, margin, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Ref", "Condition", "Section", "Comments", "Actions"]],
        body: buildItemTable(cResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
    } else {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text("No compliant items recorded.", margin, y);
    }

    // 4.3 Not Applicable Items
    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : y + 15;
    if (y > pageH - 50) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

    const naResponses = activeResponses.filter((r: any) => r.status === "NA");
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("4.3 Not Applicable Items", margin, y); y += 8;

    if (naResponses.length > 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text(`A total of ${naResponses.length} item(s) were marked as not applicable.`, margin, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Ref", "Condition", "Section", "Comments", "Actions"]],
        body: buildItemTable(naResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
    } else {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      doc.text("No items marked as not applicable.", margin, y);
    }

    // ==================== SECTION 5: COMPLIANCE SUMMARY ====================
    doc.addPage(); addFooter();
    doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    sectionHeader("5", "Compliance Summary");

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
      doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(card.value, cx + cardW / 2, y + 14, { align: "center" });
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(card.label, cx + cardW / 2, y + 22, { align: "center" });
    });
    y += 40;

    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("Compliance Breakdown by Section", margin, y); y += 8;

    const sectionStats = sections.map((s: any) => {
      const sectionItems = items.filter((i: any) => i.section_id === s.id);
      const sectionResponses = responses.filter((r: any) => sectionItems.some((i: any) => i.id === r.checklist_item_id));
      const sC = sectionResponses.filter((r: any) => r.status === "C").length;
      const sNC = sectionResponses.filter((r: any) => r.status === "NC").length;
      const sNA = sectionResponses.filter((r: any) => r.status === "NA").length;
      const sTotal = sC + sNC;
      const sPct = sTotal > 0 ? Math.round((sC / sTotal) * 100) : 0;
      return [s._inactive ? `${s.name} (INACTIVE)` : s.name, s.source, s._inactive ? "-" : String(sC), s._inactive ? "-" : String(sNC), s._inactive ? "-" : String(sNA), s._inactive ? "N/A" : `${sPct}%`];
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
        columnStyles: { 0: { cellWidth: 55 }, 5: { fontStyle: "bold", halign: "center" } },
      });
    }

    y = (doc as any).lastAutoTable?.finalY + 15 || y + 15;
    if (y > pageH - 80) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("Compliance Distribution", margin, y); y += 8;

    const barH = 12;
    const barMaxW = contentW - 30;
    const total = compliantCount + ncCount + naCount || 1;
    const bars = [
      { label: "C", count: compliantCount, color: GREEN },
      { label: "NC", count: ncCount, color: RED },
      { label: "N/A", count: naCount, color: GREY },
    ];

    bars.forEach((bar) => {
      doc.setFontSize(9); doc.setTextColor(...SLATE); doc.text(bar.label, margin, y + barH / 2 + 1);
      const w = Math.max((bar.count / total) * barMaxW, 1);
      doc.setFillColor(...(bar.color as [number, number, number]));
      doc.roundedRect(margin + 20, y, w, barH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      if (w > 15) { doc.text(`${bar.count}`, margin + 20 + w / 2, y + barH / 2 + 1, { align: "center" }); }
      y += barH + 4;
    });

    // ==================== SECTION 6 (or 6/7): AUDIT COMPARISON ====================
    const compSectionNum = hasPrevious ? "6" : null;
    const conclusionSectionNum = hasPrevious ? "7" : "6";

    if (hasPrevious && previousResponses.length > 0) {
      doc.addPage(); addFooter();
      doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
      y = 30;

      sectionHeader(compSectionNum!, "Audit Comparison — Changes from Previous Audit");

      // Comparison summary
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      const prevPeriod = previousAuditData.period || "Previous";
      const prevDate = previousAuditData.submitted_at ? new Date(previousAuditData.submitted_at).toLocaleDateString("en-ZA") : "N/A";
      const compText = `This section compares the current audit (${period}) with the previous audit (${prevPeriod}, submitted ${prevDate}) conducted on the same project.`;
      const compLines = doc.splitTextToSize(compText, contentW);
      doc.text(compLines, margin, y); y += compLines.length * 5 + 10;

      // Overview comparison table
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text("Overall Metrics Comparison", margin, y); y += 8;

      const delta = (curr: number, prev: number) => {
        const d = curr - prev;
        return d > 0 ? `+${d}` : String(d);
      };

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", `Previous (${prevPeriod})`, `Current (${period})`, "Change"]],
        body: [
          ["Compliance %", `${prevCompliancePercent}%`, `${compliancePercent}%`, `${delta(compliancePercent, prevCompliancePercent)}%`],
          ["Compliant (C)", String(prevCompliant), String(compliantCount), delta(compliantCount, prevCompliant)],
          ["Non-Compliant (NC)", String(prevNC), String(ncCount), delta(ncCount, prevNC)],
          ["Not Applicable (N/A)", String(prevNA), String(naCount), delta(naCount, prevNA)],
        ],
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 3: { fontStyle: "bold", halign: "center" } },
      });

      y = (doc as any).lastAutoTable?.finalY + 15;

      // Detailed item-level changes
      // Build a map: checklist_item_id -> { prev status, curr status }
      const prevMap = new Map<string, string>();
      previousResponses.forEach((r: any) => { prevMap.set(r.checklist_item_id, r.status); });
      const currMap = new Map<string, string>();
      activeResponses.forEach((r: any) => { currMap.set(r.checklist_item_id, r.status); });

      const changedItems: any[] = [];
      const allItemIds = new Set([...prevMap.keys(), ...currMap.keys()]);
      allItemIds.forEach(itemId => {
        if (!activeItemIds.has(itemId)) return; // only compare active items
        const prev = prevMap.get(itemId) || "-";
        const curr = currMap.get(itemId) || "-";
        if (prev !== curr) {
          const item = items.find((i: any) => i.id === itemId);
          const section = item ? sections.find((s: any) => s.id === item.section_id) : null;
          const currResp = responses.find((r: any) => r.checklist_item_id === itemId);
          changedItems.push([
            item?.condition_ref || "-",
            item?.description || "-",
            section?.name || "-",
            prev,
            curr,
            currResp?.comments || "-",
          ]);
        }
      });

      if (y > pageH - 50) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text("Item-Level Status Changes", margin, y); y += 8;

      if (changedItems.length > 0) {
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
        doc.text(`${changedItems.length} item(s) changed status between audits.`, margin, y); y += 8;

        (doc as any).autoTable({
          startY: y,
          head: [["Ref", "Condition", "Section", "Previous", "Current", "Comments"]],
          body: changedItems,
          theme: "grid",
          margin: { left: margin, right: margin },
          headStyles: { fillColor: AMBER, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
          bodyStyles: { fontSize: 7, textColor: SLATE },
          columnStyles: { 0: { cellWidth: 13 }, 3: { cellWidth: 15, halign: "center" }, 4: { cellWidth: 15, halign: "center" } },
          didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
        });

        // Highlight newly resolved NCs
        const resolvedNCs = changedItems.filter(r => r[3] === "NC" && r[4] === "C");
        const newNCs = changedItems.filter(r => r[3] !== "NC" && r[4] === "NC");

        y = (doc as any).lastAutoTable?.finalY + 10;
        if (y > pageH - 40) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
        if (resolvedNCs.length > 0) {
          doc.text(`• ${resolvedNCs.length} previously non-compliant item(s) are now compliant.`, margin, y); y += 6;
        }
        if (newNCs.length > 0) {
          doc.text(`• ${newNCs.length} new non-conformance(s) identified since the previous audit.`, margin, y); y += 6;
        }
        if (resolvedNCs.length === 0 && newNCs.length === 0) {
          doc.text("Status changes did not involve NC transitions.", margin, y); y += 6;
        }
      } else {
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
        doc.text("No item-level status changes were detected between the current and previous audit.", margin, y);
      }
    }

    // ==================== CONCLUSIONS ====================
    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : y + 15;
    if (y > pageH - 60) { doc.addPage(); addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); y = 30; }

    sectionHeader(conclusionSectionNum, "Conclusions and Recommendations");
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);

    let conclusionText = ncCount > 0
      ? `The audit identified ${ncCount} non-conformance(s) during the ${period} audit period, resulting in an overall compliance rate of ${compliancePercent}%. It is recommended that the identified non-conformances be addressed within the stipulated timeframes and that corrective actions be implemented and verified during the next audit cycle.`
      : `The audit found full compliance during the ${period} audit period, with an overall compliance rate of ${compliancePercent}%. It is recommended that the current environmental management practices be maintained and that ongoing monitoring continues as per the EMPr requirements.`;

    if (hasPrevious) {
      const trend = compliancePercent > prevCompliancePercent ? "improved" : compliancePercent < prevCompliancePercent ? "declined" : "remained unchanged";
      conclusionText += `\n\nCompared to the previous audit (${previousAuditData.period}), overall compliance has ${trend} (${prevCompliancePercent}% → ${compliancePercent}%).`;
    }

    const concLines = doc.splitTextToSize(conclusionText, contentW);
    doc.text(concLines, margin, y);

    // ==================== APPENDIX A: FULL CHECKLIST ====================
    doc.addPage(); addFooter();
    doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
    y = 30;

    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("Appendix A - Full Audit Checklist", margin, y); y += 3; drawHR(y); y += 10;

    const checklistRows: any[] = [];
    for (const section of sections) {
      const sectionLabel = section._inactive
        ? `${section.source} - ${section.name} [INACTIVE - Not assessed in this audit]`
        : `${section.source} - ${section.name}`;
      const headerColor = section._inactive ? [120, 120, 120] : SLATE;
      checklistRows.push([
        { content: sectionLabel, colSpan: 5, styles: { fillColor: headerColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 } },
      ]);

      const sectionItems = items.filter((i: any) => i.section_id === section.id);
      for (const item of sectionItems) {
        const response = responses.find((r: any) => r.checklist_item_id === item.id);
        const statusText = response?.status || "-";
        const statusColor = response?.status === "C" ? GREEN : response?.status === "NC" ? RED : GREY;
        checklistRows.push([
          item.condition_ref || "-",
          item.description || "-",
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
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 15 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
    } else {
      doc.setFontSize(10); doc.setTextColor(...SLATE);
      doc.text("No checklist data available for this audit.", margin, y);
    }

    // ==================== APPENDIX B: PHOTO EVIDENCE ====================
    if (photos.length > 0) {
      doc.addPage(); addFooter();
      doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F");
      y = 30;

      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
      doc.text("Appendix B - Photo Evidence", margin, y); y += 3; drawHR(y); y += 10;

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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
