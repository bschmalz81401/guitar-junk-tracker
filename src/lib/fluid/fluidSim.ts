/**
 * GPU fluid simulation used as a page background.
 *
 * The simulation core (Navier–Stokes on the GPU: advection, vorticity
 * confinement, Jacobi pressure projection, gaussian splats) follows Pavel
 * Dobryakov's "WebGL Fluid Simulation", MIT licensed:
 *   https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
 * Copyright (c) 2017 Pavel Dobryakov — MIT.
 *
 * Re-tuned here as a dim gold/ember drift on the app's near-black background:
 * ambient motion, amplified where the pointer moves. It is purely decorative,
 * non-interactive (pointer-events: none), and the caller is responsible for
 * only starting it when WebGL is available and motion is allowed.
 */

export interface FluidSimOptions {
  /** Base RGB the canvas clears to each frame, 0–1. Defaults to app --background. */
  background?: { r: number; g: number; b: number };
}

export interface FluidSimHandle {
  destroy: () => void;
}

interface Config {
  SIM_RESOLUTION: number;
  DYE_RESOLUTION: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE: number;
  PRESSURE_ITERATIONS: number;
  CURL: number;
  SPLAT_RADIUS: number;
  SPLAT_FORCE: number;
  BACK: { r: number; g: number; b: number };
  BRIGHTNESS: number;
}

interface Pointer {
  id: number;
  texcoordX: number;
  texcoordY: number;
  prevTexcoordX: number;
  prevTexcoordY: number;
  deltaX: number;
  deltaY: number;
  down: boolean;
  moved: boolean;
  color: RGB;
}

type RGB = { r: number; g: number; b: number };

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach: (id: number) => number;
}

interface DoubleFBO {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
}

