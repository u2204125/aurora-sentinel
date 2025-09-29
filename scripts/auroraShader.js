import { THREE } from './scene-core.js';

/**
 * Creates an aurora shader material with selectable quality levels.
 * Now includes a random offset for independent curtain animation.
 */
export function createAuroraMaterial(quality = 'low') {

    const uniforms = {
        uTime: { value: 0.0 },
        uIntensity: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uColorA: { value: new THREE.Color(0.1, 1.0, 0.2) },
        uColorB: { value: new THREE.Color(0.2, 0.7, 1.0) },
        uColorC: { value: new THREE.Color(0.7, 0.2, 1.0) },
        uColorD: { value: new THREE.Color(1.0, 0.25, 0.4) }
    };

    let vertexShader, fragmentShader;

    if (quality === 'low') {
        // --- LOW QUALITY MODE: SCROLLING NOISE SHADER ---
        vertexShader = `
            attribute float aRandomOffset; // New attribute for random seed
            varying float vRandomOffset;   // Pass seed to fragment shader
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vRandomOffset = aRandomOffset;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        fragmentShader = `
            precision mediump float;
            uniform float uTime;
            uniform float uIntensity;
            uniform vec3 uColorA, uColorB, uColorC, uColorD;
            varying vec2 vUv;
            varying float vRandomOffset; // Receive random seed

            float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }

            float fbm(vec2 st) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 4; i++) {
                    value += amplitude * random(st);
                    st *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                // Each curtain gets its own animation time
                float animationTime = uTime + vRandomOffset;

                vec2 p = vUv;
                vec2 q = vec2(fbm(p + 0.05 * animationTime), fbm(p + 0.02 * animationTime));
                vec2 r = vec2(fbm(p + q + 0.01 * animationTime), fbm(p + q + 0.03 * animationTime));
                float noise = fbm(p + r);
                float bottomEdge = smoothstep(0.0, 0.2, vUv.y);
                noise *= bottomEdge;
                vec3 auroraCol;
                auroraCol = mix(uColorA, uColorB, smoothstep(0.0, 0.4, vUv.y)); 
                auroraCol = mix(auroraCol, uColorC, smoothstep(0.3, 0.7, vUv.y));
                auroraCol = mix(auroraCol, uColorD, smoothstep(0.6, 0.9, vUv.y));
                gl_FragColor = vec4(auroraCol * uIntensity, noise * 0.8);
            }
        `;

    } else {
        // --- HIGH QUALITY MODE: VOLUMETRIC RAYMARCHING SHADER ---
        vertexShader = `
            attribute float aRandomOffset; // New attribute for random seed
            varying float vRandomOffset;   // Pass seed to fragment shader
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                vRandomOffset = aRandomOffset;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        fragmentShader = `
            precision highp float;
            uniform float uTime;
            uniform float uIntensity;
            uniform vec2 uResolution;
            uniform vec3 uColorA, uColorB, uColorC, uColorD;
            
            varying vec2 vUv;
            varying vec3 vPosition;
            varying float vRandomOffset; // Receive random seed
            
            mat2 mm2(in float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
            mat2 m2=mat2(0.95534,0.29552,-0.29552,0.95534);
            float tri(in float x){return clamp(abs(fract(x)-.5),.01,.49);}
            vec2 tri2(in vec2 p){return vec2(tri(p.x)+tri(p.y),tri(p.y+tri(p.x)));}
            float hash21(in vec2 n){return fract(sin(dot(n,vec2(12.9898,4.1414)))*43758.5453);}

            float triNoise2d(in vec2 p, float timeOffset){
                float z=1.8; float z2=2.5; float rz=0.;
                p *= mm2(p.x*.06); vec2 bp=p;
                for(float i=0.;i<5.;i++){
                    vec2 p_mod=p; p_mod.x+=.15*sin(vPosition.y*.4 + timeOffset *1.5);
                    vec2 dg=tri2(bp*1.85)*.75; dg*=mm2(timeOffset*0.3); p-=dg/z2;
                    bp*=1.3; z2*=.45; z*=.42; p*=1.21+(rz-1.)*.02;
                    rz+=tri(p_mod.x+tri(p_mod.y))*z; p*=-m2;
                }
                return clamp(1./pow(rz*29.,1.3),0.,.55);
            }
            
            vec4 aurora(vec3 ro, vec3 rd, float timeOffset){
                vec4 col=vec4(0.); vec4 avgCol=vec4(0.);
                for(float i=0.;i<40.;i++){
                    float of=.006*hash21(vUv*i)*smoothstep(0.,20.,i);
                    float pt=((vPosition.y*.1+pow(i,1.4)*.002)-ro.y)/(rd.y*2.+.4); pt-=of;
                    vec3 bpos=ro+pt*rd; vec2 p=bpos.xz;
                    float rzt=triNoise2d(p + timeOffset*.02, timeOffset);
                    float altitude=vUv.y; vec3 auroraCol;
                    auroraCol=mix(uColorA,uColorB,smoothstep(0.,.4,altitude));
                    auroraCol=mix(auroraCol,uColorC,smoothstep(.3,.7,altitude));
                    auroraCol=mix(auroraCol,uColorD,smoothstep(.6,.9,altitude));
                    vec4 col2=vec4(auroraCol*rzt,rzt);
                    col2.rgb*=.6+.4*sin(timeOffset*.5+bpos.x*2.+vPosition.y*.5);
                    avgCol=mix(avgCol,col2,.5);
                    col+=avgCol*exp2(-i*.065-2.5)*smoothstep(0.,6.,i);
                }
                float verticalFade=smoothstep(-.2,.5,rd.y); col*=verticalFade*1.8; return col;
            }

            void main(){
                float animationTime = uTime + vRandomOffset;
                vec2 q=vUv; vec2 p=q-.5; p.x*=uResolution.x/uResolution.y;
                vec3 ro=vec3(0.,0.,-6.7); vec3 rd=normalize(vec3(p,1.3));
                float fade=smoothstep(0.,.01,abs(rd.y))*.1+.9;
                vec4 aur=smoothstep(0.,1.5,aurora(ro,rd,animationTime))*fade;
                vec3 col=vec3(.0,.0,.05);
                col=col*(1.-aur.a)+aur.rgb;
                col*=uIntensity;
                gl_FragColor=vec4(col,aur.a);
            }
        `;
    }

    const auroraMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    auroraMaterial.updateFromParams = function(params) {
        if (!this.uniforms) return;
        const energyLevel = Math.min(Math.abs(params.bz) / 20.0, 1.0);
        const [c1, c2, c3, c4] = [this.uniforms.uColorA, this.uniforms.uColorB, this.uniforms.uColorC, this.uniforms.uColorD];
        if (energyLevel < 0.3) { c1.value.setRGB(0.1, 1.0, 0.2); c2.value.setRGB(0.2, 0.7, 1.0); c3.value.setRGB(0.1, 0.4, 0.8); c4.value.setRGB(0.3, 0.2, 0.6); }
        else if (energyLevel < 0.7) { c1.value.setRGB(0.2, 1.0, 0.3); c2.value.setRGB(0.3, 0.5, 1.0); c3.value.setRGB(0.8, 0.2, 1.0); c4.value.setRGB(1.0, 0.2, 0.5); }
        else { c1.value.setRGB(0.5, 1.0, 0.5); c2.value.setRGB(0.5, 0.4, 1.0); c3.value.setRGB(1.0, 0.2, 0.8); c4.value.setRGB(1.0, 0.1, 0.3); }
    };

    return auroraMaterial;
}