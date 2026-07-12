export const BOID_VERTEX_SHADER = /* glsl */ `
  attribute float aSpeed;
  attribute float aSeed;

  varying float vSpeed;
  varying float vSeed;
  varying float vFresnel;
  varying float vPulse;

  uniform float uTime;
  uniform float uMaxSpeed;

  void main() {
    vec3 transformedNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);

    vSpeed = clamp(aSpeed / max(uMaxSpeed, 0.001), 0.0, 1.4);
    vSeed = aSeed;
    vFresnel = pow(1.0 - abs(dot(transformedNormal, viewDirection)), 2.2);
    vPulse = 0.82 + 0.18 * sin(uTime * 4.0 + aSeed * 19.0);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const BOID_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying float vSpeed;
  varying float vSeed;
  varying float vFresnel;
  varying float vPulse;

  uniform float uGlow;
  uniform float uTheme;

  vec3 spectral(float t) {
    return 0.56 + 0.44 * cos(6.28318 * (vec3(0.04, 0.28, 0.56) + t));
  }

  vec3 themeColor(float speed, float seed) {
    if (uTheme < 0.5) {
      return spectral(speed * 0.52 + seed * 0.07);
    }
    if (uTheme < 1.5) {
      return mix(vec3(0.06, 0.95, 0.78), vec3(0.58, 0.18, 1.0), speed);
    }
    if (uTheme < 2.5) {
      return mix(vec3(1.0, 0.19, 0.035), vec3(1.0, 0.88, 0.3), speed);
    }
    return mix(vec3(0.44, 0.66, 0.82), vec3(0.96, 1.0, 1.0), speed);
  }

  void main() {
    vec3 color = themeColor(clamp(vSpeed, 0.0, 1.0), vSeed);
    float core = 0.72 + vSpeed * 0.55;
    float rim = vFresnel * (0.7 + uGlow * 0.7);
    color *= (core + rim) * vPulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const TRAIL_VERTEX_SHADER = /* glsl */ `
  attribute float aLife;
  attribute float aSpeed;

  varying float vLife;
  varying float vSpeed;

  void main() {
    vLife = aLife;
    vSpeed = aSpeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const TRAIL_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying float vLife;
  varying float vSpeed;

  uniform float uOpacity;
  uniform float uTheme;
  uniform float uGlow;

  vec3 spectral(float t) {
    return 0.56 + 0.44 * cos(6.28318 * (vec3(0.04, 0.28, 0.56) + t));
  }

  vec3 themeColor(float speed) {
    if (uTheme < 0.5) return spectral(speed * 0.52);
    if (uTheme < 1.5) return mix(vec3(0.02, 0.9, 0.72), vec3(0.55, 0.1, 1.0), speed);
    if (uTheme < 2.5) return mix(vec3(1.0, 0.12, 0.02), vec3(1.0, 0.72, 0.18), speed);
    return mix(vec3(0.22, 0.5, 0.72), vec3(0.9, 1.0, 1.0), speed);
  }

  void main() {
    float fade = smoothstep(0.0, 0.13, vLife) * pow(vLife, 1.65);
    vec3 color = themeColor(clamp(vSpeed, 0.0, 1.0));
    color *= 0.75 + uGlow * 0.42;
    gl_FragColor = vec4(color, fade * uOpacity);
  }
`;

export const BACKDROP_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const BACKDROP_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform float uMode;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 ray = normalize(vWorldPosition - cameraPosition);
    float horizon = pow(1.0 - abs(ray.y), 4.0);
    float cloud = noise(ray * 3.8 + vec3(uTime * 0.012, 0.0, 0.0));
    cloud *= noise(ray * 8.0 - vec3(0.0, uTime * 0.008, 0.0));

    vec3 low = vec3(0.0015, 0.003, 0.012);
    vec3 high = vec3(0.015, 0.055, 0.14);

    if (uMode > 0.5 && uMode < 1.5) {
      low = vec3(0.025, 0.001, 0.004);
      high = vec3(0.34, 0.018, 0.002);
    } else if (uMode > 1.5 && uMode < 2.5) {
      low = vec3(0.001, 0.012, 0.025);
      high = vec3(0.012, 0.18, 0.15);
    } else if (uMode > 2.5) {
      low = vec3(0.001, 0.003, 0.012);
      high = vec3(0.025, 0.015, 0.12);
    }

    vec3 color = mix(low, high, horizon * 0.55 + cloud * 0.32);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const AURORA_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying float vWave;

  uniform float uTime;
  uniform float uPhase;

  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin(p.y * 0.21 + uTime * 0.32 + uPhase) + sin(p.y * 0.47 - uTime * 0.19 + uPhase * 1.7) * 0.45;
    p.z += wave * (1.6 + 1.2 * uv.y);
    p.x += sin(p.y * 0.12 + uTime * 0.16 + uPhase) * 1.3;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const AURORA_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vWave;

  uniform float uOpacity;
  uniform float uPhase;

  void main() {
    float vertical = sin(vUv.y * 45.0 + vWave * 2.0 + uPhase) * 0.5 + 0.5;
    float curtain = pow(sin(vUv.x * 3.14159), 1.4) * smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.56, vUv.y);
    float bands = smoothstep(0.28, 0.92, vertical) * 0.44 + 0.56;
    vec3 color = mix(vec3(0.04, 0.95, 0.68), vec3(0.48, 0.1, 1.0), vUv.y + 0.18 * vWave);
    gl_FragColor = vec4(color, curtain * bands * uOpacity);
  }
`;
