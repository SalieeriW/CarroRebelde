import { useEffect, useRef } from 'react';
import { drawCircuitMap } from '../../utils/mapRenderer';

interface AcceleratorViewProps {
    speed: number;
    onAccelerate: (active: boolean) => void;
    turboActive: boolean;
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
}

export const AcceleratorView = ({ speed, onAccelerate, turboActive, carPosition, traps, startPoint, endPoint }: AcceleratorViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let accelerateInterval: ReturnType<typeof setInterval> | null = null;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                if (!accelerateInterval) {
                    onAccelerate(true);
                    accelerateInterval = setInterval(() => {
                        onAccelerate(true);
                    }, 100);
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                if (accelerateInterval) {
                    clearInterval(accelerateInterval);
                    accelerateInterval = null;
                }
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
    }, [onAccelerate]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 1200;
        canvas.height = 800;

        // Limited view: same as driver (only car and a little bit of surroundings)
        const viewRadius = 30;
        const viewBounds = {
            minX: carPosition.x - viewRadius,
            maxX: carPosition.x + viewRadius,
            minZ: carPosition.z - viewRadius,
            maxZ: carPosition.z + viewRadius
        };

        // Draw map with limited view
        drawCircuitMap(
            ctx,
            canvas.width,
            canvas.height,
            carPosition,
            traps,
            { x: 0, z: 0, active: false },
            [],
            startPoint,
            endPoint,
            viewBounds
        );

        // Draw view radius indicator
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.strokeStyle = '#00ffff44';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.min(canvas.width, canvas.height) / 2 - 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Speedometer (large, pixel art)
        const speedoX = centerX;
        const speedoY = 150;
        const speedoRadius = 100;
        const speedPercent = Math.min(100, (speed / 10) * 100);

        // Speedometer background
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(speedoX, speedoY, speedoRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Speedometer needle
        const needleAngle = (speedPercent / 100) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(speedoX, speedoY);
        ctx.lineTo(
            speedoX + Math.cos(needleAngle) * (speedoRadius - 15),
            speedoY + Math.sin(needleAngle) * (speedoRadius - 15)
        );
        ctx.stroke();

        // Speed value
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(speed * 10).toString(), speedoX, speedoY + 15);
        ctx.font = '18px monospace';
        ctx.fillText('KM/H', speedoX, speedoY + 40);

        // Turbo indicator
        if (turboActive) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 36px monospace';
            ctx.fillText('⚡ TURBO ⚡', speedoX, speedoY - speedoRadius - 30);
        }
    }, [speed, turboActive, carPosition, traps, startPoint, endPoint]);

    return (
        <div className="pixel-view accelerator-view">
            <div className="pixel-bg"></div>
            <div className="view-title">ACCELERATOR INTERFACE - PLAN VIEW</div>
            
            {turboActive && (
                <div className="turbo-indicator">⚡ TURBO ACTIVE ⚡</div>
            )}

            <div className="accelerator-layout">
                <canvas 
                    ref={canvasRef} 
                    className="accelerator-canvas"
                    style={{ 
                        imageRendering: 'pixelated'
                    }}
                ></canvas>
            </div>

            <div className="control-hint">
                Hold ↑ or W or SPACE to accelerate | Limited view: same as driver
            </div>
        </div>
    );
};
