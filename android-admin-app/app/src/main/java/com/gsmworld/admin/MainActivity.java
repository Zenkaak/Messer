package com.gsmworld.admin;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
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
    private static final String GH_RELEASES_API =
        "https://api.github.com/repos/Zenkaak/Messer/releases?per_page=10";
    private static final int    REQUEST_INSTALL_PERMISSION = 1001;
    private static final String PREFS_NAME = "gsm_admin_prefs";
    private static final String KEY_LAST_TAG = "last_apk_tag";

    private WebView             webView;
    private SwipeRefreshLayout  swipeRefresh;
    private View                errorView;
    private File                pendingApkFile;
    private boolean             errorShown = false;

    private final Handler         mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor    = Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        getWindow().setStatusBarColor(Color.TRANSPARENT);

        setContentView(R.layout.activity_main);

        webView      = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        errorView    = findViewById(R.id.errorView);

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

        // Only allow pull-to-refresh when the WebView is scrolled all the way to the top.
        // Without this, any downward scroll triggers a refresh instead of scrolling the page.
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> webView.getScrollY() > 0);

        // ── Auto-refresh after APK update ─────────────────────────────────────
        // If the stored tag differs from the compiled-in tag the app was just
        // updated.  Clear stale cache so the WebView serves fresh content.
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String lastTag = prefs.getString(KEY_LAST_TAG, "");
        if (!lastTag.equals(BuildConfig.APK_TAG)) {
            prefs.edit().putString(KEY_LAST_TAG, BuildConfig.APK_TAG).apply();
            if (!lastTag.isEmpty()) {
                // First launch after a successful auto-update
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

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                return !ADMIN_HOST.equals(host);
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                // Hide any previous error screen when a new load begins
                if (errorShown) {
                    errorShown = false;
                    errorView.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Stop the pull-to-refresh spinner
                swipeRefresh.setRefreshing(false);

                // Ensure the page uses device width (fixes fixed-width desktop layout)
                view.evaluateJavascript(
                    "(function(){" +
                    "var m=document.querySelector('meta[name=viewport]');" +
                    "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
                    "m.content='width=device-width,initial-scale=1.0,maximum-scale=5.0';" +
                    "})();",
                    null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                // Only react to main-frame failures (not sub-resource errors)
                if (!request.isForMainFrame()) return;
                swipeRefresh.setRefreshing(false);
                showError();
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(ADMIN_URL);
        }

        // Check for a newer build 4 seconds after launch
        mainHandler.postDelayed(this::checkForUpdate, 4000);
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

    // ── Auto-update: check GitHub ─────────────────────────────────────────────

    private void checkForUpdate() {
        executor.execute(() -> {
            try {
                HttpURLConnection conn = openGet(GH_RELEASES_API);
                if (conn.getResponseCode() != 200) return;

                String    body     = readString(conn.getInputStream());
                JSONArray releases = new JSONArray(body);

                String latestTag   = null;
                String downloadUrl = null;

                for (int i = 0; i < releases.length(); i++) {
                    JSONObject r   = releases.getJSONObject(i);
                    String    tag  = r.optString("tag_name", "");
                    if (!tag.startsWith("admin-apk-")) continue;

                    JSONArray assets = r.optJSONArray("assets");
                    if (assets == null) continue;

                    for (int j = 0; j < assets.length(); j++) {
                        JSONObject a = assets.getJSONObject(j);
                        if (a.optString("name").endsWith(".apk")
                                && "uploaded".equals(a.optString("state"))) {
                            latestTag   = tag;
                            downloadUrl = a.getString("browser_download_url");
                            break;
                        }
                    }
                    if (latestTag != null) break;
                }

                if (latestTag == null) return;

                String currentTag = BuildConfig.APK_TAG;
                Log.i(TAG, "Current: " + currentTag + "  Latest: " + latestTag);
                if (latestTag.equals(currentTag)) return;

                final String url = downloadUrl;
                Log.i(TAG, "Update available " + currentTag + " → " + latestTag + ". Downloading silently.");
                mainHandler.post(() -> {
                    Toast.makeText(MainActivity.this, "Update found — downloading…",
                        Toast.LENGTH_LONG).show();
                    executor.execute(() -> downloadAndInstallSilent(url));
                });

            } catch (Exception e) {
                Log.w(TAG, "Update check failed: " + e.getMessage());
            }
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
