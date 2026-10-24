import { useEffect, useState } from "react";
import {
  getPendingProducts,
  approveProduct,
  getSiteSettings,
  updateSiteSettings,
  resolveMediaUrl,
  adminApi,
} from "../services/api";
import MediaImage from "../components/MediaImage";

type Product = {
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

export default function Moderation() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [togglingSetting, setTogglingSetting] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [flaggedCopies, setFlaggedCopies] = useState<any[]>([]);
  const [evidenceReviews, setEvidenceReviews] = useState<any[]>([]);

  const loadPending = () => {
    getPendingProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Pending products error:", err))
      .finally(() => setLoading(false));
    adminApi.getFlaggedCopies().then((res) => setFlaggedCopies(res.data || [])).catch((err) => console.error("Flagged copies error:", err));
    adminApi.getEvidenceReviews().then((res) => setEvidenceReviews(res.data || [])).catch((err) => console.error("Evidence review error:", err));
  };

  const handleCopyDecision = async (id: number, confirm: boolean) => {
    setDecidingId(id);
    try {
      const response = confirm ? await adminApi.confirmCopy(id) : await adminApi.overruleCopy(id);
      setFlaggedCopies((prev) => prev.filter((p) => p.id !== id));
      if (!confirm && response.data?.status === "pending") setProducts((prev) => [...prev, response.data]);
    } catch (err) {
      console.error("Copy decision error:", err);
    } finally {
      setDecidingId(null);
    }
  };

  useEffect(() => {
    loadPending();
    getSiteSettings()
      .then((res) => setRequireApproval(res.data.require_product_approval))
      .catch((err) => console.error("Site settings error:", err));
  }, []);

  const handleToggleApproval = async () => {
    if (requireApproval === null) return;
    setTogglingSetting(true);
    const next = !requireApproval;
    try {
      await updateSiteSettings({ require_product_approval: next });
      setRequireApproval(next);
    } catch (err) {
      console.error("Toggle setting error:", err);
    } finally {
      setTogglingSetting(false);
    }
  };

  const handleDecision = async (id: number, status: "approved" | "rejected") => {
    setDecidingId(id);
    try {
      await approveProduct(id, status);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Approve error:", err);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-text mb-1">Moderation</h2>
      <p className="text-muted text-sm mb-6">Artworks pending review.</p>

      {evidenceReviews.length > 0 && <section className="mb-8"><h3 className="font-display text-lg text-text mb-2">Originality evidence review</h3><div className="space-y-3">{evidenceReviews.map((item) => <div key={item.id} className="border border-border bg-surface rounded-lg p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-text font-semibold text-sm">{item.title}</p><p className="text-muted text-xs mt-1">{item.artist_name} · {item.creation_method} · {item.copy_strikes} copy strikes</p><p className="text-faint text-xs mt-1">Verification: {item.verification_level} · Passport: {String(item.passport_token).slice(0, 8)}</p>{item.copy_of_title && <p className="text-danger text-xs mt-1">Hash match: possible copy of “{item.copy_of_title}” by {item.copy_of_artist} ({Math.round((item.copy_confidence || 0) * 100)}%)</p>}</div><div className="flex gap-2">{item.evidence.map((e: any) => <a key={e.id} href={e.file} target="_blank" rel="noreferrer" className="text-gold-light text-xs underline">Open evidence</a>)}</div></div><div className="mt-3 flex gap-2"><button onClick={async () => { await adminApi.decideEvidence(item.evidence[0]?.id, true); setEvidenceReviews((prev) => prev.map((x) => x.id === item.id ? { ...x, verification_level: "verified" } : x)); }} className="bg-success text-bg text-xs font-bold rounded-md px-3 py-2">Approve verification</button><button onClick={async () => { if (item.evidence[0]?.id) await adminApi.decideEvidence(item.evidence[0].id, false); }} className="border border-border text-muted text-xs font-bold rounded-md px-3 py-2">Keep unverified</button></div></div>)}</div></section>}

      {flaggedCopies.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-lg text-danger mb-2">Possible copies requiring review</h3>
          <div className="space-y-3">
            {flaggedCopies.map((product) => (
              <div key={product.id} className="border border-danger/40 bg-surface rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-text font-semibold text-sm">{product.title}</p>
                  <p className="text-muted text-xs mt-1">Artist: {product.artist_name || product.artist?.brand_name || "Unknown"}</p>
                  <p className="text-danger text-xs mt-1">{product.rejection_reason || "Possible copy detected."}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleCopyDecision(product.id, true)} disabled={decidingId === product.id} className="bg-danger text-bg text-xs font-bold rounded-md px-3 py-2">Confirm copy</button>
                  <button onClick={() => handleCopyDecision(product.id, false)} disabled={decidingId === product.id} className="bg-success text-bg text-xs font-bold rounded-md px-3 py-2">Clear flag</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Approval toggle */}
      <div className="border border-border bg-surface rounded-lg p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="text-text text-sm font-semibold">Manual artwork approval</p>
          <p className="text-faint text-xs mt-1 max-w-md">
            {requireApproval
              ? "Enabled — each new artwork must be approved here before it appears publicly."
              : "Disabled — artist artworks are published immediately, without review."}
          </p>
        </div>
        <button
          onClick={handleToggleApproval}
          disabled={requireApproval === null || togglingSetting}
          className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${
            requireApproval ? "bg-gold" : "bg-border"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-bg transition-transform ${
              requireApproval ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Pending queue — only meaningful while approval is required */}
      {loading ? (
        <p className="text-faint text-sm">Loading...</p>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-faint text-sm">No pending artworks at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const images = [...(product.images || [])].sort(
              (left, right) => Number(right.is_primary) - Number(left.is_primary),
            );
            const isDeciding = decidingId === product.id;

            return (
              <div key={product.id} className="border border-border bg-surface rounded-lg p-4 flex flex-col md:flex-row gap-4">
                {images.length > 0 ? (
                  <div className="flex flex-wrap gap-2 shrink-0 md:max-w-[40%]">
                    {images.map((image, index) => {
                      const imageUrl = resolveMediaUrl(image.thumbnail || image.image);
                      return imageUrl ? (
                        <MediaImage
                          key={`${product.id}-${image.image}-${index}`}
                          src={imageUrl}
                          alt={`${product.title}${image.is_primary ? " (primary image)" : ` (image ${index + 1})`}`}
                          className="w-28 h-28 rounded-md object-cover bg-bg"
                        />
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="w-28 h-28 shrink-0 rounded-md bg-bg flex items-center justify-center text-faint text-xs text-center p-2">
                    No artwork image uploaded
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-text font-semibold text-sm">{product.title}</p>
                  <p className="text-muted text-xs mt-1">
                    {product.artist_name}
                    {product.artist_is_verified ? (
                      <span className="text-success ml-2">Verified artist</span>
                    ) : (
                      <span className="text-gold-light ml-2">Artist not verified</span>
                    )}
                  </p>
                  <p className="text-faint text-xs mt-1">
                    {[product.category_display, product.artist_region_display].filter(Boolean).join(" · ") || "Category or region not provided"}
                  </p>
                  <p className="text-faint text-xs mt-2 whitespace-pre-wrap">{product.description || "No description provided."}</p>
                  <p className="text-gold-light text-sm font-semibold mt-2">{product.price_xaf.toLocaleString()} XAF</p>
                  {product.created_at && (
                    <p className="text-faint text-xs mt-1">
                      Submitted {new Date(product.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleDecision(product.id, "approved")}
                    disabled={isDeciding}
                    className="bg-success text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                  >
                    {isDeciding ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDecision(product.id, "rejected")}
                    disabled={isDeciding}
                    className="bg-danger text-bg text-xs font-bold rounded-md px-4 py-2 disabled:opacity-50"
                  >
                    {isDeciding ? "..." : "Reject"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
