import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/wordle.css';
import WordleTutorial from '../minigames/WordleTutorial'; 

// Build API URL - replace Docker service names with localhost for browser access
const buildMinigameApiUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    // Use localhost for Docker service names or localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'wordle-server') {
      return 'http://localhost:1234';
    }
    // For network access, use the actual hostname
    return `http://${hostname}:1234`;
  }
  return 'http://localhost:1234';
};

const MINIGAME_SERVER_URL = buildMinigameApiUrl();

const Minigame1 = () => {
  const searchParams = new URLSearchParams(window.location.search);
  // Get sessionId from URL (can be 'session' or 'sessionId')
  const sessionId = searchParams.get('session') || searchParams.get('sessionId') || 'test-session';
  const roomCode = searchParams.get('room') || searchParams.get('roomCode');
  const returnUrl = searchParams.get('returnUrl'); 
  
  // Estados del juego
  const [wordLength, setWordLength] = useState(5);
  const [guesses, setGuesses] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [stage, setStage] = useState(1);
  const [maxStages, setMaxStages] = useState(3);
  const [solution, setSolution] = useState(null);

  // Estado del Tutorial
  const [showTutorial, setShowTutorial] = useState(false); 

  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  
  const resultSent = useRef(false);

  // --- 1. SINCRONIZACIÓN ---
  useEffect(() => {
    const fetchGameState = async () => {
      try {
        const res = await fetch(`${MINIGAME_SERVER_URL}/api/wordle/state/${sessionId}`);
        const data = await res.json();
        
        if (data) {
            console.log("%c 🕵️ SOLUCIÓN: " + data.solution);
            if (data.stage !== stage) setCurrentGuess('');
            
            setWordLength(data.wordLength);
            setGuesses(data.guesses);
            setGameStatus(data.status);
            setStage(data.stage);
            setMaxStages(data.maxStages);
            if (data.solution) setSolution(data.solution);
        }
      } catch (e) { console.error("Sync error", e); }
    };

    fetchGameState();
    const interval = setInterval(fetchGameState, 1000); 
    return () => clearInterval(interval);
  }, [sessionId, stage]);

  useEffect(() => {
      const sendAndClose = async () => {
          if (resultSent.current) return;
          resultSent.current = true;

          const won = gameStatus === 'won';
          // URL para GUARDAR DATOS (Tu API)
          const host = window.location.hostname || 'localhost';
          const apiUrl = `http://${host}:2567/minigame/result`;

          try {
              // 1. Enviamos los datos "por debajo"
              if (roomCode && sessionId) {
                  await fetch(apiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ won, roomCode, sessionId })
                  });
              }
              
              setMessage("GUARDADO. CERRANDO...");
          } catch (err) {
              console.error("No se pudo guardar, pero cerramos igual.");
          }

          // 2. Cerrar la ventana (opened from main game)
          setTimeout(() => {
              if (window.opener) {
                  window.close();
              } else {
                  // Fallback: try to close anyway
                  window.close();
              }
          }, 500);
      };

      if (gameStatus === 'won' || gameStatus === 'lost') {
          sendAndClose();
      }
    }, [gameStatus, roomCode, sessionId]);

  // --- MANEJO DE INPUT ---
  const handleKeyPress = useCallback((letter) => {
    if (gameStatus !== 'playing') return;
    if (currentGuess.length < wordLength) setCurrentGuess(prev => prev + letter);
  }, [gameStatus, currentGuess.length, wordLength]);

  const handleBackspace = useCallback(() => {
    if (gameStatus !== 'playing') return;
    setCurrentGuess(prev => prev.slice(0, -1));
  }, [gameStatus]);

  const handleSubmit = useCallback(async () => {
    if (currentGuess.length !== wordLength || gameStatus !== 'playing') {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    try {
      const res = await fetch(`${MINIGAME_SERVER_URL}/api/wordle/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, guess: currentGuess })
      });
      const data = await res.json();

      if (data.success) {
          setCurrentGuess('');
          if (data.guesses) setGuesses(data.guesses);
          if (data.status) setGameStatus(data.status);
          if (data.stage) setStage(data.stage);
          if (data.solution) setSolution(data.solution); 
      } else {
          setMessage(data.message || 'Error');
          setShake(true);
          setTimeout(() => { setShake(false); setMessage(''); }, 2000);
      }
    } catch (error) {
      console.error('Network Error:', error);
    }
  }, [currentGuess, wordLength, gameStatus, sessionId]);

  // --- KEYDOWN LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle Tutorial con Shift+H (Help)
      if (e.key === 'H' && e.shiftKey) {
        e.preventDefault(); 
        setShowTutorial(prev => !prev);
        return;
      }
      
      // Bloquear input si el tutorial está abierto
      if (showTutorial) return;

      if (gameStatus !== 'playing') return;

      if (e.key === 'Enter') handleSubmit();
      else if (e.key === 'Backspace') handleBackspace();
      else if (/^[a-zA-ZñÑ]$/.test(e.key)) handleKeyPress(e.key.toUpperCase());
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, handleSubmit, handleBackspace, handleKeyPress, showTutorial]);

  // --- RENDER GRID ---
  const renderGrid = () => {
    const grid = [];
    const maxAttempts = 6;
    for (let i = 0; i < maxAttempts; i++) {
      const guess = guesses[i]; 
      const isCurrentRow = i === guesses.length; 
      
      grid.push(
        <div key={i} className={`wordle-row ${shake && isCurrentRow ? 'shake' : ''}`}>
          {Array.from({ length: wordLength }).map((_, j) => {
            let letter = '', state = '';
            if (guess) {
              letter = guess.word[j] || '';
              state = guess.evaluation[j] || '';
            } else if (isCurrentRow && currentGuess[j]) {
              letter = currentGuess[j];
              state = 'filled'; 
            }
            return (
              <div key={j} className={`wordle-cell ${state}`}>
                <span className="letter">{letter}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="wordle-game">
      <div className="wordle-header">
        <h1 className="wordle-title">DESENCRIPTADO</h1>
        <div className="wordle-stage-indicator">
            RONDA <span className="highlight">{stage}</span> DE {maxStages}
        </div>
      </div>

      <div className="wordle-board">
        {renderGrid()}
      </div>

      <div className="wordle-footer">
        <p className="wordle-instruction">
           COOPERATIVO: Ambos veis lo mismo. <br/>
           <span style={{ color: '#aaa', fontSize: '0.8rem' }}>(Presiona Shift+H para ver ayuda)</span>
        </p>
      </div>

      {message && <div className="wordle-toast">{message}</div>}

      {/* COMPONENTE TUTORIAL SEPARADO */}
      <WordleTutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

      {/* OVERLAY DE RESULTADO */}
      {!showTutorial && gameStatus !== 'playing' && (
        <div className="wordle-overlay">
          <div className="wordle-result">
            <h2>{gameStatus === 'won' ? 'FELICIDADES GANASTE!' : 'FALLÁSTEIS :('}</h2>
            
            {gameStatus === 'lost' && solution && (
                <div className="solution-box">
                    <p>LA PALABRA ERA:</p>
                    <h3 className="highlight-danger">{solution}</h3>
                </div>
            )}
            
            <p className="status-text">Volviendo...</p>
            <div className="loading-spinner"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Minigame1;