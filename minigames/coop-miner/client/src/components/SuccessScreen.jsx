const SuccessScreen = ({ levelId, totalLevels, score, goalScore, onContinue, onExit, isFinal }) => {
  const final = isFinal !== undefined ? isFinal : levelId >= totalLevels;

  return (
    <div className="pixel-lobby">
      <div className="pixel-bg" />
      <div className="success-container">
        <div className="success-animation">
          <div className="success-stars">
            <span className="star">⭐</span>
            <span className="star">⭐</span>
            <span className="star">⭐</span>
          </div>
        </div>

        <h1 className="lobby-title">¡NIVEL SUPERADO!</h1>

        <div className="success-stats">
          <p className="success-message">
            Puntuación: {score}/{goalScore}
          </p>
          <p className="success-message">
            Nivel {levelId}/{totalLevels}
          </p>
        </div>

        <div className="action-row" style={{ justifyContent: 'center', marginTop: '24px' }}>
          {final ? (
            <p className="hint">
              Saliendo automáticamente en 3 segundos...
            </p>
          ) : (
            onContinue && (
              <p className="hint">
                Siguiente nivel en unos segundos...
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
