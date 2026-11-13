#!/usr/bin/env node
/**
 * mirror-print-prices.mjs — mirror the root docx print prices into the live
 * Supabase DB as DRAFT values (pending GENUM approval).
 *
 * Source of truth for the numbers: GENUM_SOLUTIONS_3D_Printing_Business_Market
 * _and_Financial_Report.docx (extracted to docx-extracted.txt in the project
 * root). All prices are PROPOSED / pending approval — the script keeps
 * pricing_status = 'draft' so the public page and app still show "rate on
 * request" and the calculator stays hidden.
 *
 * Docx targets (section 13, "Recommended Initial Commercial Settings"):
 *   - PLA standard printing: NPR 12 / gram
 *   - PETG standard printing: NPR 16 / gram
 *   - Minimum printing order: NPR 350
 *   - Basic file preparation: from NPR 300  (already seeded as "File repair"
 *     print_service with "From NPR 300" — no DB change needed)
 *   - 3D design and modeling: from NPR 2,500 (already seeded as "Design for
 *     print" print_service "From NPR 2,500" AND print_settings
 *     design_base_charge = 2500 — no DB change needed)
 *   - Bulk discounts: 5–15%, subject to costing
 *
 * No payment code touched. No secrets printed.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ---- docx-derived targets (all DRAFT / pending approval) ----
const TARGETS = {
  materials: {
    pla: { ratePerGram: 12, note: 'Proposed NPR 12/g — pending owner approval.' },
    petg: { ratePerGram: 16, note: 'Proposed NPR 16/g — pending owner approval.' },
  },
  settings: {
    minimumOrder: 350, // docx: minimum printing order NPR 350
    // designBaseCharge already 2500 in DB (matches docx 3D design from NPR 2,500) — leave it
    bulkTiers: [
      { minQty: 10, discountPercent: 5 },   // 5% at 10+
      { minQty: 50, discountPercent: 10 },  // 10% at 50+
      { minQty: 100, discountPercent: 15 }, // 15% at 100+  (docx: 5–15%, subject to costing)
    ],
    // pricing_status stays 'draft' — owner approves in admin UI when ready
  },
};

const changes = [];

async function go() {
  console.log('--- current state ---');
  const { data: mats, error: e1 } = await supabase
    .from('print_materials')
    .select('id,name,rate_per_gram,note,active')
    .order('sort_order');
  if (e1) { console.error('read materials failed:', e1.message); return; }
  console.log('materials:', JSON.stringify(mats));

  const { data: set, error: e2 } = await supabase
    .from('print_settings')
    .select('id,calculator_enabled,minimum_order,design_base_charge,bulk_tiers,pricing_status')
    .single();
  if (e2) { console.error('read settings failed:', e2.message); return; }
  console.log('settings:', JSON.stringify(set));

  // ---- 1. material rates (draft) ----
  for (const [id, t] of Object.entries(TARGETS.materials)) {
    const row = mats.find((m) => m.id === id);
    if (!row) { console.log(`skip ${id}: no material row`); continue; }
    if (row.rate_per_gram === t.ratePerGram && row.note === t.note) {
      console.log(`${id}: already ${t.ratePerGram}/g — no change`);
      continue;
    }
    const { error: eu } = await supabase.from('print_materials').update({ rate_per_gram: t.ratePerGram, note: t.note, updated_at: new Date().toISOString() }).eq('id', id);
    if (eu) { console.error(`update ${id} failed:`, eu.message); continue; }
    changes.push(`print_materials(${id}): rate_per_gram 0 → ${t.ratePerGram}, note updated (DRAFT)`);
    console.log(`${id}: rate_per_gram → ${t.ratePerGram} (DRAFT)`);
  }

  // ---- 2. settings: minimum_order + bulk_tiers (draft) ----
  const minChanged = set.minimum_order !== TARGETS.settings.minimumOrder;
  const tiersChanged = JSON.stringify(set.bulk_tiers) !== JSON.stringify(TARGETS.settings.bulkTiers);

  if (minChanged || tiersChanged) {
    const update = {};
    if (minChanged) update.minimum_order = TARGETS.settings.minimumOrder;
    if (tiersChanged) update.bulk_tiers = TARGETS.settings.bulkTiers;
    update.updated_at = new Date().toISOString();
    const { error: eu } = await supabase.from('print_settings').update(update).eq('id', 1);
    if (eu) { console.error('update settings failed:', eu.message); }
    if (minChanged) changes.push(`print_settings.minimum_order: 300 → 350 (DRAFT)`);
    if (tiersChanged) changes.push(`print_settings.bulk_tiers: [] → 5%/10%/15% at 10/50/100 (DRAFT, subject to costing)`);
    console.log(`settings: minimum_order → ${TARGETS.settings.minimumOrder}, bulk_tiers → ${JSON.stringify(TARGETS.settings.bulkTiers)} (DRAFT)`);
  } else {
    console.log('settings: minimum_order and bulk_tiers already match targets — no change');
  }

  // ---- 3. confirm pricing_status is still draft (do not approve) ----
  if (set.pricing_status !== 'draft') {
    const { error: eu } = await supabase.from('print_settings').update({ pricing_status: 'draft', updated_at: new Date().toISOString() }).eq('id', 1);
    if (eu) { console.error('reset pricing_status to draft failed:', eu.message); }
    else { changes.push('print_settings.pricing_status: reset to draft (do not publish)'); }
    console.log('pricing_status reset to draft — rates are NOT published');
  } else {
    console.log('pricing_status already draft — rates remain unpublished (correct)');
  }

  // ---- verify ----
  console.log('\n--- verify after update ---');
  const { data: vm, error: ve1 } = await supabase.from('print_materials').select('id,name,rate_per_gram,note').order('sort_order');
  console.log('materials now:', JSON.stringify(vm));
  const { data: vs, error: ve2 } = await supabase.from('print_settings').select('id,minimum_order,design_base_charge,bulk_tiers,pricing_status').single();
  console.log('settings now:', JSON.stringify(vs));

  console.log('\n=== CHANGES ===');
  if (changes.length === 0) console.log('No changes made (DB already matches docx draft targets).');
  changes.forEach((c) => console.log('-', c));
  console.log('\nNOTE: pricing_status stays "draft" — public page and app still show "rate on request".');
  console.log('Owner approves in Admin → 3D Products → Pricing when ready.');
}

go().catch((e) => console.error('FATAL:', e.message));
