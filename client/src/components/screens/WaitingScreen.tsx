import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface WaitingScreenProps {
  onAssigned: (roomId: string) => void;
}

export const WaitingScreen: React.FC<WaitingScreenProps> = ({ onAssigned }) => {
  const { user, token, logout, serverUrl } = useAuth();
  const [isInQueue, setIsInQueue] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState('');

  // Poll for assignment status
  useEffect(() => {
    if (!isInQueue) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`${serverUrl}/queue/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.status === 'assigned') {
          onAssigned(data.roomId);
        } else if (data.status === 'waiting') {
          setPosition(data.position);
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [isInQueue, token, serverUrl, onAssigned]);

  const joinQueue = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/queue/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsInQueue(true);
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to join queue');
      }
    } catch (err) {
      setError('Connection error');
    }
  }, [token, serverUrl]);

  const leaveQueue = useCallback(async () => {
    try {
      await fetch(`${serverUrl}/queue/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsInQueue(false);
    } catch (err) {
      console.error('Failed to leave queue:', err);
    }
  }, [token, serverUrl]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Press Start 2P", monospace',
      padding: '20px'
    }}>
      <div style={{
        background: '#1a1a2e',
        border: '8px solid #16213e',
        boxShadow: '8px 8px 0px #0f0f23',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎮</div>
          <h1 style={{
            fontSize: '20px',
            color: '#ffd700',
            margin: 0
          }}>
            ¡HOLA, {user?.username?.toUpperCase()}!
          </h1>
        </div>

        {!isInQueue ? (
          <>
            <p style={{
              fontSize: '12px',
              color: '#888',
              lineHeight: '2',
              marginBottom: '30px'
            }}>
              Pulsa el botón para entrar en la cola de espera.
              Un monitor te asignará a una partida.
            </p>

            <button
              onClick={joinQueue}
              style={{
                padding: '20px 40px',
                fontSize: '16px',
                fontFamily: '"Press Start 2P", monospace',
                background: '#00ff88',
                color: '#000',
                border: '4px solid #16213e',
                boxShadow: '4px 4px 0px #0f0f23',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
            >
              🙋 BUSCAR PARTIDA
            </button>
          </>
        ) : (
          <>
            <div style={{
              background: '#0f3460',
              padding: '30px',
              marginBottom: '30px',
              border: '4px solid #16213e'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#00d4ff',
                marginBottom: '15px'
              }}>
                EN COLA DE ESPERA
              </div>
              
              <div style={{
                width: '60px',
                height: '60px',
                border: '4px solid #e94560',
                borderTop: '4px solid transparent',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite'
              }} />
              
              {position > 0 && (
                <div style={{
                  fontSize: '12px',
                  color: '#888'
                }}>
                  Posición: #{position}
                </div>
              )}
              
              <div style={{
                fontSize: '10px',
                color: '#666',
                marginTop: '15px'
              }}>
                Esperando a que un monitor te asigne...
              </div>
            </div>

            <button
              onClick={leaveQueue}
              style={{
                padding: '15px 30px',
                fontSize: '12px',
                fontFamily: '"Press Start 2P", monospace',
                background: '#e94560',
                color: '#fff',
                border: '4px solid #16213e',
                boxShadow: '4px 4px 0px #0f0f23',
                cursor: 'pointer'
              }}
            >
              CANCELAR
            </button>
          </>
        )}

        {error && (
          <div style={{
            background: '#e94560',
            color: '#fff',
            padding: '10px',
            fontSize: '10px',
            marginTop: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={logout}
          style={{
            marginTop: '30px',
            padding: '10px 20px',
            fontSize: '10px',
            fontFamily: '"Press Start 2P", monospace',
            background: 'none',
            color: '#666',
            border: '2px solid #333',
            cursor: 'pointer'
          }}
        >
          CERRAR SESIÓN
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

