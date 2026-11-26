export default function HouseBadge({ house }) {
  return (
    <span className="house-badge">
      <span className="house-dot" style={{ background: house.color }} />
      {house.name}
    </span>
  )
}