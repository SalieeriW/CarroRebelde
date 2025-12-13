import { useEffect, useRef, useCallback, useState } from 'react';

interface SpectatorViewProps {
  carPosition: { x: number; z: number; angle: number };
  speed: number;
  trackData: string;
  conesData: string;
  currentLap: number;
  totalLaps: number;
  raceProgress: number;
  raceTime: number;
  raceFinished: boolean;
  onBack: () => void;
  roomCode: string;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const TRACK_WIDTH = 240;

const PALETTE = {
  bg: '#001a00',
  road: '#00aa00',
  roadBorder: '#006600',
  car: '#ff3333',
  cone: '#ffaa00',
  finishLine: '#ffffff'
};

export const SpectatorView = ({
  carPosition,
  speed,
  trackData,
  conesData,
  currentLap,
  totalLaps,
  raceProgress,
  raceTime,
  raceFinished,
  onBack,
  roomCode
}: SpectatorViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  
  // Parse track data
  const [track, setTrack] = useState<Array<{x: number, y: number}>>([]);
  const [cones, setCones] = useState<Array<{x: number, y: number}>>([]);
  
  useEffect(() => {
    if (trackData) {
      try {
        const parsed = JSON.parse(trackData);
        if (Array.isArray(parsed)) {
          setTrack(parsed);
        }
      } catch (e) {
        console.error('Error parsing track:', e);
      }
    }
  }, [trackData]);
  
  useEffect(() => {
    if (conesData) {
      try {
        const parsed = JSON.parse(conesData);
        if (Array.isArray(parsed)) {
          setCones(parsed);
        }
      } catch (e) {
        console.error('Error parsing cones:', e);
      }
    }
  }, [conesData]);
  
  // Calculate zoom to fit entire track
  const getZoom = useCallback(() => {
    if (!track || track.length < 2) return 0.1;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of track) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const margin = TRACK_WIDTH * 3;
    
    return Math.min(
      (VIEW_WIDTH - 40) / (w + margin),
      (VIEW_HEIGHT - 120) / (h + margin)
    ) * 0.85;
  }, [track]);
  
  // Get track center
  const getTrackCenter = useCallback(() => {
    if (!track || track.length < 2) return { x: 0, y: 0 };
    
    let sumX = 0, sumY = 0;
    for (const p of track) {
      sumX += p.x;
      sumY += p.y;
    }
    return {
      x: sumX / track.length,
      y: sumY / track.length
    };
  }, [track]);
  
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Background
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    
    // Grid
    ctx.strokeStyle = 'rgba(0, 100, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < VIEW_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, VIEW_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < VIEW_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(VIEW_WIDTH, i);
      ctx.stroke();
    }
    
    // Transform for track
    const zoom = getZoom();
    const center = getTrackCenter();
    
    ctx.save();
    ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 30);
    ctx.scale(zoom, zoom);
    ctx.translate(-center.x, -center.y);
    
    // Draw track
    if (track && track.length > 2) {
      // Border
      ctx.strokeStyle = PALETTE.roadBorder;
      ctx.lineWidth = TRACK_WIDTH + 24;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(track[0].x, track[0].y);
      for (let i = 1; i < track.length; i++) {
        ctx.lineTo(track[i].x, track[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Road
      ctx.strokeStyle = PALETTE.road;
      ctx.lineWidth = TRACK_WIDTH;
      ctx.beginPath();
      ctx.moveTo(track[0].x, track[0].y);
      for (let i = 1; i < track.length; i++) {
        ctx.lineTo(track[i].x, track[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Center line
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 4;
      ctx.setLineDash([30, 30]);
      ctx.beginPath();
      ctx.moveTo(track[0].x, track[0].y);
      for (let i = 1; i < track.length; i++) {
        ctx.lineTo(track[i].x, track[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Finish line
      if (track.length > 1) {
        const p0 = track[0];
        const p1 = track[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        
        ctx.save();
        ctx.translate(p0.x, p0.y);
        ctx.rotate(Math.atan2(dy, dx));
        
        const numSquares = 8;
        const squareSize = (TRACK_WIDTH + 20) / numSquares;
        
        for (let i = 0; i < numSquares; i++) {
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(
              -squareSize + j * squareSize,
              -TRACK_WIDTH / 2 - 10 + i * squareSize,
              squareSize,
              squareSize
            );
          }
        }
        ctx.restore();
      }
    }
    
    // Draw cones
    cones.forEach(cone => {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(cone.x, cone.y, TRACK_WIDTH * 0.2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = PALETTE.cone;
      ctx.beginPath();
      ctx.arc(cone.x, cone.y, TRACK_WIDTH * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw car
    ctx.save();
    ctx.translate(carPosition.x, carPosition.z);
    ctx.rotate(Math.PI - carPosition.angle);
    
    // Car glow
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, TRACK_WIDTH * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // Car arrow
    const carSize = TRACK_WIDTH * 0.15;
    ctx.fillStyle = PALETTE.car;
    ctx.beginPath();
    ctx.moveTo(0, -carSize);
    ctx.lineTo(-carSize * 0.6, carSize * 0.5);
    ctx.lineTo(0, carSize * 0.2);
    ctx.lineTo(carSize * 0.6, carSize * 0.5);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = carSize * 0.1;
    ctx.stroke();
    
    ctx.restore();
    ctx.restore();
    
    // UI Overlay
    // Header
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, VIEW_WIDTH, 60);
    
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(`👁️ ESPECTADOR - ${roomCode}`, VIEW_WIDTH / 2, 25);
    
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`LAP ${currentLap}/${totalLaps} | ${Math.round(raceProgress * 100)}% | ${formatTime(raceTime)}`, VIEW_WIDTH / 2, 48);
    
    // Speed indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(VIEW_WIDTH - 120, VIEW_HEIGHT - 50, 110, 40);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#00d4ff';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(speed * 10)} KM/H`, VIEW_WIDTH - 15, VIEW_HEIGHT - 25);
    
    // Back button hint
    ctx.fillStyle = '#666';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ESC para volver', 10, VIEW_HEIGHT - 15);
    
    // Race finished overlay
    if (raceFinished) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      
      ctx.font = 'bold 32px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText('🏆 CARRERA TERMINADA', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 20);
      
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.fillStyle = '#00ff88';
      ctx.fillText(`Tiempo: ${formatTime(raceTime)}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 30);
    }
    
    ctx.textAlign = 'left';
  }, [track, cones, carPosition, speed, currentLap, totalLaps, raceProgress, raceTime, raceFinished, roomCode, getZoom, getTrackCenter]);
  
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };
  
  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    draw(ctx);
    requestRef.current = requestAnimationFrame(tick);
  }, [draw]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = VIEW_WIDTH;
    canvas.height = VIEW_HEIGHT;
    
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [tick]);
  
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);
  
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Press Start 2P", monospace',
      padding: '20px'
    }}>
      <div style={{
        border: '8px solid #16213e',
        boxShadow: '8px 8px 0px #0f0f23',
        position: 'relative'
      }}>
        <canvas
          ref={canvasRef}
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          style={{
            display: 'block',
            imageRendering: 'pixelated'
          }}
        />
        
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '70px',
            left: '10px',
            padding: '10px 15px',
            fontSize: '10px',
            fontFamily: '"Press Start 2P", monospace',
            background: '#e94560',
            color: '#fff',
            border: '3px solid #16213e',
            cursor: 'pointer'
          }}
        >
          ← VOLVER
        </button>
      </div>
    </div>
  );
};

