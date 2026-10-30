import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Teksten bij activiteiten (js/activity.js), gedeeld door de kom en de controller.
 * Het echte bestand wordt geladen, niet een kopie.
 */
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'activity.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + ';this.out={activityText,ACTIVITY_QUIET,ACTIVITY_THEMES};', ctx);
const { activityText, ACTIVITY_QUIET, ACTIVITY_THEMES } = ctx.out;

describe('activityText', () => {
    it('geeft emoji en tekst zonder tijd', () => {
        expect(activityText({ type: 'feed', data: {} })).toEqual({ emoji: '🍤', text: 'Gevoerd' });
        expect(activityText({ type: 'fish_added', data: { name: 'Bubbles' } })).toEqual({ emoji: '🐟', text: 'Bubbles toegevoegd' });
        expect(activityText({ type: 'heating_toggle', data: { state: 'uit' } }).text).toBe('Verwarming uit');
    });

    it('noemt het thema en de vorm van het dansfeest bij naam', () => {
        expect(activityText({ type: 'theme_change', data: { to: 'halloween' } })).toEqual({ emoji: '🎃', text: 'Thema: Halloween' });
        expect(activityText({ type: 'party_started', data: { kind: 'conga' } }).text).toBe('Dansen (polonaise)');
    });

    it('zegt bij groen water hoe groen het is, niet hoe schoon', () => {
        expect(activityText({ type: 'water_greenness_milestone', data: { percentage: 50 } }).text).toBe('Water 50% groen');
    });

    it('toont ongeldige codes niet aan bezoekers', () => {
        expect(activityText({ type: 'invalid_access_code', data: {} })).toBeNull();
        expect(ACTIVITY_QUIET.has('invalid_access_code')).toBe(true);
        expect(ACTIVITY_QUIET.has('feed')).toBe(false);
    });

    it('kent alle thema\'s die de server kan kiezen', () => {
        const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        const themes = serverSrc.match(/const themes = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map(t => t.replace(/'/g, ''));
        for (const t of themes) expect(ACTIVITY_THEMES[t]).toBeDefined();
    });
});
