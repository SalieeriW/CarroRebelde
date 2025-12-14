# 🚗 Carro Rebelde (Rebel Car) - Detailed Documentation

This is the comprehensive documentation for Carro Rebelde. For a quick overview, see the main [README.md](README.md).

## 📖 Table of Contents

1. [Minigame Details](#minigame-details)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Installation Guide](#installation-guide)
4. [API Documentation](#api-documentation)
5. [Development Guide](#development-guide)

---

## 🎮 Minigame Details

### 1. **Blind Rally Integration** 🏁

**Full Description**: This isn't a separate minigame but represents how the main game's portal system integrates with external minigame services. When players hit a special cone or portal on the track, the car freezes and a unique session is created.

**Technical Flow**:
1. Client detects collision with portal (Three.js raycasting)
2. WebSocket message sent to Colyseus server
3. Server generates session ID: `mg_<timestamp>_<randomHash>`
4. Server broadcasts `minigameActive=true` to all players
5. Each player's browser opens minigame in new tab with URL params
6. Main game enters "frozen" state until result received

**URL Parameters Passed**:
- `session` - Unique session ID
- `room` - 4-letter room code
- `role` - Player's current role (driver/navigator/etc.)

---

### 2. **Coop Miner** 🪨

**Full Description**: A cooperative mining game inspired by Gold Miner, where two players must work together across 3 increasingly difficult levels. Player A operates the mining hook but can only see the visual appearance of objects. Player B sees all the metadata (values, weights, special effects) but cannot control the hook. Verbal communication is essential.

**Detailed Level Design**:

**Level 1: Enchanted Forest** (Goal: 150 points)
| Object | Icon | Value | Weight | Size | Special |
|--------|------|-------|--------|------|---------|
| Stone | 🪨 | 8 pts | Heavy | Large | None |
| Crystal | 💎 | 25 pts | Medium | Medium | None |
| Chest | 📦 | 50 pts | Small | Small | ±10 variance |
| Mushroom | 🍄 | 15 pts | Light | Medium | None |

**Level 2: Asteroid Belt** (Goal: 200 points)
| Object | Icon | Value | Weight | Size | Special |
|--------|------|-------|--------|------|---------|
| Meteorite | ☄️ | -10 pts | Very Heavy | Large | Slows hook |
| Core | 🌟 | 20 pts | Light | Medium | None |
| Diamond | 💠 | 60 pts | Very Heavy | Small | High value |
| Plasma | ⚡ | 10 pts | Light | Small | Speed buff |
| Fragment | 🌑 | 15 pts | Medium | Medium | None |

**Level 3: Candy Paradise** (Goal: 180 points)
| Object | Icon | Value | Weight | Size | Special |
|--------|------|-------|--------|------|---------|
| Lollipop | 🍭 | 15 pts | Light | Large | None |
| Rainbow | 🌈 | 25 pts | Medium | Medium | Next catch +5 |
| Chocolate | 🍫 | 40 pts | Heavy | Small | None |
| Jelly | 🧃 | 10 pts | Medium | Large | Next catch +5 |
| Mystery Box | 🎁 | 50 pts | Heavy | Small | High value |

**Optimal Strategy**:
- Level 1: Focus on Chests (50pts) and Crystals (25pts)
- Level 2: Avoid Meteorites (-10pts), prioritize Diamonds (60pts)
- Level 3: Chain Rainbows and Jelly for combo bonuses

**API Endpoints**:
```
GET  /rooms/:code              - Fetch room state
POST /rooms/:code/claim        - Claim Operator (A) or Strategist (B) seat
POST /rooms/:code/ready        - Mark ready to start
POST /rooms/:code/start        - Begin countdown
POST /rooms/:code/action/hook  - Fire hook at angle (A only)
POST /rooms/:code/chat         - Send team message
POST /rooms/:code/reset        - Restart from level 1
```

---

### 3. **Gomoku Duel** ⚫⚪

**Full Description**: Two players collaborate to defeat a smart AI in Gomoku (Five in a Row). The AI uses pattern recognition and heuristic evaluation to play defensively. Players must coordinate offensive and defensive strategies.

**AI Algorithm** (Simplified):

```
For each empty cell on 15×15 board:
  1. Simulate placing AI stone → Calculate offense score
  2. Simulate placing player stone → Calculate defense score
  3. Apply defense multiplier: defense_score *= 1.5
  4. Total score = offense_score + defense_score
  5. Select cell with highest total score
```

**Pattern Scoring**:

| Pattern Type | Example | Points | Description |
|--------------|---------|--------|-------------|
| Five | `○○○○○` | 100,000 | Instant win |
| Live Four | `_○○○○_` | 10,000 | Win next turn |
| Dead Four | `●○○○○_` | 5,000 | Blocked one side |
| Live Three | `_○○○_` | 1,000 | Strong threat |
| Dead Three | `●○○○_` | 200 | Moderate threat |
| Live Two | `_○○_` | 100 | Weak threat |

**Cooperative Tactics**:
1. **Opening**: Players should spread stones across the board (not clustered)
2. **Mid-game**: Create multiple threats simultaneously
3. **End-game**: Force AI into defending two threats at once (double threat)
4. **Communication**: Use chat to plan 2-3 moves ahead

**Example Winning Strategy**:
```
Turn 1 (Player A): Place stone at H8 (center)
Turn 2 (Player B): Place stone at H7 (build vertical)
Turn 3 (AI): Blocks at H9
Turn 4 (Player A): Place stone at G8 (create horizontal threat)
Turn 5 (Player B): Place stone at I8 (double threat!)
-> AI can only block one direction, players win
```

---

### 4. **Pictionary** 🎨

**Full Description**: A telephone-style drawing game where the word degrades through each redrawing phase. The challenge comes from interpreting simplified or distorted drawings.

**Drawing Tools**:
- **Brush Sizes**: 2px (fine), 6px (medium), 12px (thick)
- **Colors**: Black, Red, Blue, Green, Yellow, Orange, Purple, Brown
- **Actions**: Clear canvas, Undo last stroke (if implemented)
- **Canvas Size**: 600×400 pixels

**Word Categories** (120+ words):

| Category | Examples | Difficulty |
|----------|----------|------------|
| Animals | cat, dog, fish, elephant, snake | Easy |
| Objects | house, car, phone, book, chair | Easy |
| Nature | tree, sun, moon, cloud, mountain | Easy |
| Food | pizza, apple, banana, cake, coffee | Medium |
| Actions | running, jumping, sleeping, dancing | Hard |
| Emotions | happy, sad, angry, surprised | Hard |

**Phase Breakdown**:
- **Phase 1** (12 seconds): Drawer 1 sees word, draws freely
- **Transition**: Drawing saved as PNG, sent to server
- **Phase 2** (12 seconds): Drawer 2 sees only the image, redraws interpretation
- **Transition**: Second drawing saved as PNG
- **Phase 3** (No time limit): Guesser sees final drawing, types answer

**Common Degradation Patterns**:
- Complex drawings → simplified shapes
- Colors → black and white
- Text → symbols (if drawer tries to cheat)
- Fine details → lost

---

### 5. **Two Keys Gate** 🔑🔑

**Full Description**: An asymmetric information puzzle where two players must decode symbol sequences together. Neither player has complete information, forcing pure verbal communication.

**Symbol Sets Used**:

**Level 1** (Playing Card Suits):
```
♠ = A
♣ = B
♥ = C
♦ = D
⭐ = E
```

**Level 2** (Greek Letters):
```
α = A
β = B
γ = C
δ = D
ε = E
ζ = F
η = G
```

**Level 3** (Zodiac Signs):
```
♈ = A  (Aries)
♉ = B  (Taurus)
♊ = C  (Gemini)
♋ = D  (Cancer)
♌ = E  (Leo)
♍ = F  (Virgo)
♎ = G  (Libra)
♏ = H  (Scorpio)
♐ = I  (Sagittarius)
♑ = J  (Capricorn)
```

**Example Puzzle** (Level 1):
```
Decoder Screen:
  Sequence: ♠ ♥ ♦ ⭐
  Choices:
    (A) ACDE
    (B) ABCE
    (C) ABDE
    (D) BCDE

Dictionary Keeper Screen:
  ♠ → A
  ♣ → B
  ♥ → C
  ♦ → D
  ⭐ → E

Solution: ♠♥♦⭐ = ACDE → Answer (A)
```

**Communication Tips**:
- Decoder: Describe symbols clearly ("spade, heart, diamond, star")
- Dictionary Keeper: Confirm each mapping ("spade is A, heart is C...")
- Both: Verify full sequence before submitting
- Time pressure increases in later levels

---

### 6. **Wordle** 🔤

**Full Description**: Classic Wordle mechanics adapted for cooperative play. Two players share the same board and attempt pool.

**Feedback Colors**:
- 🟩 **Green**: Letter is in word AND in correct position
- 🟨 **Yellow**: Letter is in word BUT wrong position
- ⬜ **Gray**: Letter is NOT in word

**Optimal Strategy** (6 attempts):

| Attempt | Strategy | Example Words |
|---------|----------|---------------|
| 1 | Test common vowels + consonants | ADIEU, AUDIO, ARISE |
| 2 | Use feedback, test new letters | STORM, CLUMP |
| 3 | Place confirmed letters | Based on feedback |
| 4-5 | Narrow down possibilities | Use elimination |
| 6 | Final guess | Make it count! |

**Advanced Tactics**:
- **Hard Mode**: Must use revealed letters in correct positions
- **Letter Frequency**: E, A, R, O, T are most common
- **Position Frequency**: S often starts words, E/Y often end
- **Vowel Distribution**: Most 5-letter words have 2 vowels

**Word Pool**: ~2,300 common 5-letter English words

---

## 🏗️ Architecture Deep Dive

### Communication Patterns

**Main Game** (WebSocket - Real-time bidirectional):
```javascript
// Client → Server
room.send("accelerate", { pressed: true });
room.send("steer", { direction: -1 }); // left

// Server → Client (automatic state sync)
room.state.onChange = (changes) => {
  console.log("Car position:", changes.carX, changes.carZ);
};
```

**Minigames** (REST + Polling):
```javascript
// Client polls every 1 second
setInterval(async () => {
  const state = await fetch(`/rooms/${code}`).then(r => r.json());
  updateUI(state);
}, 1000);

// Client sends actions
await fetch(`/rooms/${code}/action/hook`, {
  method: 'POST',
  body: JSON.stringify({ angle: 45 })
});
```

### State Synchronization Comparison

| Aspect | Colyseus (Main Game) | REST (Minigames) |
|--------|----------------------|------------------|
| **Latency** | ~20-50ms | ~100-500ms |
| **Direction** | Bidirectional | Request/Response |
| **Updates** | Push (automatic) | Pull (polling) |
| **Bandwidth** | Low (delta encoding) | Medium (full state) |
| **Complexity** | High | Low |
| **Best For** | Real-time action | Turn-based/slower |

---

## 📦 Installation Guide

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2GB | 4GB+ |
| Node.js | 18.0 | 20.0+ |
| Browser | Chrome 90 | Chrome 120+ |
| Network | 5 Mbps | 25 Mbps+ |

### Step-by-Step Installation

#### 1. Clone Repository
```bash
git clone https://github.com/yourusername/CarroRebelde.git
cd CarroRebelde
```

#### 2. Install Main Game
```bash
# Server
cd server
npm install
cp .env.example .env  # Create environment file
cd ..

# Client
cd client
npm install
cp .env.example .env
cd ..
```

#### 3. Install Minigames (Optional)

**Quick Script** (Bash/Linux/Mac):
```bash
#!/bin/bash
MINIGAMES=("coop-miner" "gomoku-duel" "two-keys-gate" "pictionary" "wordle")

for game in "${MINIGAMES[@]}"; do
  echo "Installing $game..."

  # Server
  if [ -d "minigames/$game/server" ] || [ -d "minigames/$game/${game}-server" ]; then
    cd minigames/$game/*server
    npm install
    cd ../../..
  fi

  # Client
  if [ -d "minigames/$game/client" ] || [ -d "minigames/$game/${game}-client" ]; then
    cd minigames/$game/*client
    npm install
    cd ../../..
  fi
done

echo "✅ All minigames installed!"
```

**Manual Installation**:
```bash
# Coop Miner
cd minigames/coop-miner/server && npm install && cd ../../..
cd minigames/coop-miner/client && npm install && cd ../../..

# Gomoku Duel
cd minigames/gomoku-duel/server && npm install && cd ../../..
cd minigames/gomoku-duel/client && npm install && cd ../../..

# Two Keys Gate
cd minigames/two-keys-gate/server && npm install && cd ../../..
cd minigames/two-keys-gate/client && npm install && cd ../../..

# Pictionary
cd minigames/pictionary/pictionary-server && npm install && cd ../../..
cd minigames/pictionary/pictionary-client && npm install && cd ../../..

# Wordle
cd minigames/wordle/wordle-server && npm install && cd ../../..
cd minigames/wordle/wordle-client && npm install && cd ../../..
```

#### 4. Environment Configuration

**Main Server** (`.env`):
```env
PORT=2567
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Main Client** (`.env`):
```env
VITE_SERVER_URL=ws://localhost:2567
```

**Minigame Servers** (`.env` in each server folder):
```env
# coop-miner/server/.env
PORT=3000
DEFAULT_ROOM_CODE=MINER1

# gomoku-duel/server/.env
PORT=3002
DEFAULT_ROOM_CODE=GOMOKU1

# two-keys-gate/server/.env
PORT=3001
DEFAULT_ROOM_CODE=GATE1
```

---

## 🔌 API Documentation

### Main Server API

**Base URL**: `http://localhost:2567`

#### Minigame Result Submission

```http
POST /minigame/result
Content-Type: application/json

{
  "won": true,              // Required: boolean
  "roomCode": "ABCD",       // Required if no sessionId
  "sessionId": "mg_123...", // Required if no roomCode
  "score": 150,             // Optional: number
  "duration": 45000         // Optional: ms
}
```

**Responses**:

✅ **Success (200)**:
```json
{
  "success": true,
  "rewards": {
    "clarity": 8000,      // ms remaining
    "speedBoost": 8000    // ms remaining
  }
}
```

❌ **Room Not Found (404)**:
```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

❌ **Validation Error (400)**:
```json
{
  "error": "Field 'won' (boolean) is required",
  "code": "VALIDATION_ERROR"
}
```

---

## 🛠️ Development Guide

### Running in Development Mode

**Terminal Setup** (Use tmux or multiple terminal windows):

```bash
# Terminal 1: Main Server
cd server
npm run dev

# Terminal 2: Main Client
cd client
npm run dev

# Terminal 3: Coop Miner (optional)
cd minigames/coop-miner/server && npm run dev &
cd minigames/coop-miner/client && npm run dev

# Terminal 4: Gomoku Duel (optional)
cd minigames/gomoku-duel/server && npm run dev &
cd minigames/gomoku-duel/client && npm run dev
```

### Testing Multiplayer Locally

**Option 1: Incognito Windows**
```bash
# Open 4 incognito/private windows
# Chrome: Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)
# Firefox: Cmd+Shift+P / Ctrl+Shift+P
```

**Option 2: Different Browsers**
- Player 1: Chrome
- Player 2: Firefox
- Player 3: Safari
- Player 4: Edge

**Option 3: Multiple Devices**
- Desktop, laptop, tablet, phone
- All on same network
- Use desktop's IP instead of `localhost`

### Debugging Tips

**Client-Side**:
```javascript
// Enable verbose Colyseus logs
room.connection.onmessage = (msg) => {
  console.log('[WebSocket]', msg);
};

// Three.js debug helpers
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
```

**Server-Side**:
```typescript
// Add to GameRoom.ts
onCreate(options) {
  this.clock.setInterval(() => {
    console.log('[Room]', this.roomId, 'Players:', this.clients.length);
  }, 5000);
}
```

### Performance Profiling

**Client** (Chrome DevTools):
1. F12 → Performance tab
2. Start recording
3. Play for 30 seconds
4. Stop recording
5. Look for long tasks (>50ms) in yellow

**Server**:
```bash
# Use Node.js profiler
node --prof server/lib/index.js

# Generate report
node --prof-process isolate-0x*.log > profile.txt
```

---

## 🎯 Design Principles Explained

### 1. **No One Has All the Information**

Each role sees different data:
- Driver: Blurred view (cannot see obstacles)
- Accelerator: Only speedometer
- Co-pilot: Only traps (no map)
- Navigator: Only map (no traps)

This forces players to share information verbally.

### 2. **Cooperation is Mandatory**

No single player can:
- Control all car functions (distributed controls)
- See all necessary information (distributed awareness)
- Complete minigames alone (2-4 players required)

### 3. **Non-Verbal Communication Matters**

Co-pilot cannot speak but can:
- Honk horn (H key) - convey urgency
- Change radio (R key) - signal different warnings
- Create patterns (e.g., 2 honks = turn right)

---

## 🚀 Deployment Checklist

### Pre-Production

- [ ] Environment variables configured
- [ ] CORS origins whitelisted
- [ ] WebSocket URLs updated (ws→wss)
- [ ] Build all clients (`npm run build`)
- [ ] Database configured (if using Redis)
- [ ] SSL certificates obtained

### Production

- [ ] Use process manager (PM2, systemd)
- [ ] Enable gzip compression
- [ ] Set up reverse proxy (nginx)
- [ ] Configure firewall rules
- [ ] Enable logging (winston, morgan)
- [ ] Set up monitoring (Datadog, New Relic)

### Docker Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Scale if needed
docker-compose up -d --scale main-client=3
```

---

**Made with ❤️ for cooperative gaming**
