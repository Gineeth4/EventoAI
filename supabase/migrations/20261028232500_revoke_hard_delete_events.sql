-- EventoAI: preserve deletion tombstones.
--
-- The client deletes events by setting deleted_at, not by physically
-- removing the row. Remove the direct DELETE permission so authenticated
-- clients cannot erase tombstones and permit stale copies to reappear.

REVOKE DELETE ON TABLE public.events
    FROM authenticated, anon, public;

DROP POLICY IF EXISTS events_delete_own
    ON public.events;
