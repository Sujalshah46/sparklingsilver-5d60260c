const { withAppBuildGradle, withGradleProperties, withAndroidManifest } = require('expo/config-plugins');

function withAndroidOptimizations(config) {
  // 1. Replace proguard-android.txt with proguard-android-optimize.txt in build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/g,
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );
    return cfg;
  });

  // 2. Set android.r8.optimizedResourceShrinking=true in gradle.properties
  config = withGradleProperties(config, (cfg) => {
    const hasProp = cfg.modResults.some(item => item.key === 'android.r8.optimizedResourceShrinking');
    if (!hasProp) {
      cfg.modResults.push({
        type: 'property',
        key: 'android.r8.optimizedResourceShrinking',
        value: 'true',
      });
    }
    return cfg;
  });

  // 3. Add Android 16 tablet orientation opt-out property to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const androidManifest = cfg.modResults.manifest;
    if (androidManifest && androidManifest.application) {
      const application = androidManifest.application[0];
      application.property = application.property || [];
      const hasProp = application.property.some(
        (p) => p.$ && p.$['android:name'] === 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY'
      );
      if (!hasProp) {
        application.property.push({
          $: {
            'android:name': 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY',
            'android:value': 'true',
          },
        });
      }
    }
    return cfg;
  });

  return config;
}

module.exports = withAndroidOptimizations;
