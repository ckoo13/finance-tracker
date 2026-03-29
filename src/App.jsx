import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import FinanceTracker from './FinanceTracker'

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

  return session ? <FinanceTracker session={session} /> : <AuthScreen />
}
