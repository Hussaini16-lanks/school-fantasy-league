import { NavLink } from 'react-router-dom'

export default function Navbar() {
    return (
        <header className="navbar">
            <NavLink to="/" className="logo">
                <img src="/sharks-logo.jpg" alt="PAU Sharks" />
                PAU <span>Fantasy</span>
            </NavLink>
            <nav className="nav-links">
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/team">My Team</NavLink>
                <NavLink to="/leaderboard">Leaderboard</NavLink>
                <NavLink to="/admin">Admin</NavLink>
            </nav>
        </header>
    )
}