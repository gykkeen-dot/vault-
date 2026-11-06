// FilmCam, этап 1: камера -> WebGL2 (один проход) -> фото.
// Все эффекты и ползунки живут в одном фрагментном шейдере, включаются uniform-значениями.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform vec2 uTexel;      // 1/размер видео
uniform vec2 uRes;        // размер канваса
uniform vec2 uGrainOff;   // сдвиг шума по времени
uniform float uEffect;    // 1 = Bleach Bypass включён
uniform float uIntensity, uContrast, uBrightness, uSaturation, uTemperature, uTint;
uniform float uHighlights, uShadows, uSharpness, uBlur, uGrain, uGrainSize, uVignette, uFade;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 bleachBypass(vec3 c){
  float l = luma(c);
  float k = clamp((l - 0.45) * 10.0, 0.0, 1.0);
  vec3 dark  = 2.0 * c * l;
  vec3 light = 1.0 - 2.0 * (1.0 - c) * (1.0 - l);
  vec3 ov = mix(dark, light, k);
  vec3 desat = mix(vec3(l), c, 0.45);
  return mix(desat, ov, 0.7) * 1.05;
}

void main(){
  vec3 c = texture(uTex, vUv).rgb;

  // Blur / Sharpness: 3x3 только если нужны
  if (uBlur > 0.001 || uSharpness > 0.001) {
    float r = 1.0 + uBlur * 6.0;
    vec3 s = vec3(0.0);
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++)
        s += texture(uTex, vUv + vec2(float(x), float(y)) * uTexel * r).rgb;
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

  // Эффект
  if (uEffect > 0.5) c = mix(c, bleachBypass(clamp(c, 0.0, 1.0)), uIntensity);

  // Brightness / Contrast / Saturation
  c += uBrightness * 0.5;
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;
  float l1 = luma(c);
  c = mix(vec3(l1), c, 1.0 + uSaturation);

  // Fade (приподнятые чёрные)
  c = c * (1.0 - uFade * 0.35) + uFade * 0.14;

  // Vignette
  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.8, length(d * vec2(uRes.x / uRes.y, 1.0)));

  // Grain из готовой текстуры (без random на пиксель)
  if (uGrain > 0.001) {
    float n = texture(uNoise, vUv * uRes / (256.0 * max(uGrainSize, 0.5)) + uGrainOff).r - 0.5;
    float l2 = luma(c);
    c += n * uGrain * 0.5 * (1.0 - pow(abs(l2 * 2.0 - 1.0), 2.0) * 0.6);
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ---- Ползунки: id, подпись, min, max, значение по умолчанию, uniform ----
const SLIDERS = [
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

// Состояние = будущий пресет (этап 6 просто сохранит этот объект в JSON)
const state = { effect: 'bleach', eco: false };
for (const s of SLIDERS) state[s[0]] = s[4];

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const video = document.createElement('video');
video.playsInline = true; video.muted = true; video.autoplay = true;

let gl, prog, U = {}, tex, noiseTex;
let stream = null, running = false, wakeLock = null;
let quality = { tiers: [1080, 720, 540], i: 0 };
let lastDraw = 0, skipped = 0, frames = 0, renderMs = 0, lastPresented = 0, fps = 0, fpsT = 0, fpsN = 0;

function showStatus(msg) {
  const el = $('status');
  el.textContent = msg; el.hidden = !msg;
}

// ---------- WebGL ----------
function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function initGL() {
  gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 недоступен');
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name;
    U[name] = gl.getUniformLocation(prog, name);
  }

  // Видео-текстура
  tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Текстура шума 256x256, один раз
  const data = new Uint8Array(256 * 256);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 256;
  noiseTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 256, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, p, v);

  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNoise, 1);
}

function setCanvasSize(w, h) {
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
}

function previewSize() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const short = Math.min(vw, vh);
  const tier = state.eco ? Math.min(quality.tiers[quality.i], 720) : quality.tiers[quality.i];
  const s = Math.min(1, tier / short);
  return [Math.round(vw * s), Math.round(vh * s)];
}

