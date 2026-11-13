import { defineConfig } from "weapp-vite/config";

export default defineConfig({
  build: { outDir: "dist", minify: false },
  weapp: {
    platform: "weapp",
    srcRoot: "src",
    vue: { enable: true, template: { formatWxml: false } },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: "wx6ffee4673b257014",
          projectname: "initial-props",
          compileType: "miniprogram",
          libVersion: "3.17.4",
          setting: { es6: true, minifyWXML: false },
        },
      },
    },
  },
});
