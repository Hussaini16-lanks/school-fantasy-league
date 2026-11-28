import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Opened from an invite link: /leagues/join/ABC123
export default function JoinLeague() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    supabase.rpc('join_league', { p_code: code }).then(({ data, error }) => {
      if (error) setError(error.message)
      else navigate(`/leagues/${data.id}`, { replace: true })
    })
  }, [code, navigate])

  return (
    <section className="auth-card checkin-card">
      {error ? (
        <>
          <div className="checkin-icon bad">!</div>
          <h1>Couldn't join</h1>
          <p className="error">{error}</p>
          <Link to="/leaderboard" className="btn-ghost checkin-btn">Go to Leaderboard</Link>
        </>
      ) : (
        <p className="status">Joining league…</p>
      )}
    </section>
  )
}