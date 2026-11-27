import { Link } from 'react-router-dom'
import Jersey from './Jersey'
import HouseBadge from './HouseBadge'
import { usePlayerDetails, gwShort } from '../lib/playerData'

const fmt = (n) => Number(n).toFixed(1)

function Opponent({ house, isHome }) {
  if (!house) return null
  return (
    <span className="opp">
      <span className="house-dot" style={{ background: house.color }} />
      {house.short_name} ({isHome ? 'H' : 'A'})
    </span>
  )
}

// The card that pops up when you tap a player on the court or bench
export default function PlayerSheet({
  player,
  isStarter,
  benchIndex,
  benchSize,
  isCaptain,
  isVice,
  selectedPct,
  onCaptain,
  onVice,
  onMoveBench,
  onSub,
  onRemove,
  onClose,
}) {
  const d = usePlayerDetails(player.id, player.house.id)
  const recent = d ? d.log.slice(-3) : []

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sheet-hero">
          <div className="sheet-jersey">
            <Jersey color={player.house.color} number={player.jersey_number} />
          </div>
          <div>
            <p className="eyebrow">{player.position}</p>
            <h2>{player.name}</h2>
            <HouseBadge house={player.house} />
          </div>
          <button className="chip sheet-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Price */}
        <div className="sheet-price">
          <span>Price</span>
          <strong>{fmt(player.price)} coins</strong>
        </div>

        {/* Key numbers */}
        <div className="sheet-stats">
          <div>
            <span className="stat-label">Pts / Match</span>
            <span className="stat-value">{d ? d.pointsPerGame : '…'}</span>
          </div>
          <div>
            <span className="stat-label">Form</span>
            <span className="stat-value">{d ? d.form : '…'}</span>
          </div>
          <div>
            <span className="stat-label">Selected</span>
            <span className="stat-value">{selectedPct ?? 0}%</span>
          </div>
        </div>

        {/* Last 3 games + next 3 fixtures */}
        <div className="sheet-boxes">
          <div>
            <h3>Form</h3>
            {!d ? (
              <p className="muted">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="muted">No games played yet</p>
            ) : (
              <div className="mini-row">
                {recent.map((g) => (
                  <div key={g.fixture_id} className="mini">
                    <span>{gwShort(g.gameweek_name)}</span>
                    <Opponent house={d.houses[g.opponent_house_id]} isHome={g.is_home} />
                    <span className="mini-pts">{g.fantasy_points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3>Fixtures</h3>
            {!d ? (
              <p className="muted">Loading…</p>
            ) : d.fixtures.length === 0 ? (
              <p className="muted">No upcoming games</p>
            ) : (
              <div className="mini-row">
                {d.fixtures.map((f) => {
                  const opp = d.houses[f.opponentId]
                  return (
                    <div key={f.id} className="mini">
                      <span>{gwShort(f.gameweek)}</span>
                      <Opponent house={opp} isHome={f.isHome} />
                      <span className="mini-strip" style={{ background: opp?.color }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Captaincy (starters) or bench order (subs) */}
        {isStarter ? (
          <div className="sheet-checks">
            <button className={`check ${isCaptain ? 'on' : ''}`} onClick={onCaptain}>
              <span className="check-box">{isCaptain ? '✓' : ''}</span> Captain
            </button>
            <button className={`check ${isVice ? 'on' : ''}`} onClick={onVice}>
              <span className="check-box">{isVice ? '✓' : ''}</span> Vice captain
            </button>
          </div>
        ) : (
          <div className="sheet-checks">
            <span className="muted">Sub #{benchIndex + 1}</span>
            <button className="btn-action" disabled={benchIndex === 0} onClick={() => onMoveBench(-1)}>
              ← Earlier
            </button>
            <button className="btn-action" disabled={benchIndex === benchSize - 1} onClick={() => onMoveBench(1)}>
              Later →
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="sheet-actions">
          <Link className="btn-outline" to={`/player/${player.id}`} target="_blank" rel="noreferrer">
            Full Profile ↗
          </Link>
          <button className="btn" onClick={onSub}>
            {isStarter ? 'Substitute' : 'Sub in'}
          </button>
        </div>
        <button className="link-btn danger-link" onClick={onRemove}>
          Remove from squad
        </button>
      </div>
    </div>
  )
}