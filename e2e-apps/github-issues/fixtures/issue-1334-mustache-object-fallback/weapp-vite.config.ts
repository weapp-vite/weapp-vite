import { defineConfig } from "weapp-vite/config";

export default defineConfig(({ mode }) => ({
  build: { outDir: "dist/" + mode },
  weapp: {
    platform: "weapp",
    srcRoot: "src",
    vue: {
      enable: true,
      template: {
        formatWxml: false,
        // default 模式不设置插值选项；spaced 只作为同一源码的对照。
        ...(mode === "spaced" ? { mustacheInterpolation: "spaced" as const } : {}),
      },
    },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: "wx6ffee4673b257014",
          projectname: "mustache-object-fallback-" + mode,
          compileType: "miniprogram",
          libVersion: "3.17.4",
          setting: { es6: true, minifyWXML: false },
        },
      },
    },
  },
}));
