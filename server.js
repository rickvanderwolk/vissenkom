const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load package.json for version info
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const VERSION = packageInfo.version;

// Create HTTP server for serving files
const server = http.createServer((req, res) => {
    let filePath = '';

    // Parse URL to handle query parameters
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else if (pathname === '/controller' || pathname === '/controller.html') {
        filePath = path.join(__dirname, 'controller.html');
    } else {
        res.writeHead(404);
        res.end('File not found');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = ext === '.html' ? 'text/html' : 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// Create WebSocket server (will be attached to HTTP server later)

// State file path
const STATE_FILE = path.join(__dirname, 'gamestate.json');
const EVENT_LOG_FILE = path.join(__dirname, 'events.json');

// Store application state
let appState = {
    lightsOn: true,
    discoOn: false,
    pumpOn: false,
    lastFed: 0,
    feedCooldown: 60 * 60 * 1000, // 1 hour in milliseconds
    fishes: [],
    deadLog: [],
    fishCounter: 1,
    currentAccessCode: '',
    accessCodeExpiry: 0,
    poopCount: 0 // Track amount of poop in tank
};

// Load existing state from file
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const savedState = JSON.parse(data);

            // Merge saved state with default state
            appState = { ...appState, ...savedState };

            // Load access code if it exists and is still valid
            if (appState.currentAccessCode && appState.accessCodeExpiry) {
                currentAccessCode = appState.currentAccessCode;
                accessCodeExpiry = appState.accessCodeExpiry;

                if (Date.now() < accessCodeExpiry) {
                    console.log(`Toegangscode behouden: ${currentAccessCode} (geldig tot ${new Date(accessCodeExpiry).toLocaleTimeString()})`);
                } else {
                    console.log('Opgeslagen toegangscode is verlopen, genereer nieuwe');
                    generateAccessCode();
                }
            } else {
                generateAccessCode();
            }

            console.log('Game state geladen uit bestand');
            console.log(`Geladen: ${appState.fishes.length} vissen, ${appState.deadLog.length} overleden vissen`);
        } else {
            console.log('Geen bestaande game state gevonden, start met fresh state');
            generateAccessCode();
        }
    } catch (error) {
        console.error('Fout bij laden game state:', error);
        console.log('Start met fresh state');
        generateAccessCode();
    }
}

// Save state to file
function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2));
        console.log('Game state opgeslagen');
    } catch (error) {
        console.error('Fout bij opslaan game state:', error);
    }
}

// Auto-save state every 30 seconds
setInterval(() => {
    saveState();
}, 30000);

// Event logging system
let eventLog = [];

function loadEventLog() {
    try {
        if (fs.existsSync(EVENT_LOG_FILE)) {
            const data = fs.readFileSync(EVENT_LOG_FILE, 'utf8');
            eventLog = JSON.parse(data);
            console.log(`Event log geladen: ${eventLog.length} events`);
        } else {
            console.log('Geen bestaande event log gevonden, start met lege log');
        }
    } catch (error) {
        console.error('Fout bij laden event log:', error);
        eventLog = [];
    }
}

function saveEventLog() {
    try {
        fs.writeFileSync(EVENT_LOG_FILE, JSON.stringify(eventLog, null, 2));
    } catch (error) {
        console.error('Fout bij opslaan event log:', error);
    }
}

function logEvent(type, data = {}) {
    const event = {
        timestamp: Date.now(),
        type: type,
        data: data
    };

    eventLog.push(event);
    console.log(`Event gelogd: ${type}`, data);

    // Keep only last 1000 events to prevent file from growing too large
    if (eventLog.length > 1000) {
        eventLog = eventLog.slice(-1000);
    }

    // Save immediately for important events
    saveEventLog();
}

// Connected clients - separate controllers from main app
const controllers = new Set();
const mainApps = new Set();

// Access code system
let currentAccessCode = '';
let accessCodeExpiry = 0;

