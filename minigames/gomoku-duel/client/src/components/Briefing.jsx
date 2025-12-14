import React from 'react';
import gameData from '../gameData.json';

const Briefing = ({ countdownMs, onExit }) => {
  const { briefing } = gameData;
  const countdown = Math.ceil(countdownMs / 1000);

  return (
    <div className="briefing-container">
      <div className="briefing-content">
        {onExit && (
          <button className="exit-button-top" onClick={onExit}>
            ← Volver
          </button>
        )}
        <h1 className="briefing-title">{briefing.title}</h1>
        <p className="briefing-description">{briefing.description}</p>

        <div className="instructions-section">
          <h2>Instrucciones</h2>
          <ul className="instructions-list">
            {briefing.instructions.map((instruction, i) => (
              <li key={i}>{instruction}</li>
            ))}
          </ul>
        </div>

        <p className="briefing-reminder">{briefing.reminder}</p>

        <div className="countdown-display">
          <div className="countdown-text">La partida comienza en</div>
          <div className="countdown-number">{countdown}</div>
        </div>
      </div>
    </div>
  );
};

export default Briefing;
