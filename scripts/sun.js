import { THREE, scene } from './scene-core.js';

let sun;

export function createSun() {
    const sunGeometry = new THREE.SphereGeometry(30, 64, 64);
    const sunMaterial = new THREE.ShaderMaterial({
        transparent: false, // Ensure full opacity
        uniforms: {
            time: { value: 0 },
            baseColor: { value: new THREE.Color(0xffdd44) },  // Warmer yellow base
            glowColor: { value: new THREE.Color(0xffff88) },  // Brighter yellow glow
            pulseColor: { value: new THREE.Color(0xffaa00) }, // Orange-yellow pulse
            // Additional uniforms for future color changes
            intensity: { value: 1.0 },
            activityLevel: { value: 0.0 },
            colorShift: { value: new THREE.Vector3(1.0, 1.0, 1.0) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 baseColor;
            uniform vec3 glowColor;
            uniform vec3 pulseColor;
            uniform float intensity;
            uniform float activityLevel;
            uniform vec3 colorShift;
            varying vec2 vUv;
            varying vec3 vNormal;
            
            // For future color manipulation
            vec3 adjustColor(vec3 color) {
                return color * colorShift * intensity;
            }
            
            // Improved noise function
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187,
                                  0.366025403784439,
                                 -0.577350269189626,
                                  0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                    + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ;
                m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }
            
            void main() {
                // Create multiple layers of noise with faster animation
                float n1 = snoise(vUv * 8.0 + time * 0.8);  // Faster base turbulence
                float n2 = snoise(vUv * 16.0 - time * 1.2); // Faster medium details
                float n3 = snoise(vUv * 32.0 + time * 1.5); // Faster fine details
                
                // Combine noise layers with activity level influence
                float noise = mix(
                    n1 * 0.5 + n2 * 0.3 + n3 * 0.2,
                    n1 * 0.3 + n2 * 0.4 + n3 * 0.3,
                    activityLevel
                );
                
                // Create faster pulsing effect
                float pulse = sin(time * 3.0) * 0.5 + 0.5;
                
                // Edge glow effect
                float edgeGlow = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                
                // Mix colors based on noise and effects
                vec3 color = mix(baseColor, glowColor, noise);
                color = mix(color, pulseColor, pulse * 0.3);
                color += glowColor * edgeGlow * 0.5;
                
                // Apply color adjustments for future interactions
                color = adjustColor(color);
                
                // Ensure full opacity
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(700, 0, 0);  // Position sun further to the right
    scene.add(sun);

    // Add point light
    const sunLight = new THREE.PointLight(0xffffff, 2, 1500);
    sunLight.position.copy(sun.position);
    scene.add(sunLight);
    
    return sun;
}

// Function to update sun's appearance (for future interactions)
export function updateSunState(params = {}) {
    if (!sun) return;
    
    const {
        intensity = sun.material.uniforms.intensity.value,
        activityLevel = sun.material.uniforms.activityLevel.value,
        colorShift = sun.material.uniforms.colorShift.value
    } = params;
    
    sun.material.uniforms.intensity.value = intensity;
    sun.material.uniforms.activityLevel.value = activityLevel;
    sun.material.uniforms.colorShift.value = colorShift;
}

export function animateSun(globalTime) {
    if (!sun) return;
    sun.material.uniforms.time.value = globalTime;
    sun.rotation.y += 0.001;
}

    // Update controls in animation
