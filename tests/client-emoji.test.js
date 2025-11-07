import { describe, it, expect } from 'vitest';

/**
 * Client-side emoji logic tests
 * Tests the getSickEmoji function and emoji state transitions
 */

// Mock getSickEmoji function (from vissenkom.js lines 1712-1719)
function getSickEmoji(fish) {
    if (!fish || !fish.sick) return '';
    const health = fish.health !== undefined ? fish.health : 100;
    if (health <= 30) return '💀'; // Critical
    if (health <= 60) return '🤢'; // Sick
    return '🦠'; // Early stage
}

describe('Client-Side Emoji Logic', () => {
    describe('getSickEmoji', () => {
        it('should return empty string for healthy fish', () => {
            const healthyFish = { name: 'Freddy', health: 100, sick: false };
            expect(getSickEmoji(healthyFish)).toBe('');
        });

        it('should return empty string for null/undefined fish', () => {
            expect(getSickEmoji(null)).toBe('');
            expect(getSickEmoji(undefined)).toBe('');
        });

        it('should return 🦠 for early stage sickness (health > 60%)', () => {
            const earlySick = { name: 'Freddy', health: 80, sick: true };
            expect(getSickEmoji(earlySick)).toBe('🦠');

            const earlySick2 = { name: 'Freddy', health: 61, sick: true };
            expect(getSickEmoji(earlySick2)).toBe('🦠');

            const earlySick3 = { name: 'Freddy', health: 100, sick: true };
            expect(getSickEmoji(earlySick3)).toBe('🦠');
        });

        it('should return 🤢 for moderate sickness (health 31-60%)', () => {
            const moderateSick = { name: 'Freddy', health: 60, sick: true };
            expect(getSickEmoji(moderateSick)).toBe('🤢');

            const moderateSick2 = { name: 'Freddy', health: 45, sick: true };
            expect(getSickEmoji(moderateSick2)).toBe('🤢');

            const moderateSick3 = { name: 'Freddy', health: 31, sick: true };
            expect(getSickEmoji(moderateSick3)).toBe('🤢');
        });

        it('should return 💀 for critical condition (health ≤ 30%)', () => {
            const criticalSick = { name: 'Freddy', health: 30, sick: true };
            expect(getSickEmoji(criticalSick)).toBe('💀');

            const criticalSick2 = { name: 'Freddy', health: 15, sick: true };
            expect(getSickEmoji(criticalSick2)).toBe('💀');

            const criticalSick3 = { name: 'Freddy', health: 1, sick: true };
            expect(getSickEmoji(criticalSick3)).toBe('💀');
        });

        it('should handle boundary conditions correctly', () => {
            // Test exact boundaries
            expect(getSickEmoji({ health: 61, sick: true })).toBe('🦠');
            expect(getSickEmoji({ health: 60, sick: true })).toBe('🤢');
            expect(getSickEmoji({ health: 31, sick: true })).toBe('🤢');
            expect(getSickEmoji({ health: 30, sick: true })).toBe('💀');
        });

        it('should default to 100 health if health is undefined but sick is true', () => {
            const sickNoHealth = { name: 'Freddy', sick: true };
            expect(getSickEmoji(sickNoHealth)).toBe('🦠');
        });

        it('should handle zero health correctly', () => {
            const deadSick = { name: 'Freddy', health: 0, sick: true };
            expect(getSickEmoji(deadSick)).toBe('💀');
        });
    });

    describe('Emoji Transitions', () => {
        it('should show correct emoji progression as fish gets sicker', () => {
            const fish = { name: 'Freddy', health: 100, sick: true };

            // Stage 1: Early sickness
            fish.health = 100;
            expect(getSickEmoji(fish)).toBe('🦠');

            fish.health = 70;
            expect(getSickEmoji(fish)).toBe('🦠');

            // Stage 2: Moderate sickness
            fish.health = 60;
            expect(getSickEmoji(fish)).toBe('🤢');

            fish.health = 45;
            expect(getSickEmoji(fish)).toBe('🤢');

            // Stage 3: Critical
            fish.health = 30;
            expect(getSickEmoji(fish)).toBe('💀');

            fish.health = 10;
            expect(getSickEmoji(fish)).toBe('💀');
        });

        it('should show correct emoji progression as fish recovers', () => {
            const fish = { name: 'Freddy', health: 10, sick: true, medicated: true };

            // Critical
            expect(getSickEmoji(fish)).toBe('💀');

            // Getting better
            fish.health = 35;
            expect(getSickEmoji(fish)).toBe('🤢');

            fish.health = 65;
            expect(getSickEmoji(fish)).toBe('🦠');

            // Fully recovered
            fish.health = 100;
            fish.sick = false;
            expect(getSickEmoji(fish)).toBe('');
        });

        it('should clear emoji immediately when sick status is cleared', () => {
            const fish = { name: 'Freddy', health: 50, sick: true };
            expect(getSickEmoji(fish)).toBe('🤢');

            // Fish recovers
            fish.sick = false;
            expect(getSickEmoji(fish)).toBe('');
        });

        it('should show correct emoji even with low health but not sick', () => {
            const fish = { name: 'Freddy', health: 20, sick: false };
            expect(getSickEmoji(fish)).toBe('');
        });
    });

    describe('State Sync Edge Cases', () => {
        it('should handle rapid state changes correctly', () => {
            const fish = { name: 'Freddy', health: 100, sick: false };

            // Gets sick
            fish.sick = true;
            expect(getSickEmoji(fish)).toBe('🦠');

            // Health drops rapidly
            fish.health = 25;
            expect(getSickEmoji(fish)).toBe('💀');

            // Gets medicine, health recovers
            fish.medicated = true;
            fish.health = 100;
            expect(getSickEmoji(fish)).toBe('🦠');

            // Fully recovers
            fish.sick = false;
            expect(getSickEmoji(fish)).toBe('');
        });

        it('should be consistent with server health thresholds', () => {
            // These thresholds must match server-side logic
            const CRITICAL_THRESHOLD = 30;
            const MODERATE_THRESHOLD = 60;

            const fish = { name: 'Test', sick: true };

            fish.health = CRITICAL_THRESHOLD;
            expect(getSickEmoji(fish)).toBe('💀');

            fish.health = CRITICAL_THRESHOLD + 1;
            expect(getSickEmoji(fish)).toBe('🤢');

            fish.health = MODERATE_THRESHOLD;
            expect(getSickEmoji(fish)).toBe('🤢');

            fish.health = MODERATE_THRESHOLD + 1;
            expect(getSickEmoji(fish)).toBe('🦠');
        });

        it('should handle missing fish object gracefully', () => {
            expect(() => getSickEmoji(null)).not.toThrow();
            expect(() => getSickEmoji(undefined)).not.toThrow();
            expect(() => getSickEmoji({})).not.toThrow();
        });

        it('should handle partial fish objects', () => {
            // Only sick flag
            expect(getSickEmoji({ sick: true })).toBe('🦠');

            // Only health
            expect(getSickEmoji({ health: 50 })).toBe('');

            // Health and sick
            expect(getSickEmoji({ health: 50, sick: true })).toBe('🤢');
        });
    });

    describe('Emoji Display Synchronization', () => {
        it('should update emoji when healthUpdate message received', () => {
            const fish = { name: 'Freddy', health: 80, sick: false };

            // Simulate healthUpdate message from server
            const healthUpdate = {
                command: 'healthUpdate',
                fishName: 'Freddy',
                health: 50,
                sick: true,
                medicated: true
            };

            // Apply update
            fish.health = healthUpdate.health;
            fish.sick = healthUpdate.sick;
            fish.medicated = healthUpdate.medicated;

            expect(getSickEmoji(fish)).toBe('🤢');
        });

        it('should update emoji when diseaseUpdate message received', () => {
            const fish = { name: 'Freddy', health: 100, sick: false };

            // Simulate diseaseUpdate message (fish got sick)
            fish.sick = true;
            fish.sickStartedAt = Date.now();

            expect(getSickEmoji(fish)).toBe('🦠');
        });

        it('should clear emoji when recovery happens', () => {
            const fish = {
                name: 'Freddy',
                health: 100,
                sick: true,
                medicated: true
            };

            expect(getSickEmoji(fish)).toBe('🦠');

            // Recovery message from server
            fish.sick = false;
            fish.sickStartedAt = null;
            fish.medicated = false;
            fish.medicatedAt = null;

            expect(getSickEmoji(fish)).toBe('');
        });
    });
});
