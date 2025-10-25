import type { App } from 'weapp-vite/json'

export default <App>{
  pages: [
    'pages/index/index',
  ],
  subPackages: [
    {
      root: 'packageB',
      name: 'independent',
      pages: [
        'pages/dead-end/index',
      ],
      independent: true,
    },
  ],
}
