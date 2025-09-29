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
            tailLength: { value: 1.5 },
            // Uniforms for the ripple effect
            uRippleTime: { value: 999 },
            uRippleActive: { value: 0.0 },
            uRippleOrigin: { value: new THREE.Vector3(40, 0, 0) }
        },
        vertexShader: `
            uniform float time;
            uniform float compression;
            uniform vec3 solarWindDirection;
            uniform float magneticPoleStrength;
            uniform float equatorBulge;
            uniform float tailLength;
            uniform float uRippleTime;
            uniform float uRippleActive;
            uniform vec3 uRippleOrigin;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            void main() {
                vPosition = position;
                vNormal = normal;
                vec3 pos = position;
                
                if (pos.x > 0.0) { pos.x *= (1.0 - compression * 0.3); } 
                else { pos.x *= (1.0 + tailLength * (1.0 - compression * 0.5)); }
                
                float latitude = asin(pos.y / length(pos));
                float latitudeEffect = pow(cos(latitude), 2.0) * equatorBulge;
                float radiusMultiplier = 1.0 + latitudeEffect * 0.2;
                pos.xz *= radiusMultiplier;
                
                float poleEffect = 1.0 - pow(abs(sin(latitude)), 3.0) * magneticPoleStrength;
                pos *= poleEffect;
                
                if (compression > 0.0) {
                    float angle = dot(normalize(pos), solarWindDirection);
                    float deformation = smoothstep(-1.0, 1.0, angle) * compression;
                    pos -= solarWindDirection * deformation * 10.0;
                    float turbulence = sin(time * 5.0 + length(pos) * 0.2) * compression * 2.0;
                    pos += normal * turbulence;
                }

                // RIPPLE EFFECT LOGIC
                if (uRippleActive > 0.5) {
                    float rippleSpeed = 60.0;
                    float rippleWidth = 20.0;
                    float distFromOrigin = distance(pos, uRippleOrigin);
                    float wave = sin((distFromOrigin - uRippleTime * rippleSpeed) / rippleWidth);
                    float rippleIntensity = max(0.0, 1.0 - uRippleTime * 0.8) * 3.0;
                    pos += normalize(pos) * wave * rippleIntensity;
                }
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        // --- THIS IS THE RESTORED, COMPLETE FRAGMENT SHADER ---
        fragmentShader: `
            uniform float time;
            uniform float compression;
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            void main() {
                float latitude = asin(vPosition.y / length(vPosition));
                vec3 baseColor = vec3(0.2, 0.6, 1.0);
                
                float poleInfluence = pow(abs(sin(latitude)), 8.0);
                vec3 poleColor = vec3(0.6, 0.2, 1.0);
                vec3 finalColor = mix(baseColor, poleColor, poleInfluence);
                
                float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 3.0);
                float fieldStrength = 1.0 - pow(abs(sin(latitude)), 2.0);
                float alpha = fresnel * 0.4 * fieldStrength;
                
                float pulse = sin(time * 2.0) * 0.1 + 0.9;
                alpha *= pulse;
                
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
let currentBz = 0;

export function updateMagnetosphere(time, compressionAmount = 0, params = { bz: -5 }, rippleInfo) {
    if (!magnetosphere) return;
    
    const smoothSpeed = 0.1;
    currentCompression += (compressionAmount - currentCompression) * smoothSpeed;
    
    const bzSmoothSpeed = 0.05;
    currentBz += (params.bz - currentBz) * bzSmoothSpeed;
    
    const uniforms = magnetosphere.material.uniforms;
    uniforms.time.value = time;
    uniforms.compression.value = currentCompression;
    
    const bzEffect = Math.max(0, currentBz / 10);
    const compressionEffect = currentCompression * 0.3;
    uniforms.magneticPoleStrength.value = 1.0 + bzEffect - compressionEffect;
    
    const bzBulgeEffect = Math.max(0, -currentBz / 10);
    uniforms.equatorBulge.value = 1.2 + currentCompression * 0.3 + bzBulgeEffect * 0.4;
    
    const bzTailEffect = Math.max(0, -currentBz / 10);
    uniforms.tailLength.value = 1.5 + currentCompression * 0.5 + bzTailEffect * 0.8;

    if (rippleInfo && rippleInfo.active) {
        uniforms.uRippleActive.value = 1.0;
        uniforms.uRippleTime.value = rippleInfo.time;
        uniforms.uRippleOrigin.value.copy(rippleInfo.origin);
    } else {
        uniforms.uRippleActive.value = 0.0;
    }

    return {
        compression: currentCompression,
        tailLength: uniforms.tailLength.value,
        equatorBulge: uniforms.equatorBulge.value
    };
}