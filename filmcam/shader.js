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
uniform sampler2D uMask;  // painted mask: 1 = effect, 0 = original
uniform vec2 uTexel;      // 1/video size
uniform vec2 uRes;        // canvas size
uniform vec2 uGrainOff;   // grain offset per frame
uniform vec2 uCrop;       // fraction of the source frame (aspect + zoom)
uniform float uMirror;    // 1 = mirror (front camera)
uniform float uTime;      // seconds
uniform float uEffect;    // effect number, 0 = none
uniform float uMaskOn;    // 1 = use uMask
uniform vec4 uP;          // per-effect knobs (see PARAMS)
uniform float uIntensity, uContrast, uBrightness, uSaturation, uTemperature, uTint;
uniform float uHighlights, uShadows, uSharpness, uBlur, uGrain, uGrainSize, uVignette, uFade;

const float PI = 3.14159265;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 satur(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
float nz(float s){ return texture(uNoise, vUv * uRes / 256.0 * s + uGrainOff).r; }
float rad(){ return length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)); }
mat2 rot(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
vec3 hueRot(vec3 c, float a){
  vec3 k = vec3(0.57735);
  return c * cos(a) + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cos(a));
}
vec3 heat(float t){
  vec3 r = mix(vec3(0.0, 0.0, 0.08), vec3(0.32, 0.0, 0.55), smoothstep(0.0, 0.25, t));
  r = mix(r, vec3(0.92, 0.18, 0.10), smoothstep(0.25, 0.5, t));
  r = mix(r, vec3(1.0, 0.82, 0.0), smoothstep(0.5, 0.78, t));
  return mix(r, vec3(1.0), smoothstep(0.78, 1.0, t));
}

// Canvas-space uv -> source video uv (mirror-repeat, crop, front-camera mirror)
vec2 mirrorUv(vec2 u){ return 1.0 - abs(1.0 - mod(u, 2.0)); }
vec2 toSrc(vec2 q){
  vec2 u = (mirrorUv(q) - 0.5) * uCrop + 0.5;
  if (uMirror > 0.5) u.x = 1.0 - u.x;
  return u;
}

// Sobel edge strength on luma around a source uv
float edgeAt(vec2 uv, float k){
  vec2 t = uTexel * k;
  float a = luma(texture(uTex, uv + vec2(-t.x, -t.y)).rgb), b = luma(texture(uTex, uv + vec2(0.0, -t.y)).rgb), c = luma(texture(uTex, uv + vec2(t.x, -t.y)).rgb);
  float d = luma(texture(uTex, uv + vec2(-t.x, 0.0)).rgb), f = luma(texture(uTex, uv + vec2(t.x, 0.0)).rgb);
  float g = luma(texture(uTex, uv + vec2(-t.x, t.y)).rgb), h = luma(texture(uTex, uv + vec2(0.0, t.y)).rgb), i = luma(texture(uTex, uv + vec2(t.x, t.y)).rgb);
  float gx = (c + 2.0 * f + i) - (a + 2.0 * d + g);
  float gy = (g + 2.0 * h + i) - (a + 2.0 * b + c);
  return length(vec2(gx, gy)) * 0.5;
}

// Nearest jittered cell point (animated). p in cell units. Returns the point.
vec2 voro(vec2 p, out float d1, out float d2){
  vec2 ip = floor(p), fp = fract(p), best = vec2(0.0);
  d1 = 8.0; d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + 0.45 * sin(uTime * 0.6 + 6.2831 * hash22(ip + g));
    vec2 r = g + o - fp; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; best = ip + g + o; } else if (d < d2) d2 = d;
  }
  d1 = sqrt(d1); d2 = sqrt(d2);
  return best;
}

