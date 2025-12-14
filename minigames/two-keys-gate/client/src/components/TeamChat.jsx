import React, { useState, useEffect, useRef } from 'react';

const TeamChat = ({ messages, onSendMessage, myRole }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="section-title">Chat del Equipo</div>

      {/* Messages */}
      <div className="chat-messages">
        {messages && messages.length > 0 ? (
          messages.map((msg, i) => {
            const isSystem = msg.role === 'system';
            const className = isSystem
              ? 'system-message'
              : msg.role === myRole
                ? 'own-message'
                : 'other-message';

            return (
              <div key={i} className={`chat-message ${className}`}>
                <span className="chat-sender">
                  {isSystem ? 'Sistema:' : `Jugador ${msg.role}:`}
                </span>
                <span className="chat-text">{msg.text}</span>
              </div>
            );
          })
        ) : (
          <div className="no-messages">
            Aún no hay mensajes. ¡Empieza a comunicarte!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-group">
        <input
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
        />
        <button className="pixel-button small" onClick={handleSend}>
          Enviar
        </button>
      </div>
    </div>
  );
};

export default TeamChat;
