import React, { useState } from "react";
import { KeyRound, Shield, User as UserIcon, HelpCircle, Laptop } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, user: { id: string; name: string; email: string; role: "ADMIN" | "USER" }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailStr: email, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string, presetPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: presetEmail, password: presetPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Preset login failed");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Preset login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4" id="login-container">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:flex">
        
        {/* Left Side: Branding / Welcome */}
        <div className="flex flex-col justify-between bg-zinc-900 p-8 text-white md:w-1/2">
          <div>
            <div className="mb-4 flex items-center space-x-2">
              <Laptop className="h-6 w-6 text-emerald-400" />
              <span className="font-mono text-sm tracking-widest uppercase text-zinc-400">IITR Cultural Council</span>
            </div>
            
            <h1 className="mt-8 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Smart Asset <br />
              Management
            </h1>
            <p className="mt-4 text-zinc-300">
              Track inventory, request shared equipment, and view real-time reservation schedules for cultural council activities inside IIT Roorkee.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            <div className="flex items-center space-x-3 text-sm text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-emerald-400">1</span>
              <span>Prevent overlapping overbooking instantly</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-emerald-400">2</span>
              <span>QR code tracking for swift checkouts</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-emerald-400">3</span>
              <span>Live utilization audit trails</span>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
            Current system time: 2026-06-05
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 md:w-1/2">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-zinc-900">Sign In</h2>
            <p className="text-sm text-zinc-500">Access student booking & resource tracking dashboards</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600" id="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase">IIT Email Address</label>
              <input
                id="login-email-input"
                type="email"
                required
                placeholder="chintu1@ch.iitr.ac.in or student@iitb.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase">Password</label>
              <input
                id="login-password-input"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Login to Workspace"}
            </button>
          </form>

          {/* Quick-Access Presets */}
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h3 className="mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center">
              <Shield className="mr-1 h-3.5 w-3.5 text-amber-500" />
              Quick-Access Simulation Accounts
            </h3>
            
            <div className="grid gap-3">
              <button
                id="quick-login-admin"
                onClick={() => handleQuickLogin("admin@iitr.ac.in", "admin123")}
                disabled={loading}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-amber-100 p-1.5 text-amber-600">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Admin Coordinator View</p>
                    <p className="text-[10px] text-zinc-500">Review pending bookings, track conditions, logs</p>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-mono font-medium">ADMIN</span>
              </button>

              <button
                id="quick-login-student"
                onClick={() => handleQuickLogin("student@iitr.ac.in", "student123")}
                disabled={loading}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Student Reserve (Rajesh)</p>
                    <p className="text-[10px] text-zinc-500">Browse cameras/mics, book dates, report issues</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-medium">USER</span>
              </button>

              <button
                id="quick-login-sec"
                onClick={() => handleQuickLogin("ananya@iitr.ac.in", "student123")}
                disabled={loading}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-indigo-100 p-1.5 text-indigo-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Cultural Sec (Ananya)</p>
                    <p className="text-[10px] text-zinc-500">Pre-booked active speaker, custom request rates</p>
                  </div>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-medium">USER</span>
              </button>
            </div>

            <div className="mt-4 flex items-start space-x-1.5 bg-zinc-50 p-2 rounded text-[11px] text-zinc-500 border border-zinc-100">
              <HelpCircle className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
              <span>You can also sign in with any valid Indian Institute of Technology email (e.g. <b>@iitb.ac.in</b>, <b>@ch.iitr.ac.in</b>) for custom simulation profile creation.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
