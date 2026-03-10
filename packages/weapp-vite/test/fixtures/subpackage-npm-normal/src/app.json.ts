export default {
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'Subpackage Npm Normal',
  },
  style: 'v2',
  subPackages: [
    {
      root: 'packageA',
      pages: [
        'pages/foo',
      ],
    },
    {
      root: 'packageB',
      pages: [
        'pages/bar',
      ],
    },
  ],
}
