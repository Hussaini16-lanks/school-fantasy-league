import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Court from '../components/Court'
import Jersey from '../components/Jersey'

// Same spots as My Team
const COURT_SPOTS = [
  { x: 50, y: 28 },
  { x: 18, y: 50 },
  { x: 82, y: 50 },
  { x: 32, y: 79 },
  { x: 68, y: 79 },
]

// The "Points" view: any manager's squad + points for a played gameweek
export default function ManagerTeam() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [players, setPlayers] = useState({})
  const [gwNames, setGwNames] = useState({})
  const [gws, setGws] = useState([])        // this manager's points per gameweek
  const [gwIndex, setGwIndex] = useState(0)
  const [detail, setDetail] = useState(null) // squad + points for the chosen gameweek
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Manager, players and their gameweek scores
  useEffect(() => {
    async function load() {
      setLoading(true)
      const [profRes, playersRes, pointsRes, gwRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, team_name').eq('id', id).single(),
        supabase.from('players').select('id, name, jersey_number, house:houses(id, short_name, color)'),
        supabase.rpc('manager_points'),
        supabase.from('gameweeks').select('id, name'),
      ])
      const err = profRes.error || playersRes.error || pointsRes.error || gwRes.error
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const mine = pointsRes.data
        .filter((r) => r.user_id === id)
        .sort((a, b) => a.gameweek_id - b.gameweek_id)

      setProfile(profRes.data)
      setPlayers(Object.fromEntries(playersRes.data.map((p) => [p.id, p])))
      setGwNames(Object.fromEntries(gwRes.data.map((g) => [g.id, g.name])))
      setGws(mine)
      setGwIndex(Math.max(mine.length - 1, 0)) // start on the latest gameweek
      setLoading(false)
    }
    load()
  }, [id])

  // Squad detail whenever the chosen gameweek changes
  const current = gws[gwIndex]
  const currentGw = current?.gameweek_id
  useEffect(() => {
    if (!currentGw) return
    setDetail(null)
    supabase
      .rpc('manager_gameweek_detail', { p_user: id, p_gw: currentGw })
      .then(({ data, error }) => (error ? setError(error.message) : setDetail(data)))
  }, [id, currentGw])

  if (loading) return <p className="status">Loading team…</p>
  if (error) return <p className="error">Couldn't load team: {error}</p>

  const teamName = profile.team_name || `${profile.display_name}'s Team`
  const seasonTotal = gws.reduce((sum, g) => sum + g.total_points, 0)
  const starters = detail?.filter((r) => r.is_starter) ?? []
  const bench = (detail?.filter((r) => !r.is_starter) ?? []).sort((a, b) => a.bench_order - b.bench_order)

  function renderCard(r) {
    const p = players[r.player_id]
    if (!p) return null
    const subbedOut = r.is_starter && !r.played
    const subbedIn = !r.is_starter && r.counts
    const label = r.counts ? r.points * r.multiplier : subbedOut ? 'DNP' : r.points

    return (
      <Link to={`/player/${p.id}`} className={`player-card ${r.counts ? '' : 'faded'}`}>
        <div className="jersey-wrap">
          <Jersey color={p.house.color} number={p.jersey_number} />
          {r.is_captain && <span className="badge-c">C</span>}
          {r.is_vice_captain && <span className="badge-c vice">V</span>}
          {subbedIn && <span className="badge-sub in" title="Auto-subbed in">↑</span>}
          {subbedOut && <span className="badge-sub out" title="Didn't play">↓</span>}
        </div>
        <span className="card-name">{p.name}</span>
        <span className="card-points">{label}</span>
      </Link>
    )
  }

  return (
    <div className="points-view">
      <Link to="/leaderboard" className="back-link">← Leaderboard</Link>

      <section className="team-header">
        <div>
          <p className="eyebrow">{profile.display_name}</p>
          <h1>{teamName}</h1>
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-label">GW points</span>
            <span className="stat-value">{current?.total_points ?? 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Attendance</span>
            <span className="stat-value">+{current?.attendance_points ?? 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Season</span>
            <span className="stat-value">{seasonTotal}</span>
          </div>
        </div>
      </section>

      {gws.length === 0 ? (
        <p className="muted">No points yet. This team hasn't played a gameweek.</p>
      ) : (
        <>
          <div className="gw-switcher">
            <button className="chip" disabled={gwIndex === 0} onClick={() => setGwIndex(gwIndex - 1)}>‹</button>
            <span>{gwNames[currentGw]}</span>
            <button className="chip" disabled={gwIndex === gws.length - 1} onClick={() => setGwIndex(gwIndex + 1)}>›</button>
          </div>

          {!detail ? (
            <p className="status">Loading gameweek…</p>
          ) : (
            <>
              <Court>
                {COURT_SPOTS.map((spot, i) => (
                  <div key={i} className="court-slot" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
                    {starters[i] && renderCard(starters[i])}
                  </div>
                ))}
              </Court>

              <div className="bench">
                <div className="bench-title">
                  Bench <span className="tag">↑ auto-subbed in · ↓ didn't play</span>
                </div>
                <div className="bench-row">
                  {bench.map((r, i) => (
                    <div key={r.player_id} className="bench-slot">
                      <span className="bench-no">{i + 1}</span>
                      {renderCard(r)}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}