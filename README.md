# Flame in Freefall

NASA Space Apps Challenge 2026 · *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*.

Un dashboard de scénarios d'incendie spatial : pour chaque situation, ce que disent les données NASA, **avec quel niveau de confiance**, et **quelle expérience manque**.

## Lancer

```bash
pip install pandas numpy scikit-learn pydantic openpyxl pytest
python -m engine.pipeline      # import → modèles → réponses (data/processed/, dashboard/data/)
python -m pytest               # 61 tests

cd dashboard
npm install
cp .env.example .env.local     # puis y mettre GEMINI_API_KEY
npm run gemini:check           # vérifie la clé et le modèle
npm run dev                    # http://localhost:3000
```

Sans clé Gemini, l'application fonctionne quand même : aiguillage par mots-clés et texte rédigé par règles.
L'ancienne version statique reste dans `web/` (ouvrir `web/index.html`), en secours.

Les fichiers PSI ne sont pas versionnés : voir `data/DOWNLOADS.md` pour la liste exacte, à ranger dans `data/raw/<PSI-id>/`. `data/raw/manifest.csv` relie chaque fichier local à son chemin PSI officiel (taille, SHA-256).

## Organisation

| Dossier | Rôle |
|---|---|
| `engine/schema.py` | Schéma commun (pydantic) : unités, provenance obligatoire, règle anti-fuite |
| `engine/importers/` | Un importeur par famille de jeux PSI, plus le tableau manuel des articles |
| `data/manual/build_partial_gravity.py` | Saisie des données de gravité partielle, page par page |
| `engine/datasets.py` | Un jeu d'analyse par question (jamais de fusion de toutes les sources) |
| `engine/models.py` | Modèles classiques, validation croisée groupée, référence, prédiction conforme |
| `engine/confidence.py` | Moteur de confiance : preuves × accord, matrice, plafonds |
| `engine/scenarios.py` | Les 6 scénarios ; hypothèses de scénario listées à part |
| `engine/pipeline.py` | Exécute tout, écrit `answers.json` et `dashboard.json` |
| `dashboard/` | Application Next.js : Carte, Scénario, Priorités, Sources ; routes serveur Gemini |
| `dashboard/app/api/` | `route-question` (aiguillage) et `explain` (rédaction), avec garde-fous et repli |
| `web/` | Ancienne version statique, en secours |

Travail préparatoire et usage de l'IA : voir [docs/PREPARATION.md](docs/PREPARATION.md).

Outil d'exploration et de pédagogie, pas un outil de décision de vol.
