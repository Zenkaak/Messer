package com.gsmworld.app;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import java.io.File;

public class MainActivity extends AppCompatActivity {

    private static final String APP_URL = "https://gsmworld.vercel.app";
    private static final String APK_FILENAME = "GSMWorld-update.apk";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;

    // Held so we can unregister it when the activity is destroyed
    private BroadcastReceiver downloadReceiver;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Root layout
        RelativeLayout root = new RelativeLayout(this);
        root.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT));

        // SwipeRefreshLayout
        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setColorSchemeColors(0xFF1a7a5e, 0xFF1e3a5f);
        RelativeLayout.LayoutParams swipeParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT);
        swipeRefresh.setLayoutParams(swipeParams);

        // WebView
        webView = new WebView(this);
        webView.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        // Use a real Chrome user-agent — removes the "wv" marker that Google
        // uses to block OAuth inside embedded WebViews. Keep "GSMWorldApp/1.0"
        // so the backend can still detect the Android wrapper.
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 GSMWorldApp/1.0"
        );

        // ── JavaScript bridge ──────────────────────────────────────────────
        // Exposes window.Android.downloadAndInstall(url) and
        // window.Android.downloadApk(url) to the web page so the "Update App"
        // button can trigger a background DownloadManager job instead of
        // opening a browser tab.
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    if (newProgress < 100) {
                        progressBar.setVisibility(View.VISIBLE);
                        progressBar.setProgress(newProgress);
                    } else {
                        progressBar.setVisibility(View.GONE);
                    }
                }
            }

            // Handle target="_blank" links (used by the Google sign-in button to
            // avoid navigating the WebView away from the login page).
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                                          boolean isUserGesture, android.os.Message resultMsg) {
                // Extract the URL the new window wants to open
                WebView dummyView = new WebView(MainActivity.this);
                dummyView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        String url = req.getUrl().toString();
                        // Open in Chrome / external browser
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        } catch (Exception ignored) {}
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(dummyView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Handle gsmworld:// deep links directly inside the WebView
                if (url.startsWith("gsmworld://")) {
                    handleDeepLink(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }

                // Google blocks OAuth in embedded WebViews. Open the entire
                // OAuth flow in Chrome; the server stores the token keyed by
                // sessionId and the React polling loop picks it up.
                if (url.contains("/api/auth/google/redirect")
                        || url.startsWith("https://accounts.google.com")
                        || url.startsWith("https://oauth2.googleapis.com")
                        || url.contains("google.com/o/oauth2")
                        || url.contains("googleapis.com/oauth2")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }

                // Keep everything from our domain inside the WebView
                if (url.startsWith("https://gsmworld.vercel.app")
                        || url.startsWith("https://www.gsmworld.vercel.app")) {
                    return false;
                }

                // Everything else opens in the system browser / app
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
            }
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());
        swipeRefresh.addView(webView);

        // Progress bar (on top of swipeRefresh)
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        RelativeLayout.LayoutParams pbParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, 8);
        pbParams.addRule(RelativeLayout.ALIGN_PARENT_TOP);
        progressBar.setLayoutParams(pbParams);
        progressBar.setMax(100);

        root.addView(swipeRefresh);
        root.addView(progressBar);
        setContentView(root);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            if (!handleDeepLink(getIntent())) {
                webView.loadUrl(APP_URL);
            }
        }
    }

    // ── Android JS bridge ──────────────────────────────────────────────────

    /**
     * Called by the web page via:
     *   window.Android.downloadAndInstall(apkUrl)
     * Downloads the APK in the background using DownloadManager.
     * When the download finishes, Android shows a notification and
     * immediately launches the package-installer intent.
     */
    private class AndroidBridge {

        @JavascriptInterface
        public void downloadAndInstall(String url) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this,
                    "⬇️ Downloading update in background…",
                    Toast.LENGTH_LONG).show()
            );
            startApkDownload(url, true);
        }

        @JavascriptInterface
        public void downloadApk(String url) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this,
                    "⬇️ Downloading APK…",
                    Toast.LENGTH_LONG).show()
            );
            startApkDownload(url, false);
        }
    }

    /**
     * Enqueues an APK download via {@link DownloadManager}.
     *
     * @param url         The full URL of the APK to download.
     * @param autoInstall When {@code true}, registers a {@link BroadcastReceiver}
     *                    that fires the installer Intent as soon as the download
     *                    completes.
     */
    private void startApkDownload(String url, boolean autoInstall) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("GSM World Update");
        request.setDescription("Downloading new version…");
        request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS, APK_FILENAME);
        request.setMimeType("application/vnd.android.package-archive");
        request.allowScanningByMediaScanner();

        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;
        long downloadId = dm.enqueue(request);

        if (!autoInstall) return;

        // Unregister any previous receiver before registering a new one
        if (downloadReceiver != null) {
            try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
        }

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;

                // Check the download actually succeeded before trying to install
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                try (android.database.Cursor cursor = dm.query(query)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        if (statusCol >= 0 &&
                                cursor.getInt(statusCol) == DownloadManager.STATUS_SUCCESSFUL) {
                            installApk(APK_FILENAME);
                        }
                    }
                }

                try { unregisterReceiver(this); } catch (Exception ignored) {}
                downloadReceiver = null;
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }
    }

    /**
     * Launches the system package-installer for a file saved in
     * {@link Environment#DIRECTORY_DOWNLOADS}.
     */
    private void installApk(String filename) {
        File apkFile = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                filename);

        if (!apkFile.exists()) return;

        Uri apkUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            apkUri = FileProvider.getUriForFile(
                    this, getPackageName() + ".provider", apkFile);
        } else {
            apkUri = Uri.fromFile(apkFile);
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(installIntent);
    }

    // ── Deep-link handling ─────────────────────────────────────────────────

    /**
     * Intercepts the {@code gsmworld://auth/callback?token=…} deep link that
     * the backend sends after a successful Google OAuth flow.
     *
     * @return {@code true} if a deep link was consumed, {@code false} otherwise.
     */
    private boolean handleDeepLink(Intent intent) {
        if (intent == null) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        if (!"gsmworld".equals(data.getScheme())) return false;
        if (!"auth".equals(data.getHost())) return false;

        String token = data.getQueryParameter("token");
        String email = data.getQueryParameter("email");
        String name  = data.getQueryParameter("name");
        String error = data.getQueryParameter("error");

        StringBuilder url = new StringBuilder(APP_URL + "/auth/google-callback?");
        if (token != null && !token.isEmpty()) {
            url.append("token=").append(Uri.encode(token));
            if (email != null) url.append("&email=").append(Uri.encode(email));
            if (name  != null) url.append("&name=").append(Uri.encode(name));
        } else {
            url.append("error=").append(
                    Uri.encode(error != null ? error : "Authentication failed"));
        }

        if (webView != null) webView.loadUrl(url.toString());
        return true;
    }

    // ── Activity lifecycle ─────────────────────────────────────────────────

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (downloadReceiver != null) {
            try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
            downloadReceiver = null;
        }
    }
}
