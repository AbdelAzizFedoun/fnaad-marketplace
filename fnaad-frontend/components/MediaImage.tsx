import React, { useEffect, useState } from "react";
import { Image as NativeImage, Platform, type ImageProps } from "react-native";
import { fetchNgrokMedia, isNgrokMediaUrl } from "../services/api";

type LoadedImage = {
  sourceUri: string;
  objectUrl: string;
};

/**
 * Drop-in replacement for React Native's <Image> that handles three scenarios:
 *
 * 1. ngrok tunnels (dev): fetches with the bypass header then turns the blob
 *    into an object URL so the browser can display it without CORS issues.
 *
 * 2. Local LAN/localhost URLs on web (dev): fetches the image directly using
 *    the browser's fetch (no extra headers needed for same-LAN access) and
 *    turns the blob into an object URL.  This avoids the mixed-content block
 *    that React Native Web's <Image> hits when the page is served over https
 *    but the image URL is http://.
 *
 * 3. Everything else (production, native): passes straight through to
 *    <NativeImage> with zero overhead.
 */
export default function MediaImage({ source, ...props }: ImageProps) {
  const sourceUri =
    source && typeof source === "object" && !Array.isArray(source)
      ? source.uri
      : undefined;

  const isNgrok = Platform.OS === "web" && !!sourceUri && isNgrokMediaUrl(sourceUri);

  // On web, also proxy local http:// URLs (LAN dev server) to avoid
  // mixed-content / CORS blocks when the Expo dev server runs on https.
  const isLocalHttp =
    Platform.OS === "web" &&
    !!sourceUri &&
    !isNgrok &&
    /^http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(
      sourceUri
    );

  const needsProxy = isNgrok || isLocalHttp;
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);

  useEffect(() => {
    if (!needsProxy || !sourceUri) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;

    const fetchImage = async () => {
      try {
        let blob: Blob | null = null;

        if (isNgrok) {
          blob = await fetchNgrokMedia(sourceUri, controller.signal);
        } else {
          // Local LAN URL — plain fetch, no special headers required.
          const res = await fetch(sourceUri, { signal: controller.signal });
          if (!res.ok) {
            console.warn(`[MediaImage] Local fetch failed (${res.status}): ${sourceUri}`);
            return;
          }
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.startsWith("image/")) {
            console.warn(`[MediaImage] Expected image, got "${contentType}" for: ${sourceUri}`);
            return;
          }
          blob = await res.blob();
        }

        if (controller.signal.aborted) return;
        if (!blob) {
          setLoadedImage(null);
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setLoadedImage({ sourceUri, objectUrl });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.warn(`[MediaImage] fetch error for ${sourceUri}:`, err);
      }
    };

    fetchImage();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsProxy, sourceUri, isNgrok]);

  if (needsProxy && sourceUri) {
    // Still loading — render nothing so there's no broken-image flash.
    if (loadedImage?.sourceUri !== sourceUri) return null;

    const webSource =
      typeof source === "object" && source !== null && !Array.isArray(source)
        ? { ...source, uri: loadedImage.objectUrl }
        : { uri: loadedImage.objectUrl };

    return <NativeImage {...props} source={webSource} />;
  }

  return <NativeImage {...props} source={source} />;
}
