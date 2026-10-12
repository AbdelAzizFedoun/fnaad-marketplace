import React, { useEffect, useState } from "react";
import { Image as NativeImage, Platform, type ImageProps } from "react-native";
import { fetchNgrokMedia, isNgrokMediaUrl } from "../services/api";

type LoadedImage = {
  sourceUri: string;
  objectUrl: string;
};

export default function MediaImage({ source, ...props }: ImageProps) {
  const sourceUri =
    source && typeof source === "object" && !Array.isArray(source) ? source.uri : undefined;
  const loadThroughNgrok = Platform.OS === "web" && !!sourceUri && isNgrokMediaUrl(sourceUri);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);

  useEffect(() => {
    if (!loadThroughNgrok || !sourceUri) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;

    fetchNgrokMedia(sourceUri, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        // null means ngrok returned an error page — fall back to direct load
        if (!blob) {
          setLoadedImage(null);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setLoadedImage({ sourceUri, objectUrl });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(`Failed to load image from ${sourceUri}:`, error);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loadThroughNgrok, sourceUri]);

  if (loadThroughNgrok && sourceUri) {
    if (loadedImage?.sourceUri !== sourceUri) return null;

    const webSource =
      typeof source === "object" && source !== null && !Array.isArray(source)
        ? { ...source, uri: loadedImage.objectUrl }
        : { uri: loadedImage.objectUrl };

    return <NativeImage {...props} source={webSource} />;
  }

  return <NativeImage {...props} source={source} />;
}
