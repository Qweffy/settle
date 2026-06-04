'use client';

import * as Lucide from 'lucide-react';
import type { CSSProperties } from 'react';

type IconComponent = (props: { size?: number | string }) => React.ReactElement;

const toPascal = (name: string) =>
  name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

// lucide renamed a handful of icons; map the design's kebab names to current exports.
const ALIASES: Record<string, string> = {
  'alert-triangle': 'TriangleAlert',
};

const lib = Lucide as unknown as Record<string, IconComponent | undefined>;

export function Icon({
  name,
  size = 16,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Cmp = lib[ALIASES[name] ?? ''] ?? lib[toPascal(name)] ?? Lucide.Circle;
  return (
    <span className={'icon ' + className} style={{ width: size, height: size, ...style }} aria-hidden>
      <Cmp size={size} />
    </span>
  );
}
