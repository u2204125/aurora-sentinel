import { THREE, scene } from './scene-core.js';

// This array will hold all active shockwave objects in the scene.
export let shockwaves = [];

/**
 * Creates a new shockwave (solar flare) effect.
 * @param {THREE.Vector3} sunPosition - The starting position of the shockwave.
 * @param {THREE.Vector3} earthPosition - The target position for the shockwave.
 * @returns {THREE.Mesh} The created shockwave mesh.
 */
export function createShockwave(sunPosition, earthPosition, params = { windSpeed: 500, density: 10 }) {
    // Calculate ring size based on density (higher density = larger ring)
    const innerRadius = 1 * (params.density / 10);
    const outerRadius = 3 * (params.density / 10);
    
    // A RingGeometry is used for the main shockwave front.
    const shockwaveGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64); // Increased segments for smoother deformation

    // The ShaderMaterial allows for custom vertex and fragment shaders, giving us full control over the animation.
    const shockwaveMaterial = new THREE.ShaderMaterial({
        uniforms: {
            // Uniforms are variables passed from our JavaScript to the GPU shaders.
            time: { value: 0 },
            progress: { value: 0 },
            opacity: { value: 1.0 },
            // The world position of the shockwave's center. This is crucial for calculating the interaction in the shader.
            shockwavePosition: { value: new THREE.Vector3() },
            // The position of the Earth, which is the center of the magnetosphere.
            earthPosition: { value: earthPosition },
            // The current scale of the shockwave mesh.
            scale: { value: new THREE.Vector3(1, 1, 1) },
            color1: { value: new THREE.Color(0xff7700) }, // Orange core
            color2: { value: new THREE.Color(0xff3300) }  // Red outer
        },
        vertexShader: `
            varying vec2 vUv;
            uniform float time;
            uniform float progress;
            uniform vec3 shockwavePosition;
            uniform vec3 earthPosition;
            uniform vec3 scale;

            // A Signed Distance Function (SDF) for the magnetosphere.
            // This function returns the approximate distance from a given point to the surface of the magnetosphere.
            // A negative value means the point is inside the shape.
            // This shape is a stretched ellipsoid (teardrop) to simulate the solar wind's effect.
            float magnetosphereSDF(vec3 pos) {
                // Elongate the shape along the x-axis to create the tail.
                pos.x *= 0.5;
                // Calculate the distance from the elongated point to the origin.
                float dist = length(pos);
                // Define the radius of the magnetosphere.
                float radius = 80.0;
                // The SDF result is the distance to the surface.
                return dist - radius;
            }

            // [FIX] Use an analytical normal for the ellipsoid defined by the SDF.
            // This is much more stable than the previous numerical approximation (getMagnetosphereNormal).
            // An incorrect normal calculation was causing parts of the ring to bend inwards.
            vec3 getAnalyticalNormal(vec3 pos) {
                // The SDF is based on length(vec3(pos.x * 0.5, pos.y, pos.z)).
                // The gradient of this function gives the normal direction.
                return normalize(vec3(pos.x * 0.25, pos.y, pos.z));
            }

            void main() {
                vUv = uv;
                vec3 pos = position;

                // Calculate the vertex's position in world space.
                vec3 worldPosition = shockwavePosition + pos * scale.x; // Assume uniform scaling

                // Calculate the vertex's position relative to the Earth.
                vec3 relativePos = worldPosition - earthPosition;

                // Get the distance from the vertex to the magnetosphere surface.
                float distToField = magnetosphereSDF(relativePos);

                // INTERACTION LOGIC: If the vertex is inside the magnetosphere's boundary...
                if (distToField < 0.0) {
                    // Get the surface normal at this position using the stable analytical function.
                    vec3 normal = getAnalyticalNormal(relativePos);
                    // Project the vertex onto the surface of the magnetosphere by pushing it back out along the normal.
                    // The amount it's pushed is the distance it has penetrated.
                    pos -= normal * distToField / scale.x;

                    // Add a flowing, wavy motion along the surface for a more dynamic effect.
                    float angle = atan(pos.y, pos.z);
                    float wave = sin(angle * 8.0 + time * 5.0) * 0.2;
                    pos += normal * wave;
                }

                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float progress;
            uniform float opacity;
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec2 vUv;

            void main() {
                // Calculate distance from the center of the ring.
                float dist = length(vUv - 0.5);

                // Create a flowing, energy-like pattern in the fragment color.
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                float flow = sin(angle * 10.0 + time * 3.0) * 0.5 + 0.5;
                flow *= smoothstep(0.4, 0.5, dist);

                // Mix colors based on distance from the center.
                vec3 color = mix(color1, color2, dist * 1.5);
                // Add the flow pattern as bright highlights.
                color = mix(color, vec3(1.0, 0.9, 0.5), flow * 0.5);

                // Calculate alpha (transparency). It fades at the edges and as the shockwave progresses.
                float alpha = opacity * (1.0 - dist * 1.8) * (1.0 - progress * 0.7);
                alpha = max(0.0, alpha); // Ensure alpha doesn't go below zero.

                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    // Create the main shockwave mesh.
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.position.copy(sunPosition);

    // Store necessary data for animation within the mesh's userData property.
    const direction = new THREE.Vector3().subVectors(earthPosition, sunPosition).normalize();
    shockwave.userData.direction = direction;
    shockwave.userData.startPosition = sunPosition.clone();
    shockwave.userData.startTime = Date.now();
    shockwave.userData.speed = params.windSpeed; // Store wind speed for animation
    shockwave.userData.density = params.density; // Store density for scaling

    // Orient the shockwave to face the Earth.
    shockwave.lookAt(earthPosition);

    // --- PARTICLE SYSTEM ---
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleOffsets = new Float32Array(particleCount); // Random offsets for varied movement

    for(let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Particles are spawned in a disc shape.
        const radius = Math.random() * 2.5;
        const angle = Math.random() * Math.PI * 2.0;
        // [FIX] Give particles some depth along the local X-axis to create a cloud instead of a flat disc.
        particlePositions[i3] = (Math.random() - 0.5) * 3.0;
        particlePositions[i3 + 1] = Math.sin(angle) * radius;
        particlePositions[i3 + 2] = Math.cos(angle) * radius;
        particleSizes[i] = Math.random() * 2.0 + 1.0;
        particleOffsets[i] = Math.random(); // Store a random value for each particle
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('offset', new THREE.BufferAttribute(particleOffsets, 1));

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: 1.0 },
            shockwavePosition: { value: new THREE.Vector3() },
            earthPosition: { value: earthPosition },
            scale: { value: new THREE.Vector3(1, 1, 1) }
        },
        vertexShader: `
            attribute float size;
            attribute float offset;
            uniform float time;
            uniform vec3 shockwavePosition;
            uniform vec3 earthPosition;
            uniform vec3 scale;
            varying float vOpacity;

            // Use the same SDF and Normal functions as the main shockwave shader.
            float magnetosphereSDF(vec3 pos) {
                pos.x *= 0.5;
                return length(pos) - 80.0;
            }

            vec3 getAnalyticalNormal(vec3 pos) {
                return normalize(vec3(pos.x * 0.25, pos.y, pos.z));
            }

            void main() {
                // The particle's base position is inherited from the buffer attribute.
                vec3 pos = position;

                // [FIX] Add some turbulent motion to make particles scatter as they travel.
                // This creates a more dynamic, gaseous effect.
                float scatterTime = time * (2.0 + offset);
                pos.x += sin(scatterTime * 2.1) * (0.2 + offset * 0.2);
                pos.y += cos(scatterTime * 1.7) * (0.2 + offset * 0.2);
                pos.z += sin(scatterTime * 1.3) * (0.2 + offset * 0.2);

                // Calculate the particle's world position.
                vec3 worldPosition = shockwavePosition + pos * scale.x;
                vec3 relativePos = worldPosition - earthPosition;

                // Get distance to the magnetosphere.
                float distToField = magnetosphereSDF(relativePos);

                // PARTICLE INTERACTION LOGIC:
                if (distToField < 5.0) { // Start interacting just before the surface
                    // Get the surface normal.
                    vec3 normal = getAnalyticalNormal(relativePos);
                    // Project the particle onto the surface.
                    float penetration = min(0.0, distToField);
                    pos -= normal * penetration / scale.x;

                    // Add a swirling, flowing motion along the surface.
                    // The 'offset' attribute ensures each particle moves slightly differently.
                    float swirlTime = time * (1.0 + offset * 0.5);
                    vec3 tangent = vec3(0.0, -normal.z, normal.y); // A vector perpendicular to the normal
                    pos += tangent * sin(swirlTime) * 0.5;
                }

                // Fade out particles based on their distance from the shockwave center.
                vOpacity = 1.0 - (length(position) / 3.0);
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = size * (300.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            varying float vOpacity;
            uniform float opacity;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard; // Make particles circular
                float alpha = (0.5 - dist) * 2.0 * vOpacity * opacity;
                gl_FragColor = vec4(1.0, 0.6, 0.2, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    shockwave.add(particles);
    shockwave.userData.particles = particles;

    scene.add(shockwave);
    shockwaves.push(shockwave);
    return shockwave;
}

/**
 * Updates all active shockwaves in the scene.
 * @param {THREE.Vector3} earthPosition - The current position of the Earth.
 * @returns {boolean} True if a collision with the magnetosphere occurred this frame.
 */
export function updateShockwaves(earthPosition, params = { windSpeed: 500, density: 10 }) {
    const currentTime = Date.now();
    let collision = false;
    const BASE_SPEED = 100;
    const MAX_DISTANCE = 800;
    const MAGNETOSPHERE_RADIUS = 80.0;
    const TAIL_LENGTH = 300;

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const shockwave = shockwaves[i];
        const timeDelta = (currentTime - shockwave.userData.startTime) / 1000;

        // 1. UPDATE POSITION
        // Use stored wind speed to calculate actual speed
        const speed = (shockwave.userData.speed / 500) * BASE_SPEED;
        const progress = timeDelta * speed;
        const newPosition = shockwave.userData.startPosition.clone()
            .add(shockwave.userData.direction.clone().multiplyScalar(progress));
        shockwave.position.copy(newPosition);

        // 2. UPDATE SCALE
        // The shockwave grows as it approaches the Earth, then shrinks as it passes.
        // Scale is affected by both distance and plasma density
        const distToEarth = newPosition.distanceTo(earthPosition);
        const growthFactor = 1.0 - Math.min(distToEarth / (MAX_DISTANCE * 0.5), 1.0);
        const densityScale = shockwave.userData.density / 10; // Normalize density effect
        const baseScale = 5.0 * densityScale;
        const maxGrowth = 35.0 * densityScale;
        const scale = baseScale + growthFactor * maxGrowth;
        shockwave.scale.setScalar(scale);

        // 3. UPDATE SHADER UNIFORMS
        // Pass the current time, world position, and scale to the shaders for animation and interaction calculations.
        shockwave.material.uniforms.time.value = timeDelta;
        shockwave.material.uniforms.progress.value = progress / MAX_DISTANCE;
        shockwave.material.uniforms.shockwavePosition.value.copy(newPosition);
        shockwave.material.uniforms.scale.value.copy(shockwave.scale);

        // 4. UPDATE OPACITY (FADE OUT LOGIC)
        const earthRelativePos = newPosition.clone().sub(earthPosition);
        const passedMagnetosphere = earthRelativePos.x < -TAIL_LENGTH;
        let opacity = 1.0;
        if (passedMagnetosphere) {
            const fadeProgress = (Math.abs(earthRelativePos.x) - TAIL_LENGTH) / (TAIL_LENGTH * 0.5);
            opacity = Math.max(0, 1.0 - fadeProgress);
        }
        shockwave.material.uniforms.opacity.value = opacity;

        // 5. UPDATE PARTICLES
        if (shockwave.userData.particles) {
            const particleUniforms = shockwave.userData.particles.material.uniforms;
            particleUniforms.time.value = timeDelta;
            particleUniforms.opacity.value = opacity;
            particleUniforms.shockwavePosition.value.copy(newPosition);
            particleUniforms.scale.value.copy(shockwave.scale);
        }

        // 6. COLLISION DETECTION
        if (distToEarth < MAGNETOSPHERE_RADIUS && !shockwave.userData.hasCollided) {
            collision = true;
            shockwave.userData.hasCollided = true;
        }

        // 7. REMOVE WHEN FINISHED
        if (opacity <= 0.01) {
            scene.remove(shockwave);
            shockwaves.splice(i, 1);
        }
    }

    return collision;
}
