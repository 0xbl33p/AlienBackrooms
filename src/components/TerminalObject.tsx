import { RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface TerminalObjectProps {
  position: [number, number, number];
  onInteract: () => void;
  playerPos?: React.MutableRefObject<[number, number, number] | null>;
  bootCompleted: boolean;
  unlockedCount: number;
  totalFiles: number;
  interactive: boolean;
}

const DESK_W = 1.6;
const DESK_D = 0.8;
const DESK_H = 0.78;
const DESK_TOP_T = 0.05;
const PROMPT_RADIUS = 2.6;

function DeskLeg({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, DESK_H / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[0.05, DESK_H, 0.05]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

function Chair({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#181818" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.06]} />
        <meshStandardMaterial color="#181818" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.45, 12]} />
        <meshStandardMaterial color="#0e0e0e" metalness={0.7} roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18]}
            rotation={[0, -a, 0]}
            castShadow
          >
            <boxGeometry args={[0.36, 0.04, 0.06]} />
            <meshStandardMaterial color="#0e0e0e" metalness={0.7} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

// Renders the menu content to a canvas, applies CRT scanlines and vignette,
// and exposes it as a THREE.CanvasTexture suitable for both `map` and
// `emissiveMap` on the screen mesh.
function buildScreenTexture(args: {
  bootCompleted: boolean;
  unlocked: number;
  total: number;
}) {
  const c = document.createElement("canvas");
  // 4:3 aspect, generous resolution for legibility
  c.width = 512; c.height = 384;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#06150a";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "#33ff33";
  ctx.shadowColor = "#33ff33";
  ctx.shadowBlur = 6;
  ctx.font = "bold 22px 'VT323', monospace";

  if (!args.bootCompleted) {
    ctx.fillText("DEPT OF WAR — SECURE TERMINAL", 22, 44);
    ctx.font = "16px 'VT323', monospace";
    ctx.fillText("v4.2 // SECTOR 7", 22, 70);

    ctx.font = "18px 'VT323', monospace";
    ctx.fillStyle = "#aaffaa";
    ctx.fillText("> SECURE KERNEL .................. [OK]", 22, 130);
    ctx.fillText("> SUBSYSTEM LOAD ................. [OK]", 22, 158);
    ctx.fillText("> SECTOR 7 LINK .................. [OK]", 22, 186);
    ctx.fillText("> CLASSIFIED DB .............. [PURSUE]", 22, 214);

    ctx.fillStyle = "#88ff88";
    ctx.fillText("AWAITING CLEARANCE...", 22, 270);

    ctx.fillStyle = "#ffe88a";
    ctx.font = "bold 22px 'VT323', monospace";
    ctx.fillText("[CLICK OR PRESS E TO ACCESS]", 22, 330);
  } else {
    ctx.fillText("DEPARTMENT OF WAR", 22, 44);
    ctx.font = "16px 'VT323', monospace";
    ctx.fillText("CLASSIFIED DATABASE — PURSUE", 22, 70);

    ctx.font = "18px 'VT323', monospace";
    ctx.fillStyle = "#aaffaa";
    ctx.fillText("> [ACCESS CLASSIFIED DATABASE]", 22, 140);
    ctx.fillText("> [INITIALIZE A.I.S. SUBSYSTEM]", 22, 172);
    ctx.fillStyle = "#ff8888";
    ctx.fillText("> [DISCONNECT TERMINAL]", 22, 204);

    ctx.fillStyle = "#88ff88";
    ctx.font = "16px 'VT323', monospace";
    ctx.fillText(
      `ARTIFACTS: ${args.unlocked} / ${args.total}`,
      22,
      264,
    );

    ctx.fillStyle = "#ffe88a";
    ctx.font = "bold 22px 'VT323', monospace";
    ctx.fillText("[CLICK OR PRESS E TO ACCESS]", 22, 330);
  }

  // Subtle scanlines on the texture itself (the 3D mesh also gets bloom)
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "multiply";
  for (let y = 0; y < c.height; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, y, c.width, 2);
  }
  // Vignette
  const grad = ctx.createRadialGradient(c.width / 2, c.height / 2, 60, c.width / 2, c.height / 2, c.width * 0.7);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

interface CRTMonitorProps {
  active: boolean;
  bootCompleted: boolean;
  unlockedCount: number;
  totalFiles: number;
}

function CRTMonitor({ active, bootCompleted, unlockedCount, totalFiles }: CRTMonitorProps) {
  const screenMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Re-render the screen content when relevant state changes.
  const screenTex = useMemo(
    () => buildScreenTexture({ bootCompleted, unlocked: unlockedCount, total: totalFiles }),
    [bootCompleted, unlockedCount, totalFiles],
  );

  useFrame(({ clock }) => {
    if (!screenMatRef.current) return;
    const flicker = 0.9 + Math.sin(clock.elapsedTime * 11) * 0.04 + Math.random() * 0.02;
    screenMatRef.current.emissiveIntensity = (active ? 1.7 : 1.25) * flicker;
  });

  const caseColor = "#d8cda3";

  return (
    <group position={[0, DESK_H + DESK_TOP_T / 2, -0.05]}>
      <mesh position={[0, 0.22, -0.18]} castShadow>
        <boxGeometry args={[0.62, 0.5, 0.55]} />
        <meshStandardMaterial color={caseColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.22, 0.05]} castShadow>
        <boxGeometry args={[0.58, 0.46, 0.08]} />
        <meshStandardMaterial color={caseColor} roughness={0.7} />
      </mesh>
      {[-0.18, -0.1, -0.02, 0.06].map((zOff, i) => (
        <mesh key={i} position={[0, 0.475, zOff - 0.1]}>
          <boxGeometry args={[0.4, 0.005, 0.015]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      <mesh position={[0, 0.0, 0.092]}>
        <boxGeometry args={[0.5, 0.04, 0.005]} />
        <meshStandardMaterial color="#3a352a" />
      </mesh>
      <mesh position={[0.22, 0.0, 0.092]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#33ff33" emissive="#33ff33" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.24, 0.094]}>
        <boxGeometry args={[0.48, 0.36, 0.005]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>
      {/* The CRT face — now textured with live content */}
      <mesh position={[0, 0.24, 0.098]}>
        <planeGeometry args={[0.42, 0.30, 1, 1]} />
        <meshStandardMaterial
          ref={screenMatRef}
          map={screenTex}
          emissiveMap={screenTex}
          emissive={"#ffffff"}
          emissiveIntensity={active ? 1.7 : 1.25}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 0.24, 0.4]} intensity={active ? 2 : 0.8} distance={3.5} color="#33ff33" />
    </group>
  );
}

function Keyboard() {
  return (
    <group position={[0, DESK_H + DESK_TOP_T / 2 + 0.018, 0.18]} rotation={[-0.05, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.025, 0.18]} />
        <meshStandardMaterial color="#cfc4a0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.014, 0]}>
        <boxGeometry args={[0.5, 0.005, 0.14]} />
        <meshStandardMaterial color="#bdb393" roughness={0.6} />
      </mesh>
      {[-0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06].map((z, i) => (
        <mesh key={i} position={[0, 0.017, z]}>
          <boxGeometry args={[0.5, 0.001, 0.001]} />
          <meshStandardMaterial color="#7a7155" />
        </mesh>
      ))}
    </group>
  );
}

function CableTangle() {
  return (
    <group position={[0.05, DESK_H + DESK_TOP_T / 2, -0.3]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.6} />
      </mesh>
      <mesh position={[-0.1, -0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function TerminalObject({
  position,
  onInteract,
  playerPos,
  bootCompleted,
  unlockedCount,
  totalFiles,
  interactive,
}: TerminalObjectProps) {
  const [hovered, setHovered] = useState(false);
  const [inRange, setInRange] = useState(false);
  const inRangeRef = useRef(false);

  useFrame(() => {
    const p = playerPos?.current;
    if (!p) return;
    const dx = p[0] - position[0];
    const dz = p[2] - position[2];
    const within = Math.hypot(dx, dz) < PROMPT_RADIUS;
    if (within !== inRangeRef.current) {
      inRangeRef.current = within;
      setInRange(within);
    }
  });

  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && inRangeRef.current) onInteract();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onInteract, interactive]);

  const promptVisible = interactive && (inRange || hovered);
  const active = hovered || inRange;

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onInteract(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, DESK_H + DESK_TOP_T / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[DESK_W, DESK_TOP_T, DESK_D]} />
          <meshStandardMaterial color="#2c2218" roughness={0.55} />
        </mesh>
      </RigidBody>

      <DeskLeg x={-DESK_W / 2 + 0.05} z={-DESK_D / 2 + 0.05} />
      <DeskLeg x={DESK_W / 2 - 0.05} z={-DESK_D / 2 + 0.05} />
      <DeskLeg x={-DESK_W / 2 + 0.05} z={DESK_D / 2 - 0.05} />
      <DeskLeg x={DESK_W / 2 - 0.05} z={DESK_D / 2 - 0.05} />

      <mesh position={[0, DESK_H / 2 + 0.05, -DESK_D / 2 + 0.025]}>
        <boxGeometry args={[DESK_W - 0.1, DESK_H - 0.1, 0.02]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>

      <CRTMonitor
        active={active}
        bootCompleted={bootCompleted}
        unlockedCount={unlockedCount}
        totalFiles={totalFiles}
      />
      <Keyboard />
      <CableTangle />

      <group position={[-0.55, DESK_H + DESK_TOP_T / 2 + 0.04, 0.05]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.08, 16]} />
          <meshStandardMaterial color="#f4f1e8" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.041, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.005, 16]} />
          <meshStandardMaterial color="#3a2515" roughness={0.5} />
        </mesh>
      </group>

      <Chair x={0} z={DESK_D / 2 + 0.45} />

      {/* Larger transparent click hitbox in front of the monitor */}
      <mesh position={[0, DESK_H + DESK_TOP_T / 2 + 0.24, 0.25]}>
        <planeGeometry args={[1.0, 0.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {promptVisible && (
        <Html
          position={[0, DESK_H + 1.35, 0]}
          center
          distanceFactor={6}
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            color: "#33ff33",
            background: "rgba(0,0,0,0.85)",
            padding: "6px 12px",
            border: "1px solid #33ff33",
            fontFamily: "VT323, monospace",
            fontSize: "20px",
            whiteSpace: "nowrap",
            textShadow: "0 0 6px rgba(51,255,51,0.6)",
            pointerEvents: "none",
          }}>
            [CLICK OR PRESS E TO ACCESS TERMINAL]
          </div>
        </Html>
      )}
    </group>
  );
}