// ---- Effects ----
vec3 fxApply(int fx, vec3 c, vec2 cell, vec2 uv){
  float l = luma(c);
  float asp = uRes.x / uRes.y;
  if (fx == 1) { // Bleach Bypass
    float k = clamp((l - 0.45) * 10.0, 0.0, 1.0);
    vec3 ov = mix(2.0 * c * l, 1.0 - 2.0 * (1.0 - c) * (1.0 - l), k);
    return (mix(vec3(l), c, uP.x) * 0.3 + ov * 0.7) * 1.05;
  }
  if (fx == 2) { // Doll House: soft, pink, airy
    c = c * 1.12 + 0.05;
    c = satur(c, 1.15) * vec3(1.08, 0.95, 1.04);
    c = (c - 0.5) * 0.82 + 0.5;
    c = mix(c, vec3(1.0, 0.84, 0.92), uP.x);
    return c + max(c - 0.7, 0.0) * 0.35;
  }
  if (fx == 3) { // Jet Black: deep contrasty mono
    float m = smoothstep(uP.x, 0.86, l);
    return vec3(pow(m, 1.15)) * vec3(1.0, 1.0, 1.02);
  }
  if (fx == 4) { // Teal & Orange
    vec3 tint = mix(vec3(0.62, 1.0, 1.12), vec3(1.2, 1.0, 0.78), smoothstep(0.2, 0.8, l));
    c = c * mix(vec3(1.0), tint, uP.x);
    return (c - 0.5) * 1.15 + 0.5;
  }
  if (fx == 5) { // Solarize
    vec3 s = mix(c, 1.0 - c, smoothstep(uP.x - 0.05, uP.x + 0.05, c));
    return s * (0.9 / max(uP.x, 0.2));
  }
  if (fx == 6) { // Candy
    c = satur(c, uP.x) * vec3(1.05, 0.95, 1.1) + 0.06;
    return pow(max(c, 0.0), vec3(0.85));
  }
  if (fx == 7) { // CCD: early digicam, bright, cool shadows, bloom-y highlights
    c = c * uP.x;
    c = (c - 0.5) * 1.15 + 0.5;
    c = satur(c, 1.3);
    c += vec3(-0.02, 0.0, 0.06) * (1.0 - l);
    return mix(c, vec3(1.0), smoothstep(0.85, 1.0, l) * 0.3);
  }
  if (fx == 8) { // CCD Flash: harsh direct flash
    float f = 1.0 - smoothstep(0.12, uP.x, rad());
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
    c = c * mix(vec3(1.0), vec3(1.08, 1.03, 0.88), uP.x);
    c = satur(c, 0.85);
    c = (c - 0.5) * 0.9 + 0.5 + 0.04;
    return c * (1.0 - 0.25 * smoothstep(0.4, 0.9, rad()));
  }
  if (fx == 12) { // Webcam: low-res, green-cyan, noisy
    c = c * vec3(0.92, 1.05, 1.0);
    c = satur(c, 0.75);
    c = (c - 0.5) * 0.85 + 0.5 + 0.04;
    return c + (nz(1.0) - 0.5) * uP.y;
  }
  if (fx == 13) { // Polaroid: faded, warm highlights, greenish shadows
    c = c * (1.0 - uP.x * 1.2) + uP.x;
    c = mix(c * vec3(0.95, 1.0, 1.0), c * vec3(1.06, 1.0, 0.88), smoothstep(0.2, 0.8, l));
    c = satur(c, 0.85);
    return c * (1.0 - 0.2 * smoothstep(0.4, 0.9, rad()));
  }
  if (fx == 14) { // Disposable: warm cast, flash falloff, punchy
    c = c * mix(vec3(1.0), vec3(1.1, 1.05, 0.85), uP.x);
    c = (c - 0.5) * 1.2 + 0.5;
    c = satur(c, 1.15);
    c.g += 0.03 * (1.0 - l);
    float f = 1.0 - 0.55 * smoothstep(0.25, 0.85, rad());
    return c * f;
  }
  if (fx == 15) { // VHS: scanlines, noise bands, washed color
    c = satur(c, 0.8);
    c += vec3(0.04, 0.0, 0.05) * (1.0 - l);
    float sl = (1.0 - uP.y) + uP.y * sin(vUv.y * uRes.y * 3.14159);
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
    return heat(clamp((l - uP.x) * 1.15, 0.0, 1.0));
  }
  if (fx == 18) { // Night vision
    float m = pow(clamp(l * uP.x, 0.0, 1.0), 0.8);
    vec3 g = vec3(0.1, 1.0, 0.2) * m + (nz(1.0) - 0.5) * 0.2;
    float sl = 0.93 + 0.07 * sin(vUv.y * uRes.y * 3.14159);
    return g * sl * (1.0 - smoothstep(0.5, 0.85, rad()));
  }
  // ---- TouchDesigner-style ----
  if (fx == 110) { vec2 o = vec2(0.004, 0.0); return vec3(texture(uTex, uv + o).r, c.g, texture(uTex, uv - o).b); }
  if (fx == 111) { // RGB Split
    vec2 o = vec2(cos(uTime * uP.y), sin(uTime * uP.y)) * (uP.x * (0.75 + 0.5 * sin(uTime * 3.0)));
    return vec3(texture(uTex, uv + o).r, c.g, texture(uTex, uv - o).b);
  }
  if (fx == 112) { // Neon Edges
    float e = edgeAt(uv, uP.x);
    return c * 0.18 + pal(l * 1.5 + uTime * uP.z + e) * smoothstep(0.03, 0.25, e) * uP.y;
  }
  if (fx == 113) { // Halftone
    float s = uP.x; vec2 p = vUv * uRes / s; vec2 cl = floor(p); vec2 f = fract(p) - 0.5;
    vec3 cc = texture(uTex, toSrc((cl + 0.5) * s / uRes)).rgb;
    float r = 0.12 + 0.55 * sqrt(1.0 - luma(cc));
    return mix(vec3(0.96, 0.94, 0.90), cc * 0.7, smoothstep(r + 0.06, r - 0.06, length(f)));
  }
  if (fx == 114) { // Dither
    float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    ivec2 ip = ivec2(mod(floor(vUv * uRes / max(uP.x, 1.0)), 4.0));
    float t = (B[ip.x + 4 * ip.y] + 0.5) / 16.0;
    return mix(vec3(0.02, 0.03, 0.10), vec3(0.45, 1.0, 0.98), step(t, l));
  }
  if (fx == 115) { // ASCII
    vec2 cs = vec2(uP.x, uP.x * 1.75); vec2 p = vUv * uRes / cs; vec2 cl = floor(p), f = fract(p);
    vec3 cc = texture(uTex, toSrc((cl + 0.5) * cs / uRes)).rgb; float li = luma(cc);
    float gph = 0.0;
    if (li > 0.80) gph = step(abs(f.x - 0.5), 0.38) * step(abs(f.y - 0.5), 0.42);
    else if (li > 0.60) gph = max(step(abs(f.x - 0.35), 0.07), step(abs(f.x - 0.65), 0.07)) * step(abs(f.y - 0.5), 0.42) + max(step(abs(f.y - 0.35), 0.06), step(abs(f.y - 0.65), 0.06)) * step(abs(f.x - 0.5), 0.38);
    else if (li > 0.40) gph = max(step(abs(f.x - 0.5), 0.09) * step(abs(f.y - 0.5), 0.32), step(abs(f.y - 0.5), 0.07) * step(abs(f.x - 0.5), 0.32));
    else if (li > 0.22) gph = step(length(f - vec2(0.5, 0.3)), 0.1) + step(length(f - vec2(0.5, 0.7)), 0.1);
    else if (li > 0.10) gph = step(length(f - 0.5), 0.1);
    return mix(vec3(0.0, 0.02, 0.03), mix(vec3(0.25, 1.0, 0.9), cc * 1.4, 0.45), clamp(gph, 0.0, 1.0));
  }
  if (fx == 116) { // Mosaic (Voronoi)
    float N = uP.x; vec2 sz = vec2(N * asp, N); float d1, d2;
    vec2 ctr = voro(vUv * sz, d1, d2);
    vec3 cc = texture(uTex, toSrc(ctr / sz)).rgb;
    return cc * mix(0.35, 1.0, smoothstep(0.0, 0.08, d2 - d1));
  }
  if (fx == 117) { // Hex Pixels
    float S = uP.x; vec2 sz = vec2(S * asp, S); vec2 p = vUv * sz;
    vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec3 cc = texture(uTex, toSrc((p - gv) / sz)).rgb;
    return cc * mix(0.55, 1.0, smoothstep(0.52, 0.40, length(gv)));
  }
  if (fx == 118) { // LED Matrix
    vec2 p = vUv * uRes / uP.x; vec2 f = fract(p) - 0.5;
    vec3 cc = texture(uTex, toSrc((floor(p) + 0.5) * uP.x / uRes)).rgb;
    return cc * 1.4 * smoothstep(0.44, 0.30, length(f)) + 0.02;
  }
  if (fx == 119) { // Cel Edges
    vec3 q3 = satur(floor(c * uP.x + 0.5) / uP.x, 1.3);
    return q3 * (1.0 - uP.y * smoothstep(0.15, 0.5, edgeAt(uv, 1.2)));
  }
  if (fx == 120) { // Duotone Flow
    return mix(pal(uTime * uP.x) * 0.12, pal(uTime * uP.x + uP.y), smoothstep(0.05, 0.95, l));
  }
  if (fx == 121) { // Wire Grid
    vec2 g = fract(vUv * uRes / uP.x);
    float ln = max(step(g.x, uP.y), step(g.y, uP.y));
    return c * 0.22 + ln * vec3(0.1, 0.9, 1.0) * (0.25 + 0.9 * l);
  }
  if (fx == 122) { // Zoom Blur
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) acc += texture(uTex, toSrc((vUv - 0.5) * (1.0 - float(i) * uP.x) + 0.5)).rgb;
    return acc / 12.0 * 1.15 + max(c - 0.6, 0.0) * 0.3;
  }
  if (fx == 123) { // Pointillize
    float N = uP.x; vec2 sz = vec2(N * asp, N); float d1, d2;
    vec2 ctr = voro(vUv * sz, d1, d2);
    vec3 cc = texture(uTex, toSrc(ctr / sz)).rgb;
    return mix(vec3(0.96, 0.94, 0.90), cc * 1.1, smoothstep(uP.y, uP.y - 0.08, d1));
  }
  if (fx == 124) return hueRot(satur(c, uP.y), uTime * uP.x); // Hue Cycle
  if (fx == 125) { // Bloom
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float an = float(i) * 2.39996; float rr = sqrt(float(i) + 0.5) / 3.5;
      acc += max(texture(uTex, uv + vec2(cos(an), sin(an)) * rr * uTexel * uP.z).rgb - uP.x, 0.0);
    }
    return c * 0.95 + acc / 12.0 * uP.y;
  }
  if (fx == 126) return satur(c, 1.25);                  // Echo Trails (base look)
  if (fx == 127) return satur(hueRot(c, 0.2), 1.3);      // Feedback Tunnel (base look)
  return c;
}

