"""
NeuroCAPTCHA - Multi-layered CAPTCHA system resistant to neural networks.

Combines behavioral biometrics, physics-based puzzles, adversarial visual
noise, and proof-of-work to create a verification pipeline that is trivial
for humans but extremely difficult for AI systems.
"""

import hashlib
import hmac
import json
import math
import os
import secrets
import time
from functools import wraps

from flask import Flask, jsonify, render_template, request, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

HMAC_KEY = secrets.token_bytes(32)
CHALLENGE_TTL = 300  # 5 minutes
POW_DIFFICULTY = 4   # leading zero bits in hash

# ─── Behavioral thresholds ────────────────────────────────────────────────────

MOUSE_ENTROPY_MIN = 2.0
MOUSE_ENTROPY_MAX = 8.0
MIN_EVENTS = 15
MAX_STRAIGHT_RATIO = 0.85
MIN_SPEED_VARIANCE = 0.1
MIN_SOLVE_TIME_MS = 800
MAX_SOLVE_TIME_MS = 60000
MIN_CLICK_HOLD_MS = 30
MAX_CLICK_HOLD_MS = 800

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _sign(data: str) -> str:
    return hmac.new(HMAC_KEY, data.encode(), hashlib.sha256).hexdigest()


def _verify_sig(data: str, sig: str) -> bool:
    return hmac.compare_digest(_sign(data), sig)


def _make_challenge() -> dict:
    challenge_id = secrets.token_hex(16)
    timestamp = int(time.time())
    nonce_prefix = secrets.token_hex(8)

    payload = f"{challenge_id}:{timestamp}:{nonce_prefix}"
    sig = _sign(payload)

    puzzle_seed = secrets.randbelow(2**32)

    return {
        "challenge_id": challenge_id,
        "timestamp": timestamp,
        "nonce_prefix": nonce_prefix,
        "signature": sig,
        "pow_difficulty": POW_DIFFICULTY,
        "puzzle_seed": puzzle_seed,
    }


def _verify_pow(challenge_id: str, nonce_prefix: str, nonce: str, difficulty: int) -> bool:
    data = f"{challenge_id}:{nonce_prefix}:{nonce}"
    h = hashlib.sha256(data.encode()).hexdigest()
    target = "0" * difficulty
    return h.startswith(target)


def _analyze_mouse(events: list[dict]) -> dict:
    """
    Analyze mouse movement trajectory for human-like patterns.
    Returns a score dict with individual metrics and a pass/fail verdict.
    """
    if len(events) < MIN_EVENTS:
        return {"pass": False, "reason": "insufficient_events", "score": 0}

    speeds = []
    angles = []
    accelerations = []
    curvatures = []

    for i in range(1, len(events)):
        dx = events[i]["x"] - events[i - 1]["x"]
        dy = events[i]["y"] - events[i - 1]["y"]
        dt = max(events[i]["t"] - events[i - 1]["t"], 1)

        dist = math.sqrt(dx * dx + dy * dy)
        speed = dist / dt
        speeds.append(speed)
        angles.append(math.atan2(dy, dx))

        if i >= 2:
            prev_speed = speeds[-2] if len(speeds) >= 2 else speed
            accelerations.append((speed - prev_speed) / dt)

    if not speeds:
        return {"pass": False, "reason": "no_movement", "score": 0}

    mean_speed = sum(speeds) / len(speeds)
    speed_var = sum((s - mean_speed) ** 2 for s in speeds) / len(speeds)

    straight_segments = 0
    for i in range(1, len(angles)):
        if abs(angles[i] - angles[i - 1]) < 0.05:
            straight_segments += 1
    straight_ratio = straight_segments / max(len(angles) - 1, 1)

    import collections
    angle_bins = collections.Counter()
    for a in angles:
        angle_bins[round(a, 1)] += 1
    total_angles = len(angles)
    entropy = 0
    for count in angle_bins.values():
        p = count / total_angles
        if p > 0:
            entropy -= p * math.log2(p)

    score = 0.0

    if MOUSE_ENTROPY_MIN <= entropy <= MOUSE_ENTROPY_MAX:
        score += 0.3
    if speed_var >= MIN_SPEED_VARIANCE:
        score += 0.25
    if straight_ratio <= MAX_STRAIGHT_RATIO:
        score += 0.25
    if len(accelerations) > 0:
        sign_changes = sum(
            1
            for i in range(1, len(accelerations))
            if accelerations[i] * accelerations[i - 1] < 0
        )
        jerk_ratio = sign_changes / max(len(accelerations) - 1, 1)
        if 0.2 <= jerk_ratio <= 0.8:
            score += 0.2

    return {
        "pass": score >= 0.6,
        "score": round(score, 3),
        "entropy": round(entropy, 3),
        "speed_variance": round(speed_var, 5),
        "straight_ratio": round(straight_ratio, 3),
    }


def _analyze_timing(timing: dict) -> dict:
    solve_time = timing.get("solve_time_ms", 0)
    click_hold = timing.get("click_hold_ms", 0)
    focus_changes = timing.get("focus_changes", 0)
    scroll_events = timing.get("scroll_events", 0)

    score = 0.0

    if MIN_SOLVE_TIME_MS <= solve_time <= MAX_SOLVE_TIME_MS:
        score += 0.35
    if MIN_CLICK_HOLD_MS <= click_hold <= MAX_CLICK_HOLD_MS:
        score += 0.35
    if focus_changes <= 10:
        score += 0.15
    if scroll_events <= 20:
        score += 0.15

    return {"pass": score >= 0.5, "score": round(score, 3)}


