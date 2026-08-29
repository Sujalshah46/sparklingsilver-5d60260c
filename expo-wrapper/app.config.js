module.exports = {
  expo: {
    name: "Sparkling Silver",
    owner: "sujalshah07s-team",
    slug: "sparling-silver",
    scheme: "sparklingsilver",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    primaryColor: "#6D1F2E",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.sparklingsilver.app",
      buildNumber: "14",
      entitlements: {
        "aps-environment": "production"
      },
      associatedDomains: [
        "applinks:www.sparklingsilver.in",
        "applinks:sparklingsilver.in"
      ],
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDisplayName: "Sparkling Silver",
        LSApplicationQueriesSchemes: [
          "whatsapp",
          "instagram",
          "tel",
          "mailto"
        ]
      },
      icon: {
        light: "./assets/icon.png",
        dark: "./assets/icon-dark.png",
        tinted: "./assets/icon-tinted.png"
      },
      privacyManifest: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1"]
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"]
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"]
          }
        ],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePurchaseHistory",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
          }
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000",
        monochromeImage: "./assets/adaptive-icon.png"
      },
      package: "com.sparklingsilver.app",
      versionCode: 31,
      permissions: [
        "android.permission.INTERNET",
        "android.permission.VIBRATE",
        "android.permission.DETECT_SCREEN_CAPTURE"
      ],
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "www.sparklingsilver.in",
              pathPrefix: "/auth-callback"
            },
            {
              scheme: "https",
              host: "sparklingsilver.in",
              pathPrefix: "/auth-callback"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      allowBackup: false
    },
    web: {
      favicon: "./assets/icon.png"
    },
    plugins: [
      "./plugins/withAndroidOptimizations",
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash.png",
          "resizeMode": "contain",
          "backgroundColor": "#FAF7F2"
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 36,
            "targetSdkVersion": 36,
            "buildToolsVersion": "36.0.0",
            "ndkVersion": "27.1.12297006",
            "enableMinifyInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "9f3a0161-70df-4852-b627-3b19524c2488"
      }
    }
  }
};
