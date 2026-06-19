package com.gsmworld.admin;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private static final String TAG        = "GSMAdmin";
    private static final String ADMIN_URL  = "https://gsmworld.vercel.app/admin";
    private static final String ADMIN_HOST = "gsmworld.vercel.app";
    // Version-check endpoint on the GSMWorld server — avoids hitting GitHub API
    // directly and also works if the repo is ever made private.
    private static final String ADMIN_APK_VERSION_API =
        "https://gsmworld.vercel.app/api/download/admin-apk-version";
    // Server-side streaming download — uses GitHub token on the server so
    // direct CDN auth issues can never corrupt the download.
    private static final String ADMIN_APK_DOWNLOAD_URL =
        "https://gsmworld.vercel.app/api/download/admin-apk";
    private static final int    REQUEST_INSTALL_PERMISSION = 1001;
    private static final String WEB_VERSION_API =
        "https://gsmworld.vercel.app/api/web-version";
    private static final long   WEB_VERSION_POLL_MS = 60_000;
    private static final String PREFS_NAME        = "gsm_admin_prefs";
    private static final String KEY_LAST_TAG      = "last_apk_tag";
    private static final String KEY_WEB_BUILD_ID  = "web_build_id";

    private WebView             webView;
    private SwipeRefreshLayout  swipeRefresh;
    private View                errorView;
    private File                pendingApkFile;
    private boolean             errorShown = false;

    private final Handler         mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor    = Executors.newSingleThreadExecutor();

    /**
     * JavaScript bridge that lets the web admin page tell the native layer
     * whether the scrollable <main> element is scrolled past the top.
     *
     * The admin page scrolls inside a CSS overflow element, so
     * webView.getScrollY() is always 0.  Without this bridge the
     * SwipeRefreshLayout can never tell the difference between "user is at
     * the top" and "user is halfway down the list" — causing spurious
     * pull-to-refresh when the user tries to scroll back up.
     */
    private final class ScrollBridge {
        private volatile boolean scrolledPastTop = false;

        @JavascriptInterface
        public void setScrolled(boolean isScrolled) {
            scrolledPastTop = isScrolled;
        }

        boolean isScrolledPastTop() { return scrolledPastTop; }
    }

    private final ScrollBridge scrollBridge = new ScrollBridge();

    // ── BiometricBridge: native fingerprint credential storage ────────────────
    private final class BiometricBridge {
        private static final String PREFS   = "gsm_bio_admin_v1";
        private static final String ALIAS   = "GSMBioAdminKey_v1";
        private static final String KEY_ENC = "enc_cred";
        private static final String KEY_IV  = "enc_iv";

        BiometricBridge() { ensureKey(); }

        private void ensureKey() {
            try {
                KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
                ks.load(null);
                if (ks.containsAlias(ALIAS)) return;
                KeyGenerator kg = KeyGenerator.getInstance(
                        KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
                kg.init(new KeyGenParameterSpec.Builder(ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build());
                kg.generateKey();
            } catch (Exception e) {
                Log.e(TAG, "BiometricBridge: key init failed", e);
            }
        }

        @JavascriptInterface
        public void saveCredential(String jsonData) {
            try {
                KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
                ks.load(null);
                SecretKey key = (SecretKey) ks.getKey(ALIAS, null);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key);
                byte[] iv  = cipher.getIV();
                byte[] enc = cipher.doFinal(jsonData.getBytes(StandardCharsets.UTF_8));
                getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putString(KEY_ENC, Base64.encodeToString(enc, Base64.NO_WRAP))
                    .putString(KEY_IV,  Base64.encodeToString(iv,  Base64.NO_WRAP))
                    .apply();
            } catch (Exception e) {
                Log.e(TAG, "BiometricBridge: save failed", e);
            }
        }

        @JavascriptInterface
        public String hasCredential() {
            return String.valueOf(
                getSharedPreferences(PREFS, MODE_PRIVATE).contains(KEY_ENC));
        }

        @JavascriptInterface
        public void clearCredential() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        }

        @JavascriptInterface
        public void authenticate(String callbackId) {
            SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            String encB64 = p.getString(KEY_ENC, null);
            String ivB64  = p.getString(KEY_IV,  null);
            if (encB64 == null || ivB64 == null) {
                callJs(callbackId, "{\"error\":\"no_credential\"}");
                return;
            }
            BiometricPrompt.PromptInfo info =
                new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Sign in to GSM World Admin")
                    .setSubtitle("Confirm your identity to continue")
                    .setNegativeButtonText("Use password")
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG |
                        BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .build();
            final String encFinal = encB64;
            final String ivFinal  = ivB64;
            mainHandler.post(() -> {
                BiometricPrompt prompt = new BiometricPrompt(
                    MainActivity.this,
                    ContextCompat.getMainExecutor(MainActivity.this),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(
                                BiometricPrompt.AuthenticationResult r) {
                            try {
                                KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
                                ks.load(null);
                                SecretKey key = (SecretKey) ks.getKey(ALIAS, null);
                                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                                cipher.init(Cipher.DECRYPT_MODE, key,
                                    new GCMParameterSpec(128,
                                        Base64.decode(ivFinal, Base64.NO_WRAP)));
                                byte[] dec = cipher.doFinal(
                                    Base64.decode(encFinal, Base64.NO_WRAP));
                                callJs(callbackId,
                                    new String(dec, StandardCharsets.UTF_8));
                            } catch (Exception ex) {
                                Log.e(TAG, "BiometricBridge: decrypt failed", ex);
                                callJs(callbackId, "{\"error\":\"decrypt_failed\"}");
                            }
                        }
                        @Override
                        public void onAuthenticationError(int code, CharSequence msg) {
                            callJs(callbackId, "{\"error\":\"cancelled\"}");
                        }
                        @Override
                        public void onAuthenticationFailed() { /* retry silently */ }
                    });
                prompt.authenticate(info);
            });
        }

        private void callJs(String cbId, String json) {
            String safeId = cbId.replaceAll("[^a-zA-Z0-9_]", "_");
            String js = "if(typeof window['" + safeId + "']==='function')" +
                        "{try{window['" + safeId + "'](" + json + ");}catch(e){}" +
                        "delete window['" + safeId + "'];}";
            mainHandler.post(() -> webView.evaluateJavascript(js, null));
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark status bar matching the app header (#0f172a = slate-900).
        // Do NOT use LAYOUT_FULLSCREEN — that draws content behind the status
        // bar and causes the header to overlap with system notifications.
        getWindow().setStatusBarColor(Color.parseColor("#0f172a"));
        // Light status bar icons (white) so they're visible on the dark background.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // clear → white icons
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }

        setContentView(R.layout.activity_main);

        webView      = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        errorView    = findViewById(R.id.errorView);

        // Register the bridge so the web page can call
        // AdminScrollBridge.setScrolled(true/false)
        webView.addJavascriptInterface(scrollBridge, "AdminScrollBridge");
        webView.addJavascriptInterface(new BiometricBridge(), "AndroidBiometric");

        // ── Pull-to-refresh ───────────────────────────────────────────────────
        swipeRefresh.setColorSchemeColors(
            Color.parseColor("#0ea5e9"),
            Color.parseColor("#38bdf8"),
            Color.parseColor("#7dd3fc")
        );
        swipeRefresh.setOnRefreshListener(() -> {
            webView.clearCache(false);
            webView.reload();
        });

        // Allow pull-to-refresh ONLY when both the native WebView scroll AND
        // the DOM overflow scroll are at the very top.
        //
        // webView.getScrollY() covers pages that scroll the body/window.
        // scrollBridge.isScrolledPastTop() covers pages that scroll an
        // overflow element (like the admin <main>), where getScrollY() == 0
        // regardless of how far the user has scrolled inside the element.
        swipeRefresh.setOnChildScrollUpCallback((parent, child) ->
            webView.getScrollY() > 0 || scrollBridge.isScrolledPastTop());

        // ── Auto-refresh after APK update ─────────────────────────────────────
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String lastTag = prefs.getString(KEY_LAST_TAG, "");
        if (!lastTag.equals(BuildConfig.APK_TAG)) {
            prefs.edit().putString(KEY_LAST_TAG, BuildConfig.APK_TAG).apply();
            if (!lastTag.isEmpty()) {
                webView.clearCache(true);
                Toast.makeText(this, "App updated — loading fresh content…",
                    Toast.LENGTH_SHORT).show();
            }
        }

        Button retryButton = findViewById(R.id.retryButton);
        retryButton.setOnClickListener(v -> retry());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " GSMAdminApp/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Intercept APK download links that the WebView cannot handle itself.
        // Without this, tapping "Download APK" in the dashboard silently does
        // nothing — the WebView tries to navigate to github.com (blocked by
        // shouldOverrideUrlLoading) and never triggers a download.
        // This listener catches the case where the server sends
        // Content-Disposition: attachment or an APK MIME type.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url.endsWith(".apk")
                    || "application/vnd.android.package-archive".equals(mimetype)) {
                mainHandler.post(() -> Toast.makeText(MainActivity.this,
                    "Downloading update…", Toast.LENGTH_SHORT).show());
                executor.execute(() -> downloadAndInstallSilent(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(android.webkit.PermissionRequest request) {
                // Grant all permissions from the web page (needed for WebAuthn/fingerprint).
                request.grant(request.getResources());
            }
        });
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                String path = request.getUrl().getPath();

                // APK download link from the admin dashboard "Download APK" button.
                // The WebView cannot navigate to a binary file — intercept it here
                // and hand off to the same silent download+install flow used by
                // the auto-updater, so the user gets the install prompt directly.
                if (path != null && path.endsWith(".apk")) {
                    mainHandler.post(() -> Toast.makeText(MainActivity.this,
                        "Downloading update…", Toast.LENGTH_SHORT).show());
                    executor.execute(() -> downloadAndInstallSilent(request.getUrl().toString()));
                    return true;
                }

                return !ADMIN_HOST.equals(host);
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                // Reset scroll state on each new page load
                scrollBridge.setScrolled(false);
                if (errorShown) {
                    errorShown = false;
                    errorView.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);

                view.evaluateJavascript(
                    "(function(){" +
                    "var m=document.querySelector('meta[name=viewport]');" +
                    "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
                    "m.content='width=device-width,initial-scale=1.0,maximum-scale=5.0';" +
                    "})();",
                    null
                );

                // Inject a scroll tracker on the admin <main> element.
                // The admin page scrolls inside overflow:auto — not the body —
                // so webView.getScrollY() is always 0.  We watch the element's
                // scroll event and notify the native bridge so
                // SwipeRefreshLayout knows the real scroll position.
                view.evaluateJavascript(
                    "(function(){" +
                    "  if(typeof AdminScrollBridge==='undefined') return;" +
                    "  function attachTracker(){" +
                    "    var main=document.querySelector('main');" +
                    "    if(!main) return;" +
                    "    AdminScrollBridge.setScrolled(main.scrollTop>0);" +
                    "    main.addEventListener('scroll',function(){" +
                    "      AdminScrollBridge.setScrolled(main.scrollTop>0);" +
                    "    },{passive:true});" +
                    "  }" +
                    "  if(document.readyState==='complete'){attachTracker();}" +
                    "  else{window.addEventListener('load',attachTracker,{once:true});}" +
                    "})();",
                    null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (!request.isForMainFrame()) return;
                swipeRefresh.setRefreshing(false);
                showError();
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            // Append a launch timestamp so Android's WebView cache never serves
            // stale HTML on a fresh open — Vercel will always return the latest
            // index.html, which in turn loads the latest JS chunks.
            webView.loadUrl(ADMIN_URL + "?_launch=" + System.currentTimeMillis());
        }

        // Check for a new APK release (native code changes)
        mainHandler.postDelayed(this::checkForUpdate, 4000);

        // Check for a new Vercel web deployment (JS/CSS/web changes).
        // This runs natively in Java so it works even when the WebView is
        // showing a stale cached page with no JS poller running inside it.
        mainHandler.postDelayed(this::checkWebVersion, 5000);
    }

    // ── Offline screen ────────────────────────────────────────────────────────

    private void showError() {
        if (errorShown) return;
        errorShown = true;
        webView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
    }

    private void retry() {
        errorShown = false;
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(ADMIN_URL);
    }

    // ── Auto-update: check server version endpoint ────────────────────────────
    //
    // Queries /api/download/admin-apk-version (GSMWorld server) instead of the
    // GitHub API directly.  Benefits:
    //   • Works if the repo is ever made private (server uses a token).
    //   • Single authoritative source — same logic the server uses.
    //   • The actual APK is also streamed through the server, so GitHub CDN
    //     auth issues can never produce a corrupted / HTML "APK" file.

    private void checkForUpdate() {
        executor.execute(() -> {
            try {
                HttpURLConnection conn = openGet(ADMIN_APK_VERSION_API);
                if (conn.getResponseCode() != 200) {
                    Log.w(TAG, "Version check returned HTTP " + conn.getResponseCode());
                    return;
                }

                String     body    = readString(conn.getInputStream());
                JSONObject json    = new JSONObject(body);
                String     latestTag = json.optString("tag", "");

                if (latestTag.isEmpty()) {
                    Log.w(TAG, "Version check: no tag in response");
                    return;
                }

                String currentTag = BuildConfig.APK_TAG;
                Log.i(TAG, "Current: " + currentTag + "  Latest: " + latestTag);
                if (latestTag.equals(currentTag)) return;

                Log.i(TAG, "Update available " + currentTag + " → " + latestTag + ". Downloading via server.");
                mainHandler.post(() -> {
                    Toast.makeText(MainActivity.this, "Update found — downloading…",
                        Toast.LENGTH_LONG).show();
                    // Download from server endpoint (uses GitHub token server-side;
                    // prevents corrupted/HTML downloads that Android rejects as
                    // "package appears to be invalid").
                    executor.execute(() -> downloadAndInstallSilent(ADMIN_APK_DOWNLOAD_URL));
                });

            } catch (Exception e) {
                Log.w(TAG, "Update check failed: " + e.getMessage());
            }
        });
    }

    // ── Native web-version poller ─────────────────────────────────────────────
    //
    // Polls /api/web-version (JSON: { buildId }) every 60 s from Java — not
    // from JS inside the WebView — so it fires even when the WebView is
    // showing a stale cached page that has no JS poller running in it.
    //
    // On first poll: stores the buildId, no reload.
    // On subsequent polls: if buildId changed → clear WebView cache and reload
    //   with a cache-busting URL so the latest Vercel deployment is fetched.
    //
    // This means: push to GitHub → Vercel deploys → within 60 s the admin
    // WebView automatically loads the new version. No APK update needed.

    private void checkWebVersion() {
        executor.execute(() -> {
            try {
                HttpURLConnection conn = openGet(WEB_VERSION_API);
                conn.setRequestProperty("Cache-Control", "no-store");
                if (conn.getResponseCode() != 200) return;

                String body = readString(conn.getInputStream());
                JSONObject json = new JSONObject(body);
                String newBuildId = json.optString("buildId", "");
                if (newBuildId.isEmpty()) return;

                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String knownBuildId = prefs.getString(KEY_WEB_BUILD_ID, "");

                if (knownBuildId.isEmpty()) {
                    // First poll — record the current build, do not reload.
                    prefs.edit().putString(KEY_WEB_BUILD_ID, newBuildId).apply();
                    Log.i(TAG, "Web version recorded: " + newBuildId);
                } else if (!newBuildId.equals(knownBuildId)) {
                    // New Vercel deployment detected — reload with cache-busting.
                    Log.i(TAG, "New web deploy detected: " + knownBuildId + " → " + newBuildId);
                    prefs.edit().putString(KEY_WEB_BUILD_ID, newBuildId).apply();
                    mainHandler.post(() -> {
                        webView.clearCache(true);
                        webView.loadUrl(ADMIN_URL + "?_v=" + System.currentTimeMillis());
                        Toast.makeText(this,
                            "Admin panel updated — loading latest version…",
                            Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                Log.w(TAG, "Web version check failed: " + e.getMessage());
            }

            // Schedule next poll regardless of outcome.
            mainHandler.postDelayed(this::checkWebVersion, WEB_VERSION_POLL_MS);
        });
    }

    // ── Silent download + install ─────────────────────────────────────────────

    private void downloadAndInstallSilent(String downloadUrl) {
        try {
            File dir = new File(getCacheDir(), "apk_updates");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            File apkFile = new File(dir, "gsm-admin-update.apk");

            HttpURLConnection conn = openGet(downloadUrl);
            conn.setConnectTimeout(30_000);
            conn.setReadTimeout(60_000);
            conn.setInstanceFollowRedirects(true);

            int status = conn.getResponseCode();
            while (status == 301 || status == 302 || status == 307 || status == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                conn = openGet(location);
                conn.setConnectTimeout(30_000);
                conn.setReadTimeout(60_000);
                status = conn.getResponseCode();
            }

            if (status != 200) {
                int finalStatus = status;
                mainHandler.post(() -> Toast.makeText(this,
                    "Download failed (HTTP " + finalStatus + ")", Toast.LENGTH_SHORT).show());
                return;
            }

            try (InputStream in = conn.getInputStream();
                 FileOutputStream out = new FileOutputStream(apkFile)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            }

            mainHandler.post(() -> installApk(apkFile));

        } catch (Exception e) {
            Log.e(TAG, "Download failed", e);
            mainHandler.post(() -> Toast.makeText(this,
                "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    // ── Install ───────────────────────────────────────────────────────────────

    private void installApk(File apkFile) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
            pendingApkFile = apkFile;
            new AlertDialog.Builder(this)
                .setTitle("Permission needed")
                .setMessage("Please enable \"Install unknown apps\" for GSM Admin in the next screen, then return here.")
                .setPositiveButton("Open Settings", (d, w) -> {
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, REQUEST_INSTALL_PERMISSION);
                })
                .setNegativeButton("Cancel", null)
                .show();
            return;
        }
        triggerInstall(apkFile);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_INSTALL_PERMISSION && pendingApkFile != null) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O
                    && getPackageManager().canRequestPackageInstalls()) {
                triggerInstall(pendingApkFile);
            }
            pendingApkFile = null;
        }
    }

    private void triggerInstall(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            this, getPackageName() + ".fileprovider", apkFile);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(intent);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private HttpURLConnection openGet(String urlStr) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setRequestMethod("GET");
        c.setRequestProperty("User-Agent", "GSMAdminApp/1.0");
        c.setConnectTimeout(10_000);
        c.setReadTimeout(15_000);
        return c;
    }

    private String readString(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) != -1) sb.append(new String(buf, 0, n, "UTF-8"));
        return sb.toString();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
    }
}
