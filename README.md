# Aurora Sentinel 🌌

An interactive, real-time 3D visualization of solar storms, magnetospheric dynamics, and auroral phenomena. Experience the beauty and power of space weather through scientifically-grounded simulations.

![Aurora Sentinel](https://img.shields.io/badge/Status-Active-success)
![Three.js](https://img.shields.io/badge/Three.js-0.160.0-blue)
![WebGL](https://img.shields.io/badge/WebGL-2.0-orange)

## 🎯 Overview

Aurora Sentinel is a cutting-edge web-based simulator that brings the invisible forces of space weather to life. Watch coronal mass ejections (CMEs) travel from the Sun to Earth, interact with our planet's magnetosphere, and trigger spectacular auroral displays at both poles.

### Key Features

- **🌟 Real-Time Solar Wind Simulation**: Observe CME shockwaves propagating through space with physically-based rendering
- **🌍 Dynamic Magnetosphere**: Watch Earth's magnetic shield compress and deform under solar wind pressure using the Shue model
- **🎨 Stunning Visual Effects**: 
  - Prominence-style solar flare loops with procedural FBM turbulence
  - Magnetosphere collision dynamics with impact-driven glows
  - Realistic aurora curtains at both magnetic poles
- **🎛️ Interactive Controls**: Fine-tune solar wind parameters (speed, density, IMF Bz) in real-time
- **📡 NASA DONKI Integration**: Optionally fetch real CME data from NASA's Space Weather Database
- **🌐 Multiple Views**:
  - Space View: See the Sun-Earth system from orbit
  - Ground View: Experience auroras from the North or South Pole

## 🚀 Quick Start

### Prerequisites

- Modern web browser with WebGL 2.0 support (Chrome, Firefox, Edge, Safari)
- Local web server (for CORS compliance)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/u2204125/aurora-sentinel.git
   cd aurora-sentinel
   ```

2. **Start a local server**
   
   Using Python:
   ```bash
   python -m http.server 8000
   ```
   
   Using Node.js:
   ```bash
   npx http-server -p 8000
   ```
   
   Using VS Code Live Server:
   - Install the "Live Server" extension
   - Right-click `index.html` and select "Open with Live Server"

3. **Open in browser**
   ```
   http://localhost:8000
   ```

## 🎮 Usage

### Space View Controls

- **Left Mouse**: Rotate view (orbit controls)
- **Right Mouse**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Click Sun**: Manually trigger a solar flare

### Control Panel

Access the control panel on the right side of the screen:

#### Solar Wind Parameters
- **Speed** (300-1200 km/s): Affects CME travel time and impact strength
- **Density** (1-50 p/cm³): Controls plasma density and magnetosphere compression
- **IMF Bz** (-20 to +5 nT): Southward (negative) values intensify auroras

#### Emission Settings
- **Interval** (0-20 seconds): Set automatic flare emission rate (0 = manual only)

#### Data Mode
- **Real-time Toggle**: Fetch live CME data from NASA DONKI API

### View Switching

- **Space View**: Default orbital perspective
- **Ground View** → **North Pole**: Experience northern auroras
- **Ground View** → **South Pole**: Experience southern auroras

## 🏗️ Architecture

### Technology Stack

- **Three.js** (0.160.0): 3D rendering engine
- **WebGL 2.0**: GPU-accelerated graphics
- **Custom GLSL Shaders**: High-performance visual effects
- **Vanilla JavaScript**: Modular ES6+ architecture

### Project Structure

```
aurora-sentinel/
├── index.html                 # Main entry point
├── scripts/
│   ├── main.js               # Application orchestrator
│   ├── scene-core.js         # Three.js scene setup
│   ├── shockwave.js          # CME propagation & collision
│   ├── magnetosphere.js      # Magnetosphere dynamics (Shue model)
│   ├── sun.js                # Solar sphere with corona
│   ├── earth.js              # Earth sphere with texture
│   ├── stars.js              # Background starfield
│   ├── auroraShader.js       # Aurora curtain shaders
│   ├── northPole.js          # North pole terrain & aurora
│   ├── southPole.js          # South pole terrain & aurora
│   ├── groundview.js         # Ground view camera system
│   ├── control-panel.js      # UI controls
│   └── donki-api.js          # NASA DONKI API client
├── styles/
│   ├── main.css              # Global styles
│   └── control-panel.css     # Control panel styles
├── assets/
│   └── earth_atmos_2048.jpg  # Earth texture map
└── README.md
```

### Core Modules

#### Shockwave System (`shockwave.js`)
- Ring geometry with procedural loop distortions using FBM noise
- Three-phase propagation: **inbound** → **skimming** → **tail**
- Quaternion-based rotation for magnetopause surface contact
- Dynamic opacity fade along magnetotail

#### Magnetosphere Model (`magnetosphere.js`)
- Shue et al. (1997) magnetopause model implementation
- Dynamic compression based on solar wind pressure
- Impact-driven glow rendering with directional lighting
- Ripple effects during CME collision

#### Aurora Rendering (`auroraShader.js`, `northPole.js`, `southPole.js`)
- Vertex-animated curtain geometry
- Fragment shader with turbulent noise
- Bz-dependent intensity and color modulation
- Dual-pole terrain with atmospheric lighting

## 🔬 Scientific Background

### Magnetosphere Physics

The simulator uses the **Shue model** to calculate magnetopause standoff distance:

```
r₀ = (10.22 + 1.29 tanh(0.184(Bz + 8.14))) × Pd^(-1/6.6)
```

Where:
- `r₀` = standoff distance (Earth radii)
- `Bz` = interplanetary magnetic field z-component (nT)
- `Pd` = dynamic pressure (nPa)

### CME Propagation

Coronal mass ejections are modeled as expanding cone-shaped plasma clouds:
- Travel speed: 300-1200 km/s
- Half-angle: ~35° (typical)
- Density: 1-50 protons/cm³

### Aurora Formation

Auroras occur when solar wind particles are funneled along magnetic field lines into the polar regions:
- **Southward Bz** (negative): Enhanced particle entry → brighter auroras
- **Northward Bz** (positive): Reduced auroral activity
- **Dynamic response**: Real-time intensity modulation

## 🎨 Visual Effects

### Shader Techniques

- **Fractal Brownian Motion (FBM)**: Procedural turbulence for flare loops
- **Fresnel rim lighting**: Magnetosphere edge glow
- **Impact-driven illumination**: Directional glow at CME contact points
- **Smooth interpolation**: Lerp-based parameter transitions for visual continuity

### Performance Optimizations

- Shared ring geometry for all shockwaves
- GPU-driven vertex animations
- Level-of-detail (LOD) considerations for mobile devices
- Efficient uniform updates (minimal CPU→GPU transfers)

## 📡 API Integration

### NASA DONKI

When Real-time mode is enabled, the app fetches CME data from:
```
https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CMEAnalysis
```

Retrieved parameters:
- CME speed and direction
- Half-angle (angular width)
- Estimated plasma density
- Estimated IMF Bz

**Note**: DONKI API may have rate limits. Data is cached for 5 minutes.

## 🛠️ Development

### Adding New Features

1. **New celestial objects**: Add to `scripts/` and import in `main.js`
2. **Custom shaders**: Modify vertex/fragment shaders in respective modules
3. **UI controls**: Extend `control-panel.js` and `styles/control-panel.css`

### Shader Development

Shaders are inline within JavaScript modules for easy hot-reloading:

```javascript
vertexShader: `
  precision highp float;
  uniform float uTime;
  // ... vertex transformations
`,
fragmentShader: `
  precision highp float;
  uniform vec3 uColor;
  // ... fragment shading
`
```

### Debugging

Enable verbose logging:
```javascript
// In main.js
console.log('Shockwave status:', shockStatus);
console.log('Magnetosphere params:', magnetoParams);
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- ES6+ modules
- Camel case for variables and functions
- Descriptive naming (avoid single letters except in math contexts)
- Comment complex shader code

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NASA DONKI**: Space weather data
- **Three.js Community**: 3D rendering framework
- **Shue et al. (1997)**: Magnetopause model
- **Space Weather Prediction Center (SWPC)**: Scientific validation data

## 📞 Contact

**Project Repository**: [https://github.com/u2204125/aurora-sentinel](https://github.com/u2204125/aurora-sentinel)

**Issues & Feedback**: [GitHub Issues](https://github.com/u2204125/aurora-sentinel/issues)

---

<div align="center">
  <strong>Experience the invisible forces that shape our world.</strong>
  <br/>
  Made with ❤️ and ⚡ by space weather enthusiasts
</div>
