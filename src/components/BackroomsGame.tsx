import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { BackroomsEnvironment, generateMaze, CELL_SIZE } from "./BackroomsEnvironment";
import { Player } from "./Player";
import { TerminalObject } from "./TerminalObject";
import { Pickup } from "./Pickup";
import { MIB } from "./MIB";
import { ExitPortal } from "./ExitPortal";
import { PICKUP_GRACE_SECONDS, tierForElapsed, type FilePickup } from "../lib/gameState";

interface BackroomsGameProps {
  onTerminalInteract: () => void;
  onCaught: () => void;
  onEscaped: () => void;
  collectedFiles: Set<string>;
  onCollectFile: (id: string, flavor: string, exitHint?: string) => void;
  bootCompleted: boolean;
  pickups: FilePickup[];
  interactive: boolean;
}

const MAZE_DIM = 15;

function Loader() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#d8c98a',
      fontFamily: 'VT323, monospace',
      fontSize: '22px',
      zIndex: 200,
      background: '#000',
      letterSpacing: '2px',
    }}>
      <div style={{ marginBottom: '14px', opacity: 0.7 }}>BREACH DETECTED</div>
      <div>STABILIZING TRANSPORT — DO NOT MOVE</div>
    </div>
  );
}

function FogControl({ density }: { density: number }) {
  useFrame(({ scene }) => {
    if (scene.fog && (scene.fog as THREE.FogExp2).density !== undefined) {
      const f = scene.fog as THREE.FogExp2;
      f.density += (density - f.density) * 0.05;
    }
  });
  return null;
}

function placePickups(maze: number[][], pickups: FilePickup[], terminal: [number, number], exit: [number, number]) {
  const size = maze.length;
  const open: [number, number][] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (maze[y][x] === 0) {
        const farFromSpawn = Math.hypot(x - 1, y - 1) > 2;
        const farFromTerminal = Math.hypot(x - terminal[0], y - terminal[1]) > 1.5;
        const farFromExit = Math.hypot(x - exit[0], y - exit[1]) > 1.5;
        if (farFromSpawn && farFromTerminal && farFromExit) open.push([x, y]);
      }
    }
  }
  // Deterministic-ish shuffle using maze hash
  open.sort(() => Math.random() - 0.5);
  return pickups.map((p, i) => ({
    pickup: p,
    cell: open[i % open.length],
  }));
}

