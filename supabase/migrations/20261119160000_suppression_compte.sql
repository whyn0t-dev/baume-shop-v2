-- Suppression de compte demandée par la cliente depuis l'app ou le site (exigence Apple 5.1.1).
-- Efface ou anonymise les données personnelles liées au compte. Les commandes sont conservées
-- (obligation comptable), mais ne sont plus rattachées à un compte.
-- Appelée uniquement par le backend (clé service) juste avant la suppression de l'utilisateur dans Auth.
create or replace function public.delete_customer_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_email text;
  v_customers uuid[];
begin
  select role into v_role from public.profiles where id = p_user;
  if v_role is distinct from 'customer' then
    raise exception 'not_customer' using errcode = 'P0001';
  end if;

  select lower(email) into v_email from auth.users where id = p_user;

  select coalesce(array_agg(id), '{}') into v_customers
  from public.customers
  where profile_id = p_user or (v_email is not null and lower(email) = v_email);

  -- Messagerie, quiz, newsletter : supprimés
  delete from public.conversations where profile_id = p_user or customer_id = any(v_customers);
  delete from public.quiz_results where profile_id = p_user or (v_email is not null and lower(email) = v_email);
  delete from public.newsletter_subscribers where v_email is not null and lower(email) = v_email;

  -- Adresses et paniers enregistrés : supprimés
  delete from public.addresses where customer_id = any(v_customers);
  delete from public.carts where customer_id = any(v_customers);

  -- Fiche client : anonymisée (elle reste liée aux commandes conservées)
  update public.customers
     set profile_id = null,
         email = 'supprime-' || left(id::text, 8) || '@deleted.invalid',
         first_name = null, last_name = null, phone = null, admin_notes = null,
         marketing_opt_out = true, updated_at = now()
   where id = any(v_customers);

  -- Liens sans suppression automatique
  update public.discounts set owner_profile_id = null,
         active = case when coalesce(used_count, 0) = 0 then false else active end
   where owner_profile_id = p_user;
  update public.discount_reservations set profile_id = null where profile_id = p_user;
  update public.conversations set locked_by = null where locked_by = p_user;

  return jsonb_build_object('customers_anonymized', coalesce(array_length(v_customers, 1), 0));
end;
$$;

revoke all on function public.delete_customer_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_customer_account(uuid) to service_role;
