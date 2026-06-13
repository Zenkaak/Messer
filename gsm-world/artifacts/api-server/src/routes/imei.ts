import { Router, type IRouter } from "express";
import { db, imeiLookupsTable } from "@workspace/db";

const router: IRouter = Router();

// Simple in-memory rate limiter: 10 lookups per IP per minute
const _imeiRateMap = new Map<string, { count: number; resetAt: number }>();
const IMEI_RATE_LIMIT = 10;
const IMEI_RATE_WINDOW_MS = 60_000;

function imeiRateLimitExceeded(ip: string): boolean {
  const now = Date.now();
  const entry = _imeiRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _imeiRateMap.set(ip, { count: 1, resetAt: now + IMEI_RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > IMEI_RATE_LIMIT) return true;
  return false;
}

function luhnCheck(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(imei[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

function detectBrandFromTac(tac: string): { brand: string; manufacturer: string } | null {
  const t = tac.substring(0, 6);
  const t5 = tac.substring(0, 5);
  const t4 = tac.substring(0, 4);
  const t3 = tac.substring(0, 3);

  const RULES: Array<[RegExp, string, string]> = [
    [/^(013[0-9]|014[0-9]|0150|01[5-9][0-9])/, "Apple", "Apple Inc."],
    [/^0[0-9]{1}3[0-9]/, "Apple", "Apple Inc."],
    [/^35267|^35296|^35259|^35845|^35846|^35231|^35277|^35309/, "Samsung", "Samsung Electronics"],
    [/^86195|^86196|^86197|^86868|^86869|^86870|^86148|^86149/, "Samsung", "Samsung Electronics"],
    [/^35378|^35472|^35473|^35474|^35475|^35476|^35477|^35478/, "Apple", "Apple Inc."],
    [/^86191|^86193|^86194|^86451|^86452|^86453|^86455|^86456|^86457/, "Huawei", "Huawei Technologies"],
    [/^86458|^86460|^86461|^86462|^86463|^86464|^86465|^86466/, "Xiaomi", "Xiaomi Corporation"],
    [/^86864|^86865|^86866|^86867/, "Xiaomi", "Xiaomi Corporation"],
    [/^35285|^35325|^35328|^35360|^35480|^35481|^35482/, "Google", "Google LLC"],
    [/^86434|^86435|^86436|^86437/, "Google", "Google LLC"],
    [/^35347|^35348|^35349|^35384|^35385|^35386/, "Nokia", "HMD Global"],
    [/^01209|^35901|^35902|^35903/, "Nokia", "HMD Global"],
    [/^35266|^35339|^35370|^35380|^35381|^35372/, "LG", "LG Electronics"],
    [/^35261|^35299|^35398|^35399|^35400/, "Motorola", "Motorola Solutions"],
    [/^35310|^35325|^35335|^35336|^35337/, "Sony", "Sony Corporation"],
    [/^86140|^86141|^86142|^86143|^86339|^86340/, "OnePlus", "OnePlus Technology"],
    [/^86398|^86399|^86400|^86401|^86402/, "Oppo", "OPPO Electronics"],
    [/^86439|^86440|^86441|^86442/, "Vivo", "Vivo Communication Technology"],
    [/^35246|^35247|^35248|^35249/, "HTC", "HTC Corporation"],
    [/^35284|^35286|^35287|^35288/, "BlackBerry", "BlackBerry Limited"],
  ];

  for (const [pattern, brand, manufacturer] of RULES) {
    if (pattern.test(t) || pattern.test(t5) || pattern.test(t4) || pattern.test(t3)) {
      return { brand, manufacturer };
    }
  }
  return null;
}

// Derive Apple model region from model number suffix
function getAppleModelRegion(model: string | null): { region: string; regionFull: string } | null {
  if (!model) return null;
  const match = model.match(/A\d*?(\d{2})$/i);
  if (!match) return null;
  const suffix = match[1];
  const regionMap: Record<string, { region: string; regionFull: string }> = {
    "88": { region: "Global",        regionFull: "Global (Europe / Asia / Australia)" },
    "89": { region: "Global",        regionFull: "Global (Europe / Asia / Australia)" },
    "90": { region: "Global",        regionFull: "Global (Europe / Asia / Australia)" },
    "91": { region: "Americas",      regionFull: "Americas (USA, Canada, Latin America)" },
    "92": { region: "Americas",      regionFull: "Americas (USA, Canada, Latin America)" },
    "93": { region: "North America", regionFull: "USA (AT&T / Verizon / T-Mobile)" },
    "94": { region: "Japan",         regionFull: "Japan (SoftBank / NTT DoCoMo / au)" },
    "95": { region: "China",         regionFull: "China Mainland" },
    "96": { region: "China",         regionFull: "China Mainland" },
    "97": { region: "China/HK",      regionFull: "China / Hong Kong" },
    "98": { region: "Korea",         regionFull: "South Korea" },
    "99": { region: "Middle East",   regionFull: "Middle East / Africa" },
    "00": { region: "Global",        regionFull: "Global (Unlocked)" },
    "01": { region: "Americas",      regionFull: "Americas (USA, Canada)" },
    "02": { region: "Americas",      regionFull: "Americas (USA, Canada)" },
    "03": { region: "EMEA",          regionFull: "Europe / Middle East / Africa" },
    "04": { region: "Asia Pacific",  regionFull: "Asia Pacific (excl. Japan, China)" },
  };
  return regionMap[suffix] ?? null;
}

// Derive SIM config heuristically from marketingName and brand
function getSimConfig(marketingName: string | null, brand: string | null, model: string | null): string {
  const name = (marketingName || "").toLowerCase();
  const mdl  = (model || "").toLowerCase();

  if (brand === "Apple" || name.includes("iphone")) {
    const genMatch = name.match(/iphone\s*(\d+)/);
    if (genMatch) {
      const gen = parseInt(genMatch[1], 10);
      const isSuffix93 = mdl.match(/A\d*93$/i);
      if (gen >= 14 && isSuffix93) return "eSIM Only";
      if (gen >= 12) return "Nano-SIM + eSIM";
      if (gen === 11) return "Nano-SIM + eSIM";
      return "Nano-SIM";
    }
    return "Nano-SIM + eSIM";
  }

  if (brand === "Samsung" || name.includes("samsung")) {
    if (/s2[0-9]|s3[0-9]|fold|flip|a5[0-9]|a7[0-9]|a8[0-9]/.test(name)) return "nano-SIM + eSIM";
    return "nano-SIM";
  }

  if (brand === "Google" || name.includes("pixel")) {
    if (/pixel\s*[4-9]|pixel\s*[1-9]\d/.test(name)) return "nano-SIM + eSIM";
    return "nano-SIM";
  }

  if (brand === "Huawei" || name.includes("huawei")) {
    if (/p4[0-9]|p5[0-9]|mate [4-9]|mate [1-9]\d/.test(name)) return "nano-SIM + eSIM";
    return "Dual nano-SIM";
  }

  return "nano-SIM";
}

// Normalise SimLock strings from various IMEI check API responses
function normaliseSimLock(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v.includes("unlocked") || v === "unlocked" || v === "0" || v === "no") return "Unlocked";
  if (v.includes("locked") || v === "locked" || v === "1" || v === "yes") return "Locked";
  if (v.includes("clean") || v === "clean") return "Unlocked";
  if (v.includes("blocklisted") || v.includes("blacklisted") || v.includes("lost") || v.includes("stolen")) return "Locked / Blacklisted";
  return raw.trim();
}

// Call IMEI.info API for real SimLock + carrier data
async function fetchImeiInfo(imei: string, apiToken: string): Promise<{
  simLock: string | null;
  carrier: string | null;
  blacklist: string | null;
} | null> {
  try {
    const url = `https://imei.info/api/?api=${encodeURIComponent(apiToken)}&imei=${encodeURIComponent(imei)}&lang=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GSMWorld/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;

    // IMEI.info may nest data under a "data" key or return it flat
    const d = (json.data && typeof json.data === "object" ? json.data : json) as Record<string, unknown>;

    const simLockRaw =
      (d.sim_unlock ?? d.simlock ?? d.network_lock ?? d.sim_lock ?? d.unlock_status ?? d.simLock ?? null) as string | null;
    const carrierRaw =
      (d.network ?? d.carrier ?? d.operator ?? d.network_name ?? null) as string | null;
    const blacklistRaw =
      (d.blacklist ?? d.blacklisted ?? d.lost_stolen ?? d.barring ?? null) as string | null;

    const simLock = normaliseSimLock(simLockRaw);
    const carrier = carrierRaw ? String(carrierRaw).trim() : null;
    const blacklist = blacklistRaw ? String(blacklistRaw).trim() : null;

    if (!simLock && !carrier) return null;
    return { simLock, carrier, blacklist };
  } catch {
    return null;
  }
}

router.get("/imei/lookup", async (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? "unknown";
  if (imeiRateLimitExceeded(clientIp)) {
    res.status(429).json({ error: "Too many IMEI lookups. Please wait a minute and try again." });
    return;
  }

  const imei = typeof req.query.imei === "string" ? req.query.imei.replace(/[\s\-]/g, "") : "";

  if (!/^\d{15}$/.test(imei)) {
    res.status(400).json({ error: "IMEI must be exactly 15 digits." });
    return;
  }

  if (!luhnCheck(imei)) {
    res.status(400).json({ error: "Invalid IMEI — the check digit doesn't match. Please double-check the number." });
    return;
  }

  const tac = imei.slice(0, 8);
  const localDetection = detectBrandFromTac(tac);

  // Load IMEI.info token (optional — enables real SimLock check)
  let imeiInfoToken: string | null = null;
  try {
    const { getImeiInfoApiToken } = await import("../lib/admin-settings");
    imeiInfoToken = await getImeiInfoApiToken();
  } catch { /* not configured — free basic mode */ }

  let brand: string | null = localDetection?.brand ?? null;
  let manufacturer: string | null = localDetection?.manufacturer ?? null;
  let model: string | null = null;
  let marketingName: string | null = null;
  let source = localDetection ? "embedded" : "luhn-only";

  // Step 1: Basic device info from TAC database (always free)
  try {
    const tacRes = await fetch(`https://tacdb.osmocom.org/api/v1/tac/${tac}`, {
      headers: { Accept: "application/json", "User-Agent": "GSMWorld/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (tacRes.ok) {
      const data = await tacRes.json() as {
        manufacturer?: string;
        model?: string;
        brand?: string;
        marketingName?: string;
      };
      brand = data.brand ?? brand;
      manufacturer = data.manufacturer ?? manufacturer;
      model = data.model ?? null;
      marketingName = data.marketingName ?? null;
      source = "tac-db";
    }
  } catch { /* fall through */ }

  // Derive region + SIM config from what we know
  const appleRegion = brand === "Apple" ? getAppleModelRegion(model) : null;
  const simConfig = getSimConfig(marketingName, brand, model);

  // Step 2: IMEI.info for real SimLock (only when API token is configured)
  let simLock = "Carrier check required";
  let carrier: string | null = null;
  let blacklist: string | null = null;
  let enhanced = false;

  if (imeiInfoToken) {
    const info = await fetchImeiInfo(imei, imeiInfoToken);
    if (info) {
      simLock   = info.simLock   ?? simLock;
      carrier   = info.carrier   ?? null;
      blacklist = info.blacklist ?? null;
      enhanced  = true;
    }
  }

  const result = {
    imei,
    tac,
    valid: true,
    manufacturer,
    brand,
    model,
    marketingName,
    source,
    modelRegion:     appleRegion?.region ?? null,
    modelRegionFull: appleRegion?.regionFull ?? null,
    simConfig,
    simLock,
    carrier,
    blacklist,
    enhanced,
    note: !enhanced
      ? "SimLock status requires a carrier-level check. Configure an IMEI.info API token in Admin Settings to enable it."
      : undefined,
  };

  // Log lookup to DB (fire and forget — never fail the response)
  db.insert(imeiLookupsTable).values({
    imei,
    brand,
    model,
    marketingName,
    simLock,
    carrier,
    blacklist,
    enhanced,
    source,
  }).catch(() => { /* ignore DB errors */ });

  res.json(result);
});

export default router;
