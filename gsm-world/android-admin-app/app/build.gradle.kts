plugins {
    id("com.android.application")
}

android {
    namespace = "com.gsmworld.admin"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.gsmworld.admin"
        minSdk = 24
        targetSdk = 34
        versionCode = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionName = System.getenv("GITHUB_SHA")?.take(7) ?: "dev"

        // Embed the current release tag so the app can detect newer builds
        val sha = System.getenv("GITHUB_SHA")?.take(7) ?: "dev"
        buildConfigField("String", "APK_TAG", "\"admin-apk-$sha\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.biometric:biometric:1.1.0")
}
