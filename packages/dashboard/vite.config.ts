import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import { createVueOxcTsconfigGuard } from '../../scripts/vite/vueOxcTsconfigGuard'

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
  root: __dirname,
  base: './',
  appType: 'spa',
  publicDir: false,
  server: dashboardDevServer,
  preview: dashboardDevServer,
  plugins: [
    VueRouter({
      root: __dirname,
      routesFolder: 'src/pages',
      extensions: ['.vue'],
      dts: 'typed-router.d.ts',
      watch: false,
    }),
    dashboardVuePlugin,
    createVueOxcTsconfigGuard(dashboardVuePlugin, 'dashboard-vue-oxc-tsconfig-guard'),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
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
