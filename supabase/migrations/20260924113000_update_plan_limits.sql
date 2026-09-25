update public.plans
set label = 'Fileo Essentiel',
    max_active_members = 1,
    limits_json = jsonb_build_object(
      'members', 1,
      'storageMb', coalesce((limits_json->>'storageMb')::integer, 2000),
      'orders', null,
      'templates', 5,
      'notifications', false
    )
where code = 'essentiel'
  and status = 'active';

update public.plans
set label = 'Fileo Pro',
    max_active_members = 5,
    limits_json = jsonb_build_object(
      'members', 5,
      'storageMb', coalesce((limits_json->>'storageMb')::integer, 5000),
      'orders', null,
      'templates', 10,
      'notifications', true
    )
where code in ('pro', 'mensuel')
  and status = 'active';

update public.plans
set label = 'Fileo Plus',
    max_active_members = 10,
    limits_json = jsonb_build_object(
      'members', 10,
      'storageMb', coalesce((limits_json->>'storageMb')::integer, 12000),
      'orders', null,
      'templates', 25,
      'notifications', true
    )
where code in ('atelier_plus', 'plus')
  and status = 'active';
