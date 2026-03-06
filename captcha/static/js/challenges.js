/**
 * NeuroCAPTCHA Challenge Modules
 *
 * 4 additional challenge types beyond the base drag puzzle:
 *
 * 1. SemanticGrid   — Find the icon that doesn't belong to the category
 * 2. RhythmTap      — Repeat a flashing beat sequence by clicking
 * 3. PathTrace      — Follow a winding path without leaving the boundaries
 * 4. ShadowRotate   — Rotate a shape to match a target silhouette
 *
 * Each challenge exposes: constructor(canvas, seed), onSolved callback, getResult()
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Shared utilities
// ═══════════════════════════════════════════════════════════════════════════════

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  if (e.touches) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SEMANTIC ANOMALY GRID
//    3x3 grid of icons from one category + 1 intruder. Click the intruder.
//    Requires common-sense categorization that confuses vision models.
// ═══════════════════════════════════════════════════════════════════════════════

const SEMANTIC_CATEGORIES = [
  {
    name: "fruits",
    members: ["apple", "banana", "grape", "cherry", "lemon", "peach", "pear", "melon", "kiwi", "mango"],
    intruders: ["hammer", "car", "sock", "key", "book", "bell", "bolt", "cup"],
    draw: {
      apple: (ctx, x, y, s) => { ctx.fillStyle="#e74c3c"; ctx.beginPath(); ctx.arc(x,y,s*0.4,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#27ae60"; ctx.fillRect(x-2,y-s*0.55,4,s*0.18); },
      banana: (ctx, x, y, s) => { ctx.strokeStyle="#f1c40f"; ctx.lineWidth=s*0.22; ctx.lineCap="round"; ctx.beginPath(); ctx.arc(x,y+s*0.1,s*0.35,Math.PI*1.2,Math.PI*1.9); ctx.stroke(); },
      grape: (ctx, x, y, s) => { ctx.fillStyle="#8e44ad"; for(let i=0;i<6;i++){const a=i*Math.PI/3; ctx.beginPath(); ctx.arc(x+Math.cos(a)*s*0.15,y+Math.sin(a)*s*0.15,s*0.16,0,Math.PI*2); ctx.fill();} ctx.beginPath();ctx.arc(x,y,s*0.16,0,Math.PI*2);ctx.fill(); },
      cherry: (ctx, x, y, s) => { ctx.fillStyle="#c0392b"; ctx.beginPath();ctx.arc(x-s*0.15,y+s*0.1,s*0.22,0,Math.PI*2);ctx.fill(); ctx.beginPath();ctx.arc(x+s*0.15,y+s*0.1,s*0.22,0,Math.PI*2);ctx.fill(); ctx.strokeStyle="#27ae60";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-s*0.1,y-s*0.1);ctx.quadraticCurveTo(x,y-s*0.45,x+s*0.1,y-s*0.1);ctx.stroke(); },
      lemon: (ctx, x, y, s) => { ctx.fillStyle="#f1c40f"; ctx.beginPath();ctx.ellipse(x,y,s*0.4,s*0.28,Math.PI*0.1,0,Math.PI*2);ctx.fill(); },
      peach: (ctx, x, y, s) => { ctx.fillStyle="#f39c12"; ctx.beginPath();ctx.arc(x,y,s*0.35,0,Math.PI*2);ctx.fill(); ctx.strokeStyle="#e67e22";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x+s*0.05,y,s*0.35,Math.PI*1.4,Math.PI*1.6);ctx.stroke(); },
      pear: (ctx, x, y, s) => { ctx.fillStyle="#a8d648"; ctx.beginPath();ctx.arc(x,y+s*0.1,s*0.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y-s*0.18,s*0.2,0,Math.PI*2);ctx.fill(); },
      melon: (ctx, x, y, s) => { ctx.fillStyle="#2ecc71"; ctx.beginPath();ctx.arc(x,y,s*0.38,0,Math.PI*2);ctx.fill(); ctx.strokeStyle="#27ae60";ctx.lineWidth=1;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x,y,s*0.38,i*Math.PI/2,(i+0.3)*Math.PI/2);ctx.stroke();} },
      kiwi: (ctx, x, y, s) => { ctx.fillStyle="#795548"; ctx.beginPath();ctx.ellipse(x,y,s*0.3,s*0.22,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#8bc34a";ctx.beginPath();ctx.ellipse(x,y,s*0.22,s*0.15,0,0,Math.PI*2);ctx.fill(); },
      mango: (ctx, x, y, s) => { ctx.fillStyle="#ff9800"; ctx.beginPath();ctx.ellipse(x,y,s*0.38,s*0.26,Math.PI*0.15,0,Math.PI*2);ctx.fill(); },
      hammer: (ctx, x, y, s) => { ctx.fillStyle="#795548";ctx.fillRect(x-s*0.06,y-s*0.1,s*0.12,s*0.5); ctx.fillStyle="#607d8b";ctx.fillRect(x-s*0.25,y-s*0.35,s*0.5,s*0.25); },
      car: (ctx, x, y, s) => { ctx.fillStyle="#3498db";ctx.fillRect(x-s*0.35,y-s*0.1,s*0.7,s*0.25);ctx.fillRect(x-s*0.2,y-s*0.3,s*0.4,s*0.22); ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.2,y+s*0.15,s*0.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.2,y+s*0.15,s*0.1,0,Math.PI*2);ctx.fill(); },
      sock: (ctx, x, y, s) => { ctx.fillStyle="#e91e63";ctx.fillRect(x-s*0.12,y-s*0.4,s*0.24,s*0.55); ctx.beginPath();ctx.arc(x+s*0.05,y+s*0.15,s*0.17,Math.PI*1.5,Math.PI*0.5);ctx.fill(); },
      key: (ctx, x, y, s) => { ctx.strokeStyle="#ffc107";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-s*0.2,s*0.18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+s*0.35);ctx.moveTo(x,y+s*0.2);ctx.lineTo(x+s*0.1,y+s*0.2);ctx.stroke(); },
      book: (ctx, x, y, s) => { ctx.fillStyle="#2196f3";ctx.fillRect(x-s*0.3,y-s*0.35,s*0.55,s*0.7);ctx.fillStyle="#1976d2";ctx.fillRect(x-s*0.3,y-s*0.35,s*0.08,s*0.7);ctx.fillStyle="#fff";ctx.fillRect(x-s*0.1,y-s*0.15,s*0.25,s*0.04);ctx.fillRect(x-s*0.1,y-s*0.05,s*0.18,s*0.04); },
      bell: (ctx, x, y, s) => { ctx.fillStyle="#ffc107";ctx.beginPath();ctx.moveTo(x-s*0.3,y+s*0.15);ctx.quadraticCurveTo(x-s*0.3,y-s*0.35,x,y-s*0.4);ctx.quadraticCurveTo(x+s*0.3,y-s*0.35,x+s*0.3,y+s*0.15);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(x,y+s*0.25,s*0.08,0,Math.PI*2);ctx.fill(); },
      bolt: (ctx, x, y, s) => { ctx.fillStyle="#607d8b";ctx.beginPath();ctx.arc(x,y,s*0.2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#455a64";ctx.beginPath();ctx.moveTo(x,y-s*0.12);for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;ctx.lineTo(x+Math.cos(a)*s*0.18,y+Math.sin(a)*s*0.18);}ctx.closePath();ctx.fill(); },
      cup: (ctx, x, y, s) => { ctx.fillStyle="#fff";ctx.fillRect(x-s*0.22,y-s*0.25,s*0.44,s*0.55);ctx.strokeStyle="#ccc";ctx.lineWidth=2;ctx.strokeRect(x-s*0.22,y-s*0.25,s*0.44,s*0.55);ctx.beginPath();ctx.arc(x+s*0.32,y,s*0.12,Math.PI*1.5,Math.PI*0.5);ctx.stroke(); },
    }
  },
  {
    name: "animals",
    members: ["fish", "bird", "cat_face", "dog_face", "rabbit", "mouse_face", "frog", "turtle", "bear", "fox"],
    intruders: ["tree", "lamp", "clock", "star_shape", "diamond", "cloud_shape", "gear", "note"],
    draw: {
      fish: (ctx, x, y, s) => { ctx.fillStyle="#42a5f5";ctx.beginPath();ctx.ellipse(x,y,s*0.38,s*0.22,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x+s*0.3,y);ctx.lineTo(x+s*0.5,y-s*0.2);ctx.lineTo(x+s*0.5,y+s*0.2);ctx.closePath();ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x-s*0.15,y-s*0.05,s*0.06,0,Math.PI*2);ctx.fill(); },
      bird: (ctx, x, y, s) => { ctx.fillStyle="#ff7043";ctx.beginPath();ctx.arc(x,y,s*0.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffcc02";ctx.beginPath();ctx.moveTo(x-s*0.25,y);ctx.lineTo(x-s*0.42,y-s*0.06);ctx.lineTo(x-s*0.42,y+s*0.06);ctx.closePath();ctx.fill();ctx.strokeStyle="#ff7043";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+s*0.1,y-s*0.2);ctx.quadraticCurveTo(x+s*0.35,y-s*0.45,x+s*0.5,y-s*0.15);ctx.stroke(); },
      cat_face: (ctx, x, y, s) => { ctx.fillStyle="#ff9800";ctx.beginPath();ctx.arc(x,y+s*0.05,s*0.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x-s*0.28,y-s*0.15);ctx.lineTo(x-s*0.18,y-s*0.42);ctx.lineTo(x-s*0.02,y-s*0.18);ctx.fill();ctx.beginPath();ctx.moveTo(x+s*0.28,y-s*0.15);ctx.lineTo(x+s*0.18,y-s*0.42);ctx.lineTo(x+s*0.02,y-s*0.18);ctx.fill();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.1,y,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.1,y,s*0.04,0,Math.PI*2);ctx.fill(); },
      dog_face: (ctx, x, y, s) => { ctx.fillStyle="#8d6e63";ctx.beginPath();ctx.arc(x,y,s*0.32,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x-s*0.3,y-s*0.1,s*0.14,s*0.22,Math.PI*0.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*0.3,y-s*0.1,s*0.14,s*0.22,-Math.PI*0.3,0,Math.PI*2);ctx.fill();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.1,y-s*0.05,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.1,y-s*0.05,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y+s*0.08,s*0.06,0,Math.PI*2);ctx.fill(); },
      rabbit: (ctx, x, y, s) => { ctx.fillStyle="#bdbdbd";ctx.beginPath();ctx.arc(x,y+s*0.1,s*0.28,0,Math.PI*2);ctx.fill();ctx.fillRect(x-s*0.08,y-s*0.5,s*0.07,s*0.4);ctx.fillRect(x+s*0.01,y-s*0.5,s*0.07,s*0.4);ctx.fillStyle="#e91e63";ctx.fillRect(x-s*0.05,y-s*0.45,s*0.02,s*0.3);ctx.fillRect(x+s*0.03,y-s*0.45,s*0.02,s*0.3);ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.08,y+s*0.05,s*0.03,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.08,y+s*0.05,s*0.03,0,Math.PI*2);ctx.fill(); },
      mouse_face: (ctx, x, y, s) => { ctx.fillStyle="#9e9e9e";ctx.beginPath();ctx.ellipse(x,y+s*0.05,s*0.25,s*0.22,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x-s*0.2,y-s*0.2,s*0.15,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.2,y-s*0.2,s*0.15,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e91e63";ctx.beginPath();ctx.arc(x-s*0.2,y-s*0.2,s*0.08,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.2,y-s*0.2,s*0.08,0,Math.PI*2);ctx.fill(); },
      frog: (ctx, x, y, s) => { ctx.fillStyle="#4caf50";ctx.beginPath();ctx.ellipse(x,y+s*0.05,s*0.35,s*0.25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#66bb6a";ctx.beginPath();ctx.arc(x-s*0.18,y-s*0.2,s*0.14,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.18,y-s*0.2,s*0.14,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x-s*0.18,y-s*0.22,s*0.08,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.18,y-s*0.22,s*0.08,0,Math.PI*2);ctx.fill();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.18,y-s*0.22,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.18,y-s*0.22,s*0.04,0,Math.PI*2);ctx.fill(); },
      turtle: (ctx, x, y, s) => { ctx.fillStyle="#4caf50";ctx.beginPath();ctx.ellipse(x,y,s*0.35,s*0.28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#388e3c";ctx.strokeStyle="#2e7d32";ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-s*0.35,y-s*0.1+i*s*0.12);ctx.lineTo(x+s*0.35,y-s*0.1+i*s*0.12);ctx.stroke();}ctx.fillStyle="#66bb6a";ctx.beginPath();ctx.arc(x+s*0.35,y,s*0.1,0,Math.PI*2);ctx.fill(); },
      bear: (ctx, x, y, s) => { ctx.fillStyle="#795548";ctx.beginPath();ctx.arc(x,y+s*0.05,s*0.32,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x-s*0.25,y-s*0.22,s*0.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.25,y-s*0.22,s*0.12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.1,y,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.1,y,s*0.04,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x,y+s*0.12,s*0.08,s*0.05,0,0,Math.PI*2);ctx.fill(); },
      fox: (ctx, x, y, s) => { ctx.fillStyle="#ff5722";ctx.beginPath();ctx.moveTo(x,y-s*0.4);ctx.lineTo(x-s*0.35,y+s*0.25);ctx.lineTo(x+s*0.35,y+s*0.25);ctx.closePath();ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(x,y+s*0.05);ctx.lineTo(x-s*0.2,y+s*0.25);ctx.lineTo(x+s*0.2,y+s*0.25);ctx.closePath();ctx.fill();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.1,y-s*0.05,s*0.03,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.1,y-s*0.05,s*0.03,0,Math.PI*2);ctx.fill(); },
      tree: (ctx, x, y, s) => { ctx.fillStyle="#795548";ctx.fillRect(x-s*0.06,y+s*0.05,s*0.12,s*0.4);ctx.fillStyle="#4caf50";ctx.beginPath();ctx.moveTo(x,y-s*0.4);ctx.lineTo(x-s*0.3,y+s*0.1);ctx.lineTo(x+s*0.3,y+s*0.1);ctx.closePath();ctx.fill(); },
      lamp: (ctx, x, y, s) => { ctx.fillStyle="#fdd835";ctx.beginPath();ctx.arc(x,y-s*0.1,s*0.22,Math.PI,0);ctx.fill();ctx.fillStyle="#fdd835";ctx.beginPath();ctx.moveTo(x-s*0.22,y-s*0.1);ctx.lineTo(x-s*0.3,y+s*0.2);ctx.lineTo(x+s*0.3,y+s*0.2);ctx.lineTo(x+s*0.22,y-s*0.1);ctx.fill();ctx.fillStyle="#9e9e9e";ctx.fillRect(x-s*0.05,y+s*0.2,s*0.1,s*0.15); },
      clock: (ctx, x, y, s) => { ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,s*0.35,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-s*0.25);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+s*0.18,y+s*0.05);ctx.stroke(); },
      star_shape: (ctx, x, y, s) => { ctx.fillStyle="#ffc107";ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const a2=a+Math.PI/5;ctx.lineTo(x+Math.cos(a)*s*0.38,y+Math.sin(a)*s*0.38);ctx.lineTo(x+Math.cos(a2)*s*0.15,y+Math.sin(a2)*s*0.15);}ctx.closePath();ctx.fill(); },
      diamond: (ctx, x, y, s) => { ctx.fillStyle="#00bcd4";ctx.beginPath();ctx.moveTo(x,y-s*0.4);ctx.lineTo(x+s*0.25,y);ctx.lineTo(x,y+s*0.4);ctx.lineTo(x-s*0.25,y);ctx.closePath();ctx.fill(); },
      cloud_shape: (ctx, x, y, s) => { ctx.fillStyle="#90a4ae";ctx.beginPath();ctx.arc(x-s*0.15,y,s*0.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.15,y,s*0.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y-s*0.12,s*0.22,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y+s*0.05,s*0.25,0,Math.PI*2);ctx.fill(); },
      gear: (ctx, x, y, s) => { ctx.fillStyle="#607d8b";ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.lineTo(x+Math.cos(a)*s*0.35,y+Math.sin(a)*s*0.35);ctx.lineTo(x+Math.cos(a+Math.PI/16)*s*0.22,y+Math.sin(a+Math.PI/16)*s*0.22);}ctx.closePath();ctx.fill();ctx.fillStyle="#455a64";ctx.beginPath();ctx.arc(x,y,s*0.1,0,Math.PI*2);ctx.fill(); },
      note: (ctx, x, y, s) => { ctx.fillStyle="#9c27b0";ctx.beginPath();ctx.ellipse(x-s*0.1,y+s*0.15,s*0.12,s*0.09,Math.PI*-0.2,0,Math.PI*2);ctx.fill();ctx.fillRect(x,y-s*0.35,s*0.04,s*0.52);ctx.fillRect(x,y-s*0.35,s*0.2,s*0.06); },
    }
  },
  {
    name: "transport",
    members: ["bus", "bicycle", "plane", "boat", "rocket", "train", "helicopter", "scooter", "truck", "taxi"],
    intruders: ["apple", "cat_face", "star_shape", "book", "bell", "cup", "gear", "note"],
    draw: {
      bus: (ctx, x, y, s) => { ctx.fillStyle="#f44336";ctx.fillRect(x-s*0.35,y-s*0.2,s*0.7,s*0.35);ctx.fillStyle="#81d4fa";ctx.fillRect(x-s*0.28,y-s*0.15,s*0.18,s*0.15);ctx.fillRect(x-s*0.05,y-s*0.15,s*0.18,s*0.15);ctx.fillRect(x+s*0.18,y-s*0.15,s*0.12,s*0.15);ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.2,y+s*0.18,s*0.08,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.2,y+s*0.18,s*0.08,0,Math.PI*2);ctx.fill(); },
      bicycle: (ctx, x, y, s) => { ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-s*0.22,y+s*0.1,s*0.15,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x+s*0.22,y+s*0.1,s*0.15,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*0.22,y+s*0.1);ctx.lineTo(x,y-s*0.1);ctx.lineTo(x+s*0.22,y+s*0.1);ctx.lineTo(x,y-s*0.1);ctx.lineTo(x-s*0.1,y-s*0.2);ctx.stroke(); },
      plane: (ctx, x, y, s) => { ctx.fillStyle="#90a4ae";ctx.beginPath();ctx.ellipse(x,y,s*0.12,s*0.4,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x,y-s*0.05);ctx.lineTo(x-s*0.45,y+s*0.15);ctx.lineTo(x-s*0.45,y+s*0.05);ctx.lineTo(x,y-s*0.05);ctx.fill();ctx.beginPath();ctx.moveTo(x,y-s*0.05);ctx.lineTo(x+s*0.45,y+s*0.15);ctx.lineTo(x+s*0.45,y+s*0.05);ctx.lineTo(x,y-s*0.05);ctx.fill(); },
      boat: (ctx, x, y, s) => { ctx.fillStyle="#5d4037";ctx.beginPath();ctx.moveTo(x-s*0.35,y+s*0.05);ctx.lineTo(x-s*0.25,y+s*0.3);ctx.lineTo(x+s*0.25,y+s*0.3);ctx.lineTo(x+s*0.35,y+s*0.05);ctx.closePath();ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(x,y+s*0.05);ctx.lineTo(x,y-s*0.35);ctx.lineTo(x+s*0.25,y);ctx.closePath();ctx.fill(); },
      rocket: (ctx, x, y, s) => { ctx.fillStyle="#e0e0e0";ctx.beginPath();ctx.moveTo(x,y-s*0.42);ctx.quadraticCurveTo(x+s*0.18,y-s*0.1,x+s*0.15,y+s*0.25);ctx.lineTo(x-s*0.15,y+s*0.25);ctx.quadraticCurveTo(x-s*0.18,y-s*0.1,x,y-s*0.42);ctx.fill();ctx.fillStyle="#f44336";ctx.beginPath();ctx.moveTo(x,y+s*0.25);ctx.lineTo(x-s*0.08,y+s*0.42);ctx.lineTo(x+s*0.08,y+s*0.42);ctx.closePath();ctx.fill(); },
      train: (ctx, x, y, s) => { ctx.fillStyle="#1565c0";ctx.fillRect(x-s*0.3,y-s*0.25,s*0.6,s*0.4);ctx.fillStyle="#bbdefb";ctx.fillRect(x-s*0.22,y-s*0.18,s*0.16,s*0.14);ctx.fillRect(x+s*0.06,y-s*0.18,s*0.16,s*0.14);ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.18,y+s*0.2,s*0.07,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.18,y+s*0.2,s*0.07,0,Math.PI*2);ctx.fill(); },
      helicopter: (ctx, x, y, s) => { ctx.fillStyle="#43a047";ctx.beginPath();ctx.ellipse(x-s*0.05,y+s*0.05,s*0.28,s*0.16,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#43a047";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+s*0.2,y+s*0.05);ctx.lineTo(x+s*0.42,y-s*0.05);ctx.stroke();ctx.strokeStyle="#666";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-s*0.4,y-s*0.18);ctx.lineTo(x+s*0.4,y-s*0.18);ctx.stroke(); },
      scooter: (ctx, x, y, s) => { ctx.fillStyle="#e91e63";ctx.beginPath();ctx.moveTo(x-s*0.1,y-s*0.15);ctx.lineTo(x+s*0.15,y-s*0.15);ctx.lineTo(x+s*0.05,y+s*0.1);ctx.lineTo(x-s*0.15,y+s*0.1);ctx.closePath();ctx.fill();ctx.strokeStyle="#333";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+s*0.05,y+s*0.1);ctx.lineTo(x+s*0.2,y+s*0.2);ctx.stroke();ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.2,y+s*0.2,s*0.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.2,y+s*0.2,s*0.1,0,Math.PI*2);ctx.fill(); },
      truck: (ctx, x, y, s) => { ctx.fillStyle="#ff9800";ctx.fillRect(x-s*0.38,y-s*0.15,s*0.45,s*0.32);ctx.fillStyle="#ffa726";ctx.fillRect(x+s*0.1,y-s*0.22,s*0.28,s*0.39);ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.2,y+s*0.2,s*0.08,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.25,y+s*0.2,s*0.08,0,Math.PI*2);ctx.fill(); },
      taxi: (ctx, x, y, s) => { ctx.fillStyle="#fdd835";ctx.fillRect(x-s*0.32,y-s*0.08,s*0.64,s*0.25);ctx.fillRect(x-s*0.18,y-s*0.28,s*0.36,s*0.22);ctx.fillStyle="#333";ctx.beginPath();ctx.arc(x-s*0.18,y+s*0.2,s*0.07,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*0.18,y+s*0.2,s*0.07,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f44336";ctx.fillRect(x-s*0.06,y-s*0.35,s*0.12,s*0.07); },
    }
  }
];

// Merge all draw functions from all categories into one lookup
const ALL_DRAWS = {};
SEMANTIC_CATEGORIES.forEach(cat => {
  Object.assign(ALL_DRAWS, cat.draw);
});

class SemanticGrid {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rng = mulberry32(seed);
    this.solved = false;
    this.onSolved = null;
    this.clickTimes = [];
    this.wrongClicks = 0;

    this._init();
  }

  _init() {
    const catIdx = Math.floor(this.rng() * SEMANTIC_CATEGORIES.length);
    this.category = SEMANTIC_CATEGORIES[catIdx];

    const members = shuffle([...this.category.members], this.rng).slice(0, 8);
    const intruderIdx = Math.floor(this.rng() * this.category.intruders.length);
    this.intruderName = this.category.intruders[intruderIdx];
    this.correctIndex = Math.floor(this.rng() * 9);

    this.grid = [];
    let mi = 0;
    for (let i = 0; i < 9; i++) {
      if (i === this.correctIndex) {
        this.grid.push(this.intruderName);
      } else {
        this.grid.push(members[mi++]);
      }
    }

    this._addNoise();
    this.render();
    this._bindEvents();
  }

  _addNoise() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.noiseCanvas = document.createElement("canvas");
    this.noiseCanvas.width = w;
    this.noiseCanvas.height = h;
    const nctx = this.noiseCanvas.getContext("2d");
    const imgData = nctx.createImageData(w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(this.rng() * 15);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = Math.floor(this.rng() * 20);
    }
    nctx.putImageData(imgData, 0, 0);
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#16213e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.noiseCanvas, 0, 0);

    const cellW = w / 3;
    const cellH = h / 3;

    for (let i = 0; i < 9; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);

      if (this.solved && i === this.correctIndex) {
        ctx.fillStyle = "rgba(0,214,143,0.15)";
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
        ctx.strokeStyle = "rgba(0,214,143,0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(col * cellW + 2, row * cellH + 2, cellW - 4, cellH - 4);
      }

      if (this.highlightWrong === i) {
        ctx.fillStyle = "rgba(255,107,107,0.2)";
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      }

      const drawFn = ALL_DRAWS[this.grid[i]];
      if (drawFn) {
        ctx.save();
        const iconSize = Math.min(cellW, cellH) * 0.8;
        drawFn(ctx, cx, cy, iconSize);
        ctx.restore();
      }
    }
  }

  _bindEvents() {
    const handler = (e) => {
      if (this.solved) return;
      const pos = getCanvasPos(this.canvas, e);
      const cellW = this.canvas.width / 3;
      const cellH = this.canvas.height / 3;
      const col = Math.floor(pos.x / cellW);
      const row = Math.floor(pos.y / cellH);
      const idx = row * 3 + col;

      this.clickTimes.push(Date.now());

      if (idx === this.correctIndex) {
        this.solved = true;
        this.render();
        if (this.onSolved) this.onSolved(this.getResult());
      } else {
        this.wrongClicks++;
        this.highlightWrong = idx;
        this.render();
        setTimeout(() => {
          this.highlightWrong = -1;
          this.render();
        }, 300);
      }
    };

    this.canvas.addEventListener("click", handler);
    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      handler(e);
    });
  }

  getResult() {
    return {
      type: "semantic",
      accuracy: this.solved ? 1.0 : 0.0,
      wrong_clicks: this.wrongClicks,
      click_count: this.clickTimes.length,
      path_efficiency: this.wrongClicks === 0 ? 1.0 : 1.0 / (1 + this.wrongClicks),
      overshoot_count: this.wrongClicks,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. RHYTHM TAP CHALLENGE
//    A sequence of beats flashes on screen. User must repeat the rhythm
//    by clicking. Temporal precision is analyzed — bots either replay
//    perfectly (suspicious) or have no sense of rhythm.
// ═══════════════════════════════════════════════════════════════════════════════

class RhythmTap {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rng = mulberry32(seed);
    this.solved = false;
    this.onSolved = null;

    this.beatCount = 4 + Math.floor(this.rng() * 3); // 4-6 beats
    this.beatIntervals = [];
    this.userTaps = [];
    this.phase = "showing"; // showing | waiting | tapping
    this.currentBeat = 0;
    this.showStartTime = 0;
    this.tapStartTime = 0;
    this.animFrame = null;

    this._generateBeats();
    this._init();
  }

  _generateBeats() {
    for (let i = 0; i < this.beatCount - 1; i++) {
      this.beatIntervals.push(300 + Math.floor(this.rng() * 500));
    }
    this.totalDuration = this.beatIntervals.reduce((a, b) => a + b, 0);
  }

  _init() {
    this.render();
    setTimeout(() => this._playSequence(), 600);
    this._bindEvents();
  }

  _playSequence() {
    this.phase = "showing";
    this.currentBeat = 0;
    this.showStartTime = Date.now();
    this._showNextBeat();
  }

  _showNextBeat() {
    if (this.currentBeat >= this.beatCount) {
      setTimeout(() => {
        this.phase = "waiting";
        this.render();
        setTimeout(() => {
          this.phase = "tapping";
          this.tapStartTime = 0;
          this.userTaps = [];
          this.currentBeat = 0;
          this.render();
        }, 500);
      }, 400);
      return;
    }

    this._flashBeat(this.currentBeat);
    this.currentBeat++;

    if (this.currentBeat < this.beatCount) {
      setTimeout(() => this._showNextBeat(), this.beatIntervals[this.currentBeat - 1]);
    } else {
      setTimeout(() => this._showNextBeat(), 400);
    }
  }

  _flashBeat(idx) {
    this.activeFlash = idx;
    this.render();
    setTimeout(() => {
      this.activeFlash = -1;
      this.render();
    }, 150);
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0f0c29");
    grad.addColorStop(0.5, "#1a1a3e");
    grad.addColorStop(1, "#0f0c29");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const centerY = h * 0.45;
    const dotSpacing = w / (this.beatCount + 1);

    for (let i = 0; i < this.beatCount; i++) {
      const dx = dotSpacing * (i + 1);
      const isActive = this.activeFlash === i;
      const isHit = this.phase === "tapping" && i < this.userTaps.length;

      ctx.beginPath();
      ctx.arc(dx, centerY, isActive ? 22 : 16, 0, Math.PI * 2);

      if (isActive) {
        ctx.fillStyle = "#6c5ce7";
        ctx.shadowColor = "#6c5ce7";
        ctx.shadowBlur = 25;
      } else if (isHit) {
        ctx.fillStyle = "#00d68f";
        ctx.shadowColor = "#00d68f";
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!isActive && !isHit) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";

    if (this.phase === "showing") {
      ctx.fillText("Watch the rhythm...", w / 2, h * 0.82);
    } else if (this.phase === "waiting") {
      ctx.fillText("Get ready...", w / 2, h * 0.82);
    } else if (this.phase === "tapping") {
      ctx.fillStyle = "#6c5ce7";
      ctx.font = "bold 14px Inter, system-ui, sans-serif";
      ctx.fillText("Now tap the same rhythm!", w / 2, h * 0.82);

      ctx.fillStyle = "rgba(108,92,231,0.08)";
      ctx.fillRect(0, h * 0.88, w, h * 0.12);
      ctx.fillStyle = "rgba(108,92,231,0.5)";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText("Click anywhere or press Space", w / 2, h * 0.95);
    }
  }

  _bindEvents() {
    const tap = () => {
      if (this.phase !== "tapping" || this.solved) return;

      const now = Date.now();
      if (this.tapStartTime === 0) this.tapStartTime = now;

      this.userTaps.push(now - this.tapStartTime);
      this.currentBeat = this.userTaps.length;

      this._flashBeat(this.userTaps.length - 1);

      if (this.userTaps.length >= this.beatCount) {
        this.solved = true;
        setTimeout(() => {
          if (this.onSolved) this.onSolved(this.getResult());
        }, 300);
      }
    };

    this.canvas.addEventListener("click", tap);
    this.canvas.addEventListener("touchend", (e) => { e.preventDefault(); tap(); });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); tap(); }
    });
  }

  getResult() {
    const userIntervals = [];
    for (let i = 1; i < this.userTaps.length; i++) {
      userIntervals.push(this.userTaps[i] - this.userTaps[i - 1]);
    }

    let totalError = 0;
    let perfectCount = 0;
    const minIntervals = Math.min(userIntervals.length, this.beatIntervals.length);

    for (let i = 0; i < minIntervals; i++) {
      const error = Math.abs(userIntervals[i] - this.beatIntervals[i]);
      totalError += error;
      if (error < 5) perfectCount++;
    }

    const avgError = minIntervals > 0 ? totalError / minIntervals : 9999;
    const accuracy = Math.max(0, 1 - avgError / 500);
    const suspiciouslyPerfect = perfectCount === minIntervals && minIntervals > 2;

    return {
      type: "rhythm",
      accuracy: Math.round(accuracy * 1000) / 1000,
      avg_error_ms: Math.round(avgError),
      path_efficiency: suspiciouslyPerfect ? 0.99 : Math.max(0.3, accuracy),
      overshoot_count: suspiciouslyPerfect ? 0 : Math.max(1, Math.floor((1 - accuracy) * 5)),
      suspiciously_perfect: suspiciouslyPerfect,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. PATH TRACE
//    A winding path is drawn. User must trace it with their cursor staying
//    within tolerance. Tests fine motor control and produces rich behavioral
//    data. Bots produce unnaturally smooth or jittery paths.
// ═══════════════════════════════════════════════════════════════════════════════

class PathTrace {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rng = mulberry32(seed);
    this.solved = false;
    this.onSolved = null;
    this.tracing = false;
    this.tracePath = [];
    this.progress = 0;
    this.tolerance = 25;
    this.deviations = 0;
    this.totalDistance = 0;

    this._generatePath();
    this.render();
    this._bindEvents();
  }

  _generatePath() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const points = [];
    const segments = 6 + Math.floor(this.rng() * 4);

    points.push({ x: 30, y: h / 2 + (this.rng() - 0.5) * h * 0.4 });

    for (let i = 1; i <= segments; i++) {
      const progress = i / segments;
      const x = 30 + (w - 60) * progress;
      const y = h * 0.2 + this.rng() * h * 0.6;
      points.push({ x, y });
    }

    this.pathPoints = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2 + (this.rng() - 0.5) * 50;
      const cy = (p1.y + p2.y) / 2 + (this.rng() - 0.5) * 60;

      for (let t = 0; t <= 1; t += 0.02) {
        const u = 1 - t;
        const px = u * u * p1.x + 2 * u * t * cx + t * t * p2.x;
        const py = u * u * p1.y + 2 * u * t * cy + t * t * p2.y;
        this.pathPoints.push({ x: px, y: py });
      }
    }

    for (let i = 1; i < this.pathPoints.length; i++) {
      const dx = this.pathPoints[i].x - this.pathPoints[i - 1].x;
      const dy = this.pathPoints[i].y - this.pathPoints[i - 1].y;
      this.totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    this.startZone = this.pathPoints[0];
    this.endZone = this.pathPoints[this.pathPoints.length - 1];
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(1, "#16213e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw path background (tolerance zone)
    ctx.strokeStyle = "rgba(108,92,231,0.12)";
    ctx.lineWidth = this.tolerance * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    this.pathPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Draw path center line
    ctx.strokeStyle = "rgba(108,92,231,0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    this.pathPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw traced portion
    if (this.tracePath.length > 1) {
      ctx.strokeStyle = "#00d68f";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00d68f";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      this.tracePath.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Start circle
    ctx.beginPath();
    ctx.arc(this.startZone.x, this.startZone.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = this.tracing ? "rgba(0,214,143,0.6)" : "rgba(108,92,231,0.6)";
    ctx.fill();
    ctx.strokeStyle = this.tracing ? "#00d68f" : "#6c5ce7";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!this.tracing && !this.solved) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("START", this.startZone.x, this.startZone.y + 3);
    }

    // End circle
    ctx.beginPath();
    ctx.arc(this.endZone.x, this.endZone.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = this.solved ? "rgba(0,214,143,0.8)" : "rgba(255,255,255,0.1)";
    ctx.fill();
    ctx.strokeStyle = this.solved ? "#00d68f" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!this.solved) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("END", this.endZone.x, this.endZone.y + 3);
    }

    // Progress
    if (this.tracing) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(this.progress * 100)}%`, w / 2, h - 8);
    }

    if (!this.tracing && !this.solved) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click START and trace the path to END", w / 2, h - 8);
    }
  }

  _findClosestPoint(x, y) {
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < this.pathPoints.length; i++) {
      const dx = x - this.pathPoints[i].x;
      const dy = y - this.pathPoints[i].y;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    return { index: closestIdx, distance: Math.sqrt(minDist) };
  }

  _bindEvents() {
    const onDown = (e) => {
      if (this.solved) return;
      const pos = getCanvasPos(this.canvas, e);
      const dx = pos.x - this.startZone.x;
      const dy = pos.y - this.startZone.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        this.tracing = true;
        this.tracePath = [pos];
        this.render();
        e.preventDefault();
      }
    };

    const onMove = (e) => {
      if (!this.tracing || this.solved) return;
      const pos = getCanvasPos(this.canvas, e);
      this.tracePath.push(pos);

      const closest = this._findClosestPoint(pos.x, pos.y);
      this.progress = closest.index / (this.pathPoints.length - 1);

      if (closest.distance > this.tolerance) {
        this.deviations++;
      }

      // Check if reached end
      const dx = pos.x - this.endZone.x;
      const dy = pos.y - this.endZone.y;
      if (Math.sqrt(dx * dx + dy * dy) < 18 && this.progress > 0.85) {
        this.solved = true;
        this.tracing = false;
        this.render();
        if (this.onSolved) this.onSolved(this.getResult());
        return;
      }

      this.render();
      e.preventDefault();
    };

    const onUp = () => {
      if (this.tracing && !this.solved) {
        this.tracing = false;
        this.tracePath = [];
        this.progress = 0;
        this.render();
      }
    };

    this.canvas.addEventListener("mousedown", onDown);
    this.canvas.addEventListener("mousemove", onMove);
    this.canvas.addEventListener("mouseup", onUp);
    this.canvas.addEventListener("mouseleave", onUp);
    this.canvas.addEventListener("touchstart", onDown, { passive: false });
    this.canvas.addEventListener("touchmove", onMove, { passive: false });
    this.canvas.addEventListener("touchend", onUp);
  }

  getResult() {
    let traceDist = 0;
    for (let i = 1; i < this.tracePath.length; i++) {
      const dx = this.tracePath[i].x - this.tracePath[i - 1].x;
      const dy = this.tracePath[i].y - this.tracePath[i - 1].y;
      traceDist += Math.sqrt(dx * dx + dy * dy);
    }

    const efficiency = this.totalDistance > 0 ? this.totalDistance / Math.max(traceDist, 1) : 0;
    const deviationRatio = this.tracePath.length > 0 ? this.deviations / this.tracePath.length : 1;
    const accuracy = Math.max(0, 1 - deviationRatio * 3);

    return {
      type: "path",
      accuracy: Math.round(accuracy * 1000) / 1000,
      path_efficiency: Math.round(Math.min(efficiency, 1) * 1000) / 1000,
      overshoot_count: this.deviations,
      trace_points: this.tracePath.length,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. SHADOW ROTATION
//    A 2D shape is shown at a random rotation. User must rotate it (by
//    dragging) to match the target silhouette. Tests spatial reasoning
//    and produces continuous interaction data.
// ═══════════════════════════════════════════════════════════════════════════════

class ShadowRotate {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rng = mulberry32(seed);
    this.solved = false;
    this.onSolved = null;
    this.rotateHistory = [];

    this.targetAngle = (this.rng() * Math.PI * 2);
    this.currentAngle = this.targetAngle + Math.PI * 0.5 + this.rng() * Math.PI;
    if (this.currentAngle > Math.PI * 2) this.currentAngle -= Math.PI * 2;
    this.lastMouseX = 0;
    this.rotating = false;

    this.shapeType = Math.floor(this.rng() * 4);
    this.shapeVertices = this._generateShape();

    this.render();
    this._bindEvents();
  }

  _generateShape() {
    const verts = [];
    const count = 5 + Math.floor(this.rng() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 0.5 + this.rng() * 0.5;
      verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
  }

  _drawShape(ctx, cx, cy, size, angle, style) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.beginPath();
    this.shapeVertices.forEach((v, i) => {
      const px = v.x * size;
      const py = v.y * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    if (style === "target") {
      ctx.fillStyle = "rgba(108,92,231,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(108,92,231,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (style === "piece") {
      const grad = ctx.createLinearGradient(-size, -size, size, size);
      grad.addColorStop(0, "#6c5ce7");
      grad.addColorStop(1, "#a29bfe");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(0, -size * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === "success") {
      ctx.fillStyle = "rgba(0,214,143,0.4)";
      ctx.fill();
      ctx.strokeStyle = "#00d68f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0d1117");
    grad.addColorStop(1, "#161b22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 20) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 20) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    const shapeSize = Math.min(w, h) * 0.28;
    const leftCx = w * 0.3;
    const rightCx = w * 0.7;
    const cy = h * 0.45;

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TARGET", leftCx, h * 0.1);
    ctx.fillText("ROTATE THIS", rightCx, h * 0.1);

    // Target shape (static)
    this._drawShape(ctx, leftCx, cy, shapeSize, this.targetAngle, "target");

    // User shape (rotatable)
    if (this.solved) {
      this._drawShape(ctx, rightCx, cy, shapeSize, this.currentAngle, "success");
    } else {
      this._drawShape(ctx, rightCx, cy, shapeSize, this.currentAngle, "piece");
    }

    // Angle difference indicator
    const angleDiff = this._angleDiff();
    const matchPercent = Math.max(0, 1 - angleDiff / Math.PI) * 100;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";

    if (this.solved) {
      ctx.fillStyle = "#00d68f";
      ctx.fillText("Matched!", w / 2, h * 0.88);
    } else {
      ctx.fillText(`Match: ${Math.round(matchPercent)}%`, w / 2, h * 0.88);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillText("Drag left/right on the shape to rotate", w / 2, h * 0.95);
    }

    // Match indicator bar
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(w * 0.2, h * 0.8, w * 0.6, 4);
    const barColor = matchPercent > 90 ? "#00d68f" : matchPercent > 50 ? "#ffc107" : "#6c5ce7";
    ctx.fillStyle = barColor;
    ctx.fillRect(w * 0.2, h * 0.8, w * 0.6 * (matchPercent / 100), 4);
  }

  _angleDiff() {
    let diff = Math.abs(this.currentAngle - this.targetAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  }

  _bindEvents() {
    const onDown = (e) => {
      if (this.solved) return;
      const pos = getCanvasPos(this.canvas, e);
      this.rotating = true;
      this.lastMouseX = pos.x;
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!this.rotating || this.solved) return;
      const pos = getCanvasPos(this.canvas, e);
      const dx = pos.x - this.lastMouseX;
      this.currentAngle += dx * 0.015;
      this.lastMouseX = pos.x;

      this.rotateHistory.push({ angle: this.currentAngle, t: Date.now() });

      if (this._angleDiff() < 0.12) {
        this.solved = true;
        this.rotating = false;
        this.currentAngle = this.targetAngle;
        this.render();
        if (this.onSolved) this.onSolved(this.getResult());
        return;
      }

      this.render();
      e.preventDefault();
    };

    const onUp = () => { this.rotating = false; };

    this.canvas.addEventListener("mousedown", onDown);
    this.canvas.addEventListener("mousemove", onMove);
    this.canvas.addEventListener("mouseup", onUp);
    this.canvas.addEventListener("mouseleave", onUp);
    this.canvas.addEventListener("touchstart", onDown, { passive: false });
    this.canvas.addEventListener("touchmove", onMove, { passive: false });
    this.canvas.addEventListener("touchend", onUp);
  }

  getResult() {
    const angleDiff = this._angleDiff();
    const accuracy = Math.max(0, 1 - angleDiff / 0.15);

    let directionChanges = 0;
    for (let i = 2; i < this.rotateHistory.length; i++) {
      const d1 = this.rotateHistory[i].angle - this.rotateHistory[i - 1].angle;
      const d2 = this.rotateHistory[i - 1].angle - this.rotateHistory[i - 2].angle;
      if (d1 * d2 < 0) directionChanges++;
    }

    return {
      type: "shadow",
      accuracy: Math.round(accuracy * 1000) / 1000,
      path_efficiency: this.rotateHistory.length > 0
        ? Math.round(Math.min(1, 20 / this.rotateHistory.length) * 1000) / 1000
        : 0,
      overshoot_count: directionChanges,
      rotation_samples: this.rotateHistory.length,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════════

window.SemanticGrid = SemanticGrid;
window.RhythmTap = RhythmTap;
window.PathTrace = PathTrace;
window.ShadowRotate = ShadowRotate;
