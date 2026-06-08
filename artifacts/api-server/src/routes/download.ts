import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GH_RELEASES_URL =
  "https://api.github.com/repos/Zenkaak/Messer/releases?per_page=20";
const GH_HEADERS = {
  "User-Agent": "GSMWorld/1.0",
  Accept: "application/vnd.github.v3+json",
};

interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
  state: string;
}
interface GhRelease {
  tag_name: string;
  assets?: GhAsset[];
}

// 1-minute in-memory cache so rapid HEAD + GET don't hit the API twice.
let cachedUrl: string | null = null;
let cacheExpiry = 0;

// Searches releases for the user APK (GSMWorld.apk) specifically.
// Skips admin-apk-* releases so they never interfere with user downloads.
async function getApkAssetUrl(): Promise<string | null> {
  const now = Date.now();
  if (now < cacheExpiry) return cachedUrl;

  try {
    const res = await fetch(GH_RELEASES_URL, { headers: GH_HEADERS });
    if (!res.ok) {
      cachedUrl = null;
      cacheExpiry = now + 30_000;
      return null;
    }
    const releases = (await res.json()) as GhRelease[];
    // Find first release that has GSMWorld.apk — skip any admin-apk-* releases
    for (const release of releases) {
      if (release.tag_name?.startsWith("admin-apk-")) continue;
      const asset = release.assets?.find(
        (a) => a.name === "GSMWorld.apk" && a.state === "uploaded",
      );
      if (asset) {
        cachedUrl = asset.browser_download_url;
        cacheExpiry = now + 60_000;
        return cachedUrl;
      }
    }
    cachedUrl = null;
    cacheExpiry = now + 60_000;
    return null;
  } catch {
    cachedUrl = null;
    cacheExpiry = now + 30_000;
    return null;
  }
}

// HEAD — tells the frontend whether the APK is actually available.
router.head("/download/apk", async (_req, res) => {
  const url = await getApkAssetUrl();
  res.status(url ? 200 : 503).end();
});

// GET — stream the APK binary server-side.
// A 302 redirect to a GitHub browser_download_url causes Android's download
// manager to receive a JSON error from GitHub's CDN (missing Accept header
// on the redirect), saving the file as *.apk.json and marking it failed.
// Proxying the bytes here ensures the correct Content-Type reaches the client.
router.get("/download/apk", async (_req, res) => {
  const assetUrl = await getApkAssetUrl();
  if (!assetUrl) {
    res.status(503).json({ error: "APK not available yet. Please try again later." });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(assetUrl, {
      headers: { Accept: "application/octet-stream" },
      redirect: "follow",
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach GitHub CDN", detail: String(err) });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    res.status(502).json({ error: `GitHub CDN returned ${upstream.status}` });
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
