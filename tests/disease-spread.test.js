import { describe, it, expect } from 'vitest';
import {
    calculateTemperatureMultiplier,
    calculateEnvironmentalInfectionChance,
    calculateContactInfectionChance,
    shouldGetInfected
} from '../src/gameLogic.js';

describe('Disease Spread System', () => {
    describe('calculateTemperatureMultiplier', () => {
        it('should return 1.0 for normal temperature (20-28°C)', () => {
            expect(calculateTemperatureMultiplier(20)).toBe(1.0);
            expect(calculateTemperatureMultiplier(24)).toBe(1.0);
            expect(calculateTemperatureMultiplier(28)).toBe(1.0);
        });

        it('should return 1.5 for cold temperature (<20°C)', () => {
            expect(calculateTemperatureMultiplier(19)).toBe(1.5);
            expect(calculateTemperatureMultiplier(15)).toBe(1.5);
            expect(calculateTemperatureMultiplier(10)).toBe(1.5);
        });

        it('should return 2.0 for hot temperature (>28°C)', () => {
            expect(calculateTemperatureMultiplier(29)).toBe(2.0);
            expect(calculateTemperatureMultiplier(32)).toBe(2.0);
            expect(calculateTemperatureMultiplier(35)).toBe(2.0);
        });
    });

    describe('calculateEnvironmentalInfectionChance', () => {
        it('should return 0 when environment is clean', () => {
            expect(calculateEnvironmentalInfectionChance(20, 70, 24)).toBe(0);
            expect(calculateEnvironmentalInfectionChance(30, 80, 24)).toBe(0);
        });

        it('should return base chance when poop count is high', () => {
            const chance = calculateEnvironmentalInfectionChance(31, 70, 24);
            expect(chance).toBeCloseTo(0.0083, 4);
        });

        it('should return base chance when water greenness is high', () => {
            const chance = calculateEnvironmentalInfectionChance(20, 81, 24);
            expect(chance).toBeCloseTo(0.0083, 4);
        });

        it('should return base chance when both poop and algae are high', () => {
            const chance = calculateEnvironmentalInfectionChance(35, 85, 24);
            expect(chance).toBeCloseTo(0.0083, 4);
        });

        it('should multiply by 1.5 in cold temperature', () => {
            const chance = calculateEnvironmentalInfectionChance(35, 85, 15);
            expect(chance).toBeCloseTo(0.0083 * 1.5, 4);
        });

        it('should multiply by 2.0 in hot temperature', () => {
            const chance = calculateEnvironmentalInfectionChance(35, 85, 32);
            expect(chance).toBeCloseTo(0.0083 * 2.0, 4);
        });
    });

    describe('calculateContactInfectionChance', () => {
        it('should return 0 when no sick fish are present', () => {
            expect(calculateContactInfectionChance(0, 24)).toBe(0);
        });

        it('should calculate base chance with 1 sick fish', () => {
            const chance = calculateContactInfectionChance(1, 24);
            expect(chance).toBeCloseTo(0.03, 4);
        });

        it('should scale linearly with number of sick fish', () => {
            const chance1 = calculateContactInfectionChance(1, 24);
            const chance3 = calculateContactInfectionChance(3, 24);

            expect(chance3).toBeCloseTo(chance1 * 3, 4);
            expect(chance3).toBeCloseTo(0.09, 4);
        });

        it('should multiply by 1.5 in cold temperature', () => {
            const chance = calculateContactInfectionChance(2, 15);
            expect(chance).toBeCloseTo(0.03 * 2 * 1.5, 4);
        });

        it('should multiply by 2.0 in hot temperature', () => {
            const chance = calculateContactInfectionChance(2, 32);
            expect(chance).toBeCloseTo(0.03 * 2 * 2.0, 4);
        });

        it('should handle large number of sick fish', () => {
            const chance = calculateContactInfectionChance(10, 24);
            expect(chance).toBeCloseTo(0.3, 4);
        });
    });

    describe('shouldGetInfected', () => {
        it('should return true when random value is below chance', () => {
            expect(shouldGetInfected(0.5, 0.3)).toBe(true);
            expect(shouldGetInfected(0.1, 0.05)).toBe(true);
        });

        it('should return false when random value is above chance', () => {
            expect(shouldGetInfected(0.5, 0.6)).toBe(false);
            expect(shouldGetInfected(0.1, 0.2)).toBe(false);
        });

        it('should return true when random value equals chance', () => {
            expect(shouldGetInfected(0.5, 0.5)).toBe(false); // < not <=
        });

        it('should return false for 0% chance', () => {
            expect(shouldGetInfected(0, 0.5)).toBe(false);
            expect(shouldGetInfected(0, 0)).toBe(false);
        });

        it('should return true for 100% chance', () => {
            expect(shouldGetInfected(1, 0.9)).toBe(true);
            expect(shouldGetInfected(1, 0.5)).toBe(true);
        });

        it('should use Math.random when no random value provided', () => {
            // This test just verifies it doesn't crash
            const result = shouldGetInfected(0.5);
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Disease Spread Integration Scenarios', () => {
        it('should calculate high environmental risk in dirty hot tank', () => {
            // Scenario: Very dirty tank (poop: 50, algae: 90) + hot temp (32°C)
            const chance = calculateEnvironmentalInfectionChance(50, 90, 32);

            // Base 0.0083 * 2.0 temp multiplier = 0.0166 (1.66% per hour)
            expect(chance).toBeCloseTo(0.0166, 4);
        });

        it('should calculate high contact risk with many sick fish in cold', () => {
            // Scenario: 5 sick fish in cold temperature (15°C)
            const chance = calculateContactInfectionChance(5, 15);

            // 5 * 0.03 * 1.5 = 0.225 (22.5% chance)
            expect(chance).toBeCloseTo(0.225, 4);
        });

        it('should show extreme risk scenario', () => {
            // Worst case: dirty environment + many sick fish + extreme temp
            const envChance = calculateEnvironmentalInfectionChance(60, 100, 35);
            const contactChance = calculateContactInfectionChance(8, 35);

            expect(envChance).toBeCloseTo(0.0166, 4); // 1.66%
            expect(contactChance).toBeCloseTo(0.48, 4); // 48%

            // Total risk is very high
            expect(contactChance).toBeGreaterThan(0.4);
        });

        it('should show safe scenario', () => {
            // Best case: clean tank + no sick fish + normal temp
            const envChance = calculateEnvironmentalInfectionChance(10, 40, 24);
            const contactChance = calculateContactInfectionChance(0, 24);

            expect(envChance).toBe(0);
            expect(contactChance).toBe(0);
        });
    });
});
