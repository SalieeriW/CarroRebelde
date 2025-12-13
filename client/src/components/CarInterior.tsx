import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CarInteriorProps {
    steeringAngle: number;
    speed: number;
    viewAngle?: number; // Camera angle for different views
}

export const CarInterior = ({ steeringAngle, speed, viewAngle = 0 }: CarInteriorProps) => {
    const steeringWheelRef = useRef<THREE.Group>(null);
    const speedometerRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (steeringWheelRef.current) {
            steeringWheelRef.current.rotation.z = steeringAngle * 0.5;
        }
        if (speedometerRef.current) {
            speedometerRef.current.rotation.z = -speed * 0.1;
        }
    });

    return (
        <group>
            {/* Dashboard */}
            <mesh position={[0, 0.3, 0.4]} rotation={[0, 0, 0]}>
                <boxGeometry args={[2, 0.3, 0.1]} />
                <meshStandardMaterial color="#2a2a2a" emissive="#1a1a1a" emissiveIntensity={0.2} />
            </mesh>

            {/* Steering Wheel */}
            <group ref={steeringWheelRef} position={[-0.4, 0.5, 0.5]}>
                <mesh>
                    <torusGeometry args={[0.15, 0.02, 16, 32]} />
                    <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.1} />
                </mesh>
                {/* Wheel spokes */}
                <mesh rotation={[0, 0, 0]}>
                    <boxGeometry args={[0.3, 0.02, 0.02]} />
                    <meshStandardMaterial color="#555" />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 3]}>
                    <boxGeometry args={[0.3, 0.02, 0.02]} />
                    <meshStandardMaterial color="#555" />
                </mesh>
                <mesh rotation={[0, 0, -Math.PI / 3]}>
                    <boxGeometry args={[0.3, 0.02, 0.02]} />
                    <meshStandardMaterial color="#555" />
                </mesh>
                {/* Center */}
                <mesh position={[0, 0, 0]}>
                    <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
            </group>

            {/* Speedometer */}
            <group ref={speedometerRef} position={[0.5, 0.4, 0.45]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.02, 32]} />
                    <meshStandardMaterial color="#1a1a1a" />
                </mesh>
                {/* Needle */}
                <mesh position={[0, 0.06, 0.01]}>
                    <boxGeometry args={[0.01, 0.06, 0.01]} />
                    <meshStandardMaterial color="#ff0000" />
                </mesh>
            </group>

            {/* Seats */}
            <mesh position={[-0.3, -0.2, 0.2]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.4, 0.3, 0.4]} />
                <meshStandardMaterial color="#3a3a3a" emissive="#2a2a2a" emissiveIntensity={0.1} />
            </mesh>
            <mesh position={[0.3, -0.2, 0.2]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.4, 0.3, 0.4]} />
                <meshStandardMaterial color="#3a3a3a" emissive="#2a2a2a" emissiveIntensity={0.1} />
            </mesh>

            {/* Center Console */}
            <mesh position={[0, -0.1, 0.3]}>
                <boxGeometry args={[0.3, 0.2, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" />
            </mesh>

            {/* Windshield Frame */}
            <mesh position={[0, 0.6, 0.3]}>
                <boxGeometry args={[1.8, 0.1, 0.05]} />
                <meshStandardMaterial color="#333" />
            </mesh>

            {/* Side Windows */}
            <mesh position={[-0.9, 0.3, 0.2]}>
                <boxGeometry args={[0.05, 0.5, 0.6]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.9, 0.3, 0.2]}>
                <boxGeometry args={[0.05, 0.5, 0.6]} />
                <meshStandardMaterial color="#333" />
            </mesh>

            {/* Radio/Controls */}
            <mesh position={[0, 0.2, 0.42]}>
                <boxGeometry args={[0.4, 0.15, 0.05]} />
                <meshStandardMaterial color="#0a0a0a" />
            </mesh>
        </group>
    );
};

