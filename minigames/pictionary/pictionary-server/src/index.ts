import express, { Request, Response } from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomInt } from 'crypto';

const app = express();
const PORT = process.env.PORT || 2234;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' })); // Límite alto para canvas base64

// ============================================
// GESTIÓN DE PALABRAS
// ============================================

let ALL_WORDS: string[] = [];   // Todas las palabras del diccionario (validación)
let GAME_WORDS: string[] = [];  // Palabras para usar en el juego

/**
 * Normaliza una palabra: quita tildes, convierte a mayúsculas y elimina espacios
 */
const normalizeWord = (word: string): string => {
    return word
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
};

/**
 * Carga palabras desde archivos en /resources
 */
try {
    const txtPath = join(process.cwd(), 'resources', 'spanish.txt');
    const txtData = readFileSync(txtPath, 'utf-8');
    ALL_WORDS = txtData.split('\n').map(w => normalizeWord(w)).filter(w => w.length > 0);
    console.log(`✅ Loaded ${ALL_WORDS.length} validation words from spanish.txt`);
} catch (error) {
    console.error('⚠️  spanish.txt not found. Validation disabled.');
}

try {
    const jsonPath = join(process.cwd(), 'resources', 'spanish.json');
    const jsonData = readFileSync(jsonPath, 'utf-8');
    const words = JSON.parse(jsonData);
    GAME_WORDS = words.map((w: string) => normalizeWord(w)).filter((w: string) => w.length > 0);
    console.log(`✅ Loaded ${GAME_WORDS.length} game words from spanish.json`);
} catch (error) {
    console.error('⚠️  spanish.json not found. Using fallback words.');
    GAME_WORDS = ['GATO', 'PERRO', 'CASA', 'SOL'];
}

/**
 * Obtiene una palabra aleatoria del conjunto de palabras del juego
 */
const getRandomWord = (): string => {
    if (GAME_WORDS.length === 0) return 'ERROR';
    const randomIndex = randomInt(0, GAME_WORDS.length);
    return GAME_WORDS[randomIndex];
};

// ============================================
// ESTADO DEL JUEGO
// ============================================

interface GameSession {
    round: number;          // Ronda actual (1-3)
    totalRounds: number;    // Total de rondas (3)
    score: number;          // Puntuación (no usado actualmente)
    word: string;           // Palabra actual a adivinar
    canvasData: string;     // Canvas en formato base64
    guesses: string[];      // Historial de intentos
    solved: boolean;        // Si la ronda actual fue resuelta
    lastActivity: number;   // Timestamp de última actividad
}

// Mapa de sesiones activas: sessionId → GameSession
const sessions = new Map<string, GameSession>();

/**
 * Limpieza automática de sesiones inactivas (cada 10 minutos)
 * Elimina sesiones con más de 1 hora de inactividad
 */
setInterval(() => {
    const now = Date.now();
    const oneHour = 3600000;
    sessions.forEach((session, id) => {
        if (now - session.lastActivity > oneHour) {
            sessions.delete(id);
            console.log(`🗑️  Session ${id} expired and removed`);
        }
    });
}, 600000); // 10 minutos

// ============================================
// ENDPOINTS API
// ============================================

/**
 * GET /api/pictionary/word
 * 
 * Inicializa o recupera una sesión de juego.
 * Si la sesión no existe, crea una nueva con ronda 1.
 * Si la sesión terminó (round > totalRounds), la resetea.
 * 
 * Query params:
 *   - sessionId: Identificador único de la partida
 * 
 * Retorna:
 *   - word: Palabra actual a dibujar
 *   - sessionId: ID de sesión
 *   - round: Ronda actual
 *   - totalRounds: Total de rondas
 */
app.get('/api/pictionary/word', (req: Request, res: Response): any => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Si la sesión terminó, resetearla
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId)!;
        if (existing.round > existing.totalRounds) {
            sessions.delete(sessionId);
        }
    }

    // Crear nueva sesión si no existe
    if (!sessions.has(sessionId)) {
        const initialWord = getRandomWord();
        sessions.set(sessionId, {
            round: 1,
            totalRounds: 3,
            score: 0,
            word: initialWord,
            canvasData: '',
            guesses: [],
            solved: false,
            lastActivity: Date.now()
        });
    }

    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();
    
    res.json({ 
        word: session.word, 
        sessionId,
        round: session.round,
        totalRounds: session.totalRounds
    });
});

/**
 * POST /api/pictionary/draw
 * 
 * Guarda el estado actual del canvas (dibujo).
 * 
 * Body:
 *   - sessionId: ID de la sesión
 *   - canvasData: Canvas serializado en base64 (dataURL)
 * 
 * Retorna:
 *   - success: true/false
 */
app.post('/api/pictionary/draw', (req: Request, res: Response): any => {
    const { sessionId, canvasData } = req.body;
    
    const session = sessions.get(sessionId);
    if (session) {
        session.canvasData = canvasData;
        session.lastActivity = Date.now();
    }
    
    res.json({ success: true });
});

