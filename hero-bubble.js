/**
 * Hero Bubble Texture Engine (WebGL2)
 * Ported from @canvas-ui/bubble-react for Tomas Portfolio
 * Renders the iridescent soap-film / liquid sheen glass texture
 * onto the hero outline backing layer (#Union_bg_0).
 */

(function () {
  'use strict';

  const CANVAS_WIDTH = 1466;
  const CANVAS_HEIGHT = 160;
  const BEVEL_RADIUS = 18; // Distance in pixels for the 3D rounded cushion dome

  const DEFAULTS = {
    shine: 0.42,
    rim: 0.65,
    iridescence: 0.4,
    intensity: 0.8,
    colorA: [0.88, 0.88, 0.90], // Neutral Silver-White (Zero Blue)
    colorB: [0.60, 0.60, 0.62], // Cool Neutral Silver
    tint: [1.0, 1.0, 1.0],
    tintStrength: 0.0,
    fallbackAlpha: 1.0,
    baseTime: 1.2,
  };

  const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y; // Standard top-to-bottom UV alignment
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uMask;
uniform vec2 uResolution;
uniform float uTime;
uniform float uShine;
uniform float uRim;
uniform float uIridescence;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uFallbackAlpha;

float rnd3D (vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453123);
}

float noise3D (vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);

  float a000 = rnd3D(i);
  float a100 = rnd3D(i + vec3(1.0, 0.0, 0.0));
  float a010 = rnd3D(i + vec3(0.0, 1.0, 0.0));
  float a110 = rnd3D(i + vec3(1.0, 1.0, 0.0));
  float a001 = rnd3D(i + vec3(0.0, 0.0, 1.0));
  float a101 = rnd3D(i + vec3(1.0, 0.0, 1.0));
  float a011 = rnd3D(i + vec3(0.0, 1.0, 1.0));
  float a111 = rnd3D(i + vec3(1.0, 1.0, 1.0));

  vec3 u = f * f * (3.0 - 2.0 * f);

  float k0 = a000;
  float k1 = a100 - a000;
  float k2 = a010 - a000;
  float k3 = a001 - a000;
  float k4 = a000 - a100 - a010 + a110;
  float k5 = a000 - a010 - a001 + a011;
  float k6 = a000 - a100 - a001 + a101;
  float k7 = -a000 + a100 + a010 - a110 + a001 - a101 - a011 + a111;

  return k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y +
    k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
}

vec3 dropletColor (vec3 normal, vec3 rayDir) {
  vec3 reflectDir = reflect(rayDir, normal);
  float noisePosTime = noise3D(reflectDir * 2.0 + uTime);
  float noiseNegTime = noise3D(reflectDir * 2.0 - uTime);
  vec3 color0 = uColorA * noisePosTime;
  vec3 color1 = uColorB * noiseNegTime;
  return (color0 + color1) * uIntensity;
}

