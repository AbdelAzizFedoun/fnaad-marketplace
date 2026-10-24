import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking, Animated, Modal, ScrollView } from "react-native";
import Image from "../../components/MediaImage";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { getConversationDetail, getMyConversations, sendMessage, sendLocationMessage, sendImageMessage, sendDocumentMessage, sendAudioMessage, toggleMessageReaction, updateConversationStatus, markConversationRead, reportConversation, getReviewableConversations, createReview, resolveMediaUrl, deleteConversationMessages, resumeConversation, editMessage, forwardMessage, setConversationTyping, blockConversation } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import React from "react";

// A development build made before expo-audio was installed does not contain
// ExpoAudio. Keep the entire chat usable in that case and enable voice notes
// automatically once the app is rebuilt.
let ExpoAudio: any = null;
try {
  ExpoAudio = require("expo-audio");
} catch {
  ExpoAudio = null;
}

function useVoiceRecorder() {
  if (ExpoAudio) {
    const recorder = ExpoAudio.useAudioRecorder(ExpoAudio.RecordingPresets.LOW_QUALITY);
    const state = ExpoAudio.useAudioRecorderState(recorder);
    return { recorder, state, available: true };
  }
  return { recorder: null, state: { isRecording: false }, available: false };
}

type MessageReply = {
  id: number;
  sender: number;
  sender_username: string;
  message_type: "text" | "location" | "image" | "document" | "audio";
  text: string;
};

type MessageReaction = {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
};

type Message = {
  id: number;
  sender: number;
  sender_username: string;
  message_type: "text" | "location" | "image" | "document" | "audio";
  text: string;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  document: string | null;
  audio: string | null;
  reply_to: MessageReply | null;
  reactions: MessageReaction[];
  read: boolean;
  created_at: string;
  edited_at: string | null;
  is_forwarded: boolean;
};

type ConversationContact = {
  viewer_is_customer: boolean;
  customer: {
    id: number;
    username: string;
    profile_photo: string | null;
    phone_number: string | null;
    member_since: string;
  };
  artist: {
    id: number;
    brand_name: string;
    avatar: string | null;
    region: string | null;
    region_display: string | null;
    is_verified: boolean;
    phone_number: string | null;
    mobile_money_number: string | null;
    mobile_money_provider: string | null;
  };
};

type ConversationData = {
  id: number;
  product_title: string | null;
  commission_response: number | null;
  customer_username: string;
  artist_id: number;
  artist_name: string;
  artist_avatar: string | null;
  artist_is_verified: boolean;
  status: string;
  other_user_online: boolean;
  other_user_typing: boolean;
  product_id: number | null;
  product_price_xaf: number | null;
  product_image: string | null;
  is_reported: boolean;
  messages: Message[];
  contact?: ConversationContact | null;
};

type ConversationSummary = {
  id: number;
  product_title: string | null;
  customer_username: string;
  unread: boolean;
  messages: { text: string; sender_username: string }[];
};

function DesktopInbox({ activeId, colors }: { activeId: number; colors: any }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [items, setItems] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    getMyConversations().then((res) => setItems(res.data)).catch(() => setItems([]));
  }, [activeId]);

  return (
    <View style={[desktopInboxStyles.pane, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[desktopInboxStyles.title, { color: colors.text }]}>{t("myConversationsTitle")}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const preview = item.messages?.[item.messages.length - 1];
          const active = item.id === activeId;
          return (
            <Pressable
              onPress={() => router.replace(`/conversation/${item.id}`)}
              style={[desktopInboxStyles.item, { borderColor: colors.border }, active && { backgroundColor: colors.background }]}
            >
              <View style={desktopInboxStyles.itemTop}>
                <Text numberOfLines={1} style={[desktopInboxStyles.itemTitle, { color: colors.text }]}>{item.product_title || t("commissionRequest")}</Text>
                {item.unread && !active && <View style={[desktopInboxStyles.unread, { backgroundColor: colors.accent }]} />}
              </View>
              <Text numberOfLines={1} style={[desktopInboxStyles.itemMeta, { color: colors.textMuted }]}>{item.customer_username}</Text>
              {!!preview && <Text numberOfLines={1} style={[desktopInboxStyles.preview, { color: colors.textMuted }]}>{preview.sender_username}: {preview.text}</Text>}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={[desktopInboxStyles.empty, { color: colors.textMuted }]}>{t("noConversations")}</Text>}
      />
    </View>
  );
}

