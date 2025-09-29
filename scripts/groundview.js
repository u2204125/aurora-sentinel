import { THREE } from './scene-core.js';
import { 
    createNorthPoleTerrain,
    createNorthPoleMaterial,
    createNorthPoleAuroraCurtains,
    setupNorthPoleEnvironment
} from './northPole.js';
import {
    createSouthPoleTerrain,
    createSouthPoleMaterial,
    createSouthPoleAuroraCurtains,
    setupSouthPoleEnvironment
} from './southPole.js';
import { createAuroraMaterial } from './auroraShader.js';

let groundScene, groundCamera, groundRenderer;
let groundAuroras;
let auroraMaterial;

export function initGroundView() {
    const groundViewContainer = document.getElementById('ground-view-container');
    
    groundScene = new THREE.Scene();
    groundCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    groundRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // --- AUTOMATIC QUALITY DETECTION ---
    const gl = groundRenderer.getContext();
    const hasHighPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0;
    const quality = hasHighPrecision ? 'high' : 'low';
    
    console.log(`GPU supports high precision: ${hasHighPrecision}. Using '${quality}' quality aurora.`);
    
    auroraMaterial = createAuroraMaterial(quality);
    
    groundRenderer.setSize(window.innerWidth, window.innerHeight);
    groundViewContainer.appendChild(groundRenderer.domElement);
    
    // --- Create Terrains ---
    const northTerrain = new THREE.Mesh(createNorthPoleTerrain(), createNorthPoleMaterial());
    northTerrain.rotation.x = -Math.PI / 2; northTerrain.position.y = -2; northTerrain.visible = false;
    groundScene.add(northTerrain);
    groundScene.userData.northTerrain = northTerrain;
    
    const southTerrain = new THREE.Mesh(createSouthPoleTerrain(), createSouthPoleMaterial());
    southTerrain.rotation.x = -Math.PI / 2; southTerrain.position.y = -2; southTerrain.visible = false;
    groundScene.add(southTerrain);
    groundScene.userData.southTerrain = southTerrain;

    // --- Lighting and Stars ---
    const ambientLight = new THREE.AmbientLight(0x102040, 0.3);
    groundScene.add(ambientLight);
    const moonLight = new THREE.DirectionalLight(0x8090cc, 0.6);
    moonLight.position.set(5, 5, 2);
    groundScene.add(moonLight);
    
    const starVertices = [];
    for (let i = 0; i < 5000; i++) {
        starVertices.push(THREE.MathUtils.randFloatSpread(2000), THREE.MathUtils.randFloat(100, 1000), THREE.MathUtils.randFloatSpread(2000));
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    groundScene.add(stars);
    
    groundAuroras = new THREE.Group();
    groundScene.add(groundAuroras);
    
    window.addEventListener('resize', onWindowResize);
}

export function updateGroundAurora(params, time) {
    if (!auroraMaterial || !auroraMaterial.uniforms) return;
    
    auroraMaterial.uniforms.uTime.value = time;
    
    let intensity = THREE.MathUtils.mapLinear(params.density, 1, 50, 0.8, 2.5);
    const bzFactor = THREE.MathUtils.mapLinear(Math.abs(params.bz), 0, 20, 1.0, 3.0);
    auroraMaterial.uniforms.uIntensity.value = intensity * bzFactor;
    
    auroraMaterial.updateFromParams(params);
}

export function showGroundView(visible, pole = 'north') {
    const container = document.getElementById('ground-view-container');
    container.style.display = visible ? 'block' : 'none';
    
    if (visible) {
        if (pole === 'north') {
            groundScene.userData.northTerrain.visible = true;
            groundScene.userData.southTerrain.visible = false;
            setupNorthPoleEnvironment(groundScene);
        } else {
            groundScene.userData.northTerrain.visible = false;
            groundScene.userData.southTerrain.visible = true;
            setupSouthPoleEnvironment(groundScene);
        }
        
        while(groundAuroras.children.length > 0) {
            groundAuroras.remove(groundAuroras.children[0]);
        }
        
        const newAuroras = pole === 'north' 
            ? createNorthPoleAuroraCurtains(auroraMaterial)
            : createSouthPoleAuroraCurtains(auroraMaterial);
        
        groundAuroras.add(newAuroras);
        
        groundCamera.position.set(0, 4, 50);
        groundCamera.lookAt(0, 15, -50);
    }
}

export function renderGroundView() {
    if (groundRenderer && groundScene && groundCamera) {
        groundRenderer.render(groundScene, groundCamera);
    }
}

function onWindowResize() {
    if (groundCamera && groundRenderer) {
        groundCamera.aspect = window.innerWidth / window.innerHeight;
        groundCamera.updateProjectionMatrix();
        groundRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}