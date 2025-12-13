import { useState, useEffect, useCallback } from 'react';
import * as Colyseus from "colyseus.js";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/screens/AuthScreen';
import { WaitingScreen } from './components/screens/WaitingScreen';
import { MonitorDashboard } from './components/screens/MonitorDashboard';
import { SpectatorView } from './components/views/SpectatorView';
import { Game } from './Game';

// Determine server URL based on environment
const getServerUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:2567';
    }
    return `http://${hostname}:2567`;
  }
  return 'http://localhost:2567';
};

const SERVER_URL = getServerUrl();

// Main app content (uses auth context)
const AppContent = () => {
  const { user, isLoading, serverUrl } = useAuth();
  const [assignedRoom, setAssignedRoom] = useState<string | null>(null);
  const [spectatingRoom, setSpectatingRoom] = useState<string | null>(null);
  const [spectatorData, setSpectatorData] = useState<any>(null);
  const [spectatorRoom, setSpectatorRoom] = useState<Colyseus.Room | null>(null);

  // Handle player assignment
  const handleAssigned = useCallback((roomId: string) => {
    setAssignedRoom(roomId);
  }, []);

  // Handle spectate (now receives roomId directly)
  const handleSpectate = useCallback(async (roomId: string) => {
    try {
      const client = new Colyseus.Client(serverUrl.replace('http', 'ws'));
      
      // Join as spectator using the room ID
      const room = await client.joinById(roomId, { role: 'spectator' });
      
      setSpectatorRoom(room);
      setSpectatingRoom(roomId);
      
      // Listen for state changes
      room.onStateChange((state: any) => {
        setSpectatorData({
          carPosition: {
            x: state.car?.x || 0,
            z: state.car?.z || 0,
            angle: state.car?.angle || 0
          },
          speed: state.car?.speed || 0,
          trackData: state.trackData || '',
          conesData: state.conesData || '',
          currentLap: state.currentLap || 0,
          totalLaps: state.totalLaps || 1,
          raceProgress: state.raceProgress || 0,
          raceTime: state.raceTime || 0,
          raceFinished: state.raceFinished || false
        });
      });
    } catch (error) {
      console.error('Failed to spectate:', error);
      alert('No se pudo conectar a la partida');
    }
  }, [serverUrl]);

  // Handle back from spectator
  const handleBackFromSpectator = useCallback(() => {
    if (spectatorRoom) {
      spectatorRoom.leave();
    }
    setSpectatorRoom(null);
    setSpectatingRoom(null);
    setSpectatorData(null);
  }, [spectatorRoom]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Press Start 2P", monospace',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏎️</div>
          <div style={{ fontSize: '12px', color: '#888' }}>CARGANDO...</div>
        </div>
      </div>
    );
  }

  // Not logged in - show auth screen
  if (!user) {
    return <AuthScreen />;
  }

  // Monitor spectating a game
  if (user.role === 'monitor' && spectatingRoom && spectatorData) {
    return (
      <SpectatorView
        carPosition={spectatorData.carPosition}
        speed={spectatorData.speed}
        trackData={spectatorData.trackData}
        conesData={spectatorData.conesData}
        currentLap={spectatorData.currentLap}
        totalLaps={spectatorData.totalLaps}
        raceProgress={spectatorData.raceProgress}
        raceTime={spectatorData.raceTime}
        raceFinished={spectatorData.raceFinished}
        onBack={handleBackFromSpectator}
        roomCode={spectatingRoom}
      />
    );
  }

  // Monitor - show dashboard
  if (user.role === 'monitor') {
    return <MonitorDashboard onSpectate={handleSpectate} />;
  }

  // Player assigned to a room - go to game
  if (assignedRoom) {
    return <Game preassignedRoom={assignedRoom} />;
  }

  // Player - show waiting screen
  return <WaitingScreen onAssigned={handleAssigned} />;
};

function App() {
  return (
    <AuthProvider serverUrl={SERVER_URL}>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
