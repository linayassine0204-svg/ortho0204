"use client";

import { useEffect, useRef, useState } from "react";

// Message vocal enregistré dans le navigateur (MediaRecorder). L'audio reste sur
// l'ordinateur jusqu'à l'envoi, puis ne va qu'à notre serveur (connexion chiffrée).

/** Formats acceptés par le serveur, du préféré au moins préféré. */
const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Premier format que ce navigateur sait enregistrer (null : enregistrement impossible). */
export function formatVocal(
  enregistreur: { isTypeSupported?: (type: string) => boolean } | undefined = (
    globalThis as { MediaRecorder?: { isTypeSupported?: (type: string) => boolean } }
  ).MediaRecorder,
): string | null {
  if (!enregistreur || typeof enregistreur.isTypeSupported !== "function") return null;
  return FORMATS.find((f) => enregistreur.isTypeSupported?.(f)) ?? null;
}

export interface Vocal {
  fichier: Blob;
  secondes: number;
}

/** Enregistreur de message vocal (micro du navigateur). */
export function useVocalNavigateur(dureeMaxSecondes: number) {
  const [possible, setPossible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const debut = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fin = useRef<((v: Vocal | null) => void) | null>(null);

  useEffect(() => {
    // Après l'affichage : le serveur ne connaît pas le navigateur.
    const disponible = formatVocal() !== null && Boolean(navigator.mediaDevices?.getUserMedia);
    queueMicrotask(() => setPossible(disponible));
    return () => {
      flux.current?.getTracks().forEach((p) => p.stop());
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, []);

  async function demarrer(onFin: (v: Vocal | null) => void): Promise<boolean> {
    const format = formatVocal();
    if (!format) return false;
    try {
      flux.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }
    morceaux.current = [];
    fin.current = onFin;
    const r = new MediaRecorder(flux.current, { mimeType: format });
    r.ondataavailable = (e) => {
      if (e.data.size > 0) morceaux.current.push(e.data);
    };
    r.onstop = () => {
      flux.current?.getTracks().forEach((p) => p.stop());
      if (minuteur.current) clearTimeout(minuteur.current);
      const secondes = Math.max(1, Math.round((Date.now() - debut.current) / 1000));
      const fichier = new Blob(morceaux.current, { type: format.split(";")[0] });
      setEnCours(false);
      fin.current?.(fichier.size > 0 ? { fichier, secondes } : null);
    };
    recorder.current = r;
    debut.current = Date.now();
    r.start();
    setEnCours(true);
    // Arrêt automatique à la durée maximale acceptée par le serveur.
    minuteur.current = setTimeout(
      () => r.state !== "inactive" && r.stop(),
      dureeMaxSecondes * 1000,
    );
    return true;
  }

  function arreter() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  return { possible, enCours, demarrer, arreter };
}
