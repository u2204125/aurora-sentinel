// Core imports
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Shared scene objects
export let scene, camera, renderer, controls, composer;
export let time = 0;
export let deltaTime = 0; // Time elapsed since last frame
let lastTime = 0;

// Initialize core scene
// Camera positions for different views
const CAMERA_POSITIONS = {
    space: {
        position: new THREE.Vector3(-200, 50, -100),  // Closer position
        target: new THREE.Vector3(0, 0, 0)           // Looking at center
    },
    northPole: {
        position: new THREE.Vector3(0, 30, 10),      // Much closer to surface, lower height
        target: new THREE.Vector3(0, 10, 0)          // Looking slightly upward across surface
    },
    southPole: {
        position: new THREE.Vector3(0, -20, -80),    // Much closer to surface, lower height
        target: new THREE.Vector3(0, -10, 0)         // Looking slightly upward across surface
    }
};

// Transition duration in seconds
const TRANSITION_DURATION = 2.0;
let currentTransition = null;

export function initScene() {
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.copy(CAMERA_POSITIONS.space.position);
    camera.lookAt(CAMERA_POSITIONS.space.target);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true,
        logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.sortObjects = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Setup bloom effect
    const renderPass = new RenderPass(scene, camera);
    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,    // strength
        0.4,    // radius
        0.85    // threshold
    );
    composer.addPass(bloomPass);
    
    // Initialize controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;
    controls.minDistance = 100;
    controls.maxDistance = 400;
    controls.enablePan = false;
}

// Function to transition camera to a new view
export function transitionToView(viewName, onComplete) {
    if (!CAMERA_POSITIONS[viewName]) return;
    
    // Disable controls during transition
    controls.enabled = false;
    
    const targetPos = CAMERA_POSITIONS[viewName].position.clone();
    const targetLook = CAMERA_POSITIONS[viewName].target.clone();
    
    const startPos = camera.position.clone();
    const startLook = controls.target.clone();
    
    const startTime = Date.now();
    
    // Cancel any ongoing transition
    if (currentTransition) {
        cancelAnimationFrame(currentTransition);
    }
    
    function updateTransition() {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        
        // Smooth easing function
        const eased = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate camera position and look-at target
        camera.position.lerpVectors(startPos, targetPos, eased);
        controls.target.lerpVectors(startLook, targetLook, eased);
        
        camera.lookAt(controls.target);
        
        if (progress < 1) {
            currentTransition = requestAnimationFrame(updateTransition);
        } else {
            // Re-enable controls after transition
            controls.enabled = true;
            currentTransition = null;
            
            // Update UI
            updateViewButtons(viewName);
            
            // Call the completion callback if provided
            if (onComplete) {
                onComplete();
            }
        }
    }
    
    currentTransition = requestAnimationFrame(updateTransition);
}

// Function to update button states
function updateViewButtons(viewName) {
    const spaceViewBtn = document.getElementById('space-view-btn');
    const groundViewWrapper = document.getElementById('ground-view-wrapper');
    const activePoleBtn = document.getElementById('active-pole-btn');
    
    if (viewName === 'space') {
        spaceViewBtn.classList.add('active');
        groundViewWrapper.style.display = 'block';
        activePoleBtn.style.display = 'none';
        groundViewWrapper.classList.remove('active');
    } else {
        spaceViewBtn.classList.remove('active');
        groundViewWrapper.style.display = 'none';
        activePoleBtn.style.display = 'block';
        activePoleBtn.textContent = viewName === 'northPole' ? 'North Pole' : 'South Pole';
        activePoleBtn.classList.add('active');
    }
}

// Handle window resize
window.addEventListener('resize', onWindowResize);

// Update time
export function updateTime() {
    const currentTime = performance.now() / 1000; // Convert to seconds
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    time += deltaTime;
}

// Update controls
export function updateControls() {
    if (controls) {
        controls.update();
    }
}

// Handle window resize
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    }
}

// Export THREE for other modules
export { THREE };
