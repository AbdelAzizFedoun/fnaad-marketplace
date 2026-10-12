import React, { useCallback, useMemo, useRef, useState } from "react";
import { AppState, View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getNotifications, markNotificationRead, markNotificationsRead, deleteNotification, clearNotifications } from "../../services/api";
import { publishAppDataRefresh } from "../../services/appRefresh";
import ScreenHeader from "../../components/ScreenHeader";

type AppNotification = {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  data: { product_id?: number; commission_id?: number; conversation_id?: number; [key: string]: any };
  is_read: boolean;
  created_at: string;
};

type NotificationFilter = "all" | "unread" | "orders" | "commissions" | "social";

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "numeric", day: "numeric" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef<Promise<void> | null>(null);

  const NOTIFICATION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
    product_status: "bag-outline",
    commission_response: "mail-outline",
    comment: "chatbubble-outline",
    review: "star-outline",
    favorite: "heart-outline",
    delivery: "cube-outline",
    payment: "wallet-outline",
    order: "receipt-outline",
  };

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.is_read).length, [notifications]);

  const getCategory = (notification: AppNotification): NotificationFilter => {
    if (notification.notification_type === "commission_response") return "commissions";
    if (["order", "payment", "delivery", "product_status"].includes(notification.notification_type)) return "orders";
    if (["comment", "review", "favorite"].includes(notification.notification_type)) return "social";
    return "all";
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "all") return true;
      if (filter === "unread") return !notification.is_read;
      return getCategory(notification) === filter;
    });
  }, [filter, notifications]);

  const sections = useMemo(() => {
    const sorted = [...filteredNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;
    const groups: { title: string; data: AppNotification[] }[] = [
      { title: "Today", data: [] },
      { title: "Yesterday", data: [] },
      { title: "This week", data: [] },
      { title: "Older", data: [] },
    ];
    for (const notification of sorted) {
      const time = new Date(notification.created_at).getTime();
      if (time >= startOfToday) groups[0].data.push(notification);
      else if (time >= startOfYesterday) groups[1].data.push(notification);
      else if (time >= startOfWeek) groups[2].data.push(notification);
      else groups[3].data.push(notification);
    }
    return groups.filter((group) => group.data.length > 0);
  }, [filteredNotifications]);

  const loadNotifications = useCallback(() => {
    if (requestInFlight.current) return requestInFlight.current;
    const request = getNotifications()
      .then((res) => {
        setNotifications(res.data);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load notifications"));
    const trackedRequest = request.finally(() => {
      if (requestInFlight.current === trackedRequest) requestInFlight.current = null;
    });
    requestInFlight.current = trackedRequest;
    return trackedRequest;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const refresh = async () => {
      if (requestInFlight.current) await requestInFlight.current;
      await loadNotifications();
      publishAppDataRefresh();
    };
    void refresh().finally(() => setRefreshing(false));
  }, [loadNotifications]);

  const markAllAsRead = useCallback(() => {
    if (!notifications.some((notification) => !notification.is_read)) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    markNotificationsRead().catch(() => {
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: false })));
    });
  }, [notifications]);

  const deleteNotificationById = useCallback((notification: AppNotification, index: number) => {
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    deleteNotification(notification.id).catch(() => {
      setNotifications((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, notification);
        return next;
      });
    });
  }, []);

  const clearAll = useCallback(() => {
    const previous = notifications;
    setNotifications([]);
    clearNotifications().catch(() => setNotifications(previous));
  }, [notifications]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
      const interval = setInterval(() => {
        if (AppState.currentState === "active") void loadNotifications();
      }, 30000);
      const appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void loadNotifications();
      });
      return () => {
        clearInterval(interval);
        appStateSubscription.remove();
      };
    }, [loadNotifications])
  );

  const openNotification = (notification: AppNotification) => {
    if (!notification.is_read) {
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      ));
      markNotificationRead(notification.id).catch(() => {
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, is_read: false } : item
        ));
      });
    }

    if (notification.notification_type === "comment" && notification.data.product_id) {
      router.push({
        pathname: "/product/[id]",
        params: {
          id: String(notification.data.product_id),
          openComments: "1",
        },
      });
    } else if (notification.notification_type === "commission_response" && notification.data.commission_id) {
      router.push("/my-commissions");
    } else if (notification.data.product_id) {
      router.push({
        pathname: "/product/[id]",
        params: {
          id: String(notification.data.product_id),
          openComments: "0",
        },
      });
    } else if (notification.data.commission_id) {
      router.push("/browse-commissions");
    }
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t("Notifications") || "Notifications"} showProfileAction />
        <ScrollView
          style={styles.notificationList}
          contentContainerStyle={styles.scrollFill}
          alwaysBounceVertical
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={loadNotifications} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t("Notifications") || "Notifications"} showProfileAction />

      {notifications.length ? (
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "orders", label: "Orders" },
              { key: "commissions", label: "Commissions" },
              { key: "social", label: "Social" },
            ].map((option) => {
              const selected = filter === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.filterChip, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border }]}
                  onPress={() => setFilter(option.key as NotificationFilter)}
                >
                  <Text style={[styles.filterChipText, { color: selected ? colors.accentText : colors.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.markReadBtn} onPress={markAllAsRead} disabled={unreadCount === 0}>
            <Text style={[styles.markReadText, { color: unreadCount > 0 ? colors.accent : colors.textMuted }]}>Mark all read</Text>
          </Pressable>

          {unreadCount > 0 && (
            <View style={[styles.unreadPill, { backgroundColor: colors.accent }]}>
              <Text style={styles.unreadPillText}>{unreadCount} new</Text>
            </View>
          )}

          <Pressable style={styles.markReadBtn} onPress={clearAll}>
            <Text style={[styles.markReadText, { color: colors.textMuted }]}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.notificationList}
        contentContainerStyle={filteredNotifications.length ? styles.listContent : styles.emptyContainer}
        alwaysBounceVertical
        overScrollMode="always"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {sections.length ? sections.map((section) => (
          <View key={section.title}>
            <Text
              style={[styles.sectionHeader, { color: colors.textMuted, backgroundColor: colors.background }]}
            >
              {section.title}
            </Text>
            {section.data.map((notification, index) => (
              <Pressable
                key={notification.id}
                style={[
                  styles.notificationRow,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: notification.is_read ? "transparent" : colors.surface,
                  },
                ]}
                onPress={() => openNotification(notification)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name={NOTIFICATION_ICONS[notification.notification_type] || "color-palette-outline"}
                    size={21}
                    color={colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notificationTopRow}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      {!notification.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
                    </View>
                    <Text style={[styles.notificationTime, { color: colors.textMuted }]}>
                      {formatRelativeTime(notification.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.notificationBody, { color: colors.textMuted }]}>{notification.body}</Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteNotificationById(notification, index);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${notification.title}`}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                </Pressable>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )) : (
          <>
          <Ionicons
            name="notifications-off-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t("noNotifications") || "No notifications yet."}
          </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1 },
    notificationList: { flex: 1 },
    scrollFill: { flexGrow: 1 },
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingHorizontal: 24 },
    errorText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
    retryBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 14 },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    filterRow: { paddingRight: 8, gap: 8 },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    filterChipText: { fontSize: 12, fontWeight: "700" },
    markReadBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    markReadText: { fontSize: 12, fontWeight: "700" },
    listContent: { paddingBottom: 28 },
    notificationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    notificationTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    notificationTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
    notificationTime: { fontSize: 11 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    unreadPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    unreadPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
    notificationBody: { fontSize: 12, lineHeight: 18, marginTop: 3 },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    emptyText: { fontSize: 14, textAlign: "center" },
  });
}
