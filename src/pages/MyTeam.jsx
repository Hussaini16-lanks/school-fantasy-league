import { useAuth } from '../lib/AuthContext'

export default function MyTeam() {
  const { profile } = useAuth()

  return (
    <section className="placeholder">
      <p className="eyebrow">Coming in Step 3C</p>
      <h1>My Team</h1>
      <p>Signed in as {profile?.display_name ?? '…'}. Squad builder coming next.</p>
    </section>
  )
}