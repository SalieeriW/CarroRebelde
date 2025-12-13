import { useEffect, useRef } from 'react';

interface NavigatorViewProps {
    carPosition: { x: number; z: number; angle: number };
    traps: any[];
    challengePortal: { x: number; z: number; active: boolean };
    pathHistory: Array<{ x: number; z: number }>;
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
}

export const NavigatorView = ({ carPosition, traps, challengePortal, pathHistory, startPoint, endPoint }: NavigatorViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = 1400;
        canvas.height = 1400;

        // Clear background
        ctx.fillStyle = '#0f0f1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate view bounds
        const centerX = 100;
        const centerZ = 100;
        const radiusX = 80;
        const radiusZ = 60;
        const roadWidth = 8;
        
        const minX = centerX - radiusX - roadWidth - 20;
        const maxX = centerX + radiusX + roadWidth + 20;
        const minZ = centerZ - radiusZ - roadWidth - 20;
        const maxZ = centerZ + radiusZ + roadWidth + 20;
        
        const mapWidth = maxX - minX;
        const mapHeight = maxZ - minZ;
        const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.9;
        
        const offsetX = (canvas.width - mapWidth * scale) / 2 - minX * scale;
        const offsetZ = (canvas.height - mapHeight * scale) / 2 - minZ * scale;

        const worldToScreen = (wx: number, wz: number) => {
            return {
                x: offsetX + wx * scale,
                y: offsetZ + wz * scale
            };
        };

        // Draw terrain
        ctx.fillStyle = '#1a1a2e';
        for (let x = Math.floor(minX / 20) * 20; x <= maxX; x += 20) {
            for (let z = Math.floor(minZ / 20) * 20; z <= maxZ; z += 20) {
                if ((x + z) % 40 === 0) {
                    const screen = worldToScreen(x, z);
                    ctx.fillRect(screen.x, screen.y, 20 * scale, 20 * scale);
                }
            }
        }

        // Draw grid
        ctx.strokeStyle = '#00ff0022';
        ctx.lineWidth = 1;
        for (let x = Math.floor(minX / 20) * 20; x <= maxX; x += 20) {
            const screen = worldToScreen(x, minZ);
            ctx.beginPath();
            ctx.moveTo(screen.x, 0);
            ctx.lineTo(screen.x, canvas.height);
            ctx.stroke();
        }
        for (let z = Math.floor(minZ / 20) * 20; z <= maxZ; z += 20) {
            const screen = worldToScreen(minX, z);
            ctx.beginPath();
            ctx.moveTo(0, screen.y);
            ctx.lineTo(canvas.width, screen.y);
            ctx.stroke();
        }

        // Draw F1-style circuit road
        const steps = 200;
        const roadPoints: Array<{x: number, z: number, leftWall: {x: number, z: number}, rightWall: {x: number, z: number}}> = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            // Oval circuit
            const x = centerX + Math.sin(t) * radiusX;
            const z = centerZ + Math.cos(t) * radiusZ;
            
            // Calculate perpendicular for walls
            const perpX = -Math.cos(t);
            const perpZ = Math.sin(t);
            
            const leftWall = {
                x: x + perpX * roadWidth,
                z: z + perpZ * roadWidth
            };
            const rightWall = {
                x: x - perpX * roadWidth,
                z: z - perpZ * roadWidth
            };
            
            roadPoints.push({ x, z, leftWall, rightWall });
        }

        // Draw outer walls (red)
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 4;
        ctx.beginPath();
        roadPoints.forEach((point, i) => {
            const screen = worldToScreen(point.leftWall.x, point.leftWall.z);
            if (i === 0) {
                ctx.moveTo(screen.x, screen.y);
            } else {
                ctx.lineTo(screen.x, screen.y);
            }
        });
        ctx.closePath();
        ctx.stroke();

        // Draw inner walls (red)
        ctx.beginPath();
        roadPoints.forEach((point, i) => {
            const screen = worldToScreen(point.rightWall.x, point.rightWall.z);
            if (i === 0) {
                ctx.moveTo(screen.x, screen.y);
            } else {
                ctx.lineTo(screen.x, screen.y);
            }
        });
        ctx.closePath();
        ctx.stroke();

        // Draw road surface (yellow - between walls)
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        roadPoints.forEach((point, i) => {
            const screen = worldToScreen(point.x, point.z);
            if (i === 0) {
                ctx.moveTo(screen.x, screen.y);
            } else {
                ctx.lineTo(screen.x, screen.y);
            }
        });
        ctx.closePath();
        ctx.stroke();
        
        // Draw road center line (white dashed)
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw path traveled
        if (pathHistory.length > 1) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.beginPath();
            pathHistory.forEach((point, i) => {
                const screen = worldToScreen(point.x, point.z);
                if (i === 0) {
                    ctx.moveTo(screen.x, screen.y);
                } else {
                    ctx.lineTo(screen.x, screen.y);
                }
            });
            ctx.stroke();
        }

        // Draw START/FINISH line
        const startScreen = worldToScreen(startPoint.x, startPoint.z);
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 6;
        ctx.beginPath();
        // Draw checkered line
        for (let i = -roadWidth; i <= roadWidth; i += 2) {
            const checkX = startScreen.x + Math.sin(Math.PI / 2) * i * scale;
            const checkZ = startScreen.y + Math.cos(Math.PI / 2) * i * scale;
            ctx.fillStyle = (Math.floor(i / 2) % 2 === 0) ? "#ffffff" : "#000000";
            ctx.fillRect(checkX - 10, checkZ - 20, 20, 40);
        }
        ctx.stroke();
        
        // START/FINISH label
        ctx.fillStyle = "#00ff00";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        ctx.fillText("START/FINISH", startScreen.x, startScreen.y - 30);

        // Draw car
        const carScreen = worldToScreen(carPosition.x, carPosition.z);
        ctx.save();
        ctx.translate(carScreen.x, carScreen.y);
        ctx.rotate(carPosition.angle);
        
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(-12, -18, 24, 36);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.strokeRect(-12, -18, 24, 36);
        ctx.fillStyle = "#0066ff44";
        ctx.fillRect(-10, -15, 20, 12);
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-8, -30);
        ctx.lineTo(8, -30);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw distance to finish
        const distToFinish = Math.sqrt(
            Math.pow(startPoint.x - carPosition.x, 2) + 
            Math.pow(startPoint.z - carPosition.z, 2)
        );
        ctx.fillStyle = "#ffff00";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Distance to FINISH: ${Math.floor(distToFinish)}m`, 20, 40);
        ctx.fillText(`Lap Progress: ${Math.floor((pathHistory.length / 10) % 100)}%`, 20, 65);

        // Draw compass
        const compassX = canvas.width - 100;
        const compassY = 100;
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(compassX, compassY, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(compassX, compassY - 60);
        ctx.lineTo(compassX, compassY - 40);
        ctx.stroke();
        ctx.fillStyle = "#00ffff";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("N", compassX, compassY - 75);
    }, [carPosition, pathHistory, startPoint, endPoint]);

    return (
        <div className="pixel-view navigator-view">
            <div className="pixel-bg"></div>
            <div className="view-title">NAVIGATOR INTERFACE - CIRCUIT MAP</div>
            
            <div className="map-container-large">
                <canvas ref={canvasRef} className="navigator-map-full"></canvas>
                <div className="map-overlay">
                    <div className="map-info">
                        <div className="info-item">
                            <span className="info-label">POSITION:</span>
                            <span className="info-value">{Math.floor(carPosition.x)}, {Math.floor(carPosition.z)}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">HEADING:</span>
                            <span className="info-value">{Math.floor(carPosition.angle * 180 / Math.PI)}°</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="navigation-hint">
                F1 CIRCUIT MAP - Follow the YELLOW ROAD between RED WALLS. If you crash, you'll respawn on the road!
            </div>
        </div>
    );
};
