import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, PointerLockControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface DesertSceneProps {
  onEnterPortal: () => void;
}

// ──────────────────────────────────────────────────────────────────────────
// Procedural textures
// ──────────────────────────────────────────────────────────────────────────

const makeTex = (size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

function useSandTexture() {
  return useMemo(() => makeTex(512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, "#9d8460");
    grad.addColorStop(0.5, "#8b7456");
    grad.addColorStop(1, "#6f5d44");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s * s * 1.2; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const v = Math.random();
      ctx.fillStyle = v < 0.5
        ? `rgba(60,42,20,${0.25 + v * 0.4})`
        : `rgba(180,150,100,${0.2 + v * 0.4})`;
      ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 1 + Math.random() * 2.2;
      ctx.fillStyle = `rgba(40,28,12,${0.5 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(20,12,6,0.35)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 22; i++) {
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 14; j++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }), []);
}

function useRoadTexture() {
  return useMemo(() => makeTex(256, (ctx, s) => {
    ctx.fillStyle = "#4a3a26";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "rgba(20,14,6,0.5)";
    ctx.fillRect(s * 0.30, 0, 6, s);
    ctx.fillRect(s * 0.65, 0, 6, s);
    for (let i = 0; i < s * s * 0.6; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }), []);
}

function useWarningSignTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 384;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f0eadb";
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = "#a01818";
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, 496, 368);
    ctx.fillStyle = "#a01818";
    ctx.fillRect(20, 20, 472, 80);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WARNING", 256, 78);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("RESTRICTED AREA", 256, 150);
    ctx.font = "20px sans-serif";
    ctx.fillText("IT IS UNLAWFUL TO ENTER THIS AREA", 256, 192);
    ctx.fillText("WITHOUT PERMISSION OF THE", 256, 220);
    ctx.fillText("INSTALLATION COMMANDER.", 256, 248);
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#a01818";
    ctx.fillText("USE OF DEADLY FORCE", 256, 296);
    ctx.fillText("AUTHORIZED", 256, 322);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText("Sec. 21, Internal Security Act of 1950", 256, 358);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

// ──────────────────────────────────────────────────────────────────────────
// World
// ──────────────────────────────────────────────────────────────────────────

function Sky() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, "#02030a");
    g.addColorStop(0.55, "#040a18");
    g.addColorStop(0.85, "#0a1428");
    g.addColorStop(1.00, "#1a2238");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, []);
  return (
    <mesh>
      <sphereGeometry args={[400, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function Moon() {
  return (
    <group position={[60, 90, -160]}>
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <meshStandardMaterial color="#dfe6f0" emissive="#cdd6e4" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#9bb3d8" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Ground() {
  const sand = useSandTexture();
  const sandFar = useMemo(() => {
    const t = sand.clone();
    t.repeat.set(60, 60);
    t.needsUpdate = true;
    return t;
  }, [sand]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[600, 600, 64, 64]} />
      <meshStandardMaterial map={sandFar} roughness={1} />
    </mesh>
  );
}

function Mountains() {
  const buildRing = (radius: number, peakBase: number, peakVar: number, segs: number) => {
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * 25;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const peakY = peakBase + Math.random() * peakVar;
      verts.push(x, 0, z);
      verts.push(x, peakY, z);
      if (i > 0) {
        const base = (i - 1) * 2;
        idx.push(base, base + 1, base + 3);
        idx.push(base, base + 3, base + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const near = useMemo(() => buildRing(180, 25, 35, 96), []);
  const far = useMemo(() => buildRing(310, 18, 22, 64), []);
  return (
    <>
      <mesh geometry={far}>
        <meshStandardMaterial color="#2a3142" roughness={1} flatShading />
      </mesh>
      <mesh geometry={near}>
        <meshStandardMaterial color="#1c2032" roughness={1} flatShading />
      </mesh>
    </>
  );
}

function Road() {
  const road = useRoadTexture();
  road.repeat.set(1, 30);
  road.needsUpdate = true;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -40]} receiveShadow>
      <planeGeometry args={[5, 120]} />
      <meshStandardMaterial map={road} roughness={1} />
    </mesh>
  );
}

function PowerPole({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 9, 8]} />
        <meshStandardMaterial color="#3a2a14" roughness={0.9} />
      </mesh>
      <mesh position={[0, 8.4, 0]}>
        <boxGeometry args={[1.6, 0.1, 0.1]} />
        <meshStandardMaterial color="#3a2a14" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ChainLinkFence({ start, end }: { start: [number, number]; end: [number, number] }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const posts = Math.floor(len / 3) + 1;
  return (
    <group position={[(start[0] + end[0]) / 2, 0, (start[1] + end[1]) / 2]} rotation={[0, -angle, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[len, 2.4, 0.02]} />
        <meshStandardMaterial color="#4a4a4a" wireframe transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[len, 0.04, 0.02]} />
        <meshStandardMaterial color="#6a6a6a" />
      </mesh>
      {Array.from({ length: posts }).map((_, i) => {
        const px = -len / 2 + (i / (posts - 1 || 1)) * len;
        return (
          <mesh key={i} position={[px, 1.3, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
            <meshStandardMaterial color="#6a6a6a" metalness={0.6} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function WarningSign({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const tex = useWarningSignTexture();
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[-0.6, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#6a6a6a" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.6, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#6a6a6a" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[1.5, 1.1, 0.04]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Hangar({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 8, 22]} />
        <meshStandardMaterial color="#3a3a32" roughness={0.85} />
      </mesh>
      <mesh position={[0, 8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 22, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#2a2a24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.5, 11.05]}>
        <boxGeometry args={[8, 6, 0.1]} />
        <meshStandardMaterial color="#1a1a16" roughness={0.7} />
      </mesh>
      <pointLight position={[0, 11, 0]} intensity={0.4} distance={20} color="#ffeeaa" />
    </group>
  );
}

function ControlBuilding({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 3.2, 7]} />
        <meshStandardMaterial color="#5a5240" roughness={0.85} />
      </mesh>
      {[-3, -1, 1, 3].map((wx) => (
        <mesh key={wx} position={[wx, 2.0, 3.55]}>
          <boxGeometry args={[1.0, 0.8, 0.05]} />
          <meshStandardMaterial color="#fff5cc" emissive="#fff2a8" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[0, 3.0, 4.0]} intensity={1.5} distance={14} color="#ffd58a" />
    </group>
  );
}

function Watchtower({ position }: { position: [number, number, number] }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const beaconLight = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const blink = Math.sin(t * 4) > 0.6 ? 1 : 0.05;
    if (beaconRef.current) {
      const m = beaconRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = blink * 4;
    }
    if (beaconLight.current) beaconLight.current.intensity = blink * 5;
  });
  return (
    <group position={position}>
      {[
        [-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 4.5, z]}>
          <boxGeometry args={[0.18, 9, 0.18]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 9.5, 0]} castShadow>
        <boxGeometry args={[3.4, 2, 3.4]} />
        <meshStandardMaterial color="#3a3a36" roughness={0.8} />
      </mesh>
      <mesh position={[0, 9.7, 0]}>
        <boxGeometry args={[3.45, 1.0, 3.45]} />
        <meshStandardMaterial color="#1a2a3a" emissive="#1a2a3a" emissiveIntensity={0.4} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 10.55, 0]}>
        <boxGeometry args={[3.6, 0.1, 3.6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh ref={beaconRef} position={[0, 10.85, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <pointLight ref={beaconLight} position={[0, 11.0, 0]} intensity={5} distance={26} color="#ff4444" />
      <mesh position={[0, 9.1, 1.7]} rotation={[Math.PI / 2.2, 0, 0]}>
        <coneGeometry args={[0.6, 1.4, 16]} />
        <meshStandardMaterial color="#fff5cc" transparent opacity={0.18} emissive="#fff2a8" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function JoshuaTree({ position, seed }: { position: [number, number, number]; seed: number }) {
  const trunkH = 2 + ((seed * 13.7) % 1) * 1.6;
  return (
    <group position={position} rotation={[0, seed * 1.7, 0]}>
      <mesh position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.22, trunkH, 8]} />
        <meshStandardMaterial color="#3a2c18" roughness={1} />
      </mesh>
      <mesh position={[0.3, trunkH * 0.7, 0]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.07, 0.1, 0.9, 6]} />
        <meshStandardMaterial color="#3a2c18" roughness={1} />
      </mesh>
      <mesh position={[-0.25, trunkH * 0.55, 0.1]} rotation={[0, 0, 0.7]}>
        <cylinderGeometry args={[0.07, 0.1, 0.7, 6]} />
        <meshStandardMaterial color="#3a2c18" roughness={1} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.18, trunkH + 0.18, Math.sin(a) * 0.18]} rotation={[Math.PI / 2.2, 0, a]}>
            <coneGeometry args={[0.08, 0.7, 6]} />
            <meshStandardMaterial color="#1f3a1a" roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function ScrubBush({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#3d3a22" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Energy Portal — shader-based swirling vortex
// ──────────────────────────────────────────────────────────────────────────

const portalVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const portalFragmentShader = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.04;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv) * 2.0;
    float ang = atan(uv.y, uv.x);

    // Spiral / vortex distortion: angle + something proportional to 1/r
    float spiral = ang + 1.4 / max(r, 0.06) + uTime * 0.55;
    vec2 sUv = vec2(cos(spiral), sin(spiral)) * (0.6 + r * 1.3);

    float n = fbm(sUv * 1.6 + uTime * 0.25);
    float n2 = fbm(sUv * 3.2 - uTime * 0.4);
    float energy = smoothstep(0.25, 0.85, n + n2 * 0.5);

    // Concentric pulse rings travelling inward
    float rings = sin((r - uTime * 0.4) * 24.0) * 0.5 + 0.5;
    rings = smoothstep(0.55, 1.0, rings);

    // Bright hot core
    float core = smoothstep(0.42, 0.0, r);
    // Edge falloff to a clean disc
    float edge = smoothstep(1.0, 0.86, r);

    vec3 deep = vec3(0.10, 0.30, 1.10);
    vec3 cyan = vec3(0.50, 1.00, 1.70);
    vec3 hot  = vec3(1.30, 1.80, 2.40);

    vec3 col = mix(deep, cyan, energy);
    col += hot * core * 0.9;
    col += cyan * rings * 0.55;

    // Boost overall brightness so bloom catches it
    col *= 1.4;

    float a = clamp(edge * (0.55 + energy * 0.6 + core * 0.6), 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`;

interface EnergyPortalProps {
  position: [number, number, number];
  onEnter: () => void;
  playerPos: React.MutableRefObject<[number, number, number] | null>;
}

function EnergyPortal({ position, onEnter, playerPos }: EnergyPortalProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const triggered = useRef(false);
  const [hovered, setHovered] = useState(false);

  // 28 orbiting spark particles
  const particleCount = 28;
  const particleData = useMemo(
    () => Array.from({ length: particleCount }, (_, i) => ({
      seed: i / particleCount,
      offset: Math.random() * Math.PI * 2,
      orbitR: 3.4 + Math.random() * 0.6,
      speed: 0.7 + Math.random() * 0.7,
    })),
    [],
  );
  const particleGroup = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) (matRef.current.uniforms.uTime.value as number) += delta;
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.5;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.7;
    if (lightRef.current) {
      lightRef.current.intensity = 12 + Math.sin(performance.now() * 0.003) * 3;
    }
    // Animate particles
    if (particleGroup.current) {
      const t = performance.now() * 0.001;
      particleGroup.current.children.forEach((child, i) => {
        const pd = particleData[i];
        const a = pd.offset + t * pd.speed;
        const r = pd.orbitR + Math.sin(t * 1.7 + i) * 0.15;
        child.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.2, Math.sin(a) * r);
        const s = 0.045 + Math.sin(t * 2.0 + i) * 0.02;
        child.scale.setScalar(s);
      });
    }
    // Auto-enter when player walks into it
    if (!triggered.current && playerPos.current) {
      const [px, , pz] = playerPos.current;
      const [tx, , tz] = position;
      if (Math.hypot(px - tx, pz - tz) < 2.4) {
        triggered.current = true;
        onEnter();
      }
    }
  });

  return (
    <group position={position}>
      {/* Outer torus (slow rotation) */}
      <mesh ref={ringRef}>
        <torusGeometry args={[3.2, 0.18, 16, 96]} />
        <meshStandardMaterial
          color="#0a1a3a"
          emissive="#88bbff"
          emissiveIntensity={2.2}
          metalness={0.6}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      {/* Inner torus (counter-rotating, slimmer) */}
      <mesh ref={ring2Ref} rotation={[0, 0, Math.PI / 7]}>
        <torusGeometry args={[2.85, 0.07, 12, 96]} />
        <meshStandardMaterial
          color="#0a2a5a"
          emissive="#aaddff"
          emissiveIntensity={2.5}
          metalness={0.6}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Energy disc (the actual portal surface, shader-driven) */}
      <mesh
        onClick={(e) => { e.stopPropagation(); if (!triggered.current) { triggered.current = true; onEnter(); } }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        <circleGeometry args={[2.95, 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={portalVertexShader}
          fragmentShader={portalFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Volumetric halo */}
      <mesh>
        <sphereGeometry args={[3.8, 32, 32]} />
        <meshBasicMaterial color="#88bbff" transparent opacity={hovered ? 0.18 : 0.10} depthWrite={false} />
      </mesh>

      {/* Orbiting sparks */}
      <group ref={particleGroup}>
        {particleData.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial
              color="#aaddff"
              emissive="#aaddff"
              emissiveIntensity={4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Light cast on the desert */}
      <pointLight ref={lightRef} position={[0, 0, 0.5]} intensity={12} distance={70} color="#88bbff" />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Desert player — WASD + mouse look
// ──────────────────────────────────────────────────────────────────────────

const SPAWN: [number, number, number] = [0, 1.7, 16];
// Constrain the player to the desert plot — keep them out of the base proper.
const BOUND_X = 60;
const BOUND_Z_MIN = -40;
const BOUND_Z_MAX = 40;

interface DesertPlayerProps {
  positionRef: React.MutableRefObject<[number, number, number] | null>;
  onLockChange: (locked: boolean) => void;
}

function DesertPlayer({ positionRef, onLockChange }: DesertPlayerProps) {
  const { camera } = useThree();
  const keys = useRef({ forward: false, backward: false, left: false, right: false, sprint: false });

  useEffect(() => {
    camera.position.set(...SPAWN);

    const onDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": keys.current.forward = true; break;
        case "KeyS": case "ArrowDown": keys.current.backward = true; break;
        case "KeyA": case "ArrowLeft": keys.current.left = true; break;
        case "KeyD": case "ArrowRight": keys.current.right = true; break;
        case "ShiftLeft": case "ShiftRight": keys.current.sprint = true; break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": keys.current.forward = false; break;
        case "KeyS": case "ArrowDown": keys.current.backward = false; break;
        case "KeyA": case "ArrowLeft": keys.current.left = false; break;
        case "KeyD": case "ArrowRight": keys.current.right = false; break;
        case "ShiftLeft": case "ShiftRight": keys.current.sprint = false; break;
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const bobPhase = useRef(0);

  useFrame((_, delta) => {
    fwd.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    fwd.current.y = 0;
    fwd.current.normalize();
    right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.current.y = 0;
    right.current.normalize();

    const dir = new THREE.Vector3();
    if (keys.current.forward) dir.add(fwd.current);
    if (keys.current.backward) dir.sub(fwd.current);
    if (keys.current.left) dir.sub(right.current);
    if (keys.current.right) dir.add(right.current);
    const moving = dir.lengthSq() > 0;
    const speed = (keys.current.sprint ? 8 : 4.5);
    if (moving) {
      dir.normalize().multiplyScalar(speed * delta);
      camera.position.x += dir.x;
      camera.position.z += dir.z;
    }

    // Constrain to plot
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -BOUND_X, BOUND_X);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, BOUND_Z_MIN, BOUND_Z_MAX);

    // Walking head bob
    if (moving) bobPhase.current += delta * 8;
    camera.position.y = 1.7 + (moving ? Math.sin(bobPhase.current) * 0.04 : 0);

    if (positionRef) positionRef.current = [camera.position.x, camera.position.y, camera.position.z];
  });

  return (
    <PointerLockControls
      onLock={() => onLockChange(true)}
      onUnlock={() => onLockChange(false)}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Scene
// ──────────────────────────────────────────────────────────────────────────

interface SceneContentsProps {
  onEnter: () => void;
  playerPos: React.MutableRefObject<[number, number, number] | null>;
  onLockChange: (locked: boolean) => void;
}

function SceneContents({ onEnter, playerPos, onLockChange }: SceneContentsProps) {
  const treeSpots: [number, number, number, number][] = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2 + Math.random() * 0.3;
      const r = 25 + Math.random() * 110;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r - 30;
      if (Math.abs(x) < 5 && z > -110 && z < 20) continue;
      out.push([x, 0, z, i + 1.3]);
    }
    return out;
  }, []);

  const bushSpots: [number, number, number][] = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = -(Math.random() * 180) + 20;
      if (Math.abs(x) < 4 && z > -110 && z < 20) continue;
      out.push([x, 0, z]);
    }
    return out;
  }, []);

  return (
    <>
      <Sky />
      <Stars radius={250} depth={50} count={5000} factor={4} saturation={0} fade speed={0.2} />
      <Moon />

      <ambientLight intensity={0.55} color="#aac0e8" />
      <hemisphereLight args={["#bcd0f0", "#2a2418", 0.55]} />
      <directionalLight position={[60, 90, -160]} intensity={0.9} color="#cfd9ee" />

      <Ground />
      <Mountains />
      <Road />

      {Array.from({ length: 8 }).map((_, i) => (
        <group key={`pp-${i}`}>
          <PowerPole x={-3.6} z={-i * 14 - 6} />
          <PowerPole x={3.6} z={-i * 14 - 6} />
        </group>
      ))}

      <WarningSign position={[-3.5, 0, 4]} rotation={0.18} />
      <WarningSign position={[3.5, 0, 4]} rotation={-0.18} />
      <WarningSign position={[-7, 0, -8]} rotation={0.5} />
      <WarningSign position={[7, 0, -8]} rotation={-0.5} />

      <ChainLinkFence start={[-40, -55]} end={[-7, -55]} />
      <ChainLinkFence start={[7, -55]} end={[40, -55]} />

      <ControlBuilding position={[-15, 0, -85]} />
      <Hangar position={[14, 0, -90]} scale={1.0} />
      <Hangar position={[34, 0, -100]} scale={0.85} />
      <Watchtower position={[-26, 0, -68]} />

      {treeSpots.map((s, i) => (
        <JoshuaTree key={`tree-${i}`} position={[s[0], s[1], s[2]]} seed={s[3]} />
      ))}
      {bushSpots.map((p, i) => (
        <ScrubBush key={`bush-${i}`} position={p} />
      ))}

      {/* Portal — placed between spawn and the fence so you walk to it */}
      <EnergyPortal position={[0, 3.2, -25]} onEnter={onEnter} playerPos={playerPos} />

      <DesertPlayer positionRef={playerPos} onLockChange={onLockChange} />
    </>
  );
}

