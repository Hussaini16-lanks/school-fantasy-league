import { Link } from 'react-router-dom'

// A standings table: used by the overall leaderboard and private leagues
export default function LeagueTable({ rows, userId }) {
  if (rows.length === 0) {
    return <p className="muted">No managers yet. Be the first to pick a squad!</p>
  }

  return (
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
            <tr key={r.user_id} className={r.user_id === userId ? 'me' : ''}>
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
  )
}