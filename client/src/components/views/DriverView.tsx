import { useEffect, useRef, useCallback, useState } from 'react';

interface DriverViewProps {
    steeringValue: number;
    onSteer: (value: number) => void;
    onAccelerate: (active: boolean) => void;
    onCollision?: () => void;
    controlsInverted: boolean;
    speed: number;
    turboActive: boolean;
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
    onTrackGenerated?: (track: Array<{x: number, y: number}>) => void;
    onConesGenerated?: (cones: Array<{x: number, y: number}>) => void;
    trackData?: string;
    clarityActive?: boolean; // Reward from minigame - full visibility
    minigameActive?: boolean; // Block inputs during minigame
}

// --- CONFIGURACIÓN ---

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;

// Físicas
const CAR_MAX_SPEED = 9.0; 

// Configuración Visual
const TILE_SIZE = 64; 
const CAMERA_SMOOTHING = 0.8; // Muy rápido para mínimo delay

const PALETTE = {
  bg: '#000000', 
  
  // Colores "Iluminados"
  grass: '#050a05',       
  grassDetail: '#0a140a', 
  track: '#1a1a1a',       
  trackBorder: '#cc3300', 
  trackLine: '#999999',   
  
  carBody: '#ff0044',
  carRoof: '#222222',
  
  // Luz
  headlight: 'rgba(200, 230, 255, 0.05)', 
  
  cone: '#ff8800',
  coneStrip: '#cccccc',
  
  text: '#00ff00',
  alert: '#ff0000',

  // Decoraciones
  signMetal: '#333',
  signFace: '#999',
  fastFoodRed: '#880000',
  fastFoodYellow: '#ccaa00'
};

// --- GENERADOR DE CIRCUITOS PROCEDURAL ---

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

const TRACK_WIDTH = 240;

// --- COMPONENTE PRINCIPAL ---

