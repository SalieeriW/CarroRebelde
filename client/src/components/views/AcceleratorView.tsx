import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CarInterior } from '../CarInterior';

interface AcceleratorViewProps {
    speed: number;
    onAccelerate: (active: boolean) => void;
    turboActive: boolean;
}

export const AcceleratorView = ({ speed, onAccelerate, turboActive }: AcceleratorViewProps) => {
    useEffect(() => {
        let accelerateInterval: ReturnType<typeof setInterval> | null = null;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                // Send accelerate message repeatedly while key is held
                if (!accelerateInterval) {
                    onAccelerate(true);
                    accelerateInterval = setInterval(() => {
                        onAccelerate(true);
                    }, 100); // Send every 100ms
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
                // Stop sending accelerate messages
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

    const speedPercent = Math.min(100, (speed / 10) * 100);
    const pedalPressed = speed > 0;

    return (
        <div className="pixel-view accelerator-view">
            <div className="pixel-bg"></div>
            <div className="view-title">ACCELERATOR INTERFACE</div>
            
            {turboActive && (
                <div className="turbo-indicator">⚡ TURBO ACTIVE ⚡</div>
            )}

            <div className="accelerator-layout">
                {/* Interior view */}
                <div className="interior-container">
                    <Canvas camera={{ position: [0, -0.2, 1.5], fov: 75 }}>
                        {/* Bright lighting */}
                        <ambientLight intensity={0.9} />
                        <directionalLight position={[5, 5, 5]} intensity={1.2} />
                        <pointLight position={[0, 0, 0]} intensity={1} />
                        <spotLight position={[0, 2, 2]} angle={0.6} intensity={1.2} />
                        
                        <CarInterior 
                            steeringAngle={0}
                            speed={speed}
                            viewAngle={-0.2}
                        />
                        
                        {/* Pedals - very visible */}
                        <group position={[0, -0.4, 0.3]}>
                            {/* Accelerator Pedal */}
                            <mesh 
                                position={[0.25, pedalPressed ? -0.2 : -0.1, 0]} 
                                rotation={[pedalPressed ? 0.4 : 0, 0, 0]}
                            >
                                <boxGeometry args={[0.2, 0.4, 0.08]} />
                                <meshStandardMaterial 
                                    color={pedalPressed ? "#ff0000" : "#444"} 
                                    emissive={pedalPressed ? "#ff0000" : "#000"}
                                    emissiveIntensity={pedalPressed ? 0.5 : 0}
                                />
                            </mesh>
                            {/* Brake Pedal (disabled, gray) */}
                            <mesh position={[-0.25, -0.1, 0]}>
                                <boxGeometry args={[0.2, 0.4, 0.08]} />
                                <meshStandardMaterial color="#666" />
                            </mesh>
                            {/* Clutch Pedal (disabled, gray) */}
                            <mesh position={[0, -0.1, 0]}>
                                <boxGeometry args={[0.2, 0.4, 0.08]} />
                                <meshStandardMaterial color="#666" />
                            </mesh>
                        </group>
                        
                        <OrbitControls 
                            enabled={false}
                            target={[0, -0.2, 0.3]}
                        />
                    </Canvas>
                </div>

                {/* Speedometer */}
                <div className="speedometer-panel-large">
                    <div className="speedometer">
                        <div className="speed-value-large" style={{ 
                            textShadow: `0 0 ${speedPercent}px #00ffff, 0 0 ${speedPercent * 2}px #00ffff`
                        }}>
                            {Math.floor(speed * 10)}
                        </div>
                        <div className="speed-label">KM/H</div>
                        <div className="speed-bar-large">
                            <div 
                                className="speed-fill" 
                                style={{ 
                                    width: `${speedPercent}%`,
                                    boxShadow: `0 0 ${speedPercent / 2}px #00ffff`
                                }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="control-hint">
                Hold ↑ or W or SPACE to accelerate
            </div>
        </div>
    );
};
