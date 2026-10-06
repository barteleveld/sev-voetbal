# SEV clubsite-concept

Een zelfstandige bestuursdemo voor een nieuwe publieke SEV-website. De visuele clubsite staat inhoudelijk los van het eerder ontwikkelde brandbook, maar biedt een logische doorklik naar `https://sev-brandbook.vercel.app/`.

Live demo: https://sev-voetbal.vercel.app/

## Starten

Dubbelklik op `OPEN-SEV-CLUBSITE.bat`, of open PowerShell in deze map en voer uit:

```powershell
node server.mjs
```

Open daarna `http://localhost:4173`.

De lokale server is nodig voor de automatische nieuwsfeed. Nieuws verschijnt direct vanuit de meegeleverde volledige reserve-index. De openbare bronnen worden daarna op de achtergrond ververst: het laatste nieuws na vijf minuten, het archief en Club van 50 na vijftien minuten. Een lege, mislukte of gedeeltelijke broncontrole mag eerdere berichten niet verwijderen. De datum van de laatste volledige broncontrole blijft zichtbaar als de bron niet bereikbaar is.

De homepage zet nieuws voorop: een korte hero met een directe sprong naar het nieuwsblok en compacte praktische snelkoppelingen. Het archief laadt per 18 berichten, met zoeken en combineerbare jaar- en doelgroepfilters. Op mobiel blijven zoeken en de compacte Filters-knop tijdens het scrollen bereikbaar. De laadregel toont hoeveel berichten al zichtbaar zijn.

De homepage en `/nieuws` tonen uitsluitend clubnieuws. Artikelen met de officiële broncategorie ‘Wedstrijdverslagen’ staan apart op `/wedstrijdverslagen`, met dezelfde zoek-, filter- en laadmogelijkheden. De selectie vindt vóór de limiet en paginering plaats. Beide overzichten hebben eigen browserreserves en sessiegegevens, zodat een eerder gemengd overzicht niet terugkomt. Een inhoudelijk identieke nieuws- en verslagpublicatie blijft in elk van de twee stromen afzonderlijk behouden; titels en URL-patronen bepalen de indeling niet.

Bij terugkeer naar dezelfde archiefvermelding bewaart de browser alle geladen kaarten, filters en de leespositie. Deze sessiegegevens verlopen na 24 uur. Club van 50 toont eerst negen berichten, gebruikt dezelfde compacte mobiele kaarten en laat de bezoeker meer laden. De twee hero-knoppen openen direct de Microsoft-formulieren; de uitleg en formulier-tegels blijven staan.

De drie foto-hero’s gebruiken vooraf geladen WebP-beelden met aparte mobiele formaten, vaste afmetingen en hoge laadprioriteit. De mobiele bestanden zijn 65–107 kB. De originele clubfoto’s blijven ongewijzigd.

‘Nieuw bij SEV?’ biedt de route kiezen → kennismaken → aanmelden. Acht voetbalvormen hebben leesbare uitklapblokken met geverifieerde leeftijden/indeling en hun eigen contactpersoon. Na een keuze toont het vervolgblok de bijbehorende kennismakingsroute; de informatie blijft zonder scripts via de uitklapblokken bereikbaar. De officiële aanmeldknop en de volledige contributietabel 2026–2027 staan op dezelfde pagina, inclusief de voorwaardelijke Ooievaarspaskorting. Contact- en kosteninformatie is statisch en gecontroleerd op 6 oktober 2026; bronverantwoording en hercontrolepunten staan in `docs/instroom-bronnen.md`.

Teamnamen gebruiken de huidige O-aanduiding; MO blijft behouden voor volledige meidenteams. Nieuwskaarten zetten oude JO-varianten automatisch om in titel, fragment, categorielabel en toegankelijke linknaam, ook vanuit een eerder geladen reserve. Oorspronkelijke brondata, artikel-URL's en beeldbestanden blijven intact. Zoeken op bijvoorbeeld JO9 en O9 levert dezelfde resultaten. MO-berichten zijn herkenbaar als jeugd én vrouwen/meiden.

Voor een lokale beeldcontrole zonder cache bij 500 kbit/s en 150 ms beeldvertraging: start naast de gewone server `node scripts/slow-preview.mjs` en open `http://127.0.0.1:4176`. Dit is een gecontroleerde simulatie voor hero-beelden, geen volledige Core Web Vitals- of echte mobiele netwerkmeting.

## Nieuwsreserve onderhouden

```powershell
npm.cmd run news:refresh
npm.cmd test
```

De indexvernieuwing controleert het volledige archief vanaf 2025 en de volledige artikelen met vermeldingen of bedankjes voor Club van 50. Beide collecties moeten volledig zijn voordat de reservebestanden worden vervangen. Eerdere berichten blijven behouden. Dubbele artikelen binnen dezelfde publicatiestroom worden alleen samengevoegd bij een geverifieerde gelijke volledige artikeltekst; dezelfde titel of korte RSS-inleiding is niet voldoende. Ontbrekende en generieke afbeeldingen gebruiken het SEV-logo. Met `npm.cmd run news:refresh -- --news-only` wordt uitsluitend de algemene bronreserve bijgewerkt, eveneens pas na een volledige broncontrole; de Club van 50-reserve blijft dan ongewijzigd.

De voorbereide GitHub-workflow vernieuwt de reserve dagelijks om 05:17 UTC, test de uitkomst en bewaart uitsluitend de twee gecontroleerde indexbestanden. Die workflow wordt pas actief nadat de wijzigingen later naar de standaardbranch zijn geüpload. Er zijn geen extra accounts of sleutels nodig; het bestaande GitHub/Vercel-publicatiepad wordt gebruikt. Bij bronuitval blijven de vorige bestanden intact en mislukt de controle zichtbaar. Zonder actieve workflow vernieuwen openbare nieuwsaanvragen wel op de achtergrond, maar blijft de duurzame reserve op de laatste opgeslagen versie staan.

## Pagina's

- `/` — homepage
- `/nieuws` — clubnieuws met zoeken en filters, zonder wedstrijdverslagen
- `/wedstrijdverslagen` — afzonderlijk verslagarchief met zoeken en filters
- `/de-investering` — Club van 50, formulieren en bijbehorende nieuwsberichten
- `/clubzaken` — praktische clubinformatie en vervolgpagina's
- `/wedstrijden` — concept voor het wedstrijdcentrum
- `/lid-worden` — kiezen, kennismaken en aanmelden, met contactroutes en contributie

## Publicatie

De map bevat Vercel-functies op `/api/news` en `/api/investering-news`. Die laten broncontroles na de reactie veilig doorlopen via `waitUntil`. Installeer de vastgelegde afhankelijkheden met `npm ci`; publiceer pas op expliciet verzoek. Lokale aanpassingen zijn niet automatisch online zichtbaar.
