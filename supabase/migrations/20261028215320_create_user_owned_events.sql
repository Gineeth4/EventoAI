-- EventoAI: account-owned saved events with version history.
-- Apply once through the Supabase SQL Editor.
-- The browser continues using its existing storage until the
-- cloud API and migration code are implemented and verified.

create table public.events (
    user_id uuid not null
        references auth.users (id) on delete cascade,

    id text not null
        check (length(id) between 1 and 200),

    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now(),

    data jsonb not null,

    constraint events_user_id_id_pk
        primary key (user_id, id),

    constraint events_data_object
        check (jsonb_typeof(data) = 'object'),

    constraint events_data_id_matches
        check (data ->> 'id' = id),

    constraint events_data_schema_version_2
        check (data ->> 'schemaVersion' = '2'),

    constraint events_data_input_object
        check (jsonb_typeof(data -> 'input') = 'object'),

    constraint events_data_result_object
        check (jsonb_typeof(data -> 'result') = 'object'),

    constraint events_data_versions_array
        check (jsonb_typeof(data -> 'versions') = 'array'),

    constraint events_data_current_version_string
        check (jsonb_typeof(data -> 'currentVersionId') = 'string')
);

comment on table public.events is
    'EventoAI event plans owned by authenticated users; data contains the schema-v2 record and version history.';

create index events_user_updated_at_idx
    on public.events (user_id, updated_at desc);

-- Remove access for anonymous/public roles.
-- Authenticated users receive only the operations needed by the app.
alter table public.events enable row level security;

revoke all on table public.events from anon, public;

grant select, insert, update, delete
    on table public.events to authenticated;

create policy events_select_own
    on public.events
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy events_insert_own
    on public.events
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy events_update_own
    on public.events
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy events_delete_own
    on public.events
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);