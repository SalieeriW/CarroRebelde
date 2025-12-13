import { useEffect, useRef } from 'react';

interface CopilotViewProps {
    onHorn: (active: boolean) => void;
    onRadio: () => void;
    radioStation: string;
    hornActive: boolean;
    traps: any[];
    carPosition: { x: number; z: number; angle: number };
}

export const CopilotView = ({ onHorn, onRadio, radioStation, hornActive }: CopilotViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 1200;
        canvas.height = 800;

        // Clear background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Dashboard
        ctx.fillStyle = '#333';
        ctx.fillRect(0, centerY + 200, canvas.width, canvas.height - centerY - 200);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, centerY + 200, canvas.width, canvas.height - centerY - 200);

        // Radio (pixel art) - LARGE
        const radioX = centerX - 200;
        const radioY = centerY + 50;
        ctx.fillStyle = '#000';
        ctx.fillRect(radioX, radioY, 400, 200);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 6;
        ctx.strokeRect(radioX, radioY, 400, 200);

        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(radioStation.toUpperCase(), centerX, radioY + 100);

        // Radio label
        ctx.font = 'bold 24px monospace';
        ctx.fillText('RADIO STATION', centerX, radioY + 30);

        // Horn button - LARGE
        const hornX = centerX + 250;
        const hornY = centerY + 50;
        ctx.fillStyle = hornActive ? '#ff0000' : '#444';
        ctx.fillRect(hornX, hornY, 200, 200);
        ctx.strokeStyle = hornActive ? '#ff6666' : '#666';
        ctx.lineWidth = 6;
        ctx.strokeRect(hornX, hornY, 200, 200);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px monospace';
        ctx.fillText('📣', hornX + 100, hornY + 120);
        
        // Horn label
        ctx.font = 'bold 24px monospace';
        ctx.fillText('HORN', hornX + 100, hornY + 30);

        // NO MAP MESSAGE
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO MAP VIEW - RADIO & HORN ONLY', centerX, 100);
    }, [radioStation, hornActive]);

    return (
        <div className="pixel-view copilot-view">
            <div className="pixel-bg"></div>
            <div className="view-title">COPILOT INTERFACE - NO MAP</div>
            
            <div className="copilot-layout">
                <canvas 
                    ref={canvasRef} 
                    className="copilot-interior-canvas"
                    style={{ 
                        imageRendering: 'pixelated',
                        imageRendering: 'crisp-edges',
                        width: '100%',
                        height: '100%'
                    }}
                ></canvas>
            </div>

            <div className="control-hint">
                Press H for HORN | Press R for RADIO | NO MAP VIEW
            </div>
        </div>
    );
};
