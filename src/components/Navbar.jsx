import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Navbar() {
  const { session, profile } = useAuth()

  return (
    <header className="navbar">
      <NavLink to="/" className="logo">
        <img src="/sharks-logo.jpg" alt="PAU Sharks" />
        PAU <span>Fantasy</span>
      </NavLink>

      <div className="nav-right">
        <nav className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/team">My Team</NavLink>
          {session && <NavLink to={`/manager/${session.user.id}`}>Points</NavLink>}
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          {profile?.is_admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        {session ? (
          <div className="nav-user">
            <span>{profile?.display_name}</span>
            <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>
              Log out
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="btn-ghost">Log in</NavLink>
        )}
      </div>
    </header>
  )
}