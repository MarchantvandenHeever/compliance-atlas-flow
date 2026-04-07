
-- 1. Add new enum values to audit_status
ALTER TYPE public.audit_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.audit_status ADD VALUE IF NOT EXISTS 'amendments_requested';

-- 2. Create review_comments table
CREATE TABLE public.review_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id uuid NOT NULL REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  checklist_item_id uuid REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL,
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view review comments"
  ON public.review_comments FOR SELECT TO authenticated
  USING (audit_id IN (
    SELECT ai.id FROM audit_instances ai
    JOIN projects p ON ai.project_id = p.id
    WHERE p.organisation_id = get_user_org(auth.uid())
  ));

CREATE POLICY "Reviewers can manage review comments"
  ON public.review_comments FOR ALL
  USING (has_role(auth.uid(), 'reviewer'::app_role));

CREATE POLICY "Admins can manage review comments"
  ON public.review_comments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auditors can update review comment status"
  ON public.review_comments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'eco_auditor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'eco_auditor'::app_role));

-- 3. Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  audit_id uuid REFERENCES public.audit_instances(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add client_viewer RLS policy for audit_instances (only approved audits)
CREATE POLICY "Client viewers can view approved audits"
  ON public.audit_instances FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client_viewer'::app_role)
    AND status = 'approved'
  );

-- 5. Add updated_at trigger for review_comments
CREATE TRIGGER update_review_comments_updated_at
  BEFORE UPDATE ON public.review_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
