import { useListProducts, useListCategories, ListProductsSort } from "@workspace/api-client-react";
import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, ChevronRight, Clock, X, SlidersHorizontal, ChevronDown, CheckCircle2, Package, Zap, Star, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Product = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  featured?: boolean;
  inStock?: boolean;
};

function DeliveryBadge({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const isInstant =
    lower.includes("credit") ||
    lower.includes("server") ||
    lower.includes("activation") ||
    lower.includes("license") ||
    lower.includes("tool");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
      <Clock size={9} className="shrink-0" />
      {isInstant ? "Instant" : "0–3 hrs"}
    </span>
  );
}

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-700 via-slate-800 to-teal-900 flex items-center justify-center">
        <span className="text-white font-black text-xs tracking-widest opacity-60">GSM</span>
      </div>
    );
  }
  return (
    <img src={src} alt={alt} className="w-full h-full object-contain p-3" onError={() => setFailed(true)} />
  );
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const outOfStock = product.inStock === false;
  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col ${outOfStock ? "opacity-75" : ""}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
        <ProductThumb src={product.imageUrl} alt={product.name} />
        {outOfStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-[10px] font-bold text-red-500 bg-white/90 px-2 py-0.5 rounded-full border border-red-200">
              Out of Stock
            </span>
          </div>
        )}
        {product.featured && !outOfStock && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <Star size={8} fill="currentColor" /> Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-2 gap-1.5">
        {product.categoryName && (
          <span className="text-[8px] font-bold uppercase tracking-widest text-blue-500 truncate">{product.categoryName}</span>
        )}
        <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
          <p className="text-[13px] font-black text-gray-900">
            ${product.price % 1 === 0 ? product.price.toFixed(0) : product.price.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
        <ProductThumb src={product.imageUrl} alt={product.name} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-1">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <DeliveryBadge name={product.name} />
          {product.inStock === false && (
            <span className="text-[10px] text-red-400 font-medium">Out of stock</span>
          )}
        </div>
      </div>
      <p className="text-[13px] font-black text-gray-900 shrink-0">
        ${product.price % 1 === 0 ? product.price.toFixed(0) : product.price.toFixed(2)}
      </p>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <Skeleton className="w-full aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-2 w-12" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-4 w-10 shrink-0" />
    </div>
  );
}

