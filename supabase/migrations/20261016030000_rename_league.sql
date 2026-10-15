-- The app is now Slovenian and called "Ping Pong Liga".
-- Only replaces the old default name; a name an admin chose is kept.
alter table public.app_settings alter column league_name set default 'Ping Pong Liga';
update public.app_settings set league_name = 'Ping Pong Liga' where league_name = 'Table Tennis League';
