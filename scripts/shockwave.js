import { THREE, scene } from './scene-core.js';

export let shockwaves = [];

/**
 * Creates a new shockwave (solar flare) effect.
 * @param {THREE.Vector3} sunPosition - The starting position of the shockwave.
 * @param {THREE.Vector3} earthPosition - The target position for the shockwave.
 * @returns {THREE.Mesh} The created shockwave mesh.
 */
export function createShockwave(sunPosition, earthPosition, params = { windSpeed: 500, density: 10 }) {
    const innerRadius = 1 * (params.density / 10);
    const outerRadius = 3 * (params.density / 10);
    
    const shockwaveGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);

    const shockwaveMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: 1.0 },
            shockwavePosition: { value: new THREE.Vector3() },
            earthPosition: { value: earthPosition },
            scale: { value: new THREE.Vector3(1, 1, 1) },
            color1: { value: new THREE.Color(0xff7700) },
            color2: { value: new THREE.Color(0xff3300) },
            // NEW: Uniforms to sync with the magnetosphere's visual shape
            uMagnetosphereParams: { value: new THREE.Vector3(0, 1.5, 1.2) }, // compression, tailLength, equatorBulge
            // NEW: Uniforms for the ripple effect
            uRippleTime: { value: 999 }, // Start high to be inactive
            uRippleActive: { value: 0.0 }
        },
        vertexShader: `
            uniform float time;
            uniform vec3 shockwavePosition;
            uniform vec3 earthPosition;
            uniform vec3 scale;
            uniform vec3 uMagnetosphereParams; // x: compression, y: tailLength, z: equatorBulge
            uniform float uRippleTime;
            uniform float uRippleActive;
            varying vec2 vUv;

            // This SDF now accurately mirrors the magnetosphere's visual shader.
            float magnetosphereSDF(vec3 pos) {
                float compression = uMagnetosphereParams.x;
                float tailLength = uMagnetosphereParams.y;
                float equatorBulge = uMagnetosphereParams.z;
                float baseRadius = 40.0;

                vec3 p = pos;
                if (p.x > 0.0) { p.x *= (1.0 - compression * 0.3); } 
                else { p.x *= (1.0 + tailLength * (1.0 - compression * 0.5)); }

                float latitude = asin(clamp(p.y / length(p), -1.0, 1.0));
                float latitudeEffect = pow(cos(latitude), 2.0) * equatorBulge;
                float radiusMultiplier = 1.0 + latitudeEffect * 0.2;
                
                return (length(p / radiusMultiplier) - baseRadius);
            }

            vec3 getMagnetosphereNormal(vec3 pos) {
                vec2 e = vec2(1.0, -1.0) * 0.01;
                return normalize(
                    e.xyy * magnetosphereSDF(pos + e.xyy) +
                    e.yyx * magnetosphereSDF(pos + e.yyx) +
                    e.yxy * magnetosphereSDF(pos + e.yxy) +
                    e.xxx * magnetosphereSDF(pos + e.xxx)
                );
            }

            void main() {
                vUv = uv;
                vec3 pos = position;
                vec3 worldPosition = shockwavePosition + position * scale.x;
                vec3 relativePos = worldPosition - earthPosition;

                float distToField = magnetosphereSDF(relativePos);
                
                // SMOOTH WRAPPING LOGIC
                // Calculate how much to wrap based on penetration depth
                float wrapAmount = smoothstep(5.0, -20.0, distToField);
                
                if (wrapAmount > 0.0) {
                    vec3 normal = getMagnetosphereNormal(relativePos);
                    // The target position on the magnetosphere's surface
                    vec3 wrappedPos = pos - normal * distToField / scale.x;
                    // Interpolate between original and wrapped position for a smooth effect
                    pos = mix(pos, wrappedPos, wrapAmount);
                }

                // RIPPLE EFFECT LOGIC
                if (uRippleActive > 0.5) {
                    float rippleSpeed = 80.0;
                    float rippleWidth = 25.0;
                    // A wave that travels outwards from the contact point
                    float wave = sin((distToField - uRippleTime * rippleSpeed) / rippleWidth);
                    // The ripple's intensity fades over time
                    float rippleIntensity = max(0.0, 1.0 - uRippleTime * 0.8) * 5.0 * uRippleActive;
                    // Apply the wave along the surface normal
                    vec3 normal = getMagnetosphereNormal(relativePos);
                    pos += normal * wave * rippleIntensity;
                }

                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float opacity;
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec2 vUv;

            void main() {
                float dist = length(vUv - 0.5);
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                float flow = sin(angle * 10.0 + time * 3.0) * 0.5 + 0.5;
                flow *= smoothstep(0.4, 0.5, dist);
                vec3 color = mix(color1, color2, dist * 1.5);
                color = mix(color, vec3(1.0, 0.9, 0.5), flow * 0.5);
                float alpha = opacity * (1.0 - dist * 1.8);
                gl_FragColor = vec4(color, max(0.0, alpha));
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.position.copy(sunPosition);

    const direction = new THREE.Vector3().subVectors(earthPosition, sunPosition).normalize();
    shockwave.userData = {
        direction: direction,
        startPosition: sunPosition.clone(),
        startTime: Date.now(),
        speed: params.windSpeed,
        density: params.density,
        isInteracting: false,
        isDetaching: false,
        rippleTime: 999
    };
    
    shockwave.lookAt(earthPosition);
    scene.add(shockwave);
    shockwaves.push(shockwave);
    return shockwave;
}

/**
 * Updates all active shockwaves in the scene.
 * @returns {object} An object containing collision status and ripple information.
 */
export function updateShockwaves(earthPosition, magnetosphereParams, time) {
    let collision = false;
    let rippleInfo = { active: false, time: 0, origin: new THREE.Vector3() };
    const BASE_SPEED = 100;
    const MAX_DISTANCE = 800;
    const MAGNETOSPHERE_RADIUS = 40.0;
    const TAIL_END_X = -120; // X-coordinate where detachment happens

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const shockwave = shockwaves[i];
        const material = shockwave.material;
        const timeDelta = time - (shockwave.userData.startTime / 1000);

        // --- UPDATE POSITION ---
        const speed = (shockwave.userData.speed / 500) * BASE_SPEED;
        const progress = timeDelta * speed;
        const newPosition = shockwave.userData.startPosition.clone().add(shockwave.userData.direction.clone().multiplyScalar(progress));
        shockwave.position.copy(newPosition);
        
        const distToEarth = newPosition.distanceTo(earthPosition);
        const earthRelativePos = newPosition.clone().sub(earthPosition);

        // --- STATE MANAGEMENT & SCALING ---
        let currentScale = shockwave.scale.x;
        if (shockwave.userData.isInteracting) {
            // If interacting, smoothly shrink to match magnetosphere size
            const targetScale = MAGNETOSPHERE_RADIUS * 1.5;
            currentScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.05);
        } else {
            // Default growth behavior
            const growthFactor = 1.0 - Math.min(distToEarth / (MAX_DISTANCE * 0.5), 1.0);
            const densityScale = shockwave.userData.density / 10;
            currentScale = (5.0 * densityScale) + (growthFactor * 35.0 * densityScale);
        }
        shockwave.scale.setScalar(currentScale);

        // --- COLLISION & RIPPLE TRIGGERS ---
        if (distToEarth < MAGNETOSPHERE_RADIUS * 1.8 && !shockwave.userData.isInteracting) {
            shockwave.userData.isInteracting = true;
            shockwave.userData.rippleTime = 0; // Trigger contact ripple
            collision = true;
        }
        
        if (earthRelativePos.x < TAIL_END_X && !shockwave.userData.isDetaching) {
            shockwave.userData.isDetaching = true;
            shockwave.userData.isInteracting = false; // Stop shrinking
            shockwave.userData.rippleTime = 0; // Trigger detachment ripple
        }

        if(shockwave.userData.isInteracting || shockwave.userData.isDetaching) {
            shockwave.userData.rippleTime += 1/60; // Approximate delta time
            if (shockwave.userData.rippleTime < 1.5) {
                rippleInfo.active = true;
                rippleInfo.time = shockwave.userData.rippleTime;
                // Set ripple origin based on whether we are contacting or detaching
                rippleInfo.origin = shockwave.userData.isDetaching 
                    ? new THREE.Vector3(TAIL_END_X, 0, 0)
                    : new THREE.Vector3(MAGNETOSPHERE_RADIUS, 0, 0);
            } else {
                // After ripple effect is done, reset state
                if(shockwave.userData.isDetaching) shockwave.userData.isDetaching = false;
            }
        }
        
        // --- FADE OUT & REMOVAL ---
        const passedTail = earthRelativePos.x < TAIL_END_X - 100;
        let opacity = 1.0;
        if (passedTail) {
            const fadeProgress = (Math.abs(earthRelativePos.x) - (Math.abs(TAIL_END_X) + 100)) / 100;
            opacity = Math.max(0, 1.0 - fadeProgress);
        }
        material.uniforms.opacity.value = opacity;

        if (opacity <= 0.01) {
            scene.remove(shockwave);
            shockwaves.splice(i, 1);
            continue;
        }

        // --- UPDATE SHADER UNIFORMS ---
        material.uniforms.time.value = time;
        material.uniforms.shockwavePosition.value.copy(newPosition);
        material.uniforms.scale.value.copy(shockwave.scale);
        material.uniforms.uMagnetosphereParams.value.set(
            magnetosphereParams.compression,
            magnetosphereParams.tailLength,
            magnetosphereParams.equatorBulge
        );
        material.uniforms.uRippleTime.value = shockwave.userData.rippleTime;
        material.uniforms.uRippleActive.value = (rippleInfo.active && (shockwave.userData.isInteracting || shockwave.userData.isDetaching)) ? 1.0 : 0.0;
    }

    return { collision, rippleInfo };
}