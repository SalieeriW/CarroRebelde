import React, { useState, useEffect, useRef } from 'react';
import './styles/pictionary.css'; 

// Build API URL - replace Docker service names with localhost for browser access
const buildApiUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    // Use localhost for Docker service names or localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'pictionary-server') {
      return 'http://localhost:2234';
    }
    // For network access, use the actual hostname
    return `http://${hostname}:2234`;
  }
  return 'http://localhost:2234';
};

const SERVER_URL = buildApiUrl();
const PALETTE_COLORS = ['#ffffff', '#f9d71c', '#e94560', '#00ffcc', '#3498db', '#2ecc71', '#9b59b6', '#e67e22'];

function PictionaryGame() {
  const searchParams = new URLSearchParams(window.location.search);
  // Get sessionId from URL (can be 'session' or 'sessionId')
  const urlSessionId = searchParams.get('session') || searchParams.get('sessionId');
  const urlRole = searchParams.get('role');
  const roomCode = searchParams.get('room') || searchParams.get('roomCode');
  const returnUrl = searchParams.get('returnUrl');

  const [sessionId] = useState(urlSessionId || Math.random().toString(36).substring(7));
  
  // Map Blind Rally roles to Pictionary roles
  // driver -> drawer, navigator -> guesser
  const resolvePictionaryRole = (blindRallyRole) => {
    if (blindRallyRole === 'driver') return 'drawer';
    if (blindRallyRole === 'navigator') return 'guesser';
    // If already a pictionary role, use it
    if (blindRallyRole === 'drawer' || blindRallyRole === 'guesser') return blindRallyRole;
    return null;
  };
  
  const [role, setRole] = useState(resolvePictionaryRole(urlRole));
  const resultReportedRef = useRef(false);
  
  // Estados de Juego
  const [word, setWord] = useState('');
  const [wordLength, setWordLength] = useState(0); 
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);

  const [guess, setGuess] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isRoundWon, setIsRoundWon] = useState(false); 
  const [isGameOver, setIsGameOver] = useState(false); 
  
  const [currentColor, setCurrentColor] = useState(PALETTE_COLORS[0]);
  const [showHelp, setShowHelp] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const inputRef = useRef(null);

  // --- SOLUCIÓN DEL ERROR (Referencias para el Intervalo) ---
  // Usamos refs para que el setInterval pueda leer el valor ACTUAL, no el viejo
  const roundRef = useRef(round);
  const isRoundWonRef = useRef(isRoundWon);

  // Mantenemos las refs sincronizadas con el estado
  useEffect(() => {
    roundRef.current = round;
    isRoundWonRef.current = isRoundWon;
  }, [round, isRoundWon]);
  // ----------------------------------------------------------

  // Tecla F10 Ayuda
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F10') {
        e.preventDefault(); 
        setShowHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Inicializar según Rol
  useEffect(() => {
    if (role === 'drawer') {
      initDrawer();
    } else if (role === 'guesser') {
      initGuesser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Limpiar/Pintar fondo negro al cambiar de rol o de ronda
  useEffect(() => {
    if ((role || isRoundWon === false) && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#16213e'; 
        ctx.fillRect(0, 0, 800, 600);
    }
  }, [role, round, isRoundWon]);

  // --- LOGICA ---

  const initDrawer = async () => {
    setRole('drawer');
    fetchWord();
    const interval = setInterval(checkGameState, 1000);
    return () => clearInterval(interval);
  };

  const initGuesser = () => {
    setRole('guesser');
    const interval = setInterval(checkGameState, 1000); 
    return () => clearInterval(interval);
  };

  const fetchWord = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/pictionary/word?sessionId=${sessionId}`);
      const data = await res.json();
      setWord(data.word);
      setRound(data.round);
      setTotalRounds(data.totalRounds);
    } catch (e) { console.error(e); }
  };

  // Función principal de bucle (Polling)
  const checkGameState = async () => {
    try {
        const res = await fetch(`${SERVER_URL}/api/pictionary/canvas/${sessionId}`);
        const data = await res.json();
        
        // CORRECCIÓN: Usamos roundRef.current para comparar
        if (data.round > roundRef.current) {
            handleNextRoundLocal(data);
        }

        setRound(data.round);
        setTotalRounds(data.totalRounds);

        if (data.gameOver && !resultReportedRef.current) {
            setIsGameOver(true);
            setStatusMsg("*** JUEGO COMPLETADO ***");
            
            // Report result to main game server
            if (roomCode && sessionId) {
                resultReportedRef.current = true;
                const host = window.location.hostname || 'localhost';
                fetch(`http://${host}:2567/minigame/result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ won: true, roomCode, sessionId }) // Pictionary: complete all rounds = win
                }).then(() => {
                    // Close window after reporting result
                    setTimeout(() => {
                        if (window.opener) {
                            window.close();
                        } else {
                            window.close();
                        }
                    }, 500);
                }).catch(err => {
                    console.warn('Failed to report result:', err);
                    // Still try to close
                    setTimeout(() => {
                        if (window.opener) {
                            window.close();
                        } else {
                            window.close();
                        }
                    }, 500);
                });
            } else {
                // No roomCode, but still try to close
                setTimeout(() => {
                    if (window.opener) {
                        window.close();
                    } else {
                        window.close();
                    }
                }, 500);
            }
            return;
        }

        // CORRECCIÓN: Usamos isRoundWonRef.current para evitar bucles
        if (data.solved && !isRoundWonRef.current) {
            handleRoundWin(data.round);
        }

        if (!data.solved) {
            if (data.wordLength) setWordLength(data.wordLength);
            
            if (data.canvasData) {
                const img = new Image();
                img.onload = () => {
                    const canvas = canvasRef.current;
                    if (canvas && !isDrawing.current) { 
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                    }
                };
                img.src = data.canvasData;
            } else if (role === 'guesser') {
                 const canvas = canvasRef.current;
                 if(canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#16213e'; 
                    ctx.fillRect(0, 0, 800, 600);
                 }
            }
        }
    } catch (e) { console.error("Polling error", e); }
  };

  const handleRoundWin = (currentRoundServer) => {
      setIsRoundWon(true); // Esto actualiza el estado y luego el Ref
      setStatusMsg(`¡CORRECTO! RONDA ${currentRoundServer} COMPLETADA`);
      
      if (role === 'drawer') {
          setTimeout(triggerNextRound, 3000);
      }
  };

  const triggerNextRound = async () => {
      await fetch(`${SERVER_URL}/api/pictionary/next-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      fetchWord();
  };

  const handleNextRoundLocal = (data) => {
      setIsRoundWon(false);
      setGuess('');
      setStatusMsg('');
      setWordLength(data.wordLength || 0);
      
      // Limpiar visualmente
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#16213e'; 
        ctx.fillRect(0, 0, 800, 600);
      }
  };

  // --- DIBUJO ---
  const startDrawing = (e) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor; 
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    lastPos.current = { x, y };
  };

  const stopDrawing = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL(); 
    await fetch(`${SERVER_URL}/api/pictionary/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, canvasData: dataUrl })
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#16213e'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stopDrawing(); 
  };

  // --- ADIVINAR ---
  const submitGuess = async () => {
    if (!guess) return;
    const res = await fetch(`${SERVER_URL}/api/pictionary/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guess })
    });
    const data = await res.json();
    
    if (data.correct) {
      // No hacemos nada aquí, esperamos al polling para sincronizar
      setStatusMsg("¡CORRECTO! ESPERANDO...");
    } else {
      setStatusMsg("[ ERROR: INTENTALO DE NUEVO ]");
      setGuess('');
      setTimeout(() => setStatusMsg(""), 2000);
    }
  };

  const handleInputChange = (e) => {
      const val = e.target.value.toUpperCase();
      if (wordLength > 0 && val.length > wordLength) return;
      setGuess(val);
  };

  const focusInput = () => {
      if (inputRef.current && !isRoundWon && !isGameOver) inputRef.current.focus();
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const HelpModal = () => (
    <div className="retro-modal-overlay" onClick={() => setShowHelp(false)}>
      <div className="retro-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">== AYUDA DEL SISTEMA ==</div>
        <div className="modal-content">
          <p>TECLA [F10] : MENU</p>
          <br/>
          <p className="highlight">OBJETIVO</p>
          <ul className="retro-list">
            <li>Completa 3 rondas.</li>
            <li>Dibuja o adivina la palabra secreta.</li>
          </ul>
        </div>
        <button className="retro-btn secondary full-width" onClick={() => setShowHelp(false)}>
          [ CERRAR ]
        </button>
      </div>
    </div>
  );

  // --- RENDER INICIAL (Lobby) ---
  if (!role) {
    const baseUrl = window.location.href.split('?')[0];
    const drawerUrl = `${baseUrl}?sessionId=${sessionId}&role=drawer`;
    const guesserUrl = `${baseUrl}?sessionId=${sessionId}&role=guesser`;

    return (
      <div className="retro-game">
        {showHelp && <HelpModal />}
        <div className="retro-header">
            <h1 className="retro-title">PICTIONARY.EXE</h1>
            <p className="retro-subtitle"> MULTIJUGADOR (3 RONDAS) </p>
        </div>

        <div className="retro-card connection-panel">
            <div className="connection-row">
                <div className="conn-info">
                    <span className="badge drawer">JUGADOR 1 (DIBUJA)</span>
                    <input readOnly value={drawerUrl} className="retro-input-readonly" />
                </div>
                <div className="conn-actions">
                    <button className="retro-btn sm" onClick={() => copyToClipboard(drawerUrl, 'drawer')}>
                        {copyFeedback === 'drawer' ? '¡COPIADO!' : '[ COPIAR ]'}
                    </button>
                    <a href={drawerUrl} target="_blank" rel="noreferrer" className="retro-btn sm action">[ ABRIR ↗ ]</a>
                </div>
            </div>
            <div className="divider-dashed"></div>
            <div className="connection-row">
                <div className="conn-info">
                    <span className="badge guesser">JUGADOR 2 (ADIVINA)</span>
                    <input readOnly value={guesserUrl} className="retro-input-readonly" />
                </div>
                <div className="conn-actions">
                    <button className="retro-btn sm" onClick={() => copyToClipboard(guesserUrl, 'guesser')}>
                        {copyFeedback === 'guesser' ? '¡COPIADO!' : '[ COPIAR ]'}
                    </button>
                    <a href={guesserUrl} target="_blank" rel="noreferrer" className="retro-btn sm action">[ ABRIR ↗ ]</a>
                </div>
            </div>
        </div>
        <div className="footer-hint">PRESIONA [F10] PARA AYUDA</div>
      </div>
    );
  }

  // --- RENDER JUEGO ---
  return (
    <div className="retro-game">
      {showHelp && <HelpModal />}
      
      <div className="retro-header">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 className="retro-title">
                {role === 'drawer' ? 'DIBUJANTE' : 'ADIVINADOR'}
            </h2>
            <div className="retro-id-box" style={{padding: '2px 8px'}}>
                RONDA: {round} / {totalRounds}
            </div>
        </div>
        
        {role === 'drawer' && !isGameOver && (
            <div className="retro-word-box">
                OBJETIVO: <span className="highlight">{word.toUpperCase()}</span>
            </div>
        )}
        
        {/* Mensajes de Estado */}
        {isGameOver && <div className="retro-win-msg">*** JUEGO COMPLETADO ***</div>}
        {!isGameOver && isRoundWon && <div className="retro-win-msg">¡RONDA COMPLETADA! SIGUIENTE NIVEL EN 3s...</div>}
        {!isGameOver && !isRoundWon && statusMsg && <div className="retro-status">{statusMsg}</div>}
      </div>

      {role === 'drawer' && !isRoundWon && !isGameOver && (
        <div className="retro-palette-container">
            {PALETTE_COLORS.map(color => (
                <button
                    key={color}
                    className={`palette-swatch ${currentColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCurrentColor(color)}
                />
            ))}
        </div>
      )}

      <div className="retro-canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={role === 'drawer' ? startDrawing : undefined}
            onMouseMove={role === 'drawer' ? draw : undefined}
            onMouseUp={role === 'drawer' ? stopDrawing : undefined}
            onMouseLeave={role === 'drawer' ? stopDrawing : undefined}
          />
      </div>

      <div className="retro-controls">
        {role === 'drawer' && !isRoundWon && !isGameOver && (
           <button className="retro-btn danger" onClick={clearCanvas}>[ BORRAR PANTALLA ]</button>
        )}

        {role === 'guesser' && !isRoundWon && !isGameOver && (
          <div className="guesser-container">
            <div className="word-slots" onClick={focusInput}>
                {Array.from({ length: wordLength || Math.max(guess.length + 1, 6) }).map((_, i) => (
                    <div key={i} className={`slot ${guess[i] ? 'filled' : ''}`}>
                        {guess[i] || '_'}
                    </div>
                ))}
            </div>
            <input 
              ref={inputRef}
              className="ghost-input"
              type="text" 
              value={guess}
              autoFocus 
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
              autoComplete="off"
              maxLength={wordLength} 
            />
            <button className="retro-btn" onClick={submitGuess}>[ ENTER ]</button>
          </div>
        )}
      </div>
      <div className="footer-hint">PRESIONA [F10] PARA AYUDA</div>
    </div>
  );
}

export default PictionaryGame;