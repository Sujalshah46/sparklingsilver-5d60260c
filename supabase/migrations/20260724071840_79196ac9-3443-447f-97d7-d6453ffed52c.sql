DROP POLICY IF EXISTS "users insert own activity" ON public.user_activity_log;

CREATE POLICY "users insert own activity"
ON public.user_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND (
    auth.uid() = user_id
    OR private.has_role(auth.uid(), 'admin'::app_role)
  )
);