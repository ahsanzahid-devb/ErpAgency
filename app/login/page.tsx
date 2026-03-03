"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, User, XCircle } from "lucide-react";

const VALID_USERNAME = "ahsanzahid.devb@gmail.com";
const VALID_PASSWORD = "IosJob@2019";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const isValid = username.trim() === VALID_USERNAME && password === VALID_PASSWORD;

    // Small delay to mimic a network request and allow for UI feedback
    setTimeout(() => {
      setIsSubmitting(false);
      if (isValid) {
        console.log("Authenticated successfully");
        setSuccess(true);
        document.cookie = "zapps_auth=1; path=/; max-age=86400; SameSite=Lax";
        setTimeout(() => router.push("/"), 300);
      } else {
        setError("Invalid username or password. Please try again.");
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <div className="inline-flex items-center gap-3">
            <div className="text-3xl font-black tracking-tight text-red-600">Zapps</div>
            <div className="h-2 w-2 rounded-full bg-red-600" aria-hidden />
          </div>
          <p className="text-sm text-neutral-500">Sign in to orchestrate your workspace.</p>
        </header>

        <div className="bg-white border border-neutral-200 shadow-2xl rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-semibold">Access</p>
              <h1 className="text-2xl font-semibold text-neutral-900">Login to Zapps</h1>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-inner">Z</div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="username">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-red-500" aria-hidden />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-11 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-red-500" aria-hidden />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-11 py-3 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 mt-0.5" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5" aria-hidden />
                <span>Authenticated successfully. Redirecting...</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-red-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>By continuing you agree to Zapps' terms.</span>
              <a className="font-semibold text-red-600 hover:text-red-700" href="#">Need help?</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


