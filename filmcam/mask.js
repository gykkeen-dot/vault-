// FilmCam mask brush: paint where the effect applies.
// White = effect, black = original picture. Shared by the app and the Artifact preview.

export function createMask(frame, onChange) {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const fillAll = (color) => { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.fillRect(0, 0, SIZE, SIZE); };
  fillAll('#fff');

  // Tinted overlay shows the erased area while the mask tab is open
  const ov = document.createElement('canvas');
  ov.width = ov.height = 128;
  ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto';
  ov.hidden = true;
  frame.appendChild(ov);
  const octx = ov.getContext('2d', { willReadFrequently: true });

  const api = {
    canvas, version: 0, active: false, enabled: false,
    mode: 'erase',     // 'erase' | 'restore'
    tool: 'brush',     // 'brush' | 'shape'
    size: 50, opacity: 1, hardness: 0.7,
  };

  function refreshOverlay() {
    octx.clearRect(0, 0, 128, 128);
    octx.drawImage(canvas, 0, 0, 128, 128);
    const img = octx.getImageData(0, 0, 128, 128), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const m = d[i] / 255;
      d[i] = 0; d[i + 1] = 200; d[i + 2] = 255; d[i + 3] = Math.round((1 - m) * 120);
    }
    octx.putImageData(img, 0, 0);
  }

  function changed() { api.active = true; api.version++; refreshOverlay(); onChange && onChange(); }

  // Soft disc at (cx, cy), radii in CSS px, drawn in normalized mask space
  function disc(cx, cy, rx, ry) {
    const r = frame.getBoundingClientRect();
    const col = api.mode === 'erase' ? '0,0,0' : '255,255,255';
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(cx / r.width * SIZE, cy / r.height * SIZE);
    ctx.scale(SIZE / r.width, SIZE / r.height);
    ctx.scale(rx, ry);
    const inner = Math.min(api.hardness, 0.97);
    const g = ctx.createRadialGradient(0, 0, inner, 0, 0, 1);
    g.addColorStop(0, `rgba(${col},${api.opacity})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  let last = null, start = null, snap = null, drawing = false;
  const pos = (e) => { const b = frame.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  function stroke(from, to) {
    const rr = api.size / 2;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const step = Math.max(1, rr * 0.25);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) disc(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n, rr, rr);
  }

  function shape(a, b) {
    ctx.drawImage(snap, 0, 0);
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    disc(cx, cy, Math.max(2, Math.abs(b[0] - a[0]) / 2), Math.max(2, Math.abs(b[1] - a[1]) / 2));
  }

  frame.addEventListener('pointerdown', (e) => {
    if (!api.enabled) return;
    drawing = true; frame.setPointerCapture(e.pointerId);
    start = last = pos(e);
    if (api.tool === 'brush') { stroke(last, last); changed(); }
    else { snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(canvas, 0, 0); }
    e.preventDefault();
  });
  frame.addEventListener('pointermove', (e) => {
    if (!api.enabled || !drawing) return;
    const p = pos(e);
    if (api.tool === 'brush') { stroke(last, p); last = p; } else shape(start, p);
    changed();
  });
  const end = () => { drawing = false; snap = null; };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);

  api.invert = () => { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE); ctx.globalCompositeOperation = 'source-over'; changed(); };
  api.reset = () => { fillAll('#fff'); api.active = false; api.version++; refreshOverlay(); onChange && onChange(); };
  api.setEnabled = (on) => { api.enabled = on; ov.hidden = !on; frame.style.touchAction = on ? 'none' : ''; if (on) refreshOverlay(); };
  refreshOverlay();
  return api;
}
