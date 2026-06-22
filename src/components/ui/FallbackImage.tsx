"use client";

import { useState, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";

type FallbackImageProps = Omit<ImageProps, "src"> & {
  fallbackSrc?: string;
  src?: ImageProps["src"];
};

export function FallbackImage({
  alt,
  fallbackSrc = "/product-placeholder.png",
  onError,
  src,
  ...props
}: FallbackImageProps) {
  const normalizedSrc = src || fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  const currentSrc = failedSrc === normalizedSrc ? fallbackSrc : normalizedSrc;

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    if (currentSrc !== fallbackSrc) {
      setFailedSrc(normalizedSrc);
    }

    onError?.(event);
  }

  return <Image {...props} alt={alt} src={currentSrc} onError={handleError} />;
}
