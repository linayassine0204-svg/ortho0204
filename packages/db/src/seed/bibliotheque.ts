// Contenu FICTIF de la bibliothèque, pour le développement uniquement.
//
// ⚠ Les exercices ci-dessous sont des EXEMPLES rédigés pour tester le logiciel.
// Leur contenu médical n'a PAS été vérifié : chacun est enregistré avec
// l'étiquette interne « à valider par un orthophoniste » (aValider = true),
// toujours affichée dans l'interface.

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
  /** Score « sur N » prévu par l'exercice (facultatif). */
  scoreMax?: number;
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
    scoreMax: 10,
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
    scoreMax: 10,
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
  {
    cle: "sons-ch-j",
    categorie: "articulation",
    titre: "Sons ch / j : le train et l'abeille",
    description: "Différencier et produire les sons ch [ʃ] et j [ʒ].",
    ageMin: 4,
    ageMax: 9,
    dureeMinutes: 10,
    materiel: ["Miroir", "Cartes images ch / j"],
    apercuConsigne: "Fais le train (chhh) ou l'abeille (jjj).",
    niveaux: [
      "Écoute et montre : train (ch) ou abeille (j) ?",
      "Répète des syllabes : cha, ja, chou, jou.",
      "Nomme les images : chat, jupe, chaussure, jardin.",
    ],
  },
  {
    cle: "sons-r",
    categorie: "articulation",
    titre: "Le lion qui ronronne",
    description: "Travailler la production du son [r].",
    ageMin: 4,
    ageMax: 10,
    dureeMinutes: 10,
    materiel: ["Miroir"],
    apercuConsigne: "Ronronne comme un lion : rrr.",
    niveaux: ["Son isolé, tenu.", "Syllabes : ra, ri, ro.", "Mots : rat, roue, arbre."],
  },
  {
    cle: "praxies-bouche",
    categorie: "articulation",
    titre: "Grimaces devant le miroir",
    description: "Mouvements de la langue et des lèvres en imitation.",
    ageMin: 3,
    ageMax: 8,
    dureeMinutes: 5,
    materiel: ["Miroir"],
    apercuConsigne: "Imite la grimace de la carte.",
    niveaux: ["3 mouvements simples.", "5 mouvements enchaînés.", "Mouvements rapides en rythme."],
  },
  {
    cle: "categories-mots",
    categorie: "langage-oral",
    titre: "Range les mots",
    description: "Classer des images par catégorie (animaux, fruits, vêtements).",
    ageMin: 3,
    ageMax: 7,
    dureeMinutes: 10,
    materiel: ["Cartes images"],
    apercuConsigne: "Mets ensemble ce qui va ensemble.",
    niveaux: [
      "2 catégories, 6 images.",
      "3 catégories, 9 images.",
      "Trouve seul le nom de la catégorie.",
    ],
  },
  {
    cle: "devinettes",
    categorie: "langage-oral",
    titre: "Qui suis-je ?",
    description: "Deviner un objet à partir d'indices, puis en faire deviner.",
    ageMin: 5,
    ageMax: 11,
    dureeMinutes: 10,
    materiel: ["Cartes objets"],
    apercuConsigne: "Écoute les indices et devine l'objet.",
    niveaux: [
      "3 indices, choix entre 3 images.",
      "3 indices, sans images.",
      "Fais deviner avec tes indices.",
    ],
  },
  {
    cle: "phrases-images",
    categorie: "langage-oral",
    titre: "Une image, une phrase",
    description: "Construire une phrase complète à partir d'une image.",
    ageMin: 4,
    ageMax: 9,
    dureeMinutes: 10,
    materiel: ["Images d'actions"],
    apercuConsigne: "Dis ce que fait le personnage.",
    niveaux: [
      "Phrase de 3 mots.",
      "Phrase avec un lieu (dans, sur).",
      "Deux phrases reliées par « parce que ».",
    ],
  },
  {
    cle: "dictee-syllabes",
    categorie: "langage-ecrit",
    titre: "Dictée de syllabes",
    description: "Écrire des syllabes et des mots simples sous la dictée.",
    ageMin: 6,
    ageMax: 10,
    dureeMinutes: 10,
    materiel: ["Ardoise", "Feutre"],
    apercuConsigne: "Écris la syllabe que tu entends.",
    niveaux: [
      "Syllabes simples (ma, lo).",
      "Syllabes complexes (tra, oin).",
      "Mots de 2 à 3 syllabes.",
    ],
  },
  {
    cle: "fluence-respiration-phrases",
    categorie: "begaiement",
    titre: "Démarrage en douceur",
    description: "Commencer les phrases avec une attaque vocale douce.",
    ageMin: 8,
    ageMax: 99,
    dureeMinutes: 10,
    materiel: [],
    apercuConsigne: "Commence ta phrase tout doucement.",
    niveaux: ["Mots commençant par une voyelle.", "Phrases courtes.", "Lecture d'un petit texte."],
  },
  {
    cle: "voix-sirene",
    categorie: "voix",
    titre: "La sirène",
    description: "Glisser la voix du grave à l'aigu sans forcer.",
    ageMin: 8,
    ageMax: 99,
    dureeMinutes: 5,
    materiel: [],
    apercuConsigne: "Fais la sirène du grave à l'aigu.",
    niveaux: ["Sur « ou », bouche presque fermée.", "Sur « a ».", "Sirène puis une phrase."],
  },
  {
    cle: "mastication",
    categorie: "deglutition",
    titre: "Mâcher des deux côtés",
    description: "Alterner la mastication à droite et à gauche.",
    ageMin: 4,
    ageMax: 99,
    dureeMinutes: 5,
    materiel: ["Aliment adapté choisi avec l'orthophoniste"],
    apercuConsigne: "Mâche 5 fois à droite, puis 5 fois à gauche.",
    niveaux: ["Aliment fondant.", "Aliment tendre.", "Aliment plus ferme."],
  },
  {
    cle: "souffle-coton",
    categorie: "deglutition",
    titre: "Course de cotons",
    description: "Souffler avec une paille pour faire avancer une boule de coton.",
    ageMin: 3,
    ageMax: 8,
    dureeMinutes: 5,
    materiel: ["Paille", "Boules de coton"],
    apercuConsigne: "Fais avancer le coton jusqu'à l'arrivée.",
    niveaux: ["Parcours droit.", "Parcours avec un virage.", "Parcours avec obstacles."],
  },
  {
    cle: "comparer-quantites",
    categorie: "cognition-mathematique",
    titre: "Qui en a le plus ?",
    description: "Comparer deux petites quantités.",
    ageMin: 5,
    ageMax: 9,
    dureeMinutes: 5,
    materiel: ["Jetons", "Dés"],
    apercuConsigne: "Montre le tas qui en a le plus.",
    niveaux: ["Jusqu'à 5.", "Jusqu'à 10.", "Dis combien il y en a de plus."],
  },
];

