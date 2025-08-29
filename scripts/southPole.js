import { THREE } from './scene-core.js';



export function createSouthPoleAuroraCurtains(auroraMaterial) {
    // Flat 2D aurora effect
    const auroraGeometry = new THREE.PlaneGeometry(300, 150, 1, 1);
    const auroraPlane = new THREE.Mesh(auroraGeometry, auroraMaterial);
    auroraPlane.position.set(0, 75, -100);
    auroraPlane.renderOrder = 5;

    const group = new THREE.Group();
    group.add(auroraPlane);
    return group;
}

export function setupSouthPoleEnvironment(scene) {
    scene.fog = new THREE.Fog(0x001133, 10, 150);
}
