// vite.config.ts
import { defineConfig } from "file:///Users/icebreaker/Documents/GitHub/weapp-tailwindcss/packages/weapp-vite/src/config.ts";
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from "file:///Users/icebreaker/Documents/GitHub/weapp-tailwindcss/packages/weapp-tailwindcss/dist/vite.mjs";
var vite_config_default = defineConfig({
  // root: './packageA',
  // build: {
  //   outDir: 'dist/packageA',
  // },
  // weapp: {
  //   srcRoot: 'packageA',
  //   subPackage: {
  //   },
  //   // srcRoot: 'src',
  // },
  plugins: [
    // @ts-ignore
    uvwt({
      rem2rpx: true
    })
  ]
  // build: {
  //   rollupOptions: {
  //     external: ['lodash'],
  //   },
  // },
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaWNlYnJlYWtlci9Eb2N1bWVudHMvR2l0SHViL3dlYXBwLXRhaWx3aW5kY3NzL2FwcHMvdml0ZS1uYXRpdmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9pY2VicmVha2VyL0RvY3VtZW50cy9HaXRIdWIvd2VhcHAtdGFpbHdpbmRjc3MvYXBwcy92aXRlLW5hdGl2ZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaWNlYnJlYWtlci9Eb2N1bWVudHMvR2l0SHViL3dlYXBwLXRhaWx3aW5kY3NzL2FwcHMvdml0ZS1uYXRpdmUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd3ZWFwcC12aXRlL2NvbmZpZydcbmltcG9ydCB7IFVuaWZpZWRWaXRlV2VhcHBUYWlsd2luZGNzc1BsdWdpbiBhcyB1dnd0IH0gZnJvbSAnd2VhcHAtdGFpbHdpbmRjc3Mvdml0ZSdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgLy8gcm9vdDogJy4vcGFja2FnZUEnLFxuICAvLyBidWlsZDoge1xuICAvLyAgIG91dERpcjogJ2Rpc3QvcGFja2FnZUEnLFxuICAvLyB9LFxuICAvLyB3ZWFwcDoge1xuICAvLyAgIHNyY1Jvb3Q6ICdwYWNrYWdlQScsXG4gIC8vICAgc3ViUGFja2FnZToge1xuXG4gIC8vICAgfSxcbiAgLy8gICAvLyBzcmNSb290OiAnc3JjJyxcbiAgLy8gfSxcbiAgcGx1Z2luczogW1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB1dnd0KHtcbiAgICAgIHJlbTJycHg6IHRydWUsXG4gICAgfSksXG4gIF0sXG4gIC8vIGJ1aWxkOiB7XG4gIC8vICAgcm9sbHVwT3B0aW9uczoge1xuICAvLyAgICAgZXh0ZXJuYWw6IFsnbG9kYXNoJ10sXG4gIC8vICAgfSxcbiAgLy8gfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlZLFNBQVMsb0JBQW9CO0FBQzlaLFNBQVMscUNBQXFDLFlBQVk7QUFFMUQsSUFBTyxzQkFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVkxQixTQUFTO0FBQUE7QUFBQSxJQUVQLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYLENBQUM7QUFBQSxFQUNIO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQU1GLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
