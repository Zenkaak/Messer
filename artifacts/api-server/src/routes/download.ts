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

// 1-minute in-memory cache so rapid HEAD + GET don't hit the API twice.
let cachedAsset: CachedAsset | null = null;
let cacheExpiry = 0;

// Searches for GSMWorld.apk by fetching the "latest"-tagged release directly.
// Falls back to scanning the first 100 releases if the tag lookup fails.
// Skips admin-apk-* releases so they never interfere with user downloads.
async function getApkAsset(): Promise<CachedAsset | null> {
  const now = Date.now();
  if (now < cacheExpiry) return cachedAsset;

  try {
    // Primary: fetch the release tagged exactly "latest" — this is where
    // GSMWorld.apk lives and won't be displaced by admin APK releases.
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

    // Fallback: scan up to 100 releases, skipping admin-apk-* ones.
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

// HEAD — tells the frontend whether the APK is actually available.
router.head("/download/apk", async (_req, res) => {
  const asset = await getApkAsset();
  res.status(asset ? 200 : 503).end();
});

// GET — stream the APK binary server-side.
//
// WHY not a simple 302 to browser_download_url:
//   Android's download manager follows the redirect but loses the correct
//   Accept header, so GitHub's CDN returns JSON → file saves as *.apk.json.
//
// WHY not fetch(browser_download_url, { redirect:"follow" }) with auth:
//   GitHub redirects to a pre-signed S3 URL. S3 rejects requests that carry
//   an Authorization header (it collides with the embedded query-string sig),
//   returning an XML/JSON error instead of the binary.
//
// CORRECT approach (GitHub docs):
//   1. Call the API asset endpoint with Accept: application/octet-stream and
//      the GitHub token — GitHub returns a 302 to a pre-signed S3/CDN URL.
//   2. Follow the redirect WITHOUT the Authorization header — the pre-signed
//      URL already embeds the credentials in the query string.
router.get("/download/apk", async (_req, res) => {
  const asset = await getApkAsset();
  if (!asset) {
    res.status(503).json({ error: "APK not available yet. Please try again later." });
    return;
  }

  // Step 1: hit the GitHub API asset endpoint; get the pre-signed CDN URL.
  const apiAssetUrl = `${GH_API}/releases/assets/${asset.id}`;
  let cdnUrl: string;
  try {
    const r1 = await fetch(apiAssetUrl, {
      headers: {
        "User-Agent": "GSMWorld/1.0",
        Accept: "application/octet-stream",
        ...(GH_TOKEN ? { Authorization: `token ${GH_TOKEN}` } : {}),
      },
      redirect: "manual", // capture the 302 Location instead of following it
    });

    const loc = r1.headers.get("location");
    if (!loc) {
      // Some GitHub configurations return 200 with body directly — handle that too.
      if (r1.ok && r1.body) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", 'attachment; filename="GSMWorld.apk"');
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

  // Step 2: fetch the pre-signed CDN URL — NO Authorization header (S3 rejects it).
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
  res.setHeader("Content-Disposition", 'attachment; filename="GSMWorld.apk"');
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  const cl = upstream.headers.get("content-length");
  if (cl) res.setHeader("Content-Length", cl);

  const { Readable } = await import("stream");
  Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
});

export default router;
