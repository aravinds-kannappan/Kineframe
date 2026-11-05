import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import { X, Glasses } from "lucide-react";
import { services, type Focus, type Workspace } from "../../shared/workspace";
type Props = {
  state: Workspace;
  onClose: () => void;
  onFocus: (focus: Focus) => void;
  onAction: (a: Record<string, unknown>) => void;
  onVoice: () => void;
};
export default function SpatialRoom(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef(props);
  const [error, setError] = useState("");
  live.current = props;
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "WebGL is unavailable. The desktop workspace remains fully functional.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.xr.enabled = true;
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color("#080f19");
    scene.fog = new T.Fog("#080f19", 15, 40);
    const camera = new T.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 2.8, 5);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 1.5, -3);
    orbit.enableDamping = true;
    orbit.minDistance = 2;
    orbit.maxDistance = 12;
    scene.add(new T.HemisphereLight(0xb3e6ff, 0x111827, 3));
    const grid = new T.GridHelper(40, 40, 0x315165, 0x142334);
    scene.add(grid);
    const targets: T.Mesh[] = [];
    const textures: T.CanvasTexture[] = [];
    function panel(
      width: number,
      height: number,
      x: number,
      y: number,
      z: number,
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = Math.round((1024 * height) / width);
      const ctx = canvas.getContext("2d")!,
        texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      textures.push(texture);
      const mesh = new T.Mesh(
        new T.PlaneGeometry(width, height),
        new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return { mesh, ctx, canvas, texture, width };
    }
    type Panel = ReturnType<typeof panel>;
    function paint(
      p: Panel,
      title: string,
      lines: string[],
      accent = "#71d6db",
    ) {
      const { ctx, canvas } = p;
      ctx.fillStyle = "#111e2c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#30495d";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      ctx.fillStyle = accent;
      ctx.textAlign = "left";
      if (p.width < 2) {
        ctx.textAlign = "center";
        ctx.font = "600 70px sans-serif";
        ctx.fillText(
          title,
          canvas.width / 2,
          lines.length ? 190 : canvas.height / 2 + 25,
          canvas.width - 60,
        );
        ctx.fillStyle = "#b6c7dc";
        ctx.font = "45px sans-serif";
        if (lines[0])
          ctx.fillText(lines[0], canvas.width / 2, 280, canvas.width - 60);
        p.texture.needsUpdate = true;
        return;
      }
      ctx.font = "600 30px sans-serif";
      ctx.fillText(title, 35, 53);
      ctx.fillStyle = "#e0eaf0";
      ctx.font = "25px monospace";
      let y = 100;
      for (const line of lines) {
        const words = line.split(" ");
        let row = "";
        for (const word of words) {
          if (ctx.measureText(row + word).width > canvas.width - 70) {
            if (y < canvas.height - 20) ctx.fillText(row, 35, y);
            y += 37;
            row = "";
          }
          row += word + " ";
        }
        if (y < canvas.height - 20) ctx.fillText(row, 35, y);
        y += 40;
      }
      p.texture.needsUpdate = true;
    }
    const evidence = panel(2.7, 2.3, -3.35, 2.8, -2.8);
    evidence.mesh.rotation.y = 0.35;
    const feed = panel(2.7, 2.3, 3.35, 2.8, -2.8);
    feed.mesh.rotation.y = -0.35;
    const source = panel(4.4, 2.3, 0, 2.8, -5.1);
    const nodes = services.map((service) => {
      const p = panel(
        1.45,
        0.5,
        service.x * 0.68,
        1.0 + service.y * 0.22,
        -3.25,
      );
      p.mesh.userData.focus = service.id;
      targets.push(p.mesh);
      return { service, p };
    });
    const actions = [
      { label: "RUN CHECKS", key: "verify" },
      { label: "PROPOSE FIX", key: "propose" },
      { label: "APPLY PATCH", key: "apply" },
      { label: "INTERRUPT", key: "stop" },
      { label: "ASK BY VOICE", key: "voice" },
    ].map((a, i) => {
      const p = panel(1.05, 0.34, (i - 2) * 1.18, 0.45, -2.3);
      p.mesh.userData.action = a.key;
      targets.push(p.mesh);
      paint(p, a.label, []);
      return { ...a, p };
    });
    const ray = new T.Raycaster(),
      rotation = new T.Matrix4();
    const dispatch = (mesh: T.Mesh) => {
      if (mesh.userData.focus) {
        live.current.onFocus(mesh.userData.focus);
        return;
      }
      const s = live.current.state,
        key = mesh.userData.action;
      if (key === "voice") {
        live.current.onVoice();
        return;
      }
      if (s.busy && key !== "stop") return;
      if (key === "apply") {
        if (s.proposal)
          live.current.onAction({
            type: "apply",
            id: s.proposal.id,
            version: s.version,
          });
      } else if (key === "propose") {
        if (!s.fixed)
          live.current.onAction({
            type: "propose",
            kind: s.scenario === "pool" ? "release" : "budget",
          });
      } else live.current.onAction({ type: key });
    };
    function hit(controller: T.Group) {
      rotation.identity().extractRotation(controller.matrixWorld);
      ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      return ray.intersectObjects(targets, false)[0]?.object as
        T.Mesh | undefined;
    }
    const controllers: T.Group[] = [];
    const held = new Map<T.Group, T.Mesh>();
    const handFactory = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      controllers.push(controller);
      scene.add(controller);
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(),
          new T.Vector3(0, 0, -8),
        ]),
        new T.LineBasicMaterial({
          color: 0x73dbe0,
          transparent: true,
          opacity: 0.6,
        }),
      );
      controller.add(line);
      controller.addEventListener("selectstart", () => {
        const mesh = hit(controller);
        if (!mesh) return;
        if (mesh.userData.focus) {
          if ([...held.values()].includes(mesh)) return;
          dispatch(mesh);
          controller.attach(mesh);
          held.set(controller, mesh);
        } else dispatch(mesh);
      });
      const release = () => {
        const mesh = held.get(controller);
        if (mesh) {
          scene.attach(mesh);
          held.delete(controller);
        }
      };
      controller.addEventListener("selectend", release);
      controller.addEventListener("disconnected", release);
      const hand = renderer.xr.getHand(i);
      hand.add(handFactory.createHandModel(hand, "spheres"));
      scene.add(hand);
    }
    let mouseDown: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      mouseDown = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (
        !mouseDown ||
        Math.hypot(e.clientX - mouseDown.x, e.clientY - mouseDown.y) > 7
      )
        return;
      mouseDown = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const mesh = ray.intersectObjects(targets, false)[0]?.object as
        T.Mesh | undefined;
      if (mesh) dispatch(mesh);
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    const vrButton = VRButton.createButton(renderer, {
      optionalFeatures: ["hand-tracking", "local-floor"],
    });
    vrButton.classList.add("kf-xr-entry");
    el.appendChild(vrButton);
    const started = () => {
      orbit.enabled = false;
    };
    const ended = () => {
      orbit.enabled = true;
      for (const mesh of held.values()) scene.attach(mesh);
      held.clear();
    };
    renderer.xr.addEventListener("sessionstart", started);
    renderer.xr.addEventListener("sessionend", ended);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      if (!renderer.xr.isPresenting)
        camera.position.set(0, 2.8, Math.max(5, 10 / camera.aspect - 3));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let signature = "";
    renderer.setAnimationLoop(() => {
      const s = live.current.state,
        next = JSON.stringify([
          s.version,
          s.focus,
          s.busy,
          s.evidence?.time,
          s.proposal?.id,
          s.events.at(-1)?.id,
        ]);
      if (next !== signature) {
        signature = next;
        nodes.forEach(({ service, p }) =>
          paint(
            p,
            (s.focus === service.id ? "● " : "") + service.name,
            [s.focus === service.id ? "SHARED FOCUS" : "Select to inspect"],
            s.focus === service.id ? "#a9baff" : "#71d6db",
          ),
        );
        paint(
          evidence,
          "EVIDENCE / REV " + s.version,
          s.evidence
            ? [
                s.evidence.version === s.version
                  ? "CURRENT REVISION"
                  : "STALE: rerun checks",
                ...s.evidence.tests.map(
                  (t) => (t.pass ? "PASS " : "FAIL ") + t.name,
                ),
                `${s.evidence.active} connections held`,
              ]
            : [
                "No measurements yet.",
                "Run checks to execute the service and collect real HTTP traces.",
              ],
        );
        const last = s.events
          .filter(
            (e) =>
              e.kind === "agent" || e.kind === "user" || e.kind === "error",
          )
          .slice(-2);
        paint(
          feed,
          s.busy ? "AGENT / WORKING" : "SHARED CONVERSATION",
          last.flatMap((e) => [e.kind.toUpperCase(), e.detail.slice(0, 500)]),
        );
        const p = s.proposal;
        paint(
          source,
          p ? "PROPOSED / " + p.file : "SOURCE / service.mjs",
          (p ? p.after : s.source).split("\n").slice(0, 15),
        );
        actions.forEach((a) =>
          paint(
            a.p,
            a.label,
            [],
            a.key === "apply" && !s.proposal
              ? "#657587"
              : s.busy && a.key !== "stop" && a.key !== "voice"
                ? "#657587"
                : "#8ae1db",
          ),
        );
      }
      if (!renderer.xr.isPresenting) orbit.update();
      renderer.render(scene, camera);
    });
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const session = renderer.xr.getSession();
      if (session) void session.end().catch(() => {});
      orbit.dispose();
      renderer.xr.removeEventListener("sessionstart", started);
      renderer.xr.removeEventListener("sessionend", ended);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach(
            (mat) => mat.dispose(),
          );
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      el.replaceChildren();
    };
  }, []);
  return (
    <div
      className="kf-spatial"
      role="dialog"
      aria-label="Spatial engineering room"
    >
      <header>
        <span>
          <Glasses size={20} />
          Kineframe <b>/</b> Spatial room
        </span>
        <button aria-label="Close spatial room" onClick={props.onClose}>
          <X size={20} />
        </button>
      </header>
      <div ref={host} className="kf-spatial-canvas" />
      {error && <p role="alert">{error}</p>}
      <div className="kf-spatial-guide">
        Same session · select services and action panels · drag to orbit on
        desktop
        <br />
        In VR: point and select; hold a service to arrange it. Enable voice in
        the workspace before entering VR.
      </div>
    </div>
  );
}
