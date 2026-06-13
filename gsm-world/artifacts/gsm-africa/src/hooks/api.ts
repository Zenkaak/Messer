import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getSessionId(): string {
  let id = localStorage.getItem("gsm_session_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("gsm_session_id", id);
  }
  return id;
}

export type ListProductsSort = "newest" | "popular" | "price_asc" | "price_desc";

export type ProductItem = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
  featured?: boolean;
  inStock?: boolean;
  description?: string;
};

export type ProductsResponse = {
  products: ProductItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

export type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  imageUrl?: string | null;
};

export type CartItemResponse = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

export type CartResponse = {
  items: CartItemResponse[];
  total: number;
  itemCount: number;
};

export type ListProductsParams = {
  search?: string;
  category?: string;
  sort?: ListProductsSort;
  page?: number;
  limit?: number;
  featured?: boolean;
};

async function fetchProducts(params: ListProductsParams = {}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category) qs.set("category", params.category);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.featured !== undefined) qs.set("featured", String(params.featured));
  const url = `${BASE}/api/products${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json();
}

async function fetchCategories(): Promise<CategoryItem[]> {
  const res = await fetch(`${BASE}/api/categories`);
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

function getAuthToken(): string | null {
  try { return localStorage.getItem("gsmafrica_token"); } catch { return null; }
}

function cartHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const token = getAuthToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchCart(): Promise<CartResponse> {
  const res = await fetch(`${BASE}/api/cart?sessionId=${getSessionId()}`, {
    headers: cartHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch cart: ${res.status}`);
  return res.json();
}

export const CART_QUERY_KEY = ["cart"];
export function getGetCartQueryKey() { return CART_QUERY_KEY; }

export function useListProducts(
  params: ListProductsParams = {},
  options?: { query?: { enabled?: boolean; staleTime?: number } }
) {
  const enabled = options?.query?.enabled ?? true;
  const staleTime = options?.query?.staleTime ?? 30_000;
  return useQuery<ProductsResponse>({
    queryKey: ["products", params],
    queryFn: () => fetchProducts(params),
    enabled,
    staleTime,
  });
}

export function useListCategories(options?: { query?: { staleTime?: number } }) {
  const staleTime = options?.query?.staleTime ?? 60_000;
  return useQuery<CategoryItem[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime,
  });
}

export function useGetProduct(id: number | string | null) {
  return useQuery<ProductItem>({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/products/${id}`);
      if (!res.ok) throw new Error(`Product not found: ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useGetCart() {
  return useQuery<CartResponse>({
    queryKey: CART_QUERY_KEY,
    queryFn: fetchCart,
    staleTime: 0,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation<CartResponse, Error, { productId: number; data?: { quantity?: number } }>({
    mutationFn: async ({ productId, data }) => {
      const res = await fetch(`${BASE}/api/cart?sessionId=${getSessionId()}`, {
        method: "POST",
        headers: cartHeaders(),
        body: JSON.stringify({ productId, quantity: data?.quantity ?? 1 }),
      });
      if (!res.ok) throw new Error(`Failed to add to cart: ${res.status}`);
      return res.json();
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation<CartResponse, Error, { productId: number; data: { quantity: number } }>({
    mutationFn: async ({ productId, data }) => {
      const res = await fetch(`${BASE}/api/cart/${productId}?sessionId=${getSessionId()}`, {
        method: "PUT",
        headers: cartHeaders(),
        body: JSON.stringify({ quantity: data.quantity }),
      });
      if (!res.ok) throw new Error(`Failed to update cart: ${res.status}`);
      return res.json();
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation<CartResponse, Error, { productId: number }>({
    mutationFn: async ({ productId }) => {
      const res = await fetch(`${BASE}/api/cart/${productId}?sessionId=${getSessionId()}`, {
        method: "DELETE",
        headers: cartHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to remove from cart: ${res.status}`);
      return res.json();
    },
    onSuccess: (cart) => {
      qc.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}
