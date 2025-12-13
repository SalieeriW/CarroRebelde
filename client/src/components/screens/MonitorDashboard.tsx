import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface WaitingPlayer {
  oduderId: string;
  username: string;
  waitingTime: number;
}

interface Room {
  roomId: string;
  code: string;
  players: number;
  maxPlayers: number;
}

interface MonitorDashboardProps {
  onSpectate: (roomId: string) => void;
}

export const MonitorDashboard: React.FC<MonitorDashboardProps> = ({ onSpectate }) => {
  const { user, token, logout, serverUrl } = useAuth();
  const [waitingPlayers, setWaitingPlayers] = useState<WaitingPlayer[]>([]);
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch waiting players
        const playersRes = await fetch(`${serverUrl}/queue/players`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (playersRes.ok) {
          const data = await playersRes.json();
          setWaitingPlayers(data.players || []);
        }

        // Fetch active rooms
        const roomsRes = await fetch(`${serverUrl}/monitor/rooms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (roomsRes.ok) {
          const data = await roomsRes.json();
          setActiveRooms(data.rooms || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [token, serverUrl]);

  const togglePlayerSelection = (oduderId: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(oduderId)) {
        return prev.filter(id => id !== oduderId);
      }
      if (prev.length >= 2) {
        return [prev[1], oduderId]; // Replace oldest selection
      }
      return [...prev, oduderId];
    });
  };

  const createRoomAndAssign = useCallback(async () => {
    if (selectedPlayers.length !== 2) {
      setError('Selecciona exactamente 2 jugadores');
      return;
    }

    setError('');
    setSuccess('');

    try {
      // Create room (this now actually creates a Colyseus room)
      const createRes = await fetch(`${serverUrl}/monitor/create-room`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!createRes.ok) {
        throw new Error('Failed to create room');
      }

      const createData = await createRes.json();
      const roomId = createData.roomId;
      const roomCode = createData.roomCode;

      // Assign players to the created room
      const assignRes = await fetch(`${serverUrl}/monitor/assign-players`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerIds: selectedPlayers,
          roomId // Use roomId, not roomCode
        })
      });

      if (assignRes.ok) {
        setSuccess(`¡Partida creada! Código: ${roomCode}`);
        setSelectedPlayers([]);
      } else {
        throw new Error('Failed to assign players');
      }
    } catch (err) {
      setError('Error al crear la partida');
    }
  }, [selectedPlayers, token, serverUrl]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: '"Press Start 2P", monospace',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        background: '#1a1a2e',
        border: '4px solid #16213e'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#888' }}>PANEL DE MONITOR</div>
          <div style={{ fontSize: '16px', color: '#ffd700', marginTop: '5px' }}>
            👁️ {user?.username?.toUpperCase()}
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '10px 20px',
            fontSize: '10px',
            fontFamily: '"Press Start 2P", monospace',
            background: '#e94560',
            color: '#fff',
            border: '4px solid #16213e',
            cursor: 'pointer'
          }}
        >
          SALIR
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Left Panel - Waiting Players */}
        <div style={{
          flex: '1',
          minWidth: '300px',
          background: '#1a1a2e',
          border: '4px solid #16213e',
          padding: '20px'
        }}>
          <h2 style={{
            fontSize: '14px',
            color: '#00ff88',
            marginBottom: '20px',
            borderBottom: '2px solid #16213e',
            paddingBottom: '10px'
          }}>
            🙋 JUGADORES EN ESPERA ({waitingPlayers.length})
          </h2>

          {waitingPlayers.length === 0 ? (
            <div style={{
              color: '#666',
              fontSize: '10px',
              textAlign: 'center',
              padding: '40px'
            }}>
              No hay jugadores esperando
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {waitingPlayers.map(player => (
                <div
                  key={player.oduderId}
                  onClick={() => togglePlayerSelection(player.oduderId)}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    background: selectedPlayers.includes(player.oduderId) ? '#00ff88' : '#0f3460',
                    color: selectedPlayers.includes(player.oduderId) ? '#000' : '#fff',
                    border: '3px solid #16213e',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                    {selectedPlayers.includes(player.oduderId) && '✓ '}
                    {player.username}
                  </div>
                  <div style={{
                    fontSize: '8px',
                    marginTop: '5px',
                    opacity: 0.7
                  }}>
                    Esperando: {formatTime(player.waitingTime)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Game Button */}
          <div style={{ marginTop: '20px' }}>
            <div style={{
              fontSize: '10px',
              color: '#888',
              marginBottom: '10px'
            }}>
              Seleccionados: {selectedPlayers.length}/2
            </div>
            
            <button
              onClick={createRoomAndAssign}
              disabled={selectedPlayers.length !== 2}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '12px',
                fontFamily: '"Press Start 2P", monospace',
                background: selectedPlayers.length === 2 ? '#ffd700' : '#333',
                color: selectedPlayers.length === 2 ? '#000' : '#666',
                border: '4px solid #16213e',
                cursor: selectedPlayers.length === 2 ? 'pointer' : 'not-allowed'
              }}
            >
              🎮 CREAR PARTIDA
            </button>
          </div>

          {error && (
            <div style={{
              background: '#e94560',
              color: '#fff',
              padding: '10px',
              fontSize: '10px',
              marginTop: '15px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: '#00ff88',
              color: '#000',
              padding: '10px',
              fontSize: '10px',
              marginTop: '15px',
              textAlign: 'center'
            }}>
              {success}
            </div>
          )}
        </div>

        {/* Right Panel - Active Rooms */}
        <div style={{
          flex: '1',
          minWidth: '300px',
          background: '#1a1a2e',
          border: '4px solid #16213e',
          padding: '20px'
        }}>
          <h2 style={{
            fontSize: '14px',
            color: '#00d4ff',
            marginBottom: '20px',
            borderBottom: '2px solid #16213e',
            paddingBottom: '10px'
          }}>
            🏁 PARTIDAS ACTIVAS ({activeRooms.length})
          </h2>

          {activeRooms.length === 0 ? (
            <div style={{
              color: '#666',
              fontSize: '10px',
              textAlign: 'center',
              padding: '40px'
            }}>
              No hay partidas activas
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activeRooms.map(room => (
                <div
                  key={room.roomId}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    background: '#0f3460',
                    border: '3px solid #16213e'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', color: '#ffd700' }}>
                        {room.code}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#888',
                        marginTop: '5px'
                      }}>
                        Jugadores: {room.players}/{room.maxPlayers}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onSpectate(room.roomId)}
                      style={{
                        padding: '10px 15px',
                        fontSize: '10px',
                        fontFamily: '"Press Start 2P", monospace',
                        background: '#00d4ff',
                        color: '#000',
                        border: '3px solid #16213e',
                        cursor: 'pointer'
                      }}
                    >
                      👁️ VER
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#1a1a2e',
        border: '4px solid #16213e',
        fontSize: '10px',
        color: '#888',
        lineHeight: '2'
      }}>
        <div style={{ color: '#ffd700', marginBottom: '10px' }}>📋 INSTRUCCIONES:</div>
        <div>1. Los jugadores aparecerán en la lista cuando pulsen "Buscar Partida"</div>
        <div>2. Selecciona 2 jugadores haciendo clic en ellos</div>
        <div>3. Pulsa "Crear Partida" para emparejarlos</div>
        <div>4. Usa el botón "Ver" para espectear una partida activa</div>
      </div>
    </div>
  );
};

