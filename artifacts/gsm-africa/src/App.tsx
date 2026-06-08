import { lazy, Suspense, Component, type ReactNode } from "react";
import { Layout } from "@/components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import { NotificationProvider } from "@/context/notification-context";
import { useAppVersion } from "@/hooks/use-app-version";

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif", textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#666", fontSize: 14 }}>{(this.state.error as Error).message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 20px", cursor: "pointer" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy page imports — each page is its own JS chunk ─────────────────────────
// Only the chunk for the current route is downloaded; admin (~200 KB) is never
// loaded by regular users, and vice-versa.
const Home              = lazy(() => import("@/pages/home").then(m => ({ default: m.Home })));
const StorePage         = lazy(() => import("@/pages/store").then(m => ({ default: m.StorePage })));
const ProductPage       = lazy(() => import("@/pages/product").then(m => ({ default: m.ProductPage })));
const CartPage          = lazy(() => import("@/pages/cart").then(m => ({ default: m.CartPage })));
const CategoriesPage    = lazy(() => import("@/pages/categories").then(m => ({ default: m.CategoriesPage })));
const CheckoutPage      = lazy(() => import("@/pages/checkout").then(m => ({ default: m.CheckoutPage })));
const OrderPage         = lazy(() => import("@/pages/order").then(m => ({ default: m.OrderPage })));
const OrderLookupPage   = lazy(() => import("@/pages/order-lookup").then(m => ({ default: m.OrderLookupPage })));
const AdminPage         = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminPage })));
const LoginPage         = lazy(() => import("@/pages/login").then(m => ({ default: m.LoginPage })));
const SignupPage        = lazy(() => import("@/pages/signup").then(m => ({ default: m.SignupPage })));
const AccountPage       = lazy(() => import("@/pages/account").then(m => ({ default: m.AccountPage })));
const AccountSubPage    = lazy(() => import("@/pages/account-sub").then(m => ({ default: m.AccountSubPage })));
const CreditsPage       = lazy(() => import("@/pages/credits").then(m => ({ default: m.CreditsPage })));
const ActivatePage      = lazy(() => import("@/pages/activate").then(m => ({ default: m.ActivatePage })));
const FrpPage           = lazy(() => import("@/pages/frp").then(m => ({ default: m.FrpPage })));
const IphoneUnlockPage  = lazy(() => import("@/pages/iphone-unlock").then(m => ({ default: m.IphoneUnlockPage })));
const ImeiPage          = lazy(() => import("@/pages/imei").then(m => ({ default: m.ImeiPage })));
const AndroidUnlockPage = lazy(() => import("@/pages/android-unlock").then(m => ({ default: m.AndroidUnlockPage })));
const DirectUnlockPage  = lazy(() => import("@/pages/direct-unlock").then(m => ({ default: m.DirectUnlockPage })));
const GoogleCallbackPage= lazy(() => import("@/pages/google-callback").then(m => ({ default: m.GoogleCallbackPage })));
const GiftCardsPage     = lazy(() => import("@/pages/gift-cards").then(m => ({ default: m.GiftCardsPage })));
const UnlockToolsPage   = lazy(() => import("@/pages/unlock-tools").then(m => ({ default: m.UnlockToolsPage })));
const UnsubscribePage   = lazy(() => import("@/pages/unsubscribe").then(m => ({ default: m.UnsubscribePage })));
const ResellerPage      = lazy(() => import("@/pages/reseller").then(m => ({ default: m.ResellerPage })));
const ResellerStorePage = lazy(() => import("@/pages/reseller-store").then(m => ({ default: m.ResellerStorePage })));
const TermsPage         = lazy(() => import("@/pages/terms").then(m => ({ default: m.TermsPage })));
const PrivacyPage       = lazy(() => import("@/pages/privacy").then(m => ({ default: m.PrivacyPage })));

// ── Minimal route-transition spinner ─────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: "2px solid rgba(14,165,233,0.2)",
        borderTopColor: "#0ea5e9",
        animation: "spin 0.6s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── QueryClient — tuned for mobile: less refetching, longer cache ─────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // data stays fresh for 30 s — no pointless refetch on remount
      gcTime: 5 * 60_000,        // keep unused cache for 5 min so back-navigation is instant
      retry: 1,                   // default is 3 — one retry is enough
      refetchOnWindowFocus: false, // don't refetch when user switches apps on Android
      refetchOnReconnect: true,   // do refetch when network comes back
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Admin — standalone, no layout chrome */}
        <Route path="/admin/:tab" component={AdminPage} />
        <Route path="/admin" component={AdminPage} />

        {/* All other routes share the main layout */}
        <Route>
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/products" component={StorePage} />
                <Route path="/products/:id" component={ProductPage} />
                <Route path="/cart" component={CartPage} />
                <Route path="/categories" component={CategoriesPage} />
                <Route path="/checkout" component={CheckoutPage} />
                <Route path="/orders/lookup" component={OrderLookupPage} />
                <Route path="/orders/:id" component={OrderPage} />
                <Route path="/login" component={LoginPage} />
                <Route path="/signup" component={SignupPage} />
                <Route path="/account" component={AccountPage} />
                <Route path="/account/:sub" component={AccountSubPage} />
                <Route path="/credits" component={CreditsPage} />
                <Route path="/activate" component={ActivatePage} />
                <Route path="/frp" component={FrpPage} />
                <Route path="/iphone-unlock" component={IphoneUnlockPage} />
                <Route path="/android-unlock" component={AndroidUnlockPage} />
                <Route path="/imei" component={ImeiPage} />
                <Route path="/direct-unlock" component={DirectUnlockPage} />
                <Route path="/gift-cards" component={GiftCardsPage} />
                <Route path="/unlock-tools" component={UnlockToolsPage} />
                <Route path="/unsubscribe" component={UnsubscribePage} />
                <Route path="/reseller" component={ResellerPage} />
                <Route path="/store/:slug" component={ResellerStorePage} />
                <Route path="/terms" component={TermsPage} />
                <Route path="/privacy" component={PrivacyPage} />
                <Route path="/auth/google-callback" component={GoogleCallbackPage} />
                <Route>
                  <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                    Page not found
                  </div>
                </Route>
              </Switch>
            </Suspense>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function AppVersionChecker() {
  useAppVersion();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <AuthProvider>
            <TooltipProvider>
              <AppVersionChecker />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
              <SonnerToaster position="top-right" richColors closeButton duration={6000} />
            </TooltipProvider>
          </AuthProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
