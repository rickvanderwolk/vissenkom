# Vissenkom

Een digitale vissenkom applicatie waarbij de controls nu in een aparte controller pagina zitten en communiceren via WebSockets.

## Bestanden

- `index.html` - De hoofdpagina met de vissenkom (geen controls meer)
- `controller.html` - De controller pagina met alle knoppen
- `server.js` - Node.js WebSocket server
- `package.json` - Node.js dependencies

## Setup

1. Installeer dependencies:
   ```bash
   npm install
   ```

2. Start de server:
   ```bash
   npm start
   ```

3. Open je browser:
   - **Vissenkom**: http://localhost:3000
   - **Controller**: http://localhost:3000/controller

## Gebruik

1. Open de vissenkom pagina op je hoofdscherm
2. Open de controller pagina op een tweede scherm/tablet/telefoon
3. Gebruik de controller om de vissenkom te besturen:
   - 🍤 **Voeren** - Geef voer aan de vissen (cooldown van 1 uur)
   - 🌙/☀️ **Licht** - Schakel verlichting aan/uit
   - 💡🎉 **Disco** - Schakel disco modus aan/uit
   - 💨 **Pomp** - Schakel de luchtpomp aan/uit
   - 🐟 **Vis toevoegen** - Voeg een nieuwe vis toe met eigen naam

## Technische details

- WebSocket server draait op poort 8080
- HTTP server draait op poort 3000
- Real-time communicatie tussen controller en vissenkom
- Automatische herverbinding bij verbindingsverlies
- Status updates elke 5 seconden

## Features

- ✅ Gescheiden controller interface
- ✅ WebSocket communicatie
- ✅ Real-time status updates
- ✅ Automatische herverbinding
- ✅ Cooldown systeem voor voeren
- ✅ Responsive design voor mobiele controllers
- ✅ **Persistente opslag** - Game state wordt bewaard in `gamestate.json`
- ✅ **Automatische synchronisatie** - State wordt elke 30 seconden opgeslagen
- ✅ **Page refresh ondersteuning** - Vissen en progress blijven behouden
- ✅ **Visuele persistentie** - Kleur, grootte en eigenschappen blijven consistent
- ✅ **Real-time stats sync** - Eet-statistieken worden automatisch gesynchroniseerd
- ✅ **Verbeterde cooldown display** - Slimme tijd formatting (seconden/minuten/uren)
- ✅ **Event logging** - Alle acties worden gelogd in `events.json` met timestamps
- ✅ **Tijdelijke toegangscodes** - Controller access beperkt tot 1 uur via QR code
- ✅ **Automatische code refresh** - Nieuwe codes worden elk uur gegenereerd
