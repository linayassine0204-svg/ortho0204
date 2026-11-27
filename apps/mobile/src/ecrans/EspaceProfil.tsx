import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { t, type ElementEnvoye } from "@app/shared";
import type { EnregistreurVoix } from "../audio/types";
import { BarreOnglets } from "../composants/BarreOnglets";
import { Bouton } from "../composants/Bouton";
import type { ChargementProgramme } from "../donnees/programme";
import type { AudioLocal, FaitLocal, ServiceRealisations } from "../donnees/realisations";
import { ongletActif, ongletsVisibles, type Onglet } from "../navigation/onglets";
import type { Profil } from "../session/types";
import { palette } from "../theme";
import { EcranAujourdhui } from "./EcranAujourdhui";
import { EcranExercice } from "./EcranExercice";
import { EcranVide } from "./EcranVide";

interface Props {
  profil: Profil;
  chargerProgramme: () => Promise<ChargementProgramme>;
  /** Parent : revenir à « Qui fait les exercices ? ». Absent pour un patient adulte. */
  onChangerProfil?: () => void;
  onDeconnexion: () => void;
  maintenant?: () => Date;
  realisations?: ServiceRealisations;
  enregistreur?: EnregistreurVoix;
  supprimerVoix?: (audio: AudioLocal) => void;
  /** Donne l'accord « enregistrement de la voix » (serveur). */
  donnerAccordAudio?: () => Promise<void>;
  /** Change après chaque synchronisation : rafraîchit « en attente ». */
  versionSynchro?: number;
}

const enregistreurAbsent: EnregistreurVoix = {
  enCours: false,
  dureeMs: 0,
  demarrer: async () => false,
  arreter: async () => null,
};

/** Espace d'un patient : contenu de l'onglet choisi et barre d'onglets en bas. */
export function EspaceProfil({
  profil,
  chargerProgramme,
  onChangerProfil,
  onDeconnexion,
  maintenant,
  realisations,
  enregistreur = enregistreurAbsent,
  supprimerVoix = () => undefined,
  donnerAccordAudio = async () => undefined,
  versionSynchro = 0,
}: Props) {
  const onglets = ongletsVisibles(profil);
  const [choix, setChoix] = useState<Onglet>("aujourdhui");
  const actif = ongletActif(choix, onglets);
  const [ouvert, setOuvert] = useState<{ exercice: ElementEnvoye; suite: ElementEnvoye[] } | null>(
    null,
  );
  const [accordAudio, setAccordAudio] = useState(profil.accordAudio);
  const [faits, setFaits] = useState<FaitLocal[]>([]);
  const [enAttente, setEnAttente] = useState(0);

  const rafraichir = useCallback(async () => {
    if (!realisations) return;
    const [f, n] = await Promise.all([
      realisations.faits(profil.patientId),
      realisations.enAttente(),
    ]);
    setFaits(f);
    setEnAttente(n);
  }, [realisations, profil.patientId]);

  useEffect(() => {
    if (!realisations) return;
    let actif = true;
    Promise.all([realisations.faits(profil.patientId), realisations.enAttente()]).then(([f, n]) => {
      if (!actif) return;
      setFaits(f);
      setEnAttente(n);
    });
    return () => {
      actif = false;
    };
  }, [realisations, profil.patientId, versionSynchro]);

  // Un exercice ouvert occupe tout l'écran : un seul à la fois, sans la barre d'onglets.
  if (ouvert && realisations) {
    const { exercice, suite } = ouvert;
    return (
      <View style={styles.plein}>
        <EcranExercice
          key={exercice.elementId}
          exercice={exercice}
          modeEnfant={profil.modeEnfant}
          accordAudio={accordAudio}
          onDonnerAccord={async () => {
            await donnerAccordAudio();
            setAccordAudio(true);
          }}
          enregistreur={enregistreur}
          supprimerVoix={supprimerVoix}
          encoreDesExercices={suite.length > 0}
          onEnregistrer={async (r) => {
            const issue = await realisations.enregistrer({
              patientId: profil.patientId,
              elementId: exercice.elementId,
              ...r,
            });
            await rafraichir();
            return issue;
          }}
          onFermer={(termine) => {
            // Mode enfant : après un exercice fait, on enchaîne sur le suivant, s'il y en a un.
            const [suivant, ...reste] = suite;
            setOuvert(
              termine && profil.modeEnfant && suivant ? { exercice: suivant, suite: reste } : null,
            );
          }}
        />
      </View>
    );
  }

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
            faits={faits}
            enAttente={enAttente}
            {...(realisations
              ? { onOuvrir: (exercice, suite) => setOuvert({ exercice, suite }) }
              : {})}
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
