import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Race: de pure hulpfuncties uit js/vissenkom.js.
 * De echte code wordt uit het bestand geknipt (van een const tot een volgende function),
 * zodat de test niet stilletjes een oude kopie test.
 */
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'vissenkom.js'), 'utf8');
function load(from, to, exportNames) {
    const start = src.indexOf(from);
    const end = src.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`Blok niet gevonden: ${from}`);
    const ctx = { Math };
    vm.createContext(ctx);
    vm.runInContext(src.slice(start, end) + `;this.out={${exportNames.join(',')}};`, ctx);
    return ctx.out;
}

describe('race', () => {
    const { makeRaceRunner, raceRunnerSpeed } = load('const RACE_PACE_MIN=', '// Start en finish gelden voor de neus', ['makeRaceRunner', 'raceRunnerSpeed']);

    it('geeft een snellere en gezondere vis een iets hogere basissnelheid, maar geen twee keer zo hoog', () => {
        const fast = makeRaceRunner({ speed: 3, health: 100 }).base;
        const slow = makeRaceRunner({ speed: 1.5, health: 100 }).base;
        const sick = makeRaceRunner({ speed: 3, health: 40 }).base;
        expect(fast).toBeGreaterThan(slow);
        expect(fast).toBeGreaterThan(sick);
        expect(fast / slow).toBeLessThan(1.3);
    });

    it('laat de vis die achterligt harder zwemmen dan dezelfde vis vooraan', () => {
        const a = makeRaceRunner({ speed: 2, health: 100 });
        const b = makeRaceRunner({ speed: 2, health: 100 });
        a.nextPaceAt = b.nextPaceAt = Infinity; // vast tempo, zonder toeval
        a.x = 500; b.x = 400;
        const leader = 500;
        expect(raceRunnerSpeed(b, leader, 1000, 100, 0, 16)).toBeGreaterThan(raceRunnerSpeed(a, leader, 1000, 100, 0, 16));
    });
});