function draw() {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);

  gl.uniform2f(U.uTexel, 1 / video.videoWidth, 1 / video.videoHeight);
  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform2f(U.uGrainOff, Math.random(), Math.random());
  gl.uniform1f(U.uEffect, state.effect === 'bleach' ? 1 : 0);
  for (const s of SLIDERS) gl.uniform1f(U[s[5]], state[s[0]]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---------- Цикл: рисуем только на новый кадр ----------
function onFrame(now, meta) {
  if (!running) return;
  schedule();
  if (video.readyState < 2 || !video.videoWidth) return;

  // Эко: 30 fps
  if (state.eco && now - lastDraw < 30) return;
  lastDraw = now;

  const t0 = performance.now();
  const [w, h] = previewSize();
  setCanvasSize(w, h);
  draw();
  renderMs = renderMs * 0.9 + (performance.now() - t0) * 0.1;

  // Адаптивное качество: считаем пропущенные кадры камеры
  if (meta && meta.presentedFrames != null) {
    if (lastPresented) skipped += Math.max(0, meta.presentedFrames - lastPresented - 1);
    lastPresented = meta.presentedFrames;
  }
  frames++;
  if (frames >= 60) {
    const bad = skipped / (frames + skipped) > 0.15 || renderMs > 20;
    if (bad && quality.i < quality.tiers.length - 1) quality.i++;
    frames = 0; skipped = 0;
  }

  fpsN++;
  if (now - fpsT > 1000) {
    fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now;
    $('perf').textContent = `${canvas.width}x${canvas.height} · ${fps} fps · ${renderMs.toFixed(1)} ms`;
  }
}

function schedule() {
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame);
  else requestAnimationFrame((t) => onFrame(t, null));
}

function startLoop() {
  if (running) return;
  running = true; lastPresented = 0; schedule();
}
function stopLoop() { running = false; }

// ---------- Камера ----------
async function openCamera() {
  closeCamera();
  const tries = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: true, audio: false },
  ];
  let err;
  for (const c of tries) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { err = e; }
  }
  if (!stream) throw err;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
}

function closeCamera() {
  stopLoop();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; video.srcObject = null;
}

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* не критично */ }
}

document.addEventListener('visibilitychange', async () => {
  if (!stream) return;
  if (document.hidden) { stopLoop(); }
  else { await requestWakeLock(); video.play().catch(() => {}); startLoop(); }
});

// ---------- Фото в полном разрешении ----------
function takePhoto() {
  if (!running) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  setCanvasSize(vw, vh);
  draw();
  canvas.toBlob(async (blob) => {
    setCanvasSize(...previewSize());
    if (!blob) return showStatus('Не удалось сохранить кадр');
    const name = `filmcam-${Date.now()}.jpg`;
    const url = URL.createObjectURL(blob);
    $('thumb').src = url; $('thumbLink').classList.add('has');
    $('thumbLink').onclick = (e) => { e.preventDefault(); saveBlob(blob, name); };
    flashShutter();
    await saveBlob(blob, name);
  }, 'image/jpeg', 0.95);
}

// На iPhone: Поделиться -> «Сохранить изображение». Иначе скачивание файла.
async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: 'image/jpeg' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

function flashShutter() {
  canvas.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 160 });
}

// ---------- UI ----------
function buildSliders() {
  const box = $('sliders');
  for (const [id, label, min, max, , ] of SLIDERS) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<label for="s-${id}">${label}</label><input type="range" id="s-${id}" min="${min}" max="${max}" step="0.01"><span class="v"></span>`;
    box.appendChild(row);
    const input = row.querySelector('input'), val = row.querySelector('.v');
    const sync = () => { input.value = state[id]; val.textContent = (+state[id]).toFixed(2); };
    input.addEventListener('input', () => { state[id] = parseFloat(input.value); sync(); });
    row._sync = sync; sync();
  }
}

function resetSliders() {
  for (const s of SLIDERS) state[s[0]] = s[4];
  document.querySelectorAll('#sliders .row').forEach((r) => r._sync());
}

async function start() {
  $('startBtn').disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Нужен HTTPS и современный браузер');
    initGL();
    buildSliders();
    await openCamera();
    await requestWakeLock();
    $('start').hidden = true;
    $('perf').hidden = false;
    $('shutter').disabled = false;
    startLoop();
  } catch (e) {
    $('startBtn').disabled = false;
    $('start').querySelector('p').textContent = 'Ошибка: ' + (e.message || e.name);
  }
}

$('startBtn').addEventListener('click', start);
$('shutter').addEventListener('click', takePhoto);
$('panelBtn').addEventListener('click', () => { $('panel').hidden = !$('panel').hidden; });
$('effectOn').addEventListener('change', (e) => { state.effect = e.target.checked ? 'bleach' : 'none'; });
$('eco').addEventListener('change', (e) => { state.eco = e.target.checked; });
$('reset').addEventListener('click', resetSliders);

// Для автотестов
window.__filmcam = { state, get quality() { return quality; } };
