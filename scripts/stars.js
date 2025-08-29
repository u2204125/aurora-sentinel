import { scene, THREE } from './scene-core.js';

export let stars;

export function createStars() {
    const starGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const starMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });
    
    stars = new THREE.Group();
    
    // Create 2000 stars positioned randomly in 3D space
    // Reduced count because spheres are more performance-intensive than points
    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        
        // Only add stars that are far enough from center
        const dist = x * x + y * y + z * z;
        if (dist > 100000) {
            const star = new THREE.Mesh(starGeometry, starMaterial);
            star.position.set(x, y, z);
            stars.add(star);
        }
    }
    
    scene.add(stars);
    return stars;
}
