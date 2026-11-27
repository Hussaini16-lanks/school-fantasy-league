// A basketball jersey drawn in the house colour, with the number
// in black or white depending on which is easier to read.

const SHAPE = 'M14 2 H22 Q30 14 38 2 H46 Q48 20 58 26 V62 H2 V26 Q12 20 14 2 Z'

function inkFor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return brightness > 0.6 ? '#0b1530' : '#ffffff'
}

export default function Jersey({ color, number, empty = false }) {
  if (empty) {
    return (
      <svg className="jersey" viewBox="0 0 60 64" aria-hidden="true">
        <path d={SHAPE} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.5)"
              strokeWidth="2" strokeDasharray="4 3" />
        <text x="30" y="50" textAnchor="middle" fontSize="22" fontWeight="700"
              fill="rgba(255,255,255,0.7)">+</text>
      </svg>
    )
  }

  const ink = inkFor(color)
  return (
    <svg className="jersey" viewBox="0 0 60 64" aria-hidden="true">
      <path d={SHAPE} fill={color} strokeWidth="2"
            stroke={ink === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(11,21,48,0.55)'} />
      <path d="M22 2 Q30 14 38 2" fill="none" stroke={ink} strokeOpacity="0.5" strokeWidth="2" />
      {number != null && (
        <text x="30" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill={ink}
              fontFamily="'Barlow Condensed', sans-serif">
          {number}
        </text>
      )}
    </svg>
  )
}
