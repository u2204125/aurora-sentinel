import { THREE } from './scene-core.js';

export function createNorthPoleTerrain() {
    const terrainGeometry = new THREE.PlaneGeometry(200, 200, 200, 200);
    const vertices = terrainGeometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        const distance = Math.sqrt(x * x + z * z);
        
        // North pole specific terrain with rolling hills and snow drifts
        const height = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 3 + // Rolling hills
                      Math.sin(x * 0.08) * Math.cos(z * 0.08) * 5 +   // Larger formations
                      (Math.random() * 0.8) +                         // Snow drifts
                      Math.sin(x * 0.3) * Math.cos(z * 0.3) * 2;     // Small details
                      
        vertices[i + 1] = height * (1 - Math.min(1, distance / 100));
    }
    
    terrainGeometry.computeVertexNormals();
    return terrainGeometry;
}

export function createNorthPoleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill with white base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    // Add snow texture noise
    for (let i = 0; i < 15000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 230, 230, ${Math.random() * 0.3})`;
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
}

export function createNorthPoleMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.1,
        bumpMap: createNorthPoleTexture(),
        bumpScale: 0.3,
        flatShading: true,
    });
}

export function createNorthPoleAuroraCurtains(auroraMaterial) {
    // Flat 2D aurora effect
    const auroraGeometry = new THREE.PlaneGeometry(300, 150, 1, 1);
    const auroraPlane = new THREE.Mesh(auroraGeometry, auroraMaterial);
    auroraPlane.position.set(0, 75, -100);
    auroraPlane.renderOrder = 5;

    const group = new THREE.Group();
    group.add(auroraPlane);
    return group;
}

export function setupNorthPoleEnvironment(scene) {
    scene.fog = new THREE.Fog(0x001133, 10, 150);
}
