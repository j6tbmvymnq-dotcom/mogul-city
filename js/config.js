/* Mogul City – Einstellungen.
   Cloud-Spielstand (Supabase): URL und "anon public"-Schlüssel aus dem Supabase-Projekt eintragen
   (Project Settings > API). Leer = nur lokal speichern. Einrichtung: docs/CLOUD.md */
window.MC_CONFIG = {
  cloud: {
    url: 'https://xqapuyvxgzgktdmkoohu.supabase.co',
    key: 'sb_publishable_BTTvRlcVRlysdsXZlvTGlg_3ODdC7L2'   // öffentlicher Schlüssel; Zugriff nur über get_save/put_save
  }
};
