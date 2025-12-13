import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CarInterior } from '../CarInterior';

interface CopilotViewProps {
    onHorn: (active: boolean) => void;
    onRadio: () => void;
    radioStation: string;
    hornActive: boolean;
    traps: any[];
    carPosition: { x: number; z: number; angle: number };
}

export const CopilotView = ({ onHorn, onRadio, radioStation, hornActive, traps, carPosition }: CopilotViewProps) => {
    const mapCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "h" || e.key === "H") {
                onHorn(true);
            } else if (e.key === "r" || e.key === "R") {
                onRadio();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "h" || e.key === "H") {
                onHorn(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [onHorn, onRadio]);

    // Draw map with trap distances
    useEffect(() => {
        const canvas = mapCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 500;
        canvas.height = 500;

        // Clear with lighter background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#00ff0044';
        ctx.lineWidth = 1;
        const gridSize = 25;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 3;

        // Draw car at center - larger and more visible
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(centerX - 12, centerY - 18, 24, 36);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.strokeRect(centerX - 12, centerY - 18, 24, 36);
        
        // Car direction
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 18);
        ctx.lineTo(centerX - 8, centerY - 28);
        ctx.lineTo(centerX + 8, centerY - 28);
        ctx.closePath();
        ctx.fill();

        // Draw traps with distances - only show nearby ones
        traps.forEach((trap) => {
            const x = centerX + (trap.x - carPosition.x) * scale;
            const y = centerY + (trap.z - carPosition.z) * scale;

            // Calculate distance
            const dist = Math.sqrt(
                Math.pow(trap.x - carPosition.x, 2) + 
                Math.pow(trap.z - carPosition.z, 2)
            );

            // Only show if within 60m range
            if (dist < 60) {
                const radius = Math.max(10, trap.radius * scale);
                
                // Trap color by type
                ctx.fillStyle = trap.type === "spike" ? "#ff0000" : 
                               trap.type === "puddle" ? "#0066ff" :
                               trap.type === "spin" ? "#ff00ff" : "#ffff00";
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw distance line
                ctx.strokeStyle = "#ffff00";
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw distance text - large and visible
                ctx.fillStyle = "#ffff00";
                ctx.font = "bold 14px monospace";
                ctx.fillText(`${Math.floor(dist)}m`, x + radius + 8, y);
                
                // Draw trap type icon
                ctx.font = "20px monospace";
                const icon = trap.type === "spike" ? "🦔" : 
                            trap.type === "puddle" ? "💧" :
                            trap.type === "spin" ? "🌀" : "📻";
                ctx.fillText(icon, x, y - radius - 5);
            }
        });
    }, [traps, carPosition]);

    return (
        <div className="pixel-view copilot-view">
            <div className="pixel-bg"></div>
            <div className="view-title">COPILOT INTERFACE</div>
            
            <div className="copilot-layout">
                {/* Left side - Interior */}
                <div className="interior-container-small">
                    <Canvas camera={{ position: [0.4, 0.5, 1.2], fov: 70 }}>
                        {/* Bright lighting */}
                        <ambientLight intensity={0.9} />
                        <directionalLight position={[5, 5, 5]} intensity={1.2} />
                        <pointLight position={[0, 1, 0]} intensity={1} />
                        <spotLight position={[2, 3, 2]} angle={0.5} intensity={1.2} />
                        
                        <CarInterior 
                            steeringAngle={0}
                            speed={0}
                            viewAngle={0.4}
                        />
                        
                        <OrbitControls 
                            enabled={false}
                            target={[0, 0.3, 0.4]}
                        />
                    </Canvas>
                </div>

                {/* Right side - Controls and Map */}
                <div className="copilot-controls-panel">
                    <div className="control-section">
                        <div className="section-title">HORN</div>
                        <button 
                            className={`pixel-button horn-button ${hornActive ? 'active' : ''}`}
                            onMouseDown={() => onHorn(true)}
                            onMouseUp={() => onHorn(false)}
                            onTouchStart={() => onHorn(true)}
                            onTouchEnd={() => onHorn(false)}
                        >
                            📣 HONK
                        </button>
                        <div className="control-hint">Press H</div>
                    </div>

                    <div className="control-section">
                        <div className="section-title">RADIO</div>
                        <div className="radio-display">
                            <div className="radio-station">{radioStation.toUpperCase()}</div>
                            <button 
                                className="pixel-button radio-button"
                                onClick={onRadio}
                            >
                                📻 CHANGE
                            </button>
                        </div>
                        <div className="control-hint">Press R</div>
                    </div>

                    <div className="control-section">
                        <div className="section-title">THREAT MAP</div>
                        <div className="threat-map-container">
                            <canvas ref={mapCanvasRef} className="threat-map"></canvas>
                        </div>
                        <div className="control-hint">Distance to threats (60m range)</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
