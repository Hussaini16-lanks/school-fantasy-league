import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import LeagueTable from '../components/LeagueTable'

export default function Leaderboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Overall PAU league
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Private leagues
  const [leagues, setLeagues] = useState([])
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [leagueMsg, setLeagueMsg] = useState(null)

  useEffect(() => {
    supabase.rpc('leaderboard').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setLeagues([])
      return
    }
    supabase.rpc('my_leagues').then(({ data }) => setLeagues(data ?? []))
  }, [user])

  async function createLeague(e) {
    e.preventDefault()
    setBusy(true)
    setLeagueMsg(null)
    const { data, error } = await supabase.rpc('create_league', { p_name: newName })
    setBusy(false)
    if (error) setLeagueMsg({ type: 'error', text: error.message })
    else navigate(`/leagues/${data.id}`)
  }

  async function joinLeague(e) {
    e.preventDefault()
    setBusy(true)
    setLeagueMsg(null)
    const { data, error } = await supabase.rpc('join_league', { p_code: joinCode })
    setBusy(false)
    if (error) setLeagueMsg({ type: 'error', text: error.message })
    else navigate(`/leagues/${data.id}`)
  }

  if (loading) return <p className="status">Loading leaderboard…</p>
  if (error) return <p className="error">Couldn't load leaderboard: {error}</p>

  const me = rows.find((r) => r.user_id === user?.id)

  return (
    <>
      <section className="team-header">
        <div>
          <p className="eyebrow">Coupe de Escrivá · Season standings</p>
          <h1>Leaderboard</h1>
        </div>
        {me && (
          <div className="stats-row">
            <div className="stat">
              <span className="stat-label">Your rank</span>
              <span className="stat-value">#{me.rank}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Your points</span>
              <span className="stat-value">{me.total_points}</span>
            </div>
          </div>
        )}
      </section>

      <div className="lb-layout">
        {/* ---------- Overall league ---------- */}
        <div>
          <h2 className="section-title lb-title">
            PAU Overall <span className="tag">{rows.length} managers</span>
          </h2>
          <LeagueTable rows={rows} userId={user?.id} />
        </div>

        {/* ---------- Private leagues ---------- */}
        <aside className="league-panel">
          <h2>Private leagues</h2>

          {!user ? (
            <p className="muted">
              <Link to="/login" className="link-btn">Log in</Link> to create or join leagues with your friends.
            </p>
          ) : (
            <>
              {leagues.length === 0 ? (
                <p className="muted">You're not in any private leagues yet.</p>
              ) : (
                <div className="league-list">
                  {leagues.map((l) => (
                    <Link key={l.id} to={`/leagues/${l.id}`} className="league-item">
                      <div>
                        <strong>{l.name}</strong>
                        <small>{l.members} member{l.members === 1 ? '' : 's'}{l.is_owner ? ' · owner' : ''}</small>
                      </div>
                      <span className="league-rank">#{l.my_rank ?? '–'}</span>
                    </Link>
                  ))}
                </div>
              )}

              <form className="league-form" onSubmit={createLeague}>
                <input
                  className="input"
                  placeholder="New league name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={40}
                  required
                />
                <button className="btn-small" disabled={busy}>Create</button>
              </form>

              <form className="league-form" onSubmit={joinLeague}>
                <input
                  className="input code-input"
                  placeholder="Join with code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                />
                <button className="btn-small" disabled={busy}>Join</button>
              </form>

              {leagueMsg && <p className={leagueMsg.type}>{leagueMsg.text}</p>}
            </>
          )}
        </aside>
      </div>
    </>
  )
}