// shockwave.js
import { THREE, scene } from './scene-core.js';

export let shockwaves = [];

const RING_INNER = 0.92;
const RING_OUTER = 1.0;
const RING_SEGMENTS = 256;
const INITIAL_FRONT_DISTANCE = 40;
const MIN_THICKNESS_RATIO = 0.06;

let sharedGeometry = null;

function getShockwaveGeometry() {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.RingGeometry(RING_INNER, RING_OUTER, RING_SEGMENTS);
  }
  return sharedGeometry;
}

export function createShockwave(origin, target, cme = {}) {
  const geometry = getShockwaveGeometry();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uScale: { value: 1 },
      uThickness: { value: MIN_THICKNESS_RATIO },
      uIntensity: { value: 1.0 },
      uApproach: { value: 0.0 },
      uColorCore: { value: new THREE.Color(0.95, 0.55, 0.15) },
      uColorShell: { value: new THREE.Color(0.9, 0.35, 0.12) },
  uColorFront: { value: new THREE.Color(1.0, 0.96, 0.88) },
  uForwardExtent: { value: 1.0 },
  uSeedA: { value: new THREE.Vector4(Math.random(), Math.random(), Math.random(), Math.random()) },
  uSeedB: { value: new THREE.Vector4(Math.random(), Math.random(), Math.random(), Math.random()) }
    },
    vertexShader: `
      precision highp float;
      uniform float uScale;
      uniform float uTime;
      uniform float uForwardExtent;
      uniform vec4 uSeedA;
      uniform vec4 uSeedB;
      varying vec2 vUv;
      varying float vRadial;
      varying float vLoopMask;

      float softPulse(float x, float k) {
        return pow(max(0.0, x), k);
      }

      void main() {
        vUv = uv;
        vRadial = uv.y;
        vec3 pos = position;
        float theta = uv.x * 6.28318 + uSeedA.x * 6.28318;
  float primaryLobe = softPulse(sin(theta * (1.8 + uSeedA.y * 3.5) + uSeedA.z * 6.28318), 1.4 + uSeedA.w * 1.8);
  float secondary = softPulse(sin(theta * (3.0 + uSeedB.x * 5.5) + uSeedB.y * 6.28318), 1.1 + uSeedB.z * 1.6);
  float arcProfile = (0.45 + 0.55 * vRadial) * primaryLobe + (0.25 + 0.35 * (1.0 - vRadial)) * secondary;
  float rise = arcProfile * uForwardExtent * (0.32 + uSeedA.w * 0.28);
  float swirl = sin(uTime * (0.4 + uSeedB.w * 0.9) + theta * (1.2 + uSeedA.y * 0.8)) * 0.03 * vRadial;
  pos.z += rise + swirl;
  float lateral = 1.0 + arcProfile * 0.18;
        pos.xy *= lateral;
        float twist = sin(theta * (4.0 + uSeedB.w * 6.0) + uTime * (0.6 + uSeedA.x)) * 0.3 * vRadial;
        float ct = cos(twist);
        float st = sin(twist);
        pos = vec3(pos.x * ct - pos.y * st, pos.x * st + pos.y * ct, pos.z);
  float ripple = sin(uTime * 1.2 + vRadial * 18.0 + theta * 1.6) * 0.004 * uForwardExtent;
  float breathing = sin(uTime * 0.6 + theta) * 0.003 * uForwardExtent;
  pos.z += ripple + breathing;
  vLoopMask = clamp(rise * 1.6, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos * uScale, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uIntensity;
      uniform float uApproach;
      uniform float uThickness;
      uniform vec3 uColorCore;
      uniform vec3 uColorShell;
      uniform vec3 uColorFront;
      varying vec2 vUv;
      varying float vRadial;
      varying float vLoopMask;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
        float value = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amp * noise(p);
          p = p * 2.0 + vec2(100.0);
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        float radial = clamp(vRadial, 0.0, 1.0);
        float angle = vUv.x * 6.28318;

        float innerEdge = clamp(1.0 - uThickness, 0.0, 0.98);
        float shell = smoothstep(innerEdge - 0.03, innerEdge + 0.015, radial);
        shell *= 1.0 - smoothstep(0.995, 1.0, radial);

        float turbulent = fbm(vec2(angle * 0.6, radial * 4.0 + uTime * 0.7));
        float streak = fbm(vec2(angle * 1.2 - uTime * 1.1, radial * 7.0));

        vec3 color = mix(uColorCore, uColorShell, radial);
        float frontMix = smoothstep(0.88, 1.0, radial);
        color = mix(color, uColorFront, frontMix);
        color += uColorFront * (0.05 + 0.25 * uApproach) * turbulent;
        color += uColorFront * streak * 0.1;
        color += uColorFront * vLoopMask * 0.3;

        float alpha = shell * uOpacity;
        alpha *= 0.75 + 0.25 * turbulent;
        alpha *= 0.85 + 0.15 * uApproach;
        alpha *= 0.6 + 0.4 * vLoopMask;

        if (alpha <= 0.001) discard;

        gl_FragColor = vec4(color * (0.9 + uIntensity * 0.4), alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);

  const originPoint = origin.clone();
  let dir;
  if (target && !target.equals(originPoint)) {
    dir = target.clone().sub(originPoint).normalize();
  } else {
    const lon = THREE.MathUtils.degToRad(cme.longitude || 0);
    const lat = THREE.MathUtils.degToRad(cme.latitude || 0);
    dir = new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    ).normalize();
  }

  const halfAngle = THREE.MathUtils.degToRad(cme.halfAngle ?? 40);
  const frontDistance = INITIAL_FRONT_DISTANCE;
  const shellRadius = Math.max(25, Math.tan(halfAngle) * frontDistance);

  const density = cme.density ?? 10;
  const speedKms = Math.max(250, cme.speed || 700);
  const speedUnitsPerSec = speedKms / 45;
  const densityFactor = THREE.MathUtils.clamp(density / 10, 0.25, 2.5);
  const speedFactor = THREE.MathUtils.clamp(speedKms / 700, 0.6, 1.6);
  const energy = densityFactor * speedFactor;

  const targetDistance = target ? originPoint.distanceTo(target) : 800;
  const tailLength = Math.max(220, targetDistance * 0.45);
  const baseThickness = THREE.MathUtils.clamp(MIN_THICKNESS_RATIO + energy * 0.05, MIN_THICKNESS_RATIO, 0.35);
  const forwardExtentRatio = THREE.MathUtils.clamp(0.65 + energy * 0.25, 0.55, 1.35);

  mesh.position.copy(originPoint.clone().add(dir.clone().multiplyScalar(frontDistance)));
  mesh.lookAt(mesh.position.clone().add(dir));

  material.uniforms.uScale.value = shellRadius;
  material.uniforms.uThickness.value = baseThickness;
  material.uniforms.uIntensity.value = 0.85 + energy * 0.35;
  material.uniforms.uForwardExtent.value = forwardExtentRatio;

  mesh.userData = {
    origin: originPoint,
    dir,
    halfAngle,
    frontDistance,
    speed: speedUnitsPerSec,
    energy,
    targetDistance,
    tailLength,
    baseThickness,
  forwardExtentRatio,
    mode: 'inbound',
    curveSign: Math.random() > 0.5 ? 1 : -1,
    contactNormal: null,
    slideAngle: 0,
  tailAnchor: null,
    passedEarth: false,
    _hit: false,
    rippleTime: 0,
    approach: 0,
    _lastT: null
  };
  scene.add(mesh);
  shockwaves.push(mesh);
  return mesh;
}

export function updateShockwaves(earthPos, magnetoParams, tSec) {
  let collision = false;
  let rippleInfo = { active: false, time: 0, origin: new THREE.Vector3(1, 0, 0) };
  let maxApproach = 0;
  let maxCompressionBoost = 0;
  let impactNormal = null;

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    const dt = Math.max(0, tSec - (sw.userData._lastT ?? tSec));
    sw.userData._lastT = tSec;

    const baseMagnetopause = 40;
    const mpDist = baseMagnetopause * (1 - 0.25 * (magnetoParams?.compression || 0));

    if (sw.userData.mode === 'skimming') {
      sw.userData.slideAngle += dt * 0.45;
      const axis = new THREE.Vector3(0, sw.userData.curveSign, 0);
      const angle = Math.min(sw.userData.slideAngle, Math.PI * 0.85);
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      const rotatedNormal = sw.userData.contactNormal.clone().applyQuaternion(quat).normalize();

  const surfacePos = earthPos.clone().add(rotatedNormal.clone().multiplyScalar(mpDist));
      sw.position.copy(surfacePos);
      sw.userData.dir = rotatedNormal.clone();
      sw.lookAt(surfacePos.clone().add(sw.userData.dir));
      sw.userData.frontDistance = mpDist;

      const shellRadius = Math.max(30, Math.tan(sw.userData.halfAngle) * sw.userData.frontDistance);
      sw.material.uniforms.uTime.value = tSec;
      sw.material.uniforms.uScale.value = shellRadius;
      sw.material.uniforms.uThickness.value = THREE.MathUtils.clamp(
        sw.userData.baseThickness + sw.userData.energy * 0.05,
        MIN_THICKNESS_RATIO,
        0.4
      );
      sw.material.uniforms.uForwardExtent.value = sw.userData.forwardExtentRatio;
  sw.material.uniforms.uApproach.value = 1.0;
  // Fade slightly while skimming so they don't pile up too bright
  const skimProgress = angle / (Math.PI * 0.85);
  sw.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.85, 0.55, THREE.MathUtils.clamp(skimProgress, 0, 1));

      maxApproach = Math.max(maxApproach, 1.0);
      maxCompressionBoost = Math.max(maxCompressionBoost, sw.userData.energy);
      impactNormal = rotatedNormal.clone();

      sw.userData.rippleTime += dt;
      if (sw.userData.rippleTime < 1.6) {
        rippleInfo = {
          active: true,
          time: sw.userData.rippleTime,
          origin: rotatedNormal.clone().multiplyScalar(mpDist)
        };
      }

      if (sw.userData.slideAngle >= Math.PI * 0.85) {
        sw.userData.mode = 'tail';
  const tailDir = new THREE.Vector3(-1, rotatedNormal.y * 0.35, rotatedNormal.z * 0.4).normalize();
  sw.userData.dir = tailDir;
  sw.userData.tailAnchor = surfacePos.clone().sub(tailDir.clone().multiplyScalar(sw.userData.frontDistance));
        // Define how far along the magnetotail we keep rendering before fully fading out
        sw.userData.tailFadeEnd = mpDist * (2.6 + 1.1 * (magnetoParams?.tailLength || 1.5));
        sw.userData.passedEarth = true;
      }
      continue;
    }

    const isTail = sw.userData.mode === 'tail';
    const speedFactor = isTail ? 0.55 : sw.userData._hit && !sw.userData.passedEarth ? 0.22 : 1.0;
    sw.userData.frontDistance += sw.userData.speed * dt * speedFactor;
    const shellRadius = Math.max(30, Math.tan(sw.userData.halfAngle) * sw.userData.frontDistance);

    sw.material.uniforms.uTime.value = tSec;
    sw.material.uniforms.uScale.value = shellRadius;
    const thicknessRatio = THREE.MathUtils.clamp(
      sw.userData.baseThickness + sw.userData.energy * 0.03 + sw.userData.approach * 0.08,
      MIN_THICKNESS_RATIO,
      0.4
    );
    sw.material.uniforms.uThickness.value = thicknessRatio;
    const forwardExtent = shellRadius * (sw.userData.forwardExtentRatio + sw.userData.approach * 0.12);
    sw.material.uniforms.uForwardExtent.value = sw.userData.forwardExtentRatio;

    const baseOrigin = sw.userData.mode === 'tail' && sw.userData.tailAnchor ? sw.userData.tailAnchor : sw.userData.origin;

    const frontPos = baseOrigin
      .clone()
      .add(sw.userData.dir.clone().multiplyScalar(sw.userData.frontDistance));
    sw.position.copy(frontPos);
    sw.lookAt(frontPos.clone().add(sw.userData.dir));
    const distToEarth = Math.max(0, frontPos.distanceTo(earthPos) - forwardExtent);

    const approachBuffer = Math.max(mpDist, sw.userData.targetDistance + sw.userData.tailLength * 0.3);
    const approach = THREE.MathUtils.clamp(1 - distToEarth / approachBuffer, 0, 1);
    sw.userData.approach = approach;
    sw.material.uniforms.uApproach.value = approach;
    maxApproach = Math.max(maxApproach, approach);

    const compressionBoost = sw.userData.energy * Math.pow(approach, 1.2);
    maxCompressionBoost = Math.max(maxCompressionBoost, compressionBoost);

    if (!sw.userData._hit && distToEarth < mpDist) {
      sw.userData._hit = true;
      sw.userData.rippleTime = 0;
      sw.userData.mode = 'skimming';
      sw.userData.contactNormal = frontPos.clone().sub(earthPos).normalize();
      sw.userData.slideAngle = 0;
      collision = true;
      continue;
    }

    if (sw.userData._hit) {
      sw.userData.rippleTime += dt;
      if (sw.userData.rippleTime < 1.6) {
        const actualImpactDir = sw.userData.origin
          .clone()
          .add(sw.userData.dir.clone().multiplyScalar(sw.userData.frontDistance + forwardExtent))
          .sub(earthPos)
          .normalize();
        rippleInfo = {
          active: true,
          time: sw.userData.rippleTime,
          origin: actualImpactDir.multiplyScalar(mpDist)
        };
        impactNormal = actualImpactDir.clone();
      }
    }

    if (!sw.userData.passedEarth && sw.userData.frontDistance >= sw.userData.targetDistance) {
      sw.userData.passedEarth = true;
    }

    const fadeIn = THREE.MathUtils.clamp((sw.userData.frontDistance - INITIAL_FRONT_DISTANCE * 0.5) / (INITIAL_FRONT_DISTANCE * 1.2), 0, 1);
    const fadeStart = sw.userData.targetDistance + sw.userData.tailLength * 0.25;
    const fadeEnd = sw.userData.targetDistance + sw.userData.tailLength;
    let opacity = fadeIn;

    if (sw.userData.passedEarth) {
      const fadeProgress = (sw.userData.frontDistance - fadeStart) / Math.max(20, fadeEnd - fadeStart);
      opacity = THREE.MathUtils.clamp(1 - fadeProgress, 0, 1);
    }

    // If traveling down the magnetotail, override fade by magnetosphere length so it disappears after crossing it
    if (isTail) {
  const tailEnd = sw.userData.tailFadeEnd || (mpDist * 3.0);
  const p = THREE.MathUtils.clamp(sw.userData.frontDistance / Math.max(1e-3, tailEnd), 0, 1);
  const fade = THREE.MathUtils.smoothstep(p, 0.6, 1.0);
  const tailOpacity = 0.9 * (1.0 - fade);
      opacity = Math.min(opacity, tailOpacity);
      if (p >= 1.0) {
        scene.remove(sw);
        shockwaves.splice(i, 1);
        continue;
      }
    }

    opacity *= 0.85 + 0.15 * approach;
    sw.material.uniforms.uOpacity.value = opacity;

    if (sw.userData.frontDistance > fadeEnd) {
      scene.remove(sw);
      shockwaves.splice(i, 1);
      continue;
    }
  }

  return { collision, rippleInfo, proximity: maxApproach, compressionBoost: maxCompressionBoost, impactNormal };
}
