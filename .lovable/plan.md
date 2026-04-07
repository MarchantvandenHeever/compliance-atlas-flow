

## Fix: Import Checklist to Parse All Workbook Tabs

### Problem
The current import logic (`Templates.tsx` line 47) only reads the **first sheet** of the workbook (`wb.SheetNames[0]`), which is the Table of Contents/summary page with no checklist items. The actual checklist data lives on subsequent sheets (EA Checklist, EMPr Checklist, etc.).

Additionally, section names like "OBJECTIVE 3: APPROPRIATE MANAGEMENT..." appear as **inline rows** in the Description column (with no Score value), not as a separate "Section" column. The current parser expects a dedicated section column.

### Plan

**File: `src/pages/Templates.tsx`** — Rewrite the `handleImport` function:

1. **Iterate all sheets** in the workbook instead of only `wb.SheetNames[0]`. Skip the first sheet (Table of Contents) or any sheet that doesn't contain checklist data (detected by absence of a "Description" header row).

2. **Smarter header detection** — For each sheet, scan rows to find a header row containing "Description" (case-insensitive). Also detect "Condition No." / "Condition" for the reference column, and "Score" / "Comments" columns. The column match regex on line 62 already includes "desc" but needs to also match exact "Description".

3. **Auto-detect sections from inline rows** — When a row has a value in the Description column but NO score/condition number, and the text matches patterns like "OBJECTIVE", "Section", or is all-caps, treat it as a **section header** rather than a checklist item. Use the sheet name as a fallback section grouping.

4. **Detect source from sheet name** — If the sheet name contains "EA", set source to `'EA'`; if it contains "EMPr", set source to `'EMPr'`. This replaces reliance on a "Source" column which doesn't exist in this workbook format.

5. **Handle merged cells and empty rows gracefully** — Skip rows where all relevant cells are empty. Handle the sub-item pattern (e.g., "a)", "b)") by treating them as regular checklist items under the current section.

### Technical Details

```text
Current flow:
  Sheet[0] → find headers → parse rows → fail (no Description on summary sheet)

New flow:
  For each sheet in workbook:
    Skip if sheet name matches "contents" / "summary" / "cover"
    Find header row with "Description"
    Determine source from sheet name (EA/EMPr)
    Parse rows:
      If row has Description but no Condition No. and looks like a title → new section
      Otherwise → checklist item under current section
    Accumulate into sectionsMap
  Import all accumulated sections + items
```

