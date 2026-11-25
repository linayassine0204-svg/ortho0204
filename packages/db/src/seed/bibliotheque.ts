// Contenu FICTIF de la bibliothèque, pour le développement uniquement.

export const CATEGORIES = [
  { slug: "langage-oral", nom: "Langage oral" },
  { slug: "langage-ecrit", nom: "Langage écrit" },
  { slug: "articulation", nom: "Articulation et parole" },
  { slug: "begaiement", nom: "Bégaiement et fluence" },
  { slug: "voix", nom: "Voix" },
  { slug: "deglutition", nom: "Déglutition et oralité" },
  { slug: "cognition-mathematique", nom: "Cognition mathématique" },
] as const;

export type SlugCategorie = (typeof CATEGORIES)[number]["slug"];

export interface ExerciceFictif {
  cle: string;
  categorie: SlugCategorie;
  titre: string;
  description: string;
  ageMin: number;
  ageMax: number;
  dureeMinutes: number;
  materiel: string[];
  apercuConsigne: string;
  niveaux: [string, string, string];
}

export const EXERCICES: ExerciceFictif[] = [
  {
    cle: "rimes",
    categorie: "langage-ecrit",
    titre: "Chasse aux rimes",
    description: "Trouver des mots qui finissent par le même son.",
    ageMin: 5,
    ageMax: 9,
    dureeMinutes: 10,
    materiel: ["Cartes images"],
    apercuConsigne: "Trouve deux mots qui riment.",
    niveaux: [
      "Choisis parmi 2 images celle qui rime avec le mot dit.",
      "Choisis parmi 4 images celle qui rime avec le mot dit.",
      "Trouve seul un mot qui rime avec le mot dit.",
    ],
  },
  {
    cle: "syllabes",
    categorie: "langage-ecrit",
    titre: "Frappe les syllabes",
    description: "Découper un mot en syllabes en frappant dans les mains.",
    ageMin: 4,
    ageMax: 8,
    dureeMinutes: 5,
    materiel: [],
    apercuConsigne: "Frappe une fois par syllabe.",
    niveaux: ["Mots de 2 syllabes.", "Mots de 3 syllabes.", "Mots de 4 syllabes et plus."],
  },
  {
    cle: "lecture-flash",
    categorie: "langage-ecrit",
    titre: "Lecture flash",
    description: "Lire rapidement des mots fréquents.",
    ageMin: 6,
    ageMax: 11,
    dureeMinutes: 10,
    materiel: ["Liste de mots"],
    apercuConsigne: "Lis le mot qui apparaît.",
    niveaux: ["Mots courts et fréquents.", "Mots de deux syllabes.", "Mots irréguliers."],
  },
  {
    cle: "histoire-images",
    categorie: "langage-oral",
    titre: "Raconte l'histoire",
    description: "Remettre des images dans l'ordre et raconter l'histoire.",
    ageMin: 4,
    ageMax: 10,
    dureeMinutes: 15,
    materiel: ["Images séquentielles"],
    apercuConsigne: "Range les images puis raconte.",
    niveaux: ["3 images.", "4 images.", "6 images avec connecteurs (puis, ensuite, enfin)."],
  },
  {
    cle: "parole-lente",
    categorie: "begaiement",
    titre: "Parole de la tortue",
    description: "Parler lentement et en douceur sur des phrases courtes.",
    ageMin: 5,
    ageMax: 99,
    dureeMinutes: 10,
    materiel: ["Minuteur"],
    apercuConsigne: "Dis la phrase doucement, comme une tortue.",
    niveaux: ["Mots isolés.", "Phrases courtes.", "Conversation de 2 minutes."],
  },
  {
    cle: "respiration",
    categorie: "begaiement",
    titre: "Respiration du ballon",
    description: "Respiration abdominale avant de parler.",
    ageMin: 5,
    ageMax: 99,
    dureeMinutes: 5,
    materiel: [],
    apercuConsigne: "Gonfle le ventre comme un ballon.",
    niveaux: ["5 respirations guidées.", "10 respirations.", "Respiration puis une phrase."],
  },
  {
    cle: "sons-s-ch",
    categorie: "articulation",
    titre: "Le serpent et le chat",
    description: "Distinguer et produire les sons [s] et [ʃ].",
    ageMin: 4,
    ageMax: 8,
    dureeMinutes: 10,
    materiel: ["Miroir", "Cartes images"],
    apercuConsigne: "Fais le serpent (sss) ou le chat (chh).",
    niveaux: ["Son isolé.", "Son dans des syllabes.", "Son dans des mots."],
  },
  {
    cle: "voix-paille",
    categorie: "voix",
    titre: "Paille dans l'eau",
    description: "Exercice de voix avec une paille dans un verre d'eau.",
    ageMin: 12,
    ageMax: 99,
    dureeMinutes: 5,
    materiel: ["Paille", "Verre d'eau"],
    apercuConsigne: "Souffle en faisant « ou » dans la paille.",
    niveaux: ["Son tenu 5 secondes.", "Glissando grave-aigu.", "Petite mélodie connue."],
  },
  {
    cle: "comptage",
    categorie: "cognition-mathematique",
    titre: "Compte les étoiles",
    description: "Dénombrer une petite collection.",
    ageMin: 4,
    ageMax: 8,
    dureeMinutes: 5,
    materiel: ["Jetons"],
    apercuConsigne: "Combien d'étoiles vois-tu ?",
    niveaux: ["Jusqu'à 5.", "Jusqu'à 10.", "Jusqu'à 20, en groupant par 5."],
  },
];

export interface ConseilFictif {
  cle: string;
  titre: string;
  contenu: string;
  ageMin: number | null;
  ageMax: number | null;
  categories: SlugCategorie[];
}

export const CONSEILS_MODELES: ConseilFictif[] = [
  {
    cle: "lecture-partagee",
    titre: "Lire ensemble chaque soir",
    contenu: "Lisez une courte histoire avec votre enfant. Laissez-le lire un mot sur deux.",
    ageMin: 5,
    ageMax: 10,
    categories: ["langage-ecrit"],
  },
  {
    cle: "temps-de-parole",
    titre: "Laisser le temps de parler",
    contenu: "Ne finissez pas les phrases de votre enfant. Gardez un débit calme vous-même.",
    ageMin: 3,
    ageMax: 12,
    categories: ["begaiement"],
  },
  {
    cle: "reformuler",
    titre: "Reformuler sans corriger",
    contenu: "Répétez correctement la phrase de votre enfant, sans lui demander de la redire.",
    ageMin: 3,
    ageMax: 8,
    categories: ["langage-oral", "articulation"],
  },
  {
    cle: "hydratation-voix",
    titre: "Prendre soin de sa voix",
    contenu: "Buvez de l'eau régulièrement et évitez de forcer la voix dans le bruit.",
    ageMin: 12,
    ageMax: null,
    categories: ["voix"],
  },
];
