import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { terminal, type Board, type Solution } from "../../shared/circuitLab";
import type { ViewControls } from "../components/Scene";
function textSprite(text: string, color = "#a8eefa", size = 0.38) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "500 29px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 48);
  const texture = new T.CanvasTexture(canvas);
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(size * 6.4, size, 1);
  return sprite;
}
function material(color: number, opacity = 0.45) {
  return new T.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity,
    metalness: 0.35,
    roughness: 0.35,
    depthWrite: false,
  });
}
function dispose(group: T.Group) {
  group.traverse((o) => {
    const m = o as T.Mesh;
    m.geometry?.dispose();
    (Array.isArray(m.material) ? m.material : [m.material])
      .filter(Boolean)
      .forEach((mat) => {
        if ("map" in mat) (mat.map as T.Texture)?.dispose();
        mat.dispose();
      });
  });
  group.clear();
}
export default function CircuitWorld({
  board,
  solution,
  selected,
  pending,
  running,
  controlsRef,
  onSelect,
  onMove,
  onTerminal,
  onDrop,
}: {
  board: Board;
  solution: Solution;
  selected: string | null;
  pending: string | null;
  running: boolean;
  controlsRef: MutableRefObject<ViewControls | null>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onTerminal: (terminal: string) => void;
  onDrop: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef({
      board,
      solution,
      selected,
      pending,
      running,
      onSelect,
      onMove,
      onTerminal,
      onDrop,
    }),
    [error, setError] = useState(false);
  live.current = {
    board,
    solution,
    selected,
    pending,
    running,
    onSelect,
    onMove,
    onTerminal,
    onDrop,
  };
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(40, 1, 0.1, 150);
    camera.position.set(1, 16, 17);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, 0, 0);
    orbit.minDistance = 7;
    orbit.maxDistance = 45;
    orbit.maxPolarAngle = Math.PI * 0.46;
    orbit.minPolarAngle = 0.2;
    scene.add(new T.AmbientLight(0x9cd9ff, 2));
    const light = new T.PointLight(0x8ceaff, 50);
    light.position.set(0, 8, 2);
    scene.add(light);
    const grid = new T.GridHelper(44, 44, 0x286578, 0x12313e);
    scene.add(grid);
    const content = new T.Group();
    scene.add(content);
    const ray = new T.Raycaster(),
      plane = new T.Plane(new T.Vector3(0, 1, 0), -0.3);
    let dragging: string | null = null,
      offset = new T.Vector3(),
      frame = 0,
      key = "",
      particles: { mesh: T.Mesh; x: number; z: number; speed: number }[] = [],
      last = performance.now(),
      elapsed = 0;
    const reset = () => {
      camera.position
        .set(1, 16, 17)
        .multiplyScalar(
          Math.max(1, (el.clientWidth < 650 ? 1.2 : 1.5) / camera.aspect),
        );
      orbit.target.set(0, 0, 0);
      orbit.update();
    };
    function point(x: number, y: number) {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((x - r.left) / r.width) * 2 - 1,
          (-(y - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    }
    function interact(phase: "start" | "move" | "end", x: number, y: number) {
      if (phase === "end") {
        const had = !!dragging;
        if (had) live.current.onDrop();
        dragging = null;
        orbit.enabled = true;
        return had;
      }
      const pos = point(x, y);
      if (phase === "start") {
        const hit = ray
          .intersectObjects(content.children, true)
          .find((h) => h.object.userData.part || h.object.userData.terminal);
        if (!hit) return false;
        const { part, terminal: port } = hit.object.userData;
        if (port) {
          live.current.onTerminal(port);
          return true;
        }
        live.current.onSelect(part);
        dragging = part;
        const p = live.current.board.parts.find((p) => p.id === part)!;
        offset = pos ? new T.Vector3(p.x, 0.3, p.y).sub(pos) : new T.Vector3();
        orbit.enabled = false;
        return true;
      }
      if (dragging && pos) {
        pos.add(offset);
        live.current.onMove(
          dragging,
          Math.max(-10, Math.min(10, pos.x)),
          Math.max(-7, Math.min(7, pos.z)),
        );
        return true;
      }
      return false;
    }
    controlsRef.current = {
      reset,
      zoom: (factor) => {
        camera.position
          .sub(orbit.target)
          .multiplyScalar(factor)
          .add(orbit.target);
        orbit.update();
      },
      rotate: (x, y) => {
        const s = new T.Spherical().setFromVector3(
          camera.position.clone().sub(orbit.target),
        );
        s.theta += x;
        s.phi = T.MathUtils.clamp(s.phi + y, 0.2, Math.PI * 0.46);
        camera.position.copy(
          new T.Vector3().setFromSpherical(s).add(orbit.target),
        );
        orbit.update();
      },
      pan: (dx, dy) => {
        const scale =
          (2 *
            camera.position.distanceTo(orbit.target) *
            Math.tan(T.MathUtils.degToRad(camera.fov / 2))) /
          el.clientHeight;
        const delta = new T.Vector3()
          .setFromMatrixColumn(camera.matrix, 0)
          .multiplyScalar(-dx * scale)
          .add(
            new T.Vector3()
              .setFromMatrixColumn(camera.matrix, 1)
              .multiplyScalar(dy * scale),
          );
        camera.position.add(delta);
        orbit.target.add(delta);
        orbit.update();
      },
      interact,
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (interact("start", e.clientX, e.clientY)) {
        renderer.domElement.setPointerCapture(e.pointerId);
        e.stopImmediatePropagation();
      }
    };
    const move = (e: PointerEvent) => {
      if (dragging) {
        interact("move", e.clientX, e.clientY);
        e.stopImmediatePropagation();
      }
    };
    const up = (e: PointerEvent) => interact("end", e.clientX, e.clientY);
    renderer.domElement.addEventListener("pointerdown", down, true);
    renderer.domElement.addEventListener("pointermove", move, true);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    const resize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.setViewOffset(
        el.clientWidth,
        el.clientHeight,
        0,
        el.clientWidth < 650 ? -65 : 0,
        el.clientWidth,
        el.clientHeight,
      );
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      reset();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    function build() {
      dispose(content);
      particles = [];
      const { board: b, solution: s, selected, pending } = live.current;
      for (const w of b.wires) {
        const a = terminal(b, w.a),
          c = terminal(b, w.b);
        const points = [
          new T.Vector3(a.x, 0.3, a.y),
          new T.Vector3(a.x, 0.3, (a.y + c.y) / 2),
          new T.Vector3(c.x, 0.3, (a.y + c.y) / 2),
          new T.Vector3(c.x, 0.3, c.y),
        ];
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints(points),
          new T.LineBasicMaterial({
            color:
              s.status === "short"
                ? 0xff8469
                : s.potentials[w.a] === null
                  ? 0x375564
                  : 0x59d9ef,
            transparent: true,
            opacity: 0.65,
          }),
        );
        content.add(line);
      }
      for (const p of b.parts) {
        const group = new T.Group();
        group.position.set(p.x, 0.4, p.y);
        const active = p.id === selected,
          color = active ? 0xffce82 : 0x65dcf7;
        const base = new T.Mesh(
          new T.CylinderGeometry(1.0, 1.0, 0.04, 48),
          new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.06 }),
        );
        base.position.y = -0.3;
        group.add(base);
        const ring = new T.Mesh(
          new T.TorusGeometry(1.0, 0.012, 6, 64),
          new T.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: active ? 0.85 : 0.25,
          }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.25;
        group.add(ring);
        let geometry: T.BufferGeometry =
          p.kind === "battery"
            ? new T.CylinderGeometry(0.4, 0.4, 1.2, 32)
            : p.kind === "bulb"
              ? new T.SphereGeometry(0.5, 32, 24)
              : new T.BoxGeometry(1.5, 0.28, 0.5);
        const body = new T.Mesh(
          geometry,
          material(
            p.kind === "bulb" ? 0xffdb8d : color,
            p.kind === "switch" ? 0.65 : 0.3,
          ),
        );
        if (p.kind === "battery") body.rotation.z = Math.PI / 2;
        if (p.kind === "switch" && !p.closed) body.rotation.y = -0.5;
        body.userData.part = p.id;
        group.add(body);
        const edges = new T.LineSegments(
          new T.EdgesGeometry(geometry),
          new T.LineBasicMaterial({
            color: p.kind === "bulb" ? 0xffdb8d : color,
            transparent: true,
            opacity: 0.8,
          }),
        );
        edges.rotation.copy(body.rotation);
        group.add(edges);
        if (p.kind === "resistor") {
          for (const x of [-0.4, 0, 0.4]) {
            const band = new T.Mesh(
              new T.BoxGeometry(0.05, 0.32, 0.55),
              new T.MeshBasicMaterial({ color }),
            );
            band.position.x = x;
            band.userData.part = p.id;
            group.add(band);
          }
        }
        if (p.kind === "bulb") {
          const power = s.readings[p.id]?.power ?? 0;
          const glow = new T.Mesh(
            new T.SphereGeometry(0.35, 24, 16),
            new T.MeshBasicMaterial({
              color: 0xffd18a,
              transparent: true,
              opacity: Math.min(0.9, power / 4),
            }),
          );
          glow.userData.part = p.id;
          group.add(glow);
        }
        for (const [side, x] of [
          ["a", -1.15],
          ["b", 1.15],
        ] as const) {
          const port = new T.Mesh(
            new T.SphereGeometry(0.15, 18, 12),
            new T.MeshBasicMaterial({
              color: pending === p.id + ":" + side ? 0xffc27b : 0xa5f0ff,
            }),
          );
          port.position.set(x, 0, 0);
          port.userData.terminal = p.id + ":" + side;
          group.add(port);
          const lead = new T.Line(
            new T.BufferGeometry().setFromPoints([
              new T.Vector3(x, 0, 0),
              new T.Vector3(x * 0.55, 0, 0),
            ]),
            new T.LineBasicMaterial({ color }),
          );
          group.add(lead);
          const tag = textSprite(
            p.kind === "battery"
              ? side === "a"
                ? "+"
                : "−"
              : side.toUpperCase(),
            "#83b7c6",
            0.19,
          );
          tag.position.set(x, 0.28, 0.25);
          group.add(tag);
        }
        const label = textSprite(
          `${p.id} / ${p.kind.toUpperCase()}`,
          active ? "#ffce82" : "#bcf2ff",
          0.32,
        );
        label.position.set(0, 1, 0);
        group.add(label);
        const reading = s.readings[p.id];
        const units =
          p.kind === "battery"
            ? `${p.value} V`
            : p.kind === "switch"
              ? p.closed
                ? "CLOSED"
                : "OPEN"
              : `${p.value} Ω · ${reading?.current === null ? "FLOATING" : Math.abs(reading?.current ?? 0).toFixed(3) + " A"}`;
        const sub = textSprite(units, "#6fa5b4", 0.26);
        sub.position.set(0, -0.05, 1);
        group.add(sub);
        if (reading?.current && p.kind !== "battery" && p.kind !== "switch") {
          for (let i = 0; i < 4; i++) {
            const dot = new T.Mesh(
              new T.SphereGeometry(0.055, 10, 8),
              new T.MeshBasicMaterial({ color: 0xd9faff }),
            );
            content.add(dot);
            particles.push({
              mesh: dot,
              x: p.x,
              z: p.y,
              speed: reading.current,
            });
            dot.userData.phase = i / 4;
          }
        }
        content.add(group);
      }
    }
    const animate = () => {
      const now = performance.now();
      if (live.current.running) elapsed += (now - last) / 1000;
      last = now;
      const nextKey = JSON.stringify([
        live.current.board,
        live.current.selected,
        live.current.pending,
      ]);
      if (nextKey !== key) {
        build();
        key = nextKey;
      }
      for (const p of particles) {
        const f =
          (((elapsed *
            Math.sign(p.speed) *
            Math.min(1.5, Math.abs(p.speed) * 2) +
            p.mesh.userData.phase) %
            1) +
            1) %
          1;
        p.mesh.position.set(p.x + (f - 0.5) * 2.3, 0.75, p.z);
        p.mesh.visible = live.current.running;
      }
      orbit.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointermove", move, true);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      dispose(content);
      grid.geometry.dispose();
      (grid.material as T.Material).dispose();
      orbit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      controlsRef.current = null;
    };
  }, [controlsRef]);
  return (
    <div
      className="scene-canvas circuit-world"
      ref={host}
      role="img"
      aria-label="Circuit sandbox. Drag components to move them. Select two terminals to wire them together. Drag empty space to orbit."
    >
      {error && (
        <div className="world-error">
          WebGL is unavailable. You can still build and inspect the circuit
          using the component tray and terminal controls.
        </div>
      )}
    </div>
  );
}
