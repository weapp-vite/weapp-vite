/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // 不能在根目录这样写 vite 会把这都作为依赖，导致 watch files 爆炸
    // '**/*.{wxml,js,ts}',
    // '!node_modules',
    // '!dist',
    // '!packageA',
    // '!packageB',
    'components/**/*.{wxml,js,ts}',
    'pages/**/*.{wxml,js,ts}',
    'packageA/**/*.{wxml,js,ts}',
    'packageB/**/*.{wxml,js,ts}',
    'packageC/**/*.{wxml,js,ts}',
    'custom-tab-bar/**/*.{wxml,js,ts}',
    'subpackage-demos/**/*.{wxml,js,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    // 小程序不需要 preflight，因为这主要是给 h5 的，如果你要同时开发小程序和 h5 端，你应该使用环境变量来控制它
    preflight: false,
    container: false,
  },
}
