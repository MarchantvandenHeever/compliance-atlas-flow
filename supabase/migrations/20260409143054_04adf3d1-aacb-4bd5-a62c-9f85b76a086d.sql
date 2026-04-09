-- Drop old check constraint and add updated one that includes 'reviewed'
ALTER TABLE public.review_comments DROP CONSTRAINT review_comments_status_check;
ALTER TABLE public.review_comments ADD CONSTRAINT review_comments_status_check CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'reviewed'::text]));
