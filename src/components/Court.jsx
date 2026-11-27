// A basketball half-court (hoop at the top, half-court line at the bottom).
// Anything passed as children is placed on top of it.

export default function Court({ children }) {
  return (
    <div className="court">
      <svg className="court-lines" viewBox="0 0 500 470" aria-hidden="true">
        {/* Boundary */}
        <rect x="2" y="2" width="496" height="466" />
        {/* The paint (key) */}
        <rect className="paint" x="170" y="2" width="160" height="188" />
        {/* Free-throw circle */}
        <circle cx="250" cy="190" r="60" />
        {/* Three-point line */}
        <path d="M30 2 V142 A237.5 237.5 0 0 0 470 142 V2" />
        {/* Backboard, restricted area and rim */}
        <line x1="220" y1="40" x2="280" y2="40" />
        <path d="M210 52 A40 40 0 0 0 290 52" />
        <circle className="rim" cx="250" cy="52" r="8" />
        {/* Half-court circle */}
        <path d="M190 468 A60 60 0 0 1 310 468" />
      </svg>
      {children}
    </div>
  )
}