export function DesertScene({ onEnterPortal }: DesertSceneProps) {
  const [transitioning, setTransitioning] = useState(false);
  const [locked, setLocked] = useState(false);
  const playerPos = useRef<[number, number, number] | null>(null);

  const handleEnter = () => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => onEnterPortal(), 1400);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#02030a", position: "relative" }}>
      <Suspense fallback={<div style={{ color: "#cfe6ff", textAlign: "center", paddingTop: "40vh", fontFamily: "VT323, monospace", letterSpacing: "2px", fontSize: "20px" }}>ACQUIRING SECTOR 7 PERIMETER...</div>}>
        <Canvas
          camera={{ fov: 70, near: 0.1, far: 1200, position: [0, 1.7, 16] }}
          dpr={[1, 1.5]}
          gl={{ antialias: true }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            scene.fog = new THREE.FogExp2(0x0a1020, 0.0035);
          }}
        >
          <SceneContents onEnter={handleEnter} playerPos={playerPos} onLockChange={setLocked} />
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={1.0} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur />
            <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} radialModulation={false} modulationOffset={0} />
            <Vignette eskil={false} offset={0.18} darkness={0.7} />
          </EffectComposer>
        </Canvas>
      </Suspense>

      {/* Top HUD */}
      <div style={{
        position: "absolute",
        top: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        color: "#cfe6ff",
        fontFamily: "VT323, monospace",
        fontSize: "20px",
        textAlign: "center",
        letterSpacing: "2px",
        textShadow: "0 0 12px rgba(0,0,0,0.9)",
        pointerEvents: "none",
      }}>
        NEVADA TEST AND TRAINING RANGE — SECTOR 7 PERIMETER<br/>
        <span style={{ opacity: 0.75, fontSize: "16px" }}>2026-05-08 // 03:14 LOCAL // GROOM BASIN</span>
      </div>

      {/* Center crosshair (only when locked) */}
      {locked && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "5px", height: "5px",
          border: "1px solid rgba(255,240,180,0.7)",
          borderRadius: "50%",
          pointerEvents: "none", zIndex: 10,
          boxShadow: "0 0 4px rgba(0,0,0,0.8)",
        }} />
      )}

      {/* Bottom prompt */}
      {!locked && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#cfe6ff",
          fontFamily: "VT323, monospace",
          fontSize: "32px",
          textAlign: "center",
          textShadow: "0 0 12px rgba(0,0,0,0.9)",
          pointerEvents: "none",
          zIndex: 20,
          background: "rgba(0,0,0,0.3)",
        }}>
          [CLICK TO TAKE CONTROL]<br/>
          <span style={{ fontSize: "18px", opacity: 0.85 }}>WASD MOVE · SHIFT RUN · MOUSE LOOK</span>
        </div>
      )}

      {locked && (
        <div style={{
          position: "absolute",
          bottom: "60px",
          left: "50%",
          transform: "translateX(-50%)",
          color: "#cfe6ff",
          fontFamily: "VT323, monospace",
          fontSize: "20px",
          textAlign: "center",
          textShadow: "0 0 12px rgba(0,0,0,0.9)",
          pointerEvents: "none",
          opacity: 0.85,
        }}>
          ANOMALY DETECTED — APPROACH TO BREACH
        </div>
      )}

      {transitioning && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "white",
          opacity: 0,
          animation: "transportFlash 1.4s forwards",
          zIndex: 50,
          pointerEvents: "none",
        }} />
      )}

      <style>{`
        @keyframes transportFlash {
          0%   { opacity: 0; background: rgba(136,204,255,0); }
          40%  { opacity: 1; background: rgba(220,235,255,1); }
          70%  { opacity: 1; background: rgba(255,255,255,1); }
          100% { opacity: 1; background: rgba(0,0,0,1); }
        }
      `}</style>
    </div>
  );
}
