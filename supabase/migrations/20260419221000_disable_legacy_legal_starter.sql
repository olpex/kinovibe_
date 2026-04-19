-- Hide legacy starter row that predates full legal seed quality.
update public.legal_catalog_items
set is_active = false,
    updated_at = now()
where slug = 'night-of-the-living-dead-1968'
  and coalesce(metadata_json->>'provider', '') = '';
