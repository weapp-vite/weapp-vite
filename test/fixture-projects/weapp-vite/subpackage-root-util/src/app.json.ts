export default {
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'Subpackage Root Util Fixture',
  },
  style: 'v2',
  subPackages: [
    {
      root: 'packageA',
      pages: [
        'pages/foo',
      ],
    },
  ],
}