export function createFluidSim(
  canvas: HTMLCanvasElement,
  options: FluidSimOptions = {}
): FluidSimHandle | null {
  const config: Config = {
    SIM_RESOLUTION: 96,
    DYE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 1.35,
    VELOCITY_DISSIPATION: 0.28,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 16,
    CURL: 26,
    SPLAT_RADIUS: 0.32,
    SPLAT_FORCE: 2500,
    BACK: options.background ?? { r: 0.039, g: 0.039, b: 0.043 },
    BRIGHTNESS: 0.14,
  };

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const halfFloat = gl.getExtension("EXT_color_buffer_float");
  const supportLinear = gl.getExtension("OES_texture_float_linear");
  if (!halfFloat) return null;

  gl.clearColor(0, 0, 0, 0);

  const texType = gl.HALF_FLOAT;
  const rgba = { internalFormat: gl.RGBA16F, format: gl.RGBA };
  const rg = { internalFormat: gl.RG16F, format: gl.RG };
  const r = { internalFormat: gl.R16F, format: gl.RED };
  const filtering = supportLinear ? gl.LINEAR : gl.NEAREST;

  // ── shaders ────────────────────────────────────────────────────────────
  const baseVertexShader = compile(
    gl.VERTEX_SHADER,
    `#version 300 es
    precision highp float;
    in vec2 aPosition;
    out vec2 vUv;
    out vec2 vL;
    out vec2 vR;
    out vec2 vT;
    out vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`
  );

  const copyShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; uniform sampler2D uTexture; out vec4 o;
    void main () { o = texture(uTexture, vUv); }`
  );

  const clearShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; uniform sampler2D uTexture; uniform float value; out vec4 o;
    void main () { o = value * texture(uTexture, vUv); }`
  );

  const splatShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;
    uniform vec3 color; uniform vec2 point; uniform float radius; out vec4 o;
    void main () {
      vec2 p = vUv - point.xy; p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture(uTarget, vUv).xyz;
      o = vec4(base + splat, 1.0);
    }`
  );

  const advectionShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;
    uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt;
    uniform float dissipation; out vec4 o;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st); vec2 fuv = fract(st);
      vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }
    void main () {
      ${
        supportLinear
          ? `vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
             vec4 result = texture(uSource, coord);`
          : `vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
             vec4 result = bilerp(uSource, coord, dyeTexelSize);`
      }
      float decay = 1.0 + dissipation * dt;
      o = result / decay;
    }`
  );

  const divergenceShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    uniform sampler2D uVelocity; out vec4 o;
    void main () {
      float L = texture(uVelocity, vL).x;
      float R = texture(uVelocity, vR).x;
      float T = texture(uVelocity, vT).y;
      float B = texture(uVelocity, vB).y;
      vec2 C = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      o = vec4(div, 0.0, 0.0, 1.0);
    }`
  );

  const curlShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    uniform sampler2D uVelocity; out vec4 o;
    void main () {
      float L = texture(uVelocity, vL).y;
      float R = texture(uVelocity, vR).y;
      float T = texture(uVelocity, vT).x;
      float B = texture(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      o = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }`
  );

  const vorticityShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    uniform sampler2D uVelocity; uniform sampler2D uCurl;
    uniform float curl; uniform float dt; out vec4 o;
    void main () {
      float L = texture(uCurl, vL).x;
      float R = texture(uCurl, vR).x;
      float T = texture(uCurl, vT).x;
      float B = texture(uCurl, vB).x;
      float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      o = vec4(velocity, 0.0, 1.0);
    }`
  );

  const pressureShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    uniform sampler2D uPressure; uniform sampler2D uDivergence; out vec4 o;
    void main () {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      float divergence = texture(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      o = vec4(pressure, 0.0, 0.0, 1.0);
    }`
  );

  const gradientSubtractShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float; precision mediump sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
    uniform sampler2D uPressure; uniform sampler2D uVelocity; out vec4 o;
    void main () {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      vec2 velocity = texture(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      o = vec4(velocity, 0.0, 1.0);
    }`
  );

  const displayShader = compile(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; uniform sampler2D uTexture; uniform vec3 back; out vec4 o;
    void main () {
      vec3 dye = texture(uTexture, vUv).rgb;
      o = vec4(back + dye, 1.0);
    }`
  );

  // ── program plumbing ───────────────────────────────────────────────────
  function compile(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, source.trim());
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      throw new Error(gl!.getShaderInfoLog(shader) || "shader compile failed");
    }
    return shader;
  }

  class Program {
    program: WebGLProgram;
    uniforms: Record<string, WebGLUniformLocation | null> = {};
    constructor(vertex: WebGLShader, fragment: WebGLShader) {
      this.program = gl!.createProgram()!;
      gl!.attachShader(this.program, vertex);
      gl!.attachShader(this.program, fragment);
      gl!.linkProgram(this.program);
      if (!gl!.getProgramParameter(this.program, gl!.LINK_STATUS)) {
        throw new Error(gl!.getProgramInfoLog(this.program) || "link failed");
      }
      const count = gl!.getProgramParameter(this.program, gl!.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl!.getActiveUniform(this.program, i)!.name;
        this.uniforms[name] = gl!.getUniformLocation(this.program, name);
      }
    }
    bind() {
      gl!.useProgram(this.program);
    }
  }

  const programs = {
    copy: new Program(baseVertexShader, copyShader),
    clear: new Program(baseVertexShader, clearShader),
    splat: new Program(baseVertexShader, splatShader),
    advection: new Program(baseVertexShader, advectionShader),
    divergence: new Program(baseVertexShader, divergenceShader),
    curl: new Program(baseVertexShader, curlShader),
    vorticity: new Program(baseVertexShader, vorticityShader),
    pressure: new Program(baseVertexShader, pressureShader),
    gradientSubtract: new Program(baseVertexShader, gradientSubtractShader),
    display: new Program(baseVertexShader, displayShader),
  };

  // Fullscreen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target: FBO | null) {
    if (target == null) {
      gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    } else {
      gl!.viewport(0, 0, target.width, target.height);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
    }
    gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
  }

  function createFBO(w: number, h: number, iFmt: number, fmt: number, type: number, param: number): FBO {
    gl!.activeTexture(gl!.TEXTURE0);
    const texture = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, param);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, param);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, iFmt, w, h, 0, fmt, type, null);

    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
    gl!.viewport(0, 0, w, h);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    const texelSizeX = 1.0 / w;
    const texelSizeY = 1.0 / h;
    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX,
      texelSizeY,
      attach(id: number) {
        gl!.activeTexture(gl!.TEXTURE0 + id);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  function createDoubleFBO(w: number, h: number, iFmt: number, fmt: number, type: number, param: number): DoubleFBO {
    let fbo1 = createFBO(w, h, iFmt, fmt, type, param);
    let fbo2 = createFBO(w, h, iFmt, fmt, type, param);
    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() {
        return fbo1;
      },
      set read(v: FBO) {
        fbo1 = v;
      },
      get write() {
        return fbo2;
      },
      set write(v: FBO) {
        fbo2 = v;
      },
      swap() {
        const tmp = fbo1;
        fbo1 = fbo2;
        fbo2 = tmp;
      },
    };
  }

  function getResolution(resolution: number) {
    let aspectRatio = gl!.drawingBufferWidth / gl!.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspectRatio);
    if (gl!.drawingBufferWidth > gl!.drawingBufferHeight) return { width: max, height: min };
    return { width: min, height: max };
  }

  let dye: DoubleFBO;
  let velocity: DoubleFBO;
  let divergence: FBO;
  let curl: FBO;
  let pressure: DoubleFBO;

  function initFramebuffers() {
    const simRes = getResolution(config.SIM_RESOLUTION);
    const dyeRes = getResolution(config.DYE_RESOLUTION);
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl!.NEAREST);
    curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl!.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl!.NEAREST);
  }

  // ── forcing ──────────────────────────────────────────────────────────────
  const pointers: Pointer[] = [
    {
      id: -1,
      texcoordX: 0,
      texcoordY: 0,
      prevTexcoordX: 0,
      prevTexcoordY: 0,
      deltaX: 0,
      deltaY: 0,
      down: false,
      moved: false,
      color: { r: 0, g: 0, b: 0 },
    },
  ];

  // Gold / ember dye. Warm hue jitter, kept to a whisper via BRIGHTNESS.
  function goldColor(): RGB {
    const h = 0.09 + Math.random() * 0.04; // ~32°–47° hue: amber → gold
    const s = 0.55 + Math.random() * 0.25;
    const v = 0.7 + Math.random() * 0.3;
    const c = hsvToRgb(h, s, v);
    const k = config.BRIGHTNESS;
    return { r: c.r * k, g: c.g * k, b: c.b * k };
  }

  function hsvToRgb(h: number, s: number, v: number): RGB {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        return { r: v, g: t, b: p };
      case 1:
        return { r: q, g: v, b: p };
      case 2:
        return { r: p, g: v, b: t };
      case 3:
        return { r: p, g: q, b: v };
      case 4:
        return { r: t, g: p, b: v };
      default:
        return { r: v, g: p, b: q };
    }
  }

  function correctRadius(radius: number) {
    const aspectRatio = canvas.width / canvas.height;
    return aspectRatio > 1 ? radius * aspectRatio : radius;
  }

  function splat(x: number, y: number, dx: number, dy: number, color: RGB) {
    programs.splat.bind();
    gl!.uniform1i(programs.splat.uniforms.uTarget, velocity.read.attach(0));
    gl!.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl!.uniform2f(programs.splat.uniforms.point, x, y);
    gl!.uniform3f(programs.splat.uniforms.color, dx, dy, 0.0);
    gl!.uniform1f(programs.splat.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
    blit(velocity.write);
    velocity.swap();

    gl!.uniform1i(programs.splat.uniforms.uTarget, dye.read.attach(0));
    gl!.uniform3f(programs.splat.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  function splatPointer(p: Pointer) {
    const dx = p.deltaX * config.SPLAT_FORCE;
    const dy = p.deltaY * config.SPLAT_FORCE;
    splat(p.texcoordX, p.texcoordY, dx, dy, p.color);
  }

  // Ambient drift: gentle random splats so the field is never fully still.
  function ambientSplat() {
    const x = Math.random();
    const y = Math.random();
    const dx = (Math.random() - 0.5) * 120;
    const dy = (Math.random() - 0.5) * 120;
    splat(x, y, dx, dy, goldColor());
  }

  // ── simulation step ────────────────────────────────────────────────────
  function step(dt: number) {
    gl!.disable(gl!.BLEND);

    programs.curl.bind();
    gl!.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    programs.vorticity.bind();
    gl!.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.vorticity.uniforms.uCurl, curl.attach(1));
    gl!.uniform1f(programs.vorticity.uniforms.curl, config.CURL);
    gl!.uniform1f(programs.vorticity.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    programs.divergence.bind();
    gl!.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    programs.clear.bind();
    gl!.uniform1i(programs.clear.uniforms.uTexture, pressure.read.attach(0));
    gl!.uniform1f(programs.clear.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    programs.pressure.bind();
    gl!.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.pressure.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl!.uniform1i(programs.pressure.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    programs.gradientSubtract.bind();
    gl!.uniform2f(programs.gradientSubtract.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.gradientSubtract.uniforms.uPressure, pressure.read.attach(0));
    gl!.uniform1i(programs.gradientSubtract.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    programs.advection.bind();
    gl!.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinear)
      gl!.uniform2f(programs.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.advection.uniforms.uSource, velocity.read.attach(0));
    gl!.uniform1f(programs.advection.uniforms.dt, dt);
    gl!.uniform1f(programs.advection.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinear)
      gl!.uniform2f(programs.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl!.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl!.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl!.uniform1f(programs.advection.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    programs.display.bind();
    gl!.uniform1i(programs.display.uniforms.uTexture, dye.read.attach(0));
    gl!.uniform3f(programs.display.uniforms.back, config.BACK.r, config.BACK.g, config.BACK.b);
    blit(null);
  }

  // ── canvas sizing ────────────────────────────────────────────────────────
  function resizeCanvas(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  // ── event wiring ─────────────────────────────────────────────────────────
  function updatePointerMove(p: Pointer, x: number, y: number) {
    p.prevTexcoordX = p.texcoordX;
    p.prevTexcoordY = p.texcoordY;
    p.texcoordX = x / canvas.clientWidth;
    p.texcoordY = 1.0 - y / canvas.clientHeight;
    p.deltaX = p.texcoordX - p.prevTexcoordX;
    p.deltaY = p.texcoordY - p.prevTexcoordY;
    p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
  }

  const pointer = pointers[0];
  let pointerInitialized = false;

  function onPointerMove(e: PointerEvent) {
    if (!pointerInitialized) {
      pointer.texcoordX = e.clientX / canvas.clientWidth;
      pointer.texcoordY = 1.0 - e.clientY / canvas.clientHeight;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.color = goldColor();
      pointerInitialized = true;
      return;
    }
    updatePointerMove(pointer, e.clientX, e.clientY);
    if (pointer.moved) {
      // Re-tint occasionally so the trail shifts across the gold range.
      if (Math.random() < 0.08) pointer.color = goldColor();
    }
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // ── main loop ────────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let ambientAccumulator = 0;
  let seeded = false;
  let rafId = 0;
  let destroyed = false;

  function calcDeltaTime() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastTime = now;
    return dt;
  }

  function frame() {
    if (destroyed) return;
    const dt = calcDeltaTime();
    if (resizeCanvas()) initFramebuffers();

    // A few splats on the very first frames so there is dye to see immediately.
    if (!seeded) {
      for (let i = 0; i < 6; i++) ambientSplat();
      seeded = true;
    }

    // Ambient drift roughly every 0.9s.
    ambientAccumulator += dt;
    if (ambientAccumulator > 0.9) {
      ambientAccumulator = 0;
      ambientSplat();
    }

    if (pointer.moved) {
      pointer.moved = false;
      splatPointer(pointer);
    }

    step(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }

  initFramebuffers();
  resizeCanvas();
  initFramebuffers();
  rafId = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    },
  };
}