// Canvas-space geometry for an effect (pixelation, wobble, TD warps)
vec2 geo(int fx, vec2 q, out vec2 cell){
  float asp = uRes.x / uRes.y;
  if (fx == 15) q.x += sin(vUv.y * 30.0 + uTime * 2.0) * 0.0015 + step(0.97, fract(vUv.y * 3.0 - uTime * 0.2)) * 0.01;
  float cols = 0.0;
  if (fx == 9) cols = uP.x;
  else if (fx == 10) cols = uP.x;
  else if (fx == 12) cols = uP.x;
  else if (fx == 16) cols = uP.x;
  vec2 g = vec2(1.0);
  if (cols > 0.0) {
    g = vec2(cols, cols / asp);
    q = (floor(q * g) + 0.5) / g;
  }
  cell = fract(vUv * g);

  if (fx >= 101 && fx <= 110) {
    vec2 p = (q - 0.5) * vec2(asp, 1.0);
    float r = length(p);
    bool useP = true;
    if (fx == 101) { // Kaleidoscope
      float w = PI * 2.0 / floor(uP.x + 0.5);
      float a = mod(atan(p.y, p.x) + uTime * uP.y, w);
      a = abs(a - w * 0.5);
      p = 0.6 * r * vec2(cos(a), sin(a));
    } else if (fx == 102) { // Mirror Quad
      p = abs(p);
    } else if (fx == 103) { // Tunnel
      q = vec2(abs(atan(p.y, p.x)) / PI, uP.y / max(r, 0.04) - uTime * uP.x); useP = false;
    } else if (fx == 104) { // Swirl
      p = rot((1.0 - smoothstep(0.0, 0.9, r)) * (uP.x * (0.7 + 0.3 * sin(uTime * 0.6)))) * p;
    } else if (fx == 105) { // Bulge
      p *= (1.0 - uP.x) + uP.x * smoothstep(0.0, 1.0, r * 1.2);
    } else if (fx == 106) { // Ripple
      p += (r > 0.001 ? p / r : vec2(0.0)) * sin(r * uP.x - uTime * uP.z) * uP.y * (1.0 - smoothstep(0.0, 1.2, r));
    } else if (fx == 107) { // Noise Warp
      p += (vec2(vnoise(p * uP.x + uTime * uP.z), vnoise(p * uP.x + 7.0 + uTime * uP.z)) - 0.5) * uP.y;
    } else if (fx == 108) { // Tile Grid
      q = fract(q * uP.x); useP = false;
    } else if (fx == 109) { // Wave
      q.x += sin(q.y * uP.y + uTime * uP.z) * uP.x; q.y += sin(q.x * uP.y * 0.83 + uTime * uP.z * 0.85) * uP.x; useP = false;
    } else { // 110 Glitch Blocks
      float by = floor(q.y * 18.0), t = floor(uTime * uP.y);
      q.x += step(1.0 - uP.x, hash21(vec2(by, t))) * (hash21(vec2(by, t + 11.0)) - 0.5) * 0.3;
      vec2 bk = floor(q * vec2(6.0, 8.0));
      q += step(0.95, hash21(bk + vec2(3.0, t))) * (hash22(bk) - 0.5) * 0.2;
      useP = false;
    }
    if (useP) q = p / vec2(asp, 1.0) + 0.5;
  }
  return q;
}

