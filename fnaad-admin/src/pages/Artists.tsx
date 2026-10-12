import { useEffect, useMemo, useState } from "react";
import { getAdminArtists, verifyArtist, suspendArtist, resolveMediaUrl } from "../services/api";

type Artist = {
  id: number;
  username: string;
  brand_name: string;
  bio: string;
  avatar: string | null;
  region: string;
  region_display: string;
  gender: string;
  is_verified: boolean;
  verified_at: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string;
  product_count: number;
  created_at: string;
};

export default function Artists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "unverified" | "suspended">("all");
  const [suspendModalId, setSuspendModalId] = useState<number | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = () => {
    setLoading(true);
    getAdminArtists()
      .then((res) => setArtists(res.data))
      .catch((err) => console.error("Artists error:", err))
      .finally(() => setLoading(false));
  };

  const handleVerify = async (id: number, isVerified: boolean) => {
    setActioningId(id);
    try {
      const res = await verifyArtist(id, isVerified);
      setArtists((prev) => prev.map((a) => (a.id === id ? { ...a, ...res.data } : a)));
    } catch (err) {
      console.error("Verify error:", err);
    } finally {
      setActioningId(null);
    }
  };

  const openSuspendModal = (id: number) => {
    setSuspendModalId(id);
    setSuspendReason("");
  };

  const confirmSuspend = async () => {
    if (suspendModalId === null) return;
    setActioningId(suspendModalId);
    try {
      const res = await suspendArtist(suspendModalId, true, suspendReason);
      setArtists((prev) =>
        prev.map((a) => (a.id === suspendModalId ? { ...a, ...res.data } : a))
      );
      setSuspendModalId(null);
    } catch (err) {
      console.error("Suspend error:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleUnsuspend = async (id: number) => {
    setActioningId(id);
    try {
      const res = await suspendArtist(id, false);
      setArtists((prev) => prev.map((a) => (a.id === id ? { ...a, ...res.data } : a)));
    } catch (err) {
      console.error("Unsuspend error:", err);
    } finally {
      setActioningId(null);
    }
  };

  const filtered = useMemo(() => {
    return artists.filter((a) => {
      const matchesSearch = `${a.brand_name} ${a.username} ${a.region_display}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "verified" && a.is_verified && !a.is_suspended) ||
        (statusFilter === "unverified" && !a.is_verified && !a.is_suspended) ||
        (statusFilter === "suspended" && a.is_suspended);

      return matchesSearch && matchesStatus;
    });
  }, [artists, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: artists.length,
      verified: artists.filter((artist) => artist.is_verified && !artist.is_suspended).length,
      unverified: artists.filter((artist) => !artist.is_verified && !artist.is_suspended).length,
      suspended: artists.filter((artist) => artist.is_suspended).length,
    };
  }, [artists]);

  return (
    <div>
      <h2 className="font-display text-2xl text-text mb-1">Artists</h2>
      <p className="text-muted text-sm mb-6">Artist account management.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Total</p>
          <p className="text-2xl font-display text-text mt-2">{stats.total}</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Verified</p>
          <p className="text-2xl font-display text-gold-light mt-2">{stats.verified}</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Needs review</p>
          <p className="text-2xl font-display text-text mt-2">{stats.unverified}</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Suspended</p>
          <p className="text-2xl font-display text-danger mt-2">{stats.suspended}</p>
        </div>
      </div>

      <div className="border border-border bg-surface rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-faint text-[10px] uppercase tracking-wide mb-2">Search artists</label>
            <input
              type="text"
              placeholder="Search for an artist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-text text-sm outline-none focus:border-gold transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all", label: "All" },
              { key: "verified", label: "Verified" },
              { key: "unverified", label: "Needs review" },
              { key: "suspended", label: "Suspended" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key as "all" | "verified" | "unverified" | "suspended")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === option.key ? "bg-gold text-bg" : "bg-bg text-muted border border-border"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-faint text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-faint text-sm">No artist found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((artist) => {
            const isActioning = actioningId === artist.id;
            const avatarUrl = resolveMediaUrl(artist.avatar);

            return (
              <div
                key={artist.id}
                className="border border-border bg-surface rounded-lg p-4 flex items-center gap-4"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={artist.brand_name}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center text-faint text-xs shrink-0">
                    {artist.brand_name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-text font-semibold text-sm truncate">{artist.brand_name}</p>
                    {artist.is_verified && <span className="text-gold text-xs">✓ Verified</span>}
                    {artist.is_suspended && (
                      <span className="text-danger text-xs font-semibold">Suspended</span>
                    )}
                  </div>
                  <p className="text-muted text-xs mt-0.5">
                    @{artist.username} · {artist.region_display}
                  </p>
                  <p className="text-faint text-xs mt-1">
                    {artist.product_count} artwork{artist.product_count !== 1 ? "s" : ""}
                  </p>
                  {artist.is_suspended && artist.suspension_reason && (
                    <p className="text-danger text-xs mt-1 italic">
                      Reason: {artist.suspension_reason}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleVerify(artist.id, !artist.is_verified)}
                    disabled={isActioning}
                    className={`text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50 ${
                      artist.is_verified
                        ? "border border-border text-muted hover:bg-white/5"
                        : "bg-gold text-[#1A1508] hover:bg-gold-light"
                    }`}
                  >
                    {isActioning ? "..." : artist.is_verified ? "Remove verification" : "Verify"}
                  </button>

                  {artist.is_suspended ? (
                    <button
                      onClick={() => handleUnsuspend(artist.id)}
                      disabled={isActioning}
                      className="bg-success text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                    >
                      {isActioning ? "..." : "Reactivate"}
                    </button>
                  ) : (
                    <button
                      onClick={() => openSuspendModal(artist.id)}
                      disabled={isActioning}
                      className="bg-danger text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suspend reason modal */}
      {suspendModalId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-text font-semibold text-sm mb-3">Suspension reason</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Explain the reason for suspension..."
              rows={3}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-text text-sm outline-none focus:border-gold transition-colors resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSuspendModalId(null)}
                className="flex-1 border border-border text-muted text-xs font-bold rounded-md py-2 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspend}
                disabled={actioningId === suspendModalId}
                className="flex-1 bg-danger text-bg text-xs font-bold rounded-md py-2 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}