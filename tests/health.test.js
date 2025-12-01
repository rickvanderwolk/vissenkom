import { describe, it, expect } from 'vitest';
import {
    calculateTemperatureDamage,
    calculateHealthChange,
    determineDeathCause,
    calculatePumpPoopFiltering
} from '../src/gameLogic.js';

describe('Health System', () => {
    describe('calculateTemperatureDamage', () => {
        it('should return 0 for optimal temperature (18-30°C)', () => {
            expect(calculateTemperatureDamage(18)).toBe(0);
            expect(calculateTemperatureDamage(24)).toBe(0);
            expect(calculateTemperatureDamage(30)).toBe(0);
        });

        it('should return -0.5 for slightly cold temperature (16-18°C)', () => {
            expect(calculateTemperatureDamage(17)).toBe(-0.5);
        });

        it('should return -1.0 for very cold temperature (<16°C)', () => {
            expect(calculateTemperatureDamage(15)).toBe(-1.0);
            expect(calculateTemperatureDamage(10)).toBe(-1.0);
        });

        it('should return -1.0 for hot temperature (30-32°C)', () => {
            expect(calculateTemperatureDamage(31)).toBe(-1.0);
        });

        it('should return -2.0 for very hot temperature (>32°C)', () => {
            expect(calculateTemperatureDamage(33)).toBe(-2.0);
            expect(calculateTemperatureDamage(35)).toBe(-2.0);
        });
    });

    describe('calculateHealthChange', () => {
        it('should apply hunger damage of -0.167% per tick', () => {
            const fish = { health: 100, sick: false, medicated: false };
            const result = calculateHealthChange(fish, 24);

            expect(result.health).toBeCloseTo(99.833, 3);
            expect(result.isDead).toBe(false);
            expect(result.recovered).toBe(false);
        });

        it('should apply additional disease damage when sick and not medicated', () => {
            const fish = { health: 100, sick: true, medicated: false };
            const result = calculateHealthChange(fish, 24);

            // Hunger (-0.167) + Disease (-0.083) = -0.25
            expect(result.health).toBeCloseTo(99.75, 3);
        });

        it('should not apply disease damage when medicated', () => {
            const fish = { health: 100, sick: true, medicated: true };
            const result = calculateHealthChange(fish, 24);

            // Hunger (-0.167) + Medicine (+0.333) = +0.166
            expect(result.health).toBeCloseTo(100, 3); // Capped at 100
        });

        it('should apply temperature stress damage in cold conditions', () => {
            const fish = { health: 100, sick: false, medicated: false };
            const result = calculateHealthChange(fish, 15); // Very cold

            // Hunger (-0.167) + Temperature (-1.0/6 = -0.167) = -0.334
            expect(result.health).toBeCloseTo(99.666, 2);
        });

        it('should apply temperature stress damage in hot conditions', () => {
            const fish = { health: 100, sick: false, medicated: false };
            const result = calculateHealthChange(fish, 33); // Very hot

            // Hunger (-0.167) + Temperature (-2.0/6 = -0.333) = -0.5
            expect(result.health).toBeCloseTo(99.5, 2);
        });

        it('should apply medicine recovery bonus', () => {
            const fish = { health: 50, sick: true, medicated: true };
            const result = calculateHealthChange(fish, 24);

            // Hunger (-0.167) + Medicine (+0.333) = +0.166
            expect(result.health).toBeCloseTo(50.166, 3);
        });

        it('should cap health at 100', () => {
            const fish = { health: 99.9, sick: false, medicated: true };
            const result = calculateHealthChange(fish, 24);

            // 99.9 - 0.167 (hunger) + 0.333 (medicine) = 100.066, capped at 100
            expect(result.health).toBe(100);
        });

        it('should not go below 0 health', () => {
            const fish = { health: 0.1, sick: true, medicated: false };
            const result = calculateHealthChange(fish, 15); // Cold temp

            expect(result.health).toBe(0);
            expect(result.isDead).toBe(true);
        });

        it('should mark fish as recovered when health reaches 100 while sick and medicated', () => {
            const fish = { health: 99.9, sick: true, medicated: true };
            const result = calculateHealthChange(fish, 24);

            // 99.9 - 0.167 (hunger) + 0.333 (medicine) = 100.066, capped at 100
            expect(result.health).toBe(100);
            expect(result.recovered).toBe(true);
        });

        it('should not mark as recovered if not sick', () => {
            const fish = { health: 99.9, sick: false, medicated: true };
            const result = calculateHealthChange(fish, 24);

            // 99.9 - 0.167 (hunger) + 0.333 (medicine) = 100.066, capped at 100
            expect(result.health).toBe(100);
            expect(result.recovered).toBe(false);
        });

        it('should not mark as recovered if not medicated', () => {
            const fish = { health: 99.8, sick: true, medicated: false };
            const result = calculateHealthChange(fish, 24);

            expect(result.recovered).toBe(false);
        });

        it('should mark as critical when health drops to 30 or below', () => {
            const fish = { health: 30.1, sick: true, medicated: false };
            const result = calculateHealthChange(fish, 24);

            expect(result.isCritical).toBe(true);
        });

        it('should handle missing health property by defaulting to 100', () => {
            const fish = { sick: false, medicated: false };
            const result = calculateHealthChange(fish, 24);

            expect(result.health).toBeCloseTo(99.833, 3);
        });

        it('should accumulate all damage types correctly', () => {
            const fish = { health: 100, sick: true, medicated: false };
            const result = calculateHealthChange(fish, 33); // Very hot

            // Hunger (-0.167) + Disease (-0.083) + Temperature (-2.0/6 = -0.333) = -0.583
            expect(result.health).toBeCloseTo(99.417, 2);
        });
    });

    describe('determineDeathCause', () => {
        it('should return "disease" when fish is sick', () => {
            const fish = { sick: true };
            expect(determineDeathCause(fish)).toBe('disease');
        });

        it('should return "hunger" when fish is not sick', () => {
            const fish = { sick: false };
            expect(determineDeathCause(fish)).toBe('hunger');
        });
    });

    describe('calculatePumpPoopFiltering', () => {
        it('should return 1 when pump is on', () => {
            expect(calculatePumpPoopFiltering(true)).toBe(1);
        });

        it('should return 0 when pump is off', () => {
            expect(calculatePumpPoopFiltering(false)).toBe(0);
        });
    });
});
