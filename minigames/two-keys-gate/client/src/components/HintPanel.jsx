import React, { useEffect, useState } from 'react';

const HintPanel = ({ hint }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hint) {
      setVisible(true);

      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setVisible(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [hint]);

  if (!hint || !visible) {
    return (
      <div className="moderator-panel">
        <div className="section-title">💡 Mensaje del Moderador</div>
        <div className="no-hint">Sin mensajes nuevos</div>
      </div>
    );
  }

  return (
    <div className="moderator-panel active">
      <div className="section-title">💡 Mensaje del Moderador</div>
      <div className="hint-message">{hint}</div>
    </div>
  );
};

export default HintPanel;
