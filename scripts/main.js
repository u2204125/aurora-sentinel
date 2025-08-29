import { THREE, scene, camera, renderer, composer, initScene, updateControls, updateTime, time, transitionToView } from './scene-core.js';
import { createSun, animateSun } from './sun.js';
import { createEarth } from './earth.js';
import { createShockwave, updateShockwaves } from './shockwave.js';
import { updateMagnetosphere } from './magnetosphere.js';
import { createStars } from './stars.js';
import { ControlPanel } from './control-panel.js';
import { DonkiAPI } from './donki-api.js';
import { initGroundView, updateGroundAurora, showGroundView, renderGroundView } from './groundview.js';

let lastShockwaveTime = 0;
let lastAutoShockwaveTime = 0;

// Function to handle automatic flare creation
function checkAutoFlare(currentTime) {
    if (!simulationParams.emissionInterval) return; // If interval is 0, don't auto-emit
    
    const interval = simulationParams.emissionInterval * 1000; // Convert to milliseconds
    if (currentTime - lastAutoShockwaveTime > interval) {
        createShockwave(sun.position, earth.position, {
            windSpeed: simulationParams.windSpeed,
            density: simulationParams.density
        });
        lastAutoShockwaveTime = currentTime;
    }
}

// Initialize scene
initScene();

// Create celestial objects
const starField = createStars();
const sun = createSun();
const earth = createEarth();

// Function to create a solar flare
function createSolarFlare() {
    const currentTime = Date.now();
    if (currentTime - lastShockwaveTime > 2000) {
        createShockwave(sun.position, earth.position, {
            windSpeed: simulationParams.windSpeed,
            density: simulationParams.density
        });
        lastShockwaveTime = currentTime;
    }
}

// Click handler for manual flare creation
sun.userData.onClick = createSolarFlare;

// Add click event listener to the canvas
renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, camera);

    const intersects = raycaster.intersectObjects(scene.children);
    
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject.userData.onClick) {
            clickedObject.userData.onClick();
        }
    }
});

// Handle view switching buttons
const spaceViewBtn = document.getElementById('space-view-btn');
const groundViewBtn = document.getElementById('ground-view-btn');
const groundViewWrapper = document.getElementById('ground-view-wrapper');
const northPoleBtn = document.getElementById('north-pole-btn');
const southPoleBtn = document.getElementById('south-pole-btn');

// Initialize control panel
const simulationParams = {
    windSpeed: 500,
    density: 10,
    bz: -5,
    emissionInterval: 5,
    realMode: false
};
const controlPanel = new ControlPanel(simulationParams);

// Connect aurora shader to control panel
import { createAuroraMaterial } from './auroraShader.js';
const auroraMaterial = createAuroraMaterial();

// Update aurora when parameters change
controlPanel.onParamChange((params) => {
    auroraMaterial.updateFromParams(params);
});

controlPanel.init();

// Initialize ground view
initGroundView();

// Initialize DONKI API for real-time data
const donkiAPI = new DonkiAPI();

// Update real-time data when in real mode
async function updateRealTimeData() {
    if (!simulationParams.realMode) return;
    
    const data = await donkiAPI.getCMEAnalysis();
    if (data) {
        simulationParams.windSpeed = data.speed || 500;
        simulationParams.density = data.density || 10;
        simulationParams.bz = data.bz || -5;
        controlPanel.updateValues(simulationParams);
    }
}

// Update real-time data periodically
setInterval(updateRealTimeData, 5 * 60 * 1000); // Update every 5 minutes

// Function to close pole buttons
function closePoleButtons(e) {
    // Don't close if clicking inside the ground view wrapper
    if (e && groundViewWrapper.contains(e.target)) return;
    groundViewWrapper.classList.remove('active');
    // Remove the click listener from document
    document.removeEventListener('click', closePoleButtons);
}

// Toggle pole buttons on ground view button click
groundViewBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    const isActive = groundViewWrapper.classList.contains('active');
    
    if (!isActive) {
        // Open pole buttons
        groundViewWrapper.classList.add('active');
        // Add click listener to document with a slight delay to avoid immediate triggering
        setTimeout(() => {
            document.addEventListener('click', closePoleButtons);
        }, 0);
    } else {
        // Close pole buttons
        closePoleButtons();
    }
});

// Handle view transitions
spaceViewBtn.addEventListener('click', () => {
    showGroundView(false);
    transitionToView('space');
});

northPoleBtn.addEventListener('click', () => {
    showGroundView(false);
    transitionToView('northPole', () => {
        showGroundView(true, 'north');
    });
    closePoleButtons();
});

southPoleBtn.addEventListener('click', () => {
    showGroundView(false);
    transitionToView('southPole', () => {
        showGroundView(true, 'south');
    });
    closePoleButtons();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updateTime();  // Update global time
    updateControls(); // Update orbit controls
    animateSun(time);  // Pass global time to sun animation
    
    // Rotate Earth
    if (earth) {
        earth.rotation.y += 0.005;
    }
    
    // Update shockwaves and check for collisions
    const collision = updateShockwaves(earth.position, simulationParams);
    if (collision) {
        updateMagnetosphere(time, 1.0, simulationParams); // Compress magnetosphere on collision
    } else {
        updateMagnetosphere(time, 0, simulationParams); // Normal state
    }
    
    // Check for automatic flare creation
    if (simulationParams.emissionInterval > 0) {
        checkAutoFlare(Date.now());
    }
    
    updateTime();
    composer.render();
    
    // Update aurora material with current time
    if (auroraMaterial && auroraMaterial.uniforms) {
        auroraMaterial.uniforms.uTime.value = time;
    }
    
    // Update and render ground view aurora
    updateGroundAurora(simulationParams, time);
    renderGroundView();
}

// Start animation after loader disappears
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.style.display === 'none') {
                    animate();
                    observer.disconnect();
                }
            });
        });
        
        observer.observe(loader, {
            attributes: true,
            attributeFilter: ['style']
        });
    } else {
        animate();
    }
});
