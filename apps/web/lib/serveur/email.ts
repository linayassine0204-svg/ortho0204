// Envoi des e-mails (invitations). Aucun prestataire n'est branché en version 1 :
// le futur prestataire devra être hébergé en France et ne recevoir que l'adresse
// et le lien (jamais le prénom du patient ni une donnée de santé).

export interface Expediteur {
  envoyerInvitation(destinataire: string, lien: string): Promise<{ envoye: boolean }>;
}

/** Expéditeur inactif : n'envoie rien et n'écrit rien dans les journaux. */
export const expediteurInactif: Expediteur = {
  async envoyerInvitation() {
    return { envoye: false };
  },
};

export function expediteur(): Expediteur {
  return expediteurInactif;
}
