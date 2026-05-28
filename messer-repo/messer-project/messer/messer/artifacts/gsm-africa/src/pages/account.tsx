import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import {
  User, BarChart2, ShoppingBag, ShoppingCart, Zap,
  UserCircle, ShieldCheck, Cpu, DollarSign, FileText,
  BookOpen, LogOut, ChevronRight, Plus, Server, KeyRound,
  Gift,
} from "lucide-react";

export function AccountPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: balance = 0 } = useWalletBalance();

  function handleLogout() {
    logout();
    toast({ title: "Signed out successfully" });
    navigate("/");
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0f1923]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/10 flex items-center justify-center mb-6">
            <User size={36} className="text-white/60" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Welcome Back</h2>
          <p className="text-white/40 text-sm text-center max-w-[240px] mb-8">
            Sign in to manage your orders, wallet &amp; account settings
          </p>
          <div className="w-full max-w-xs space-y-3">
            <Link href="/login">
              <button className="w-full py-4 text-base font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-colors shadow-lg shadow-blue-900/40">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button className="w-full py-4 text-base font-bold border border-white/15 rounded-2xl bg-white/5 text-white/80 hover:bg-white/10 transition-colors mt-1">
                Create Account
              </button>
            </Link>
          </div>
          <p className="text-center text-xs text-white/20 mt-8">
            Trusted by thousands of customers worldwide · Since 2016
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const memberSince = user ? new Date().getFullYear() : null;

  return (
    <div className="flex flex-col min-h-full bg-[#f0f2f5] pb-10">

      {/* Profile hero */}
      <div style={{ background: "linear-gradient(160deg,#0f1923 0%,#1a3a5c 100%)" }} className="px-5 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #60a5fa 0%, transparent 60%)" }} />
        <div className="relative flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-900/40 shrink-0">
            <span className="text-white font-black text-xl">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg leading-tight truncate">{displayName}</p>
            <p className="text-blue-300/50 text-xs mt-0.5 truncate">{user?.email}</p>
            {memberSince && (
              <span className="inline-flex items-center gap-1 mt-1.5 bg-white/10 border border-white/10 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-[10px] text-green-300 font-semibold">Active Member · {memberSince}</span>
              </span>
            )}
          </div>
          <Link href="/account/profile">
            <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 hover:bg-white/20 transition-colors">
              <span className="text-white text-xs font-bold">Edit</span>
            </div>
          </Link>
        </div>

        {/* Wallet card */}
        <div className="relative bg-white/8 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-widest">GSM Wallet</p>
              <p className="text-white font-black text-3xl leading-none mt-1">
                ${balance.toFixed(2)}
              </p>
              <p className="text-blue-300/40 text-[11px] mt-1">Available USD Balance</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
              <DollarSign size={18} className="text-blue-300" />
            </div>
          </div>
          <Link href="/account/add-fund">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              <Plus size={14} strokeWidth={3} /> Top Up Wallet
            </button>
          </Link>
        </div>
      </div>

      {/* Quick actions grid */}
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Quick Access</p>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: <ShoppingBag size={20} />, label: "Orders", href: "/account/orders", color: "from-indigo-500 to-indigo-700" },
            { icon: <BarChart2 size={20} />, label: "Dashboard", href: "/account/dashboard", color: "from-blue-500 to-blue-700" },
            { icon: <Gift size={20} />, label: "Gift Cards", href: "/gift-cards", color: "from-pink-500 to-rose-600" },
            { icon: <Zap size={20} />, label: "Express", href: "/account/express-order", color: "from-orange-500 to-orange-700" },
          ].map(item => (
            <Link href={item.href} key={item.label}>
              <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-sm`}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-bold text-gray-600 text-center leading-tight">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 pt-3 space-y-3">

        {/* Orders & Services */}
        <MenuSection title="Orders & Services">
          <MenuItem icon={<ShoppingBag size={16} />} iconCls="bg-indigo-100 text-indigo-600"  label="My Orders"       sub="Track & manage your orders"     href="/account/orders" />
          <MenuItem icon={<ShoppingCart size={16} />} iconCls="bg-cyan-100 text-cyan-600"   label="Bulk Order"       sub="Order multiple services at once"  href="/account/bulk-order" />
          <MenuItem icon={<Zap size={16} />}         iconCls="bg-orange-100 text-orange-600" label="Express Order"   sub="Priority processing"              href="/account/express-order" />
          <MenuItem icon={<Server size={16} />}       iconCls="bg-teal-100 text-teal-600"    label="Server Credits"   sub="Manage compute credits"           href="/credits" />
          <MenuItem icon={<KeyRound size={16} />}     iconCls="bg-amber-100 text-amber-600"  label="Tool Activation"  sub="Activate GSM tools & services"    href="/activate" />
        </MenuSection>

        {/* Billing */}
        <MenuSection title="Billing">
          <MenuItem icon={<DollarSign size={16} />} iconCls="bg-emerald-100 text-emerald-600" label="Add Funds"      sub="Top up your wallet balance"       href="/account/add-fund" />
          <MenuItem icon={<FileText size={16} />}   iconCls="bg-yellow-100 text-yellow-600"   label="Invoices"       sub="Download receipts & invoices"      href="/account/invoices" />
          <MenuItem icon={<BookOpen size={16} />}   iconCls="bg-pink-100 text-pink-600"       label="Account Ledger" sub="View all transactions"             href="/account/ledger" />
        </MenuSection>

        {/* Account Settings */}
        <MenuSection title="Settings">
          <MenuItem icon={<UserCircle size={16} />}  iconCls="bg-gray-100 text-gray-600"     label="Profile"           sub="Name, photo & preferences"       href="/account/profile" />
          <MenuItem icon={<ShieldCheck size={16} />} iconCls="bg-green-100 text-green-600"   label="Security"          sub="Password & account security"     href="/account/security" />
          <MenuItem icon={<Cpu size={16} />}         iconCls="bg-purple-100 text-purple-600" label="API Settings"      sub="API keys & developer tools"      href="/account/api" />
        </MenuSection>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full h-12 flex items-center justify-center gap-2 font-bold text-red-600 border border-red-100 rounded-2xl bg-white hover:bg-red-50 transition-colors shadow-sm"
        >
          <LogOut size={16} />
          Sign Out
        </button>

        <p className="text-center text-[10px] text-gray-300 pb-2">GSM World · Official Distributor Since 2016</p>
      </div>
    </div>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">{title}</p>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  icon, iconCls, label, sub, href,
}: {
  icon: React.ReactNode;
  iconCls: string;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors">
      <div className={`w-9 h-9 rounded-xl ${iconCls} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-800 text-[13px] font-bold leading-tight">{label}</p>
        <p className="text-gray-400 text-[11px] mt-0.5 truncate">{sub}</p>
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </Link>
  );
}
