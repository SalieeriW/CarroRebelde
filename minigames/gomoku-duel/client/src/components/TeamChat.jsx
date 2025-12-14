import React, { useState, useEffect, useRef } from 'react';

const TeamChat = ({ messages = [], onSendMessage, myRole }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  // Prevent auto focus on mount
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  }, []);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="section-title">Chat del Equipo</div>

      <div className="chat-messages">
        {messages && messages.length > 0 ? (
          messages.map((msg, i) => {
            const isSystem = msg.role === 'SYSTEM' || msg.role === 'system';
            return (
              <div
                key={i}
                className={`chat-message ${isSystem ? 'system-message' : msg.role === myRole ? 'own-message' : 'other-message'}`}
              >
                {isSystem ? (
                  <span className="chat-text" style={{ fontStyle: 'italic', color: 'var(--pixel-yellow)' }}>
                    {msg.text}
                  </span>
                ) : (
                  <>
                    <span className="chat-sender">Jugador {msg.role}:</span>
                    <span className="chat-text">{msg.text}</span>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-messages">
            Aún no hay mensajes. ¡Empieza a comunicarte!
          </div>
        )}
      </div>

      <div className="chat-input-group">
        <input
          ref={inputRef}
          className="pixel-input small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          placeholder="Escribe un mensaje..."
          maxLength={100}
          autoFocus={false}
          tabIndex={0}
        />
        <button className="pixel-button small" onClick={handleSend}>
          Enviar
        </button>
      </div>
    </div>
  );
};

export default TeamChat;
