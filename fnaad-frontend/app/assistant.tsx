import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Animated,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  type DimensionValue,
} from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { assistantChat, resolveMediaUrl, sanaaImageRank } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type RecommendedProduct = {
  id: number;
  title: string;
  description: string;
  price_xaf: number;
  category_display: string;
  images: { image: string | null; is_primary: boolean }[];
  artist_name: string;
  artist_region_display: string | null;
  average_rating: number | null;
  review_count: number;
};

type RecommendedArtist = {
  id: number;
  brand_name: string;
  region_display: string;
  avatar: string | null;
  artistic_practice?: string;
  is_verified?: boolean;
  average_rating?: number | null;
  review_count?: number;
  like_count?: number;
};

const STARTER_KEYS = [
  "assistant_starter_1",
  "assistant_starter_2",
  "assistant_starter_3",
  "assistant_starter_4",
] as const;

/**
 * A titled block of recommendations.
 *
 * On a phone there is only room for a swipeable rail under the thread. From
 * tablet width up the same block becomes a vertical list inside the side pane,
 * so it gets a real card shape instead of being cropped to a 180pt sliver.
 */
function RecommendationBlock<T extends { id: number }>({
  title,
  data,
  renderItem,
  styles,
  stacked,
  testID,
}: {
  title: string;
  data: T[];
  renderItem: (item: T) => React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  stacked: boolean;
  testID?: string;
}) {
  if (!data.length) return null;

  if (!stacked) {
    return (
      <View style={styles.recommendationSection} testID={testID}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlatList
          data={data}
          renderItem={({ item }) => <>{renderItem(item)}</>}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.recommendationSection} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.stackList}>
        {data.map((item) => (
          <View key={item.id.toString()}>{renderItem(item)}</View>
        ))}
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const { loggedIn, user } = useAuth();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = useMemo(() => createStyles(colors, layout), [colors, layout]);
  const { t } = useLanguage();
  const router = useRouter();

  // From tablet width up the thread and the recommendations get their own
  // columns, so a long answer no longer has to share a 4-inch-wide screen with
  // three carousels stacked underneath it.
  //
  // The threshold is 900 rather than the hook's 768: at 768 a side pane would
  // leave the conversation itself under 450pt, which is the part that has to be
  // comfortable. Below 900 the extra width goes to the rail cards instead.
  const isWide = layout.width >= 900;

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
  const [recommendedArtists, setRecommendedArtists] = useState<RecommendedArtist[]>([]);
  const [imageRankArtists, setImageRankArtists] = useState<RecommendedArtist[]>([]);
  const [imageMatchedCategory, setImageMatchedCategory] = useState<string | null>(null);
  const [imageRankLoading, setImageRankLoading] = useState(false);
  const [imageRankError, setImageRankError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList<AssistantMessage>>(null);
  const sanaaMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sanaaMotion, { toValue: 1, duration: 950, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(sanaaMotion, { toValue: 0, duration: 950, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [sanaaMotion]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // A new text question invalidates any image results still on screen. Leaving
  // them there made the carousel look like it belonged to the new question.
  const clearImageResults = useCallback(() => {
    setImageRankArtists([]);
    setImageMatchedCategory(null);
    setImageRankError(null);
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    clearImageResults();
    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await assistantChat(trimmed, nextMessages);
      const data = response.data;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "" }]);
      setRecommendedProducts(data.recommended_products || []);
      setRecommendedArtists(data.recommended_artists || []);
      // The backend answers from a fixed offline set when no AI provider is
      // configured, and says so. Show that instead of hiding it.
      setDegraded(Boolean(data.degraded));
    } catch (err: any) {
      const status = err?.response?.status;
      const message =
        status === 429
          ? t("assistant_rate_limited")
          : err?.response?.data?.detail || err?.message || t("assistant_unavailable_reply");
      setError(String(message));
      setMessages((prev) => [...prev, { role: "assistant", content: t("assistant_unavailable_reply") }]);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = (prompt: string) => {
    setInput(prompt);
  };

  const pickReferenceImage = async () => {
    setError(null);
    setImageRankError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("photoPermissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      mediaTypes: ["images"],
    });
    if (result.canceled) return;
    const picked = result.assets?.[0];
    if (picked?.uri) {
      runImageRank(picked.uri, input);
    }
  };

  const runImageRank = async (imageUri: string, prompt: string) => {
    setImageRankLoading(true);
    setImageRankError(null);
    try {
      const response = await sanaaImageRank(imageUri, prompt.trim() || undefined);
      const data = response.data;
      setImageRankArtists(data.artists || []);
      setImageMatchedCategory(data.category || null);
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
      if (!data.artists?.length) {
        setImageRankError(t("assistant_no_match"));
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || t("assistant_image_type_error");
      setImageRankError(String(message));
    } finally {
      setImageRankLoading(false);
    }
  };

  const renderMessage = useCallback(({ item }: { item: AssistantMessage }) => (
    <View
      style={[styles.messageBubble, item.role === "assistant" ? styles.assistantBubble : styles.userBubble]}
      accessibilityRole="text"
      accessibilityLabel={item.content}
    >
      <Text style={item.role === "assistant" ? styles.assistantText : styles.userText}>{item.content}</Text>
    </View>
  ), [styles]);

  const renderProduct = useCallback(({ item }: { item: RecommendedProduct }) => {
    const imageUrl = resolveMediaUrl(item.images?.find((img) => img.is_primary)?.image || item.images?.[0]?.image || undefined);
    return (
      <Pressable
        style={[styles.productCard, isWide && styles.cardStacked]}
        onPress={() => router.push(`/product/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.price_xaf} XAF, ${item.artist_name}`}
      >
        {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.productImage, isWide && styles.productImageStacked]} /> : null}
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.productMeta} numberOfLines={1}>{item.category_display} · {item.price_xaf} XAF</Text>
        <Text style={styles.productMeta} numberOfLines={1}>{item.artist_name}{item.artist_region_display ? ` · ${item.artist_region_display}` : ""}</Text>
      </Pressable>
    );
  }, [router, styles, isWide]);

  const renderArtist = useCallback(({ item }: { item: RecommendedArtist }) => (
    <Pressable
      style={[styles.artistCard, isWide && styles.cardStacked]}
      onPress={() => router.push(`/artist/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.brand_name}
    >
      <View style={styles.artistTitleRow}>
        <Text style={styles.artistName} numberOfLines={1}>{item.brand_name}</Text>
        {item.is_verified ? <Ionicons name="checkmark-circle" size={15} color="#5FA779" /> : null}
      </View>
      {item.artistic_practice ? <Text style={styles.artistPractice} numberOfLines={1}>{item.artistic_practice}</Text> : null}
      <Text style={styles.artistMeta} numberOfLines={1}>{item.region_display}</Text>
      {item.average_rating ? <View style={styles.artistScore}><Ionicons name="star" size={13} color="#E7C878" /><Text style={styles.artistScoreText}>{item.average_rating.toFixed(1)}{item.review_count ? ` (${item.review_count})` : ""}{item.like_count ? ` · ${item.like_count} likes` : ""}</Text></View> : null}
    </Pressable>
  ), [router, styles, isWide]);

  const sanaaBrand = (
    <View style={styles.brandLockup}>
      <Animated.Image
        source={require("../assets/logo-full-transparent.png")}
        style={[styles.brandLogo, {
          opacity: sanaaMotion.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] }),
          transform: [{ translateY: sanaaMotion.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }],
        }]}
        resizeMode="contain"
      />
    </View>
  );

  const emptyState = (
    <View style={styles.emptyState}>
      <Ionicons name="sparkles-outline" size={30} color={colors.accent} />
      <Text style={styles.emptyText}>{t("assistant_empty")}</Text>
      <Text style={styles.emptyHint}>{t("assistant_empty_hint")}</Text>
      <Text style={styles.startersLabel}>{t("assistant_starters")}</Text>
      <View style={styles.starterList}>
        {STARTER_KEYS.map((key) => (
          <Pressable
            key={key}
            style={[styles.starterChip, isWide && styles.starterChipHalf]}
            onPress={() => startConversation(t(key))}
            accessibilityRole="button"
          >
            <Text style={styles.starterText}>{t(key)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const productBlock = (
    <RecommendationBlock
      title={t("recommendedProducts")}
      data={recommendedProducts}
      renderItem={(item) => renderProduct({ item })}
      styles={styles}
      stacked={isWide}
      testID="assistant-products"
    />
  );

  const artistBlock = (
    <RecommendationBlock
      title={t("recommendedArtists")}
      data={recommendedArtists}
      renderItem={(item) => renderArtist({ item })}
      styles={styles}
      stacked={isWide}
      testID="assistant-artists"
    />
  );

  const imageBlock = (
    <RecommendationBlock
      // This used to carry the same label as the text recommendations, so the
      // user could not tell which carousel answered which question.
      title={imageMatchedCategory ? t("assistant_matches_from_image") : t("assistant_best_available")}
      data={imageRankArtists}
      renderItem={(item) => renderArtist({ item })}
      styles={styles}
      stacked={isWide}
      testID="assistant-image-artists"
    />
  );

  const hasRecommendations =
    recommendedProducts.length > 0 || recommendedArtists.length > 0 || imageRankArtists.length > 0;

  const thread = (
    <KeyboardAvoidingView
      style={styles.threadKeyboardAvoiding}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
    <View style={styles.thread}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t("goBack")}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </Pressable>
        <View style={styles.headerText}>
          {sanaaBrand}
          <Text style={styles.headerSubtitle} numberOfLines={isWide ? 1 : 2}>{t("assistant_header_subtitle")}</Text>
        </View>
        {loggedIn && (
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("profile")}
          >
            {user?.profile_photo ? <Image source={{ uri: resolveMediaUrl(user.profile_photo)! }} style={styles.profileImage} /> : <Text style={[styles.profileInitial, { color: colors.accentText }]}>{(user?.username || "U").slice(0, 1).toUpperCase()}</Text>}
          </Pressable>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.messagesListEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={loading ? (
          <View style={styles.typingRow} accessibilityRole="alert" accessibilityLabel={t("assistant_typing")}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={styles.typingText}>{t("assistant_typing")}</Text>
          </View>
        ) : null}
        ListEmptyComponent={emptyState}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {degraded && !error ? <Text style={styles.degradedText}>{t("assistant_degraded_notice")}</Text> : null}
      {imageRankLoading ? (
        <View style={styles.imageRankLoading}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.typingText}>{t("assistant_typing")}</Text>
        </View>
      ) : null}
      {imageRankError ? <Text style={styles.errorText}>{imageRankError}</Text> : null}

      {/* On a phone the recommendations live here, under the thread. From tablet
          width up they are hoisted into the side pane instead. */}
      {isWide || keyboardVisible ? null : (
        <>
          {productBlock}
          {artistBlock}
          {imageBlock}
        </>
      )}

      <View style={styles.inputWrap}>
        <View style={styles.inputRow}>
          <Pressable
            style={styles.imageButton}
            onPress={pickReferenceImage}
            disabled={imageRankLoading}
            accessibilityRole="button"
            accessibilityLabel={t("assistant_upload_label")}
          >
            <Ionicons name="image-outline" size={22} color={colors.accent} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder={t("assistant_input_placeholder")}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            accessibilityLabel={t("assistant_input_placeholder")}
          />
          {imageRankArtists.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={clearImageResults}
              accessibilityRole="button"
              accessibilityLabel={t("assistant_clear_image_label")}
            >
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.sendButton, !input.trim() && styles.sendButtonIdle]}
            onPress={handleSend}
            disabled={loading || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel={t("assistant_send_label")}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </Pressable>
        </View>
      </View>
    </View>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.container}>
      {isWide ? (
        <View style={styles.panes}>
          {thread}
          <View style={styles.sidePane}>
            <ScrollView
              style={styles.sideScroll}
              contentContainerStyle={styles.sideContent}
              showsVerticalScrollIndicator={false}
            >
              {hasRecommendations ? (
                <>
                  {productBlock}
                  {artistBlock}
                  {imageBlock}
                </>
              ) : (
                <View style={styles.sidePlaceholder}>
                  <Ionicons name="sparkles-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.sidePlaceholderText}>{t("assistant_side_hint")}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      ) : (
        thread
      )}
    </View>
  );
}

function createStyles(colors: any, layout: ReturnType<typeof useResponsiveLayout>) {
  const isWide = layout.width >= 900;
  const isDesktop = layout.isDesktop;

  // The thread is the column that must stay readable, so its measure is capped
  // even on a 1400px monitor: an answer running the full width of a desktop
  // window is unreadable, whatever the extra pixels are used for.
  const sideWidth = isDesktop ? 360 : 320;
  const contentWidth = Math.min(layout.width, layout.maxContentWidth);
  const threadWidth = isWide ? contentWidth - sideWidth - 1 : contentWidth;
  const threadInner = threadWidth - layout.horizontalPadding * 2;

  // A comfortable chat measure, never wider than the pane holding it.
  const bubbleMax: DimensionValue = isWide
    ? Math.min(560, threadInner * 0.82)
    : "82%";

  // Rail cards fill the phone width minus padding; in the side pane they fill it.
  // The caps grow a little past the phone range so a tablet in single-column
  // mode does not end up with 240pt cards marooned on a 768pt screen.
  const productCardWidth = isWide
    ? sideWidth - layout.horizontalPadding * 2
    : Math.min(300, contentWidth * 0.62);
  const artistCardWidth = isWide
    ? sideWidth - layout.horizontalPadding * 2
    : Math.min(260, contentWidth * 0.52);
  const starterWidth: DimensionValue = isWide ? `${100 / STARTER_KEYS.length - 1.6}%` : "100%";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Two panes on tablet and up, one column on a phone.
    panes: {
      flex: 1,
      width: "100%",
      maxWidth: layout.maxContentWidth,
      alignSelf: "center",
      flexDirection: "row",
    },
    thread: { flex: 1, minWidth: 0 },
    threadKeyboardAvoiding: { flex: 1, minWidth: 0 },

    sidePane: {
      width: sideWidth,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      backgroundColor: colors.background,
    },
    sideScroll: { flex: 1 },
    sideContent: { paddingVertical: 8, paddingBottom: 24 },
    sidePlaceholder: { alignItems: "center", paddingHorizontal: 24, paddingTop: 48, gap: 10 },
    sidePlaceholderText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: layout.topPadding,
      paddingBottom: isWide ? 18 : 16,
      paddingHorizontal: layout.horizontalPadding,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: { marginRight: 12 },
    headerText: { flex: 1, minWidth: 0 },
    profileButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", overflow: "hidden", marginLeft: 12 },
    profileImage: { width: 38, height: 38, borderRadius: 19 },
    profileInitial: { fontSize: 16, fontWeight: "800" },
    brandLockup: { alignItems: "flex-start" },
    brandLogo: { width: isWide ? 112 : 96, height: isWide ? 38 : 34 },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
      maxWidth: isWide ? threadInner - 130 : 260,
    },

    messagesList: {
      paddingHorizontal: layout.horizontalPadding,
      paddingBottom: 16,
    },
    // Centre the welcome state in whatever height the pane has, instead of
    // pinning it to the top of a tall empty screen.
    messagesListEmpty: { flexGrow: 1, justifyContent: "center" },

    messageBubble: {
      borderRadius: 18,
      padding: 12,
      marginBottom: 10,
      maxWidth: bubbleMax,
    },
    userBubble: {
      backgroundColor: colors.accent,
      alignSelf: "flex-end",
      borderBottomRightRadius: 6,
    },
    assistantBubble: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      alignSelf: "flex-start",
      borderBottomLeftRadius: 6,
    },
    userText: { color: colors.accentText, fontSize: 14, lineHeight: 20 },
    assistantText: { color: colors.text, fontSize: 14, lineHeight: 20 },

    emptyState: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 24 },
    emptyText: { color: colors.text, fontSize: isWide ? 17 : 15, fontWeight: "700", textAlign: "center", marginTop: 10 },
    emptyHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, maxWidth: 420 },
    startersLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 22, textTransform: "uppercase" },
    starterList: { width: "100%", marginTop: 10, gap: 8, flexDirection: isWide ? "row" : "column", flexWrap: isWide ? "wrap" : "nowrap" },
    starterChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
    starterChipHalf: { width: starterWidth },
    starterText: { color: colors.accent, fontSize: 13, fontWeight: "600" },

    typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
    typingText: { color: colors.textMuted, fontSize: 13 },
    imageRankLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: layout.horizontalPadding, paddingBottom: 8 },
    errorText: { color: "#B0524F", paddingHorizontal: layout.horizontalPadding, marginBottom: 8 },
    degradedText: { color: colors.textMuted, fontSize: 12, paddingHorizontal: layout.horizontalPadding, marginBottom: 8 },

    recommendationSection: { paddingTop: 10, paddingBottom: 10 },
    stackList: { paddingHorizontal: layout.horizontalPadding, gap: 10 },
    sectionTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginLeft: layout.horizontalPadding,
      marginBottom: 10,
    },

    productCard: {
      width: productCardWidth,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginLeft: layout.horizontalPadding,
      overflow: "hidden",
    },
    productImage: {
      width: "100%",
      height: 120,
      backgroundColor: colors.background,
    },
    // The side pane is wider than a rail card, so the artwork gets a real
    // rectangle instead of a letterbox strip.
    productImageStacked: { width: "100%", marginLeft: 0, height: 168 },
    productTitle: { color: colors.text, fontSize: 14, fontWeight: "700", padding: 10, paddingBottom: 4 },
    productMeta: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 10, paddingBottom: 6 },

    artistCard: {
      width: artistCardWidth,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginLeft: layout.horizontalPadding,
      padding: 12,
    },
    // In the side pane the card owns the full column, so it drops the rail's
    // left gutter and fixed width.
    cardStacked: { width: "100%", marginLeft: 0 },
    artistName: { color: colors.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
    artistTitleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
    artistMeta: { color: colors.textMuted, fontSize: 12 },
    artistPractice: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
    artistScore: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    artistScoreText: { color: colors.text, fontSize: 11, fontWeight: "600" },

    // The bar is padded to the same measure as the thread so the input does not
    // start further left than the messages it is answering.
    inputWrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      padding: 12,
      paddingHorizontal: layout.horizontalPadding,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: colors.text,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonIdle: { opacity: 0.45 },
    imageButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    clearButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
