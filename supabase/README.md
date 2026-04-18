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
4. `20260418120000_content_policy_blocks_cleanup.sql`
5. `20260418123000_content_policy_bulk_upsert.sql`

## Content policy bulk seed
Use `supabase/sql/no_russian_content_seed_template.sql` to mass-add blocked TMDB IDs and run cleanup.

## `mvp_schema.sql`
`supabase/mvp_schema.sql` is documentation-only and intentionally non-executable.
Do not add new schema changes there.
