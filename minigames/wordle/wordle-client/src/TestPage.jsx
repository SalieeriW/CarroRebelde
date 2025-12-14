import { useState } from 'react';
import './styles/game.css';

const TestPage = () => {
  const [minigame, setMinigame] = useState('1');
  const [roomCode, setRoomCode] = useState('');

  const handleTest = () => {
    const code = roomCode || 'TEST' + Math.random().toString(36).substring(7).toUpperCase();
    const url = `/?game=${minigame}&roomCode=${code}`;
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
  };

  const handleCreateAndJoin = () => {
    const code = 'TEST' + Math.random().toString(36).substring(7).toUpperCase();
    const url = `/?game=${minigame}&roomCode=${code}`;
    
    // Abrir primera pestaña
    window.open(url, '_blank');
    
    // Abrir segunda pestaña después de 1 segundo
    setTimeout(() => {
      window.open(url, '_blank');
    }, 1000);
  };

  return (
    <div className="pixel-lobby">
      <div className="pixel-bg"></div>
      <div className="lobby-container">
        <h1 className="lobby-title">MINIGAME TESTER</h1>
        
        <div className="lobby-section">
          <div className="section-header">Select Minigame</div>
          <select 
            className="pixel-input" 
            value={minigame} 
            onChange={(e) => setMinigame(e.target.value)}
          >
            <option value="1">Minigame 1 - Wordle</option>
            <option value="2">Minigame 2 - Pictionary</option>
            <option value="3">Minigame 3</option>
            <option value="4">Minigame 4</option>
            <option value="5">Minigame 5</option>
            <option value="6">Minigame 6</option>
          </select>
        </div>

        <div className="lobby-section">
          <div className="section-header">Room Code (optional)</div>
          <input
            type="text"
            className="pixel-input"
            placeholder="Leave empty for random"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>

        <div className="lobby-section">
          <button className="pixel-button large" onClick={handleTest}>
            Open Test Window
          </button>
          <button className="pixel-button large" onClick={handleCreateAndJoin}>
            Auto-Open 2 Windows
          </button>
        </div>

        <div className="lobby-section">
          <div className="section-header">Manual Testing</div>
          <p style={{ fontSize: '10px', color: '#aaa', fontFamily: 'Press Start 2P' }}>
            1. Select a minigame<br/>
            2. Click "Auto-Open 2 Windows"<br/>
            3. Both windows will connect to same room<br/>
            4. Click "START GAME" in one window
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestPage;