import React, { useEffect, useState } from 'react';
import levelData from '../../../shared/levelData.json';

const Briefing = ({ countdownMs = 0, onExit }) => {
  const [remaining, setRemaining] = useState(countdownMs);
  const briefing = levelData.briefing;

  useEffect(() => {
    setRemaining(countdownMs);
  }, [countdownMs]);

  useEffect(() => {
    if (!countdownMs) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(prev - 500, 0));
    }, 500);
    return () => clearInterval(id);
  }, [countdownMs]);

  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="pixel-view">
      <div className="briefing-container">
        {/* Exit Button */}
        <button className="exit-button-top" onClick={onExit}>
          ← Volver
        </button>

        {/* Title */}
        <h1 className="briefing-title">{briefing.title}</h1>
        <p className="briefing-description">{briefing.description}</p>

        {/* Instructions */}
        <div className="briefing-section">
          <div className="section-header">Cómo Jugar</div>
          <div className="instructions-list">
            {briefing.instructions.map((instruction, index) => (
              <div key={index} className="instruction-item">
                {instruction}
              </div>
            ))}
          </div>
        </div>

        {/* Reminder */}
        <div className="briefing-reminder">
          {briefing.reminder}
        </div>

        {/* Countdown */}
        <div className="briefing-countdown">
          {countdownMs
            ? `El juego comenzará en ${seconds} segundos...`
            : 'Preparando el inicio...'}
        </div>
      </div>
    </div>
  );
};

export default Briefing;
