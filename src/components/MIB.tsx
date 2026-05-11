import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CELL_SIZE } from "./BackroomsEnvironment";

interface MIBProps {
  maze: number[][];
  spawnCell: [number, number];
  playerPosition: React.MutableRefObject<[number, number, number] | null>;
  speed: number;
  onCatchPlayer: () => void;
}

const CATCH_DIST = 1.4;
const REPATH_INTERVAL = 0.6; // seconds

// BFS from start cell to goal cell, returns path of grid cells (including start, ending at goal),
// or null if unreachable.
function bfs(maze: number[][], start: [number, number], goal: [number, number]): [number, number][] | null {
  const size = maze.length;
  const key = (x: number, y: number) => y * size + x;
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: [number, number][] = [start];
  visited.add(key(start[0], start[1]));

  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    if (cx === goal[0] && cy === goal[1]) {
      // reconstruct
      const path: [number, number][] = [];
      let k = key(cx, cy);
      let x = cx, y = cy;
      while (true) {
        path.unshift([x, y]);
        const pk = parent.get(k);
        if (pk === undefined) break;
        x = pk % size;
        y = Math.floor(pk / size);
        k = pk;
      }
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (maze[ny][nx] !== 0) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, key(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function MIB({ maze, spawnCell, playerPosition, speed, onCatchPlayer }: MIBProps) {
  const group = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(spawnCell[0] * CELL_SIZE, 0, spawnCell[1] * CELL_SIZE));
  const path = useRef<[number, number][] | null>(null);
  const pathIdx = useRef(0);
  const repathTimer = useRef(0);
  const caught = useRef(false);

  const playerCellOf = (p: [number, number, number]): [number, number] => [
    Math.max(0, Math.min(maze.length - 1, Math.round(p[0] / CELL_SIZE))),
    Math.max(0, Math.min(maze.length - 1, Math.round(p[2] / CELL_SIZE))),
  ];

  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Pre-build geometry — figure made from primitives
  const figure = useMemo(() => {
    return (
      <group>
        {/* shoes */}
        <mesh position={[-0.08, 0.02, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.04, 0.22]} />
          <meshStandardMaterial color="#050505" roughness={0.4} />
        </mesh>
        <mesh position={[0.08, 0.02, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.04, 0.22]} />
          <meshStandardMaterial color="#050505" roughness={0.4} />
        </mesh>
        {/* legs / pants */}
        <mesh position={[-0.08, 0.45, 0]} castShadow>
          <boxGeometry args={[0.16, 0.85, 0.16]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.7} />
        </mesh>
        <mesh position={[0.08, 0.45, 0]} castShadow>
          <boxGeometry args={[0.16, 0.85, 0.16]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.7} />
        </mesh>
        {/* torso / suit jacket */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.46, 0.55, 0.26]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.65} />
        </mesh>
        {/* shirt v */}
        <mesh position={[0, 1.18, 0.135]}>
          <boxGeometry args={[0.16, 0.32, 0.005]} />
          <meshStandardMaterial color="#e6e6e6" roughness={0.6} />
        </mesh>
        {/* black tie */}
        <mesh position={[0, 1.05, 0.138]}>
          <boxGeometry args={[0.05, 0.32, 0.005]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        {/* arms */}
        <mesh position={[-0.27, 1.1, 0]} castShadow>
          <boxGeometry args={[0.1, 0.55, 0.18]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.65} />
        </mesh>
        <mesh position={[0.27, 1.1, 0]} castShadow>
          <boxGeometry args={[0.1, 0.55, 0.18]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.65} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 1.46, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.1, 12]} />
          <meshStandardMaterial color="#9c8666" roughness={0.7} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#a08266" roughness={0.7} />
        </mesh>
        {/* black sunglasses */}
        <mesh position={[0, 1.65, 0.115]}>
          <boxGeometry args={[0.18, 0.05, 0.01]} />
          <meshStandardMaterial ref={headMatRef} color="#000" emissive="#220000" emissiveIntensity={0.3} roughness={0.2} metalness={0.3} />
        </mesh>
        {/* hat */}
        <mesh position={[0, 1.79, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.13, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.73, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.5} />
        </mesh>
      </group>
    );
  }, []);

  useFrame((_, delta) => {
    if (caught.current) return;
    const playerWorld = playerPosition.current;
    if (!playerWorld) return;

    repathTimer.current += delta;
    if (repathTimer.current > REPATH_INTERVAL || !path.current) {
      repathTimer.current = 0;
      const myCell: [number, number] = [
        Math.round(pos.current.x / CELL_SIZE),
        Math.round(pos.current.z / CELL_SIZE),
      ];
      const goalCell = playerCellOf(playerWorld);
      const newPath = bfs(maze, myCell, goalCell);
      if (newPath && newPath.length > 0) {
        path.current = newPath;
        pathIdx.current = 0;
      }
    }

    // Move toward next cell on path
    if (path.current && pathIdx.current < path.current.length) {
      const [tx, ty] = path.current[pathIdx.current];
      const target = new THREE.Vector3(tx * CELL_SIZE, 0, ty * CELL_SIZE);
      const toTarget = target.clone().sub(pos.current);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist < 0.1) {
        pathIdx.current += 1;
      } else {
        toTarget.normalize().multiplyScalar(speed * delta);
        pos.current.add(toTarget);
      }
    }

    if (group.current) {
      group.current.position.copy(pos.current);
      // Face the player
      const dx = playerWorld[0] - pos.current.x;
      const dz = playerWorld[2] - pos.current.z;
      group.current.rotation.y = Math.atan2(dx, dz);
    }

    // Catch check (player world position vs MIB)
    const dxp = playerWorld[0] - pos.current.x;
    const dzp = playerWorld[2] - pos.current.z;
    if (Math.hypot(dxp, dzp) < CATCH_DIST) {
      caught.current = true;
      onCatchPlayer();
    }
  });

  return <group ref={group}>{figure}</group>;
}
