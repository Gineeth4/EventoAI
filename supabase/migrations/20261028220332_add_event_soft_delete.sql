-- Keep deletion tombstones so stale local copies cannot recreate deleted events.
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.events.deleted_at IS
    'When set, the event is deleted and must not be restored by stale local sync.';