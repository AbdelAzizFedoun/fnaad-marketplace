import { useEffect, useState } from "react";
import {
  getPendingProducts,
  approveProduct,
  getSiteSettings,
  updateSiteSettings,
  resolveMediaUrl,
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

  const loadPending = () => {
    getPendingProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Pending products error:", err))
      .finally(() => setLoading(false));
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