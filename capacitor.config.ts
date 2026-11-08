import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "http://10.0.2.2:5173";

const config: CapacitorConfig = {
  appId: "ls.co.autohelp",
  appName: "AutoHelp Lesotho",
  webDir: "capacitor-web",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0B172A",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
  },
};

export default config;