/**
 * Conseil pré-fait pour les familles. Tranche d'âge en années (null = pas de limite).
 * EXEMPLES NON VALIDÉS MÉDICALEMENT : ils sont tous marqués « à valider par un
 * orthophoniste » (aValider) et doivent être relus par un professionnel avant usage réel.
 */
export interface ConseilFictif {
  cle: string;
  titre: string;
  aFaire: string[];
  aEviter: string[];
  ageMin: number | null;
  ageMax: number | null;
  categories: SlugCategorie[];
}

export const CONSEILS_MODELES: ConseilFictif[] = [
  // ── Langage oral ──
  {
    cle: "parler-en-jouant",
    titre: "Parler en jouant",
    aFaire: [
      "Mettez des mots sur ce que fait votre enfant pendant le jeu.",
      "Attendez quelques secondes pour lui laisser le temps de répondre.",
      "Proposez des jeux de « faire semblant » (dînette, garage, poupées).",
    ],
    aEviter: [
      "Poser trop de questions à la suite.",
      "Laisser la télévision allumée en fond pendant les moments de jeu.",
    ],
    ageMin: 2,
    ageMax: 4,
    categories: ["langage-oral"],
  },
  {
    cle: "reformuler",
    titre: "Reformuler sans corriger",
    aFaire: [
      "Répétez correctement la phrase de votre enfant, d'un ton naturel.",
      "Ajoutez un petit mot ou une idée à ce qu'il a dit (« Oui, le gros chien noir court »).",
    ],
    aEviter: [
      "Lui demander de répéter la phrase « comme il faut ».",
      "Dire « non, on ne dit pas comme ça ».",
    ],
    ageMin: 3,
    ageMax: 8,
    categories: ["langage-oral", "articulation"],
  },
  {
    cle: "raconter-sa-journee",
    titre: "Raconter sa journée",
    aFaire: [
      "Chaque soir, demandez-lui de raconter un moment de sa journée.",
      "Aidez-le avec des mots pour le temps : « d'abord », « après », « à la fin ».",
      "Montrez l'exemple en racontant aussi un moment de votre journée.",
    ],
    aEviter: [
      "Finir ses phrases à sa place.",
      "Transformer le moment en interrogatoire sur l'école.",
    ],
    ageMin: 5,
    ageMax: 10,
    categories: ["langage-oral"],
  },
  {
    cle: "jeux-de-mots",
    titre: "Enrichir le vocabulaire au quotidien",
    aFaire: [
      "Jouez à trouver des mots d'une même famille (fruits, animaux, outils…).",
      "Expliquez les mots nouveaux rencontrés dans une histoire ou un dessin animé.",
      "Faites des devinettes : « C'est un animal, il a une trompe… ».",
    ],
    aEviter: [
      "Lui faire réciter des listes de mots sans jeu.",
      "Vous moquer d'un mot mal employé.",
    ],
    ageMin: 6,
    ageMax: 11,
    categories: ["langage-oral"],
  },
  {
    cle: "expliquer-avec-ses-mots",
    titre: "Expliquer avec ses mots",
    aFaire: [
      "Demandez-lui de vous expliquer un sujet qu'il aime (jeu, sport, série).",
      "Posez des questions ouvertes : « Comment ça marche ? », « Pourquoi ? ».",
    ],
    aEviter: [
      "Corriger chaque erreur pendant qu'il parle.",
      "Parler à sa place devant d'autres personnes.",
    ],
    ageMin: 12,
    ageMax: 18,
    categories: ["langage-oral"],
  },
  // ── Langage écrit ──
  {
    cle: "lecture-partagee",
    titre: "Lire ensemble chaque soir",
    aFaire: [
      "Lisez une courte histoire ensemble, 10 minutes suffisent.",
      "Laissez-le lire un mot sur deux, ou une ligne sur deux.",
      "Laissez-le choisir le livre.",
    ],
    aEviter: [
      "Prolonger la lecture quand il est fatigué.",
      "Comparer sa lecture à celle de ses frères, sœurs ou camarades.",
    ],
    ageMin: 5,
    ageMax: 10,
    categories: ["langage-ecrit"],
  },
  {
    cle: "devoirs-sans-tension",
    titre: "Des devoirs sans tension",
    aFaire: [
      "Gardez un moment court et régulier, dans un endroit calme.",
      "Lisez-lui les consignes à voix haute s'il en a besoin.",
      "Félicitez l'effort, pas seulement le résultat.",
    ],
    aEviter: [
      "Faire recopier un texte plusieurs fois à cause des fautes.",
      "Des séances de devoirs de plus de 30 minutes d'affilée.",
    ],
    ageMin: 7,
    ageMax: 12,
    categories: ["langage-ecrit"],
  },
  {
    cle: "lecture-au-college",
    titre: "Faciliter la lecture au collège",
    aFaire: [
      "Proposez des livres audio en plus des livres papier.",
      "Aidez-le à découper un long texte en petites parties.",
    ],
    aEviter: [
      "Imposer la lecture à voix haute devant la famille.",
      "Présenter la lecture comme une punition.",
    ],
    ageMin: 11,
    ageMax: 18,
    categories: ["langage-ecrit"],
  },
  // ── Articulation et parole ──
  {
    cle: "jouer-avec-la-bouche",
    titre: "Jouer avec la bouche",
    aFaire: [
      "Faites des grimaces ensemble devant le miroir.",
      "Soufflez sur des bulles, des plumes ou une paille.",
    ],
    aEviter: [
      "Lui faire répéter un son qu'il n'arrive pas encore à dire.",
      "Faire remarquer ses erreurs de prononciation devant d'autres personnes.",
    ],
    ageMin: 3,
    ageMax: 7,
    categories: ["articulation"],
  },
  // ── Bégaiement et fluence ──
  {
    cle: "temps-de-parole",
    titre: "Laisser le temps de parler",
    aFaire: [
      "Gardez un débit calme et posé quand vous lui parlez.",
      "Regardez-le pendant qu'il parle, montrez que vous écoutez.",
      "Prévoyez un petit moment par jour où il a toute votre attention.",
    ],
    aEviter: [
      "Finir ses phrases ou souffler les mots.",
      "Lui dire « respire » ou « parle moins vite ».",
    ],
    ageMin: 3,
    ageMax: 12,
    categories: ["begaiement"],
  },
  {
    cle: "parler-du-begaiement",
    titre: "Pouvoir parler du bégaiement",
    aFaire: [
      "Laissez-le parler de son bégaiement s'il le souhaite, sans dramatiser.",
      "Valorisez ce qu'il dit plutôt que la façon dont il le dit.",
    ],
    aEviter: [
      "Éviter le sujet comme s'il était honteux.",
      "Répondre à sa place au téléphone ou dans les magasins.",
    ],
    ageMin: 12,
    ageMax: null,
    categories: ["begaiement"],
  },
  // ── Voix ──
  {
    cle: "voix-enfant",
    titre: "Protéger la voix de son enfant",
    aFaire: [
      "Proposez de l'eau régulièrement dans la journée.",
      "Allez le voir pour lui parler plutôt que de l'appeler d'une pièce à l'autre.",
    ],
    aEviter: [
      "Les jeux où il faut crier longtemps.",
      "Parler fort par-dessus le bruit (télévision, musique).",
    ],
    ageMin: 5,
    ageMax: 11,
    categories: ["voix"],
  },
  {
    cle: "hydratation-voix",
    titre: "Prendre soin de sa voix",
    aFaire: [
      "Buvez de l'eau régulièrement dans la journée.",
      "Faites des pauses de voix après une longue période de parole.",
    ],
    aEviter: ["Forcer la voix dans le bruit.", "Chuchoter longtemps : cela fatigue aussi la voix."],
    ageMin: 12,
    ageMax: null,
    categories: ["voix"],
  },
  // ── Déglutition et oralité ──
  {
    cle: "repas-sans-pression",
    titre: "Des repas sans pression",
    aFaire: [
      "Proposez les nouveaux aliments plusieurs fois, en petite quantité.",
      "Laissez-le toucher et sentir les aliments.",
      "Mangez ensemble, dans le calme.",
    ],
    aEviter: ["Forcer à finir l'assiette.", "Les écrans pendant le repas."],
    ageMin: 1,
    ageMax: 6,
    categories: ["deglutition"],
  },
  {
    cle: "manger-en-securite",
    titre: "Manger dans de bonnes conditions",
    aFaire: [
      "Mangez assis, bien droit, sans vous presser.",
      "Prenez de petites bouchées et de petites gorgées.",
    ],
    aEviter: ["Parler en mangeant.", "Manger allongé ou très fatigué."],
    ageMin: 18,
    ageMax: null,
    categories: ["deglutition"],
  },
  // ── Cognition mathématique ──
  {
    cle: "nombres-au-quotidien",
    titre: "Les nombres au quotidien",
    aFaire: [
      "Comptez ensemble les objets de la vie courante (couverts, marches, fruits).",
      "Jouez à des jeux de société avec un dé.",
      "Faites-le participer aux courses : comparer, peser, compter la monnaie.",
    ],
    aEviter: [
      "Les fiches de calcul répétitives à la maison.",
      "Montrer de l'agacement quand il compte sur ses doigts.",
    ],
    ageMin: 5,
    ageMax: 11,
    categories: ["cognition-mathematique"],
  },
];
