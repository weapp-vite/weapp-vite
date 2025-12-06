import { getCrossSharedMessage, getNodeModulesPreview, getSharedPets } from '@/subpackage-demos/cross-subpackage-shared'
import { sharedFlavor } from '@/subpackage-demos/main-and-sub-shared'

Page({
  data: {
    title: 'packageA 分包共享示例',
    crossMessage: getCrossSharedMessage('packageA'),
    nodeModulesPreview: getNodeModulesPreview(),
    sharedFlavors: sharedFlavor('packageA'),
    sharedPets: getSharedPets(),
  },
})
