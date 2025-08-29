import { THREE } from './scene-core.js';

/**
 * Aurora shader based on Nimitz's 2017 aurora implementation
 * Modified and adapted for our space weather visualization
 */
export function createAuroraMaterial() {
    const auroraMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSpeed: { value: 0.3 }, // Base speed for aurora movement
            uIntensity: { value: 1.2 }, // Overall intensity
            uResolution: { value: new THREE.Vector2(1.0, 1.0) },
            uMouse: { value: new THREE.Vector2(0.1, 0.1) }, // Default view angle
            uWindSpeed: { value: 500.0 }, // Solar wind speed
            uDensity: { value: 10.0 }, // Particle density
            uBz: { value: -5.0 }, // IMF Bz component
            uColorA: { value: new THREE.Color(0.0, 1.0, 0.3) }, // Green
            uColorB: { value: new THREE.Color(0.2, 0.7, 1.0) }, // Cyan
            uColorC: { value: new THREE.Color(0.7, 0.2, 1.0) }, // Purple
            uColorD: { value: new THREE.Color(1.0, 0.25, 0.4) }  // Pink/Red
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision mediump float;
            uniform float uTime;
            uniform float uSpeed;
            uniform float uIntensity;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            uniform float uWindSpeed;
            uniform float uDensity;
            uniform float uBz;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform vec3 uColorC;
            uniform vec3 uColorD;
            
            varying vec2 vUv;
            varying vec3 vPosition;
            
            mat2 mm2(in float a) {
                float c = cos(a), s = sin(a);
                return mat2(c, s, -s, c);
            }
            
            mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534); 
            float tri(in float x) {
                return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
            }
            
            vec2 tri2(in vec2 p) {
                return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
            }
            
            float triNoise2d(in vec2 p, float spd) {
                float z = 1.8;
                float z2 = 2.5;
                float rz = 0.0;
                p *= mm2(p.x * 0.06);
                vec2 bp = p;
                
                for (float i = 0.0; i < 5.0; i++) {
                    vec2 dg = tri2(bp * 1.85) * 0.75;
                    dg *= mm2(uTime * spd);
                    p -= dg / z2;
                    
                    bp *= 1.3;
                    z2 *= 0.45;
                    z *= 0.42;
                    p *= 1.21 + (rz - 1.0) * 0.02;
                    
                    rz += tri(p.x + tri(p.y)) * z;
                    p *= -m2;
                }
                return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
            }
            
            float hash21(in vec2 n) {
                return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
            }
            
            vec4 aurora(vec3 ro, vec3 rd) {
                vec4 col = vec4(0.0);
                vec4 avgCol = vec4(0.0);
                
                for(float i = 0.0; i < 30.0; i++) {
                    float of = 0.006 * hash21(vUv * 100.0) * smoothstep(0.0, 15.0, i);
                    float pt = ((0.8 + pow(i, 1.4) * 0.002) - ro.y) / (rd.y * 2.0 + 0.4);
                    pt -= of;
                    vec3 bpos = ro + pt * rd;
                    vec2 p = bpos.xz;
                    float rzt = triNoise2d(p, 0.06);
                    vec4 col2 = vec4(0.0, 0.0, 0.0, rzt);
                    col2.rgb = (sin(1.0 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt;
                    avgCol = mix(avgCol, col2, 0.5);
                    col += avgCol * exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
                }
                
                // Apply vertical fade for aurora bands
                float verticalFade = smoothstep(-0.2, 0.4, rd.y);
                col *= verticalFade * 1.8;
                return col;
            }
            
            vec3 stars(in vec3 p) {
                vec3 c = vec3(0.0);
                float res = uResolution.x;
                
                for (float i = 0.0; i < 3.0; i++) {
                    vec3 q = fract(p * (0.15 * res)) - 0.5;
                    vec3 id = floor(p * (0.15 * res));
                    vec2 rn = vec2(hash21(id.xy), hash21(id.yz));
                    float c2 = 1.0 - smoothstep(0.0, 0.6, length(q));
                    c2 *= step(rn.x, 0.0005 + i * i * 0.001);
                    c += c2 * (mix(vec3(1.0, 0.49, 0.1), vec3(0.75, 0.9, 1.0), rn.y) * 0.1 + 0.9);
                    p *= 1.3;
                }
                return c * c * 0.8;
            }
            
            vec3 bg(in vec3 rd) {
                float sd = dot(normalize(vec3(-0.5, -0.6, 0.9)), rd) * 0.5 + 0.5;
                sd = pow(sd, 5.0);
                vec3 col = mix(vec3(0.0, 0.0, 0.05), vec3(0.0, 0.0, 0.1), sd);
                return col * 0.63;
            }
            
            float edgeFade(vec2 uv) {
                // Create smooth edge fadeout
                vec2 center = vec2(0.5, 0.6); // Slightly above center for aurora
                float dist = distance(uv, center);
                float radialFade = 1.0 - smoothstep(0.2, 0.8, dist);
                
                // Add vertical gradient for bottom fade
                float verticalFade = smoothstep(0.0, 0.3, uv.y);
                
                return radialFade * verticalFade;
            }

            void main() {
                vec2 q = vUv;
                vec2 p = q - 0.5;
                p.x *= uResolution.x/uResolution.y;
                
                // Apply solar wind speed to animation speed
                float windSpeedFactor = uWindSpeed / 500.0; // Normalized around base speed of 500
                float adjustedTime = uTime * uSpeed * windSpeedFactor;
                
                vec3 ro = vec3(0.0, 0.0, -6.7);
                vec3 rd = normalize(vec3(p, 1.3));
                
                vec3 col = vec3(0.0);
                float fade = smoothstep(0.0, 0.01, abs(rd.y)) * 0.1 + 0.9;
                
                col = bg(rd) * fade;
                
                // Calculate aurora intensity based on density and Bz
                float densityFactor = uDensity / 10.0; // Normalized around base density of 10
                float bzFactor = (abs(uBz) / 20.0) * 2.0; // Normalized and scaled
                float auroraIntensity = densityFactor * bzFactor * uIntensity;
                
                vec4 aur = smoothstep(0.0, 1.5, aurora(ro, rd)) * fade;
                aur *= auroraIntensity; // Apply dynamic intensity
                
                // Add stars only in the sky
                col += stars(rd) * smoothstep(-0.1, 0.1, rd.y);
                
                // Apply edge feathering
                float edgeAlpha = edgeFade(vUv);
                aur.a *= edgeAlpha;
                
                // Blend aurora with background
                col = col * (1.0 - aur.a) + aur.rgb;
                
                // Apply final intensity
                col *= uIntensity;
                
                // Output with transparency for better blending
                gl_FragColor = vec4(col, edgeAlpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    // Function to update aurora material based on simulation parameters
    auroraMaterial.updateFromParams = function(params) {
        if (!this.uniforms) return;
        
        // Update wind speed
        this.uniforms.uWindSpeed.value = params.windSpeed;
        
        // Update density
        this.uniforms.uDensity.value = params.density;
        
        // Update Bz component
        this.uniforms.uBz.value = params.bz;
        
        // Adjust colors based on energy level
        const energyLevel = Math.abs(params.bz) / 20.0; // Normalize to 0-1
        if (energyLevel < 0.3) {
            // Low energy - green/blue aurora
            this.uniforms.uColorA.value.setRGB(0.0, 1.0, 0.3);
            this.uniforms.uColorB.value.setRGB(0.2, 0.7, 1.0);
        } else if (energyLevel < 0.7) {
            // Medium energy - blue/purple aurora
            this.uniforms.uColorB.value.setRGB(0.3, 0.5, 1.0);
            this.uniforms.uColorC.value.setRGB(0.7, 0.2, 1.0);
        } else {
            // High energy - purple/red aurora
            this.uniforms.uColorC.value.setRGB(0.8, 0.2, 1.0);
            this.uniforms.uColorD.value.setRGB(1.0, 0.2, 0.4);
        }
    };

    return auroraMaterial;
}
