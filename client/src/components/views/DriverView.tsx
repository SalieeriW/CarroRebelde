import { useEffect, useRef } from 'react';

interface DriverViewProps {
    steeringValue: number;
    onSteer: (value: number) => void;
    onAccelerate: (active: boolean) => void;
    controlsInverted: boolean;
    speed: number;
    turboActive: boolean;
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
}

export const DriverView = ({ steeringValue, onSteer, onAccelerate, controlsInverted, speed, turboActive }: DriverViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef({
        time: 0,
        physics: {
            speed: 0,
            rpm: 0,
            curve: 0,
            maxSpeed: 100, // Increased to match server max speed
            accel: 0.1,
            decel: 0.05,
            turnSpeed: 0.05,
            maxCurve: 1.5,
            curveDecay: 0.03
        },
        keys: {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        },
        scenery: [] as any[]
    });

    // Extended 16-bit Palette
    const palette = {
        skyTop: '#2a1d3d',
        skyMid: '#593a59',
        skyBot: '#9e626e',
        sun: '#ffcc33',
        cloudLight: '#e0d8e8',
        cloudShadow: '#8f839e',
        mountainFar: '#221133',
        mountainNear: '#442244',
        grassLight: '#2d4d22',
        grassDark: '#1e3316',
        road: '#1a1a1a',
        roadShoulder: '#3a2a1a',
        roadLine: '#dcb938',
        dashBase: '#050505',
        gaugeBg: '#050505',
        gaugeBorder: '#555555',
        needle: '#e63946',
        radioText: '#44ff44',
        wheel: '#111111',
        wheelGrip: '#1a1a1a',
        skin: '#eebb99',
        skinShadow: '#cfa07a',
        sleeve: '#6688aa',
        sleeveShadow: '#446688',
        leatherStitch: '#333333'
    };

    // Initialize scenery
    useEffect(() => {
        const scenery = [];
        for(let i=0; i<30; i++) {
            scenery.push({
                type: Math.random() > 0.85 ? 'pole' : (Math.random() > 0.5 ? 'tree' : 'bush'),
                z: Math.random() * 100,
                side: Math.random() > 0.5 ? -1 : 1
            });
        }
        gameStateRef.current.scenery = scenery;
    }, []);

    // Input handling
    useEffect(() => {
        let accelerateInterval: ReturnType<typeof setInterval> | null = null;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                onSteer(controlsInverted ? 1 : -1);
                gameStateRef.current.keys.ArrowLeft = true;
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                onSteer(controlsInverted ? -1 : 1);
                gameStateRef.current.keys.ArrowRight = true;
            } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                if (!accelerateInterval) {
                    onAccelerate(true);
                    // Keep sending accelerate message while key is held
                    accelerateInterval = setInterval(() => {
                        onAccelerate(true);
                    }, 50); // Send every 50ms
                }
                gameStateRef.current.keys.ArrowUp = true;
            } else if (e.key === "ArrowDown") {
                gameStateRef.current.keys.ArrowDown = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                onSteer(0);
                gameStateRef.current.keys.ArrowLeft = false;
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                onSteer(0);
                gameStateRef.current.keys.ArrowRight = false;
            } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                if (accelerateInterval) {
                    clearInterval(accelerateInterval);
                    accelerateInterval = null;
                }
                onAccelerate(false);
                gameStateRef.current.keys.ArrowUp = false;
            } else if (e.key === "ArrowDown") {
                gameStateRef.current.keys.ArrowDown = false;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            if (accelerateInterval) {
                clearInterval(accelerateInterval);
            }
        };
    }, [onSteer, onAccelerate, controlsInverted]);

    // Update physics from game state with smooth transitions
    useEffect(() => {
        const physics = gameStateRef.current.physics;
        // Map game speed (0-100) to physics speed (0-100) with smooth transition
        const targetSpeed = Math.min(speed, physics.maxSpeed);
        physics.speed += (targetSpeed - physics.speed) * 0.1; // Smooth interpolation
        
        // Map steering value (-1 to 1) to curve with smooth transition
        const targetCurve = steeringValue * physics.maxCurve;
        physics.curve += (targetCurve - physics.curve) * 0.15; // Smooth steering transition
        
        // RPM based on speed
        const targetRpm = 0.1 + (physics.speed / physics.maxSpeed) * 0.8;
        if (speed > 0.1) physics.rpm += 0.1;
        physics.rpm += (targetRpm - physics.rpm) * 0.1; // Smooth RPM transition
        physics.rpm = Math.min(physics.rpm, 1.0);
    }, [speed, steeringValue]);

    // Drawing functions
    const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    };

    const drawPixelCloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) => {
        let w = 40 * scale;
        let h = 15 * scale;
        
        ctx.fillStyle = palette.cloudLight;
        drawRect(ctx, cx - w, cy, w*2, h, palette.cloudLight);
        drawRect(ctx, cx - w*0.6, cy - h*0.6, w*0.5, h, palette.cloudLight);
        drawRect(ctx, cx + w*0.1, cy - h*0.8, w*0.6, h, palette.cloudLight);
        drawRect(ctx, cx - w + 5, cy + h - 5, w*2 - 10, 5, palette.cloudShadow);
    };

    const drawSky = (ctx: CanvasRenderingContext2D, time: number, curve: number) => {
        const horizon = 240;
        
        let grad = ctx.createLinearGradient(0, 0, 0, horizon);
        grad.addColorStop(0, palette.skyTop);
        grad.addColorStop(0.4, palette.skyMid);
        grad.addColorStop(1, palette.skyBot);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, horizon);

        let sunX = 320 + (curve * 20);
        ctx.fillStyle = palette.sun;
        ctx.beginPath();
        ctx.arc(sunX, 180, 40, 0, Math.PI*2);
        ctx.fill();
        
        for(let i=0; i<5; i++) {
            let speedOffset = (time * 0.2); 
            let curveOffset = (curve * 100);
            let cx = ((i * 180) + speedOffset + curveOffset) % 800 - 100;
            let cy = 50 + (i * 20) + Math.sin(i)*10;
            let scale = 1 + (i*0.2);
            drawPixelCloud(ctx, cx, cy, scale);
        }
    };

    const drawMountains = (ctx: CanvasRenderingContext2D, time: number, curve: number) => {
        const horizon = 240;
        
        ctx.fillStyle = palette.mountainFar;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        let offsetFar = (time * 0.1) + (curve * 50);
        for(let x=0; x<=640; x+=10) {
            let n = Math.sin((x + offsetFar) * 0.02) * 40 + Math.sin((x + offsetFar)*0.08)*10;
            ctx.lineTo(x, horizon - 50 - n);
        }
        ctx.lineTo(640, horizon);
        ctx.fill();

        ctx.fillStyle = palette.mountainNear;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        let offsetNear = (time * 0.3) + (curve * 150);
        for(let x=0; x<=640; x+=20) {
            let n = Math.sin((x + offsetNear) * 0.03) * 30 + Math.random()*5;
            ctx.lineTo(x, horizon - 20 - n);
        }
        ctx.lineTo(640, horizon);
        ctx.fill();
    };

    const drawRoad = (ctx: CanvasRenderingContext2D, time: number, curve: number, speed: number) => {
        const horizon = 240;
        const bottom = 480;
        const centerX = 320;

        ctx.fillStyle = palette.grassLight;
        ctx.fillRect(0, horizon, 640, 240);

        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        if (Math.floor(time) % 2 === 0) {
             ctx.fillRect(0, horizon, 640, 240);
        }

        const numStrips = 240;
        const step = 2;
        
        let prevY = horizon;
        let prevW = 10;
        let prevCurveX = curve * 300;
        let prevX = centerX + prevCurveX;

        for(let i=step; i<=numStrips; i+=step) {
             let y = horizon + i;
             let p = i / 240;
             
             let w = 10 + (p * 630);
             let curveX = curve * 300 * Math.pow(1-p, 2);
             let x = centerX + curveX;

             ctx.fillStyle = palette.road;
             ctx.beginPath();
             ctx.moveTo(prevX - prevW/2, prevY);
             ctx.lineTo(prevX + prevW/2, prevY);
             ctx.lineTo(x + w/2, y);
             ctx.lineTo(x - w/2, y);
             ctx.fill();
             
             ctx.fillStyle = palette.roadShoulder;
             ctx.beginPath();
             ctx.moveTo(prevX - prevW/2 - 20, prevY);
             ctx.lineTo(prevX - prevW/2, prevY);
             ctx.lineTo(x - w/2, y);
             ctx.lineTo(x - w/2 - 20, y);
             ctx.fill();
             
             ctx.beginPath();
             ctx.moveTo(prevX + prevW/2, prevY);
             ctx.lineTo(prevX + prevW/2 + 20, prevY);
             ctx.lineTo(x + w/2 + 20, y);
             ctx.lineTo(x + w/2, y);
             ctx.fill();

             prevX = x;
             prevW = w;
             prevY = y;
        }

        const stripes = 12;
        for(let i=0; i<stripes; i++) {
            let z = (time * speed * 0.5 + i * (100/stripes)) % 100;
            let p = z / 100; 
            let renderP = p; 
            
            let screenY = horizon + (renderP * renderP * (bottom - horizon));
            
            if(screenY > horizon && screenY < bottom) {
                 let curveP = (screenY - horizon) / (bottom - horizon);
                 let curveX = curve * 300 * Math.pow(1-curveP, 2);
                 let x = centerX + curveX;
                 
                 let w = 2 + renderP * 20;
                 drawRect(ctx, x - w/2, screenY, w, 4 + renderP*10, palette.roadLine);
            }
        }
    };

    const drawScenery = (ctx: CanvasRenderingContext2D, curve: number, speed: number) => {
        const scenery = gameStateRef.current.scenery;
        scenery.sort((a, b) => b.z - a.z);
        
        scenery.forEach(obj => {
            obj.z -= speed * 0.1;
            
            if(obj.z <= 0) {
                obj.z = 100;
                obj.side = Math.random() > 0.5 ? -1 : 1;
                obj.type = Math.random() > 0.85 ? 'pole' : (Math.random() > 0.5 ? 'tree' : 'bush');
            }

            let p = (100 - obj.z) / 100;
            let y = 240 + (p * p * 240);
            
            let curveX = curve * 300 * Math.pow(1-p, 2);
            let xCenter = 320 + curveX;
            
            let spread = 40 + (p * p * 600);
            let turnShift = curve * 200 * p;

            let x = xCenter + (obj.side * spread) - turnShift;
            let scale = p * p * 3.5;

            if(obj.z < 98 && scale > 0.05) {
                if(obj.type === 'tree') drawObjTree(ctx, x, y, scale);
                else if(obj.type === 'bush') drawObjBush(ctx, x, y, scale);
                else drawObjPole(ctx, x, y, scale);
            }
        });
    };

    const drawObjTree = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
        let w = 40 * s;
        let h = 80 * s;
        drawRect(ctx, x - w*0.15, y - h, w*0.3, h, '#3e2723');
        ctx.fillStyle = '#1b5e20';
        for(let i=0; i<3; i++) {
            let size = w * (1 - i*0.2);
            let ly = (y - h*0.4) - (i * h * 0.3);
            ctx.beginPath();
            ctx.moveTo(x - size, ly);
            ctx.lineTo(x + size, ly);
            ctx.lineTo(x, ly - h*0.5);
            ctx.fill();
        }
    };

    const drawObjBush = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
        let w = 30 * s;
        let h = 20 * s;
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.ellipse(x, y-h/2, w, h, 0, Math.PI, 0); 
        ctx.fill();
        if (s > 0.5) {
            ctx.fillStyle = '#ef5350';
            drawRect(ctx, x - w*0.5, y - h*0.8, 4*s, 4*s, '#ef5350');
            drawRect(ctx, x + w*0.3, y - h*0.6, 4*s, 4*s, '#ef5350');
        }
    };

    const drawObjPole = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
        let w = 8 * s;
        let h = 100 * s;
        drawRect(ctx, x - w/2, y - h, w, h, '#78909c');
        drawRect(ctx, x - w, y - h, w*4, 4*s, '#78909c');
        ctx.fillStyle = '#fff9c4';
        ctx.fillRect(x + w, y - h + 4*s, 3*s, 3*s);
    };

    const drawClusterHousing = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        ctx.fillStyle = '#080808';
        ctx.beginPath();
        ctx.arc(x, y, 75, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.stroke();
    };

    const drawGauge = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, val: number, label: string) => {
        ctx.fillStyle = palette.gaugeBg;
        ctx.beginPath();
        ctx.arc(x, y, r-4, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for(let i=0; i<=10; i++) {
            let angle = Math.PI*0.8 + (i/10) * (Math.PI*1.4);
            let len = i % 5 === 0 ? 10 : 5;
            let tx = x + Math.cos(angle) * (r - len - 5);
            let ty = y + Math.sin(angle) * (r - len - 5);
            let ox = x + Math.cos(angle) * (r - 5);
            let oy = y + Math.sin(angle) * (r - 5);
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
        }

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(label, x - 15, y + r/2);

        let angle = Math.PI*0.8 + val * (Math.PI*1.4);
        
        ctx.strokeStyle = palette.needle;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle)*(r-10), y + Math.sin(angle)*(r-10));
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI*2);
        ctx.fill();
    };

    const drawDashboard = (ctx: CanvasRenderingContext2D, rpm: number, gameSpeed: number) => {
        const height = 480;
        const dashTop = 320;

        ctx.fillStyle = palette.dashBase;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, dashTop);
        ctx.bezierCurveTo(100, dashTop - 20, 220, dashTop - 10, 320, dashTop);
        ctx.bezierCurveTo(420, dashTop - 10, 540, dashTop - 20, 640, dashTop);
        ctx.lineTo(640, height);
        ctx.fill();

        ctx.strokeStyle = palette.leatherStitch;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, dashTop + 10);
        ctx.bezierCurveTo(100, dashTop - 10, 220, dashTop, 320, dashTop + 10);
        ctx.bezierCurveTo(420, dashTop, 540, dashTop - 10, 640, dashTop + 10);
        ctx.stroke();
        ctx.setLineDash([]); 

        drawClusterHousing(ctx, 140, 390);
        drawClusterHousing(ctx, 500, 390);

        // Use game speed for gauge (0-100 from server, display as 0-1000 km/h)
        let speedVal = gameSpeed / 100; // Normalize to 0-1 (max speed is 100)
        drawGauge(ctx, 140, 390, 70, speedVal, "SPEED");
        drawGauge(ctx, 500, 390, 70, rpm, "RPM");

        // Display actual speed number
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        const speedKmh = Math.floor(gameSpeed * 10); // Convert to km/h (game speed 0-100 -> 0-1000 km/h)
        ctx.fillText(`${speedKmh}`, 140, 390 + 50);
        ctx.font = '10px monospace';
        ctx.fillText('KM/H', 140, 390 + 65);

        const cx = 320;
        const cy = 420;
        
        drawRect(ctx, cx - 30, cy, 60, 20, '#000');
        ctx.fillStyle = palette.radioText;
        ctx.font = '10px monospace';
        const radioText = turboActive ? 'TURBO 88.8' : 'RADIO 88.8';
        ctx.fillText(radioText, cx - 28, cy + 14);
    };

    const drawWheel = (ctx: CanvasRenderingContext2D, curve: number, rpm: number, time: number) => {
        const cx = 320;
        const cy = 400; 
        const r = 90;

        ctx.save();
        ctx.translate(cx, cy);
        
        let rot = curve * 1.5;
        let vibe = (rpm > 0.1) ? Math.sin(time) * 1 : 0;
        ctx.rotate(rot + vibe * 0.005);

        ctx.lineWidth = 18;
        ctx.strokeStyle = palette.wheel;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.lineWidth = 14;
        ctx.strokeStyle = palette.wheelGrip;
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI*1.1, Math.PI*1.9); 
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI*0.1, Math.PI*0.9);
        ctx.stroke();

        ctx.fillStyle = palette.wheel;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI*2);
        ctx.fill();

        for(let i=0; i<3; i++) {
            ctx.save();
            ctx.rotate(i * (Math.PI * 2 / 3) + Math.PI/2);
            ctx.fillRect(-10, 0, 20, r-5);
            ctx.restore();
        }

        ctx.fillStyle = '#d4af37'; 
        ctx.fillRect(-5, -5, 10, 10);

        ctx.restore();
    };

    const drawHands = (ctx: CanvasRenderingContext2D, curve: number) => {
        const cx = 320;
        const cy = 400;
        const r = 85;
        
        let rot = curve * 1.5;
        
        let leftAngle = Math.PI - 0.5 + rot;
        let rightAngle = 0 - 0.5 + rot;

        let lx = cx + Math.cos(leftAngle) * r;
        let ly = cy + Math.sin(leftAngle) * r;
        
        let rx = cx + Math.cos(rightAngle) * r;
        let ry = cy + Math.sin(rightAngle) * r;

        drawHandArm(ctx, lx, ly, -1);
        drawHandArm(ctx, rx, ry, 1);
    };

    const drawHandArm = (ctx: CanvasRenderingContext2D, x: number, y: number, side: number) => {
        ctx.fillStyle = palette.sleeve;
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        if(side === -1) {
            ctx.lineTo(0, 480);
            ctx.lineTo(100, 480);
        } else {
            ctx.lineTo(640, 480);
            ctx.lineTo(540, 480);
        }
        ctx.lineTo(x + (side*20), y + 20);
        ctx.fill();

        ctx.fillStyle = palette.skin;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(gameStateRef.current.physics.curve);
        drawRect(ctx, -15, -15, 30, 30, palette.skin);
        
        ctx.fillStyle = palette.skinShadow;
        drawRect(ctx, -10, -10, 8, 20, palette.skinShadow);
        drawRect(ctx, 2, -10, 8, 20, palette.skinShadow);
        ctx.restore();
    };

    const drawRearViewMirror = (ctx: CanvasRenderingContext2D, curve: number) => {
        const mx = 270, my = 40, mw = 100, mh = 30;
        
        ctx.fillStyle = '#111';
        ctx.fillRect(mx, my, mw, mh);
        
        drawRect(ctx, mx + mw/2 - 5, 0, 10, my, '#222');

        ctx.save();
        ctx.beginPath();
        ctx.rect(mx+4, my+4, mw-8, mh-8);
        ctx.clip();

        ctx.fillStyle = palette.skyTop;
        ctx.fillRect(mx, my, mw, mh);
        
        let mirrorCurve = -curve * 10;
        
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(mx + mw/2 + mirrorCurve, my + mh/2);
        ctx.lineTo(mx + mw, my + mh);
        ctx.lineTo(mx, my + mh);
        ctx.fill();

        ctx.restore();
    };

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set internal resolution
        const internalWidth = 640;
        const internalHeight = 480;
        canvas.width = internalWidth;
        canvas.height = internalHeight;

        // Handle resize for responsive fullscreen
        const handleResize = () => {
            const container = canvas.parentElement;
            if (container) {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                
                // Calculate scale to fit container while maintaining aspect ratio
                const scaleX = containerWidth / internalWidth;
                const scaleY = containerHeight / internalHeight;
                const scale = Math.min(scaleX, scaleY);
                
                canvas.style.width = `${internalWidth * scale}px`;
                canvas.style.height = `${internalHeight * scale}px`;
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        let animationFrameId: number;
        let lastTime = performance.now();
        const loop = (currentTime: number) => {
            const state = gameStateRef.current;
            const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
            lastTime = currentTime;
            
            // Use actual game speed for visual movement (speed is 0-100 from server)
            // Use full speed for rendering
            const visualSpeed = Math.min(speed, state.physics.maxSpeed);
            
            // Smooth physics updates every frame
            state.physics.speed += (visualSpeed - state.physics.speed) * 0.1;
            
            const targetCurve = steeringValue * state.physics.maxCurve;
            state.physics.curve += (targetCurve - state.physics.curve) * 0.15;
            
            // RPM based on actual game speed
            const targetRpm = 0.1 + (speed / 100) * 0.8; // Use actual game speed (0-100)
            state.physics.rpm += (targetRpm - state.physics.rpm) * 0.1;
            state.physics.rpm = Math.min(state.physics.rpm, 1.0);
            
            // Update time based on actual game speed for visual movement
            // Use actual speed from server, not interpolated speed
            state.time += speed * deltaTime * 2; // Scale for visual effect

            ctx.clearRect(0, 0, internalWidth, internalHeight);

            drawSky(ctx, state.time, state.physics.curve);
            drawMountains(ctx, state.time, state.physics.curve);
            // Use actual game speed for road movement
            drawRoad(ctx, state.time, state.physics.curve, speed);
            // Use actual game speed for scenery movement
            drawScenery(ctx, state.physics.curve, speed);
            
            // Pass actual game speed to dashboard
            drawDashboard(ctx, state.physics.rpm, speed);
            drawWheel(ctx, state.physics.curve, state.physics.rpm, state.time);
            drawHands(ctx, state.physics.curve);
            drawRearViewMirror(ctx, state.physics.curve);
            
            animationFrameId = requestAnimationFrame(loop);
        };

        lastTime = performance.now();
        loop(performance.now());

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [speed, steeringValue, turboActive]);

    return (
        <div className="pixel-view driver-view" style={{ 
            background: '#050505',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            padding: 0,
            margin: 0
        }}>
            <div className="game-container" style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#000'
            }}>
                <canvas 
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        imageRendering: 'pixelated',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto'
                    }}
                ></canvas>
                <div className="scanlines" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0) 2px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)',
                    pointerEvents: 'none',
                    zIndex: 10
                }}></div>
                <div className="vignette" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)',
                    pointerEvents: 'none',
                    zIndex: 11
                }}></div>
                <div className="instructions" style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: 0,
                    width: '100%',
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '14px',
                    fontFamily: 'Courier New, monospace',
                    pointerEvents: 'none',
                    zIndex: 12,
                    textTransform: 'uppercase',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}>
                    {controlsInverted ? '⚠️ CONTROLS INVERTED' : '← → to steer | ↑ to accelerate'}
                    {turboActive && ' | ⚡ TURBO ACTIVE'}
                </div>
            </div>
        </div>
    );
};
