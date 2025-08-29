import { THREE } from './scene-core.js';

export function createAuroraCurtain(isNorthPole, segments = 40) {
    const geometry = new THREE.BufferGeometry();
    const verticalSegments = 20;
    
    // Create base curve points
    const points = [];
    const curtainLength = isNorthPole ? 80 : 60;
    const curtainHeight = isNorthPole ? 35 : 25;
    const waviness = isNorthPole ? 0.3 : 0.2;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = Math.PI * 2 * t;
        
        // Calculate base position with natural wave pattern
        const radius = 40 + Math.sin(t * Math.PI * 2) * 15;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Add height variation for more natural flow
        const heightVariation = 
            Math.sin(t * Math.PI * 3) * 5 +
            Math.sin(t * Math.PI * 7) * 2 +
            Math.sin(t * Math.PI * 11) * 1;
            
        const y = Math.sin(t * Math.PI) * curtainHeight + heightVariation;
        points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points, true);
    const positions = [];
    const uvs = [];
    
    // Generate curtain mesh
    for (let i = 0; i <= verticalSegments; i++) {
        const v = i / verticalSegments;
        for (let j = 0; j <= segments; j++) {
            const u = j / segments;
            const point = curve.getPoint(u);
            
            // Create tapering width effect
            const width = 15 * (1 - v * v);
            const normal = curve.getTangent(u).cross(new THREE.Vector3(0, 1, 0)).normalize();
            
            // Add natural waviness to the curtain
            const waveOffset = Math.sin(u * Math.PI * 4 + v * Math.PI * 2) * (1 - v) * 2;
            
            positions.push(
                point.x + normal.x * width * (1 - v * 0.5) + waveOffset,
                point.y * (1 - v * 0.2),
                point.z + normal.z * width * (1 - v * 0.5) + waveOffset
            );
            uvs.push(u, v);
        }
    }
    
    // Create faces
    const indices = [];
    const segWidth = segments + 1;
    for (let i = 0; i < verticalSegments; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * segWidth + j;
            const b = a + 1;
            const c = a + segWidth;
            const d = c + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

export function createAuroraGroup(isNorthPole, material) {
    const group = new THREE.Group();
    const curtainCount = isNorthPole ? 6 : 4;
    
    for (let i = 0; i < curtainCount; i++) {
        const geometry = createAuroraCurtain(isNorthPole);
        const curtain = new THREE.Mesh(geometry, material);
        
        // Position each curtain
        const angle = (i / curtainCount) * Math.PI * 2;
        curtain.position.x = Math.cos(angle) * 30;
        curtain.position.z = Math.sin(angle) * 30;
        curtain.rotation.y = angle;
        
        group.add(curtain);
    }
    
    // Set the entire group's position
    group.position.y = isNorthPole ? 2 : 0;
    group.position.z = -30;
    
    return group;
}
