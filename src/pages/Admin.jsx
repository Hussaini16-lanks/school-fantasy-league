import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import HouseBadge from '../components/HouseBadge'

const STATS = ['points', 'rebounds', 'assists', 'steals', 'blocks']
const LABELS = { points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK' }
const emptyLine = () => ({ played: false, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })

export default function Admin() {
  const { profile } = useAuth()

  const [fixtures, setFixtures] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // The game being edited
  const [fixtureId, setFixtureId] = useState(null)
  const [status, setStatus] = useState('scheduled')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [lines, setLines] = useState({}) // player id -> { played, points, rebounds, ... }
  const [linesLoading, setLinesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // ---------- Load games + players ----------
  async function loadFixtures() {
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        id, status, home_score, away_score, gameweek_id,
        gameweek:gameweeks (name),
        home:houses!fixtures_home_house_id_fkey (id, name, short_name, color),
        away:houses!fixtures_away_house_id_fkey (id, name, short_name, color)
      `)
      .order('gameweek_id')
      .order('id')
    if (error) throw error
    setFixtures(data)
    return data
  }

  useEffect(() => {
    async function load() {
      try {
        const [, playersRes] = await Promise.all([
          loadFixtures(),
          supabase
            .from('players')
            .select('id, name, jersey_number, house_id')
            .eq('active', true)
            .order('jersey_number'),
        ])
        if (playersRes.error) throw playersRes.error
        setPlayers(playersRes.data)
      } catch (err) {
        setLoadError(err.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ---------- Open a game ----------
  async function openFixture(f) {
    setFixtureId(f.id)
    setStatus(f.status)
    setHomeScore(f.home_score ?? '')
    setAwayScore(f.away_score ?? '')
    setMessage(null)
    setLinesLoading(true)

    const { data, error } = await supabase.from('player_stats').select('*').eq('fixture_id', f.id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLinesLoading(false)
      return
    }

    // Start everyone as "didn't play", then fill in any saved stats
    const next = {}
    players
      .filter((p) => p.house_id === f.home.id || p.house_id === f.away.id)
      .forEach((p) => { next[p.id] = emptyLine() })
    data.forEach((s) => {
      next[s.player_id] = {
        played: true,
        points: s.points, rebounds: s.rebounds, assists: s.assists, steals: s.steals, blocks: s.blocks,
      }
    })
    setLines(next)
    setLinesLoading(false)
  }

  // ---------- Editing ----------
  function updateLine(playerId, field, value) {
    setLines((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }))
  }

  function setNumber(playerId, field, raw) {
    const n = Math.max(0, parseInt(raw, 10) || 0)
    updateLine(playerId, field, n)
  }

  function markAllPlayed(houseId, played) {
    setLines((prev) => {
      const next = { ...prev }
      players.filter((p) => p.house_id === houseId).forEach((p) => {
        next[p.id] = { ...next[p.id], played }
      })
      return next
    })
  }

  const fixture = fixtures.find((f) => f.id === fixtureId)

  function teamTotal(houseId) {
    return players
      .filter((p) => p.house_id === houseId && lines[p.id]?.played)
      .reduce((sum, p) => sum + (lines[p.id]?.points ?? 0), 0)
  }

  // ---------- Save ----------
  async function save() {
    setSaving(true)
    setMessage(null)

    const stats = Object.entries(lines)
      .filter(([, l]) => l.played)
      .map(([pid, l]) => ({
        player_id: Number(pid),
        points: l.points, rebounds: l.rebounds, assists: l.assists, steals: l.steals, blocks: l.blocks,
      }))

    const { error } = await supabase.rpc('admin_save_fixture', {
      p_fixture_id: fixtureId,
      p_status: status,
      p_home_score: homeScore === '' ? null : Number(homeScore),
      p_away_score: awayScore === '' ? null : Number(awayScore),
      p_stats: stats,
    })

    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: `Saved: ${stats.length} player stat lines. Points and leaderboard are updated.` })
      loadFixtures()
    }
  }

  // ---------- Render ----------
  if (!profile) return <p className="status">Loading…</p>
  if (!profile.is_admin) return <p className="error">This page is for admins only.</p>
  if (loading) return <p className="status">Loading games…</p>
  if (loadError) return <p className="error">Couldn't load games: {loadError}</p>

  // Group games by gameweek for the list
  const byGameweek = fixtures.reduce((acc, f) => {
    const key = f.gameweek?.name ?? `GW ${f.gameweek_id}`
    ;(acc[key] ??= []).push(f)
    return acc
  }, {})

  function renderHouseTable(house, score, setScore) {
    const squad = players.filter((p) => p.house_id === house.id)
    const total = teamTotal(house.id)

    return (
      <div className="admin-team">
        <div className="admin-team-head">
          <HouseBadge house={house} />
          <div className="score-entry">
            <input
              className="input score-input"
              type="number"
              min="0"
              placeholder="Score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            <button className="btn-ghost" onClick={() => setScore(String(total))} title="Use the sum of player points">
              Use total ({total})
            </button>
          </div>
        </div>

        <div className="admin-team-actions">
          <button className="link-btn" onClick={() => markAllPlayed(house.id, true)}>Tick all</button>
          <button className="link-btn" onClick={() => markAllPlayed(house.id, false)}>Untick all</button>
        </div>

        <div className="table-wrap">
          <table className="stats-table admin-table">
            <thead>
              <tr>
                <th>Played</th>
                <th>Player</th>
                {STATS.map((s) => <th key={s}>{LABELS[s]}</th>)}
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const line = lines[p.id] ?? emptyLine()
                return (
                  <tr key={p.id} className={line.played ? '' : 'not-played'}>
                    <td>
                      <input
                        type="checkbox"
                        className="played-box"
                        checked={line.played}
                        onChange={(e) => updateLine(p.id, 'played', e.target.checked)}
                      />
                    </td>
                    <td>#{p.jersey_number} {p.name}</td>
                    {STATS.map((s) => (
                      <td key={s}>
                        <input
                          className="stat-input"
                          type="number"
                          min="0"
                          disabled={!line.played}
                          value={line[s]}
                          onChange={(e) => setNumber(p.id, s, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="team-header">
        <div>
          <p className="eyebrow">Admin · Coupe de Escrivá</p>
          <h1>Match centre</h1>
        </div>
      </section>

      <div className="admin-layout">
        {/* ---------- Game list ---------- */}
        <aside className="admin-list">
          {Object.entries(byGameweek).map(([gw, games]) => (
            <div key={gw}>
              <h3 className="admin-gw">{gw}</h3>
              {games.map((f) => (
                <button
                  key={f.id}
                  className={`fixture-btn ${f.id === fixtureId ? 'active' : ''}`}
                  onClick={() => openFixture(f)}
                >
                  <span>{f.home.short_name} vs {f.away.short_name}</span>
                  <span className={`status-pill ${f.status}`}>
                    {f.status === 'finished' ? `${f.home_score}–${f.away_score}` : f.status}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* ---------- Editor ---------- */}
        <section>
          {!fixture ? (
            <p className="placeholder muted">Pick a game on the left to enter its result and player stats.</p>
          ) : linesLoading ? (
            <p className="status">Loading game…</p>
          ) : (
            <div className="admin-editor">
              <div className="admin-editor-head">
                <h2>{fixture.home.name} vs {fixture.away.name}</h2>
                <label className="field status-field">
                  Status
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                  </select>
                </label>
              </div>

              {renderHouseTable(fixture.home, homeScore, setHomeScore)}
              {renderHouseTable(fixture.away, awayScore, setAwayScore)}

              <div className="save-bar">
                <p className="muted">
                  Only ticked players count as having played. Unticked starters get auto-subbed in managers' teams.
                  The +2 win bonus only applies once the game is marked <strong>Finished</strong>.
                </p>
                                {status !== 'finished' && (
                  <p className="hint">⚠ This game is still <strong>{status}</strong>. Set it to <strong>Finished</strong> when it's over, or scores won't show on Home and there's no win bonus.</p>
                )}
                {message && <p className={message.type}>{message.text}</p>}
                <button className="btn" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save game'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}