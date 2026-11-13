import { fileURLToPath } from "node:url";
import { defineConfig } from "weapp-vite/config";

export default defineConfig(({ mode }) => ({
  build: { outDir: "dist/" + mode },
  plugins: mode === "workaround" ? [{
    name: "resolve-shared-component",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "../../components/ReproLabel.vue" &&
          importer?.split("?", 1)[0] === fileURLToPath(new URL("./src/pages/index/index.vue", import.meta.url))) {
        return fileURLToPath(new URL("./shared/components/ReproLabel.vue", import.meta.url));
      }
    },
  }] : [],
  weapp: {
    platform: "weapp",
    srcRoot: "src",
    vue: { enable: true },
    multiPlatform: {
      projectConfigs: {
        weapp: {
          appid: "wx6ffee4673b257014",
          projectname: "external-script",
          compileType: "miniprogram",
        },
      },
    },
  },
}));
