import { getCrossSharedMessage, getNodeModulesPreview, getSharedPets } from '@/subpackage-demos/cross-subpackage-shared'
import { sharedFlavor } from '@/subpackage-demos/main-and-sub-shared'

Page({
  data: {
    title: 'packageC 分包共享示例',
    crossMessage: getCrossSharedMessage('packageC'),
    nodeModulesPreview: getNodeModulesPreview(),
    sharedFlavors: sharedFlavor('packageC'),
    sharedPets: getSharedPets(),
  },
})
