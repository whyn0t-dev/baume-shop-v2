-- ═══════════════════════════════════════════════════════════════════════════
-- Baume — caisse & codes promo courts (novembre 2026)
--   1. Codes fidélité courts : FID-XXXXXX au lieu de FIDELITE + 32 caractères
--   2. sync_variant_inventory : aligne inventory_levels sur product_variants
--      (exigé par finalize_paid_order avant toute vente)
--
-- Migration idempotente : peut être relancée sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Codes fidélité courts ───────────────────────────────────────────────
-- Seul le format du code change : seuils, verrous, historique et
-- valeur de retour sont identiques à la version précédente.
-- Les anciens codes FIDELITE… restent valables.
CREATE OR REPLACE FUNCTION public.convert_loyalty_to_coupon(p_profile_id uuid, p_points integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_reward numeric;
    v_loyalty public.loyalty_points%ROWTYPE;
    v_code text;
    v_remaining integer;
    v_new_code jsonb;
    -- Sans 0/O, 1/I/L : lisible et facile à saisir.
    v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    v_bytes bytea;
    i integer;
BEGIN
    -- Accepter exclusivement les récompenses prévues.
    v_reward := CASE p_points
        WHEN 200 THEN 5
        WHEN 400 THEN 12
        WHEN 800 THEN 25
        ELSE NULL
    END;

    IF v_reward IS NULL THEN
        RAISE EXCEPTION 'Seuil de points invalide';
    END IF;

    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'Compte client requis';
    END IF;

    -- Même verrou que celui utilisé pour l'attribution
    -- des points : éviter les opérations simultanées.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_profile_id::text, 0)
    );

    -- Verrouiller le solde pendant toute la conversion.
    SELECT *
    INTO v_loyalty
    FROM public.loyalty_points
    WHERE profile_id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND OR v_loyalty.points < p_points THEN
        RAISE EXCEPTION 'Points insuffisants';
    END IF;

    -- Code court FID-XXXXXX (31^6 ≈ 887 millions de combinaisons).
    -- Les 6 premiers octets d'un UUID v4 sont aléatoires.
    -- La boucle vérifie l'unicité.
    LOOP
        v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
        v_code := 'FID-';
        FOR i IN 0..5 LOOP
            v_code := v_code || substr(
                v_alphabet,
                (get_byte(v_bytes, i) % length(v_alphabet)) + 1,
                1
            );
        END LOOP;

        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.discounts
            WHERE upper(code) = v_code
        );
    END LOOP;

    -- Créer le coupon personnel.
    INSERT INTO public.discounts (
        code,
        type,
        value,
        active,
        usage_limit,
        used_count,
        owner_profile_id,
        description,
        created_at
    )
    VALUES (
        v_code,
        'fixed',
        v_reward,
        true,
        1,
        0,
        p_profile_id,
        'Code fidélité — ' || p_points || ' points convertis',
        now()
    );

    v_new_code := jsonb_build_object(
        'code', v_code,
        'reward', v_reward,
        'points_spent', p_points,
        'created_at', now(),
        'used', false
    );

    -- Déduire les points et enregistrer le coupon
    -- dans une seule opération.
    UPDATE public.loyalty_points
    SET
        points = points - p_points,
        total_spent = total_spent + p_points,
        generated_codes =
            CASE
                WHEN jsonb_typeof(generated_codes) = 'array'
                THEN generated_codes
                ELSE '[]'::jsonb
            END || jsonb_build_array(v_new_code),
        updated_at = now()
    WHERE profile_id = p_profile_id
    RETURNING points INTO v_remaining;

    -- Enregistrer la dépense dans l'historique.
    INSERT INTO public.loyalty_transactions (
        id,
        profile_id,
        order_id,
        type,
        points,
        reason,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_profile_id,
        NULL,
        'spend',
        -p_points,
        'Conversion en code promo ' || v_code,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', v_code,
        'reward', v_reward,
        'points_remaining', v_remaining
    );
END;
$function$;


-- ── 2. Synchronisation du stock d'une variante ─────────────────────────────
-- finalize_paid_order exige, pour chaque variante vendue :
--   • une ligne inventory_items,
--   • exactement une ligne inventory_levels,
--   • inventory_levels.available_quantity = product_variants.stock.
-- Les ajustements manuels (scanner, caisse, fiche produit) ne modifient
-- que product_variants.stock : cette fonction recrée l'alignement en
-- prenant product_variants.stock comme référence.
CREATE OR REPLACE FUNCTION public.sync_variant_inventory(p_variant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_stock integer;
    v_item uuid;
    v_count integer;
    v_location uuid;
BEGIN
    -- Même ordre de verrouillage que finalize_paid_order
    -- (variante puis inventaire) : pas d'interblocage.
    SELECT stock
    INTO v_stock
    FROM public.product_variants
    WHERE id = p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante introuvable : %', p_variant_id;
    END IF;

    INSERT INTO public.inventory_items (variant_id, tracked)
    VALUES (p_variant_id, true)
    ON CONFLICT (variant_id) DO NOTHING;

    SELECT id
    INTO v_item
    FROM public.inventory_items
    WHERE variant_id = p_variant_id;

    SELECT count(*)
    INTO v_count
    FROM public.inventory_levels
    WHERE inventory_item_id = v_item;

    IF v_count = 0 THEN
        SELECT id
        INTO v_location
        FROM public.locations
        WHERE active IS NOT FALSE
        ORDER BY created_at, id
        LIMIT 1;

        IF v_location IS NULL THEN
            RAISE EXCEPTION 'Aucun emplacement de stock actif (table locations)';
        END IF;

        INSERT INTO public.inventory_levels (
            inventory_item_id, location_id,
            available_quantity, reserved_quantity, updated_at
        )
        VALUES (v_item, v_location, greatest(v_stock, 0), 0, now());

    ELSIF v_count = 1 THEN
        UPDATE public.inventory_levels
        SET available_quantity = v_stock,
            updated_at = now()
        WHERE inventory_item_id = v_item
          AND available_quantity IS DISTINCT FROM v_stock;

    ELSE
        RAISE EXCEPTION 'Emplacements de stock multiples : %', p_variant_id;
    END IF;

    RETURN v_stock;
END;
$function$;

-- Réservée au backend (service role).
REVOKE ALL ON FUNCTION public.sync_variant_inventory(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_variant_inventory(uuid) TO service_role;

-- Réalignement initial de toutes les variantes actives.
DO $$
DECLARE
    v record;
BEGIN
    FOR v IN SELECT id FROM public.product_variants WHERE active IS NOT FALSE ORDER BY id LOOP
        BEGIN
            PERFORM public.sync_variant_inventory(v.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Variante % non synchronisée : %', v.id, SQLERRM;
        END;
    END LOOP;
END;
$$;
