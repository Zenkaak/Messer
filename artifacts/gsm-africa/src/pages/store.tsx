import { useListProducts, useListCategories, ListProductsSort } from "@workspace/api-client-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, ChevronRight, Clock, X, SlidersHorizontal, ChevronDown, CheckCircle2, Package } from "lucide-react";
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
    <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
      <Clock size={10} className="shrink-0" />
      {isInstant ? "1 Minute" : "0–3 Hours"}
    </span>
  );
}

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center">
        <span className="text-white font-black text-[8px]">GSM</span>
      </div>
    );
  }
  return (
    <img src={src} alt={alt} className="w-full h-full object-contain p-0.5" onError={() => setFailed(true)} />
  );
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
        <ProductThumb src={product.imageUrl} alt={product.name} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-1">{product.name}</p>
        <div className="flex items-center gap-2">
          <DeliveryBadge name={product.name} />
          {product.inStock === false && (
            <span className="text-[10px] text-red-400 font-medium">Out of stock</span>
          )}
        </div>
      </div>
      <p className="text-[13px] font-black text-gray-800 shrink-0">
        ${product.price % 1 === 0 ? product.price.toFixed(0) : product.price.toFixed(2)}
      </p>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <Skeleton className="w-10 h-10 rounded-md shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-4 w-10 shrink-0" />
    </div>
  );
}

function SectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <Skeleton className="h-4 w-28" />
      </div>
      {Array.from({ length: rows }).map((_, i) => <RowSkeleton key={i} />)}
    </div>
  );
}

function ProductSection({ title, colorClass, products, onProductClick, count }: {
  title: string;
  colorClass: string;
  products: Product[];
  onProductClick: (id: number) => void;
  count?: number;
}) {
  if (products.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
      <div className={`px-3 py-2 border-b border-gray-200 ${colorClass} flex items-center justify-between`}>
        <p className="text-[13px] font-bold">{title}</p>
        {count !== undefined && <p className="text-[11px] opacity-60">{count} items</p>}
      </div>
      {products.map((p) => (
        <ProductRow key={p.id} product={p} onClick={() => onProductClick(p.id)} />
      ))}
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
  const categories = (categoriesData ?? []).filter(c => c.productCount > 0);

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
    limit: 6,
  });

  const { data: newArrivalsData, isLoading: loadingNew } = useListProducts({
    sort: ListProductsSort.newest,
    page: 1,
    limit: 6,
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
      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 shadow-sm">

        {/* Row 1: Search input */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-[13px] border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Category pills (horizontal scroll) */}
        <div
          ref={categoryRowRef}
          className="flex items-center gap-2 px-3 pb-2 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setCategory("")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
              !selectedCategory
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.slug)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
                selectedCategory === cat.slug
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {cat.name}
              <span className={`ml-1 text-[10px] ${selectedCategory === cat.slug ? "opacity-70" : "text-gray-400"}`}>
                {cat.productCount}
              </span>
            </button>
          ))}
        </div>

        {/* Row 3: Sort chips + availability + price filter toggle */}
        <div className="flex items-center gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {/* Sort */}
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                sort === opt.value
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="h-4 w-px bg-gray-200 shrink-0 mx-0.5" />

          {/* In stock toggle */}
          <button
            onClick={() => { setInStockOnly(v => !v); setPage(1); }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
              inStockOnly
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            <CheckCircle2 size={11} />
            In Stock
          </button>

          {/* Price range toggle */}
          <button
            onClick={() => setShowPricePanel(v => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
              activePriceLabel
                ? "bg-purple-600 text-white border-purple-600"
                : showPricePanel
                  ? "bg-gray-100 text-gray-800 border-gray-400"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            <SlidersHorizontal size={11} />
            {activePriceLabel ?? "Price"}
            <ChevronDown size={10} className={`transition-transform ${showPricePanel ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Price panel (expandable) */}
        {showPricePanel && (
          <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 space-y-2.5">
            <div className="flex gap-1.5 flex-wrap">
              {PRICE_PRESETS.map(preset => {
                const active = preset.min === minPrice && preset.max === maxPrice;
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyPricePreset(preset.min, preset.max)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                      active
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
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
                className="flex-1 px-2.5 py-1.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
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
                className="flex-1 px-2.5 py-1.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                min={0}
              />
              <button
                onClick={() => { applyCustomPrice(); setShowPricePanel(false); }}
                className="px-3 py-1.5 text-[12px] font-semibold bg-gray-900 text-white rounded-lg whitespace-nowrap"
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

      {/* ── Product list area ───────────────────────────────────── */}
      <div className="px-3 md:px-8 py-4 flex-1 max-w-7xl mx-auto w-full">

        {isFiltering ? (
          loadingFiltered ? (
            <SectionSkeleton rows={8} />
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
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-gray-700">
                    {activeCategoryName || (debouncedSearch ? `Results for "${debouncedSearch}"` : "Results")}
                  </p>
                  <p className="text-[11px] text-gray-400">{primaryProducts.length} of {totalResults.toLocaleString()}</p>
                </div>
                {primaryProducts.map((p) => (
                  <ProductRow key={p.id} product={p} onClick={() => handleProductClick(p.id)} />
                ))}
              </div>

              {hasRelated && relatedProducts.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
                  <div className="px-3 py-2 border-b border-gray-200 bg-amber-50 flex items-center justify-between">
                    <p className="text-[13px] font-bold text-amber-700">Related Products</p>
                    <p className="text-[11px] text-amber-500">{relatedProducts.length} items</p>
                  </div>
                  {relatedProducts.map((p) => (
                    <ProductRow key={p.id} product={p} onClick={() => handleProductClick(p.id)} />
                  ))}
                </div>
              )}

              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )
        ) : loadingBest || loadingNew ? (
          <>
            <SectionSkeleton rows={5} />
            <SectionSkeleton rows={5} />
            <SectionSkeleton rows={8} />
          </>
        ) : (
          <>
            <ProductSection
              title="Best Sellers"
              colorClass="bg-blue-50 text-blue-700"
              products={bestSellers}
              onProductClick={handleProductClick}
            />
            <ProductSection
              title="New Arrivals"
              colorClass="bg-green-50 text-green-700"
              products={newArrivals}
              onProductClick={handleProductClick}
            />

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-[13px] font-bold text-gray-700">All Products</p>
                <p className="text-[11px] text-gray-400">{(browseData?.total ?? 0).toLocaleString()} total</p>
              </div>
              {loadingBrowse ? (
                Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
              ) : (browseData?.products ?? []).length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No products available.</div>
              ) : (
                (browseData?.products ?? []).map((p) => (
                  <ProductRow key={p.id} product={p} onClick={() => handleProductClick(p.id)} />
                ))
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
          className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
        >
          Previous
        </button>
        <span className="text-[13px] text-gray-500">Page {page} of {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
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
          className="w-16 text-center text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={() => {
            const n = parseInt(jump, 10);
            if (!isNaN(n) && n >= 1 && n <= totalPages) { onPage(n); setJump(""); }
          }}
          className="px-3 py-1.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700"
        >
          Go
        </button>
      </div>
    </div>
  );
}
