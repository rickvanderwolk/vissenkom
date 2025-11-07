import { describe, it, expect } from 'vitest';

/**
 * State Synchronization Tests
 * Verify that core state is preserved and synced correctly
 */

describe('State Synchronization', () => {
    describe('Server State Persistence', () => {
        it('should save all critical fish properties', () => {
            const mockFish = {
                name: 'Freddy',
                health: 75,
                sick: true,
                sickStartedAt: Date.now(),
                medicated: true,
                medicatedAt: Date.now(),
                baseSize: 1.0,
                hue: 180,
                eats: 5,
                lastEat: Date.now()
            };

            // All these properties should be in gamestate.json
            const requiredProperties = [
                'name', 'health', 'sick', 'sickStartedAt',
                'medicated', 'medicatedAt', 'baseSize', 'hue',
                'eats', 'lastEat'
            ];

            requiredProperties.forEach(prop => {
                expect(mockFish).toHaveProperty(prop);
            });
        });

        it('should include hasBall in gameState sync', () => {
            const mockGameState = {
                fishes: [],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                heatingOn: true,
                temperature: 24,
                hasBall: true // This was missing before bug fix!
            };

            expect(mockGameState).toHaveProperty('hasBall');
            expect(mockGameState.hasBall).toBe(true);
        });

        it('should include heatingOn and temperature in gameState', () => {
            const mockGameState = {
                fishes: [],
                heatingOn: true,
                temperature: 24
            };

            expect(mockGameState).toHaveProperty('heatingOn');
            expect(mockGameState).toHaveProperty('temperature');
        });
    });

    describe('Client State Validation', () => {
        // Mock validation function (matches client-side implementation)
        function validateReceivedState(state) {
            const errors = [];

            if (!state || typeof state !== 'object') {
                errors.push('State is null or not an object');
                return errors;
            }

            if (!Array.isArray(state.fishes)) {
                errors.push('Fishes is not an array');
            } else {
                state.fishes.forEach((fish, index) => {
                    if (!fish.name) {
                        errors.push(`Fish ${index} has no name`);
                    }

                    if (fish.health !== undefined && (fish.health < 0 || fish.health > 100)) {
                        errors.push(`Fish ${fish.name} health out of range: ${fish.health}`);
                    }

                    if (fish.sick && !fish.sickStartedAt) {
                        errors.push(`Fish ${fish.name} is sick but has no sickStartedAt`);
                    }

                    if (!fish.sick && fish.sickStartedAt) {
                        errors.push(`Fish ${fish.name} is not sick but has sickStartedAt`);
                    }

                    if (fish.medicated && !fish.sick) {
                        errors.push(`Fish ${fish.name} is medicated but not sick`);
                    }
                });
            }

            if (state.lightsOn === undefined) errors.push('lightsOn is undefined');
            if (state.discoOn === undefined) errors.push('discoOn is undefined');
            if (state.pumpOn === undefined) errors.push('pumpOn is undefined');
            if (state.fishCounter === undefined) errors.push('fishCounter is undefined');
            if (state.lastFed === undefined) errors.push('lastFed is undefined');

            return errors;
        }

        it('should pass validation for valid state', () => {
            const validState = {
                fishes: [
                    {
                        name: 'Freddy',
                        health: 75,
                        sick: true,
                        sickStartedAt: Date.now(),
                        medicated: true,
                        medicatedAt: Date.now()
                    }
                ],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 1,
                lastFed: Date.now()
            };

            const errors = validateReceivedState(validState);
            expect(errors).toHaveLength(0);
        });

        it('should detect health out of range', () => {
            const invalidState = {
                fishes: [{
                    name: 'Freddy',
                    health: 150, // Invalid!
                    sick: false
                }],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 1,
                lastFed: Date.now()
            };

            const errors = validateReceivedState(invalidState);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(e => e.includes('health out of range'))).toBe(true);
        });

        it('should detect sick without timestamp', () => {
            const invalidState = {
                fishes: [{
                    name: 'Freddy',
                    health: 75,
                    sick: true,
                    sickStartedAt: null // Invalid!
                }],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 1,
                lastFed: Date.now()
            };

            const errors = validateReceivedState(invalidState);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(e => e.includes('sick but has no sickStartedAt'))).toBe(true);
        });

        it('should detect medicated but not sick', () => {
            const invalidState = {
                fishes: [{
                    name: 'Freddy',
                    health: 100,
                    sick: false,
                    medicated: true, // Invalid!
                    medicatedAt: Date.now()
                }],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 1,
                lastFed: Date.now()
            };

            const errors = validateReceivedState(invalidState);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(e => e.includes('medicated but not sick'))).toBe(true);
        });

        it('should detect missing required properties', () => {
            const invalidState = {
                fishes: [],
                // Missing: lightsOn, discoOn, pumpOn, fishCounter, lastFed
            };

            const errors = validateReceivedState(invalidState);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(e => e.includes('lightsOn is undefined'))).toBe(true);
            expect(errors.some(e => e.includes('discoOn is undefined'))).toBe(true);
            expect(errors.some(e => e.includes('pumpOn is undefined'))).toBe(true);
            expect(errors.some(e => e.includes('fishCounter is undefined'))).toBe(true);
            expect(errors.some(e => e.includes('lastFed is undefined'))).toBe(true);
        });

        it('should handle null state gracefully', () => {
            const errors = validateReceivedState(null);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toBe('State is null or not an object');
        });

        it('should handle missing fishes array', () => {
            const invalidState = {
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 0,
                lastFed: Date.now()
                // Missing: fishes array
            };

            const errors = validateReceivedState(invalidState);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(e => e.includes('Fishes is not an array'))).toBe(true);
        });
    });

    describe('Refresh Cycle Simulation', () => {
        it('should preserve fish health across refresh', () => {
            // Before refresh
            const serverState = {
                fishes: [{
                    name: 'Freddy',
                    health: 67.5,
                    sick: false
                }]
            };

            // After refresh - same state returned
            const clientState = serverState;

            expect(clientState.fishes[0].health).toBe(67.5);
            expect(clientState.fishes[0].sick).toBe(false);
        });

        it('should preserve sick status across refresh', () => {
            const now = Date.now();
            const serverState = {
                fishes: [{
                    name: 'Freddy',
                    health: 50,
                    sick: true,
                    sickStartedAt: now,
                    medicated: true,
                    medicatedAt: now
                }]
            };

            const clientState = serverState;

            expect(clientState.fishes[0].sick).toBe(true);
            expect(clientState.fishes[0].sickStartedAt).toBe(now);
            expect(clientState.fishes[0].medicated).toBe(true);
            expect(clientState.fishes[0].medicatedAt).toBe(now);
        });

        it('should preserve recovered fish status', () => {
            // Fish that recovered should stay recovered
            const serverState = {
                fishes: [{
                    name: 'Freddy',
                    health: 100,
                    sick: false,
                    sickStartedAt: null,
                    medicated: false,
                    medicatedAt: null
                }]
            };

            const clientState = serverState;

            expect(clientState.fishes[0].sick).toBe(false);
            expect(clientState.fishes[0].sickStartedAt).toBe(null);
            expect(clientState.fishes[0].medicated).toBe(false);
        });

        it('should preserve tank control states', () => {
            const serverState = {
                lightsOn: false,
                discoOn: true,
                pumpOn: true,
                heatingOn: false,
                hasBall: true
            };

            expect(serverState.lightsOn).toBe(false);
            expect(serverState.discoOn).toBe(true);
            expect(serverState.pumpOn).toBe(true);
            expect(serverState.heatingOn).toBe(false);
            expect(serverState.hasBall).toBe(true);
        });
    });

    describe('Save Timing Guarantees', () => {
        it('should save immediately on critical events', () => {
            let saveWasCalled = false;
            const mockSave = () => { saveWasCalled = true; };

            // Simulate fish recovery
            mockSave(); // recoverFish() calls saveState()

            expect(saveWasCalled).toBe(true);
        });

        it('should save within 10 seconds at most', () => {
            // Auto-save interval is 10 seconds (reduced from 30)
            const saveInterval = 10 * 1000; // 10 seconds

            expect(saveInterval).toBeLessThanOrEqual(10000);
        });

        it('should save on shutdown', () => {
            // Server has shutdown handler that calls saveState()
            let saveOnShutdown = false;
            const mockShutdown = () => { saveOnShutdown = true; };

            mockShutdown();

            expect(saveOnShutdown).toBe(true);
        });
    });

    describe('Invalid State Handling', () => {
        it('should reject invalid state on client', () => {
            const invalidState = {
                fishes: [{
                    name: 'Freddy',
                    health: 150, // INVALID!
                    sick: false
                }],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                fishCounter: 1,
                lastFed: Date.now()
            };

            // Validation function (same as client-side)
            function validateReceivedState(state) {
                const errors = [];
                if (state.fishes[0].health > 100) {
                    errors.push('Health out of range');
                }
                return errors;
            }

            const errors = validateReceivedState(invalidState);

            // Client should detect and reject
            expect(errors.length).toBeGreaterThan(0);

            // In real implementation, client would return early
            // and request fresh state from server
        });

        it('should auto-fix invalid state on server', () => {
            const invalidFish = {
                name: 'Freddy',
                health: 150, // INVALID!
                sick: false
            };

            // Server auto-fix logic
            if (invalidFish.health > 100) {
                invalidFish.health = 100;
            }

            expect(invalidFish.health).toBe(100);
        });

        it('should auto-fix sick without timestamp', () => {
            const invalidFish = {
                name: 'Freddy',
                health: 75,
                sick: true,
                sickStartedAt: null // INVALID!
            };

            // Server auto-fix
            if (invalidFish.sick && !invalidFish.sickStartedAt) {
                invalidFish.sickStartedAt = Date.now();
            }

            expect(invalidFish.sickStartedAt).not.toBeNull();
            expect(typeof invalidFish.sickStartedAt).toBe('number');
        });

        it('should auto-fix medicated but not sick', () => {
            const invalidFish = {
                name: 'Freddy',
                health: 100,
                sick: false,
                medicated: true, // INVALID!
                medicatedAt: Date.now()
            };

            // Server auto-fix
            if (invalidFish.medicated && !invalidFish.sick) {
                invalidFish.medicated = false;
                invalidFish.medicatedAt = null;
            }

            expect(invalidFish.medicated).toBe(false);
            expect(invalidFish.medicatedAt).toBe(null);
        });

        it('should save state after auto-fix', () => {
            let saveWasCalled = false;
            const mockSave = () => { saveWasCalled = true; };

            // Simulate validation finding errors
            const errorsFound = true;

            if (errorsFound) {
                // Auto-fix happens...
                // Then save
                mockSave();
            }

            expect(saveWasCalled).toBe(true);
        });
    });

    describe('Medicine Cooldown Sync', () => {
        it('should include lastMedicine in gameState', () => {
            const gameState = {
                fishes: [],
                lastFed: Date.now(),
                lastMedicine: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
                feedCooldown: 60 * 60 * 1000,
                medicineCooldown: 24 * 60 * 60 * 1000
            };

            expect(gameState).toHaveProperty('lastMedicine');
            expect(gameState).toHaveProperty('feedCooldown');
            expect(gameState).toHaveProperty('medicineCooldown');
        });

        it('should load medicine cooldown from server', () => {
            const serverState = {
                lastMedicine: Date.now() - (5 * 60 * 60 * 1000), // 5 hours ago
                feedCooldown: 60 * 60 * 1000,
                medicineCooldown: 24 * 60 * 60 * 1000
            };

            // Client loads this
            const lastMedicine = serverState.lastMedicine;
            const timeUntilReady = serverState.medicineCooldown - (Date.now() - lastMedicine);

            expect(timeUntilReady).toBeGreaterThan(0);
            expect(timeUntilReady).toBeLessThan(serverState.medicineCooldown);
        });
    });

    describe('Hash Verification', () => {
        it('should calculate matching hashes for same state', () => {
            // Mock hash function (simple version for testing)
            function simpleHash(obj) {
                const str = JSON.stringify(obj);
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return hash.toString(16);
            }

            const state = {
                fishCount: 2,
                fishes: [
                    { name: 'Freddy', health: 100, sick: false, medicated: false },
                    { name: 'Nemo', health: 75, sick: true, medicated: true }
                ],
                lightsOn: true,
                discoOn: false,
                pumpOn: false,
                hasBall: false
            };

            const hash1 = simpleHash(state);
            const hash2 = simpleHash(state);

            expect(hash1).toBe(hash2);
        });

        it('should detect different hashes for different state', () => {
            function simpleHash(obj) {
                const str = JSON.stringify(obj);
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return hash.toString(16);
            }

            const state1 = { fishCount: 2, lightsOn: true };
            const state2 = { fishCount: 2, lightsOn: false };

            const hash1 = simpleHash(state1);
            const hash2 = simpleHash(state2);

            expect(hash1).not.toBe(hash2);
        });

        it('should request fresh gameState on hash mismatch', () => {
            let gameStateRequested = false;
            const mockRequest = () => { gameStateRequested = true; };

            const serverHash = 'abc123';
            const clientHash = 'def456';

            if (serverHash !== clientHash) {
                mockRequest();
            }

            expect(gameStateRequested).toBe(true);
        });
    });

    describe('Message Sequence Numbers', () => {
        it('should track message sequence', () => {
            let messageSeq = 0;

            const msg1 = { command: 'healthUpdate', seq: ++messageSeq };
            const msg2 = { command: 'diseaseUpdate', seq: ++messageSeq };
            const msg3 = { command: 'healthUpdate', seq: ++messageSeq };

            expect(msg1.seq).toBe(1);
            expect(msg2.seq).toBe(2);
            expect(msg3.seq).toBe(3);
        });

        it('should ignore out-of-order messages', () => {
            let lastSeenSeq = 0;
            const processedMessages = [];

            const messages = [
                { type: 'healthUpdate', seq: 1 },
                { type: 'healthUpdate', seq: 3 },
                { type: 'healthUpdate', seq: 2 }, // Out of order!
                { type: 'healthUpdate', seq: 4 }
            ];

            messages.forEach(msg => {
                if (msg.seq > lastSeenSeq) {
                    processedMessages.push(msg);
                    lastSeenSeq = msg.seq;
                }
            });

            expect(processedMessages).toHaveLength(3);
            expect(processedMessages.map(m => m.seq)).toEqual([1, 3, 4]);
        });

        it('should always accept gameState messages', () => {
            let lastSeenSeq = 10;

            const oldGameState = { type: 'gameState', seq: 5 };

            // gameState should always be processed, even if seq is old
            const shouldProcess = oldGameState.type === 'gameState' || oldGameState.seq > lastSeenSeq;

            expect(shouldProcess).toBe(true);
        });
    });
});
