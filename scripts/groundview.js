import { THREE } from './scene-core.js';
import { 
    createNorthPoleTerrain,
    createNorthPoleMaterial,
    createNorthPoleAuroraCurtains,
    setupNorthPoleEnvironment
} from './northPole.js';
import {
    createSouthPoleAuroraCurtains,
    setupSouthPoleEnvironment
} from './southPole.js';
import { createAuroraMaterial } from './auroraShader.js';

let groundScene, groundCamera, groundRenderer;
let groundAuroras, groundFlash;
let auroraMaterial;

export function initGroundView() {
    const groundViewContainer = document.getElementById('ground-view-container');
    
    // Create scene
    groundScene = new THREE.Scene();
    groundCamera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
    groundRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // Initialize aurora material
    auroraMaterial = createAuroraMaterial();
    
    // Set initial camera position
    groundCamera.position.y = 1.5;
    
    // Set up renderer
    groundRenderer.setSize(window.innerWidth, window.innerHeight);
    groundViewContainer.appendChild(groundRenderer.domElement);
    
    // Set up camera
    groundCamera.position.y = 1.5;
    
    // Create north pole terrain
    const northTerrain = new THREE.Mesh(createNorthPoleTerrain(), createNorthPoleMaterial());
    
    northTerrain.rotation.x = -Math.PI / 2;
    northTerrain.position.y = -2;
    
    // Add to scene but hide initially
    northTerrain.visible = false;
    groundScene.add(northTerrain);
    
    // Store references for later use
    groundScene.userData.northTerrain = northTerrain;
    
    // Add atmospheric lighting
    const ambientLight = new THREE.AmbientLight(0x001133, 0.2);  // Deep blue night ambient
    groundScene.add(ambientLight);
    
    const moonLight = new THREE.DirectionalLight(0x555588, 0.8);
    moonLight.position.set(5, 3, 2);
    groundScene.add(moonLight);
    
    // Add stars to the background
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starSizes = [];
    const starOpacities = [];

    for (let i = 0; i < 10000; i++) { // Increased star count
        const r = 500;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        starVertices.push(x, y, z);

        // Add random sizes and opacities
        starSizes.push(Math.random() * 1.5 + 0.5); // Varying sizes
        starOpacities.push(Math.random() * 0.5 + 0.5); // Varying opacities
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
    starGeometry.setAttribute('opacity', new THREE.Float32BufferAttribute(starOpacities, 1));

    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xffffff) },
            pointTexture: { value: createStarTexture() }
        },
        vertexShader: `
            attribute float size;
            attribute float opacity;
            varying float vOpacity;
            void main() {
                vOpacity = opacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform sampler2D pointTexture;
            varying float vOpacity;
            void main() {
                gl_FragColor = vec4(color, vOpacity) * texture2D(pointTexture, gl_PointCoord);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    groundScene.add(stars);
    
    // Initialize empty aurora group
    groundAuroras = new THREE.Group();
    groundScene.add(groundAuroras);
    
    // Add flash effect
    createGroundFlash();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function createGroundFlash() {
    const flashMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;
            
            void main() {
                float dist = distance(vUv, vec2(0.5, 1.0));
                float strength = smoothstep(0.8, 0.0, dist) * (1.0 - uTime) * 0.5;
                gl_FragColor = vec4(1.0, 1.0, 1.0, strength);
            }
        `,
        transparent: true
    });
    
    groundFlash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMaterial);
    groundScene.add(groundFlash);
}

export function updateGroundAurora(params, time) {
    if (!auroraMaterial || !auroraMaterial.uniforms) return;
    
    // Update aurora parameters based on simulation values
    auroraMaterial.uniforms.uTime.value = time;
    auroraMaterial.uniforms.uSpeed.value = THREE.MathUtils.mapLinear(params.windSpeed, 300, 1200, 0.05, 0.5);
    
    let intensity = THREE.MathUtils.mapLinear(params.density, 1, 50, 0.3, 1.5);
    const bzFactor = THREE.MathUtils.mapLinear(params.bz, 0, -20, 1.0, 4.0);
    auroraMaterial.uniforms.uIntensity.value = intensity * bzFactor;
    
    // Update colors based on parameters
    const energyLevel = Math.abs(params.bz) / 20; // Normalize to 0-1
    const midColor = new THREE.Color();

    // Adjust colors based on energy level
    if (energyLevel < 0.3) {
        // Low energy - subtle pink
        midColor.setHSL(0.9, 0.5, 0.6);
    } else if (energyLevel < 0.7) {
        // Medium energy - stronger pink
        midColor.setHSL(0.9, 0.8, 0.6);
    } else {
        // High energy - intense reddish-pink
        midColor.setHSL(0.95, 0.9, 0.65);
    }
    
    if (auroraMaterial.uniforms.uColorMid) {
        auroraMaterial.uniforms.uColorMid.value.copy(midColor);
    }
}

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for star
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export function showGroundView(visible, pole = 'north') {
    const container = document.getElementById('ground-view-container');
    container.style.display = visible ? 'block' : 'none';
    
    if (visible) {
        // Store current pole and update terrain visibility
        groundScene.userData.currentPole = pole;
        if (groundScene.userData.northTerrain) {
            groundScene.userData.northTerrain.visible = pole === 'north';
        }
        
        // Set up pole-specific environment
        if (pole === 'north') {
            setupNorthPoleEnvironment(groundScene);
        } else {
            setupSouthPoleEnvironment(groundScene);
        }
        
        // Create new aurora curtains based on pole
        while(groundAuroras.children.length > 0) {
            groundAuroras.remove(groundAuroras.children[0]);
        }
        
        const newAuroras = pole === 'north' 
            ? createNorthPoleAuroraCurtains(auroraMaterial)
            : createSouthPoleAuroraCurtains(auroraMaterial);
        
        groundAuroras.add(newAuroras);
        
        // Adjust camera for different poles
        groundCamera.position.y = 1.8;
        groundCamera.position.z = 0;
        groundCamera.lookAt(0, 15, -30);
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
