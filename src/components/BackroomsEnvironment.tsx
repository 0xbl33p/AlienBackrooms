import { RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  wallpaperColor,
  wallpaperNormal,
  carpetColor,
  carpetNormal,
  ceilingColor,
  ceilingNormal,
  baseboardColor,
} from "./textures";

export const CELL_SIZE = 4;
export const WALL_HEIGHT = 3.2;

export const generateMaze = (size: number): number[][] => {
  const s = size % 2 === 0 ? size + 1 : size;
  const grid: number[][] = Array(s).fill(null).map(() => Array(s).fill(1));

  const carve = (cx: number, cy: number) => {
    grid[cy][cx] = 0;
    const dirs = [
      [0, -2], [2, 0], [0, 2], [-2, 0],
    ].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < s - 1 && ny > 0 && ny < s - 1 && grid[ny][nx] === 1) {
        grid[cy + dy / 2][cx + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  };

  carve(1, 1);

  const extraOpenings = Math.floor(s * 0.7);
  for (let i = 0; i < extraOpenings; i++) {
    const x = 1 + 2 * Math.floor(Math.random() * Math.floor((s - 1) / 2));
    const y = 2 * Math.floor(Math.random() * Math.floor((s - 2) / 2)) + 2;
    if (y < s - 1) grid[y][x] = 0;
  }

  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      grid[1 + dy][1 + dx] = 0;
      grid[s - 4 + dy][s - 4 + dx] = 0;
    }
  }

  return grid;
};

interface BackroomsEnvironmentProps {
  maze: number[][];
  lightsFailRatio?: number; // 0..1 fraction of fixtures that go dark
}

// A flickering fluorescent tube fixture mounted under the drop ceiling.
function Fluorescent({ position, seed, dead }: { position: [number, number, number]; seed: number; dead: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const tubeRef = useRef<THREE.MeshStandardMaterial>(null);
  // Most fixtures are stable; some flicker mildly.
  const flickerProb = (Math.sin(seed) + 1) * 0.5; // 0..1

  useFrame(({ clock }) => {
    if (!lightRef.current || !tubeRef.current) return;
    if (dead) {
      lightRef.current.intensity = 0;
      tubeRef.current.emissiveIntensity = 0;
      return;
    }
    const t = clock.elapsedTime;
    let i = 1;
    if (flickerProb > 0.85) {
      // heavy flicker
      const f = (Math.sin(t * 24 + seed) + Math.sin(t * 11.3 + seed * 2)) * 0.5;
      i = 0.55 + f * 0.45;
      if (Math.random() < 0.005) i = 0.05;
    } else if (flickerProb > 0.6) {
      // light buzz
      i = 0.9 + Math.sin(t * 60 + seed) * 0.06;
    }
    lightRef.current.intensity = 6 * i;
    tubeRef.current.emissiveIntensity = 2.4 * i;
  });

  return (
    <group position={position}>
      {/* Recessed fixture pan (metallic) */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.2, 0.1, 0.7]} />
        <meshStandardMaterial color="#cfcfcf" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Twin fluorescent tubes */}
      <mesh position={[0, -0.02, -0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2.0, 12]} />
        <meshStandardMaterial
          ref={tubeRef}
          color="#ffffff"
          emissive="#fff6d0"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.02, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2.0, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#fff6d0"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      {/* Diffuser */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[2.0, 0.02, 0.55]} />
        <meshStandardMaterial color="#fff8d8" transparent opacity={0.45} emissive="#fff2b0" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, -0.4, 0]}
        intensity={6}
        distance={CELL_SIZE * 4}
        decay={2}
        color="#fff5cc"
      />
    </group>
  );
}

export function BackroomsEnvironment({ maze, lightsFailRatio = 0 }: BackroomsEnvironmentProps) {
  const size = maze.length;
  const worldSize = size * CELL_SIZE;
  const center = worldSize / 2 - CELL_SIZE / 2;

  // Configure repeating textures based on world size.
  const wallMaterial = useMemo(() => {
    const c = wallpaperColor.clone();
    const n = wallpaperNormal.clone();
    c.repeat.set(1, 1);
    n.repeat.set(1, 1);
    c.needsUpdate = n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: c,
      normalMap: n,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.95,
      metalness: 0,
    });
  }, []);

  const baseboardMaterial = useMemo(() => {
    const c = baseboardColor.clone();
    c.repeat.set(1, 0.2);
    c.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: c,
      roughness: 0.7,
      metalness: 0,
    });
  }, []);

  const floorMaterial = useMemo(() => {
    const c = carpetColor.clone();
    const n = carpetNormal.clone();
    c.repeat.set(size, size);
    n.repeat.set(size, size);
    c.needsUpdate = n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: c,
      normalMap: n,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 1,
      metalness: 0,
    });
  }, [size]);

  const ceilingMaterial = useMemo(() => {
    const c = ceilingColor.clone();
    const n = ceilingNormal.clone();
    c.repeat.set(size, size);
    n.repeat.set(size, size);
    c.needsUpdate = n.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: c,
      normalMap: n,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.9,
      metalness: 0,
    });
  }, [size]);

  const walls = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (maze[y][x] === 1) out.push({ x: x * CELL_SIZE, z: y * CELL_SIZE });
      }
    }
    return out;
  }, [maze, size]);

  // Place a fluorescent fixture in some open cells (every ~3 cells).
  const fixtures = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let y = 1; y < size - 1; y += 3) {
      for (let x = 1; x < size - 1; x += 3) {
        if (maze[y]?.[x] === 0) {
          out.push([x * CELL_SIZE, WALL_HEIGHT - 0.05, y * CELL_SIZE]);
        }
      }
    }
    return out;
  }, [maze, size]);

  return (
    <group>
      {/* Carpet floor */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[center, -0.05, center]} material={floorMaterial}>
          <boxGeometry args={[worldSize, 0.1, worldSize]} />
        </mesh>
      </RigidBody>

      {/* Drop ceiling */}
      <mesh position={[center, WALL_HEIGHT + 0.05, center]} material={ceilingMaterial}>
        <boxGeometry args={[worldSize, 0.1, worldSize]} />
      </mesh>

      {/* Walls — each cell gets the wallpaper material with a baseboard strip at the bottom */}
      {walls.map((w) => (
        <RigidBody key={`${w.x}-${w.z}`} type="fixed" colliders="cuboid">
          <mesh position={[w.x, WALL_HEIGHT / 2, w.z]} material={wallMaterial}>
            <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
          </mesh>
          {/* Baseboard, drawn slightly proud so it reads */}
          <mesh position={[w.x, 0.12, w.z]} material={baseboardMaterial}>
            <boxGeometry args={[CELL_SIZE + 0.04, 0.24, CELL_SIZE + 0.04]} />
          </mesh>
        </RigidBody>
      ))}

      {/* Fluorescent fixtures — some "die" as escalation rises */}
      {fixtures.map((p, i) => {
        // Stable per-fixture rank in [0,1]; lights with rank below failRatio go dark.
        const rank = ((i * 2654435761) % 1000) / 1000;
        const dead = rank < lightsFailRatio;
        return <Fluorescent key={`fx-${i}`} position={p} seed={i * 7.31} dead={dead} />;
      })}

      {/* Soft fill so deep dead-ends aren't pure black */}
      <ambientLight intensity={0.18} color="#fff2cc" />
      <hemisphereLight args={["#fff2b0", "#1a1408", 0.25]} />
    </group>
  );
}
