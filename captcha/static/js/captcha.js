/**
 * NeuroCAPTCHA Main Controller
 * Orchestrates the full verification pipeline: challenge request, behavioral
 * collection, puzzle interaction, proof-of-work, and server verification.
 */

class NeuroCaptcha {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);

    this.state = "idle"; // idle | loading | active | solving_pow | verifying | success | fail
    this.challenge = null;
    this.behavior = new BehaviorCollector();
    this.puzzle = null;
    this.onVerified = null;
    this._retryCount = 0;

    this._buildUI();
    this._bindTrigger();
  }

  _buildUI() {
    this.container.innerHTML = "";
    this.container.classList.add("nc-container");

    this.widget = document.createElement("div");
    this.widget.className = "nc-widget";

    this.trigger = document.createElement("div");
    this.trigger.className = "nc-trigger";
    this.trigger.innerHTML = `
      <div class="nc-checkbox-wrap">
        <div class="nc-checkbox">
          <svg class="nc-check-icon" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="nc-spinner"></div>
        </div>
      </div>
      <span class="nc-label">I am human</span>
      <div class="nc-brand">
        <svg class="nc-shield" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="currentColor" opacity="0.1"/>
        </svg>
        <span>NeuroCAPTCHA</span>
      </div>
    `;

    this.challengePanel = document.createElement("div");
    this.challengePanel.className = "nc-challenge-panel";
    this.challengePanel.innerHTML = `
      <div class="nc-challenge-header">
        <span class="nc-challenge-title">Drag the puzzle piece to its position</span>
        <button class="nc-refresh-btn" title="New challenge">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="nc-canvas-wrap">
        <canvas class="nc-canvas" width="360" height="220"></canvas>
      </div>
      <div class="nc-progress-bar"><div class="nc-progress-fill"></div></div>
      <div class="nc-status-row">
        <span class="nc-status-text"></span>
        <div class="nc-pow-indicator">
          <div class="nc-pow-dot"></div>
          <span>Securing...</span>
        </div>
      </div>
    `;

    this.widget.appendChild(this.trigger);
    this.widget.appendChild(this.challengePanel);
    this.container.appendChild(this.widget);
  }

  _bindTrigger() {
    this.trigger.addEventListener("click", () => {
      if (this.state === "idle" || this.state === "fail") {
        this._startChallenge();
      }
    });

    this.challengePanel.querySelector(".nc-refresh-btn").addEventListener("click", () => {
      if (this.state === "active") {
        this._startChallenge();
      }
    });
  }

  async _startChallenge() {
    this._setState("loading");
    this.behavior.reset();
    this.behavior.start();

    try {
      const resp = await fetch("/api/challenge", { method: "POST" });
      this.challenge = await resp.json();

      this._setState("active");
      this._initPuzzle();
    } catch (err) {
      console.error("Challenge fetch failed:", err);
      this._setState("fail");
    }
  }

  _initPuzzle() {
    const canvas = this.challengePanel.querySelector(".nc-canvas");
    this.puzzle = new PuzzleEngine(canvas, this.challenge.puzzle_seed);
    this.puzzle.onSolved = (result) => this._onPuzzleSolved(result);
  }

  async _onPuzzleSolved(puzzleResult) {
    this._setState("solving_pow");

    const statusText = this.challengePanel.querySelector(".nc-status-text");
    statusText.textContent = "Verifying...";

    const powNonce = await ProofOfWork.solve(
      this.challenge.challenge_id,
      this.challenge.nonce_prefix,
      this.challenge.pow_difficulty
    );

    this._setState("verifying");

    const report = this.behavior.getReport();
    this.behavior.stop();

    const payload = {
      pow_nonce: powNonce,
      mouse_events: report.mouse_events,
      timing: report.timing,
      puzzle: puzzleResult,
    };

    try {
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json();

      if (result.verified) {
        this._setState("success");
        if (this.onVerified) this.onVerified(result.token);
      } else {
        this._retryCount++;
        if (this._retryCount >= 3) {
          this._setState("fail");
          const statusText = this.challengePanel.querySelector(".nc-status-text");
          statusText.textContent = "Verification failed. Please try again.";
        } else {
          this._setState("fail");
          setTimeout(() => this._startChallenge(), 800);
        }
      }
    } catch (err) {
      console.error("Verification failed:", err);
      this._setState("fail");
    }
  }

  _setState(state) {
    this.state = state;
    const widget = this.widget;
    const panel = this.challengePanel;
    const checkbox = this.trigger.querySelector(".nc-checkbox");
    const label = this.trigger.querySelector(".nc-label");
    const progressFill = panel.querySelector(".nc-progress-fill");
    const powIndicator = panel.querySelector(".nc-pow-indicator");
    const statusText = panel.querySelector(".nc-status-text");

    widget.classList.remove("nc-loading", "nc-active", "nc-success", "nc-fail", "nc-verifying");

    switch (state) {
      case "loading":
        widget.classList.add("nc-loading");
        checkbox.classList.add("nc-spinning");
        label.textContent = "Verifying...";
        panel.classList.add("nc-visible");
        powIndicator.classList.remove("nc-visible");
        progressFill.style.width = "0%";
        statusText.textContent = "Loading challenge...";
        break;

      case "active":
        widget.classList.add("nc-active");
        checkbox.classList.remove("nc-spinning");
        label.textContent = "Solve the puzzle";
        statusText.textContent = "Drag the piece to complete the image";
        progressFill.style.width = "30%";
        break;

      case "solving_pow":
        widget.classList.add("nc-verifying");
        powIndicator.classList.add("nc-visible");
        progressFill.style.width = "60%";
        statusText.textContent = "Computing proof...";
        break;

      case "verifying":
        progressFill.style.width = "85%";
        statusText.textContent = "Analyzing behavior...";
        break;

      case "success":
        widget.classList.add("nc-success");
        checkbox.classList.remove("nc-spinning");
        checkbox.classList.add("nc-checked");
        label.textContent = "Verified";
        panel.classList.remove("nc-visible");
        progressFill.style.width = "100%";
        statusText.textContent = "";

        setTimeout(() => {
          panel.classList.remove("nc-visible");
        }, 600);
        break;

      case "fail":
        widget.classList.add("nc-fail");
        checkbox.classList.remove("nc-spinning", "nc-checked");
        label.textContent = "Try again";
        powIndicator.classList.remove("nc-visible");
        progressFill.style.width = "0%";
        break;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const captcha = new NeuroCaptcha("neurocaptcha");

  captcha.onVerified = (token) => {
    console.log("CAPTCHA verified! Token:", token);
    const demo = document.getElementById("demo-result");
    if (demo) {
      demo.classList.add("visible");
      demo.querySelector(".demo-token").textContent = token;
    }
  };
});
