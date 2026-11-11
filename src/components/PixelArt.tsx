import React from 'react';

type PixelArtProps = {
  scale?: number;
  className?: string;
};

// Simple 8x8 pixel art rendered as div grid. Characters map to colors.
const PATTERN = [
  '..xx..xx',
  '.xxxxxxx',
  '.xxyyxxx',
  '..xyyyx.',
  '...yy...',
  '..x..x..',
  '.x....x.',
  '........',
];

const COLOR_MAP: Record<string, string> = {
  '.': 'transparent',
  'x': '#65a30d', // green
  'y': '#ffd166', // amber / yellow
};

export default function PixelArt({ scale = 6, className }: PixelArtProps) {
  const pixelSize = 4; // base pixel size
  const size = pixelSize * scale;

  return (
    <div
      className={className ? `pixel-art ${className}` : 'pixel-art'}
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(8, ${size}px)`,
        gridTemplateRows: `repeat(8, ${size}px)`,
        imageRendering: 'pixelated',
        lineHeight: 0,
      }}
      aria-hidden
    >
      {PATTERN.flatMap((row, ry) =>
        Array.from(row).map((ch, rx) => (
          <div
            key={`${rx}-${ry}`}
            style={{
              width: size,
              height: size,
              background: COLOR_MAP[ch] ?? 'transparent',
            }}
          />
        ))
      )}
    </div>
  );
}