function generateAccessCode() {
    // Generate 6-digit code
    currentAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
    accessCodeExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now

    // Save to appState so it persists across restarts
    appState.currentAccessCode = currentAccessCode;
    appState.accessCodeExpiry = accessCodeExpiry;

    console.log(`Nieuwe toegangscode gegenereerd: ${currentAccessCode} (geldig tot ${new Date(accessCodeExpiry).toLocaleTimeString()})`);

    // Log the access code generation
    logEvent('access_code_generated', {
        code: currentAccessCode,
        expiresAt: accessCodeExpiry,
        validFor: '1 hour'
    });

    // Save state immediately to persist the new access code
    saveState();

    // Broadcast new access code to all main apps for QR update
    broadcastNewAccessCode();

    return currentAccessCode;
}

function isValidAccessCode(code) {
    const now = Date.now();
    if (now > accessCodeExpiry) {
        console.log('Toegangscode verlopen');
        return false;
    }

    if (code !== currentAccessCode) {
        console.log('Ongeldige toegangscode:', code);
        return false;
    }

    return true;
}

function getCurrentAccessCode() {
    const now = Date.now();
    if (now > accessCodeExpiry) {
        generateAccessCode();
    }
    return currentAccessCode;
}

// Load state on startup
loadState();
loadEventLog();



function handleCommand(data, fromClient) {
    console.log('Ontvangen commando:', data);

    switch (data.command) {
        case 'feed':
            handleFeed();
            break;
        case 'toggleLight':
            handleToggleLight();
            break;
        case 'toggleDisco':
            handleToggleDisco();
            break;
        case 'togglePump':
            handleTogglePump();
            break;
        case 'cleanTank':
            handleCleanTank();
            break;
        case 'reportPoop':
            handleReportPoop(data.poopCount);
            break;
        case 'addFish':
            handleAddFish(data.name);
            break;
        case 'getStatus':
            sendStatusUpdate(fromClient);
            sendFeedCooldownUpdate(fromClient);
            break;
        case 'getGameState':
            sendGameState(fromClient);
            break;
        case 'fishDied':
            handleFishDied(data.fish);
            break;
        case 'updateFishStats':
            handleUpdateFishStats(data.fishName, data.stats);
            break;
        case 'getAccessCode':
            sendAccessCode(fromClient);
            break;
        case 'getVersion':
            sendToClient(fromClient, { type: 'version', version: VERSION });
            break;
        default:
            console.log('Onbekend commando:', data.command);
    }
}

function handleFeed() {
    const now = Date.now();
    if (now - appState.lastFed < appState.feedCooldown) {
        console.log('Voeren nog in cooldown');
        return;
    }

    appState.lastFed = now;
    console.log('Vissen gevoerd!');

    // Log event
    logEvent('feed', {
        timestamp: now,
        cooldownMinutes: appState.feedCooldown / 60000
    });

    // Broadcast to all main application windows
    broadcastToMainApp({ command: 'feed' });

    // Update cooldown status for controllers
    broadcastFeedCooldownUpdate();
}

function handleToggleLight() {
    appState.lightsOn = !appState.lightsOn;
    console.log('Licht omgeschakeld:', appState.lightsOn ? 'aan' : 'uit');

    // Log event
    logEvent('light_toggle', {
        state: appState.lightsOn ? 'aan' : 'uit'
    });

    broadcastToMainApp({ command: 'toggleLight' });
    broadcastStatusUpdate(); // This will update all controllers
    saveState(); // Save state immediately for status changes
}

function handleToggleDisco() {
    appState.discoOn = !appState.discoOn;
    console.log('Disco omgeschakeld:', appState.discoOn ? 'aan' : 'uit');

    // Log event
    logEvent('disco_toggle', {
        state: appState.discoOn ? 'aan' : 'uit'
    });

    broadcastToMainApp({ command: 'toggleDisco' });
    broadcastStatusUpdate(); // This will update all controllers
    saveState(); // Save state immediately for status changes
}

function handleTogglePump() {
    appState.pumpOn = !appState.pumpOn;
    console.log('Pomp omgeschakeld:', appState.pumpOn ? 'aan' : 'uit');

    // Log event
    logEvent('pump_toggle', {
        state: appState.pumpOn ? 'aan' : 'uit'
    });

    broadcastToMainApp({ command: 'togglePump' });
    broadcastStatusUpdate(); // This will update all controllers
    saveState(); // Save state immediately for status changes
}

