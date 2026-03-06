/**
 * NeuroCAPTCHA Puzzle Engine
 *
 * Generates physics-based drag puzzles with adversarial visual noise.
 * The puzzle piece must be dragged to the correct slot, but the path
 * is analyzed for human-like characteristics (overshoots, corrections,
 * non-linear trajectories).
 */

class PuzzleEngine {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.seed = seed;
    this.rng = this._mulberry32(seed);
    this.solved = false;
    this.dragPath = [];
    this.overshootCount = 0;

    this.slotX = 0;
    this.slotY = 0;
    this.pieceX = 0;
    this.pieceY = 0;
    this.pieceSize = 50;
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.startDragTime = 0;
    this.wasNearSlot = false;

    this._init();
  }

  _mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _init() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ps = this.pieceSize;

    this.slotX = Math.floor(this.rng() * (w - ps - 80)) + 40;
    this.slotY = Math.floor(this.rng() * (h - ps - 80)) + 40;

    let px, py;
    do {
      px = Math.floor(this.rng() * (w - ps - 20)) + 10;
      py = Math.floor(this.rng() * (h - ps - 20)) + 10;
    } while (Math.abs(px - this.slotX) < 100 && Math.abs(py - this.slotY) < 100);

    this.pieceX = px;
    this.pieceY = py;

    this.bgPattern = this._generateBackground();
    this.puzzleShape = this._generatePuzzleShape();

    this._bindEvents();
    this.render();
  }

  _generateBackground() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, w, h);
    const hue1 = Math.floor(this.rng() * 360);
    const hue2 = (hue1 + 40 + Math.floor(this.rng() * 60)) % 360;
    grad.addColorStop(0, `hsl(${hue1}, 60%, 25%)`);
    grad.addColorStop(0.5, `hsl(${(hue1 + hue2) / 2}, 50%, 20%)`);
    grad.addColorStop(1, `hsl(${hue2}, 60%, 25%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 15; i++) {
      const cx = this.rng() * w;
      const cy = this.rng() * h;
      const r = 20 + this.rng() * 60;
      const shapeHue = Math.floor(this.rng() * 360);
      ctx.beginPath();
      const sides = 3 + Math.floor(this.rng() * 5);
      for (let s = 0; s < sides; s++) {
        const angle = (s / sides) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * r;
        const sy = cy + Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = `hsla(${shapeHue}, 50%, 40%, 0.3)`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${shapeHue}, 60%, 60%, 0.2)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let i = 0; i < 200; i++) {
      const nx = this.rng() * w;
      const ny = this.rng() * h;
      const na = 0.05 + this.rng() * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${na})`;
      ctx.fillRect(nx, ny, 1 + this.rng() * 2, 1 + this.rng() * 2);
    }

    return offscreen;
  }

  _generatePuzzleShape() {
    const ps = this.pieceSize;
    const knobSize = ps * 0.2;
    return { ps, knobSize };
  }

  _drawPuzzlePiece(ctx, x, y, isShadow) {
    const { ps, knobSize } = this.puzzleShape;
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ps * 0.35, y);
    ctx.arc(x + ps * 0.5, y - knobSize * 0.3, knobSize, Math.PI * 0.8, Math.PI * 0.2);
    ctx.lineTo(x + ps, y);
    ctx.lineTo(x + ps, y + ps * 0.35);
    ctx.arc(x + ps + knobSize * 0.3, y + ps * 0.5, knobSize, Math.PI * 1.3, Math.PI * 0.7);
    ctx.lineTo(x + ps, y + ps);
    ctx.lineTo(x, y + ps);
    ctx.closePath();

    if (isShadow) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.clip();
      ctx.drawImage(this.bgPattern, -this.slotX + x, -this.slotY + y, this.canvas.width, this.canvas.height);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ps * 0.35, y);
      ctx.arc(x + ps * 0.5, y - knobSize * 0.3, knobSize, Math.PI * 0.8, Math.PI * 0.2);
      ctx.lineTo(x + ps, y);
      ctx.lineTo(x + ps, y + ps * 0.35);
      ctx.arc(x + ps + knobSize * 0.3, y + ps * 0.5, knobSize, Math.PI * 1.3, Math.PI * 0.7);
      ctx.lineTo(x + ps, y + ps);
      ctx.lineTo(x, y + ps);
      ctx.closePath();

      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.bgPattern, 0, 0);

    this._drawPuzzlePiece(ctx, this.slotX, this.slotY, true);

    if (!this.solved) {
      this._drawPuzzlePiece(ctx, this.pieceX, this.pieceY, false);
    } else {
      this._drawPuzzlePiece(ctx, this.slotX, this.slotY, false);
    }
  }

  _bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
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
    };

    const onStart = (e) => {
      if (this.solved) return;
      const pos = getPos(e);
      const ps = this.pieceSize;
      if (
        pos.x >= this.pieceX &&
        pos.x <= this.pieceX + ps + 15 &&
        pos.y >= this.pieceY - 15 &&
        pos.y <= this.pieceY + ps + 15
      ) {
        this.dragging = true;
        this.dragOffsetX = pos.x - this.pieceX;
        this.dragOffsetY = pos.y - this.pieceY;
        this.startDragTime = Date.now();
        this.dragPath = [{ x: pos.x, y: pos.y, t: 0 }];
        this.wasNearSlot = false;
        e.preventDefault();
      }
    };

    const onMove = (e) => {
      if (!this.dragging) return;
      const pos = getPos(e);
      this.pieceX = pos.x - this.dragOffsetX;
      this.pieceY = pos.y - this.dragOffsetY;

      this.dragPath.push({
        x: pos.x,
        y: pos.y,
        t: Date.now() - this.startDragTime,
      });

      const dist = Math.sqrt(
        (this.pieceX - this.slotX) ** 2 + (this.pieceY - this.slotY) ** 2
      );

      if (dist < 20 && !this.wasNearSlot) {
        this.wasNearSlot = true;
      } else if (dist > 40 && this.wasNearSlot) {
        this.overshootCount++;
        this.wasNearSlot = false;
      }

      this.render();
      e.preventDefault();
    };

    const onEnd = (e) => {
      if (!this.dragging) return;
      this.dragging = false;

      const dist = Math.sqrt(
        (this.pieceX - this.slotX) ** 2 + (this.pieceY - this.slotY) ** 2
      );

      if (dist < 15) {
        this.solved = true;
        this.pieceX = this.slotX;
        this.pieceY = this.slotY;
        this.render();
        this._onSolve();
      }
    };

    this.canvas.addEventListener("mousedown", onStart);
    this.canvas.addEventListener("mousemove", onMove);
    this.canvas.addEventListener("mouseup", onEnd);
    this.canvas.addEventListener("mouseleave", onEnd);
    this.canvas.addEventListener("touchstart", onStart, { passive: false });
    this.canvas.addEventListener("touchmove", onMove, { passive: false });
    this.canvas.addEventListener("touchend", onEnd);
  }

  _onSolve() {
    if (this.onSolved) this.onSolved(this.getResult());
  }

  getResult() {
    if (this.dragPath.length < 2) {
      return { accuracy: 0, path_efficiency: 0, overshoot_count: 0 };
    }

    const totalDist = this.dragPath.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const dx = p.x - this.dragPath[i - 1].x;
      const dy = p.y - this.dragPath[i - 1].y;
      return acc + Math.sqrt(dx * dx + dy * dy);
    }, 0);

    const directDist = Math.sqrt(
      (this.dragPath[this.dragPath.length - 1].x - this.dragPath[0].x) ** 2 +
        (this.dragPath[this.dragPath.length - 1].y - this.dragPath[0].y) ** 2
    );

    const efficiency = directDist > 0 ? directDist / Math.max(totalDist, 1) : 0;

    const finalDist = Math.sqrt(
      (this.pieceX - this.slotX) ** 2 + (this.pieceY - this.slotY) ** 2
    );
    const accuracy = Math.max(0, 1 - finalDist / 50);

    return {
      accuracy: Math.round(accuracy * 1000) / 1000,
      path_efficiency: Math.round(efficiency * 1000) / 1000,
      overshoot_count: this.overshootCount,
    };
  }
}

window.PuzzleEngine = PuzzleEngine;
