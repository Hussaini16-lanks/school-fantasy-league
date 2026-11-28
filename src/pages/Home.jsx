import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import HouseBadge from '../components/HouseBadge'

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Home() {
  const { session } = useAuth()
  const [gameweeks, setGameweeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('gameweeks')
        .select(`
          id, name, deadline, is_finished,
          fixtures (
            id, status, home_score, away_score,
            home:houses!fixtures_home_house_id_fkey (name, color),
            away:houses!fixtures_away_house_id_fkey (name, color)
          )
        `)
        .order('deadline')
        .order('id', { referencedTable: 'fixtures' })

      if (error) setError(error.message)
      else setGameweeks(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="status">Loading fixtures…</p>
  if (error) return <p className="error">Couldn't load data: {error}</p>

  // The next gameweek whose deadline hasn't passed yet
  const next = gameweeks.find((gw) => new Date(gw.deadline) > new Date())

  return (
    <>
      <section className="hero">
        <p className="eyebrow">PAU Sharks · Coupe de Escrivá · Basketball</p>
        <h1>PAU Fantasy</h1>
        <p className="hero-text">
          Draft 10 real players from Madiba, TSG, Cirok and Blue Jays.
          Earn points from their real games. Beat your friends.
        </p>
        <div className="hero-actions">
          <Link to={session ? '/team' : '/login'} className="btn hero-cta">
            {session ? 'Go to My Team' : 'Create your team →'}
          </Link>
          {next && (
            <p className="deadline">
              {next.name} deadline: <strong>{formatDate(next.deadline)}</strong>
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">How to play</h2>
        <div className="how-grid">
          <div className="how-card">
            <span className="how-no">1</span>
            <h3>Draft your squad</h3>
            <p>Pick 10 real players with 100 coins. Max 3 from any one house.</p>
          </div>
          <div className="how-card">
            <span className="how-no">2</span>
            <h3>Set your five</h3>
            <p>Your 5 starters score. Your captain scores double, and subs come in automatically if a starter doesn't play.</p>
          </div>
          <div className="how-card">
            <span className="how-no">3</span>
            <h3>Earn points</h3>
            <p>Point 1 · Rebound 1 · Assist 2 · Steal 3 · Block 3 · House win +2</p>
          </div>
          <div className="how-card">
            <span className="how-no">4</span>
            <h3>Show up</h3>
            <p>Scan the QR code at the game for +5. You get 1 free transfer every gameweek.</p>
          </div>
        </div>
      </section>

      {gameweeks.map((gw) => (
        <section key={gw.id}>
          <h2 className="section-title">
            {gw.name}
            <span className="tag">
              {gw.is_finished ? 'Finished' : `Deadline ${formatDate(gw.deadline)}`}
            </span>
          </h2>
          <div className="fixture-list">
            {gw.fixtures.map((f) => (
              <div className="fixture" key={f.id}>
                <HouseBadge house={f.home} />
                <span className="score">
                  {f.status === 'finished' ? `${f.home_score} – ${f.away_score}` : 'VS'}
                </span>
                <span className="away">
                  <HouseBadge house={f.away} />
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}