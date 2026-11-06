// FilmCam, этап 1: камера -> WebGL2 (один проход) -> фото.
// Все эффекты и ползунки живут в одном фрагментном шейдере, включаются uniform-значениями.

import { VERT, FRAG, SLIDERS, EFFECTS } from './shader.js';

// Состояние = будущий пресет (этап 6 просто сохранит этот объект в JSON)
const state = { effect: 'bleach', eco: false }; // effect: id from EFFECTS or 'none'
// Настройки камеры (не входят в пресет)
const cam = { facing: 'environment', zoom: 1, ar: '9:16', timer: 0, ultraId: null, mainId: {}, kind: 'main', busy: false };
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
  if (!gl) throw new Error('WebGL2 is not available');
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

const AR = { '9:16': 9 / 16, '4:3': 3 / 4, '1:1': 1 };

// Выходное соотношение сторон с учётом ориентации потока
function outAspect() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const a = AR[cam.ar];
  if (!vw) return a;
  return vh >= vw ? a : 1 / a;
}

// Какую часть исходного кадра берём: центр-кроп под формат и цифровой зум
function cropFrac() {
  const V = video.videoWidth / video.videoHeight, A = outAspect();
  let cx = 1, cy = 1;
  if (A < V) cx = A / V; else cy = V / A;
  const z = Math.max(1, cam.zoom);
  return [cx / z, cy / z];
}

function previewSize() {
  const [cx, cy] = cropFrac();
  const sw = video.videoWidth * cx, sh = video.videoHeight * cy;
  const tier = state.eco ? Math.min(quality.tiers[quality.i], 720) : quality.tiers[quality.i];
  const s = Math.min(1, tier / Math.min(sw, sh));
  return [Math.round(sw * s), Math.round(sh * s)];
}

function fitFrame() {
  const vp = $('vp'), fr = $('frame');
  const cs = getComputedStyle(vp);
  const W = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 14;
  const H = vp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 14;
  const A = outAspect();
  let w = W, h = W / A;
  if (h > H) { h = H; w = H * A; }
  fr.style.width = Math.max(0, Math.floor(w)) + 'px';
  fr.style.height = Math.max(0, Math.floor(h)) + 'px';
}
new ResizeObserver(fitFrame).observe(document.getElementById('vp'));

function draw() {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);

  gl.uniform2f(U.uTexel, 1 / video.videoWidth, 1 / video.videoHeight);
  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform2f(U.uGrainOff, Math.random(), Math.random());
  gl.uniform2f(U.uCrop, ...cropFrac());
  gl.uniform1f(U.uMirror, cam.facing === 'user' ? 1 : 0);
  const fx = EFFECTS.find((e) => e.id === state.effect);
  gl.uniform1f(U.uEffect, fx ? fx.n : 0);
  gl.uniform1f(U.uTime, (performance.now() / 1000) % 1000);
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
    $('perf').textContent = `${canvas.width}×${canvas.height} · ${fps} FPS · ${renderMs.toFixed(1)} MS`;
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
async function openCamera({ deviceId } = {}) {
  closeCamera();
  const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  const tries = [];
  if (deviceId) tries.push({ video: { deviceId: { exact: deviceId }, ...size }, audio: false });
  tries.push({ video: { facingMode: { ideal: cam.facing }, ...size }, audio: false });
  tries.push({ video: true, audio: false });
  let err;
  for (const c of tries) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { err = e; }
  }
  if (!stream) throw err;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  const id = stream.getVideoTracks()[0].getSettings().deviceId;
  if (cam.kind === 'main') cam.mainId[cam.facing] = id;
  await detectUltraWide();
}

// 0.5x: ищем ультраширокую камеру по названию (метки доступны после разрешения)
async function detectUltraWide() {
  try {
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const u = list.find((d) => /ultra/i.test(d.label) && !/front|user/i.test(d.label));
    cam.ultraId = u ? u.deviceId : null;
  } catch { cam.ultraId = null; }
  syncUI();
}

function closeCamera() {
  stopLoop();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; video.srcObject = null;
}

