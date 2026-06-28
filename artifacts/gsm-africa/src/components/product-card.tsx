import { Product } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Smartphone } from "lucide-react";

export function ProductCard({ product, compact = false }: { product: Product, compact?: boolean }) {
  const [, navigate] = useLocation();

  const hasImage = product.imageUrl && product.imageUrl.trim() !== "";
  const needsDetails = !!((product as unknown as Record<string, unknown>).requiredFields as string[] | undefined)?.length;

  function handleCartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${product.id}`);
  }

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col rounded-xl overflow-hidden h-full relative transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.3)",
      }}
    >
      {!product.inStock && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
          OUT OF STOCK
        </div>
      )}

      <div
        className="w-full aspect-square flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: "linear-gradient(135deg,#0f1c2e 0%,#1a2d45 60%,#0d3349 100%)" }}
      >
        {hasImage ? (
          <img
            src={product.imageUrl!}
            alt={product.name}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 opacity-30 group-hover:opacity-50 transition-opacity">
            <Smartphone size={compact ? 28 : 36} className="text-teal-400" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 px-2.5 pt-2 pb-2.5">
        <h3 className="text-[12px] font-bold text-white/90 line-clamp-2 leading-snug mb-1.5 flex-1">
          {product.name}
        </h3>

        <div className="flex items-center justify-between gap-1 mt-auto pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[14px] font-black text-white">
            ${product.price.toFixed(2)}
          </span>

          <button
            onClick={handleCartClick}
            disabled={!product.inStock}
            aria-label={needsDetails ? "View product details" : "Add to cart"}
            title={needsDetails ? "Fill required details first" : "Add to cart"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              !product.inStock
                ? "bg-white/5 text-white/20"
                : "text-white hover:opacity-90"
            }`}
            style={product.inStock ? { background: "linear-gradient(135deg,#3b82f6,#2563eb)" } : {}}
          >
            <ShoppingCart size={13} />
          </button>
        </div>
      </div>
    </Link>
  );
}
