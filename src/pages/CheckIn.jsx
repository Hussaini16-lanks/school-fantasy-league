import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Opened by scanning the QR code at a game
export default function CheckIn() {
  const { fixtureId } = useParams()
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const [result, setResult] = useState({ status: 'loading' })
  const sent = useRef(false) // make sure we only check in once

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    supabase
      .rpc('check_in', { p_fixture_id: Number(fixtureId), p_code: code })
      .then(({ data, error }) => {
        if (error) setResult({ status: 'error', text: error.message })
        else setResult({ status: 'ok', ...data })
      })
  }, [fixtureId, code])

  return (
    <section className="auth-card checkin-card">
      {result.status === 'loading' && <p className="status">Checking you in…</p>}

      {result.status === 'ok' && (
        <>
          <div className="checkin-icon ok">✓</div>
          <p className="eyebrow">{result.home} vs {result.away}</p>
          <h1>{result.new ? "You're checked in!" : 'Already checked in'}</h1>
          <p className="muted">
            {result.new
              ? '+5 bonus points for being in the stands. Enjoy the game! 🦈'
              : 'Your +5 for this game is already counted.'}
          </p>
          <Link to="/team" className="btn checkin-btn">Go to My Team</Link>
        </>
      )}

      {result.status === 'error' && (
        <>
          <div className="checkin-icon bad">!</div>
          <h1>Couldn't check in</h1>
          <p className="error">{result.text}</p>
          <Link to="/" className="btn-ghost checkin-btn">Back to Home</Link>
        </>
      )}
    </section>
  )
}