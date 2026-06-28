import { useListProducts, useListCategories, ListProductsSort } from "@workspace/api-client-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, X, CheckCircle2, Package, Zap, Star, Sparkles, SlidersHorizontal, ChevronDown } from "lucide-react";
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

function isGift(p: Product) {
  const n = (p.name ?? "").toLowerCase();
  const c = (p.categoryName ?? "").toLowerCase();
  return n.includes("gift") || c.includes("gift");
}

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#0f1c2e] via-[#1a2d45] to-[#0d3349] flex items-center justify-center">
        <span className="text-teal-400 font-black text-[10px] tracking-[0.2em] opacity-70">GSM</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-full h-full object-contain p-3" onError={() => setFailed(true)} />;
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const outOfStock = product.inStock === false;
  const priceStr = product.price % 1 === 0 ? product.price.toFixed(0) : product.price.toFixed(2);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl cursor-pointer overflow-hidden flex flex-col hover:-translate-y-0.5 transition-all duration-200 ${outOfStock ? "opacity-50" : ""}`}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
    >
      <div className="relative w-full aspect-square overflow-hidden" style={{ background: "linear-gradient(135deg,#0f1c2e 0%,#1a2d45 100%)" }}>
        <ProductThumb src={product.imageUrl} alt={product.name} />

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
            <span className="text-[10px] font-bold text-red-400 bg-black/80 px-2 py-0.5 rounded-full" style={{ border: "1px solid rgba(239,68,68,0.4)" }}>
              Out of Stock
            </span>
          </div>
        )}
        {product.featured && !outOfStock && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-300 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(217,119,6,0.25)", border: "1px solid rgba(217,119,6,0.4)" }}>
              <Star size={7} fill="currentColor" /> Featured
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col flex-1 gap-1">
        {product.categoryName && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-teal-400/80 truncate">
            {product.categoryName}
          </span>
        )}
        <p className="text-[11px] font-semibold text-white/90 leading-snug line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between pt-1.5 mt-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[14px] font-black text-white">${priceStr}</p>
          <span className="text-[9px] font-semibold text-emerald-400 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
            Buy
          </span>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <Skeleton className="w-full aspect-square" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-2 w-14" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-3 w-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-3 w-3/4" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-10" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Skeleton className="h-4 w-8" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>
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
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}

function ProductGrid({ products, onProductClick }: { products: Product[]; onProductClick: (id: number) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} />
      ))}
    </div>
  );
}

function SectionLabel({
  icon,
  title,
  count,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center opacity-80 ${accent}`}>{icon}</span>
        <h2 className="text-[14px] font-bold text-white/90">{title}</h2>
      </div>
      {count !== undefined && (
        <span className="text-[11px] text-white/30 font-medium">{count} items</span>
      )}
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
      {label}
      <button onClick={onClear} className="text-blue-400 hover:text-blue-200 ml-0.5">
        <X size={10} />
      </button>
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-5">
      <button
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-30 transition-colors text-white/80 hover:text-white"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        Previous
      </button>
      <span className="text-[13px] text-white/40 font-medium">
        {page} / {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-30 transition-colors text-white/80 hover:text-white"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        Next
      </button>
    </div>
  );
}

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: ListProductsSort; label: string }[] = [
  { value: ListProductsSort.newest, label: "Newest" },
  { value: ListProductsSort.popular, label: "Popular" },
  { value: "price_asc" as ListProductsSort, label: "Price ↑" },
  { value: "price_desc" as ListProductsSort, label: "Price ↓" },
];

const PRICE_PRESETS = [
  { label: "Any", min: undefined, max: undefined },
  { label: "< $10", min: undefined, max: 10 },
  { label: "$10–$50", min: 10, max: 50 },
  { label: "$50–$100", min: 50, max: 100 },
  { label: "$100+", min: 100, max: undefined },
];

