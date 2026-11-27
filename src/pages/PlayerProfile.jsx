import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Jersey from '../components/Jersey'
import HouseBadge from '../components/HouseBadge'
import { usePlayerDetails, gwShort } from '../lib/playerData'

const fmt = (n) => Number(n).toFixed(1)
const perGame = (total, games) => (games ? fmt(total / games) : '0.0')

export default function PlayerProfile() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [selectedPct, setSelectedPct] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('players')
      .select('id, name, position, jersey_number, price, house:houses(id, name, short_name, color)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setPlayer(data)))

    supabase.rpc('player_selection').then(({ data }) => {
      const row = (data ?? []).find((r) => r.player_id === Number(id))
      setSelectedPct(row?.selected_pct ?? 0)
    })
  }, [id])

  const d = usePlayerDetails(player?.id, player?.house.id)

  if (error) return <p className="error">Couldn't load player: {error}</p>
  if (!player || !d) return <p className="status">Loading player…</p>

  const games = d.log.length
  const sum = (key) => d.log.reduce((total, g) => total + g[key], 0)

  return (
    <>
      <Link to="/team" className="back-link">← Back to My Team</Link>

      <div className="sheet-hero profile-hero">
        <div className="sheet-jersey">
          <Jersey color={player.house.color} number={player.jersey_number} />
        </div>
        <div>
          <p className="eyebrow">{player.position} · #{player.jersey_number}</p>
          <h2>{player.name}</h2>
          <HouseBadge house={player.house} />
        </div>
      </div>

      {/* Fantasy numbers */}
      <div className="tiles">
        <div className="stat"><span className="stat-label">Price</span><span className="stat-value">{fmt(player.price)}</span></div>
        <div className="stat"><span className="stat-label">Total pts</span><span className="stat-value">{d.totalPoints}</span></div>
        <div className="stat"><span className="stat-label">Pts / Match</span><span className="stat-value">{d.pointsPerGame}</span></div>
        <div className="stat"><span className="stat-label">Form</span><span className="stat-value">{d.form}</span></div>
        <div className="stat"><span className="stat-label">Selected</span><span className="stat-value">{selectedPct}%</span></div>
      </div>

      {/* Real basketball averages */}
      <h2 className="section-title">Season averages <span className="tag">{games} game{games === 1 ? '' : 's'}</span></h2>
      <div className="tiles">
        <div className="stat"><span className="stat-label">PPG</span><span className="stat-value">{perGame(sum('points'), games)}</span></div>
        <div className="stat"><span className="stat-label">RPG</span><span className="stat-value">{perGame(sum('rebounds'), games)}</span></div>
        <div className="stat"><span className="stat-label">APG</span><span className="stat-value">{perGame(sum('assists'), games)}</span></div>
        <div className="stat"><span className="stat-label">SPG</span><span className="stat-value">{perGame(sum('steals'), games)}</span></div>
        <div className="stat"><span className="stat-label">BPG</span><span className="stat-value">{perGame(sum('blocks'), games)}</span></div>
      </div>

      {/* Game log */}
      <h2 className="section-title">Game log</h2>
      {games === 0 ? (
        <p className="muted">No games played yet this season.</p>
      ) : (
        <div className="table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>GW</th><th>Opponent</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Fantasy</th>
              </tr>
            </thead>
            <tbody>
              {d.log.map((g) => {
                const opp = d.houses[g.opponent_house_id]
                return (
                  <tr key={g.fixture_id}>
                    <td>{gwShort(g.gameweek_name)}</td>
                    <td>
                      <span className="opp">
                        <span className="house-dot" style={{ background: opp?.color }} />
                        {opp?.name} ({g.is_home ? 'H' : 'A'})
                      </span>
                    </td>
                    <td>{g.points}</td>
                    <td>{g.rebounds}</td>
                    <td>{g.assists}</td>
                    <td>{g.steals}</td>
                    <td>{g.blocks}</td>
                    <td className="fp">{g.fantasy_points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upcoming */}
      <h2 className="section-title">Upcoming fixtures</h2>
      {d.fixtures.length === 0 ? (
        <p className="muted">No upcoming games.</p>
      ) : (
        <div className="fixture-chips">
          {d.fixtures.map((f) => {
            const opp = d.houses[f.opponentId]
            return (
              <span key={f.id} className="fixture-chip">
                <strong>{gwShort(f.gameweek)}</strong>
                <span className="house-dot" style={{ background: opp?.color }} />
                {opp?.name} ({f.isHome ? 'H' : 'A'})
              </span>
            )
          })}
        </div>
      )}
    </>
  )
}