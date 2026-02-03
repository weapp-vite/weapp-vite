const require_common = require("../../../common.js");
var label = "script-setup-only";
require_common.Dr({ setup(__props, { expose }) {
	const __returned__ = { label };
	Object.defineProperty(__returned__, "__isScriptSetup", {
		enumerable: false,
		value: true
	});
	return __returned__;
} });
