-- ════════════════════════════════════════════════════════════════════
-- Baume — Double authentification (code à 6 chiffres)
--
-- La double authentification est facultative. Pour un compte qui l'a activée,
-- une session ouverte avec le seul mot de passe (niveau « aal1 ») ne donne accès
-- à aucune donnée de la base : il faut la session validée par le code (« aal2 »).
--
-- Sans effet pour le site, les apps et le serveur : le serveur et les fonctions
-- Supabase utilisent la clé service_role, qui n'est pas soumise à ces règles.
-- Rejouable sans risque.
-- ════════════════════════════════════════════════════════════════════

begin;

-- Vrai si la session est au bon niveau pour ce compte.
-- SECURITY DEFINER : les comptes connectés ne peuvent pas lire auth.mfa_factors
-- eux-mêmes ; la fonction ne renvoie qu'un oui/non sur leur propre compte.
create or replace function public.mfa_session_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
		or not exists (
			select 1 from auth.mfa_factors f
			where f.user_id = auth.uid() and f.status = 'verified'
		);
$$;

revoke execute on function public.mfa_session_ok() from public, anon;
grant execute on function public.mfa_session_ok() to authenticated, service_role;

-- Règle « restrictive » ajoutée à toutes les tables protégées par RLS :
-- elle s'ajoute aux règles existantes (elle ne donne aucun accès, elle en retire).
do $$
declare
	t record;
begin
	for t in
		select c.relname
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
	loop
		execute format('drop policy if exists "mfa_session_required" on public.%I', t.relname);
		execute format(
			'create policy "mfa_session_required" on public.%I as restrictive for all to authenticated using (public.mfa_session_ok()) with check (public.mfa_session_ok())',
			t.relname
		);
	end loop;
end $$;

commit;

-- Vérification : select count(*) from pg_policies where policyname = 'mfa_session_required';
-- → doit renvoyer le nombre de tables (60 au 17 novembre 2026).
