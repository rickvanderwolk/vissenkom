#!/usr/bin/env node
/**
 * Admin script om vissen te hernoemen/censureren
 *
 * Gebruik:
 *   node admin-rename-fish.js                     # Toon alle vissen
 *   node admin-rename-fish.js "Naam" "NieuweNaam" # Hernoem vis
 *   node admin-rename-fish.js "Naam" --censor     # Censureer: "Hallo" -> "*****"
 *   node admin-rename-fish.js "Naam" --censor-word "woord"  # Alleen specifiek woord censureren
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'gamestate.json');
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
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('gamestate.json opgeslagen');
}

// Censureer een string: elke letter wordt *, spaties/cijfers blijven
function censorFull(name) {
    return name.split('').map(char => {
        if (char === ' ') return ' ';
        if (/\d/.test(char)) return char; // cijfers behouden
        return '*';
    }).join('');
}

// Censureer alleen een specifiek woord in de naam
function censorWord(name, word) {
    const regex = new RegExp(word, 'gi');
    return name.replace(regex, match => '*'.repeat(match.length));
}

function listFishes(state) {
    console.log('\n=== Levende vissen ===');
    if (state.fishes.length === 0) {
        console.log('  (geen vissen)');
    } else {
        state.fishes.forEach((fish, i) => {
            const status = fish.sick ? ' [ZIEK]' : '';
            console.log(`  ${i + 1}. "${fish.name}"${status}`);
        });
    }

    console.log('\n=== Overleden vissen ===');
    if (!state.deadLog || state.deadLog.length === 0) {
        console.log('  (geen)');
    } else {
        state.deadLog.slice(-10).forEach((fish, i) => {
            console.log(`  ${i + 1}. "${fish.name}"`);
        });
        if (state.deadLog.length > 10) {
            console.log(`  ... en ${state.deadLog.length - 10} meer`);
        }
    }
    console.log('');
}

function renameFish(state, oldName, newName) {
    // Zoek in levende vissen
    const fishIndex = state.fishes.findIndex(f => f.name === oldName);
    if (fishIndex !== -1) {
        state.fishes[fishIndex].name = newName;
        console.log(`Levende vis hernoemd: "${oldName}" -> "${newName}"`);
        return true;
    }

    // Zoek in dode vissen
    const deadIndex = state.deadLog?.findIndex(f => f.name === oldName) ?? -1;
    if (deadIndex !== -1) {
        state.deadLog[deadIndex].name = newName;
        console.log(`Overleden vis hernoemd: "${oldName}" -> "${newName}"`);
        return true;
    }

    console.error(`Vis "${oldName}" niet gevonden!`);
    return false;
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    // Toon lijst
    const state = loadState();
    listFishes(state);
    console.log('Gebruik:');
    console.log('  node admin-rename-fish.js "OudeNaam" "NieuweNaam"');
    console.log('  node admin-rename-fish.js "OudeNaam" --censor');
    console.log('  node admin-rename-fish.js "OudeNaam" --censor-word "woord"');
    process.exit(0);
}

if (args.length === 1) {
    console.error('Geef ook een nieuwe naam of --censor optie');
    process.exit(1);
}

const oldName = args[0];
const state = loadState();

let newName;

if (args[1] === '--censor') {
    // Volledige censuur
    newName = censorFull(oldName);
    console.log(`Censuur modus: "${oldName}" -> "${newName}"`);
} else if (args[1] === '--censor-word' && args[2]) {
    // Censureer specifiek woord
    newName = censorWord(oldName, args[2]);
    console.log(`Woord censuur: "${oldName}" -> "${newName}" (woord: "${args[2]}")`);
} else {
    // Directe hernoem
    newName = args[1];
}

// Check of nieuwe naam al bestaat
const existsLiving = state.fishes.some(f => f.name === newName && f.name !== oldName);
const existsDead = state.deadLog?.some(f => f.name === newName && f.name !== oldName) ?? false;

if (existsLiving || existsDead) {
    console.error(`Naam "${newName}" bestaat al!`);
    process.exit(1);
}

if (renameFish(state, oldName, newName)) {
    saveState(state);

    // Log naar apart admin-log (niet zichtbaar in UI)
    logAdmin('fish_renamed', {
        oldName,
        newName,
        reason: args[1] === '--censor' ? 'full_censor' :
                args[1] === '--censor-word' ? `word_censor:${args[2]}` : 'manual'
    });

    console.log('\nLET OP: Herstart de server om wijzigingen door te voeren!');
    console.log('  Ctrl+C in terminal waar server draait, dan: npm start');
}
