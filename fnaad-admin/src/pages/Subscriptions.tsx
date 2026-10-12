import { useEffect, useMemo, useState } from "react";
import {
  activateSubscription,
  cancelSubscription,
  getAdminSubscriptions,
} from "../services/api";

type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

type Subscription = {
  id: number;
  artist: number;
  artist_brand_name: string;
  artist_username: string;
  artist_phone: string;
  artist_region: string | null;
  artist_mobile_money_number: string;
  artist_mobile_money_provider: string;
  status: SubscriptionStatus;
  trial_start_date: string;
  trial_end_date: string;
  current_period_end: string | null;
  effective_end_date: string;
  monthly_price_xaf: number;
  is_active: boolean;
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  trial: "border-info/40 text-info bg-info/10",
  active: "border-success/40 text-success bg-success/10",
  expired: "border-danger/40 text-danger bg-danger/10",
  cancelled: "border-muted/40 text-muted bg-white/5",
};

const PROVIDERS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getDaysLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");

  const summary = useMemo(() => {
    return subscriptions.reduce(
      (acc, subscription) => {
        acc.total += 1;
        if (subscription.is_active) acc.active += 1;
        if (subscription.status === "trial") acc.trial += 1;
        if (!subscription.is_active) acc.inactive += 1;
        if (new Date(subscription.effective_end_date).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) {
          acc.expiringSoon += 1;
        }
        return acc;
      },
      { total: 0, active: 0, trial: 0, inactive: 0, expiringSoon: 0 }
    );
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    return [...subscriptions]
      .filter((subscription) => {
        const matchesStatus = statusFilter === "all" || subscription.status === statusFilter;
        const matchesSearch =
          !search.trim() ||
          `${subscription.artist_brand_name} ${subscription.artist_username} ${subscription.artist_mobile_money_number}`
            .toLowerCase()
            .includes(search.toLowerCase());

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(a.effective_end_date).getTime() - new Date(b.effective_end_date).getTime());
  }, [search, statusFilter, subscriptions]);

  const loadSubscriptions = () => {
    setError("");
    getAdminSubscriptions()
      .then((res) => setSubscriptions(res.data))
      .catch((err) => {
        console.error("Subscriptions error:", err);
        setError("Unable to load subscriptions.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const updateSubscription = (updated: Subscription) => {
    setSubscriptions((prev) =>
      prev.map((subscription) => (subscription.id === updated.id ? updated : subscription))
    );
  };

  const handleActivate = async (id: number, days: number) => {
    setActingId(id);
    try {
      const res = await activateSubscription(id, days);
      updateSubscription(res.data);
    } catch (err) {
      console.error("Activate subscription error:", err);
      setError("Activation failed. Check the backend or your admin rights.");
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActingId(id);
    try {
      const res = await cancelSubscription(id);
      updateSubscription(res.data);
    } catch (err) {
      console.error("Cancel subscription error:", err);
      setError("Cancellation failed. Check the backend or your admin rights.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-2xl text-text mb-1">Subscriptions</h2>
          <p className="text-muted text-sm">
            Manually activate an artist after confirming Mobile Money payment.
          </p>
        </div>
        <button
          onClick={loadSubscriptions}
          className="border border-border text-muted hover:text-text hover:bg-white/5 rounded-md px-4 py-2 text-xs font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Active" value={summary.active} tone="success" />
        <SummaryCard label="Trial" value={summary.trial} tone="info" />
        <SummaryCard label="Inactive" value={summary.inactive} tone="danger" />
        <SummaryCard label="Expiring soon" value={summary.expiringSoon} tone="default" />
      </div>

      <div className="border border-border bg-surface rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-faint text-[10px] uppercase tracking-wide mb-2">Search subscriptions</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Artist, username, mobile money"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "trial", "expired", "cancelled"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === option ? "bg-gold text-bg" : "bg-bg text-muted border border-border"
                }`}
              >
                {option === "all" ? "All" : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-danger/40 bg-danger/10 text-danger rounded-lg p-4 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-faint text-sm">Loading...</p>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-faint text-sm">No matching subscriptions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubscriptions.map((subscription) => {
            const isActing = actingId === subscription.id;
            const daysLeft = getDaysLeft(subscription.effective_end_date);
            const provider =
              PROVIDERS[subscription.artist_mobile_money_provider] ||
              subscription.artist_mobile_money_provider ||
              "Mobile Money";

            return (
              <div key={subscription.id} className="border border-border bg-surface rounded-lg p-5">
                <div className="flex flex-col xl:flex-row xl:items-start gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-text font-semibold">{subscription.artist_brand_name}</p>
                      <span
                        className={`border rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          STATUS_CLASSES[subscription.status]
                        }`}
                      >
                        {STATUS_LABELS[subscription.status] || subscription.status}
                      </span>
                    </div>
                    <p className="text-faint text-xs mt-1">
                      @{subscription.artist_username} · Account {subscription.artist_phone}
                    </p>
                    <p className="text-muted text-xs mt-3">
                      Artist payment: {provider} · {subscription.artist_mobile_money_number}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:w-[520px]">
                    <Info label="Price" value={`${formatPrice(subscription.monthly_price_xaf)} XAF/month`} />
                    <Info label="End date" value={formatDate(subscription.effective_end_date)} />
                    <Info label="Days left" value={daysLeft > 0 ? String(daysLeft) : "0"} />
                    <Info
                      label="Active period"
                      value={subscription.current_period_end ? formatDate(subscription.current_period_end) : "-"}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[30, 90, 365].map((days) => (
                    <button
                      key={days}
                      onClick={() => handleActivate(subscription.id, days)}
                      disabled={isActing}
                      className="bg-success text-bg rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {isActing ? "..." : `Activate ${days}d`}
                    </button>
                  ))}
                  <button
                    onClick={() => handleCancel(subscription.id)}
                    disabled={isActing}
                    className="border border-danger/50 text-danger hover:bg-danger/10 rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {isActing ? "..." : "Cancel"}
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

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "info" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "info"
      ? "text-info"
      : tone === "danger"
      ? "text-danger"
      : "text-gold-light";

  return (
    <div className="border border-border bg-surface rounded-lg p-4">
      <p className="text-faint text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-md p-3">
      <p className="text-faint text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-text text-sm font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}
