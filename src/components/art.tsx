export type IconName =
  | "leaf"
  | "basket"
  | "compass"
  | "chart"
  | "help"
  | "sun"
  | "hand"
  | "rake"
  | "flag"
  | "arrow"
  | "close"
  | "volume"
  | "mute"
  | "download"
  | "spark"
  | "mountain";
export function Icon({
  name,
  size = 22,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    leaf: (
      <>
        <path d="M20 3C8 2 3 7 5 14c2 7 14 5 15-11Z" />
        <path d="m3 21 12-12M8 16l-1-5m5 1 5 1" />
      </>
    ),
    basket: (
      <>
        <path d="m3 10 3 10h12l3-10H3Zm4 0 5-7 5 7M9 13v4m6-4v4M2 10h20" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10m8 10V4m8 16v-7M2 21h20" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
      </>
    ),
    hand: (
      <>
        <path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v10c0 4-3 6-7 6-3 0-5-2-6-4l-3-5c-1-2 1-3 3-2l1 1Z" />
      </>
    ),
    rake: (
      <>
        <path d="m5 21 9-12m-5-7 10 7M8 3l-3 4m8-1-3 4m8-1-3 4m8-1-3 4M6 7l13 9" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3c6-5 8 4 15 0v10c-7 4-9-5-15 0" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    volume: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m-6 0 6-6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
      </>
    ),
    mountain: (
      <>
        <path d="m2 20 8-15 5 8 3-4 5 11H2Zm5-9 3 2 3-3" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function MushroomArt({
  color = "#db824c",
  size = 32,
  className = "",
}: {
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="m16 21-2 12c0 4 13 4 12 0l-2-12"
        fill="#f7e9c6"
        stroke="#674e35"
        strokeWidth="1.5"
      />
      <path
        d="M4 22C3 13 11 5 20 5s17 8 16 17c-7 4-25 4-32 0Z"
        fill={color}
        stroke="#674e35"
        strokeWidth="1.5"
      />
      <path
        d="M9 16c2-4 5-6 9-7"
        stroke="#fff4d5"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".65"
      />
      <ellipse cx="27" cy="16" rx="3" ry="2" fill="#fff0d2" opacity=".75" />
      <circle cx="15" cy="19" r="2" fill="#fff0d2" opacity=".75" />
    </svg>
  );
}
export function ForestArt() {
  return (
    <svg
      className="forest-art"
      viewBox="0 0 560 270"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="hill"
          x1="300"
          y1="90"
          x2="300"
          y2="270"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#b9c898" />
          <stop offset="1" stopColor="#839c69" />
        </linearGradient>
      </defs>
      <circle cx="386" cy="64" r="36" fill="#edca77" opacity=".7" />
      <path
        d="M26 209c73-87 152-27 201-73 70-65 179-8 216 22 33-12 76-18 117 18v94H26Z"
        fill="#cbd2ac"
      />
      <path
        d="M75 240c106-93 178-26 253-75 73-47 145-16 232 42v63H75Z"
        fill="url(#hill)"
      />
      {[
        { x: 146, y: 37, s: 0.8 },
        { x: 470, y: 0, s: 1.3 },
        { x: 515, y: 55, s: 0.8 },
        { x: 230, y: 10, s: 1.1 },
        { x: 93, y: 95, s: 0.65 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
          <path
            d="M0 195V76"
            stroke="#70694c"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M0 4c-11 25-27 39-30 56h11c-12 16-29 28-33 48h16c-13 18-24 30-26 46 24 15 91 13 120-1-8-22-21-35-32-46h17C34 86 25 72 17 61h11C16 43 6 22 0 4Z"
            fill={i % 2 ? "#496a4d" : "#6f895e"}
          />
          <path d="M0 30v127" stroke="#a3b38a" strokeWidth="2" opacity=".35" />
        </g>
      ))}
      <path
        d="M345 172c-11 29-96 19-117 47-10 12 20 34 43 51h140c-54-18-109-39-104-47 7-12 77-17 77-37Z"
        fill="#dcc49a"
      />
      <g transform="translate(318 135) rotate(8)">
        <path d="M9 42C-3-3 63-7 59 42" stroke="#8b6039" strokeWidth="9" />
        <path
          d="m-3 32 8 57c18 11 41 9 57-3l6-55Z"
          fill="#bc894f"
          stroke="#7e5937"
          strokeWidth="3"
        />
        <path
          d="m2 48 60-2M4 61l56-2M6 76l52-3M15 38l5 52m12-53 3 54m12-54-1 50"
          stroke="#e0b16a"
          strokeWidth="4"
        />
        <path d="M-3 33c16 7 48 6 71-2" stroke="#745133" strokeWidth="8" />
        <path d="m20 32-1-23 12-1 3 26" fill="#f5e6bd" />
        <path d="M4 11C5-17 43-18 47 8 36 15 18 17 4 11Z" fill="#c87140" />
        <path d="m44 31 3-17 9 2-3 15" fill="#f5e6bd" />
        <path d="M36 16C38-3 65-1 69 19c-11 4-24 2-33-3Z" fill="#dfae45" />
        <ellipse cx="19" cy="0" rx="5" ry="3" fill="#efd29f" />
      </g>
      <g transform="translate(200 207)">
        <path
          d="m14 20-2 27h14l-3-27"
          fill="#f5e9cd"
          stroke="#7b6c48"
          strokeWidth="2"
        />
        <path
          d="M0 22C-1-7 38-8 40 21c-10 6-29 7-40 1Z"
          fill="#c96f44"
          stroke="#89513b"
          strokeWidth="2"
        />
        <ellipse cx="12" cy="10" rx="5" ry="3" fill="#f2d6a9" />
        <circle cx="29" cy="15" r="3" fill="#f2d6a9" />
      </g>
      <g transform="translate(436 212) scale(.65)">
        <path d="m14 20-2 27h14l-3-27" fill="#f5e9cd" />
        <path d="M0 22C-1-7 38-8 40 21c-10 6-29 7-40 1Z" fill="#d9ad43" />
      </g>
      <path
        d="m140 253-6-19m6 19 6-26m-6 26 14-12m310 6 2-24m-2 24 13-16m-13 16-9-13M280 180l-4-15m4 15 7-12"
        stroke="#496a4d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g fill="#edda9e">
        <ellipse cx="169" cy="233" rx="3" ry="2" />
        <ellipse cx="405" cy="210" rx="3" ry="2" />
        <ellipse cx="490" cy="259" rx="3" ry="2" />
      </g>
      <path
        d="m304 73 3-6 3 6-3 6-3-6Zm118 39 2-5 2 5-2 5-2-5Z"
        fill="#f6d681"
      />
    </svg>
  );
}
export function Sprout({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={`sprout sprout-${variant}`}
      aria-hidden="true"
    >
      <path
        d="M12 19v-6M12 15C4 16 5 8 5 8c6 0 7 7 7 7Zm0-3c0-6 7-7 7-7 1 6-7 7-7 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function ColorDot({ color }: { color: string }) {
  return <span className="color-dot" style={{ backgroundColor: color }} />;
}
