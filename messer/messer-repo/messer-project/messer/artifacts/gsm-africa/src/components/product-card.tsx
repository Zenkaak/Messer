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
      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all h-full relative"
    >
      {!product.inStock && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
          OUT OF STOCK
        </div>
      )}

      <div className="w-full aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden shrink-0">
        {hasImage ? (
          <img
            src={product.imageUrl!}
            alt={product.name}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 opacity-30 group-hover:opacity-50 transition-opacity">
            <Smartphone size={compact ? 28 : 36} className="text-slate-500" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 px-2.5 pt-2 pb-2.5">
        <h3 className="text-[12px] font-bold text-gray-800 line-clamp-2 leading-snug mb-1.5 flex-1">
          {product.name}
        </h3>

        <div className="flex items-center justify-between gap-1 mt-auto">
          <span className="text-[13px] font-black text-[#1a2332]">
            ${product.price.toFixed(2)}
          </span>

          <button
            onClick={handleCartClick}
            disabled={!product.inStock}
            aria-label={needsDetails ? "View product details" : "Add to cart"}
            title={needsDetails ? "Fill required details first" : "Add to cart"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
              ${!product.inStock
                ? 'bg-gray-100 text-gray-300'
                : 'bg-[#1a2332] text-white hover:bg-[#253246]'
              }`}
          >
            <ShoppingCart size={13} />
          </button>
        </div>
      </div>
    </Link>
  );
}
