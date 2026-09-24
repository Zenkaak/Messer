import { Layout } from "@/components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import { NotificationProvider } from "@/context/notification-context";
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
import { GiftCardsPage } from "@/pages/gift-cards";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Admin — standalone, no layout chrome */}
      <Route path="/admin" component={AdminPage} />

      {/* All other routes share the main layout */}
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
            <Route path="/gift-cards" component={GiftCardsPage} />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
