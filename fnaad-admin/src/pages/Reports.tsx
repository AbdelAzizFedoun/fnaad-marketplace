import { useEffect, useMemo, useState } from "react";
import { getReportedConversations } from "../services/api";

type Message = {
  id: number;
  sender: number;
  sender_username: string;
  message_type: string;
  text: string;
  created_at: string;
};

type ReportedConversation = {
  id: number;
  product: number;
  product_title: string;
  customer: number;
  customer_username: string;
  artist_id: number;
  artist_name: string;
  artist_is_verified: boolean;
  status: string;
  is_reported: boolean;
  report_reason: string;
  reported_at: string;
  created_at: string;
  messages: Message[];
};

export default function Reports() {
  const [conversations, setConversations] = useState<ReportedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getReportedConversations()
      .then((res) => setConversations(res.data))
      .catch((err) => console.error("Reports error:", err))
      .finally(() => setLoading(false));
  }, []);

  const issueFilters = useMemo(() => {
    const reasons = conversations
      .map((item) => item.report_reason || "Other")
      .filter(Boolean)
      .map((reason) => reason.trim());

    return ["all", ...Array.from(new Set(reasons.map((reason) => reason.toLowerCase())))];
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...conversations]
      .filter((conv) => {
        const matchesFilter =
          filter === "all" ||
          (conv.report_reason || "Other").toLowerCase().includes(filter) ||
          filter === "other" && !(conv.report_reason || "Other").trim();

        const haystack = [
          conv.product_title,
          conv.customer_username,
          conv.artist_name,
          conv.report_reason,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = !query || haystack.includes(query);
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
  }, [conversations, filter, search]);

  const stats = useMemo(() => {
    const reasons = conversations.reduce<Record<string, number>>((acc, conv) => {
      const key = (conv.report_reason || "Other").trim() || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      total: conversations.length,
      uniqueArtists: new Set(conversations.map((conv) => conv.artist_id)).size,
      topReason: Object.entries(reasons).sort((a, b) => b[1] - a[1])[0],
    };
  }, [conversations]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-text mb-1">Reports</h2>
      <p className="text-muted text-sm mb-6">Prioritize user-reported conversations before they escalate.</p>

      <div className="border border-border bg-surface rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="block text-faint text-[10px] uppercase tracking-wide mb-2">Search reports</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, customer, artist, reason"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {issueFilters.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === option ? "bg-danger text-bg" : "bg-bg text-muted border border-border"
                }`}
              >
                {option === "all" ? "All" : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Open reports</p>
          <p className="text-2xl font-display text-text mt-2">{stats.total}</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Artists involved</p>
          <p className="text-2xl font-display text-gold-light mt-2">{stats.uniqueArtists}</p>
        </div>
        <div className="border border-border bg-surface rounded-lg p-4">
          <p className="text-faint text-[10px] uppercase tracking-wide">Most common reason</p>
          <p className="text-lg font-display text-text mt-2">{stats.topReason ? stats.topReason[0] : "None"}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-faint text-sm">Loading...</p>
      ) : filteredConversations.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-faint text-sm">No matching reports found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => {
            const isExpanded = expandedId === conv.id;

            return (
              <div
                key={conv.id}
                className="border border-border bg-surface rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(conv.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-text text-sm font-semibold truncate">
                        {conv.product_title}
                      </p>
                      <span className="text-danger text-[10px] font-bold border border-danger/40 rounded-full px-2 py-0.5 shrink-0">
                        REPORTED
                      </span>
                      <span className="text-faint text-[10px] border border-border rounded-full px-2 py-0.5 shrink-0">
                        {conv.report_reason || "Other"}
                      </span>
                    </div>
                    <p className="text-muted text-xs mt-1">
                      {conv.customer_username} → {conv.artist_name}
                      {conv.artist_is_verified && <span className="text-gold ml-1">✓</span>}
                    </p>
                    {conv.report_reason && (
                      <p className="text-faint text-xs mt-1 italic truncate">
                        Reason: {conv.report_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-faint text-xs">
                      {conv.reported_at ? new Date(conv.reported_at).toLocaleDateString("en-US") : ""}
                    </p>
                    <p className="text-faint text-xs mt-1">
                      {isExpanded ? "Collapse ▲" : "View conversation ▼"}
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-bg p-4 space-y-3 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-faint">
                      <span>Conversation status</span>
                      <span>{conv.status || "Open"}</span>
                    </div>
                    {conv.messages.length === 0 ? (
                      <p className="text-faint text-xs">No messages in this conversation.</p>
                    ) : (
                      conv.messages.map((msg) => {
                        const isArtist = msg.sender === conv.artist_id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isArtist ? "items-end" : "items-start"}`}
                          >
                            <p className="text-faint text-[10px] mb-0.5">
                              {msg.sender_username}
                            </p>
                            <div
                              className={`max-w-[75%] rounded-md px-3 py-2 text-xs ${
                                isArtist
                                  ? "bg-gold/10 text-gold-light border border-gold/20"
                                  : "bg-surface text-text border border-border"
                              }`}
                            >
                              {msg.message_type === "text" ? (
                                msg.text
                              ) : (
                                <span className="italic text-faint">
                                  [{msg.message_type}]
                                </span>
                              )}
                            </div>
                            <p className="text-faint text-[10px] mt-0.5">
                              {new Date(msg.created_at).toLocaleString("en-US")}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}