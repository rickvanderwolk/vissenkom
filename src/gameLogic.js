// Pure functions for game logic calculations
// These functions have no side effects and can be easily tested

/**
 * Calculate temperature damage based on temperature thresholds
 * @param {number} temp - Current temperature in Celsius
 * @returns {number} - Damage value (negative number or 0)
 */
export function calculateTemperatureDamage(temp) {
    if (temp > 32) return -2.0;
    if (temp > 30) return -1.0;
    if (temp < 16) return -1.0;
    if (temp < 18) return -0.5;
    return 0;
}

/**
 * Calculate all health changes for a fish in one tick (10 minutes)
 * @param {Object} fish - Fish object with health, sick, medicated properties
 * @param {number} temperature - Current tank temperature
 * @returns {Object} - New health value and whether fish recovered
 */
export function calculateHealthChange(fish, temperature) {
    let health = fish.health || 100;
    let recovered = false;

    // Hunger damage: -0.167% per 10 minutes
    health = Math.max(0, health - 0.167);

    // Disease damage: -0.083% per 10 minutes when sick and not medicated
    if (fish.sick && !fish.medicated) {
        health = Math.max(0, health - 0.083);
    }

    // Temperature stress damage (divided by 6 in the original code)
    const tempDamage = calculateTemperatureDamage(temperature);
    if (tempDamage < 0) {
        health = Math.max(0, health + (tempDamage / 6));
    }

    // Medicine recovery: +0.333% per 10 minutes when medicated
    if (fish.medicated) {
        health = Math.min(100, health + 0.333);
    }

    // Check for full recovery
    if (health >= 100 && fish.sick && fish.medicated) {
        recovered = true;
    }

    return {
        health: health,
        recovered: recovered,
        isDead: health <= 0,
        isCritical: health <= 30 && health > 29.5
    };
}

/**
 * Calculate temperature multiplier for disease spread
 * @param {number} temp - Current temperature in Celsius
 * @returns {number} - Multiplier (1.0, 1.5, or 2.0)
 */
export function calculateTemperatureMultiplier(temp) {
    if (temp > 28) return 2.0;
    if (temp < 20) return 1.5;
    return 1.0;
}

/**
 * Calculate environmental infection chance
 * @param {number} poopCount - Number of poop particles
 * @param {number} waterGreenness - Algae level (0-100)
 * @param {number} temperature - Current temperature
 * @returns {number} - Infection chance (0-1 probability)
 */
export function calculateEnvironmentalInfectionChance(poopCount, waterGreenness, temperature) {
    // No infection if environment is clean
    if (poopCount <= 30 && waterGreenness <= 80) {
        return 0;
    }

    const baseChance = 0.0083;
    const tempMultiplier = calculateTemperatureMultiplier(temperature);
    return baseChance * tempMultiplier;
}

/**
 * Calculate contact infection chance
 * @param {number} sickFishCount - Number of sick, unmedicated fish
 * @param {number} temperature - Current temperature
 * @param {boolean} pumpOn - Whether the pump is running (fish gather near pump)
 * @returns {number} - Infection chance (0-1 probability)
 */
export function calculateContactInfectionChance(sickFishCount, temperature, pumpOn = false) {
    if (sickFishCount === 0) {
        return 0;
    }

    const baseChance = 0.03;
    const tempMultiplier = calculateTemperatureMultiplier(temperature);
    // Pump on = fish gather together = 1.5x contact spread
    const pumpMultiplier = pumpOn ? 1.5 : 1.0;
    return (sickFishCount * baseChance) * tempMultiplier * pumpMultiplier;
}

/**
 * Determine if infection occurs based on chance
 * @param {number} chance - Infection probability (0-1)
 * @param {number} randomValue - Random value for testing (optional, uses Math.random() if not provided)
 * @returns {boolean} - Whether infection occurs
 */
export function shouldGetInfected(chance, randomValue = null) {
    const random = randomValue !== null ? randomValue : Math.random();
    return random < chance;
}

/**
 * Calculate cause of death
 * @param {Object} fish - Fish object
 * @returns {string} - 'disease' or 'hunger'
 */
export function determineDeathCause(fish) {
    return fish.sick ? 'disease' : 'hunger';
}

/**
 * Calculate poop filtered by pump per tick (10 minutes)
 * @param {boolean} pumpOn - Whether the pump/filter is running
 * @returns {number} - Amount of poop to remove
 */
export function calculatePumpPoopFiltering(pumpOn) {
    // Pump filters 1 poop per 10 minutes when running
    return pumpOn ? 1 : 0;
}
