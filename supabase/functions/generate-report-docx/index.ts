import { createClient } from "@supabase/supabase-js";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat,
} from "docx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CES Brand colors (hex)
const TEAL = "0096A6";
const SLATE = "163847";
const AQUA = "A9D6D8";
const GREEN = "228B22";
const RED = "DC2626";
const GREY = "9CA3AF";
const AMBER = "D97706";
const LIGHT_BG = "F7F8F8";
const WHITE = "FFFFFF";

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

// Page dimensions in DXA (A4)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1440; // 1 inch
const CONTENT_W = PAGE_W - MARGIN * 2;

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text: string, width: number, fill = TEAL): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, font: "Arial", size: 18 })] })],
  });
}

function dataCell(text: string, width: number, opts?: { bold?: boolean; color?: string; fill?: string }): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts?.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text: text || "-", font: "Arial", size: 18, bold: opts?.bold, color: opts?.color || SLATE })] })],
  });
}

function sectionTitle(num: string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL, space: 4 } },
    children: [new TextRun({ text: `${num}. ${title}`, font: "Arial", size: 32, bold: true, color: TEAL })],
  });
}

function subSection(num: string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text: `${num} ${title}`, font: "Arial", size: 26, bold: true, color: SLATE })],
  });
}

function subSubSection(num: string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    indent: { left: 360 },
    children: [new TextRun({ text: `${num} ${title}`, font: "Arial", size: 22, bold: true, color: SLATE })],
  });
}

function bodyPara(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: SLATE })],
  });
}

function nothingToReport(): Paragraph {
  return bodyPara("Nothing to report.");
}