def _analyze_puzzle(puzzle_data: dict, seed: int, challenge_type: str = "puzzle") -> dict:
    accuracy = puzzle_data.get("accuracy", 0)
    path_efficiency = puzzle_data.get("path_efficiency", 0)
    overshoot_count = puzzle_data.get("overshoot_count", 0)

    score = 0.0

    if challenge_type == "semantic":
        wrong_clicks = puzzle_data.get("wrong_clicks", 0)
        if accuracy >= 1.0:
            score += 0.5
        if wrong_clicks <= 2:
            score += 0.3
        if puzzle_data.get("click_count", 0) >= 1:
            score += 0.2
        return {"pass": score >= 0.5, "score": round(score, 3)}

    if challenge_type == "rhythm":
        avg_error = puzzle_data.get("avg_error_ms", 9999)
        suspiciously_perfect = puzzle_data.get("suspiciously_perfect", False)
        if suspiciously_perfect:
            return {"pass": False, "score": 0.1, "reason": "suspiciously_perfect"}
        if accuracy >= 0.6:
            score += 0.4
        elif accuracy >= 0.3:
            score += 0.2
        if 30 < avg_error < 400:
            score += 0.35
        if 1 <= overshoot_count <= 5:
            score += 0.25
        return {"pass": score >= 0.4, "score": round(score, 3)}

    if challenge_type == "path":
        trace_points = puzzle_data.get("trace_points", 0)
        if accuracy >= 0.7:
            score += 0.35
        elif accuracy >= 0.4:
            score += 0.15
        if 0.3 <= path_efficiency <= 0.95:
            score += 0.3
        if trace_points >= 30:
            score += 0.15
        if 1 <= overshoot_count <= 30:
            score += 0.2
        return {"pass": score >= 0.4, "score": round(score, 3)}

    if challenge_type == "shadow":
        rotation_samples = puzzle_data.get("rotation_samples", 0)
        if accuracy >= 0.8:
            score += 0.4
        elif accuracy >= 0.5:
            score += 0.2
        if rotation_samples >= 10:
            score += 0.2
        if 2 <= overshoot_count <= 20:
            score += 0.2
        if 0.05 <= path_efficiency <= 0.9:
            score += 0.2
        return {"pass": score >= 0.4, "score": round(score, 3)}

    # Default: drag puzzle
    if accuracy >= 0.85:
        score += 0.4
    elif accuracy >= 0.7:
        score += 0.2
    if 0.3 <= path_efficiency <= 0.95:
        score += 0.3
    if 1 <= overshoot_count <= 5:
        score += 0.3
    elif overshoot_count == 0:
        score += 0.0

    return {"pass": score >= 0.5, "score": round(score, 3)}


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/challenge", methods=["POST"])
def create_challenge():
    challenge = _make_challenge()
    session["challenge"] = challenge
    return jsonify(challenge)


@app.route("/api/verify", methods=["POST"])
def verify():
    challenge = session.get("challenge")
    if not challenge:
        return jsonify({"verified": False, "error": "no_challenge"}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"verified": False, "error": "invalid_payload"}), 400

    cid = challenge["challenge_id"]
    ts = challenge["timestamp"]
    nonce_prefix = challenge["nonce_prefix"]
    sig = challenge["signature"]
    seed = challenge["puzzle_seed"]

    payload = f"{cid}:{ts}:{nonce_prefix}"
    if not _verify_sig(payload, sig):
        return jsonify({"verified": False, "error": "tampered_challenge"}), 403

    if time.time() - ts > CHALLENGE_TTL:
        session.pop("challenge", None)
        return jsonify({"verified": False, "error": "expired"}), 410

    pow_nonce = data.get("pow_nonce", "")
    if not _verify_pow(cid, nonce_prefix, pow_nonce, POW_DIFFICULTY):
        return jsonify({"verified": False, "error": "pow_failed"}), 403

    challenge_type = data.get("challenge_type", "puzzle")

    mouse_result = _analyze_mouse(data.get("mouse_events", []))
    timing_result = _analyze_timing(data.get("timing", {}))
    puzzle_result = _analyze_puzzle(data.get("puzzle", {}), seed, challenge_type)

    weights = {"mouse": 0.4, "timing": 0.3, "puzzle": 0.3}
    final_score = (
        mouse_result["score"] * weights["mouse"]
        + timing_result["score"] * weights["timing"]
        + puzzle_result["score"] * weights["puzzle"]
    )

    verified = final_score >= 0.45 and mouse_result["pass"]

    if verified:
        token_data = f"{cid}:{int(time.time())}:verified"
        token_sig = _sign(token_data)
        token = f"{token_data}:{token_sig}"
    else:
        token = None

    session.pop("challenge", None)

    return jsonify(
        {
            "verified": verified,
            "token": token,
            "debug": {
                "final_score": round(final_score, 3),
                "mouse": mouse_result,
                "timing": timing_result,
                "puzzle": puzzle_result,
            },
        }
    )


@app.route("/api/validate-token", methods=["POST"])
def validate_token():
    """Endpoint for downstream services to validate a CAPTCHA token."""
    data = request.get_json(silent=True)
    token = data.get("token", "") if data else ""

    parts = token.rsplit(":", 1)
    if len(parts) != 2:
        return jsonify({"valid": False}), 400

    token_data, token_sig = parts
    if not _verify_sig(token_data, token_sig):
        return jsonify({"valid": False}), 403

    segments = token_data.split(":")
    if len(segments) < 3 or segments[-1] != "verified":
        return jsonify({"valid": False}), 400

    token_ts = int(segments[1])
    if time.time() - token_ts > CHALLENGE_TTL:
        return jsonify({"valid": False, "reason": "expired"}), 410

    return jsonify({"valid": True})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
