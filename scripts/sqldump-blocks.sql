-- Live-vs-fallback inspection for the website's public surfaces.
-- Run this in the Supabase Dashboard SQL Editor for the genumsolutions
-- project (jxgmbodzkmxanuwfaqxo). Each block below answers one question:
-- is this public surface rendering live DB rows, or is the website falling
-- back to bundled content data?

-- 1) Site content: / (metadata + home fallback), admin Content tab.
select 'site_content' as table, id, home_title, left(home_body, 120) as home_body_sample, updated_at
  from public.site_content
  where id = 1;

-- 2) Services: /services and the home services grid / tools tabs.
select 'services' as table, id, name, category, price_label, description, tag, sort_order, active
  from public.services
  order by sort_order nulls last, id;

-- 3) Company info: footer / contact / account surfaces.
select 'company_info' as table, id, name, short_name, email, phone, whatsapp_number, description, updated_at
  from public.company_info
  where id = 1;

-- 4) Training programs: home training strip / services #training.
select 'training_programs' as table, id, title, audience, duration, left(description, 100) as description_sample, active, sort_order
  from public.training_programs
  order by sort_order nulls last, title;

-- 5) Pilot cost lines: home pilot-costing panel / services #pilots.
select 'pilot_cost_lines' as table, id, item, cost, left(note, 100) as note_sample, active, sort_order
  from public.pilot_cost_lines
  order by sort_order nulls last, id;

-- 6) Curriculum highlights: home curriculum section / services.
select 'curriculum_highlights' as table, id, age_band, items, active, sort_order
  from public.curriculum_highlights
  order by sort_order nulls last, id;

-- 7) Journal posts: /journal and the app journal feed.
select 'journal_posts' as table, id, tag, title, left(text, 120) as text_sample, active, sort_order
  from public.journal_posts
  order by sort_order nulls last, id;

-- 8) Products: /products + home carousel / shelf strips.
select 'products' as table, id, name, category, price_label, active, stock, image_url, gallery, sort_order
  from public.products
  order by sort_order nulls last, id
  limit 400;

-- 8b) Products empty check (decisive parity signal).
select 'products_empty_check' as table, count(*)::int as product_count, sum((active)::int) as active_product_count
  from public.products;

select 'products_sample' as table, id, name, category, price_label, active, stock, image_url is not null as has_image, sort_order
  from public.products
  order by sort_order nulls last, id
  limit 300;

-- 9) Project categories: /projects.
select 'project_categories' as table, id, name, icon, car_type, sort_order, updated_at
  from public.project_categories
  order by sort_order nulls last, id;
