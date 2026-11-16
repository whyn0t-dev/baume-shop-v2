-- Relie les produits aux catégories « Shop par besoin ».
-- Le filtre cherche le slug du besoin dans products.needs : 8 besoins sur 12
-- n'avaient aucun produit. On AJOUTE des slugs (les étiquettes existantes sont conservées).
-- Répartition proposée pour le catalogue de démonstration : à ajuster ensuite
-- produit par produit dans l'admin (nouveau sélecteur « Besoins »).
with m(name, add) as (values
 ('Culotte Aube', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Culotte Épure', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Culotte Horizon', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Culotte Minuit', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Culotte Mouvement', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Culotte Onde', '["ados","maternite-post-partum","post-partum","peri-menopause"]'),
 ('Serviette lavable Rosée', '["ados","post-partum","maternite-post-partum"]'),
 ('Protège-slip Aurore', '["ados","peri-menopause","inconforts-intimes"]'),
 ('Bouillotte Nacre', '["endometriose"]'),
 ('Bouillotte Sillage', '["endometriose"]'),
 ('Coussin Pause', '["endometriose","future-maman","maternite-post-partum","post-partum"]'),
 ('Masque de repos Éclipse', '["spm","peri-menopause"]'),
 ('Infusion Pause Dorée', '["regles-douloureuses","spm","endometriose","peri-menopause"]'),
 ('Complexe Cycle — Concept', '["regles-cycle","spm","regles-douloureuses","endometriose"]'),
 ('Soin intime — Concept', '["inconforts-intimes","peri-menopause"]'),
 ('Gel de confort — Concept', '["sexualite","intimite","inconforts-intimes","peri-menopause"]'),
 ('Huile Sereine', '["future-maman","maternite-post-partum"]'),
 ('Baume Velours', '["future-maman","maternite-post-partum","post-partum"]'),
 ('Kimono Solstice', '["future-maman"]'),
 ('Pantalon Lento', '["future-maman"]')
)
update public.products p
set needs = (
      select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(p.needs, '[]'::jsonb) || m.add::jsonb) x
    ),
    updated_at = now()
from m
where coalesce(p.name, p.title) = m.name;

-- Contrôle : nombre de produits actifs par besoin (aucun ne doit être à 0).
select c.slug, c.name,
       (select count(*) from public.products p
         where p.status = 'active' and p.needs @> to_jsonb(array[c.slug])) as produits
from public.categories c
where c.kind = 'besoin'
order by produits, c.slug;
