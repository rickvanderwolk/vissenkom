# State Synchronization Guarantees

This document describes what state is synchronized between server and client, and what guarantees exist for state consistency across page refreshes.

## ✅ Core State - 100% Synced

These critical properties are **guaranteed** to be identical after a page refresh:

### Fish Health & Disease State
- ✅ `health` (0-100%) - Exact health percentage
- ✅ `sick` status - Whether fish is sick or healthy
- ✅ `sickStartedAt` - Timestamp when fish got sick
- ✅ `medicated` status - Whether fish has received medicine
- ✅ `medicatedAt` - Timestamp when medicine was administered

**Guarantee**: All fish health and disease state is persisted within 10 seconds maximum, and immediately on critical events (infection, medication, recovery, death).

### Fish Identity & Stats
- ✅ `name` - Fish name
- ✅ `bornAt` / `addedAt` - Birth/addition timestamp
- ✅ `eats` - Number of times fed
- ✅ `lastEat` - Last feeding timestamp
- ✅ `baseSize` - Fish size
- ✅ `hue` - Fish color
- ✅ `speed` - Swimming speed
- ✅ Other fish properties (sickTop, hungerWindow)

### Tank State
- ✅ `lightsOn` - Lights on/off
- ✅ `discoOn` - Disco mode on/off
- ✅ `pumpOn` - Pump on/off
- ✅ `heatingOn` - Heater on/off
- ✅ `temperature` - Water temperature
- ✅ `hasBall` - Play ball present (fixed in this release!)
- ✅ `poopCount` - Amount of waste
- ✅ `waterGreenness` - Water quality (0-100)

### Meta State
- ✅ `fishCounter` - Fish ID counter
- ✅ `lastFed` - Last global feed time
- ✅ `lastMedicine` - Last medicine administration time (fixed in 0.13.5!)
- ✅ `feedCooldown` - Feeding cooldown duration
- ✅ `medicineCooldown` - Medicine cooldown duration
- ✅ `deadLog` - History of deceased fish
- ✅ `theme` - Current theme (normal/halloween/etc)
- ✅ `currentAccessCode` - QR code for controllers

---

## ❌ Visual State - NOT Synced

These properties are **randomized** on each page refresh:

### Fish Position & Movement
- ❌ `x, y` - Fish position (respawns in center area)
- ❌ `vx, vy` - Fish velocity/direction
- ❌ `dir` - Swimming direction
- ❌ `behaviorState` - Current behavior (normal/playing/resting/etc)
- ❌ `turnTimer` - Swimming pattern timer

**Why**: These are visual/animation states that don't affect the core simulation.

### Ephemeral Elements
- ❌ Food particles in water
- ❌ Bubbles
- ❌ Ball position (existence synced, position randomized)
- ❌ Plant positions
- ❌ Decoration positions
- ❌ Star positions (background)
- ❌ Ambient particles

**Why**: These are purely decorative and regenerated on each load.

---

## 🔒 Synchronization Mechanisms

### 1. Automatic Saves
- **Auto-save interval**: Every 10 seconds
- **Immediate saves** on critical events:
  - Fish gets infected
  - Fish receives medicine
  - Fish recovers
  - Fish dies
  - **State validation detects and fixes errors**

### 2. State Validation

**Server-Side** (`server.js`):
- Runs every 2 minutes
- Runs on server startup (validates loaded state)
- Validates all fish states:
  - Health within 0-100
  - Sick status consistent with timestamps
  - Medicated only if sick
- **Auto-fixes ALL inconsistencies**:
  - Clamps health to 0-100
  - Adds missing timestamps
  - Clears invalid flags
- **Broadcasts corrections** to all clients
- **Saves fixed state immediately** to disk
- Logs errors for tracking

**Client-Side** (`vissenkom.js`):
- Validates state on load (every refresh)
- Same validation checks as server
- **REFUSES to load invalid state**
- Automatically requests fresh state from server
- Logs validation errors to console

### 3. Hash Verification (NEW in 0.13.5!)

**Automatic Hash Checks**:
- **Initial check**: 5 seconds after page load
- **Periodic checks**: Every 30 seconds
- **Manual check**: `checkSyncNow()` in console

**How It Works**:
1. Client calculates hash of core state (fish health, sick status, tank state)
2. Server calculates same hash from its state
3. Hashes are compared
4. ✅ **If matching**: Sync confirmed, logged to console
5. ❌ **If mismatched**: Fresh gameState automatically requested

**What's Included in Hash**:
- Fish count
- Each fish: name, health (rounded to 0.1), sick, medicated
- Tank: lightsOn, discoOn, pumpOn, hasBall

