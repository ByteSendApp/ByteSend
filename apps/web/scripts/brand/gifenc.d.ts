declare module "gifenc" {
  type Palette = number[][];
  type Format = "rgb565" | "rgb444" | "rgba4444";
  interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette;
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  const gifenc: {
    GIFEncoder(): Encoder;
    quantize(
      rgba: Uint8Array,
      maxColors: number,
      options?: { format?: Format; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
    ): Palette;
    applyPalette(rgba: Uint8Array, palette: Palette, format?: Format): Uint8Array;
  };
  export default gifenc;
}
