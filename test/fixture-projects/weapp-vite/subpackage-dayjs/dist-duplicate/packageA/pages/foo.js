const require_rolldown_runtime = require("../rolldown-runtime.js");
const require_weapp_shared_virtual_packageA_packageB_common = require("../weapp-shared/common.js");
var now = (0, (/* @__PURE__ */ require_rolldown_runtime.__toESM(require_weapp_shared_virtual_packageA_packageB_common.require_dayjs_min(), 1)).default)();
Page({
	data: {
		shared: require_weapp_shared_virtual_packageA_packageB_common.buildSharedMessage("packageA"),
		formattedNow: now.format("YYYY-MM-DD HH:mm:ss"),
		tomorrow: now.add(1, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageA foo loaded");
	}
});
//#endregion
