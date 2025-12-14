import { useEffect, useRef, useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';

interface NavigatorViewProps {
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    pathHistory: Array<{ x: number; z: number }>;
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
    onHorn: (active: boolean) => void;
    onRadio: () => void;
    radioStation: string;
    hornActive: boolean;
    speed?: number;
    trackData?: string; // JSON serializado del circuito del servidor
    conesData?: string; // JSON serializado de los conos del Driver
    bgmEnabled?: boolean; // BGM toggle state
    onBgmToggle?: () => void; // BGM toggle handler
}

// --- CONFIGURACIร�N ---

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;

// Configuraciรณn Visual

const PALETTE = {
  bg: '#050505', 
  text: '#ffffff',
  alert: '#ff0000',
  
  // Mundo Conductor
  grass: '#0d1a0d',       
  grassDetail: '#142b14', 
  track: '#2a2a2a',       
  trackBorder: '#d35400', // Naranja Seguridad
  trackLine: '#cccccc',   
  
  carBody: '#d90429',
  carRoof: '#1d3557',
  headlight: 'rgba(220, 240, 255, 0.15)', 
  
  cone: '#ff6600',
  coneStrip: '#ffffff',

  // Decoraciones
  fastFoodRed: '#d00000',
  fastFoodYellow: '#ffcc00',
  signMetal: '#a0a0a0',
  signFace: '#eeeeee',
  
  // UI Copiloto (Estilo Retro)
  dashWood: '#5d4037',
  dashLeather: '#212121',
  gpsBezel: '#333333',
  gpsScreenOff: '#111',
  gpsScreenOn: '#001a00', // Verde oscuro CRT
  gpsRoad: '#00ff00',     // Verde fรณsforo
  gpsObstacle: '#ffaa00', // Color obstaculos GPS
  gpsCar: '#ff3333',
  
  radioBody: '#111',
  radioDisplay: '#2b1b17', // Ambar apagado
  radioText: '#ff8800',    // Ambar encendido
  
  hornBtn: '#b71c1c',
  hornBtnLit: '#ff5252'
};

const STATIONS = [
  { name: "RETRO FM", color: "#ff8800", speed: 0.2 }, 
  { name: "EUROBEAT", color: "#00ccff", speed: 0.8 }, 
  { name: "LO-FI", color: "#cc88ff", speed: 0.1 }, 
  { name: "STATIC", color: "#aaaaaa", speed: 2.0 }
];

const checkClick = (pos: {x: number, y: number}, rect: {x: number, y: number, w: number, h: number}) => {
    return pos.x >= rect.x && pos.x <= rect.x + rect.w &&
           pos.y >= rect.y && pos.y <= rect.y + rect.h;
};

// --- GENERADOR DE CIRCUITOS PROCEDURAL (MISMO QUE DRIVERVIEW) ---

const generateProceduralTrack = () => {
  const points = [];
  const numPoints = 300; 
  const baseRadius = 2500; 
  
  const layers = [];
  const numLayers = 6;
  
  for(let i = 0; i < numLayers; i++) {
      layers.push({
          frequency: Math.floor(Math.random() * 10) + 2, 
          phase: Math.random() * Math.PI * 2,
          amplitude: (Math.random() * 800 + 400) / (i + 1.5) 
      });
  }

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    let radiusOffset = 0;
    
    layers.forEach(layer => {
        radiusOffset += Math.sin(angle * layer.frequency + layer.phase) * layer.amplitude;
    });

    const r = Math.max(800, baseRadius + radiusOffset);
    
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    });
  }
  return points;
};

const TRACK_WIDTH = 240; // Same as DriverView / Server procedural track width

// --- COMPONENTE PRINCIPAL ---