export function StorePage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [, navigate] = useLocation();
  const rawSearch = useSearch();
  const urlParams = new URLSearchParams(rawSearch);
  const selectedCategory = urlParams.get("category") ?? urlParams.get("categoryId") ?? "";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<ListProductsSort>(ListProductsSort.newest);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [page, setPage] = useState(1);
  const [browsePage, setBrowsePage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prevCategory, setPrevCategory] = useState(selectedCategory);
  if (selectedCategory !== prevCategory) {
    setPrevCategory(selectedCategory);
    setPage(1);
  }

  const { data: categoriesData } = useListCategories();
  const categories = (categoriesData ?? []).filter(
    (c) =>
      c.productCount > 0 &&
      !c.name.toLowerCase().includes("gift") &&
      !(c.slug ?? "").toLowerCase().includes("gift"),
  );

  const hasActiveFilters =
    !!debouncedSearch ||
    !!selectedCategory ||
    inStockOnly ||
    minPrice !== undefined ||
    maxPrice !== undefined;
  const isFiltering = hasActiveFilters || sort !== ListProductsSort.newest;

  const { data: filteredData, isLoading: loadingFiltered } = useListProducts({
    search: debouncedSearch || undefined,
    category: selectedCategory || undefined,
    sort,
    min_price: minPrice,
    max_price: maxPrice,
    in_stock: inStockOnly ? true : undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: bestSellersData, isLoading: loadingBest } = useListProducts({
    sort: ListProductsSort.popular,
    page: 1,
    limit: 10,
  });

  const { data: newArrivalsData, isLoading: loadingNew } = useListProducts({
    sort: ListProductsSort.newest,
    page: 1,
    limit: 10,
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
    }, 380);
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
    const min =
      minPriceInput !== "" && !isNaN(Number(minPriceInput))
        ? Number(minPriceInput)
        : undefined;
    const max =
      maxPriceInput !== "" && !isNaN(Number(maxPriceInput))
        ? Number(maxPriceInput)
        : undefined;
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
    setShowFilters(false);
    setPage(1);
    navigate(`${basePath}/products`);
  }

  function handleProductClick(id: number) {
    navigate(`/products/${id}`);
  }

  const activeCategoryName = categories.find((c) => c.slug === selectedCategory)?.name;
  const activePriceLabel =
    minPrice !== undefined || maxPrice !== undefined
      ? minPrice !== undefined && maxPrice !== undefined
        ? `$${minPrice}–$${maxPrice}`
        : minPrice !== undefined
        ? `$${minPrice}+`
        : `< $${maxPrice}`
      : null;

  const filteredProducts = (filteredData?.products ?? []).filter((p) => !isGift(p));
  const totalResults = filteredData?.total ?? 0;
  const totalPages = filteredData?.totalPages ?? 1;
  const relatedStartIdx = (filteredData as { relatedStartIndex?: number } | undefined)?.relatedStartIndex;
  const hasRelated = relatedStartIdx !== undefined && relatedStartIdx < filteredProducts.length;
  const primaryProducts = hasRelated ? filteredProducts.slice(0, relatedStartIdx) : filteredProducts;
  const relatedProducts = hasRelated ? filteredProducts.slice(relatedStartIdx) : [];

  const bestSellers = (bestSellersData?.products ?? []).filter((p) => !isGift(p));
  const newArrivals = (newArrivalsData?.products ?? []).filter((p) => !isGift(p));
  const browseProducts = (browseData?.products ?? []).filter((p) => !isGift(p));

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#06101e 0%,#0b1a35 100%)" }}>
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 pt-8 pb-6"
        style={{ background: "linear-gradient(135deg,#0f1c2e 0%,#0d3349 60%,#0a3d52 100%)" }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%,#38bdf8 0%,transparent 50%),radial-gradient(circle at 80% 20%,#818cf8 0%,transparent 40%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-teal-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">GSM World Store</p>
          <h1 className="text-white font-black text-2xl leading-tight mb-4">
            Phone Unlocks &<br />Digital Services
          </h1>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-9 py-2.5 text-[13px] bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:bg-white/15 transition-colors"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Category pills ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20" style={{ background: "rgba(6,16,30,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setCategory("")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
              !selectedCategory
                ? "bg-teal-500/20 text-teal-300"
                : "text-white/50 hover:text-white/80"
            }`}
            style={!selectedCategory ? { border: "1px solid rgba(20,184,166,0.4)" } : { border: "1px solid rgba(255,255,255,0.08)" }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.slug)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat.slug
                  ? "bg-teal-500/20 text-teal-300"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={selectedCategory === cat.slug ? { border: "1px solid rgba(20,184,166,0.4)" } : { border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {cat.name}
              <span className={`ml-1 text-[9px] ${selectedCategory === cat.slug ? "opacity-60" : "opacity-30"}`}>
                {cat.productCount}
              </span>
            </button>
          ))}
        </div>

        {/* Sort + Filter row */}
        <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex items-center gap-1 shrink-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); setPage(1); }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                  sort === opt.value
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
                style={sort === opt.value
                  ? { background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.5)" }
                  : { border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="h-3 w-px shrink-0 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
          <button
            onClick={() => { setInStockOnly((v) => !v); setPage(1); }}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              inStockOnly ? "text-emerald-300" : "text-white/40 hover:text-white/70"
            }`}
            style={inStockOnly
              ? { background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)" }
              : { border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <CheckCircle2 size={10} /> In Stock
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              activePriceLabel || showFilters ? "text-indigo-300" : "text-white/40 hover:text-white/70"
            }`}
            style={activePriceLabel || showFilters
              ? { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }
              : { border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <SlidersHorizontal size={10} />
            {activePriceLabel ?? "Price"}
            <ChevronDown size={9} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Price filter dropdown */}
        {showFilters && (
          <div className="px-3 pb-3 pt-2 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.06)" }}>
            <div className="flex gap-1.5 flex-wrap">
              {PRICE_PRESETS.map((preset) => {
                const active = preset.min === minPrice && preset.max === maxPrice;
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyPricePreset(preset.min, preset.max)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      active ? "text-indigo-200" : "text-white/50 hover:text-white/80"
                    }`}
                    style={active
                      ? { background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)" }
                      : { border: "1px solid rgba(255,255,255,0.1)" }}
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
                className="flex-1 px-2.5 py-1.5 text-[12px] rounded-lg focus:outline-none text-white placeholder-white/20"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                min={0}
              />
              <span className="text-white/20">—</span>
              <input
                type="number"
                placeholder="Max $"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                onBlur={applyCustomPrice}
                onKeyDown={(e) => e.key === "Enter" && applyCustomPrice()}
                className="flex-1 px-2.5 py-1.5 text-[12px] rounded-lg focus:outline-none text-white placeholder-white/20"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                min={0}
              />
              <button
                onClick={() => { applyCustomPrice(); setShowFilters(false); }}
                className="px-3 py-1.5 text-[11px] font-bold text-white rounded-lg whitespace-nowrap"
                style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {isFiltering && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(59,130,246,0.05)" }}>
            {activeCategoryName && <Chip label={activeCategoryName} onClear={() => setCategory("")} />}
            {inStockOnly && <Chip label="In Stock" onClear={() => { setInStockOnly(false); setPage(1); }} />}
            {activePriceLabel && <Chip label={activePriceLabel} onClear={() => applyPricePreset(undefined, undefined)} />}
            {debouncedSearch && (
              <Chip label={`"${debouncedSearch}"`} onClear={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }} />
            )}
            {sort !== ListProductsSort.newest && (
              <Chip
                label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ""}
                onClear={() => setSort(ListProductsSort.newest)}
              />
            )}
            <div className="flex-1" />
            <span className="text-[11px] text-blue-300/70 font-medium">
              {loadingFiltered ? "…" : `${totalResults.toLocaleString()} results`}
            </span>
            <button onClick={clearFilters} className="text-[11px] text-blue-300 font-bold hover:text-blue-200 ml-1">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Product area ─────────────────────────────────────────── */}
      <div className="px-3 md:px-6 py-5 max-w-7xl mx-auto">
        {isFiltering ? (
          loadingFiltered ? (
            <SectionSkeleton cards={8} />
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Package size={44} className="text-white/15 mb-4" />
              <p className="font-bold text-white/70 mb-1">No products found</p>
              <p className="text-white/35 text-sm mb-5">Try adjusting your search or filters.</p>
              <button
                onClick={clearFilters}
                className="text-blue-300 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <SectionLabel
                  icon={<Search size={12} className="text-indigo-600" />}
                  title={activeCategoryName ?? (debouncedSearch ? `Results for "${debouncedSearch}"` : "Results")}
                  count={totalResults}
                  accent="bg-indigo-50"
                />
                <ProductGrid products={primaryProducts} onProductClick={handleProductClick} />
              </div>

              {hasRelated && relatedProducts.length > 0 && (
                <div className="mb-6">
                  <SectionLabel
                    icon={<Sparkles size={12} className="text-amber-600" />}
                    title="Related Products"
                    count={relatedProducts.length}
                    accent="bg-amber-50"
                  />
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
                <SectionLabel
                  icon={<Star size={12} className="text-amber-500" fill="currentColor" />}
                  title="Best Sellers"
                  count={bestSellers.length}
                  accent="bg-amber-50"
                />
                <ProductGrid products={bestSellers} onProductClick={handleProductClick} />
              </div>
            )}

            {newArrivals.length > 0 && (
              <div className="mb-8">
                <SectionLabel
                  icon={<Zap size={12} className="text-emerald-600" fill="currentColor" />}
                  title="New Arrivals"
                  count={newArrivals.length}
                  accent="bg-emerald-50"
                />
                <ProductGrid products={newArrivals} onProductClick={handleProductClick} />
              </div>
            )}

            <div className="mb-6">
              <SectionLabel
                icon={<Package size={12} className="text-gray-500" />}
                title="All Products"
                count={browseData?.total}
                accent="bg-gray-100"
              />
              {loadingBrowse ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : browseProducts.length === 0 ? (
                <div className="py-16 text-center text-white/30 text-sm">No products available.</div>
              ) : (
                <ProductGrid products={browseProducts} onProductClick={handleProductClick} />
              )}
            </div>

            <Pagination page={browsePage} totalPages={browseData?.totalPages ?? 1} onPage={setBrowsePage} />
          </>
        )}
      </div>
    </div>
  );
}
