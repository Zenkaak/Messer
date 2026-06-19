package com.gsmworld.app;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

public class MainActivity extends AppCompatActivity {

    private static final String TAG      = "GSMWorld";
    private static final String APP_URL  = "https://gsmworld.vercel.app/";
    private static final String APP_HOST = "gsmworld.vercel.app";

    private WebView            webView;
    private SwipeRefreshLayout swipeRefresh;
    private View               errorView;
    private boolean            errorShown = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // ── BiometricBridge: native fingerprint credential storage ────────────────
    // The web frontend calls window.AndroidBiometric.saveCredential(json) after
    // login to store {email, token} encrypted with an AES-256-GCM key in the
    // Android Keystore.  On subsequent opens it calls authenticate(callbackId)
    // which shows a BiometricPrompt; on success the decrypted JSON is returned
    // via window[callbackId](json) so the web page can log the user in directly.
    private final class BiometricBridge {
        private static final String PREFS   = "gsm_biometric_v1";
        private static final String ALIAS   = "GSMBioKey_v1";
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
                Log.d(TAG, "BiometricBridge: credential saved");
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
                    .setTitle("Sign in to GSM World")
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

        // Dark status bar matching the app header colour.
        getWindow().setStatusBarColor(Color.parseColor("#060b15"));
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }

        setContentView(R.layout.activity_main);

        webView      = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        errorView    = findViewById(R.id.errorView);

        // Pull-to-refresh
        swipeRefresh.setColorSchemeColors(
            Color.parseColor("#3b82f6"),
            Color.parseColor("#6366f1"),
            Color.parseColor("#a78bfa")
        );
        swipeRefresh.setOnRefreshListener(() -> {
            webView.clearCache(false);
            webView.reload();
        });

        Button retryButton = findViewById(R.id.retryButton);
        retryButton.setOnClickListener(v -> retry());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Include "GSMWorldApp" so the web frontend can detect it's running inside our app.
        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " GSMWorldApp/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new BiometricBridge(), "AndroidBiometric");

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
                // Open external links in the browser; keep GSM World URLs in WebView.
                if (host == null || !host.equals(APP_HOST)) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                    startActivity(intent);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (errorShown) {
                    errorShown = false;
                    errorView.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
                // Ensure viewport meta is always present for proper mobile rendering.
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
                if (!request.isForMainFrame()) return;
                swipeRefresh.setRefreshing(false);
                showError();
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL + "?_launch=" + System.currentTimeMillis());
        }
    }

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
        webView.loadUrl(APP_URL);
    }

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
}
