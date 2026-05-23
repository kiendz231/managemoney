// Liquid Glass — Animated floating bubbles
// Creates ambient glass orbs that float in the background

const BUBBLE_CONFIG = [
  { size: 220, x: '8%',  y: '12%',  duration: '18s', delay: '0s',     hue: 250 },
  { size: 160, x: '78%', y: '8%',   duration: '22s', delay: '-4s',    hue: 200 },
  { size: 120, x: '65%', y: '60%',  duration: '20s', delay: '-8s',    hue: 280 },
  { size: 180, x: '20%', y: '72%',  duration: '24s', delay: '-2s',    hue: 230 },
  { size: 90,  x: '45%', y: '35%',  duration: '16s', delay: '-6s',    hue: 210 },
  { size: 140, x: '88%', y: '45%',  duration: '26s', delay: '-10s',   hue: 260 },
  { size: 70,  x: '35%', y: '85%',  duration: '14s', delay: '-3s',    hue: 190 },
  { size: 100, x: '55%', y: '15%',  duration: '19s', delay: '-7s',    hue: 240 },
];

function randomRange(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function createBubble(config) {
  const el = document.createElement('div');
  el.className = 'liquid-bubble';

  // Size
  el.style.width = `${config.size}px`;
  el.style.height = `${config.size}px`;

  // Position
  el.style.left = config.x;
  el.style.top = config.y;

  // Animation timing
  el.style.setProperty('--duration', config.duration);
  el.style.setProperty('--delay', config.delay);

  // Unique drift offsets for natural movement
  const drift = config.size * 0.4;
  el.style.setProperty('--dx1', `${randomRange(-drift, drift)}px`);
  el.style.setProperty('--dy1', `${randomRange(-drift, drift)}px`);
  el.style.setProperty('--dx2', `${randomRange(-drift, drift)}px`);
  el.style.setProperty('--dy2', `${randomRange(-drift, drift)}px`);
  el.style.setProperty('--dx3', `${randomRange(-drift, drift)}px`);
  el.style.setProperty('--dy3', `${randomRange(-drift, drift)}px`);

  // Scale variation
  el.style.setProperty('--s1', `${(0.95 + Math.random() * 0.1).toFixed(2)}`);
  el.style.setProperty('--s2', `${(0.92 + Math.random() * 0.16).toFixed(2)}`);
  el.style.setProperty('--s3', `${(0.96 + Math.random() * 0.08).toFixed(2)}`);

  // Slight per-bubble color shift via custom gradient
  const hue = config.hue;
  el.style.background = `radial-gradient(
    circle at 30% 30%,
    hsla(${hue}, 80%, 75%, 0.16),
    hsla(${hue + 30}, 70%, 60%, 0.07) 50%,
    hsla(${hue - 20}, 60%, 50%, 0.03) 80%,
    transparent
  )`;

  return el;
}

export function initLiquidGlass() {
  // Create container
  const container = document.createElement('div');
  container.className = 'liquid-glass-bg';
  container.setAttribute('aria-hidden', 'true');

  // Add bubbles
  BUBBLE_CONFIG.forEach(cfg => {
    container.appendChild(createBubble(cfg));
  });

  // Insert into #app as the first child so it sits behind everything
  const app = document.getElementById('app');
  if (app) {
    app.insertBefore(container, app.firstChild);
  }
}
