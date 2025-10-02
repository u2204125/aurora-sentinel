// main.js
import {
  THREE, scene, camera, renderer, composer,
  initScene, updateControls, updateTime, time, transitionToView
} from './scene-core.js';

import { createSun, animateSun } from './sun.js';
import { createEarth } from './earth.js';
import { createShockwave, updateShockwaves } from './shockwave.js';
import { createMagnetosphere, updateMagnetosphere } from './magnetosphere.js';
import { createStars } from './stars.js';
import { ControlPanel } from './control-panel.js';
import { DonkiAPI } from './donki-api.js';
import { initGroundView, updateGroundAurora, showGroundView, renderGroundView } from './groundview.js';
import { createAuroraMaterial } from './auroraShader.js';

// Setup
initScene();
createStars();
const sun = createSun();
const earth = createEarth();
createMagnetosphere(earth.position);

const simulationParams = {
  windSpeed: 800,
  density: 6,
  bz: -3,
  emissionInterval: 12,
  realMode: false
};
const controlPanel = new ControlPanel(simulationParams);
const auroraMaterial = createAuroraMaterial();
controlPanel.onParamChange(() => scheduleNextAutoFlareSoon());
controlPanel.init();

// Data sources
const donki = new DonkiAPI();

// Optionally seed a CME at startup
(async () => {
  if (!simulationParams.realMode) return;
  try {
    const latest = await donki.getCMEAnalysis();
    if (latest) {
      createShockwave(sun.position, earth.position, {
        speed: latest.speed ?? simulationParams.windSpeed,
        halfAngle: latest.halfAngle ?? 35,
        longitude: latest.longitude ?? 0,
        latitude: latest.latitude ?? 0,
        density: latest.density ?? simulationParams.density
      });
      scheduleNextAutoFlareSoon();
    }
  } catch (e) {
    console.warn('DONKI seed error', e);
  }
})();

// Flare scheduling
let nextAuto = null;
let lastTap = -1e6;
function scheduleNextAutoFlareSoon() {
  if (simulationParams.emissionInterval > 0) {
    nextAuto = time + 0.2;
  } else {
    nextAuto = null;
  }
}
function maybeAuto() {
  if (simulationParams.emissionInterval <= 0) return;
  if (nextAuto === null) nextAuto = time + simulationParams.emissionInterval;
  if (time >= nextAuto) {
    createShockwave(sun.position, earth.position, {
      speed: simulationParams.windSpeed,
      halfAngle: 35,
      longitude: 0, latitude: 0,
      startTime: new Date().toISOString(),
      density: simulationParams.density
    });
    nextAuto = time + simulationParams.emissionInterval;
  }
}
function spawnTap() {
  if (time - lastTap < 0.15) return;
  createShockwave(sun.position, earth.position, {
    speed: simulationParams.windSpeed,
    halfAngle: 35,
    longitude: 0, latitude: 0,
    startTime: new Date().toISOString(),
    density: simulationParams.density
  });
  lastTap = time;
  nextAuto = time + (simulationParams.emissionInterval || 12);
}
sun.userData.onClick = spawnTap;
renderer.domElement.addEventListener('pointerdown', evt => {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x, y }, camera);
  const objs = ray.intersectObjects(scene.children, true);
  if (objs.length) {
    let o = objs[0].object;
    while (o) {
      if (o.userData?.onClick) { o.userData.onClick(); break; }
      o = o.parent;
    }
  }
});

// Ground view button: open/close pole selector without accidental immediate close
(() => {
  const groundViewWrapper = document.getElementById('ground-view-wrapper');
  const groundViewBtn = document.getElementById('ground-view-btn');
  if (!groundViewWrapper || !groundViewBtn) return;

  let outsideHandler = null;

  function closeMenu() {
    groundViewWrapper.classList.remove('active');
    if (outsideHandler) {
      document.removeEventListener('pointerdown', outsideHandler, true);
      outsideHandler = null;
    }
  }

  function openMenu() {
    groundViewWrapper.classList.add('active');
    if (outsideHandler) return;
    // Use capture to detect outside pointer downs reliably
    outsideHandler = (e) => {
      if (!groundViewWrapper.contains(e.target) && e.target !== groundViewBtn) {
        closeMenu();
      }
    };
    // Defer attach to avoid closing on the same event frame
    setTimeout(() => document.addEventListener('pointerdown', outsideHandler, true), 0);
  }

  groundViewBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const isActive = groundViewWrapper.classList.contains('active');
    if (isActive) closeMenu(); else openMenu();
  });
})();

// Initialize ground view
initGroundView();

// Handle view transitions
const spaceViewBtn = document.getElementById('space-view-btn');
const northPoleBtn = document.getElementById('north-pole-btn');
const southPoleBtn = document.getElementById('south-pole-btn');

if (spaceViewBtn) {
  spaceViewBtn.addEventListener('click', () => {
    showGroundView(false);
    transitionToView('space');
  });
}

if (northPoleBtn) {
  northPoleBtn.addEventListener('click', () => {
    const groundViewWrapper = document.getElementById('ground-view-wrapper');
    if (groundViewWrapper) groundViewWrapper.classList.remove('active');
    showGroundView(false);
    transitionToView('northPole', () => {
      showGroundView(true, 'north');
    });
  });
}

if (southPoleBtn) {
  southPoleBtn.addEventListener('click', () => {
    const groundViewWrapper = document.getElementById('ground-view-wrapper');
    if (groundViewWrapper) groundViewWrapper.classList.remove('active');
    showGroundView(false);
    transitionToView('southPole', () => {
      showGroundView(true, 'south');
    });
  });
}

// Animation loop
let magnetoParams = { compression: 0, tailLength: 1.5, equatorBulge: 1.2 };
function animate() {
  requestAnimationFrame(animate);
  updateTime();
  updateControls();
  animateSun(time);
  if (earth) earth.rotation.y += 0.003;

  maybeAuto();
  const shockStatus = updateShockwaves(earth.position, magnetoParams, time);

  const solarInputs = {
    pd: Math.max(0.5, simulationParams.density / 3.5),
    bz: simulationParams.bz,
    density: simulationParams.density,
    speed: simulationParams.windSpeed
  };

  magnetoParams = updateMagnetosphere(
    time,
    solarInputs,
    shockStatus.rippleInfo,
    {
      proximity: shockStatus.proximity,
      compressionBoost: shockStatus.compressionBoost,
      impactNormal: shockStatus.impactNormal
    }
  );

  composer.render();
  if (auroraMaterial?.uniforms) auroraMaterial.uniforms.uTime.value = time;
  updateGroundAurora(simulationParams, time);
  renderGroundView();
}
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader');
  if (loader) {
    const obs = new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.target.style.display === 'none') {
          animate();
          obs.disconnect();
        }
      });
    });
    obs.observe(loader, { attributes: true, attributeFilter: ['style'] });
  } else {
    animate();
  }
});
