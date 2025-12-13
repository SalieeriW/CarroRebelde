import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RoadViewProps {
    speed: number;
    carAngle: number;
}

export const RoadView = ({ speed, carAngle }: RoadViewProps) => {
    const roadRef = useRef<THREE.Mesh>(null);
    const roadLinesRef = useRef<THREE.Group>(null);
    const roadOffset = useRef(0);

    useFrame((state, delta) => {
        // Move road based on speed
        if (roadRef.current) {
            roadOffset.current += speed * delta * 2;
            roadRef.current.position.z = (roadOffset.current % 20) - 10;
        }
        
        // Animate road lines
        if (roadLinesRef.current) {
            roadLinesRef.current.children.forEach((line, i) => {
                if (line instanceof THREE.Mesh) {
                    line.position.z = ((roadOffset.current + i * 5) % 20) - 10;
                }
            });
        }
    });

    // Road segments
    const roadSegments = useMemo(() => {
        const segments = [];
        for (let i = -5; i < 10; i++) {
            segments.push(
                <mesh key={i} position={[0, 0, i * 20]}>
                    <boxGeometry args={[8, 0.1, 20]} />
                    <meshStandardMaterial color="#333333" />
                </mesh>
            );
        }
        return segments;
    }, []);

    // Road lines
    const roadLines = useMemo(() => {
        const lines = [];
        for (let i = -10; i < 20; i++) {
            lines.push(
                <mesh key={i} position={[0, 0.11, i * 5]}>
                    <boxGeometry args={[0.2, 0.05, 2]} />
                    <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} />
                </mesh>
            );
        }
        return lines;
    }, []);

    // Road signs based on speed
    const roadSigns = useMemo(() => {
        const signs = [];
        const signTypes = ["STOP", "SLOW", "SPEED", "CURVE"];
        for (let i = 0; i < 5; i++) {
            const signType = signTypes[i % signTypes.length];
            const side = i % 2 === 0 ? -4 : 4;
            signs.push(
                <group key={i} position={[side, 1, -30 + i * 15]}>
                    <mesh>
                        <boxGeometry args={[1, 1.5, 0.1]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[0, 0, 0.06]}>
                        <boxGeometry args={[0.9, 1.4, 0.05]} />
                        <meshStandardMaterial color="#ff0000" />
                    </mesh>
                </group>
            );
        }
        return signs;
    }, []);

    return (
        <group>
            {/* Road surface */}
            <group ref={roadRef}>
                {roadSegments}
            </group>
            
            {/* Road lines */}
            <group ref={roadLinesRef}>
                {roadLines}
            </group>
            
            {/* Road signs */}
            {roadSigns}
            
            {/* Side barriers */}
            <mesh position={[-4, 0.5, 0]}>
                <boxGeometry args={[0.2, 1, 200]} />
                <meshStandardMaterial color="#ff0000" />
            </mesh>
            <mesh position={[4, 0.5, 0]}>
                <boxGeometry args={[0.2, 1, 200]} />
                <meshStandardMaterial color="#ff0000" />
            </mesh>
            
            {/* Sky/background */}
            <mesh position={[0, 10, -50]}>
                <planeGeometry args={[100, 50]} />
                <meshStandardMaterial color="#87ceeb" side={THREE.DoubleSide} />
            </mesh>
            
            {/* Ground/sides */}
            <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[100, 200]} />
                <meshStandardMaterial color="#2a5a2a" />
            </mesh>
        </group>
    );
};

