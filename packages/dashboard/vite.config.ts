import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { createVueOxcTsconfigGuard } from '../../scripts/vite/vueOxcTsconfigGuard.js'

const dashboardRoot = import.meta.dirname

const dashboardDevServer = {
  host: '127.0.0.1',
  port: 6188,
  strictPort: false,
}

function resolveDashboardChunk(id: string) {
  if (!id.includes('node_modules')) {
    return undefined
  }
  if (id.includes('monaco-editor')) {
    return 'monaco'
  }
  if (id.includes('echarts')) {
    return 'echarts'
  }
  if (id.includes('vue')) {
    return 'vue'
  }
  return 'vendor'
}

const dashboardVuePlugin = vue()

export default defineConfig({
  root: dashboardRoot,
  base: './',
  appType: 'spa',
  publicDir: false,
  server: dashboardDevServer,
  preview: dashboardDevServer,
  plugins: [
    VueRouter({
      root: dashboardRoot,
      routesFolder: 'src/pages',
      extensions: ['.vue'],
      dts: 'typed-router.d.ts',
      watch: false,
    }),
    dashboardVuePlugin,
    createVueOxcTsconfigGuard(dashboardVuePlugin, 'dashboard-vue-oxc-tsconfig-guard'),
    WeappTailwindcss({
      // Dashboard 是 Web SPA，显式选择 generic Vite 分支，避免被 monorepo 根目录识别为小程序项目。
      appType: 'native',
      cssEntries: [resolve(dashboardRoot, 'src/style.css')],
      generator: {
        target: 'web',
      },
      logLevel: 'silent',
      tailwindcssBasedir: dashboardRoot,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(dashboardRoot, 'src'),
    },
  },
  build: {
    outDir: resolve(dashboardRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: resolveDashboardChunk,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: resolveDashboardChunk,
            },
          ],
        },
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
