import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function TeamNameEditor() {
  const { user, profile } = useAuth()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile) setName(profile.team_name ?? '')
  }, [profile])

  const shown = name || `${profile?.display_name ?? ''}'s Team`

  async function save(e) {
    e.preventDefault()
    const clean = name.trim().slice(0, 30)
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ team_name: clean || null })
      .eq('id', user.id)
    setSaving(false)
    if (error) setError(error.message)
    else {
      setName(clean)
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <button className="team-name" onClick={() => setEditing(true)} title="Rename your team">
        {shown} <span className="edit-icon">✎</span>
      </button>
    )
  }

  return (
    <form className="team-name-form" onSubmit={save}>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Team name"
        autoFocus
      />
      <button className="btn-small" disabled={saving}>{saving ? '…' : 'Save'}</button>
      <button
        type="button"
        className="link-btn"
        onClick={() => { setName(profile.team_name ?? ''); setEditing(false) }}
      >
        Cancel
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}