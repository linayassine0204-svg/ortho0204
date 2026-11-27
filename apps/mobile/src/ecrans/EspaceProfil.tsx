import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "@app/shared";
import { BarreOnglets } from "../composants/BarreOnglets";
import { Bouton } from "../composants/Bouton";
import type { ChargementProgramme } from "../donnees/programme";
import { ongletActif, ongletsVisibles, type Onglet } from "../navigation/onglets";
import type { Profil } from "../session/types";
import { palette } from "../theme";
import { EcranAujourdhui } from "./EcranAujourdhui";
import { EcranVide } from "./EcranVide";

interface Props {
  profil: Profil;
  chargerProgramme: () => Promise<ChargementProgramme>;
  /** Parent : revenir à « Qui fait les exercices ? ». Absent pour un patient adulte. */
  onChangerProfil?: () => void;
  onDeconnexion: () => void;
  maintenant?: () => Date;
}

/** Espace d'un patient : contenu de l'onglet choisi et barre d'onglets en bas. */
export function EspaceProfil({
  profil,
  chargerProgramme,
  onChangerProfil,
  onDeconnexion,
  maintenant,
}: Props) {
  const onglets = ongletsVisibles(profil);
  const [choix, setChoix] = useState<Onglet>("aujourdhui");
  const actif = ongletActif(choix, onglets);

  return (
    <View style={styles.plein}>
      <View style={styles.haut}>
        {onChangerProfil ? (
          <Bouton
            libelle={t("mobile.profil.changer")}
            onPress={onChangerProfil}
            variante="discret"
          />
        ) : (
          <Bouton
            libelle={t("mobile.commun.deconnexion")}
            onPress={onDeconnexion}
            variante="discret"
          />
        )}
      </View>
      <View style={styles.plein}>
        {actif === "aujourdhui" ? (
          <EcranAujourdhui
            profil={profil}
            charger={chargerProgramme}
            {...(maintenant ? { maintenant } : {})}
          />
        ) : actif === "conseils" ? (
          <EcranVide titre={t("mobile.conseils.titre")} texte={t("mobile.conseils.vide")} />
        ) : (
          // Messagerie : tâche 11. L'onglet n'existe que si elle est activée.
          <EcranVide titre={t("mobile.messages.titre")} texte={t("mobile.messages.bientot")} />
        )}
      </View>
      <BarreOnglets onglets={onglets} actif={actif} onChoisir={setChoix} />
    </View>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
  haut: { alignItems: "flex-end", paddingHorizontal: 12 },
});
