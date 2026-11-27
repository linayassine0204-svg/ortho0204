// Adresse de l'API (apps/web). Valeur publique, pas un secret : EXPO_PUBLIC_API_URL.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api").replace(
  /\/+$/,
  "",
);
