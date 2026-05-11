import * as THREE from "three";

const make = (size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const makeData = (size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) => {
  const tex = make(size, draw);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
};

// ── Yellow stained wallpaper — the iconic backrooms wall ─────────────────────
export const wallpaperColor = make(512, (ctx, s) => {
  // Base yellow gradient (slightly uneven across panel)
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#d4b54a");
  grad.addColorStop(0.5, "#c9a73a");
  grad.addColorStop(1, "#b89530");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Vertical wallpaper stripes (very faint, period ~32px)
  ctx.globalCompositeOperation = "multiply";
  for (let x = 0; x < s; x += 16) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + ((x / 16) % 2) * 0.05})`;
    ctx.fillRect(x, 0, 8, s);
  }
  ctx.globalCompositeOperation = "source-over";

  // Speckle / fiber noise so it isn't flat
  for (let i = 0; i < s * s * 0.35; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const v = Math.random();
    ctx.fillStyle = `rgba(${v < 0.5 ? "60,40,10" : "240,220,150"},${0.04 + Math.random() * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Brown stains and water marks
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 30 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(80,50,15,${0.18 + Math.random() * 0.18})`);
    g.addColorStop(0.6, "rgba(80,50,15,0.07)");
    g.addColorStop(1, "rgba(80,50,15,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    // Irregular stain shape via random radii
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const rr = r * (0.6 + Math.random() * 0.5);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Horizontal wallpaper seam every 256px (panels)
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, s / 2 + 0.5); ctx.lineTo(s, s / 2 + 0.5); ctx.stroke();
});

export const wallpaperNormal = makeData(512, (ctx, s) => {
  // Neutral normal (128,128,255)
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, s, s);
  // Faint horizontal seam at y = s/2
  const g = ctx.createLinearGradient(0, s / 2 - 4, 0, s / 2 + 4);
  g.addColorStop(0, "#8080ff");
  g.addColorStop(0.5, "#a070ff");
  g.addColorStop(1, "#8080ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, s / 2 - 4, s, 8);
  // Vertical light corrugation
  for (let x = 0; x < s; x += 16) {
    ctx.fillStyle = "rgba(160,128,255,0.25)";
    ctx.fillRect(x, 0, 1, s);
    ctx.fillStyle = "rgba(96,128,255,0.25)";
    ctx.fillRect(x + 8, 0, 1, s);
  }
});

// ── Damp brown carpet — short pile with subtle pattern ────────────────────────
export const carpetColor = make(512, (ctx, s) => {
  // Base brown
  ctx.fillStyle = "#3a2a18";
  ctx.fillRect(0, 0, s, s);
  // Pile noise
  for (let i = 0; i < s * s * 1.4; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const v = Math.random();
    const c = v < 0.5
      ? `rgba(80,55,30,${0.4 + v})`
      : `rgba(20,12,5,${0.3 + v * 0.4})`;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  // Damp darker patches
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 40 + Math.random() * 100;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
});

export const carpetNormal = makeData(512, (ctx, s) => {
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < s * s * 0.8; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 100 + Math.random() * 80;
    const g = 100 + Math.random() * 80;
    ctx.fillStyle = `rgba(${r},${g},255,0.6)`;
    ctx.fillRect(x, y, 1, 1);
  }
});

// ── Drop ceiling — white acoustic tile with metal grid ───────────────────────
export const ceilingColor = make(512, (ctx, s) => {
  // Tile body
  ctx.fillStyle = "#e9e6d8";
  ctx.fillRect(0, 0, s, s);
  // Pinhole acoustic pattern
  for (let i = 0; i < s * s * 0.25; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    ctx.fillStyle = `rgba(60,55,45,${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1, 1);
  }
  // Stains
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 30 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(120,90,40,0.25)");
    g.addColorStop(1, "rgba(120,90,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Metal T-grid (one tile = the whole texture; grid runs along edges)
  ctx.strokeStyle = "#9a958a";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, s - 8, s - 8);
  ctx.strokeStyle = "#74716a";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, s - 8, s - 8);
});

export const ceilingNormal = makeData(512, (ctx, s) => {
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, s, s);
  // Grid edges as raised
  ctx.fillStyle = "#a0a0ff";
  ctx.fillRect(0, 0, s, 8);
  ctx.fillRect(0, s - 8, s, 8);
  ctx.fillRect(0, 0, 8, s);
  ctx.fillRect(s - 8, 0, 8, s);
});

// ── Baseboard / trim ─────────────────────────────────────────────────────────
export const baseboardColor = make(256, (ctx, s) => {
  ctx.fillStyle = "#5b4220";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < s * s * 0.3; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
    ctx.fillRect(x, y, 1, 1);
  }
});
