#!/usr/bin/env node
/**
 * Admin script om overleden vissen te fixen
 *
 * Leest de events log en verplaatst vissen die als dood gelogd zijn
 * maar nog in de fishes array staan naar de deadLog.
 *
 * Gebruik:
 *   node admin-fix-dead-fish.js          # Dry run - toon wat er zou gebeuren
 *   node admin-fix-dead-fish.js --fix    # Voer de fix uit
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'gamestate.json');
const EVENTS_FILE = path.join(__dirname, 'events-current.jsonl');
const ADMIN_LOG_FILE = path.join(__dirname, 'admin-log.jsonl');

function logAdmin(action, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        ...data
    };
    fs.appendFileSync(ADMIN_LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`[LOG] ${action}`);
}

function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        console.error('Geen gamestate.json gevonden!');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
    // Backup maken
    const backupFile = STATE_FILE + '.backup-' + Date.now();
    fs.copyFileSync(STATE_FILE, backupFile);
    console.log(`Backup gemaakt: ${path.basename(backupFile)}`);

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('gamestate.json opgeslagen');
}

function loadDeathEvents() {
    if (!fs.existsSync(EVENTS_FILE)) {
        console.error('Geen events-current.jsonl gevonden!');
        console.error('Zorg dat dit bestand in de project root staat.');
        process.exit(1);
    }

    const content = fs.readFileSync(EVENTS_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const deathEvents = [];
    for (const line of lines) {
        try {
            const event = JSON.parse(line);
            if (event.type === 'fish_died' || event.type === 'fish_died_disease') {
                deathEvents.push({
                    name: event.data.name,
                    timestamp: event.timestamp,
                    cause: event.data.cause || 'unknown',
                    type: event.type
                });
            }
        } catch (e) {
            // Skip invalid lines
        }
    }

    return deathEvents;
}

function findInconsistencies(state, deathEvents) {
    const inconsistencies = [];

    for (const death of deathEvents) {
        // Check of vis nog in fishes staat
        const fishIndex = state.fishes.findIndex(f => f.name === death.name);
        if (fishIndex !== -1) {
            const fish = state.fishes[fishIndex];
            inconsistencies.push({
                name: death.name,
                fishIndex,
                diedAt: death.timestamp,
                bornAt: fish.bornAt,
                cause: death.cause,
                currentHealth: fish.health
            });
        }

        // Check of vis al in deadLog staat
        const inDeadLog = state.deadLog?.some(d => d.name === death.name) ?? false;
        if (inDeadLog && fishIndex !== -1) {
            console.warn(`⚠️  ${death.name} staat in BEIDE fishes en deadLog!`);
        }
    }

    return inconsistencies;
}

// Main
const args = process.argv.slice(2);
const doFix = args.includes('--fix');

console.log('=== Fix Overleden Vissen ===\n');

const state = loadState();
const deathEvents = loadDeathEvents();

console.log(`Gevonden death events in log: ${deathEvents.length}`);
deathEvents.forEach(d => {
    const date = new Date(d.timestamp).toLocaleString('nl-NL');
    console.log(`  - ${d.name} (${d.cause}) op ${date}`);
});

console.log(`\nHuidige fishes: ${state.fishes.length}`);
console.log(`Huidige deadLog: ${state.deadLog?.length || 0}\n`);

const inconsistencies = findInconsistencies(state, deathEvents);

if (inconsistencies.length === 0) {
    console.log('✅ Geen inconsistenties gevonden! Alles is in orde.');
    process.exit(0);
}

console.log(`❌ ${inconsistencies.length} vissen zijn dood maar staan nog in fishes:\n`);

for (const inc of inconsistencies) {
    const diedDate = new Date(inc.diedAt).toLocaleString('nl-NL');
    console.log(`  📛 ${inc.name}`);
    console.log(`     - Overleden: ${diedDate} (${inc.cause})`);
    console.log(`     - Huidige health in state: ${inc.currentHealth}`);
    console.log('');
}

if (!doFix) {
    console.log('Dit was een dry run. Gebruik --fix om de wijzigingen door te voeren:');
    console.log('  node admin-fix-dead-fish.js --fix\n');
    process.exit(0);
}

// Fix uitvoeren
console.log('Fixing...\n');

for (const inc of inconsistencies) {
    // Vind de volledige vis data
    const fishIndex = state.fishes.findIndex(f => f.name === inc.name);
    const fullFishData = { ...state.fishes[fishIndex] };

    // Verwijder uit fishes
    state.fishes.splice(fishIndex, 1);

    // Voeg toe aan deadLog met alle data (als nog niet bestaat)
    if (!state.deadLog) state.deadLog = [];
    const alreadyInDeadLog = state.deadLog.some(d => d.name === inc.name);

    if (!alreadyInDeadLog) {
        // Voeg diedAt toe en zet health op 0, behoud alle andere data
        fullFishData.diedAt = inc.diedAt;
        fullFishData.health = 0;

        state.deadLog.push(fullFishData);
        console.log(`✅ ${inc.name} verplaatst naar deadLog (alle data behouden)`);
    } else {
        console.log(`⚠️  ${inc.name} stond al in deadLog, alleen uit fishes verwijderd`);
    }

    logAdmin('dead_fish_fixed', {
        name: inc.name,
        diedAt: inc.diedAt,
        cause: inc.cause,
        previousHealth: inc.currentHealth
    });
}

saveState(state);

console.log(`\n✅ Klaar! ${inconsistencies.length} vissen gefixt.`);
console.log('\nLET OP: Herstart de server om wijzigingen door te voeren!');
console.log('  Ctrl+C in terminal waar server draait, dan: npm start');
