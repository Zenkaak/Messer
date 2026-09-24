import { useListProducts, useListCategories, ListProductsSort } from "@workspace/api-client-react";
import { useState, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, ChevronRight, Clock, X, SlidersHorizontal, ArrowUpDown, ChevronDown } from "lucide-react";
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
      {isInstant ? "1 Minute" : "0-3 Hours"}
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
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain p-0.5"
      onError={() => setFailed(true)}
    />
  );
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
        <ProductThumb src={product.imageUrl} alt={product.name} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-1">{product.name}</p>
        <DeliveryBadge name={product.name} />
      </div>
      <p className="text-[13px] font-black text-gray-800 shrink-0">
        ${product.price % 1 === 0 ? product.price.toFixed(1) : product.price.toFixed(2)}
      </p>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </div>
  );
}

function SectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <Skeleton className="h-4 w-28" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0">
          <Skeleton className="w-10 h-10 rounded-md shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-4 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Section({ title, color, products, onProductClick }: {
  title: string;
  color: string;
  products: Product[];
  onProductClick: (id: number) => void;
}) {
  if (products.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3">
      <div className={`px-3 py-2 border-b border-gray-200 ${color}`}>
        <p className="text-[13px] font-bold">{title}</p>
      </div>
      {products.map((p) => (
        <ProductRow key={p.id} product={p} onClick={() => onProductClick(p.id)} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
] as const;

const PRICE_PRESETS = [
  { label: "Any", min: undefined, max: undefined },
  { label: "Under $10", min: undefined, max: 10 },
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
  const [typeFilter, setTypeFilter] = useState<"" | "server" | "imei">("");
  const [sort, setSort] = useState<ListProductsSort>(ListProductsSort.newest);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [browsePage, setBrowsePage] = useState(1);
  const [pageJump, setPageJump] = useState("");
  const [browsePageJump, setBrowsePageJump] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prevCategory, setPrevCategory] = useState(selectedCategory);
  if (selectedCategory !== prevCategory) {
    setPrevCategory(selectedCategory);
    setPage(1);
  }

  const { data: categoriesData } = useListCategories();

  const hasActiveFilters = !!debouncedSearch || !!selectedCategory || !!typeFilter || minPrice !== undefined || maxPrice !== undefined;
  const isFiltering = hasActiveFilters || sort !== ListProductsSort.newest;

  const { data: filteredData, isLoading: loadingFiltered } = useListProducts({
    search: debouncedSearch || undefined,
    category: selectedCategory || undefined,
    sort,
    min_price: minPrice,
    max_price: maxPrice,
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
    // Clear search results immediately when input is emptied
    if (!val.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDebouncedSearch("");
      setPage(1);
    }
  }, []);

  const handleSearchSubmit = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedSearch(val.trim());
    setPage(1);
  }, []);

  function applyTypeFilter(products: Product[]): Product[] {
    if (!typeFilter) return products;
    return products.filter((p) => {
      const lower = `${p.name} ${p.categoryName ?? ""}`.toLowerCase();
      const serverKw = ["tool", "credit", "server", "activation", "license", "dongle", "software", "subscription"];
      const isServer = serverKw.some((kw) => lower.includes(kw));
      return typeFilter === "server" ? isServer : !isServer;
    });
  }

  function setCategory(slug: string) {
    setPage(1);
    if (slug) {
      navigate(`${basePath}/products?category=${encodeURIComponent(slug)}`);
    } else {
      navigate(`${basePath}/products`);
    }
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
    setTypeFilter("");
    setSort(ListProductsSort.newest);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinPriceInput("");
    setMaxPriceInput("");
    setPage(1);
    navigate(`${basePath}/products`);
  }

  function handleProductClick(id: number) {
    navigate(`/products/${id}`);
  }

  const filteredProducts = applyTypeFilter(filteredData?.products ?? []);
  const totalResults = filteredData?.total ?? 0;
  const totalPages = filteredData?.totalPages ?? 1;

  const relatedStartIdx: number | undefined = (filteredData as { relatedStartIndex?: number } | undefined)?.relatedStartIndex;
  const hasRelated = relatedStartIdx !== undefined && relatedStartIdx < filteredProducts.length && relatedStartIdx > 0;
  const primaryProducts = hasRelated ? filteredProducts.slice(0, relatedStartIdx) : filteredProducts;
  const relatedProducts = hasRelated ? filteredProducts.slice(relatedStartIdx) : [];

  const bestSellers = applyTypeFilter(bestSellersData?.products ?? []);
  const newArrivals = applyTypeFilter(
    (newArrivalsData?.products ?? []).filter((p) => !bestSellers.some((b) => b.id === p.id))
  );

  const activeCategoryName = selectedCategory
    ? (categoriesData ?? []).find(c => c.slug === selectedCategory)?.name ?? selectedCategory
    : "";

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Newest";

  const activePriceLabel = (() => {
    if (minPrice !== undefined && maxPrice !== undefined) return `$${minPrice}–$${maxPrice}`;
    if (minPrice !== undefined) return `$${minPrice}+`;
    if (maxPrice !== undefined) return `Under $${maxPrice}`;
    return null;
  })();

  const activeChips = [
    activeCategoryName && { key: "cat", label: activeCategoryName, clear: () => setCategory("") },
    typeFilter && { key: "type", label: typeFilter === "server" ? "Server Service" : "IMEI Service", clear: () => setTypeFilter("") },
    activePriceLabel && { key: "price", label: activePriceLabel, clear: () => applyPricePreset(undefined, undefined) },
    debouncedSearch && { key: "search", label: `"${debouncedSearch}"`, clear: () => { setSearch(""); setDebouncedSearch(""); setPage(1); } },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="px-4 md:px-8 pt-5 pb-3 border-b border-gray-200 bg-white max-w-none">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-0.5">
            {activeCategoryName || "Product List"}
          </h1>
          <p className="text-[13px] text-gray-500">
            {activeCategoryName
              ? `Showing all products in ${activeCategoryName}`
              : "Comprehensive list of all products and services."}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-4 md:px-8 py-3 bg-white border-b border-gray-200 sticky top-14 z-30 space-y-2">
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1 flex gap-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(search); } }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            <button
              onClick={() => handleSearchSubmit(search)}
              className="px-3 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeChips.length > 0 && (
              <span className={`text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${showFilters || hasActiveFilters ? "bg-white text-blue-600" : "bg-blue-600 text-white"}`}>
                {activeChips.length}
              </span>
            )}
          </button>
        </div>

        {/* Expandable filters panel */}
        {showFilters && (
          <div className="space-y-3 pt-1 pb-1">
            {/* Row 1: Category + Type */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedCategory}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white appearance-none pr-7"
                >
                  <option value="">All Categories</option>
                  {(categoriesData ?? []).filter(c => c.productCount > 0).map((cat) => (
                    <option key={cat.id} value={cat.slug}>{cat.name} ({cat.productCount})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={13} />
              </div>
              <div className="relative flex-1">
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value as "" | "server" | "imei"); setPage(1); }}
                  className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white appearance-none pr-7"
                >
                  <option value="">All Types</option>
                  <option value="server">Server Service</option>
                  <option value="imei">IMEI Service</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={13} />
              </div>
            </div>

            {/* Row 2: Sort */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <ArrowUpDown size={10} /> Sort by
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value as ListProductsSort); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                      sort === opt.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 3: Price Range */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price Range</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {PRICE_PRESETS.map(preset => {
                  const active = preset.min === minPrice && preset.max === maxPrice;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => applyPricePreset(preset.min, preset.max)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
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
                  onClick={applyCustomPrice}
                  className="px-3 py-1.5 text-[12px] font-semibold bg-gray-900 text-white rounded-lg"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active chips + result count */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeChips.map(chip => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200"
              >
                {chip.label}
                <button onClick={chip.clear} className="text-blue-400 hover:text-blue-700 ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
            {sort !== ListProductsSort.newest && (
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-gray-200">
                {activeSortLabel}
                <button onClick={() => setSort(ListProductsSort.newest)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <p className="text-[11px] text-gray-500 whitespace-nowrap">
              {loadingFiltered ? "Loading..." : `${(isFiltering ? totalResults : browseData?.total ?? 0).toLocaleString()} products`}
            </p>
            {(hasActiveFilters || sort !== ListProductsSort.newest) && (
              <button onClick={clearFilters} className="text-[11px] text-blue-600 font-semibold whitespace-nowrap hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product list */}
      <div className="px-4 md:px-8 py-4 flex-1 max-w-7xl mx-auto w-full">
        {isFiltering ? (
          loadingFiltered ? (
            <SectionSkeleton rows={8} />
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search size={40} className="text-gray-300 mb-3" />
              <p className="font-bold text-gray-600 mb-1">No products found</p>
              <p className="text-gray-400 text-sm mb-4">Try adjusting your search or filters.</p>
              <button onClick={clearFilters} className="text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-lg">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-gray-700">
                    {activeCategoryName || "Results"}
                  </p>
                  <p className="text-[11px] text-gray-400">{filteredProducts.length} of {filteredData?.total ?? 0}</p>
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

              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
                    >
                      Previous
                    </button>
                    <span className="text-[13px] text-gray-500">Page {page} of {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-gray-400">Go to page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageJump}
                      onChange={e => setPageJump(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const n = parseInt(pageJump, 10);
                          if (!isNaN(n) && n >= 1 && n <= totalPages) { setPage(n); setPageJump(""); }
                        }
                      }}
                      placeholder="…"
                      className="w-16 text-center text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => {
                        const n = parseInt(pageJump, 10);
                        if (!isNaN(n) && n >= 1 && n <= totalPages) { setPage(n); setPageJump(""); }
                      }}
                      className="px-3 py-1.5 text-sm font-semibold bg-[#1a2332] text-white rounded-lg hover:bg-[#1e3a5f]"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}
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
            <Section title="Best Sellers" color="bg-blue-50 text-blue-700" products={bestSellers} onProductClick={handleProductClick} />
            <Section title="New Arrivals" color="bg-green-50 text-green-700" products={newArrivals} onProductClick={handleProductClick} />

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-[13px] font-bold text-gray-700">All Products</p>
                <p className="text-[11px] text-gray-400">{(browseData?.total ?? 0).toLocaleString()} total</p>
              </div>
              {loadingBrowse ? (
                <SectionSkeleton rows={PAGE_SIZE} />
              ) : (browseData?.products ?? []).length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No products available.</div>
              ) : (
                (browseData?.products ?? []).map((p) => (
                  <ProductRow key={p.id} product={p} onClick={() => handleProductClick(p.id)} />
                ))
              )}
            </div>

            {(browseData?.totalPages ?? 1) > 1 && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex items-center gap-3">
                  <button
                    disabled={browsePage <= 1}
                    onClick={() => setBrowsePage(p => Math.max(1, p - 1))}
                    className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
                  >
                    Previous
                  </button>
                  <span className="text-[13px] text-gray-500">Page {browsePage} of {browseData?.totalPages ?? 1}</span>
                  <button
                    disabled={browsePage >= (browseData?.totalPages ?? 1)}
                    onClick={() => setBrowsePage(p => Math.min(browseData?.totalPages ?? 1, p + 1))}
                    className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gray-400">Go to page</span>
                  <input
                    type="number"
                    min={1}
                    max={browseData?.totalPages ?? 1}
                    value={browsePageJump}
                    onChange={e => setBrowsePageJump(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const n = parseInt(browsePageJump, 10);
                        const max = browseData?.totalPages ?? 1;
                        if (!isNaN(n) && n >= 1 && n <= max) { setBrowsePage(n); setBrowsePageJump(""); }
                      }
                    }}
                    placeholder="…"
                    className="w-16 text-center text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => {
                      const n = parseInt(browsePageJump, 10);
                      const max = browseData?.totalPages ?? 1;
                      if (!isNaN(n) && n >= 1 && n <= max) { setBrowsePage(n); setBrowsePageJump(""); }
                    }}
                    className="px-3 py-1.5 text-sm font-semibold bg-[#1a2332] text-white rounded-lg hover:bg-[#1e3a5f]"
                  >
                    Go
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
