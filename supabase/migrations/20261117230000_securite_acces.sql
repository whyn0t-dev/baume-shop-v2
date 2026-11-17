-- ════════════════════════════════════════════════════════════════════
-- Baume — Durcissement de la sécurité (17 novembre 2026)
--
-- Principe : rien de ce qu'utilisent le site, l'administration, la caisse
-- et les apps ne change. Le serveur et les fonctions Supabase passent par la
-- clé « service_role », qui n'est pas concernée par ces règles.
-- On ferme uniquement les accès directs à la base que personne n'utilise,
-- mais qu'un attaquant pourrait exploiter avec la clé publique du site.
--
-- Le script est rejouable sans risque (IF EXISTS / OR REPLACE).
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Le rôle « admin » ne peut plus être modifié par une cliente ─────────
-- Avant : la règle « User update own profile » permettait à chaque compte
-- de passer sa propre colonne role à 'admin'.
-- Désormais : seuls le serveur (service_role), la base elle-même et un
-- administrateur déjà en place peuvent changer un rôle.
-- SECURITY INVOKER volontaire : current_user = le rôle réel de l'appelant.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
	if tg_op = 'INSERT' then
		if new.role is distinct from 'customer'
			and current_user not in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
			new.role := 'customer';
		end if;
		return new;
	end if;

	if new.role is distinct from old.role then
		if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
			return new;
		end if;
		if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
			return new;
		end if;
		raise exception 'Modification du rôle non autorisée' using errcode = '42501';
	end if;

	-- L'identifiant d'un profil ne change jamais.
	if new.id is distinct from old.id then
		raise exception 'Modification non autorisée' using errcode = '42501';
	end if;

	return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
	before insert or update on public.profiles
	for each row execute function public.protect_profile_role();

revoke execute on function public.protect_profile_role() from public, anon, authenticated;

-- ── 2. Plus d'écriture directe avec la clé publique ───────────────────────
-- Ces créations passent toutes par le serveur (service_role) : les règles
-- publiques ne servaient qu'à contourner ses contrôles (prix, statut, quotas).

-- Commandes : une cliente pouvait créer elle-même une commande « payée ».
drop policy if exists "User create order" on public.orders;

-- Réservations d'ateliers : création directe sans paiement ni contrôle des places.
drop policy if exists "Anyone can create booking" on public.workshop_bookings;

-- Newsletter : inscriptions en masse sans passer par la limite du serveur.
drop policy if exists "Public insert newsletter" on public.newsletter_subscribers;

-- Quiz : insertion directe de résultats.
drop policy if exists "quiz_results_insert_all" on public.quiz_results;

-- ── 3. Codes promo : plus de liste publique ──────────────────────────────
-- Avant : n'importe qui pouvait lister tous les codes actifs (bons fidélité
-- compris). Le serveur valide les codes lui-même (service_role) : la
-- vérification d'un code dans le panier fonctionne exactement comme avant.
drop policy if exists "Public read discounts" on public.discounts;
-- La règle « Admin manage discounts » (lecture et écriture admin) reste en place.

-- ── 4. Fonctions : chemin de recherche figé (recommandation Supabase) ─────
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.keepalive_ping() set search_path = public, extensions, pg_temp;
alter function public.sync_product_stock() set search_path = public, extensions, pg_temp;
alter function public.set_order_public_reference() set search_path = public, extensions, pg_temp;
alter function public.pos_sessions_lock_closed() set search_path = public, extensions, pg_temp;
alter function public.pos_assert_session_open() set search_path = public, extensions, pg_temp;

-- Fonctions internes : appelées par la base (déclencheurs, tâches planifiées)
-- ou par le serveur, jamais directement par un visiteur.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_daily_inventory_snapshot() from public, anon, authenticated;
revoke execute on function public.keepalive_ping() from public, anon, authenticated;
grant execute on function public.keepalive_ping() to service_role;
grant execute on function public.record_daily_inventory_snapshot() to service_role;

commit;

-- ── Vérification (facultative) ───────────────────────────────────────────
-- select tablename, policyname from pg_policies
--  where policyname in ('User create order','Anyone can create booking',
--    'Public insert newsletter','quiz_results_insert_all','Public read discounts');
-- → doit renvoyer 0 ligne.
