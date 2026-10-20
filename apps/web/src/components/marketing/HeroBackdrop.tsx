const WIDTH = 1440;
const HEIGHT = 760;
const CENTER_Y = 300;
const TIP_X = 1150;
const RINGS = 7;
const GAP = 46;
const INNER = 150;

const PULSES: Array<{ ring: number; side: "top" | "bottom"; duration: number; delay: number }> = [
  { ring: 0, side: "top", duration: 6.5, delay: 0 },
  { ring: 1, side: "bottom", duration: 8, delay: 2.2 },
  { ring: 2, side: "top", duration: 7.2, delay: 4.1 },
  { ring: 3, side: "bottom", duration: 9, delay: 1.1 },
  { ring: 4, side: "top", duration: 8.4, delay: 5.6 },
  { ring: 5, side: "bottom", duration: 10, delay: 3.3 },
];

function ring(index: number) {
  const half = INNER + index * GAP;
  const tip = TIP_X + index * GAP * Math.SQRT2;
  return {
    top: `M -40 ${CENTER_Y - half} H ${tip - half} L ${tip} ${CENTER_Y}`,
    bottom: `M -40 ${CENTER_Y + half} H ${tip - half} L ${tip} ${CENTER_Y}`,
  };
}

const rings = Array.from({ length: RINGS }, (_, index) => ring(index));

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
      <div className="absolute right-[2%] top-[160px] h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(0,87,255,0.16),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(31,181,255,0.14),transparent)]" />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMaxYMin slice"
        className="absolute inset-0 size-full [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_30%),linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <defs>
          <linearGradient id="hero-send-pulse" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WIDTH} y2="0">
            <stop offset="0" stopColor="#0057ff" stopOpacity="0" />
            <stop offset="0.45" stopColor="#0057ff" />
            <stop offset="0.8" stopColor="#1fb5ff" />
            <stop offset="1" stopColor="#85fcff" />
          </linearGradient>
        </defs>

        <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/[0.08]">
          {rings.map((path, index) => (
            <g key={index}>
              <path d={path.top} />
              <path d={path.bottom} />
            </g>
          ))}
        </g>

        <g fill="none" stroke="url(#hero-send-pulse)" strokeWidth="2" strokeLinecap="round" className="motion-reduce:hidden">
          {PULSES.map((pulse) => (
            <path
              key={`${pulse.ring}-${pulse.side}`}
              d={rings[pulse.ring]![pulse.side]}
              pathLength={1000}
              strokeDasharray="90 2000"
              strokeDashoffset={90}
              className="animate-[hero-send_var(--duration)_linear_infinite]"
              style={{ "--duration": `${pulse.duration}s`, animationDelay: `${pulse.delay}s` } as React.CSSProperties}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
