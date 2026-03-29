import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import FinanceTracker from './FinanceTracker'

function validatePasswordStrength(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character'
  return null
}

function ChangePasswordModal({ session, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) return setError(strengthError)
    if (newPassword !== confirmPassword) return setError('New passwords do not match')
    if (currentPassword === newPassword) return setError('New password must be different from current password')

    setLoading(true)
    try {
      // Re-authenticate with current password first
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      })
      if (reAuthError) throw new Error('Current password is incorrect')

      // Now update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const inputStyle = {
    background: "#1a1a2e", border: "1px solid #252545", borderRadius: "8px",
    padding: "12px 16px", color: "#e0e0e0", fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box"
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ width: "100%", maxWidth: "380px", background: "#16162a", borderRadius: "16px", border: "1px solid #252545", padding: "32px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", fontFamily: "'DM Sans', sans-serif" }}>Change Password</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "24px" }}>{session.user.email}</div>

        {success ? (
          <div>
            <div style={{ padding: "12px", background: "#1e3a2f", border: "1px solid #34D399", borderRadius: "8px", fontSize: "13px", color: "#34D399", marginBottom: "16px" }}>
              Password updated successfully.
            </div>
            <button onClick={onClose} style={{ width: "100%", background: "#5B8DEF", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: "14px", fontFamily: "'DM Sans', sans-serif" }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && <div style={{ padding: "10px", background: "#2a1a1e", border: "1px solid #E8524A", borderRadius: "8px", fontSize: "13px", color: "#E8524A" }}>{error}</div>}
            <input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} required />
            <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required />
            <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
            <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.6 }}>
              Requirements: 8+ characters, uppercase letter, number, special character
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button type="button" onClick={onClose} style={{ flex: 1, background: "none", border: "1px solid #252545", borderRadius: "8px", padding: "12px", color: "#6b7280", cursor: "pointer", fontSize: "14px", fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, background: "#5B8DEF", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: "14px", fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.6 : 1 }}>
                {loading ? '...' : 'Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const inputStyle = {
    background: "#1a1a2e", border: "1px solid #252545", borderRadius: "8px",
    padding: "12px 16px", color: "#e0e0e0", fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%"
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1e" }}>
      <div style={{ width: "100%", maxWidth: "380px", padding: "40px 32px", background: "#16162a", borderRadius: "16px", border: "1px solid #252545" }}>
        <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", fontFamily: "'DM Sans', sans-serif" }}>Finance Tracker</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "32px" }}>{isSignUp ? "Create an account" : "Sign in to continue"}</div>
        {error && <div style={{ padding: "10px", background: "#2a1a1e", border: "1px solid #E8524A", borderRadius: "8px", fontSize: "13px", color: "#E8524A", marginBottom: "16px" }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          <button onClick={handleAuth} disabled={loading} style={{
            background: "#5B8DEF", color: "#fff", border: "none", borderRadius: "8px",
            padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: "14px",
            fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.6 : 1
          }}>{loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}</button>
        </div>
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#6b7280" }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span onClick={() => { setIsSignUp(!isSignUp); setError(null); }} style={{ color: "#5B8DEF", cursor: "pointer" }}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1e", color: "#6b7280" }}>Loading...</div>

  return (
    <>
      {session ? <FinanceTracker session={session} onChangePassword={() => setShowChangePassword(true)} /> : <AuthScreen />}
      {showChangePassword && session && <ChangePasswordModal session={session} onClose={() => setShowChangePassword(false)} />}
    </>
  )
}
