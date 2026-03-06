# NeuroCAPTCHA

Multi-layered CAPTCHA system specifically designed to resist neural network attacks.

## Defense Layers

| Layer | What it does | Why AI fails |
|-------|-------------|--------------|
| **Behavioral Biometrics** | Analyzes mouse trajectory entropy, speed variance, acceleration jerk | Neural nets can't replicate the stochastic nature of human motor control |
| **Physics Puzzle** | Drag-and-drop with overshoot/correction detection | Perfect robotic paths are flagged; humans always overshoot and correct |
| **Proof of Work** | SHA-256 mining per challenge attempt | Makes large-scale bot attacks economically infeasible |
| **Timing Analysis** | Solve time, click-hold duration, focus/blur patterns | Bots have unnatural timing distributions |
| **Adversarial Visuals** | Procedural backgrounds with CNN-confusing noise | Designed to disrupt convolutional feature extraction |
| **HMAC Signatures** | Cryptographic challenge signing with TTL | Prevents replay attacks and token forgery |

## Quick Start

```bash
pip install -r requirements.txt
python server.py
```

Open http://localhost:5000 in your browser.

## API

### `POST /api/challenge`
Returns a signed challenge with puzzle seed and proof-of-work parameters.

### `POST /api/verify`
Accepts behavioral data, puzzle results, and proof-of-work nonce. Returns verification result with token.

### `POST /api/validate-token`
Validates a previously issued verification token (for downstream services).

## Integration

```html
<div id="neurocaptcha"></div>
<script src="/static/js/behavior.js"></script>
<script src="/static/js/pow.js"></script>
<script src="/static/js/puzzle.js"></script>
<script src="/static/js/captcha.js"></script>
```

```javascript
const captcha = new NeuroCaptcha("neurocaptcha");
captcha.onVerified = (token) => {
  // Send token with your form submission
  // Validate server-side via POST /api/validate-token
};
```

## Architecture

```
Client                          Server
  │                               │
  ├─ POST /api/challenge ────────►│ Generate signed challenge
  │◄──── challenge + seed ────────┤
  │                               │
  │  [User solves puzzle]         │
  │  [Behavioral data collected]  │
  │  [PoW computed in browser]    │
  │                               │
  ├─ POST /api/verify ───────────►│ Verify PoW
  │                               │ Analyze mouse dynamics
  │                               │ Check timing signals
  │                               │ Score puzzle interaction
  │◄──── {verified, token} ───────┤
  │                               │
  ▼                               ▼
```
