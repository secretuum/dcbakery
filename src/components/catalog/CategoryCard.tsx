import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/src/types";

type CategoryCardProps = {
  category: Category;
  className?: string;
  eyebrow?: string;
  href?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function CategoryCard({ category, className, eyebrow, href }: CategoryCardProps) {
  const imageSrc = category.image ?? "/product-placeholder.png";

  return (
    <Link
      href={href ?? `/catalog/${category.slug}`}
      className={cx(
        "group relative min-h-72 overflow-hidden rounded-2xl bg-dark text-white shadow-sm transition duration-300 hover:scale-[1.02]",
        className,
      )}
    >
      <Image
        src={imageSrc}
        alt={category.name}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className="object-cover opacity-80 transition duration-300 group-hover:scale-105 group-hover:opacity-95"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-coral/20" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <span className="inline-flex rounded-badge bg-white/90 px-3 py-1 text-xs font-bold text-burgundy shadow-sm">
          {eyebrow ?? "категория"}
        </span>
        <h3 className="mt-4 text-3xl font-bold tracking-tight">{category.name}</h3>
        {category.description ? (
          <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-white/85">
            {category.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
