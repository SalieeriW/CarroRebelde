import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { CarInterior } from '../CarInterior';
import { RoadView } from '../RoadView';
import * as THREE from 'three';

interface DriverViewProps {
    steeringValue: number;
    onSteer: (value: number) => void;
    controlsInverted: boolean;
    speed: number;
}

export const DriverView = ({ steeringValue, onSteer, controlsInverted, speed }: DriverViewProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                onSteer(controlsInverted ? 1 : -1);
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                onSteer(controlsInverted ? -1 : 1);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || 
                e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                onSteer(0);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [onSteer, controlsInverted]);

    const steeringAngle = steeringValue * Math.PI / 3; // Max 60 degrees

    return (
        <div className="pixel-view driver-view">
            <div className="pixel-bg"></div>
            <div className="view-title">DRIVER INTERFACE</div>
            {controlsInverted && (
                <div className="warning-banner">⚠️ CONTROLS INVERTED</div>
            )}
            
            <div className="driver-container">
                <Canvas camera={{ position: [0, 0.8, 1.2], fov: 75 }}>
                    {/* Bright lighting */}
                    <ambientLight intensity={0.8} />
                    <directionalLight position={[5, 10, 5]} intensity={1.2} />
                    <pointLight position={[0, 2, 0]} intensity={0.8} />
                    <spotLight position={[0, 5, 5]} angle={0.5} intensity={1} />
                    
                    {/* Interior (visible but not blocking view) */}
                    <group position={[0, 0, 0]}>
                        <CarInterior 
                            steeringAngle={steeringAngle}
                            speed={speed}
                            viewAngle={0}
                        />
                    </group>
                    
                    {/* Road view through windshield */}
                    <group position={[0, 0.5, 0.8]}>
                        <RoadView speed={speed} carAngle={0} />
                    </group>
                    
                    {/* Windshield frame */}
                    <mesh position={[0, 0.7, 0.5]}>
                        <boxGeometry args={[1.6, 0.15, 0.05]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    
                    <OrbitControls 
                        enabled={false}
                        target={[0, 0.5, 1]}
                    />
                </Canvas>
            </div>

            <div className="control-hint">
                ← → or A D to steer | Speed affects road visibility
            </div>
        </div>
    );
};
