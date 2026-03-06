/**
 * NeuroCAPTCHA Behavioral Analysis Engine
 *
 * Collects and analyzes mouse dynamics, keyboard patterns, touch behavior,
 * scroll patterns, and timing signals that distinguish humans from bots.
 * Neural networks can learn to solve visual puzzles, but replicating
 * the full spectrum of human micro-behaviors is orders of magnitude harder.
 */

class BehaviorCollector {
  constructor() {
    this.mouseEvents = [];
    this.keyEvents = [];
    this.scrollEvents = [];
    this.focusChanges = 0;
    this.startTime = Date.now();
    this.lastMouseTime = 0;
    this.clickHoldStart = 0;
    this.clickHoldDurations = [];
    this.touchPressures = [];
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.screenFingerprint = this._screenFingerprint();
    this._bound = {};
    this._active = false;
  }

  start() {
    if (this._active) return;
    this._active = true;
    this.startTime = Date.now();

    this._bound.mouseMove = (e) => this._onMouseMove(e);
    this._bound.mouseDown = (e) => this._onMouseDown(e);
    this._bound.mouseUp = (e) => this._onMouseUp(e);
    this._bound.keyDown = (e) => this._onKeyDown(e);
    this._bound.scroll = (e) => this._onScroll(e);
    this._bound.focus = () => this.focusChanges++;
    this._bound.blur = () => this.focusChanges++;
    this._bound.touchMove = (e) => this._onTouchMove(e);

    document.addEventListener("mousemove", this._bound.mouseMove, { passive: true });
    document.addEventListener("mousedown", this._bound.mouseDown, { passive: true });
    document.addEventListener("mouseup", this._bound.mouseUp, { passive: true });
    document.addEventListener("keydown", this._bound.keyDown, { passive: true });
    document.addEventListener("scroll", this._bound.scroll, { passive: true });
    document.addEventListener("touchmove", this._bound.touchMove, { passive: true });
    window.addEventListener("focus", this._bound.focus);
    window.addEventListener("blur", this._bound.blur);
  }

  stop() {
    if (!this._active) return;
    this._active = false;

    document.removeEventListener("mousemove", this._bound.mouseMove);
    document.removeEventListener("mousedown", this._bound.mouseDown);
    document.removeEventListener("mouseup", this._bound.mouseUp);
    document.removeEventListener("keydown", this._bound.keyDown);
    document.removeEventListener("scroll", this._bound.scroll);
    document.removeEventListener("touchmove", this._bound.touchMove);
    window.removeEventListener("focus", this._bound.focus);
    window.removeEventListener("blur", this._bound.blur);
  }

  _onMouseMove(e) {
    const now = Date.now();
    if (now - this.lastMouseTime < 8) return; // throttle to ~120Hz
    this.lastMouseTime = now;

    this.mouseEvents.push({
      x: e.clientX,
      y: e.clientY,
      t: now - this.startTime,
    });

    if (this.mouseEvents.length > 2000) {
      this.mouseEvents = this.mouseEvents.slice(-1500);
    }
  }

  _onMouseDown(e) {
    this.clickHoldStart = Date.now();
  }

  _onMouseUp(e) {
    if (this.clickHoldStart > 0) {
      this.clickHoldDurations.push(Date.now() - this.clickHoldStart);
      this.clickHoldStart = 0;
    }
  }

  _onKeyDown(e) {
    this.keyEvents.push({ t: Date.now() - this.startTime, key: e.key.length === 1 ? "k" : e.key });
  }

  _onScroll() {
    this.scrollEvents.push(Date.now() - this.startTime);
  }

  _onTouchMove(e) {
    const touch = e.touches[0];
    if (touch) {
      const now = Date.now();
      this.mouseEvents.push({
        x: touch.clientX,
        y: touch.clientY,
        t: now - this.startTime,
      });
      if (touch.force !== undefined && touch.force > 0) {
        this.touchPressures.push(touch.force);
      }
    }
  }

  _screenFingerprint() {
    return {
      w: screen.width,
      h: screen.height,
      dpr: this.devicePixelRatio,
      colorDepth: screen.colorDepth,
      touch: navigator.maxTouchPoints > 0,
    };
  }

  getReport() {
    const avgClickHold =
      this.clickHoldDurations.length > 0
        ? this.clickHoldDurations.reduce((a, b) => a + b, 0) / this.clickHoldDurations.length
        : 0;

    return {
      mouse_events: this.mouseEvents,
      timing: {
        solve_time_ms: Date.now() - this.startTime,
        click_hold_ms: avgClickHold,
        focus_changes: this.focusChanges,
        scroll_events: this.scrollEvents.length,
      },
      meta: {
        screen: this.screenFingerprint,
        event_count: this.mouseEvents.length,
        touch_pressures: this.touchPressures.slice(0, 20),
      },
    };
  }

  reset() {
    this.mouseEvents = [];
    this.keyEvents = [];
    this.scrollEvents = [];
    this.focusChanges = 0;
    this.clickHoldStart = 0;
    this.clickHoldDurations = [];
    this.touchPressures = [];
    this.startTime = Date.now();
    this.lastMouseTime = 0;
  }
}

window.BehaviorCollector = BehaviorCollector;