function ProductGrid({ products, onProductClick }: { products: Product[]; onProductClick: (id: number) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} />
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, count, colorClass }: { icon: ReactNode; title: string; count?: number; colorClass: string }) {
  return (
    <div className={`flex items-center justify-between mb-3`}>
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${colorClass}`}>{icon}</span>
        <h2 className="text-[14px] font-bold text-gray-800">{title}</h2>
      </div>
      {count !== undefined && <span className="text-[11px] text-gray-400 font-medium">{count} items</span>}
    </div>
  );
}

function SectionSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-6 h-6 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: ListProductsSort; label: string }[] = [
  { value: ListProductsSort.newest,     label: "Newest" },
  { value: ListProductsSort.popular,    label: "Popular" },
  { value: "price_asc" as ListProductsSort, label: "Price ↑" },
  { value: "price_desc" as ListProductsSort, label: "Price ↓" },
];

const PRICE_PRESETS = [
  { label: "Any price", min: undefined, max: undefined },
  { label: "Under $10",  min: undefined, max: 10 },
  { label: "$10–$50",    min: 10,        max: 50 },
  { label: "$50–$100",   min: 50,        max: 100 },
  { label: "$100+",      min: 100,       max: undefined },
];

export function StorePage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [, navigate] = useLocation();
  const rawSearch = useSearch();
  const urlParams = new URLSearchParams(rawSearch);
  const selectedCategory = urlParams.get("category") ?? urlParams.get("categoryId") ?? "";

  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort]                   = useState<ListProductsSort>(ListProductsSort.newest);
  const [inStockOnly, setInStockOnly]     = useState(false);
  const [minPrice, setMinPrice]           = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice]           = useState<number | undefined>(undefined);
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [showPricePanel, setShowPricePanel] = useState(false);
  const [page, setPage]                   = useState(1);
  const [browsePage, setBrowsePage]       = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);

  const [prevCategory, setPrevCategory] = useState(selectedCategory);
  if (selectedCategory !== prevCategory) {
    setPrevCategory(selectedCategory);
    setPage(1);
  }

  const { data: categoriesData } = useListCategories();
  const categories = (categoriesData ?? []).filter(c => c.productCount > 0 && !c.name.toLowerCase().includes("gift") && !(c.slug ?? "").toLowerCase().includes("gift"));

  const hasActiveFilters = !!debouncedSearch || !!selectedCategory || inStockOnly || minPrice !== undefined || maxPrice !== undefined;
  const isFiltering = hasActiveFilters || sort !== ListProductsSort.newest;

  const { data: filteredData, isLoading: loadingFiltered } = useListProducts({
    search:    debouncedSearch || undefined,
    category:  selectedCategory || undefined,
    sort,
    min_price: minPrice,
    max_price: maxPrice,
    in_stock:  inStockOnly ? true : undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: bestSellersData, isLoading: loadingBest } = useListProducts({
    sort: ListProductsSort.popular,
    page: 1,
    limit: 8,
  });

  const { data: newArrivalsData, isLoading: loadingNew } = useListProducts({
    sort: ListProductsSort.newest,
    page: 1,
    limit: 8,
  });

  const { data: browseData, isLoading: loadingBrowse } = useListProducts({
    sort: ListProductsSort.newest,
    page: browsePage,
    limit: PAGE_SIZE,
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setDebouncedSearch("");
      setPage(1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val.trim());
      setPage(1);
    }, 400);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function setCategory(slug: string) {
    setPage(1);
    if (slug) navigate(`${basePath}/products?category=${encodeURIComponent(slug)}`);
    else navigate(`${basePath}/products`);
  }

  function applyPricePreset(min: number | undefined, max: number | undefined) {
    setMinPrice(min);
    setMaxPrice(max);
    setMinPriceInput(min !== undefined ? String(min) : "");
    setMaxPriceInput(max !== undefined ? String(max) : "");
    setPage(1);
  }

  function applyCustomPrice() {
    const min = minPriceInput !== "" && !isNaN(Number(minPriceInput)) ? Number(minPriceInput) : undefined;
    const max = maxPriceInput !== "" && !isNaN(Number(maxPriceInput)) ? Number(maxPriceInput) : undefined;
    setMinPrice(min);
    setMaxPrice(max);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setSort(ListProductsSort.newest);
    setInStockOnly(false);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinPriceInput("");
    setMaxPriceInput("");
    setShowPricePanel(false);
    setPage(1);
    navigate(`${basePath}/products`);
  }

  function handleProductClick(id: number) {
    navigate(`/products/${id}`);
  }

  const filteredProducts = filteredData?.products ?? [];
  const totalResults     = filteredData?.total ?? 0;
  const totalPages       = filteredData?.totalPages ?? 1;

  const relatedStartIdx = (filteredData as { relatedStartIndex?: number } | undefined)?.relatedStartIndex;
  const hasRelated       = relatedStartIdx !== undefined && relatedStartIdx < filteredProducts.length && relatedStartIdx > 0;
  const primaryProducts  = hasRelated ? filteredProducts.slice(0, relatedStartIdx) : filteredProducts;
  const relatedProducts  = hasRelated ? filteredProducts.slice(relatedStartIdx) : [];

  const bestSellers  = bestSellersData?.products ?? [];
  const newArrivals  = (newArrivalsData?.products ?? []).filter(p => !bestSellers.some(b => b.id === p.id));

  const activeCategoryName = selectedCategory
    ? (categories.find(c => c.slug === selectedCategory)?.name ?? selectedCategory)
    : "";

  const activePriceLabel = (() => {
    if (minPrice !== undefined && maxPrice !== undefined) return `$${minPrice}–$${maxPrice}`;
    if (minPrice !== undefined) return `$${minPrice}+`;
    if (maxPrice !== undefined) return `Under $${maxPrice}`;
    return null;
  })();

  const activeChipCount = [
    !!selectedCategory,
    inStockOnly,
    activePriceLabel !== null,
    !!debouncedSearch,
    sort !== ListProductsSort.newest,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Sticky search + filter bar ─────────────────────────── */}
      <div className="sticky top-14 z-30 bg-gradient-to-b from-[#f0f4ff] to-white border-b border-indigo-100 shadow-sm">

        {/* Row 1: Search input + filter toggle */}
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={14} />
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-[13px] border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white shadow-sm placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowPricePanel(v => !v)}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl text-[12px] font-semibold border transition-all shadow-sm ${
              activePriceLabel
                ? "bg-indigo-600 text-white border-indigo-600"
                : showPricePanel
                  ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                  : "bg-white text-gray-600 border-indigo-200 hover:border-indigo-400"
            }`}
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">{activePriceLabel ?? "Filter"}</span>
            <ChevronDown size={10} className={`transition-transform ${showPricePanel ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Row 2: Category pills (horizontal scroll) */}
        <div
          ref={categoryRowRef}
          className="flex items-center gap-1.5 px-3 pb-1.5 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setCategory("")}
            className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap shadow-sm ${
              !selectedCategory
                ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                : "bg-white text-gray-600 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50"
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.slug)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap shadow-sm ${
                selectedCategory === cat.slug
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                  : "bg-white text-gray-600 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {cat.name}
              <span className={`ml-1 text-[9px] ${selectedCategory === cat.slug ? "opacity-70" : "text-gray-400"}`}>
                {cat.productCount}
              </span>
            </button>
          ))}
        </div>

        {/* Row 3: Sort + In Stock chips */}
        <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                sort === opt.value
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-gray-500 border-indigo-100 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="h-3 w-px bg-indigo-100 shrink-0 mx-0.5" />
          <button
            onClick={() => { setInStockOnly(v => !v); setPage(1); }}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
              inStockOnly
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-500 border-indigo-100 hover:border-emerald-300"
            }`}
          >
            <CheckCircle2 size={10} />
            In Stock
          </button>
        </div>

        {/* Price panel */}
        {showPricePanel && (
          <div className="px-3 pb-3 border-t border-indigo-100 pt-2.5 space-y-2.5 bg-indigo-50/50">
            <div className="flex gap-1.5 flex-wrap">
              {PRICE_PRESETS.map(preset => {
                const active = preset.min === minPrice && preset.max === maxPrice;
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyPricePreset(preset.min, preset.max)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-indigo-200 hover:border-indigo-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min $"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                onBlur={applyCustomPrice}
                onKeyDown={(e) => e.key === "Enter" && applyCustomPrice()}
                className="flex-1 px-2.5 py-1.5 text-[13px] border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                min={0}
              />
              <span className="text-gray-400 text-[13px]">—</span>
              <input
                type="number"
                placeholder="Max $"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                onBlur={applyCustomPrice}
                onKeyDown={(e) => e.key === "Enter" && applyCustomPrice()}
                className="flex-1 px-2.5 py-1.5 text-[13px] border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                min={0}
              />
              <button
                onClick={() => { applyCustomPrice(); setShowPricePanel(false); }}
                className="px-3 py-1.5 text-[12px] font-semibold bg-indigo-700 text-white rounded-lg whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Active filter summary bar */}
        {(activeChipCount > 0 || isFiltering) && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeCategoryName && (
                <Chip label={activeCategoryName} onClear={() => setCategory("")} />
              )}
              {inStockOnly && (
                <Chip label="In Stock" onClear={() => { setInStockOnly(false); setPage(1); }} />
              )}
              {activePriceLabel && (
                <Chip label={activePriceLabel} onClear={() => { applyPricePreset(undefined, undefined); }} />
              )}
              {debouncedSearch && (
                <Chip label={`"${debouncedSearch}"`} onClear={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }} />
              )}
              {sort !== ListProductsSort.newest && (
                <Chip label={SORT_OPTIONS.find(o => o.value === sort)?.label ?? ""} onClear={() => setSort(ListProductsSort.newest)} />
              )}
            </div>
            <div className="flex items-center gap-3 ml-2 shrink-0">
              <p className="text-[11px] text-blue-600 font-medium">
                {loadingFiltered ? "…" : `${totalResults.toLocaleString()} results`}
              </p>
              <button onClick={clearFilters} className="text-[11px] text-blue-700 font-bold hover:underline">
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Product grid area ───────────────────────────────────── */}
      <div className="px-3 md:px-6 py-5 flex-1 max-w-7xl mx-auto w-full">

        {isFiltering ? (
          loadingFiltered ? (
            <SectionSkeleton cards={8} />
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Package size={44} className="text-gray-200 mb-4" />
              <p className="font-bold text-gray-600 mb-1">No products found</p>
              <p className="text-gray-400 text-sm mb-5">Try adjusting your search or filters.</p>
              <button onClick={clearFilters} className="text-blue-600 font-bold text-sm bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-200">
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              {/* Primary results */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-bold text-gray-800">
                    {activeCategoryName || (debouncedSearch ? `Results for "${debouncedSearch}"` : "Results")}
                  </h2>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {primaryProducts.length} of {totalResults.toLocaleString()}
                  </span>
                </div>
                <ProductGrid products={primaryProducts} onProductClick={handleProductClick} />
              </div>

              {hasRelated && relatedProducts.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Sparkles size={12} className="text-amber-600" />
                    </span>
                    <h2 className="text-[14px] font-bold text-gray-800">Related Products</h2>
                    <span className="text-[11px] text-gray-400 font-medium">{relatedProducts.length} items</span>
                  </div>
                  <ProductGrid products={relatedProducts} onProductClick={handleProductClick} />
                </div>
              )}

              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )
        ) : loadingBest || loadingNew ? (
          <>
            <SectionSkeleton cards={8} />
            <SectionSkeleton cards={8} />
            <SectionSkeleton cards={8} />
          </>
        ) : (
          <>
            {bestSellers.length > 0 && (
              <div className="mb-8">
                <SectionHeader
                  icon={<Star size={13} className="text-blue-600" fill="currentColor" />}
                  title="Best Sellers"
                  colorClass="bg-blue-50"
                />
                <ProductGrid products={bestSellers} onProductClick={handleProductClick} />
              </div>
            )}

            {newArrivals.length > 0 && (
              <div className="mb-8">
                <SectionHeader
                  icon={<Zap size={13} className="text-emerald-600" fill="currentColor" />}
                  title="New Arrivals"
                  colorClass="bg-emerald-50"
                />
                <ProductGrid products={newArrivals} onProductClick={handleProductClick} />
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package size={12} className="text-gray-600" />
                  </span>
                  <h2 className="text-[14px] font-bold text-gray-800">All Products</h2>
                </div>
                <span className="text-[11px] text-gray-400 font-medium">
                  {(browseData?.total ?? 0).toLocaleString()} total
                </span>
              </div>
              {loadingBrowse ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : (browseData?.products ?? []).length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">No products available.</div>
              ) : (
                <ProductGrid products={browseData?.products ?? []} onProductClick={handleProductClick} />
              )}
            </div>

            <Pagination page={browsePage} totalPages={browseData?.totalPages ?? 1} onPage={setBrowsePage} />
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-white text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
      {label}
      <button onClick={onClear} className="text-blue-400 hover:text-blue-700 ml-0.5">
        <X size={10} />
      </button>
    </span>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const [jump, setJump] = useState("");
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-xl disabled:opacity-40 hover:bg-gray-50 bg-white"
        >
          Previous
        </button>
        <span className="text-[13px] text-gray-500">Page {page} of {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-xl disabled:opacity-40 hover:bg-gray-50 bg-white"
        >
          Next
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-gray-400">Go to page</span>
        <input
          type="number" min={1} max={totalPages} value={jump}
          onChange={e => setJump(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              const n = parseInt(jump, 10);
              if (!isNaN(n) && n >= 1 && n <= totalPages) { onPage(n); setJump(""); }
            }
          }}
          placeholder="…"
          className="w-16 text-center text-sm border border-gray-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={() => {
            const n = parseInt(jump, 10);
            if (!isNaN(n) && n >= 1 && n <= totalPages) { onPage(n); setJump(""); }
          }}
          className="px-3 py-1.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700"
        >
          Go
        </button>
      </div>
    </div>
  );
}
