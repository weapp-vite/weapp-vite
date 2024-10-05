import path from 'node:path'
// import.meta.dirname
/** @type {import('tailwindcss').Config} */
export default {
  // vite plugin watch files 爆炸
  content: [
    'pages/**/*.{wxml,js,ts}',
    // '!node_modules',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    // 小程序不需要 preflight，因为这主要是给 h5 的，如果你要同时开发小程序和 h5 端，你应该使用环境变量来控制它
    preflight: false,
  },
}
