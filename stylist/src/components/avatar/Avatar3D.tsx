import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Profile, WardrobeItem } from "@shared/types";
import { shade } from "@shared/color";
import { buildBody, type BodyModel } from "./bodyModel";
import { armFrame, armGeometry, ellipsoid, footLast, legGeometry, merge, sweepY, torsoSec } from "./geometry";
import { buildOutfit, type MeshSpec } from "./garments";
import { fabricTexture, materialFor } from "./textures";

export interface AvatarHandle {
  snapshot: () => string | null;
}

interface Props {
  profile: Profile;
  items: WardrobeItem[];
  autoRotate?: boolean;
  className?: string;
  interactive?: boolean;
}

export const Avatar3D = forwardRef<AvatarHandle, Props>(function Avatar3D({ profile, items, autoRotate, className, interactive = true }, ref) {
  const body = useMemo(() => buildBody(profile.body, profile.gender), [profile.body, profile.gender]);
  const snapRef = useRef<() => string | null>(() => null);
  useImperativeHandle(ref, () => ({ snapshot: () => snapRef.current() }), []);
  const H = body.H;
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        camera={{ position: [0, H * 0.56, H * 2.05], fov: 32, near: 0.05, far: 30 }}
      >
        <SnapshotBridge onReady={(fn) => (snapRef.current = fn)} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[1.8, 3.2, 2.6]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.04} />
        <directionalLight position={[-2.5, 1.8, -2]} intensity={0.9} color="#c9b1ff" />
        <directionalLight position={[-2, 1.2, 2]} intensity={0.4} color="#ffd9e4" />
        <Environment resolution={128}>
          <Lightformer intensity={1.6} position={[0, 3, 3]} scale={[4, 2, 1]} />
          <Lightformer intensity={0.8} position={[-3, 1, -1]} scale={[2, 3, 1]} color="#d8c8ff" />
          <Lightformer intensity={0.6} position={[3, 1, -2]} scale={[2, 3, 1]} color="#ffd6e2" />
        </Environment>
        <group>
          <Body body={body} profile={profile} items={items} />
        </group>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} receiveShadow>
          <circleGeometry args={[0.55, 64]} />
          <meshStandardMaterial color="#8a7aa8" transparent opacity={0.12} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={2.4} blur={2.2} far={1.5} resolution={512} />
        <OrbitControls
          target={[0, H * 0.5, 0]}
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          minDistance={0.8}
          maxDistance={H * 3}
          minPolarAngle={0.25}
          maxPolarAngle={1.75}
          autoRotate={autoRotate}
          autoRotateSpeed={1.4}
        />
      </Canvas>
    </div>
  );
});

