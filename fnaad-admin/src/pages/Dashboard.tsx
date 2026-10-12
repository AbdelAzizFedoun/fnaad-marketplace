import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  approveProduct,
  getAdminDashboard,
  getPendingProducts,
  getSiteSettings,
  resolveMediaUrl,
} from "../services/api";
import MediaImage from "../components/MediaImage";

type PendingProduct = {
  id: number;
  title: string;
  description: string;
  price_xaf: number;
  artist_name: string;
  artist_region_display?: string | null;
  artist_is_verified?: boolean;
  category_display?: string;
  created_at?: string;
  images: { image: string; thumbnail?: string | null; is_primary: boolean }[];
};

type DashboardStats = {
  products: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  users: {
    total_artists: number;
    total_customers: number;
  };
  orders: {
    total_conversations: number;
    negotiating: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
  };
  top_artists: { brand_name: string; product_count: number }[];
  artists_by_region: { region: string; region_display: string; count: number }[];
  products_by_category: { category: string; category_display: string; count: number }[];
};

type FilterKey = "all" | "artists" | "regions" | "categories";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="border border-border bg-surface rounded-lg p-5">
      <p className="text-faint text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-display mt-2 ${accent ? "text-gold-light" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-faint">{count}</span>
      </div>
      <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<FilterKey>("all");
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const loadPendingProducts = () => {
    setPendingLoading(true);
    getPendingProducts()
      .then((res) => {
        setPendingProducts(res.data);
        setPendingError("");
      })
      .catch((err) => {
        console.error("Pending products error:", err);
        setPendingError(
          err.response?.data?.detail ||
            err.message ||
            "Unable to load artwork awaiting approval.",
        );
      })
      .finally(() => setPendingLoading(false));
  };

  useEffect(() => {
    getAdminDashboard()
      .then((res) => {
        setStats(res.data);
        setError("");
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
        if (err.response?.status === 403) {
          setError("Access denied: This account does not have admin privileges (staff or superadmin).");
        } else if (err.response?.status === 401) {
          setError("Session expired or invalid. Please log in again.");
        } else {
          setError(
            err.response?.data?.detail ||
            err.message ||
            "Unable to load platform statistics."
          );
        }
      })
      .finally(() => setLoading(false));
    loadPendingProducts();
  }, []);

  const handleProductDecision = async (id: number, status: "approved" | "rejected") => {
    setDecidingId(id);
    try {
      await approveProduct(id, status);
      setPendingProducts((products) => products.filter((product) => product.id !== id));
      setStats((current) =>
        current
          ? {
              ...current,
              products: {
                ...current.products,
                pending: Math.max(0, current.products.pending - 1),
                approved: current.products.approved + (status === "approved" ? 1 : 0),
                rejected: current.products.rejected + (status === "rejected" ? 1 : 0),
              },
            }
          : current,
      );
    } catch (err) {
      console.error("Artwork moderation error:", err);
      setPendingError("Unable to update this artwork. Please try again.");
    } finally {
      setDecidingId(null);
    }
  };

  const normalizedQuery = search.trim().toLowerCase();

  const visibility = useMemo(() => {
    if (!stats) {
      return { topArtists: [], artistsByRegion: [], productsByCategory: [] };
    }

    const matches = (value: string) => !normalizedQuery || value.toLowerCase().includes(normalizedQuery);

    const topArtists = (stats.top_artists || []).filter((artist) => matches(artist.brand_name));
    const artistsByRegion = (stats.artists_by_region || []).filter((region) => matches(region.region_display || region.region));
    const productsByCategory = (stats.products_by_category || []).filter((cat) => matches(cat.category_display || cat.category));

    return { topArtists, artistsByRegion, productsByCategory };
  }, [normalizedQuery, stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-faint text-sm animate-pulse">Loading statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl text-text mb-1">Dashboard</h2>
        <div className="border border-danger/40 bg-danger/10 rounded-lg p-5">
          <p className="text-danger font-medium text-sm mb-1">Loading error</p>
          <p className="text-muted text-xs">{error || "No data available."}</p>
        </div>
      </div>
    );
  }

  const topArtists = visibility.topArtists;
  const artistsByRegion = visibility.artistsByRegion;
  const productsByCategory = visibility.productsByCategory;

  const maxRegionCount = Math.max(...artistsByRegion.map((r) => r.count), 1);
  const maxCategoryCount = Math.max(...productsByCategory.map((c) => c.count), 1);
  const maxArtistCount = Math.max(...topArtists.map((a) => a.product_count), 1);

  const priorityActions = [
    { label: "Pending approvals", value: stats.products.pending, tone: "gold" },
    { label: "Negotiating orders", value: stats.orders.negotiating, tone: "text" },
    { label: "Cancelled orders", value: stats.orders.cancelled, tone: "danger" },
  ];

  const showArtists = focus === "all" || focus === "artists";
  const showRegions = focus === "all" || focus === "regions";
  const showCategories = focus === "all" || focus === "categories";

  return (
    <div>
      <h2 className="font-display text-2xl text-text mb-1">Dashboard</h2>
      <p className="text-muted text-sm mb-8">Overview of the FNAAD platform.</p>

      <div className="border border-border bg-surface rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <label className="block text-faint text-[10px] uppercase tracking-wide mb-2">Search marketplace</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search artists, regions or categories"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all", label: "All" },
              { key: "artists", label: "Artists" },
              { key: "regions", label: "Regions" },
              { key: "categories", label: "Categories" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFocus(option.key as FilterKey)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  focus === option.key ? "bg-gold text-bg" : "bg-bg text-muted border border-border"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total artworks" value={stats.products.total} accent />
        <StatCard label="Pending" value={stats.products.pending} />
        <StatCard label="Artists" value={stats.users.total_artists} />
        <StatCard label="Customers" value={stats.users.total_customers} />
      </div>

      <div className="border border-border bg-surface rounded-lg p-5 mb-6">
        <h3 className="text-text text-sm font-semibold mb-4">Priority actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {priorityActions.map((item) => (
            <div key={item.label} className="border border-border bg-bg rounded-md p-4">
              <p className="text-faint text-[10px] uppercase tracking-wide">{item.label}</p>
              <p className={`text-2xl font-display mt-2 ${item.tone === "danger" ? "text-danger" : item.tone === "gold" ? "text-gold-light" : "text-text"}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className="border border-border bg-surface rounded-lg p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-text text-sm font-semibold">Artwork awaiting approval</h3>
            <p className="text-faint text-xs mt-1">
              Review artists’ photos and details before publishing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadPendingProducts}
              disabled={pendingLoading}
              className="text-xs text-muted hover:text-text disabled:opacity-50"
            >
              {pendingLoading ? "Refreshing..." : "Refresh"}
            </button>
            <Link to="/moderation" className="text-xs text-gold-light hover:underline">
              Moderation settings
            </Link>
          </div>
        </div>

        {pendingError ? (
          <div className="border border-danger/40 bg-danger/10 rounded-md p-3 text-danger text-sm">
            {pendingError}
          </div>
        ) : pendingLoading ? (
          <p className="text-faint text-sm animate-pulse">Loading pending artwork...</p>
        ) : pendingProducts.length === 0 ? (
          <p className="text-faint text-sm">
            No artworks are waiting for approval. Check Moderation to confirm manual approval is enabled.
          </p>
        ) : (
          <div className="space-y-4">
            {pendingProducts.map((product) => {
              const images = [...(product.images || [])].sort(
                (left, right) => Number(right.is_primary) - Number(left.is_primary),
              );
              const isDeciding = decidingId === product.id;

              return (
                <article
                  key={product.id}
                  className="border border-border bg-bg rounded-lg p-4 flex flex-col lg:flex-row gap-4"
                >
                  {images.length > 0 ? (
                    <div className="flex flex-wrap gap-2 shrink-0 lg:max-w-[40%]">
                      {images.map((image, index) => {
                        const imageUrl = resolveMediaUrl(image.thumbnail || image.image);
                        return imageUrl ? (
                          <MediaImage
                            key={`${product.id}-${image.image}-${index}`}
                            src={imageUrl}
                            alt={`${product.title}${image.is_primary ? " (primary image)" : ` (image ${index + 1})`}`}
                            className="w-28 h-28 rounded-md object-cover bg-surface"
                          />
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <div className="w-28 h-28 shrink-0 rounded-md bg-surface flex items-center justify-center text-faint text-xs text-center p-2">
                      No artwork image uploaded
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-text font-semibold text-sm">{product.title}</p>
                    <p className="text-muted text-xs mt-1">
                      {product.artist_name}
                      <span className={`ml-2 ${product.artist_is_verified ? "text-success" : "text-gold-light"}`}>
                        {product.artist_is_verified ? "Verified artist" : "Artist not verified"}
                      </span>
                    </p>
                    <p className="text-faint text-xs mt-1">
                      {[product.category_display, product.artist_region_display].filter(Boolean).join(" · ") ||
                        "Category or region not provided"}
                    </p>
                    <p className="text-faint text-xs mt-2 whitespace-pre-wrap">
                      {product.description || "No description provided."}
                    </p>
                    <p className="text-gold-light text-sm font-semibold mt-2">
                      {product.price_xaf.toLocaleString()} XAF
                    </p>
                    {product.created_at && (
                      <p className="text-faint text-xs mt-1">
                        Submitted {new Date(product.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleProductDecision(product.id, "approved")}
                      disabled={isDeciding}
                      className="bg-success text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                    >
                      {isDeciding ? "..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProductDecision(product.id, "rejected")}
                      disabled={isDeciding}
                      className="bg-danger text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                    >
                      {isDeciding ? "..." : "Reject"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="border border-border bg-surface rounded-lg p-5 mb-6">
        <h3 className="text-text text-sm font-semibold mb-4">Artworks by status</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-display text-gold-light">{stats.products.approved}</p>
            <p className="text-faint text-xs mt-1">Approved</p>
          </div>
          <div>
            <p className="text-xl font-display text-muted">{stats.products.pending}</p>
            <p className="text-faint text-xs mt-1">Pending</p>
          </div>
          <div>
            <p className="text-xl font-display text-danger">{stats.products.rejected}</p>
            <p className="text-faint text-xs mt-1">Rejected</p>
          </div>
        </div>
      </div>

      <div className="border border-border bg-surface rounded-lg p-5 mb-6">
        <h3 className="text-text text-sm font-semibold mb-4">
          Orders ({stats.orders.total_conversations} total)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-display text-text">{stats.orders.negotiating}</p>
            <p className="text-faint text-xs mt-1">Negotiating</p>
          </div>
          <div>
            <p className="text-lg font-display text-text">{stats.orders.confirmed}</p>
            <p className="text-faint text-xs mt-1">Confirmed</p>
          </div>
          <div>
            <p className="text-lg font-display text-success">{stats.orders.delivered}</p>
            <p className="text-faint text-xs mt-1">Delivered</p>
          </div>
          <div>
            <p className="text-lg font-display text-danger">{stats.orders.cancelled}</p>
            <p className="text-faint text-xs mt-1">Cancelled</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {showArtists && (
          <div className="border border-border bg-surface rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text text-sm font-semibold">Top artists</h3>
              <span className="text-faint text-[10px] uppercase tracking-wide">{topArtists.length} results</span>
            </div>
            {topArtists.length === 0 ? (
              <p className="text-faint text-xs">No artist matches your search.</p>
            ) : (
              <div className="space-y-3">
                {topArtists.map((artist) => (
                  <BarRow key={artist.brand_name} label={artist.brand_name} count={artist.product_count} max={maxArtistCount} />
                ))}
              </div>
            )}
          </div>
        )}

        {showRegions && (
          <div className="border border-border bg-surface rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text text-sm font-semibold">Artists by region</h3>
              <span className="text-faint text-[10px] uppercase tracking-wide">{artistsByRegion.length} results</span>
            </div>
            {artistsByRegion.length === 0 ? (
              <p className="text-faint text-xs">No region matches your search.</p>
            ) : (
              <div className="space-y-3">
                {artistsByRegion.map((r) => (
                  <BarRow key={r.region} label={r.region_display} count={r.count} max={maxRegionCount} />
                ))}
              </div>
            )}
          </div>
        )}

        {showCategories && (
          <div className={`border border-border bg-surface rounded-lg p-5 ${showArtists || showRegions ? "md:col-span-2" : "md:col-span-2"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text text-sm font-semibold">Artworks by category</h3>
              <span className="text-faint text-[10px] uppercase tracking-wide">{productsByCategory.length} results</span>
            </div>
            {productsByCategory.length === 0 ? (
              <p className="text-faint text-xs">No category matches your search.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {productsByCategory.map((c) => (
                  <BarRow key={c.category} label={c.category_display} count={c.count} max={maxCategoryCount} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}