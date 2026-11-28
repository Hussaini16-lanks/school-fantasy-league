import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import LeagueTable from '../components/LeagueTable'

// One private league's standings
export default function League() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [league, setLeague] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [leaguesRes, standingsRes] = await Promise.all([
        supabase.rpc('my_leagues'),
        supabase.rpc('league_standings', { p_league_id: Number(id) }),
      ])
      const err = leaguesRes.error || standingsRes.error
      const found = leaguesRes.data?.find((l) => l.id === Number(id))
      if (err) setError(err.message)
      else if (!found) setError("You're not a member of this league.")
      else {
        setLeague(found)
        setRows(standingsRes.data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function copyInvite() {
    const url = `${window.location.origin}/leagues/join/${league.code}`
    const text = `Join my PAU Fantasy league "${league.name}" 🦈\n${url}\nCode: ${league.code}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Share the code instead: ' + league.code)
    }
  }

  async function leave() {
    if (!confirmLeave) {
      setConfirmLeave(true)
      return
    }
    const { error } = await supabase.rpc('leave_league', { p_league_id: Number(id) })
    if (error) setError(error.message)
    else navigate('/leaderboard')
  }

  if (loading) return <p className="status">Loading league…</p>
  if (error) {
    return (
      <>
        <Link to="/leaderboard" className="back-link">← Leaderboard</Link>
        <p className="error">{error}</p>
      </>
    )
  }

  return (
    <>
      <Link to="/leaderboard" className="back-link">← Leaderboard</Link>

      <section className="team-header">
        <div>
          <p className="eyebrow">Private league · {league.members} member{league.members === 1 ? '' : 's'}</p>
          <h1>{league.name}</h1>
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-label">Your rank</span>
            <span className="stat-value">#{league.my_rank ?? '–'}</span>
          </div>
        </div>
      </section>

      <div className="league-actions">
        <span className="code-chip">{league.code}</span>
        <button className="btn-small" onClick={copyInvite}>
          {copied ? 'Copied ✓' : 'Copy invite'}
        </button>
        <button className="btn-ghost" onClick={leave}>
          {confirmLeave
            ? league.is_owner ? 'Tap again: this deletes the league' : 'Tap again to leave'
            : league.is_owner ? 'Delete league' : 'Leave league'}
        </button>
      </div>

      <LeagueTable rows={rows} userId={user?.id} />
    </>
  )
}