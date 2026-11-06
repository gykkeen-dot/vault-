// FilmCam shader: one pass for every effect. Shared by the app (ES module)
// and the Artifact preview (tools/build_preview.py inlines this file).

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

export const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform vec2 uTexel;      // 1/video size
uniform vec2 uRes;        // canvas size
uniform vec2 uGrainOff;   // grain offset per frame
uniform vec2 uCrop;       // fraction of the source frame (aspect + zoom)
uniform float uMirror;    // 1 = mirror (front camera)
uniform float uTime;      // seconds
uniform float uEffect;    // effect number, 0 = none
uniform float uIntensity, uContrast, uBrightness, uSaturation, uTemperature, uTint;
uniform float uHighlights, uShadows, uSharpness, uBlur, uGrain, uGrainSize, uVignette, uFade;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 satur(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
float nz(float s){ return texture(uNoise, vUv * uRes / 256.0 * s + uGrainOff).r; }
float rad(){ return length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)); }

vec3 heat(float t){
  vec3 r = mix(vec3(0.0, 0.0, 0.08), vec3(0.32, 0.0, 0.55), smoothstep(0.0, 0.25, t));
  r = mix(r, vec3(0.92, 0.18, 0.10), smoothstep(0.25, 0.5, t));
  r = mix(r, vec3(1.0, 0.82, 0.0), smoothstep(0.5, 0.78, t));
  return mix(r, vec3(1.0), smoothstep(0.78, 1.0, t));
}

// ---- Effects ----
vec3 fxApply(int fx, vec3 c, vec2 cell){
  float l = luma(c);
  if (fx == 1) { // Bleach Bypass
    float k = clamp((l - 0.45) * 10.0, 0.0, 1.0);
    vec3 ov = mix(2.0 * c * l, 1.0 - 2.0 * (1.0 - c) * (1.0 - l), k);
    return (mix(vec3(l), c, 0.45) * 0.3 + ov * 0.7) * 1.05;
  }
  if (fx == 2) { // Doll House: soft, pink, airy
    c = c * 1.12 + 0.05;
    c = satur(c, 1.15) * vec3(1.08, 0.95, 1.04);
    c = (c - 0.5) * 0.82 + 0.5;
    c = mix(c, vec3(1.0, 0.84, 0.92), 0.10);
    return c + max(c - 0.7, 0.0) * 0.35;
  }
  if (fx == 3) { // Jet Black: deep contrasty mono
    float m = smoothstep(0.16, 0.86, l);
    return vec3(pow(m, 1.15)) * vec3(1.0, 1.0, 1.02);
  }
  if (fx == 4) { // Teal & Orange
    vec3 tint = mix(vec3(0.62, 1.0, 1.12), vec3(1.2, 1.0, 0.78), smoothstep(0.2, 0.8, l));
    c = c * tint;
    return (c - 0.5) * 1.15 + 0.5;
  }
  if (fx == 5) { // Solarize
    vec3 s = mix(c, 1.0 - c, smoothstep(0.45, 0.55, c));
    return s * 1.8;
  }
  if (fx == 6) { // Candy
    c = satur(c, 1.55) * vec3(1.05, 0.95, 1.1) + 0.06;
    return pow(max(c, 0.0), vec3(0.85));
  }
  if (fx == 7) { // CCD: early digicam, bright, cool shadows, bloom-y highlights
    c = c * 1.25;
    c = (c - 0.5) * 1.15 + 0.5;
    c = satur(c, 1.3);
    c += vec3(-0.02, 0.0, 0.06) * (1.0 - l);
    return mix(c, vec3(1.0), smoothstep(0.85, 1.0, l) * 0.3);
  }
  if (fx == 8) { // CCD Flash: harsh direct flash
    float f = 1.0 - smoothstep(0.12, 0.95, rad());
    c = c * (0.3 + 1.15 * f);
    c = (c - 0.5) * 1.25 + 0.5;
    c = satur(c, 1.2);
    c += smoothstep(0.6, 1.0, l) * 0.15;
    c.b *= 1.04;
    return c;
  }
  if (fx == 9) { // Nokia: 4-tone green LCD with a pixel grid
    float q = floor(l * 3.999) / 3.0;
    vec3 col = mix(vec3(0.26, 0.32, 0.24), vec3(0.78, 0.94, 0.85), q);
    float grid = step(0.10, cell.x) * step(0.10, cell.y);
    return col * mix(0.82, 1.0, grid);
  }
  if (fx == 10) { // Motorola: low-res, washed, cold
    c = satur(c, 0.85) * vec3(0.97, 1.0, 1.06);
    c = (c - 0.5) * 0.9 + 0.5 + 0.03;
    return c + (nz(1.0) - 0.5) * 0.05;
  }
  if (fx == 11) { // 3GS: warm, soft, lifted blacks
    c = c * vec3(1.08, 1.03, 0.88);
    c = satur(c, 0.85);
    c = (c - 0.5) * 0.9 + 0.5 + 0.04;
    return c * (1.0 - 0.25 * smoothstep(0.4, 0.9, rad()));
  }
  if (fx == 12) { // Webcam: low-res, green-cyan, noisy
    c = c * vec3(0.92, 1.05, 1.0);
    c = satur(c, 0.75);
    c = (c - 0.5) * 0.85 + 0.5 + 0.04;
    return c + (nz(1.0) - 0.5) * 0.12;
  }
  if (fx == 13) { // Polaroid: faded, warm highlights, greenish shadows
    c = c * 0.88 + 0.10;
    c = mix(c * vec3(0.95, 1.0, 1.0), c * vec3(1.06, 1.0, 0.88), smoothstep(0.2, 0.8, l));
    c = satur(c, 0.85);
    return c * (1.0 - 0.2 * smoothstep(0.4, 0.9, rad()));
  }
  if (fx == 14) { // Disposable: warm cast, flash falloff, punchy
    c = c * vec3(1.1, 1.05, 0.85);
    c = (c - 0.5) * 1.2 + 0.5;
    c = satur(c, 1.15);
    c.g += 0.03 * (1.0 - l);
    float f = 1.0 - 0.55 * smoothstep(0.25, 0.85, rad());
    return c * f;
  }
  if (fx == 15) { // VHS: scanlines, noise bands, washed color
    c = satur(c, 0.8);
    c += vec3(0.04, 0.0, 0.05) * (1.0 - l);
    float sl = 0.88 + 0.12 * sin(vUv.y * uRes.y * 3.14159);
    float band = texture(uNoise, vec2(0.37, floor(vUv.y * 240.0) / 240.0 + uTime)).r;
    c += (band - 0.5) * 0.08;
    c = c * sl + 0.03;
    return c + smoothstep(0.7, 1.0, l) * 0.08;
  }
  if (fx == 16) { // Surveillance: green-grey, scanlines, harsh
    float m = (l - 0.5) * 1.3 + 0.5;
    float sl = 0.85 + 0.15 * sin(vUv.y * uRes.y * 3.14159);
    return vec3(0.75, 1.0, 0.8) * m * sl + (nz(1.0) - 0.5) * 0.1;
  }
  if (fx == 17) { // Thermal
    return heat(clamp((l - 0.08) * 1.15, 0.0, 1.0));
  }
  if (fx == 18) { // Night vision
    float m = pow(clamp(l * 1.8, 0.0, 1.0), 0.8);
    vec3 g = vec3(0.1, 1.0, 0.2) * m + (nz(1.0) - 0.5) * 0.2;
    float sl = 0.93 + 0.07 * sin(vUv.y * uRes.y * 3.14159);
    return g * sl * (1.0 - smoothstep(0.5, 0.85, rad()));
  }
  return c;
}

