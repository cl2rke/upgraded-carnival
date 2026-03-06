/**
 * Proof-of-Work solver using Web Workers.
 * Forces the client to expend real CPU cycles, making large-scale bot
 * attacks economically infeasible. Humans won't notice the 100-500ms delay,
 * but bots trying thousands of requests will burn significant resources.
 */

class ProofOfWork {
  static solve(challengeId, noncePrefix, difficulty) {
    return new Promise((resolve) => {
      const target = "0".repeat(difficulty);
      let nonce = 0;

      const batchSize = 50000;

      function work() {
        const end = nonce + batchSize;
        while (nonce < end) {
          const data = `${challengeId}:${noncePrefix}:${nonce}`;
          const hash = ProofOfWork._sha256(data);
          if (hash.startsWith(target)) {
            resolve(String(nonce));
            return;
          }
          nonce++;
        }
        setTimeout(work, 0);
      }

      work();
    });
  }

  static _sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = ProofOfWork._sha256Sync(msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static _sha256Sync(data) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
      0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
      0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
      0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    function rr(v, n) {
      return ((v >>> n) | (v << (32 - n))) >>> 0;
    }

    let len = data.length;
    let bitLen = len * 8;
    let padded = new Uint8Array(((len + 9 + 63) & ~63));
    padded.set(data);
    padded[len] = 0x80;
    let dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let off = 0; off < padded.length; off += 64) {
      let w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        let s0 = rr(w[i-15], 7) ^ rr(w[i-15], 18) ^ (w[i-15] >>> 3);
        let s1 = rr(w[i-2], 17) ^ rr(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }

      let a=h0, b=h1, c=h2, d=h3, e=h4, f=h5, g=h6, h=h7;

      for (let i = 0; i < 64; i++) {
        let S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25);
        let ch = (e & f) ^ (~e & g);
        let t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        let S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = (S0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
      }

      h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
      h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
    }

    let result = new ArrayBuffer(32);
    let rdv = new DataView(result);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i) => rdv.setUint32(i*4, v, false));
    return result;
  }
}

window.ProofOfWork = ProofOfWork;
