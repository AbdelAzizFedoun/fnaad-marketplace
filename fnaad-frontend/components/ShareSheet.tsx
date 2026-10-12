import React, { useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Linking,
    Platform,
    Share,
    ActivityIndicator,
    useWindowDimensions,
} from "react-native";
import Image from "./MediaImage";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Ionicons, FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

/** Everything the share sheet needs to describe an artwork. */
export type ShareProduct = {
    title: string;
    url: string;
    imageUrl?: string | null;
    priceXaf?: number | null;
    authorName?: string | null;
    authorAvatar?: string | null;
    authorVerified?: boolean;
    description?: string | null;
    category?: string | null;
    isSold?: boolean;
};

type ShareSheetProps = {
    visible: boolean;
    onClose: () => void;
    product: ShareProduct;
};

type IconDef =
    | { family: "Ionicons"; name: React.ComponentProps<typeof Ionicons>["name"] }
    | { family: "FontAwesome"; name: React.ComponentProps<typeof FontAwesome>["name"] }
    | { family: "FontAwesome5"; name: React.ComponentProps<typeof FontAwesome5>["name"] }
    | { family: "MaterialCommunityIcons"; name: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

type ShareOption = {
    key: string;
    label: string;
    color: string;
    icon: IconDef;
    action: (text: string, url: string) => Promise<void>;
};

const CARD_WIDTH = 340;
const CARD_IMAGE_HEIGHT = 340;
const MAX_DESCRIPTION = 400;

const openOrFallback = async (appUrl: string, webUrl: string) => {
    const canOpen = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpen ? appUrl : webUrl);
};