const desktopInboxStyles = StyleSheet.create({
  pane: { width: 290, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  title: { fontSize: 18, fontWeight: "800", padding: 18, borderBottomWidth: 1 },
  item: { padding: 14, borderBottomWidth: 1 },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  itemMeta: { fontSize: 12, marginTop: 4 },
  preview: { fontSize: 12, marginTop: 5 },
  unread: { width: 8, height: 8, borderRadius: 4 },
  empty: { textAlign: "center", padding: 20, fontSize: 13 },
});

type ContactDetail = {
  key: string;
  icon: "call-outline" | "calendar-outline" | "wallet-outline" | "location-outline";
  value: string | null | undefined;
  onPress?: () => void;
  hiddenHint?: string;
};

function ContactCard({
  roleLabel,
  name,
  avatarUrl,
  initials,
  colors,
  styles,
  verified,
  t,
  details,
}: {
  roleLabel: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  colors: any;
  styles: any;
  verified: boolean;
  t: (key: string) => string;
  details: ContactDetail[];
}) {
  return (
    <View style={[styles.contactCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.contactCardHeader}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.contactAvatar} />
        ) : (
          <View style={[styles.contactAvatar, styles.contactAvatarFallback, { backgroundColor: colors.accent }]}>
            <Text style={[styles.contactAvatarInitial, { color: colors.accentText }]}>
              {(initials || "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.contactRole, { color: colors.textMuted }]}>{roleLabel}</Text>
          <View style={styles.contactNameRow}>
            <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            {verified && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
          </View>
        </View>
      </View>

      {details.map((detail) => (
        detail.value ? (
          <Pressable
            key={detail.key}
            style={[styles.contactDetailRow, { borderTopColor: colors.border }]}
            onPress={detail.onPress}
            disabled={!detail.onPress}
          >
            <Ionicons name={detail.icon} size={16} color={colors.textMuted} />
            <Text style={[styles.contactDetailValue, { color: detail.onPress ? colors.accent : colors.text }]}>
              {detail.value}
            </Text>
            {detail.onPress && <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />}
          </Pressable>
        ) : (
          <View key={detail.key} style={[styles.contactDetailRow, { borderTopColor: colors.border }]}>
            <Ionicons name={detail.icon} size={16} color={colors.textMuted} />
            <Text style={[styles.contactDetailHint, { color: colors.textMuted }]}>
              {detail.hiddenHint || t("notAvailable") || "Not available"}
            </Text>
          </View>
        )
      ))}
    </View>
  );
}

const DANGER = "#B0524F";
const SUCCESS = "#5FA779";
const INFO_LINK = "#1B4DA6";
const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

function getReplyPreview(message: MessageReply, t: (key: string) => string) {
  if (message.message_type === "image") return t("attachGallery");
  if (message.message_type === "document") return t("attachDocument");
  if (message.message_type === "location") return t("attachLocation");
  return message.text || t("writeMessage");
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateSeparator(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined }).format(date);
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isWithinFiveMinutes(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 5 * 60 * 1000;
}

function StarPicker({ value, onChange, accent }: { value: number; onChange: (n: number) => void; accent: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Text style={{ fontSize: 28, color: n <= value ? accent : "#3A3640" }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DateSeparator({ date, colors, styles }: { date: string; colors: any; styles: any }) {
  return (
    <View style={styles.dateSeparatorRow}>
      <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
      <Text style={styles.dateSeparatorText}>{formatDateSeparator(date)}</Text>
      <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

function OrderTimeline({ status, colors, styles }: { status: string; colors: any; styles: any }) {
  const steps = [
    { key: "negotiating", label: "Discussing", icon: "chatbubbles-outline" as const },
    { key: "confirmed", label: "Confirmed", icon: "checkmark-circle-outline" as const },
    { key: "delivered", label: "Delivered", icon: "cube-outline" as const },
  ];

  const current = status === "cancelled" ? -1 : steps.findIndex((step) => step.key === status);
  const nextStepText =
    status === "negotiating"
      ? "Next: confirm the order and delivery terms."
      : status === "confirmed"
        ? "Estimated delivery: 3–7 days after confirmation."
        : status === "delivered"
          ? "Order complete: review the finished work when ready."
          : "This conversation can be resumed by the customer.";

  return (
    <View style={[styles.timeline, { borderColor: status === "cancelled" ? DANGER : colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.timelineTitleRow}>
        <Ionicons name={status === "cancelled" ? "close-circle-outline" : "receipt-outline"} size={16} color={status === "cancelled" ? DANGER : colors.accent} />
        <Text style={[styles.timelineTitle, { color: status === "cancelled" ? DANGER : colors.text }]}>{status === "cancelled" ? "Order cancelled" : "Order progress"}</Text>
      </View>
      {status !== "cancelled" && <View style={styles.timelineSteps}>
        {steps.map((step, index) => {
          const complete = index <= current;
          return <React.Fragment key={step.key}>
            {index > 0 && <View style={[styles.timelineLine, { backgroundColor: index <= current ? colors.accent : colors.border }]} />}
            <View style={styles.timelineStep}>
              <View style={[styles.timelineIcon, { backgroundColor: complete ? colors.accent : colors.background, borderColor: complete ? colors.accent : colors.border }]}>
                <Ionicons name={complete ? "checkmark" : step.icon} size={14} color={complete ? colors.accentText : colors.textMuted} />
              </View>
              <Text style={[styles.timelineLabel, { color: complete ? colors.text : colors.textMuted }]}>{step.label}</Text>
            </View>
          </React.Fragment>;
        })}
      </View>}
      <View style={styles.timelineMetaRow}>
        <View style={[styles.timelinePill, { backgroundColor: status === "cancelled" ? DANGER : colors.accent }]}>
          <Text style={[styles.timelinePillText, { color: status === "cancelled" ? "#FFFFFF" : colors.accentText }]}>
            {status === "cancelled" ? "Restart available" : status === "negotiating" ? "Awaiting confirmation" : status === "confirmed" ? "In production" : "Completed"}
          </Text>
        </View>
      </View>
      <Text style={[styles.timelineHint, { color: colors.textMuted }]}>{nextStepText}</Text>
    </View>
  );
}

function EmptyState({ colors, styles }: { colors: any; styles: any }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
      <Text style={styles.emptyStateText}>No messages yet</Text>
      <Text style={styles.emptyStateSubtext}>The conversation starts above — send a message to continue</Text>
    </View>
  );
}

function SkeletonBubble({ colors, styles, isMine }: { colors: any; styles: any; isMine: boolean }) {
  return (
    <View style={[styles.skeletonBubble, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]} />
  );
}

function VoiceNotePlayer({ uri, mine, styles, colors }: { uri: string; mine: boolean; styles: any; colors: any }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webVoiceNote}>
        {React.createElement("audio", {
          src: uri,
          controls: true,
          preload: "none",
          "aria-label": "Voice message playback",
          style: { width: "100%", maxWidth: 300, height: 40 },
        })}
      </View>
    );
  }
  if (!ExpoAudio) {
    return <Text style={mine ? styles.voiceTextMine : styles.voiceTextTheirs}>Voice note — update app to play</Text>;
  }
  // This component is rendered only after a rebuilt app can load ExpoAudio.
  const player = ExpoAudio.useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };
  return (
    <Pressable onPress={toggle} style={styles.voiceNote} accessibilityLabel={playing ? "Pause voice note" : "Play voice note"}>
      <Ionicons name={playing ? "pause" : "play"} size={20} color={mine ? colors.accentText : colors.accent} />
      <View style={[styles.voiceWave, { backgroundColor: mine ? colors.accentText : colors.accent }]} />
      <Text style={mine ? styles.voiceTextMine : styles.voiceTextTheirs}>{playing ? "Playing…" : "Voice note"}</Text>
    </Pressable>
  );
}

function ConversationHeader({
  conversation,
  isCustomer,
  colors,
  topInset,
  onMenuPress,
  onCall,
}: {
  conversation: ConversationData;
  isCustomer: boolean;
  colors: any;
  topInset: number;
  onMenuPress?: () => void;
  onCall?: () => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const styles = headerStyles(colors, topInset);

  const displayName = isCustomer ? conversation.artist_name : conversation.customer_username;
  const avatarUrl = isCustomer ? resolveMediaUrl(conversation.artist_avatar || undefined) : null;
  const showVerified = isCustomer && conversation.artist_is_verified;
  const subtitle = conversation.product_title || t("commissionRequest");
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/conversations");
  };

  const HeaderContent = (
    <View style={styles.row}>
      <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.accent} />
      </Pressable>

      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{displayName?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {conversation.other_user_online && <View style={styles.onlineIndicator} />}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}{showVerified ? "  ✓" : ""}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {onCall && (
        <Pressable hitSlop={10} style={styles.headerIconBtn} onPress={onCall} accessibilityLabel={`Call ${displayName}`}>
          <Ionicons name="call-outline" size={20} color={colors.accent} />
        </Pressable>
      )}
      <Pressable hitSlop={10} style={styles.headerIconBtn} onPress={onMenuPress} accessibilityLabel="Conversation menu">
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  if (isCustomer) {
    return (
      <Pressable onPress={() => router.push(`/artist/${conversation.artist_id}`)}>
        {HeaderContent}
      </Pressable>
    );
  }

  return HeaderContent;
}

function headerStyles(colors: any, topInset: number) {
  return StyleSheet.create({
    row: {
      flexDirection: "row", alignItems: "center",
      paddingTop: Math.max(topInset + 8, 16), paddingBottom: 10, paddingHorizontal: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
    },
    backBtn: { marginRight: 6, padding: 4 },
    avatarContainer: { marginRight: 10, position: "relative" },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
    avatarPlaceholder: { justifyContent: "center", alignItems: "center" },
    avatarInitial: { color: colors.accent, fontSize: 16, fontWeight: "700" },
    onlineIndicator: {
      position: "absolute", bottom: -1, right: -1,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: SUCCESS, borderWidth: 2, borderColor: colors.surface,
    },
    name: { color: colors.text, fontSize: 15, fontWeight: "700" },
    subtitle: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
    headerIconBtn: { padding: 6 },
  });
}

function MessageBubble({
  item,
  isMine,
  showSender,
  showDateSeparator,
  isLastInGroup,
  colors,
  styles,
    onOpenMap,
    onOpenImage,
  onMessageLongPress,
  onToggleReaction,
  selectionMode,
  selected,
  onToggleSelected,
  artistId,
  customerUsername,
}: {
  item: Message;
  isMine: boolean;
  showSender: boolean;
  showDateSeparator: boolean;
  isLastInGroup: boolean;
  colors: any;
  styles: any;
    onOpenMap: (lat: number, lng: number) => void;
    onOpenImage: (url: string) => void;
  onMessageLongPress: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  artistId: number;
  customerUsername: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== "web" }).start();
  }, []);

  const isArtistSender = showSender && item.sender === artistId;
  const senderLabel = isArtistSender ? (
    <Pressable onPress={() => router.push(`/artist/${item.sender}`)} hitSlop={4}>
      <Text style={isMine ? styles.bubbleSenderMine : styles.bubbleSenderTheirs}>{item.sender_username}</Text>
    </Pressable>
  ) : (
    <Text style={isMine ? styles.bubbleSenderMine : styles.bubbleSenderTheirs}>{item.sender_username}</Text>
  );

  return (
    <Pressable
      onPress={selectionMode ? onToggleSelected : undefined}
      onLongPress={() => !selectionMode && onMessageLongPress(item)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={selectionMode ? "Select message" : "Message actions"}
    >
    <Animated.View style={[styles.messageItem, { opacity, marginBottom: isLastInGroup ? 6 : 2 }]}>
      {showDateSeparator && <DateSeparator date={item.created_at} colors={colors} styles={styles} />}
      <View style={[styles.messageRow, { justifyContent: isMine ? "flex-end" : "flex-start" }]}>
      {selectionMode && <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.accent : colors.textMuted} />}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, !isLastInGroup && (isMine ? styles.bubbleMineContinued : styles.bubbleTheirsContinued)]}>
        {item.is_forwarded && <Text style={isMine ? styles.forwardedMine : styles.forwardedTheirs}>Forwarded</Text>}
        {showSender ? senderLabel : null}
        {item.reply_to && (
          <View style={[styles.replyPreview, { borderColor: isMine ? colors.accentText : colors.border }]}>
            <Ionicons name="return-down-forward" size={14} color={isMine ? colors.accentText : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={isMine ? styles.replyPreviewSenderMine : styles.replyPreviewSenderTheirs} numberOfLines={1}>
                {item.reply_to.sender_username}
              </Text>
              <Text style={isMine ? styles.replyPreviewTextMine : styles.replyPreviewTextTheirs} numberOfLines={1}>
                {getReplyPreview(item.reply_to, t)}
              </Text>
            </View>
          </View>
        )}
        {item.message_type === "location" && item.latitude !== null && item.longitude !== null ? (
          <Pressable onPress={() => onOpenMap(item.latitude!, item.longitude!)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location" size={14} color={INFO_LINK} />
              <Text style={styles.bubbleLocationText}>
                {` ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)} — ${t("openInGoogleMaps") || "Open in Google Maps"}`}
              </Text>
            </View>
          </Pressable>
        ) : item.message_type === "image" && item.image ? (
          <Pressable onPress={() => onOpenImage(resolveMediaUrl(item.image || undefined)!)}>
            <Image source={{ uri: resolveMediaUrl(item.image || undefined)! }} style={styles.bubbleImage} resizeMode="cover" />
          </Pressable>
        ) : item.message_type === "document" && item.document ? (
          <Pressable onPress={() => Linking.openURL(resolveMediaUrl(item.document ?? undefined)!)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="document-attach-outline" size={20} color={INFO_LINK} />
              <Text style={styles.bubbleLocationText}> {t("openDocument") || "Open document"}</Text>
            </View>
          </Pressable>
        ) : item.message_type === "audio" && item.audio ? (
          <VoiceNotePlayer uri={resolveMediaUrl(item.audio)!} mine={isMine} styles={styles} colors={colors} />
        ) : (
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
        )}
        {!!item.reactions?.length && (
          <View style={styles.reactionsRow}>
            {item.reactions.map((reaction) => (
              <Pressable
                key={reaction.emoji}
                onPress={() => onToggleReaction(item, reaction.emoji)}
                style={[
                  styles.reactionChip,
                  { borderColor: reaction.reacted_by_me ? colors.accentText : colors.border },
                ]}
                accessibilityLabel={`${reaction.emoji} ${reaction.count}`}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                {reaction.count > 1 && <Text style={isMine ? styles.reactionCountMine : styles.reactionCountTheirs}>{reaction.count}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.messageMeta}>
          <Text style={isMine ? styles.messageTimeMine : styles.messageTimeTheirs}>{formatMessageTime(item.created_at)}</Text>
          {!!item.edited_at && <Text style={isMine ? styles.messageEditedMine : styles.messageEditedTheirs}> · Edited</Text>}
          {isMine && isLastInGroup && <Ionicons name={item.read ? "checkmark-done" : "checkmark"} size={14} color={colors.accentText} style={{ opacity: 0.75, marginLeft: 4 }} />}
        </View>
        {isMine && isLastInGroup && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 2 }}>
            <Ionicons name={item.read ? "checkmark-done" : "checkmark"} size={12} color={colors.accentText} style={{ opacity: 0.6 }} />
            <Text style={styles.readReceipt}> {item.read ? "Read" : "Sent"}</Text>
          </View>
        )}
      </View>
      </View>
    </Animated.View>
    </Pressable>
  );
}

function ProductCard({ product, colors, styles }: { product: { id: number; title: string; price_xaf: number | null; image: string | null }; colors: any; styles: any }) {
  const router = useRouter();
  return (
    <Pressable
      style={[styles.productCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`View artwork ${product.title}`}
    >
      {product.image ? (
        <Image source={{ uri: resolveMediaUrl(product.image) || undefined }} style={styles.productCardImage} />
      ) : (
        <View style={[styles.productCardImage, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name="color-palette-outline" size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.productCardBody}>
        <Text style={[styles.productCardLabel, { color: colors.textMuted }]}>About this artwork</Text>
        <Text style={[styles.productCardTitle, { color: colors.text }]} numberOfLines={1}>{product.title}</Text>
        {product.price_xaf != null && (
          <Text style={[styles.productCardPrice, { color: colors.accent }]}>{product.price_xaf} XAF</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const typingBubbleStyles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(128,128,128,0.14)",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

function TypingBubble({ colors }: { colors: any }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay(480),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={typingBubbleStyles.bubble} accessibilityRole="alert" accessibilityLabel="The other person is typing">
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            typingBubbleStyles.dot,
            {
              backgroundColor: colors.textMuted,
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, layout, insets.top, insets.bottom);

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showReportBox, setShowReportBox] = useState(false);
  const [reporting, setReporting] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingHeartbeatRef = useRef(0);

  const [canReview, setCanReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [attachVisible, setAttachVisible] = useState(false);
  const [clearMenuVisible, setClearMenuVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedText, setEditedText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardTargets, setForwardTargets] = useState<ConversationSummary[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const voiceRecorder = useVoiceRecorder();
  const recorder = voiceRecorder.recorder;
  const recorderState = voiceRecorder.state;
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [voiceCanceling, setVoiceCanceling] = useState(false);
  const voiceHoldRef = useRef(false);
  const voiceCancelRef = useRef(false);
  const voiceStartXRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (!recorderState.isRecording) {
      setVoiceElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setVoiceElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recorderState.isRecording]);

  const isCustomer = conversation?.customer_username === user?.username;
  const isArtist = user?.is_artist && !isCustomer;

  const loadConversation = () => {
    return getConversationDetail(Number(id))
      .then((res) => setConversation(res.data))
      .catch((err) => console.log("Conversation load error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  };

  const checkReviewEligibility = () => {
    getReviewableConversations()
      .then((res) => {
        const ids = res.data.map((c: { id: number }) => c.id);
        setCanReview(ids.includes(Number(id)));
      })
      .catch((err) => console.log("Reviewable check error:", err.message));
  };

  useEffect(() => {
    loadConversation();
    checkReviewEligibility();
    markConversationRead(Number(id)).catch((err) =>
      console.log("Mark read error:", err.response?.data || err.message)
    );

    const interval = setInterval(() => {
      loadConversation();
    }, 4000);

    return () => {
      clearInterval(interval);
      void setConversationTyping(Number(id), false).catch(() => undefined);
    };
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      loadConversation();
      checkReviewEligibility();
      markConversationRead(Number(id)).catch((err) =>
        console.log("Mark read error:", err.response?.data || err.message)
      );
    }, [id])
  );

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage(Number(id), text.trim(), replyingTo?.id);
      setText("");
      void setConversationTyping(Number(id), false);
      setReplyingTo(null);
      loadConversation();
    } catch (err: any) {
      console.log("Send message error:", err.response?.data || err.message);
    } finally {
      setSending(false);
    }
  };

  const handleMessageTextChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (!value.trim()) {
      void setConversationTyping(Number(id), false);
      return;
    }
    if (now - typingHeartbeatRef.current > 2500) {
      typingHeartbeatRef.current = now;
      void setConversationTyping(Number(id), true).catch(() => undefined);
    }
  };

  const startVoiceRecording = async (event?: any) => {
    if (voiceHoldRef.current || sendingVoice) return;
    if (!voiceRecorder.available || !recorder) {
      const message = Platform.OS === "web"
        ? "Voice recording is unavailable. Refresh this page and allow microphone access."
        : "Voice notes need an updated app build. Rebuild and reinstall the app, then try again.";
      if (Platform.OS === "web") setVoiceError(message);
      else Alert.alert("Voice notes", message);
      return;
    }
    setVoiceError("");
    try {
      voiceHoldRef.current = true;
      voiceCancelRef.current = false;
      setVoiceCanceling(false);
      voiceStartXRef.current = event?.nativeEvent?.pageX || 0;
      const permission = await ExpoAudio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Allow microphone access in your browser settings to record a voice note.");
      }
      await ExpoAudio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.response?.data?.audio?.[0] || error.message;
      const message = detail || "Unable to record or send this voice note. Please try again.";
      if (Platform.OS === "web") setVoiceError(message);
      else Alert.alert("Voice note", message);
    } finally {
      if (!voiceHoldRef.current) setSendingVoice(false);
    }
  };

  const finishVoiceRecording = async () => {
    if (!voiceHoldRef.current || !recorderState.isRecording) return;
    voiceHoldRef.current = false;
    const cancelled = voiceCancelRef.current;
    voiceCancelRef.current = false;
    setVoiceCanceling(false);
    setSendingVoice(true);
    try {
      await recorder.stop();
      if (!cancelled && recorder.uri) {
        await sendAudioMessage(Number(id), recorder.uri);
        loadConversation();
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.response?.data?.audio?.[0] || error.message;
      const message = detail || "Unable to send this voice note. Please try again.";
      if (Platform.OS === "web") setVoiceError(message);
      else Alert.alert("Voice note", message);
    } finally {
      setSendingVoice(false);
    }
  };

  const moveVoiceRecording = (event: any) => {
    if (!voiceHoldRef.current || !recorderState.isRecording) return;
    const currentX = event?.nativeEvent?.pageX || voiceStartXRef.current;
    if (voiceStartXRef.current - currentX > 80) {
      voiceCancelRef.current = true;
      setVoiceCanceling(true);
    }
  };

  const confirmBlockConversation = () => {
    setMenuVisible(false);
    Alert.alert(
      "Block user",
      "This will close the conversation and prevent either person from accessing or messaging in it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block", style: "destructive",
          onPress: async () => {
            try {
              await blockConversation(Number(id));
              router.replace("/(tabs)/conversations");
            } catch {
              Alert.alert("Unable to block user", "Please try again.");
            }
          },
        },
      ],
    );
  };

const handleStatusChange = async (status: "confirmed" | "cancelled" | "delivered") => {
    setUpdatingStatus(true);
    try {
      await updateConversationStatus(Number(id), status);
      loadConversation();
      checkReviewEligibility();
    } catch (err: any) {
      console.log("Status update error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle"), t("statusUpdateError"));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResumeConversation = async () => {
    setUpdatingStatus(true);
    try {
      await resumeConversation(Number(id));
      loadConversation();
    } catch (err: any) {
      console.log("Resume error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle"), t("statusUpdateError"));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await createReview({
        conversation: Number(id),
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewSubmitted(true);
      setShowReviewForm(false);
      setCanReview(false);
    } catch (err: any) {
      console.log("Review submit error:", err.response?.data || err.message);
      Alert.alert("Error", "Unable to send your review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const openMap = async (lat: number, lng: number) => {
    const query = `${lat},${lng}`;
    // Google Maps app first, then the platform geo: handler, then the web link.
    const candidates = [
      `comgooglemaps://?q=${encodeURIComponent(query)}`,
      `geo:${lat},${lng}?q=${lat},${lng}`,
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    ];

    for (const url of candidates) {
      try {
        if (url.startsWith("https://") || (await Linking.canOpenURL(url))) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // Try the next candidate.
      }
    }
    Alert.alert("Google Maps", "Unable to open this location in Google Maps.");
  };

  const handleReport = async () => {
    if (!reportText.trim()) return;
    setReporting(true);
    try {
      await reportConversation(Number(id), reportText.trim());
      setShowReportBox(false);
      setReportText("");
      loadConversation();
    } catch (err: any) {
      console.log("Report error:", err.response?.data || err.message);
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.workspace}>
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.border }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skeletonLine, { width: "60%", backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: "40%", backgroundColor: colors.border }]} />
            </View>
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <SkeletonBubble colors={colors} styles={styles} isMine={false} />
            <SkeletonBubble colors={colors} styles={styles} isMine={true} />
            <SkeletonBubble colors={colors} styles={styles} isMine={false} />
            <SkeletonBubble colors={colors} styles={styles} isMine={true} />
            <SkeletonBubble colors={colors} styles={styles} isMine={false} />
          </View>
        </View>
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Conversation introuvable.</Text>
      </View>
    );
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_username === user?.username;
    const prev = index > 0 ? conversation.messages[index - 1] : null;
    const showSender = !isMine && (!prev || prev.sender_username !== item.sender_username || !isWithinFiveMinutes(prev.created_at, item.created_at));
    const showDateSeparator = !prev || !isSameDay(prev.created_at, item.created_at);
    const isLastInGroup = index === conversation.messages.length - 1 || conversation.messages[index + 1]?.sender_username !== item.sender_username || !isWithinFiveMinutes(item.created_at, conversation.messages[index + 1].created_at);

    return (
      <MessageBubble
        item={item}
        isMine={isMine}
        showSender={showSender}
        showDateSeparator={showDateSeparator}
        isLastInGroup={isLastInGroup}
        colors={colors}
        styles={styles}
        onOpenMap={openMap}
        onOpenImage={setExpandedImageUrl}
        onMessageLongPress={setActionMessage}
        onToggleReaction={(message, emoji) => { void handleToggleReaction(message, emoji); }}
        selectionMode={selectionMode && isMine}
        selected={selectedMessageIds.has(item.id)}
        onToggleSelected={() => {
          setSelectedMessageIds((current) => {
            const next = new Set(current);
            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
            return next;
          });
        }}
        artistId={conversation.artist_id}
        customerUsername={conversation.customer_username}
      />
    );
  };

  const filteredMessages = searchQuery.trim()
    ? conversation.messages.filter((m) => m.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : conversation.messages;

  const contact = conversation.contact;

  const handleViewContact = () => {
    setMenuVisible(false);
    setContactVisible(true);
  };

  const handleReplyToMessage = (message: Message) => {
    setActionMessage(null);
    setReplyingTo(message);
  };

  const startEditingMessage = (message: Message) => {
    setActionMessage(null);
    setEditedText(message.text);
    setEditingMessage(message);
  };

  const startForwardingMessage = async (message: Message) => {
    setActionMessage(null);
    try {
      const response = await getMyConversations();
      setForwardTargets(response.data.filter((item: ConversationSummary) => item.id !== Number(id)));
      setForwardingMessage(message);
    } catch {
      Alert.alert("Unable to load conversations", "Please try again.");
    }
  };

  const forwardToConversation = async (targetId: number) => {
    if (!forwardingMessage || forwarding) return;
    setForwarding(true);
    try {
      await forwardMessage(forwardingMessage.id, targetId);
      setForwardingMessage(null);
      Alert.alert("Message forwarded", "The message was sent to the selected conversation.");
    } catch (err: any) {
      Alert.alert("Unable to forward message", err.response?.data?.conversation_id || "Please try again.");
    } finally { setForwarding(false); }
  };

  const saveMessageEdit = async () => {
    if (!editingMessage || !editedText.trim()) return;
    setSavingEdit(true);
    try {
      const response = await editMessage(editingMessage.id, editedText.trim());
      setConversation((current) => current ? {
        ...current,
        messages: current.messages.map((item) => item.id === editingMessage.id ? response.data : item),
      } : current);
      setEditingMessage(null);
    } catch (err: any) {
      Alert.alert("Unable to edit message", err.response?.data?.text || "Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleReaction = async (message: Message, emoji: string) => {
    if (reactionBusy) return;
    setReactionBusy(true);
    try {
      const response = await toggleMessageReaction(message.id, emoji);
      setConversation((current) => current ? {
        ...current,
        messages: current.messages.map((item) => item.id === message.id ? response.data : item),
      } : current);
      setActionMessage(null);
    } catch (err: any) {
      console.log("Message reaction error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle") || "Error", "Unable to update this reaction. Please try again.");
    } finally {
      setReactionBusy(false);
    }
  };

  const openDial = (phone: string) => {
    const url = `tel:${phone.replace(/\s+/g, "")}`;
    Linking.canOpenURL(url)
      .then((ok) => (ok ? Linking.openURL(url) : Alert.alert(t("contactInfo") || "Contact Info", phone)))
      .catch(() => Alert.alert(t("contactInfo") || "Contact Info", phone));
  };

  const handleViewArtistProfile = () => {
    setContactVisible(false);
    router.push(`/artist/${conversation.artist_id}`);
  };

  const handleClearChat = () => {
    setMenuVisible(false);
    setClearMenuVisible(true);
  };

  const confirmClearAll = () => {
    setClearMenuVisible(false);
    Alert.alert(
      t("clearChatTitle") || "Clear chat",
      "This will permanently unsend all of your messages from this conversation.",
      [
        { text: t("cancel") || "Cancel", style: "cancel" },
        {
          text: t("clear") || "Clear",
          style: "destructive",
          onPress: () => { void deleteMessages(); },
        },
      ]
    );
  };

  const startMessageSelection = () => {
    setClearMenuVisible(false);
    setSelectedMessageIds(new Set());
    setSelectionMode(true);
  };

  const cancelMessageSelection = () => {
    setSelectedMessageIds(new Set());
    setSelectionMode(false);
  };

  const confirmSelectedMessages = () => {
    if (!selectedMessageIds.size) return;
    Alert.alert(
      "Unsend selected messages",
      `Permanently unsend ${selectedMessageIds.size} of your message${selectedMessageIds.size === 1 ? "" : "s"}?`,
      [
        { text: t("cancel") || "Cancel", style: "cancel" },
        {
          text: "Unsend",
          style: "destructive",
          onPress: () => { void deleteMessages([...selectedMessageIds]); },
        },
      ]
    );
  };

  const deleteMessages = async (messageIds?: number[]) => {
    setDeletingMessages(true);
    try {
      await deleteConversationMessages(Number(id), messageIds);
      // Update locally for instant feedback, then refetch so the screen always
      // ends up matching what the server actually deleted.
      setConversation((current) => current ? {
        ...current,
        messages: messageIds
          ? current.messages.filter((message) => !messageIds.includes(message.id))
          : [],
      } : current);
      cancelMessageSelection();
      await loadConversation();
    } catch (err: any) {
      console.log("Message deletion error:", err.response?.data || err.message);
      Alert.alert("Unable to delete messages", err.response?.data ? JSON.stringify(err.response.data) : "Please try again.");
      loadConversation();
    } finally {
      setDeletingMessages(false);
    }
  };

  const handleSearchChat = () => {
    setMenuVisible(false);
    setShowSearch(true);
  };

  const handleReportFromMenu = () => {
    setMenuVisible(false);
    setShowReportBox(true);
  };

  const handlePickImage = async () => {
    setMenuVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo permission", "Allow photo access to send an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setSendingMedia(true);
      await sendImageMessage(Number(id), {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType || "image/jpeg",
        // expo-image-picker only returns a real File on web; without it the
        // FormData entry would be serialised as "[object Object]".
        file: (asset as any).file ?? null,
      }, replyingTo?.id);
      setReplyingTo(null);
      loadConversation();
    } catch (err: any) {
      console.log("Image pick error:", err.response?.data || err.message);
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      Alert.alert("Unable to send image", detail || "Please try again.");
    } finally {
      setSendingMedia(false);
    }
  };

  const handleTakePhoto = async () => {
    setMenuVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("permissionDeniedTitle"), "Camera permission is required.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setSendingMedia(true);
      await sendImageMessage(Number(id), {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType || "image/jpeg",
        file: (asset as any).file ?? null,
      }, replyingTo?.id);
      setReplyingTo(null);
      loadConversation();
    } catch (err: any) {
      console.log("Camera error:", err.response?.data || err.message);
      Alert.alert("Error", "Unable to send photo.");
    } finally {
      setSendingMedia(false);
    }
  };

  const handlePickDocument = async () => {
    setMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setSendingMedia(true);
      await sendDocumentMessage(Number(id), {
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        // expo-document-picker only returns a real File on web; without it the
        // FormData entry would be serialised as "[object Object]".
        file: (asset as any).file ?? null,
      }, replyingTo?.id);
      setReplyingTo(null);
      loadConversation();
    } catch (err: any) {
      console.log("Document pick error:", err.response?.data || err.message);
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      Alert.alert("Unable to send document", detail || "Please try again.");
    } finally {
      setSendingMedia(false);
    }
  };

  const handleShareLocationFromMenu = async () => {
    setMenuVisible(false);
    setSharingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("permissionDeniedTitle"), "Allow location access to share your current location.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await sendLocationMessage(Number(id), position.coords.latitude, position.coords.longitude, replyingTo?.id);
      setReplyingTo(null);
      loadConversation();
      // Deliberately no openMap() here: the sender has just shared their
      // position, the recipient opens it in Google Maps by tapping the bubble.
    } catch (err: any) {
      console.log("Location share error:", err.response?.data || err.message);
      Alert.alert("Location", "Unable to get or send your current location.");
    } finally {
      setSharingLocation(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.desktopShell}>
      {layout.isDesktop && <DesktopInbox activeId={Number(id)} colors={colors} />}
      <View style={styles.workspace}>
      <ConversationHeader
        conversation={conversation}
        isCustomer={isCustomer}
        colors={colors}
        topInset={insets.top}
        onMenuPress={() => setMenuVisible(true)}
        onCall={(() => {
          const phone = conversation.contact?.viewer_is_customer
            ? conversation.contact.artist.phone_number
            : conversation.contact?.customer.phone_number;
          return phone ? () => openDial(phone) : undefined;
        })()}
      />

      <View style={styles.subHeader}>
        <Text style={styles.headerStatus}>{t(conversation.status)}</Text>
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, { backgroundColor: conversation.other_user_online ? SUCCESS : colors.textMuted }]} />
          <Text style={styles.onlineText}>{conversation.other_user_online ? t("online") : t("offline")}</Text>
        </View>
      </View>

      <OrderTimeline status={conversation.status} colors={colors} styles={styles} />

      {conversation.product_id != null && (
        <ProductCard
          product={{
            id: conversation.product_id,
            title: conversation.product_title || "",
            price_xaf: conversation.product_price_xaf,
            image: conversation.product_image,
          }}
          colors={colors}
          styles={styles}
        />
      )}

      {conversation.other_user_typing && <TypingBubble colors={colors} />}

      <View style={styles.reportRow}>
        {conversation.is_reported ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <Ionicons name="warning" size={14} color={colors.accent} />
            <Text style={styles.reportedNotice}> {t("reportedNotice")}</Text>
          </View>
        ) : (
          <Pressable onPress={() => setShowReportBox(!showReportBox)} hitSlop={8}>
            <Text style={styles.reportLink}>{t("reportProblem")}</Text>
          </Pressable>
        )}
      </View>

      {showReportBox && !conversation.is_reported && (
        <View style={styles.reportBox}>
          <TextInput
            style={styles.reportInput}
            placeholder={t("reportPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={reportText}
            onChangeText={setReportText}
            multiline
          />
          <Pressable style={styles.reportSendBtn} onPress={handleReport} disabled={reporting}>
            <Text style={styles.reportSendBtnText}>{reporting ? "..." : t("sendReport")}</Text>
          </Pressable>
        </View>
      )}

      {showSearch && (
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchText, { color: colors.text }]}
              placeholder={t("searchChat") || "Search chat"}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => { setShowSearch(false); setSearchQuery(""); }} hitSlop={8}>
            <Text style={[styles.searchCancel, { color: colors.accent }]}>{t("cancel") || "Cancel"}</Text>
          </Pressable>
        </View>
      )}

      {selectionMode && (
        <View style={[styles.selectionBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.selectionCount, { color: colors.text }]}>{selectedMessageIds.size} selected · your messages only</Text>
          <View style={styles.selectionActions}>
            <Pressable onPress={cancelMessageSelection} hitSlop={8}>
              <Text style={[styles.selectionActionText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirmSelectedMessages} disabled={!selectedMessageIds.size || deletingMessages} hitSlop={8}>
              <Text style={[styles.selectionActionText, { color: selectedMessageIds.size && !deletingMessages ? DANGER : colors.textMuted }]}>{deletingMessages ? "Deleting…" : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={conversation.messages.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={<EmptyState colors={colors} styles={styles} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMessage}
      />

      {conversation.status === "negotiating" && isCustomer && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.confirmBtn}
            onPress={() => handleStatusChange("confirmed")}
            disabled={updatingStatus}
          >
            <Text style={styles.confirmBtnText}>{t("confirmOrder")}</Text>
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => handleStatusChange("cancelled")}
            disabled={updatingStatus}
          >
            <Text style={styles.cancelBtnText}>{t("cancelOrder")}</Text>
          </Pressable>
        </View>
      )}

      {conversation.status === "confirmed" && isArtist && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.confirmBtn}
            onPress={() => handleStatusChange("delivered")}
            disabled={updatingStatus}
          >
            <Text style={styles.confirmBtnText}>{t("markDelivered")}</Text>
          </Pressable>
        </View>
      )}

      {conversation.status === "delivered" && isCustomer && canReview && !showReviewForm && (
        <View style={styles.actionRow}>
          <Pressable style={styles.rateBtn} onPress={() => setShowReviewForm(true)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="star" size={14} color={colors.accentText} />
              <Text style={styles.rateBtnText}> Noter cette commande</Text>
            </View>
          </Pressable>
        </View>
      )}

{conversation.status === "delivered" && isCustomer && reviewSubmitted && (
        <View style={styles.actionRow}>
          <Text style={styles.reviewThanks}>Merci pour votre avis !</Text>
        </View>
      )}

      {conversation.status === "cancelled" && isCustomer && (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.confirmBtn}
            onPress={handleResumeConversation}
            disabled={updatingStatus}
          >
            <Text style={styles.confirmBtnText}>{t("resumeConversation") || "Reprendre la conversation"}</Text>
          </Pressable>
        </View>
      )}

      {showReviewForm && (
        <View style={styles.reviewForm}>
          <Text style={styles.reviewFormLabel}>Your rating</Text>
          <StarPicker value={reviewRating} onChange={setReviewRating} accent={colors.accent} />
          <TextInput
            style={styles.reviewFormInput}
            placeholder="Your comment (optional)"
            placeholderTextColor={colors.textMuted}
            value={reviewComment}
            onChangeText={setReviewComment}
            multiline
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.confirmBtn, { flex: 1 }]}
              onPress={handleSubmitReview}
              disabled={submittingReview}
            >
              <Text style={styles.confirmBtnText}>{submittingReview ? "..." : t("send")}</Text>
            </Pressable>
            <Pressable
              style={[styles.cancelBtn, { flex: 1 }]}
              onPress={() => setShowReviewForm(false)}
              disabled={submittingReview}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {replyingTo && (
        <View style={styles.composerReply}>
          <View style={[styles.composerReplyAccent, { backgroundColor: colors.accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.composerReplyLabel, { color: colors.accent }]}>{t("replyingTo")} {replyingTo.sender_username}</Text>
            <Text style={[styles.composerReplyText, { color: colors.textMuted }]} numberOfLines={1}>
              {getReplyPreview(replyingTo, t)}
            </Text>
          </View>
          <Pressable
            onPress={() => setReplyingTo(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("cancelReply")}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {recorderState.isRecording && (
        <View style={styles.voiceRecordingBar}>
          <View style={styles.voiceRecordingPulse}>
            <Ionicons name="mic" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.voiceRecordingCopy}>
            <Text style={styles.voiceRecordingTitle}>Recording voice note</Text>
            <Text style={styles.voiceRecordingHint}>
              {voiceCanceling ? "Release to cancel" : "Slide left to cancel · release to send"}
            </Text>
          </View>
          <Text style={styles.voiceRecordingTime}>{`${Math.floor(voiceElapsed / 60)}:${String(voiceElapsed % 60).padStart(2, "0")}`}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <Pressable style={styles.attachBtn} hitSlop={8} onPress={() => setAttachVisible(true)}>
          <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
        </Pressable>
        <Pressable
          style={[
            styles.recordBtn,
            Platform.OS === "web" && styles.webRecordBtn,
            recorderState.isRecording && styles.recordBtnActive,
          ]}
          hitSlop={8}
          onLongPress={(event) => { void startVoiceRecording(event); }}
          onPressOut={() => { void finishVoiceRecording(); }}
          onPressMove={moveVoiceRecording}
          disabled={sendingVoice}
          delayLongPress={350}
          accessibilityLabel="Hold to record a voice note. Release to send."
          accessibilityRole="button"
          accessibilityState={{ disabled: sendingVoice, selected: recorderState.isRecording }}
        >
          {sendingVoice ? <ActivityIndicator size="small" color={colors.accentText} /> : (
            <>
              <Ionicons name={recorderState.isRecording ? "radio" : "mic"} size={20} color={recorderState.isRecording ? "#FFFFFF" : colors.accent} />
              {Platform.OS === "web" && (
                <Text style={[styles.recordBtnText, recorderState.isRecording && styles.recordBtnTextActive]}>
                  {recorderState.isRecording ? (voiceCancelRef.current ? "Release to cancel" : "Release to send") : "Hold to record"}
                </Text>
              )}
            </>
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={t("writeMessage")}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={handleMessageTextChange}
          onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 180)}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
          {sending ? <ActivityIndicator size="small" color={colors.accentText} /> : <Ionicons name="send" size={18} color={text.trim() ? colors.accentText : colors.textMuted} />}
        </Pressable>
      </View>
      {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}

      <Modal
        visible={!!actionMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMessage(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setActionMessage(null)}>
          <Pressable style={[styles.messageActionSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            {actionMessage && (
              <>
                <Text style={[styles.messageActionTitle, { color: colors.text }]} numberOfLines={1}>
                  {actionMessage.sender_username}
                </Text>
                <View style={styles.quickReactionRow}>
                  {QUICK_REACTIONS.map((emoji) => {
                    const selected = actionMessage.reactions?.some(
                      (reaction) => reaction.emoji === emoji && reaction.reacted_by_me
                    );
                    return (
                      <Pressable
                        key={emoji}
                        style={[
                          styles.quickReactionButton,
                          { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.background : "transparent" },
                        ]}
                        onPress={() => { void handleToggleReaction(actionMessage, emoji); }}
                        disabled={reactionBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`React ${emoji}`}
                      >
                        <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.messageActionRow, { borderTopColor: colors.border }]}
                  onPress={() => handleReplyToMessage(actionMessage)}
                  accessibilityRole="button"
                >
                  <Ionicons name="return-down-forward-outline" size={21} color={colors.accent} />
                  <Text style={[styles.messageActionText, { color: colors.text }]}>{t("reply")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.messageActionRow, { borderTopColor: colors.border }]}
                  onPress={() => { void startForwardingMessage(actionMessage); }}
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-redo-outline" size={21} color={colors.accent} />
                  <Text style={[styles.messageActionText, { color: colors.text }]}>Forward</Text>
                </Pressable>
                {actionMessage.message_type === "text" && (
                  <Pressable
                    style={[styles.messageActionRow, { borderTopColor: colors.border }]}
                    onPress={() => {
                      void Clipboard.setStringAsync(actionMessage.text || "").finally(() =>
                        setActionMessage(null)
                      );
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons name="copy-outline" size={21} color={colors.accent} />
                    <Text style={[styles.messageActionText, { color: colors.text }]}>Copy</Text>
                  </Pressable>
                )}
                {actionMessage.sender_username === user?.username && actionMessage.message_type === "text" && (
                  <Pressable
                    style={[styles.messageActionRow, { borderTopColor: colors.border }]}
                    onPress={() => startEditingMessage(actionMessage)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="create-outline" size={21} color={colors.accent} />
                    <Text style={[styles.messageActionText, { color: colors.text }]}>Edit message</Text>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!forwardingMessage} transparent animationType="fade" onRequestClose={() => setForwardingMessage(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setForwardingMessage(null)}>
          <Pressable style={[styles.messageActionSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.messageActionTitle, { color: colors.text }]}>Forward to</Text>
            <ScrollView style={styles.forwardTargets} contentContainerStyle={{ gap: 4 }}>
              {forwardTargets.length ? forwardTargets.map((target) => (
                <Pressable key={target.id} style={[styles.forwardTarget, { borderColor: colors.border }]} onPress={() => { void forwardToConversation(target.id); }} disabled={forwarding}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.forwardTargetTitle, { color: colors.text }]} numberOfLines={1}>{target.product_title || "Commission request"}</Text>
                    <Text style={[styles.forwardTargetMeta, { color: colors.textMuted }]} numberOfLines={1}>{target.customer_username}</Text>
                  </View>
                  <Ionicons name="send-outline" size={19} color={colors.accent} />
                </Pressable>
              )) : <Text style={[styles.forwardEmpty, { color: colors.textMuted }]}>No other conversations available.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!editingMessage} transparent animationType="fade" onRequestClose={() => setEditingMessage(null)}>
        <KeyboardAvoidingView
          style={styles.menuOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.modalDismissArea} onPress={() => setEditingMessage(null)}>
            <Pressable style={[styles.messageActionSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.messageActionTitle, { color: colors.text }]}>Edit message</Text>
              <TextInput
                style={[styles.editInput, { borderColor: colors.border, color: colors.text }]}
                value={editedText}
                onChangeText={setEditedText}
                multiline
                autoFocus
                maxLength={4000}
              />
              <View style={styles.editActions}>
                <Pressable onPress={() => setEditingMessage(null)} style={styles.editCancel}>
                  <Text style={[styles.messageActionText, { color: colors.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => { void saveMessageEdit(); }} disabled={!editedText.trim() || savingEdit} style={[styles.editSave, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.editSaveText, { color: colors.accentText }]}>{savingEdit ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!expandedImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUrl(null)}
      >
        <Pressable
          style={styles.imageViewerBackdrop}
          onPress={() => setExpandedImageUrl(null)}
        >
          {expandedImageUrl ? (
            <Image
              source={{ uri: expandedImageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          ) : null}
          <Pressable style={styles.imageViewerClose} onPress={() => setExpandedImageUrl(null)}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleViewContact}>
              <Ionicons name="person-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("viewContact") || "View contact"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleSearchChat}>
              <Ionicons name="search-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("searchChat") || "Search chat"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleReportFromMenu}>
              <Ionicons name="warning-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("reportProblem")}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={20} color="#B0524F" />
              <Text style={[styles.menuItemText, { color: "#B0524F" }]}>{t("clearChat") || "Clear chat"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={confirmBlockConversation}>
              <Ionicons name="ban-outline" size={20} color={DANGER} />
              <Text style={[styles.menuItemText, { color: DANGER }]}>Block user</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={contactVisible} transparent animationType="fade" onRequestClose={() => setContactVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setContactVisible(false)}>
          <Pressable style={[styles.contactSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.contactTitle, { color: colors.text }]}>
              {t("contactInfo") || "Contact info"}
            </Text>

            {contact && (
              <ScrollView style={styles.contactScroll} contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
                <ContactCard
                  roleLabel={t("customer") || "Customer"}
                  name={contact.customer.username}
                  avatarUrl={resolveMediaUrl(contact.customer.profile_photo || undefined) || null}
                  initials={contact.customer.username}
                  colors={colors}
                  styles={styles}
                  verified={false}
                  t={t}
                  details={[
                    {
                      key: "phone",
                      icon: "call-outline" as const,
                      value: contact.customer.phone_number,
                      onPress: contact.customer.phone_number ? () => openDial(contact.customer.phone_number!) : undefined,
                      hiddenHint: t("phoneNotAvailable") || "Number visible after a confirmed order.",
                    },
                    {
                      key: "member",
                      icon: "calendar-outline" as const,
                      value: contact.customer.member_since
                        ? new Date(contact.customer.member_since).toLocaleDateString()
                        : null,
                    },
                  ]}
                />

                <ContactCard
                  roleLabel={t("Artist") || "Artist"}
                  name={contact.artist.brand_name}
                  avatarUrl={resolveMediaUrl(contact.artist.avatar || undefined) || null}
                  initials={contact.artist.brand_name}
                  colors={colors}
                  styles={styles}
                  verified={contact.artist.is_verified}
                  t={t}
                  details={[
                    {
                      key: "phone",
                      icon: "call-outline" as const,
                      value: contact.artist.phone_number,
                      onPress: contact.artist.phone_number ? () => openDial(contact.artist.phone_number!) : undefined,
                      hiddenHint: t("contactHiddenByPrivacy") || "Not shared with you",
                    },
                    {
                      key: "money",
                      icon: "wallet-outline" as const,
                      value: contact.artist.mobile_money_number
                        ? `${contact.artist.mobile_money_provider ? contact.artist.mobile_money_provider + " · " : ""}${contact.artist.mobile_money_number}`
                        : null,
                      hiddenHint: t("mobileMoneyNotSet") || "No mobile money number",
                    },
                    {
                      key: "region",
                      icon: "location-outline" as const,
                      value: contact.artist.region_display,
                    },
                  ]}
                />

                <Pressable
                  style={[styles.contactProfileBtn, { backgroundColor: colors.accent }]}
                  onPress={handleViewArtistProfile}
                >
                  <Ionicons name="open-outline" size={18} color={colors.accentText} />
                  <Text style={[styles.contactProfileBtnText, { color: colors.accentText }]}>
                    {t("viewArtistProfile") || "View artist profile"}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={attachVisible} transparent animationType="fade" onRequestClose={() => setAttachVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setAttachVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handlePickImage}>
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("attachGallery") || "Gallery"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("attachCamera") || "Camera"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handlePickDocument}>
              <Ionicons name="document-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("attachDocument") || "Document"}</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: colors.border }]} onPress={handleShareLocationFromMenu}>
              <Ionicons name="location-outline" size={20} color={colors.accent} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t("attachLocation") || "Share location"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={clearMenuVisible} transparent animationType="fade" onRequestClose={() => setClearMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setClearMenuVisible(false)}>
          <Pressable style={[styles.clearSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.clearTitle, { color: colors.text }]}>Clear chat</Text>
            <Text style={[styles.clearDescription, { color: colors.textMuted }]}>Choose what you want to remove from this conversation.</Text>
            <Pressable style={[styles.clearOption, { borderColor: colors.border }]} onPress={confirmClearAll}>
              <Ionicons name="trash-outline" size={21} color={DANGER} />
              <View style={styles.clearOptionCopy}>
                <Text style={[styles.clearOptionTitle, { color: DANGER }]}>Unsend all my messages</Text>
                <Text style={[styles.clearOptionText, { color: colors.textMuted }]}>Permanently remove messages you sent for both participants.</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.clearOption, { borderColor: colors.border }]} onPress={startMessageSelection}>
              <Ionicons name="checkbox-outline" size={21} color={colors.accent} />
              <View style={styles.clearOptionCopy}>
                <Text style={[styles.clearOptionTitle, { color: colors.text }]}>Select messages</Text>
                <Text style={[styles.clearOptionText, { color: colors.textMuted }]}>Choose your messages, then permanently unsend them.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.clearCancel} onPress={() => setClearMenuVisible(false)}>
              <Text style={[styles.clearCancelText, { color: colors.accent }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>,
  topInset: number,
  bottomInset: number
) {
  const workspaceMaxWidth = layout.isDesktop ? 860 : layout.isTablet ? 760 : "100%";
  const messageMaxWidth = layout.isTablet ? "70%" : "84%";
  const horizontalMessagePadding = layout.isTablet ? 24 : 12;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, alignItems: "center" },
    desktopShell: { flex: 1, width: "100%", maxWidth: layout.isDesktop ? 1180 : undefined, flexDirection: "row", gap: layout.isDesktop ? 16 : 0, paddingVertical: layout.isDesktop ? 16 : 0, paddingHorizontal: layout.isDesktop ? 16 : 0 },
    workspace: {
      flex: 1,
      width: "100%",
      maxWidth: workspaceMaxWidth,
      alignSelf: "center",
      backgroundColor: colors.background,
      borderLeftWidth: layout.isTablet ? 1 : 0,
      borderRightWidth: layout.isTablet ? 1 : 0,
      borderColor: colors.border,
    },
    listContent: { paddingHorizontal: horizontalMessagePadding, paddingTop: layout.isTablet ? 18 : 12, paddingBottom: 12 },
    emptyListContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: horizontalMessagePadding },
    subHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6,
      borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
    },
    headerStatus: { color: colors.textMuted, fontSize: 11 },
    onlineRow: { flexDirection: "row", alignItems: "center" },
    onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    onlineText: { color: colors.textMuted, fontSize: 11 },
    typingIndicator: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: colors.surface },
    typingDot: { width: 7, height: 7, borderRadius: 4 },
    typingIndicatorText: { fontSize: 12, fontStyle: "italic" },
    timeline: {
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    timelineTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    timelineTitle: { fontSize: 12, fontWeight: "700" },
    timelineSteps: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    timelineStep: { flex: 1, alignItems: "center" },
    timelineIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    timelineLine: { flex: 1, height: 2, borderRadius: 999, marginHorizontal: 4, marginBottom: 18 },
    timelineLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
    timelineMetaRow: { marginBottom: 6 },
    timelinePill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    timelinePillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
    timelineHint: { fontSize: 11, lineHeight: 16 },
    reportRow: { alignItems: "center", paddingTop: 6, paddingBottom: 2, backgroundColor: colors.surface },
    reportLink: { color: DANGER, fontSize: 11 },
    reportedNotice: { color: colors.accent, fontSize: 11 },
    reportBox: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 8, backgroundColor: colors.surface },
    reportInput: {
      borderWidth: 1, borderColor: DANGER, borderRadius: 8, padding: 10,
      color: colors.text, fontSize: 12, marginBottom: 8, minHeight: 60, textAlignVertical: "top",
    },
    reportSendBtn: { backgroundColor: DANGER, borderRadius: 8, padding: 10, alignItems: "center" },
    reportSendBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
    messageItem: { width: "100%" },
    messageRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
    bubble: { maxWidth: messageMaxWidth, flexShrink: 1, borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
    bubbleMine: { backgroundColor: colors.accent, alignSelf: "flex-end", borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.surface, alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
    bubbleMineContinued: { borderBottomRightRadius: 16, marginBottom: 2 },
    bubbleTheirsContinued: { borderBottomLeftRadius: 16, marginBottom: 2 },
    bubbleSenderMine: { fontSize: 11, color: colors.accentText, opacity: 0.7, marginBottom: 2 },
    bubbleSenderTheirs: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
    bubbleTextMine: { fontSize: 14, color: colors.accentText, lineHeight: 20 },
    bubbleTextTheirs: { fontSize: 14, color: colors.text, lineHeight: 20 },
    forwardedMine: { fontSize: 11, color: colors.accentText, opacity: 0.75, fontStyle: "italic", marginBottom: 4 },
    forwardedTheirs: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginBottom: 4 },
    replyPreview: { flexDirection: "row", alignItems: "center", gap: 6, borderLeftWidth: 2, paddingLeft: 8, marginBottom: 7, opacity: 0.86 },
    replyPreviewSenderMine: { color: colors.accentText, fontSize: 11, fontWeight: "700" },
    replyPreviewSenderTheirs: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
    replyPreviewTextMine: { color: colors.accentText, fontSize: 11, marginTop: 1 },
    replyPreviewTextTheirs: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
    bubbleLocationText: { fontSize: 13, color: INFO_LINK, fontWeight: "600", textDecorationLine: "underline" },
    bubbleImage: { width: layout.isTablet ? 320 : 220, height: layout.isTablet ? 320 : 220, borderRadius: 12, marginTop: 4, marginBottom: 4 },
    voiceNote: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 170, paddingVertical: 5 },
    webVoiceNote: { width: 300, maxWidth: "100%", minWidth: 220 },
    voiceWave: { width: 38, height: 3, borderRadius: 2, opacity: 0.7 },
    voiceTextMine: { color: colors.accentText, fontSize: 13, fontWeight: "600" },
    voiceTextTheirs: { color: colors.text, fontSize: 13, fontWeight: "600" },
    imageViewerBackdrop: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.94)",
      alignItems: "center", justifyContent: "center",
    },
    imageViewerImage: { width: "100%", height: "100%" },
    imageViewerClose: { position: "absolute", top: 44, right: 22, padding: 6 },
    messageMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 },
    messageTimeMine: { fontSize: 11, color: colors.accentText, opacity: 0.7 },
    messageTimeTheirs: { fontSize: 11, color: colors.textMuted },
    messageEditedMine: { fontSize: 11, color: colors.accentText, opacity: 0.7 },
    messageEditedTheirs: { fontSize: 11, color: colors.textMuted },
    readReceipt: { fontSize: 11, color: colors.accentText, opacity: 0.6, marginTop: 2, textAlign: "right" },
    reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 7 },
    reactionChip: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.background },
    reactionEmoji: { fontSize: 13 },
    reactionCountMine: { fontSize: 11, color: colors.accentText, fontWeight: "700" },
    reactionCountTheirs: { fontSize: 11, color: colors.text, fontWeight: "700" },
    dateSeparatorRow: { flexDirection: "row", alignItems: "center", marginVertical: 8, marginHorizontal: 4 },
    dateSeparatorLine: { flex: 1, height: 1 },
    dateSeparatorText: { color: colors.textMuted, fontSize: 11, marginHorizontal: 10, fontWeight: "600" },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
    emptyStateText: { color: colors.text, fontSize: 16, fontWeight: "600" },
    emptyStateSubtext: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
    actionRow: {
      flexDirection: "row", paddingHorizontal: horizontalMessagePadding, paddingBottom: 10, gap: 8, backgroundColor: colors.surface,
    },
    confirmBtn: {
      flex: 1, backgroundColor: SUCCESS, borderRadius: 8, padding: 12, alignItems: "center",
    },
    confirmBtnText: { color: "#0B0A0C", fontWeight: "700", fontSize: 12 },
    rateBtn: {
      flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: "center",
    },
    rateBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 12 },
    cancelBtn: {
      flex: 1, backgroundColor: DANGER, borderRadius: 8, padding: 12, alignItems: "center",
    },
    cancelBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
    reviewThanks: { color: SUCCESS, fontSize: 12, textAlign: "center", flex: 1 },
    reviewForm: {
      paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, backgroundColor: colors.surface,
    },
    reviewFormLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
    reviewFormInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10,
      color: colors.text, fontSize: 12, marginTop: 10, marginBottom: 10, minHeight: 60, textAlignVertical: "top",
    },
    inputRow: { flexDirection: "row", paddingHorizontal: layout.isTablet ? 16 : 10, paddingTop: 10, paddingBottom: Math.max(12, bottomInset), borderTopWidth: 1, borderTopColor: colors.border, alignItems: "flex-end", backgroundColor: colors.surface, gap: 8 },
    voiceRecordingBar: { flexDirection: "row", alignItems: "center", marginHorizontal: layout.isTablet ? 16 : 10, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: DANGER, gap: 10 },
    voiceRecordingPulse: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)" },
    voiceRecordingCopy: { flex: 1 },
    voiceRecordingTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    voiceRecordingHint: { color: "rgba(255,255,255,0.82)", fontSize: 11, marginTop: 2 },
    voiceRecordingTime: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
    attachBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    recordBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent },
    webRecordBtn: { width: 118, flexDirection: "row", gap: 7, paddingHorizontal: 10 },
    recordBtnActive: { backgroundColor: DANGER, borderColor: DANGER },
    recordBtnText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    recordBtnTextActive: { color: "#FFFFFF" },
    voiceError: { color: DANGER, fontSize: 12, paddingHorizontal: 14, paddingBottom: 8 },
    input: {
      flex: 1, backgroundColor: colors.background, borderRadius: 22,
      paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 14, maxHeight: 100,
    },
    sendBtn: { backgroundColor: colors.accent, borderRadius: 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    composerReply: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
    composerReplyAccent: { width: 3, alignSelf: "stretch", borderRadius: 2 },
    composerReplyLabel: { fontSize: 12, fontWeight: "700" },
    composerReplyText: { fontSize: 12, marginTop: 2 },
    error: { color: "#E7A0A0", fontSize: 13, textAlign: "center", marginTop: 60 },
    skeletonHeader: { flexDirection: "row", alignItems: "center", paddingTop: Math.max(topInset + 8, 16), paddingBottom: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, gap: 10 },
    skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
    skeletonLine: { height: 12, borderRadius: 6 },
    skeletonBubble: { height: 48, borderRadius: 16, width: "70%", marginBottom: 8, backgroundColor: colors.border },
    searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.surface, gap: 8 },
    searchInput: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background },
    searchText: { flex: 1, fontSize: 14 },
    searchCancel: { fontSize: 14, fontWeight: "600" },
    selectionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
    selectionCount: { fontSize: 14, fontWeight: "700" },
    selectionActions: { flexDirection: "row", gap: 20 },
    selectionActionText: { fontSize: 14, fontWeight: "700" },
    menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    modalDismissArea: { flex: 1, justifyContent: "flex-end" },
    menuSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingHorizontal: 8 },
    menuHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 8 },
    menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, gap: 14 },
    menuItemText: { fontSize: 15, fontWeight: "600" },
    messageActionSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 22, paddingHorizontal: 16 },
    messageActionTitle: { fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 14 },
    quickReactionRow: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginBottom: 16 },
    quickReactionButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    quickReactionEmoji: { fontSize: 22 },
    messageActionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 15, paddingBottom: 4 },
    messageActionText: { fontSize: 15, fontWeight: "700" },
    forwardTargets: { maxHeight: 340 },
    forwardTarget: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingVertical: 13 },
    forwardTargetTitle: { fontSize: 14, fontWeight: "700" },
    forwardTargetMeta: { fontSize: 12, marginTop: 3 },
    forwardEmpty: { textAlign: "center", paddingVertical: 18, fontSize: 13 },
    editInput: { borderWidth: 1, borderRadius: 10, minHeight: 100, padding: 12, fontSize: 15, textAlignVertical: "top" },
    editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 14 },
    editCancel: { paddingHorizontal: 14, paddingVertical: 10 },
    editSave: { borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10 },
    editSaveText: { fontSize: 14, fontWeight: "700" },
    clearSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, paddingHorizontal: 16 },
    clearTitle: { fontSize: 19, fontWeight: "800", marginTop: 4 },
    clearDescription: { fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 14 },
    clearOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1 },
    clearOptionCopy: { flex: 1 },
    clearOptionTitle: { fontSize: 15, fontWeight: "700" },
    clearOptionText: { fontSize: 12, lineHeight: 17, marginTop: 2 },
    clearCancel: { alignItems: "center", paddingTop: 16 },
    clearCancelText: { fontSize: 15, fontWeight: "700" },
    contactSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
      paddingHorizontal: 16,
      maxHeight: "82%",
    },
    contactTitle: { fontSize: 19, fontWeight: "800", marginTop: 4, marginBottom: 14 },
    contactScroll: { flexGrow: 0 },
    contactCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
    contactCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    contactAvatar: { width: 48, height: 48, borderRadius: 24 },
    contactAvatarFallback: { alignItems: "center", justifyContent: "center" },
    contactAvatarInitial: { fontSize: 19, fontWeight: "800" },
    contactNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    contactRole: { fontSize: 12, marginBottom: 2 },
    contactName: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
    contactDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingTop: 12,
      marginTop: 12,
      borderTopWidth: 1,
    },
    contactDetailValue: { fontSize: 14, fontWeight: "600", flex: 1 },
    contactDetailHint: { fontSize: 13, fontStyle: "italic", flex: 1 },
    contactProfileBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
    },
    contactProfileBtnText: { fontSize: 15, fontWeight: "700" },
    productCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 10,
      padding: 10,
      borderWidth: 1,
      borderRadius: 14,
    },
    productCardImage: { width: 52, height: 52, borderRadius: 10 },
    productCardBody: { flex: 1, gap: 2 },
    productCardLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
    productCardTitle: { fontSize: 14, fontWeight: "700" },
    productCardPrice: { fontSize: 13, fontWeight: "800" },
  });
}
