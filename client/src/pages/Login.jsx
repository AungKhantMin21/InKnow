import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

const Login = () => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  const inputClass =
    "w-full border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors placeholder:text-ink-4";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4" style={{ animation: "pageFade 200ms ease" }}>
      <div
        className="bg-white border border-rule w-full p-10"
        style={{ maxWidth: 400 }}
      >
        {/* Wordmark */}
        <div className="text-center mb-10">
          <span className="font-display font-light text-[32px] leading-none text-ink">
            In
          </span>
          <span className="font-display font-light italic text-[32px] leading-none text-volt">
            Know
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={set("name")}
              required
              className={inputClass}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={set("email")}
            required
            className={inputClass}
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set("password")}
            required
            className={inputClass}
          />

          {error && (
            <p className="font-body text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50 mt-2"
          >
            {loading
              ? "One moment..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
