import { useEffect, useState } from "react";
import { API_BASE_URL, fetchMediaBlob } from "../services/api";

type MediaImageProps = {
  src: string;
  alt: string;
  className: string;
};

type LoadedImage = {
  source: string;
  objectUrl: string;
};

export default function MediaImage({ src, alt, className }: MediaImageProps) {
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  const useNgrokFetch = origin.includes("ngrok");
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!useNgrokFetch) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;

    fetchMediaBlob(src, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoadedImage({ source: src, objectUrl });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(`Failed to load artwork image ${src}:`, error);
          setFailed(true);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, useNgrokFetch]);

  const imageSrc = useNgrokFetch
    ? loadedImage?.source === src ? loadedImage.objectUrl : null
    : src;

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-bg text-faint text-xs text-center p-2`}>
        Image unavailable
      </div>
    );
  }

  if (!imageSrc) {
    return <div className={`${className} bg-bg animate-pulse`} aria-label={`Loading ${alt}`} />;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