const OPTIONS: ShareOption[] = [
    {
        key: "whatsapp",
        label: "WhatsApp",
        color: "#25D366",
        icon: { family: "FontAwesome", name: "whatsapp" },
        action: async (text) => {
            const encoded = encodeURIComponent(text);
            await openOrFallback(`whatsapp://send?text=${encoded}`, `http://wa.me/?text=${encoded}`);
        },
    },
    {
        key: "facebook",
        label: "Facebook",
        color: "#1877F2",
        icon: { family: "FontAwesome", name: "facebook" },
        action: async (_text, url) => {
            await Linking.openURL(`http://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        },
    },
    {
        key: "instagram",
        label: "Instagram",
        color: "#E1306C",
        icon: { family: "FontAwesome", name: "instagram" },
        action: async () => {
            const canOpen = await Linking.canOpenURL("instagram://app");
            if (canOpen) {
                await Linking.openURL("instagram://app");
            } else {
                await Linking.openURL("http://apps.apple.com/app/instagram/id389801252");
            }
        },
    },
    {
        key: "twitter",
        label: "X",
        color: "#000000",
        icon: { family: "FontAwesome5", name: "x-twitter" as any },
        action: async (text, url) => {
            const encoded = encodeURIComponent(`${text}\n${url}`);
            await openOrFallback(`twitter://post?message=${encoded}`, `http://twitter.com/intent/tweet?text=${encoded}`);
        },
    },
    {
        key: "telegram",
        label: "Telegram",
        color: "#0088CC",
        icon: { family: "FontAwesome5", name: "telegram-plane" },
        action: async (text, url) => {
            const encodedUrl = encodeURIComponent(url);
            const encodedText = encodeURIComponent(text);
            await openOrFallback(
                `tg://msg?text=${encodeURIComponent(`${text}\n${url}`)}`,
                `http://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
            );
        },
    },
    {
        key: "sms",
        label: "SMS",
        color: "#5FA779",
        icon: { family: "MaterialCommunityIcons", name: "message-text" },
        action: async (text, url) => {
            const body = encodeURIComponent(`${text}\n${url}`);
            const separator = Platform.OS === "ios" ? "&" : "?";
            await Linking.openURL(`sms:${separator}body=${body}`);
        },
    },
    {
        key: "email",
        label: "Email",
        color: "#7D7880",
        icon: { family: "Ionicons", name: "mail" },
        action: async (text, url) => {
            const subject = encodeURIComponent(text.split("\n")[0]);
            const body = encodeURIComponent(text);
            await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
        },
    },
];

/** Renders the correct icon component based on the icon family */
function ShareIcon({ icon, size, color }: { icon: IconDef; size: number; color: string }) {
    switch (icon.family) {
        case "Ionicons":
            return <Ionicons name={icon.name} size={size} color={color} />;
        case "FontAwesome":
            return <FontAwesome name={icon.name} size={size} color={color} />;
        case "FontAwesome5":
            return <FontAwesome5 name={icon.name} size={size} color={color} />;
        case "MaterialCommunityIcons":
            return <MaterialCommunityIcons name={icon.name} size={size} color={color} />;
    }
}

const truncate = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;

export default function ShareSheet({ visible, onClose, product }: ShareSheetProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const { width } = useWindowDimensions();

    // Responsive sizing — scales with screen width, clamped to sensible min/max
    const iconSize = Math.min(26, Math.max(18, Math.round(width * 0.055)));
    const circleSize = Math.min(56, Math.max(42, Math.round(width * 0.13)));
    const labelSize = Math.min(12, Math.max(9, Math.round(width * 0.025)));
    const titleSize = Math.min(17, Math.max(13, Math.round(width * 0.038)));

    const styles = createStyles(colors, circleSize, labelSize, titleSize);

    const cardRef = useRef<View>(null);
    const [imageReady, setImageReady] = useState(false);
    const [sharingImage, setSharingImage] = useState(false);

    const description = useMemo(
        () => (product.description ? truncate(product.description.trim(), MAX_DESCRIPTION) : ""),
        [product.description]
    );

    /** Full artwork summary: what, who, how much, and where to see it. */
    const shareText = useMemo(() => {
        const lines: string[] = [product.title];

        const facts: string[] = [];
        if (product.priceXaf != null) facts.push(`${product.priceXaf} XAF`);
        if (product.isSold) facts.push(t("sold"));
        if (product.category) facts.push(product.category);
        if (facts.length) lines.push(facts.join(" · "));

        if (product.authorName) {
            lines.push(`${t("Artist")}: ${product.authorName}${product.authorVerified ? " ✓" : ""}`);
        }
        if (description) lines.push("", description);
        lines.push("", product.url, "", `— FNAAD · ${t("galleryTagline")}`);
        return lines.join("\n");
    }, [product, description, t]);

    const canShareImage = !!product.imageUrl && Platform.OS !== "web";

    const handleOptionPress = async (option: ShareOption) => {
        try {
            await option.action(shareText, product.url);
        } catch (err) {
            console.log(`Share via ${option.key} failed:`, err);
        }
        onClose();
    };

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(`${shareText}\n${product.url}`);
        onClose();
    };

    const handleMore = async () => {
        if (Platform.OS === "web") {
            await Clipboard.setStringAsync(`${shareText}\n${product.url}`);
        } else {
            try {
                await Share.share({ message: `${shareText}\n${product.url}` });
            } catch (err) {
                console.log("Native share failed:", err);
            }
        }
        onClose();
    };

    /** Capture the composed card (artwork + details) and share it as a PNG. */
    const handleShareImage = async () => {
        if (!cardRef.current || !product.imageUrl) return;
        setSharingImage(true);
        try {
            const uri = await captureRef(cardRef, {
                format: "png",
                quality: 1,
                result: "tmpfile",
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: "image/png",
                    dialogTitle: product.title,
                    UTI: "public.png",
                });
            } else {
                await Share.share({ message: `${shareText}\n${product.url}` });
            }
        } catch (err) {
            console.log("Share image failed:", err);
            await Share.share({ message: `${shareText}\n${product.url}` });
        } finally {
            setSharingImage(false);
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                {/* Rendered off to the side and fully transparent: view-shot needs a
                    mounted, laid out view, but it must never be seen by the user. */}
                <View style={styles.captureHost} pointerEvents="none" collapsable={false}>
                    <View ref={cardRef} style={styles.card} collapsable={false}>
                        <Image
                            source={{ uri: product.imageUrl! }}
                            style={styles.cardImage}
                            resizeMode="cover"
                            onLoad={() => setImageReady(true)}
                            onError={() => setImageReady(false)}
                        />
                        <View style={styles.cardBody}>
                            <Text style={styles.cardTitle} numberOfLines={2}>
                                {product.title}
                            </Text>
                            <View style={styles.cardFacts}>
                                {product.priceXaf != null && (
                                    <Text style={styles.cardPrice}>
                                        {product.priceXaf} XAF{product.isSold ? ` · ${t("sold")}` : ""}
                                    </Text>
                                )}
                                {product.category ? (
                                    <Text style={styles.cardCategory} numberOfLines={1}>
                                        {product.category}
                                    </Text>
                                ) : null}
                            </View>
                            {product.authorName ? (
                                <View style={styles.cardAuthor}>
                                    {product.authorAvatar ? (
                                        <Image source={{ uri: product.authorAvatar }} style={styles.cardAuthorAvatar} />
                                    ) : (
                                        <View style={[styles.cardAuthorAvatar, styles.cardAuthorInitial]} />
                                    )}
                                    <Text style={styles.cardAuthorName} numberOfLines={1}>
                                        {product.authorName}
                                    </Text>
                                    {product.authorVerified ? (
                                        <Ionicons name="checkmark-circle" size={15} color="#2E7D32" />
                                    ) : null}
                                </View>
                            ) : null}
                            {description ? (
                                <Text style={styles.cardDescription}>{description}</Text>
                            ) : null}
                            <Text style={styles.cardFooter} numberOfLines={1}>
                                FNAAD · {product.url}
                            </Text>
                        </View>
                    </View>
                </View>

                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>{t("shareVia")}</Text>

                    <View style={styles.grid}>
                        {OPTIONS.map((option) => (
                            <Pressable
                                key={option.key}
                                style={styles.item}
                                onPress={() => handleOptionPress(option)}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                                    <ShareIcon icon={option.icon} size={iconSize} color="#FFFFFF" />
                                </View>
                                <Text style={styles.itemLabel}>{option.label}</Text>
                            </Pressable>
                        ))}

                        {canShareImage && (
                            <Pressable
                                style={[styles.item, (sharingImage || !imageReady) && styles.itemDisabled]}
                                onPress={handleShareImage}
                                disabled={sharingImage || !imageReady}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                                    {sharingImage || !imageReady ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Ionicons name="image" size={iconSize} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.itemLabel}>{t("shareImage")}</Text>
                            </Pressable>
                        )}

                        <Pressable style={styles.item} onPress={handleCopyLink}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.border }]}>
                                <Ionicons name="link" size={iconSize} color="#FFFFFF" />
                            </View>
                            <Text style={styles.itemLabel}>{t("copyLink")}</Text>
                        </Pressable>

                        <Pressable style={styles.item} onPress={handleMore}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.border }]}>
                                <Ionicons name="ellipsis-horizontal" size={iconSize} color="#FFFFFF" />
                            </View>
                            <Text style={styles.itemLabel}>{t("moreOptions")}</Text>
                        </Pressable>
                    </View>

                    <Pressable style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>{t("cancel")}</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function createStyles(
    colors: ReturnType<typeof useTheme>["colors"],
    circleSize: number,
    labelSize: number,
    titleSize: number,
) {
    return StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
        captureHost: { position: "absolute", top: 0, left: 0, opacity: 0.01, zIndex: -1 },
        card: {
            width: CARD_WIDTH,
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            overflow: "hidden",
        },
        cardImage: { width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT, backgroundColor: "#E8E8E8" },
        cardBody: { padding: 16 },
        cardTitle: { color: "#111111", fontSize: 20, fontWeight: "800", lineHeight: 25 },
        cardFacts: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
        cardPrice: { color: "#B45309", fontSize: 17, fontWeight: "800" },
        cardCategory: { color: "#6B7280", fontSize: 12 },
        cardAuthor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
        cardAuthorAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E5E7EB" },
        cardAuthorInitial: { backgroundColor: "#E5E7EB" },
        cardAuthorName: { color: "#374151", fontSize: 14, fontWeight: "600", flexShrink: 1 },
        cardDescription: { color: "#4B5563", fontSize: 13, lineHeight: 19, marginTop: 12 },
        cardFooter: { color: "#9CA3AF", fontSize: 11, marginTop: 14 },
        sheet: {
            backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingTop: 12, paddingBottom: 30, paddingHorizontal: 16,
        },
        handle: {
            width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
            alignSelf: "center", marginBottom: 16,
        },
        title: { color: colors.text, fontSize: titleSize, fontWeight: "700", textAlign: "center", marginBottom: 16 },
        grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" },
        item: { width: "25%", alignItems: "center", marginBottom: 18 },
        itemDisabled: { opacity: 0.5 },
        iconCircle: {
            width: circleSize, height: circleSize, borderRadius: circleSize / 2,
            alignItems: "center", justifyContent: "center", marginBottom: 6,
        },
        itemLabel: { color: colors.textMuted, fontSize: labelSize, textAlign: "center" },
        cancelBtn: {
            marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            padding: 12, alignItems: "center",
        },
        cancelText: { color: colors.text, fontWeight: "600", fontSize: 13 },
    });
}
