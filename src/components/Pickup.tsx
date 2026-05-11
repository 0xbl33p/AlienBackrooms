import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ArtifactType } from "../lib/gameState";

interface PickupProps {
  position: [number, number, number];
  artifact: ArtifactType;
  fileId: string;
  collected: boolean;
  onCollect: () => void;
}

function ArtifactMesh({ artifact, hovered }: { artifact: ArtifactType; hovered: boolean }) {
  const emissive = hovered ? 0.6 : 0.2;

  switch (artifact) {
    case "polaroid":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.005, 0.22]} />
            <meshStandardMaterial color="#f4ead2" emissive="#ffec90" emissiveIntensity={emissive} roughness={0.7} />
          </mesh>
          {/* photo area */}
          <mesh position={[0, 0.003, -0.02]}>
            <boxGeometry args={[0.14, 0.001, 0.14]} />
            <meshStandardMaterial color="#0a1a30" emissive="#1a2a50" emissiveIntensity={emissive * 1.5} />
          </mesh>
        </group>
      );
    case "folder":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.012, 0.24]} />
            <meshStandardMaterial color="#bda270" emissive="#bda270" emissiveIntensity={emissive * 0.5} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.008, -0.06]}>
            <boxGeometry args={[0.26, 0.001, 0.05]} />
            <meshStandardMaterial color="#3a2515" />
          </mesh>
        </group>
      );
    case "cable":
      // Stack of telex paper / cable printout
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.015, 0.16]} />
            <meshStandardMaterial color="#e8e3cb" emissive="#e8e3cb" emissiveIntensity={emissive * 0.4} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <boxGeometry args={[0.18, 0.001, 0.12]} />
            <meshStandardMaterial color="#3a2a18" />
          </mesh>
        </group>
      );
    case "sketch":
      // Sketchbook-page sketch on rumpled paper
      return (
        <group rotation={[0, Math.random() * 0.4 - 0.2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.003, 0.18]} />
            <meshStandardMaterial color="#f1ead0" emissive="#f1ead0" emissiveIntensity={emissive * 0.4} roughness={0.85} />
          </mesh>
          {/* "drawing" — a black blob and a few lines */}
          <mesh position={[-0.04, 0.002, 0.02]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        </group>
      );
    case "newspaper":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.005, 0.24]} />
            <meshStandardMaterial color="#d8c89a" emissive="#d8c89a" emissiveIntensity={emissive * 0.3} roughness={0.95} />
          </mesh>
          {/* "headline" stripe */}
          <mesh position={[0, 0.003, 0.08]}>
            <boxGeometry args={[0.28, 0.001, 0.02]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      );
    case "tape":
      // VHS tape
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.19, 0.025, 0.11]} />
            <meshStandardMaterial color="#1a1a1a" emissive={hovered ? "#444" : "#0a0a0a"} emissiveIntensity={emissive} roughness={0.6} />
          </mesh>
          {/* white label */}
          <mesh position={[0, 0.014, 0]}>
            <boxGeometry args={[0.15, 0.001, 0.07]} />
            <meshStandardMaterial color="#e8e3cb" />
          </mesh>
        </group>
      );
  }
}

export function Pickup({ position, artifact, fileId, collected, onCollect }: PickupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + position[0] * 0.3;
    // Subtle hover bob and slow rotation when not collected
    groupRef.current.position.y = position[1] + 0.04 + Math.sin(t * 1.2) * 0.012;
    groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.2;
  });

  if (collected) return null;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onCollect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <ArtifactMesh artifact={artifact} hovered={hovered} />
      {/* Faint local glow so they're spottable in dim corridors */}
      <pointLight position={[0, 0.3, 0]} intensity={hovered ? 0.6 : 0.25} distance={2.2} color="#fff2b0" />

      {hovered && (
        <Html position={[0, 0.4, 0]} center distanceFactor={5}>
          <div style={{
            color: "#fff5cc",
            background: "rgba(0,0,0,0.85)",
            padding: "4px 8px",
            border: "1px solid rgba(255,245,200,0.5)",
            fontFamily: "VT323, monospace",
            fontSize: "16px",
            whiteSpace: "nowrap",
          }}>
            PICK UP — {fileId}
          </div>
        </Html>
      )}
    </group>
  );
}
