// magnetosphere.js
import { THREE, scene } from './scene-core.js';

export let magnetosphere;

const impactState = {
  normal: new THREE.Vector3(1, 0, 0),
  strength: 0
};

// Shue model
function shueParams(Pd, Bz) {
  const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (Bz + 8.14))) * Math.pow(Pd || 1, -1 / 6.6);
  const alpha = (0.58 - 0.007 * Bz) * (1 + 0.024 * Math.log(Math.max(Pd, 0.1)));
  return { r0, alpha };
}

export function createMagnetosphere(earthPos) {
  const geom = new THREE.SphereGeometry(1, 128, 128);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uR0: { value: 10.5 },
      uAlpha: { value: 0.6 },
      uBz: { value: -5 },
      uPd: { value: 2 },
      uRippleTime: { value: 999 },
      uRippleActive: { value: 0.0 },
      uRippleOrigin: { value: new THREE.Vector3(1, 0, 0) },
      uImpactNormal: { value: new THREE.Vector3(1, 0, 0) },
      uImpactStrength: { value: 0 },
      uCompression: { value: 0 }
    },
    vertexShader: `
      uniform float uR0, uAlpha;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(position);
        float theta = acos(clamp(n.x, -1.0, 1.0));
        float denom = 1.0 + cos(theta);
        float scale = uR0 * pow(2.0 / max(denom, 1e-4), uAlpha);
        vec3 mp = n * scale;
        vPos = mp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mp, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime, uRippleTime, uRippleActive, uImpactStrength, uCompression;
      uniform vec3 uRippleOrigin, uImpactNormal;
      varying vec3 vPos;
      void main() {
        vec3 N = normalize(vPos);
        float dusk = clamp((dot(N, vec3(1.0,0.0,0.0)) + 1.0) * 0.5, 0.0, 1.0);
        float tail = clamp(1.0 - dusk, 0.0, 1.0);

        vec3 dayColor = vec3(0.28, 0.66, 1.05);
        vec3 nightColor = vec3(0.55, 0.25, 0.95);
        vec3 base = mix(nightColor, dayColor, dusk);

        float rim = pow(1.0 - abs(dot(N, vec3(0.0, 0.0, 1.0))), 2.8);
        float auroral = pow(clamp(N.z, 0.0, 1.0), 4.0);

        float ripple = 0.0;
        if (uRippleActive > 0.1) {
          float dist = length(vPos - uRippleOrigin);
          float spread = 1.0 - smoothstep(0.0, 15.0, dist);
          ripple = spread * (0.55 + 0.45 * sin(uRippleTime * 6.0 + dist * 0.7));
        }

        float impact = 0.0;
        if (uImpactStrength > 0.01) {
          float align = max(dot(N, uImpactNormal), 0.0);
          float band = pow(align, 12.0);
          float shear = pow(1.0 - abs(N.z), 3.5);
          impact = (band * 1.5 + shear * 0.35) * uImpactStrength;
        }

        float compressionGlow = pow(clamp(dot(N, vec3(1.0, 0.0, 0.0)), 0.0, 1.0), 2.5) * (0.18 + uCompression * 0.7);
        float tailFade = pow(tail, 1.5);

        vec3 color = base;
        color += rim * vec3(0.12, 0.23, 0.45);
        color += auroral * vec3(0.05, 0.35, 0.55) * (0.8 + uCompression * 0.4);
        color += ripple * vec3(0.2, 0.44, 0.92);
        color += impact * vec3(0.95, 0.75, 0.28);
        color += tailFade * vec3(0.05, 0.08, 0.18);
        color += compressionGlow * vec3(0.42, 0.3, 0.12);

        float alpha = 0.2 + rim * 0.22 + auroral * 0.18;
        alpha += impact * 0.4;
        alpha = clamp(alpha, 0.12, 0.72);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.FrontSide
  });
  magnetosphere = new THREE.Mesh(geom, mat);
  magnetosphere.position.copy(earthPos);
  scene.add(magnetosphere);
}

let current = { r0: 10.5, alpha: 0.6, bz: -5, pd: 2 };

export function updateMagnetosphere(time, solarWind, rippleInfo, shockInfluence = { proximity: 0, compressionBoost: 0 }) {
  if (!magnetosphere) return current;

  const lerp = (a, b, t) => a + (b - a) * t;
  const k = 0.12;

  const Pd = solarWind?.pd ?? current.pd;
  const Bz = solarWind?.bz ?? current.bz;
  const proximity = THREE.MathUtils.clamp(shockInfluence?.proximity ?? 0, 0, 1);
  const compressionGain = THREE.MathUtils.clamp(shockInfluence?.compressionBoost ?? 0, 0, 3);

  const pressureBoost = 1 + proximity * 0.6 + compressionGain * 0.4;
  const effectivePd = Pd * pressureBoost;
  const effectiveBz = Bz - proximity * 1.5;

  const { r0, alpha } = shueParams(effectivePd, effectiveBz);

  current = {
    r0: lerp(current.r0, r0, k),
    alpha: lerp(current.alpha, alpha, k),
    bz: lerp(current.bz, effectiveBz, k),
    pd: lerp(current.pd, effectivePd, k)
  };

  const u = magnetosphere.material.uniforms;
  u.uTime.value = time;
  u.uR0.value = current.r0;
  u.uAlpha.value = current.alpha;
  u.uBz.value = current.bz;
  u.uPd.value = current.pd;

  if (rippleInfo?.active) {
    u.uRippleActive.value = 1.0;
    u.uRippleTime.value = rippleInfo.time;
    u.uRippleOrigin.value.copy(rippleInfo.origin);
  } else {
    u.uRippleActive.value = THREE.MathUtils.lerp(u.uRippleActive.value, proximity * 0.6, 0.1);
    if (proximity < 0.01) {
      u.uRippleTime.value = 999;
    }
  }

  if (shockInfluence?.impactNormal) {
    impactState.normal.copy(shockInfluence.impactNormal).normalize();
    impactState.strength = THREE.MathUtils.lerp(impactState.strength, 1, 0.35);
  } else {
    impactState.strength = THREE.MathUtils.lerp(impactState.strength, 0, 0.12);
  }

  const compressionMetric = THREE.MathUtils.clamp((11 - current.r0) / 6, 0, 1);

  u.uImpactNormal.value.copy(impactState.normal);
  u.uImpactStrength.value = impactState.strength;
  u.uCompression.value = compressionMetric;

  // Return sync params
  return {
    compression: compressionMetric,
    tailLength: THREE.MathUtils.lerp(1.2, 2.2, THREE.MathUtils.clamp((current.alpha - 0.4) / 0.4, 0, 1)),
    equatorBulge: THREE.MathUtils.lerp(1.0, 1.4, THREE.MathUtils.clamp((current.pd - 1) / 5, 0, 1))
  };
}
