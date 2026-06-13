import { Layout } from "@/components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import { Home } from "@/pages/home";
import { StorePage } from "@/pages/store";
import { ProductPage } from "@/pages/product";
import { CartPage } from "@/pages/cart";
import { CategoriesPage } from "@/pages/categories";
import { CheckoutPage } from "@/pages/checkout";
import { OrderPage } from "@/pages/order";
import { AdminPage } from "@/pages/admin";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { AccountPage } from "@/pages/account";
import { AccountSubPage } from "@/pages/account-sub";
import { CreditsPage } from "@/pages/credits";
import { ActivatePage } from "@/pages/activate";
import { FrpPage } from "@/pages/frp";
import { IphoneUnlockPage } from "@/pages/iphone-unlock";
import { ImeiPage } from "@/pages/imei";
import { AndroidUnlockPage } from "@/pages/android-unlock";
import { DirectUnlockPage } from "@/pages/direct-unlock";
import { GoogleCallbackPage } from "@/pages/google-callback";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={AdminPage} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/products" component={StorePage} />
            <Route path="/products/:id" component={ProductPage} />
            <Route path="/cart" component={CartPage} />
            <Route path="/categories" component={CategoriesPage} />
            <Route path="/checkout" component={CheckoutPage} />
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
            <Route path="/auth/google-callback" component={GoogleCallbackPage} />
            <Route>
              <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                Page not found
              </div>
            </Route>
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function AppSetup() {
  const { toast } = useToast();

  useEffect(() => {
    // ── Version check: show "Update App" toast when backend version advances ──
    fetch("/api/version")
      .then((r) => r.json())
      .then(({ version }: { version: string }) => {
        localStorage.setItem("gsm_app_version", version);
      })
      .catch(() => {});

    // ── Install prompt: show "Download App" toast for non-installed users ──
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }
    const installKey = "gsm_install_prompted_v2";
    if (localStorage.getItem(installKey)) {
      return;
    }

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      localStorage.setItem(installKey, "1");
      setTimeout(() => {
        toast({
          title: "📲 Download GSM World App",
          description: "Install for a faster, offline-capable experience.",
          action: (
            <ToastAction
              altText="Install"
              onClick={() => {
                (e as { prompt?: () => void }).prompt?.();
              }}
            >
              Install
            </ToastAction>
          ),
          duration: 12000,
        });
      }, 8000);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt, { once: true } as AddEventListenerOptions);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, [toast]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <AppSetup />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
