import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GH_API = "https://api.github.com/repos/Zenkaak/Messer";
const GH_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "";
const GH_HEADERS: Record<string, string> = {
  "User-Agent": "GSMWorld/1.0",
  Accept: "application/vnd.github.v3+json",
  ...(GH_TOKEN ? { Authorization: `token ${GH_TOKEN}` } : {}),
};

interface GhAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  state: string;
}
interface GhRelease {
  tag_name: string;
  assets?: GhAsset[];
}

interface CachedAsset {
  id: number;
  url: string;
}

interface CachedAdminAsset {
  id: number;
  tag: string;
  url: string;
}

// 1-minute in-memory cache so rapid HEAD + GET don't hit the API twice.
let cachedAsset: CachedAsset | null = null;
let cacheExpiry = 0;

let cachedAdminAsset: CachedAdminAsset | null = null;
let adminCacheExpiry = 0;

// ── User APK (GSMWorld.apk) lookup ────────────────────────────────────────────
// Searches for GSMWorld.apk by fetching the "latest"-tagged release directly.
// Falls back to scanning the first 100 releases if the tag lookup fails.
// Skips admin-apk-* releases so they never interfere with user downloads.
async function getApkAsset(): Promise<CachedAsset | null> {
  const now = Date.now();
  if (now < cacheExpiry) return cachedAsset;

  try {
    const tagRes = await fetch(`${GH_API}/releases/tags/latest`, {
      headers: GH_HEADERS,
    });
    if (tagRes.ok) {
      const release = (await tagRes.json()) as GhRelease;
      const asset = release.assets?.find(
        (a) => a.name === "GSMWorld.apk" && a.state === "uploaded",
      );
      if (asset) {
        cachedAsset = { id: asset.id, url: asset.browser_download_url };
        cacheExpiry = now + 60_000;
        return cachedAsset;
      }
    }

    const listRes = await fetch(`${GH_API}/releases?per_page=100`, {
      headers: GH_HEADERS,
    });
    if (!listRes.ok) {
      cachedAsset = null;
      cacheExpiry = now + 30_000;
      return null;
    }
    const releases = (await listRes.json()) as GhRelease[];
    for (const release of releases) {
      if (release.tag_name?.startsWith("admin-apk-")) continue;
      const asset = release.assets?.find(
        (a) => a.name === "GSMWorld.apk" && a.state === "uploaded",
      );
      if (asset) {
        cachedAsset = { id: asset.id, url: asset.browser_download_url };
        cacheExpiry = now + 60_000;
        return cachedAsset;
      }
    }

    cachedAsset = null;
    cacheExpiry = now + 60_000;
    return null;
  } catch {
    cachedAsset = null;
    cacheExpiry = now + 30_000;
    return null;
  }
}

// ── Admin APK lookup ──────────────────────────────────────────────────────────
// Finds the latest admin-apk-* release and returns its first .apk asset.
async function getAdminApkAsset(): Promise<CachedAdminAsset | null> {
  const now = Date.now();
  if (now < adminCacheExpiry) return cachedAdminAsset;

  try {
    const listRes = await fetch(`${GH_API}/releases?per_page=20`, {
      headers: GH_HEADERS,
    });
    if (!listRes.ok) {
      cachedAdminAsset = null;
      adminCacheExpiry = now + 30_000;
      return null;
    }
    const releases = (await listRes.json()) as GhRelease[];
    for (const release of releases) {
      if (!release.tag_name?.startsWith("admin-apk-")) continue;
      const asset = release.assets?.find(
        (a) => a.name.endsWith(".apk") && a.state === "uploaded",
      );
      if (asset) {
        cachedAdminAsset = { id: asset.id, tag: release.tag_name, url: asset.browser_download_url };
        adminCacheExpiry = now + 60_000;
        return cachedAdminAsset;
      }
    }
    cachedAdminAsset = null;
    adminCacheExpiry = now + 60_000;
    return null;
  } catch {
    cachedAdminAsset = null;
    adminCacheExpiry = now + 30_000;
    return null;
  }
}

