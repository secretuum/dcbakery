"use client";

import { useState, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";

type FallbackImageProps = Omit<ImageProps, "src"> & {
  fallbackSrc?: string;
  src?: ImageProps["src"];
};

function ImagePlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-coral-light to-cream">
      <svg
        width="44"
        height="44"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-300"
      >
        {/* dome */}
        <path
          d="M8 28 C8 12 40 12 40 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* handle */}
        <rect x="21" y="8" width="6" height="5" rx="3" fill="currentColor" />
        {/* plate rim */}
        <line x1="4" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* plate curve */}
        <path
          d="M10 32 Q24 40 38 32"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="mt-1.5 text-xs font-medium tracking-widest text-gray-300">DC</span>
    </div>
  );
}

export function FallbackImage({
  alt,
  fallbackSrc,
  onError,
  src,
  ...props
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImagePlaceholder />;
  }

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    setFailed(true);
    onError?.(event);
  }

  return <Image {...props} alt={alt} src={src} onError={handleError} />;
}
