import { Router } from "express";

const router = Router();

const GITHUB_API_URL =
  "https://api.github.com/repos/Zenkaak/Messer/releases/latest";
const APK_DOWNLOAD_URL =
  "https://github.com/Zenkaak/Messer/releases/latest/download/GSMWorld.apk";

interface ReleaseInfo {
  versionCode: number;
  downloadUrl: string;
  releaseName: string | null;
  fetchedAt: number;
}

// 5-minute in-memory cache so we don't hammer the GitHub API
let _cache: ReleaseInfo | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        "User-Agent": "GSMWorld-VersionCheck/1.0",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      // No release published yet
      return { versionCode: 0, downloadUrl: APK_DOWNLOAD_URL, releaseName: null, fetchedAt: Date.now() };
    }

    const release = await res.json() as {
      name: string;
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    // Parse build number from release title: "GSM World App — Build #42"
    const match = (release.name ?? "").match(/#(\d+)/);
    const versionCode = match ? parseInt(match[1], 10) : 0;

    // Use direct asset URL if present; fall back to the generic latest URL
    const apkAsset = release.assets?.find((a) => a.name === "GSMWorld.apk");
    const downloadUrl = apkAsset?.browser_download_url ?? APK_DOWNLOAD_URL;

    _cache = { versionCode, downloadUrl, releaseName: release.name ?? null, fetchedAt: Date.now() };
    return _cache;
  } catch {
    return { versionCode: 0, downloadUrl: APK_DOWNLOAD_URL, releaseName: null, fetchedAt: Date.now() };
  }
}

/**
 * GET /api/version
 * Returns the latest build version so the Android WebView can silently
 * detect when a newer APK is available and show the "Update App" button.
 *
 * Response:
 *   { versionCode: number, downloadUrl: string, releaseName: string | null }
 *
 * The Android app compares versionCode against BuildConfig.VERSION_CODE.
 * If versionCode > BuildConfig.VERSION_CODE → update is available.
 */
router.get("/version", async (_req, res) => {
  const info = await fetchLatestRelease();
  res.json({
    versionCode: info.versionCode,
    downloadUrl: info.downloadUrl,
    releaseName: info.releaseName,
  });
});

export default router;