export const NavigatorView = ({ 
    carPosition,
    onHorn,
    onRadio,
    radioStation,
    hornActive,
    speed = 0,
    trackData = "",
    conesData = "",
    bgmEnabled = true,
    onBgmToggle
}: NavigatorViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);
    
    // Parsear los conos del Driver (recibidos del servidor)
    const [cones, setCones] = useState<Array<{x: number, y: number}>>([]);
    
    useEffect(() => {
        if (conesData) {
            try {
                const parsed = JSON.parse(conesData);
                if (Array.isArray(parsed)) {
                    setCones(parsed);
                    console.log("NavigatorView: Received cones from server:", parsed.length);
                }
            } catch (e) {
                console.error("Error parsing conesData:", e);
            }
        }
    }, [conesData]);
    
    // Usar el circuito del servidor si está disponible, sino generar uno local como fallback
    const getTrackPoints = useCallback(() => {
        if (trackData) {
            try {
                const parsed = JSON.parse(trackData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.error("Error parsing trackData:", e);
            }
        }
        // Fallback: generar circuito local si no hay datos del servidor
        return generateProceduralTrack();
    }, [trackData]);
    
    const [track, setTrack] = useState(getTrackPoints());
    
    // Actualizar el circuito cuando cambie trackData del servidor
    useEffect(() => {
        const newTrack = getTrackPoints();
        setTrack(newTrack);
    }, [trackData, getTrackPoints]);

    // Zoom state for GPS - start with a close-up view that follows the car
    const [zoomLevel, setZoomLevel] = useState(2); // 0 = full track, 1 = medium, 2 = close-up
    
    // Calculate zoom based on zoom level setting
    const gpsZoom = useCallback(() => {
        // Different zoom modes
        const mapW = 440;
        const mapH = 460;
        
        if (zoomLevel === 0) {
            // Full track view
            if (!track || track.length < 2) return 0.1;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of track) {
                if (typeof p?.x !== "number" || typeof p?.y !== "number") continue;
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            }
            const w = Math.max(1, maxX - minX);
            const h = Math.max(1, maxY - minY);
            const margin = TRACK_WIDTH * 2 + 20;
            return Math.min(mapW / (w + margin), mapH / (h + margin)) * 0.9;
        } else if (zoomLevel === 1) {
            // Medium zoom - show area around car (~1500 units visible)
            const viewRadius = 1500;
            return Math.min(mapW, mapH) / (viewRadius * 2);
        } else {
            // Close-up zoom - show area around car (~600 units visible)
            const viewRadius = 600;
            return Math.min(mapW, mapH) / (viewRadius * 2);
        }
    }, [track, zoomLevel]);

    const gameState = useRef({
        // Estado Copiloto
        radioIndex: 0,
        hornActive: false,
        time: 0,
        
        // UI Copiloto
        radioVizHeight: Array(12).fill(0) as number[]
    });

    // Sync with server state
    useEffect(() => {
        gameState.current.hornActive = hornActive;
    }, [hornActive]);

    useEffect(() => {
        // Map server radio station to index
        const stationMap: { [key: string]: number } = {
            "normal": 0,
            "absurd1": 1,
            "absurd2": 2,
            "absurd3": 3
        };
        const idx = stationMap[radioStation] || 0;
        gameState.current.radioIndex = idx;
    }, [radioStation]);

    const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const pos = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };

        console.log("Mouse click at:", pos.x, pos.y); // Debug

        // UI Layout (Coordenadas fijas del dibujo)
        // Botรณn Horn (Redondo grande abajo derecha) - coordenadas: 640, 450, radio 60
        const hornCX = 640;
        const hornCY = 450;
        const hornDist = Math.sqrt((pos.x - hornCX)**2 + (pos.y - hornCY)**2);
        if (hornDist < 60) {
            console.log("HORN clicked!");
            gameState.current.hornActive = true;
            onHorn(true);
            return; // Early return to avoid checking other buttons
        }
        
        // Radio (Arriba derecha) - coordenadas: 520, 100, width 240, height 140
        const radX = 520;
        const radY = 100;
        const radW = 240;
        const radH = 140;
        
        // Botรณn Prev (x: 520+20, y: 100+90, w: 60, h: 30)
        if (checkClick(pos, { x: radX + 20, y: radY + 90, w: 60, h: 30 })) {
            console.log("RADIO PREV clicked!");
            const newIndex = (gameState.current.radioIndex - 1 + STATIONS.length) % STATIONS.length;
            gameState.current.radioIndex = newIndex;
            onRadio(); // Cycle radio
            return;
        }
        
        // Botรณn Next (x: 520+160, y: 100+90, w: 60, h: 30)
        if (checkClick(pos, { x: radX + 160, y: radY + 90, w: 60, h: 30 })) {
            console.log("RADIO NEXT clicked!");
            const newIndex = (gameState.current.radioIndex + 1) % STATIONS.length;
            gameState.current.radioIndex = newIndex;
            onRadio(); // Cycle radio
            return;
        }
        
        // Zoom buttons on GPS (bottom of GPS screen)
        const mapX = 40, mapY = 100, mapH = 460;
        // Zoom Out button
        if (checkClick(pos, { x: mapX + 10, y: mapY + mapH - 50, w: 40, h: 35 })) {
            console.log("ZOOM OUT clicked!");
            setZoomLevel(prev => Math.max(0, prev - 1));
            return;
        }
        
        // Zoom In button
        if (checkClick(pos, { x: mapX + 60, y: mapY + mapH - 50, w: 40, h: 35 })) {
            console.log("ZOOM IN clicked!");
            setZoomLevel(prev => Math.min(2, prev + 1));
            return;
        }

        // BGM Toggle button (below radio)
        const bgmX = radX;
        const bgmY = radY + radH + 10;
        const bgmW = radW;
        const bgmH = 40;
        if (checkClick(pos, { x: bgmX, y: bgmY, w: bgmW, h: bgmH })) {
            console.log("BGM TOGGLE clicked!");
            if (onBgmToggle) {
                onBgmToggle();
            }
            return;
        }

    }, [onHorn, onRadio, onBgmToggle]);

    const handleMouseUp = useCallback(() => {
        gameState.current.hornActive = false;
        onHorn(false);
    }, [onHorn]);

    // --- RENDERIZADO COPILOTO ---

    const drawCopilotUI = useCallback((ctx: CanvasRenderingContext2D, state: typeof gameState.current) => {
        // 1. Salpicadero (Madera/Cuero)
        ctx.fillStyle = PALETTE.dashLeather;
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        
        // Panel de Madera (Parte superior)
        ctx.fillStyle = PALETTE.dashWood;
        ctx.fillRect(0, 0, VIEW_WIDTH, 80);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(VIEW_WIDTH, 80); ctx.stroke();

        // --- 2. PANTALLA GPS (Izquierda) ---
        const mapX = 40; const mapY = 100; const mapW = 440; const mapH = 460;
        
        // Marco GPS (Plรกstico rugoso)
        ctx.fillStyle = PALETTE.gpsBezel;
        ctx.fillRect(mapX-15, mapY-15, mapW+30, mapH+30);
        // Tornillos
        ctx.fillStyle = '#111';
        ctx.fillRect(mapX-10, mapY-10, 6, 6);
        ctx.fillRect(mapX+mapW+4, mapY-10, 6, 6);
        ctx.fillRect(mapX-10, mapY+mapH+4, 6, 6);
        ctx.fillRect(mapX+mapW+4, mapY+mapH+4, 6, 6);

        // Pantalla CRT
        ctx.save();
        ctx.beginPath(); ctx.rect(mapX, mapY, mapW, mapH); ctx.clip();
        
        // Fondo Mapa (Grid Tรกctico)
        ctx.fillStyle = PALETTE.gpsScreenOn;
        ctx.fillRect(mapX, mapY, mapW, mapH);
        
        ctx.strokeStyle = 'rgba(0, 100, 0, 0.3)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        const gridOffX = (carPosition.x * 0.15) % gridSize;
        const gridOffY = (carPosition.z * 0.15) % gridSize;
        
        for(let i=0; i<mapW+gridSize; i+=gridSize) {
            ctx.beginPath(); ctx.moveTo(mapX + i - gridOffX, mapY); ctx.lineTo(mapX + i - gridOffX, mapY + mapH); ctx.stroke();
        }
        for(let i=0; i<mapH+gridSize; i+=gridSize) {
            ctx.beginPath(); ctx.moveTo(mapX, mapY + i - gridOffY); ctx.lineTo(mapX + mapW, mapY + i - gridOffY); ctx.stroke();
        }

        // RENDERIZAR TRACK EN GPS (North Up)
        const zoom = gpsZoom();
        const gpsCX = mapX + mapW/2;
        const gpsCY = mapY + mapH * 0.5; // Centrado (North Up)

        ctx.translate(gpsCX, gpsCY);
        // Sin rotacion para North Up
        ctx.scale(zoom, zoom);
        // Centrar en la posiciรณn del coche del servidor
        ctx.translate(-carPosition.x, -carPosition.z);

        // Pista - solo dibujar si hay datos válidos
        if (track && track.length > 2 && track[0]?.x !== undefined) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Outer border (red safety barrier)
            ctx.strokeStyle = '#cc3300';
            // NOTE: we already scaled the context (ctx.scale(zoom, zoom)),
            // so lineWidth must stay in world units (do NOT divide by zoom).
            ctx.lineWidth = (TRACK_WIDTH + 24);
            ctx.beginPath();
            ctx.moveTo(track[0].x, track[0].y);
            for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
            ctx.closePath();
            ctx.stroke();

            // Road surface (green)
            ctx.strokeStyle = PALETTE.gpsRoad;
            ctx.lineWidth = TRACK_WIDTH;
            ctx.beginPath();
            ctx.moveTo(track[0].x, track[0].y);
            for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
            ctx.closePath();
            ctx.stroke();
            
            // Center line (dashed yellow)
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 6;
            ctx.setLineDash([40, 40]);
            ctx.beginPath();
            ctx.moveTo(track[0].x, track[0].y);
            for(let i=1; i<track.length; i++) ctx.lineTo(track[i].x, track[i].y);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            
            // === FINISH LINE ===
            if (track.length > 1) {
                const p0 = track[0];
                const p1 = track[1];
                // Calculate direction
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                
                // Draw checkered pattern
                const numSquares = 8;
                const squareSize = (TRACK_WIDTH + 20) / numSquares;
                
                ctx.save();
                ctx.translate(p0.x, p0.y);
                ctx.rotate(Math.atan2(dy, dx));
                
                for (let i = 0; i < numSquares; i++) {
                    for (let j = 0; j < 2; j++) {
                        const isWhite = (i + j) % 2 === 0;
                        ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
                        ctx.fillRect(
                            -squareSize + j * squareSize,
                            -TRACK_WIDTH / 2 - 10 + i * squareSize,
                            squareSize,
                            squareSize
                        );
                    }
                }
                
                // Add "FINISH" text
                ctx.rotate(-Math.atan2(dy, dx)); // Reset rotation for text
                ctx.fillStyle = '#ffd700';
                ctx.font = `bold ${Math.max(20, TRACK_WIDTH * 0.15)}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('🏁', 0, -TRACK_WIDTH / 2 - 30);
                ctx.restore();
            }
        } else {
            // No track data - draw a placeholder message
            ctx.fillStyle = '#ff0000';
            ctx.font = `${100/zoom}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText("NO TRACK DATA", carPosition.x, carPosition.z);
            ctx.textAlign = 'left';
        }

        // OBSTACULOS EN GPS (Conos del Driver - mismas coordenadas que la pista)
        // Los conos usan {x, y} igual que el track, donde y = server z
        const coneSizes = [TRACK_WIDTH * 0.4, TRACK_WIDTH * 0.25, TRACK_WIDTH * 0.15];
        const coneVisualRadius = coneSizes[zoomLevel] || TRACK_WIDTH * 0.15;
        if (cones && cones.length > 0) {
            cones.forEach(cone => {
                // Coordenadas: cone.x y cone.y (mismo sistema que track)
                const coneX = cone.x;
                const coneY = cone.y; // y del cono = y del track = z del servidor
                
                // Draw cone with pulsing effect
                const pulse = 1 + Math.sin(Date.now() / 200) * 0.2;
                
                // Outer glow
                ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(coneX, coneY, coneVisualRadius * 1.5 * pulse, 0, Math.PI * 2);
                ctx.fill();
                
                // Main cone circle
                ctx.fillStyle = PALETTE.gpsObstacle;
                ctx.beginPath();
                ctx.arc(coneX, coneY, coneVisualRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner highlight
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(coneX, coneY, coneVisualRadius * 0.4, 0, Math.PI * 2);
                ctx.fill();
                
                // Black outline
                ctx.strokeStyle = '#000';
                ctx.lineWidth = coneVisualRadius * 0.15;
                ctx.beginPath();
                ctx.arc(coneX, coneY, coneVisualRadius, 0, Math.PI * 2);
                ctx.stroke();
            });
        }

        // Icono Coche - tamaño según zoom level
        const carSizes = [TRACK_WIDTH * 0.8, TRACK_WIDTH * 0.4, TRACK_WIDTH * 0.25];
        const carSize = carSizes[zoomLevel] || TRACK_WIDTH * 0.25;
        ctx.save();
        ctx.translate(carPosition.x, carPosition.z);
        
        // Draw a circle background first for visibility
        ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, carSize * 1.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Server uses: x += sin(angle), z += cos(angle)
        // So angle=0 means moving in +Z direction (down on screen)
        // The arrow points UP (-Y) in local coords
        // To align with movement: rotation = PI - angle
        ctx.rotate(Math.PI - carPosition.angle);
        
        // Car arrow icon - pointing in direction of movement
        ctx.fillStyle = PALETTE.gpsCar;
        ctx.beginPath();
        ctx.moveTo(0, -carSize);           // Tip (front of car)
        ctx.lineTo(-carSize * 0.5, carSize * 0.3);  // Left back
        ctx.lineTo(-carSize * 0.3, carSize * 0.6);  // Left indent
        ctx.lineTo(0, carSize * 0.3);      // Center back
        ctx.lineTo(carSize * 0.3, carSize * 0.6);   // Right indent
        ctx.lineTo(carSize * 0.5, carSize * 0.3);   // Right back
        ctx.closePath();
        ctx.fill();
        
        // Add a white outline for better visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = carSize * 0.08;
        ctx.stroke();
        
        // Direction indicator line (shows exactly where car is heading)
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = carSize * 0.1;
        ctx.beginPath();
        ctx.moveTo(0, -carSize);
        ctx.lineTo(0, -carSize * 2);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.restore(); // Fin GPS transform - volver a coordenadas de pantalla
        
        // Scanlines GPS
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        for(let i=mapY; i<mapY+mapH; i+=4) ctx.fillRect(mapX, i, mapW, 2);

        // Texto OSD
        ctx.fillStyle = '#0f0';
        ctx.font = '14px monospace';
        ctx.fillText("NAV-SAT V1.0", mapX + 10, mapY + 25);
        ctx.fillText(`SPD: ${Math.round(speed * 10)} KM/H`, mapX + 120, mapY + mapH - 15);
        
        // Info panel (right side)
        ctx.textAlign = 'right';
        ctx.fillText(`CONES: ${cones?.length || 0}`, mapX + mapW - 10, mapY + 25);
        ctx.fillText(`ANG: ${Math.round(carPosition.angle * 180 / Math.PI)}°`, mapX + mapW - 10, mapY + 45);
        // Debug: show first cone position if available
        if (cones && cones.length > 0) {
            const c = cones[0];
            ctx.fillText(`C0: ${Math.round(c.x)},${Math.round(c.y)}`, mapX + mapW - 10, mapY + 65);
        }
        ctx.textAlign = 'left';
        
        // Zoom buttons (bottom left of GPS)
        const zoomLabels = ['MAP', 'MED', 'CAR'];
        // Zoom Out button (-)
        ctx.fillStyle = '#333';
        ctx.fillRect(mapX + 10, mapY + mapH - 50, 40, 35);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(mapX + 10, mapY + mapH - 50, 40, 35);
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('-', mapX + 30, mapY + mapH - 27);
        
        // Zoom In button (+)
        ctx.fillStyle = '#333';
        ctx.fillRect(mapX + 60, mapY + mapH - 50, 40, 35);
        ctx.strokeStyle = '#0f0';
        ctx.strokeRect(mapX + 60, mapY + mapH - 50, 40, 35);
        ctx.fillStyle = '#0f0';
        ctx.fillText('+', mapX + 80, mapY + mapH - 27);
        
        // Current zoom level indicator
        ctx.font = '12px monospace';
        ctx.fillText(zoomLabels[zoomLevel] || 'CAR', mapX + 55, mapY + mapH - 55);
        ctx.textAlign = 'left';

        // Alerta Claxon
        if (state.hornActive) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(mapX, mapY, mapW, mapH);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("ALERTA", mapX + mapW/2, mapY + mapH/2);
            ctx.textAlign = 'left';
        }

        // --- 3. RADIO (Derecha Arriba) ---
        const radX = 520; const radY = 100; const radW = 240; const radH = 140;
        
        // Cuerpo Radio
        ctx.fillStyle = PALETTE.radioBody;
        ctx.fillRect(radX, radY, radW, radH);
        // Bordes cromados
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 4;
        ctx.strokeRect(radX, radY, radW, radH);
        
        // Pantalla LCD
        ctx.fillStyle = PALETTE.radioDisplay;
        ctx.fillRect(radX + 20, radY + 20, radW - 40, 50);
        
        // Texto LCD
        const currentStation = STATIONS[state.radioIndex];
        ctx.fillStyle = currentStation.color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(currentStation.name, radX + radW/2, radY + 52);
        
        // Visualizer
        const bars = 12;
        const barW = (radW - 50) / bars;
        ctx.fillStyle = currentStation.color;
        
        // Actualizar visualizer data (simulado)
        if (state.time % 5 === 0) {
            state.radioVizHeight = state.radioVizHeight.map(() => Math.random() * 20);
        }
        
        for(let i=0; i<bars; i++) {
            const h = state.radioVizHeight[i] * currentStation.speed;
            ctx.fillRect(radX + 25 + i*(barW+2), radY + 70 - h, barW, h);
        }

        // Botones Radio
        ctx.fillStyle = '#333';
        // Botรณn Prev
        ctx.fillRect(radX + 20, radY + 90, 60, 30);
        // Botรณn Next
        ctx.fillRect(radX + 160, radY + 90, 60, 30);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText("<", radX + 50, radY + 110);
        ctx.fillText(">", radX + 190, radY + 110);
        
        // Dial central
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(radX + radW/2, radY + 105, 15, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.stroke();

        // --- BGM Toggle (Below Radio) ---
        const bgmX = radX;
        const bgmY = radY + radH + 10;
        const bgmW = radW;
        const bgmH = 40;
        
        // BGM Button background
        ctx.fillStyle = bgmEnabled ? '#2d5016' : '#333';
        ctx.fillRect(bgmX, bgmY, bgmW, bgmH);
        ctx.strokeStyle = bgmEnabled ? '#0f0' : '#666';
        ctx.lineWidth = 3;
        ctx.strokeRect(bgmX, bgmY, bgmW, bgmH);
        
        // BGM Text
        ctx.fillStyle = bgmEnabled ? '#0f0' : '#888';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bgmEnabled ? '🎵 BGM ON' : '🔇 BGM OFF', bgmX + bgmW/2, bgmY + bgmH/2 + 6);

        // --- 4. CLAXON (Derecha Abajo) ---
        const hornCX = 640; 
        const hornCY = 450;
        const hornR = 60;
        
        // Base
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(hornCX, hornCY, hornR + 10, 0, Math.PI*2); ctx.fill();
        
        // Botรณn
        ctx.fillStyle = state.hornActive ? PALETTE.hornBtnLit : PALETTE.hornBtn;
        ctx.beginPath(); 
        // Efecto pulsado (mรกs pequeรฑo si active)
        const r = state.hornActive ? hornR - 5 : hornR;
        ctx.arc(hornCX, hornCY, r, 0, Math.PI*2); 
        ctx.fill();
        
        // Brillo botรณn
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(hornCX - 20, hornCY - 20, 15, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("HORN", hornCX, hornCY + 10);
        
        ctx.textAlign = 'left'; // Reset
    }, [carPosition, cones, speed, hornActive, zoomLevel, gpsZoom, track, bgmEnabled]);

    const draw = useCallback((ctx: CanvasRenderingContext2D) => {
        // Clear canvas first
        ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        
        const state = gameState.current;
        state.time++;
        drawCopilotUI(ctx, state);
    }, [drawCopilotUI]);

    const tick = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.imageSmoothingEnabled = false; 
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

    return (
        <div style={{
            margin: 0,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#ccc',
            padding: '16px'
        }}>
            <div style={{
                position: 'relative',
                border: '8px solid #333',
                borderRadius: '8px',
                boxShadow: '0 0 30px rgba(0,0,0,0.9)',
                backgroundColor: '#000',
                overflow: 'hidden',
                cursor: 'crosshair'
            }}>
                <canvas 
                    ref={canvasRef} 
                    width={VIEW_WIDTH} 
                    height={VIEW_HEIGHT}
                    style={{
                        display: 'block',
                        imageRendering: 'pixelated' as any
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    backgroundImage: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
                    backgroundSize: "100% 4px, 6px 100%"
                }}></div>
            </div>
            
            <div style={{
                marginTop: '16px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: '#666',
                textAlign: 'center'
            }}>
                <div>Click en <span style={{color: '#fff', fontWeight: 'bold'}}>RADIO</span> para cambiar estaciรณn</div>
                <div>Click en <span style={{color: '#fff', fontWeight: 'bold'}}>BGM</span> para activar/desactivar mรณsica</div>
                <div>Click en <span style={{color: '#fff', fontWeight: 'bold'}}>HORN</span> para alertar</div>
            </div>
        </div>
    );
};