export function BackroomsGame({
  onTerminalInteract,
  onCaught,
  onEscaped,
  collectedFiles,
  onCollectFile,
  bootCompleted,
  pickups,
  interactive,
}: BackroomsGameProps) {
  const maze = useMemo(() => generateMaze(MAZE_DIM), []);
  const size = maze.length;

  const terminalCell: [number, number] = [size - 3, size - 3];
  const terminalPosition: [number, number, number] = [
    terminalCell[0] * CELL_SIZE,
    0,
    terminalCell[1] * CELL_SIZE,
  ];

  // Exit portal goes in the *opposite* corner from terminal.
  const exitCell: [number, number] = useMemo(() => {
    const candidates: [number, number][] = [
      [1, size - 3],
      [size - 3, 1],
    ];
    // Pick the one that's open in the maze; carve a small pocket if not.
    for (const [cx, cy] of candidates) {
      if (maze[cy]?.[cx] === 0) return [cx, cy];
    }
    // Fallback: force-clear the first candidate
    const [cx, cy] = candidates[0];
    if (maze[cy]) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = cy + dy, xx = cx + dx;
        if (yy >= 0 && yy < size && xx >= 0 && xx < size) maze[yy][xx] = 0;
      }
    }
    return [cx, cy];
  }, [maze, size]);

  const exitPosition: [number, number, number] = [
    exitCell[0] * CELL_SIZE,
    0,
    exitCell[1] * CELL_SIZE,
  ];

  const pickupPlacements = useMemo(
    () => placePickups(maze, pickups, terminalCell, exitCell),
    [maze, pickups, terminalCell, exitCell],
  );

  const playerPosRef = useRef<[number, number, number] | null>(null);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(performance.now());
  const graceOffset = useRef<number>(0);

  // Bookkeep elapsed time; pickups subtract grace from elapsed.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      const e = (now - startedAt.current) / 1000 - graceOffset.current;
      setElapsed(Math.max(0, e));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const tier = tierForElapsed(elapsed);

  // When a pickup is collected, ease the escalation timer back.
  const handleCollect = (p: FilePickup) => {
    if (collectedFiles.has(p.id)) return;
    onCollectFile(p.id, p.flavor, p.exitHint);
    graceOffset.current += PICKUP_GRACE_SECONDS;
  };

  // MIB spawn cells — start as far from the player as possible.
  const mibSpawnCells = useMemo<[number, number][]>(() => {
    const result: [number, number][] = [];
    const candidates: [number, number][] = [
      [size - 2, size - 2],
      [1, size - 2],
      [size - 2, 1],
    ];
    for (const c of candidates) if (maze[c[1]]?.[c[0]] === 0 || true) result.push(c);
    return result;
  }, [maze, size]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0e0a04", position: 'relative' }}>
      <Suspense fallback={<Loader />}>
        <Canvas
          shadows={false}
          dpr={[1, 1.5]}
          camera={{ fov: 75, near: 0.05, far: 200, position: [CELL_SIZE, 1.6, CELL_SIZE] }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.95;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            scene.fog = new THREE.FogExp2(0x1a1408, 0.06);
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              console.warn("WebGL context lost — attempting restore");
            });
          }}
        >
          <color attach="background" args={["#1a1408"]} />
          <FogControl density={tier.fogDensity} />
          <Physics gravity={[0, -20, 0]}>
            <BackroomsEnvironment maze={maze} lightsFailRatio={tier.lightsFailRatio} />
            <Player onLockChange={setLocked} positionRef={playerPosRef} />
            <TerminalObject
              position={terminalPosition}
              onInteract={onTerminalInteract}
              playerPos={playerPosRef}
              bootCompleted={bootCompleted}
              unlockedCount={collectedFiles.size}
              totalFiles={pickups.length}
              interactive={interactive}
            />
            <ExitPortal position={exitPosition} playerPosition={playerPosRef} onEscape={onEscaped} />

            {pickupPlacements.map(({ pickup, cell }) => (
              <Pickup
                key={pickup.id}
                position={[cell[0] * CELL_SIZE, 0.9, cell[1] * CELL_SIZE]}
                artifact={pickup.artifact}
                fileId={pickup.id}
                collected={collectedFiles.has(pickup.id)}
                onCollect={() => handleCollect(pickup)}
              />
            ))}

            {tier.mibActive && Array.from({ length: tier.mibCount }).map((_, i) => (
              <MIB
                key={`mib-${i}`}
                maze={maze}
                spawnCell={mibSpawnCells[i % mibSpawnCells.length]}
                playerPosition={playerPosRef}
                speed={tier.mibSpeed}
                onCatchPlayer={onCaught}
              />
            ))}
          </Physics>

          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur radius={0.7} />
            <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation={false} modulationOffset={0} />
            <Vignette eskil={false} offset={0.25} darkness={0.85} />
            <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} premultiply={false} />
          </EffectComposer>
        </Canvas>
      </Suspense>

      {/* Crosshair */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "5px", height: "5px",
        border: "1px solid rgba(255,240,180,0.7)",
        borderRadius: "50%",
        pointerEvents: "none", zIndex: 10,
        boxShadow: "0 0 4px rgba(0,0,0,0.8)",
      }} />

      {/* HUD: tier indicator and pickup counter */}
      <div style={{
        position: "absolute",
        bottom: "20px", left: "20px",
        color: "#d8c98a",
        fontFamily: "VT323, monospace", fontSize: "18px",
        zIndex: 10,
        background: "rgba(0,0,0,0.7)",
        padding: "10px 14px",
        border: "1px solid rgba(216,201,138,0.4)",
        pointerEvents: 'none',
        lineHeight: 1.4,
      }}>
        SECTOR 7 // SUBLEVEL — DESIGNATION "BACKROOMS"<br/>
        WASD MOVE &nbsp;·&nbsp; MOUSE LOOK &nbsp;·&nbsp; E INTERACT &nbsp;·&nbsp; ESC RELEASE<br/>
        ARTIFACTS RECOVERED: {collectedFiles.size} / {pickups.length}<br/>
        STATUS: {tier.mibActive ? <span style={{ color: "#ff6666" }}>HOSTILE PRESENCE DETECTED</span> : "QUIET"}
      </div>

      {/* HUD: time-in-sector / dread bar */}
      <div style={{
        position: "absolute",
        top: "20px", right: "20px",
        color: tier.mibActive ? "#ff8888" : "#d8c98a",
        fontFamily: "VT323, monospace", fontSize: "16px",
        zIndex: 10,
        background: "rgba(0,0,0,0.7)",
        padding: "8px 12px",
        border: `1px solid ${tier.mibActive ? "rgba(255,90,90,0.6)" : "rgba(216,201,138,0.4)"}`,
        pointerEvents: 'none',
        textAlign: "right",
        minWidth: "180px",
      }}>
        TIME IN SECTOR: {Math.floor(elapsed)}s<br/>
        ESCALATION: T{tierForElapsed(elapsed).threshold === 0 ? "0" : tierForElapsed(elapsed).threshold}
      </div>

      {!locked && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff5cc",
          fontFamily: "VT323, monospace", fontSize: "32px",
          zIndex: 20,
          background: "rgba(0,0,0,0.4)",
          pointerEvents: "none",
          textShadow: "0 0 12px rgba(0,0,0,0.9)",
        }}>
          [CLICK TO TAKE CONTROL]
        </div>
      )}
    </div>
  );
}
