alter table public.workshops
  add column if not exists measurement_units_json jsonb not null default '["cm","mm","m"]'::jsonb;

alter table public.workshops
  drop constraint if exists workshops_measurement_units_json_array;

alter table public.workshops
  add constraint workshops_measurement_units_json_array
  check (jsonb_typeof(measurement_units_json) = 'array');
