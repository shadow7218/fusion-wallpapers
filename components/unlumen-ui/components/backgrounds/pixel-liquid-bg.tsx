"use client";

import React, { useEffect, useRef } from "react";

export interface PixelLiquidBgProps {
  className?: string;
  darkPalette?: [string, string, string, string] | string[];
  lightPalette?: [string, string, string, string] | string[];
  pixelSize?: number;
  resolution?: number;
  mouseForce?: number;
  theme?: "dark" | "light";
  children?: React.ReactNode;
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export function PixelLiquidBg({
  className = "",
  darkPalette = ["#000000", "#1f0010", "#c80050", "#ff2a7a"],
  lightPalette = ["#ffffff", "#e8d5ff", "#aa55ff", "#7700ff"],
  pixelSize = 3,
  resolution = 0.4,
  mouseForce = 8,
  theme = "dark",
  children,
}: PixelLiquidBgProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: "default",
    });

    if (!gl) return;

    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Uses highp float so mobile GPUs never overflow sin() hash calculations
    const fragmentShaderSource = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      varying vec2 v_uv;
      uniform vec2 u_res;
      uniform float u_time;
      uniform float u_pixelSize;
      uniform vec2 u_pointer;
      uniform vec2 u_pointerVel;
      uniform float u_mouseForce;
      uniform vec3 u_c0;
      uniform vec3 u_c1;
      uniform vec3 u_c2;
      uniform vec3 u_c3;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.55 * noise(p);
        p = p * 2.02 + vec2(1.7, 9.2);
        v += 0.30 * noise(p);
        p = p * 2.01 + vec2(8.3, 2.8);
        v += 0.15 * noise(p);
        return v;
      }

      float bayer4x4(vec2 pos) {
        vec2 p = floor(mod(pos, 4.0));
        int idx = int(p.x) + int(p.y) * 4;
        if (idx == 0) return 0.0 / 16.0;
        if (idx == 1) return 8.0 / 16.0;
        if (idx == 2) return 2.0 / 16.0;
        if (idx == 3) return 10.0 / 16.0;
        if (idx == 4) return 12.0 / 16.0;
        if (idx == 5) return 4.0 / 16.0;
        if (idx == 6) return 14.0 / 16.0;
        if (idx == 7) return 6.0 / 16.0;
        if (idx == 8) return 3.0 / 16.0;
        if (idx == 9) return 11.0 / 16.0;
        if (idx == 10) return 1.0 / 16.0;
        if (idx == 11) return 9.0 / 16.0;
        if (idx == 12) return 15.0 / 16.0;
        if (idx == 13) return 7.0 / 16.0;
        if (idx == 14) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      void main() {
        float px = max(1.0, u_pixelSize);
        vec2 fragCoord = v_uv * u_res;
        vec2 cellCoord = floor(fragCoord / px);
        vec2 quantizedFrag = cellCoord * px + px * 0.5;
        vec2 uv = quantizedFrag / u_res;

        float aspect = u_res.x / max(1.0, u_res.y);
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

        float t = u_time * 0.28;

        // Auto-demo swirling liquid streams + interactive pointer force
        vec2 emitter1 = vec2(sin(t * 0.9) * 0.25 * aspect, cos(t * 0.7) * 0.3);
        vec2 emitter2 = vec2(cos(t * 0.65) * 0.22 * aspect, sin(t * 1.05) * 0.32);
        vec2 emitter3 = vec2(sin(t * 0.5 + 2.0) * 0.18 * aspect, cos(t * 0.9 + 1.2) * 0.22);
        vec2 ptr = (u_pointer - 0.5) * vec2(aspect, 1.0);

        float dPtr = length(p - ptr);
        vec2 ptrWarp = u_pointerVel * exp(-dPtr * 3.0) * (u_mouseForce * 0.16);

        vec2 q = vec2(
          fbm(p * 2.2 + vec2(0.0, t * 0.85)),
          fbm(p * 2.2 + vec2(5.2, -t * 0.75))
        );

        vec2 r = vec2(
          fbm(p * 2.5 + 2.5 * q + vec2(1.7, 9.2) + 0.45 * t + ptrWarp),
          fbm(p * 2.5 + 2.5 * q + vec2(8.3, 2.8) - 0.4 * t - ptrWarp)
        );

        float fluidField = fbm(p * 1.9 + 2.4 * r);

        // Liquid ribbons over pure OLED #000000 background
        float plume1 = exp(-length(p - emitter1 + (r - 0.5) * 0.65) * 2.1);
        float plume2 = exp(-length(p - emitter2 - (q - 0.5) * 0.6) * 2.25);
        float plume3 = exp(-length(p - emitter3 + (q - r) * 0.45) * 2.4);
        float ptrPlume = exp(-dPtr * 2.6) * 0.85;

        float density = clamp(
          fluidField * (plume1 * 1.45 + plume2 * 1.3 + plume3 * 1.15 + ptrPlume),
          0.0,
          1.0
        );

        // Keep deep OLED black in empty regions while making liquid plumes pop
        density = smoothstep(0.14, 0.78, density);

        float bayer = (bayer4x4(cellCoord) - 0.5) * 0.085;
        float grain = (hash(cellCoord + fract(u_time)) - 0.5) * 0.03;
        float d = clamp(density + bayer + grain, 0.0, 1.0);

        vec3 col = u_c0;
        if (d < 0.30) {
          col = mix(u_c0, u_c1, smoothstep(0.02, 0.30, d));
        } else if (d < 0.68) {
          col = mix(u_c1, u_c2, (d - 0.30) / 0.38);
        } else {
          col = mix(u_c2, u_c3, (d - 0.68) / 0.32);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uPixelSize = gl.getUniformLocation(program, "u_pixelSize");
    const uPointer = gl.getUniformLocation(program, "u_pointer");
    const uPointerVel = gl.getUniformLocation(program, "u_pointerVel");
    const uMouseForce = gl.getUniformLocation(program, "u_mouseForce");
    const uC0 = gl.getUniformLocation(program, "u_c0");
    const uC1 = gl.getUniformLocation(program, "u_c1");
    const uC2 = gl.getUniformLocation(program, "u_c2");
    const uC3 = gl.getUniformLocation(program, "u_c3");

    const activePalette = theme === "light" ? lightPalette : darkPalette;
    const c0 = hexToRgbNormalized(activePalette[0] || "#000000");
    const c1 = hexToRgbNormalized(activePalette[1] || "#1f0010");
    const c2 = hexToRgbNormalized(activePalette[2] || "#c80050");
    const c3 = hexToRgbNormalized(activePalette[3] || "#ff2a7a");

    gl.uniform3fv(uC0, c0);
    gl.uniform3fv(uC1, c1);
    gl.uniform3fv(uC2, c2);
    gl.uniform3fv(uC3, c3);
    gl.uniform1f(uMouseForce, mouseForce);

    const updateSize = () => {
      const scale = Math.max(0.2, Math.min(1.0, resolution));
      const width = Math.max(1, Math.floor(window.innerWidth * scale));
      const height = Math.max(1, Math.floor(window.innerHeight * scale));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uPixelSize, Math.max(1.0, pixelSize * scale));
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    let pointerX = 0.5;
    let pointerY = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;
    let velX = 0;
    let velY = 0;

    const handlePointerMove = (clientX: number, clientY: number) => {
      const nx = clientX / Math.max(1, window.innerWidth);
      const ny = 1.0 - clientY / Math.max(1, window.innerHeight);
      velX = (nx - targetX) * 4.0;
      velY = (ny - targetY) * 4.0;
      targetX = nx;
      targetY = ny;
    };

    const onMouseMove = (e: MouseEvent) =>
      handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    let rafId = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      pointerX += (targetX - pointerX) * 0.08;
      pointerY += (targetY - pointerY) * 0.08;
      velX *= 0.92;
      velY *= 0.92;

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uPointer, pointerX, pointerY);
      gl.uniform2f(uPointerVel, velX, velY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [darkPalette, lightPalette, pixelSize, resolution, mouseForce, theme]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 w-screen h-screen z-0 block ${className}`}
        style={{ imageRendering: "pixelated" }}
      />
      {children ? <div className="relative z-10 h-full">{children}</div> : null}
    </>
  );
}
