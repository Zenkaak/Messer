import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import {
  User, BarChart2, ShoppingBag, ShoppingCart, Zap,
  UserCircle, ShieldCheck, Cpu, DollarSign, FileText,
  BookOpen, LogOut, ChevronRight, Plus, Server, KeyRound, Store, Shield,
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
      <div className="flex flex-col min-h-[80vh] bg-white">
        {/* Dark top section */}
        <div
          className="flex flex-col items-center justify-center pt-14 pb-10 px-6 text-center"
          style={{ background: "linear-gradient(160deg,#1a2332 0%,#1e3a5f 100%)" }}
        >
          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4">
            <User size={36} className="text-white/70" />
          </div>
          <h2 className="text-xl font-black text-white mb-1">Your Account</h2>
          <p className="text-blue-300/70 text-sm max-w-[240px]">
            Sign in to manage orders, wallet &amp; settings
          </p>
        </div>

        <div className="px-5 pt-6 pb-8 space-y-3">
          <Link href="/login">
            <button className="w-full h-13 py-3.5 text-base font-black bg-[#1a2332] text-white rounded-2xl shadow-lg">
              Sign In
            </button>
          </Link>
          <Link href="/signup">
            <button className="w-full h-13 py-3.5 text-base font-bold border-2 border-gray-200 rounded-2xl bg-white text-gray-800 mt-1">
              Create Account
            </button>
          </Link>
          <p className="text-center text-xs text-gray-400 pt-2">
            Join thousands of satisfied customers worldwide
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-10">

      {/* Profile hero */}
      <div
        className="px-5 pt-7 pb-6"
        style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
            <span className="text-white font-black text-xl">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-[17px] leading-tight truncate">{displayName}</p>
            <p className="text-blue-300/60 text-xs mt-0.5 truncate">{user?.email}</p>
          </div>
          <Link href="/account/profile">
            <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
              <span className="text-white text-xs font-bold">Edit</span>
            </div>
          </Link>
        </div>

        {/* Wallet card */}
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-blue-300/70 text-[10px] font-semibold uppercase tracking-widest">Wallet Balance</p>
              <p className="text-white font-black text-2xl leading-none mt-0.5">
                ${balance.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-blue-300/50 text-[10px]">GSM World · USD</p>
              <span className="inline-flex items-center gap-1 mt-1 text-green-300 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Active
              </span>
            </div>
          </div>
          <Link href="/account/add-fund">
            <button className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              <Plus size={14} strokeWidth={3} /> Add Funds
            </button>
          </Link>
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 pt-4 space-y-3">

        {/* Orders section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Orders</p>
          <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
            <MenuItem icon={<BarChart2 size={17} />} iconBg="bg-blue-100 text-blue-600"  label="Dashboard"     href="/account/dashboard" />
            <MenuItem icon={<ShoppingBag size={17} />} iconBg="bg-indigo-100 text-indigo-600" label="My Orders" href="/account/orders" />
            <MenuItem icon={<ShoppingCart size={17} />} iconBg="bg-cyan-100 text-cyan-600" label="Bulk Order"  href="/account/bulk-order" />
            <MenuItem icon={<Zap size={17} />} iconBg="bg-orange-100 text-orange-600"    label="Express Order" href="/account/express-order" />
          </div>
        </div>

        {/* Account section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Account</p>
          <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
            <MenuItem icon={<UserCircle size={17} />}  iconBg="bg-gray-100 text-gray-600"   label="Profile"          href="/account/profile" />
            <MenuItem icon={<ShieldCheck size={17} />} iconBg="bg-green-100 text-green-600" label="Account Security" href="/account/security" />
            <MenuItem icon={<Cpu size={17} />}         iconBg="bg-purple-100 text-purple-600" label="API Settings"   href="/account/api" />
          </div>
        </div>

        {/* Services section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Services</p>
          <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
            <MenuItem icon={<Server size={17} />}   iconBg="bg-orange-100 text-orange-600"  label="Server Credits"   href="/credits" />
            <MenuItem icon={<KeyRound size={17} />} iconBg="bg-amber-100 text-amber-600"    label="Tool Activation"  href="/activate" />
          </div>
        </div>

        {/* Earn section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Earn Money</p>
          <Link href="/reseller" className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl shadow-sm overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Store size={17} className="text-white" />
            </div>
            <div className="flex-1">
              <span className="text-white text-[14px] font-black block leading-tight">Reseller Program</span>
              <span className="text-teal-100 text-[11px] font-medium">Earn 10% commission on every sale</span>
            </div>
            <ChevronRight size={15} className="text-white/60" />
          </Link>
        </div>

        {/* Billing section */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Billing</p>
          <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
            <MenuItem icon={<DollarSign size={17} />} iconBg="bg-emerald-100 text-emerald-600" label="Add Fund"       href="/account/add-fund" />
            <MenuItem icon={<FileText size={17} />}   iconBg="bg-yellow-100 text-yellow-600"   label="Invoices"       href="/account/invoices" />
            <MenuItem icon={<BookOpen size={17} />}   iconBg="bg-pink-100 text-pink-600"       label="Account Ledger" href="/account/ledger" />
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full h-12 flex items-center justify-center gap-2 font-bold text-red-600 border border-red-100 rounded-2xl bg-white hover:bg-red-50 transition-colors shadow-sm mt-1"
        >
          <LogOut size={17} />
          Sign Out
        </button>

        {/* Admin Panel link */}
        <Link href="/admin" className="w-full h-10 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <Shield size={13} />
          Admin Panel
        </Link>

        <p className="text-center text-[10px] text-gray-300 pb-2">GSM World · Since 2016</p>
      </div>
    </div>
  );
}

function MenuItem({
  icon, iconBg, label, href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors">
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <span className="text-gray-800 text-[14px] font-semibold flex-1">{label}</span>
      <ChevronRight size={15} className="text-gray-300" />
    </Link>
  );
}