// Source sample + pre-effect adjustments (blur, sharpen, temperature, tint, highlights, shadows)
vec3 pre(vec2 uv, int fx){
  vec3 c = texture(uTex, uv).rgb;
  if (fx == 15) { // VHS chroma shift
    vec2 o = vec2(uP.x, 0.0);
    c.r = texture(uTex, uv + o).r;
    c.b = texture(uTex, uv - o).b;
  }
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
  c.r += uTemperature * 0.12;  c.b -= uTemperature * 0.12;
  c.g += uTint * 0.10;         c.r -= uTint * 0.04; c.b -= uTint * 0.04;
  float l0 = luma(c);
  c += uHighlights * smoothstep(0.5, 1.0, l0) * 0.3;
  c += uShadows * (1.0 - smoothstep(0.0, 0.5, l0)) * 0.3;
  return c;
}

void main(){
  int fx = int(uEffect + 0.5);
  vec2 cell;
  vec2 q = geo(fx, vUv, cell);
  vec2 uvFx = toSrc(q);
  vec3 c = pre(uvFx, fx);

  // Effect strength = Intensity x painted mask; the rest shows the untouched picture
  float k = uIntensity;
  if (uMaskOn > 0.5) k *= texture(uMask, vUv).r;
  if (fx > 0) {
    vec3 e = clamp(fxApply(fx, clamp(c, 0.0, 1.0), cell, uvFx), 0.0, 1.0);
    if (k < 0.999) c = mix(pre(toSrc(vUv), 0), e, k); else c = e;
  }

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


// Second pass for feedback effects: reads the fresh frame (uCur) and the previous result (uPrev).
export const FRAG_FB = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform float uMode;    // 0 = copy, 1 = echo trails, 2 = feedback tunnel
uniform float uAspect;
uniform float uReset;   // 1 = no history yet
uniform vec4 uP;        // echo: decay, hue | tunnel: decay, rotation, zoom
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hueRot(vec3 c, float a){
  vec3 k = vec3(0.57735);
  return c * cos(a) + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cos(a));
}
void main(){
  vec3 cur = texture(uCur, vUv).rgb;
  if (uMode < 0.5 || uReset > 0.5) { outColor = vec4(cur, 1.0); return; }
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  if (uMode < 1.5) {
    vec3 prev = texture(uPrev, p * 0.994 / vec2(uAspect, 1.0) + 0.5).rgb;
    prev = hueRot(prev, uP.y) * uP.x;
    outColor = vec4(max(cur, prev), 1.0);
  } else {
    float a = uP.y, s = sin(a), c = cos(a);
    p = mat2(c, -s, s, c) * p * uP.z;
    vec3 prev = texture(uPrev, p / vec2(uAspect, 1.0) + 0.5).rgb;
    prev = hueRot(prev, 0.04) * uP.x;
    float m = smoothstep(0.35, 0.7, luma(cur));
    outColor = vec4(max(mix(prev, cur, 0.15), cur * m), 1.0);
  }
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
  { id: 'bleach',       n: 1,  name: 'Bleach Bypass',  group: 'Filters', tab: 'presets' },
  { id: 'dollhouse',    n: 2,  name: 'Doll House',     group: 'Filters', tab: 'presets' },
  { id: 'jetblack',     n: 3,  name: 'Jet Black',      group: 'Filters', tab: 'presets' },
  { id: 'tealorange',   n: 4,  name: 'Teal & Orange',  group: 'Filters', tab: 'presets' },
  { id: 'solarize',     n: 5,  name: 'Solarize',       group: 'Filters', tab: 'presets' },
  { id: 'candy',        n: 6,  name: 'Candy',          group: 'Filters', tab: 'presets' },
  { id: 'ccd',          n: 7,  name: 'CCD',            group: 'Digicam', tab: 'presets' },
  { id: 'ccdflash',     n: 8,  name: 'CCD Flash',      group: 'Digicam', tab: 'presets' },
  { id: 'nokia',        n: 9,  name: 'Nokia',          group: 'Digicam', tab: 'presets' },
  { id: 'motorola',     n: 10, name: 'Motorola',       group: 'Digicam', tab: 'presets' },
  { id: '3gs',          n: 11, name: '3GS',            group: 'Digicam', tab: 'presets' },
  { id: 'webcam',       n: 12, name: 'Webcam',         group: 'Digicam', tab: 'presets' },
  { id: 'polaroid',     n: 13, name: 'Polaroid',       group: 'Digicam', tab: 'presets' },
  { id: 'disposable',   n: 14, name: 'Disposable',     group: 'Digicam', tab: 'presets' },
  { id: 'vhs',          n: 15, name: 'VHS',            group: 'Digicam', tab: 'presets' },
  { id: 'surveillance', n: 16, name: 'Surveillance',   group: 'Digicam', tab: 'presets' },
  { id: 'thermal',      n: 17, name: 'Thermal',        group: 'Digicam', tab: 'presets' },
  { id: 'nightvision',  n: 18, name: 'Nightvision',    group: 'Digicam', tab: 'presets' },
  { id: 'kaleido', n: 101, name: 'Kaleidoscope', group: 'Warp', tab: 'touch' },
  { id: 'mirrorquad', n: 102, name: 'Mirror Quad', group: 'Warp', tab: 'touch' },
  { id: 'tunnel', n: 103, name: 'Tunnel', group: 'Warp', tab: 'touch' },
  { id: 'swirl', n: 104, name: 'Swirl', group: 'Warp', tab: 'touch' },
  { id: 'bulge', n: 105, name: 'Bulge', group: 'Warp', tab: 'touch' },
  { id: 'ripple', n: 106, name: 'Ripple', group: 'Warp', tab: 'touch' },
  { id: 'noisewarp', n: 107, name: 'Noise Warp', group: 'Warp', tab: 'touch' },
  { id: 'tilegrid', n: 108, name: 'Tile Grid', group: 'Warp', tab: 'touch' },
  { id: 'wave', n: 109, name: 'Wave', group: 'Warp', tab: 'touch' },
  { id: 'glitch', n: 110, name: 'Glitch Blocks', group: 'Warp', tab: 'touch' },
  { id: 'rgbsplit', n: 111, name: 'RGB Split', group: 'Style', tab: 'touch' },
  { id: 'neonedges', n: 112, name: 'Neon Edges', group: 'Style', tab: 'touch' },
  { id: 'halftone', n: 113, name: 'Halftone', group: 'Style', tab: 'touch' },
  { id: 'dither', n: 114, name: 'Dither', group: 'Style', tab: 'touch' },
  { id: 'ascii', n: 115, name: 'ASCII', group: 'Style', tab: 'touch' },
  { id: 'mosaic', n: 116, name: 'Mosaic', group: 'Style', tab: 'touch' },
  { id: 'hexpixels', n: 117, name: 'Hex Pixels', group: 'Style', tab: 'touch' },
  { id: 'ledmatrix', n: 118, name: 'LED Matrix', group: 'Style', tab: 'touch' },
  { id: 'cel', n: 119, name: 'Cel Edges', group: 'Style', tab: 'touch' },
  { id: 'duoflow', n: 120, name: 'Duotone Flow', group: 'Style', tab: 'touch' },
  { id: 'wiregrid', n: 121, name: 'Wire Grid', group: 'Style', tab: 'touch' },
  { id: 'zoomblur', n: 122, name: 'Zoom Blur', group: 'Style', tab: 'touch' },
  { id: 'pointillize', n: 123, name: 'Pointillize', group: 'Style', tab: 'touch' },
  { id: 'huecycle', n: 124, name: 'Hue Cycle', group: 'Style', tab: 'touch' },
  { id: 'bloom', n: 125, name: 'Bloom', group: 'Style', tab: 'touch' },
  { id: 'echo', n: 126, name: 'Echo Trails', group: 'Feedback', tab: 'touch', fb: true, fbMode: 1 },
  { id: 'fbtunnel', n: 127, name: 'Feedback Tunnel', group: 'Feedback', tab: 'touch', fb: true, fbMode: 2 },
];