/**
 * GET /api/pictionary/canvas/:sessionId
 * 
 * Obtiene el estado actual del juego (usado para polling).
 * El guesser usa este endpoint para obtener el dibujo actualizado.
 * 
 * Params:
 *   - sessionId: ID de la sesión
 * 
 * Retorna:
 *   - canvasData: Canvas en base64
 *   - solved: Si la ronda fue resuelta
 *   - wordLength: Longitud de la palabra (para mostrar slots)
 *   - round: Ronda actual
 *   - totalRounds: Total de rondas
 *   - gameOver: Si el juego terminó (round > totalRounds)
 */
app.get('/api/pictionary/canvas/:sessionId', (req: Request, res: Response): any => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.json({ 
            canvasData: '', 
            solved: false, 
            wordLength: 0,
            round: 1, 
            totalRounds: 3, 
            gameOver: false 
        }); 
    }

    res.json({ 
        canvasData: session.canvasData,
        solved: session.solved,
        wordLength: session.word.length,
        round: session.round,
        totalRounds: session.totalRounds,
        gameOver: session.round > session.totalRounds
    });
});

/**
 * POST /api/pictionary/guess
 * 
 * Valida un intento de adivinanza.
 * Si es correcto, marca la ronda como resuelta y automáticamente
 * avanza a la siguiente ronda después de 3 segundos.
 * 
 * Body:
 *   - sessionId: ID de la sesión
 *   - guess: Palabra adivinada
 * 
 * Retorna:
 *   - correct: true/false
 *   - word: Palabra correcta (solo si acertó)
 */
app.post('/api/pictionary/guess', (req: Request, res: Response): any => {
    const { sessionId, guess } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.round > session.totalRounds) {
        return res.json({ correct: false });
    }

    const normalizedGuess = normalizeWord(guess || '');
    const isCorrect = normalizedGuess === session.word;
    
    if (isCorrect) {
        session.solved = true;
        
        // Avanzar automáticamente a la siguiente ronda después de 3 segundos
        setTimeout(() => {
            if (session.solved) {
                session.round++;
                
                if (session.round <= session.totalRounds) {
                    session.word = getRandomWord();
                    session.canvasData = '';
                    session.solved = false;
                    session.guesses = [];
                } 
            }
        }, 3000);
    }

    res.json({ 
        correct: isCorrect, 
        word: isCorrect ? session.word : null 
    });
});

/**
 * POST /api/pictionary/next-round
 * 
 * Avanza manualmente a la siguiente ronda (opcional).
 * Generalmente no se usa porque el avance es automático al adivinar.
 * 
 * Body:
 *   - sessionId: ID de la sesión
 * 
 * Retorna:
 *   - success: true/false
 *   - round: Ronda actual después del avance
 */
app.post('/api/pictionary/next-round', (req: Request, res: Response): any => {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.json({ success: false });
    }

    // Si ya avanzó automáticamente, solo confirmar
    if (session.round > 1 && !session.solved) {
        return res.json({ success: true, round: session.round });
    }

    // Avance manual
    if (session.solved || session.round === 1) {
        session.round++;
        
        if (session.round <= session.totalRounds) {
            session.word = getRandomWord();
            session.canvasData = '';
            session.solved = false;
            session.guesses = [];
        }
        
        return res.json({ success: true, round: session.round });
    }
    
    res.json({ success: false });
});

/**
 * GET /health
 * 
 * Health check endpoint para verificar que el servidor está activo.
 * 
 * Retorna:
 *   - status: 'ok'
 *   - service: Nombre del servicio
 *   - words: Cantidad de palabras cargadas
 *   - activeSessions: Número de sesiones activas
 */
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'pictionary-2-server',
        words: GAME_WORDS.length,
        activeSessions: sessions.size,
        port: PORT
    });
});

/**
 * POST /api/pictionary/reset/:roomCode
 * 
 * Resetea todas las sesiones de un roomCode específico.
 * Usado cuando se inicia un nuevo minijuego desde Blind Rally.
 */
app.post('/api/pictionary/reset/:roomCode', (req: Request, res: Response): any => {
    const { roomCode } = req.params;
    
    // Eliminar todas las sesiones que contengan el roomCode en su ID
    let deletedCount = 0;
    sessions.forEach((session, sessionId) => {
        // Si el sessionId contiene el roomCode o si queremos resetear todo
        if (sessionId.includes(roomCode) || roomCode === 'ALL') {
            sessions.delete(sessionId);
            deletedCount++;
        }
    });
    
    console.log(`🔄 [Pictionary] Reset room: ${roomCode} - Deleted ${deletedCount} sessions`);
    
    res.json({ 
        success: true, 
        deletedSessions: deletedCount,
        message: `Reset ${deletedCount} sessions for room ${roomCode}`
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log(`\n🎨 Pictionary Server`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`🔢 Port: ${PORT}`);
    console.log(`📚 Game words loaded: ${GAME_WORDS.length}`);
    console.log(`✅ Ready!\n`);
});