function handleCleanTank() {
    console.log('Tank wordt opgeruimd - alle poep weggehaald');

    // Reset poop count
    appState.poopCount = 0;

    // Log event
    logEvent('tank_cleaned', {
        timestamp: Date.now(),
        poopCleaned: appState.poopCount
    });

    broadcastToMainApp({ command: 'cleanTank' });
    broadcastStatusUpdate(); // Update controllers with new poop status
    saveState(); // Save state immediately
}

function handleReportPoop(poopCount) {
    if (typeof poopCount === 'number' && poopCount >= 0) {
        appState.poopCount = Math.max(0, poopCount);
        console.log('Poep count gerapporteerd:', appState.poopCount);

        // Broadcast status update to controllers
        broadcastStatusUpdate();

        // Auto-save will handle persistence (every 30s)
    }
}

function handleAddFish(name) {
    if (!name || name.trim() === '') {
        console.log('Ongeldige visnaam');
        return;
    }

    const fishName = name.trim();

    // Generate visual properties (same ranges as original client code)
    const fishData = {
        name: fishName,
        addedAt: Date.now(),
        bornAt: Date.now(),
        lastEat: Date.now(),
        eats: 0,
        // Visual properties
        baseSize: Math.floor(Math.random() * (30 - 18 + 1)) + 18, // 18-30
        hue: Math.floor(Math.random() * 360), // 0-360
        speed: Math.random() * (1.2 - 0.7) + 0.7, // 0.7-1.2
        sickTop: Math.random() < 0.5,
        hungerWindow: (2 * 24 * 60 * 60 * 1000) * (Math.random() * (1.1 - 0.9) + 0.9) // DAY * rand(0.9, 1.1)
    };

    appState.fishes.push(fishData);
    appState.fishCounter++;

    console.log('Vis toegevoegd:', fishName, 'met eigenschappen:', {
        baseSize: fishData.baseSize,
        hue: fishData.hue,
        speed: fishData.speed
    });

    // Log event
    logEvent('fish_added', {
        name: fishName,
        baseSize: fishData.baseSize,
        hue: fishData.hue,
        speed: fishData.speed,
        fishCounter: appState.fishCounter
    });

    broadcastToMainApp({
        command: 'addFish',
        fishData: fishData,
        fishCounter: appState.fishCounter
    });
    saveState(); // Save state after adding fish
}

function sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

function broadcastToMainApp(command) {
    console.log('Verstuur naar main apps:', command);
    mainApps.forEach(client => {
        sendToClient(client, command);
    });
}

function broadcastStatusUpdate() {
    const statusMessage = {
        type: 'status',
        data: {
            lightsOn: appState.lightsOn,
            discoOn: appState.discoOn,
            pumpOn: appState.pumpOn,
            poopCount: appState.poopCount
        }
    };

    controllers.forEach(client => {
        sendToClient(client, statusMessage);
    });
}

function sendStatusUpdate(client) {
    const statusMessage = {
        type: 'status',
        data: {
            lightsOn: appState.lightsOn,
            discoOn: appState.discoOn,
            pumpOn: appState.pumpOn,
            poopCount: appState.poopCount
        }
    };

    sendToClient(client, statusMessage);
}

function broadcastFeedCooldownUpdate() {
    controllers.forEach(client => {
        sendFeedCooldownUpdate(client);
    });
}

function sendFeedCooldownUpdate(client) {
    const now = Date.now();
    const timeLeft = Math.max(0, appState.feedCooldown - (now - appState.lastFed));
    const canFeed = timeLeft <= 0;

    const cooldownMessage = {
        type: 'feedCooldown',
        data: {
            canFeed,
            timeLeft,
            lastFed: appState.lastFed
        }
    };

    sendToClient(client, cooldownMessage);
}

function sendGameState(client) {
    const gameStateMessage = {
        type: 'gameState',
        data: {
            fishes: appState.fishes,
            deadLog: appState.deadLog,
            fishCounter: appState.fishCounter,
            lastFed: appState.lastFed,
            lightsOn: appState.lightsOn,
            discoOn: appState.discoOn,
            pumpOn: appState.pumpOn,
            poopCount: appState.poopCount
        }
    };

    sendToClient(client, gameStateMessage);
}