void main () {
  vec4 maskSample = texture(uMask, vUv);
  float d = maskSample.r;
  float cov = maskSample.g;

  if (cov < 0.002) {
    outColor = vec4(0.0);
    return;
  }

  // 3D surface normal reconstruction from distance gradient
  vec2 texel = 1.0 / uResolution;
  float dR = texture(uMask, vUv + vec2(texel.x * 2.0, 0.0)).r;
  float dL = texture(uMask, vUv - vec2(texel.x * 2.0, 0.0)).r;
  float dU = texture(uMask, vUv + vec2(0.0, texel.y * 2.0)).r;
  float dD = texture(uMask, vUv - vec2(0.0, texel.y * 2.0)).r;

  vec2 grad = vec2(dR - dL, dU - dD);
  float z = sqrt(max(0.02, 1.0 - (1.0 - d) * (1.0 - d)));
  vec3 n = normalize(vec3(-grad.x * 4.5, -grad.y * 4.5, z * 1.6));

  vec3 rayDir = vec3(0.0, 0.0, -1.0);
  vec3 glints = pow(max(dropletColor(n, rayDir), 0.0), vec3(7.0));
  vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);

  float edge = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.5);
  vec3 filmTint = mix(vec3(0.92), uTint, clamp(uTintStrength, 0.0, 1.0));
  float fade = cov * clamp(uFallbackAlpha, 0.0, 1.0);

  // Ultra-clear neutral glass: crisp white specular highlight and subtle dark rim
  vec3 light = glints * uIridescence * 0.35 + vec3(spec * uShine * 2.2) +
    filmTint * (0.60 * max(uRim, 0.4) * edge + 0.02);
  float a = fade * clamp(0.05 + 0.60 * edge, 0.0, 1.0);

  outColor = vec4(light * fade, a);
}`;

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  // Fast 2-pass Euclidean distance transform
  function generateDistanceMap(pathD, width, height, maxRadius) {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    const path = new Path2D(pathD);
    ctx.fill(path);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const total = width * height;
    const dist = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      dist[i] = data[i * 4 + 3] > 128 ? 1e6 : 0;
    }

    // Pass 1: Top-left to bottom-right
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (dist[idx] > 0) {
          let d = dist[idx];
          if (x > 0) d = Math.min(d, dist[idx - 1] + 1);
          if (y > 0) d = Math.min(d, dist[idx - width] + 1);
          if (x > 0 && y > 0) d = Math.min(d, dist[idx - width - 1] + 1.414);
          if (x < width - 1 && y > 0) d = Math.min(d, dist[idx - width + 1] + 1.414);
          dist[idx] = d;
        }
      }
    }

    // Pass 2: Bottom-right to top-left
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const idx = y * width + x;
        if (dist[idx] > 0) {
          let d = dist[idx];
          if (x < width - 1) d = Math.min(d, dist[idx + 1] + 1);
          if (y < height - 1) d = Math.min(d, dist[idx + width] + 1);
          if (x < width - 1 && y < height - 1) d = Math.min(d, dist[idx + width + 1] + 1.414);
          if (x > 0 && y < height - 1) d = Math.min(d, dist[idx + width - 1] + 1.414);
          dist[idx] = d;
        }
      }
    }

    // Pack into RGBA: R = normalized distance [0, 255], G = original alpha coverage [0, 255]
    const out = new Uint8Array(total * 4);
    for (let i = 0; i < total; i++) {
      const oIdx = i * 4;
      const dNorm = dist[i] === 0 ? 0 : Math.min(255, Math.round((Math.min(dist[i], maxRadius) / maxRadius) * 255));
      out[oIdx] = dNorm;
      out[oIdx + 1] = data[oIdx + 3];
      out[oIdx + 2] = 0;
      out[oIdx + 3] = 255;
    }
    return out;
  }

  function initHeroBubble() {
    let canvas = document.getElementById('hero-bubble-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'hero-bubble-canvas';
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
    }

    const unionBgPath = document.getElementById('Union_bg_0');
    if (!unionBgPath) return;
    const pathD = unionBgPath.getAttribute('d');
    if (!pathD) return;

    // Ensure #Union sits directly behind #I___m_Tomas_Chen in the SVG painter stack
    const unionEl = document.getElementById('Union');
    const textEl = document.getElementById('I___m_Tomas_Chen');
    if (unionEl && textEl && unionEl.parentNode) {
      unionEl.parentNode.insertBefore(unionEl, textEl);
    }

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    if (!gl) {
      console.warn('WebGL2 not supported for Hero Bubble');
      return;
    }

    const program = createProgram(gl, VERT, FRAG);
    if (!program) return;

    // Full-screen quad
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Generate distance texture
    const maskData = generateDistanceMap(pathD, CANVAS_WIDTH, CANVAS_HEIGHT, BEVEL_RADIUS);
    if (!maskData) return;

    const maskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CANVAS_WIDTH, CANVAS_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, maskData);

    // Uniform locations
    const loc = {
      uMask: gl.getUniformLocation(program, 'uMask'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uShine: gl.getUniformLocation(program, 'uShine'),
      uRim: gl.getUniformLocation(program, 'uRim'),
      uIridescence: gl.getUniformLocation(program, 'uIridescence'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uColorA: gl.getUniformLocation(program, 'uColorA'),
      uColorB: gl.getUniformLocation(program, 'uColorB'),
      uTint: gl.getUniformLocation(program, 'uTint'),
      uTintStrength: gl.getUniformLocation(program, 'uTintStrength'),
      uFallbackAlpha: gl.getUniformLocation(program, 'uFallbackAlpha'),
    };

    let currentTime = DEFAULTS.baseTime;

    function render(time) {
      gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform1i(loc.uMask, 0);

      gl.uniform2f(loc.uResolution, CANVAS_WIDTH, CANVAS_HEIGHT);
      gl.uniform1f(loc.uTime, time);
      gl.uniform1f(loc.uShine, DEFAULTS.shine);
      gl.uniform1f(loc.uRim, DEFAULTS.rim);
      gl.uniform1f(loc.uIridescence, DEFAULTS.iridescence);
      gl.uniform1f(loc.uIntensity, DEFAULTS.intensity);
      gl.uniform3fv(loc.uColorA, DEFAULTS.colorA);
      gl.uniform3fv(loc.uColorB, DEFAULTS.colorB);
      gl.uniform3fv(loc.uTint, DEFAULTS.tint);
      gl.uniform1f(loc.uTintStrength, DEFAULTS.tintStrength);
      gl.uniform1f(loc.uFallbackAlpha, DEFAULTS.fallbackAlpha);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const imgEl = document.getElementById('hero-bubble-img');
      if (imgEl) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          imgEl.setAttribute('href', dataUrl);
        } catch (err) {
          console.warn('Could not export hero bubble canvas to SVG image:', err);
        }
      }
    }

    // Initial render at frame 0
    render(currentTime);

    // Public API for scroll synchronization
    window.heroBubbleInstance = {
      setScrollProgress(progress) {
        // Locked Studio Lighting: maintain fixed crisp specular highlights
        // (Opacity fade-out is handled natively by #Union's keyframe animation)
      },
      render() {
        render(currentTime);
      },
      destroy() {
        gl.deleteTexture(maskTex);
        gl.deleteBuffer(quadBuf);
        gl.deleteProgram(program);
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroBubble);
  } else {
    initHeroBubble();
  }
})();
