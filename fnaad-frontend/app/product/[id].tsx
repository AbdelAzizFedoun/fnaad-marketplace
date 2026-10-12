import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Linking } from "react-native";
import Image from "../../components/MediaImage";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { getProductDetail, getArtistProducts, resolveMediaUrl, startConversation, getProductReviews, getFavoriteIds, toggleFavorite, getProductComments, createProductComment, unwrapList } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import ShareSheet from "../../components/ShareSheet";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { shadow, RADIUS } from "../../components/shadow";
import { Ionicons } from "@expo/vector-icons";

import React from "react";

type ProductImage = { image: string; is_primary: boolean; order?: number };

type Product = {
  id: number;
  title: string;
  description: string;
  price_xaf: number;
  category_display: string;
  artist_id: number;
  artist_user_id: number;
  artist_name: string;
  artist_avatar: string | null;
  artist_phone: string;
  artist_mobile_money_number: string;
  artist_mobile_money_provider: string;
  artist_is_verified: boolean;
  average_rating: number | null;
  review_count: number;
  images: ProductImage[];
  is_sold?: boolean;
  public_url: string;
  like_count?: number;
  comment_count?: number;
};

type Review = {
  id: number;
  customer_username: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ProductComment = { id: number; username: string; text: string; created_at: string };

const PROVIDER_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <Text style={{ fontSize: size, color: "#E7C878" }}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </Text>
  );
}

