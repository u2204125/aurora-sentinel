import { THREE, scene } from './scene-core.js';

export let magnetosphere;

export function createMagnetosphere(earthPosition) {
    const magnetosphereGeometry = new THREE.SphereGeometry(40, 64, 64);
    const magnetosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            compression: { value: 0 },
            solarWindDirection: { value: new THREE.Vector3(1, 0, 0) },
            magneticPoleStrength: { value: 1.0 },
            equatorBulge: { value: 1.2 },
            tailLength: { value: 1.5 }
        },
        vertexShader: `
            uniform float time;
            uniform float compression;
            uniform vec3 solarWindDirection;
            uniform float magneticPoleStrength;
            uniform float equatorBulge;
            uniform float tailLength;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            void main() {
                vPosition = position;
                vNormal = normal;
                vec3 pos = position;
                
                // Calculate latitude effect (poles vs equator)
                float latitude = asin(pos.y / length(pos));
                float latitudeEffect = pow(cos(latitude), 2.0) * equatorBulge;
                
                // Basic magnetosphere shape
                if (pos.x > 0.0) {
                    // Sun-facing side: compression
                    pos.x *= (1.0 - compression * 0.3);
                } else {
                    // Tail side: elongation
                    pos.x *= (1.0 + tailLength * (1.0 - compression * 0.5));
                }
                
                // Apply equatorial bulge
                float radiusMultiplier = 1.0 + latitudeEffect * 0.2;
                pos.xz *= radiusMultiplier;
                
                // Reduce field strength at poles
                float poleEffect = 1.0 - pow(abs(sin(latitude)), 3.0) * magneticPoleStrength;
                pos *= poleEffect;
                
                // Dynamic response to solar wind
                if (compression > 0.0) {
                    float angle = dot(normalize(pos), solarWindDirection);
                    float deformation = smoothstep(-1.0, 1.0, angle) * compression;
                    pos -= solarWindDirection * deformation * 10.0;
                    
                    // Add turbulence in compressed regions
                    float turbulence = sin(time * 5.0 + length(pos) * 0.2) * compression * 2.0;
                    pos += normal * turbulence;
                }
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float compression;
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            void main() {
                // Calculate latitude for color variation
                float latitude = asin(vPosition.y / length(vPosition));
                
                // Base color: blue for stable field
                vec3 baseColor = vec3(0.2, 0.6, 1.0);
                
                // Add purple tint near poles
                float poleInfluence = pow(abs(sin(latitude)), 8.0);
                vec3 poleColor = vec3(0.6, 0.2, 1.0);
                vec3 finalColor = mix(baseColor, poleColor, poleInfluence);
                
                // Enhanced fresnel effect for field lines
                float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 3.0);
                
                // Magnetic field strength visualization
                float fieldStrength = 1.0 - pow(abs(sin(latitude)), 2.0);
                
                // Combine effects for final alpha
                float alpha = fresnel * 0.4 * fieldStrength;
                
                // Add subtle pulsing
                float pulse = sin(time * 2.0) * 0.1 + 0.9;
                alpha *= pulse;
                
                // Increase opacity in compressed regions
                if (compression > 0.0) {
                    alpha = mix(alpha, alpha * 1.5, compression);
                    finalColor = mix(finalColor, vec3(0.4, 0.8, 1.0), compression * 0.5);
                }
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.FrontSide
    });
    magnetosphere = new THREE.Mesh(magnetosphereGeometry, magnetosphereMaterial);
    magnetosphere.position.copy(earthPosition);
    scene.add(magnetosphere);
}

let currentCompression = 0;
let targetCompression = 0;
let currentBz = 0;

export function updateMagnetosphere(time, compressionAmount = 0, params = { bz: -5 }) {
    if (!magnetosphere) return;
    
    // Smooth transition for compression
    targetCompression = compressionAmount;
    const smoothSpeed = 0.1;
    currentCompression += (targetCompression - currentCompression) * smoothSpeed;
    
    // Smooth transition for IMF Bz
    const targetBz = params.bz;
    const bzSmoothSpeed = 0.05;
    currentBz += (targetBz - currentBz) * bzSmoothSpeed;
    
    // Update basic uniforms
    magnetosphere.material.uniforms.time.value = time;
    magnetosphere.material.uniforms.compression.value = currentCompression;
    
    // Adjust magnetic field strength based on IMF Bz
    // Negative Bz causes stronger reconnection and weaker field
    const baseStrength = 1.0;
    const bzEffect = Math.max(0, currentBz / 10); // Normalize Bz effect
    const compressionEffect = currentCompression * 0.3;
    magnetosphere.material.uniforms.magneticPoleStrength.value = 
        baseStrength + bzEffect - compressionEffect;
    
    // Adjust equatorial bulge based on IMF Bz and compression
    // Negative Bz increases bulge due to reconnection
    const bzBulgeEffect = Math.max(0, -currentBz / 10);
    magnetosphere.material.uniforms.equatorBulge.value = 
        1.2 + currentCompression * 0.3 + bzBulgeEffect * 0.4;
    
    // Elongate tail more with negative Bz
    const bzTailEffect = Math.max(0, -currentBz / 10);
    magnetosphere.material.uniforms.tailLength.value = 
        1.5 + currentCompression * 0.5 + bzTailEffect * 0.8;
    
    // Update solar wind direction with slight variations
    const windVariation = Math.sin(time * 0.5) * 0.1;
    magnetosphere.material.uniforms.solarWindDirection.value.set(
        1,
        windVariation + currentBz * 0.1, // Slight deflection based on Bz
        windVariation
    );
}
