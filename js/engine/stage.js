// The photographic stage. It renders real 3D beads with physically based glass,
// and averages many frames with a moving lens and moving lights. That converges
// to true area light shadows, ambient occlusion and depth of field, like a photo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { beadGeometry, chainLinkGeometry, jumpRingGeometry, lobsterGeometry, VARIANTS } from './geometry.js';
import { beadMaterial, metalMaterial, threadMaterial, albedoFromHex, lightingUniforms } from './materials.js';
import { makeStudioEnvironment, surfaceMaterial } from './studio.js';
import { makePose } from './pose.js';

const halton = (i, b) => {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
};

const hash = (a, b) => {
  let h = Math.imul(a * 73856093 ^ b * 19349663, 2654435761) >>> 0;
  h ^= h >>> 15;
  return (Math.imul(h, 2246822519) >>> 0) / 4294967296;
};

const quadVertex = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const blendFragment = `
  uniform sampler2D tNew; uniform sampler2D tOld; uniform float uWeight; varying vec2 vUv;
  void main(){
    vec4 n = texture2D(tNew, vUv);
    // A single bad float must not poison the running average for good.
    if (n.r != n.r || n.g != n.g || n.b != n.b) n = vec4(0.0, 0.0, 0.0, 1.0);
    n.rgb = min(n.rgb, vec3(24.0));
    gl_FragColor = uWeight >= 1.0 ? n : mix(texture2D(tOld, vUv), n, uWeight);
  }`;

// Linear up to a late shoulder, with each channel compressed on its own. Pale and saturated
// colours then reach the catalogue value measured in tools/calibrate.html.
const finalFragment = `
  uniform sampler2D tAccum; uniform float uExposure; uniform float uVignette; uniform float uTime; varying vec2 vUv;
  vec3 neutral(vec3 color){
    const float Start = 0.88;
    color *= uExposure;
    float x = min(color.r, min(color.g, color.b));
    color -= x < 0.08 ? x - 6.25 * x * x : 0.04;
    float d = 1. - Start;
    return mix(color, 1. - d * d / (color + d - Start), step(Start, color));
  }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
  float grain(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
  void main(){
    vec3 c = texture2D(tAccum, vUv).rgb;
    vec2 q = vUv - 0.5;
    c *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(q, q) * 2.0);
    c = neutral(c);
    c = toSRGB(clamp(c, 0.0, 1.0));
    c += (grain(gl_FragCoord.xy) - 0.5) * 0.012;
    gl_FragColor = vec4(c, 1.0);
  }`;

