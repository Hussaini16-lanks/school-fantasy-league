import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Leaderboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.rpc('leaderboard').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data)
      setLoading(false)
    })
  }, [])

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

      {rows.length === 0 ? (
        <p className="muted">No managers yet. Be the first to pick a squad!</p>
      ) : (
        <div className="table-wrap">
          <table className="stats-table leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Manager</th>
                <th>Latest GW</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className={r.user_id === user?.id ? 'me' : ''}>
                  <td><span className={`rank rank-${r.rank}`}>{r.rank}</span></td>
                  <td>
                    <Link to={`/manager/${r.user_id}`} className="manager team-link">
                      <strong>{r.team_name || `${r.display_name}'s Team`}</strong>
                      <span className="muted">{r.display_name}</span>
                    </Link>
                  </td>
                  <td>{r.gw_points}</td>
                  <td className="fp">{r.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}