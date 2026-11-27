import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { t } from "@app/shared";
import { ErreurApi } from "./api/client";
import { messageErreur } from "./api/erreurs";
import { dependancesTelephone, type Dependances } from "./dependances";
import { chargerProgramme } from "./donnees/programme";
import { chargerInfosSession, type InfosSession } from "./donnees/session";
import { EcranAccueil } from "./ecrans/EcranAccueil";
import { EcranChoixProfil } from "./ecrans/EcranChoixProfil";
import { EcranConnexion } from "./ecrans/EcranConnexion";
import { EcranInvitation } from "./ecrans/EcranInvitation";
import { EspaceProfil } from "./ecrans/EspaceProfil";
import { destinationApresConnexion } from "./session/profils";
import type { Profil } from "./session/types";
import { palette } from "./theme";

type Etat =
  | { ecran: "demarrage" }
  | { ecran: "accueil"; message?: string }
  | { ecran: "invitation"; lien?: string }
  | { ecran: "connexion"; information?: string }
  | { ecran: "connecte"; infos: InfosSession; profil: Profil | null };

/** Un lien d'invitation ouvre directement l'écran d'activation. */
const estLienInvitation = (url: string | null | undefined): url is string =>
  !!url && /invitation\/?#/.test(url);

export default function App({ dependances }: { dependances?: Dependances }) {
  const deps = useMemo(() => dependances ?? dependancesTelephone(), [dependances]);
  const { client, cache, maintenant } = deps;
  const [etat, setEtat] = useState<Etat>({ ecran: "demarrage" });

  const quitter = useCallback(
    async (message?: string) => {
      await client.deconnexion();
      await cache.toutEffacer();
      setEtat(message ? { ecran: "accueil", message } : { ecran: "accueil" });
    },
    [client, cache],
  );

  const ouvrirSession = useCallback(async () => {
    const infos = await chargerInfosSession(client, cache);
    const destination = destinationApresConnexion(infos.utilisateur.role, infos.patients);
    switch (destination.ecran) {
      case "reserveeFamilles":
        await quitter(t("mobile.connexion.reserveeFamilles"));
        return;
      case "aucunDossier":
        await quitter(t("web.famille.aucun"));
        return;
      case "programme":
        setEtat({ ecran: "connecte", infos, profil: destination.profil });
        return;
      case "choixProfil":
        setEtat({ ecran: "connecte", infos, profil: null });
    }
  }, [client, cache, quitter]);

  // Démarrage : session existante (jetons dans le coffre-fort) ou écran d'accueil.
  useEffect(() => {
    let actif = true;
    (async () => {
      const lien = await Linking.getInitialURL().catch(() => null);
      if (!actif) return;
      if (estLienInvitation(lien)) {
        setEtat({ ecran: "invitation", lien });
        return;
      }
      if (!(await client.estConnecte())) {
        setEtat({ ecran: "accueil" });
        return;
      }
      try {
        await ouvrirSession();
      } catch (e) {
        if (!actif) return;
        if (e instanceof ErreurApi && e.status === 401) await quitter(t("erreurs.nonConnecte"));
        else setEtat({ ecran: "accueil", message: messageErreur(e) });
      }
    })();
    const abonnement = Linking.addEventListener("url", ({ url }) => {
      if (estLienInvitation(url)) setEtat({ ecran: "invitation", lien: url });
    });
    return () => {
      actif = false;
      abonnement.remove();
    };
  }, [client, ouvrirSession, quitter]);

  const profil = etat.ecran === "connecte" ? etat.profil : null;
  const charger = useCallback(async () => {
    if (!profil) throw new Error("profil absent");
    try {
      return await chargerProgramme(client, cache, profil.patientId, maintenant());
    } catch (e) {
      if (e instanceof ErreurApi && e.status === 401) await quitter(t("erreurs.nonConnecte"));
      throw e;
    }
  }, [client, cache, maintenant, profil, quitter]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.plein}>
        {contenu()}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );

  function contenu() {
    switch (etat.ecran) {
      case "demarrage":
        return null;
      case "accueil":
        return (
          <EcranAccueil
            message={etat.message ?? null}
            onInvitation={() => setEtat({ ecran: "invitation" })}
            onConnexion={() => setEtat({ ecran: "connexion" })}
          />
        );
      case "invitation":
        return (
          <EcranInvitation
            {...(etat.lien ? { lienInitial: etat.lien } : {})}
            onActiver={(donnees) => client.accepterInvitation(donnees)}
            onSucces={() =>
              setEtat({ ecran: "connexion", information: t("mobile.invitation.succes") })
            }
            onRetour={() => setEtat({ ecran: "accueil" })}
          />
        );
      case "connexion":
        return (
          <EcranConnexion
            information={etat.information ?? null}
            onConnexion={async (email, motDePasse) => {
              await client.connexion(email, motDePasse);
              await ouvrirSession();
            }}
            onRetour={() => setEtat({ ecran: "accueil" })}
          />
        );
      case "connecte": {
        const { infos } = etat;
        if (!etat.profil) {
          return (
            <EcranChoixProfil
              patients={infos.patients}
              onChoisir={(p) => setEtat({ ecran: "connecte", infos, profil: p })}
              onDeconnexion={() => void quitter()}
            />
          );
        }
        return (
          <EspaceProfil
            key={etat.profil.patientId}
            profil={etat.profil}
            chargerProgramme={charger}
            maintenant={maintenant}
            {...(infos.utilisateur.role === "PARENT"
              ? { onChangerProfil: () => setEtat({ ecran: "connecte", infos, profil: null }) }
              : {})}
            onDeconnexion={() => void quitter()}
          />
        );
      }
    }
  }
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
});