function statusColor(status: string): string {
  if (status === "C") return GREEN;
  if (status === "NC") return RED;
  return GREY;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    } = body;

    // ─── Data Fetching (same as PDF function) ───
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
        .from("audit_instances").select("*, projects(*)").eq("id", auditId).single();
      auditData = audit;
      projectData = audit?.projects;

      const { data: resp } = await supabase
        .from("audit_item_responses").select("*, response_photos(*)").eq("audit_id", auditId);
      responses = resp || [];
      photos = responses.flatMap((r: any) => (r.response_photos || []).map((p: any) => ({ ...p, responseId: r.id })));

      const { data: revLog } = await supabase
        .from("audit_revision_log").select("*").eq("audit_id", auditId).order("revision_number", { ascending: true });
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
        .from("audit_section_overrides").select("*").eq("audit_id", auditId);

      if (audit?.template_id) {
        const { data: secs } = await supabase
          .from("checklist_sections").select("*").eq("template_id", audit.template_id).order("sort_order");
        sections = secs || [];
        const inactiveSectionIds = new Set(
          (sectionOverrides || []).filter((o: any) => !o.is_active).map((o: any) => o.section_id)
        );
        sections = sections.map((s: any) => ({ ...s, _inactive: inactiveSectionIds.has(s.id) }));

        const allSectionIds = sections.map((s: any) => s.id);
        if (allSectionIds.length > 0) {
          const { data: objs } = await supabase
            .from("checklist_objectives").select("*").in("section_id", allSectionIds).order("sort_order");
          const objectiveIds = (objs || []).map((o: any) => o.id);
          if (objectiveIds.length > 0) {
            const { data: itms } = await supabase
              .from("checklist_items").select("*").in("objective_id", objectiveIds).order("sort_order");
            items = (itms || []).map((i: any) => {
              const obj = (objs || []).find((o: any) => o.id === i.objective_id);
              return { ...i, section_id: obj?.section_id, _objectiveName: obj?.name };
            });
          }
        }
      }

      if (audit?.project_id) {
        const { data: prevAudits } = await supabase
          .from("audit_instances").select("*").eq("project_id", audit.project_id)
          .in("status", ["submitted", "approved"]).neq("id", auditId)
          .order("submitted_at", { ascending: false }).limit(1);
        if (prevAudits && prevAudits.length > 0) {
          previousAuditData = prevAudits[0];
          const { data: prevResp } = await supabase
            .from("audit_item_responses").select("*").eq("audit_id", previousAuditData.id);
          previousResponses = prevResp || [];
        }
      }
    } else if (projectId) {
      const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
      projectData = project;
    }

    // ─── Metrics ───
    const activeSections = sections.filter((s: any) => !s._inactive);
    const inactiveSections = sections.filter((s: any) => s._inactive);
    const activeSectionIds = new Set(activeSections.map((s: any) => s.id));
    const activeItems = items.filter((i: any) => activeSectionIds.has(i.section_id));
    const activeItemIds = new Set(activeItems.map((i: any) => i.id));
    const activeResponses = responses.filter((r: any) => activeItemIds.has(r.checklist_item_id));
    const compliantCount = activeResponses.filter((r: any) => r.status === "C").length;
    const ncCount = activeResponses.filter((r: any) => r.status === "NC").length;
    const naCount = activeResponses.filter((r: any) => r.status === "NA").length;
    const totalAssessed = compliantCount + ncCount;
    const compliancePercent = totalAssessed > 0 ? Math.round((compliantCount / totalAssessed) * 100) : 0;

    let prevCompliant = 0, prevNC = 0, prevNA = 0, prevCompliancePercent = 0;
    if (previousResponses.length > 0) {
      const prevActive = previousResponses.filter((r: any) => activeItemIds.has(r.checklist_item_id));
      prevCompliant = prevActive.filter((r: any) => r.status === "C").length;
      prevNC = prevActive.filter((r: any) => r.status === "NC").length;
      prevNA = prevActive.filter((r: any) => r.status === "NA").length;
      const prevTotal = prevCompliant + prevNC;
      prevCompliancePercent = prevTotal > 0 ? Math.round((prevCompliant / prevTotal) * 100) : 0;
    }

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
    const reviewedAtStr = reportReview?.reviewed_at
      ? new Date(reportReview.reviewed_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })
      : "—";

    // ─── Helper: build findings table ───
    const buildFindingsTable = (filteredResp: any[], headerFill: string): Table => {
      const colWidths = [1000, 3200, 1600, 1800, 1426];
      const rows = [
        new TableRow({
          children: [
            headerCell("Ref", colWidths[0], headerFill),
            headerCell("Condition", colWidths[1], headerFill),
            headerCell("Phase", colWidths[2], headerFill),
            headerCell("Comments", colWidths[3], headerFill),
            headerCell("Actions", colWidths[4], headerFill),
          ],
        }),
        ...filteredResp.map((r: any) => {
          const item = items.find((i: any) => i.id === r.checklist_item_id);
          const section = item ? sections.find((s: any) => s.id === item.section_id) : null;
          return new TableRow({
            children: [
              dataCell(item?.condition_ref || "-", colWidths[0]),
              dataCell(item?.description || "-", colWidths[1]),
              dataCell(section?.name || "-", colWidths[2]),
              dataCell(r.comments || "-", colWidths[3]),
              dataCell(r.actions || "-", colWidths[4]),
            ],
          });
        }),
      ];
      return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: colWidths,
        rows,
      });
    };

    // ─── Build Document ───
    const children: any[] = [];

    // ── Cover Page ──
    children.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "CES", font: "Arial", size: 36, bold: true, color: TEAL })],
    }));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "ENVIRONMENTAL AND SOCIAL ADVISORY SERVICES", font: "Arial", size: 20, color: SLATE })],
    }));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      shading: { fill: TEAL, type: ShadingType.CLEAR },
      children: [new TextRun({ text: reportTitle, font: "Arial", size: 36, bold: true, color: WHITE })],
    }));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: reportNumber, font: "Arial", size: 24, color: SLATE })],
    }));

    // Review status
    const statusFill = auditData?.status === "approved" ? GREEN : AMBER;
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      shading: { fill: statusFill, type: ShadingType.CLEAR },
      children: [new TextRun({ text: reviewStatus, font: "Arial", size: 18, bold: true, color: WHITE })],
    }));

    // Project info table on cover
    const coverColWidths = [3000, CONTENT_W - 3000];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: coverColWidths,
      rows: [
        new TableRow({ children: [dataCell("Project:", coverColWidths[0], { bold: true }), dataCell(projName, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Client:", coverColWidths[0], { bold: true }), dataCell(projClient, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Location:", coverColWidths[0], { bold: true }), dataCell(projLocation, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Audit Period:", coverColWidths[0], { bold: true }), dataCell(period, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Author:", coverColWidths[0], { bold: true }), dataCell(author, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Reviewer:", coverColWidths[0], { bold: true }), dataCell(reviewer, coverColWidths[1])] }),
        new TableRow({ children: [dataCell("Review Status:", coverColWidths[0], { bold: true }), dataCell(reviewStatus, coverColWidths[1])] }),
      ],
    }));

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ── Revisions Tracking Table ──
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL, space: 4 } },
      children: [new TextRun({ text: "Revisions Tracking Table", font: "Arial", size: 32, bold: true, color: TEAL })],
    }));

    const revTrackCols = [4000, CONTENT_W - 4000];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: revTrackCols,
      rows: [
        new TableRow({ children: [dataCell("Document Title:", revTrackCols[0], { bold: true }), dataCell(reportTitle, revTrackCols[1])] }),
        new TableRow({ children: [dataCell("Client Name:", revTrackCols[0], { bold: true }), dataCell(projClient, revTrackCols[1])] }),
        new TableRow({ children: [dataCell("Status:", revTrackCols[0], { bold: true }), dataCell(auditData?.status === "approved" ? "Approved" : "Draft", revTrackCols[1])] }),
        new TableRow({ children: [dataCell("Issue Date:", revTrackCols[0], { bold: true }), dataCell(new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" }), revTrackCols[1])] }),
        new TableRow({ children: [dataCell("ECO (Report Writer):", revTrackCols[0], { bold: true }), dataCell(author, revTrackCols[1])] }),
        new TableRow({ children: [dataCell("Senior ECO / Reviewer:", revTrackCols[0], { bold: true }), dataCell(reviewer, revTrackCols[1])] }),
      ],
    }));

    children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Revision History", font: "Arial", size: 24, bold: true, color: SLATE })] }));

    const revHistCols = [1500, 2200, 2200, 3126];
    if (revisionLog.length > 0) {
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: revHistCols,
        rows: [
          new TableRow({ children: [headerCell("Revision", revHistCols[0], SLATE), headerCell("Date", revHistCols[1], SLATE), headerCell("Previous Status", revHistCols[2], SLATE), headerCell("Reason", revHistCols[3], SLATE)] }),
          ...revisionLog.map((r: any) => new TableRow({
            children: [
              dataCell(`Rev ${r.revision_number}`, revHistCols[0]),
              dataCell(new Date(r.revised_at).toLocaleDateString("en-ZA"), revHistCols[1]),
              dataCell(r.previous_status, revHistCols[2]),
              dataCell(r.reason || "-", revHistCols[3]),
            ],
          })),
        ],
      }));
    } else {
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2000, 3000, 4026],
        rows: [
          new TableRow({ children: [headerCell("Version", 2000, SLATE), headerCell("Date", 3000, SLATE), headerCell("Notes", 4026, SLATE)] }),
          new TableRow({ children: [dataCell("Version 1", 2000), dataCell(period, 3000), dataCell("Initial report", 4026)] }),
        ],
      }));
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ── The Project Team ──
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL, space: 4 } },
      children: [new TextRun({ text: "The Project Team", font: "Arial", size: 32, bold: true, color: TEAL })],
    }));

    const teamCols = [3500, 3500, 2026];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: teamCols,
      rows: [
        new TableRow({ children: [headerCell("Role", teamCols[0], TEAL), headerCell("Name", teamCols[1], TEAL), headerCell("Responsibility", teamCols[2], TEAL)] }),
        new TableRow({ children: [dataCell("Environmental Control Officer (ECO)", teamCols[0]), dataCell(author, teamCols[1]), dataCell("Report Writer", teamCols[2])] }),
        new TableRow({ children: [dataCell("Senior ECO / Reviewer", teamCols[0]), dataCell(reviewer, teamCols[1]), dataCell("Reviewer", teamCols[2])] }),
      ],
    }));

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ── Section 1: Introduction ──
    children.push(sectionTitle("1", "Introduction"));
    children.push(bodyPara(
      `CES Environmental and Social Advisory Services has been appointed as the Environmental Control Officer (ECO) for the ${projName} project. This report presents the findings of the environmental compliance audit conducted during the ${period} audit period.`
    ));
    children.push(bodyPara(
      `The purpose of this audit is to assess compliance with the conditions of the Environmental Authorisation (EA) and the Environmental Management Programme (EMPr) applicable to the project, identify non-conformances, and recommend corrective actions where necessary.`
    ));

    // 1.1 Project Description
    children.push(subSection("1.1", "Project Description"));
    if (projectData?.description) {
      children.push(bodyPara(projectData.description));
    }

    const projCols = [3000, CONTENT_W - 3000];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: projCols,
      rows: [
        new TableRow({ children: [headerCell("Field", projCols[0], TEAL), headerCell("Detail", projCols[1], TEAL)] }),
        new TableRow({ children: [dataCell("Project Name", projCols[0], { bold: true }), dataCell(projName, projCols[1])] }),
        new TableRow({ children: [dataCell("Client", projCols[0], { bold: true }), dataCell(projClient, projCols[1])] }),
        new TableRow({ children: [dataCell("Location", projCols[0], { bold: true }), dataCell(projLocation, projCols[1])] }),
        new TableRow({ children: [dataCell("Audit Period", projCols[0], { bold: true }), dataCell(period, projCols[1])] }),
        new TableRow({ children: [dataCell("Audit Type", projCols[0], { bold: true }), dataCell(auditData?.type || "Monthly", projCols[1])] }),
        new TableRow({ children: [dataCell("Auditor (ECO)", projCols[0], { bold: true }), dataCell(author, projCols[1])] }),
        new TableRow({ children: [dataCell("Reviewer", projCols[0], { bold: true }), dataCell(reviewer, projCols[1])] }),
        ...(auditData?.revision_count > 0 ? [new TableRow({ children: [dataCell("Revision", projCols[0], { bold: true }), dataCell(`Rev ${auditData.revision_count}`, projCols[1])] })] : []),
      ],
    }));

    // 1.2 Authorisation Monitoring
    children.push(subSection("1.2", "Authorisation Monitoring and Reporting Requirements"));
    children.push(bodyPara(
      `The Environmental Control Officer (ECO) is required to report on the compliance of the proponent and/or contractor in terms of the Environmental Authorisation (EA), Environmental Management Programme (EMPr), General Authorisation (GA), or any relevant environmental permits and licences.`
    ));

    children.push(subSubSection("1.2.1", "Monitoring, Recording and Reporting Requirements"));
    children.push(bodyPara(
      `The audit was conducted in terms of the monitoring requirements stipulated in the EA and EMPr. The ECO is required to conduct regular site inspections and compliance audits to verify adherence to the authorisation conditions, and to report on any deviations or non-conformances observed during the audit period.`
    ));

    children.push(subSubSection("1.2.2", "Relevant Contact Persons"));
    const contactCols = [3500, CONTENT_W - 3500];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: contactCols,
      rows: [
        new TableRow({ children: [headerCell("Role", contactCols[0], SLATE), headerCell("Name", contactCols[1], SLATE)] }),
        new TableRow({ children: [dataCell("ECO (Report Writer)", contactCols[0], { bold: true }), dataCell(author, contactCols[1])] }),
        new TableRow({ children: [dataCell("Senior ECO (Reviewer)", contactCols[0], { bold: true }), dataCell(reviewer, contactCols[1])] }),
        new TableRow({ children: [dataCell("Client", contactCols[0], { bold: true }), dataCell(projClient, contactCols[1])] }),
      ],
    }));

    children.push(subSubSection("1.2.3", "Report Outcome"));
    if (ncCount > 0) {
      children.push(bodyPara(`This audit identified ${ncCount} non-conformance(s) out of ${totalAssessed} assessed conditions, resulting in an overall compliance rate of ${compliancePercent}%.`));
    } else if (totalAssessed > 0) {
      children.push(bodyPara(`This audit found full compliance across all ${totalAssessed} assessed conditions, with an overall compliance rate of ${compliancePercent}%.`));
    } else {
      children.push(nothingToReport());
    }

    children.push(subSubSection("1.2.4", "Site Compliance Monitoring"));
    children.push(bodyPara(
      `Site compliance monitoring was carried out through visual inspection, documentation review, and engagement with on-site personnel. Compliance was assessed against the conditions of the EA, EMPr, and any other relevant authorisations and permits.`
    ));

    children.push(subSubSection("1.2.5", "Audit Programme"));
    const auditFreq = projectData?.audit_frequency || auditData?.type || "monthly";
    children.push(bodyPara(`The audit programme for this project comprises ${auditFreq} environmental compliance audits. This report constitutes audit ${reportNumber} for the ${period} period.`));

    if (inactiveSections.length > 0) {
      const inactiveNames = inactiveSections.map((s: any) => s.name).join(", ");
      children.push(bodyPara(`Note: The following phase(s) were marked as inactive and were therefore not considered as part of this audit: ${inactiveNames}. Items within inactive phases are excluded from the compliance calculations.`));
    }

    // ── Section 2: Environmental Compliance Audit ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionTitle("2", "Environmental Compliance Audit"));

    // 2.1 Audit Methodology
    children.push(subSection("2.1", "Audit Methodology"));
    children.push(bodyPara(
      `The audit was conducted through a systematic review of the EA conditions and EMPr commitments. Each compliance condition was assessed against site observations, documentation review, and stakeholder engagement.`
    ));

    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Table 2.1: Qualitative indicator of compliance.", font: "Arial", size: 18, italics: true, color: SLATE })] }));

    const methodCols = [2500, CONTENT_W - 2500];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: methodCols,
      rows: [
        new TableRow({ children: [headerCell("Rating", methodCols[0], TEAL), headerCell("Description", methodCols[1], TEAL)] }),
        new TableRow({ children: [dataCell("C (Compliant)", methodCols[0], { bold: true, color: GREEN }), dataCell("The condition has been met.", methodCols[1])] }),
        new TableRow({ children: [dataCell("NC (Non-Compliant)", methodCols[0], { bold: true, color: RED }), dataCell("The condition has not been met and requires corrective action.", methodCols[1])] }),
        new TableRow({ children: [dataCell("N/A (Not Applicable)", methodCols[0], { bold: true, color: GREY }), dataCell("The condition is not applicable to the current audit period or phase of the project.", methodCols[1])] }),
      ],
    }));

    children.push(bodyPara(`The compliance percentage is calculated as: Compliant / (Compliant + Non-Compliant) x 100, excluding N/A items from the denominator.`));

    // 2.2 Summary of Audit Findings
    children.push(subSection("2.2", "Summary of Audit Findings"));

    // 2.2.1 Non-Compliant
    children.push(subSubSection("2.2.1", "Non-Compliant Items"));
    const ncResp = activeResponses.filter((r: any) => r.status === "NC");
    if (ncResp.length > 0) {
      children.push(bodyPara(`A total of ${ncResp.length} non-conformance(s) were identified during this audit period.`));
      children.push(buildFindingsTable(ncResp, RED));
    } else {
      children.push(nothingToReport());
    }

    // 2.2.2 Compliant
    children.push(subSubSection("2.2.2", "Compliant Items"));
    const cResp = activeResponses.filter((r: any) => r.status === "C");
    if (cResp.length > 0) {
      children.push(bodyPara(`A total of ${cResp.length} item(s) were found to be compliant.`));
      children.push(buildFindingsTable(cResp, GREEN));
    } else {
      children.push(nothingToReport());
    }

    // 2.2.3 Not Applicable
    children.push(subSubSection("2.2.3", "Not Applicable Items"));
    const naResp = activeResponses.filter((r: any) => r.status === "NA");
    if (naResp.length > 0) {
      children.push(bodyPara(`A total of ${naResp.length} item(s) were marked as not applicable to the current audit period.`));
      children.push(buildFindingsTable(naResp, GREY));
    } else {
      children.push(nothingToReport());
    }

    // 2.3 Summary of Compliance
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(subSection("2.3", "Summary of Compliance"));

    // Metrics table
    const metricCols = [CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4];
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: metricCols,
      rows: [
        new TableRow({
          children: [
            new TableCell({ borders: cellBorders, width: { size: metricCols[0], type: WidthType.DXA }, shading: { fill: TEAL, type: ShadingType.CLEAR }, margins: cellMargins,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${compliancePercent}%`, font: "Arial", size: 36, bold: true, color: WHITE })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Compliance", font: "Arial", size: 16, color: WHITE })] }),
              ],
            }),
            new TableCell({ borders: cellBorders, width: { size: metricCols[1], type: WidthType.DXA }, shading: { fill: GREEN, type: ShadingType.CLEAR }, margins: cellMargins,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(compliantCount), font: "Arial", size: 36, bold: true, color: WHITE })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Compliant", font: "Arial", size: 16, color: WHITE })] }),
              ],
            }),
            new TableCell({ borders: cellBorders, width: { size: metricCols[2], type: WidthType.DXA }, shading: { fill: RED, type: ShadingType.CLEAR }, margins: cellMargins,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(ncCount), font: "Arial", size: 36, bold: true, color: WHITE })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Non-Compliant", font: "Arial", size: 16, color: WHITE })] }),
              ],
            }),
            new TableCell({ borders: cellBorders, width: { size: metricCols[3], type: WidthType.DXA }, shading: { fill: GREY, type: ShadingType.CLEAR }, margins: cellMargins,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(naCount), font: "Arial", size: 36, bold: true, color: WHITE })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "N/A", font: "Arial", size: 16, color: WHITE })] }),
              ],
            }),
          ],
        }),
      ],
    }));

    // Section breakdown
    children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Table 2.3: Compliance breakdown by section.", font: "Arial", size: 18, italics: true, color: SLATE })] }));

    if (sections.length > 0) {
      const brkCols = [3000, 1000, 1000, 1000, 1000, 2026];
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: brkCols,
        rows: [
          new TableRow({ children: [headerCell("Phase", brkCols[0], SLATE), headerCell("Source", brkCols[1], SLATE), headerCell("C", brkCols[2], SLATE), headerCell("NC", brkCols[3], SLATE), headerCell("N/A", brkCols[4], SLATE), headerCell("Compliance %", brkCols[5], SLATE)] }),
          ...sections.map((s: any) => {
            const si = items.filter((i: any) => i.section_id === s.id);
            const sr = responses.filter((r: any) => si.some((i: any) => i.id === r.checklist_item_id));
            const sC = sr.filter((r: any) => r.status === "C").length;
            const sNC = sr.filter((r: any) => r.status === "NC").length;
            const sNA = sr.filter((r: any) => r.status === "NA").length;
            const sT = sC + sNC;
            const sPct = sT > 0 ? Math.round((sC / sT) * 100) : 0;
            return new TableRow({
              children: [
                dataCell(s._inactive ? `${s.name} (INACTIVE)` : s.name, brkCols[0], { bold: true }),
                dataCell(s.source, brkCols[1]),
                dataCell(s._inactive ? "-" : String(sC), brkCols[2]),
                dataCell(s._inactive ? "-" : String(sNC), brkCols[3]),
                dataCell(s._inactive ? "-" : String(sNA), brkCols[4]),
                dataCell(s._inactive ? "N/A" : `${sPct}%`, brkCols[5], { bold: true }),
              ],
            });
          }),
        ],
      }));
    } else {
      children.push(nothingToReport());
    }

    // 2.4 Audit Comparison
    if (hasPrevious && previousResponses.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(subSection("2.4", "Audit Comparison \u2014 Changes from Previous Audit"));

      const prevPeriod = previousAuditData.period || "Previous";
      const prevDate = previousAuditData.submitted_at ? new Date(previousAuditData.submitted_at).toLocaleDateString("en-ZA") : "N/A";
      children.push(bodyPara(`This section compares the current audit (${period}) with the previous audit (${prevPeriod}, submitted ${prevDate}) conducted on the same project.`));

      const delta = (curr: number, prev: number) => { const d = curr - prev; return d > 0 ? `+${d}` : String(d); };
      const compCols = [2500, 2200, 2200, 2126];
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: compCols,
        rows: [
          new TableRow({ children: [headerCell("Metric", compCols[0], TEAL), headerCell(`Previous (${prevPeriod})`, compCols[1], TEAL), headerCell(`Current (${period})`, compCols[2], TEAL), headerCell("Change", compCols[3], TEAL)] }),
          new TableRow({ children: [dataCell("Compliance %", compCols[0], { bold: true }), dataCell(`${prevCompliancePercent}%`, compCols[1]), dataCell(`${compliancePercent}%`, compCols[2]), dataCell(`${delta(compliancePercent, prevCompliancePercent)}%`, compCols[3], { bold: true })] }),
          new TableRow({ children: [dataCell("Compliant (C)", compCols[0], { bold: true }), dataCell(String(prevCompliant), compCols[1]), dataCell(String(compliantCount), compCols[2]), dataCell(delta(compliantCount, prevCompliant), compCols[3], { bold: true })] }),
          new TableRow({ children: [dataCell("Non-Compliant (NC)", compCols[0], { bold: true }), dataCell(String(prevNC), compCols[1]), dataCell(String(ncCount), compCols[2]), dataCell(delta(ncCount, prevNC), compCols[3], { bold: true })] }),
          new TableRow({ children: [dataCell("Not Applicable (N/A)", compCols[0], { bold: true }), dataCell(String(prevNA), compCols[1]), dataCell(String(naCount), compCols[2]), dataCell(delta(naCount, prevNA), compCols[3], { bold: true })] }),
        ],
      }));

      // Item-level changes
      const prevMap = new Map<string, string>();
      previousResponses.forEach((r: any) => { prevMap.set(r.checklist_item_id, r.status); });
      const currMap = new Map<string, string>();
      activeResponses.forEach((r: any) => { currMap.set(r.checklist_item_id, r.status); });

      const changedItems: any[] = [];
      const allIds = new Set([...prevMap.keys(), ...currMap.keys()]);
      allIds.forEach(itemId => {
        if (!activeItemIds.has(itemId)) return;
        const prev = prevMap.get(itemId) || "-";
        const curr = currMap.get(itemId) || "-";
        if (prev !== curr) {
          const item = items.find((i: any) => i.id === itemId);
          const section = item ? sections.find((s: any) => s.id === item.section_id) : null;
          const currR = responses.find((r: any) => r.checklist_item_id === itemId);
          changedItems.push({ ref: item?.condition_ref || "-", desc: item?.description || "-", phase: section?.name || "-", prev, curr, comments: currR?.comments || "-" });
        }
      });

      children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Item-Level Status Changes", font: "Arial", size: 24, bold: true, color: SLATE })] }));

      if (changedItems.length > 0) {
        children.push(bodyPara(`${changedItems.length} item(s) changed status between audits.`));
        const chgCols = [900, 2800, 1500, 1000, 1000, 1826];
        children.push(new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: chgCols,
          rows: [
            new TableRow({ children: [headerCell("Ref", chgCols[0], AMBER), headerCell("Condition", chgCols[1], AMBER), headerCell("Phase", chgCols[2], AMBER), headerCell("Prev", chgCols[3], AMBER), headerCell("Curr", chgCols[4], AMBER), headerCell("Comments", chgCols[5], AMBER)] }),
            ...changedItems.map(c => new TableRow({
              children: [dataCell(c.ref, chgCols[0]), dataCell(c.desc, chgCols[1]), dataCell(c.phase, chgCols[2]), dataCell(c.prev, chgCols[3], { color: statusColor(c.prev) }), dataCell(c.curr, chgCols[4], { color: statusColor(c.curr) }), dataCell(c.comments, chgCols[5])],
            })),
          ],
        }));

        const resolvedNCs = changedItems.filter(c => c.prev === "NC" && c.curr === "C");
        const newNCs = changedItems.filter(c => c.prev !== "NC" && c.curr === "NC");
        if (resolvedNCs.length > 0) children.push(bodyPara(`\u2022 ${resolvedNCs.length} previously non-compliant item(s) are now compliant.`));
        if (newNCs.length > 0) children.push(bodyPara(`\u2022 ${newNCs.length} new non-conformance(s) identified since the previous audit.`));
        if (resolvedNCs.length === 0 && newNCs.length === 0) children.push(bodyPara("Status changes did not involve NC transitions."));
      } else {
        children.push(nothingToReport());
      }
    }

    // ── Section 3: Conclusions and Recommendations ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionTitle("3", "Conclusions and Recommendations"));

    children.push(subSection("3.1", "Objectives"));
    children.push(bodyPara(
      `The objective of this audit was to assess the level of environmental compliance of the ${projName} project against the conditions stipulated in the EA and EMPr during the ${period} audit period. The audit further aimed to identify areas of non-compliance and recommend appropriate corrective actions to improve environmental performance.`
    ));

    children.push(subSection("3.2", "General Comments and Observations"));
    if (ncCount > 0) {
      let concText = `The audit identified ${ncCount} non-conformance(s) during the ${period} audit period, resulting in an overall compliance rate of ${compliancePercent}%. It is recommended that the identified non-conformances be addressed within the stipulated timeframes and that corrective actions be implemented and verified during the next audit cycle.`;
      if (hasPrevious) {
        const trend = compliancePercent > prevCompliancePercent ? "improved" : compliancePercent < prevCompliancePercent ? "declined" : "remained unchanged";
        concText += ` Compared to the previous audit (${previousAuditData.period}), overall compliance has ${trend} (${prevCompliancePercent}% to ${compliancePercent}%).`;
      }
      children.push(bodyPara(concText));
    } else if (totalAssessed > 0) {
      let concText = `The audit found full compliance during the ${period} audit period, with an overall compliance rate of ${compliancePercent}%. It is recommended that the current environmental management practices be maintained and that ongoing monitoring continues as per the EMPr requirements.`;
      if (hasPrevious) {
        const trend = compliancePercent > prevCompliancePercent ? "improved" : compliancePercent < prevCompliancePercent ? "declined" : "remained unchanged";
        concText += ` Compared to the previous audit (${previousAuditData.period}), overall compliance has ${trend} (${prevCompliancePercent}% to ${compliancePercent}%).`;
      }
      children.push(bodyPara(concText));
    } else {
      children.push(nothingToReport());
    }

    // ── Appendix A ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL, space: 4 } },
      children: [new TextRun({ text: "Appendix A \u2014 Audit Checklist", font: "Arial", size: 32, bold: true, color: TEAL })],
    }));

    if (sections.length > 0) {
      const appCols = [1000, 3200, 1000, 1800, 2026];
      const appRows: TableRow[] = [
        new TableRow({ children: [headerCell("Ref", appCols[0], TEAL), headerCell("Condition", appCols[1], TEAL), headerCell("Status", appCols[2], TEAL), headerCell("Comments", appCols[3], TEAL), headerCell("Actions", appCols[4], TEAL)] }),
      ];

      for (const section of sections) {
        const label = section._inactive
          ? `${section.source} - ${section.name} [INACTIVE - Not assessed in this audit]`
          : `${section.source} - ${section.name}`;
        const hdrFill = section._inactive ? "787878" : SLATE;
        appRows.push(new TableRow({
          children: [
            new TableCell({
              borders: cellBorders, columnSpan: 5,
              shading: { fill: hdrFill, type: ShadingType.CLEAR }, margins: cellMargins,
              width: { size: CONTENT_W, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: WHITE })] })],
            }),
          ],
        }));

        const sItems = items.filter((i: any) => i.section_id === section.id);
        for (const item of sItems) {
          const resp = responses.find((r: any) => r.checklist_item_id === item.id);
          const st = resp?.status || "-";
          appRows.push(new TableRow({
            children: [
              dataCell(item.condition_ref || "-", appCols[0]),
              dataCell(item.description || "-", appCols[1]),
              dataCell(st, appCols[2], { bold: true, color: statusColor(st) }),
              dataCell(resp?.comments || "-", appCols[3]),
              dataCell(resp?.actions || "-", appCols[4]),
            ],
          }));
        }
      }

      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: appCols,
        rows: appRows,
      }));
    } else {
      children.push(nothingToReport());
    }

    // ── Appendix B ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL, space: 4 } },
      children: [new TextRun({ text: "Appendix B \u2014 Photo Evidence", font: "Arial", size: 32, bold: true, color: TEAL })],
    }));

    if (photos.length > 0) {
      const photoCols = [800, 3500, 2700, 2026];
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: photoCols,
        rows: [
          new TableRow({ children: [headerCell("#", photoCols[0], TEAL), headerCell("Caption", photoCols[1], TEAL), headerCell("GPS Location", photoCols[2], TEAL), headerCell("Date", photoCols[3], TEAL)] }),
          ...photos.map((p: any, idx: number) => new TableRow({
            children: [
              dataCell(String(idx + 1), photoCols[0]),
              dataCell(p.caption || "No caption", photoCols[1]),
              dataCell(p.gps_location || "N/A", photoCols[2]),
              dataCell(p.exif_date ? new Date(p.exif_date).toLocaleDateString("en-ZA") : p.upload_date ? new Date(p.upload_date).toLocaleDateString("en-ZA") : "N/A", photoCols[3]),
            ],
          })),
        ],
      }));
    } else {
      children.push(nothingToReport());
    }

    // ─── Build and Return ───
    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 20 } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 32, bold: true, font: "Arial", color: TEAL },
            paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 26, bold: true, font: "Arial", color: SLATE },
            paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
          { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 22, bold: true, font: "Arial", color: SLATE },
            paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: TEAL, space: 4 } },
              children: [
                new TextRun({ text: "CES Environmental and Social Advisory Services", font: "Arial", size: 16, color: TEAL }),
                new TextRun({ text: "\t\tCONFIDENTIAL", font: "Arial", size: 14, color: GREY }),
              ],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: TEAL, space: 4 } },
              children: [
                new TextRun({ text: "Page ", font: "Arial", size: 16, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: GREY }),
              ],
            })],
          }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="CES_Audit_Report_${period.replace(/\s/g, "_")}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate report", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
