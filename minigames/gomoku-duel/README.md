# Duelo de Gomoku

A multiplayer Gomoku (Five in a Row) game where two players collaborate to defeat an AI opponent.

## 🎮 Game Features

- **Multiplayer Collaboration**: Two players work together to beat the AI
- **AI Opponent**: Heuristic-based AI with strategic evaluation
- **Real-time Sync**: REST API with polling for state synchronization
- **Team Chat**: Built-in chat for player communication
- **Spanish UI**: All text and messages in Spanish
- **Pixel Art Style**: Retro aesthetic with monospace fonts

## 🏗️ Architecture

```
gomoku-duel/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # useMultiplayerGame hook
│   │   ├── App.jsx      # Main app
│   │   └── App.css      # Pixel art styles
│   └── package.json
├── server/              # Express backend (TypeScript)
│   ├── src/
│   │   ├── gomoku/      # Game logic & AI
│   │   │   ├── ai.ts    # Heuristic AI
│   │   │   ├── board.ts # Board utilities
│   │   │   └── rules.ts # Win detection
│   │   ├── index.ts     # REST API
│   │   └── types.ts     # Type definitions
│   └── package.json
└── shared/
    └── gameData.json    # Spanish text content
```

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
cd gomoku-duel
./START.sh
```

Access:
- Client: http://localhost:6001
- Server: http://localhost:3002

### Option 2: Local Development

```bash
cd gomoku-duel
./START_LOCAL.sh
```

Or manually:

```bash
# Terminal 1 - Server
cd server
npm install
npm run dev

# Terminal 2 - Client
cd client
npm install
npm run dev
```

## 🎯 How to Play

1. **Lobby**: Two players claim seats (A and B) and mark ready
2. **Briefing**: 5-second countdown with game rules
3. **Game**: Players take turns placing black stones (●) vs AI white stones (○)
4. **Goal**: Create 5 consecutive stones (horizontal, vertical, or diagonal)
5. **Result**: Victory, defeat, or draw
6. **Reset**: Start a new game from the same room

## 🤖 AI Implementation

The AI uses a **heuristic evaluation function** (no machine learning):

### Scoring System

| Pattern | Description | Score |
|---------|-------------|-------|
| Live 4  | `_●●●●_` (both ends open) | 10,000 |
| Dead 4  | `X●●●●_` (one end blocked) | 5,000 |
| Live 3  | `_●●●_` | 1,000 |
| Dead 3  | `X●●●_` | 200 |
| Live 2  | `_●●_` | 100 |

### Strategy

1. **Evaluate all empty positions** (15×15 = 225 cells)
2. **For each position**:
   - Simulate AI stone placement → calculate offensive score
   - Simulate player stone placement → calculate defensive score (×1.5 weight)
3. **Select position with highest total score**
4. **Defense priority**: Blocks player's winning threats

### Performance

- Time complexity: O(n²) where n=15 (board size)
- Move calculation: ~100ms on average
- Suitable for real-time gameplay

## 📡 API Endpoints

### Room Management

- `GET /rooms/:code` - Get room state
- `POST /rooms/:code/claim` - Claim seat (A or B)
- `POST /rooms/:code/release` - Release seat
- `POST /rooms/:code/ready` - Mark player ready
- `POST /rooms/:code/start` - Start countdown

### Game Actions

- `POST /rooms/:code/move` - Make a move (x, y)
- `POST /rooms/:code/reset` - Reset game
- `POST /rooms/:code/chat` - Send chat message

## 🎨 Pixel Art Styling

CSS variables for easy customization:

```css
--pixel-black: #0f0f0f
--pixel-white: #f0f0f0
--pixel-gray: #4a4a4a
--pixel-blue: #4a90e2
--pixel-green: #50c878
--pixel-red: #e74c3c
```

## 🔧 Configuration

### Server (.env)

```env
PORT=3002
DEFAULT_ROOM_CODE=GOMOKU1
```

### Client (.env)

```env
VITE_API_URL=http://localhost:3002
VITE_ROOM_CODE=GOMOKU1
```

## 📦 Tech Stack

- **Frontend**: React 18, Vite 4
- **Backend**: Node.js, Express, TypeScript
- **Styling**: Vanilla CSS (Pixel Art theme)
- **State Management**: REST polling (1s interval)
- **Board Size**: 15×15 (standard Gomoku)

## 🧩 Extending the AI

The AI module is designed to be replaceable:

```typescript
// Current: Heuristic AI
import { makeAIMove } from './gomoku/ai';

// Future options:
// 1. Minimax with Alpha-Beta pruning
// 2. Monte Carlo Tree Search (MCTS)
// 3. Neural network (TensorFlow.js)
```

## 🐛 Troubleshooting

**Port conflicts:**
```bash
# Change ports in docker-compose.yml
ports:
  - "3003:3002"  # Server
  - "6002:6001"  # Client
```

**Client can't connect to server:**
- Verify server is running on port 3002
- Check `VITE_API_URL` environment variable
- Ensure CORS is enabled in server

## 📝 License

MIT

## 🤝 Contributing

This is a demonstration project. Feel free to fork and extend!

---

**Project Type**: Multiplayer Cooperative vs AI Game
**Language**: Spanish (UI/UX)
**Architecture**: REST API with polling
**AI**: Heuristic evaluation (no ML)