// Любое действие, которое перезапускает поток
async function switchCamera(fn) {
  if (cam.busy) return;
  cam.busy = true; syncUI(); showStatus('SWITCHING CAMERA…');
  try { await fn(); startLoop(); showStatus(''); }
  catch (e) { showStatus('Camera error: ' + (e.message || e.name)); }
  cam.busy = false; fitFrame(); syncUI();
}

async function setFacing(f) {
  if (f === cam.facing || cam.busy) return;
  await switchCamera(async () => {
    cam.facing = f; cam.zoom = 1; cam.kind = 'main'; unlockFocus();
    await openCamera({ deviceId: cam.mainId[f] });
  });
}

async function setZoom(z) {
  if (cam.busy) return;
  if (z === 0.5) {
    if (!cam.ultraId || cam.facing !== 'environment') return;
    if (cam.kind !== 'ultra') {
      await switchCamera(async () => { cam.kind = 'ultra'; cam.zoom = 0.5; await openCamera({ deviceId: cam.ultraId }); });
    } else cam.zoom = 0.5;
  } else if (cam.kind === 'ultra') {
    await switchCamera(async () => { cam.kind = 'main'; cam.zoom = z; await openCamera({ deviceId: cam.mainId[cam.facing] }); });
  } else cam.zoom = z;
  syncUI();
}

function setAspect(ar) { cam.ar = ar; fitFrame(); syncUI(); }

function syncUI() {
  const mark = (seg, attr, val) => document.querySelectorAll(`#${seg} button`).forEach((b) => {
    b.classList.toggle('on', String(b.dataset[attr]) === String(val));
  });
  mark('zoomSeg', 'zoom', cam.zoom); mark('camSeg', 'cam', cam.facing);
  mark('arSeg', 'ar', cam.ar); mark('timerSeg', 't', cam.timer);
  const z05 = document.querySelector('#zoomSeg [data-zoom="0.5"]');
  z05.disabled = !cam.ultraId || cam.facing !== 'environment';
  document.querySelectorAll('#zoomSeg button, #camSeg button').forEach((b) => { if (cam.busy) b.disabled = true; else if (b !== z05) b.disabled = false; });
  if (cam.busy) z05.disabled = true;
  const [cx] = cropFrac();
  $('readout').textContent = `${cam.facing === 'user' ? 'FRONT' : 'BACK'} · ${cam.zoom}× · ${cam.ar}${cam.timer ? ' · TIMER ' + cam.timer + 'S' : ''}${cx ? '' : ''}`;
}

// ---------- Фокус по тапу / блокировка по долгому нажатию ----------
let focusLocked = false;

function toVideoPoint(x, y) {
  // x, y: 0..1 внутри кадра -> координаты в исходном потоке
  const [cx, cy] = cropFrac();
  let vx = (x - 0.5) * cx + 0.5;
  if (cam.facing === 'user') vx = 1 - vx;
  return { x: vx, y: (y - 0.5) * cy + 0.5 };
}

async function focusAt(x, y, lock) {
  const track = stream && stream.getVideoTracks()[0];
  const caps = (track && track.getCapabilities) ? track.getCapabilities() : {};
  const has = (k, v) => Array.isArray(caps[k]) && caps[k].includes(v);
  let label = 'FOCUS NOT SUPPORTED';
  try {
    if (lock && has('focusMode', 'manual')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual' }] });
      if (has('exposureMode', 'manual')) await track.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });
      focusLocked = true; label = 'AE/AF LOCKED';
    } else if (has('focusMode', 'single-shot')) {
      const p = toVideoPoint(x, y);
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest: [p] }] });
      label = 'FOCUS';
    } else if (lock) label = 'LOCK NOT SUPPORTED';
  } catch { label = 'FOCUS NOT SUPPORTED'; }
  showReticle(x, y, label, focusLocked);
}

async function unlockFocus() {
  if (!focusLocked) return;
  focusLocked = false;
  document.querySelectorAll('.reticle').forEach((r) => r.remove());
  const track = stream && stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }] }); } catch { /* ignore */ }
}

function showReticle(x, y, label, lock) {
  const fr = $('frame');
  fr.querySelectorAll('.reticle').forEach((r) => r.remove());
  const r = document.createElement('div');
  r.className = 'reticle' + (lock ? ' lock' : '');
  r.style.left = x * 100 + '%'; r.style.top = y * 100 + '%';
  r.innerHTML = `<span>${label}</span>`;
  fr.appendChild(r);
  if (!lock) setTimeout(() => r.remove(), 1200);
}

