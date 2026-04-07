
## Restructure Template Hierarchy: Phase → Objective → Task

### Current Structure (2 levels)
- `checklist_sections` (Section) → `checklist_items` (Item)

### New Structure (3 levels)
- `checklist_sections` → renamed conceptually to **Phases**
- NEW `checklist_objectives` table → **Objectives** (child of phase/section)
- `checklist_items` → repurposed as **Task Descriptions** (child of objective)

### Step 1 — Database Migration
- Create `checklist_objectives` table with columns: `id`, `section_id` (FK to phases), `name`, `sort_order`, `source`
- Update `checklist_items` to reference `objective_id` instead of `section_id`
- Add RLS policies matching existing patterns
- Migrate existing data: create a default objective per section, re-link items

### Step 2 — Update Hooks (`useTemplates.ts`)
- Add `useTemplateObjectives` hook
- Update import mutation to handle 3-level parsing
- Update delete to cascade through objectives

### Step 3 — Update Import Logic (`Templates.tsx`)
- Parse Excel: Phase (bold/header rows) → Objective (sub-header) → Task (detail rows)
- Map to the 3-level insert flow

### Step 4 — Update Template Detail View
- Show Phase → Objective → Task accordion hierarchy

### Step 5 — Update Audit Capture
- Update `AuditCapture.tsx` to navigate Phase → Objective → Tasks
