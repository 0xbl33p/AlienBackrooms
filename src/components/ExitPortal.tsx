import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface ExitPortalProps {
  position: [number, number, number];
  playerPosition: React.MutableRefObject<[number, number, number] | null>;
  onEscape: () => void;
}

export function ExitPortal({ position, playerPosition, onEscape }: ExitPortalProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const triggered = useRef(false);
  const visibleDistance = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.5;
    if (innerRef.current) innerRef.current.emissiveIntensity = 1.4 + Math.sin(t * 2.4) * 0.6;
    if (lightRef.current) lightRef.current.intensity = 4 + Math.sin(t * 1.5) * 1.2;

    if (triggered.current) return;
    const p = playerPosition.current;
    if (!p) return;
    const d = Math.hypot(p[0] - position[0], p[2] - position[2]);
    visibleDistance.current = d;
    if (d < 1.4) {
      triggered.current = true;
      onEscape();
    }
  });

  return (
    <group position={position}>
      {/* Backwall portal: a torus + emissive disc, distinct blue tone vs. desert */}
      <mesh ref={ringRef} position={[0, 1.8, 0]}>
        <torusGeometry args={[0.95, 0.1, 12, 48]} />
        <meshStandardMaterial color="#aaccff" emissive="#88aaff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <circleGeometry args={[0.85, 48]} />
        <meshStandardMaterial
          ref={innerRef}
          color="#5a8fff"
          emissive="#7aa9ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.8, 0]} intensity={4} distance={CELL_SIZE_LOCAL * 5} color="#88bbff" />

      <Html position={[0, 2.95, 0]} center distanceFactor={6}>
        <div style={{
          color: "#cfe6ff",
          background: "rgba(0,0,0,0.85)",
          padding: "4px 10px",
          border: "1px solid #88aaff",
          fontFamily: "VT323, monospace",
          fontSize: "18px",
          whiteSpace: "nowrap",
          textShadow: "0 0 8px rgba(136,170,255,0.6)",
        }}>
          EXIT — RETURN TO PERIMETER
        </div>
      </Html>
    </group>
  );
}

const CELL_SIZE_LOCAL = 4;
