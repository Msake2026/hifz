// Configuration des comptes (Supabase). Ces deux valeurs sont PUBLIQUES par conception :
// la sécurité repose sur les règles de la base (supabase/schema.sql), pas sur le secret de cette clé.
// Tant qu'elles sont vides, la page « Compte » indique que les comptes ne sont pas encore activés.
// N'écris JAMAIS ici la clé « service_role » (secrète).
window.HIFZ_CLOUD = {
  url: 'https://rdtfpinikhqxbufnoqvm.supabase.co',
  anonKey: 'sb_publishable_EmfYn0tBDUM-QgHfNSCc5A_qwU2IVDw',   // clé « publishable » (publique par conception)
  vapidPublicKey: 'BGSyzd0fSnxyLCKcsbtliLDWAeWZb1A38k-bY9yLWDq04L_Ki16sCALo8ldhM1FhbSxB75rxRnVv0WFO7XWvBxM' // clé PUBLIQUE des notifications (la clé privée est dans un secret Supabase)
};

// Mentions affichées dans la page « Confidentialité et conditions ».
window.HIFZ_LEGAL = {
  contact: 'hifz.app.contact@gmail.com',  // adresse pour les demandes sur les données
  region: 'Londres (eu-west-2)'                        // région du projet Supabase (Project Settings → General), ex. « Paris (eu-west-3) »
};
