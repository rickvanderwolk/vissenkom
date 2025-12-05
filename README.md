# Vissenkom

<img src="assets/preview2-optimized.png" width="49%" /> <img src="assets/preview3-optimized.png" width="49%" />

Virtuele vissenkom met remote control. Scan de QR-code met je telefoon (max. 1 uur geldig) en voeg vissen toe, geef ze voer, bedien het licht en de pomp, maak de kom schoon, etc.

## ⚠️ Waarschuwing

Dit project is volledig gemaakt met AI. Eerlijk gezegd weet ik niet precies wat er op de achtergrond gebeurt. Gebruik op eigen risico.
## Setup

1. Installeer dependencies:
```
npm install
```

2. Start de server:
```
npm start
```

3. Open je browser:

Ga naar http://localhost:3000

## Zelf hosten (Railway)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/YlW9Ln)

1. Klik op de knop hierboven en volg de stappen
2. Na deployment: ga naar je service → **Settings** → **Networking** → **Generate Domain**
3. (Optioneel) Voor persistente data: **Add Volume** → Mount path `/data`
4. Open de gegenereerde URL in je browser

Zonder volume gaat je data (vissen, events) verloren bij een redeploy. Met volume blijft alles behouden.

Gratis tier beschikbaar (~500 uur/maand).

## Configuratie (optioneel)

De applicatie werkt direct zonder configuratie. Als je de footer in de controller wilt aanpassen, kopieer dan `config.example.json` naar `config.json` en pas de waarden aan:

```bash
cp config.example.json config.json
```

Beschikbare opties:
- `footerText`: Tekst in de footer (bijv. "Powered by Vissenkom")
- `footerLink`: URL waar de footer naartoe linkt (optioneel)

## Credits

Geluidseffecten:
- Bell notification sound via [Pixabay](https://pixabay.com/sound-effects/bell-notification-337658/)
