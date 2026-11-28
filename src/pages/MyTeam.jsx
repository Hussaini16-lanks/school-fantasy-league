import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import HouseBadge from '../components/HouseBadge'
import Court from '../components/Court'
import Jersey from '../components/Jersey'
import PlayerSheet from '../components/PlayerSheet'
import TeamNameEditor from '../components/TeamNameEditor'

const fmt = (n) => Number(n).toFixed(1)
const round1 = (n) => Math.round(n * 10) / 10

// Where the 5 starters stand on the court (% of court width / height)
const COURT_SPOTS = [
  { x: 50, y: 28 }, // in the paint
  { x: 18, y: 50 }, // left wing
  { x: 82, y: 50 }, // right wing
  { x: 32, y: 79 }, // left guard
  { x: 68, y: 79 }, // right guard
]

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MyTeam() {
  // Data from the database
  const [team, setTeam] = useState(null)        // result of get_team_state()
  const [players, setPlayers] = useState([])
  const [selection, setSelection] = useState({}) // player id -> % of managers who picked him
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // The squad being edited
  const [starters, setStarters] = useState([])  // up to 5 player ids
  const [bench, setBench] = useState([])        // up to 5 player ids, in sub order
  const [captain, setCaptain] = useState(null)
  const [vice, setVice] = useState(null)
  const [selected, setSelected] = useState(null) // player whose menu is open
  const [swapping, setSwapping] = useState(null) // player waiting to be swapped

  // Market filters + saving
  const [search, setSearch] = useState('')
  const [houseFilter, setHouseFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)  // { type: 'error' | 'success', text }

  // ---------- Load ----------
  useEffect(() => {
    async function load() {
      const [teamRes, playersRes, selectionRes] = await Promise.all([
        supabase.rpc('get_team_state'),
        supabase
          .from('players')
          .select('id, name, position, jersey_number, price, house:houses(id, name, short_name, color)')
          .eq('active', true)
          .order('price', { ascending: false }),
        supabase.rpc('player_selection'),
      ])

      const err = teamRes.error || playersRes.error || selectionRes.error
      if (err) {
        setLoadError(err.message)
        setLoading(false)
        return
      }

      const t = teamRes.data
      const picks = t.picks ?? []
      setTeam(t)
      setPlayers(playersRes.data)
      setSelection(Object.fromEntries(selectionRes.data.map((r) => [r.player_id, r.selected_pct])))
      setStarters(picks.filter((p) => p.is_starter).map((p) => p.player_id))
      setBench(
        picks
          .filter((p) => !p.is_starter)
          .sort((a, b) => a.bench_order - b.bench_order)
          .map((p) => p.player_id)
      )
      setCaptain(picks.find((p) => p.is_captain)?.player_id ?? null)
      setVice(picks.find((p) => p.is_vice_captain)?.player_id ?? null)
      setLoading(false)
    }
    load()
  }, [])

  // ---------- Derived numbers ----------
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const houses = useMemo(() => {
    const seen = new Map()
    players.forEach((p) => seen.set(p.house.id, p.house))
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [players])

  const squad = [...starters, ...bench]
  const budget = team?.budget ?? 100
  const maxPerHouse = team?.max_per_house ?? 3
  const cost = round1(squad.reduce((sum, id) => sum + Number(byId[id]?.price ?? 0), 0))
  const remaining = round1(budget - cost)

  const houseCounts = squad.reduce((acc, id) => {
    const h = byId[id]?.house.id
    acc[h] = (acc[h] ?? 0) + 1
    return acc
  }, {})

  const freeTransfers = team?.free_transfers ?? null // null = unlimited (first squad)
  const baseIds = team?.base_player_ids ?? []
  const isNew = (id) => freeTransfers !== null && !baseIds.includes(id)
  const transfersUsed = squad.filter(isNew).length

  // ---------- Actions ----------
  function clearRoles(id) {
    if (captain === id) setCaptain(null)
    if (vice === id) setVice(null)
  }

  function addPlayer(id) {
    setMessage(null)
    if (starters.length < 5) setStarters([...starters, id])
    else if (bench.length < 5) setBench([...bench, id])
  }

  function removePlayer(id) {
    setMessage(null)
    setStarters(starters.filter((x) => x !== id))
    setBench(bench.filter((x) => x !== id))
    clearRoles(id)
    if (swapping === id) setSwapping(null)
    setSelected(null)
  }

  function makeCaptain(id) {
    if (vice === id) setVice(captain) // swap armbands
    setCaptain(id)
  }

  function makeVice(id) {
    if (captain === id) setCaptain(vice)
    setVice(id)
  }

  function handleSwap(id) {
    setMessage(null)
    const isStarter = starters.includes(id)

    // Nothing waiting to be swapped yet
    if (swapping === null) {
      // If the other side has room, just move straight across
      if (isStarter && bench.length < 5) {
        setStarters(starters.filter((x) => x !== id))
        setBench([...bench, id])
        clearRoles(id)
        return
      }
      if (!isStarter && starters.length < 5) {
        setBench(bench.filter((x) => x !== id))
        setStarters([...starters, id])
        return
      }
      setSwapping(id) // otherwise wait for a second tap
      return
    }

    if (swapping === id) {
      setSwapping(null) // tapped the same player again: cancel
      return
    }

    const otherIsStarter = starters.includes(swapping)
    if (otherIsStarter === isStarter) {
      setSwapping(id) // same side: change selection
      return
    }

    // Swap a starter with a bench player (the sub takes the starter's spot)
    const s = isStarter ? id : swapping
    const b = isStarter ? swapping : id
    setStarters(starters.map((x) => (x === s ? b : x)))
    setBench(bench.map((x) => (x === b ? s : x)))
    clearRoles(s)
    setSwapping(null)
  }

  function moveBench(index, dir) {
    const j = index + dir
    if (j < 0 || j >= bench.length) return
    const next = [...bench]
    ;[next[index], next[j]] = [next[j], next[index]]
    setBench(next)
  }

  function handleCardClick(id) {
    if (swapping !== null) {
      handleSwap(id)
      return
    }
    setSelected(selected === id ? null : id)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.rpc('save_team', {
      p_starters: starters,
      p_bench: bench,
      p_captain: captain,
      p_vice_captain: vice,
    })
    setSaving(false)
    if (error) setMessage({ type: 'error', text: error.message })
    else setMessage({ type: 'success', text: `Squad saved for ${team.gameweek.name}!` })
  }

  // Why a player can't be added (null = they can)
  function blockReason(p) {
    if (squad.includes(p.id)) return 'Picked'
    if (squad.length >= 10) return 'Squad full'
    if ((houseCounts[p.house.id] ?? 0) >= maxPerHouse) return `Max ${maxPerHouse} ${p.house.short_name}`
    if (Number(p.price) > remaining) return 'Too pricey'
    return null
  }

  // What's stopping the squad from being saved
  const problems = []
  if (starters.length < 5) problems.push(`Pick ${5 - starters.length} more starter(s)`)
  if (bench.length < 5) problems.push(`Pick ${5 - bench.length} more sub(s)`)
  if (starters.length === 5 && !captain) problems.push('Choose a captain (tap a starter)')
  if (starters.length === 5 && !vice) problems.push('Choose a vice-captain (tap a starter)')
  if (remaining < 0) problems.push('Your squad is over budget')
  if (freeTransfers !== null && transfersUsed > freeTransfers)
    problems.push(`Only ${freeTransfers} transfer allowed this gameweek`)

  // ---------- Render ----------
  if (loading) return <p className="status">Loading your team…</p>
  if (loadError) return <p className="error">Couldn't load your team: {loadError}</p>
  if (!team.gameweek)
    return <p className="status">No gameweek is open for picking right now. Check back soon.</p>

  const market = players.filter(
    (p) =>
      (houseFilter === 'all' || p.house.id === Number(houseFilter)) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  )

  // A player standing on the court or sitting on the bench
  function renderCard(id, isStarter) {
    const p = byId[id]
    if (!p) return null
    const canSwapWith =
      swapping !== null && swapping !== id && starters.includes(swapping) !== isStarter

    const classes = ['player-card']
    if (selected === id) classes.push('selected')
    if (swapping === id) classes.push('swapping')
    if (canSwapWith) classes.push('swap-target')

    return (
      <button className={classes.join(' ')} onClick={() => handleCardClick(id)}>
        <div className="jersey-wrap">
          <Jersey color={p.house.color} number={p.jersey_number} />
          {captain === id && <span className="badge-c">C</span>}
          {vice === id && <span className="badge-c vice">V</span>}
          {isNew(id) && <span className="badge-new" title="New this gameweek" />}
        </div>
        <span className="card-name">{p.name}</span>
        <span className="card-price">{p.house.short_name} · {fmt(p.price)}</span>
      </button>
    )
  }

  function renderEmpty(label) {
    return (
      <div className="player-card empty">
        <div className="jersey-wrap"><Jersey empty /></div>
        <span className="card-name">{label}</span>
      </div>
    )
  }

  // The card for the tapped player
  const sel = selected ? byId[selected] : null
  const selIsStarter = selected ? starters.includes(selected) : false
  const selBenchIndex = selected ? bench.indexOf(selected) : -1

  return (
    <>
      <section className="team-header">
        <div>
          <p className="eyebrow">
            {team.gameweek.name} · Deadline {formatDate(team.gameweek.deadline)}
          </p>
          <h1>My Team</h1>
          <TeamNameEditor />
        </div>
        <div className="stats-row">
          <div className={`stat ${remaining < 0 ? 'warn' : ''}`}>
            <span className="stat-label">Coins left</span>
            <span className="stat-value">{fmt(remaining)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Squad</span>
            <span className="stat-value">{squad.length}/10</span>
          </div>
          <div className={`stat ${freeTransfers !== null && transfersUsed > freeTransfers ? 'warn' : ''}`}>
            <span className="stat-label">Transfers</span>
            <span className="stat-value">
              {freeTransfers === null ? 'Free' : `${transfersUsed}/${freeTransfers}`}
            </span>
          </div>
        </div>
      </section>

      <div className="team-layout">
        {/* ---------- Court + bench ---------- */}
        <div>
          <Court>
            {COURT_SPOTS.map((spot, i) => (
              <div key={i} className="court-slot" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
                {starters[i] ? renderCard(starters[i], true) : renderEmpty('Starter')}
              </div>
            ))}
          </Court>

          <div className="bench">
            <div className="bench-title">
              Bench <span className="tag">Auto-subs in this order</span>
            </div>
            <div className="bench-row">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="bench-slot">
                  <span className="bench-no">{i + 1}</span>
                  {bench[i] ? renderCard(bench[i], false) : renderEmpty('Sub')}
                </div>
              ))}
            </div>
          </div>

          {swapping && (
            <div className="hint">
              <span>
                Tap a pulsing {starters.includes(swapping) ? 'bench' : 'court'} player to swap with{' '}
                <strong>{byId[swapping]?.name}</strong>.
              </span>
              <button className="btn-ghost" onClick={() => setSwapping(null)}>Cancel</button>
            </div>
          )}

          {sel && !swapping && (
            <PlayerSheet
              player={sel}
              isStarter={selIsStarter}
              benchIndex={selBenchIndex}
              benchSize={bench.length}
              isCaptain={captain === selected}
              isVice={vice === selected}
              selectedPct={selection[selected]}
              onCaptain={() => makeCaptain(selected)}
              onVice={() => makeVice(selected)}
              onMoveBench={(dir) => moveBench(selBenchIndex, dir)}
              onSub={() => { const id = selected; setSelected(null); handleSwap(id) }}
              onRemove={() => removePlayer(selected)}
              onClose={() => setSelected(null)}
            />
          )}

          <div className="save-bar">
            {problems.length > 0 && (
              <ul className="problems">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            {message && <p className={message.type}>{message.text}</p>}
            <button className="btn" disabled={saving || problems.length > 0} onClick={save}>
              {saving ? 'Saving…' : 'Save squad'}
            </button>
          </div>
        </div>

        {/* ---------- Player market ---------- */}
        <aside>
          <h2 className="section-title">
            Players <span className="tag">{market.length} shown</span>
          </h2>
          <div className="filters">
            <input
              className="input"
              placeholder="Search name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="input" value={houseFilter} onChange={(e) => setHouseFilter(e.target.value)}>
              <option value="all">All houses</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div className="market">
            {market.map((p) => {
              const reason = blockReason(p)
              return (
                <div key={p.id} className="market-row">
                  <div className="market-jersey">
                    <Jersey color={p.house.color} number={p.jersey_number} />
                  </div>
                  <div className="player-info">
                    <span className="player-name">{p.name}</span>
                    <span className="player-meta">
                      <HouseBadge house={p.house} /> · {p.position} · {selection[p.id] ?? 0}% sel.
                    </span>
                  </div>
                  <span className="price">{fmt(p.price)}</span>
                  <button className="btn-small" disabled={!!reason} onClick={() => addPlayer(p.id)}>
                    {reason ?? 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </>
  )
}