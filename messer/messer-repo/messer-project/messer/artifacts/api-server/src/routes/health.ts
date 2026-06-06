import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const APP_VERSION = "2.0.0";
const RELEASE_DATE = "2026-06-02";
const GITHUB_OWNER = "Zenkaak";
const GITHUB_REPO = "Messer";

// Cache the latest release so we don't hammer the GitHub API
let _apkCache: { url: string; version: string; fetchedAt: number } | null = null;

async function getLatestApkRelease(): Promise<{ url: string; version: string } | null> {
  if (_apkCache && Date.now() - _apkCache.fetchedAt < 3_600_000) {
    return { url: _apkCache.url, version: _apkCache.version };
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "GSMWorld-App/1.0" } },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };
    const apk = data.assets.find(a => a.name.toLowerCase().endsWith(".apk"));
    if (!apk) return null;
    const result = { url: apk.browser_download_url, version: data.tag_name.replace(/^v/, "") };
    _apkCache = { ...result, fetchedAt: Date.now() };
    return result;
  } catch {
    return null;
  }
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/version", (_req, res) => {
  res.json({ version: APP_VERSION, releaseDate: RELEASE_DATE });
});

// Returns the latest APK version + download URL for auto-update checks
router.get("/app/version", async (_req, res) => {
  const release = await getLatestApkRelease();
  res.json({
    version: release?.version ?? APP_VERSION,
    apkUrl: release?.url ?? null,
  });
});

// APK download — redirects to the latest GitHub release asset
// Served from our own domain so Chrome trusts the origin better
router.get("/download/apk", async (_req, res) => {
  const release = await getLatestApkRelease();
  const apkUrl =
    release?.url ??
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/app-release.apk`;
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="GSMWorld.apk"');
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.redirect(302, apkUrl);
});

export default router;
