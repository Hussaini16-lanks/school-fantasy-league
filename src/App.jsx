import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import MyTeam from './pages/MyTeam'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import PlayerProfile from './pages/PlayerProfile'
import ManagerTeam from './pages/ManagerTeam'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/manager/:id" element={<ManagerTeam />} />
            <Route path="*" element={<p className="status">Page not found.</p>} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}