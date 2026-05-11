import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { RigidBody, type RapierRigidBody, CapsuleCollider } from "@react-three/rapier";
import * as THREE from "three";

interface PlayerProps {
  onLockChange?: (locked: boolean) => void;
  positionRef?: React.MutableRefObject<[number, number, number] | null>;
}

const MOVE_SPEED = 6;
const SPAWN: [number, number, number] = [4, 1.2, 4];

export function Player({ onLockChange, positionRef }: PlayerProps) {
  const rb = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const keys = useRef({ forward: false, backward: false, left: false, right: false });

  useEffect(() => {
    const isPlaying = () => document.pointerLockElement !== null;

    const onDown = (e: KeyboardEvent) => {
      if (!isPlaying()) return;
      switch (e.code) {
        case "KeyW": case "ArrowUp": keys.current.forward = true; break;
        case "KeyS": case "ArrowDown": keys.current.backward = true; break;
        case "KeyA": case "ArrowLeft": keys.current.left = true; break;
        case "KeyD": case "ArrowRight": keys.current.right = true; break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": keys.current.forward = false; break;
        case "KeyS": case "ArrowDown": keys.current.backward = false; break;
        case "KeyA": case "ArrowLeft": keys.current.left = false; break;
        case "KeyD": case "ArrowRight": keys.current.right = false; break;
      }
    };
    const clearKeys = () => {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    // When pointer lock is released (terminal opens, Escape pressed), drop
    // any in-flight key state so the player doesn't keep drifting.
    document.addEventListener("pointerlockchange", clearKeys);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      document.removeEventListener("pointerlockchange", clearKeys);
    };
  }, []);

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const bobPhase = useRef(0);

  useFrame((_, delta) => {
    const body = rb.current;
    if (!body) return;
    const t = body.translation();
    if (!t || Number.isNaN(t.x)) return;

    const v = body.linvel();

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
    if (moving) dir.normalize().multiplyScalar(MOVE_SPEED);

    body.setLinvel({ x: dir.x, y: v.y, z: dir.z }, true);

    // Head bob — only when moving on the ground.
    if (moving) bobPhase.current += delta * 9;
    const bob = moving ? Math.sin(bobPhase.current) * 0.025 : 0;
    camera.position.set(t.x, t.y + 0.9 + bob, t.z);

    if (positionRef) positionRef.current = [t.x, t.y, t.z];
  });

  return (
    <>
      <PointerLockControls
        onLock={() => onLockChange?.(true)}
        onUnlock={() => onLockChange?.(false)}
      />
      <RigidBody
        ref={rb}
        colliders={false}
        position={SPAWN}
        enabledRotations={[false, false, false]}
        mass={1}
        type="dynamic"
        linearDamping={4}
        friction={0.2}
      >
        <CapsuleCollider args={[0.4, 0.4]} />
      </RigidBody>
    </>
  );
}
