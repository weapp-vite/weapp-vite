/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
import 'wevu/router';

declare module 'weapp-vite/auto-routes' {
    export type AutoRoutesPages = [
        "pages/issue-289/computed-class/index",
        "pages/issue-289/index",
        "pages/issue-289/map-class/index",
        "pages/issue-289/object-literal/index",
        "pages/issue-289/root-class/index",
        "pages/issue-294/index",
        "pages/issue-297-setup-method-calls/index",
        "pages/issue-297/index",
        "pages/issue-300/index",
        "pages/issue-302/index",
        "pages/issue-309-created/index",
        "pages/issue-309/index",
        "pages/issue-312/index",
        "pages/issue-316/index",
        "pages/issue-318/index",
        "pages/issue-320/index",
        "pages/issue-322/index",
        "pages/issue-328/index"
    ];
    export type AutoRoutesEntries = [
        "pages/issue-289/computed-class/index",
        "pages/issue-289/index",
        "pages/issue-289/map-class/index",
        "pages/issue-289/object-literal/index",
        "pages/issue-289/root-class/index",
        "pages/issue-294/index",
        "pages/issue-297-setup-method-calls/index",
        "pages/issue-297/index",
        "pages/issue-300/index",
        "pages/issue-302/index",
        "pages/issue-309-created/index",
        "pages/issue-309/index",
        "pages/issue-312/index",
        "pages/issue-316/index",
        "pages/issue-318/index",
        "pages/issue-320/index",
        "pages/issue-322/index",
        "pages/issue-328/index",
        "subpackages/issue-327/index",
        "subpackages/item/index",
        "subpackages/item/issue-340-shared",
        "subpackages/item/login-required/index",
        "subpackages/user/index",
        "subpackages/user/register/form"
    ];
    export type AutoRoutesSubPackages = [
        {
            readonly root: "subpackages/issue-327";
            readonly pages: [
                "index"
            ];
            [k: string]: unknown;
        },
        {
            readonly root: "subpackages/item";
            readonly pages: [
                "index",
                "issue-340-shared",
                "login-required/index"
            ];
            [k: string]: unknown;
        },
        {
            readonly root: "subpackages/user";
            readonly pages: [
                "index",
                "register/form"
            ];
            [k: string]: unknown;
        }
    ];
    export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];
    export interface AutoRoutes {
        readonly pages: AutoRoutesPages;
        readonly entries: AutoRoutesEntries;
        readonly subPackages: AutoRoutesSubPackages;
    }
    export type AutoRouteEntry = AutoRoutesEntries[number];
    export type AutoRoutesRelativeUrl = `./${string}` | `../${string}`;
    export type AutoRoutesAbsoluteUrl<Path extends string> = Path | `/${Path}` | `${Path}?${string}` | `/${Path}?${string}`;
    export type AutoRoutesUrl = AutoRoutesAbsoluteUrl<AutoRouteEntry> | AutoRoutesRelativeUrl;
    export type AutoRouteNavigateOption = {
        readonly url: AutoRoutesUrl;
    } & Record<string, any>;
    export interface AutoRoutesWxRouter {
        switchTab: (option: AutoRouteNavigateOption) => unknown;
        reLaunch: (option: AutoRouteNavigateOption) => unknown;
        redirectTo: (option: AutoRouteNavigateOption) => unknown;
        navigateTo: (option: AutoRouteNavigateOption) => unknown;
        navigateBack: (option?: Record<string, any>) => unknown;
    }
    export const routes: AutoRoutes;
    export const pages: AutoRoutesPages;
    export const entries: AutoRoutesEntries;
    export const subPackages: AutoRoutesSubPackages;
    export const wxRouter: AutoRoutesWxRouter;
    export default routes;
}

declare module 'wevu/router' {
    interface WevuTypedRouterRouteMap {
        entries: import('weapp-vite/auto-routes').AutoRoutesEntries[number];
    }
}
