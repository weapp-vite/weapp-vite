import { defineConfig } from 'vite'


export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_APP_NAME': '"experimental"'
    },
    root: import.meta.dirname,
    build: {
      outDir: 'dist-build-config',
      minify: true
    }
  }
})