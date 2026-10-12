import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { getPendingProducts } from "../services/api";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "DB" },
  { to: "/review", label: "Review Hub", icon: "RH" },
  { to: "/moderation", label: "Moderation", icon: "MO" },
  { to: "/artists", label: "Artists", icon: "AR" },
  { to: "/subscriptions", label: "Subscriptions", icon: "AB" },
  { to: "/reports", label: "Reports", icon: "SI" },
  { to: "/registrations", label: "Registrations", icon: "RG" },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const loadCount = () => {
      getPendingProducts()
        .then((res) => setPendingCount(res.data.length))
        .catch(() => {});
    };
    loadCount();
    const interval = setInterval(loadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="px-6 py-8">
        <h1 className="font-display text-2xl text-gold-light tracking-tight">FNAAD</h1>
        <p className="text-faint text-xs mt-1 tracking-widest uppercase">Administration</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-gold/10 text-gold-light border border-gold/30"
                  : "text-muted hover:text-text hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <span className="text-[10px] font-bold opacity-70 w-5">{item.icon}</span>
            <span>{item.label}</span>
            {item.to === "/moderation" && pendingCount > 0 && (
              <span className="ml-auto bg-danger text-white text-[10px] font-bold rounded-full px-2 py-0.5">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2.5 rounded-md text-sm text-danger hover:bg-danger/10 transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
