import React from 'react';

const SuccessScreen = ({ message, onContinue, onExit }) => {

  return (
    <div className="pixel-view">
      <div className="success-container">
        {/* Success Animation */}
        <div className="success-animation">
          <div className="door-opening">
            <div className="door-left"></div>
            <div className="door-right"></div>
          </div>
          <div className="success-particles"></div>
        </div>

        {/* Success Message */}
        <h1 className="success-title">¡ÉXITO!</h1>
        <p className="success-message">{message}</p>

        {/* Star Rating */}
        <div className="success-stars">
          <span className="star">⭐</span>
          <span className="star">⭐</span>
          <span className="star">⭐</span>
        </div>

        {/* Continue / Exit */}
        {onContinue && (
          <button className="pixel-button large" onClick={onContinue}>
            Continuar
          </button>
        )}
        {onExit && (
          <button
            className="pixel-button large"
            style={{ marginTop: onContinue ? '12px' : 0 }}
            onClick={onExit}
          >
            Salir
          </button>
        )}
      </div>
    </div>
  );
};

export default SuccessScreen;
