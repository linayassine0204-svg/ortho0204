/** Message d'erreur ou de succès, annoncé aux lecteurs d'écran. */
export function Message({ type, texte }: { type: "erreur" | "succes"; texte: string | null }) {
  if (!texte) return null;
  return (
    <p className={`message message-${type}`} role={type === "erreur" ? "alert" : "status"}>
      {texte}
    </p>
  );
}
