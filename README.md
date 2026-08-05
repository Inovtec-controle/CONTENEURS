# CONTENEURS

Application de suivi des sorties et rentrées de conteneurs.

- `index.html` : page mobile des agents avec une tuile par chantier.
- `dashboard.html` : suivi des interventions prévues, réalisées ou signalées.
- `administration.html` : programmation des tuiles récurrentes.

## Lien personnel d’un agent

```text
https://inovtec-controle.github.io/CONTENEURS/?agent=michel
```

## Mise en ligne

Dans **Settings > Pages**, choisir **Deploy from a branch**, puis `main` et `/(root)`.

## Données Firebase

Le projet Firebase `inovtec-chantiers` est utilisé avec les collections :

- `conteneurs_plannings`
- `conteneurs_pointages`
