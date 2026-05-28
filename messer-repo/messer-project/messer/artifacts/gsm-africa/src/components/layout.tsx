import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Home, Grid, ShoppingCart, User, Search, Menu, Tag, X, Phone, Cpu, Lock, Server, Zap, Gift, Wallet, ChevronRight, Wrench, ChevronDown } from "lucide-react";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/notification-bell";
import { GsmBot } from "@/components/gsm-bot";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: cart } = useGetCart();
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const cartItemCount = cart?.itemCount || 0;
  const queryClient = useQueryClient();
  const prevAuthRef = useRef(isAuthenticated);

  // Invalidate cart cache when user logs in so guest cart items appear immediately
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }, 600);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, queryClient]);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      {/* ── Mobile Sidebar Drawer ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[100] flex md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-72 max-w-[85vw] bg-[#f8fafc] h-full flex flex-col shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar header */}
            <div className="bg-[#1a2332] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-sm">G</span>
                </div>
                <div>
                  <p className="font-black text-base leading-tight">GSM World</p>
                  <p className="text-[10px] text-teal-300/80 leading-tight font-medium">Trusted Since 2016</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 py-3 space-y-0.5 px-3">
              {/* Shop section */}
              <p className="px-2 pt-2 pb-1 text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Shop</p>
              <SideLink
                href={`${basePath}/`} icon={<Home size={16} />} label="Home"
                onClick={() => setSidebarOpen(false)} active={location === "/"}
                iconBg="bg-blue-100 text-blue-600"
              />
              <SideLink
                href={`${basePath}/products`} icon={<Tag size={16} />} label="All Products"
                onClick={() => setSidebarOpen(false)} active={location === "/products"}
                iconBg="bg-indigo-100 text-indigo-600"
              />
              <SideLink
                href={`${basePath}/categories`} icon={<Grid size={16} />} label="Categories"
                onClick={() => setSidebarOpen(false)} active={location === "/categories"}
                iconBg="bg-violet-100 text-violet-600"
              />
              <SideLink
                href={`${basePath}/gift-cards`} icon={<Gift size={16} />} label="Gift Cards"
                onClick={() => setSidebarOpen(false)} active={location === "/gift-cards"}
                iconBg="bg-pink-100 text-pink-600"
              />

              {/* Services section */}
              <p className="px-2 pt-4 pb-1 text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Services</p>
              <SideLink
                href={`${basePath}/credits`} icon={<Server size={16} />} label="Server Credits"
                onClick={() => setSidebarOpen(false)} active={location === "/credits"}
                iconBg="bg-cyan-100 text-cyan-700"
              />
              <SideLink
                href={`${basePath}/activate`} icon={<Zap size={16} />} label="Tool Activation"
                onClick={() => setSidebarOpen(false)} active={location === "/activate"}
                iconBg="bg-yellow-100 text-yellow-700"
              />
              <SideLink
                href={`${basePath}/direct-unlock`} icon={<Phone size={16} />} label="iPhone / Android Unlock"
                onClick={() => setSidebarOpen(false)} active={location === "/direct-unlock" || location === "/iphone-unlock" || location === "/android-unlock"}
                iconBg="bg-teal-100 text-teal-700"
                badge="HOT"
              />
              <SideLink
                href={`${basePath}/frp`} icon={<Lock size={16} />} label="FRP Bypass"
                onClick={() => setSidebarOpen(false)} active={location === "/frp"}
                iconBg="bg-red-100 text-red-600"
              />
              <SideLink
                href={`${basePath}/imei`} icon={<Cpu size={16} />} label="IMEI Services"
                onClick={() => setSidebarOpen(false)} active={location === "/imei"}
                iconBg="bg-orange-100 text-orange-600"
              />

              {/* Unlock Tool Rentals section */}
              <p className="px-2 pt-4 pb-1 text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Unlock Tool Rentals</p>
              <div className={`flex items-center gap-0 rounded-xl transition-colors ${location.startsWith("/unlock-tools") ? "bg-[#1a2332]/10 text-[#1a2332]" : "text-gray-700 hover:bg-gray-100"}`}>
                <Link
                  href={`${basePath}/unlock-tools`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Wrench size={14} />
                  </div>
                  <span className="flex-1 text-[12.5px] font-bold">All Unlock Tools</span>
                  <span className="text-[9px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full">26</span>
                </Link>
                <button
                  onClick={() => setToolsExpanded((v) => !v)}
                  className="px-2 py-2.5 hover:bg-gray-200 rounded-r-xl"
                  aria-label="Expand tools list"
                >
                  <ChevronDown size={13} className={`text-gray-400 transition-transform ${toolsExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>

              {toolsExpanded && (
                <div className="ml-3 pl-3 border-l-2 border-indigo-100 space-y-0 mt-0.5">
                  {[
                    { id: "ultra-tool", name: "Ultra Tool", cat: "Samsung" },
                    { id: "z3x-samsung", name: "Z3X Samsung Tool Pro", cat: "Samsung" },
                    { id: "chimera-tool", name: "Chimera Tool", cat: "Samsung" },
                    { id: "octoplus-samsung", name: "Octoplus Samsung", cat: "Samsung" },
                    { id: "locksmith-pro", name: "LockSmith Pro", cat: "Samsung" },
                    { id: "bmt-pro", name: "BMT Pro", cat: "Samsung" },
                    { id: "gsm-flasher", name: "GSM Flasher Tool", cat: "Samsung" },
                    { id: "samkey-tmf", name: "SamKey TMF", cat: "Samsung" },
                    { id: "nc-auth", name: "NC Auth Server", cat: "iPhone" },
                    { id: "iremoval-pro", name: "iRemoval Pro", cat: "iPhone" },
                    { id: "iactivate-server", name: "iActivate Server", cat: "iPhone" },
                    { id: "3utools", name: "3uTools", cat: "iPhone" },
                    { id: "passfab-activation", name: "PassFab Unlocker", cat: "iPhone" },
                    { id: "4ukey", name: "Tenorshare 4uKey", cat: "iPhone" },
                    { id: "unlockgo", name: "UnlockGo", cat: "iPhone" },
                    { id: "multiunlock", name: "Multiunlock Server", cat: "Android" },
                    { id: "eft-pro", name: "EFT Pro", cat: "Android" },
                    { id: "sigma-software", name: "Sigma Software", cat: "Android" },
                    { id: "dr-fone-unlock", name: "Dr.Fone Unlock", cat: "Android" },
                    { id: "fonegeek", name: "FoneGeek Unlock", cat: "Android" },
                    { id: "imyfone-lockwiper", name: "iMyFone LockWiper", cat: "Android" },
                    { id: "xiaomi-unlock", name: "Xiaomi Unlock Server", cat: "Android" },
                    { id: "huawei-server", name: "Huawei Unlock Server", cat: "Android" },
                    { id: "frp-tool-pro", name: "FRP Tool Pro", cat: "FRP" },
                    { id: "easy-frp", name: "Easy FRP Bypass", cat: "FRP" },
                    { id: "android-mdm", name: "Android MDM Bypass", cat: "FRP" },
                  ].map((tool) => (
                    <Link
                      key={tool.id}
                      href={`${basePath}/unlock-tools?tool=${tool.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left w-full group ${location === "/unlock-tools" ? "text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"}`}
                    >
                      <span className={`text-[8px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${
                        tool.cat === "Samsung" ? "bg-blue-100 text-blue-600" :
                        tool.cat === "iPhone" ? "bg-gray-100 text-gray-600" :
                        tool.cat === "Android" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-600"
                      }`}>{tool.cat}</span>
                      <span className="text-[11px] font-semibold truncate">{tool.name}</span>
                      <span className="ml-auto text-[8px] text-green-600 font-bold shrink-0">$3+</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Account section */}
              <p className="px-2 pt-4 pb-1 text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Account</p>
              {isAuthenticated ? (
                <>
                  <SideLink
                    href={`${basePath}/account`} icon={<User size={16} />} label="My Account"
                    onClick={() => setSidebarOpen(false)} active={location === "/account"}
                    iconBg="bg-blue-100 text-blue-600"
                  />
                  <SideLink
                    href={`${basePath}/account/add-fund`} icon={<Wallet size={16} />} label="Add Funds"
                    onClick={() => setSidebarOpen(false)} active={location === "/account/add-fund"}
                    iconBg="bg-green-100 text-green-600"
                  />
                </>
              ) : (
                <SideLink
                  href={`${basePath}/login`} icon={<User size={16} />} label="Sign In / Register"
                  onClick={() => setSidebarOpen(false)} active={location === "/login"}
                  iconBg="bg-blue-100 text-blue-600"
                />
              )}
            </nav>

            {/* Cart quick-link */}
            {cartItemCount > 0 && (
              <div className="px-3 pb-3 shrink-0">
                <Link
                  href={`${basePath}/cart`}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 bg-[#1a2332] text-white rounded-2xl px-4 py-3 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShoppingCart size={15} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black leading-none">View Cart</p>
                    <p className="text-[10px] text-blue-300/70 mt-0.5">{cartItemCount} item{cartItemCount !== 1 ? "s" : ""} waiting</p>
                  </div>
                  <ChevronRight size={15} className="text-white/40" />
                </Link>
              </div>
            )}

            <div className="px-4 pb-4 pt-1 border-t border-gray-200 shrink-0">
              <p className="text-[10px] text-gray-400 text-center">Official distributor for major tool teams since 2016</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#1a2332] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-white/10 rounded-md transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
            <Link href={`${basePath}/`} className="flex flex-col">
              <span className="font-black text-lg leading-tight tracking-tight text-white hover:text-teal-400 transition-colors">
                GSM WORLD
              </span>
              <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold hidden sm:block">
                www.gsmworld.com | Since 2016
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <DesktopNavLink href={`${basePath}/`} label="Home" active={location === "/"} />
            <DesktopNavLink href={`${basePath}/products`} label="Store" active={location.startsWith("/products")} />
            <DesktopNavLink href={`${basePath}/categories`} label="Categories" active={location === "/categories"} />

            <div className="w-px h-5 bg-white/20 mx-1" />

            <DesktopNavLink href={`${basePath}/credits`} label="Credits" active={location === "/credits"} />
            <DesktopNavLink href={`${basePath}/activate`} label="Activation" active={location === "/activate"} />
            <DesktopNavLink href={`${basePath}/direct-unlock`} label="Unlock" active={location === "/direct-unlock" || location === "/iphone-unlock" || location === "/android-unlock"} />
            <DesktopNavLink href={`${basePath}/frp`} label="FRP" active={location === "/frp"} />
            <DesktopNavLink href={`${basePath}/imei`} label="IMEI" active={location === "/imei"} />
            <DesktopNavLink href={`${basePath}/gift-cards`} label="Gift Cards" active={location === "/gift-cards"} />
            <DesktopNavLink href={`${basePath}/unlock-tools`} label="Rentals" active={location.startsWith("/unlock-tools")} />
          </nav>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Search">
              <Search size={18} />
            </button>
            <NotificationBell />

            <Link href={`${basePath}/cart`} className="relative p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Cart">
              <ShoppingCart size={18} />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#1a2332]">
                  {cartItemCount > 9 ? "9+" : cartItemCount}
                </span>
              )}
            </Link>

            <Link
              href={isAuthenticated ? `${basePath}/account` : `${basePath}/login`}
              className="hidden md:flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <User size={14} />
              {isAuthenticated ? "Account" : "Sign In"}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>

      {/* ── Desktop Footer ── */}
      <footer className="hidden md:block bg-[#1a2332] text-white mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-4 gap-8 mb-8">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
                  <span className="text-white font-black text-sm">G</span>
                </div>
                <span className="font-black text-lg">GSM World</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Worldwide source for unlock tools, server credits &amp; GSM services. Trusted since 2016.
              </p>
              <div className="flex gap-3">
                <a href="https://wa.me/254756816951" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
                <a href="https://t.me/markjsbb" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </a>
              </div>
            </div>

            <div>
              <p className="font-bold text-sm mb-4 text-gray-200 uppercase tracking-wider">Shop</p>
              <ul className="space-y-2.5">
                {[
                  { label: "All Products", href: `${basePath}/products` },
                  { label: "Categories", href: `${basePath}/categories` },
                  { label: "Server Credits", href: `${basePath}/credits` },
                  { label: "Tool Activation", href: `${basePath}/activate` },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-gray-400 hover:text-teal-400 text-sm transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-bold text-sm mb-4 text-gray-200 uppercase tracking-wider">Services</p>
              <ul className="space-y-2.5">
                {[
                  { label: "iPhone / iCloud Unlock", href: `${basePath}/iphone-unlock` },
                  { label: "Android Unlock", href: `${basePath}/android-unlock` },
                  { label: "FRP Bypass", href: `${basePath}/frp` },
                  { label: "IMEI Services", href: `${basePath}/imei` },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-gray-400 hover:text-teal-400 text-sm transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-bold text-sm mb-4 text-gray-200 uppercase tracking-wider">Account</p>
              <ul className="space-y-2.5">
                {[
                  { label: "Sign In", href: `${basePath}/login` },
                  { label: "Register", href: `${basePath}/signup` },
                  { label: "My Account", href: `${basePath}/account` },
                  { label: "My Orders", href: `${basePath}/account/orders` },
                  { label: "My Cart", href: `${basePath}/cart` },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-gray-400 hover:text-teal-400 text-sm transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex items-center justify-between">
            <p className="text-gray-500 text-xs">© {new Date().getFullYear()} GSM World. All rights reserved. Official distributor for major tool teams.</p>
            <div className="flex items-center gap-4">
              <span className="text-gray-500 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                Online &amp; Ready to Help
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── GSMBot AI Chat Widget ── */}
      <GsmBot />

      {/* ── Mobile Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-between items-center px-2 py-2 z-50 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <NavItem href={`${basePath}/`} icon={<Home size={22} />} label="Home" active={location === "/"} />
        <NavItem href={`${basePath}/categories`} icon={<Grid size={22} />} label="Categories" active={location === "/categories"} />
        <NavItem href={`${basePath}/products`} icon={<Tag size={22} />} label="Store" active={location.startsWith("/products")} />
        <NavItem href={`${basePath}/cart`} icon={<ShoppingCart size={22} />} label="Cart" active={location === "/cart"} badge={cartItemCount} />
        <NavItem
          href={isAuthenticated ? `${basePath}/account` : `${basePath}/login`}
          icon={<User size={22} />}
          label={isAuthenticated ? "Account" : "Sign In"}
          active={location === "/account" || location === "/login" || location === "/signup"}
        />
      </nav>
    </div>
  );
}

function DesktopNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function SideLink({
  href, icon, label, onClick, active, iconBg, badge,
}: {
  href: string; icon: React.ReactNode; label: string;
  onClick: () => void; active: boolean; iconBg: string; badge?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
        active
          ? "bg-[#1a2332] text-white shadow-sm"
          : "text-gray-700 hover:bg-white hover:shadow-sm"
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? "bg-white/20" : iconBg}`}>
        {icon}
      </div>
      <span className={`font-semibold text-sm flex-1 leading-none ${active ? "text-white" : "text-gray-700"}`}>{label}</span>
      {badge && (
        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
          badge === "HOT" ? "bg-red-500 text-white" : active ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
        }`}>
          {badge}
        </span>
      )}
      {!badge && <ChevronRight size={12} className={active ? "text-white/50" : "text-gray-300 group-hover:text-gray-400"} />}
    </Link>
  );
}

function NavItem({ href, icon, label, active, badge }: { href: string; icon: React.ReactNode; label: string; active: boolean; badge?: number }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center w-full py-1 gap-1 relative transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
