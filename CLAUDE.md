# CLAUDE.md — Flame in Freefall

Ce fichier donne à Claude Code tout le contexte du projet. Il résume les décisions prises en phase de conception. Le lire en entier avant toute tâche.

## 1. Le projet

**Événement** : NASA Space Apps Challenge 2026, thème « The Next Frontier ». Hackathon les 14 et 15 novembre 2026 (soumission jusqu'au 15 à 23 h 59, heure locale). Équipes de 6 maximum.

**Challenge** : *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*. Difficulté affichée : intermédiaire-avancé. Énoncé officiel complet (il n'existe aucune liste officielle de ressources) :

> For decades, NASA has studied how flames and fire behave in microgravity, gathering a trove of experimental data along the way. That knowledge matters more than ever as humans gear up to return to the Moon and press on to Mars, yet the volume of results makes them hard to find, compare, and understand. Your challenge is to create an interactive, AI-powered dashboard that summarizes, ranks, and interprets those findings to deliver fire safety insights for human space exploration.

Les trois verbes **résumer, classer, interpréter** sont la grille de lecture du jury : la démo doit montrer les trois explicitement.

**Équipe actuelle** : Adrien (data scientist, porteur du projet, développement) et une experte en publicité (récit, pitch, vidéo).

## 2. Le concept

Un dashboard de **scénarios d'incendie spatial** qui, pour chaque situation, montre ce que disent les données NASA, **avec quel niveau de confiance**, et **quelle expérience manque** pour en savoir plus.

Promesse : montrer non seulement ce qu'on sait, mais à quel point on le sait.

Métaphore centrale, qui guide aussi le design : **la connaissance est une lumière**. Zones bien étudiées éclairées, angles morts dans l'obscurité.

### Le fait scientifique au cœur du récit

La gravité partielle n'est pas un entre-deux rassurant. Les essais en tour de chute centrifugée sur du PMMA placent la **gravité lunaire près du minimum de la limite d'inflammabilité** (oxygène × gravité). En vol parabolique, un tissu qui s'éteint vite à 1 g continue de brûler en gravité lunaire. Conséquence : un matériau certifié sûr sur Terre pourrait ne pas l'être dans un habitat lunaire. La première mesure réelle sur la Lune, l'expérience **FM2**, est attendue fin 2026 : l'outil doit être conçu pour l'intégrer dès publication.

### Ce qui nous différencie

Les autres équipes visibles font surtout des chatbots RAG ou des visuels spectaculaires. Notre différence : le moteur de confiance traçable, la carte de la connaissance, et l'exploitation des rares données en gravité partielle.

## 3. Architecture de l'interface

Trois vues et une annexe. Maquette de référence (canevas Claude) : https://claude.ai/artifact/7H6TWt3kJxKzyqUvy4Ucnk

1. **Carte** (accueil, *résumer*) : « Où en est la connaissance ? » Espace oxygène × gravité. Trois couches activables : expériences (points), couverture (halos lumineux), limite d'inflammabilité (courbe et bande d'incertitude). Les contextes de mission y sont des marqueurs. Projections alternatives prévues : O₂ × pression, O₂ × écoulement.
2. **Scénario** (*interpréter*) : « Que sait-on de ce cas précis ? » Bande de contexte Terre → ISS → Gateway → Lune → Mars (la « descente de confiance »). Réponse, niveau de confiance, décomposition du score, flamme animée selon le régime, preuves classées, ce qui manque.
3. **Priorités** (*classer*) : « Que faut-il faire maintenant ? » Matrice risque × connaissance avec le quadrant « angle mort », classement, et « quoi étudier ensuite ».
4. **Annexe Sources** : catalogue des sources avec statut. Hors navigation principale.

**Barre de question** présente sur toutes les vues : la question en langage naturel est traduite en scénario, puis ouvre la vue Scénario.

### Contextes de mission

| Contexte | Gravité | O₂ | Pression | Statut |
|---|---|---|---|---|
| Terre | 1 g | 21 % | 101 kPa | **Référence**, non calculée par le moteur (cadre de la certification) |
| ISS | ≈ 0 | 21 % | 101 kPa | Calculé |
| Gateway | ≈ 0 | 26,5 % | 73,5 kPa | Calculé |
| Habitat lunaire | 0,16 g | 34 % | 56,5 kPa | Calculé |
| Habitat martien | 0,38 g | [à définir] | [à définir] | Calculé, atmosphère inconnue |

La Terre n'apparaît pas dans la vue Priorités.

### Scénarios de départ

| Id | Scénario | Sources principales |
|---|---|---|
| s6 | Matériau certifié à 1 g, utilisé hors de la Terre (scénario phare) | Tour de chute centrifugée, vols paraboliques, FM2 |
| s1 | Câble électrique en surchauffe | Vols paraboliques sur fils gainés LDPE |
| s2 | Tissu en atmosphère enrichie | BASS-II (PSI-25), Saffire-II (PSI-99) |
| s5 | Fumée : le détecteur la verra-t-il ? | SAME-R (PSI-101) |
| s3 | Flamme froide invisible après extinction | CFI (PSI-39), FLEX (PSI-117) |
| s4 | Fuite de gaz : la flamme s'éteint-elle seule ? | ACME CFI-G (PSI-159) |

## 4. Les données

### Accès

- **psi.nasa.gov** (Physical Sciences Informatics) : source principale, libre accès (compte gratuit). Le téléchargement est fait manuellement par Adrien.
- Le bucket **AWS Open Data de PSI ne contient pas la combustion** (seulement DSI et OASIS). Ne pas compter dessus.
- **Inaccessibles** : MAPTIS (base de certification des matériaux, sur compte NASA), portails de données ACME et Saffire de Glenn (accès réservé).
- **NTRS** (ntrs.nasa.gov) : rapports et articles, utile pour la traçabilité et les données en gravité partielle.

### Inventaire PSI (d'après un recensement public, à revérifier)

> **Vérifié sur les fichiers le 2026-10-09 : voir section 11.** Les comptes de lignes ci-dessous sont ceux du recensement public et sont en partie faux.

25 investigations de combustion, 10 exploitables :

| Jeu | Contenu | Lignes | Usage |
|---|---|---|---|
| PSI-159 ACME CFI-G | Flamme de gaz : maintien ou auto-extinction | 272 | Classification |
| PSI-69 FLEX-1 | Quantité de CO₂/He pour éteindre un feu de gouttelette | 213 | Classification |
| PSI-39 CFI | Persistance d'une flamme froide | 146 | Classification |
| PSI-117 FLEX | Diamètres de flammes froides, **mesures et simulations mêlées** | 141 | Régression, CV groupée obligatoire |
| PSI-101 SAME-R | Signal des détecteurs de fumée | 134 | Régression (aucun déclenchement d'alarme enregistré) |
| PSI-25 BASS-II | Essais de matériaux sur l'ISS | 129 | **Descriptif seulement** (20 essais sur 129 ont un résultat, en texte libre) |
| PSI-142 Princeton | Limites d'extinction | 95 | Régression, **au sol (1 g)**, ne jamais mélanger à la microgravité |
| PSI-107 SPICE | Production de suie | 70 | Régression |
| PSI-115 | Panache de fumée avec et sans gravité | 5 cas simulés | Descriptif |
| PSI-99 Saffire-II | Même matériau brûlé en orbite et sur Terre | 9 | Comparaison |

Pièges connus : pas de format commun entre investigations, résultats enfouis dans du texte libre, en-têtes dont les indices ont été perdus à l'encodage, erreurs de formules Excel figées dans les cellules, valeurs d'oxygène physiquement impossibles par endroits.

### Gravité partielle (extraction manuelle depuis les articles)

- *Partial gravity flammability of cast PMMA rods*, Fire Safety Journal, 2024 : tour de chute centrifugée de Glenn, 0,04 à 1 g, 13,2 à 15,2 % d'O₂, 58 kPa. Gravité lunaire près du minimum de la limite d'inflammabilité. Critère d'extinction à 5 s (non standard) à cause de la durée de chute (5,2 s).
- Essai de tissu en gravité lunaire, vol parabolique NASA Glenn (rapporté en 2025) : s'éteint vite à 1 g, continue de brûler en gravité lunaire.
- *Flame spread over electric wires in partial gravity*, Proceedings of the Combustion Institute 39 : fils gainés LDPE en gravité lunaire et martienne ; comportement cyclique pouvant éteindre la flamme en gravité martienne.
- *Evaluating material flammability in microgravity and Martian gravity compared to the NASA standard normal gravity test*, NTRS, 2013 : tour de chute, gravité martienne.
- LUCI (février 2025) : capsule Blue Origin en rotation, environ 2,5 min de gravité lunaire. Publication à surveiller.
- **FM2** (Flammability of Materials on the Moon) : première combustion sur la Lune, quatre allumages à différents taux d'O₂, lancement visé fin 2026 sur un atterrisseur CLPS.

### Référence certification

Norme NASA-STD-6001, test 1 : le matériau est exposé à une flamme à 1 g ; échec si la flamme dépasse 15 cm ou produit des débris enflammés.

## 5. Schéma de données commun (à implémenter)

Toutes les sources, PSI ou articles, sont converties vers ce schéma. Unités normalisées.

### `Source`
- `source_id` (str), `title`, `kind` (`psi_dataset` | `article` | `report` | `standard` | `upcoming`)
- `reference` (DOI, URL, identifiant PSI), `year`
- `access` (`open` | `restricted` | `pending`)

### `Experiment` (une ligne = un essai ou une condition)
- `experiment_id`, `source_id`, `dataset`
- Provenance : `provenance_file`, `provenance_row` ou `provenance_page` (**obligatoire**, toute valeur doit être traçable)
- Plateforme : `platform` (`iss` | `drop_tower` | `drop_tower_centrifuge` | `parabolic_flight` | `suborbital_centrifuge` | `ground` | `simulation` | `lunar_surface`)
- `duration_s` (durée de l'état de gravité)
- Conditions : `gravity_g` (float), `gravity_regime` (`micro` | `lunar` | `martian` | `partial_other` | `earth`), `o2_mole_fraction` (0–1), `pressure_kpa`, `flow_velocity_cm_s`, `diluent`, `fuel`, `fuel_type` (`gas` | `liquid_droplet` | `solid`), `geometry`
- Résultat : `outcome_type` (`extinction` | `sustained` | `spread_rate` | `limit_o2` | `soot` | `detector_signal` | `descriptive`), `outcome_value`, `outcome_unit`
- Qualité : `is_measured` (bool, faux si simulation), `extinction_criterion`, `quality_flags` (liste), `notes`

Règle anti-fuite : séparer explicitement les variables connues **avant** l'allumage (entrées possibles) des mesures faites **après** (interdites en entrée de modèle).

### `Scenario`
- `scenario_id`, `question`, `question_type` (relie le scénario à un jeu de données et un modèle), `risk_level` (1–3)
- `params` : mêmes champs que les conditions d'`Experiment`
- `context_id`

### `Answer` (sortie du moteur)
```json
{
  "scenario_id": "s6",
  "context_id": "lune",
  "prediction": null,
  "confidence": "tres_faible",
  "evidence_axis": "limitees",
  "agreement_axis": "moyen",
  "components": {"coverage": 0.12, "gravity_regime": "partial_short", "source_quality": 0.5, "n_neighbors": 3, "agreement": 0.6},
  "ceilings_applied": ["partial_gravity_no_long_duration"],
  "evidence": [{"experiment_id": "...", "source_id": "...", "relevance_rank": 1}],
  "gaps": ["..."],
  "model": {"name": "...", "cv_score": null, "baseline_score": null, "shown": false}
}
```

## 6. Moteur de confiance (spécification)

Inspiré du cadre du GIEC : deux axes, résultat exprimé en mots, **jamais en pourcentage**.

### Axe preuves (P)
- **Couverture κ(x)** : on standardise l'espace des paramètres, puis κ = exp(−d_k / d_ref), où d_k est la distance moyenne aux k plus proches expériences et d_ref la distance typique entre expériences du jeu.
- **Régime de gravité γ** : 1 si le scénario est dans un régime testé en longue durée ; pénalisé sinon.
- **Qualité de source w** : ISS longue durée > tour de chute / vol parabolique > simulation.
- **Nombre n** d'expériences voisines.

### Axe accord (A)
- Classification : entropie des résultats des k voisins.
- Régression : coefficient de variation des voisins.
- Dans les deux cas : largeur de l'intervalle par **prédiction conforme** (adaptée aux petits échantillons, garantie de couverture).

### Combinaison
P et A discrétisés en trois niveaux (seuils à calibrer et à documenter) :

| | A faible | A moyen | A élevé |
|---|---|---|---|
| **P limitées** | très faible | très faible | faible |
| **P moyennes** | très faible | faible | moyenne |
| **P solides** | faible | moyenne | élevée |

### Règles de plafond (appliquées après la matrice)
1. Gravité partielle sans mesure longue durée → au mieux **faible**.
2. Scénario hors de l'enveloppe des données (κ sous un seuil) → au mieux **faible**.
3. Une seule source → au mieux **moyenne**.
4. Modèle qui ne bat pas la classe majoritaire (ou la moyenne) en validation → **aucune prédiction affichée**, seulement les expériences voisines.

### Modèles
- Classiques uniquement : régression logistique, arbres peu profonds. Pas de deep learning (quelques centaines de lignes).
- **Un modèle par question et par jeu de données**. Jamais de modèle unique fusionnant toutes les sources.
- Validation croisée **groupée par condition physique**, pas par ligne.
- Toujours afficher le score de référence (classe majoritaire) à côté du score du modèle.

### Rôle du LLM (strictement borné)
- Traduire une question en langage naturel en paramètres de scénario (aiguilleur, pas répondant).
- Assister l'extraction des paramètres depuis les PDF, avec **validation humaine**.
- Rédiger l'explication à partir du JSON `Answer`.
- **Ne jamais produire un chiffre ni un niveau de confiance.**

## 7. Règles du projet

- Aucun chiffre inventé. Toute valeur affichée est traçable jusqu'à un fichier, une ligne ou une page.
- Toute valeur illustrative est signalée comme telle dans l'interface.
- Ne jamais mélanger les régimes de gravité dans un même modèle sans variable explicite.
- Unités SI normalisées à l'import.
- L'outil est un outil d'exploration et de pédagogie, pas un outil de décision de vol : à écrire dans l'interface.

## 8. Stack

- Moteur et pipeline de données : Python (pandas, scikit-learn ; MAPIE ou équivalent pour la prédiction conforme ; pydantic pour le schéma).
- Front-end : **Next.js 16** (`dashboard/`), qui lit `dashboard/data/dashboard.json` produit par le pipeline Python. LLM : **Gemini** (clé `GEMINI_API_KEY` dans `dashboard/.env.local`), appelé uniquement côté serveur.

## 9. Direction visuelle (maquette v2)

- Fond `#07090C`, panneaux `#0A0D11`, filets `#1E252E`, texte `#EDEBE6`, texte secondaire `#98A0AA`.
- Lumière / connaissance : `#CFE8FF` (avec halo). Feu / alerte : `#FF7A2F`, `#FFB27A`. Microgravité : `#6FA8DC`.
- Typographies : Archivo (titres condensés, `font-stretch` ~68–70 %), JetBrains Mono (libellés, données).
- Confiance représentée par des barres lumineuses (« lumens »), jamais par la couleur seule.
- Flammes animées : sphère bleue qui respire (microgravité), flamme stable (Lune), flamme haute qui vacille (Terre), silhouette en pointillés avec « ? » (Mars).

## 10. Premières tâches

1. Initialiser le dépôt et la structure (`data/raw`, `data/processed`, `engine/`, `tests/`).
2. Implémenter le schéma (section 5) en pydantic, avec validation des unités et de la provenance.
3. Écrire un premier importeur pour **PSI-159 ACME**, puis **PSI-69 FLEX-1** et **PSI-99 Saffire-II**, dès que les fichiers sont dans `data/raw`.
4. Créer à la main le tableau des données en gravité partielle à partir des articles de la section 4.
5. Implémenter le moteur de confiance (section 6) avec des tests unitaires sur les règles de plafond et la matrice.
6. Produire les sorties `Answer` pour les six scénarios et les cinq contextes.

## 11. État d'avancement (2026-10-09)

**Règle de l'événement** : le travail anticipé est accepté par l'événement local à condition d'être déclaré comme entraînement, avec l'usage de l'IA : tenir `docs/PREPARATION.md` à jour à chaque étape.

Tâches 1 à 6 de la section 10 terminées ; front-end statique livré dans `web/`. Lancer : `python -m engine.pipeline`, puis ouvrir `web/index.html`. 61 tests (`python -m pytest`).

### Ce que contiennent vraiment les fichiers

| Question (scénario) | Jeu réel | Essais | Remarque |
|---|---|---|---|
| s4 fuite de gaz | PSI-159, flammes **normales** seulement | 133 (102 SE / 31 FT) | 46 essais sans allumage écartés. Flammes inverses non importées (leur O₂ décrit le jet, pas l'ambiance). |
| s3 flamme froide | PSI-39, classeur `CFI_DataSummary` (Master + DATA) | 146 | Flamme froide = `kcool` mesurée. 81 essais à l'analyse non terminée écartés. |
| s5 fumée | PSI-101, `Combined SAMER Results`, feuille « Reduced data sheet » | 130 | Cible : diamètre de masse moyenne (µm). DBP (étalonnage) écarté. |
| s1 câble | Konno 2023, fig. 2 (lue sur la grille) | 24 limites | `digitized_from_figure`. |
| s2 matériau solide | Saffire I/II/III, PMMA Olson 2024 (figure LPSC 2026 p. 20), SIBAL lunaire, LUCI, limites Olson 2013 converties | 64 | Saffire-II : chaque échantillon a un résultat en orbite ET à 1 g. |
| s6 certifié à 1 g | Olson & Ferkul 2013, tableau I (+ Konno) | 27 écarts ΔO₂ | Les ΔO₂ recalculés redonnent exactement ceux de l'article (test). |

PSI-69 FLEX : 273 essais (ligne 115 : pression 0 mmHg, écartée). PSI-10, PSI-25 : conditions seulement (carte). Indisponibles sur PSI (erreur S3) : BASS-II Test.Matrices et ReadMe, BASS FinalReport. Article PMMA 2024 payant : remplacé par sa figure dans Ferkul LPSC 2026.

**Attention** : `PSI-26/BASS Test Matrix 050213.xlsx` contient des identifiants et mots de passe en clair dans une cellule. Ne jamais republier ce fichier ni son contenu.

### Décisions ajoutées à la spécification du moteur

- d_ref = médiane, sur les expériences, de leur distance moyenne aux k voisines (même statistique que d_k) ; κ ≈ 0,37 pour un point « typique ». Seuils recalés en conséquence (`Settings`).
- Échelle minimale de standardisation par variable (sinon une colonne constante masque l'extrapolation).
- Voisines ex æquo incluses (sinon choix arbitraire quand seule la gravité est connue, ex. Mars).
- Règle 4 renforcée : le modèle doit battre la référence d'au moins une erreur-type.
- Règle 4 bis : hors de l'enveloppe des données, la prédiction est masquée (seules les observations voisines sont montrées).
- L'incertitude conforme ne compte dans l'accord que si le modèle est affiché.
- `Answer.observations` : résultats observés chez les voisines (données, pas prédiction).
- Niveaux de risque des scénarios : proposition à valider (s1, s2, s6 = 3 ; s3, s4, s5 = 2).

### Week-end du hackathon (14-15 novembre 2026)

Ressources officielles du challenge : `RESSOURCES.md` (PSI confirmé comme source ; pas de nouveau jeu de données).

- **Tout le produit est en anglais** : textes du moteur, identifiants (`earth`, `moon` ; confiance `very_low` … `high` ; preuves `limited/medium/robust`), interface, routes (`/priorities`), consignes Gemini. Ce fichier reste en français (interne).
- **Sept scénarios.** s5 vise désormais le **signal du détecteur de fumée de l'ISS** (V), feuille « Reduced Data with ISS Det » ; les valeurs ≥ 6,2 V sont signalées `at_signal_ceiling` (saturation probable, non confirmée par la source ; aucun seuil d'alarme dans les données). **s7** (nouveau) : extincteur au CO₂, données FLEX PSI-69, cible = diamètre d'extinction / diamètre initial (172 essais ; gouttes éclatées exclues).
- **Comparaisons** (`observations.comparison`) : médiane par matériau (s5) ou par dose de CO₂ (s7), sur tout le jeu.
- **Observations BASS** (PSI-26, matrice « as run », 124 comptes rendus) : citées mot pour mot (`field_notes`), jamais classées. Règles de sélection affichées.
- **Couverture** : les variables propres à la question (`extra.*`) comptent dans le choix des voisines quand le scénario les renseigne.
- **Catalogue** (`engine/catalog.py`, `data/manual/psi_catalog.json`) : usage des 24 investigations PSI, incidents (Apollo 1, Apollo 13, Mir), retombées, ressources officielles. Chaque phrase d'incident reste dans les citations des pages NASA.
- **Vue Investigations** (`/investigations`) ajoutée à la navigation.
- Next.js 16.4.6 ; Gemini `gemini-3.8-flash` testé avec la vraie clé.
- `web/` (prototype statique) figé : plus régénéré par le pipeline.
- **Énoncé complet du challenge lu le 15 novembre** : l'objectif porte sur les *investigations* (résumer, comparer, classer). Ajouts : `engine/profiles.py` (fiche par investigation : pilier prévention/détection/suppression, famille de matériel, combustibles, plages testées, ce qui varie, réserves sur les données), **classement des 24 investigations par habitat** (score 0-6 : lien avec la sécurité incendie 0-2, oxygène couvert 0-2, gravité 0-1, résultats exploitables 0-1 ; le rover pressurisé partage l'atmosphère de la base lunaire), tableau de comparaison, export CSV/JSON (`dashboard/public/data/`).
- Corrections d'après l'énoncé : BRE est une étude d'inflammabilité des matériaux ; E-FIELD Flames imite la gravité partielle ; DAFT partage un instrument avec SAME. Flammes inverses de CFI-G importées (`PSI-159-inverse`, O₂ du brûleur dans `extra`, jamais mêlées au modèle s4).
- Tableaux de synthèse PSI-20, 21, 22, 23, 47, 106 : une ligne par journée, sans résultat ; artefacts de tableur signalés, jamais corrigés (« 3400 % », formules incrémentées « CH5 », « N3 »).
- L'énoncé confirme : **aucune donnée de gravité partielle dans PSI**. Les nôtres viennent d'articles et de rapports ; l'interface le dit.
- 69 tests.

### Reste à faire

- Valider les niveaux de risque et les hypothèses de scénario avec l'équipe.
- Intégrer FM2 dès publication (`data/manual/build_partial_gravity.py`).

