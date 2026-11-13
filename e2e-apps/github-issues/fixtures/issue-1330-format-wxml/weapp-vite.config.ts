import { defineConfig } from "weapp-vite/config";

export default defineConfig(({ mode }) => ({
  build: { outDir: mode === "formatted" ? "dist/formatted" : "dist/compact" },
  weapp: {
    platform: "weapp",
    srcRoot: "src",
    vue: {
      enable: true,
      template: { formatWxml: mode === "formatted" },
    },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: "wx6ffee4673b257014",
          projectname: "format-wxml-" + mode,
          compileType: "miniprogram",
          libVersion: "3.17.4",
          setting: { es6: true, minifyWXML: false },
        },
      },
    },
  },
}));
