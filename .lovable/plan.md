## Phase 1: Database Schema & Auth (This message)
1. Create database tables: organisations, projects, checklist_templates, checklist_sections, checklist_items, audit_instances, audit_item_responses, response_photos, corrective_actions, user_roles, profiles
2. Set up RLS policies
3. Add authentication with login/signup page
4. Add role-based access (Admin, ECO/Auditor, Reviewer, Client Viewer)
5. Wire up Supabase client integration

## Phase 2: Photo Upload with EXIF (Next message)
1. Create storage bucket for audit photos
2. Build photo upload component with camera capture
3. Extract EXIF metadata (GPS, date/time) client-side
4. Display thumbnails inline in checklist

## Phase 3: PDF Report Generation (Following message)
1. Build server-side PDF generation edge function
2. Style PDF to match CES audit report structure
3. Include cover page, TOC, compliance charts, checklist appendix, photo appendix
4. Add download functionality to Reports page

This phased approach ensures each feature works before building on it.