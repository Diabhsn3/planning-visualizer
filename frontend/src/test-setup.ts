import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const noop = () => undefined;
    return {
      canvas: {} as HTMLCanvasElement,
      fillRect: noop,
      clearRect: noop,
      strokeRect: noop,
      fillText: noop,
      strokeText: noop,
      measureText: () => ({ width: 0 }) as TextMetrics,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      arcTo: noop,
      bezierCurveTo: noop,
      quadraticCurveTo: noop,
      rect: noop,
      ellipse: noop,
      fill: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      setTransform: noop,
      getTransform: () => ({}) as DOMMatrix,
      resetTransform: noop,
      transform: noop,
      drawImage: noop,
      getImageData: () => ({ data: new Uint8ClampedArray() }) as ImageData,
      putImageData: noop,
      createImageData: () => ({}) as ImageData,
      createLinearGradient: () => ({ addColorStop: noop }) as unknown as CanvasGradient,
      createRadialGradient: () => ({ addColorStop: noop }) as unknown as CanvasGradient,
      createPattern: () => null,
      clip: noop,
      isPointInPath: () => false,
      isPointInStroke: () => false,
      setLineDash: noop,
      getLineDash: () => [],
      lineDashOffset: 0,
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      miterLimit: 10,
      shadowBlur: 0,
      shadowColor: "rgba(0,0,0,0)",
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      direction: "inherit",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
    } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
