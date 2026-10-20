// Configuration des comptes (Supabase). Ces deux valeurs sont PUBLIQUES par conception :
// la sécurité repose sur les règles de la base (supabase/schema.sql), pas sur le secret de cette clé.
// Tant qu'elles sont vides, la page « Compte » indique que les comptes ne sont pas encore activés.
// N'écris JAMAIS ici la clé « service_role » (secrète).
window.HIFZ_CLOUD = {
  url: 'https://rdtfpinikhqxbufnoqvm.supabase.co',
  anonKey: 'sb_publishable_EmfYn0tBDUM-QgHfNSCc5A_qwU2IVDw'   // clé « publishable » (publique par conception)
};
