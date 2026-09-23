-- Preserve the translated FAQ preview copy as independently editable content.
-- A shared slug identifies the same question across languages.
with translations(slug, locale, title, body) as (
  values
    ('essai-gratuit', 'en', 'How does the trial work?', 'The trial lasts 14 days from the creation of your workshop. No payment method is required.'),
    ('essai-gratuit', 'lg', 'Komeka esalaka ndenge nini?', 'Okoki komeka mikolo 14 kobanda na mokolo atelier efungwami. Esɛngi moyen ya kofuta te.'),
    ('sans-reseau', 'en', 'Can I work offline?', 'The mobile app keeps essential operations available offline and synchronizes them when the network returns.'),
    ('sans-reseau', 'lg', 'Nakoki kosala sans réseau?', 'Application mobile ebombaka misala ya ntina mpe etindaka yango ntango réseau ezongi.'),
    ('client-compte', 'en', 'Do my customers need an account?', 'No. Your customers do not need an account or an app.'),
    ('client-compte', 'lg', 'Bakiliya basengeli na compte?', 'Te. Kiliya asengeli na compte to application te.')
)
insert into public.contents (kind, slug, locale, title, body, sort_order, status, published_at)
select 'faq'::public.content_kind, source.slug, translations.locale, translations.title,
  translations.body, source.sort_order, source.status,
  case when source.status = 'published' then now() else null end
from translations
join public.contents source on source.kind = 'faq' and source.locale = 'fr'
  and source.slug = translations.slug
on conflict (kind, slug, locale) do nothing;

update public.contents
set body = 'Les données de l''atelier sont stockées dans PostgreSQL sur Supabase.',
    row_version = row_version + 1
where kind = 'faq' and slug = 'donnees-securisees' and locale = 'fr'
  and body = 'Les donnees applicatives sont stockees dans MongoDB Atlas, avec une separation par atelier et des index d''integrite.';
