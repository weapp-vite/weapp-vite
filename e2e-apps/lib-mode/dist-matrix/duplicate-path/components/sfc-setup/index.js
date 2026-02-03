const require_dist = require("../../dist.js");
var label = "script-setup-only";
require_dist.Dr({ setup(__props, { expose }) {
	const __returned__ = { label };
	Object.defineProperty(__returned__, "__isScriptSetup", {
		enumerable: false,
		value: true
	});
	return __returned__;
} });
