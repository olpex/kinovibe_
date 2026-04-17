# Supabase Schema Workflow

## Source of truth
Use versioned SQL migrations in `supabase/migrations/`.

## Apply changes
```bash
supabase db push
```

## Current migration chain
1. `20260417180000_core_schema.sql`
2. `20260417181000_rls_policies.sql`
3. `20260417182000_leaderboard_rpc_filters.sql`

## `mvp_schema.sql`
`supabase/mvp_schema.sql` is documentation-only and intentionally non-executable.
Do not add new schema changes there.
