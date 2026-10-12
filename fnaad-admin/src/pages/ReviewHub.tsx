import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminArtists,
  getAdminSubscriptions,
  getPendingProducts,
  getReportedConversations,
} from "../services/api";

type ReviewSummary = {
  pendingProducts: number;
  reportedConversations: number;
  unverifiedArtists: number;
  suspendedArtists: number;
  expiringSubscriptions: number;
};

export default function ReviewHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getPendingProducts(),
      getReportedConversations(),
      getAdminArtists(),
      getAdminSubscriptions(),
    ])
      .then(([pendingRes, reportsRes, artistsRes, subscriptionsRes]) => {
        setPendingProducts(pendingRes.data || []);
        setReports(reportsRes.data || []);
        setArtists(artistsRes.data || []);
        setSubscriptions(subscriptionsRes.data || []);
        setError("");
      })
      .catch((err) => {
        console.error("Review hub error:", err);
        setError("Unable to load the review queue.");
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo<ReviewSummary>(() => ({
    pendingProducts: pendingProducts.length,
    reportedConversations: reports.length,
    unverifiedArtists: artists.filter((artist) => !artist.is_verified && !artist.is_suspended).length,
    suspendedArtists: artists.filter((artist) => artist.is_suspended).length,
    expiringSubscriptions: subscriptions.filter((subscription) => {
      const end = new Date(subscription.effective_end_date).getTime();
      const delta = end - Date.now();
      return delta > 0 && delta <= 7 * 24 * 60 * 60 * 1000;
    }).length,
  }), [artists, pendingProducts, reports, subscriptions]);

  const totalOpenItems =
    summary.pendingProducts +
    summary.reportedConversations +
    summary.unverifiedArtists +
    summary.suspendedArtists +
    summary.expiringSubscriptions;

  const priorityRows = [
    { label: "Pending product approvals", value: summary.pendingProducts, to: "/moderation", tone: "gold" },
    { label: "Reported conversations", value: summary.reportedConversations, to: "/reports", tone: "danger" },
    { label: "Unverified artists", value: summary.unverifiedArtists, to: "/artists", tone: "text" },
    { label: "Suspended artists", value: summary.suspendedArtists, to: "/artists", tone: "danger" },
    { label: "Expiring subscriptions", value: summary.expiringSubscriptions, to: "/subscriptions", tone: "info" },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl text-text mb-1">Review Hub</h2>
      <p className="text-muted text-sm mb-6">
        One place to catch the marketplace issues that need attention first.
      </p>

      {error && (
        <div className="border border-danger/40 bg-danger/10 rounded-lg p-4 mb-6 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {priorityRows.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="border border-border bg-surface rounded-lg p-4 hover:bg-white/5 transition-colors"
          >
            <p className="text-faint text-[10px] uppercase tracking-wide">{item.label}</p>
            <p
              className={`text-2xl font-display mt-2 ${
                item.tone === "gold"
                  ? "text-gold-light"
                  : item.tone === "danger"
                  ? "text-danger"
                  : item.tone === "info"
                  ? "text-info"
                  : "text-text"
              }`}
            >
              {item.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="border border-border bg-surface rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-text text-sm font-semibold">Priority queue</h3>
          <span className="text-faint text-[10px] uppercase tracking-wide">{totalOpenItems} items</span>
        </div>

        {loading ? (
          <p className="text-faint text-sm">Loading review queue...</p>
        ) : totalOpenItems === 0 ? (
          <p className="text-faint text-sm">Everything looks clear right now.</p>
        ) : (
          <div className="space-y-4">
            {pendingProducts.slice(0, 3).length > 0 && (
              <QueueSection
                title="Pending product approvals"
                items={pendingProducts.slice(0, 3).map((product) => ({
                  name: product.title,
                  meta: product.artist_name,
                  link: "/moderation",
                }))}
              />
            )}

            {reports.slice(0, 3).length > 0 && (
              <QueueSection
                title="Reported conversations"
                items={reports.slice(0, 3).map((report) => ({
                  name: report.product_title || "Reported conversation",
                  meta: `${report.customer_username} → ${report.artist_name} · ${report.report_reason || "General concern"}`,
                  link: "/reports",
                }))}
              />
            )}

            {artists.filter((artist) => !artist.is_verified && !artist.is_suspended).slice(0, 3).length > 0 && (
              <QueueSection
                title="Unverified artists"
                items={artists
                  .filter((artist) => !artist.is_verified && !artist.is_suspended)
                  .slice(0, 3)
                  .map((artist) => ({
                    name: artist.brand_name,
                    meta: `@${artist.username} · ${artist.region_display || "Unknown region"}`,
                    link: "/artists",
                  }))}
              />
            )}

            {subscriptions
              .filter((subscription) => {
                const end = new Date(subscription.effective_end_date).getTime();
                const delta = end - Date.now();
                return delta > 0 && delta <= 7 * 24 * 60 * 60 * 1000;
              })
              .slice(0, 3).length > 0 && (
                <QueueSection
                  title="Expiring subscriptions"
                  items={subscriptions
                    .filter((subscription) => {
                      const end = new Date(subscription.effective_end_date).getTime();
                      const delta = end - Date.now();
                      return delta > 0 && delta <= 7 * 24 * 60 * 60 * 1000;
                    })
                    .slice(0, 3)
                    .map((subscription) => ({
                      name: subscription.artist_brand_name,
                      meta: `${subscription.artist_mobile_money_provider || "Mobile Money"} · ${subscription.artist_mobile_money_number}`,
                      link: "/subscriptions",
                    }))}
                />
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueSection({
  title,
  items,
}: {
  title: string;
  items: { name: string; meta: string; link: string }[];
}) {
  return (
    <div className="border border-border rounded-lg bg-bg p-4">
      <h4 className="text-text text-xs font-semibold uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={`${title}-${item.name}-${item.meta}`}
            to={item.link}
            className="block rounded-md border border-border bg-surface p-3 hover:bg-white/5 transition-colors"
          >
            <p className="text-text text-sm font-medium truncate">{item.name}</p>
            <p className="text-faint text-[11px] mt-1 truncate">{item.meta}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
