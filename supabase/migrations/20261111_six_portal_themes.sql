-- MECATREX 20261111: expand the saved portal theme palette without resetting user choices.
-- Apply after 20261110. Safe to run again.
alter table public.profiles drop constraint if exists profiles_accent_color_valid;
alter table public.profiles add constraint profiles_accent_color_valid
  check (accent_color in ('blue','teal','violet','slate','rose','amber'));
