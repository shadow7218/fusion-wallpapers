"use client";

import React from "react";

export type GlassShapeType = "rounded" | "circle" | "pill";

export interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: GlassShapeType;
  borderRadius?: number;
  tintOpacity?: number;
  blurRadius?: number;
  warp?: boolean;
  activeWhite?: boolean;
  children: React.ReactNode;
}

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  typeShape?: GlassShapeType;
  size?: number;
  borderRadius?: number;
  tintOpacity?: number;
  blurRadius?: number;
  warp?: boolean;
  activeWhite?: boolean;
  children: React.ReactNode;
}

export function LiquidGlassShaderDefs() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed h-0 w-0 opacity-0"
    >
      <defs>
        <filter
          id="liquid-glass-refraction"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.015"
            numOctaves="2"
            seed="4"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.5" result="smoothNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="smoothNoise"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  (
    {
      type = "rounded",
      borderRadius = 24,
      tintOpacity = 0.18,
      blurRadius = 22,
      warp = false,
      activeWhite = false,
      className = "",
      style,
      children,
      ...props
    },
    ref
  ) => {
    const shapeClass =
      type === "circle"
        ? "glass-container-circle"
        : type === "pill"
        ? "glass-container-pill"
        : "glass-container-rounded";

    const hasCustomPosition = /\b(absolute|fixed|sticky)\b/.test(className);
    const positionClass = hasCustomPosition ? "" : "relative";

    const customStyles: React.CSSProperties = {
      "--lg-border-radius": `${borderRadius}px`,
      "--lg-tint-opacity": tintOpacity,
      "--lg-blur-radius": `${blurRadius}px`,
      ...style,
    } as React.CSSProperties;

    return (
      <div
        ref={ref}
        style={customStyles}
        className={`${positionClass} glass-container ${shapeClass} ${
          warp ? "glass-warp" : ""
        } ${activeWhite ? "glass-active-white" : ""} ${className}`}
        {...props}
      >
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    );
  }
);
GlassContainer.displayName = "GlassContainer";

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      typeShape = "pill",
      size,
      borderRadius = 20,
      tintOpacity = 0.22,
      blurRadius = 22,
      warp = false,
      activeWhite = false,
      className = "",
      style,
      children,
      ...props
    },
    ref
  ) => {
    const shapeClass =
      typeShape === "circle"
        ? "glass-container-circle glass-button-circle"
        : typeShape === "pill"
        ? "glass-container-pill"
        : "glass-container-rounded";

    const hasCustomPosition = /\b(absolute|fixed|sticky)\b/.test(className);
    const positionClass = hasCustomPosition ? "" : "relative";

    const customStyles: React.CSSProperties = {
      "--lg-border-radius": `${borderRadius}px`,
      "--lg-tint-opacity": tintOpacity,
      "--lg-blur-radius": `${blurRadius}px`,
      ...(size && typeShape === "circle"
        ? { width: `${size}px`, height: `${size}px` }
        : {}),
      ...style,
    } as React.CSSProperties;

    return (
      <button
        ref={ref}
        type={props.type || "button"}
        style={customStyles}
        className={`${positionClass} glass-container glass-button ${shapeClass} ${
          warp ? "glass-warp" : ""
        } ${activeWhite ? "glass-active-white" : ""} ${className}`}
        {...props}
      >
        <span className="glass-button-text w-full h-full">{children}</span>
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";