export const DriverView = ({ 
    onSteer, 
    onAccelerate, 
    onCollision,
    controlsInverted, 
    speed,
    carPosition,
    onTrackGenerated,
    onConesGenerated,
    trackData = "",
    clarityActive = false,
    minigameActive = false
}: DriverViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);
    
    // Refs para que estén siempre actualizados en el render loop
    const clarityActiveRef = useRef(clarityActive);
    clarityActiveRef.current = clarityActive;
    
    const minigameActiveRef = useRef(minigameActive);
    minigameActiveRef.current = minigameActive;
    
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
        return generateProceduralTrack();
    }, [trackData]);

    const [trackPoints, setTrackPoints] = useState(getTrackPoints());
    
    const gameState = useRef({
        x: 0, y: 0, angle: 0, velocity: { x: 0, y: 0 }, speed: 0,                 
        camX: 0, camY: 0,
        keys: { ArrowUp: false, ArrowLeft: false, ArrowRight: false, ArrowDown: false },
        cones: [] as Array<{x: number, y: number}>, 
        decorations: [] as Array<{x: number, y: number, type: string, angle: number}>, 
        skidMarks: [] as Array<{x: number, y: number, life: number}>, 
        particles: [] as Array<any>, 
        message: "", shake: 0, collisionCooldown: 0, time: 0,
        
        // Feature Toggle
        debugLight: false
    });

    const toggleDebugLight = () => {
        gameState.current.debugLight = !gameState.current.debugLight;
    };

    const resetGame = useCallback((newTrack: Array<{x: number, y: number}>, sendConesToServer: boolean = false) => {
        const startP = newTrack[0];
        const nextP = newTrack[1];
        
        const cones: Array<{x: number, y: number}> = [];
        const decorations: Array<{x: number, y: number, type: string, angle: number}> = [];

        for(let i=0; i<newTrack.length; i++) {
            const p = newTrack[i];
            
            // Generar más conos para que haya más obstáculos
            if(i % 5 === 0 && Math.random() > 0.3) {
                const offsetX = (Math.random() - 0.5) * (TRACK_WIDTH - 80);
                const offsetY = (Math.random() - 0.5) * (TRACK_WIDTH - 80);
                cones.push({ x: p.x + offsetX, y: p.y + offsetY });
            }

            if (i % 8 === 0 && Math.random() > 0.5) {
                const nextP = newTrack[(i+1) % newTrack.length];
                const dx = nextP.x - p.x;
                const dy = nextP.y - p.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                const nx = -dy / len; 
                const ny = dx / len;

                const side = Math.random() > 0.5 ? 1 : -1;
                const distFromCenter = TRACK_WIDTH / 2 + 80 + Math.random() * 50;
                
                const decX = p.x + nx * distFromCenter * side;
                const decY = p.y + ny * distFromCenter * side;

                let type = 'SIGN_TURN';
                if (Math.random() > 0.95) type = 'FAST_FOOD';
                else if (Math.random() > 0.8) type = 'SIGN_LIMIT';

                decorations.push({ x: decX, y: decY, type, angle: Math.atan2(dy, dx) });
            }
        }

        // Preservar debugLight al reiniciar
        const currentDebug = gameState.current ? gameState.current.debugLight : false;

        gameState.current = {
            ...gameState.current,
            x: startP.x,
            y: startP.y,
            angle: Math.atan2(nextP.y - startP.y, nextP.x - startP.x),
            velocity: { x: 0, y: 0 },
            speed: 0,
            camX: startP.x,
            camY: startP.y,
            cones: cones,
            decorations: decorations,
            skidMarks: [],
            particles: [],
            message: "NUEVA PISTA",
            shake: 0,
            collisionCooldown: 0,
            time: 0,
            debugLight: currentDebug
        };

        // Enviar los conos al servidor para que NavigatorView los pueda ver
        if (sendConesToServer && onConesGenerated && cones.length > 0) {
            console.log("Sending cones to server:", cones.length);
            onConesGenerated(cones);
        }
    }, [onConesGenerated]);

    useEffect(() => {
        // Actualizar pista cuando cambie el trackData del servidor
        const next = getTrackPoints();
        setTrackPoints(next);
        // Generar y enviar conos al servidor cuando se crea/actualiza la pista
        resetGame(next, true);

        // Solo publicamos el circuito al servidor si NO viene del servidor (fallback local)
        if (!trackData && onTrackGenerated) {
            onTrackGenerated(next);
        }
    }, [trackData, getTrackPoints, resetGame, onTrackGenerated]); 

    const handleGenerateNewTrack = () => {
        // If the server is providing a shared track, keep it authoritative so Driver/Navigator stay in sync.
        if (trackData) {
            gameState.current.message = "PISTA BLOQUEADA (SERVIDOR)";
            return;
        }
        const newTrack = generateProceduralTrack();
        setTrackPoints(newTrack);
        resetGame(newTrack);
        // Enviar el nuevo circuito al servidor
        if (onTrackGenerated) {
            onTrackGenerated(newTrack);
        }
    };

    // Sync with server speed
    useEffect(() => {
        // Convert server speed (0-100) to game speed (0-9)
        gameState.current.speed = (speed / 100) * CAR_MAX_SPEED;
    }, [speed]);

    // Sync with server car position - this is the source of truth
    useEffect(() => {
        // Server uses {x, z, angle}, client uses {x, y, angle}
        gameState.current.x = carPosition.x;
        gameState.current.y = carPosition.z; // Server z = Client y
        gameState.current.angle = carPosition.angle;
        
        // Camera follows car almost instantly for minimal delay
        const dx = carPosition.x - gameState.current.camX;
        const dy = carPosition.z - gameState.current.camY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Snap camera if too far (like after repositioning) or on first load
        if (dist > 100 || (gameState.current.camX === 0 && gameState.current.camY === 0)) {
            console.log("📷 Camera snapped to car position");
            gameState.current.camX = carPosition.x;
            gameState.current.camY = carPosition.z;
        }
    }, [carPosition.x, carPosition.z, carPosition.angle]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Block inputs during minigame
        if (minigameActiveRef.current) return;
        
        if (e.key in gameState.current.keys) {
            (gameState.current.keys as any)[e.key] = true;
            
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                onAccelerate(true);
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                // Brake
            }
            
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                onSteer(controlsInverted ? 1 : -1);
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                onSteer(controlsInverted ? -1 : 1);
            }
        }
    }, [onSteer, onAccelerate, controlsInverted]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (e.key in gameState.current.keys) {
            (gameState.current.keys as any)[e.key] = false;
            
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                onAccelerate(false);
            }
            
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
                onSteer(0);
            }
        }
    }, [onSteer, onAccelerate]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    // --- EFECTOS VISUALES ---

    const updatePhysics = () => {
        const state = gameState.current;
        state.time++;
        
        if (state.collisionCooldown > 0) state.collisionCooldown--;

        // Camera follows car position directly (fast follow)
        state.camX += (state.x - state.camX) * CAMERA_SMOOTHING;
        state.camY += (state.y - state.camY) * CAMERA_SMOOTHING;

        // Check for local cone collisions (visual feedback) 
        let hitIndex = -1;
        for(let i=0; i<state.cones.length; i++) {
            const cx = state.cones[i].x;
            const cy = state.cones[i].y;
            if (Math.abs(state.x - cx) < 25 && Math.abs(state.y - cy) < 25) { 
                hitIndex = i; break;
            }
        }

        if (hitIndex !== -1) {
            state.shake = 15;
            state.message = "¡CONO!";
            state.cones.splice(hitIndex, 1);
            
            console.log("💥 Cone collision detected!");
            
            // Notify server about collision
            if (onCollision) {
                console.log("📤 Calling onCollision callback");
                onCollision();
            }
        } else if (state.shake === 0 && state.message !== "NUEVA PISTA") {
            state.message = "";
        }

        // Decay shake effect
        if (state.shake > 0) state.shake *= 0.85;
        if (state.shake < 0.3) state.shake = 0;

        // Cleanup old skid marks
        for(let i=state.skidMarks.length-1; i>=0; i--) {
            state.skidMarks[i].life -= 0.01;
            if(state.skidMarks[i].life <= 0) state.skidMarks.splice(i, 1);
        }
    };

    // --- RENDERIZADO ---

    const drawDecoration = (ctx: CanvasRenderingContext2D, dec: {x: number, y: number, type: string, angle: number}) => {
        ctx.save();
        ctx.translate(Math.round(dec.x), Math.round(dec.y));
        
        if (dec.type === 'FAST_FOOD') {
            ctx.fillStyle = PALETTE.fastFoodRed;
            ctx.fillRect(-4, -40, 8, 40);
            ctx.fillStyle = PALETTE.fastFoodYellow;
            ctx.fillRect(-20, -60, 10, 30); 
            ctx.fillRect(10, -60, 10, 30);  
            ctx.fillRect(-10, -45, 10, 15); 
            ctx.fillRect(0, -45, 10, 15);   
            ctx.fillStyle = '#999';
            ctx.fillRect(-25, -25, 50, 12);
            ctx.fillStyle = '#000';
            ctx.fillRect(-20, -22, 4, 4); 
            ctx.fillRect(-12, -22, 4, 4);
        } else if (dec.type === 'SIGN_TURN') {
            ctx.rotate(dec.angle + Math.PI/2);
            ctx.fillStyle = PALETTE.signMetal;
            ctx.fillRect(-14, -2, 4, 4);
            ctx.fillRect(10, -2, 4, 4);
            ctx.fillStyle = PALETTE.signFace;
            ctx.fillRect(-20, -12, 40, 20); 
            ctx.fillStyle = '#aa8800'; 
            ctx.fillRect(-10, -2, 4, 4);
            ctx.fillRect(-5, -6, 4, 4);
            ctx.fillRect(0, -10, 4, 4);
            ctx.fillRect(5, -6, 4, 4);
            ctx.fillRect(10, -2, 4, 4);
        } else if (dec.type === 'SIGN_LIMIT') {
            ctx.fillStyle = '#555';
            ctx.fillRect(-2, -2, 4, 4); 
            ctx.fillStyle = '#999';
            ctx.strokeStyle = '#800';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-10, -5); ctx.lineTo(-5, -10); ctx.lineTo(5, -10); ctx.lineTo(10, -5);
            ctx.lineTo(10, 5); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.lineTo(-10, 5);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const state = gameState.current;
        
        // 1. FONDO NEGRO
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        const screenCX = VIEW_WIDTH / 2;
        const screenCY = VIEW_HEIGHT / 2;
        const shakeX = Math.round((Math.random() - 0.5) * state.shake);
        const shakeY = Math.round((Math.random() - 0.5) * state.shake);
        
        const carScreenX = Math.round(screenCX + shakeX);
        const carScreenY = Math.round(screenCY + shakeY);
        
        // Server uses: x += sin(angle), z += cos(angle)
        // So angle=0 means moving in +z direction (down on screen)
        // Sprite faces right (+x) by default
        // To align sprite with movement direction: drawAngle = PI/2 - angle
        const drawAngle = Math.PI / 2 - state.angle;

        // 2. MÁSCARA DE LUZ (RECORTE)
        // Solo aplicamos recorte si NO estamos en modo debug
        ctx.save();
        
        // clarityActive or debugLight = full visibility (no fog)
        const hasFullVisibility = state.debugLight || clarityActiveRef.current;
        
        if (!hasFullVisibility) {
            ctx.beginPath();
            ctx.moveTo(carScreenX, carScreenY);
            
            const lightDist = 160; 
            const lightWidth = Math.PI / 3.5; 
            
            const lx = carScreenX + Math.cos(drawAngle - lightWidth/2) * lightDist;
            const ly = carScreenY + Math.sin(drawAngle - lightWidth/2) * lightDist;
            const rx = carScreenX + Math.cos(drawAngle + lightWidth/2) * lightDist;
            const ry = carScreenY + Math.sin(drawAngle + lightWidth/2) * lightDist;
            
            ctx.lineTo(lx, ly);
            ctx.lineTo(
                carScreenX + Math.cos(drawAngle) * (lightDist * 1.1), 
                carScreenY + Math.sin(drawAngle) * (lightDist * 1.1)
            );
            ctx.lineTo(rx, ry);
            ctx.lineTo(carScreenX, carScreenY);
            ctx.clip(); 
        }

        // 3. DIBUJAR MUNDO
        ctx.translate(screenCX - state.camX + shakeX, screenCY - state.camY + shakeY);

        // -- Suelo
        const startX = Math.floor((state.camX - 300) / TILE_SIZE) * TILE_SIZE;
        const startY = Math.floor((state.camY - 300) / TILE_SIZE) * TILE_SIZE;
        for (let x = startX; x < startX + 600; x += TILE_SIZE) {
            for (let y = startY; y < startY + 600; y += TILE_SIZE) {
                const noise = ((Math.floor(x/100) + Math.floor(y/100)) % 2 === 0);
                ctx.fillStyle = noise ? PALETTE.grass : PALETTE.grassDetail;
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            }
        }

        // -- Pista
        ctx.lineCap = 'square'; 
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.strokeStyle = PALETTE.trackBorder;
        ctx.lineWidth = TRACK_WIDTH + 24; 
        ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i < trackPoints.length; i++) ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = PALETTE.track;
        ctx.lineWidth = TRACK_WIDTH;
        ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i < trackPoints.length; i++) ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = PALETTE.trackLine;
        ctx.lineWidth = 6;
        ctx.setLineDash([40, 40]);
        ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i < trackPoints.length; i++) ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // === FINISH LINE ===
        if (trackPoints.length > 1) {
            const p0 = trackPoints[0];
            const p1 = trackPoints[1];
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
            ctx.restore();
        }

        state.skidMarks.forEach(skid => {
            ctx.fillStyle = '#111';
            ctx.globalAlpha = skid.life;
            ctx.fillRect(Math.round(skid.x - 4), Math.round(skid.y - 4), 8, 8);
        });
        ctx.globalAlpha = 1.0;

        // Dibujar conos locales (estos son los obstáculos del juego)
        state.cones.forEach(cone => {
            // En modo clarity/debug dibujamos todos, en modo normal solo cercanos
            if(hasFullVisibility || (Math.abs(cone.x - state.x) < 400 && Math.abs(cone.y - state.y) < 400)) {
                const cx = Math.round(cone.x);
                const cy = Math.round(cone.y);
                
                // Efecto de brillo/pulso
                const pulse = 1 + Math.sin(state.time * 0.15) * 0.2;
                
                // Brillo exterior
                ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
                ctx.fill();
                
                // Cuerpo del cono
                ctx.fillStyle = PALETTE.cone;
                ctx.beginPath();
                ctx.arc(cx, cy, 10, 0, Math.PI * 2);
                ctx.fill();
                
                // Centro
                ctx.fillStyle = PALETTE.coneStrip;
                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Borde negro
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 10, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        state.decorations.forEach(dec => {
            if(hasFullVisibility || (Math.abs(dec.x - state.x) < 300 && Math.abs(dec.y - state.y) < 300)) {
                drawDecoration(ctx, dec);
            }
        });

        // 4. TINTE DE LUZ (ATENUADO)
        ctx.restore(); // Quita transform y clip
        
        // Si no estamos en clarity/debug, aplicamos el fade out a la luz
        if (!hasFullVisibility) {
            ctx.globalCompositeOperation = 'destination-in'; 
            ctx.save();
            ctx.translate(carScreenX, carScreenY);
            ctx.rotate(drawAngle);

            const lightDist = 160; 
            const fadeGrad = ctx.createRadialGradient(0, 0, 0, lightDist, 0, lightDist * 0.5);
            fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
            fadeGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)'); 
            fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)'); 

            ctx.fillStyle = fadeGrad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, lightDist + 20, -Math.PI/2, Math.PI/2);
            ctx.fill();
            ctx.restore();
        }

        // Color tenue (siempre dibujar un poco para ambiente)
        ctx.globalCompositeOperation = 'screen'; 
        ctx.save();
        ctx.translate(carScreenX, carScreenY);
        ctx.rotate(drawAngle);

        ctx.fillStyle = PALETTE.headlight;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(200, -80);
        ctx.lineTo(220, 0);
        ctx.lineTo(200, 80);
        ctx.lineTo(0,0);
        ctx.fill();
        
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';

        // 5. COCHE
        ctx.save();
        ctx.translate(carScreenX, carScreenY);
        ctx.rotate(drawAngle);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-20, -10, 44, 24);

        ctx.fillStyle = '#000';
        ctx.fillRect(-18, -14, 10, 4); 
        ctx.fillRect(-18, 10, 10, 4);  
        ctx.fillRect(18, -14, 10, 4);  
        ctx.fillRect(18, 10, 10, 4);   

        ctx.fillStyle = PALETTE.carBody;
        ctx.fillRect(-20, -12, 44, 24);
        
        ctx.fillStyle = PALETTE.carRoof;
        ctx.fillRect(-10, -10, 20, 20);
        
        ctx.fillStyle = '#112233';
        ctx.fillRect(10, -9, 4, 18); 
        ctx.fillRect(-12, -9, 2, 18); 

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(24, -10, 4, 6); 
        ctx.fillRect(24, 4, 4, 6);

        ctx.fillStyle = '#550000';
        ctx.fillRect(-22, -10, 2, 6);
        ctx.fillRect(-22, 4, 2, 6);

        ctx.restore();

        // 6. UI
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = PALETTE.text;
        ctx.fillText(`VEL: ${Math.round(Math.abs(state.speed) * 10)} KM/H`, 20, 30);
        
        if (state.message) {
            ctx.fillStyle = PALETTE.alert;
            ctx.textAlign = 'center';
            ctx.fillText(state.message, VIEW_WIDTH/2, VIEW_HEIGHT - 50);
        }
        
        // CLARITY EFFECT - glowing border when active
        if (clarityActiveRef.current) {
            const pulse = 0.5 + Math.sin(state.time * 0.2) * 0.3;
            ctx.strokeStyle = `rgba(0, 255, 136, ${pulse})`;
            ctx.lineWidth = 8;
            ctx.strokeRect(4, 4, VIEW_WIDTH - 8, VIEW_HEIGHT - 8);
            
            // Inner glow
            ctx.strokeStyle = `rgba(0, 255, 136, ${pulse * 0.5})`;
            ctx.lineWidth = 16;
            ctx.strokeRect(12, 12, VIEW_WIDTH - 24, VIEW_HEIGHT - 24);
            
            // Text indicator
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = `rgba(0, 255, 136, ${pulse + 0.3})`;
            ctx.textAlign = 'center';
            ctx.fillText('👁️ CLARIDAD ACTIVA', VIEW_WIDTH / 2, 30);
        }
    };

    const tick = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        updatePhysics();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.imageSmoothingEnabled = false; 
        draw(ctx);
        requestRef.current = requestAnimationFrame(tick);
    }, []);

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
    }, [tick, trackPoints]);

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
                overflow: 'hidden'
            }}>
                <canvas 
                    ref={canvasRef} 
                    width={VIEW_WIDTH} 
                    height={VIEW_HEIGHT}
                    style={{
                        display: 'block',
                        imageRendering: 'pixelated' as any
                    }}
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
                display: 'flex',
                gap: '16px',
                marginTop: '24px'
            }}>
                <button 
                    onClick={handleGenerateNewTrack}
                    style={{
                        padding: '8px 24px',
                        backgroundColor: '#ff5500',
                        color: '#fff',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    GENERAR NUEVA PISTA
                </button>
                <button 
                    onClick={toggleDebugLight}
                    style={{
                        padding: '8px 24px',
                        backgroundColor: '#333',
                        color: '#fff',
                        fontWeight: 'bold',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    MODO DEBUG: LUZ
                </button>
            </div>

            <div style={{
                marginTop: '16px',
                display: 'flex',
                gap: '32px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: '#666'
            }}>
                <div><span style={{color: '#fff', fontWeight: 'bold'}}>⬆</span> Acelerar</div>
                <div><span style={{color: '#fff', fontWeight: 'bold'}}>⬅ ⮕</span> Girar</div>
            </div>
        </div>
    );
};
