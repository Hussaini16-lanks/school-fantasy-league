import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const average = (arr) =>
  arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0

// Loads a player's game log, upcoming fixtures and summary numbers.
// Used by both the player card (PlayerSheet) and the Full Profile page.
export function usePlayerDetails(playerId, houseId) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!playerId || !houseId) return
    let cancelled = false
    setData(null)

    async function load() {
      const [logRes, fixRes, housesRes] = await Promise.all([
        supabase
          .from('player_fixture_points')
          .select('fixture_id, gameweek_id, gameweek_name, is_home, opponent_house_id, points, rebounds, assists, steals, blocks, fantasy_points')
          .eq('player_id', playerId)
          .order('gameweek_id'),
        supabase
          .from('fixtures')
          .select('id, home_house_id, away_house_id, gameweek:gameweeks(name)')
          .neq('status', 'finished')
          .or(`home_house_id.eq.${houseId},away_house_id.eq.${houseId}`)
          .order('gameweek_id')
          .limit(3),
        supabase.from('houses').select('id, name, short_name, color'),
      ])
      if (cancelled) return

      const log = logRes.data ?? []
      const pts = log.map((g) => g.fantasy_points)

      setData({
        error: logRes.error?.message || fixRes.error?.message || housesRes.error?.message || null,
        houses: Object.fromEntries((housesRes.data ?? []).map((h) => [h.id, h])),
        log,
        fixtures: (fixRes.data ?? []).map((f) => ({
          id: f.id,
          gameweek: f.gameweek?.name,
          isHome: f.home_house_id === houseId,
          opponentId: f.home_house_id === houseId ? f.away_house_id : f.home_house_id,
        })),
        totalPoints: pts.reduce((a, b) => a + b, 0),
        pointsPerGame: average(pts),
        form: average(pts.slice(-3)),
      })
    }

    load()
    return () => { cancelled = true }
  }, [playerId, houseId])

  return data
}

// "Gameweek 2" -> "GW2"
export const gwShort = (name) => (name ?? '').replace('Gameweek ', 'GW')