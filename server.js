const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load package.json for version info
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const VERSION = packageInfo.version;

// Load config.json for customizable settings
let config = {
    showFooter: true,
    footerLink: 'https://github.com/rickvanderwolk/vissenkom',
    footerLinkText: 'View on GitHub'
};
try {
    const configFile = path.join(__dirname, 'config.json');
    if (fs.existsSync(configFile)) {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        config = { ...config, ...configData };
        console.log('Config geladen:', config);
    }
} catch (error) {
    console.error('Fout bij laden config:', error);
}

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
    } else if (pathname.startsWith('/node_modules/')) {
        // Serve npm packages from node_modules
        filePath = path.join(__dirname, pathname);
    } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
        // Serve CSS and JS files
        filePath = path.join(__dirname, pathname);
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
        let contentType = 'text/plain';
        if (ext === '.html') {
            contentType = 'text/html';
        } else if (ext === '.js') {
            contentType = 'application/javascript';
        } else if (ext === '.css') {
            contentType = 'text/css';
        }

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
    poopCount: 0, // Track amount of poop in tank
    waterGreenness: 0, // Track water algae level (0-100)
    lastMedicine: 0, // Last time medicine was added
    medicineCooldown: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    temperature: 24, // Current water temperature in °C
    heatingOn: true // Heating thermostat on/off
};

// Track last broadcasted waterGreenness to avoid unnecessary updates
let lastBroadcastedGreenness = 0;

// Load existing state from file
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const savedState = JSON.parse(data);

            // Merge saved state with default state
            appState = { ...appState, ...savedState };

            // Initialize lastBroadcastedGreenness with loaded value
            lastBroadcastedGreenness = appState.waterGreenness || 0;

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

// Get room temperature based on current season (real calendar)
function getRoomTemperature() {
    const month = new Date().getMonth(); // 0-11

    if (month === 11 || month === 0 || month === 1) return 16;  // Winter: dec, jan, feb
    if (month >= 2 && month <= 4) return 19;                     // Spring: mar, apr, may
    if (month >= 5 && month <= 7) return 24;                     // Summer: jun, jul, aug
    return 19;                                                    // Autumn: sep, oct, nov
}

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

    // Save immediately for important events
    saveEventLog();

    // Broadcast updated activity list to all main apps
    broadcastRecentActivity();
}

function broadcastRecentActivity() {
    const recentEvents = eventLog.slice(-9);
    const activityMessage = {
        type: 'recentActivity',
        events: recentEvents
    };

    mainApps.forEach(client => {
        sendToClient(client, activityMessage);
    });
}

// Connected clients - separate controllers from main app
const controllers = new Set();
const mainApps = new Set();

// Access code system
let currentAccessCode = '';
let accessCodeExpiry = 0;

function disconnectAllControllers() {
    if (controllers.size > 0) {
        console.log(`🚪 Disconnecting ${controllers.size} controller(s) due to expired access code`);
        controllers.forEach(client => {
            try {
                // Send a message indicating the code has expired
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify({
                        error: 'Access code expired',
                        message: 'Your access code has expired. Please refresh and enter the new code.'
                    }));
                }
                // Close the connection
                client.close(1000, 'Access code expired');
            } catch (error) {
                console.error('Error disconnecting controller:', error);
            }
        });
        controllers.clear();
    }
}

