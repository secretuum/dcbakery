"use client";

import { useState } from "react";
import { FallbackImage } from "@/src/components/ui/FallbackImage";

type ProductGalleryProps = {
  alt: string;
  images: string[];
};

export function ProductGallery({ alt, images }: ProductGalleryProps) {
  const safeImages = images.length > 0 ? images : ["/product-placeholder.png"];
  const [activeImage, setActiveImage] = useState(safeImages[0]);

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-coral-light shadow-sm">
        <FallbackImage
          src={activeImage}
          alt={alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 48vw"
          className="object-cover"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {safeImages.map((image, index) => {
          const isActive = image === activeImage;

          return (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveImage(image)}
              className={`relative aspect-square overflow-hidden rounded-btn border bg-white transition ${
                isActive ? "border-2 border-coral" : "border-black/10 hover:border-coral/60"
              }`}
              aria-label={`Показать фото ${index + 1}`}
            >
              <FallbackImage src={image} alt="" fill sizes="96px" className="object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
