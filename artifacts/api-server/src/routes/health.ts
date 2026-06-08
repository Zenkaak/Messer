import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const APP_VERSION = "2.0.0";
const RELEASE_DATE = "2026-06-02";

// Unique ID for the current web deployment — changes on every Vercel deploy
const WEB_BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Date.now()); // fallback: server start time (changes on each restart)
const GITHUB_OWNER = "Zenkaak";
const GITHUB_REPO = "Messer";

// Cache the latest admin APK release so we don't hammer the GitHub API
let _apkCache: { url: string; version: string; fetchedAt: number } | null = null;

async function getLatestApkRelease(): Promise<{ url: string; version: string } | null> {
  if (_apkCache && Date.now() - _apkCache.fetchedAt < 3_600_000) {
    return { url: _apkCache.url, version: _apkCache.version };
  }
  try {
    // Fetch all releases and sort by published_at — /releases/latest uses
    // GitHub's "Latest" marker which can point to an older release when
    // make_latest was previously false or when many releases exist.
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=50`,
      { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "GSMWorld-App/1.0" } },
    );
    if (!res.ok) return null;
    const releases = await res.json() as Array<{
      tag_name: string;
      published_at: string;
      assets: Array<{ name: string; browser_download_url: string; state: string }>;
    }>;

    // Sort newest first, then find the first admin-apk-* release with an uploaded APK
    releases.sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
    const adminRelease = releases.find(r =>
      r.tag_name.startsWith("admin-apk-") &&
      r.assets.some(a => a.name.endsWith(".apk") && a.state === "uploaded")
    );
    if (!adminRelease) return null;

    const apk = adminRelease.assets.find(
      a => a.name.endsWith(".apk") && a.state === "uploaded"
    );
    if (!apk) return null;

    const result = { url: apk.browser_download_url, version: adminRelease.tag_name };
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

// Web build ID — used by the WebView to detect new Vercel deploys and auto-reload
router.get("/web-version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ buildId: WEB_BUILD_ID });
});

// Returns the latest APK version + download URL for auto-update checks
router.get("/app/version", async (_req, res) => {
  const release = await getLatestApkRelease();
  res.json({
    version: release?.version ?? APP_VERSION,
    apkUrl: release?.url ?? null,
  });
});

// APK download — proxies the latest ADMIN APK from GitHub releases.
// Uses a separate path (/admin/download/apk) so it never conflicts with
// the user-facing /download/apk endpoint (download.ts → GSMWorld.apk).
router.get("/admin/download/apk", async (_req, res) => {
  const release = await getLatestApkRelease();
  if (!release) {
    res.status(404).json({ error: "No admin APK release found" });
    return;
  }
  const filename = `gsm-admin-${release.version}.apk`;
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.redirect(302, release.url);
});

export default router;
