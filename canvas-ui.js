/**
 * Canvas UI - Woven Artist Canvas with Wet Paint Simulation (WebGL2)
 * Ported from @canvas-ui/canvas-react for Tomas Portfolio
 * Desktop-only effect for the black background area in About, Works, and Contact.
 */

(function () {
  'use strict';

  // Desktop breakpoint
  const MIN_DESKTOP_WIDTH = 1025;

  const DEFAULTS = {
    threadSize: 2,
    threadWidth: 0.2,
    texture: 1,
    tint: [0.8392, 0.8078, 0.7529],
    tintStrength: 0,
    grain: 0.5,
    halftone: 0.1,
    dotSize: 6,
    strength: 1,
    relief: 0.45,
    gloss: 0.35,
    bristle: 0.4,
    dry: 0.95,
    radius: 0.075,
    intro: 1.6,
    followSpeed: 5.5,
  };

  const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG_PAINT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform sampler2D uBrushMask;
uniform vec2 uBrushSize;
uniform vec2 uTexel;
uniform vec2 uShift;
uniform vec2 uPoint;
uniform vec2 uPrevPoint;
uniform float uAspect;
uniform float uRadius;
uniform float uDeposit;
uniform float uBristle;
uniform float uLevel;
uniform float uDecay;
uniform float uDryRate;

float sampleMask(vec2 uv) {
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    return texture(uBrushMask, uv).r;
  }
  return 0.0;
}

void main () {
  vec2 src = vUv + uShift;
  float inside =
    step(0.0, src.x) * step(src.x, 1.0) *
    step(0.0, src.y) * step(src.y, 1.0);
  vec4 prev = texture(uState, src);
  float h = prev.r * inside;
  float wet = prev.g * inside;

  float around =
    texture(uState, src + vec2(uTexel.x, 0.0)).r +
    texture(uState, src - vec2(uTexel.x, 0.0)).r +
    texture(uState, src + vec2(0.0, uTexel.y)).r +
    texture(uState, src - vec2(0.0, uTexel.y)).r;
  around *= 0.25 * inside;

  h = mix(h, around, uLevel * (0.15 + 0.85 * wet));
  h *= uDecay;
  wet *= uDryRate;

  if (uDeposit <= 1e-4) {
    outColor = vec4(h, wet, 0.0, 1.0);
    return;
  }

  // Bounding box early rejection for 60fps performance
  vec2 halfBrush = uBrushSize * 0.58;
  vec2 bbMin = min(uPrevPoint, uPoint) - halfBrush;
  vec2 bbMax = max(uPrevPoint, uPoint) + halfBrush;

  float sweptMask = 0.0;

  // Exact embossed logo stamp at leading cursor tip (uPoint)
  vec2 headDiff = vUv - uPoint;
  vec2 headUv = headDiff / max(uBrushSize, vec2(1e-4)) + 0.5;
  float headMask = sampleMask(headUv);

  if (vUv.x >= bbMin.x && vUv.x <= bbMax.x && vUv.y >= bbMin.y && vUv.y <= bbMax.y) {
    vec2 dPos = uPoint - uPrevPoint;
    vec2 dUv = dPos / max(uBrushSize, vec2(1e-4));
    float dUvLen = length(dUv);

    if (dUvLen < 1e-4) {
      sweptMask = headMask;
    } else {
      vec2 uv0 = (vUv - uPrevPoint) / max(uBrushSize, vec2(1e-4)) + 0.5;

      // Find the range of t in [0, 1] where uv(t) = uv0 - t * dUv is in [0, 1] x [0, 1]
      float t0 = 0.0;
      float t1 = 1.0;

      if (abs(dUv.x) > 1e-5) {
        float txA = uv0.x / dUv.x;
        float txB = (uv0.x - 1.0) / dUv.x;
        t0 = max(t0, min(txA, txB));
        t1 = min(t1, max(txA, txB));
      } else if (uv0.x < 0.0 || uv0.x > 1.0) {
        t0 = 1.0;
        t1 = 0.0;
      }

      if (abs(dUv.y) > 1e-5) {
        float tyA = uv0.y / dUv.y;
        float tyB = (uv0.y - 1.0) / dUv.y;
        t0 = max(t0, min(tyA, tyB));
        t1 = min(t1, max(tyA, tyB));
      } else if (uv0.y < 0.0 || uv0.y > 1.0) {
        t0 = 1.0;
        t1 = 0.0;
      }

      if (t0 <= t1) {
        float segTravel = (t1 - t0) * dUvLen;
        int steps = clamp(int(ceil(segTravel * 42.0)) + 1, 2, 32);
        float stepInv = 1.0 / float(steps - 1);

        for (int i = 0; i < 32; i++) {
          if (i >= steps) break;
          float t = mix(t0, t1, float(i) * stepInv);
          vec2 sUv = uv0 - t * dUv;
          float m = sampleMask(sUv);
          sweptMask = max(sweptMask, m);
          if (sweptMask >= 0.98) break;
        }
      }
      sweptMask = max(sweptMask, headMask);
    }
  }

  // 3D sculptural impasto relief directly from the continuous swept logo silhouette
  float sweptDome = sweptMask * sweptMask;
  float sweptLip = smoothstep(0.05, 0.35, sweptMask) * (1.0 - smoothstep(0.35, 0.90, sweptMask));

  // Subtle painterly bristle texture along the motion path
  vec2 p = vUv * vec2(uAspect, 1.0);
  vec2 a = uPrevPoint * vec2(uAspect, 1.0);
  vec2 b = uPoint * vec2(uAspect, 1.0);
  vec2 travel = b - a;
  float len = length(travel);
  float bristle = 1.0;
  if (len > 1e-4) {
    vec2 axis = travel / len;
    vec2 perp = vec2(-axis.y, axis.x);
    float across = dot(p - a, perp) / max(uBrushSize.x * uAspect * 0.45, 1e-4);
    float comb = 0.5 + 0.5 * cos(across * 16.0);
    bristle = mix(1.0, 0.82 + 0.18 * comb, clamp(uBristle, 0.0, 1.0));
  }

  // Unified smooth continuous ribbon whose cross-section and contours are 100% the logo shape
  float combined = (sweptDome * 0.85 + sweptLip * 0.55) * sweptMask * bristle;

  // Uniform painterly stroke deposit: avoids corrugated frame seams for a silky smooth ribbon
  float strokeH = combined * clamp(uDeposit * 2.8, 0.0, 0.65);
  h = clamp(max(h, strokeH) + strokeH * 0.12, 0.0, 1.0);
  wet = clamp(max(wet, strokeH * 3.5), 0.0, 1.0);

  outColor = vec4(h, wet, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform sampler2D uTextMask;
uniform vec2 uResolution;
uniform float uThreadSize;
uniform float uThreadWidth;
uniform float uTexture;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uGrain;
uniform float uHalftone;
uniform float uDotSize;
uniform float uStrength;
uniform sampler2D uPaint;
uniform vec2 uPaintTexel;
uniform float uRelief;
uniform float uGloss;
uniform float uIntro;
uniform float uMaxX;
uniform vec2 uScroll;

#define S(a, b, t) smoothstep(a, b, t)

float hash (vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float threadedEdges (vec2 st, float width) {
  return 1.0 - S(0.0, width, st.x) + S(1.0 - width, 1.0, st.x);
}

float ovalGradient (vec2 st, float radius) {
  return S(radius - 0.1, radius + 0.9, 1.0 - length(st - 0.5));
}

vec2 weave (vec2 frag) {
  vec2 st = frag / max(uThreadSize, 1.0);
  st.x *= 0.5;
  if (mod(floor(st.y), 2.0) == 1.0) {
    st.x -= 0.5;
  }
  vec2 f = fract(st);
  float edges = threadedEdges(f, max(uThreadWidth, 0.001));
  float bump = ovalGradient(f, 0.5);
  float shade = clamp(1.0 - edges * 0.4 + bump * 0.22, 0.45, 1.3);
  return vec2(shade, bump);
}

void main () {
  vec2 uv = vUv;

  if (uv.x > uMaxX) {
    outColor = vec4(0.0);
    return;
  }

  float textness = texture(uTextMask, vec2(uv.x, 1.0 - uv.y)).r;

  vec2 paintState = texture(uPaint, uv).rg;
  float thickness = paintState.r;
  float wetness = paintState.g;
  float hL = texture(uPaint, uv - vec2(uPaintTexel.x, 0.0)).r;
  float hR = texture(uPaint, uv + vec2(uPaintTexel.x, 0.0)).r;
  float hD = texture(uPaint, uv - vec2(0.0, uPaintTexel.y)).r;
  float hU = texture(uPaint, uv + vec2(0.0, uPaintTexel.y)).r;
  vec2 slope = vec2(hR - hL, hU - hD) * 0.5;

  float relief = clamp(uRelief, 0.0, 1.0);
  vec2 parallax = -slope * relief * 0.08 * (1.0 - textness);
  vec2 contentUv = vec2(uv.x + parallax.x, 1.0 - uv.y - parallax.y);
  contentUv.x = clamp(contentUv.x, 0.0, uMaxX);
  contentUv.y = clamp(contentUv.y, 0.0, 1.0);

  vec4 content = texture(uContent, contentUv);
  vec2 frag = uv * uResolution;
  vec2 cloth = frag + uScroll;

  vec2 fiber = weave(cloth);
  float grainN = hash(floor(cloth));

  float dotPx = max(uDotSize, 2.0);
  mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  mat2 inv = mat2(0.7071, 0.7071, -0.7071, 0.7071);
  vec2 hFrag = rot * cloth;
  vec2 hCenter = (floor(hFrag / dotPx) + 0.5) * dotPx;
  vec2 hLocal = (hFrag - hCenter) / dotPx;
  vec2 hUv = (inv * hCenter - uScroll) / uResolution;
  hUv = clamp(hUv, vec2(0.001), vec2(uMaxX - 0.002, 0.999));
  vec4 cellPix = texture(uContent, vec2(hUv.x, 1.0 - hUv.y));
  float cellLum = dot(cellPix.rgb, vec3(0.299, 0.587, 0.114));

  float crisp = 0.0;
  if (textness > 0.4) {
    float fineLum = dot(content.rgb, vec3(0.299, 0.587, 0.114));
    if (abs(fineLum - cellLum) > 0.08) {
      crisp = 1.0;
    }
  }

  float dotR = (1.0 - cellLum) * 0.55 + (grainN - 0.5) * uGrain * 0.12;
  float dotMask = 1.0 - S(dotR - 0.12, dotR + 0.12, length(hLocal));
  vec3 ink = cellPix.rgb * 0.35;
  vec3 between = mix(cellPix.rgb, vec3(1.0), 0.55);
  vec3 screened = mix(between, ink, dotMask);

  vec3 paint = content.rgb;
  float halftoneAmt = clamp(uHalftone, 0.0, 1.0) * (1.0 - 0.85 * crisp);
  paint = mix(paint, screened, halftoneAmt);

  float texAmt = clamp(uTexture, 0.0, 1.0) * (1.0 - 0.6 * crisp);
  texAmt *= 1.0 - 0.55 * thickness * relief;
  paint *= mix(1.0, fiber.x, texAmt);

  float tintMax = max(uTint.r, max(uTint.g, uTint.b));
  vec3 tintMul = uTint / max(tintMax, 0.001);
  float tintAmt = clamp(uTintStrength, 0.0, 1.0) * (1.0 - 0.5 * crisp);
  paint *= mix(vec3(1.0), tintMul, tintAmt);

  paint *= 1.0 + (grainN - 0.5) * uGrain * (0.35 - 0.25 * crisp);

  vec3 nrm = normalize(vec3(-slope * relief * 18.0, 1.0));
  vec3 lightDir = normalize(vec3(-0.55, 0.62, 0.56));
  float presence = S(0.0, 0.12, thickness);
  float diffuse = clamp(dot(nrm, lightDir), 0.0, 1.0);
  float shade = (diffuse - lightDir.z) * 1.15 * (1.0 - 0.45 * crisp);
  paint *= clamp(1.0 + shade, 0.55, 1.7);

  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(nrm, halfVec), 0.0, 1.0), 48.0);
  spec = max(spec - pow(clamp(halfVec.z, 0.0, 1.0), 48.0), 0.0);
  float sheen = clamp(uGloss, 0.0, 1.0) * (0.3 + 0.7 * wetness) * presence;
  paint += (presence * 0.08 * diffuse + spec * sheen * 1.8) * (1.0 - 0.5 * crisp);

  float amt = clamp(uStrength, 0.0, 1.0) * clamp(uIntro, 0.0, 1.0);
  vec3 col = mix(content.rgb, paint, amt);
  float alpha = mix(content.a, 1.0, amt);
  outColor = vec4(col, alpha);
}`;

  function initCanvasUI() {
    const canvas = document.getElementById('canvas-ui-bg');
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl || gl.isContextLost()) {
      console.warn('Canvas UI: WebGL2 not supported or context lost');
      return;
    }

    const config = { ...DEFAULTS };

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Canvas shader error:', gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    const vertexShader = compile(gl.VERTEX_SHADER, VERT);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
    const paintShader = compile(gl.FRAGMENT_SHADER, FRAG_PAINT);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const paintProgram = gl.createProgram();
    gl.attachShader(paintProgram, vertexShader);
    gl.attachShader(paintProgram, paintShader);
    gl.linkProgram(paintProgram);

    const paintUniforms = {};
    const paintCount = gl.getProgramParameter(paintProgram, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < paintCount; i++) {
      const info = gl.getActiveUniform(paintProgram, i);
      paintUniforms[info.name] = gl.getUniformLocation(paintProgram, info.name);
    }

    const halfFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Content texture: base #202020 dark charcoal canvas surface
    const contentTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Fill with #202020 (32, 32, 32, 255)
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = 64;
    baseCanvas.height = 64;
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.fillStyle = '#202020';
    baseCtx.fillRect(0, 0, 64, 64);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, baseCanvas);

    // Text mask texture (1x1 transparent)
    const textMaskTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textMaskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    // Logo brush stamp texture (rasterized from icons/logo.svg)
    function createLogoBrushTexture() {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, size, size);

      // Center and scale icons/logo.svg path (viewBox 0 0 21 24, center 10.33, 12.25)
      const scale = 205 / 24;
      ctx.translate(size / 2, size / 2);
      ctx.scale(scale, -scale); // flip Y for WebGL texture coordinates
      ctx.translate(-10.33, -12.25);

      const path = new Path2D(
        'M5.6875 18.4339C3.13033 19.5184 2.78747 22.1288 2.23218 23.8638' +
        'C2.20601 23.9456 2.12968 24 2.04383 24H0.250423C0.122121 24 0.0259952 23.8854 0.0543427 23.7602' +
        'C1.52948 17.2487 4.375 4.47055 4.375 3.59091C4.375 2.71836 3.95504 2.84317 1.88073 4.59346' +
        'C1.80594 4.65657 1.69526 4.65764 1.62063 4.59434L0.166448 3.36096' +
        'C0.0769657 3.28507 0.0712967 3.14902 0.156228 3.06806' +
        'C2.79669 0.551163 7.10281 -1.18944 12.25 0.993339' +
        'C15.987 2.57808 19.0855 1.18486 20.4551 0.513505' +
        'C20.6282 0.42862 20.746 0.576693 20.6092 0.712622' +
        'C19.622 1.69344 17.186 3.43224 15.3125 3.96191' +
        'C12.6875 4.70406 13.5625 7.30158 14 9.8991' +
        'C14.4375 12.4966 15.0184 15.2606 12.6875 16.5785' +
        'C10.0625 18.0627 7.68278 17.5877 5.6875 18.4339Z'
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill(path);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      return tex;
    }

    const brushMaskTexture = createLogoBrushTexture();

    const PAINT_SCALE = 0.5;
    const PAINT_MAX = 1024;

    function createTarget(width, height) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        halfFloat ? gl.RGBA16F : gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null
      );
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fbo, texture };
    }

    function releaseTarget(target) {
      if (!target) return;
      gl.deleteFramebuffer(target.fbo);
      gl.deleteTexture(target.texture);
    }

    let paintRead = null;
    let paintWrite = null;
    let paintWidth = 0;
    let paintHeight = 0;

    function syncPaintTargets() {
      const cssW = Math.max(canvas.clientWidth, 1);
      const cssH = Math.max(canvas.clientHeight, 1);
      const scale = Math.min(1, PAINT_MAX / Math.max(cssW, cssH, 1));
      const width = Math.max(1, Math.round(cssW * PAINT_SCALE * scale));
      const height = Math.max(1, Math.round(cssH * PAINT_SCALE * scale));
      if (width === paintWidth && height === paintHeight) return;
      releaseTarget(paintRead);
      releaseTarget(paintWrite);
      paintWidth = width;
      paintHeight = height;
      paintRead = createTarget(width, height);
      paintWrite = createTarget(width, height);
    }

    function syncCanvasSize() {
      if (window.innerWidth < MIN_DESKTOP_WIDTH) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      syncPaintTargets();
    }

    syncCanvasSize();

    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, target: 0 };
    let prevPaintX = 0.5;
    let prevPaintY = 0.5;
    let paintSeeded = false;
    let activeUntil = 0;
    let lastPointerMoveTime = 0;

    let introStart = performance.now();
    let introDone = false;

    function introProgress(now) {
      if (config.intro <= 0 || reducedMotion) {
        introDone = true;
        return 1;
      }
      const p = Math.min((now - introStart) / (config.intro * 1000), 1);
      if (p >= 1) introDone = true;
      return p * p * (3 - 2 * p);
    }

    function stepPaint(delta, now) {
      if (!paintRead || !paintWrite) return;
      const cssW = Math.max(canvas.clientWidth, 1);
      const cssH = Math.max(canvas.clientHeight, 1);

      if (!paintSeeded) {
        prevPaintX = pointer.x;
        prevPaintY = pointer.y;
        paintSeeded = true;
      }

      const dry = Math.max(config.dry, 0.05);
      const travel = Math.hypot(pointer.x - prevPaintX, pointer.y - prevPaintY);
      const stroke = Math.min(travel / Math.max(config.radius * 0.5, 1e-4), 1.6);
      const painting = pointer.active > 0.02 && config.relief > 0.001 && !reducedMotion;

      // When cursor stops moving (travel -> 0), deposit smoothly drops to 0
      const deposit = painting ? Math.min(stroke * 0.35, 0.50) : 0;

      // Keep animation alive for the full dissolve window so paint completely fades
      if (deposit > 1e-4) {
        activeUntil = now + dry * 1000 + 600;
      }

      // Smooth painterly decay curve (~0.8s brisk fade to ~1.2s complete dissolve)
      const decay = Math.exp((-delta / dry) * 3.2);
      const dryRate = Math.exp((-delta / (dry * 0.6)) * 3.2);

      // Stamp dimensions (~115px wide)
      const stampPx = 115;
      const stampW = stampPx / cssW;
      const stampH = (stampPx * (24 / 21)) / cssH;

      gl.useProgram(paintProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paintRead.texture);
      gl.uniform1i(paintUniforms.uState, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, brushMaskTexture);
      gl.uniform1i(paintUniforms.uBrushMask, 1);

      gl.uniform2f(paintUniforms.uBrushSize, stampW, stampH);
      gl.uniform2f(paintUniforms.uTexel, 1 / paintWidth, 1 / paintHeight);
      gl.uniform2f(paintUniforms.uShift, 0, 0);
      gl.uniform2f(paintUniforms.uPoint, pointer.x, pointer.y);
      gl.uniform2f(paintUniforms.uPrevPoint, prevPaintX, prevPaintY);
      gl.uniform1f(paintUniforms.uAspect, cssW / cssH);
      gl.uniform1f(paintUniforms.uRadius, Math.max(config.radius, 0.005));
      gl.uniform1f(paintUniforms.uDeposit, deposit);
      gl.uniform1f(paintUniforms.uBristle, config.bristle);
      gl.uniform1f(paintUniforms.uLevel, 1 - Math.exp(-delta * 2.5));
      gl.uniform1f(paintUniforms.uDecay, decay);
      gl.uniform1f(paintUniforms.uDryRate, dryRate);

      gl.bindFramebuffer(gl.FRAMEBUFFER, paintWrite.fbo);
      gl.viewport(0, 0, paintWidth, paintHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const swap = paintRead;
      paintRead = paintWrite;
      paintWrite = swap;
      prevPaintX = pointer.x;
      prevPaintY = pointer.y;
    }

    function render(now) {
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.uniform1i(uniforms.uContent, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textMaskTexture);
      gl.uniform1i(uniforms.uTextMask, 1);

      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      const dpr = canvas.width / Math.max(canvas.clientWidth, 1);
      gl.uniform1f(uniforms.uThreadSize, Math.max(config.threadSize, 1) * dpr);
      gl.uniform1f(uniforms.uThreadWidth, config.threadWidth);
      gl.uniform1f(uniforms.uTexture, config.texture);
      gl.uniform3f(
        uniforms.uTint,
        config.tint[0],
        config.tint[1],
        config.tint[2]
      );
      gl.uniform1f(uniforms.uTintStrength, config.tintStrength);
      gl.uniform1f(uniforms.uGrain, config.grain);
      gl.uniform1f(uniforms.uHalftone, config.halftone);
      gl.uniform1f(uniforms.uDotSize, Math.max(config.dotSize, 1.5) * dpr);
      gl.uniform1f(uniforms.uStrength, config.strength);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, paintRead ? paintRead.texture : null);
      gl.uniform1i(uniforms.uPaint, 2);
      gl.uniform2f(
        uniforms.uPaintTexel,
        1 / Math.max(paintWidth, 1),
        1 / Math.max(paintHeight, 1)
      );
      gl.uniform1f(uniforms.uRelief, config.relief);
      gl.uniform1f(uniforms.uGloss, config.gloss);
      gl.uniform1f(uniforms.uIntro, introProgress(now));
      gl.uniform1f(uniforms.uMaxX, 1.0);
      gl.uniform2f(uniforms.uScroll, 0, 0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    let raf = 0;
    let lastTime = performance.now();
    let destroyed = false;
    let running = false;
    let visible = false;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    function frame(now) {
      if (destroyed) return;
      if (!visible || window.innerWidth < MIN_DESKTOP_WIDTH) {
        running = false;
        return;
      }
      const delta = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      const ease = reducedMotion
        ? 1
        : 1 - Math.exp(-delta * Math.max(config.followSpeed, 0.5));
      pointer.x += (pointer.tx - pointer.x) * ease;
      pointer.y += (pointer.ty - pointer.y) * ease;
      pointer.active += (pointer.target - pointer.active) * ease;

      stepPaint(delta, now);
      render(now);

      const drying = now < activeUntil;
      const settled =
        Math.abs(pointer.tx - pointer.x) < 5e-4 &&
        Math.abs(pointer.ty - pointer.y) < 5e-4 &&
        Math.abs(pointer.target - pointer.active) < 1e-3 &&
        introDone &&
        !drying;

      if (settled) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.active = pointer.target;
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (destroyed || running || !visible || window.innerWidth < MIN_DESKTOP_WIDTH) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function wake() {
      start();
    }

    function onMotionChange() {
      reducedMotion = motionQuery.matches;
      start();
    }
    motionQuery.addEventListener('change', onMotionChange);

    // Resize handler
    window.addEventListener('resize', () => {
      if (window.innerWidth >= MIN_DESKTOP_WIDTH) {
        syncCanvasSize();
        start();
      }
    });

    // Check if scroll is within About, Works, or Contact sections
    function isWithinTargetSections() {
      const about = document.getElementById('about');
      const contact = document.getElementById('contact');
      if (!about) return false;
      const scrollY = window.scrollY;
      const startY = about.offsetTop - 150;
      const endY = contact ? contact.offsetTop + contact.offsetHeight : document.body.scrollHeight;
      return scrollY >= startY && scrollY <= endY;
    }

    // Pointer event tracking over the full black card background
    function onPointerMove(event) {
      if (window.innerWidth < MIN_DESKTOP_WIDTH || !visible) {
        if (pointer.target !== 0) {
          pointer.target = 0;
          wake();
        }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      // Ensure cursor is within the black canvas frame
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        if (pointer.target !== 0) {
          pointer.target = 0;
          wake();
        }
        return;
      }

      const nx = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const ny = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);

      // Prevent teleport streak if pointer re-enters or jumps across screen after long idle
      const now = performance.now();
      const timeSinceMove = now - lastPointerMoveTime;
      const jumpDist = Math.hypot(nx - pointer.x, ny - pointer.y);
      if ((pointer.active < 0.02 && pointer.target === 0) || (timeSinceMove > 300 && jumpDist > 0.15)) {
        pointer.x = nx;
        pointer.y = ny;
        prevPaintX = nx;
        prevPaintY = ny;
      }

      pointer.tx = nx;
      pointer.ty = ny;
      pointer.target = 1;
      lastPointerMoveTime = now;
      wake();
    }

    function onPointerLeave() {
      pointer.target = 0;
      wake();
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });

    // Public API exposed on window for app.js
    window.canvasUIInstance = {
      setVisible(val, immediate) {
        const nextVisible = Boolean(val);
        if (visible === nextVisible && !immediate) return;
        visible = nextVisible;
        if (immediate || !visible) {
          canvas.classList.add('no-transition');
          canvas.style.transition = 'none';
        } else {
          canvas.classList.remove('no-transition');
          canvas.style.transition = 'opacity 0.3s ease';
        }
        canvas.style.opacity = visible ? '1' : '0';
        if (visible) {
          syncCanvasSize();
          start();
        }
      },
      wake() {
        wake();
      },
      resize() {
        syncCanvasSize();
        start();
      },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        motionQuery.removeEventListener('change', onMotionChange);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        gl.deleteTexture(contentTexture);
        gl.deleteTexture(textMaskTexture);
        gl.deleteTexture(brushMaskTexture);
        releaseTarget(paintRead);
        releaseTarget(paintWrite);
        gl.deleteProgram(program);
        gl.deleteProgram(paintProgram);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(paintShader);
        gl.deleteBuffer(quad);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCanvasUI);
  } else {
    initCanvasUI();
  }
})();
