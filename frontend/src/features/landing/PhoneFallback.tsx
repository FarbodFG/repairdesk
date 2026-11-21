import { useId } from 'react'

export function PhoneFallback({
  exploded = true,
  onToggle,
}: {
  exploded?: boolean
  onToggle?: () => void
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="device-poster" viewBox="0 0 560 500" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-metal`}
          x1="0"
          y1="0"
          x2="160"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#b3c9b8" />
          <stop offset=".3" stopColor="#355c51" />
          <stop offset=".7" stopColor="#152e29" />
          <stop offset="1" stopColor="#8b9f87" />
        </linearGradient>
        <linearGradient
          id={`${id}-screen`}
          x1="10"
          y1="0"
          x2="150"
          y2="290"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#082c39" />
          <stop offset=".55" stopColor="#147b70" />
          <stop offset="1" stopColor="#031d23" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#55c5a5" stopOpacity=".16" />
          <stop offset="1" stopColor="#55c5a5" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="6" y="6" width="148" height="298" rx="22" />
        </clipPath>
      </defs>
      <ellipse cx="280" cy="260" rx="240" ry="220" fill={`url(#${id}-glow)`} />
      <ellipse
        cx="280"
        cy="424"
        rx="115"
        ry="22"
        fill="#153a30"
        stroke="#4f8870"
        strokeOpacity=".4"
      />
      <ellipse cx="280" cy="424" rx="90" ry="15" stroke="#bda16b" strokeOpacity=".5" />
      <ellipse
        cx="280"
        cy="249"
        rx="220"
        ry="176"
        transform="rotate(-27 280 249)"
        stroke="#ae9060"
        strokeOpacity=".75"
      />
      <ellipse
        cx="280"
        cy="249"
        rx="237"
        ry="169"
        transform="rotate(20 280 249)"
        stroke="#497461"
        strokeOpacity=".6"
      />
      <g transform={`translate(${exploded ? 308 : 218} 92) rotate(13 80 155)`} onClick={onToggle}>
        <rect width="160" height="310" rx="25" fill={`url(#${id}-metal)`} stroke="#a5b9a1" />
        <rect x="8" y="8" width="144" height="294" rx="21" fill="#21463a" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx={i === 1 ? 66 : 30} cy={i === 2 ? 72 : 34} r="15" fill="#749283" />
            <circle
              cx={i === 1 ? 66 : 30}
              cy={i === 2 ? 72 : 34}
              r="11"
              fill="#06161b"
              stroke="#507b8f"
            />
            <circle
              cx={i === 1 ? 63 : 27}
              cy={i === 2 ? 69 : 31}
              r="3"
              fill="#b9e9e8"
              opacity=".5"
            />
          </g>
        ))}
        <circle cx="109" cy="37" r="5" fill="#f1e0ac" />
      </g>
      <g transform="translate(220 94) rotate(-8 80 155)" onClick={onToggle}>
        <rect width="154" height="302" rx="22" fill="#07372c" stroke="#7c9c76" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M${12 + i * 12} 12V${65 + (i % 3) * 10}L77 132L${12 + i * 12} 214V286`}
            stroke={i % 3 === 0 ? '#b6a773' : '#399d7f'}
            strokeWidth="1"
            opacity=".75"
          />
        ))}
        <rect x="44" y="73" width="69" height="69" rx="6" fill="#ab9769" />
        <rect x="51" y="80" width="55" height="55" rx="3" fill="#192e25" />
        <circle cx="79" cy="107" r="15" stroke="#8ce4c1" />
        <text x="79" y="112" textAnchor="middle" fill="#c3f1d4" fontSize="12" fontFamily="Arial">
          SC
        </text>
        <rect x="32" y="165" width="91" height="113" rx="8" fill="#122923" stroke="#456b53" />
        <circle cx="77" cy="220" r="33" stroke="#48836c" />
      </g>
      <g transform={`translate(${exploded ? 126 : 216} 76) rotate(-16 80 155)`} onClick={onToggle}>
        <rect
          width="160"
          height="310"
          rx="25"
          fill={`url(#${id}-metal)`}
          stroke="#b0c8b4"
          strokeWidth="1.5"
        />
        <rect x="5" y="5" width="150" height="300" rx="22" fill={`url(#${id}-screen)`} />
        <g clipPath={`url(#${id}-clip)`}>
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cx="128"
              cy="213"
              rx={58 + i * 19}
              ry={103 + i * 20}
              transform="rotate(-30 128 213)"
              stroke={i === 2 ? '#e8c98e' : '#8df1cc'}
              strokeOpacity={i === 2 ? '.85' : '.25'}
            />
          ))}
        </g>
        <rect x="59" y="13" width="42" height="8" rx="4" fill="#041a1d" />
        <text
          x="80"
          y="66"
          textAnchor="middle"
          fill="#e9d3a9"
          fontSize="9"
          letterSpacing="2"
          fontFamily="Arial"
        >
          SUN CITY
        </text>
        <text x="80" y="104" textAnchor="middle" fill="#eef7e8" fontSize="33" fontFamily="Arial">
          09:41
        </text>
        <circle cx="80" cy="193" r="18" stroke="#efd49c" strokeWidth="1.5" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M80 164V158"
            stroke="#efd49c"
            strokeWidth="1.5"
            transform={`rotate(${i * 30} 80 193)`}
          />
        ))}
        <rect x="57" y="292" width="46" height="2" rx="1" fill="#d4eade" />
      </g>
      {[
        [81, 180],
        [454, 328],
        [160, 406],
        [391, 68],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 3 : 2} fill={i % 2 ? '#c5ac78' : '#88d2b7'} />
      ))}
    </svg>
  )
}