// ── Shared streaming helper ───────────────────────────────────────────────────
// Uses the GitHub API asset endpoint to get a pre-signed CDN URL, then streams
// the binary without any auth header (S3 rejects requests that carry Authorization).
async function streamGhAsset(
  assetId: number,
  filename: string,
  res: import("express").Response,
) {
  const apiAssetUrl = `${GH_API}/releases/assets/${assetId}`;
  let cdnUrl: string;
  try {
    const r1 = await fetch(apiAssetUrl, {
      headers: {
        "User-Agent": "GSMWorld/1.0",
        Accept: "application/octet-stream",
        ...(GH_TOKEN ? { Authorization: `token ${GH_TOKEN}` } : {}),
      },
      redirect: "manual",
    });

    const loc = r1.headers.get("location");
    if (!loc) {
      if (r1.ok && r1.body) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-store");
        const cl = r1.headers.get("content-length");
        if (cl) res.setHeader("Content-Length", cl);
        const { Readable } = await import("stream");
        Readable.fromWeb(r1.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
        return;
      }
      res.status(502).json({ error: `GitHub API returned ${r1.status} with no redirect` });
      return;
    }
    cdnUrl = loc;
  } catch (err) {
    res.status(502).json({ error: "Failed to reach GitHub API", detail: String(err) });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(cdnUrl, {
      headers: { "User-Agent": "GSMWorld/1.0" },
      redirect: "follow",
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach CDN", detail: String(err) });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    res.status(502).json({ error: `CDN returned ${upstream.status}` });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  const cl = upstream.headers.get("content-length");
  if (cl) res.setHeader("Content-Length", cl);

  const { Readable } = await import("stream");
  Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
}

// ── User APK routes ───────────────────────────────────────────────────────────

// HEAD — tells the frontend whether the user APK is available.
// Blocked for admin app UA so admins can't accidentally pull the user APK.
router.head("/download/apk", async (req, res) => {
  if (req.headers["user-agent"]?.includes("GSMAdminApp")) {
    res.status(403).end();
    return;
  }
  const asset = await getApkAsset();
  res.status(asset ? 200 : 503).end();
});

// GET — stream GSMWorld.apk.
// Blocked for admin app UA: admins must use /download/admin-apk instead.
router.get("/download/apk", async (req, res) => {
  if (req.headers["user-agent"]?.includes("GSMAdminApp")) {
    res.status(403).json({ error: "Admin app must use /api/download/admin-apk" });
    return;
  }
  const asset = await getApkAsset();
  if (!asset) {
    res.status(503).json({ error: "APK not available yet. Please try again later." });
    return;
  }
  await streamGhAsset(asset.id, "GSMWorld.apk", res);
});

// ── Admin APK routes ──────────────────────────────────────────────────────────

// GET /download/admin-apk-version
// Public version-check endpoint called by the admin Android app to detect
// updates without needing to hit the GitHub API directly. Returns the latest
// admin-apk-* tag so the app can compare against BuildConfig.APK_TAG.
router.get("/download/admin-apk-version", async (_req, res) => {
  const asset = await getAdminApkAsset();
  if (!asset) {
    res.status(503).json({ error: "No admin APK release found" });
    return;
  }
  res.json({ tag: asset.tag });
});

// GET /download/admin-apk
// Streams the latest signed admin APK through the server.
// Restricted to requests from the admin Android app (GSMAdminApp UA) so
// regular users can never accidentally receive or install the admin APK.
// Also accepts x-admin-password for manual testing via a browser.
router.get("/download/admin-apk", async (req, res) => {
  const ua = req.headers["user-agent"] ?? "";
  const adminPwd = req.headers["x-admin-password"];
  const { getAdminPassword } = await import("../lib/admin-settings");
  const correctPwd = await getAdminPassword();

  const isAdminApp = ua.includes("GSMAdminApp");
  const isAdminBrowser = adminPwd && adminPwd === correctPwd;

  if (!isAdminApp && !isAdminBrowser) {
    res.status(403).json({ error: "Forbidden: admin APK is not available to user accounts" });
    return;
  }

  const asset = await getAdminApkAsset();
  if (!asset) {
    res.status(503).json({ error: "No admin APK release found. Build may still be in progress." });
    return;
  }
  await streamGhAsset(asset.id, "gsm-admin-latest.apk", res);
});

export default router;