// Per-effect knobs: [label, min, max, default]. Sent to the shader as uP (up to 4).
const PARAMS = {
  bleach: [['Color keep', 0, 1, 0.45]], dollhouse: [['Pink', 0, 0.4, 0.10]], jetblack: [['Black point', 0, 0.5, 0.16]],
  tealorange: [['Strength', 0, 1.5, 1]], solarize: [['Threshold', 0.2, 0.8, 0.5]], candy: [['Saturation', 1, 2.5, 1.55]],
  ccd: [['Exposure', 0.8, 1.8, 1.25]], ccdflash: [['Flash reach', 0.2, 1.2, 0.95]],
  nokia: [['Pixels across', 40, 160, 84]], motorola: [['Pixels across', 80, 480, 240]], '3gs': [['Warmth', 0, 1.5, 1]],
  webcam: [['Pixels across', 120, 640, 320], ['Noise', 0, 0.3, 0.12]], polaroid: [['Fade', 0, 0.3, 0.10]], disposable: [['Warmth', 0, 1.5, 1]],
  vhs: [['Color bleed', 0, 0.02, 0.004], ['Scanlines', 0, 0.3, 0.12]], surveillance: [['Pixels across', 100, 560, 280]],
  thermal: [['Cold point', 0, 0.3, 0.08]], nightvision: [['Gain', 1, 4, 1.8]],
  kaleido: [['Segments', 3, 16, 6], ['Spin', -1, 1, 0.15]], mirrorquad: [],
  tunnel: [['Speed', -2, 2, 0.35], ['Depth', 0.1, 1, 0.3]], swirl: [['Twist', 0, 6, 3.5]], bulge: [['Amount', 0, 1, 0.45]],
  ripple: [['Frequency', 10, 90, 45], ['Height', 0, 0.05, 0.012], ['Speed', 0, 10, 5]],
  noisewarp: [['Scale', 1, 8, 3], ['Amount', 0, 0.5, 0.18], ['Speed', 0, 1, 0.2]], tilegrid: [['Tiles', 1, 8, 3]],
  wave: [['Height', 0, 0.1, 0.02], ['Frequency', 2, 30, 12], ['Speed', 0, 6, 2]], glitch: [['Amount', 0, 0.5, 0.14], ['Rate', 1, 20, 7]],
  rgbsplit: [['Distance', 0, 0.03, 0.008], ['Spin', 0, 5, 1.3]],
  neonedges: [['Thickness', 0.5, 4, 1.5], ['Glow', 0.5, 4, 2.2], ['Hue speed', 0, 1, 0.15]],
  halftone: [['Dot size', 4, 24, 9]], dither: [['Pixel size', 1, 8, 3]], ascii: [['Cell size', 5, 20, 8]],
  mosaic: [['Cells', 6, 40, 16]], hexpixels: [['Cells', 6, 50, 18]], ledmatrix: [['Cell size', 4, 24, 10]],
  cel: [['Levels', 2, 8, 4], ['Outline', 0, 1, 1]], duoflow: [['Speed', 0, 1, 0.05], ['Hue offset', 0, 1, 0.45]],
  wiregrid: [['Cell size', 8, 80, 26], ['Line width', 0.02, 0.3, 0.06]], zoomblur: [['Amount', 0, 0.03, 0.014]],
  pointillize: [['Cells', 10, 80, 34], ['Dot size', 0.2, 0.5, 0.42]], huecycle: [['Speed', 0, 4, 0.9], ['Saturation', 0, 2, 1.3]],
  bloom: [['Threshold', 0, 1, 0.55], ['Gain', 0, 6, 2.4], ['Radius', 4, 40, 14]],
  echo: [['Decay', 0.8, 1, 0.94], ['Hue shift', 0, 0.3, 0.07]], fbtunnel: [['Decay', 0.8, 1, 0.97], ['Rotation', -0.05, 0.05, 0.015], ['Zoom', 0.95, 1, 0.985]],
};
for (const e of EFFECTS) e.p = PARAMS[e.id] || [];
