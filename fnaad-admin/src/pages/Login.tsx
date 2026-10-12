import { useState, FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loading, error, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password)
      navigate("/");
    } catch {
      // error already set in context
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-gold-light">FNAAD</h1>
          <p className="text-faint text-xs mt-2 tracking-widest uppercase">
            Administration panel
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-border bg-surface rounded-lg p-8 space-y-4"
        >
          {error && (
            <p className="text-danger text-sm text-center border border-danger/30 bg-danger/10 rounded-md py-2 px-3">
              {error}
            </p>
          )}

          <div>
            <label className="block text-muted text-xs mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-text text-sm outline-none focus:border-gold transition-colors"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-muted text-xs mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-text text-sm outline-none focus:border-gold transition-colors"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-[#1A1508] font-semibold text-sm rounded-md py-2.5 mt-2 hover:bg-gold-light transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}