function generateAccessCode() {
    // Disconnect all existing controllers before generating new code
    disconnectAllControllers();

    // Generate 6-digit code
    currentAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
    accessCodeExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now

    // Save to appState so it persists across restarts
    appState.currentAccessCode = currentAccessCode;
    appState.accessCodeExpiry = accessCodeExpiry;

    console.log(`🔑 Nieuwe toegangscode gegenereerd: ${currentAccessCode} (geldig tot ${new Date(accessCodeExpiry).toLocaleTimeString()})`);

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
        case 'refreshWater':
            handleRefreshWater();
            break;
        case 'tapGlass':
            handleTapGlass();
            break;
        case 'reportPoop':
            handleReportPoop(data.poopCount);
            break;
        case 'reportWaterGreenness':
            handleReportWaterGreenness(data.waterGreenness);
            break;
        case 'addFish':
            handleAddFish(data.name);
            break;
        case 'addMedicine':
            handleAddMedicine();
            break;
        case 'getStatus':
            sendStatusUpdate(fromClient);
            sendFeedCooldownUpdate(fromClient);
            sendMedicineCooldownUpdate(fromClient);
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
        case 'getConfig':
            sendToClient(fromClient, { type: 'config', config: config });
            break;
        case 'getRecentActivity':
            sendRecentActivity(fromClient);
            break;
        case 'toggleHeating':
            handleToggleHeating();
            break;
        default:
            console.log('Onbekend commando:', data.command);
    }
}