function ImageCarousel({
  images,
  colors,
  width,
  height,
  onImagePress,
  viewFullSizeLabel,
}: {
  images: ProductImage[];
  colors: any;
  width: number;
  height: number;
  onImagePress: (url: string) => void;
  viewFullSizeLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const sortedImages = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  if (sortedImages.length === 0) return null;

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  return (
    <View>
      <FlatList
        data={sortedImages}
        keyExtractor={(_, i) => i.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const url = resolveMediaUrl(item.image);
          return (
            <Pressable
              onPress={() => url && onImagePress(url)}
              accessibilityRole="button"
              accessibilityLabel={viewFullSizeLabel}
            >
              <Image
                source={{ uri: url! }}
                style={{ width, height, backgroundColor: colors.surface }}
                resizeMode="cover"
              />
            </Pressable>
          );
        }}
      />
      {sortedImages.length > 1 && (
        <View style={carouselStyles.dotsRow}>
          {sortedImages.map((_, i) => (
            <View
              key={i}
              style={[
                carouselStyles.dot,
                { backgroundColor: i === activeIndex ? colors.accent : "rgba(255,255,255,0.35)" },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  dotsRow: {
    position: "absolute", bottom: 14, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export default function ProductDetailScreen() {
  const { id, openComments: openCommentsParam } = useLocalSearchParams();
  const router = useRouter();
  const { loggedIn, user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, layout.maxContentWidth);
  const carouselWidth = layout.isDesktop ? Math.min(560, Math.floor(contentWidth * 0.54)) : contentWidth;
  const carouselHeight = layout.isDesktop ? 500 : 320;
  const styles = createStyles(colors, layout);

  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const openedNotificationCommentsFor = useRef<string | null>(null);

  const loadProductData = () => {
    getProductDetail(Number(id))
      .then((res) => {
        setProduct(res.data);
        getProductReviews(Number(id))
          .then((r) => setReviews(unwrapList(r.data)))
          .catch((err) => console.log("Reviews load error:", err.message));
        return getArtistProducts(res.data.artist_id);
      })
      .then((res) => {
        if (res) {
          setOtherProducts(
            unwrapList<Product>(res.data).filter((p: Product) => p.id !== Number(id))
          );
        }
      })
      .catch((err) => {
        const status = err.response?.status;
        console.log("Product detail error:", status, err.response?.data || err.message);
        // Only a true 404 means the artwork is missing; anything else
        // (401 expired session, 502, offline) is a different problem.
        setErrorMsg(
          status === 404 ? t("productNotFound") : err.message || "Failed to load artwork"
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProductData();
  }, [id]);

  useEffect(() => {
    if (!loggedIn) {
      setLiked(false);
      return;
    }
    getFavoriteIds()
      .then((res) => setLiked(res.data.favorite_ids.includes(Number(id))))
      .catch(() => setLiked(false));
  }, [id, loggedIn]);

  useEffect(() => {
    if (openCommentsParam === "1") {
      setCommentsVisible(true);
      loadComments();
    }
  }, [openCommentsParam]);

  useFocusEffect(
    React.useCallback(() => {
      loadProductData();
      if (!loggedIn) {
        setLiked(false);
        return;
      }
      getFavoriteIds()
        .then((res) => setLiked(res.data.favorite_ids.includes(Number(id))))
        .catch(() => setLiked(false));
    }, [id, loggedIn])
  );

  const loadComments = () => {
    setCommentsLoading(true);
    getProductComments(Number(id))
      .then((res) => setComments(unwrapList(res.data)))
      .catch((err) => console.log("Comments load error:", err.message))
      .finally(() => setCommentsLoading(false));
  };

  const handleOpenComments = () => {
    setCommentsVisible(true);
    loadComments();
  };

  useEffect(() => {
    const productId = String(id);
    if (
      String(openCommentsParam) === "1" &&
      product &&
      openedNotificationCommentsFor.current !== productId
    ) {
      openedNotificationCommentsFor.current = productId;
      handleOpenComments();
    }
  }, [id, openCommentsParam, product]);

  const handleLike = async () => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    const previousLiked = liked;
    setLiked(!previousLiked);
    setProduct((current) => current ? { ...current, like_count: Math.max(0, (current.like_count || 0) + (previousLiked ? -1 : 1)) } : current);
    try {
      await toggleFavorite(Number(id));
    } catch {
      setLiked(previousLiked);
      setProduct((current) => current ? { ...current, like_count: Math.max(0, (current.like_count || 0) + (previousLiked ? 1 : -1)) } : current);
    }
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!loggedIn) {
      setCommentsVisible(false);
      router.push("/login");
      return;
    }
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await createProductComment(Number(id), text);
      setComments((current) => [...current, res.data]);
      setCommentText("");
      setProduct((current) => current ? { ...current, comment_count: (current.comment_count || 0) + 1 } : current);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.text?.[0] || t("genericError"));
    } finally {
      setSendingComment(false);
    }
  };

  const handleContact = () => {
    if (!product?.artist_phone) return;
    const digitsOnly = product.artist_phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      t("contactMessagePrefill", { title: product.title })
    );
    const url = `http://wa.me/${digitsOnly}?text=${message}`;
    Linking.openURL(url).catch(() => {
      setErrorMsg(t("whatsappError"));
    });
  };

  const handleMessageArtist = async () => {
    if (!product) return;
    setStartingChat(true);
    try {
      const res = await startConversation(product.id);
      router.push(`/conversation/${res.data.id}`);
    } catch (err: any) {
      console.log("Start conversation error:", err.response?.data || err.message);
      setErrorMsg(t("chatStartError"));
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("productDetailTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (errorMsg || !product) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("productDetailTitle")} />
        <Text style={styles.error}>{errorMsg || t("productNotFound")}</Text>
      </View>
    );
  }

  const artistAvatarUrl = resolveMediaUrl(product.artist_avatar || undefined);
  // Same selection order the carousel uses, so the shared image is the one on screen.
  const shareImage = [...(product.images || [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  })[0];
  const providerLabel = PROVIDER_LABELS[product.artist_mobile_money_provider] || product.artist_mobile_money_provider;
  // The API refuses a conversation between an artist and themselves, so do not
  // offer the button to the artist looking at their own artwork.
  const isOwnProduct = !!user && product.artist_user_id === user.id;

  return (
    <View style={styles.container}>
      <ScreenHeader title={product.title} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={styles.artistShortcut}
          onPress={() => router.push(`/artist/${product.artist_id}`)}
        >
          {artistAvatarUrl ? (
            <Image source={{ uri: artistAvatarUrl }} style={styles.artistAvatarSmall} />
          ) : (
            <View style={[styles.artistAvatarSmall, styles.artistAvatarPlaceholder]}>
              <Text style={styles.artistAvatarInitial}>{product.artist_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>

        <View style={[styles.carouselFrame, { width: carouselWidth }]}>
          <ImageCarousel
            images={product.images || []}
            colors={colors}
            width={carouselWidth}
            height={carouselHeight}
            onImagePress={setExpandedImageUrl}
            viewFullSizeLabel={t("viewFullSize")}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title}</Text>
            {product.is_sold && <View style={styles.soldPill}><Text style={styles.soldPillText}>{t("sold")}</Text></View>}
          </View>
          <View style={styles.categoryPill}><Text style={styles.category}>{product.category_display}</Text></View>

          {product.average_rating !== null && (
            <View style={styles.ratingRow}>
              <Stars rating={product.average_rating} size={16} />
              <Text style={styles.ratingText}>
                {product.average_rating} ({product.review_count})
              </Text>
            </View>
          )}

          <Pressable onPress={() => router.push(`/artist/${product.artist_id}`)} style={styles.artistRow}>
            <Text style={styles.artist}>
              {product.artist_name}
            </Text>
            {product.artist_is_verified && <Ionicons name="checkmark-circle" size={16} color="#5FA779" style={{ marginLeft: 4 }} />}
            {product.artist_is_verified && <Text style={[styles.artist, styles.verifiedLabel]}>Verified</Text>}
            <Text style={styles.artistArrow}>  →</Text>
          </Pressable>
          <Text style={styles.price}>{product.price_xaf} XAF</Text>
          <View style={styles.socialSummary}>
            <Text style={styles.socialSummaryText}>{product.like_count || 0} {(product.like_count || 0) === 1 ? t("like") : t("like") + "s"}</Text>
            <Pressable onPress={handleOpenComments} hitSlop={8}>
              <Text style={styles.socialSummaryText}>{product.comment_count || 0} {(product.comment_count || 0) === 1 ? t("comment") : t("comment") + "s"}</Text>
            </Pressable>
          </View>
          <View style={styles.socialActions}>
            <Pressable style={styles.socialAction} onPress={handleLike}>
              <Ionicons name={liked ? "thumbs-up" : "thumbs-up-outline"} size={19} color={liked ? "#1877F2" : colors.textMuted} />
              <Text style={[styles.socialActionText, liked && styles.likedText]}>{t("like")}</Text>
            </Pressable>
            <Pressable style={styles.socialAction} onPress={handleOpenComments}>
              <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
              <Text style={styles.socialActionText}>{t("comment")}</Text>
            </Pressable>
            <Pressable style={styles.socialAction} onPress={() => setShareSheetVisible(true)}>
              <Ionicons name="share-social-outline" size={19} color={colors.textMuted} />
              <Text style={styles.socialActionText}>{t("share")}</Text>
            </Pressable>
          </View>
          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}

          <View style={styles.paymentBox}>
            <Text style={styles.paymentLabel}>{t("paymentTitle")}</Text>
            <Text style={styles.paymentValue}>
              {providerLabel} — {product.artist_mobile_money_number}
            </Text>
            <Text style={styles.paymentHint}>{t("paymentHint")}</Text>
          </View>

          {!isOwnProduct && (
            <Pressable
              style={[styles.messageBtn, product.is_sold && styles.disabledBtn]}
              onPress={handleMessageArtist}
              disabled={startingChat || product.is_sold}
            >
              <Text style={styles.messageBtnText}>
                {product.is_sold ? t("sold") : startingChat ? "..." : t("chatWithArtist")}
              </Text>
            </Pressable>
          )}

          {!product.is_sold && (
            <Pressable style={styles.contactBtn} onPress={handleContact}>
              <Text style={styles.contactBtnText}>{t("contactWhatsapp")}</Text>
            </Pressable>
          )}

          <Pressable style={styles.shareBtn} onPress={() => setShareSheetVisible(true)}>
            <Text style={styles.shareBtnText}>↗ {t("shareProduct")}</Text>
          </Pressable>
        </View>

        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsTitle}>{t("reviewsTitle").replace("{count}", String(reviews.length))}</Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>{t("noReviewsYet")}</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{review.customer_username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewAuthor}>{review.customer_username}</Text>
                    <Stars rating={review.rating} size={12} />
                  </View>
                </View>
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {otherProducts.length > 0 && (
          <View style={styles.otherSection}>
            <Text style={styles.otherTitle}>{t("moreFromArtist")} {product.artist_name}</Text>
            <FlatList
              data={otherProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => {
                const img = item.images?.find((i) => i.is_primary) || item.images?.[0];
                const url = resolveMediaUrl(img?.image);
                return (
                  <Pressable style={styles.otherCard} onPress={() => router.push(`/product/${item.id}`)}>
                    {url && <Image source={{ uri: url }} style={styles.otherCardImage} />}
                    <Text style={styles.otherCardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.otherCardPrice}>{item.price_xaf} XAF</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </ScrollView>

      <ShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        product={{
          title: product.title,
          url: product.public_url,
          imageUrl: resolveMediaUrl(shareImage?.image),
          priceXaf: product.price_xaf,
          authorName: product.artist_name,
          authorAvatar: resolveMediaUrl(product.artist_avatar || undefined),
          authorVerified: product.artist_is_verified,
          description: product.description,
          category: product.category_display,
          isSold: product.is_sold,
        }}
      />
      <Modal
        visible={!!expandedImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUrl(null)}
      >
        <View style={styles.imageViewer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExpandedImageUrl(null)}
            accessibilityRole="button"
            accessibilityLabel={t("closeFullSize")}
          />
          {expandedImageUrl && (
            <Image
              source={{ uri: expandedImageUrl }}
              style={styles.expandedImage}
              resizeMode="contain"
            />
          )}
          <Pressable
            style={styles.imageViewerClose}
            onPress={() => setExpandedImageUrl(null)}
            accessibilityRole="button"
            accessibilityLabel={t("closeFullSize")}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
      <Modal visible={commentsVisible} animationType="slide" transparent onRequestClose={() => setCommentsVisible(false)}>
        <KeyboardAvoidingView style={styles.commentModalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCommentsVisible(false)} />
          <View style={styles.commentModal}>
            <View style={styles.commentModalHeader}>
              <Text style={styles.commentModalTitle}>{t("commentsTitle")}</Text>
              <Pressable onPress={() => setCommentsVisible(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            {commentsLoading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} /> : (
              <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
                {comments.length === 0 ? <Text style={styles.noComments}>{t("noCommentsYet")}</Text> : comments.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{comment.username.charAt(0).toUpperCase()}</Text></View>
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentAuthor}>{comment.username}</Text>
                      <Text style={styles.commentBody}>{comment.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={loggedIn ? t("writeCommentPlaceholder") : t("signInToComment")}
                placeholderTextColor={colors.textMuted}
                editable={!sendingComment}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Pressable style={[styles.sendCommentButton, (!commentText.trim() || sendingComment) && styles.sendCommentDisabled]} onPress={handlePostComment} disabled={sendingComment}>
                <Ionicons name="send" size={18} color={colors.accentText} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      paddingBottom: 48,
      alignItems: "center",
      paddingHorizontal: layout.isDesktop ? layout.horizontalPadding : 0,
    },
    artistShortcut: {
      position: "absolute", top: 12, right: 16, zIndex: 10,
    },
    artistAvatarSmall: {
      width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    artistAvatarPlaceholder: { justifyContent: "center", alignItems: "center" },
    artistAvatarInitial: { color: colors.accent, fontSize: 18, fontWeight: "800" },
    content: {
      width: "100%",
      maxWidth: layout.isDesktop ? layout.maxContentWidth : undefined,
      padding: 20,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: "800", lineHeight: 30 },
    category: { color: colors.accent, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "700" },
    ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
    ratingText: { color: colors.textMuted, fontSize: 13 },
    artistRow: { flexDirection: "row", alignItems: "center", marginTop: 10, flexWrap: "wrap" },
    artist: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    verifiedLabel: { color: "#5FA779", fontSize: 12, marginLeft: 4, fontWeight: "600" },
    artistArrow: { color: colors.accent, fontSize: 14, fontWeight: "700", marginLeft: 4 },
    price: { color: colors.accent, fontSize: 22, fontWeight: "800", marginTop: 12, letterSpacing: 0.3 },
    socialSummary: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border },
    socialSummaryText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
    socialActions: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6, marginTop: 4 },
    socialAction: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingVertical: 10 },
    socialActionText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    likedText: { color: "#1877F2" },
    description: { color: colors.text, fontSize: 15, marginTop: 18, lineHeight: 22, opacity: 0.88 },
    paymentBox: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      padding: 16, marginTop: 24, backgroundColor: colors.surface,
    },
    paymentLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
    paymentValue: { color: colors.accent, fontSize: 17, fontWeight: "700", marginTop: 8 },
    paymentHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
    messageBtn: {
      backgroundColor: colors.accent, borderRadius: 12, padding: 14,
      alignItems: "center", marginTop: 16, ...shadow(2),
    },
    messageBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 15 },
    contactBtn: {
      backgroundColor: "#25D366", borderRadius: 12, padding: 14,
      alignItems: "center", marginTop: 12, ...shadow(2),
    },
    contactBtnText: { color: "#0B0A0C", fontWeight: "700", fontSize: 15 },
    shareBtn: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14,
      alignItems: "center", marginTop: 12,
    },
    shareBtnText: { color: colors.text, fontWeight: "600", fontSize: 14 },
    error: { color: "#E7A0A0", fontSize: 14, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
    reviewsSection: {
      width: "100%",
      maxWidth: layout.maxContentWidth,
      paddingHorizontal: layout.isDesktop ? 20 : 20,
      paddingTop: 28,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    reviewsTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 14 },
    noReviews: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 20 },
    reviewCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      padding: 14, marginBottom: 10, backgroundColor: colors.surface,
    },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    reviewAvatarText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    reviewAuthor: { color: colors.text, fontSize: 13, fontWeight: "700" },
    reviewComment: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 },
    otherSection: { width: "100%", maxWidth: layout.maxContentWidth, marginTop: 8, paddingBottom: 16 },
    otherTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 14, paddingHorizontal: 20, textTransform: "uppercase", letterSpacing: 0.5 },
    otherCard: { width: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: colors.surface },
    otherCardImage: { width: "100%", height: 110, borderRadius: 8, marginBottom: 8, backgroundColor: colors.background },
    otherCardTitle: { color: colors.text, fontSize: 12, fontWeight: "600" },
    otherCardPrice: { color: colors.accent, fontSize: 12, marginTop: 3, fontWeight: "700" },
    disabledBtn: { opacity: 0.45 },
    imageViewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center", alignItems: "center", padding: 20 },
    expandedImage: { width: "100%", height: "100%" },
    imageViewerClose: { position: "absolute", top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
    commentModalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    commentModal: { maxHeight: "78%", flexShrink: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
    commentModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.border },
    commentModalTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
    commentsList: { flex: 1, minHeight: 0 },
    commentsListContent: { padding: 16, gap: 12 },
    noComments: { color: colors.textMuted, textAlign: "center", paddingVertical: 30, fontSize: 13 },
    commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    commentAvatarText: { color: colors.accentText, fontWeight: "700", fontSize: 14 },
    commentBubble: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    commentAuthor: { color: colors.text, fontSize: 12, fontWeight: "700", marginBottom: 4 },
    commentBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
    commentComposer: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderColor: colors.border },
    commentInput: { flex: 1, maxHeight: 100, color: colors.text, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
    sendCommentButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    sendCommentDisabled: { opacity: 0.45 },
    carouselFrame: {
      width: "100%",
      maxWidth: layout.isDesktop ? layout.maxContentWidth : undefined,
      alignSelf: "center",
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: colors.surface,
      marginTop: 10,
      ...shadow(2),
    },
    categoryPill: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.pill,
      paddingVertical: 5,
      paddingHorizontal: 12,
      marginTop: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    soldPill: { backgroundColor: "#B0524F", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
    soldPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  });
}