(function bindFocus() {
  const fr = $('frame'); let t = null, long = false;
  const pos = (e) => { const b = fr.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
  fr.addEventListener('pointerdown', (e) => {
    if (!running) return;
    long = false; const [x, y] = pos(e);
    t = setTimeout(() => { long = true; if (focusLocked) unlockFocus(); else focusAt(x, y, true); }, 600);
  });
  fr.addEventListener('pointerup', (e) => {
    clearTimeout(t);
    if (!long && running) { const [x, y] = pos(e); focusAt(x, y, false); }
  });
  fr.addEventListener('pointerleave', () => clearTimeout(t));
})();

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* not critical */ }
}

document.addEventListener('visibilitychange', async () => {
  if (!stream) return;
  if (document.hidden) { stopLoop(); }
  else { await requestWakeLock(); video.play().catch(() => {}); startLoop(); }
});

// ---------- Фото в полном разрешении ----------
function takePhoto() {
  if (!running) return;
  const [cx, cy] = cropFrac();
  setCanvasSize(Math.round(video.videoWidth * cx), Math.round(video.videoHeight * cy));
  draw();
  canvas.toBlob(async (blob) => {
    setCanvasSize(...previewSize());
    if (!blob) return showStatus('Could not save the photo');
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

function buildEffects() {
  const box = $('fxList');
  const add = (id, name) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = name; b.dataset.fx = id;
    b.addEventListener('click', () => {
      state.effect = id;
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.fx === id));
    });
    box.appendChild(b);
  };
  let group = '';
  add('none', 'Original');
  for (const e of EFFECTS) {
    if (e.group !== group) {
      group = e.group;
      const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = group; box.appendChild(sep);
    }
    add(e.id, e.name);
  }
  box.querySelector(`[data-fx="${state.effect}"]`).classList.add('on');
}

function resetSliders() {
  for (const s of SLIDERS) state[s[0]] = s[4];
  document.querySelectorAll('#sliders .row').forEach((r) => r._sync());
}

async function start() {
  $('startBtn').disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS and a modern browser are required');
    initGL();
    buildSliders();
    buildEffects();
    await openCamera();
    await requestWakeLock();
    $('start').hidden = true;
    $('perf').hidden = false;
    $('shutter').disabled = false;
    fitFrame(); syncUI();
    startLoop();
  } catch (e) {
    $('startBtn').disabled = false;
    $('start').querySelector('p').textContent = 'Error: ' + (e.message || e.name);
  }
}

$('startBtn').addEventListener('click', start);
let countdown = null;
function cancelCountdown() {
  clearInterval(countdown); countdown = null;
  $('count').hidden = true; $('shutter').classList.remove('armed');
}
$('shutter').addEventListener('click', () => {
  if (countdown) return cancelCountdown();
  if (!cam.timer) return takePhoto();
  let n = cam.timer;
  $('shutter').classList.add('armed'); $('count').hidden = false; $('count').textContent = n;
  countdown = setInterval(() => {
    n--;
    if (n <= 0) { cancelCountdown(); takePhoto(); } else $('count').textContent = n;
  }, 1000);
});
document.querySelectorAll('#zoomSeg button').forEach((b) => b.addEventListener('click', () => setZoom(parseFloat(b.dataset.zoom))));
document.querySelectorAll('#camSeg button').forEach((b) => b.addEventListener('click', () => setFacing(b.dataset.cam)));
document.querySelectorAll('#arSeg button').forEach((b) => b.addEventListener('click', () => setAspect(b.dataset.ar)));
document.querySelectorAll('#timerSeg button').forEach((b) => b.addEventListener('click', () => { cam.timer = parseInt(b.dataset.t, 10); syncUI(); }));
$('panelBtn').addEventListener('click', () => { $('panel').hidden = !$('panel').hidden; $('panelBtn').classList.toggle('on', !$('panel').hidden); });
$('eco').addEventListener('change', (e) => { state.eco = e.target.checked; });
$('reset').addEventListener('click', resetSliders);

// Для автотестов
window.__filmcam = { state, cam, setZoom, setAspect, setFacing, get quality() { return quality; } };
