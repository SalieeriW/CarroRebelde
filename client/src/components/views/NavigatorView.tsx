import { useEffect, useRef, useState } from 'react';

interface NavigatorViewProps {
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    challengePortal: { x: number; z: number; active: boolean };
    pathHistory: Array<{ x: number; z: number }>;
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
    onHorn: (active: boolean) => void;
    onRadio: () => void;
    radioStation: string;
    hornActive: boolean;
    speed?: number;
}

const OBSTACLE = {
    NONE: 0,
    ROCK: 1,
    LOG: 2,
    PUDDLE: 3,
    HOLE: 4,
    CONE: 5,
    OIL: 6
};

export const NavigatorView = ({ 
    carPosition, 
    traps, 
    challengePortal, 
    pathHistory, 
    startPoint, 
    endPoint, 
    onHorn, 
    onRadio, 
    radioStation, 
    hornActive,
    speed = 0
}: NavigatorViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statusTextRef = useRef<HTMLDivElement>(null);
    const [localState, setLocalState] = useState({
        radioOn: true,
        stationIndex: 0,
        stations: ["FM 104.5", "AM 880", "AUX IN", "NO SIGNAL"],
        switches: [true, false, true, false],
        hornPressed: false
    });

    const palette = {
        skyTop: '#1a1025',
        skyBot: '#5d3e68',
        sun: '#ff7755',
        mountain: '#2a1a35',
        dashBase: '#141414',
        dashMid: '#1f1f1f',
        dashLight: '#2a2a2a',
        dashHighlight: '#444',
        consoleBg: '#0a0a0a',
        screenBg: '#001100',
        screenLine: '#00ff44',
        screenText: '#ccffcc',
        screenWall: '#ff3333',
        radioText: '#ffaa00',
        btnRed: '#aa2222',
        btnRedLit: '#ff4444',
        btnRedDark: '#661111',
        indicatorOn: '#00ff00',
        indicatorOff: '#224422',
        glovebox: '#181818',
        vent: '#000000',
        obsRock: '#888888',
        obsLog: '#8B4513',
        obsPuddle: '#4444ff',
        obsHole: '#111111',
        obsCone: '#ff6600',
        obsOil: '#aa00aa'
    };

    // Random route generator with improved algorithm - no intersections
    const generateRoute = (length = 4000, difficulty = 1) => {
        const points: Array<{x: number, y: number, curve: number, angle: number, obstacle: number}> = [];
        let cx = 0;
        let cy = 0;
        let angle = 0;
        let lastAngle = 0;
        
        // Random seed-like behavior using simple math
        let seed = Math.random() * 1000;

        for (let i = 0; i < length; i++) {
            // Perlin-ish noise for smooth curves - reduced amplitude to prevent intersections
            const noise1 = Math.sin((i + seed) * 0.02);
            const noise2 = Math.sin((i + seed) * 0.005);
            // Reduced curve strength to prevent self-intersections
            let curve = (noise1 * 0.2 + noise2 * 0.3) * difficulty;
            
            // Smooth angle changes to prevent sharp turns that cause intersections
            angle += curve * 0.05;
            // Clamp angle changes to prevent too sharp turns
            const angleDiff = angle - lastAngle;
            if (Math.abs(angleDiff) > 0.3) {
                angle = lastAngle + (angleDiff > 0 ? 0.3 : -0.3);
            }
            lastAngle = angle;
            
            cx += Math.cos(angle) * 10;
            cy += Math.sin(angle) * 10;

            // Obstacle Logic
            let obstacle = OBSTACLE.NONE;
            // Don't place obstacles at the start (first 100 points)
            if (i > 100 && Math.random() > 0.96) {
                const r = Math.random();
                if (r < 0.16) obstacle = OBSTACLE.ROCK;
                else if (r < 0.33) obstacle = OBSTACLE.LOG;
                else if (r < 0.5) obstacle = OBSTACLE.PUDDLE;
                else if (r < 0.66) obstacle = OBSTACLE.HOLE;
                else if (r < 0.83) obstacle = OBSTACLE.CONE;
                else obstacle = OBSTACLE.OIL;
            }

            points.push({
                x: cx,
                y: cy,
                curve: curve,
                angle: angle,
                obstacle: obstacle
            });
        }
        return points;
    };

    // Generate route on mount and store in ref
    const trackPoints = useRef(generateRoute(5000, 1.2));
    const carPosIndex = useRef(0);
    const timeRef = useRef(0);

    // Update car position index based on actual car position and movement
    // This syncs the GPS view with the actual car movement
    useEffect(() => {
        // Find closest track point to actual car position for procedural track display
        let minDist = Infinity;
        let closestIndex = carPosIndex.current; // Start from current index for efficiency
        
        // Search around current position first (more efficient)
        const searchRange = 200; // Increased search range
        const startIdx = Math.max(0, Math.floor(carPosIndex.current) - searchRange);
        const endIdx = Math.min(trackPoints.current.length, Math.floor(carPosIndex.current) + searchRange);
        
        for(let i = startIdx; i < endIdx; i++) {
            const tp = trackPoints.current[i];
            if (!tp) continue;
            const dist = Math.sqrt(Math.pow(tp.x - carPosition.x, 2) + Math.pow(tp.y - carPosition.z, 2));
            if(dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }
        
        // If not found in search range, do full search (shouldn't happen often)
        if (minDist > 100) {
            for(let i = 0; i < trackPoints.current.length; i++) {
                const tp = trackPoints.current[i];
                if (!tp) continue;
                const dist = Math.sqrt(Math.pow(tp.x - carPosition.x, 2) + Math.pow(tp.y - carPosition.z, 2));
                if(dist < minDist) {
                    minDist = dist;
                    closestIndex = i;
                }
            }
        }
        
        // Smooth interpolation between old and new index to prevent jumping
        const targetIndex = closestIndex;
        const currentIndex = carPosIndex.current;
        const diff = targetIndex - currentIndex;
        
        // If the difference is large, jump immediately (probably respawned or teleported)
        if (Math.abs(diff) > 50) {
            carPosIndex.current = targetIndex;
        } else {
            // Smooth interpolation (0.5 = 50% towards target per update - faster response)
            carPosIndex.current = currentIndex + diff * 0.5;
        }
    }, [carPosition, pathHistory]);

    // Mouse interaction
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const hotspots = {
            radioKnob: { x: 40, y: 265, r: 20 },
            radioFace: { x: 20, y: 240, w: 140, h: 50 },
            switch1: { x: 35, y: 310, w: 20, h: 40 },
            switch2: { x: 70, y: 310, w: 20, h: 40 },
            switch3: { x: 105, y: 310, w: 20, h: 40 },
            switch4: { x: 140, y: 310, w: 20, h: 40 },
            horn: { x: 90, y: 400, r: 35 }
        };

        const getMousePos = (evt: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (evt.clientX - rect.left) * scaleX,
                y: (evt.clientY - rect.top) * scaleY
            };
        };

        const isInsideCircle = (pos: {x: number, y: number}, circle: {x: number, y: number, r: number}) => {
            const dx = pos.x - circle.x;
            const dy = pos.y - circle.y;
            return (dx*dx + dy*dy) <= circle.r * circle.r;
        };

        const isInsideRect = (pos: {x: number, y: number}, rect: {x: number, y: number, w: number, h: number}) => {
            return pos.x >= rect.x && pos.x <= rect.x + rect.w &&
                   pos.y >= rect.y && pos.y <= rect.y + rect.h;
        };

        const handleMouseDown = (e: MouseEvent) => {
            const pos = getMousePos(e);
            let clicked = false;

            if (isInsideCircle(pos, hotspots.horn)) {
                setLocalState(prev => ({ ...prev, hornPressed: true }));
                onHorn(true);
                if (statusTextRef.current) {
                    statusTextRef.current.innerText = "WARNING: HORN ACTIVE";
                    statusTextRef.current.style.color = "red";
                }
                clicked = true;
            }
            else if (isInsideCircle(pos, hotspots.radioKnob)) {
                setLocalState(prev => ({ ...prev, radioOn: !prev.radioOn }));
                if (statusTextRef.current) {
                    statusTextRef.current.innerText = localState.radioOn ? "RADIO: OFF" : "RADIO: ON";
                    statusTextRef.current.style.color = "#444";
                }
                clicked = true;
            }
            else if (localState.radioOn && isInsideRect(pos, hotspots.radioFace)) {
                setLocalState(prev => ({ 
                    ...prev, 
                    stationIndex: (prev.stationIndex + 1) % prev.stations.length 
                }));
                onRadio();
                if (statusTextRef.current) {
                    statusTextRef.current.innerText = "TUNING...";
                }
                clicked = true;
            }
            else if (isInsideRect(pos, hotspots.switch1)) { 
                setLocalState(prev => ({ 
                    ...prev, 
                    switches: prev.switches.map((s, i) => i === 0 ? !s : s)
                }));
                clicked = true; 
            }
            else if (isInsideRect(pos, hotspots.switch2)) { 
                setLocalState(prev => ({ 
                    ...prev, 
                    switches: prev.switches.map((s, i) => i === 1 ? !s : s)
                }));
                clicked = true; 
            }
            else if (isInsideRect(pos, hotspots.switch3)) { 
                setLocalState(prev => ({ 
                    ...prev, 
                    switches: prev.switches.map((s, i) => i === 2 ? !s : s)
                }));
                clicked = true; 
            }
            else if (isInsideRect(pos, hotspots.switch4)) { 
                setLocalState(prev => ({ 
                    ...prev, 
                    switches: prev.switches.map((s, i) => i === 3 ? !s : s)
                }));
                clicked = true; 
            }
        };

        const handleMouseUp = () => {
            if (localState.hornPressed) {
                setLocalState(prev => ({ ...prev, hornPressed: false }));
                onHorn(false);
                if (statusTextRef.current) {
                    statusTextRef.current.innerText = "System: ONLINE";
                    statusTextRef.current.style.color = "#444";
                }
            }
        };

        const handleMouseLeave = () => {
            if (localState.hornPressed) {
                setLocalState(prev => ({ ...prev, hornPressed: false }));
                onHorn(false);
            }
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [localState.radioOn, localState.hornPressed, onHorn, onRadio]);

    // Sync horn state
    useEffect(() => {
        if (!hornActive && localState.hornPressed) {
            setLocalState(prev => ({ ...prev, hornPressed: false }));
        }
    }, [hornActive]);

    // Rendering loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 640;
        canvas.height = 480;

        let animationFrame: number;
        let lastTime = 0;

        const drawRect = (x: number, y: number, w: number, h: number, color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
        };

        const drawBackground = () => {
            let grad = ctx.createLinearGradient(0, 0, 0, 220);
            grad.addColorStop(0, palette.skyTop);
            grad.addColorStop(1, palette.skyBot);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 240);

            ctx.fillStyle = palette.sun;
            ctx.beginPath();
            ctx.arc(450, 200, 30, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = palette.mountain;
            let scroll = timeRef.current * 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 240);
            for(let x=0; x<=640; x+=10) {
                let h = Math.sin((x + scroll)*0.03) * 30 + 20;
                h += Math.sin((x + scroll)*0.1) * 5;
                ctx.lineTo(x, 240-h);
            }
            ctx.lineTo(640, 240);
            ctx.fill();
            
            ctx.fillStyle = palette.dashBase;
            ctx.beginPath();
            ctx.moveTo(580, 0);
            ctx.lineTo(640, 0);
            ctx.lineTo(640, 480);
            ctx.lineTo(550, 240);
            ctx.fill();
        };

        const drawDashboard = () => {
            ctx.fillStyle = palette.dashMid;
            ctx.beginPath();
            ctx.moveTo(0, 480);   
            ctx.lineTo(0, 160);   
            ctx.lineTo(180, 160); 
            ctx.lineTo(640, 240); 
            ctx.lineTo(640, 480); 
            ctx.fill();

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(180, 180, 460, 300);

            ctx.strokeStyle = palette.dashHighlight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 162);
            ctx.lineTo(180, 162);
            ctx.lineTo(640, 242);
            ctx.stroke();

            const gX = 420; const gY = 320; const gW = 180; const gH = 100;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(gX, gY, gW, gH);
            
            ctx.fillStyle = '#111';
            ctx.fillRect(gX + gW/2 - 20, gY + 15, 40, 10);
            ctx.fillStyle = '#333';
            ctx.fillRect(gX + gW/2 - 5, gY + 18, 10, 4);

            const vX = 580; const vY = 260;
            ctx.fillStyle = palette.vent;
            ctx.fillRect(vX, vY, 40, 30);
            ctx.strokeStyle = '#333';
            for(let i=0; i<3; i++) {
                ctx.beginPath(); ctx.moveTo(vX, vY+5+i*8); ctx.lineTo(vX+40, vY+5+i*8); ctx.stroke();
            }
            ctx.strokeStyle = palette.dashHighlight;
            ctx.strokeRect(vX, vY, 40, 30);
        };

        const drawCenterConsole = () => {
            ctx.fillStyle = palette.consoleBg;
            ctx.fillRect(0, 160, 180, 320);
            ctx.strokeStyle = '#333';
            ctx.beginPath(); ctx.moveTo(180, 160); ctx.lineTo(180, 480); ctx.stroke();

            ctx.fillStyle = palette.vent;
            ctx.fillRect(20, 180, 60, 30);
            ctx.fillRect(90, 180, 60, 30);
            ctx.strokeStyle = '#222';
            for(let i=0; i<3; i++) {
                ctx.beginPath(); ctx.moveTo(20, 185+i*8); ctx.lineTo(80, 185+i*8); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(90, 185+i*8); ctx.lineTo(150, 185+i*8); ctx.stroke();
            }

            const rX = 20; const rY = 240;
            ctx.fillStyle = '#111';
            ctx.fillRect(rX, rY, 140, 50);
            
            if (localState.radioOn) {
                ctx.fillStyle = '#221100';
                ctx.fillRect(rX+40, rY+10, 90, 30);
                ctx.fillStyle = palette.radioText;
                ctx.font = '10px monospace';
                ctx.fillText(localState.stations[localState.stationIndex], rX+45, rY+28);
            } else {
                ctx.fillStyle = '#0a0500';
                ctx.fillRect(rX+40, rY+10, 90, 30);
            }

            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(rX+20, rY+25, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#111';
            let knobAngle = localState.radioOn ? timeRef.current * 0.1 : -0.5;
            let kx = (rX+20) + Math.cos(knobAngle)*8;
            let ky = (rY+25) + Math.sin(knobAngle)*8;
            ctx.beginPath(); ctx.arc(kx, ky, 3, 0, Math.PI*2); ctx.fill();

            const sX = 20; const sY = 310;
            ctx.fillStyle = '#222';
            ctx.fillRect(sX, sY, 140, 40);
            
            for(let i=0; i<4; i++) {
                let on = localState.switches[i];
                let swX = sX + 15 + (i*35);
                ctx.fillStyle = '#666'; ctx.font = '8px sans-serif'; ctx.fillText("SW"+(i+1), swX-5, sY+35);
                ctx.fillStyle = '#111'; ctx.fillRect(swX, sY+5, 10, 20);
                ctx.fillStyle = on ? palette.indicatorOn : palette.indicatorOff;
                ctx.fillRect(swX+2, sY + (on?5:15), 6, 10);
            }

            const bX = 50; const bY = 380;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(bX-10, bY-10, 100, 60);
            ctx.strokeStyle = '#444';
            ctx.strokeRect(bX-10, bY-10, 100, 60);

            let pressOffset = localState.hornPressed ? 2 : 0;
            let color = localState.hornPressed ? palette.btnRedLit : palette.btnRed;
            let topColor = localState.hornPressed ? palette.btnRedLit : palette.btnRedLit;

            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(bX+40, bY+20, 25, 0, Math.PI*2); ctx.fill();
            
            if (!localState.hornPressed) {
                ctx.fillStyle = topColor;
                ctx.beginPath(); ctx.arc(bX+40, bY+18, 20, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = palette.btnRedDark;
                ctx.beginPath(); ctx.arc(bX+40, bY+20, 20, 0, Math.PI*2); ctx.fill();
            }
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText("HORN", bX+40, bY+21 + pressOffset);
            ctx.textAlign = 'left';
        };

        const drawGPS = () => {
            // Use latest car position from props (captured in closure)
            const currentCarPos = {
                x: carPosition.x,
                y: carPosition.z,
                angle: carPosition.angle
            };
            
            const gx = 130; const gy = 80; const gw = 420; const gh = 340;

            ctx.fillStyle = '#111';
            ctx.fillRect(gx+80, gy+gh, 180, 20);
            ctx.beginPath(); ctx.moveTo(gx+100, gy+gh); ctx.lineTo(gx+100, gy+gh-20); ctx.lineTo(gx+240, gy+gh-20); ctx.lineTo(gx+240, gy+gh); ctx.fill();

            ctx.fillStyle = '#181818';
            drawRect(gx, gy, gw, gh, '#181818');
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(gx, gy, gw, gh);
            
            ctx.fillStyle = '#333';
            for(let i=0; i<4; i++) { ctx.fillRect(gx + gw - 20, gy + 30 + (i*50), 10, 30); }

            const sx = gx + 15; const sy = gy + 15; const sw = gw - 40; const sh = gh - 30;

            ctx.save();
            ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();

            ctx.fillStyle = palette.screenBg;
            ctx.fillRect(sx, sy, sw, sh);
            
            ctx.strokeStyle = '#003300';
            ctx.lineWidth = 1;
            for(let i=0; i<sw; i+=40) { ctx.beginPath(); ctx.moveTo(sx+i, sy); ctx.lineTo(sx+i, sy+sh); ctx.stroke(); }
            for(let i=0; i<sh; i+=40) { ctx.beginPath(); ctx.moveTo(sx, sy+i); ctx.lineTo(sx+sw, sy+i); ctx.stroke(); }

            const viewCX = sx + sw/2;
            const viewCY = sy + sh * 0.75;
            
            // Use actual car position directly
            const carP = {
                x: currentCarPos.x,
                y: currentCarPos.z
            };
            
            // Use actual car angle for heading
            let heading: number;
            if (currentCarPos.angle !== undefined && !isNaN(currentCarPos.angle)) {
                // Use actual car angle (convert from game angle to map angle)
                heading = currentCarPos.angle + Math.PI/2;
            } else {
                // Fallback: use direction from pathHistory if available
                if (pathHistory.length >= 2) {
                    const last = pathHistory[pathHistory.length - 1];
                    const prev = pathHistory[pathHistory.length - 2];
                    heading = Math.atan2(last.z - prev.z, last.x - prev.x) + Math.PI/2;
                } else {
                    heading = 0;
                }
            }

            // Center the view on the car and rotate to match car heading
            ctx.translate(viewCX, viewCY);
            ctx.rotate(-heading);
            // Translate to center car at origin (0,0) in rotated space
            ctx.translate(-carP.x, -carP.y);

            // Draw the actual game track (oval circuit) around car position
            const centerX = 100;
            const centerZ = 100;
            const radiusX = 80;
            const radiusZ = 60;
            const roadWidth = 15;
            
            // Draw outer wall (red)
            ctx.strokeStyle = palette.screenWall;
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
                const x = centerX + (radiusX + roadWidth) * Math.cos(angle);
                const y = centerZ + (radiusZ + roadWidth) * Math.sin(angle);
                if (angle === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Draw inner wall (green/yellow)
            ctx.strokeStyle = palette.screenLine;
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
                const x = centerX + (radiusX - roadWidth) * Math.cos(angle);
                const y = centerZ + (radiusZ - roadWidth) * Math.sin(angle);
                if (angle === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            
            // Draw center line (dashed)
            ctx.strokeStyle = '#335533';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
                const x = centerX + radiusX * Math.cos(angle);
                const y = centerZ + radiusZ * Math.sin(angle);
                if (angle === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw path history (where car has been)
            if (pathHistory.length >= 2) {
                ctx.strokeStyle = '#00ff4444';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(pathHistory[0].x, pathHistory[0].z);
                for (let i = 1; i < pathHistory.length; i++) {
                    ctx.lineTo(pathHistory[i].x, pathHistory[i].z);
                }
                ctx.stroke();
            }
            
            // Draw traps from game state
            if (traps && traps.length > 0) {
                ctx.fillStyle = '#ff0000';
                traps.forEach(trap => {
                    const dist = Math.sqrt(Math.pow(trap.x - carP.x, 2) + Math.pow(trap.z - carP.y, 2));
                    if (dist < 200) { // Only draw nearby traps
                        ctx.beginPath();
                        ctx.arc(trap.x, trap.z, trap.radius || 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
            }
            
            // Draw car position indicator (white triangle)
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(carP.x, carP.y - 8);
            ctx.lineTo(carP.x - 6, carP.y + 6);
            ctx.lineTo(carP.x + 6, carP.y + 6);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();

            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(viewCX, viewCY - 8); ctx.lineTo(viewCX - 6, viewCY + 6); ctx.lineTo(viewCX + 6, viewCY + 6); ctx.fill();

            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(sx, sy, sw, 25);
            ctx.fillStyle = palette.screenText;
            ctx.font = '10px monospace';
            const distToFinish = Math.sqrt(
                Math.pow(endPoint.x - carPosition.x, 2) + 
                Math.pow(endPoint.z - carPosition.z, 2)
            );
            ctx.fillText("DIST: " + Math.floor(distToFinish).toFixed(0) + "m", sx + 5, sy + 15);
            // Display speed in km/h (speed is 0-100, convert to 0-1000 km/h for display)
            const speedKmh = Math.floor(speed * 10);
            ctx.fillText("SPD: " + speedKmh, sx + sw - 50, sy + 15);

            // Calculate upcoming curve based on pathHistory direction changes
            let upcomingCurve = 0;
            if (pathHistory.length >= 3) {
                // Use recent path history to determine curve
                const recent = pathHistory.slice(-10);
                for (let i = 1; i < recent.length - 1; i++) {
                    const prev = recent[i - 1];
                    const curr = recent[i];
                    const next = recent[i + 1];
                    const angle1 = Math.atan2(curr.z - prev.z, curr.x - prev.x);
                    const angle2 = Math.atan2(next.z - curr.z, next.x - curr.x);
                    let angleDiff = angle2 - angle1;
                    // Normalize angle difference to -PI to PI
                    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                    upcomingCurve += angleDiff;
                }
                upcomingCurve /= (recent.length - 2);
            }

            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            if(upcomingCurve > 0.4) {
                ctx.fillStyle = palette.screenWall; ctx.fillText(">> R4", viewCX, sy + sh - 20);
            } else if(upcomingCurve < -0.4) {
                ctx.fillStyle = palette.screenWall; ctx.fillText("L4 <<", viewCX, sy + sh - 20);
            } else {
                ctx.fillStyle = '#558855'; ctx.font = '14px monospace'; ctx.fillText("POS CHECK", viewCX, sy + sh - 20);
            }
            ctx.textAlign = 'left';

            ctx.fillStyle = '#0f0';
            ctx.fillRect(sx + 5, sy + sh - 5, 4, 4);
        };

        const drawPeripheralDriver = () => {
            ctx.fillStyle = '#223344';
            ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(0, 200); ctx.quadraticCurveTo(50, 220, 80, 400); ctx.lineTo(40, 480); ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(20, 250); ctx.lineTo(50, 400); ctx.stroke();
            ctx.setLineDash([]);
        };

        const loop = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            timeRef.current += 0.05;
            // Don't update carPosIndex here - it's updated by useEffect based on actual car position
            // This ensures the GPS map follows the real car movement, not a simulated one
            if(carPosIndex.current >= trackPoints.current.length - 10) carPosIndex.current = 0;

            ctx.clearRect(0, 0, 640, 480);
            
            drawBackground();
            drawPeripheralDriver();
            drawDashboard();
            drawCenterConsole();
            drawGPS();
            
            if(localState.hornPressed) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
                ctx.fillRect(0,0,640,480);
            }

            animationFrame = requestAnimationFrame(loop);
        };

        animationFrame = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [carPosition, speed, localState, endPoint, pathHistory, traps]);

    return (
        <div style={{ 
            margin: 0, 
            backgroundColor: '#050505', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh', 
            overflow: 'hidden',
            fontFamily: "'Courier New', Courier, monospace",
            userSelect: 'none',
            WebkitUserSelect: 'none'
        }}>
            <div style={{
                position: 'relative',
                boxShadow: '0 0 60px rgba(0,0,0,1)',
                border: '2px solid #333',
                background: '#000',
                cursor: 'crosshair'
            }}>
                <canvas 
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        imageRendering: 'pixelated',
                        imageRendering: 'crisp-edges',
                        width: '960px',
                        height: '720px'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%)',
                    backgroundSize: '100% 4px',
                    pointerEvents: 'none',
                    zIndex: 10
                }} />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at 50% 30%, rgba(200,100,50,0.1) 0%, rgba(0,0,0,0.6) 90%)',
                    pointerEvents: 'none',
                    zIndex: 11
                }} />
                <div 
                    ref={statusTextRef}
                    style={{
                        position: 'absolute',
                        bottom: 20,
                        right: 20,
                        color: '#444',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        pointerEvents: 'none',
                        zIndex: 12
                    }}
                >
                    System: ONLINE
                </div>
            </div>
        </div>
    );
};
