import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  circuit,
  forward,
  projectile,
  samples,
  type State,
} from "../../shared/simulation";
export type ViewControls = {
  rotate: (x: number, y: number) => void;
  reset: () => void;
  zoom: (factor: number) => void;
};
const lime = 0xc8f582,
  teal = 0x79d9c4;
function line(points: THREE.Vector3[], color: number, opacity = 1) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}
function label(
  text: string,
  x: number,
  y: number,
  z: number,
  color = "#a6b4a7",
  size = 0.38,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext("2d")!;
  c.font = "500 34px monospace";
  c.fillStyle = color;
  c.textAlign = "center";
  c.fillText(text, 256, 61);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.position.set(x, y, z);
  sprite.scale.set((size * 512) / 96, size, 1);
  return sprite;
}
function sphere(radius: number, color: number) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.15,
    }),
  );
}
function disposeGroup(group: THREE.Group) {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.filter(Boolean).forEach((m) => {
      if ("map" in m) (m.map as THREE.Texture | null)?.dispose();
      m.dispose();
    });
  });
  group.clear();
}
export default function Scene({
  state,
  controlsRef,
  onInspect,
}: {
  state: State;
  controlsRef: MutableRefObject<ViewControls | null>;
  onInspect?: (element: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    stateRef = useRef(state),
    [error, setError] = useState(false);
  stateRef.current = state;
  const inspectRef = useRef(onInspect);
  inspectRef.current = onInspect;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x101711, 0);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 250);
    camera.position.set(13, 10, 18);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);
    controls.minDistance = 6;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enablePan = true;
    const reset = () => {
      camera.position
        .set(13, 10, 18)
        .multiplyScalar(Math.max(1, 1.65 / camera.aspect));
      controls.target.set(0, 2, 0);
      controls.update();
    };
    controlsRef.current = {
      reset,
      rotate: (x, y) => {
        const offset = camera.position.clone().sub(controls.target),
          s = new THREE.Spherical().setFromVector3(offset);
        s.theta += x;
        s.phi = THREE.MathUtils.clamp(s.phi + y, 0.15, Math.PI * 0.49);
        camera.position.copy(
          new THREE.Vector3().setFromSpherical(s).add(controls.target),
        );
        controls.update();
      },
      zoom: (factor) => {
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
      },
    };
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xe5ffd0, 3);
    light.position.set(5, 12, 8);
    scene.add(light);
    const grid = new THREE.GridHelper(30, 30, 0x3e5140, 0x243229);
    scene.add(grid);
    const group = new THREE.Group();
    scene.add(group);
    const raycaster = new THREE.Raycaster();
    const inspect = (x: number, y: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
        return;
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          (-(y - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(group.children, true)
        .find((h) => h.object.userData.inspect);
      if (hit) inspectRef.current?.(hit.object.userData.inspect);
    };
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7)
        inspect(e.clientX, e.clientY);
    };
    const handInspect = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail;
      inspect(x, y);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    document.addEventListener("mindscope:inspect", handInspect);
    let lastKey = "",
      lastConcept = "";
    let moving: THREE.Mesh | undefined,
      particles: THREE.Mesh[] = [];
    let path: THREE.Vector3[] = [];
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      const oldFit = Math.max(1, 1.65 / camera.aspect);
      camera.aspect = w / h;
      const newFit = Math.max(1, 1.65 / camera.aspect);
      camera.position
        .sub(controls.target)
        .multiplyScalar(newFit / oldFit)
        .add(controls.target);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    function rebuild(s: State) {
      disposeGroup(group);
      moving = undefined;
      particles = [];
      path = [];
      if (s.concept === "projectile") {
        const p = s.params.projectile,
          r = projectile(p),
          all = [p, ...s.comparisons],
          maxRange = Math.max(...all.map((v) => projectile(v).range)),
          maxHeight = Math.max(...all.map((v) => projectile(v).height));
        const scale = 12 / Math.max(maxRange, maxHeight * 1.7, 10),
          offset = (-maxRange * scale) / 2;
        const trajectory = (v: typeof p, color: number, opacity: number) => {
          const m = projectile(v),
            points = Array.from({ length: 101 }, (_, i) => {
              const t = (m.flight * i) / 100;
              return new THREE.Vector3(
                offset + m.vx * t * scale,
                0.12 + (m.vy * t - (v.gravity * t * t) / 2) * scale,
                0,
              );
            });
          group.add(line(points, color, opacity));
          return points;
        };
        s.comparisons.forEach((v, i) =>
          trajectory(v, [0x77c4ed, 0xe7b481, 0xc3a0ed][i], 0.65),
        );
        path = trajectory(p, lime, 1);
        const ground = line(
          [
            new THREE.Vector3(offset, 0.05, 0),
            new THREE.Vector3(offset + r.range * scale, 0.05, 0),
          ],
          0x72905b,
          0.7,
        );
        group.add(ground);
        for (let i = 0; i <= 4; i++) {
          const x = offset + (r.range * scale * i) / 4;
          group.add(
            line(
              [new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, -0.3)],
              0x879c7b,
            ),
          );
          group.add(
            label(`${((r.range * i) / 4).toFixed(1)} m`, x, 0.02, 0.75),
          );
        }
        const apex = path[50];
        group.add(line([new THREE.Vector3(apex.x, 0, 0), apex], 0x72905b, 0.5));
        group.add(
          label(
            `H = ${r.height.toFixed(2)} m`,
            apex.x,
            apex.y + 0.65,
            0,
            "#d3efb8",
            0.46,
          ),
        );
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.55, 0.12, 32),
          new THREE.MeshStandardMaterial({
            color: 0x66864b,
            metalness: 0.5,
            roughness: 0.3,
          }),
        );
        pad.position.set(offset, 0.06, 0);
        group.add(pad);
        const landing = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.025, 8, 40),
          new THREE.MeshBasicMaterial({ color: lime }),
        );
        landing.rotation.x = Math.PI / 2;
        landing.position.set(offset + r.range * scale, 0.03, 0);
        group.add(landing);
        moving = sphere(0.19, lime);
        moving.userData.inspect = "projectile";
        pad.userData.inspect = "launch";
        group.add(moving);
        group.add(label("LAUNCH", offset, 0.02, 1.4, "#c8f582"));
        group.add(label("LANDING", offset + r.range * scale, 0.02, 1.4));
      } else if (s.concept === "circuit") {
        const p = s.params.circuit,
          r = circuit(p);
        const wireColor = 0x91b9a3;
        const route = p.parallel
          ? [
              [-5, 1, 0],
              [-5, 5, 0],
              [5, 5, 0],
              [5, 1, 0],
              [-5, 1, 0],
            ]
          : [
              [-5, 1, 0],
              [-5, 4, 0],
              [5, 4, 0],
              [5, 1, 0],
              [-5, 1, 0],
            ];
        path = route.map(
          (v) => new THREE.Vector3(...(v as [number, number, number])),
        );
        group.add(line(path, wireColor));
        if (p.parallel)
          group.add(
            line(
              [new THREE.Vector3(-5, 3, 0), new THREE.Vector3(5, 3, 0)],
              wireColor,
            ),
          );
        const resistor = (
          x: number,
          y: number,
          value: number,
          name: string,
        ) => {
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 0.48, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xe5ba83, roughness: 0.6 }),
          );
          body.userData.inspect = name;
          body.position.set(x, y, 0);
          group.add(body);
          for (const dx of [-0.55, -0.25, 0.3]) {
            const band = new THREE.Mesh(
              new THREE.BoxGeometry(0.13, 0.5, 0.52),
              new THREE.MeshBasicMaterial({
                color: dx === 0.3 ? 0xa06b39 : 0x434a39,
              }),
            );
            band.position.set(x + dx, y, 0);
            group.add(band);
          }
          group.add(
            label(`${name} · ${value} Ω`, x, y + 0.65, 0, "#ecd6b8", 0.5),
          );
        };
        resistor(p.parallel ? 0 : -2, p.parallel ? 5 : 4, p.r1, "R₁");
        resistor(p.parallel ? 0 : 2, p.parallel ? 3 : 4, p.r2, "R₂");
        const battery = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1.3, 0.65),
          new THREE.MeshStandardMaterial({ color: lime }),
        );
        battery.userData.inspect = "battery";
        battery.position.set(-5, 2.2, 0);
        group.add(battery);
        group.add(label(`${p.voltage} V`, -6.1, 2.3, 0, "#c8f582"));
        group.add(
          label(`I = ${r.current.toFixed(3)} A`, 0, 0.3, 0, "#c8f582", 0.55),
        );
        group.add(label("+", -5, 3.2, 0, "#c8f582"));
        for (let i = 0; i < 16; i++) {
          const dot = sphere(0.065, teal);
          group.add(dot);
          particles.push(dot);
        }
      } else {
        const n = s.network,
          sample = s.params.network.sample,
          f = forward(n, samples[sample]);
        const positions = [
          samples[sample].map(
            (_, i) => new THREE.Vector3(-5, 1.8 + i * 2.5, 0),
          ),
          f.hidden.map((_, i) => new THREE.Vector3(0, 0.7 + i * 1.5, 0)),
          [new THREE.Vector3(5, 2.95, 0)],
        ];
        positions[0].forEach((a, i) =>
          positions[1].forEach((b, j) =>
            group.add(
              line(
                [a, b],
                n.w1[j][i] > 0 ? lime : 0x88a9d7,
                Math.min(0.8, 0.15 + Math.abs(n.w1[j][i]) / 8),
              ),
            ),
          ),
        );
        positions[1].forEach((a, j) =>
          group.add(
            line(
              [a, positions[2][0]],
              n.w2[j] > 0 ? lime : 0x88a9d7,
              Math.min(0.9, 0.15 + Math.abs(n.w2[j]) / 8),
            ),
          ),
        );
        const values = [samples[sample], f.hidden, [f.output]];
        positions.forEach((layer, l) =>
          layer.forEach((p, i) => {
            const node = sphere(
              l === 1 ? 0.38 : 0.48,
              new THREE.Color(0x294a39)
                .lerp(new THREE.Color(lime), values[l][i])
                .getHex(),
            );
            node.userData.inspect =
              l === 0
                ? `input ${i + 1}`
                : l === 1
                  ? `hidden neuron ${i + 1}`
                  : "output";
            node.position.copy(p);
            group.add(node);
            group.add(
              label(
                values[l][i].toFixed(l === 0 ? 0 : 2),
                p.x,
                p.y,
                p.z + 0.55,
                "#f5ffe9",
                0.42,
              ),
            );
          }),
        );
        group.add(label("INPUT", -5, 6.5, 0));
        group.add(label("HIDDEN · SIGMOID", 0, 6.5, 0));
        group.add(label("OUTPUT", 5, 6.5, 0));
        group.add(label("2 → 4 → 1", 0, -0.1, 0, "#c8f582", 0.55));
      }
    }
    let raf = 0;
    const animate = () => {
      const s = stateRef.current;
      if (lastConcept !== s.concept) {
        lastConcept = s.concept;
        reset();
      }
      const key = JSON.stringify([
        s.concept,
        s.params,
        s.comparisons,
        s.concept === "network" ? s.network : 0,
      ]);
      if (key !== lastKey) {
        rebuild(s);
        lastKey = key;
      }
      if (moving && path.length) {
        const t = s.time / projectile(s.params.projectile).flight,
          index = Math.min(99, Math.floor(t * 100));
        moving.position
          .copy(path[index])
          .lerp(path[index + 1], Math.min(1, t * 100 - index));
      }
      if (particles.length) {
        const makeCurve = (points: THREE.Vector3[]) => {
          const curve = new THREE.CurvePath<THREE.Vector3>();
          points
            .slice(1)
            .forEach((point, i) =>
              curve.add(new THREE.LineCurve3(points[i], point)),
            );
          return curve;
        };
        const outer = makeCurve(path),
          values = circuit(s.params.circuit);
        const inner = s.params.circuit.parallel
          ? makeCurve([
              new THREE.Vector3(-5, 1, 0),
              new THREE.Vector3(-5, 3, 0),
              new THREE.Vector3(5, 3, 0),
              new THREE.Vector3(5, 1, 0),
              new THREE.Vector3(-5, 1, 0),
            ])
          : outer;
        particles.forEach((particle, i) => {
          const branch = s.params.circuit.parallel && i >= particles.length / 2;
          const curve = branch ? inner : outer;
          const current = s.params.circuit.parallel
            ? branch
              ? values.i2
              : values.i1
            : values.current;
          const count = s.params.circuit.parallel
            ? particles.length / 2
            : particles.length;
          particle.position.copy(
            curve.getPoint((s.time * current * 0.1 + (i % count) / count) % 1),
          );
        });
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      document.removeEventListener("mindscope:inspect", handInspect);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      cancelAnimationFrame(raf);
      observer.disconnect();
      disposeGroup(group);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      controlsRef.current = null;
    };
  }, [controlsRef]);
  return (
    <div
      className="scene-canvas"
      ref={host}
      role="img"
      aria-label={`Interactive 3D ${state.concept} simulation. Drag to orbit, scroll to zoom.`}
    >
      {error && (
        <div className="webgl-error">
          3D rendering needs WebGL. Try enabling hardware acceleration. The
          parameter controls and calculated results still work.
        </div>
      )}
    </div>
  );
}
