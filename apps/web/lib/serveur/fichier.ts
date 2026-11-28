/** Réponse « fichier » (PDF, Word…) produite par notre serveur. */
export function fichier(
  octets: Uint8Array,
  type: string,
  nom: string,
  disposition: "inline" | "attachment",
): Response {
  return new Response(new Uint8Array(octets), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename="${nom}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
