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
6. `20260419103000_feedback_close_flag.sql`
7. `20260419113000_feedback_discussion_state_hardening.sql`
8. `20260419150000_legal_catalog_and_event_types.sql`
9. `20260419200000_seed_legal_catalog_archive_org.sql`
10. `20260419220000_reseed_legal_catalog_archive_org.sql`
11. `20260419221000_disable_legacy_legal_starter.sql`
12. `20260419223500_reseed_legal_catalog_archive_org.sql`
13. `20260419235500_billing_and_ads_monetization.sql`
14. `20260421200000_billing_provider_legacy_step1.sql`
15. `20260421233000_billing_provider_legacy_step2.sql`
16. `20260421234500_billing_provider_legacy_step3.sql`
17. `20260422110000_monobank_billing_provider.sql`

## Content policy bulk seed
Use `supabase/sql/no_russian_content_seed_template.sql` to mass-add blocked TMDB IDs and run cleanup.

## `mvp_schema.sql`
`supabase/mvp_schema.sql` is documentation-only and intentionally non-executable.
Do not add new schema changes there.
