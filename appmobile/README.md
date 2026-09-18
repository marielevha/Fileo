# Fileo Mobile

Application mobile Expo pour les ateliers Fileo.

## Demarrage

```powershell
cd appmobile
npm run start
```

Pour tester contre l'API locale depuis un telephone physique, remplacez
`localhost` par l'adresse IP de la machine qui lance Next.js :

```powershell
$env:EXPO_PUBLIC_FILEO_API_URL="http://192.168.x.x:3000/api/mobile/v1"
npm run start
```

## Structure

- `app/` : routes Expo Router.
- `src/api/` : client HTTP vers `/api/mobile/v1`.
- `src/components/` : composants UI reutilisables.
- `src/features/` : ecrans organises par domaine produit.
- `src/theme/` : couleurs et espacements Fileo.
- `src/types/` : types partages pour les reponses API.
