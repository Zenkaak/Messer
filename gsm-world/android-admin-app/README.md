# GSM Admin Android App

A lightweight Android WebView wrapper for the GSM World admin dashboard.

## How It Works

Every push to `main` triggers the GitHub Actions workflow which:
1. Builds a signed APK
2. Creates a GitHub Release with the APK attached
3. The admin dashboard shows a download card with the latest version

## First-Time Setup (one time only)

You need to create a signing keystore and add it to GitHub Secrets:

### 1. Generate a keystore (run on any machine with Java installed)

```bash
keytool -genkeypair \
  -alias gsmadmin \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -keystore keystore.jks \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=GSM World, OU=Admin, O=GSMWorld, L=Nairobi, S=Nairobi, C=KE"
```

### 2. Base64-encode it

```bash
base64 keystore.jks | tr -d '\n' > keystore.b64
```

### 3. Add GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name        | Value                              |
|--------------------|------------------------------------|
| `KEYSTORE_BASE64`  | Contents of `keystore.b64`         |
| `KEYSTORE_PASSWORD`| Your store password                |
| `KEY_ALIAS`        | `gsmadmin`                         |
| `KEY_PASSWORD`     | Your key password                  |

### 4. Trigger the first build

Push any commit to `main` — the APK will appear under **Releases** within ~5 minutes.

## Admin Dashboard

The download card on `/admin` automatically fetches the latest release from GitHub and shows a one-tap download link.
