import { Router, type IRouter } from "express";

const router: IRouter = Router();

const GH_API_URL =
  "https://api.github.com/repos/Zenkaak/Messer/releases/latest";
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
  assets?: GhAsset[];
}

// 1-minute in-memory cache so rapid HEAD + GET don't hit the API twice.
let cachedUrl: string | null = null;
let cacheExpiry = 0;

async function getApkAssetUrl(): Promise<string | null> {
  const now = Date.now();
  if (now < cacheExpiry) return cachedUrl;

  try {
    const res = await fetch(GH_API_URL, { headers: GH_HEADERS });
    if (!res.ok) {
      cachedUrl = null;
      cacheExpiry = now + 30_000; // retry sooner on API error
      return null;
    }
    const release = (await res.json()) as GhRelease;
    const asset = release.assets?.find(
      (a) => a.name === "GSMWorld.apk" && a.state === "uploaded",
    );
    cachedUrl = asset?.browser_download_url ?? null;
    cacheExpiry = now + 60_000;
    return cachedUrl;
  } catch {
    cachedUrl = null;
    cacheExpiry = now + 30_000;
    return null;
  }
}

// HEAD — tells the frontend whether the APK is actually available.
// Uses the GitHub Releases API so there's no guesswork from content-type.
router.head("/download/apk", async (_req, res) => {
  const url = await getApkAssetUrl();
  res.status(url ? 200 : 503).end();
});

// GET — redirect to the GitHub CDN asset URL so the real APK bytes are
// served directly. No streaming, no content-type guessing.
router.get("/download/apk", async (_req, res) => {
  const assetUrl = await getApkAssetUrl();
  if (!assetUrl) {
    res.status(503).json({ error: "APK not available yet. Please try again later." });
    return;
  }
  // The CDN URL already carries the correct Content-Type and a very long
  // Cache-Control, so we just send the client there.
  res.redirect(302, assetUrl);
});

export default router;
