
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid,
  path text NOT NULL,
  referrer text,
  user_agent text,
  country text,
  device text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_visitor ON public.page_views (visitor_id);
CREATE INDEX idx_page_views_user ON public.page_views (user_id);
CREATE INDEX idx_page_views_path ON public.page_views (path);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY page_views_select_admin ON public.page_views
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserts/updates only via service role (server route), so no insert/update policies needed.