const letterCache = new Map();
function letterTexture(char) {
  if (letterCache.has(char)) return letterCache.get(char);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 92px Figtree, Arial, sans-serif';
  ctx.fillText(char, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  letterCache.set(char, t);
  return t;
}

function detectQuality() {
  const touch = navigator.maxTouchPoints > 0;
  const small = Math.min(screen.width, screen.height) < 820;
  return touch && small ? 'low' : 'high';
}

export class Stage {
  constructor(canvas, { quality, interactive = true, maxFrames, onChange } = {}) {
    this.canvas = canvas;
    this.quality = quality ?? detectQuality();
    this.maxFrames = maxFrames ?? (this.quality === 'low' ? 40 : 96);
    this.onChange = onChange;
    this.frame = 0;
    this.running = false;
    this.disposed = false;
    this.exposure = 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 2 : 2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x777777);
    scene.environment = makeStudioEnvironment(renderer);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(22, 2, 10, 4000);
    this.camera.position.set(0, 190, 150);
    this.target = new THREE.Vector3(0, 0, 0);

    // Key: the window. Moved over its area each frame for a soft penumbra.
    const key = new THREE.DirectionalLight(0xfff4e6, 2.25);
    key.castShadow = true;
    key.shadow.mapSize.set(this.quality === 'low' ? 1536 : 3072, this.quality === 'low' ? 1536 : 3072);
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 1.6;
    scene.add(key, key.target);
    this.key = key;
    this.keyDir = new THREE.Vector3(-0.46, 0.8, -0.4).normalize();

    // Dome: sampled over the hemisphere frame by frame. The average is occlusion.
    const dome = new THREE.DirectionalLight(0xf2f5ff, 1.2);
    dome.castShadow = true;
    dome.shadow.mapSize.set(this.quality === 'low' ? 1024 : 2048, this.quality === 'low' ? 1024 : 2048);
    dome.shadow.normalBias = 0.035;
    dome.shadow.bias = -0.0002;
    dome.shadow.radius = 2;
    scene.add(dome, dome.target);
    this.dome = dome;

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    
    scene.add(this.ground);
    this.surfaceId = null;

    this.beads = new THREE.Group();
    this.findings = new THREE.Group();
    scene.add(this.beads, this.findings);
    this.meshes = new Map();

    this._initPost();

    if (interactive) {
      const controls = new OrbitControls(this.camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.enablePan = false;
      controls.minPolarAngle = 0.08;
      controls.maxPolarAngle = 1.42;
      controls.addEventListener('change', () => this.restart());
      this.controls = controls;
    }
    this._tick = this._tick.bind(this);
    this._onVisible = () => {
      if (document.hidden || this.running || this.disposed) return;
      // Coming back from another app: resume, or at least show the finished picture again.
      if (this.frame < this.maxFrames) {
        this.running = true;
        requestAnimationFrame(this._tick);
      } else if (this.frame > 0) {
        this._present();
      }
    };
    document.addEventListener('visibilitychange', this._onVisible);
    // Phones drop the GPU context under memory pressure. three.js rebuilds it, we redraw.
    canvas.addEventListener('webglcontextrestored', () => this.restart());
    this.bounds = { radius: 60, center: new THREE.Vector3() };
    this.resize(canvas.clientWidth || 800, canvas.clientHeight || 400);
    this.setSurface('backdrop');
  }

  _initPost() {
    const type = THREE.HalfFloatType;
    const samples = this.quality === 'low' ? 2 : 4;
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { type, samples, depthBuffer: true });
    const make = () => new THREE.WebGLRenderTarget(4, 4, { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rtA = make();
    this.rtB = make();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    this.blendMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex, fragmentShader: blendFragment,
      uniforms: { tNew: { value: null }, tOld: { value: null }, uWeight: { value: 1 } },
      depthTest: false, depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex, fragmentShader: finalFragment,
      uniforms: { tAccum: { value: null }, uExposure: { value: 1 }, uVignette: { value: 0.28 }, uTime: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(geo, this.blendMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
  }

  resize(cssW, cssH, dpr = this.dpr) {
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.rtScene.setSize(w, h);
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.restart();
  }

  setSurface(id) {
    if (this.surfaceId === id) return;
    this.surfaceId = id;
    const old = this.ground.material;
    this.ground.material = surfaceMaterial(id, this.renderer, this.quality === 'low' ? 512 : 768);
    old.map?.dispose();
    old.normalMap?.dispose();
    old.dispose();
    this.restart();
  }

  // scene spec: { instances, poseKind, length, width, thread, metal, findings }
  setBracelet(spec) {
    this.spec = spec;
    const pose = makePose(spec.poseKind ?? 'bow', spec.length, spec.width, spec.lift);
    this.pose = pose;
    this._buildBeads(spec, pose);
    this._buildBed(spec, pose);
    this._buildFindings(spec, pose);
    this._buildDecals(spec, pose);
    this._fitLights(spec, pose);
    this.restart();
  }

  _buildBeads(spec, pose) {
    const groups = new Map();
    for (let i = 0; i < spec.instances.length; i++) {
      const b = spec.instances[i];
      const v = Math.floor(hash(i, 3) * VARIANTS);
      const key = `${b.shape}|${b.finish}|${v}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    const seen = new Set();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qt = new THREE.Quaternion();
    const e = new THREE.Euler();
    const basis = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    for (const [key, list] of groups) {
      seen.add(key);
      let mesh = this.meshes.get(key);
      if (!mesh || mesh.instanceMatrix.count < list.length) {
        if (mesh) {
          this.beads.remove(mesh);
          mesh.dispose();
        }
        const [shape, finish, v] = key.split('|');
        mesh = new THREE.InstancedMesh(beadGeometry(shape, Number(v), this.quality), beadMaterial(finish), Math.ceil(list.length * 1.4) + 8);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        this.meshes.set(key, mesh);
        this.beads.add(mesh);
      }
      mesh.visible = true;
      mesh.count = list.length;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const f = pose.at(b.s);
        const h = b.h ?? 0;
        pos.set(f.px + f.bx * b.t + f.nx * h, f.py + f.by * b.t + f.ny * h, f.pz + f.bz * b.t + f.nz * h);
        basis.set(f.tx, f.nx, f.bx, 0, f.ty, f.ny, f.by, 0, f.tz, f.nz, f.bz, 0, 0, 0, 0, 1);
        q.setFromRotationMatrix(basis);
        const r1 = hash(i, 11) - 0.5;
        const r2 = hash(i, 17) - 0.5;
        const r3 = hash(i, 23) - 0.5;
        const r4 = hash(i, 29) - 0.5;
        // Hand-sewn beads never sit perfectly: small tilts, nudges, sizes.
        e.set(r1 * 0.06 + (b.rx ?? 0), r3 * 0.09 + (b.yaw ?? 0), r2 * 0.05 + (b.rz ?? 0), 'YXZ');
        qt.setFromEuler(e);
        q.multiply(qt);
        pos.x += r1 * 0.018;
        pos.y += r4 * 0.018;
        pos.z += r2 * 0.018;
        const s = 0.985 + r3 * 0.024;
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        albedoFromHex(b.hex, b.finish, col);
        const l = 1 + r4 * 0.07;
        col.r *= l; col.g *= l; col.b *= l;
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const [key, mesh] of this.meshes) if (!seen.has(key)) mesh.visible = false;
  }

  _buildBed(spec, pose) {
    if (this.bed) {
      this.scene.remove(this.bed);
      this.bed.geometry.dispose();
      this.bed = null;
    }
    if (!spec.bed) return;
    // The thread layer sits mid-bead so gaps go dark and no light leaks through.
    const { sMin, sMax, tMin, tMax } = spec.bed;
    const steps = Math.max(8, Math.round((sMax - sMin) / 2));
    const pts = [];
    const idx = [];
    for (let i = 0; i <= steps; i++) {
      const s = sMin + ((sMax - sMin) * i) / steps;
      const f = pose.at(s);
      pts.push(f.px + f.bx * tMin, f.py + f.by * tMin, f.pz + f.bz * tMin);
      pts.push(f.px + f.bx * tMax, f.py + f.by * tMax, f.pz + f.bz * tMax);
      if (i < steps) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.bed = new THREE.Mesh(g, threadMaterial(spec.bed.color ?? 0x2a2523));
    this.bed.castShadow = true;
    this.bed.receiveShadow = true;
    this.scene.add(this.bed);
  }

  // Printed marks, like letters on cube beads. A few flat planes just above the bead.
  _buildDecals(spec, pose) {
    if (!this.decals) {
      this.decals = new THREE.Group();
      this.decalGeo = new THREE.PlaneGeometry(1, 1);
      this.scene.add(this.decals);
    }
    for (const mesh of this.decals.children) mesh.material.dispose();
    this.decals.clear();
    for (const d of spec.decals ?? []) {
      const f = pose.at(d.s);
      const mesh = new THREE.Mesh(this.decalGeo, new THREE.MeshStandardMaterial({
        map: letterTexture(d.char), color: new THREE.Color(`#${d.hex}`), transparent: true, depthWrite: false, roughness: 0.42, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      mesh.position.set(f.px + f.bx * d.t + f.nx * d.h, f.py + f.by * d.t + f.ny * d.h, f.pz + f.bz * d.t + f.nz * d.h);
      // Reads upright for someone looking at the bracelet from the front.
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(f.tx, -f.bx, f.nx, 0, f.ty, -f.by, f.ny, 0, f.tz, -f.bz, f.nz, 0, 0, 0, 0, 1));
      mesh.scale.setScalar(d.size);
      this.decals.add(mesh);
    }
  }

  _buildFindings(spec, pose) {
    this.findings.clear();
    if (!spec.findings || spec.findings.metal === 'none') return;
    const mat = metalMaterial(spec.findings.metal);
    const Q = this.quality;
    const add = (geo, position, quat) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.quaternion.copy(quat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.findings.add(mesh);
      return mesh;
    };
    const half = spec.length / 2;
    const link = chainLinkGeometry(Q);
    const ring = jumpRingGeometry(Q);
    const lob = lobsterGeometry(Q);
    const axisX = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);

    if (pose.kind === 'loop') {
      // Lobster and chain close the gap of the ring.
      const R = pose.radius;
      const start = half + 1;
      const gapMm = Math.PI * 2 * R - spec.length;
      const n = Math.max(2, Math.floor(gapMm / 1.5));
      for (let i = 0; i < n; i++) {
        const s = start + i * (gapMm / n);
        const f = pose.at(s);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(f.tx, f.nx, f.bx, 0, f.ty, f.ny, f.by, 0, f.tz, f.nz, f.bz, 0, 0, 0, 0, 1));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axisX, i % 2 ? Math.PI / 2 : 0));
        add(link, new THREE.Vector3(f.px, f.py, f.pz), q);
      }
      return;
    }

    // Lying pose. Right end: extender chain. Left end: ring and lobster clasp.
    const place = (s, zOff, hOff) => {
      const f = pose.at(s);
      return new THREE.Vector3(f.px + f.bx * zOff + f.nx * hOff, f.py + f.by * zOff + f.ny * hOff, f.pz + f.bz * zOff + f.nz * hOff);
    };
    const frameQuat = (s) => {
      const f = pose.at(s);
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(f.tx, f.nx, f.bx, 0, f.ty, f.ny, f.by, 0, f.tz, f.nz, f.bz, 0, 0, 0, 0, 1));
    };
    const flat = new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI / 2);

    // Right side
    let s = half + 1.1;
    add(ring, place(s, 0, -0.1), frameQuat(s).multiply(flat));
    s += 1.6;
    const chainLinks = spec.findings.chainLinks ?? 16;
    for (let i = 0; i < chainLinks; i++) {
      const wander = Math.sin(i * 0.5) * Math.min(i * 0.32, 5.5);
      const q = frameQuat(s).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.cos(i * 0.5) * 0.3));
      if (i % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI / 2));
      else q.multiply(flat);
      add(link, place(s, wander, -0.25), q);
      s += 1.52;
    }

    // Left side
    let sl = -half - 1.1;
    add(ring, place(sl, 0, -0.1), frameQuat(sl).multiply(flat));
    sl -= 1.4;
    const qLob = frameQuat(sl).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI)).multiply(flat);
    add(lob, place(sl, 0, -0.1), qLob);
  }

  _fitLights(spec, pose) {
    const half = spec.length / 2 + 26;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const f = pose.at(-half + (i / 12) * half * 2);
      pts.push(new THREE.Vector3(f.px, f.py, f.pz));
    }
    const b = new THREE.Box3().setFromPoints(pts).expandByScalar(spec.width);
    const center = b.getCenter(new THREE.Vector3());
    const radius = b.getSize(new THREE.Vector3()).length() / 2;
    this.bounds = { center, radius };
    for (const light of [this.key, this.dome]) {
      const cam = light.shadow.camera;
      cam.left = -radius;
      cam.right = radius;
      cam.top = radius;
      cam.bottom = -radius;
      cam.near = 1;
      cam.far = radius * 2 + 500;
      cam.updateProjectionMatrix();
      light.target.position.copy(center);
    }
  }

  // Frame the camera on a stretch of the band, or the whole thing.
  frameView({ sCenter = 0, span, tilt = 0.62, azimuth = 0, fill = 0.92, frameHeight, lookAtCenter = false }) {
    const pose = this.pose;
    if (!pose) return;
    const f = pose.at(sCenter);
    const c = lookAtCenter ? new THREE.Vector3(0, f.py, 0) : new THREE.Vector3(f.px, f.py, f.pz);
    const vFov = (this.camera.fov * Math.PI) / 180;
    const aspect = this.camera.aspect;
    const needW = span / fill;
    const needH = frameHeight ?? this.spec.frameHeight ?? this.spec.width * 2.4;
    let d = needW / (2 * Math.tan(vFov / 2) * aspect);
    d = Math.max(d, needH / (2 * Math.tan(vFov / 2)));
    const el = tilt;
    this.camera.position.set(
      c.x + d * Math.sin(azimuth) * Math.sin(el),
      c.y + d * Math.cos(el),
      c.z + d * Math.cos(azimuth) * Math.sin(el)
    );
    this.camera.up.set(0, 1, 0);
    this.target.copy(c);
    this.camera.lookAt(c);
    if (this.controls) {
      this.controls.target.copy(c);
      this.controls.minDistance = d * 0.18;
      this.controls.maxDistance = d * 2.6;
      this.controls.update();
    }
    this.restart();
  }

  restart() {
    this.frame = 0;
    this.lastChange = performance.now();
    if (!this.running && !this.disposed) {
      this.running = true;
      requestAnimationFrame(this._tick);
    }
  }

  _setSample(i) {
    const cam = this.camera;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // Lens: move the eye on a disc and shear so the focal plane stays put.
    const focus = cam.position.distanceTo(this.controls ? this.controls.target : this.target);
    const aperture = (this.aperture ?? 0.011) * focus;
    let lx = 0;
    let ly = 0;
    let jx = 0;
    let jy = 0;
    if (i > 0) {
      const a = halton(i, 2) * Math.PI * 2;
      const r = Math.sqrt(halton(i, 3)) * aperture;
      lx = Math.cos(a) * r;
      ly = Math.sin(a) * r;
      jx = (halton(i, 5) - 0.5) * 2;
      jy = (halton(i, 7) - 0.5) * 2;
    }
    this._lens = { lx, ly };
    const e = cam.projectionMatrix.elements;
    e[8] += (-e[0] * lx) / focus + jx / this.width;
    e[9] += (-e[5] * ly) / focus + jy / this.height;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    this._eye = cam.position.clone();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    cam.position.addScaledVector(right, lx).addScaledVector(up, ly);
    cam.updateMatrixWorld();

    // Key light wanders over the window. Dome light sweeps the hemisphere.
    const R = this.bounds.radius + 400;
    const c = this.bounds.center;
    const k = this.keyDir;
    const u = new THREE.Vector3(-k.z, 0, k.x).normalize();
    const v = new THREE.Vector3().crossVectors(k, u);
    const ka = halton(i + 1, 2) * Math.PI * 2;
    const kr = i === 0 ? 0 : Math.sqrt(halton(i + 1, 5)) * 0.14;
    const kd = k.clone().addScaledVector(u, Math.cos(ka) * kr).addScaledVector(v, Math.sin(ka) * kr).normalize();
    this.key.position.copy(c).addScaledVector(kd, R);
    this.key.target.position.copy(c);
    this.key.target.updateMatrixWorld();

    // Cosine weighted direction; frame 0 is the zenith so a still is usable at once.
    let dd;
    if (i === 0) dd = new THREE.Vector3(0.15, 1, 0.2).normalize();
    else {
      const a2 = halton(i, 11) * Math.PI * 2;
      const r2 = Math.sqrt(halton(i, 13));
      dd = new THREE.Vector3(Math.cos(a2) * r2, Math.sqrt(Math.max(0.02, 1 - r2 * r2)), Math.sin(a2) * r2);
    }
    this.dome.position.copy(c).addScaledVector(dd, R);
    this.dome.target.position.copy(c);
    this.dome.target.updateMatrixWorld();
  }

  _restoreEye() {
    if (this._eye) {
      this.camera.position.copy(this._eye);
      this.camera.updateMatrixWorld();
    }
    this.camera.updateProjectionMatrix();
  }

  _renderSample() {
    const r = this.renderer;
    const i = this.frame;
    this._setSample(i);
    r.setRenderTarget(this.rtScene);
    r.render(this.scene, this.camera);
    this._restoreEye();

    this.quad.material = this.blendMat;
    this.blendMat.uniforms.tNew.value = this.rtScene.texture;
    this.blendMat.uniforms.tOld.value = this.rtA.texture;
    this.blendMat.uniforms.uWeight.value = 1 / (i + 1);
    r.setRenderTarget(this.rtB);
    r.render(this.quadScene, this.quadCam);
    [this.rtA, this.rtB] = [this.rtB, this.rtA];

    this._present();
    this.frame++;
  }

  _present() {
    this.quad.material = this.finalMat;
    this.finalMat.uniforms.tAccum.value = this.rtA.texture;
    this.finalMat.uniforms.uExposure.value = this.exposure;
    this.finalMat.uniforms.uTime.value = 0.37;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  _tick() {
    if (this.disposed) {
      this.running = false;
      return;
    }
    if (document.hidden) {
      this.running = false;
      return;
    }
    if (this.controls) this.controls.update();
    if (this.frame < this.maxFrames) {
      // A few samples per display frame once idle, so it settles quickly.
      const idle = performance.now() - this.lastChange > 180;
      const batch = idle && this.quality === 'high' ? 2 : 1;
      const t0 = performance.now();
      for (let i = 0; i < batch && this.frame < this.maxFrames; i++) this._renderSample();
      this._adapt((performance.now() - t0) / batch);
      requestAnimationFrame(this._tick);
    } else {
      this.running = false;
      this.onChange?.('settled');
    }
  }

  // A struggling phone gives up the second shadow and settles sooner.
  _adapt(ms) {
    this.slowFrames = ms > 90 ? (this.slowFrames ?? 0) + 1 : 0;
    if (this.slowFrames >= 3 && this.dome.castShadow) {
      this.dome.castShadow = false;
      this.maxFrames = Math.min(this.maxFrames, 18);
    }
  }

  // Render straight to completion for thumbnails and image export.
  renderStill(frames) {
    this.frame = 0;
    const end = frames ?? this.maxFrames;
    for (let i = 0; i < end; i++) this._renderSample();
    this.frame = Infinity;
    return this.canvas;
  }

  // Screen position for every bead centre, used for tap picking.
  pick(cssX, cssY, cssW, cssH) {
    if (!this.spec) return -1;
    const v = new THREE.Vector3();
    const pose = this.pose;
    let best = -1;
    let bestD = Infinity;
    this.camera.updateMatrixWorld();
    for (let i = 0; i < this.spec.instances.length; i++) {
      const b = this.spec.instances[i];
      const f = pose.at(b.s);
      const h = b.h ?? 0;
      v.set(f.px + f.bx * b.t + f.nx * h, f.py + f.by * b.t + f.ny * h, f.pz + f.bz * b.t + f.nz * h);
      v.project(this.camera);
      const sx = ((v.x + 1) / 2) * cssW;
      const sy = ((1 - v.y) / 2) * cssH;
      const d = (sx - cssX) ** 2 + (sy - cssY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { index: best, dist: Math.sqrt(bestD) };
  }

  dispose() {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this._onVisible);
    this.controls?.dispose();
    this.renderer.dispose();
  }
}
