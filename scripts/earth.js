import { THREE, scene } from './scene-core.js';
import { createMagnetosphere } from './magnetosphere.js';

export function createEarth() {
    // Create ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Create directional light for better definition
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Create Earth with proper texture path
    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(20, 64, 64),
        new THREE.MeshLambertMaterial({ 
            map: new THREE.TextureLoader().load('assets/earth_atmos_2048.jpg')
        })
    );
    
    // Position and add to scene
    earth.position.set(0, 0, 0);
    scene.add(earth);
    
    // Create magnetosphere immediately
    createMagnetosphere(earth.position);
    
    return earth;
}