function handleFishDied(deadFish) {
    console.log('Vis overleden:', deadFish.name);
    appState.deadLog.push(deadFish);

    // Log event
    logEvent('fish_died', {
        name: deadFish.name,
        age: deadFish.diedAt - deadFish.bornAt,
        lifespan: Math.round((deadFish.diedAt - deadFish.bornAt) / (24 * 60 * 60 * 1000) * 10) / 10 // days
    });

    // Remove fish from active list if it exists
    appState.fishes = appState.fishes.filter(f => f.name !== deadFish.name);

    saveState(); // Save state after fish dies
}

function handleUpdateFishStats(fishName, stats) {
    const fish = appState.fishes.find(f => f.name === fishName);
    if (fish) {
        // Update fish statistics
        if (stats.eats !== undefined) fish.eats = stats.eats;
        if (stats.lastEat !== undefined) fish.lastEat = stats.lastEat;

        console.log(`Stats bijgewerkt voor ${fishName}: eats=${fish.eats}`);

        // Auto-save will handle persistence (every 30s)
    }
}

function sendAccessCode(client) {
    const code = getCurrentAccessCode();
    const accessCodeMessage = {
        type: 'accessCode',
        code: code,
        expiresAt: accessCodeExpiry
    };

    sendToClient(client, accessCodeMessage);
}

function broadcastNewAccessCode() {
    const accessCodeMessage = {
        type: 'accessCode',
        code: currentAccessCode,
        expiresAt: accessCodeExpiry
    };

    console.log('Broadcasting nieuwe access code naar main apps:', currentAccessCode);
    mainApps.forEach(client => {
        sendToClient(client, accessCodeMessage);
    });
}

// Update feed cooldown every second
setInterval(() => {
    broadcastFeedCooldownUpdate();
}, 1000);

// Broadcast status updates every 5 seconds to keep controllers in sync
setInterval(() => {
    if (controllers.size > 0) {
        broadcastStatusUpdate();
    }
}, 5000);

// Check and regenerate access code every hour
setInterval(() => {
    const now = Date.now();
    if (now > accessCodeExpiry) {
        console.log('Access code verlopen, genereer nieuwe...');
        generateAccessCode();
    }
}, 60 * 60 * 1000); // Every hour

// Create WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    console.log('Nieuwe client verbonden');

    // Parse URL for access code validation
    const url = new URL(req.url, `http://${req.headers.host}`);
    const providedCode = url.searchParams.get('code');

    // Determine client type based on URL or user agent
    const isController = req.url && req.url.includes('controller') ||
                        req.headers['user-agent'] && req.headers['user-agent'].includes('controller');

    if (isController) {
        // Validate access code for controller connections
        if (!providedCode || !isValidAccessCode(providedCode)) {
            console.log('Controller ongeldige code:', providedCode);

            // Send error and close connection
            sendToClient(ws, {
                type: 'accessDenied',
                message: 'Ongeldige code. Scan de QR code opnieuw.'
            });

            setTimeout(() => ws.close(), 1000);
            return;
        }

        controllers.add(ws);
        console.log('Controller verbonden met geldige code');

        // Log successful access
        logEvent('controller_access', {
            code: providedCode,
            timestamp: Date.now()
        });

        // Send initial status to controller
        sendToClient(ws, {
            type: 'status',
            data: {
                lightsOn: appState.lightsOn,
                discoOn: appState.discoOn,
                pumpOn: appState.pumpOn
            }
        });
        sendFeedCooldownUpdate(ws);
    } else {
        mainApps.add(ws);
        console.log('Main app verbonden');
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Mark this connection as a controller if it sends commands
            if (data.command && !controllers.has(ws) && !mainApps.has(ws)) {
                controllers.add(ws);
                console.log('Client gemarkeerd als controller');
            }

            handleCommand(data, ws);
        } catch (error) {
            console.error('Fout bij verwerken bericht:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client verbinding gesloten');
        controllers.delete(ws);
        mainApps.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket fout:', error);
        controllers.delete(ws);
        mainApps.delete(ws);
    });
});

// Start HTTP server
server.listen(3000, () => {
    console.log('HTTP server luistert op http://localhost:3000');
    console.log('WebSocket server gestart op dezelfde poort (3000)');
    console.log('Bezoek http://localhost:3000 voor de vissenkom');
    console.log('Bezoek http://localhost:3000/controller voor de controller');
});