function SnapshotBridge({ onReady }: { onReady: (fn: () => string | null) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/webp", 0.85);
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function Body({ body, profile, items }: { body: BodyModel; profile: Profile; items: WardrobeItem[] }) {
  const outfit = useMemo(() => buildOutfit(body, items), [body, items]);
  const skinGeo = useMemo(() => buildSkin(body, outfit.hideFeet), [body, outfit.hideFeet]);
  const hairGeo = useMemo(() => buildHair(body, profile, !!outfit.hatType), [body, profile, outfit.hatType]);
  const hands = useMemo(() => buildHands(body), [body]);

  useEffect(() => () => skinGeo.dispose(), [skinGeo]);
  useEffect(() => () => hairGeo?.dispose(), [hairGeo]);
  useEffect(() => () => outfit.meshes.forEach((m) => m.geometry.dispose()), [outfit]);

  const skin = profile.appearance.skinTone || "#e0b89c";
  return (
    <>
      <mesh geometry={skinGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color={skin} roughness={0.55} sheen={0.3} sheenColor={shade(skin, 0.3)} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={hands} castShadow>
        <meshPhysicalMaterial color={outfit.gloves ?? skin} roughness={outfit.gloves ? 0.5 : 0.55} side={THREE.DoubleSide} />
      </mesh>
      {hairGeo && (
        <mesh geometry={hairGeo} castShadow>
          <meshPhysicalMaterial color={profile.appearance.hairColor} roughness={0.5} sheen={0.8} sheenColor={shade(profile.appearance.hairColor, 0.4)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {outfit.meshes.map((m) => (
        <GarmentMesh key={m.key} spec={m} />
      ))}
    </>
  );
}

function GarmentMesh({ spec }: { spec: MeshSpec }) {
  const mat = materialFor(spec.pattern, spec.material);
  const color = spec.flatColor ?? spec.colors[0] ?? "#888";
  const map = spec.flatColor || spec.metal ? null : fabricTexture(spec.pattern, spec.colors);
  if (spec.metal)
    return (
      <mesh geometry={spec.geometry} castShadow>
        <meshStandardMaterial color={metalColor(spec.colors[0])} metalness={0.9} roughness={0.25} />
      </mesh>
    );
  return (
    <mesh geometry={spec.geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={map ? "#ffffff" : color}
        map={map}
        roughness={mat.roughness}
        metalness={mat.metalness}
        sheen={mat.sheen}
        sheenColor={shade(color, 0.35)}
        sheenRoughness={0.7}
        side={THREE.DoubleSide}
        transparent={spec.opacity != null && spec.opacity < 1}
        opacity={spec.opacity ?? 1}
        depthWrite={spec.opacity == null || spec.opacity >= 1}
      />
    </mesh>
  );
}

function metalColor(hex?: string) {
  if (!hex) return "#d4b87a";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r > b + 25 && g > b ? "#d9b56a" : "#cfd3d8";
}

function buildSkin(body: BodyModel, hideFeet: boolean): THREE.BufferGeometry {
  const L = body.levels;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(sweepY(L.crotch - 0.012, L.neckBase, 64, torsoSec(body, 0)));
  // промежность — закрываем низ туловища
  const bottom = ellipsoid(body.torso[0].a, 0.045, (body.torso[0].bf + body.torso[0].bb) / 2, [0, L.crotch - 0.01, -0.01], 24, Math.PI);
  parts.push(bottom);
  for (const side of [1, -1] as const) {
    parts.push(legGeometry(body, side, 0.02, L.crotch + 0.05, 0));
    parts.push(armGeometry(body, side, -0.04, 1, 0));
    if (!hideFeet) parts.push(footLast({ len: body.foot.len, width: body.foot.width, height: 0.055, x: side * body.legX, sole: 0.01 }));
  }
  // плечевые «шарниры», чтобы не было щели между рукой и туловищем
  for (const side of [1, -1] as const) {
    const { start } = armFrame(body, side);
    const r = body.arm.r[0].r * 1.05;
    parts.push(ellipsoid(r, r, r, [start.x, start.y + 0.005, start.z], 20, Math.PI));
  }
  // шея и голова
  const neck = new THREE.CylinderGeometry(body.neck.r * 1.04, body.neck.r * 1.12, body.neck.y1 - body.neck.y0, 24, 1, true);
  neck.translate(0, (body.neck.y0 + body.neck.y1) / 2, -0.005);
  parts.push(neck);
  const h = body.head;
  parts.push(ellipsoid(h.rx, h.ry, h.rz, [0, h.cy, 0], 40, Math.PI));
  // нос — лёгкий намёк на лицо манекена
  parts.push(ellipsoid(h.rx * 0.11, h.ry * 0.13, h.rz * 0.12, [0, h.cy - h.ry * 0.1, h.rz * 0.95], 12, Math.PI));
  return merge(parts);
}

function buildHands(body: BodyModel): THREE.BufferGeometry {
  const parts = ([1, -1] as const).map((side) => {
    const { start, dir } = armFrame(body, side);
    const p = start.clone().addScaledVector(dir, body.arm.len + 0.07);
    const g = ellipsoid(0.026, 0.085, 0.045, [0, 0, 0], 20, Math.PI);
    g.rotateZ(side * body.arm.angle);
    g.translate(p.x, p.y, p.z + 0.005);
    return g;
  });
  return merge(parts);
}

function buildHair(body: BodyModel, profile: Profile, hat: boolean): THREE.BufferGeometry | null {
  const h = body.head;
  const L = body.levels;
  const { hairLength, hairType } = profile.appearance;
  const vol = hairType === "curly" ? 1.18 : hairType === "wavy" ? 1.09 : 1.04;
  const parts: THREE.BufferGeometry[] = [];
  if (!hat) {
    const cap = ellipsoid(h.rx * vol * 1.04, h.ry * 1.05 * (hairType === "curly" ? 1.06 : 1), h.rz * vol * 1.06, [0, 0, 0], 40, Math.PI * 0.56);
    cap.rotateX(-0.32);
    cap.translate(0, h.cy + h.ry * 0.02, -h.rz * 0.06);
    parts.push(cap);
  }
  const bottomY = hairLength === "short" ? h.cy - h.ry * 0.55 : hairLength === "medium" ? L.shoulder + 0.02 : L.chest - 0.03;
  const topY = h.cy + h.ry * 0.35;
  const back = sweepY(
    bottomY,
    topY,
    24,
    (y) => {
      const u = (topY - y) / (topY - bottomY);
      const spread = hairLength === "short" ? 0 : Math.max(0, (h.cy - h.ry * 0.6 - y) * 0.35);
      return {
        a: h.rx * vol * (1.04 - u * 0.12) + spread,
        bf: h.rz * vol * 0.2,
        bb: h.rz * vol * (1.06 - u * (hairLength === "short" ? 0.35 : 0.15)) + (y < L.neckBase ? 0.03 : 0),
        cz: -h.rz * 0.08,
      };
    },
    { theta0: Math.PI * 0.42, thetaLen: Math.PI * 1.16, seg: 36 },
  );
  parts.push(back);
  return merge(parts);
}
