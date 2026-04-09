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
    let revisionLog: any[] = [];
    let reportReview: any = null;
    let reviewerName = reviewer;

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

      // Fetch revision log
      const { data: revLog } = await supabase
        .from("audit_revision_log")
        .select("*")
        .eq("audit_id", auditId)
        .order("revision_number", { ascending: true });
      revisionLog = revLog || [];

      // Fetch report review status and reviewer profile
      const { data: rr } = await supabase
        .from("report_reviews")
        .select("*")
        .eq("audit_id", auditId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rr && rr.length > 0) {
        reportReview = rr[0];
        if (reportReview.reviewer_id) {
          const { data: revProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", reportReview.reviewer_id)
            .single();
          if (revProfile?.display_name) reviewerName = revProfile.display_name;
        }
      }

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

      // Fetch previous audit for the same project
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

    const projName = projectData?.name || "Project";
    const projClient = projectData?.client || "Client";
    const projLocation = projectData?.location || "Location";
    const hasPrevious = !!previousAuditData;

    // Derive review status from report_reviews table
    const reportStatus = reportReview?.status || "pending_review";
    const reviewStatusMap: Record<string, string> = {
      approved: "REVIEWED AND APPROVED",
      disapproved: "DISAPPROVED",
      amendments_requested: "AMENDMENTS REQUESTED",
      under_review: "UNDER REVIEW",
      pending_review: "PENDING REVIEW",
    };
    const reviewStatus = reviewStatusMap[reportStatus] || "PENDING REVIEW";
    const reviewColorMap: Record<string, readonly [number, number, number]> = {
      approved: GREEN,
      disapproved: RED,
      amendments_requested: AMBER,
      under_review: [59, 130, 246],
      pending_review: AMBER,
    };
    const reviewColor = reviewColorMap[reportStatus] || AMBER;
    const reviewedAtStr = reportReview?.reviewed_at
      ? new Date(reportReview.reviewed_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })
      : "—";

    const addFooter = () => {
      pageNum++;
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(`Page ${pageNum}`, pageW / 2, pageH - 10, { align: "center" });
      doc.text("CES Environmental and Social Advisory Services", margin, pageH - 10);
      doc.text("CONFIDENTIAL", pageW - margin, pageH - 10, { align: "right" });
    };

    const drawHR = (yPos: number) => {
      doc.setDrawColor(...TEAL);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageW - margin, yPos);
    };

    const newPage = () => {
      doc.addPage();
      addFooter();
      doc.setFillColor(...LIGHT_BG);
      doc.rect(0, 0, pageW, pageH, "F");
    };

    const ensureSpace = (needed: number, currentY: number): number => {
      if (currentY > pageH - needed) {
        newPage();
        return 30;
      }
      return currentY;
    };

    const sectionHeader = (num: string, title: string, yRef: { y: number }) => {
      yRef.y = ensureSpace(40, yRef.y);
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
      doc.text(`${num}. ${title}`, margin, yRef.y); yRef.y += 3; drawHR(yRef.y); yRef.y += 10;
    };

    const subSectionHeader = (num: string, title: string, yRef: { y: number }) => {
      yRef.y = ensureSpace(30, yRef.y);
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text(`${num} ${title}`, margin, yRef.y); yRef.y += 8;
    };

    const subSubHeader = (num: string, title: string, yRef: { y: number }) => {
      yRef.y = ensureSpace(25, yRef.y);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text(`${num} ${title}`, margin + 5, yRef.y); yRef.y += 7;
    };

    const bodyText = (text: string, yRef: { y: number }) => {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
      const lines = doc.splitTextToSize(text, contentW);
      // Check if we need a page break
      const lineHeight = 5;
      const totalH = lines.length * lineHeight;
      if (yRef.y + totalH > pageH - 20) {
        // Print what fits on current page, then continue
        for (const line of lines) {
          if (yRef.y > pageH - 20) {
            newPage();
            yRef.y = 30;
            doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
          }
          doc.text(line, margin, yRef.y);
          yRef.y += lineHeight;
        }
      } else {
        doc.text(lines, margin, yRef.y);
        yRef.y += totalH;
      }
      yRef.y += 5;
    };

    const nothingToReport = (yRef: { y: number }) => {
      bodyText("Nothing to report.", yRef);
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
    doc.setFillColor(...(reviewColor as [number, number, number]));
    doc.roundedRect(margin, 125, contentW, 8, 2, 2, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(reviewStatus, pageW / 2, 130.5, { align: "center" });

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
    doc.text(reviewerName, margin + 90, metaY + 7);
    doc.text(reviewStatus, margin + 135, metaY + 7);
    doc.setFillColor(...TEAL);
    doc.rect(0, pageH - 8, pageW, 8, "F");

    // ==================== REVISIONS TRACKING TABLE ====================
    newPage();
    let y = 30;
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("Revisions Tracking Table", margin, y); y += 3; drawHR(y); y += 10;

    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("CES Report Revision and Tracking Schedule", margin, y); y += 10;

    const revTrackingBody: any[] = [
      ["Document Title:", reportTitle],
      ["Client Name:", projClient],
      ["Report Review Status:", reviewStatus],
      ["Reviewed By:", reviewerName],
      ["Reviewed Date:", reviewedAtStr],
      ["Issue Date:", new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })],
      ["Environmental Control Officer:", author],
      ["Senior Environmental Control Officer / Reviewer:", reviewerName],
    ];

    (doc as any).autoTable({
      startY: y,
      body: revTrackingBody,
      theme: "grid",
      margin: { left: margin, right: margin },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 65 } },
      alternateRowStyles: { fillColor: [240, 248, 248] },
    });

    y = (doc as any).lastAutoTable?.finalY + 15 || y + 15;

    // Revision history
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("Revision History", margin, y); y += 8;

    if (revisionLog.length > 0) {
      const revRows = revisionLog.map((r: any) => [
        `Rev ${r.revision_number}`,
        new Date(r.revised_at).toLocaleDateString("en-ZA"),
        r.previous_status,
        r.reason || "-",
      ]);

      (doc as any).autoTable({
        startY: y,
        head: [["Revision", "Date", "Previous Status", "Reason"]],
        body: revRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
      });
    } else if (auditData?.revision_count > 0) {
      (doc as any).autoTable({
        startY: y,
        head: [["Version", "Date", "Notes"]],
        body: [["Version 1", period, "Initial report"]],
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
      });
    } else {
      (doc as any).autoTable({
        startY: y,
        head: [["Version", "Date", "Notes"]],
        body: [["Version 1", period, "Initial report"]],
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
      });
    }

    // ==================== THE PROJECT TEAM ====================
    newPage();
    y = 30;
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("The Project Team", margin, y); y += 3; drawHR(y); y += 10;

    const teamBody: any[] = [
      ["Environmental Control Officer (ECO):", author, "Report Writer"],
      ["Senior ECO / Reviewer:", reviewerName, "Reviewer"],
    ];

    (doc as any).autoTable({
      startY: y,
      head: [["Role", "Name", "Responsibility"]],
      body: teamBody,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
    });

    // ==================== TABLE OF CONTENTS ====================
    newPage();
    y = 30;
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("Table of Contents", margin, y); drawHR(y + 5); y += 15;

    const tocItems = [
      { num: "1", title: "Introduction", indent: 0 },
      { num: "1.1", title: "Project Description", indent: 1 },
      { num: "1.2", title: "Authorisation Monitoring and Reporting Requirements", indent: 1 },
      { num: "1.2.1", title: "Monitoring, Recording and Reporting Requirements", indent: 2 },
      { num: "1.2.2", title: "Relevant Contact Persons", indent: 2 },
      { num: "1.2.3", title: "Report Outcome", indent: 2 },
      { num: "1.2.4", title: "Site Compliance Monitoring", indent: 2 },
      { num: "1.2.5", title: "Audit Programme", indent: 2 },
      { num: "2", title: "Environmental Compliance Audit", indent: 0 },
      { num: "2.1", title: "Audit Methodology", indent: 1 },
      { num: "2.2", title: "Summary of Audit Findings", indent: 1 },
      { num: "2.3", title: "Summary of Compliance", indent: 1 },
      ...(hasPrevious ? [{ num: "2.4", title: "Audit Comparison — Changes from Previous Audit", indent: 1 }] : []),
      { num: "3", title: "Conclusions and Recommendations", indent: 0 },
      { num: "3.1", title: "Objectives", indent: 1 },
      { num: "3.2", title: "General Comments and Observations", indent: 1 },
      { num: "A", title: "Appendix A — Audit Checklist", indent: 0 },
      { num: "B", title: "Appendix B — Photo Evidence", indent: 0 },
    ];

    doc.setFontSize(11);
    for (const item of tocItems) {
      const xOff = margin + item.indent * 8;
      const fontSize = item.indent === 0 ? 11 : item.indent === 1 ? 10 : 9;
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", item.indent === 0 ? "bold" : "normal");
      doc.setTextColor(...TEAL); doc.text(item.num, xOff, y);
      doc.setTextColor(...SLATE); doc.text(item.title, xOff + (item.indent === 2 ? 12 : 10), y);
      const tw = doc.getTextWidth(item.title);
      doc.setDrawColor(...GREY); doc.setLineDashPattern([1, 1], 0);
      const lineStart = xOff + (item.indent === 2 ? 12 : 10) + tw + 3;
      if (lineStart < pageW - margin - 5) {
        doc.line(lineStart, y, pageW - margin - 5, y);
      }
      doc.setLineDashPattern([], 0);
      y += item.indent === 0 ? 9 : 7;
    }

    // ==================== LIST OF TABLES / FIGURES ====================
    y += 5;
    y = ensureSpace(30, y);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("List of Tables", margin, y); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
    doc.text("Table 2.1: Qualitative indicator of compliance.", margin, y); y += 7;
    doc.text("Table 2.2: Summary of construction audit findings.", margin, y); y += 7;
    doc.text("Table 2.3: Compliance breakdown by section.", margin, y); y += 12;

    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
    doc.text("List of Figures", margin, y); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
    doc.text("Figure 2.1: Compliance distribution chart.", margin, y);

    // ==================== SECTION 1: INTRODUCTION ====================
    newPage();
    const yRef = { y: 30 };

    sectionHeader("1", "Introduction", yRef);
    bodyText(
      `CES Environmental and Social Advisory Services has been appointed as the Environmental Control Officer (ECO) for the ${projName} project. This report presents the findings of the environmental compliance audit conducted during the ${period} audit period.\n\nThe purpose of this audit is to assess compliance with the conditions of the Environmental Authorisation (EA) and the Environmental Management Programme (EMPr) applicable to the project, identify non-conformances, and recommend corrective actions where necessary.`,
      yRef
    );

    // 1.1 Project Description
    subSectionHeader("1.1", "Project Description", yRef);

    if (projectData?.description) {
      bodyText(projectData.description, yRef);
    }

    yRef.y = ensureSpace(60, yRef.y);
    (doc as any).autoTable({
      startY: yRef.y,
      head: [["Field", "Detail"]],
      body: [
        ["Project Name", projName],
        ["Client", projClient],
        ["Location", projLocation],
        ["Audit Period", period],
        ["Audit Type", auditData?.type || "Monthly"],
        ["Auditor (ECO)", author],
        ["Reviewer", reviewerName],
        ["Review Status", reviewStatus],
        ["Reviewed Date", reviewedAtStr],
        ...(auditData?.revision_count > 0 ? [["Revision", `Rev ${auditData.revision_count}`]] : []),
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });
    yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;

    // 1.2 Authorisation Monitoring and Reporting Requirements
    subSectionHeader("1.2", "Authorisation Monitoring and Reporting Requirements", yRef);
    bodyText(
      `The Environmental Control Officer (ECO) is required to report on the compliance of the proponent and/or contractor in terms of the Environmental Authorisation (EA), Environmental Management Programme (EMPr), General Authorisation (GA), or any relevant environmental permits and licences.`,
      yRef
    );

    // 1.2.1 Monitoring, Recording and Reporting Requirements
    subSubHeader("1.2.1", "Monitoring, Recording and Reporting Requirements", yRef);
    bodyText(
      `The audit was conducted in terms of the monitoring requirements stipulated in the EA and EMPr. The ECO is required to conduct regular site inspections and compliance audits to verify adherence to the authorisation conditions, and to report on any deviations or non-conformances observed during the audit period.`,
      yRef
    );

    // 1.2.2 Relevant Contact Persons
    subSubHeader("1.2.2", "Relevant Contact Persons", yRef);
    yRef.y = ensureSpace(40, yRef.y);
    (doc as any).autoTable({
      startY: yRef.y,
      head: [["Role", "Name"]],
      body: [
        ["ECO (Report Writer)", author],
        ["Senior ECO (Reviewer)", reviewer],
        ["Client", projClient],
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    });
    yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;

    // 1.2.3 Report Outcome
    subSubHeader("1.2.3", "Report Outcome", yRef);
    const outcomeText = ncCount > 0
      ? `This audit identified ${ncCount} non-conformance(s) out of ${totalAssessed} assessed conditions, resulting in an overall compliance rate of ${compliancePercent}%.`
      : totalAssessed > 0
        ? `This audit found full compliance across all ${totalAssessed} assessed conditions, with an overall compliance rate of ${compliancePercent}%.`
        : "Nothing to report.";
    bodyText(outcomeText, yRef);

    // 1.2.4 Site Compliance Monitoring
    subSubHeader("1.2.4", "Site Compliance Monitoring", yRef);
    bodyText(
      `Site compliance monitoring was carried out through visual inspection, documentation review, and engagement with on-site personnel. Compliance was assessed against the conditions of the EA, EMPr, and any other relevant authorisations and permits.`,
      yRef
    );

    // 1.2.5 Audit Programme
    subSubHeader("1.2.5", "Audit Programme", yRef);
    const auditFreq = projectData?.audit_frequency || auditData?.type || "monthly";
    bodyText(
      `The audit programme for this project comprises ${auditFreq} environmental compliance audits. This report constitutes audit ${reportNumber} for the ${period} period.`,
      yRef
    );

    if (inactiveSections.length > 0) {
      const inactiveNames = inactiveSections.map((s: any) => s.name).join(", ");
      bodyText(
        `Note: The following phase(s) were marked as inactive and were therefore not considered as part of this audit: ${inactiveNames}. Items within inactive phases are excluded from the compliance calculations.`,
        yRef
      );
    }

    // ==================== SECTION 2: ENVIRONMENTAL COMPLIANCE AUDIT ====================
    newPage();
    yRef.y = 30;

    sectionHeader("2", "Environmental Compliance Audit", yRef);

    // 2.1 Audit Methodology
    subSectionHeader("2.1", "Audit Methodology", yRef);

    bodyText(
      `The audit was conducted through a systematic review of the EA conditions and EMPr commitments. Each compliance condition was assessed against site observations, documentation review, and stakeholder engagement.`,
      yRef
    );

    bodyText("Table 2.1: Qualitative indicator of compliance.", yRef);

    yRef.y = ensureSpace(40, yRef.y);
    (doc as any).autoTable({
      startY: yRef.y,
      head: [["Rating", "Description"]],
      body: [
        ["C (Compliant)", "The condition has been met."],
        ["NC (Non-Compliant)", "The condition has not been met and requires corrective action."],
        ["N/A (Not Applicable)", "The condition is not applicable to the current audit period or phase of the project."],
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    });
    yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;

    bodyText(
      `The compliance percentage is calculated as: Compliant / (Compliant + Non-Compliant) × 100, excluding N/A items from the denominator.`,
      yRef
    );

    // 2.2 Summary of Audit Findings
    subSectionHeader("2.2", "Summary of Audit Findings", yRef);

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

    // 2.2.1 Non-Compliant Items
    subSubHeader("2.2.1", "Non-Compliant Items", yRef);

    const ncResponses = activeResponses.filter((r: any) => r.status === "NC");
    if (ncResponses.length > 0) {
      bodyText(`A total of ${ncResponses.length} non-conformance(s) were identified during this audit period.`, yRef);

      yRef.y = ensureSpace(30, yRef.y);
      (doc as any).autoTable({
        startY: yRef.y,
        head: [["Ref", "Condition", "Phase", "Comments", "Corrective Actions"]],
        body: buildItemTable(ncResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
      yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;
    } else {
      nothingToReport(yRef);
    }

    // 2.2.2 Compliant Items
    subSubHeader("2.2.2", "Compliant Items", yRef);

    const cResponses = activeResponses.filter((r: any) => r.status === "C");
    if (cResponses.length > 0) {
      bodyText(`A total of ${cResponses.length} item(s) were found to be compliant.`, yRef);

      yRef.y = ensureSpace(30, yRef.y);
      (doc as any).autoTable({
        startY: yRef.y,
        head: [["Ref", "Condition", "Phase", "Comments", "Actions"]],
        body: buildItemTable(cResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
      yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;
    } else {
      nothingToReport(yRef);
    }

    // 2.2.3 Not Applicable Items
    subSubHeader("2.2.3", "Not Applicable Items", yRef);

    const naResponses = activeResponses.filter((r: any) => r.status === "NA");
    if (naResponses.length > 0) {
      bodyText(`A total of ${naResponses.length} item(s) were marked as not applicable to the current audit period.`, yRef);

      yRef.y = ensureSpace(30, yRef.y);
      (doc as any).autoTable({
        startY: yRef.y,
        head: [["Ref", "Condition", "Phase", "Comments", "Actions"]],
        body: buildItemTable(naResponses),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: GREY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 28 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
      yRef.y = (doc as any).lastAutoTable?.finalY + 10 || yRef.y + 10;
    } else {
      nothingToReport(yRef);
    }

    // 2.3 Summary of Compliance
    newPage();
    yRef.y = 30;
    subSectionHeader("2.3", "Summary of Compliance", yRef);

    // Compliance metric cards
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
      doc.roundedRect(cx, yRef.y, cardW, 28, 3, 3, "F");
      doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(card.value, cx + cardW / 2, yRef.y + 14, { align: "center" });
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(card.label, cx + cardW / 2, yRef.y + 22, { align: "center" });
    });
    yRef.y += 40;

    // Compliance Breakdown by Section (Table 2.3)
    doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(...SLATE);
    doc.text("Table 2.3: Compliance breakdown by section.", margin, yRef.y); yRef.y += 8;

    const sectionStats = activeSections.map((s: any) => {
      const sectionItems = items.filter((i: any) => i.section_id === s.id);
      const sectionResponses = responses.filter((r: any) => sectionItems.some((i: any) => i.id === r.checklist_item_id));
      const sC = sectionResponses.filter((r: any) => r.status === "C").length;
      const sNC = sectionResponses.filter((r: any) => r.status === "NC").length;
      const sNA = sectionResponses.filter((r: any) => r.status === "NA").length;
      const sTotal = sC + sNC;
      const sPct = sTotal > 0 ? Math.round((sC / sTotal) * 100) : 0;
      return [s.name, s.source, String(sC), String(sNC), String(sNA), `${sPct}%`];
    });

    if (sectionStats.length > 0) {
      (doc as any).autoTable({
        startY: yRef.y,
        head: [["Phase", "Source", "C", "NC", "N/A", "Compliance %"]],
        body: sectionStats,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
        columnStyles: { 0: { cellWidth: 55 }, 5: { fontStyle: "bold", halign: "center" } },
      });
      yRef.y = (doc as any).lastAutoTable?.finalY + 15 || yRef.y + 15;
    } else {
      nothingToReport(yRef);
    }

    // Compliance Distribution Chart (Figure 2.1)
    yRef.y = ensureSpace(80, yRef.y);
    doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(...SLATE);
    doc.text("Figure 2.1: Compliance distribution chart.", margin, yRef.y); yRef.y += 8;

    const barH = 12;
    const barMaxW = contentW - 30;
    const total = compliantCount + ncCount + naCount || 1;
    const bars = [
      { label: "C", count: compliantCount, color: GREEN },
      { label: "NC", count: ncCount, color: RED },
      { label: "N/A", count: naCount, color: GREY },
    ];

    bars.forEach((bar) => {
      doc.setFontSize(9); doc.setTextColor(...SLATE); doc.text(bar.label, margin, yRef.y + barH / 2 + 1);
      const w = Math.max((bar.count / total) * barMaxW, 1);
      doc.setFillColor(...(bar.color as [number, number, number]));
      doc.roundedRect(margin + 20, yRef.y, w, barH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      if (w > 15) { doc.text(`${bar.count}`, margin + 20 + w / 2, yRef.y + barH / 2 + 1, { align: "center" }); }
      yRef.y += barH + 4;
    });

    // 2.4 Audit Comparison (if previous audit exists)
    if (hasPrevious && previousResponses.length > 0) {
      newPage();
      yRef.y = 30;

      subSectionHeader("2.4", "Audit Comparison — Changes from Previous Audit", yRef);

      const prevPeriod = previousAuditData.period || "Previous";
      const prevDate = previousAuditData.submitted_at ? new Date(previousAuditData.submitted_at).toLocaleDateString("en-ZA") : "N/A";
      bodyText(
        `This section compares the current audit (${period}) with the previous audit (${prevPeriod}, submitted ${prevDate}) conducted on the same project.`,
        yRef
      );

      // Overall Metrics Comparison
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text("Overall Metrics Comparison", margin, yRef.y); yRef.y += 8;

      const delta = (curr: number, prev: number) => {
        const d = curr - prev;
        return d > 0 ? `+${d}` : String(d);
      };

      (doc as any).autoTable({
        startY: yRef.y,
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
      yRef.y = (doc as any).lastAutoTable?.finalY + 15;

      // Item-level changes
      const prevMap = new Map<string, string>();
      previousResponses.forEach((r: any) => { prevMap.set(r.checklist_item_id, r.status); });
      const currMap = new Map<string, string>();
      activeResponses.forEach((r: any) => { currMap.set(r.checklist_item_id, r.status); });

      const changedItems: any[] = [];
      const allItemIds = new Set([...prevMap.keys(), ...currMap.keys()]);
      allItemIds.forEach(itemId => {
        if (!activeItemIds.has(itemId)) return;
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

      yRef.y = ensureSpace(50, yRef.y);
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...SLATE);
      doc.text("Item-Level Status Changes", margin, yRef.y); yRef.y += 8;

      if (changedItems.length > 0) {
        bodyText(`${changedItems.length} item(s) changed status between audits.`, yRef);

        (doc as any).autoTable({
          startY: yRef.y,
          head: [["Ref", "Condition", "Phase", "Previous", "Current", "Comments"]],
          body: changedItems,
          theme: "grid",
          margin: { left: margin, right: margin },
          headStyles: { fillColor: AMBER, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
          bodyStyles: { fontSize: 7, textColor: SLATE },
          columnStyles: { 0: { cellWidth: 13 }, 3: { cellWidth: 15, halign: "center" }, 4: { cellWidth: 15, halign: "center" } },
          didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
        });

        const resolvedNCs = changedItems.filter(r => r[3] === "NC" && r[4] === "C");
        const newNCs = changedItems.filter(r => r[3] !== "NC" && r[4] === "NC");

        yRef.y = (doc as any).lastAutoTable?.finalY + 10;
        yRef.y = ensureSpace(40, yRef.y);

        if (resolvedNCs.length > 0) {
          bodyText(`• ${resolvedNCs.length} previously non-compliant item(s) are now compliant.`, yRef);
        }
        if (newNCs.length > 0) {
          bodyText(`• ${newNCs.length} new non-conformance(s) identified since the previous audit.`, yRef);
        }
        if (resolvedNCs.length === 0 && newNCs.length === 0) {
          bodyText("Status changes did not involve NC transitions.", yRef);
        }
      } else {
        nothingToReport(yRef);
      }
    }

    // ==================== SECTION 3: CONCLUSIONS AND RECOMMENDATIONS ====================
    newPage();
    yRef.y = 30;

    sectionHeader("3", "Conclusions and Recommendations", yRef);

    // 3.1 Objectives
    subSectionHeader("3.1", "Objectives", yRef);
    bodyText(
      `The objective of this audit was to assess the level of environmental compliance of the ${projName} project against the conditions stipulated in the EA and EMPr during the ${period} audit period. The audit further aimed to identify areas of non-compliance and recommend appropriate corrective actions to improve environmental performance.`,
      yRef
    );

    // 3.2 General Comments and Observations
    subSectionHeader("3.2", "General Comments and Observations", yRef);

    if (ncCount > 0) {
      let conclusionText = `The audit identified ${ncCount} non-conformance(s) during the ${period} audit period, resulting in an overall compliance rate of ${compliancePercent}%. It is recommended that the identified non-conformances be addressed within the stipulated timeframes and that corrective actions be implemented and verified during the next audit cycle.`;

      if (hasPrevious) {
        const trend = compliancePercent > prevCompliancePercent ? "improved" : compliancePercent < prevCompliancePercent ? "declined" : "remained unchanged";
        conclusionText += `\n\nCompared to the previous audit (${previousAuditData.period}), overall compliance has ${trend} (${prevCompliancePercent}% → ${compliancePercent}%).`;
      }

      bodyText(conclusionText, yRef);
    } else if (totalAssessed > 0) {
      let conclusionText = `The audit found full compliance during the ${period} audit period, with an overall compliance rate of ${compliancePercent}%. It is recommended that the current environmental management practices be maintained and that ongoing monitoring continues as per the EMPr requirements.`;

      if (hasPrevious) {
        const trend = compliancePercent > prevCompliancePercent ? "improved" : compliancePercent < prevCompliancePercent ? "declined" : "remained unchanged";
        conclusionText += `\n\nCompared to the previous audit (${previousAuditData.period}), overall compliance has ${trend} (${prevCompliancePercent}% → ${compliancePercent}%).`;
      }

      bodyText(conclusionText, yRef);
    } else {
      nothingToReport(yRef);
    }

    // ── Build item numbering map ──
    const itemNumberMap = new Map<string, string>();
    let globalItemNum = 0;
    for (const section of activeSections) {
      const sectionItems2 = items.filter((i: any) => i.section_id === section.id);
      for (const item of sectionItems2) {
        globalItemNum++;
        itemNumberMap.set(item.id, String(globalItemNum));
      }
    }

    // Build photo-to-item reference map
    const photoItemRefMap = new Map<string, string>();
    for (const p of photos) {
      const resp = responses.find((r: any) => r.id === p.responseId);
      if (resp) {
        const itemNum = itemNumberMap.get(resp.checklist_item_id);
        const item = items.find((i: any) => i.id === resp.checklist_item_id);
        photoItemRefMap.set(p.id, itemNum ? `Item ${itemNum} (${item?.condition_ref || "-"})` : item?.condition_ref || "-");
      }
    }

    // ==================== APPENDIX A: FULL CHECKLIST ====================
    newPage();
    yRef.y = 30;

    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("Appendix A — Audit Checklist", margin, yRef.y); yRef.y += 3; drawHR(yRef.y); yRef.y += 10;

    const checklistRows: any[] = [];
    for (const section of activeSections) {
      const sectionLabel = `${section.source} - ${section.name}`;
      checklistRows.push([
        { content: sectionLabel, colSpan: 6, styles: { fillColor: SLATE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 } },
      ]);

      const sectionItems = items.filter((i: any) => i.section_id === section.id);
      for (const item of sectionItems) {
        const response = responses.find((r: any) => r.checklist_item_id === item.id);
        const statusText = response?.status || "-";
        const statusColor = response?.status === "C" ? GREEN : response?.status === "NC" ? RED : GREY;
        const num = itemNumberMap.get(item.id) || "-";
        checklistRows.push([
          num,
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
        startY: yRef.y,
        head: [["#", "Ref", "Condition", "Status", "Comments", "Actions"]],
        body: checklistRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: SLATE, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 250, 250] },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 13 }, 3: { cellWidth: 12 } },
        didDrawPage: () => { addFooter(); doc.setFillColor(...LIGHT_BG); doc.rect(0, 0, pageW, pageH, "F"); },
      });
    } else {
      bodyText("No checklist data available for this audit.", yRef);
    }

    // ==================== APPENDIX B: PHOTO EVIDENCE ====================
    newPage();
    yRef.y = 30;

    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("Appendix B — Photo Evidence", margin, yRef.y); yRef.y += 3; drawHR(yRef.y); yRef.y += 10;

    if (photos.length > 0) {
      const photoRows = photos.map((p: any, idx: number) => [
        String(idx + 1),
        photoItemRefMap.get(p.id) || "-",
        p.caption || "No caption",
        p.gps_location || "N/A",
        p.exif_date ? new Date(p.exif_date).toLocaleDateString("en-ZA") : p.upload_date ? new Date(p.upload_date).toLocaleDateString("en-ZA") : "N/A",
      ]);

      (doc as any).autoTable({
        startY: yRef.y,
        head: [["#", "Item Ref", "Caption", "GPS Location", "Date"]],
        body: photoRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: SLATE },
        alternateRowStyles: { fillColor: [240, 248, 248] },
      });
    } else {
      nothingToReport(yRef);
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
