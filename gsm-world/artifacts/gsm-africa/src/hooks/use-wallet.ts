import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useWalletBalance() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["wallet-balance", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return 0;
      const data = await res.json() as { balance: number };
      return data.balance;
    },
    staleTime: 30_000,
  });
}
