import { THREE } from './scene-core.js';

class SimplexNoise {
	constructor( r = Math ) { this.r = r; this.p = new Uint8Array( 256 ); this.perm = new Uint8Array( 512 ); this.permMod12 = new Uint8Array( 512 ); for ( let i = 0; i < 256; i ++ ) { this.p[ i ] = i; } this.shuffle( this.p ); for ( let i = 0; i < 512; i ++ ) { this.perm[ i ] = this.p[ i & 255 ]; this.permMod12[ i ] = this.perm[ i ] % 12; } }
	shuffle( a ) { for ( let i = a.length - 1; i > 0; i -- ) { const j = Math.floor( this.r.random() * ( i + 1 ) ); [ a[ i ], a[ j ] ] = [ a[ j ], a[ i ] ]; } }
	noise( x, y ) { const G2 = ( 3.0 - Math.sqrt( 3.0 ) ) / 6.0; const F2 = 0.5 * ( Math.sqrt( 3.0 ) - 1.0 ); let n = 0.0; let t = ( x + y ) * F2; let i = Math.floor( x + t ); let j = Math.floor( y + t ); t = ( i + j ) * G2; const X0 = i - t; const Y0 = j - t; const x0 = x - X0; const y0 = y - Y0; let i1, j1; if ( x0 > y0 ) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; } const x1 = x0 - i1 + G2; const y1 = y0 - j1 + G2; const x2 = x0 - 1.0 + 2.0 * G2; const y2 = y0 - 1.0 + 2.0 * G2; const ii = i & 255; const jj = j & 255; let t0 = 0.5 - x0 * x0 - y0 * y0; if ( t0 >= 0 ) { t0 *= t0; n += t0 * t0 * this.dot( this.grad( this.perm[ ii + this.perm[ jj ] ] ), x0, y0 ); } let t1 = 0.5 - x1 * x1 - y1 * y1; if ( t1 >= 0 ) { t1 *= t1; n += t1 * t1 * this.dot( this.grad( this.perm[ ii + i1 + this.perm[ jj + j1 ] ] ), x1, y1 ); } let t2 = 0.5 - x2 * x2 - y2 * y2; if ( t2 >= 0 ) { t2 *= t2; n += t2 * t2 * this.dot( this.grad( this.perm[ ii + 1 + this.perm[ jj + 1 ] ] ), x2, y2 ); } return 70.0 * n; }
	dot( g, x, y ) { return g[ 0 ] * x + g[ 1 ] * y; }
	grad( hash ) { const g = [ [ 1, 1 ], [ - 1, 1 ], [ 1, - 1 ], [ - 1, - 1 ], [ 1, 0 ], [ - 1, 0 ], [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ], [ 0, 1 ], [ 0, - 1 ] ]; return g[ hash % 12 ]; }
}

export function createNorthPoleAuroraCurtains(material) {
    const auroraGroup = new THREE.Group();
    const numCurtains = 12;

    for (let i = 0; i < numCurtains; i++) {
        const radius = 70 + Math.random() * 20;
        const height = 30 + Math.random() * 20;
        const radialSegments = 64;
        const heightSegments = 1;
        const thetaLength = Math.PI * (0.3 + Math.random() * 0.4);
        const thetaStart = Math.random() * Math.PI * 2;

        const geometry = new THREE.CylinderGeometry(
            radius, radius, height,
            radialSegments, heightSegments, true,
            thetaStart, thetaLength
        );
        
        // --- ADD RANDOM SEED FOR INDEPENDENT ANIMATION ---
        const randomOffset = Math.random() * 100.0;
        const vertexCount = geometry.attributes.position.count;
        const offsetArray = new Float32Array(vertexCount);
        offsetArray.fill(randomOffset);
        geometry.setAttribute('aRandomOffset', new THREE.BufferAttribute(offsetArray, 1));
        
        const curtainMesh = new THREE.Mesh(geometry, material);
        curtainMesh.position.y = 15; // Lifts the base of each curtain
        auroraGroup.add(curtainMesh);
    }
    // LIFT THE ENTIRE AURORA SYSTEM HIGHER
    auroraGroup.position.y = 15;
    return auroraGroup;
}

export function createNorthPoleTerrain() {
    const geometry = new THREE.PlaneGeometry(300, 300, 100, 100);
    const simplex = new SimplexNoise();
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i <= vertices.length; i += 3) {
        const x = vertices[i]; const y = vertices[i + 1];
        vertices[i + 2] = simplex.noise(x / 80, y / 80) * 3 + simplex.noise(x / 20, y / 20) * 0.5;
    }
    geometry.computeVertexNormals();
    return geometry;
}

export function createNorthPoleMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0x1c2a49, roughness: 0.8, metalness: 0.1 });
}

export function setupNorthPoleEnvironment(scene) {
    scene.fog = new THREE.Fog(0x050515, 30, 150);
}