**Console Output**:
```
[SYNC] ✅ State in sync | Hash: a3f5b2c9 | Fish: 5 | Sick: 2
[SYNC] ❌ HASH MISMATCH DETECTED!
[SYNC] 🔄 Requesting fresh gameState...
```

### 4. Message Sequencing (NEW in 0.13.5!)

**Protection Against Out-of-Order Messages**:
- Every server message includes sequence number (`seq`)
- Client tracks last seen sequence number
- Messages with old sequence numbers are ignored
- Prevents race conditions from network delays

**Exception**: `gameState` messages always accepted (they're authoritative)

**Console Output**:
```
[SYNC] ⚠️ Ignored out-of-order message | Type: healthUpdate, Seq: 142 (last: 145)
```

---

## 🛡️ Invalid State Protection

### What Happens if State is Invalid?

**Scenario 1: Corrupted gamestate.json**

1. Server loads state from disk
2. Validation detects errors (e.g., health = 150)
3. **Server auto-fixes** (health → 100)
4. **Saves fixed state immediately**
5. Broadcasts corrections to clients
6. ✅ State is now valid

**Scenario 2: Client Receives Invalid State**

1. Client receives gameState from server
2. Validation detects errors
3. **Client REFUSES to load state**
4. Logs error to console
5. **Automatically requests fresh gameState**
6. Server responds with (auto-fixed) valid state
7. ✅ Valid state loaded

**Scenario 3: State Corrupts During Runtime**

1. Periodic validation (every 2 minutes) detects issue
2. **Server auto-fixes immediately**
3. **Saves fixed state to disk**
4. Broadcasts corrections to clients
5. ✅ Corruption prevented from persisting

### Auto-Fix Examples

```javascript
// Health out of range → clamped
fish.health = 150  →  fish.health = 100
fish.health = -10  →  fish.health = 0

// Sick without timestamp → timestamp added
fish.sick = true, sickStartedAt = null
  →  fish.sickStartedAt = Date.now()

// Medicated but not sick → flags cleared
fish.sick = false, medicated = true
  →  fish.medicated = false, medicatedAt = null
```

### Protection Guarantees

✅ **Invalid state NEVER persists**
- Auto-fixed within 2 minutes (periodic validation)
- Auto-fixed on server startup (if corrupted file)
- Auto-fixed immediately on detection

✅ **Clients NEVER display invalid state**
- Validation on every load
- Automatic rejection + re-request
- No visual glitches from bad data

✅ **State consistency maintained**
- All fixes broadcasted to clients
- Fixed state saved immediately
- No drift between clients possible

---

## 🐛 Fixed Bugs

### Bug #1: hasBall Not Synced
**Before**: `hasBall` was not included in `sendGameState()`
**After**: Added `hasBall` to game state sync
**Impact**: Play ball now persists correctly across refreshes

### Bug #2: Health 0 Shows Wrong Emoji
**Before**: `fish.health || 100` treated 0 as falsy → showed 🦠 instead of 💀
**After**: `fish.health !== undefined ? fish.health : 100`
**Impact**: Dead/dying fish show correct 💀 emoji

### Bug #3: Race Conditions in Health Updates
**Before**: Eating and health tick could overwrite each other
**After**: Centralized queue system (`updateFishState`)
**Impact**: No more lost health updates

### Bug #4: Duplicate Recovery Events
**Before**: Recovery logic existed in 2 places
**After**: Centralized `recoverFish()` function
**Impact**: Clean event log, single recovery per fish

### Bug #5: Medicine Cooldown Not Synced
**Before**: `lastMedicine`, `feedCooldown`, `medicineCooldown` not in gameState
**After**: Added all cooldown state to sync
**Impact**: Cooldown timers now correct after page refresh

---

## 📊 Test Coverage

- **113 tests** passing ✅
- **5 test suites**:
  - Health calculations
  - Disease spread mechanics
  - Client emoji logic
  - Server integration
  - **State synchronization (expanded in 0.13.5!)**
    - Medicine cooldown sync
    - Hash verification
    - Message sequence numbers
    - Invalid state handling
    - Sync timing guarantees

---

## 🎯 What This Means for Users

After a page refresh (F5), you can expect:

### ✅ Will Stay the Same:
- All fish health percentages
- Which fish are sick/healthy
- Which fish are medicated
- Sick emoji (🦠/🤢/💀) matches health
- **Medicine cooldown timer** (fixed in 0.13.5!)
- **Feed cooldown timer** (fixed in 0.13.5!)
- Tank lights, disco, pump status
- Water temperature and quality
- Play ball presence
- Number of fish
- Dead fish log

### ❌ Will Change:
- Fish positions (respawn in center)
- Fish swimming directions
- Food in water (disappears)
- Ball position (respawns randomly)
- Plants/decorations (regenerate)

### ⚠️ Maximum Data Loss Window:
- **10 seconds** (auto-save interval)
- **0 seconds** for critical events (infection, medicine, recovery, death)

---

## 🔧 For Developers

### Adding New Synced State
1. Add property to `appState` in `server.js`
2. Add to `sendGameState()` data object
3. Add to `loadGameState()` in `vissenkom.js`
4. Add validation in `validateReceivedState()`
5. Add test in `state-sync.test.js`

### Debugging Sync Issues
1. Check browser console for validation errors
2. **Use manual sync commands** (NEW in 0.13.5!):
   - `checkSyncNow()` - Immediate hash verification
   - `forceSyncNow()` - Request fresh gameState from server
   - `getSyncStats()` - View sync statistics
3. Check server logs for state validation errors
4. Verify `gamestate.json` contains expected data
5. Run test suite: `npm test`

### Manual Sync Commands (NEW!)

Open browser console and run:

```javascript
// Check if client and server state match right now
checkSyncNow()
// Output: [SYNC] ✅ State in sync | Hash: a3f5b2c9

// Force re-sync from server (useful if something looks wrong)
forceSyncNow()
// Output: [SYNC] Force re-sync requested...

// View sync statistics
getSyncStats()
// Output: Table showing:
//   - Last check time
//   - Hash matches/mismatches
//   - Last server/client hash
//   - Total checks performed
```

**When to Use**:
- `checkSyncNow()`: When you suspect state drift
- `forceSyncNow()`: When display looks wrong but hash matches
- `getSyncStats()`: To see sync health over time

### Environment Variables
```bash
LOG_LEVEL=DEBUG npm start  # Enable debug logging
```

---

## 📝 Version History

- **0.13.5** (Current)
  - **Sync Improvements**:
    - Fixed hasBall sync bug
    - Fixed medicine cooldown sync bug
    - Added automatic hash verification (every 30s)
    - Added message sequence numbers
    - Added manual sync commands (checkSyncNow, forceSyncNow, getSyncStats)
  - **Validation**:
    - Added client-side state validation
    - Client refuses invalid state and auto-requests fresh state
  - **Performance**:
    - Reduced auto-save interval (30s → 10s)
    - Added immediate saves for critical events
  - **Testing**:
    - Expanded to 113 tests (from 100)
    - Full coverage for sync mechanisms

---

## ⏱️ Sync & Check Frequencies

Complete overview of all automatic synchronization and validation:

| **Activity** | **Frequency** | **Purpose** | **Action on Issue** |
|-------------|---------------|-------------|---------------------|
| **State Save** | Every 10s | Persist state to disk | N/A |
| **State Save (Critical)** | Immediate | Save on infection/medicine/recovery/death | N/A |
| **State Broadcast** | Every 5s | Send healthUpdate to all clients | N/A |
| **State Validation (Server)** | Every 2 min | Check for state corruption | Auto-fix + save + broadcast |
| **Hash Verification (Client)** | Every 30s | Detect client-server drift | Request fresh gameState |
| **Hash Verification (Initial)** | 5s after load | Confirm sync after refresh | Request fresh gameState |
| **State Validation (Client)** | On load | Reject invalid incoming state | Request fresh gameState |

### What Gets Checked?

**State Save** (10s / immediate):
- Writes entire `appState` to `gamestate.json`
- Includes all fish, tank state, meta state

**State Broadcast** (5s):
- Sends `healthUpdate` with all fish health/sick/medicated
- Keeps clients up-to-date in real-time

**State Validation** (2 min / on load):
- Health in range (0-100)
- Sick status consistent with timestamps
- Medicated only if sick
- All required fields present

**Hash Verification** (30s / 5s initial):
- Fish count + health + sick + medicated
- Tank state (lights, disco, pump, ball)
- Simple hash comparison (fast!)

### Manual Control

You can trigger these checks manually:

```javascript
checkSyncNow()    // Immediate hash check
forceSyncNow()    // Request fresh state
getSyncStats()    // View sync history
```

---

## ⚡ Performance Notes

- State save: ~1ms (synchronous file write)
- State validation: <1ms per fish
- State hash calculation: <1ms
- Hash verification: <5ms round-trip
- No noticeable performance impact from validation

---

## 🎮 For Users

**TLDR**: After refreshing the page, your fish health, sick status, and tank settings will be exactly the same. Fish positions will change (they respawn in the center), but nothing important is lost.

**Maximum data loss**: 10 seconds of health changes if server crashes (very unlikely).

**Recommendation**: If you want to be 100% safe, wait 10 seconds after a critical event (fish getting sick, giving medicine) before closing the page.
