# SEV clubsite-concept

Een zelfstandige bestuursdemo voor een nieuwe publieke SEV-website. De visuele clubsite staat inhoudelijk los van het eerder ontwikkelde brandbook, maar biedt een logische doorklik naar `https://sev-brandbook.vercel.app/`.

## Starten

Dubbelklik op `OPEN-SEV-CLUBSITE.bat`, of open PowerShell in deze map en voer uit:

```powershell
node server.mjs
```

Open daarna `http://localhost:4173`.

De lokale server is nodig voor de automatische nieuwsfeed. De server haalt de openbare RSS-feed van `sev-voetbal.nl` op, zet deze om naar veilige JSON en bewaart het resultaat vijf minuten in het geheugen. De website toont een lokale reserveweergave wanneer de bron tijdelijk niet bereikbaar is.

## Pagina's

- `/` — homepage
- `/nieuws` — volledig nieuwsoverzicht met zoekfunctie
- `/wedstrijden` — concept voor het wedstrijdcentrum
- `/lid-worden` — wervende instroompagina met echte SEV-aanmeldroutes

## Publicatie

De map bevat ook een Vercel-functie op `/api/news`. Daardoor kan hetzelfde concept zonder inhoudelijke wijziging als Vercel-demo worden gepubliceerd.
