-- ═══════════════════════════════════════════════════════════════════════════
-- Baume — demandes cliente (novembre 2026)
--   1. Parrainage limité (5/an) + anti-abus
--   2. Informations produit « L'essentiel »
--   3. CTR des bannières promotionnelles
--   4. Fiche client (notes, étiquettes, désinscription marketing)
--   5. Email J+30 avec code promo 5 % / 10 % (suivi des envois)
--   6. Offres personnalisées automatiques (suivi des envois)
--   7. Tâches planifiées pg_cron (J+30, offres, rapport mensuel, expiration)
--
-- Migration idempotente : peut être relancée sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Parrainage ──────────────────────────────────────────────────────────
alter table public.referrals
  add column if not exists referee_email_normalized text,
  add column if not exists referee_profile_id uuid,
  add column if not exists referee_ip text,
  add column if not exists rejection_reason text;

-- Statuts : pending · completed · capped (limite annuelle) · reversed
--           (commande remboursée) · rejected (non éligible)
update public.referrals
   set referee_email_normalized = lower(trim(referee_email))
 where referee_email_normalized is null and referee_email is not null;

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at);
create index if not exists referrals_referee_norm_idx
  on public.referrals (referee_email_normalized);
create index if not exists referrals_referee_ip_idx
  on public.referrals (referee_ip, created_at);
create index if not exists referrals_order_idx
  on public.referrals (order_id);

-- ── 2. Produits : bloc « L'essentiel » ─────────────────────────────────────
alter table public.products
  add column if not exists highlights jsonb not null default '[]'::jsonb,
  add column if not exists specs jsonb not null default '[]'::jsonb,
  add column if not exists care_instructions text;

-- ── 3. CTR bannières ───────────────────────────────────────────────────────
create table if not exists public.banner_events (
  id            uuid primary key default gen_random_uuid(),
  banner_id     text not null,
  banner_label  text,
  event_type    text not null check (event_type in ('view', 'click')),
  page          text,
  target        text,
  session_id    text,
  profile_id    uuid,
  created_at    timestamptz not null default now()
);

create index if not exists banner_events_banner_created_idx
  on public.banner_events (banner_id, created_at);
create index if not exists banner_events_created_idx
  on public.banner_events (created_at);

alter table public.banner_events enable row level security;
-- Aucune politique publique : seul le backend (service role) lit/écrit.

-- Agrégat CTR par bannière depuis une date donnée.
-- Affichages = visiteurs uniques (session) ; clics = total des clics.
create or replace function public.banner_ctr_stats(p_since timestamptz)
returns table (
  banner_id        text,
  banner_label     text,
  views            bigint,
  unique_viewers   bigint,
  clicks           bigint,
  unique_clickers  bigint,
  last_event_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.banner_id,
    (array_agg(e.banner_label order by e.created_at desc))[1] as banner_label,
    count(*) filter (where e.event_type = 'view')                              as views,
    count(distinct coalesce(e.session_id, e.id::text)) filter (where e.event_type = 'view')  as unique_viewers,
    count(*) filter (where e.event_type = 'click')                             as clicks,
    count(distinct coalesce(e.session_id, e.id::text)) filter (where e.event_type = 'click') as unique_clickers,
    max(e.created_at)                                                          as last_event_at
  from public.banner_events e
  where e.created_at >= p_since
  group by e.banner_id;
$$;

revoke all on function public.banner_ctr_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.banner_ctr_stats(timestamptz) to service_role;

-- ── 4. Fiche client ────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists admin_notes text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists marketing_opt_out boolean not null default false,
  add column if not exists updated_at timestamptz;

-- Codes promo : campagne d'origine (post_purchase_30d, personalized_*, …)
alter table public.discounts
  add column if not exists campaign text;
create index if not exists discounts_owner_idx on public.discounts (owner_profile_id);
create index if not exists discounts_campaign_ends_idx on public.discounts (campaign, ends_at);

-- ── 5. Email J+30 ──────────────────────────────────────────────────────────
create table if not exists public.customer_followups (
  id                uuid primary key default gen_random_uuid(),
  order_id          text not null,
  customer_email    text not null,
  profile_id        uuid,
  kind              text not null default 'post_purchase_30d',
  discount_id       uuid,
  discount_code     text,
  discount_percent  numeric,
  expires_at        timestamptz,
  status            text not null default 'sent',  -- sent · failed · skipped_recent · skipped_opt_out
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique (order_id, kind)
);
create index if not exists customer_followups_email_idx
  on public.customer_followups (customer_email, created_at);
alter table public.customer_followups enable row level security;

-- ── 6. Offres personnalisées ───────────────────────────────────────────────
create table if not exists public.customer_offers (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid,
  customer_id       uuid,
  email             text not null,
  rule              text not null,   -- replenish · winback · loyal · manual
  category          text,
  product_ids       text[] default '{}',
  discount_id       uuid,
  discount_code     text,
  discount_percent  numeric,
  expires_at        timestamptz,
  status            text not null default 'sent',
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists customer_offers_profile_idx
  on public.customer_offers (profile_id, created_at);
alter table public.customer_offers enable row level security;

-- ── 7. Expiration des codes automatiques ───────────────────────────────────
create or replace function public.deactivate_expired_campaign_discounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.discounts
     set active = false
   where active = true
     and campaign is not null
     and ends_at is not null
     and ends_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.deactivate_expired_campaign_discounts() from public, anon, authenticated;

-- ── 8. Tâches planifiées (pg_cron + pg_net) ────────────────────────────────
-- Pré-requis (une seule fois, dans Supabase > SQL Editor) :
--   select vault.create_secret('https://<ref>.supabase.co', 'baume_project_url');
--   select vault.create_secret('<BAUME_INTERNAL_TOKEN>',     'baume_internal_token');
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.baume_call_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url   text;
  v_token text;
begin
  select decrypted_secret into v_url   from vault.decrypted_secrets where name = 'baume_project_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'baume_internal_token';
  if v_url is null or v_token is null then
    raise exception 'Secrets vault baume_project_url / baume_internal_token manquants';
  end if;
  return net.http_post(
    url     := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Baume-Internal-Token', v_token
    ),
    body    := p_body,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.baume_call_function(text, jsonb) from public, anon, authenticated;

-- (re)programmation idempotente
do $$
begin
  perform cron.unschedule(jobname) from cron.job
   where jobname in (
     'baume-post-purchase-offer',
     'baume-personalized-offers',
     'baume-monthly-report',
     'baume-expire-campaign-discounts'
   );
end $$;

-- Tous les jours à 09:15 (heure de Genève, hiver = 08:15 UTC)
select cron.schedule(
  'baume-post-purchase-offer',
  '15 8 * * *',
  $$ select public.baume_call_function('send-post-purchase-offer', '{}'::jsonb); $$
);

-- Chaque lundi à 10:20 (heure de Genève, hiver = 09:20 UTC)
select cron.schedule(
  'baume-personalized-offers',
  '20 9 * * 1',
  $$ select public.baume_call_function('send-personalized-offers', '{"mode":"auto"}'::jsonb); $$
);

-- Le 1er de chaque mois à 08:05 (heure de Genève, hiver = 07:05 UTC)
select cron.schedule(
  'baume-monthly-report',
  '5 7 1 * *',
  $$ select public.baume_call_function('send-monthly-report', '{"trigger":"cron"}'::jsonb); $$
);

-- Toutes les nuits à 02:00 UTC : désactiver les codes de campagne expirés
select cron.schedule(
  'baume-expire-campaign-discounts',
  '0 2 * * *',
  $$ select public.deactivate_expired_campaign_discounts(); $$
);
