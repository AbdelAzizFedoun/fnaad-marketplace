import { useEffect, useState } from "react";
import { getRegistrationStats } from "../services/api";

type RegionStat = {
  region: string;
  region_display: string;
  count: number;
  share_pct: number;
};

type TrendDay = {
  date: string;
  customers: number;
  artists: number;
};

type RegistrationStats = {
  totals: {
    customers: number;
    artists: number;
    total_members: number;
    artist_share_pct: number;
  };
  recent: {
    customers_last_7d: number;
    artists_last_7d: number;
    customers_last_30d: number;
    artists_last_30d: number;
  };
  artists_by_region: RegionStat[];
  trend: TrendDay[];
};

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent?: boolean }) {
  return (
    <div className="border border-border bg-surface rounded-lg p-5">
      <p className="text-faint text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-display mt-2 ${accent ? "text-gold-light" : "text-text"}`}>
        {value}
      </p>
      <p className="text-faint text-xs mt-1">{sub}</p>
    </div>
  );
}

function BarRow({ label, count, max, note }: { label: string; count: number; max: number; note?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-faint">
          {count}
          {note ? ` · ${note}` : ""}
        </span>
      </div>
      <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Registrations() {
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getRegistrationStats()
      .then((res) => {
        setStats(res.data);
        setError("");
      })
      .catch((err) => {
        console.error("Registration stats error:", err);
        if (err.response?.status === 403) {
          setError("Access denied: This account does not have admin privileges (staff or superadmin).");
        } else if (err.response?.status === 401) {
          setError("Session expired or invalid. Please log in again.");
        } else {
          setError(
            err.response?.data?.detail ||
              err.message ||
              "Unable to load registration statistics.",
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-faint text-sm animate-pulse">Loading registration statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl text-text mb-1">Registrations</h2>
        <div className="border border-danger/40 bg-danger/10 rounded-lg p-5">
          <p className="text-danger font-medium text-sm mb-1">Loading error</p>
          <p className="text-muted text-xs">{error || "No data available."}</p>
        </div>
      </div>
    );
  }

  const maxRegion = Math.max(...stats.artists_by_region.map((r) => r.count), 1);
  const maxTrend = Math.max(
    ...stats.trend.map((day) => Math.max(day.customers, day.artists)),
    1,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-text mb-1">Registrations</h2>
        <p className="text-faint text-sm">
          Clients and artists signing up, and where the artists are located.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Clients"
          value={stats.totals.customers}
          sub={`+${stats.recent.customers_last_7d} this week · ${stats.recent.customers_last_30d} this month`}
        />
        <StatCard
          label="Artists"
          value={stats.totals.artists}
          sub={`+${stats.recent.artists_last_7d} this week · ${stats.recent.artists_last_30d} this month`}
          accent
        />
        <StatCard
          label="Total members"
          value={stats.totals.total_members}
          sub={`+${stats.recent.customers_last_7d + stats.recent.artists_last_7d} this week`}
        />
        <StatCard
          label="Artist share"
          value={`${stats.totals.artist_share_pct}%`}
          sub="of all registered members"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border bg-surface rounded-lg p-5">
          <h3 className="font-display text-lg text-text mb-4">Artists by region</h3>
          <div className="space-y-3">
            {stats.artists_by_region.map((region) => (
              <BarRow
                key={region.region}
                label={region.region_display}
                count={region.count}
                max={maxRegion}
                note={`${region.share_pct}%`}
              />
            ))}
          </div>
        </div>

        <div className="border border-border bg-surface rounded-lg p-5">
          <h3 className="font-display text-lg text-text mb-4">Sign-ups — last 14 days</h3>
          <div className="space-y-3">
            {stats.trend.map((day) => {
              const date = new Date(`${day.date}T00:00:00`);
              const label = date.toLocaleDateString([], { month: "short", day: "numeric" });
              const total = day.customers + day.artists;
              return (
                <div key={day.date}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted">{label}</span>
                    <span className="text-faint">
                      {total} ({day.customers} clients · {day.artists} artists)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bg rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${(day.artists / maxTrend) * 100}%` }}
                    />
                    <div
                      className="h-full bg-white/20 rounded-full"
                      style={{ width: `${(day.customers / maxTrend) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gold inline-block" /> Artists
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/20 inline-block" /> Clients
            </span>
          </div>
        </div>
      </div>

      <div className="border border-border bg-surface rounded-lg p-5 overflow-x-auto">
        <h3 className="font-display text-lg text-text mb-4">Region breakdown</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase tracking-wide border-b border-border">
              <th className="pb-2 font-semibold">Region</th>
              <th className="pb-2 font-semibold text-right">Artists</th>
              <th className="pb-2 font-semibold text-right">Share</th>
              <th className="pb-2 font-semibold text-right">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {stats.artists_by_region.map((region) => (
              <tr key={region.region} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 text-text">{region.region_display}</td>
                <td className="py-2.5 text-right text-muted">{region.count}</td>
                <td className="py-2.5 text-right text-muted">{region.share_pct}%</td>
                <td className="py-2.5 text-right">
                  <div className="w-full max-w-[140px] h-1.5 bg-bg rounded-full overflow-hidden ml-auto">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{
                        width: `${maxRegion > 0 ? (region.count / maxRegion) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