void main(){
  int fx = int(uEffect + 0.5);
  vec2 q = vUv;

  // Geometry effects first: VHS wobble, pixelation
  if (fx == 15) q.x += sin(vUv.y * 30.0 + uTime * 2.0) * 0.0015 + step(0.97, fract(vUv.y * 3.0 - uTime * 0.2)) * 0.01;
  float cols = 0.0;
  if (fx == 9) cols = 84.0;
  else if (fx == 10) cols = 240.0;
  else if (fx == 12) cols = 320.0;
  else if (fx == 16) cols = 280.0;
  vec2 g = vec2(1.0);
  if (cols > 0.0) {
    g = vec2(cols, cols * uRes.y / uRes.x);
    q = (floor(q * g) + 0.5) / g;
  }
  vec2 cell = fract(vUv * g);

  vec2 uv = (q - 0.5) * uCrop + 0.5;
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  vec3 c = texture(uTex, uv).rgb;
  if (fx == 15) { // VHS chroma shift
    vec2 o = vec2(0.004, 0.0);
    c.r = texture(uTex, uv + o).r;
    c.b = texture(uTex, uv - o).b;
  }

  // Blur / Sharpness: 3x3 only when needed
  if (uBlur > 0.001 || uSharpness > 0.001) {
    float r = 1.0 + uBlur * 6.0;
    vec3 s = vec3(0.0);
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++)
        s += texture(uTex, uv + vec2(float(x), float(y)) * uTexel * r).rgb;
    s /= 9.0;
    if (uBlur > 0.001) c = mix(c, s, clamp(uBlur * 2.0, 0.0, 1.0));
    c += (c - s) * uSharpness * 2.0;
  }

  // Temperature / Tint
  c.r += uTemperature * 0.12;  c.b -= uTemperature * 0.12;
  c.g += uTint * 0.10;         c.r -= uTint * 0.04; c.b -= uTint * 0.04;

  // Highlights / Shadows
  float l0 = luma(c);
  c += uHighlights * smoothstep(0.5, 1.0, l0) * 0.3;
  c += uShadows * (1.0 - smoothstep(0.0, 0.5, l0)) * 0.3;

  // Effect
  if (fx > 0) c = mix(c, clamp(fxApply(fx, clamp(c, 0.0, 1.0), cell), 0.0, 1.0), uIntensity);

  // Brightness / Contrast / Saturation
  c += uBrightness * 0.5;
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;
  float l1 = luma(c);
  c = mix(vec3(l1), c, 1.0 + uSaturation);

  // Fade (lifted blacks)
  c = c * (1.0 - uFade * 0.35) + uFade * 0.14;

  // Vignette
  c *= 1.0 - uVignette * smoothstep(0.25, 0.8, rad());

  // Grain from a prebuilt noise texture
  if (uGrain > 0.001) {
    float n = texture(uNoise, vUv * uRes / (256.0 * max(uGrainSize, 0.5)) + uGrainOff).r - 0.5;
    float l2 = luma(c);
    c += n * uGrain * 0.5 * (1.0 - pow(abs(l2 * 2.0 - 1.0), 2.0) * 0.6);
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// id, label, min, max, default, uniform
export const SLIDERS = [
  ['intensity',   'Intensity',   0, 1, 1,   'uIntensity'],
  ['contrast',    'Contrast',   -1, 1, 0.15,'uContrast'],
  ['brightness',  'Brightness', -1, 1, 0,   'uBrightness'],
  ['saturation',  'Saturation', -1, 1, 0,   'uSaturation'],
  ['temperature', 'Temperature',-1, 1, 0,   'uTemperature'],
  ['tint',        'Tint',       -1, 1, 0,   'uTint'],
  ['highlights',  'Highlights', -1, 1, 0,   'uHighlights'],
  ['shadows',     'Shadows',    -1, 1, 0,   'uShadows'],
  ['sharpness',   'Sharpness',   0, 1, 0.2, 'uSharpness'],
  ['blur',        'Blur',        0, 1, 0,   'uBlur'],
  ['grain',       'Grain',       0, 1, 0.3, 'uGrain'],
  ['grainSize',   'Grain Size',0.5, 3, 1.2, 'uGrainSize'],
  ['vignette',    'Vignette',    0, 1, 0.3, 'uVignette'],
  ['fade',        'Fade',        0, 1, 0.1, 'uFade'],
];

// n = value of uEffect in the shader
export const EFFECTS = [
  { id: 'bleach',       n: 1,  name: 'Bleach Bypass',  group: 'Filters' },
  { id: 'dollhouse',    n: 2,  name: 'Doll House',     group: 'Filters' },
  { id: 'jetblack',     n: 3,  name: 'Jet Black',      group: 'Filters' },
  { id: 'tealorange',   n: 4,  name: 'Teal & Orange',  group: 'Filters' },
  { id: 'solarize',     n: 5,  name: 'Solarize',       group: 'Filters' },
  { id: 'candy',        n: 6,  name: 'Candy',          group: 'Filters' },
  { id: 'ccd',          n: 7,  name: 'CCD',            group: 'Digicam' },
  { id: 'ccdflash',     n: 8,  name: 'CCD Flash',      group: 'Digicam' },
  { id: 'nokia',        n: 9,  name: 'Nokia',          group: 'Digicam' },
  { id: 'motorola',     n: 10, name: 'Motorola',       group: 'Digicam' },
  { id: '3gs',          n: 11, name: '3GS',            group: 'Digicam' },
  { id: 'webcam',       n: 12, name: 'Webcam',         group: 'Digicam' },
  { id: 'polaroid',     n: 13, name: 'Polaroid',       group: 'Digicam' },
  { id: 'disposable',   n: 14, name: 'Disposable',     group: 'Digicam' },
  { id: 'vhs',          n: 15, name: 'VHS',            group: 'Digicam' },
  { id: 'surveillance', n: 16, name: 'Surveillance',   group: 'Digicam' },
  { id: 'thermal',      n: 17, name: 'Thermal',        group: 'Digicam' },
  { id: 'nightvision',  n: 18, name: 'Nightvision',    group: 'Digicam' },
];
