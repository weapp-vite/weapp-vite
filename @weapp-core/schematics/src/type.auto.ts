/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * 全局配置, 小程序根目录下的 app.json 文件用来对微信小程序进行全局配置。
 */
export interface App {
  /**
   * 指定小程序的默认启动路径（首页），常见情景是从微信聊天列表页下拉启动、小程序列表启动等。如果不填，将默认为 pages 列表的第一项。不支持带页面路径参数。
   */
  entryPagePath?: string;
  /**
   * 用于指定小程序由哪些页面组成，每一项都对应一个页面的 路径（含文件名） 信息。文件名不需要写文件后缀，框架会自动去寻找对应位置的 .json, .js, .wxml, .wxss 四个文件进行处理。
   */
  pages: string[];
  window?: {
    navigationBarBackgroundColor?: string;
    navigationBarTextStyle?: string;
    navigationBarTitleText?: string;
    navigationStyle?: "default" | "custom";
    homeButton?: boolean;
    backgroundColor?: string;
    backgroundTextStyle?: "dark" | "light";
    backgroundColorTop?: string;
    backgroundColorBottom?: string;
    enablePullDownRefresh?: boolean;
    onReachBottomDistance?: number;
    pageOrientation?: "portrait" | "auto" | "landscape";
    restartStrategy?: "homePage" | "homePageAndLatestPage";
    initialRenderingCache?: "static" | "dynamic";
    visualEffectInBackground?: "none" | "hidden";
    handleWebviewPreload?: "static" | "manual" | "auto";
    [k: string]: unknown;
  };
  tabBar?: {
    color: string;
    selectedColor: string;
    backgroundColor: string;
    borderStyle?: "black" | "white";
    /**
     * @minItems 2
     * @maxItems 5
     */
    list:
      | [
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          }
        ]
      | [
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          }
        ]
      | [
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          }
        ]
      | [
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          },
          {
            pagePath: string;
            text: string;
            iconPath?: string;
            selectedIconPath?: string;
            [k: string]: unknown;
          }
        ];
    position?: "bottom" | "top";
    custom?: boolean;
    [k: string]: unknown;
  };
  networkTimeout?: {
    request?: number;
    connectSocket?: number;
    uploadFile?: number;
    downloadFile?: number;
    [k: string]: unknown;
  };
  debug?: boolean;
  functionalPages?: boolean;
  subpackages?: {
    root?: string;
    name?: string;
    pages?: string[];
    independent?: boolean;
    entry?: string;
    [k: string]: unknown;
  }[];
  workers?: string;
  requiredBackgroundModes?: string[];
  requiredPrivateInfos?: string[];
  plugins?: {
    [k: string]: unknown;
  };
  preloadRule?: {
    [k: string]: unknown;
  };
  resizable?: boolean;
  permission?: {
    [k: string]: unknown;
  };
  sitemapLocation: string;
  useExtendedLib?: {
    [k: string]: unknown;
  };
  entranceDeclare?: {
    [k: string]: unknown;
  };
  darkmode?: boolean;
  themeLocation?: string;
  lazyCodeLoading?: string;
  supportedMaterials?: {
    [k: string]: unknown;
  };
  serviceProviderTicket?: string;
  embeddedAppIdList?: string[];
  halfPage?: {
    [k: string]: unknown;
  };
  debugOptions?: {
    [k: string]: unknown;
  };
  resolveAlias?: {
    [k: string]: unknown;
  };
  miniApp?: {
    [k: string]: unknown;
  };
  static?: {
    [k: string]: unknown;
  };
  convertRpxToVw?: boolean;
  style?: string;
  singlePage?: {
    [k: string]: unknown;
  };
  enablePassiveEvent?:
    | {
        [k: string]: unknown;
      }
    | boolean;
  renderer?: "webview" | "skyline";
  rendererOptions?: {
    skyline?: {
      defaultDisplayBlock?: boolean;
      defaultContentBox?: boolean;
      disableABTest?: boolean;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  usingComponents?: {
    [k: string]: unknown;
  };
  componentFramework?: string;
  $schema?: string;
  [k: string]: unknown;
}

/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * 自定义组件配置
 */
export interface Component {
  component?: boolean;
  styleIsolation?: "isolated" | "apply-shared" | "shared";
  componentGenerics?: {
    [k: string]: unknown;
  };
  componentPlaceholder?: {
    [k: string]: unknown;
  };
  usingComponents?: {
    [k: string]: unknown;
  };
  componentFramework?: string;
  $schema?: string;
  [k: string]: unknown;
}

/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * 页面配置, 支持对单个页面进行配置，可以在页面对应的 .json 文件来对本页面的表现进行配置
 */
export interface Page {
  backgroundColorContent?: string;
  disableScroll?: boolean;
  styleIsolation?: "page-isolated" | "page-apply-shared" | "page-shared";
  style?: string;
  singlePage?: {
    [k: string]: unknown;
  };
  enablePassiveEvent?:
    | {
        [k: string]: unknown;
      }
    | boolean;
  renderer?: "webview" | "skyline";
  rendererOptions?: {
    skyline?: {
      defaultDisplayBlock?: boolean;
      defaultContentBox?: boolean;
      disableABTest?: boolean;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  usingComponents?: {
    [k: string]: unknown;
  };
  componentFramework?: string;
  $schema?: string;
  componentPlaceholder?: {
    [k: string]: unknown;
  };
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: string;
  navigationBarTitleText?: string;
  navigationStyle?: "default" | "custom";
  homeButton?: boolean;
  backgroundColor?: string;
  backgroundTextStyle?: "dark" | "light";
  backgroundColorTop?: string;
  backgroundColorBottom?: string;
  enablePullDownRefresh?: boolean;
  onReachBottomDistance?: number;
  pageOrientation?: "portrait" | "auto" | "landscape";
  restartStrategy?: "homePage" | "homePageAndLatestPage";
  initialRenderingCache?: "static" | "dynamic";
  visualEffectInBackground?: "none" | "hidden";
  handleWebviewPreload?: "static" | "manual" | "auto";
  [k: string]: unknown;
}