function handleFeed() {
    const now = Date.now();
    if (now - appState.lastFed < appState.feedCooldown) {
        console.log('Voeren nog in cooldown');
        // Send cooldown status to controllers so they know it's not allowed
        broadcastFeedCooldownUpdate();
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

function handleToggleHeating() {
    appState.heatingOn = !appState.heatingOn;
    console.log('Verwarming omgeschakeld:', appState.heatingOn ? 'aan' : 'uit');

    // Log event
    logEvent('heating_toggle', {
        state: appState.heatingOn ? 'aan' : 'uit',
        currentTemp: appState.temperature,
        roomTemp: getRoomTemperature()
    });

    broadcastStatusUpdate();
    saveState();
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

function handleRefreshWater() {
    const oldGreenness = appState.waterGreenness;
    console.log(`💧 Water wordt ververst - greenness van ${oldGreenness.toFixed(2)}% naar 0%`);

    // Reset water greenness
    appState.waterGreenness = 0;
    lastBroadcastedGreenness = 0; // Reset tracking variable

    // Log event
    logEvent('water_refreshed', {
        timestamp: Date.now(),
        oldGreenness: oldGreenness,
        newGreenness: 0
    });

    broadcastToMainApp({ command: 'refreshWater' });
    broadcastStatusUpdate(); // Update controllers with new water status (always needed here)
    saveState(); // Save state immediately
}

function handleTapGlass() {
    console.log('👊 Er wordt op het glas getikt - vissen schrikken!');

    // Log event
    logEvent('glass_tapped', {
        timestamp: Date.now()
    });

    // Broadcast to main app to scare all fish
    broadcastToMainApp({ command: 'tapGlass' });
}

function handleAddMedicine() {
    const now = Date.now();
    if (now - appState.lastMedicine < appState.medicineCooldown) {
        console.log('Medicine nog in cooldown');
        // Send cooldown status to controllers
        broadcastMedicineCooldownUpdate();
        return;
    }

    appState.lastMedicine = now;
    console.log('💊 Medicine toegevoegd aan tank!');

    // Medicate all sick fish
    let medicatedCount = 0;
    appState.fishes.forEach(fish => {
        if (fish.sick) {
            fish.medicated = true;
            fish.medicatedAt = now;
            medicatedCount++;
        }
    });

    // Log event
    logEvent('medicine_added', {
        timestamp: now,
        fishMedicated: medicatedCount,
        cooldownHours: appState.medicineCooldown / (60 * 60 * 1000)
    });

    // Broadcast to main app to update visuals
    broadcastToMainApp({ command: 'addMedicine' });

    // Update cooldown status for controllers
    broadcastMedicineCooldownUpdate();

    // Save state
    saveState();
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

function handleReportWaterGreenness(waterGreenness) {
    if (typeof waterGreenness === 'number' && waterGreenness >= 0 && waterGreenness <= 100) {
        appState.waterGreenness = waterGreenness;
        console.log('Water greenness gerapporteerd:', appState.waterGreenness.toFixed(2) + '%');

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
        hungerWindow: (2 * 24 * 60 * 60 * 1000) * (Math.random() * (1.1 - 0.9) + 0.9), // DAY * rand(0.9, 1.1)
        // Disease properties
        sick: false,
        sickStartedAt: null,
        medicated: false,
        medicatedAt: null,
        health: 100
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
    const sickCount = appState.fishes.filter(f => f.sick).length;

    const statusMessage = {
        type: 'status',
        data: {
            lightsOn: appState.lightsOn,
            discoOn: appState.discoOn,
            pumpOn: appState.pumpOn,
            poopCount: appState.poopCount,
            waterGreenness: appState.waterGreenness,
            sickFishCount: sickCount,
            temperature: appState.temperature,
            heatingOn: appState.heatingOn,
            roomTemperature: getRoomTemperature()
        }
    };

    // Broadcast to controllers
    controllers.forEach(client => {
        sendToClient(client, statusMessage);
    });

    // Also broadcast to main apps for real-time water greenness updates
    mainApps.forEach(client => {
        sendToClient(client, statusMessage);
    });
}

function sendStatusUpdate(client) {
    const sickCount = appState.fishes.filter(f => f.sick).length;

    const statusMessage = {
        type: 'status',
        data: {
            lightsOn: appState.lightsOn,
            discoOn: appState.discoOn,
            pumpOn: appState.pumpOn,
            poopCount: appState.poopCount,
            waterGreenness: appState.waterGreenness,
            sickFishCount: sickCount,
            temperature: appState.temperature,
            heatingOn: appState.heatingOn,
            roomTemperature: getRoomTemperature()
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

function broadcastMedicineCooldownUpdate() {
    controllers.forEach(client => {
        sendMedicineCooldownUpdate(client);
    });
}

function sendMedicineCooldownUpdate(client) {
    const now = Date.now();
    const timeLeft = Math.max(0, appState.medicineCooldown - (now - appState.lastMedicine));
    const canAddMedicine = timeLeft <= 0;

    const cooldownMessage = {
        type: 'medicineCooldown',
        data: {
            canAddMedicine,
            timeLeft,
            lastMedicine: appState.lastMedicine
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
            poopCount: appState.poopCount,
            waterGreenness: appState.waterGreenness
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

    console.log('📡 Broadcasting nieuwe access code naar main apps:', currentAccessCode, `(${mainApps.size} clients)`);
    mainApps.forEach(client => {
        sendToClient(client, accessCodeMessage);
    });
}

function sendRecentActivity(client) {
    const recentEvents = eventLog.slice(-9);
    const activityMessage = {
        type: 'recentActivity',
        events: recentEvents
    };

    sendToClient(client, activityMessage);
}

// Note: Feed and medicine cooldown updates are now only sent when actions occur.
// Controllers handle their own countdown timers for smooth UX.
// Status updates every 5 seconds act as sync check to correct any drift.

// Broadcast status updates every 5 seconds to keep controllers in sync
setInterval(() => {
    if (controllers.size > 0) {
        broadcastStatusUpdate();
    }
}, 5000);

// Auto-regenerate access code 10 minutes before expiry (50 minutes interval for 1 hour codes)
setInterval(() => {
    console.log('🔄 Auto-regenerating access code for QR update...');
    generateAccessCode();
    broadcastNewAccessCode();
}, 50 * 60 * 1000); // Every 50 minutes (10 minute buffer before 1 hour expiry)

// Temperature regulation with smart thermostat (every 5 minutes)
setInterval(() => {
    const roomTemp = getRoomTemperature();

    // Calculate heat from lights (fixed amounts)
    let heatFromLights = 0;
    if (appState.lightsOn) heatFromLights += 0.5; // Lights add 0.5°C
    if (appState.discoOn) heatFromLights += 1.0;  // Disco adds 1.0°C

    const naturalTemp = roomTemp + heatFromLights; // Temp without heating
    const targetTemp = 24; // Thermostat target

    if (appState.heatingOn) {
        // Thermostat mode: maintain 24°C
        if (appState.temperature < targetTemp) {
            // Too cold: heating works
            appState.temperature += 0.2;
        } else if (appState.temperature > targetTemp) {
            // Too warm: heating off, cools down
            appState.temperature -= 0.1;
        }
        // Don't exceed target temp
        appState.temperature = Math.min(targetTemp, appState.temperature);
    } else {
        // Heating off: move toward natural temp
        if (appState.temperature < naturalTemp) {
            appState.temperature += 0.1;
        } else if (appState.temperature > naturalTemp) {
            appState.temperature -= 0.1;
        }
    }

    // Absolute safety limits
    appState.temperature = Math.max(15, Math.min(35, appState.temperature));

    // Broadcast update
    broadcastStatusUpdate();
}, 5 * 60 * 1000); // Every 5 minutes

// Water greenness increases over time (algae growth)
// Base: +0.07% every 5 minutes = 100% in ~5 days (120 hours)
setInterval(() => {
    if (appState.waterGreenness < 100) {
        // Base growth rate
        let growthRate = 0.07;

        // Temperature modifier (primary factor for cold, secondary for warm)
        const temp = appState.temperature;
        let tempModifier = 1.0;
        if (temp < 18) tempModifier = 0.3;      // Very cold = almost no growth
        else if (temp < 22) tempModifier = 0.7; // Cool = slow growth
        else tempModifier = 1.0;                // Warm = normal growth

        // Light modifier (primary factor)
        let lightModifier = 1.0;
        if (!appState.lightsOn) lightModifier = 0.5;  // Dark = very slow
        if (appState.discoOn) lightModifier = 2.0;     // Disco = explosive growth

        // Calculate final growth
        growthRate = growthRate * tempModifier * lightModifier;

        appState.waterGreenness = Math.min(100, appState.waterGreenness + growthRate);
        console.log(`🌿 Water greenness increased to ${appState.waterGreenness.toFixed(2)}% (temp: ${temp.toFixed(1)}°C, rate: ${growthRate.toFixed(3)})`);

        // Only broadcast if greenness changed significantly (>= 0.5%)
        if (Math.abs(appState.waterGreenness - lastBroadcastedGreenness) >= 0.5) {
            broadcastStatusUpdate();
            lastBroadcastedGreenness = appState.waterGreenness;
        }

        // Log significant milestones
        const rounded = Math.round(appState.waterGreenness);
        if (rounded === 25 || rounded === 50 || rounded === 75 || rounded === 100) {
            logEvent('water_greenness_milestone', {
                greenness: appState.waterGreenness,
                level: rounded,
                temperature: appState.temperature,
                tempModifier: tempModifier,
                lightModifier: lightModifier
            });
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Disease health loss and temperature damage - every 10 minutes
setInterval(() => {
    const now = Date.now();
    const temp = appState.temperature;
    let healthChanged = false;

    appState.fishes.forEach(fish => {
        if (!fish.health) fish.health = 100; // Initialize health if missing

        // Temperature stress damage
        let tempDamage = 0;
        if (temp < 18) tempDamage = -0.5;      // Cold: -0.5%/hour = -0.083%/10min
        if (temp < 16) tempDamage = -1.0;      // Very cold: -1%/hour = -0.167%/10min
        if (temp > 30) tempDamage = -1.0;      // Hot: -1%/hour
        if (temp > 32) tempDamage = -2.0;      // Very hot: -2%/hour

        if (tempDamage < 0) {
            fish.health = Math.max(0, fish.health + (tempDamage / 6)); // /6 because every 10 min
            healthChanged = true;
        }

        if (fish.sick && !fish.medicated) {
            // Sick fish lose health
            fish.health = Math.max(0, fish.health - 0.5);
            healthChanged = true;

            // Log critical health
            if (fish.health <= 30 && fish.health > 29.5) {
                logEvent('fish_critical_health', {
                    name: fish.name,
                    health: fish.health,
                    temperature: temp
                });
                console.log(`⚠️ ${fish.name} is in critical condition (${fish.health.toFixed(1)}% health)`);
            }

            // Check if fish died from disease
            if (fish.health <= 0) {
                console.log(`💀 ${fish.name} died from disease/temperature`);
                logEvent('fish_died_disease', {
                    name: fish.name,
                    temperature: temp,
                    sickDuration: now - fish.sickStartedAt
                });
                // Will be handled by client's death detection
            }
        } else if (fish.medicated) {
            // Medicated fish recover health slowly
            fish.health = Math.min(100, fish.health + 2); // +2% per 10 minutes
            healthChanged = true;

            // Check if fully recovered
            if (fish.health >= 100 && fish.sick) {
                fish.sick = false;
                fish.sickStartedAt = null;
                fish.medicated = false;
                fish.medicatedAt = null;
                console.log(`✅ ${fish.name} fully recovered!`);
                logEvent('fish_recovered', {
                    name: fish.name
                });
            }
        }
    });

    if (healthChanged) {
        broadcastStatusUpdate();
    }
}, 10 * 60 * 1000); // Every 10 minutes

// Disease spread logic - runs every hour
setInterval(() => {
    const now = Date.now();
    const temp = appState.temperature;
    let newInfections = 0;

    // Temperature affects disease spread
    let tempDiseaseMultiplier = 1.0;
    if (temp < 20) tempDiseaseMultiplier = 1.5;   // Cold = +50% disease chance
    if (temp > 28) tempDiseaseMultiplier = 2.0;   // Warm = +100% disease chance

    appState.fishes.forEach(fish => {
        if (!fish.health) fish.health = 100; // Initialize health if missing
        if (fish.sick) return; // Already sick

        // Environmental infection (dirty water)
        if (appState.poopCount > 15 || appState.waterGreenness > 80) {
            // Base: 1% chance per 12 hours = 0.0833% per hour
            const baseEnvironmentalChance = 0.0083;
            const environmentalChance = baseEnvironmentalChance * tempDiseaseMultiplier;

            if (Math.random() < environmentalChance) {
                fish.sick = true;
                fish.sickStartedAt = now;
                newInfections++;
                console.log(`🦠 ${fish.name} got sick from dirty environment (temp: ${temp.toFixed(1)}°C)`);
                logEvent('fish_infected_environment', {
                    name: fish.name,
                    poopCount: appState.poopCount,
                    waterGreenness: appState.waterGreenness,
                    temperature: temp,
                    tempMultiplier: tempDiseaseMultiplier
                });
            }
        }

        // Contact infection - check distance to sick fish
        // This is a simplification - client will report actual positions later
        // For now, just use probability based on number of sick fish
        const sickFish = appState.fishes.filter(f => f.sick && !f.medicated);
        if (sickFish.length > 0 && !fish.sick) {
            // Base: 3% chance per hour per sick fish (proximity assumed)
            const baseContactChance = 0.03;
            const contactChance = (sickFish.length * baseContactChance) * tempDiseaseMultiplier;

            if (Math.random() < contactChance) {
                fish.sick = true;
                fish.sickStartedAt = now;
                newInfections++;
                console.log(`🦠 ${fish.name} got infected by contact with sick fish (temp: ${temp.toFixed(1)}°C)`);
                logEvent('fish_infected_contact', {
                    name: fish.name,
                    sickFishCount: sickFish.length,
                    temperature: temp,
                    tempMultiplier: tempDiseaseMultiplier
                });
            }
        }
    });

    if (newInfections > 0) {
        console.log(`🦠 Disease spread: ${newInfections} new infections`);
        broadcastStatusUpdate();
        // Broadcast to main app to update visuals
        broadcastToMainApp({ command: 'diseaseUpdate' });
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
        // Check if there's already an active main app connection
        if (mainApps.size >= 1) {
            console.log('🚫 Tweede vissenkom verbinding geweigerd - er is al een actieve verbinding');
            // Send error message before closing
            sendToClient(ws, {
                error: 'vissenkom_already_active',
                message: 'Vissenkom is al geopend in ander tabblad of device'
            });
            // Close connection after short delay to ensure message is sent
            setTimeout(() => {
                ws.close(1008, 'Vissenkom already active elsewhere');
            }, 100);
            return;
        }

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