var Module;
if (!Module) Module = (typeof Module !== "undefined" ? Module : null) || {};
var moduleOverrides = {};
for (var key in Module) {
	if (Module.hasOwnProperty(key)) {
		moduleOverrides[key] = Module[key]
	}
}
var ENVIRONMENT_IS_WEB = typeof window === "object";
var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (ENVIRONMENT_IS_NODE) {
	if (!Module["print"]) Module["print"] = function print(x) {
		process["stdout"].write(x + "\n")
	};
	if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
		process["stderr"].write(x + "\n")
	};
	var nodeFS = require("fs");
	var nodePath = require("path");
	Module["read"] = function read(filename, binary) {
		filename = nodePath["normalize"](filename);
		var ret = nodeFS["readFileSync"](filename);
		if (!ret && filename != nodePath["resolve"](filename)) {
			filename = path.join(__dirname, "..", "src", filename);
			ret = nodeFS["readFileSync"](filename)
		}
		if (ret && !binary) ret = ret.toString();
		return ret
	};
	Module["readBinary"] = function readBinary(filename) {
		return Module["read"](filename, true)
	};
	Module["load"] = function load(f) {
		globalEval(read(f))
	};
	if (!Module["thisProgram"]) {
		if (process["argv"].length > 1) {
			Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
		} else {
			Module["thisProgram"] = "unknown-program"
		}
	}
	Module["arguments"] = process["argv"].slice(2);
	if (typeof module !== "undefined") {
		module["exports"] = Module
	}

	
	process["on"]("uncaughtException", (function (ex) {
		if (!(ex instanceof ExitStatus)) {
			throw ex
		}
	}));
	Module["inspect"] = (function () {
		return "[Emscripten Module object]"
	})
} else if (ENVIRONMENT_IS_SHELL) {
	if (!Module["print"]) Module["print"] = print;
	if (typeof printErr != "undefined") Module["printErr"] = printErr;
	if (typeof read != "undefined") {
		Module["read"] = read
	} else {
		Module["read"] = function read() {
			throw "no read() available (jsc?)"
		}
	}
	Module["readBinary"] = function readBinary(f) {
		if (typeof readbuffer === "function") {
			return new Uint8Array(readbuffer(f))
		}
		var data = read(f, "binary");
		assert(typeof data === "object");
		return data
	};
	if (typeof scriptArgs != "undefined") {
		Module["arguments"] = scriptArgs
	} else if (typeof arguments != "undefined") {
		Module["arguments"] = arguments
	}
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
	Module["read"] = function read(url) {
		var xhr = new XMLHttpRequest;
		xhr.open("GET", url, false);
		xhr.send(null);
		return xhr.responseText
	};
	if (typeof arguments != "undefined") {
		Module["arguments"] = arguments
	}
	if (typeof console !== "undefined") {
		if (!Module["print"]) Module["print"] = function print(x) {
			console.log(x)
		};
		if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
			console.log(x)
		}
	} else {
		var TRY_USE_DUMP = false;
		if (!Module["print"]) Module["print"] = TRY_USE_DUMP && typeof dump !== "undefined" ? (function (x) {
			dump(x)
		}) : (function (x) {})
	}
	if (ENVIRONMENT_IS_WORKER) {
		Module["load"] = importScripts
	}
	if (typeof Module["setWindowTitle"] === "undefined") {
		Module["setWindowTitle"] = (function (title) {
			document.title = title
		})
	}
} else {
	throw "Unknown runtime environment. Where are we?"
}

function globalEval(x) {
	eval.call(null, x)
}
if (!Module["load"] && Module["read"]) {
	Module["load"] = function load(f) {
		globalEval(Module["read"](f))
	}
}
if (!Module["print"]) {
	Module["print"] = (function () {})
}
if (!Module["printErr"]) {
	Module["printErr"] = Module["print"]
}
if (!Module["arguments"]) {
	Module["arguments"] = []
}
if (!Module["thisProgram"]) {
	Module["thisProgram"] = "./this.program"
}
Module.print = Module["print"];
Module.printErr = Module["printErr"];
Module["preRun"] = [];
Module["postRun"] = [];
for (var key in moduleOverrides) {
	if (moduleOverrides.hasOwnProperty(key)) {
		Module[key] = moduleOverrides[key]
	}
}
var Runtime = {
	setTempRet0: (function (value) {
		tempRet0 = value
	}),
	getTempRet0: (function () {
		return tempRet0
	}),
	stackSave: (function () {
		return STACKTOP
	}),
	stackRestore: (function (stackTop) {
		STACKTOP = stackTop
	}),
	getNativeTypeSize: (function (type) {
		switch (type) {
			case "i1":
			case "i8":
				return 1;
			case "i16":
				return 2;
			case "i32":
				return 4;
			case "i64":
				return 8;
			case "float":
				return 4;
			case "double":
				return 8;
			default:
				{
					if (type[type.length - 1] === "*") {
						return Runtime.QUANTUM_SIZE
					} else if (type[0] === "i") {
						var bits = parseInt(type.substr(1));
						assert(bits % 8 === 0);
						return bits / 8
					} else {
						return 0
					}
				}
		}
	}),
	getNativeFieldSize: (function (type) {
		return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE)
	}),
	STACK_ALIGN: 16,
	prepVararg: (function (ptr, type) {
		if (type === "double" || type === "i64") {
			if (ptr & 7) {
				assert((ptr & 7) === 4);
				ptr += 4
			}
		} else {
			assert((ptr & 3) === 0)
		}
		return ptr
	}),
	getAlignSize: (function (type, size, vararg) {
		if (!vararg && (type == "i64" || type == "double")) return 8;
		if (!type) return Math.min(size, 8);
		return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE)
	}),
	dynCall: (function (sig, ptr, args) {
		if (args && args.length) {
			if (!args.splice) args = Array.prototype.slice.call(args);
			args.splice(0, 0, ptr);
			return Module["dynCall_" + sig].apply(null, args)
		} else {
			return Module["dynCall_" + sig].call(null, ptr)
		}
	}),
	functionPointers: [],
	addFunction: (function (func) {
		for (var i = 0; i < Runtime.functionPointers.length; i++) {
			if (!Runtime.functionPointers[i]) {
				Runtime.functionPointers[i] = func;
				return 2 * (1 + i)
			}
		}
		throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS."
	}),
	removeFunction: (function (index) {
		Runtime.functionPointers[(index - 2) / 2] = null
	}),
	warnOnce: (function (text) {
		if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
		if (!Runtime.warnOnce.shown[text]) {
			Runtime.warnOnce.shown[text] = 1;
			Module.printErr(text)
		}
	}),
	funcWrappers: {},
	getFuncWrapper: (function (func, sig) {
		assert(sig);
		if (!Runtime.funcWrappers[sig]) {
			Runtime.funcWrappers[sig] = {}
		}
		var sigCache = Runtime.funcWrappers[sig];
		if (!sigCache[func]) {
			sigCache[func] = function dynCall_wrapper() {
				return Runtime.dynCall(sig, func, arguments)
			}
		}
		return sigCache[func]
	}),
	getCompilerSetting: (function (name) {
		throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work"
	}),
	stackAlloc: (function (size) {
		var ret = STACKTOP;
		STACKTOP = STACKTOP + size | 0;
		STACKTOP = STACKTOP + 15 & -16;
		return ret
	}),
	staticAlloc: (function (size) {
		var ret = STATICTOP;
		STATICTOP = STATICTOP + size | 0;
		STATICTOP = STATICTOP + 15 & -16;
		return ret
	}),
	dynamicAlloc: (function (size) {
		var ret = DYNAMICTOP;
		DYNAMICTOP = DYNAMICTOP + size | 0;
		DYNAMICTOP = DYNAMICTOP + 15 & -16;
		if (DYNAMICTOP >= TOTAL_MEMORY) {
			var success = enlargeMemory();
			if (!success) {
				DYNAMICTOP = ret;
				return 0
			}
		}
		return ret
	}),
	alignMemory: (function (size, quantum) {
		var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
		return ret
	}),
	makeBigInt: (function (low, high, unsigned) {
		var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
		return ret
	}),
	GLOBAL_BASE: 8,
	QUANTUM_SIZE: 4,
	__dummy__: 0
};
Module["Runtime"] = Runtime;
var __THREW__ = 0;
var ABORT = false;
var EXITSTATUS = 0;
var undef = 0;
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
	if (!condition) {
		abort("Assertion failed: " + text)
	}
}
var globalScope = this;

function getCFunc(ident) {
	var func = Module["_" + ident];
	if (!func) {
		try {
			func = eval("_" + ident)
		} catch (e) {}
	}
	assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
	return func
}
var cwrap, ccall;
((function () {
	var JSfuncs = {
		"stackSave": (function () {
			Runtime.stackSave()
		}),
		"stackRestore": (function () {
			Runtime.stackRestore()
		}),
		"arrayToC": (function (arr) {
			var ret = Runtime.stackAlloc(arr.length);
			writeArrayToMemory(arr, ret);
			return ret
		}),
		"stringToC": (function (str) {
			var ret = 0;
			if (str !== null && str !== undefined && str !== 0) {
				ret = Runtime.stackAlloc((str.length << 2) + 1);
				writeStringToMemory(str, ret)
			}
			return ret
		})
	};
	var toC = {
		"string": JSfuncs["stringToC"],
		"array": JSfuncs["arrayToC"]
	};
	ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
		var func = getCFunc(ident);
		var cArgs = [];
		var stack = 0;
		if (args) {
			for (var i = 0; i < args.length; i++) {
				var converter = toC[argTypes[i]];
				if (converter) {
					if (stack === 0) stack = Runtime.stackSave();
					cArgs[i] = converter(args[i])
				} else {
					cArgs[i] = args[i]
				}
			}
		}
		var ret = func.apply(null, cArgs);
		if (returnType === "string") ret = Pointer_stringify(ret);
		if (stack !== 0) {
			if (opts && opts.async) {
				EmterpreterAsync.asyncFinalizers.push((function () {
					Runtime.stackRestore(stack)
				}));
				return
			}
			Runtime.stackRestore(stack)
		}
		return ret
	};
	var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;

	function parseJSFunc(jsfunc) {
		var parsed = jsfunc.toString().match(sourceRegex).slice(1);
		return {
			arguments: parsed[0],
			body: parsed[1],
			returnValue: parsed[2]
		}
	}
	var JSsource = {};
	for (var fun in JSfuncs) {
		if (JSfuncs.hasOwnProperty(fun)) {
			JSsource[fun] = parseJSFunc(JSfuncs[fun])
		}
	}
	cwrap = function cwrap(ident, returnType, argTypes) {
		argTypes = argTypes || [];
		var cfunc = getCFunc(ident);
		var numericArgs = argTypes.every((function (type) {
			return type === "number"
		}));
		var numericRet = returnType !== "string";
		if (numericRet && numericArgs) {
			return cfunc
		}
		var argNames = argTypes.map((function (x, i) {
			return "$" + i
		}));
		var funcstr = "(function(" + argNames.join(",") + ") {";
		var nargs = argTypes.length;
		if (!numericArgs) {
			funcstr += "var stack = " + JSsource["stackSave"].body + ";";
			for (var i = 0; i < nargs; i++) {
				var arg = argNames[i],
					type = argTypes[i];
				if (type === "number") continue;
				var convertCode = JSsource[type + "ToC"];
				funcstr += "var " + convertCode.arguments + " = " + arg + ";";
				funcstr += convertCode.body + ";";
				funcstr += arg + "=" + convertCode.returnValue + ";"
			}
		}
		var cfuncname = parseJSFunc((function () {
			return cfunc
		})).returnValue;
		funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
		if (!numericRet) {
			var strgfy = parseJSFunc((function () {
				return Pointer_stringify
			})).returnValue;
			funcstr += "ret = " + strgfy + "(ret);"
		}
		if (!numericArgs) {
			funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";"
		}
		funcstr += "return ret})";
		return eval(funcstr)
	}
}))();
Module["cwrap"] = cwrap;
Module["ccall"] = ccall;

function setValue(ptr, value, type, noSafe) {
	type = type || "i8";
	if (type.charAt(type.length - 1) === "*") type = "i32";
	switch (type) {
		case "i1":
			HEAP8[ptr >> 0] = value;
			break;
		case "i8":
			HEAP8[ptr >> 0] = value;
			break;
		case "i16":
			HEAP16[ptr >> 1] = value;
			break;
		case "i32":
			HEAP32[ptr >> 2] = value;
			break;
		case "i64":
			tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
			break;
		case "float":
			HEAPF32[ptr >> 2] = value;
			break;
		case "double":
			HEAPF64[ptr >> 3] = value;
			break;
		default:
			abort("invalid type for setValue: " + type)
	}
}
Module["setValue"] = setValue;

function getValue(ptr, type, noSafe) {
	type = type || "i8";
	if (type.charAt(type.length - 1) === "*") type = "i32";
	switch (type) {
		case "i1":
			return HEAP8[ptr >> 0];
		case "i8":
			return HEAP8[ptr >> 0];
		case "i16":
			return HEAP16[ptr >> 1];
		case "i32":
			return HEAP32[ptr >> 2];
		case "i64":
			return HEAP32[ptr >> 2];
		case "float":
			return HEAPF32[ptr >> 2];
		case "double":
			return HEAPF64[ptr >> 3];
		default:
			abort("invalid type for setValue: " + type)
	}
	return null
}
Module["getValue"] = getValue;
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_STATIC = 2;
var ALLOC_DYNAMIC = 3;
var ALLOC_NONE = 4;
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

function allocate(slab, types, allocator, ptr) {
	var zeroinit, size;
	if (typeof slab === "number") {
		zeroinit = true;
		size = slab
	} else {
		zeroinit = false;
		size = slab.length
	}
	var singleType = typeof types === "string" ? types : null;
	var ret;
	if (allocator == ALLOC_NONE) {
		ret = ptr
	} else {
		ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length))
	}
	if (zeroinit) {
		var ptr = ret,
			stop;
		assert((ret & 3) == 0);
		stop = ret + (size & ~3);
		for (; ptr < stop; ptr += 4) {
			HEAP32[ptr >> 2] = 0
		}
		stop = ret + size;
		while (ptr < stop) {
			HEAP8[ptr++ >> 0] = 0
		}
		return ret
	}
	if (singleType === "i8") {
		if (slab.subarray || slab.slice) {
			HEAPU8.set(slab, ret)
		} else {
			HEAPU8.set(new Uint8Array(slab), ret)
		}
		return ret
	}
	var i = 0,
		type, typeSize, previousType;
	while (i < size) {
		var curr = slab[i];
		if (typeof curr === "function") {
			curr = Runtime.getFunctionIndex(curr)
		}
		type = singleType || types[i];
		if (type === 0) {
			i++;
			continue
		}
		if (type == "i64") type = "i32";
		setValue(ret + i, curr, type);
		if (previousType !== type) {
			typeSize = Runtime.getNativeTypeSize(type);
			previousType = type
		}
		i += typeSize
	}
	return ret
}
Module["allocate"] = allocate;

function getMemory(size) {
	if (!staticSealed) return Runtime.staticAlloc(size);
	if (typeof _sbrk !== "undefined" && !_sbrk.called || !runtimeInitialized) return Runtime.dynamicAlloc(size);
	return _malloc(size)
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, length) {
	if (length === 0 || !ptr) return "";
	var hasUtf = 0;
	var t;
	var i = 0;
	while (1) {
		t = HEAPU8[ptr + i >> 0];
		hasUtf |= t;
		if (t == 0 && !length) break;
		i++;
		if (length && i == length) break
	}
	if (!length) length = i;
	var ret = "";
	if (hasUtf < 128) {
		var MAX_CHUNK = 1024;
		var curr;
		while (length > 0) {
			curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
			ret = ret ? ret + curr : curr;
			ptr += MAX_CHUNK;
			length -= MAX_CHUNK
		}
		return ret
	}
	return Module["UTF8ToString"](ptr)
}
Module["Pointer_stringify"] = Pointer_stringify;

function AsciiToString(ptr) {
	var str = "";
	while (1) {
		var ch = HEAP8[ptr++ >> 0];
		if (!ch) return str;
		str += String.fromCharCode(ch)
	}
}
Module["AsciiToString"] = AsciiToString;

function stringToAscii(str, outPtr) {
	return writeAsciiToMemory(str, outPtr, false)
}
Module["stringToAscii"] = stringToAscii;

function UTF8ArrayToString(u8Array, idx) {
	var u0, u1, u2, u3, u4, u5;
	var str = "";
	while (1) {
		u0 = u8Array[idx++];
		if (!u0) return str;
		if (!(u0 & 128)) {
			str += String.fromCharCode(u0);
			continue
		}
		u1 = u8Array[idx++] & 63;
		if ((u0 & 224) == 192) {
			str += String.fromCharCode((u0 & 31) << 6 | u1);
			continue
		}
		u2 = u8Array[idx++] & 63;
		if ((u0 & 240) == 224) {
			u0 = (u0 & 15) << 12 | u1 << 6 | u2
		} else {
			u3 = u8Array[idx++] & 63;
			if ((u0 & 248) == 240) {
				u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
			} else {
				u4 = u8Array[idx++] & 63;
				if ((u0 & 252) == 248) {
					u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
				} else {
					u5 = u8Array[idx++] & 63;
					u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
				}
			}
		}
		if (u0 < 65536) {
			str += String.fromCharCode(u0)
		} else {
			var ch = u0 - 65536;
			str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
		}
	}
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

function UTF8ToString(ptr) {
	return UTF8ArrayToString(HEAPU8, ptr)
}
Module["UTF8ToString"] = UTF8ToString;

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
	if (!(maxBytesToWrite > 0)) return 0;
	var startIdx = outIdx;
	var endIdx = outIdx + maxBytesToWrite - 1;
	for (var i = 0; i < str.length; ++i) {
		var u = str.charCodeAt(i);
		if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
		if (u <= 127) {
			if (outIdx >= endIdx) break;
			outU8Array[outIdx++] = u
		} else if (u <= 2047) {
			if (outIdx + 1 >= endIdx) break;
			outU8Array[outIdx++] = 192 | u >> 6;
			outU8Array[outIdx++] = 128 | u & 63
		} else if (u <= 65535) {
			if (outIdx + 2 >= endIdx) break;
			outU8Array[outIdx++] = 224 | u >> 12;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63
		} else if (u <= 2097151) {
			if (outIdx + 3 >= endIdx) break;
			outU8Array[outIdx++] = 240 | u >> 18;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63
		} else if (u <= 67108863) {
			if (outIdx + 4 >= endIdx) break;
			outU8Array[outIdx++] = 248 | u >> 24;
			outU8Array[outIdx++] = 128 | u >> 18 & 63;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63
		} else {
			if (outIdx + 5 >= endIdx) break;
			outU8Array[outIdx++] = 252 | u >> 30;
			outU8Array[outIdx++] = 128 | u >> 24 & 63;
			outU8Array[outIdx++] = 128 | u >> 18 & 63;
			outU8Array[outIdx++] = 128 | u >> 12 & 63;
			outU8Array[outIdx++] = 128 | u >> 6 & 63;
			outU8Array[outIdx++] = 128 | u & 63
		}
	}
	outU8Array[outIdx] = 0;
	return outIdx - startIdx
}
Module["stringToUTF8Array"] = stringToUTF8Array;

function stringToUTF8(str, outPtr, maxBytesToWrite) {
	return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
Module["stringToUTF8"] = stringToUTF8;

function lengthBytesUTF8(str) {
	var len = 0;
	for (var i = 0; i < str.length; ++i) {
		var u = str.charCodeAt(i);
		if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
		if (u <= 127) {
			++len
		} else if (u <= 2047) {
			len += 2
		} else if (u <= 65535) {
			len += 3
		} else if (u <= 2097151) {
			len += 4
		} else if (u <= 67108863) {
			len += 5
		} else {
			len += 6
		}
	}
	return len
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

function UTF16ToString(ptr) {
	var i = 0;
	var str = "";
	while (1) {
		var codeUnit = HEAP16[ptr + i * 2 >> 1];
		if (codeUnit == 0) return str;
		++i;
		str += String.fromCharCode(codeUnit)
	}
}
Module["UTF16ToString"] = UTF16ToString;

function stringToUTF16(str, outPtr, maxBytesToWrite) {
	if (maxBytesToWrite === undefined) {
		maxBytesToWrite = 2147483647
	}
	if (maxBytesToWrite < 2) return 0;
	maxBytesToWrite -= 2;
	var startPtr = outPtr;
	var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
	for (var i = 0; i < numCharsToWrite; ++i) {
		var codeUnit = str.charCodeAt(i);
		HEAP16[outPtr >> 1] = codeUnit;
		outPtr += 2
	}
	HEAP16[outPtr >> 1] = 0;
	return outPtr - startPtr
}
Module["stringToUTF16"] = stringToUTF16;

function lengthBytesUTF16(str) {
	return str.length * 2
}
Module["lengthBytesUTF16"] = lengthBytesUTF16;

function UTF32ToString(ptr) {
	var i = 0;
	var str = "";
	while (1) {
		var utf32 = HEAP32[ptr + i * 4 >> 2];
		if (utf32 == 0) return str;
		++i;
		if (utf32 >= 65536) {
			var ch = utf32 - 65536;
			str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
		} else {
			str += String.fromCharCode(utf32)
		}
	}
}
Module["UTF32ToString"] = UTF32ToString;

function stringToUTF32(str, outPtr, maxBytesToWrite) {
	if (maxBytesToWrite === undefined) {
		maxBytesToWrite = 2147483647
	}
	if (maxBytesToWrite < 4) return 0;
	var startPtr = outPtr;
	var endPtr = startPtr + maxBytesToWrite - 4;
	for (var i = 0; i < str.length; ++i) {
		var codeUnit = str.charCodeAt(i);
		if (codeUnit >= 55296 && codeUnit <= 57343) {
			var trailSurrogate = str.charCodeAt(++i);
			codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
		}
		HEAP32[outPtr >> 2] = codeUnit;
		outPtr += 4;
		if (outPtr + 4 > endPtr) break
	}
	HEAP32[outPtr >> 2] = 0;
	return outPtr - startPtr
}
Module["stringToUTF32"] = stringToUTF32;

function lengthBytesUTF32(str) {
	var len = 0;
	for (var i = 0; i < str.length; ++i) {
		var codeUnit = str.charCodeAt(i);
		if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
		len += 4
	}
	return len
}
Module["lengthBytesUTF32"] = lengthBytesUTF32;

function demangle(func) {
	var hasLibcxxabi = !!Module["___cxa_demangle"];
	if (hasLibcxxabi) {
		try {
			var buf = _malloc(func.length);
			writeStringToMemory(func.substr(1), buf);
			var status = _malloc(4);
			var ret = Module["___cxa_demangle"](buf, 0, 0, status);
			if (getValue(status, "i32") === 0 && ret) {
				return Pointer_stringify(ret)
			}
		} catch (e) {} finally {
			if (buf) _free(buf);
			if (status) _free(status);
			if (ret) _free(ret)
		}
	}
	var i = 3;
	var basicTypes = {
		"v": "void",
		"b": "bool",
		"c": "char",
		"s": "short",
		"i": "int",
		"l": "long",
		"f": "float",
		"d": "double",
		"w": "wchar_t",
		"a": "signed char",
		"h": "unsigned char",
		"t": "unsigned short",
		"j": "unsigned int",
		"m": "unsigned long",
		"x": "long long",
		"y": "unsigned long long",
		"z": "..."
	};
	var subs = [];
	var first = true;

	function dump(x) {
		if (x) Module.print(x);
		Module.print(func);
		var pre = "";
		for (var a = 0; a < i; a++) pre += " ";
		Module.print(pre + "^")
	}

	function parseNested() {
		i++;
		if (func[i] === "K") i++;
		var parts = [];
		while (func[i] !== "E") {
			if (func[i] === "S") {
				i++;
				var next = func.indexOf("_", i);
				var num = func.substring(i, next) || 0;
				parts.push(subs[num] || "?");
				i = next + 1;
				continue
			}
			if (func[i] === "C") {
				parts.push(parts[parts.length - 1]);
				i += 2;
				continue
			}
			var size = parseInt(func.substr(i));
			var pre = size.toString().length;
			if (!size || !pre) {
				i--;
				break
			}
			var curr = func.substr(i + pre, size);
			parts.push(curr);
			subs.push(curr);
			i += pre + size
		}
		i++;
		return parts
	}

	function parse(rawList, limit, allowVoid) {
		limit = limit || Infinity;
		var ret = "",
			list = [];

		function flushList() {
			return "(" + list.join(", ") + ")"
		}
		var name;
		if (func[i] === "N") {
			name = parseNested().join("::");
			limit--;
			if (limit === 0) return rawList ? [name] : name
		} else {
			if (func[i] === "K" || first && func[i] === "L") i++;
			var size = parseInt(func.substr(i));
			if (size) {
				var pre = size.toString().length;
				name = func.substr(i + pre, size);
				i += pre + size
			}
		}
		first = false;
		if (func[i] === "I") {
			i++;
			var iList = parse(true);
			var iRet = parse(true, 1, true);
			ret += iRet[0] + " " + name + "<" + iList.join(", ") + ">"
		} else {
			ret = name
		}
		paramLoop: while (i < func.length && limit-- > 0) {
			var c = func[i++];
			if (c in basicTypes) {
				list.push(basicTypes[c])
			} else {
				switch (c) {
					case "P":
						list.push(parse(true, 1, true)[0] + "*");
						break;
					case "R":
						list.push(parse(true, 1, true)[0] + "&");
						break;
					case "L":
						{
							i++;
							var end = func.indexOf("E", i);
							var size = end - i;list.push(func.substr(i, size));i += size + 2;
							break
						};
					case "A":
						{
							var size = parseInt(func.substr(i));i += size.toString().length;
							if (func[i] !== "_") throw "?";i++;list.push(parse(true, 1, true)[0] + " [" + size + "]");
							break
						};
					case "E":
						break paramLoop;
					default:
						ret += "?" + c;
						break paramLoop
				}
			}
		}
		if (!allowVoid && list.length === 1 && list[0] === "void") list = [];
		if (rawList) {
			if (ret) {
				list.push(ret + "?")
			}
			return list
		} else {
			return ret + flushList()
		}
	}
	var parsed = func;
	try {
		if (func == "Object._main" || func == "_main") {
			return "main()"
		}
		if (typeof func === "number") func = Pointer_stringify(func);
		if (func[0] !== "_") return func;
		if (func[1] !== "_") return func;
		if (func[2] !== "Z") return func;
		switch (func[3]) {
			case "n":
				return "operator new()";
			case "d":
				return "operator delete()"
		}
		parsed = parse()
	} catch (e) {
		parsed += "?"
	}
	if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
		Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling")
	}
	return parsed
}

function demangleAll(text) {
	return text.replace(/__Z[\w\d_]+/g, (function (x) {
		var y = demangle(x);
		return x === y ? x : x + " [" + y + "]"
	}))
}

function jsStackTrace() {
	var err = new Error;
	if (!err.stack) {
		try {
			throw new Error(0)
		} catch (e) {
			err = e
		}
		if (!err.stack) {
			return "(no stack trace available)"
		}
	}
	return err.stack.toString()
}

function stackTrace() {
	return demangleAll(jsStackTrace())
}
Module["stackTrace"] = stackTrace;
var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
	if (x % 4096 > 0) {
		x += 4096 - x % 4096
	}
	return x
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0,
	STATICTOP = 0,
	staticSealed = false;
var STACK_BASE = 0,
	STACKTOP = 0,
	STACK_MAX = 0;
var DYNAMIC_BASE = 0,
	DYNAMICTOP = 0;

function enlargeMemory() {
	abort("Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.")
}
var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 6e8;
var totalMemory = 64 * 1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
	if (totalMemory < 16 * 1024 * 1024) {
		totalMemory *= 2
	} else {
		totalMemory += 16 * 1024 * 1024
	}
}
if (totalMemory !== TOTAL_MEMORY) {
	Module.printErr("increasing TOTAL_MEMORY to " + totalMemory + " to be compliant with the asm.js spec (and given that TOTAL_STACK=" + TOTAL_STACK + ")");
	TOTAL_MEMORY = totalMemory
}
assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "JS engine does not provide full typed array support");
var buffer;
buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
Module["HEAP"] = HEAP;
Module["buffer"] = buffer;
Module["HEAP8"] = HEAP8;
Module["HEAP16"] = HEAP16;
Module["HEAP32"] = HEAP32;
Module["HEAPU8"] = HEAPU8;
Module["HEAPU16"] = HEAPU16;
Module["HEAPU32"] = HEAPU32;
Module["HEAPF32"] = HEAPF32;
Module["HEAPF64"] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
	while (callbacks.length > 0) {
		var callback = callbacks.shift();
		if (typeof callback == "function") {
			callback();
			continue
		}
		var func = callback.func;
		if (typeof func === "number") {
			if (callback.arg === undefined) {
				Runtime.dynCall("v", func)
			} else {
				Runtime.dynCall("vi", func, [callback.arg])
			}
		} else {
			func(callback.arg === undefined ? null : callback.arg)
		}
	}
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
	if (Module["preRun"]) {
		if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
		while (Module["preRun"].length) {
			addOnPreRun(Module["preRun"].shift())
		}
	}
	callRuntimeCallbacks(__ATPRERUN__)
}

function ensureInitRuntime() {
	if (runtimeInitialized) return;
	runtimeInitialized = true;
	callRuntimeCallbacks(__ATINIT__)
}

function preMain() {
	callRuntimeCallbacks(__ATMAIN__)
}

function exitRuntime() {
	callRuntimeCallbacks(__ATEXIT__);
	runtimeExited = true
}

function postRun() {
	if (Module["postRun"]) {
		if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
		while (Module["postRun"].length) {
			addOnPostRun(Module["postRun"].shift())
		}
	}
	callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
	__ATPRERUN__.unshift(cb)
}
Module["addOnPreRun"] = Module.addOnPreRun = addOnPreRun;

function addOnInit(cb) {
	__ATINIT__.unshift(cb)
}
Module["addOnInit"] = Module.addOnInit = addOnInit;

function addOnPreMain(cb) {
	__ATMAIN__.unshift(cb)
}
Module["addOnPreMain"] = Module.addOnPreMain = addOnPreMain;

function addOnExit(cb) {
	__ATEXIT__.unshift(cb)
}
Module["addOnExit"] = Module.addOnExit = addOnExit;

function addOnPostRun(cb) {
	__ATPOSTRUN__.unshift(cb)
}
Module["addOnPostRun"] = Module.addOnPostRun = addOnPostRun;

function intArrayFromString(stringy, dontAddNull, length) {
	var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
	var u8array = new Array(len);
	var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
	if (dontAddNull) u8array.length = numBytesWritten;
	return u8array
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
	var ret = [];
	for (var i = 0; i < array.length; i++) {
		var chr = array[i];
		if (chr > 255) {
			chr &= 255
		}
		ret.push(String.fromCharCode(chr))
	}
	return ret.join("")
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
	var array = intArrayFromString(string, dontAddNull);
	var i = 0;
	while (i < array.length) {
		var chr = array[i];
		HEAP8[buffer + i >> 0] = chr;
		i = i + 1
	}
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
	for (var i = 0; i < array.length; i++) {
		HEAP8[buffer++ >> 0] = array[i]
	}
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
	for (var i = 0; i < str.length; ++i) {
		HEAP8[buffer++ >> 0] = str.charCodeAt(i)
	}
	if (!dontAddNull) HEAP8[buffer >> 0] = 0
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
	if (value >= 0) {
		return value
	}
	return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value
}

function reSign(value, bits, ignore) {
	if (value <= 0) {
		return value
	}
	var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
	if (value >= half && (bits <= 32 || value > half)) {
		value = -2 * half + value
	}
	return value
}
if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5) Math["imul"] = function imul(a, b) {
	var ah = a >>> 16;
	var al = a & 65535;
	var bh = b >>> 16;
	var bl = b & 65535;
	return al * bl + (ah * bl + al * bh << 16) | 0
};
Math.imul = Math["imul"];
if (!Math["clz32"]) Math["clz32"] = (function (x) {
	x = x >>> 0;
	for (var i = 0; i < 32; i++) {
		if (x & 1 << 31 - i) return i
	}
	return 32
});
Math.clz32 = Math["clz32"];
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;

function getUniqueRunDependency(id) {
	return id
}

function addRunDependency(id) {
	runDependencies++;
	if (Module["monitorRunDependencies"]) {
		Module["monitorRunDependencies"](runDependencies)
	}
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
	runDependencies--;
	if (Module["monitorRunDependencies"]) {
		Module["monitorRunDependencies"](runDependencies)
	}
	if (runDependencies == 0) {
		if (runDependencyWatcher !== null) {
			clearInterval(runDependencyWatcher);
			runDependencyWatcher = null
		}
		if (dependenciesFulfilled) {
			var callback = dependenciesFulfilled;
			dependenciesFulfilled = null;
			callback()
		}
	}
}
Module["removeRunDependency"] = removeRunDependency;
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var memoryInitializer = null;
var ASM_CONSTS = [];
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 23136;
__ATINIT__.push({
	func: (function () {
		__GLOBAL__sub_I_iostream_cpp()
	})
});
memoryInitializer = "https://cs17b008.github.io/btp-resources.github.io/static/scripts/example.js.mem";
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) {
	HEAP8[tempDoublePtr] = HEAP8[ptr];
	HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
	HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
	HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3]
}

function copyTempDouble(ptr) {
	HEAP8[tempDoublePtr] = HEAP8[ptr];
	HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
	HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
	HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
	HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
	HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
	HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
	HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7]
}

function _atexit(func, arg) {
	__ATEXIT__.unshift({
		func: func,
		arg: arg
	})
}

function ___cxa_atexit() {
	return _atexit.apply(null, arguments)
}
Module["_i64Subtract"] = _i64Subtract;

function ___setErrNo(value) {
	if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
	return value
}
var ERRNO_CODES = {
	EPERM: 1,
	ENOENT: 2,
	ESRCH: 3,
	EINTR: 4,
	EIO: 5,
	ENXIO: 6,
	E2BIG: 7,
	ENOEXEC: 8,
	EBADF: 9,
	ECHILD: 10,
	EAGAIN: 11,
	EWOULDBLOCK: 11,
	ENOMEM: 12,
	EACCES: 13,
	EFAULT: 14,
	ENOTBLK: 15,
	EBUSY: 16,
	EEXIST: 17,
	EXDEV: 18,
	ENODEV: 19,
	ENOTDIR: 20,
	EISDIR: 21,
	EINVAL: 22,
	ENFILE: 23,
	EMFILE: 24,
	ENOTTY: 25,
	ETXTBSY: 26,
	EFBIG: 27,
	ENOSPC: 28,
	ESPIPE: 29,
	EROFS: 30,
	EMLINK: 31,
	EPIPE: 32,
	EDOM: 33,
	ERANGE: 34,
	ENOMSG: 42,
	EIDRM: 43,
	ECHRNG: 44,
	EL2NSYNC: 45,
	EL3HLT: 46,
	EL3RST: 47,
	ELNRNG: 48,
	EUNATCH: 49,
	ENOCSI: 50,
	EL2HLT: 51,
	EDEADLK: 35,
	ENOLCK: 37,
	EBADE: 52,
	EBADR: 53,
	EXFULL: 54,
	ENOANO: 55,
	EBADRQC: 56,
	EBADSLT: 57,
	EDEADLOCK: 35,
	EBFONT: 59,
	ENOSTR: 60,
	ENODATA: 61,
	ETIME: 62,
	ENOSR: 63,
	ENONET: 64,
	ENOPKG: 65,
	EREMOTE: 66,
	ENOLINK: 67,
	EADV: 68,
	ESRMNT: 69,
	ECOMM: 70,
	EPROTO: 71,
	EMULTIHOP: 72,
	EDOTDOT: 73,
	EBADMSG: 74,
	ENOTUNIQ: 76,
	EBADFD: 77,
	EREMCHG: 78,
	ELIBACC: 79,
	ELIBBAD: 80,
	ELIBSCN: 81,
	ELIBMAX: 82,
	ELIBEXEC: 83,
	ENOSYS: 38,
	ENOTEMPTY: 39,
	ENAMETOOLONG: 36,
	ELOOP: 40,
	EOPNOTSUPP: 95,
	EPFNOSUPPORT: 96,
	ECONNRESET: 104,
	ENOBUFS: 105,
	EAFNOSUPPORT: 97,
	EPROTOTYPE: 91,
	ENOTSOCK: 88,
	ENOPROTOOPT: 92,
	ESHUTDOWN: 108,
	ECONNREFUSED: 111,
	EADDRINUSE: 98,
	ECONNABORTED: 103,
	ENETUNREACH: 101,
	ENETDOWN: 100,
	ETIMEDOUT: 110,
	EHOSTDOWN: 112,
	EHOSTUNREACH: 113,
	EINPROGRESS: 115,
	EALREADY: 114,
	EDESTADDRREQ: 89,
	EMSGSIZE: 90,
	EPROTONOSUPPORT: 93,
	ESOCKTNOSUPPORT: 94,
	EADDRNOTAVAIL: 99,
	ENETRESET: 102,
	EISCONN: 106,
	ENOTCONN: 107,
	ETOOMANYREFS: 109,
	EUSERS: 87,
	EDQUOT: 122,
	ESTALE: 116,
	ENOTSUP: 95,
	ENOMEDIUM: 123,
	EILSEQ: 84,
	EOVERFLOW: 75,
	ECANCELED: 125,
	ENOTRECOVERABLE: 131,
	EOWNERDEAD: 130,
	ESTRPIPE: 86
};

function _sysconf(name) {
	switch (name) {
		case 30:
			return PAGE_SIZE;
		case 85:
			return totalMemory / PAGE_SIZE;
		case 132:
		case 133:
		case 12:
		case 137:
		case 138:
		case 15:
		case 235:
		case 16:
		case 17:
		case 18:
		case 19:
		case 20:
		case 149:
		case 13:
		case 10:
		case 236:
		case 153:
		case 9:
		case 21:
		case 22:
		case 159:
		case 154:
		case 14:
		case 77:
		case 78:
		case 139:
		case 80:
		case 81:
		case 82:
		case 68:
		case 67:
		case 164:
		case 11:
		case 29:
		case 47:
		case 48:
		case 95:
		case 52:
		case 51:
		case 46:
			return 200809;
		case 79:
			return 0;
		case 27:
		case 246:
		case 127:
		case 128:
		case 23:
		case 24:
		case 160:
		case 161:
		case 181:
		case 182:
		case 242:
		case 183:
		case 184:
		case 243:
		case 244:
		case 245:
		case 165:
		case 178:
		case 179:
		case 49:
		case 50:
		case 168:
		case 169:
		case 175:
		case 170:
		case 171:
		case 172:
		case 97:
		case 76:
		case 32:
		case 173:
		case 35:
			return -1;
		case 176:
		case 177:
		case 7:
		case 155:
		case 8:
		case 157:
		case 125:
		case 126:
		case 92:
		case 93:
		case 129:
		case 130:
		case 131:
		case 94:
		case 91:
			return 1;
		case 74:
		case 60:
		case 69:
		case 70:
		case 4:
			return 1024;
		case 31:
		case 42:
		case 72:
			return 32;
		case 87:
		case 26:
		case 33:
			return 2147483647;
		case 34:
		case 1:
			return 47839;
		case 38:
		case 36:
			return 99;
		case 43:
		case 37:
			return 2048;
		case 0:
			return 2097152;
		case 3:
			return 65536;
		case 28:
			return 32768;
		case 44:
			return 32767;
		case 75:
			return 16384;
		case 39:
			return 1e3;
		case 89:
			return 700;
		case 71:
			return 256;
		case 40:
			return 255;
		case 2:
			return 100;
		case 180:
			return 64;
		case 25:
			return 20;
		case 5:
			return 16;
		case 6:
			return 6;
		case 73:
			return 4;
		case 84:
			{
				if (typeof navigator === "object") return navigator["hardwareConcurrency"] || 1;
				return 1
			}
	}
	___setErrNo(ERRNO_CODES.EINVAL);
	return -1
}

function __ZSt18uncaught_exceptionv() {
	return !!__ZSt18uncaught_exceptionv.uncaught_exception
}
var EXCEPTIONS = {
	last: 0,
	caught: [],
	infos: {},
	deAdjust: (function (adjusted) {
		if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
		for (var ptr in EXCEPTIONS.infos) {
			var info = EXCEPTIONS.infos[ptr];
			if (info.adjusted === adjusted) {
				return ptr
			}
		}
		return adjusted
	}),
	addRef: (function (ptr) {
		if (!ptr) return;
		var info = EXCEPTIONS.infos[ptr];
		info.refcount++
	}),
	decRef: (function (ptr) {
		if (!ptr) return;
		var info = EXCEPTIONS.infos[ptr];
		assert(info.refcount > 0);
		info.refcount--;
		if (info.refcount === 0) {
			if (info.destructor) {
				Runtime.dynCall("vi", info.destructor, [ptr])
			}
			delete EXCEPTIONS.infos[ptr];
			___cxa_free_exception(ptr)
		}
	}),
	clearRef: (function (ptr) {
		if (!ptr) return;
		var info = EXCEPTIONS.infos[ptr];
		info.refcount = 0
	})
};

function ___resumeException(ptr) {
	if (!EXCEPTIONS.last) {
		EXCEPTIONS.last = ptr
	}
	EXCEPTIONS.clearRef(EXCEPTIONS.deAdjust(ptr));
	throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch."
}

function ___cxa_find_matching_catch() {
	var thrown = EXCEPTIONS.last;
	if (!thrown) {
		return (asm["setTempRet0"](0), 0) | 0
	}
	var info = EXCEPTIONS.infos[thrown];
	var throwntype = info.type;
	if (!throwntype) {
		return (asm["setTempRet0"](0), thrown) | 0
	}
	var typeArray = Array.prototype.slice.call(arguments);
	var pointer = Module["___cxa_is_pointer_type"](throwntype);
	if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
	HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
	thrown = ___cxa_find_matching_catch.buffer;
	for (var i = 0; i < typeArray.length; i++) {
		if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
			thrown = HEAP32[thrown >> 2];
			info.adjusted = thrown;
			return (asm["setTempRet0"](typeArray[i]), thrown) | 0
		}
	}
	thrown = HEAP32[thrown >> 2];
	return (asm["setTempRet0"](throwntype), thrown) | 0
}

function ___cxa_throw(ptr, type, destructor) {
	EXCEPTIONS.infos[ptr] = {
		ptr: ptr,
		adjusted: ptr,
		type: type,
		destructor: destructor,
		refcount: 0
	};
	EXCEPTIONS.last = ptr;
	if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
		__ZSt18uncaught_exceptionv.uncaught_exception = 1
	} else {
		__ZSt18uncaught_exceptionv.uncaught_exception++
	}
	throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch."
}
Module["_memset"] = _memset;
var _BDtoILow = true;

function _pthread_mutex_lock() {}

function __isLeapYear(year) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function __arraySum(array, index) {
	var sum = 0;
	for (var i = 0; i <= index; sum += array[i++]);
	return sum
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function __addDays(date, days) {
	var newDate = new Date(date.getTime());
	while (days > 0) {
		var leap = __isLeapYear(newDate.getFullYear());
		var currentMonth = newDate.getMonth();
		var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
		if (days > daysInCurrentMonth - newDate.getDate()) {
			days -= daysInCurrentMonth - newDate.getDate() + 1;
			newDate.setDate(1);
			if (currentMonth < 11) {
				newDate.setMonth(currentMonth + 1)
			} else {
				newDate.setMonth(0);
				newDate.setFullYear(newDate.getFullYear() + 1)
			}
		} else {
			newDate.setDate(newDate.getDate() + days);
			return newDate
		}
	}
	return newDate
}

function _strftime(s, maxsize, format, tm) {
	var tm_zone = HEAP32[tm + 40 >> 2];
	var date = {
		tm_sec: HEAP32[tm >> 2],
		tm_min: HEAP32[tm + 4 >> 2],
		tm_hour: HEAP32[tm + 8 >> 2],
		tm_mday: HEAP32[tm + 12 >> 2],
		tm_mon: HEAP32[tm + 16 >> 2],
		tm_year: HEAP32[tm + 20 >> 2],
		tm_wday: HEAP32[tm + 24 >> 2],
		tm_yday: HEAP32[tm + 28 >> 2],
		tm_isdst: HEAP32[tm + 32 >> 2],
		tm_gmtoff: HEAP32[tm + 36 >> 2],
		tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ""
	};
	var pattern = Pointer_stringify(format);
	var EXPANSION_RULES_1 = {
		"%c": "%a %b %d %H:%M:%S %Y",
		"%D": "%m/%d/%y",
		"%F": "%Y-%m-%d",
		"%h": "%b",
		"%r": "%I:%M:%S %p",
		"%R": "%H:%M",
		"%T": "%H:%M:%S",
		"%x": "%m/%d/%y",
		"%X": "%H:%M:%S"
	};
	for (var rule in EXPANSION_RULES_1) {
		pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
	}
	var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	function leadingSomething(value, digits, character) {
		var str = typeof value === "number" ? value.toString() : value || "";
		while (str.length < digits) {
			str = character[0] + str
		}
		return str
	}

	function leadingNulls(value, digits) {
		return leadingSomething(value, digits, "0")
	}

	function compareByDay(date1, date2) {
		function sgn(value) {
			return value < 0 ? -1 : value > 0 ? 1 : 0
		}
		var compare;
		if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
			if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
				compare = sgn(date1.getDate() - date2.getDate())
			}
		}
		return compare
	}

	function getFirstWeekStartDate(janFourth) {
		switch (janFourth.getDay()) {
			case 0:
				return new Date(janFourth.getFullYear() - 1, 11, 29);
			case 1:
				return janFourth;
			case 2:
				return new Date(janFourth.getFullYear(), 0, 3);
			case 3:
				return new Date(janFourth.getFullYear(), 0, 2);
			case 4:
				return new Date(janFourth.getFullYear(), 0, 1);
			case 5:
				return new Date(janFourth.getFullYear() - 1, 11, 31);
			case 6:
				return new Date(janFourth.getFullYear() - 1, 11, 30)
		}
	}

	function getWeekBasedYear(date) {
		var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
		var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
		var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
		var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
		var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
		if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
			if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
				return thisDate.getFullYear() + 1
			} else {
				return thisDate.getFullYear()
			}
		} else {
			return thisDate.getFullYear() - 1
		}
	}
	var EXPANSION_RULES_2 = {
		"%a": (function (date) {
			return WEEKDAYS[date.tm_wday].substring(0, 3)
		}),
		"%A": (function (date) {
			return WEEKDAYS[date.tm_wday]
		}),
		"%b": (function (date) {
			return MONTHS[date.tm_mon].substring(0, 3)
		}),
		"%B": (function (date) {
			return MONTHS[date.tm_mon]
		}),
		"%C": (function (date) {
			var year = date.tm_year + 1900;
			return leadingNulls(year / 100 | 0, 2)
		}),
		"%d": (function (date) {
			return leadingNulls(date.tm_mday, 2)
		}),
		"%e": (function (date) {
			return leadingSomething(date.tm_mday, 2, " ")
		}),
		"%g": (function (date) {
			return getWeekBasedYear(date).toString().substring(2)
		}),
		"%G": (function (date) {
			return getWeekBasedYear(date)
		}),
		"%H": (function (date) {
			return leadingNulls(date.tm_hour, 2)
		}),
		"%I": (function (date) {
			return leadingNulls(date.tm_hour < 13 ? date.tm_hour : date.tm_hour - 12, 2)
		}),
		"%j": (function (date) {
			return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
		}),
		"%m": (function (date) {
			return leadingNulls(date.tm_mon + 1, 2)
		}),
		"%M": (function (date) {
			return leadingNulls(date.tm_min, 2)
		}),
		"%n": (function () {
			return "\n"
		}),
		"%p": (function (date) {
			if (date.tm_hour > 0 && date.tm_hour < 13) {
				return "AM"
			} else {
				return "PM"
			}
		}),
		"%S": (function (date) {
			return leadingNulls(date.tm_sec, 2)
		}),
		"%t": (function () {
			return "\t"
		}),
		"%u": (function (date) {
			var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
			return day.getDay() || 7
		}),
		"%U": (function (date) {
			var janFirst = new Date(date.tm_year + 1900, 0, 1);
			var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
			var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
			if (compareByDay(firstSunday, endDate) < 0) {
				var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
				var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
				var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
				return leadingNulls(Math.ceil(days / 7), 2)
			}
			return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
		}),
		"%V": (function (date) {
			var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
			var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
			var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
			var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
			var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
			if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
				return "53"
			}
			if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
				return "01"
			}
			var daysDifference;
			if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
				daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
			} else {
				daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
			}
			return leadingNulls(Math.ceil(daysDifference / 7), 2)
		}),
		"%w": (function (date) {
			var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
			return day.getDay()
		}),
		"%W": (function (date) {
			var janFirst = new Date(date.tm_year, 0, 1);
			var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
			var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
			if (compareByDay(firstMonday, endDate) < 0) {
				var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
				var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
				var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
				return leadingNulls(Math.ceil(days / 7), 2)
			}
			return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
		}),
		"%y": (function (date) {
			return (date.tm_year + 1900).toString().substring(2)
		}),
		"%Y": (function (date) {
			return date.tm_year + 1900
		}),
		"%z": (function (date) {
			var off = date.tm_gmtoff;
			var ahead = off >= 0;
			off = Math.abs(off) / 60;
			off = off / 60 * 100 + off % 60;
			return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
		}),
		"%Z": (function (date) {
			return date.tm_zone
		}),
		"%%": (function () {
			return "%"
		})
	};
	for (var rule in EXPANSION_RULES_2) {
		if (pattern.indexOf(rule) >= 0) {
			pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
		}
	}
	var bytes = intArrayFromString(pattern, false);
	if (bytes.length > maxsize) {
		return 0
	}
	writeArrayToMemory(bytes, s);
	return bytes.length - 1
}

function _strftime_l(s, maxsize, format, tm) {
	return _strftime(s, maxsize, format, tm)
}

function _abort() {
	Module["abort"]()
}

function _pthread_once(ptr, func) {
	if (!_pthread_once.seen) _pthread_once.seen = {};
	if (ptr in _pthread_once.seen) return;
	Runtime.dynCall("v", func);
	_pthread_once.seen[ptr] = 1
}

function ___lock() {}

function ___unlock() {}
var PTHREAD_SPECIFIC = {};

function _pthread_getspecific(key) {
	return PTHREAD_SPECIFIC[key] || 0
}

function ___assert_fail(condition, filename, line, func) {
	ABORT = true;
	throw "Assertion failed: " + Pointer_stringify(condition) + ", at: " + [filename ? Pointer_stringify(filename) : "unknown filename", line, func ? Pointer_stringify(func) : "unknown function"] + " at " + stackTrace()
}
var _fabs = Math_abs;
var PTHREAD_SPECIFIC_NEXT_KEY = 1;

function _pthread_key_create(key, destructor) {
	if (key == 0) {
		return ERRNO_CODES.EINVAL
	}
	HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
	PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
	PTHREAD_SPECIFIC_NEXT_KEY++;
	return 0
}
var ERRNO_MESSAGES = {
	0: "Success",
	1: "Not super-user",
	2: "No such file or directory",
	3: "No such process",
	4: "Interrupted system call",
	5: "I/O error",
	6: "No such device or address",
	7: "Arg list too long",
	8: "Exec format error",
	9: "Bad file number",
	10: "No children",
	11: "No more processes",
	12: "Not enough core",
	13: "Permission denied",
	14: "Bad address",
	15: "Block device required",
	16: "Mount device busy",
	17: "File exists",
	18: "Cross-device link",
	19: "No such device",
	20: "Not a directory",
	21: "Is a directory",
	22: "Invalid argument",
	23: "Too many open files in system",
	24: "Too many open files",
	25: "Not a typewriter",
	26: "Text file busy",
	27: "File too large",
	28: "No space left on device",
	29: "Illegal seek",
	30: "Read only file system",
	31: "Too many links",
	32: "Broken pipe",
	33: "Math arg out of domain of func",
	34: "Math result not representable",
	35: "File locking deadlock error",
	36: "File or path name too long",
	37: "No record locks available",
	38: "Function not implemented",
	39: "Directory not empty",
	40: "Too many symbolic links",
	42: "No message of desired type",
	43: "Identifier removed",
	44: "Channel number out of range",
	45: "Level 2 not synchronized",
	46: "Level 3 halted",
	47: "Level 3 reset",
	48: "Link number out of range",
	49: "Protocol driver not attached",
	50: "No CSI structure available",
	51: "Level 2 halted",
	52: "Invalid exchange",
	53: "Invalid request descriptor",
	54: "Exchange full",
	55: "No anode",
	56: "Invalid request code",
	57: "Invalid slot",
	59: "Bad font file fmt",
	60: "Device not a stream",
	61: "No data (for no delay io)",
	62: "Timer expired",
	63: "Out of streams resources",
	64: "Machine is not on the network",
	65: "Package not installed",
	66: "The object is remote",
	67: "The link has been severed",
	68: "Advertise error",
	69: "Srmount error",
	70: "Communication error on send",
	71: "Protocol error",
	72: "Multihop attempted",
	73: "Cross mount point (not really error)",
	74: "Trying to read unreadable message",
	75: "Value too large for defined data type",
	76: "Given log. name not unique",
	77: "f.d. invalid for this operation",
	78: "Remote address changed",
	79: "Can   access a needed shared lib",
	80: "Accessing a corrupted shared lib",
	81: ".lib section in a.out corrupted",
	82: "Attempting to link in too many libs",
	83: "Attempting to exec a shared library",
	84: "Illegal byte sequence",
	86: "Streams pipe error",
	87: "Too many users",
	88: "Socket operation on non-socket",
	89: "Destination address required",
	90: "Message too long",
	91: "Protocol wrong type for socket",
	92: "Protocol not available",
	93: "Unknown protocol",
	94: "Socket type not supported",
	95: "Not supported",
	96: "Protocol family not supported",
	97: "Address family not supported by protocol family",
	98: "Address already in use",
	99: "Address not available",
	100: "Network interface is not configured",
	101: "Network is unreachable",
	102: "Connection reset by network",
	103: "Connection aborted",
	104: "Connection reset by peer",
	105: "No buffer space available",
	106: "Socket is already connected",
	107: "Socket is not connected",
	108: "Can't send after socket shutdown",
	109: "Too many references",
	110: "Connection timed out",
	111: "Connection refused",
	112: "Host is down",
	113: "Host is unreachable",
	114: "Socket already connected",
	115: "Connection already in progress",
	116: "Stale file handle",
	122: "Quota exceeded",
	123: "No medium (in tape drive)",
	125: "Operation canceled",
	130: "Previous owner died",
	131: "State not recoverable"
};
var TTY = {
	ttys: [],
	init: (function () {}),
	shutdown: (function () {}),
	register: (function (dev, ops) {
		TTY.ttys[dev] = {
			input: [],
			output: [],
			ops: ops
		};
		FS.registerDevice(dev, TTY.stream_ops)
	}),
	stream_ops: {
		open: (function (stream) {
			var tty = TTY.ttys[stream.node.rdev];
			if (!tty) {
				throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
			}
			stream.tty = tty;
			stream.seekable = false
		}),
		close: (function (stream) {
			stream.tty.ops.flush(stream.tty)
		}),
		flush: (function (stream) {
			stream.tty.ops.flush(stream.tty)
		}),
		read: (function (stream, buffer, offset, length, pos) {
			if (!stream.tty || !stream.tty.ops.get_char) {
				throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
			}
			var bytesRead = 0;
			for (var i = 0; i < length; i++) {
				var result;
				try {
					result = stream.tty.ops.get_char(stream.tty)
				} catch (e) {
					throw new FS.ErrnoError(ERRNO_CODES.EIO)
				}
				if (result === undefined && bytesRead === 0) {
					throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
				}
				if (result === null || result === undefined) break;
				bytesRead++;
				buffer[offset + i] = result
			}
			if (bytesRead) {
				stream.node.timestamp = Date.now()
			}
			return bytesRead
		}),
		write: (function (stream, buffer, offset, length, pos) {
			if (!stream.tty || !stream.tty.ops.put_char) {
				throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
			}
			for (var i = 0; i < length; i++) {
				try {
					stream.tty.ops.put_char(stream.tty, buffer[offset + i])
				} catch (e) {
					throw new FS.ErrnoError(ERRNO_CODES.EIO)
				}
			}
			if (length) {
				stream.node.timestamp = Date.now()
			}
			return i
		})
	},
	default_tty_ops: {
		get_char: (function (tty) {
			if (!tty.input.length) {
				var result = null;
				if (ENVIRONMENT_IS_NODE) {
					var BUFSIZE = 256;
					var buf = new Buffer(BUFSIZE);
					var bytesRead = 0;
					var fd = process.stdin.fd;
					var usingDevice = false;
					try {
						fd = fs.openSync("/dev/stdin", "r");
						usingDevice = true
					} catch (e) {}
					bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
					if (usingDevice) {
						fs.closeSync(fd)
					}
					if (bytesRead > 0) {
						result = buf.slice(0, bytesRead).toString("utf-8")
					} else {
						result = null
					}
				} else if (typeof window != "undefined" && typeof window.prompt == "function") {
					result = window.prompt("Input: ");
					if (result !== null) {
						result += "\n"
					}
				} else if (typeof readline == "function") {
					result = readline();
					if (result !== null) {
						result += "\n"
					}
				}
				if (!result) {
					return null
				}
				tty.input = intArrayFromString(result, true)
			}
			return tty.input.shift()
		}),
		put_char: (function (tty, val) {
			if (val === null || val === 10) {
				Module["print"](UTF8ArrayToString(tty.output, 0));
				tty.output = []
			} else {
				if (val != 0) tty.output.push(val)
			}
		}),
		flush: (function (tty) {
			if (tty.output && tty.output.length > 0) {
				Module["print"](UTF8ArrayToString(tty.output, 0));
				tty.output = []
			}
		})
	},
	default_tty1_ops: {
		put_char: (function (tty, val) {
			if (val === null || val === 10) {
				Module["printErr"](UTF8ArrayToString(tty.output, 0));
				tty.output = []
			} else {
				if (val != 0) tty.output.push(val)
			}
		}),
		flush: (function (tty) {
			if (tty.output && tty.output.length > 0) {
				Module["printErr"](UTF8ArrayToString(tty.output, 0));
				tty.output = []
			}
		})
	}
};
var MEMFS = {
	ops_table: null,
	mount: (function (mount) {
		return MEMFS.createNode(null, "/", 16384 | 511, 0)
	}),
	createNode: (function (parent, name, mode, dev) {
		if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		if (!MEMFS.ops_table) {
			MEMFS.ops_table = {
				dir: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
						lookup: MEMFS.node_ops.lookup,
						mknod: MEMFS.node_ops.mknod,
						rename: MEMFS.node_ops.rename,
						unlink: MEMFS.node_ops.unlink,
						rmdir: MEMFS.node_ops.rmdir,
						readdir: MEMFS.node_ops.readdir,
						symlink: MEMFS.node_ops.symlink
					},
					stream: {
						llseek: MEMFS.stream_ops.llseek
					}
				},
				file: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr
					},
					stream: {
						llseek: MEMFS.stream_ops.llseek,
						read: MEMFS.stream_ops.read,
						write: MEMFS.stream_ops.write,
						allocate: MEMFS.stream_ops.allocate,
						mmap: MEMFS.stream_ops.mmap,
						msync: MEMFS.stream_ops.msync
					}
				},
				link: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
						readlink: MEMFS.node_ops.readlink
					},
					stream: {}
				},
				chrdev: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr
					},
					stream: FS.chrdev_stream_ops
				}
			}
		}
		var node = FS.createNode(parent, name, mode, dev);
		if (FS.isDir(node.mode)) {
			node.node_ops = MEMFS.ops_table.dir.node;
			node.stream_ops = MEMFS.ops_table.dir.stream;
			node.contents = {}
		} else if (FS.isFile(node.mode)) {
			node.node_ops = MEMFS.ops_table.file.node;
			node.stream_ops = MEMFS.ops_table.file.stream;
			node.usedBytes = 0;
			node.contents = null
		} else if (FS.isLink(node.mode)) {
			node.node_ops = MEMFS.ops_table.link.node;
			node.stream_ops = MEMFS.ops_table.link.stream
		} else if (FS.isChrdev(node.mode)) {
			node.node_ops = MEMFS.ops_table.chrdev.node;
			node.stream_ops = MEMFS.ops_table.chrdev.stream
		}
		node.timestamp = Date.now();
		if (parent) {
			parent.contents[name] = node
		}
		return node
	}),
	getFileDataAsRegularArray: (function (node) {
		if (node.contents && node.contents.subarray) {
			var arr = [];
			for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
			return arr
		}
		return node.contents
	}),
	getFileDataAsTypedArray: (function (node) {
		if (!node.contents) return new Uint8Array;
		if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
		return new Uint8Array(node.contents)
	}),
	expandFileStorage: (function (node, newCapacity) {
		if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
			node.contents = MEMFS.getFileDataAsRegularArray(node);
			node.usedBytes = node.contents.length
		}
		if (!node.contents || node.contents.subarray) {
			var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
			if (prevCapacity >= newCapacity) return;
			var CAPACITY_DOUBLING_MAX = 1024 * 1024;
			newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
			if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
			var oldContents = node.contents;
			node.contents = new Uint8Array(newCapacity);
			if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
			return
		}
		if (!node.contents && newCapacity > 0) node.contents = [];
		while (node.contents.length < newCapacity) node.contents.push(0)
	}),
	resizeFileStorage: (function (node, newSize) {
		if (node.usedBytes == newSize) return;
		if (newSize == 0) {
			node.contents = null;
			node.usedBytes = 0;
			return
		}
		if (!node.contents || node.contents.subarray) {
			var oldContents = node.contents;
			node.contents = new Uint8Array(new ArrayBuffer(newSize));
			if (oldContents) {
				node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
			}
			node.usedBytes = newSize;
			return
		}
		if (!node.contents) node.contents = [];
		if (node.contents.length > newSize) node.contents.length = newSize;
		else
			while (node.contents.length < newSize) node.contents.push(0);
		node.usedBytes = newSize
	}),
	node_ops: {
		getattr: (function (node) {
			var attr = {};
			attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
			attr.ino = node.id;
			attr.mode = node.mode;
			attr.nlink = 1;
			attr.uid = 0;
			attr.gid = 0;
			attr.rdev = node.rdev;
			if (FS.isDir(node.mode)) {
				attr.size = 4096
			} else if (FS.isFile(node.mode)) {
				attr.size = node.usedBytes
			} else if (FS.isLink(node.mode)) {
				attr.size = node.link.length
			} else {
				attr.size = 0
			}
			attr.atime = new Date(node.timestamp);
			attr.mtime = new Date(node.timestamp);
			attr.ctime = new Date(node.timestamp);
			attr.blksize = 4096;
			attr.blocks = Math.ceil(attr.size / attr.blksize);
			return attr
		}),
		setattr: (function (node, attr) {
			if (attr.mode !== undefined) {
				node.mode = attr.mode
			}
			if (attr.timestamp !== undefined) {
				node.timestamp = attr.timestamp
			}
			if (attr.size !== undefined) {
				MEMFS.resizeFileStorage(node, attr.size)
			}
		}),
		lookup: (function (parent, name) {
			throw FS.genericErrors[ERRNO_CODES.ENOENT]
		}),
		mknod: (function (parent, name, mode, dev) {
			return MEMFS.createNode(parent, name, mode, dev)
		}),
		rename: (function (old_node, new_dir, new_name) {
			if (FS.isDir(old_node.mode)) {
				var new_node;
				try {
					new_node = FS.lookupNode(new_dir, new_name)
				} catch (e) {}
				if (new_node) {
					for (var i in new_node.contents) {
						throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
					}
				}
			}
			delete old_node.parent.contents[old_node.name];
			old_node.name = new_name;
			new_dir.contents[new_name] = old_node;
			old_node.parent = new_dir
		}),
		unlink: (function (parent, name) {
			delete parent.contents[name]
		}),
		rmdir: (function (parent, name) {
			var node = FS.lookupNode(parent, name);
			for (var i in node.contents) {
				throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
			}
			delete parent.contents[name]
		}),
		readdir: (function (node) {
			var entries = [".", ".."];
			for (var key in node.contents) {
				if (!node.contents.hasOwnProperty(key)) {
					continue
				}
				entries.push(key)
			}
			return entries
		}),
		symlink: (function (parent, newname, oldpath) {
			var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
			node.link = oldpath;
			return node
		}),
		readlink: (function (node) {
			if (!FS.isLink(node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
			}
			return node.link
		})
	},
	stream_ops: {
		read: (function (stream, buffer, offset, length, position) {
			var contents = stream.node.contents;
			if (position >= stream.node.usedBytes) return 0;
			var size = Math.min(stream.node.usedBytes - position, length);
			assert(size >= 0);
			if (size > 8 && contents.subarray) {
				buffer.set(contents.subarray(position, position + size), offset)
			} else {
				for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
			}
			return size
		}),
		write: (function (stream, buffer, offset, length, position, canOwn) {
			if (!length) return 0;
			var node = stream.node;
			node.timestamp = Date.now();
			if (buffer.subarray && (!node.contents || node.contents.subarray)) {
				if (canOwn) {
					node.contents = buffer.subarray(offset, offset + length);
					node.usedBytes = length;
					return length
				} else if (node.usedBytes === 0 && position === 0) {
					node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
					node.usedBytes = length;
					return length
				} else if (position + length <= node.usedBytes) {
					node.contents.set(buffer.subarray(offset, offset + length), position);
					return length
				}
			}
			MEMFS.expandFileStorage(node, position + length);
			if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
			else {
				for (var i = 0; i < length; i++) {
					node.contents[position + i] = buffer[offset + i]
				}
			}
			node.usedBytes = Math.max(node.usedBytes, position + length);
			return length
		}),
		llseek: (function (stream, offset, whence) {
			var position = offset;
			if (whence === 1) {
				position += stream.position
			} else if (whence === 2) {
				if (FS.isFile(stream.node.mode)) {
					position += stream.node.usedBytes
				}
			}
			if (position < 0) {
				throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
			}
			return position
		}),
		allocate: (function (stream, offset, length) {
			MEMFS.expandFileStorage(stream.node, offset + length);
			stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
		}),
		mmap: (function (stream, buffer, offset, length, position, prot, flags) {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
			}
			var ptr;
			var allocated;
			var contents = stream.node.contents;
			if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
				allocated = false;
				ptr = contents.byteOffset
			} else {
				if (position > 0 || position + length < stream.node.usedBytes) {
					if (contents.subarray) {
						contents = contents.subarray(position, position + length)
					} else {
						contents = Array.prototype.slice.call(contents, position, position + length)
					}
				}
				allocated = true;
				ptr = _malloc(length);
				if (!ptr) {
					throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
				}
				buffer.set(contents, ptr)
			}
			return {
				ptr: ptr,
				allocated: allocated
			}
		}),
		msync: (function (stream, buffer, offset, length, mmapFlags) {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
			}
			if (mmapFlags & 2) {
				return 0
			}
			var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
			return 0
		})
	}
};
var IDBFS = {
	dbs: {},
	indexedDB: (function () {
		if (typeof indexedDB !== "undefined") return indexedDB;
		var ret = null;
		if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
		assert(ret, "IDBFS used, but indexedDB not supported");
		return ret
	}),
	DB_VERSION: 21,
	DB_STORE_NAME: "FILE_DATA",
	mount: (function (mount) {
		return MEMFS.mount.apply(null, arguments)
	}),
	syncfs: (function (mount, populate, callback) {
		IDBFS.getLocalSet(mount, (function (err, local) {
			if (err) return callback(err);
			IDBFS.getRemoteSet(mount, (function (err, remote) {
				if (err) return callback(err);
				var src = populate ? remote : local;
				var dst = populate ? local : remote;
				IDBFS.reconcile(src, dst, callback)
			}))
		}))
	}),
	getDB: (function (name, callback) {
		var db = IDBFS.dbs[name];
		if (db) {
			return callback(null, db)
		}
		var req;
		try {
			req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
		} catch (e) {
			return callback(e)
		}
		req.onupgradeneeded = (function (e) {
			var db = e.target.result;
			var transaction = e.target.transaction;
			var fileStore;
			if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
				fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
			} else {
				fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
			}
			if (!fileStore.indexNames.contains("timestamp")) {
				fileStore.createIndex("timestamp", "timestamp", {
					unique: false
				})
			}
		});
		req.onsuccess = (function () {
			db = req.result;
			IDBFS.dbs[name] = db;
			callback(null, db)
		});
		req.onerror = (function (e) {
			callback(this.error);
			e.preventDefault()
		})
	}),
	getLocalSet: (function (mount, callback) {
		var entries = {};

		function isRealDir(p) {
			return p !== "." && p !== ".."
		}

		function toAbsolute(root) {
			return (function (p) {
				return PATH.join2(root, p)
			})
		}
		var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
		while (check.length) {
			var path = check.pop();
			var stat;
			try {
				stat = FS.stat(path)
			} catch (e) {
				return callback(e)
			}
			if (FS.isDir(stat.mode)) {
				check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
			}
			entries[path] = {
				timestamp: stat.mtime
			}
		}
		return callback(null, {
			type: "local",
			entries: entries
		})
	}),
	getRemoteSet: (function (mount, callback) {
		var entries = {};
		IDBFS.getDB(mount.mountpoint, (function (err, db) {
			if (err) return callback(err);
			var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
			transaction.onerror = (function (e) {
				callback(this.error);
				e.preventDefault()
			});
			var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
			var index = store.index("timestamp");
			index.openKeyCursor().onsuccess = (function (event) {
				var cursor = event.target.result;
				if (!cursor) {
					return callback(null, {
						type: "remote",
						db: db,
						entries: entries
					})
				}
				entries[cursor.primaryKey] = {
					timestamp: cursor.key
				};
				cursor.continue()
			})
		}))
	}),
	loadLocalEntry: (function (path, callback) {
		var stat, node;
		try {
			var lookup = FS.lookupPath(path);
			node = lookup.node;
			stat = FS.stat(path)
		} catch (e) {
			return callback(e)
		}
		if (FS.isDir(stat.mode)) {
			return callback(null, {
				timestamp: stat.mtime,
				mode: stat.mode
			})
		} else if (FS.isFile(stat.mode)) {
			node.contents = MEMFS.getFileDataAsTypedArray(node);
			return callback(null, {
				timestamp: stat.mtime,
				mode: stat.mode,
				contents: node.contents
			})
		} else {
			return callback(new Error("node type not supported"))
		}
	}),
	storeLocalEntry: (function (path, entry, callback) {
		try {
			if (FS.isDir(entry.mode)) {
				FS.mkdir(path, entry.mode)
			} else if (FS.isFile(entry.mode)) {
				FS.writeFile(path, entry.contents, {
					encoding: "binary",
					canOwn: true
				})
			} else {
				return callback(new Error("node type not supported"))
			}
			FS.chmod(path, entry.mode);
			FS.utime(path, entry.timestamp, entry.timestamp)
		} catch (e) {
			return callback(e)
		}
		callback(null)
	}),
	removeLocalEntry: (function (path, callback) {
		try {
			var lookup = FS.lookupPath(path);
			var stat = FS.stat(path);
			if (FS.isDir(stat.mode)) {
				FS.rmdir(path)
			} else if (FS.isFile(stat.mode)) {
				FS.unlink(path)
			}
		} catch (e) {
			return callback(e)
		}
		callback(null)
	}),
	loadRemoteEntry: (function (store, path, callback) {
		var req = store.get(path);
		req.onsuccess = (function (event) {
			callback(null, event.target.result)
		});
		req.onerror = (function (e) {
			callback(this.error);
			e.preventDefault()
		})
	}),
	storeRemoteEntry: (function (store, path, entry, callback) {
		var req = store.put(entry, path);
		req.onsuccess = (function () {
			callback(null)
		});
		req.onerror = (function (e) {
			callback(this.error);
			e.preventDefault()
		})
	}),
	removeRemoteEntry: (function (store, path, callback) {
		var req = store.delete(path);
		req.onsuccess = (function () {
			callback(null)
		});
		req.onerror = (function (e) {
			callback(this.error);
			e.preventDefault()
		})
	}),
	reconcile: (function (src, dst, callback) {
		var total = 0;
		var create = [];
		Object.keys(src.entries).forEach((function (key) {
			var e = src.entries[key];
			var e2 = dst.entries[key];
			if (!e2 || e.timestamp > e2.timestamp) {
				create.push(key);
				total++
			}
		}));
		var remove = [];
		Object.keys(dst.entries).forEach((function (key) {
			var e = dst.entries[key];
			var e2 = src.entries[key];
			if (!e2) {
				remove.push(key);
				total++
			}
		}));
		if (!total) {
			return callback(null)
		}
		var errored = false;
		var completed = 0;
		var db = src.type === "remote" ? src.db : dst.db;
		var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
		var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

		function done(err) {
			if (err) {
				if (!done.errored) {
					done.errored = true;
					return callback(err)
				}
				return
			}
			if (++completed >= total) {
				return callback(null)
			}
		}
		transaction.onerror = (function (e) {
			done(this.error);
			e.preventDefault()
		});
		create.sort().forEach((function (path) {
			if (dst.type === "local") {
				IDBFS.loadRemoteEntry(store, path, (function (err, entry) {
					if (err) return done(err);
					IDBFS.storeLocalEntry(path, entry, done)
				}))
			} else {
				IDBFS.loadLocalEntry(path, (function (err, entry) {
					if (err) return done(err);
					IDBFS.storeRemoteEntry(store, path, entry, done)
				}))
			}
		}));
		remove.sort().reverse().forEach((function (path) {
			if (dst.type === "local") {
				IDBFS.removeLocalEntry(path, done)
			} else {
				IDBFS.removeRemoteEntry(store, path, done)
			}
		}))
	})
};
var NODEFS = {
	isWindows: false,
	staticInit: (function () {
		NODEFS.isWindows = !!process.platform.match(/^win/)
	}),
	mount: (function (mount) {
		assert(ENVIRONMENT_IS_NODE);
		return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
	}),
	createNode: (function (parent, name, mode, dev) {
		if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var node = FS.createNode(parent, name, mode);
		node.node_ops = NODEFS.node_ops;
		node.stream_ops = NODEFS.stream_ops;
		return node
	}),
	getMode: (function (path) {
		var stat;
		try {
			stat = fs.lstatSync(path);
			if (NODEFS.isWindows) {
				stat.mode = stat.mode | (stat.mode & 146) >> 1
			}
		} catch (e) {
			if (!e.code) throw e;
			throw new FS.ErrnoError(ERRNO_CODES[e.code])
		}
		return stat.mode
	}),
	realPath: (function (node) {
		var parts = [];
		while (node.parent !== node) {
			parts.push(node.name);
			node = node.parent
		}
		parts.push(node.mount.opts.root);
		parts.reverse();
		return PATH.join.apply(null, parts)
	}),
	flagsToPermissionStringMap: {
		0: "r",
		1: "r+",
		2: "r+",
		64: "r",
		65: "r+",
		66: "r+",
		129: "rx+",
		193: "rx+",
		514: "w+",
		577: "w",
		578: "w+",
		705: "wx",
		706: "wx+",
		1024: "a",
		1025: "a",
		1026: "a+",
		1089: "a",
		1090: "a+",
		1153: "ax",
		1154: "ax+",
		1217: "ax",
		1218: "ax+",
		4096: "rs",
		4098: "rs+"
	},
	flagsToPermissionString: (function (flags) {
		if (flags in NODEFS.flagsToPermissionStringMap) {
			return NODEFS.flagsToPermissionStringMap[flags]
		} else {
			return flags
		}
	}),
	node_ops: {
		getattr: (function (node) {
			var path = NODEFS.realPath(node);
			var stat;
			try {
				stat = fs.lstatSync(path)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
			if (NODEFS.isWindows && !stat.blksize) {
				stat.blksize = 4096
			}
			if (NODEFS.isWindows && !stat.blocks) {
				stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
			}
			return {
				dev: stat.dev,
				ino: stat.ino,
				mode: stat.mode,
				nlink: stat.nlink,
				uid: stat.uid,
				gid: stat.gid,
				rdev: stat.rdev,
				size: stat.size,
				atime: stat.atime,
				mtime: stat.mtime,
				ctime: stat.ctime,
				blksize: stat.blksize,
				blocks: stat.blocks
			}
		}),
		setattr: (function (node, attr) {
			var path = NODEFS.realPath(node);
			try {
				if (attr.mode !== undefined) {
					fs.chmodSync(path, attr.mode);
					node.mode = attr.mode
				}
				if (attr.timestamp !== undefined) {
					var date = new Date(attr.timestamp);
					fs.utimesSync(path, date, date)
				}
				if (attr.size !== undefined) {
					fs.truncateSync(path, attr.size)
				}
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		lookup: (function (parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);
			var mode = NODEFS.getMode(path);
			return NODEFS.createNode(parent, name, mode)
		}),
		mknod: (function (parent, name, mode, dev) {
			var node = NODEFS.createNode(parent, name, mode, dev);
			var path = NODEFS.realPath(node);
			try {
				if (FS.isDir(node.mode)) {
					fs.mkdirSync(path, node.mode)
				} else {
					fs.writeFileSync(path, "", {
						mode: node.mode
					})
				}
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
			return node
		}),
		rename: (function (oldNode, newDir, newName) {
			var oldPath = NODEFS.realPath(oldNode);
			var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
			try {
				fs.renameSync(oldPath, newPath)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		unlink: (function (parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);
			try {
				fs.unlinkSync(path)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		rmdir: (function (parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);
			try {
				fs.rmdirSync(path)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		readdir: (function (node) {
			var path = NODEFS.realPath(node);
			try {
				return fs.readdirSync(path)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		symlink: (function (parent, newName, oldPath) {
			var newPath = PATH.join2(NODEFS.realPath(parent), newName);
			try {
				fs.symlinkSync(oldPath, newPath)
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		readlink: (function (node) {
			var path = NODEFS.realPath(node);
			try {
				path = fs.readlinkSync(path);
				path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
				return path
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		})
	},
	stream_ops: {
		open: (function (stream) {
			var path = NODEFS.realPath(stream.node);
			try {
				if (FS.isFile(stream.node.mode)) {
					stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags))
				}
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		close: (function (stream) {
			try {
				if (FS.isFile(stream.node.mode) && stream.nfd) {
					fs.closeSync(stream.nfd)
				}
			} catch (e) {
				if (!e.code) throw e;
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
		}),
		read: (function (stream, buffer, offset, length, position) {
			if (length === 0) return 0;
			var nbuffer = new Buffer(length);
			var res;
			try {
				res = fs.readSync(stream.nfd, nbuffer, 0, length, position)
			} catch (e) {
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
			if (res > 0) {
				for (var i = 0; i < res; i++) {
					buffer[offset + i] = nbuffer[i]
				}
			}
			return res
		}),
		write: (function (stream, buffer, offset, length, position) {
			var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
			var res;
			try {
				res = fs.writeSync(stream.nfd, nbuffer, 0, length, position)
			} catch (e) {
				throw new FS.ErrnoError(ERRNO_CODES[e.code])
			}
			return res
		}),
		llseek: (function (stream, offset, whence) {
			var position = offset;
			if (whence === 1) {
				position += stream.position
			} else if (whence === 2) {
				if (FS.isFile(stream.node.mode)) {
					try {
						var stat = fs.fstatSync(stream.nfd);
						position += stat.size
					} catch (e) {
						throw new FS.ErrnoError(ERRNO_CODES[e.code])
					}
				}
			}
			if (position < 0) {
				throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
			}
			return position
		})
	}
};
var _stdin = allocate(1, "i32*", ALLOC_STATIC);
var _stdout = allocate(1, "i32*", ALLOC_STATIC);
var _stderr = allocate(1, "i32*", ALLOC_STATIC);

function _fflush(stream) {}
Module["_fflush"] = _fflush;
var FS = {
	root: null,
	mounts: [],
	devices: [null],
	streams: [],
	nextInode: 1,
	nameTable: null,
	currentPath: "/",
	initialized: false,
	ignorePermissions: true,
	trackingDelegate: {},
	tracking: {
		openFlags: {
			READ: 1,
			WRITE: 2
		}
	},
	ErrnoError: null,
	genericErrors: {},
	handleFSError: (function (e) {
		if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
		return ___setErrNo(e.errno)
	}),
	lookupPath: (function (path, opts) {
		path = PATH.resolve(FS.cwd(), path);
		opts = opts || {};
		if (!path) return {
			path: "",
			node: null
		};
		var defaults = {
			follow_mount: true,
			recurse_count: 0
		};
		for (var key in defaults) {
			if (opts[key] === undefined) {
				opts[key] = defaults[key]
			}
		}
		if (opts.recurse_count > 8) {
			throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
		}
		var parts = PATH.normalizeArray(path.split("/").filter((function (p) {
			return !!p
		})), false);
		var current = FS.root;
		var current_path = "/";
		for (var i = 0; i < parts.length; i++) {
			var islast = i === parts.length - 1;
			if (islast && opts.parent) {
				break
			}
			current = FS.lookupNode(current, parts[i]);
			current_path = PATH.join2(current_path, parts[i]);
			if (FS.isMountpoint(current)) {
				if (!islast || islast && opts.follow_mount) {
					current = current.mounted.root
				}
			}
			if (!islast || opts.follow) {
				var count = 0;
				while (FS.isLink(current.mode)) {
					var link = FS.readlink(current_path);
					current_path = PATH.resolve(PATH.dirname(current_path), link);
					var lookup = FS.lookupPath(current_path, {
						recurse_count: opts.recurse_count
					});
					current = lookup.node;
					if (count++ > 40) {
						throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
					}
				}
			}
		}
		return {
			path: current_path,
			node: current
		}
	}),
	getPath: (function (node) {
		var path;
		while (true) {
			if (FS.isRoot(node)) {
				var mount = node.mount.mountpoint;
				if (!path) return mount;
				return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
			}
			path = path ? node.name + "/" + path : node.name;
			node = node.parent
		}
	}),
	hashName: (function (parentid, name) {
		var hash = 0;
		for (var i = 0; i < name.length; i++) {
			hash = (hash << 5) - hash + name.charCodeAt(i) | 0
		}
		return (parentid + hash >>> 0) % FS.nameTable.length
	}),
	hashAddNode: (function (node) {
		var hash = FS.hashName(node.parent.id, node.name);
		node.name_next = FS.nameTable[hash];
		FS.nameTable[hash] = node
	}),
	hashRemoveNode: (function (node) {
		var hash = FS.hashName(node.parent.id, node.name);
		if (FS.nameTable[hash] === node) {
			FS.nameTable[hash] = node.name_next
		} else {
			var current = FS.nameTable[hash];
			while (current) {
				if (current.name_next === node) {
					current.name_next = node.name_next;
					break
				}
				current = current.name_next
			}
		}
	}),
	lookupNode: (function (parent, name) {
		var err = FS.mayLookup(parent);
		if (err) {
			throw new FS.ErrnoError(err, parent)
		}
		var hash = FS.hashName(parent.id, name);
		for (var node = FS.nameTable[hash]; node; node = node.name_next) {
			var nodeName = node.name;
			if (node.parent.id === parent.id && nodeName === name) {
				return node
			}
		}
		return FS.lookup(parent, name)
	}),
	createNode: (function (parent, name, mode, rdev) {
		if (!FS.FSNode) {
			FS.FSNode = (function (parent, name, mode, rdev) {
				if (!parent) {
					parent = this
				}
				this.parent = parent;
				this.mount = parent.mount;
				this.mounted = null;
				this.id = FS.nextInode++;
				this.name = name;
				this.mode = mode;
				this.node_ops = {};
				this.stream_ops = {};
				this.rdev = rdev
			});
			FS.FSNode.prototype = {};
			var readMode = 292 | 73;
			var writeMode = 146;
			Object.defineProperties(FS.FSNode.prototype, {
				read: {
					get: (function () {
						return (this.mode & readMode) === readMode
					}),
					set: (function (val) {
						val ? this.mode |= readMode : this.mode &= ~readMode
					})
				},
				write: {
					get: (function () {
						return (this.mode & writeMode) === writeMode
					}),
					set: (function (val) {
						val ? this.mode |= writeMode : this.mode &= ~writeMode
					})
				},
				isFolder: {
					get: (function () {
						return FS.isDir(this.mode)
					})
				},
				isDevice: {
					get: (function () {
						return FS.isChrdev(this.mode)
					})
				}
			})
		}
		var node = new FS.FSNode(parent, name, mode, rdev);
		FS.hashAddNode(node);
		return node
	}),
	destroyNode: (function (node) {
		FS.hashRemoveNode(node)
	}),
	isRoot: (function (node) {
		return node === node.parent
	}),
	isMountpoint: (function (node) {
		return !!node.mounted
	}),
	isFile: (function (mode) {
		return (mode & 61440) === 32768
	}),
	isDir: (function (mode) {
		return (mode & 61440) === 16384
	}),
	isLink: (function (mode) {
		return (mode & 61440) === 40960
	}),
	isChrdev: (function (mode) {
		return (mode & 61440) === 8192
	}),
	isBlkdev: (function (mode) {
		return (mode & 61440) === 24576
	}),
	isFIFO: (function (mode) {
		return (mode & 61440) === 4096
	}),
	isSocket: (function (mode) {
		return (mode & 49152) === 49152
	}),
	flagModes: {
		"r": 0,
		"rs": 1052672,
		"r+": 2,
		"w": 577,
		"wx": 705,
		"xw": 705,
		"w+": 578,
		"wx+": 706,
		"xw+": 706,
		"a": 1089,
		"ax": 1217,
		"xa": 1217,
		"a+": 1090,
		"ax+": 1218,
		"xa+": 1218
	},
	modeStringToFlags: (function (str) {
		var flags = FS.flagModes[str];
		if (typeof flags === "undefined") {
			throw new Error("Unknown file open mode: " + str)
		}
		return flags
	}),
	flagsToPermissionString: (function (flag) {
		var accmode = flag & 2097155;
		var perms = ["r", "w", "rw"][accmode];
		if (flag & 512) {
			perms += "w"
		}
		return perms
	}),
	nodePermissions: (function (node, perms) {
		if (FS.ignorePermissions) {
			return 0
		}
		if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
			return ERRNO_CODES.EACCES
		} else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
			return ERRNO_CODES.EACCES
		} else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
			return ERRNO_CODES.EACCES
		}
		return 0
	}),
	mayLookup: (function (dir) {
		var err = FS.nodePermissions(dir, "x");
		if (err) return err;
		if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
		return 0
	}),
	mayCreate: (function (dir, name) {
		try {
			var node = FS.lookupNode(dir, name);
			return ERRNO_CODES.EEXIST
		} catch (e) {}
		return FS.nodePermissions(dir, "wx")
	}),
	mayDelete: (function (dir, name, isdir) {
		var node;
		try {
			node = FS.lookupNode(dir, name)
		} catch (e) {
			return e.errno
		}
		var err = FS.nodePermissions(dir, "wx");
		if (err) {
			return err
		}
		if (isdir) {
			if (!FS.isDir(node.mode)) {
				return ERRNO_CODES.ENOTDIR
			}
			if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
				return ERRNO_CODES.EBUSY
			}
		} else {
			if (FS.isDir(node.mode)) {
				return ERRNO_CODES.EISDIR
			}
		}
		return 0
	}),
	mayOpen: (function (node, flags) {
		if (!node) {
			return ERRNO_CODES.ENOENT
		}
		if (FS.isLink(node.mode)) {
			return ERRNO_CODES.ELOOP
		} else if (FS.isDir(node.mode)) {
			if ((flags & 2097155) !== 0 || flags & 512) {
				return ERRNO_CODES.EISDIR
			}
		}
		return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
	}),
	MAX_OPEN_FDS: 4096,
	nextfd: (function (fd_start, fd_end) {
		fd_start = fd_start || 0;
		fd_end = fd_end || FS.MAX_OPEN_FDS;
		for (var fd = fd_start; fd <= fd_end; fd++) {
			if (!FS.streams[fd]) {
				return fd
			}
		}
		throw new FS.ErrnoError(ERRNO_CODES.EMFILE)
	}),
	getStream: (function (fd) {
		return FS.streams[fd]
	}),
	createStream: (function (stream, fd_start, fd_end) {
		if (!FS.FSStream) {
			FS.FSStream = (function () {});
			FS.FSStream.prototype = {};
			Object.defineProperties(FS.FSStream.prototype, {
				object: {
					get: (function () {
						return this.node
					}),
					set: (function (val) {
						this.node = val
					})
				},
				isRead: {
					get: (function () {
						return (this.flags & 2097155) !== 1
					})
				},
				isWrite: {
					get: (function () {
						return (this.flags & 2097155) !== 0
					})
				},
				isAppend: {
					get: (function () {
						return this.flags & 1024
					})
				}
			})
		}
		var newStream = new FS.FSStream;
		for (var p in stream) {
			newStream[p] = stream[p]
		}
		stream = newStream;
		var fd = FS.nextfd(fd_start, fd_end);
		stream.fd = fd;
		FS.streams[fd] = stream;
		return stream
	}),
	closeStream: (function (fd) {
		FS.streams[fd] = null
	}),
	chrdev_stream_ops: {
		open: (function (stream) {
			var device = FS.getDevice(stream.node.rdev);
			stream.stream_ops = device.stream_ops;
			if (stream.stream_ops.open) {
				stream.stream_ops.open(stream)
			}
		}),
		llseek: (function () {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
		})
	},
	major: (function (dev) {
		return dev >> 8
	}),
	minor: (function (dev) {
		return dev & 255
	}),
	makedev: (function (ma, mi) {
		return ma << 8 | mi
	}),
	registerDevice: (function (dev, ops) {
		FS.devices[dev] = {
			stream_ops: ops
		}
	}),
	getDevice: (function (dev) {
		return FS.devices[dev]
	}),
	getMounts: (function (mount) {
		var mounts = [];
		var check = [mount];
		while (check.length) {
			var m = check.pop();
			mounts.push(m);
			check.push.apply(check, m.mounts)
		}
		return mounts
	}),
	syncfs: (function (populate, callback) {
		if (typeof populate === "function") {
			callback = populate;
			populate = false
		}
		var mounts = FS.getMounts(FS.root.mount);
		var completed = 0;

		function done(err) {
			if (err) {
				if (!done.errored) {
					done.errored = true;
					return callback(err)
				}
				return
			}
			if (++completed >= mounts.length) {
				callback(null)
			}
		}
		mounts.forEach((function (mount) {
			if (!mount.type.syncfs) {
				return done(null)
			}
			mount.type.syncfs(mount, populate, done)
		}))
	}),
	mount: (function (type, opts, mountpoint) {
		var root = mountpoint === "/";
		var pseudo = !mountpoint;
		var node;
		if (root && FS.root) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
		} else if (!root && !pseudo) {
			var lookup = FS.lookupPath(mountpoint, {
				follow_mount: false
			});
			mountpoint = lookup.path;
			node = lookup.node;
			if (FS.isMountpoint(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
			}
			if (!FS.isDir(node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
			}
		}
		var mount = {
			type: type,
			opts: opts,
			mountpoint: mountpoint,
			mounts: []
		};
		var mountRoot = type.mount(mount);
		mountRoot.mount = mount;
		mount.root = mountRoot;
		if (root) {
			FS.root = mountRoot
		} else if (node) {
			node.mounted = mount;
			if (node.mount) {
				node.mount.mounts.push(mount)
			}
		}
		return mountRoot
	}),
	unmount: (function (mountpoint) {
		var lookup = FS.lookupPath(mountpoint, {
			follow_mount: false
		});
		if (!FS.isMountpoint(lookup.node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var node = lookup.node;
		var mount = node.mounted;
		var mounts = FS.getMounts(mount);
		Object.keys(FS.nameTable).forEach((function (hash) {
			var current = FS.nameTable[hash];
			while (current) {
				var next = current.name_next;
				if (mounts.indexOf(current.mount) !== -1) {
					FS.destroyNode(current)
				}
				current = next
			}
		}));
		node.mounted = null;
		var idx = node.mount.mounts.indexOf(mount);
		assert(idx !== -1);
		node.mount.mounts.splice(idx, 1)
	}),
	lookup: (function (parent, name) {
		return parent.node_ops.lookup(parent, name)
	}),
	mknod: (function (path, mode, dev) {
		var lookup = FS.lookupPath(path, {
			parent: true
		});
		var parent = lookup.node;
		var name = PATH.basename(path);
		if (!name || name === "." || name === "..") {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var err = FS.mayCreate(parent, name);
		if (err) {
			throw new FS.ErrnoError(err)
		}
		if (!parent.node_ops.mknod) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		return parent.node_ops.mknod(parent, name, mode, dev)
	}),
	create: (function (path, mode) {
		mode = mode !== undefined ? mode : 438;
		mode &= 4095;
		mode |= 32768;
		return FS.mknod(path, mode, 0)
	}),
	mkdir: (function (path, mode) {
		mode = mode !== undefined ? mode : 511;
		mode &= 511 | 512;
		mode |= 16384;
		return FS.mknod(path, mode, 0)
	}),
	mkdev: (function (path, mode, dev) {
		if (typeof dev === "undefined") {
			dev = mode;
			mode = 438
		}
		mode |= 8192;
		return FS.mknod(path, mode, dev)
	}),
	symlink: (function (oldpath, newpath) {
		if (!PATH.resolve(oldpath)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		var lookup = FS.lookupPath(newpath, {
			parent: true
		});
		var parent = lookup.node;
		if (!parent) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		var newname = PATH.basename(newpath);
		var err = FS.mayCreate(parent, newname);
		if (err) {
			throw new FS.ErrnoError(err)
		}
		if (!parent.node_ops.symlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		return parent.node_ops.symlink(parent, newname, oldpath)
	}),
	rename: (function (old_path, new_path) {
		var old_dirname = PATH.dirname(old_path);
		var new_dirname = PATH.dirname(new_path);
		var old_name = PATH.basename(old_path);
		var new_name = PATH.basename(new_path);
		var lookup, old_dir, new_dir;
		try {
			lookup = FS.lookupPath(old_path, {
				parent: true
			});
			old_dir = lookup.node;
			lookup = FS.lookupPath(new_path, {
				parent: true
			});
			new_dir = lookup.node
		} catch (e) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
		}
		if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		if (old_dir.mount !== new_dir.mount) {
			throw new FS.ErrnoError(ERRNO_CODES.EXDEV)
		}
		var old_node = FS.lookupNode(old_dir, old_name);
		var relative = PATH.relative(old_path, new_dirname);
		if (relative.charAt(0) !== ".") {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		relative = PATH.relative(new_path, old_dirname);
		if (relative.charAt(0) !== ".") {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
		}
		var new_node;
		try {
			new_node = FS.lookupNode(new_dir, new_name)
		} catch (e) {}
		if (old_node === new_node) {
			return
		}
		var isdir = FS.isDir(old_node.mode);
		var err = FS.mayDelete(old_dir, old_name, isdir);
		if (err) {
			throw new FS.ErrnoError(err)
		}
		err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
		if (err) {
			throw new FS.ErrnoError(err)
		}
		if (!old_dir.node_ops.rename) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
		}
		if (new_dir !== old_dir) {
			err = FS.nodePermissions(old_dir, "w");
			if (err) {
				throw new FS.ErrnoError(err)
			}
		}
		try {
			if (FS.trackingDelegate["willMovePath"]) {
				FS.trackingDelegate["willMovePath"](old_path, new_path)
			}
		} catch (e) {
			console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
		}
		FS.hashRemoveNode(old_node);
		try {
			old_dir.node_ops.rename(old_node, new_dir, new_name)
		} catch (e) {
			throw e
		} finally {
			FS.hashAddNode(old_node)
		}
		try {
			if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
		} catch (e) {
			console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
		}
	}),
	rmdir: (function (path) {
		var lookup = FS.lookupPath(path, {
			parent: true
		});
		var parent = lookup.node;
		var name = PATH.basename(path);
		var node = FS.lookupNode(parent, name);
		var err = FS.mayDelete(parent, name, true);
		if (err) {
			throw new FS.ErrnoError(err)
		}
		if (!parent.node_ops.rmdir) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		if (FS.isMountpoint(node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
		}
		try {
			if (FS.trackingDelegate["willDeletePath"]) {
				FS.trackingDelegate["willDeletePath"](path)
			}
		} catch (e) {
			console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
		}
		parent.node_ops.rmdir(parent, name);
		FS.destroyNode(node);
		try {
			if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
		} catch (e) {
			console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
		}
	}),
	readdir: (function (path) {
		var lookup = FS.lookupPath(path, {
			follow: true
		});
		var node = lookup.node;
		if (!node.node_ops.readdir) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
		}
		return node.node_ops.readdir(node)
	}),
	unlink: (function (path) {
		var lookup = FS.lookupPath(path, {
			parent: true
		});
		var parent = lookup.node;
		var name = PATH.basename(path);
		var node = FS.lookupNode(parent, name);
		var err = FS.mayDelete(parent, name, false);
		if (err) {
			if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
			throw new FS.ErrnoError(err)
		}
		if (!parent.node_ops.unlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		if (FS.isMountpoint(node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
		}
		try {
			if (FS.trackingDelegate["willDeletePath"]) {
				FS.trackingDelegate["willDeletePath"](path)
			}
		} catch (e) {
			console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
		}
		parent.node_ops.unlink(parent, name);
		FS.destroyNode(node);
		try {
			if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
		} catch (e) {
			console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
		}
	}),
	readlink: (function (path) {
		var lookup = FS.lookupPath(path);
		var link = lookup.node;
		if (!link) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		if (!link.node_ops.readlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
	}),
	stat: (function (path, dontFollow) {
		var lookup = FS.lookupPath(path, {
			follow: !dontFollow
		});
		var node = lookup.node;
		if (!node) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		if (!node.node_ops.getattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		return node.node_ops.getattr(node)
	}),
	lstat: (function (path) {
		return FS.stat(path, true)
	}),
	chmod: (function (path, mode, dontFollow) {
		var node;
		if (typeof path === "string") {
			var lookup = FS.lookupPath(path, {
				follow: !dontFollow
			});
			node = lookup.node
		} else {
			node = path
		}
		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		node.node_ops.setattr(node, {
			mode: mode & 4095 | node.mode & ~4095,
			timestamp: Date.now()
		})
	}),
	lchmod: (function (path, mode) {
		FS.chmod(path, mode, true)
	}),
	fchmod: (function (fd, mode) {
		var stream = FS.getStream(fd);
		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		FS.chmod(stream.node, mode)
	}),
	chown: (function (path, uid, gid, dontFollow) {
		var node;
		if (typeof path === "string") {
			var lookup = FS.lookupPath(path, {
				follow: !dontFollow
			});
			node = lookup.node
		} else {
			node = path
		}
		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		node.node_ops.setattr(node, {
			timestamp: Date.now()
		})
	}),
	lchown: (function (path, uid, gid) {
		FS.chown(path, uid, gid, true)
	}),
	fchown: (function (fd, uid, gid) {
		var stream = FS.getStream(fd);
		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		FS.chown(stream.node, uid, gid)
	}),
	truncate: (function (path, len) {
		if (len < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var node;
		if (typeof path === "string") {
			var lookup = FS.lookupPath(path, {
				follow: true
			});
			node = lookup.node
		} else {
			node = path
		}
		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM)
		}
		if (FS.isDir(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
		}
		if (!FS.isFile(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var err = FS.nodePermissions(node, "w");
		if (err) {
			throw new FS.ErrnoError(err)
		}
		node.node_ops.setattr(node, {
			size: len,
			timestamp: Date.now()
		})
	}),
	ftruncate: (function (fd, len) {
		var stream = FS.getStream(fd);
		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		FS.truncate(stream.node, len)
	}),
	utime: (function (path, atime, mtime) {
		var lookup = FS.lookupPath(path, {
			follow: true
		});
		var node = lookup.node;
		node.node_ops.setattr(node, {
			timestamp: Math.max(atime, mtime)
		})
	}),
	open: (function (path, flags, mode, fd_start, fd_end) {
		if (path === "") {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
		mode = typeof mode === "undefined" ? 438 : mode;
		if (flags & 64) {
			mode = mode & 4095 | 32768
		} else {
			mode = 0
		}
		var node;
		if (typeof path === "object") {
			node = path
		} else {
			path = PATH.normalize(path);
			try {
				var lookup = FS.lookupPath(path, {
					follow: !(flags & 131072)
				});
				node = lookup.node
			} catch (e) {}
		}
		var created = false;
		if (flags & 64) {
			if (node) {
				if (flags & 128) {
					throw new FS.ErrnoError(ERRNO_CODES.EEXIST)
				}
			} else {
				node = FS.mknod(path, mode, 0);
				created = true
			}
		}
		if (!node) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
		}
		if (FS.isChrdev(node.mode)) {
			flags &= ~512
		}
		if (flags & 65536 && !FS.isDir(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
		}
		if (!created) {
			var err = FS.mayOpen(node, flags);
			if (err) {
				throw new FS.ErrnoError(err)
			}
		}
		if (flags & 512) {
			FS.truncate(node, 0)
		}
		flags &= ~(128 | 512);
		var stream = FS.createStream({
			node: node,
			path: FS.getPath(node),
			flags: flags,
			seekable: true,
			position: 0,
			stream_ops: node.stream_ops,
			ungotten: [],
			error: false
		}, fd_start, fd_end);
		if (stream.stream_ops.open) {
			stream.stream_ops.open(stream)
		}
		if (Module["logReadFiles"] && !(flags & 1)) {
			if (!FS.readFiles) FS.readFiles = {};
			if (!(path in FS.readFiles)) {
				FS.readFiles[path] = 1;
				Module["printErr"]("read file: " + path)
			}
		}
		try {
			if (FS.trackingDelegate["onOpenFile"]) {
				var trackingFlags = 0;
				if ((flags & 2097155) !== 1) {
					trackingFlags |= FS.tracking.openFlags.READ
				}
				if ((flags & 2097155) !== 0) {
					trackingFlags |= FS.tracking.openFlags.WRITE
				}
				FS.trackingDelegate["onOpenFile"](path, trackingFlags)
			}
		} catch (e) {
			console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
		}
		return stream
	}),
	close: (function (stream) {
		if (stream.getdents) stream.getdents = null;
		try {
			if (stream.stream_ops.close) {
				stream.stream_ops.close(stream)
			}
		} catch (e) {
			throw e
		} finally {
			FS.closeStream(stream.fd)
		}
	}),
	llseek: (function (stream, offset, whence) {
		if (!stream.seekable || !stream.stream_ops.llseek) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
		}
		stream.position = stream.stream_ops.llseek(stream, offset, whence);
		stream.ungotten = [];
		return stream.position
	}),
	read: (function (stream, buffer, offset, length, position) {
		if (length < 0 || position < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		if ((stream.flags & 2097155) === 1) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		if (FS.isDir(stream.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
		}
		if (!stream.stream_ops.read) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		var seeking = true;
		if (typeof position === "undefined") {
			position = stream.position;
			seeking = false
		} else if (!stream.seekable) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
		}
		var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
		if (!seeking) stream.position += bytesRead;
		return bytesRead
	}),
	write: (function (stream, buffer, offset, length, position, canOwn) {
		if (length < 0 || position < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		if (FS.isDir(stream.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
		}
		if (!stream.stream_ops.write) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		if (stream.flags & 1024) {
			FS.llseek(stream, 0, 2)
		}
		var seeking = true;
		if (typeof position === "undefined") {
			position = stream.position;
			seeking = false
		} else if (!stream.seekable) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
		}
		var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
		if (!seeking) stream.position += bytesWritten;
		try {
			if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
		} catch (e) {
			console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message)
		}
		return bytesWritten
	}),
	allocate: (function (stream, offset, length) {
		if (offset < 0 || length <= 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
		}
		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF)
		}
		if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
		}
		if (!stream.stream_ops.allocate) {
			throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
		}
		stream.stream_ops.allocate(stream, offset, length)
	}),
	mmap: (function (stream, buffer, offset, length, position, prot, flags) {
		if ((stream.flags & 2097155) === 1) {
			throw new FS.ErrnoError(ERRNO_CODES.EACCES)
		}
		if (!stream.stream_ops.mmap) {
			throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
		}
		return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
	}),
	msync: (function (stream, buffer, offset, length, mmapFlags) {
		if (!stream || !stream.stream_ops.msync) {
			return 0
		}
		return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
	}),
	munmap: (function (stream) {
		return 0
	}),
	ioctl: (function (stream, cmd, arg) {
		if (!stream.stream_ops.ioctl) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTTY)
		}
		return stream.stream_ops.ioctl(stream, cmd, arg)
	}),
	readFile: (function (path, opts) {
		opts = opts || {};
		opts.flags = opts.flags || "r";
		opts.encoding = opts.encoding || "binary";
		if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
			throw new Error('Invalid encoding type "' + opts.encoding + '"')
		}
		var ret;
		var stream = FS.open(path, opts.flags);
		var stat = FS.stat(path);
		var length = stat.size;
		var buf = new Uint8Array(length);
		FS.read(stream, buf, 0, length, 0);
		if (opts.encoding === "utf8") {
			ret = UTF8ArrayToString(buf, 0)
		} else if (opts.encoding === "binary") {
			ret = buf
		}
		FS.close(stream);
		return ret
	}),
	writeFile: (function (path, data, opts) {
		opts = opts || {};
		opts.flags = opts.flags || "w";
		opts.encoding = opts.encoding || "utf8";
		if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
			throw new Error('Invalid encoding type "' + opts.encoding + '"')
		}
		var stream = FS.open(path, opts.flags, opts.mode);
		if (opts.encoding === "utf8") {
			var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
			var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
			FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn)
		} else if (opts.encoding === "binary") {
			FS.write(stream, data, 0, data.length, 0, opts.canOwn)
		}
		FS.close(stream)
	}),
	cwd: (function () {
		return FS.currentPath
	}),
	chdir: (function (path) {
		var lookup = FS.lookupPath(path, {
			follow: true
		});
		if (!FS.isDir(lookup.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
		}
		var err = FS.nodePermissions(lookup.node, "x");
		if (err) {
			throw new FS.ErrnoError(err)
		}
		FS.currentPath = lookup.path
	}),
	createDefaultDirectories: (function () {
		FS.mkdir("/tmp");
		FS.mkdir("/home");
		FS.mkdir("/home/web_user")
	}),
	createDefaultDevices: (function () {
		FS.mkdir("/dev");
		FS.registerDevice(FS.makedev(1, 3), {
			read: (function () {
				return 0
			}),
			write: (function (stream, buffer, offset, length, pos) {
				return length
			})
		});
		FS.mkdev("/dev/null", FS.makedev(1, 3));
		TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
		TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
		FS.mkdev("/dev/tty", FS.makedev(5, 0));
		FS.mkdev("/dev/tty1", FS.makedev(6, 0));
		var random_device;
		if (typeof crypto !== "undefined") {
			var randomBuffer = new Uint8Array(1);
			random_device = (function () {
				crypto.getRandomValues(randomBuffer);
				return randomBuffer[0]
			})
		} else if (ENVIRONMENT_IS_NODE) {
			random_device = (function () {
				return require("crypto").randomBytes(1)[0]
			})
		} else {
			random_device = (function () {
				return Math.random() * 256 | 0
			})
		}
		FS.createDevice("/dev", "random", random_device);
		FS.createDevice("/dev", "urandom", random_device);
		FS.mkdir("/dev/shm");
		FS.mkdir("/dev/shm/tmp")
	}),
	createSpecialDirectories: (function () {
		FS.mkdir("/proc");
		FS.mkdir("/proc/self");
		FS.mkdir("/proc/self/fd");
		FS.mount({
			mount: (function () {
				var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
				node.node_ops = {
					lookup: (function (parent, name) {
						var fd = +name;
						var stream = FS.getStream(fd);
						if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
						var ret = {
							parent: null,
							mount: {
								mountpoint: "fake"
							},
							node_ops: {
								readlink: (function () {
									return stream.path
								})
							}
						};
						ret.parent = ret;
						return ret
					})
				};
				return node
			})
		}, {}, "/proc/self/fd")
	}),
	createStandardStreams: (function () {
		if (Module["stdin"]) {
			FS.createDevice("/dev", "stdin", Module["stdin"])
		} else {
			FS.symlink("/dev/tty", "/dev/stdin")
		}
		if (Module["stdout"]) {
			FS.createDevice("/dev", "stdout", null, Module["stdout"])
		} else {
			FS.symlink("/dev/tty", "/dev/stdout")
		}
		if (Module["stderr"]) {
			FS.createDevice("/dev", "stderr", null, Module["stderr"])
		} else {
			FS.symlink("/dev/tty1", "/dev/stderr")
		}
		var stdin = FS.open("/dev/stdin", "r");
		assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
		var stdout = FS.open("/dev/stdout", "w");
		assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
		var stderr = FS.open("/dev/stderr", "w");
		assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")")
	}),
	ensureErrnoError: (function () {
		if (FS.ErrnoError) return;
		FS.ErrnoError = function ErrnoError(errno, node) {
			this.node = node;
			this.setErrno = (function (errno) {
				this.errno = errno;
				for (var key in ERRNO_CODES) {
					if (ERRNO_CODES[key] === errno) {
						this.code = key;
						break
					}
				}
			});
			this.setErrno(errno);
			this.message = ERRNO_MESSAGES[errno]
		};
		FS.ErrnoError.prototype = new Error;
		FS.ErrnoError.prototype.constructor = FS.ErrnoError;
		[ERRNO_CODES.ENOENT].forEach((function (code) {
			FS.genericErrors[code] = new FS.ErrnoError(code);
			FS.genericErrors[code].stack = "<generic error, no stack>"
		}))
	}),
	staticInit: (function () {
		FS.ensureErrnoError();
		FS.nameTable = new Array(4096);
		FS.mount(MEMFS, {}, "/");
		FS.createDefaultDirectories();
		FS.createDefaultDevices();
		FS.createSpecialDirectories()
	}),
	init: (function (input, output, error) {
		assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
		FS.init.initialized = true;
		FS.ensureErrnoError();
		Module["stdin"] = input || Module["stdin"];
		Module["stdout"] = output || Module["stdout"];
		Module["stderr"] = error || Module["stderr"];
		FS.createStandardStreams()
	}),
	quit: (function () {
		FS.init.initialized = false;
		var fflush = Module["_fflush"];
		if (fflush) fflush(0);
		for (var i = 0; i < FS.streams.length; i++) {
			var stream = FS.streams[i];
			if (!stream) {
				continue
			}
			FS.close(stream)
		}
	}),
	getMode: (function (canRead, canWrite) {
		var mode = 0;
		if (canRead) mode |= 292 | 73;
		if (canWrite) mode |= 146;
		return mode
	}),
	joinPath: (function (parts, forceRelative) {
		var path = PATH.join.apply(null, parts);
		if (forceRelative && path[0] == "/") path = path.substr(1);
		return path
	}),
	absolutePath: (function (relative, base) {
		return PATH.resolve(base, relative)
	}),
	standardizePath: (function (path) {
		return PATH.normalize(path)
	}),
	findObject: (function (path, dontResolveLastLink) {
		var ret = FS.analyzePath(path, dontResolveLastLink);
		if (ret.exists) {
			return ret.object
		} else {
			___setErrNo(ret.error);
			return null
		}
	}),
	analyzePath: (function (path, dontResolveLastLink) {
		try {
			var lookup = FS.lookupPath(path, {
				follow: !dontResolveLastLink
			});
			path = lookup.path
		} catch (e) {}
		var ret = {
			isRoot: false,
			exists: false,
			error: 0,
			name: null,
			path: null,
			object: null,
			parentExists: false,
			parentPath: null,
			parentObject: null
		};
		try {
			var lookup = FS.lookupPath(path, {
				parent: true
			});
			ret.parentExists = true;
			ret.parentPath = lookup.path;
			ret.parentObject = lookup.node;
			ret.name = PATH.basename(path);
			lookup = FS.lookupPath(path, {
				follow: !dontResolveLastLink
			});
			ret.exists = true;
			ret.path = lookup.path;
			ret.object = lookup.node;
			ret.name = lookup.node.name;
			ret.isRoot = lookup.path === "/"
		} catch (e) {
			ret.error = e.errno
		}
		return ret
	}),
	createFolder: (function (parent, name, canRead, canWrite) {
		var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(canRead, canWrite);
		return FS.mkdir(path, mode)
	}),
	createPath: (function (parent, path, canRead, canWrite) {
		parent = typeof parent === "string" ? parent : FS.getPath(parent);
		var parts = path.split("/").reverse();
		while (parts.length) {
			var part = parts.pop();
			if (!part) continue;
			var current = PATH.join2(parent, part);
			try {
				FS.mkdir(current)
			} catch (e) {}
			parent = current
		}
		return current
	}),
	createFile: (function (parent, name, properties, canRead, canWrite) {
		var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(canRead, canWrite);
		return FS.create(path, mode)
	}),
	createDataFile: (function (parent, name, data, canRead, canWrite, canOwn) {
		var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
		var mode = FS.getMode(canRead, canWrite);
		var node = FS.create(path, mode);
		if (data) {
			if (typeof data === "string") {
				var arr = new Array(data.length);
				for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
				data = arr
			}
			FS.chmod(node, mode | 146);
			var stream = FS.open(node, "w");
			FS.write(stream, data, 0, data.length, 0, canOwn);
			FS.close(stream);
			FS.chmod(node, mode)
		}
		return node
	}),
	createDevice: (function (parent, name, input, output) {
		var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(!!input, !!output);
		if (!FS.createDevice.major) FS.createDevice.major = 64;
		var dev = FS.makedev(FS.createDevice.major++, 0);
		FS.registerDevice(dev, {
			open: (function (stream) {
				stream.seekable = false
			}),
			close: (function (stream) {
				if (output && output.buffer && output.buffer.length) {
					output(10)
				}
			}),
			read: (function (stream, buffer, offset, length, pos) {
				var bytesRead = 0;
				for (var i = 0; i < length; i++) {
					var result;
					try {
						result = input()
					} catch (e) {
						throw new FS.ErrnoError(ERRNO_CODES.EIO)
					}
					if (result === undefined && bytesRead === 0) {
						throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
					}
					if (result === null || result === undefined) break;
					bytesRead++;
					buffer[offset + i] = result
				}
				if (bytesRead) {
					stream.node.timestamp = Date.now()
				}
				return bytesRead
			}),
			write: (function (stream, buffer, offset, length, pos) {
				for (var i = 0; i < length; i++) {
					try {
						output(buffer[offset + i])
					} catch (e) {
						throw new FS.ErrnoError(ERRNO_CODES.EIO)
					}
				}
				if (length) {
					stream.node.timestamp = Date.now()
				}
				return i
			})
		});
		return FS.mkdev(path, mode, dev)
	}),
	createLink: (function (parent, name, target, canRead, canWrite) {
		var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
		return FS.symlink(target, path)
	}),
	forceLoadFile: (function (obj) {
		if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
		var success = true;
		if (typeof XMLHttpRequest !== "undefined") {
			throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
		} else if (Module["read"]) {
			try {
				obj.contents = intArrayFromString(Module["read"](obj.url), true);
				obj.usedBytes = obj.contents.length
			} catch (e) {
				success = false
			}
		} else {
			throw new Error("Cannot load without read() or XMLHttpRequest.")
		}
		if (!success) ___setErrNo(ERRNO_CODES.EIO);
		return success
	}),
	createLazyFile: (function (parent, name, url, canRead, canWrite) {
		function LazyUint8Array() {
			this.lengthKnown = false;
			this.chunks = []
		}
		LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
			if (idx > this.length - 1 || idx < 0) {
				return undefined
			}
			var chunkOffset = idx % this.chunkSize;
			var chunkNum = idx / this.chunkSize | 0;
			return this.getter(chunkNum)[chunkOffset]
		};
		LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
			this.getter = getter
		};
		LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
			var xhr = new XMLHttpRequest;
			xhr.open("HEAD", url, false);
			xhr.send(null);
			if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
			var datalength = Number(xhr.getResponseHeader("Content-length"));
			var header;
			var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
			var chunkSize = 1024 * 1024;
			if (!hasByteServing) chunkSize = datalength;
			var doXHR = (function (from, to) {
				if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
				if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
				var xhr = new XMLHttpRequest;
				xhr.open("GET", url, false);
				if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
				if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
				if (xhr.overrideMimeType) {
					xhr.overrideMimeType("text/plain; charset=x-user-defined")
				}
				xhr.send(null);
				if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
				if (xhr.response !== undefined) {
					return new Uint8Array(xhr.response || [])
				} else {
					return intArrayFromString(xhr.responseText || "", true)
				}
			});
			var lazyArray = this;
			lazyArray.setDataGetter((function (chunkNum) {
				var start = chunkNum * chunkSize;
				var end = (chunkNum + 1) * chunkSize - 1;
				end = Math.min(end, datalength - 1);
				if (typeof lazyArray.chunks[chunkNum] === "undefined") {
					lazyArray.chunks[chunkNum] = doXHR(start, end)
				}
				if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
				return lazyArray.chunks[chunkNum]
			}));
			this._length = datalength;
			this._chunkSize = chunkSize;
			this.lengthKnown = true
		};
		if (typeof XMLHttpRequest !== "undefined") {
			if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
			var lazyArray = new LazyUint8Array;
			Object.defineProperty(lazyArray, "length", {
				get: (function () {
					if (!this.lengthKnown) {
						this.cacheLength()
					}
					return this._length
				})
			});
			Object.defineProperty(lazyArray, "chunkSize", {
				get: (function () {
					if (!this.lengthKnown) {
						this.cacheLength()
					}
					return this._chunkSize
				})
			});
			var properties = {
				isDevice: false,
				contents: lazyArray
			}
		} else {
			var properties = {
				isDevice: false,
				url: url
			}
		}
		var node = FS.createFile(parent, name, properties, canRead, canWrite);
		if (properties.contents) {
			node.contents = properties.contents
		} else if (properties.url) {
			node.contents = null;
			node.url = properties.url
		}
		Object.defineProperty(node, "usedBytes", {
			get: (function () {
				return this.contents.length
			})
		});
		var stream_ops = {};
		var keys = Object.keys(node.stream_ops);
		keys.forEach((function (key) {
			var fn = node.stream_ops[key];
			stream_ops[key] = function forceLoadLazyFile() {
				if (!FS.forceLoadFile(node)) {
					throw new FS.ErrnoError(ERRNO_CODES.EIO)
				}
				return fn.apply(null, arguments)
			}
		}));
		stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
			if (!FS.forceLoadFile(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EIO)
			}
			var contents = stream.node.contents;
			if (position >= contents.length) return 0;
			var size = Math.min(contents.length - position, length);
			assert(size >= 0);
			if (contents.slice) {
				for (var i = 0; i < size; i++) {
					buffer[offset + i] = contents[position + i]
				}
			} else {
				for (var i = 0; i < size; i++) {
					buffer[offset + i] = contents.get(position + i)
				}
			}
			return size
		};
		node.stream_ops = stream_ops;
		return node
	}),
	createPreloadedFile: (function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
		Browser.init();
		var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
		var dep = getUniqueRunDependency("cp " + fullname);

		function processData(byteArray) {
			function finish(byteArray) {
				if (preFinish) preFinish();
				if (!dontCreateFile) {
					FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
				}
				if (onload) onload();
				removeRunDependency(dep)
			}
			var handled = false;
			Module["preloadPlugins"].forEach((function (plugin) {
				if (handled) return;
				if (plugin["canHandle"](fullname)) {
					plugin["handle"](byteArray, fullname, finish, (function () {
						if (onerror) onerror();
						removeRunDependency(dep)
					}));
					handled = true
				}
			}));
			if (!handled) finish(byteArray)
		}
		addRunDependency(dep);
		if (typeof url == "string") {
			Browser.asyncLoad(url, (function (byteArray) {
				processData(byteArray)
			}), onerror)
		} else {
			processData(url)
		}
	}),
	indexedDB: (function () {
		return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
	}),
	DB_NAME: (function () {
		return "EM_FS_" + window.location.pathname
	}),
	DB_VERSION: 20,
	DB_STORE_NAME: "FILE_DATA",
	saveFilesToDB: (function (paths, onload, onerror) {
		onload = onload || (function () {});
		onerror = onerror || (function () {});
		var indexedDB = FS.indexedDB();
		try {
			var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
		} catch (e) {
			return onerror(e)
		}
		openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
			console.log("creating db");
			var db = openRequest.result;
			db.createObjectStore(FS.DB_STORE_NAME)
		};
		openRequest.onsuccess = function openRequest_onsuccess() {
			var db = openRequest.result;
			var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
			var files = transaction.objectStore(FS.DB_STORE_NAME);
			var ok = 0,
				fail = 0,
				total = paths.length;

			function finish() {
				if (fail == 0) onload();
				else onerror()
			}
			paths.forEach((function (path) {
				var putRequest = files.put(FS.analyzePath(path).object.contents, path);
				putRequest.onsuccess = function putRequest_onsuccess() {
					ok++;
					if (ok + fail == total) finish()
				};
				putRequest.onerror = function putRequest_onerror() {
					fail++;
					if (ok + fail == total) finish()
				}
			}));
			transaction.onerror = onerror
		};
		openRequest.onerror = onerror
	}),
	loadFilesFromDB: (function (paths, onload, onerror) {
		onload = onload || (function () {});
		onerror = onerror || (function () {});
		var indexedDB = FS.indexedDB();
		try {
			var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
		} catch (e) {
			return onerror(e)
		}
		openRequest.onupgradeneeded = onerror;
		openRequest.onsuccess = function openRequest_onsuccess() {
			var db = openRequest.result;
			try {
				var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
			} catch (e) {
				onerror(e);
				return
			}
			var files = transaction.objectStore(FS.DB_STORE_NAME);
			var ok = 0,
				fail = 0,
				total = paths.length;

			function finish() {
				if (fail == 0) onload();
				else onerror()
			}
			paths.forEach((function (path) {
				var getRequest = files.get(path);
				getRequest.onsuccess = function getRequest_onsuccess() {
					if (FS.analyzePath(path).exists) {
						FS.unlink(path)
					}
					FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
					ok++;
					if (ok + fail == total) finish()
				};
				getRequest.onerror = function getRequest_onerror() {
					fail++;
					if (ok + fail == total) finish()
				}
			}));
			transaction.onerror = onerror
		};
		openRequest.onerror = onerror
	})
};
var PATH = {
	splitPath: (function (filename) {
		var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
		return splitPathRe.exec(filename).slice(1)
	}),
	normalizeArray: (function (parts, allowAboveRoot) {
		var up = 0;
		for (var i = parts.length - 1; i >= 0; i--) {
			var last = parts[i];
			if (last === ".") {
				parts.splice(i, 1)
			} else if (last === "..") {
				parts.splice(i, 1);
				up++
			} else if (up) {
				parts.splice(i, 1);
				up--
			}
		}
		if (allowAboveRoot) {
			for (; up--; up) {
				parts.unshift("..")
			}
		}
		return parts
	}),
	normalize: (function (path) {
		var isAbsolute = path.charAt(0) === "/",
			trailingSlash = path.substr(-1) === "/";
		path = PATH.normalizeArray(path.split("/").filter((function (p) {
			return !!p
		})), !isAbsolute).join("/");
		if (!path && !isAbsolute) {
			path = "."
		}
		if (path && trailingSlash) {
			path += "/"
		}
		return (isAbsolute ? "/" : "") + path
	}),
	dirname: (function (path) {
		var result = PATH.splitPath(path),
			root = result[0],
			dir = result[1];
		if (!root && !dir) {
			return "."
		}
		if (dir) {
			dir = dir.substr(0, dir.length - 1)
		}
		return root + dir
	}),
	basename: (function (path) {
		if (path === "/") return "/";
		var lastSlash = path.lastIndexOf("/");
		if (lastSlash === -1) return path;
		return path.substr(lastSlash + 1)
	}),
	extname: (function (path) {
		return PATH.splitPath(path)[3]
	}),
	join: (function () {
		var paths = Array.prototype.slice.call(arguments, 0);
		return PATH.normalize(paths.join("/"))
	}),
	join2: (function (l, r) {
		return PATH.normalize(l + "/" + r)
	}),
	resolve: (function () {
		var resolvedPath = "",
			resolvedAbsolute = false;
		for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
			var path = i >= 0 ? arguments[i] : FS.cwd();
			if (typeof path !== "string") {
				throw new TypeError("Arguments to path.resolve must be strings")
			} else if (!path) {
				return ""
			}
			resolvedPath = path + "/" + resolvedPath;
			resolvedAbsolute = path.charAt(0) === "/"
		}
		resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter((function (p) {
			return !!p
		})), !resolvedAbsolute).join("/");
		return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
	}),
	relative: (function (from, to) {
		from = PATH.resolve(from).substr(1);
		to = PATH.resolve(to).substr(1);

		function trim(arr) {
			var start = 0;
			for (; start < arr.length; start++) {
				if (arr[start] !== "") break
			}
			var end = arr.length - 1;
			for (; end >= 0; end--) {
				if (arr[end] !== "") break
			}
			if (start > end) return [];
			return arr.slice(start, end - start + 1)
		}
		var fromParts = trim(from.split("/"));
		var toParts = trim(to.split("/"));
		var length = Math.min(fromParts.length, toParts.length);
		var samePartsLength = length;
		for (var i = 0; i < length; i++) {
			if (fromParts[i] !== toParts[i]) {
				samePartsLength = i;
				break
			}
		}
		var outputParts = [];
		for (var i = samePartsLength; i < fromParts.length; i++) {
			outputParts.push("..")
		}
		outputParts = outputParts.concat(toParts.slice(samePartsLength));
		return outputParts.join("/")
	})
};

function _emscripten_set_main_loop_timing(mode, value) {
	Browser.mainLoop.timingMode = mode;
	Browser.mainLoop.timingValue = value;
	if (!Browser.mainLoop.func) {
		return 1
	}
	if (mode == 0) {
		Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
			setTimeout(Browser.mainLoop.runner, value)
		};
		Browser.mainLoop.method = "timeout"
	} else if (mode == 1) {
		Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
			Browser.requestAnimationFrame(Browser.mainLoop.runner)
		};
		Browser.mainLoop.method = "rAF"
	}
	return 0
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
	Module["noExitRuntime"] = true;
	assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
	Browser.mainLoop.func = func;
	Browser.mainLoop.arg = arg;
	var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
	Browser.mainLoop.runner = function Browser_mainLoop_runner() {
		if (ABORT) return;
		if (Browser.mainLoop.queue.length > 0) {
			var start = Date.now();
			var blocker = Browser.mainLoop.queue.shift();
			blocker.func(blocker.arg);
			if (Browser.mainLoop.remainingBlockers) {
				var remaining = Browser.mainLoop.remainingBlockers;
				var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
				if (blocker.counted) {
					Browser.mainLoop.remainingBlockers = next
				} else {
					next = next + .5;
					Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
				}
			}
			console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
			Browser.mainLoop.updateStatus();
			setTimeout(Browser.mainLoop.runner, 0);
			return
		}
		if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
		Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
		if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
			Browser.mainLoop.scheduler();
			return
		}
		if (Browser.mainLoop.method === "timeout" && Module.ctx) {
			Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
			Browser.mainLoop.method = ""
		}
		Browser.mainLoop.runIter((function () {
			if (typeof arg !== "undefined") {
				Runtime.dynCall("vi", func, [arg])
			} else {
				Runtime.dynCall("v", func)
			}
		}));
		if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
		if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
		Browser.mainLoop.scheduler()
	};
	if (!noSetTiming) {
		if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
		else _emscripten_set_main_loop_timing(1, 1);
		Browser.mainLoop.scheduler()
	}
	if (simulateInfiniteLoop) {
		throw "SimulateInfiniteLoop"
	}
}
var Browser = {
	mainLoop: {
		scheduler: null,
		method: "",
		currentlyRunningMainloop: 0,
		func: null,
		arg: 0,
		timingMode: 0,
		timingValue: 0,
		currentFrameNumber: 0,
		queue: [],
		pause: (function () {
			Browser.mainLoop.scheduler = null;
			Browser.mainLoop.currentlyRunningMainloop++
		}),
		resume: (function () {
			Browser.mainLoop.currentlyRunningMainloop++;
			var timingMode = Browser.mainLoop.timingMode;
			var timingValue = Browser.mainLoop.timingValue;
			var func = Browser.mainLoop.func;
			Browser.mainLoop.func = null;
			_emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
			_emscripten_set_main_loop_timing(timingMode, timingValue);
			Browser.mainLoop.scheduler()
		}),
		updateStatus: (function () {
			if (Module["setStatus"]) {
				var message = Module["statusMessage"] || "Please wait...";
				var remaining = Browser.mainLoop.remainingBlockers;
				var expected = Browser.mainLoop.expectedBlockers;
				if (remaining) {
					if (remaining < expected) {
						Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
					} else {
						Module["setStatus"](message)
					}
				} else {
					Module["setStatus"]("")
				}
			}
		}),
		runIter: (function (func) {
			if (ABORT) return;
			if (Module["preMainLoop"]) {
				var preRet = Module["preMainLoop"]();
				if (preRet === false) {
					return
				}
			}
			try {
				func()
			} catch (e) {
				if (e instanceof ExitStatus) {
					return
				} else {
					if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [e, e.stack]);
					throw e
				}
			}
			if (Module["postMainLoop"]) Module["postMainLoop"]()
		})
	},
	isFullScreen: false,
	pointerLock: false,
	moduleContextCreatedCallbacks: [],
	workers: [],
	init: (function () {
		if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
		if (Browser.initted) return;
		Browser.initted = true;
		try {
			new Blob;
			Browser.hasBlobConstructor = true
		} catch (e) {
			Browser.hasBlobConstructor = false;
			console.log("warning: no blob constructor, cannot create blobs with mimetypes")
		}
		Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
		Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
		if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
			console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
			Module.noImageDecoding = true
		}
		var imagePlugin = {};
		imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
			return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
		};
		imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
			var b = null;
			if (Browser.hasBlobConstructor) {
				try {
					b = new Blob([byteArray], {
						type: Browser.getMimetype(name)
					});
					if (b.size !== byteArray.length) {
						b = new Blob([(new Uint8Array(byteArray)).buffer], {
							type: Browser.getMimetype(name)
						})
					}
				} catch (e) {
					Runtime.warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
				}
			}
			if (!b) {
				var bb = new Browser.BlobBuilder;
				bb.append((new Uint8Array(byteArray)).buffer);
				b = bb.getBlob()
			}
			var url = Browser.URLObject.createObjectURL(b);
			var img = new Image;
			img.onload = function img_onload() {
				assert(img.complete, "Image " + name + " could not be decoded");
				var canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
				Module["preloadedImages"][name] = canvas;
				Browser.URLObject.revokeObjectURL(url);
				if (onload) onload(byteArray)
			};
			img.onerror = function img_onerror(event) {
				console.log("Image " + url + " could not be decoded");
				if (onerror) onerror()
			};
			img.src = url
		};
		Module["preloadPlugins"].push(imagePlugin);
		var audioPlugin = {};
		audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
			return !Module.noAudioDecoding && name.substr(-4) in {
				".ogg": 1,
				".wav": 1,
				".mp3": 1
			}
		};
		audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
			var done = false;

			function finish(audio) {
				if (done) return;
				done = true;
				Module["preloadedAudios"][name] = audio;
				if (onload) onload(byteArray)
			}

			function fail() {
				if (done) return;
				done = true;
				Module["preloadedAudios"][name] = new Audio;
				if (onerror) onerror()
			}
			if (Browser.hasBlobConstructor) {
				try {
					var b = new Blob([byteArray], {
						type: Browser.getMimetype(name)
					})
				} catch (e) {
					return fail()
				}
				var url = Browser.URLObject.createObjectURL(b);
				var audio = new Audio;
				audio.addEventListener("canplaythrough", (function () {
					finish(audio)
				}), false);
				audio.onerror = function audio_onerror(event) {
					if (done) return;
					console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

					function encode64(data) {
						var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
						var PAD = "=";
						var ret = "";
						var leftchar = 0;
						var leftbits = 0;
						for (var i = 0; i < data.length; i++) {
							leftchar = leftchar << 8 | data[i];
							leftbits += 8;
							while (leftbits >= 6) {
								var curr = leftchar >> leftbits - 6 & 63;
								leftbits -= 6;
								ret += BASE[curr]
							}
						}
						if (leftbits == 2) {
							ret += BASE[(leftchar & 3) << 4];
							ret += PAD + PAD
						} else if (leftbits == 4) {
							ret += BASE[(leftchar & 15) << 2];
							ret += PAD
						}
						return ret
					}
					audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
					finish(audio)
				};
				audio.src = url;
				Browser.safeSetTimeout((function () {
					finish(audio)
				}), 1e4)
			} else {
				return fail()
			}
		};
		Module["preloadPlugins"].push(audioPlugin);
		var canvas = Module["canvas"];

		function pointerLockChange() {
			Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas || document["msPointerLockElement"] === canvas
		}
		if (canvas) {
			canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (function () {});
			canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (function () {});
			canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
			document.addEventListener("pointerlockchange", pointerLockChange, false);
			document.addEventListener("mozpointerlockchange", pointerLockChange, false);
			document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
			document.addEventListener("mspointerlockchange", pointerLockChange, false);
			if (Module["elementPointerLock"]) {
				canvas.addEventListener("click", (function (ev) {
					if (!Browser.pointerLock && canvas.requestPointerLock) {
						canvas.requestPointerLock();
						ev.preventDefault()
					}
				}), false)
			}
		}
	}),
	createContext: (function (canvas, useWebGL, setInModule, webGLContextAttributes) {
		if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
		var ctx;
		var contextHandle;
		if (useWebGL) {
			var contextAttributes = {
				antialias: false,
				alpha: false
			};
			if (webGLContextAttributes) {
				for (var attribute in webGLContextAttributes) {
					contextAttributes[attribute] = webGLContextAttributes[attribute]
				}
			}
			contextHandle = GL.createContext(canvas, contextAttributes);
			if (contextHandle) {
				ctx = GL.getContext(contextHandle).GLctx
			}
			canvas.style.backgroundColor = "black"
		} else {
			ctx = canvas.getContext("2d")
		}
		if (!ctx) return null;
		if (setInModule) {
			if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
			Module.ctx = ctx;
			if (useWebGL) GL.makeContextCurrent(contextHandle);
			Module.useWebGL = useWebGL;
			Browser.moduleContextCreatedCallbacks.forEach((function (callback) {
				callback()
			}));
			Browser.init()
		}
		return ctx
	}),
	destroyContext: (function (canvas, useWebGL, setInModule) {}),
	fullScreenHandlersInstalled: false,
	lockPointer: undefined,
	resizeCanvas: undefined,
	requestFullScreen: (function (lockPointer, resizeCanvas, vrDevice) {
		Browser.lockPointer = lockPointer;
		Browser.resizeCanvas = resizeCanvas;
		Browser.vrDevice = vrDevice;
		if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
		if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
		if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
		var canvas = Module["canvas"];

		function fullScreenChange() {
			Browser.isFullScreen = false;
			var canvasContainer = canvas.parentNode;
			if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
				canvas.cancelFullScreen = document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["webkitCancelFullScreen"] || document["msExitFullscreen"] || document["exitFullscreen"] || (function () {});
				canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
				if (Browser.lockPointer) canvas.requestPointerLock();
				Browser.isFullScreen = true;
				if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize()
			} else {
				canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
				canvasContainer.parentNode.removeChild(canvasContainer);
				if (Browser.resizeCanvas) Browser.setWindowedCanvasSize()
			}
			if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullScreen);
			Browser.updateCanvasDimensions(canvas)
		}
		if (!Browser.fullScreenHandlersInstalled) {
			Browser.fullScreenHandlersInstalled = true;
			document.addEventListener("fullscreenchange", fullScreenChange, false);
			document.addEventListener("mozfullscreenchange", fullScreenChange, false);
			document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
			document.addEventListener("MSFullscreenChange", fullScreenChange, false)
		}
		var canvasContainer = document.createElement("div");
		canvas.parentNode.insertBefore(canvasContainer, canvas);
		canvasContainer.appendChild(canvas);
		canvasContainer.requestFullScreen = canvasContainer["requestFullScreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullScreen"] ? (function () {
			canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
		}) : null);
		if (vrDevice) {
			canvasContainer.requestFullScreen({
				vrDisplay: vrDevice
			})
		} else {
			canvasContainer.requestFullScreen()
		}
	}),
	nextRAF: 0,
	fakeRequestAnimationFrame: (function (func) {
		var now = Date.now();
		if (Browser.nextRAF === 0) {
			Browser.nextRAF = now + 1e3 / 60
		} else {
			while (now + 2 >= Browser.nextRAF) {
				Browser.nextRAF += 1e3 / 60
			}
		}
		var delay = Math.max(Browser.nextRAF - now, 0);
		setTimeout(func, delay)
	}),
	requestAnimationFrame: function requestAnimationFrame(func) {
		if (typeof window === "undefined") {
			Browser.fakeRequestAnimationFrame(func)
		} else {
			if (!window.requestAnimationFrame) {
				window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
			}
			window.requestAnimationFrame(func)
		}
	},
	safeCallback: (function (func) {
		return (function () {
			if (!ABORT) return func.apply(null, arguments)
		})
	}),
	allowAsyncCallbacks: true,
	queuedAsyncCallbacks: [],
	pauseAsyncCallbacks: (function () {
		Browser.allowAsyncCallbacks = false
	}),
	resumeAsyncCallbacks: (function () {
		Browser.allowAsyncCallbacks = true;
		if (Browser.queuedAsyncCallbacks.length > 0) {
			var callbacks = Browser.queuedAsyncCallbacks;
			Browser.queuedAsyncCallbacks = [];
			callbacks.forEach((function (func) {
				func()
			}))
		}
	}),
	safeRequestAnimationFrame: (function (func) {
		return Browser.requestAnimationFrame((function () {
			if (ABORT) return;
			if (Browser.allowAsyncCallbacks) {
				func()
			} else {
				Browser.queuedAsyncCallbacks.push(func)
			}
		}))
	}),
	safeSetTimeout: (function (func, timeout) {
		Module["noExitRuntime"] = true;
		return setTimeout((function () {
			if (ABORT) return;
			if (Browser.allowAsyncCallbacks) {
				func()
			} else {
				Browser.queuedAsyncCallbacks.push(func)
			}
		}), timeout)
	}),
	safeSetInterval: (function (func, timeout) {
		Module["noExitRuntime"] = true;
		return setInterval((function () {
			if (ABORT) return;
			if (Browser.allowAsyncCallbacks) {
				func()
			}
		}), timeout)
	}),
	getMimetype: (function (name) {
		return {
			"jpg": "image/jpeg",
			"jpeg": "image/jpeg",
			"png": "image/png",
			"bmp": "image/bmp",
			"ogg": "audio/ogg",
			"wav": "audio/wav",
			"mp3": "audio/mpeg"
		}[name.substr(name.lastIndexOf(".") + 1)]
	}),
	getUserMedia: (function (func) {
		if (!window.getUserMedia) {
			window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
		}
		window.getUserMedia(func)
	}),
	getMovementX: (function (event) {
		return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
	}),
	getMovementY: (function (event) {
		return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
	}),
	getMouseWheelDelta: (function (event) {
		var delta = 0;
		switch (event.type) {
			case "DOMMouseScroll":
				delta = event.detail;
				break;
			case "mousewheel":
				delta = event.wheelDelta;
				break;
			case "wheel":
				delta = event["deltaY"];
				break;
			default:
				throw "unrecognized mouse wheel event: " + event.type
		}
		return delta
	}),
	mouseX: 0,
	mouseY: 0,
	mouseMovementX: 0,
	mouseMovementY: 0,
	touches: {},
	lastTouches: {},
	calculateMouseEvent: (function (event) {
		if (Browser.pointerLock) {
			if (event.type != "mousemove" && "mozMovementX" in event) {
				Browser.mouseMovementX = Browser.mouseMovementY = 0
			} else {
				Browser.mouseMovementX = Browser.getMovementX(event);
				Browser.mouseMovementY = Browser.getMovementY(event)
			}
			if (typeof SDL != "undefined") {
				Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
				Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
			} else {
				Browser.mouseX += Browser.mouseMovementX;
				Browser.mouseY += Browser.mouseMovementY
			}
		} else {
			var rect = Module["canvas"].getBoundingClientRect();
			var cw = Module["canvas"].width;
			var ch = Module["canvas"].height;
			var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
			var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
			if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
				var touch = event.touch;
				if (touch === undefined) {
					return
				}
				var adjustedX = touch.pageX - (scrollX + rect.left);
				var adjustedY = touch.pageY - (scrollY + rect.top);
				adjustedX = adjustedX * (cw / rect.width);
				adjustedY = adjustedY * (ch / rect.height);
				var coords = {
					x: adjustedX,
					y: adjustedY
				};
				if (event.type === "touchstart") {
					Browser.lastTouches[touch.identifier] = coords;
					Browser.touches[touch.identifier] = coords
				} else if (event.type === "touchend" || event.type === "touchmove") {
					var last = Browser.touches[touch.identifier];
					if (!last) last = coords;
					Browser.lastTouches[touch.identifier] = last;
					Browser.touches[touch.identifier] = coords
				}
				return
			}
			var x = event.pageX - (scrollX + rect.left);
			var y = event.pageY - (scrollY + rect.top);
			x = x * (cw / rect.width);
			y = y * (ch / rect.height);
			Browser.mouseMovementX = x - Browser.mouseX;
			Browser.mouseMovementY = y - Browser.mouseY;
			Browser.mouseX = x;
			Browser.mouseY = y
		}
	}),
	xhrLoad: (function (url, onload, onerror) {
		var xhr = new XMLHttpRequest;
		xhr.open("GET", url, true);
		xhr.responseType = "arraybuffer";
		xhr.onload = function xhr_onload() {
			if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
				onload(xhr.response)
			} else {
				onerror()
			}
		};
		xhr.onerror = onerror;
		xhr.send(null)
	}),
	asyncLoad: (function (url, onload, onerror, noRunDep) {
		Browser.xhrLoad(url, (function (arrayBuffer) {
			assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
			onload(new Uint8Array(arrayBuffer));
			if (!noRunDep) removeRunDependency("al " + url)
		}), (function (event) {
			if (onerror) {
				onerror()
			} else {
				throw 'Loading data file "' + url + '" failed.'
			}
		}));
		if (!noRunDep) addRunDependency("al " + url)
	}),
	resizeListeners: [],
	updateResizeListeners: (function () {
		var canvas = Module["canvas"];
		Browser.resizeListeners.forEach((function (listener) {
			listener(canvas.width, canvas.height)
		}))
	}),
	setCanvasSize: (function (width, height, noUpdates) {
		var canvas = Module["canvas"];
		Browser.updateCanvasDimensions(canvas, width, height);
		if (!noUpdates) Browser.updateResizeListeners()
	}),
	windowedWidth: 0,
	windowedHeight: 0,
	setFullScreenCanvasSize: (function () {
		if (typeof SDL != "undefined") {
			var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
			flags = flags | 8388608;
			HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags
		}
		Browser.updateResizeListeners()
	}),
	setWindowedCanvasSize: (function () {
		if (typeof SDL != "undefined") {
			var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
			flags = flags & ~8388608;
			HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags
		}
		Browser.updateResizeListeners()
	}),
	updateCanvasDimensions: (function (canvas, wNative, hNative) {
		if (wNative && hNative) {
			canvas.widthNative = wNative;
			canvas.heightNative = hNative
		} else {
			wNative = canvas.widthNative;
			hNative = canvas.heightNative
		}
		var w = wNative;
		var h = hNative;
		if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
			if (w / h < Module["forcedAspectRatio"]) {
				w = Math.round(h * Module["forcedAspectRatio"])
			} else {
				h = Math.round(w / Module["forcedAspectRatio"])
			}
		}
		if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
			var factor = Math.min(screen.width / w, screen.height / h);
			w = Math.round(w * factor);
			h = Math.round(h * factor)
		}
		if (Browser.resizeCanvas) {
			if (canvas.width != w) canvas.width = w;
			if (canvas.height != h) canvas.height = h;
			if (typeof canvas.style != "undefined") {
				canvas.style.removeProperty("width");
				canvas.style.removeProperty("height")
			}
		} else {
			if (canvas.width != wNative) canvas.width = wNative;
			if (canvas.height != hNative) canvas.height = hNative;
			if (typeof canvas.style != "undefined") {
				if (w != wNative || h != hNative) {
					canvas.style.setProperty("width", w + "px", "important");
					canvas.style.setProperty("height", h + "px", "important")
				} else {
					canvas.style.removeProperty("width");
					canvas.style.removeProperty("height")
				}
			}
		}
	}),
	wgetRequests: {},
	nextWgetRequestHandle: 0,
	getNextWgetRequestHandle: (function () {
		var handle = Browser.nextWgetRequestHandle;
		Browser.nextWgetRequestHandle++;
		return handle
	})
};

function _pthread_setspecific(key, value) {
	if (!(key in PTHREAD_SPECIFIC)) {
		return ERRNO_CODES.EINVAL
	}
	PTHREAD_SPECIFIC[key] = value;
	return 0
}

function _time(ptr) {
	var ret = Date.now() / 1e3 | 0;
	if (ptr) {
		HEAP32[ptr >> 2] = ret
	}
	return ret
}

function __exit(status) {
	Module["exit"](status)
}

function _exit(status) {
	__exit(status)
}
var SYSCALLS = {
	DEFAULT_POLLMASK: 5,
	mappings: {},
	umask: 511,
	calculateAt: (function (dirfd, path) {
		if (path[0] !== "/") {
			var dir;
			if (dirfd === -100) {
				dir = FS.cwd()
			} else {
				var dirstream = FS.getStream(dirfd);
				if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
				dir = dirstream.path
			}
			path = PATH.join2(dir, path)
		}
		return path
	}),
	doStat: (function (func, path, buf) {
		try {
			var stat = func(path)
		} catch (e) {
			if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
				return -ERRNO_CODES.ENOTDIR
			}
			throw e
		}
		HEAP32[buf >> 2] = stat.dev;
		HEAP32[buf + 4 >> 2] = 0;
		HEAP32[buf + 8 >> 2] = stat.ino;
		HEAP32[buf + 12 >> 2] = stat.mode;
		HEAP32[buf + 16 >> 2] = stat.nlink;
		HEAP32[buf + 20 >> 2] = stat.uid;
		HEAP32[buf + 24 >> 2] = stat.gid;
		HEAP32[buf + 28 >> 2] = stat.rdev;
		HEAP32[buf + 32 >> 2] = 0;
		HEAP32[buf + 36 >> 2] = stat.size;
		HEAP32[buf + 40 >> 2] = 4096;
		HEAP32[buf + 44 >> 2] = stat.blocks;
		HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
		HEAP32[buf + 52 >> 2] = 0;
		HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
		HEAP32[buf + 60 >> 2] = 0;
		HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
		HEAP32[buf + 68 >> 2] = 0;
		HEAP32[buf + 72 >> 2] = stat.ino;
		return 0
	}),
	doMsync: (function (addr, stream, len, flags) {
		var buffer = new Uint8Array(HEAPU8.buffer, addr, len);
		FS.msync(stream, buffer, 0, len, flags)
	}),
	doMkdir: (function (path, mode) {
		path = PATH.normalize(path);
		if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
		FS.mkdir(path, mode, 0);
		return 0
	}),
	doMknod: (function (path, mode, dev) {
		switch (mode & 61440) {
			case 32768:
			case 8192:
			case 24576:
			case 4096:
			case 49152:
				break;
			default:
				return -ERRNO_CODES.EINVAL
		}
		FS.mknod(path, mode, dev);
		return 0
	}),
	doReadlink: (function (path, buf, bufsize) {
		if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
		var ret = FS.readlink(path);
		ret = ret.slice(0, Math.max(0, bufsize));
		writeStringToMemory(ret, buf, true);
		return ret.length
	}),
	doAccess: (function (path, amode) {
		if (amode & ~7) {
			return -ERRNO_CODES.EINVAL
		}
		var node;
		var lookup = FS.lookupPath(path, {
			follow: true
		});
		node = lookup.node;
		var perms = "";
		if (amode & 4) perms += "r";
		if (amode & 2) perms += "w";
		if (amode & 1) perms += "x";
		if (perms && FS.nodePermissions(node, perms)) {
			return -ERRNO_CODES.EACCES
		}
		return 0
	}),
	doDup: (function (path, flags, suggestFD) {
		var suggest = FS.getStream(suggestFD);
		if (suggest) FS.close(suggest);
		return FS.open(path, flags, 0, suggestFD, suggestFD).fd
	}),
	doReadv: (function (stream, iov, iovcnt, offset) {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAP32[iov + i * 8 >> 2];
			var len = HEAP32[iov + (i * 8 + 4) >> 2];
			var curr = FS.read(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr;
			if (curr < len) break
		}
		return ret
	}),
	doWritev: (function (stream, iov, iovcnt, offset) {
		var ret = 0;
		for (var i = 0; i < iovcnt; i++) {
			var ptr = HEAP32[iov + i * 8 >> 2];
			var len = HEAP32[iov + (i * 8 + 4) >> 2];
			var curr = FS.write(stream, HEAP8, ptr, len, offset);
			if (curr < 0) return -1;
			ret += curr
		}
		return ret
	}),
	varargs: 0,
	get: (function (varargs) {
		SYSCALLS.varargs += 4;
		var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
		return ret
	}),
	getStr: (function () {
		var ret = Pointer_stringify(SYSCALLS.get());
		return ret
	}),
	getStreamFromFD: (function () {
		var stream = FS.getStream(SYSCALLS.get());
		if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		return stream
	}),
	getSocketFromFD: (function () {
		var socket = SOCKFS.getSocket(SYSCALLS.get());
		if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		return socket
	}),
	getSocketAddress: (function (allowNull) {
		var addrp = SYSCALLS.get(),
			addrlen = SYSCALLS.get();
		if (allowNull && addrp === 0) return null;
		var info = __read_sockaddr(addrp, addrlen);
		if (info.errno) throw new FS.ErrnoError(info.errno);
		info.addr = DNS.lookup_addr(info.addr) || info.addr;
		return info
	}),
	get64: (function () {
		var low = SYSCALLS.get(),
			high = SYSCALLS.get();
		if (low >= 0) assert(high === 0);
		else assert(high === -1);
		return low
	}),
	getZero: (function () {
		assert(SYSCALLS.get() === 0)
	})
};

function ___syscall6(which, varargs) {
	SYSCALLS.varargs = varargs;
	try {
		var stream = SYSCALLS.getStreamFromFD();
		FS.close(stream);
		return 0
	} catch (e) {
		if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
		return -e.errno
	}
}

function _malloc(bytes) {
	var ptr = Runtime.dynamicAlloc(bytes + 8);
	return ptr + 8 & 4294967288
}
Module["_malloc"] = _malloc;

function ___cxa_allocate_exception(size) {
	return _malloc(size)
}

function ___syscall54(which, varargs) {
	SYSCALLS.varargs = varargs;
	try {
		var stream = SYSCALLS.getStreamFromFD(),
			op = SYSCALLS.get();
		switch (op) {
			case 21505:
				{
					if (!stream.tty) return -ERRNO_CODES.ENOTTY;
					return 0
				};
			case 21506:
				{
					if (!stream.tty) return -ERRNO_CODES.ENOTTY;
					return 0
				};
			case 21519:
				{
					if (!stream.tty) return -ERRNO_CODES.ENOTTY;
					var argp = SYSCALLS.get();HEAP32[argp >> 2] = 0;
					return 0
				};
			case 21520:
				{
					if (!stream.tty) return -ERRNO_CODES.ENOTTY;
					return -ERRNO_CODES.EINVAL
				};
			case 21531:
				{
					var argp = SYSCALLS.get();
					return FS.ioctl(stream, op, argp)
				};
			default:
				abort("bad ioctl syscall " + op)
		}
	} catch (e) {
		if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
		return -e.errno
	}
}
Module["_i64Add"] = _i64Add;
Module["_bitshift64Lshr"] = _bitshift64Lshr;
var _BDtoIHigh = true;

function _pthread_cleanup_push(routine, arg) {
	__ATEXIT__.push((function () {
		Runtime.dynCall("vi", routine, [arg])
	}));
	_pthread_cleanup_push.level = __ATEXIT__.length
}

function _pthread_cond_broadcast() {
	return 0
}

function ___cxa_guard_acquire(variable) {
	if (!HEAP8[variable >> 0]) {
		HEAP8[variable >> 0] = 1;
		return 1
	}
	return 0
}

function _pthread_cleanup_pop() {
	assert(_pthread_cleanup_push.level == __ATEXIT__.length, "cannot pop if something else added meanwhile!");
	__ATEXIT__.pop();
	_pthread_cleanup_push.level = __ATEXIT__.length
}

function ___cxa_begin_catch(ptr) {
	__ZSt18uncaught_exceptionv.uncaught_exception--;
	EXCEPTIONS.caught.push(ptr);
	EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
	return ptr
}

function _emscripten_memcpy_big(dest, src, num) {
	HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
	return dest
}
Module["_memcpy"] = _memcpy;
var _log = Math_log;

function _sbrk(bytes) {
	var self = _sbrk;
	if (!self.called) {
		DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
		self.called = true;
		assert(Runtime.dynamicAlloc);
		self.alloc = Runtime.dynamicAlloc;
		Runtime.dynamicAlloc = (function () {
			abort("cannot dynamically allocate, sbrk now has control")
		})
	}
	var ret = DYNAMICTOP;
	if (bytes != 0) {
		var success = self.alloc(bytes);
		if (!success) return -1 >>> 0
	}
	return ret
}
Module["_bitshift64Shl"] = _bitshift64Shl;
Module["_memmove"] = _memmove;
var _BItoD = true;

function _pthread_cond_wait() {
	return 0
}

function _pthread_mutex_unlock() {}
var _exp = Math_exp;

function ___cxa_guard_release() {}

function _pthread_self() {
	return 0
}

function ___syscall140(which, varargs) {
	SYSCALLS.varargs = varargs;
	try {
		var stream = SYSCALLS.getStreamFromFD(),
			offset_high = SYSCALLS.get(),
			offset_low = SYSCALLS.get(),
			result = SYSCALLS.get(),
			whence = SYSCALLS.get();
		var offset = offset_low;
		assert(offset_high === 0);
		FS.llseek(stream, offset, whence);
		HEAP32[result >> 2] = stream.position;
		if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
		return 0
	} catch (e) {
		if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
		return -e.errno
	}
}

function ___syscall146(which, varargs) {
	SYSCALLS.varargs = varargs;
	try {
		var stream = SYSCALLS.getStreamFromFD(),
			iov = SYSCALLS.get(),
			iovcnt = SYSCALLS.get();
		return SYSCALLS.doWritev(stream, iov, iovcnt)
	} catch (e) {
		if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
		return -e.errno
	}
}

function ___syscall145(which, varargs) {
	SYSCALLS.varargs = varargs;
	try {
		var stream = SYSCALLS.getStreamFromFD(),
			iov = SYSCALLS.get(),
			iovcnt = SYSCALLS.get();
		return SYSCALLS.doReadv(stream, iov, iovcnt)
	} catch (e) {
		if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
		return -e.errno
	}
}
var ___dso_handle = allocate(1, "i32*", ALLOC_STATIC);
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
	Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
};
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
	Browser.requestAnimationFrame(func)
};
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
	Browser.setCanvasSize(width, height, noUpdates)
};
Module["pauseMainLoop"] = function Module_pauseMainLoop() {
	Browser.mainLoop.pause()
};
Module["resumeMainLoop"] = function Module_resumeMainLoop() {
	Browser.mainLoop.resume()
};
Module["getUserMedia"] = function Module_getUserMedia() {
	Browser.getUserMedia()
};
Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
	return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
};
FS.staticInit();
__ATINIT__.unshift((function () {
	if (!Module["noFSInit"] && !FS.init.initialized) FS.init()
}));
__ATMAIN__.push((function () {
	FS.ignorePermissions = false
}));
__ATEXIT__.push((function () {
	FS.quit()
}));
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
__ATINIT__.unshift((function () {
	TTY.init()
}));
__ATEXIT__.push((function () {
	TTY.shutdown()
}));
if (ENVIRONMENT_IS_NODE) {
	var fs = require("fs");
	var NODEJS_PATH = require("path");
	NODEFS.staticInit()
}
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true;
STACK_MAX = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
var cttz_i8 = allocate([8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0], "i8", ALLOC_DYNAMIC);

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
	try {
		return Module["dynCall_iiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiii(index, a1, a2, a3) {
	try {
		return Module["dynCall_iiii"](index, a1, a2, a3)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
	try {
		Module["dynCall_viiiii"](index, a1, a2, a3, a4, a5)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiiiid(index, a1, a2, a3, a4, a5, a6) {
	try {
		return Module["dynCall_iiiiiid"](index, a1, a2, a3, a4, a5, a6)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_vi(index, a1) {
	try {
		Module["dynCall_vi"](index, a1)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_vii(index, a1, a2) {
	try {
		Module["dynCall_vii"](index, a1, a2)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
	try {
		return Module["dynCall_iiiiiii"](index, a1, a2, a3, a4, a5, a6)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
	try {
		return Module["dynCall_iiiiid"](index, a1, a2, a3, a4, a5)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_ii(index, a1) {
	try {
		return Module["dynCall_ii"](index, a1)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_viii(index, a1, a2, a3) {
	try {
		Module["dynCall_viii"](index, a1, a2, a3)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_v(index) {
	try {
		Module["dynCall_v"](index)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
	try {
		return Module["dynCall_iiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiii(index, a1, a2, a3, a4) {
	try {
		return Module["dynCall_iiiii"](index, a1, a2, a3, a4)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
	try {
		Module["dynCall_viiiiii"](index, a1, a2, a3, a4, a5, a6)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iii(index, a1, a2) {
	try {
		return Module["dynCall_iii"](index, a1, a2)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
	try {
		return Module["dynCall_iiiiii"](index, a1, a2, a3, a4, a5)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}

function invoke_viiii(index, a1, a2, a3, a4) {
	try {
		Module["dynCall_viiii"](index, a1, a2, a3, a4)
	} catch (e) {
		if (typeof e !== "number" && e !== "longjmp") throw e;
		asm["setThrew"](1, 0)
	}
}
Module.asmGlobalArg = {
	"Math": Math,
	"Int8Array": Int8Array,
	"Int16Array": Int16Array,
	"Int32Array": Int32Array,
	"Uint8Array": Uint8Array,
	"Uint16Array": Uint16Array,
	"Uint32Array": Uint32Array,
	"Float32Array": Float32Array,
	"Float64Array": Float64Array,
	"NaN": NaN,
	"Infinity": Infinity
};
Module.asmLibraryArg = {
	"abort": abort,
	"assert": assert,
	"invoke_iiiiiiii": invoke_iiiiiiii,
	"invoke_iiii": invoke_iiii,
	"invoke_viiiii": invoke_viiiii,
	"invoke_iiiiiid": invoke_iiiiiid,
	"invoke_vi": invoke_vi,
	"invoke_vii": invoke_vii,
	"invoke_iiiiiii": invoke_iiiiiii,
	"invoke_iiiiid": invoke_iiiiid,
	"invoke_ii": invoke_ii,
	"invoke_viii": invoke_viii,
	"invoke_v": invoke_v,
	"invoke_iiiiiiiii": invoke_iiiiiiiii,
	"invoke_iiiii": invoke_iiiii,
	"invoke_viiiiii": invoke_viiiiii,
	"invoke_iii": invoke_iii,
	"invoke_iiiiii": invoke_iiiiii,
	"invoke_viiii": invoke_viiii,
	"_fabs": _fabs,
	"_strftime": _strftime,
	"_pthread_cond_wait": _pthread_cond_wait,
	"_exp": _exp,
	"_pthread_key_create": _pthread_key_create,
	"_abort": _abort,
	"___cxa_guard_acquire": ___cxa_guard_acquire,
	"___setErrNo": ___setErrNo,
	"___assert_fail": ___assert_fail,
	"___cxa_allocate_exception": ___cxa_allocate_exception,
	"__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv,
	"__isLeapYear": __isLeapYear,
	"___cxa_guard_release": ___cxa_guard_release,
	"__addDays": __addDays,
	"_strftime_l": _strftime_l,
	"_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
	"_sbrk": _sbrk,
	"___cxa_begin_catch": ___cxa_begin_catch,
	"_emscripten_memcpy_big": _emscripten_memcpy_big,
	"___resumeException": ___resumeException,
	"___cxa_find_matching_catch": ___cxa_find_matching_catch,
	"_sysconf": _sysconf,
	"_pthread_getspecific": _pthread_getspecific,
	"__arraySum": __arraySum,
	"_pthread_self": _pthread_self,
	"_pthread_mutex_unlock": _pthread_mutex_unlock,
	"_pthread_once": _pthread_once,
	"___syscall54": ___syscall54,
	"___unlock": ___unlock,
	"_pthread_cleanup_pop": _pthread_cleanup_pop,
	"_pthread_cond_broadcast": _pthread_cond_broadcast,
	"_emscripten_set_main_loop": _emscripten_set_main_loop,
	"_log": _log,
	"_pthread_setspecific": _pthread_setspecific,
	"___cxa_atexit": ___cxa_atexit,
	"___cxa_throw": ___cxa_throw,
	"__exit": __exit,
	"___lock": ___lock,
	"___syscall6": ___syscall6,
	"_pthread_cleanup_push": _pthread_cleanup_push,
	"_time": _time,
	"_pthread_mutex_lock": _pthread_mutex_lock,
	"_atexit": _atexit,
	"___syscall140": ___syscall140,
	"_exit": _exit,
	"___syscall145": ___syscall145,
	"___syscall146": ___syscall146,
	"STACKTOP": STACKTOP,
	"STACK_MAX": STACK_MAX,
	"tempDoublePtr": tempDoublePtr,
	"ABORT": ABORT,
	"cttz_i8": cttz_i8,
	"___dso_handle": ___dso_handle
}; // EMSCRIPTEN_START_ASM
var asm = (function (global, env, buffer) {
	"use asm";
	var a = new global.Int8Array(buffer);
	var b = new global.Int16Array(buffer);
	var c = new global.Int32Array(buffer);
	var d = new global.Uint8Array(buffer);
	var e = new global.Uint16Array(buffer);
	var f = new global.Uint32Array(buffer);
	var g = new global.Float32Array(buffer);
	var h = new global.Float64Array(buffer);
	var i = env.STACKTOP | 0;
	var j = env.STACK_MAX | 0;
	var k = env.tempDoublePtr | 0;
	var l = env.ABORT | 0;
	var m = env.cttz_i8 | 0;
	var n = env.___dso_handle | 0;
	var o = 0;
	var p = 0;
	var q = 0;
	var r = 0;
	var s = global.NaN,
		t = global.Infinity;
	var u = 0,
		v = 0,
		w = 0,
		x = 0,
		y = 0.0,
		z = 0,
		A = 0,
		B = 0,
		C = 0.0;
	var D = 0;
	var E = 0;
	var F = 0;
	var G = 0;
	var H = 0;
	var I = 0;
	var J = 0;
	var K = 0;
	var L = 0;
	var M = 0;
	var N = global.Math.floor;
	var O = global.Math.abs;
	var P = global.Math.sqrt;
	var Q = global.Math.pow;
	var R = global.Math.cos;
	var S = global.Math.sin;
	var T = global.Math.tan;
	var U = global.Math.acos;
	var V = global.Math.asin;
	var W = global.Math.atan;
	var X = global.Math.atan2;
	var Y = global.Math.exp;
	var Z = global.Math.log;
	var _ = global.Math.ceil;
	var $ = global.Math.imul;
	var aa = global.Math.min;
	var ba = global.Math.clz32;
	var ca = env.abort;
	var da = env.assert;
	var ea = env.invoke_iiiiiiii;
	var fa = env.invoke_iiii;
	var ga = env.invoke_viiiii;
	var ha = env.invoke_iiiiiid;
	var ia = env.invoke_vi;
	var ja = env.invoke_vii;
	var ka = env.invoke_iiiiiii;
	var la = env.invoke_iiiiid;
	var ma = env.invoke_ii;
	var na = env.invoke_viii;
	var oa = env.invoke_v;
	var pa = env.invoke_iiiiiiiii;
	var qa = env.invoke_iiiii;
	var ra = env.invoke_viiiiii;
	var sa = env.invoke_iii;
	var ta = env.invoke_iiiiii;
	var ua = env.invoke_viiii;
	var va = env._fabs;
	var wa = env._strftime;
	var xa = env._pthread_cond_wait;
	var ya = env._exp;
	var za = env._pthread_key_create;
	var Aa = env._abort;
	var Ba = env.___cxa_guard_acquire;
	var Ca = env.___setErrNo;
	var Da = env.___assert_fail;
	var Ea = env.___cxa_allocate_exception;
	var Fa = env.__ZSt18uncaught_exceptionv;
	var Ga = env.__isLeapYear;
	var Ha = env.___cxa_guard_release;
	var Ia = env.__addDays;
	var Ja = env._strftime_l;
	var Ka = env._emscripten_set_main_loop_timing;
	var La = env._sbrk;
	var Ma = env.___cxa_begin_catch;
	var Na = env._emscripten_memcpy_big;
	var Oa = env.___resumeException;
	var Pa = env.___cxa_find_matching_catch;
	var Qa = env._sysconf;
	var Ra = env._pthread_getspecific;
	var Sa = env.__arraySum;
	var Ta = env._pthread_self;
	var Ua = env._pthread_mutex_unlock;
	var Va = env._pthread_once;
	var Wa = env.___syscall54;
	var Xa = env.___unlock;
	var Ya = env._pthread_cleanup_pop;
	var Za = env._pthread_cond_broadcast;
	var _a = env._emscripten_set_main_loop;
	var $a = env._log;
	var ab = env._pthread_setspecific;
	var bb = env.___cxa_atexit;
	var cb = env.___cxa_throw;
	var db = env.__exit;
	var eb = env.___lock;
	var fb = env.___syscall6;
	var gb = env._pthread_cleanup_push;
	var hb = env._time;
	var ib = env._pthread_mutex_lock;
	var jb = env._atexit;
	var kb = env.___syscall140;
	var lb = env._exit;
	var mb = env.___syscall145;
	var nb = env.___syscall146;
	var ob = 0.0;
	// EMSCRIPTEN_START_FUNCS
	function Me(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		e = d;
		a: do
			if (!((e ^ b) & 3)) {
				if (!(e & 3)) {
					f = d;
					g = b
				} else {
					h = b;
					i = d;
					while (1) {
						j = a[i >> 0] | 0;
						a[h >> 0] = j;
						if (!(j << 24 >> 24)) {
							k = h;
							break a
						}
						j = i + 1 | 0;
						l = h + 1 | 0;
						if (!(j & 3)) {
							f = j;
							g = l;
							break
						} else {
							h = l;
							i = j
						}
					}
				}
				i = c[f >> 2] | 0;
				if (!((i & -2139062144 ^ -2139062144) & i + -16843009)) {
					h = i;
					i = g;
					j = f;
					while (1) {
						l = j + 4 | 0;
						m = i + 4 | 0;
						c[i >> 2] = h;
						h = c[l >> 2] | 0;
						if ((h & -2139062144 ^ -2139062144) & h + -16843009) {
							n = m;
							o = l;
							break
						} else {
							i = m;
							j = l
						}
					}
				} else {
					n = g;
					o = f
				}
				p = o;
				q = n;
				r = 8
			} else {
				p = d;
				q = b;
				r = 8
			}
		while (0);
		if ((r | 0) == 8) {
			r = a[p >> 0] | 0;
			a[q >> 0] = r;
			if (!(r << 24 >> 24)) k = q;
			else {
				r = q;
				q = p;
				while (1) {
					q = q + 1 | 0;
					p = r + 1 | 0;
					b = a[q >> 0] | 0;
					a[p >> 0] = b;
					if (!(b << 24 >> 24)) {
						k = p;
						break
					} else r = p
				}
			}
		}
		return k | 0
	}

	function Ne(b, c) {
		b = b | 0;
		c = c | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0;
		d = a[b >> 0] | 0;
		e = a[c >> 0] | 0;
		if (d << 24 >> 24 == 0 ? 1 : d << 24 >> 24 != e << 24 >> 24) {
			f = d;
			g = e
		} else {
			e = b;
			b = c;
			do {
				e = e + 1 | 0;
				b = b + 1 | 0;
				c = a[e >> 0] | 0;
				d = a[b >> 0] | 0
			} while (!(c << 24 >> 24 == 0 ? 1 : c << 24 >> 24 != d << 24 >> 24));
			f = c;
			g = d
		}
		return (f & 255) - (g & 255) | 0
	}

	function Oe(a, b) {
		a = a | 0;
		b = b | 0;
		Me(a, b) | 0;
		return a | 0
	}

	function Pe(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		d = b;
		a: do
			if (!(d & 3)) {
				e = b;
				f = 4
			} else {
				g = b;
				h = d;
				while (1) {
					if (!(a[g >> 0] | 0)) {
						i = h;
						break a
					}
					j = g + 1 | 0;
					h = j;
					if (!(h & 3)) {
						e = j;
						f = 4;
						break
					} else g = j
				}
			}
		while (0);
		if ((f | 0) == 4) {
			f = e;
			while (1) {
				e = c[f >> 2] | 0;
				if (!((e & -2139062144 ^ -2139062144) & e + -16843009)) f = f + 4 | 0;
				else {
					k = e;
					l = f;
					break
				}
			}
			if (!((k & 255) << 24 >> 24)) m = l;
			else {
				k = l;
				while (1) {
					l = k + 1 | 0;
					if (!(a[l >> 0] | 0)) {
						m = l;
						break
					} else k = l
				}
			}
			i = m
		}
		return i - d | 0
	}

	function Qe(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = a;
		while (1)
			if (!(c[b >> 2] | 0)) {
				d = b;
				break
			} else b = b + 4 | 0;
		return d - a >> 2 | 0
	}

	function Re(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0;
		if (d) {
			e = d;
			d = b;
			b = a;
			while (1) {
				e = e + -1 | 0;
				c[b >> 2] = c[d >> 2];
				if (!e) break;
				else {
					d = d + 4 | 0;
					b = b + 4 | 0
				}
			}
		}
		return a | 0
	}

	function Se(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		e = (d | 0) == 0;
		if (a - b >> 2 >>> 0 < d >>> 0) {
			if (!e) {
				f = d;
				do {
					f = f + -1 | 0;
					c[a + (f << 2) >> 2] = c[b + (f << 2) >> 2]
				} while ((f | 0) != 0)
			}
		} else if (!e) {
			e = b;
			b = a;
			f = d;
			while (1) {
				f = f + -1 | 0;
				c[b >> 2] = c[e >> 2];
				if (!f) break;
				else {
					e = e + 4 | 0;
					b = b + 4 | 0
				}
			}
		}
		return a | 0
	}

	function Te(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0;
		if (d) {
			e = d;
			d = a;
			while (1) {
				e = e + -1 | 0;
				c[d >> 2] = b;
				if (!e) break;
				else d = d + 4 | 0
			}
		}
		return a | 0
	}

	function Ue() {
		var a = 0;
		do
			if (!(c[893] | 0)) {
				a = Qa(30) | 0;
				if (!(a + -1 & a)) {
					c[895] = a;
					c[894] = a;
					c[896] = -1;
					c[897] = -1;
					c[898] = 0;
					c[886] = 0;
					c[893] = (hb(0) | 0) & -16 ^ 1431655768;
					break
				} else Aa()
			}
		while (0);
		return
	}

	function Ve(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		d = a + 4 | 0;
		e = c[d >> 2] | 0;
		f = e & -8;
		g = a + f | 0;
		h = c[779] | 0;
		i = e & 3;
		if ((i | 0) != 1 & a >>> 0 >= h >>> 0 & a >>> 0 < g >>> 0 ? (j = a + (f | 4) | 0, k = c[j >> 2] | 0, (k & 1 | 0) != 0) : 0) {
			do
				if (!i)
					if (b >>> 0 < 256) l = 0;
					else {
						if (f >>> 0 >= (b + 4 | 0) >>> 0 ? (f - b | 0) >>> 0 <= c[895] << 1 >>> 0 : 0) {
							l = a;
							break
						}
						l = 0
					}
			else {
				if (f >>> 0 >= b >>> 0) {
					m = f - b | 0;
					if (m >>> 0 <= 15) {
						l = a;
						break
					}
					c[d >> 2] = e & 1 | b | 2;
					c[a + (b + 4) >> 2] = m | 3;
					c[j >> 2] = c[j >> 2] | 1;
					We(a + b | 0, m);
					l = a;
					break
				}
				if ((g | 0) == (c[781] | 0)) {
					m = (c[778] | 0) + f | 0;
					if (m >>> 0 <= b >>> 0) {
						l = 0;
						break
					}
					n = m - b | 0;
					c[d >> 2] = e & 1 | b | 2;
					c[a + (b + 4) >> 2] = n | 1;
					c[781] = a + b;
					c[778] = n;
					l = a;
					break
				}
				if ((g | 0) == (c[780] | 0)) {
					n = (c[777] | 0) + f | 0;
					if (n >>> 0 < b >>> 0) {
						l = 0;
						break
					}
					m = n - b | 0;
					if (m >>> 0 > 15) {
						c[d >> 2] = e & 1 | b | 2;
						c[a + (b + 4) >> 2] = m | 1;
						c[a + n >> 2] = m;
						o = a + (n + 4) | 0;
						c[o >> 2] = c[o >> 2] & -2;
						p = a + b | 0;
						q = m
					} else {
						c[d >> 2] = e & 1 | n | 2;
						m = a + (n + 4) | 0;
						c[m >> 2] = c[m >> 2] | 1;
						p = 0;
						q = 0
					}
					c[777] = q;
					c[780] = p;
					l = a;
					break
				}
				if ((k & 2 | 0) == 0 ? (m = (k & -8) + f | 0, m >>> 0 >= b >>> 0) : 0) {
					n = m - b | 0;
					o = k >>> 3;
					do
						if (k >>> 0 >= 256) {
							r = c[a + (f + 24) >> 2] | 0;
							s = c[a + (f + 12) >> 2] | 0;
							do
								if ((s | 0) == (g | 0)) {
									t = a + (f + 20) | 0;
									u = c[t >> 2] | 0;
									if (!u) {
										v = a + (f + 16) | 0;
										w = c[v >> 2] | 0;
										if (!w) {
											x = 0;
											break
										} else {
											y = w;
											z = v
										}
									} else {
										y = u;
										z = t
									}
									while (1) {
										t = y + 20 | 0;
										u = c[t >> 2] | 0;
										if (u) {
											y = u;
											z = t;
											continue
										}
										t = y + 16 | 0;
										u = c[t >> 2] | 0;
										if (!u) {
											A = y;
											B = z;
											break
										} else {
											y = u;
											z = t
										}
									}
									if (B >>> 0 < h >>> 0) Aa();
									else {
										c[B >> 2] = 0;
										x = A;
										break
									}
								} else {
									t = c[a + (f + 8) >> 2] | 0;
									if ((t >>> 0 >= h >>> 0 ? (u = t + 12 | 0, (c[u >> 2] | 0) == (g | 0)) : 0) ? (v = s + 8 | 0, (c[v >> 2] | 0) == (g | 0)) : 0) {
										c[u >> 2] = s;
										c[v >> 2] = t;
										x = s;
										break
									}
									Aa()
								}
							while (0);
							if (r) {
								s = c[a + (f + 28) >> 2] | 0;
								t = 3404 + (s << 2) | 0;
								if ((g | 0) == (c[t >> 2] | 0)) {
									c[t >> 2] = x;
									if (!x) {
										c[776] = c[776] & ~(1 << s);
										break
									}
								} else {
									if (r >>> 0 < (c[779] | 0) >>> 0) Aa();
									s = r + 16 | 0;
									if ((c[s >> 2] | 0) == (g | 0)) c[s >> 2] = x;
									else c[r + 20 >> 2] = x;
									if (!x) break
								}
								s = c[779] | 0;
								if (x >>> 0 < s >>> 0) Aa();
								c[x + 24 >> 2] = r;
								t = c[a + (f + 16) >> 2] | 0;
								do
									if (t)
										if (t >>> 0 < s >>> 0) Aa();
										else {
											c[x + 16 >> 2] = t;
											c[t + 24 >> 2] = x;
											break
										}
								while (0);
								t = c[a + (f + 20) >> 2] | 0;
								if (t)
									if (t >>> 0 < (c[779] | 0) >>> 0) Aa();
									else {
										c[x + 20 >> 2] = t;
										c[t + 24 >> 2] = x;
										break
									}
							}
						} else {
							t = c[a + (f + 8) >> 2] | 0;
							s = c[a + (f + 12) >> 2] | 0;
							r = 3140 + (o << 1 << 2) | 0;
							do
								if ((t | 0) != (r | 0)) {
									if (t >>> 0 >= h >>> 0 ? (c[t + 12 >> 2] | 0) == (g | 0) : 0) break;
									Aa()
								}
							while (0);
							if ((s | 0) == (t | 0)) {
								c[775] = c[775] & ~(1 << o);
								break
							}
							do
								if ((s | 0) == (r | 0)) C = s + 8 | 0;
								else {
									if (s >>> 0 >= h >>> 0 ? (v = s + 8 | 0, (c[v >> 2] | 0) == (g | 0)) : 0) {
										C = v;
										break
									}
									Aa()
								}
							while (0);
							c[t + 12 >> 2] = s;
							c[C >> 2] = t
						}
					while (0);
					if (n >>> 0 < 16) {
						c[d >> 2] = m | e & 1 | 2;
						o = a + (m | 4) | 0;
						c[o >> 2] = c[o >> 2] | 1;
						l = a;
						break
					} else {
						c[d >> 2] = e & 1 | b | 2;
						c[a + (b + 4) >> 2] = n | 3;
						o = a + (m | 4) | 0;
						c[o >> 2] = c[o >> 2] | 1;
						We(a + b | 0, n);
						l = a;
						break
					}
				} else l = 0
			} while (0);
			return l | 0
		}
		Aa();
		return 0
	}

	function We(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0;
		d = a + b | 0;
		e = c[a + 4 >> 2] | 0;
		do
			if (!(e & 1)) {
				f = c[a >> 2] | 0;
				if (e & 3) {
					g = a + (0 - f) | 0;
					h = f + b | 0;
					i = c[779] | 0;
					if (g >>> 0 < i >>> 0) Aa();
					if ((g | 0) == (c[780] | 0)) {
						j = a + (b + 4) | 0;
						k = c[j >> 2] | 0;
						if ((k & 3 | 0) != 3) {
							l = g;
							m = h;
							n = 54;
							break
						}
						c[777] = h;
						c[j >> 2] = k & -2;
						c[a + (4 - f) >> 2] = h | 1;
						c[d >> 2] = h;
						break
					}
					k = f >>> 3;
					if (f >>> 0 < 256) {
						j = c[a + (8 - f) >> 2] | 0;
						o = c[a + (12 - f) >> 2] | 0;
						p = 3140 + (k << 1 << 2) | 0;
						do
							if ((j | 0) != (p | 0)) {
								if (j >>> 0 >= i >>> 0 ? (c[j + 12 >> 2] | 0) == (g | 0) : 0) break;
								Aa()
							}
						while (0);
						if ((o | 0) == (j | 0)) {
							c[775] = c[775] & ~(1 << k);
							l = g;
							m = h;
							n = 54;
							break
						}
						do
							if ((o | 0) == (p | 0)) q = o + 8 | 0;
							else {
								if (o >>> 0 >= i >>> 0 ? (r = o + 8 | 0, (c[r >> 2] | 0) == (g | 0)) : 0) {
									q = r;
									break
								}
								Aa()
							}
						while (0);
						c[j + 12 >> 2] = o;
						c[q >> 2] = j;
						l = g;
						m = h;
						n = 54;
						break
					}
					p = c[a + (24 - f) >> 2] | 0;
					k = c[a + (12 - f) >> 2] | 0;
					do
						if ((k | 0) == (g | 0)) {
							r = 16 - f | 0;
							s = a + (r + 4) | 0;
							t = c[s >> 2] | 0;
							if (!t) {
								u = a + r | 0;
								r = c[u >> 2] | 0;
								if (!r) {
									v = 0;
									break
								} else {
									w = r;
									x = u
								}
							} else {
								w = t;
								x = s
							}
							while (1) {
								s = w + 20 | 0;
								t = c[s >> 2] | 0;
								if (t) {
									w = t;
									x = s;
									continue
								}
								s = w + 16 | 0;
								t = c[s >> 2] | 0;
								if (!t) {
									y = w;
									z = x;
									break
								} else {
									w = t;
									x = s
								}
							}
							if (z >>> 0 < i >>> 0) Aa();
							else {
								c[z >> 2] = 0;
								v = y;
								break
							}
						} else {
							s = c[a + (8 - f) >> 2] | 0;
							if ((s >>> 0 >= i >>> 0 ? (t = s + 12 | 0, (c[t >> 2] | 0) == (g | 0)) : 0) ? (u = k + 8 | 0, (c[u >> 2] | 0) == (g | 0)) : 0) {
								c[t >> 2] = k;
								c[u >> 2] = s;
								v = k;
								break
							}
							Aa()
						}
					while (0);
					if (p) {
						k = c[a + (28 - f) >> 2] | 0;
						i = 3404 + (k << 2) | 0;
						if ((g | 0) == (c[i >> 2] | 0)) {
							c[i >> 2] = v;
							if (!v) {
								c[776] = c[776] & ~(1 << k);
								l = g;
								m = h;
								n = 54;
								break
							}
						} else {
							if (p >>> 0 < (c[779] | 0) >>> 0) Aa();
							k = p + 16 | 0;
							if ((c[k >> 2] | 0) == (g | 0)) c[k >> 2] = v;
							else c[p + 20 >> 2] = v;
							if (!v) {
								l = g;
								m = h;
								n = 54;
								break
							}
						}
						k = c[779] | 0;
						if (v >>> 0 < k >>> 0) Aa();
						c[v + 24 >> 2] = p;
						i = 16 - f | 0;
						j = c[a + i >> 2] | 0;
						do
							if (j)
								if (j >>> 0 < k >>> 0) Aa();
								else {
									c[v + 16 >> 2] = j;
									c[j + 24 >> 2] = v;
									break
								}
						while (0);
						j = c[a + (i + 4) >> 2] | 0;
						if (j)
							if (j >>> 0 < (c[779] | 0) >>> 0) Aa();
							else {
								c[v + 20 >> 2] = j;
								c[j + 24 >> 2] = v;
								l = g;
								m = h;
								n = 54;
								break
							}
						else {
							l = g;
							m = h;
							n = 54
						}
					} else {
						l = g;
						m = h;
						n = 54
					}
				}
			} else {
				l = a;
				m = b;
				n = 54
			}
		while (0);
		a: do
			if ((n | 0) == 54) {
				v = c[779] | 0;
				if (d >>> 0 < v >>> 0) Aa();
				y = a + (b + 4) | 0;
				z = c[y >> 2] | 0;
				if (!(z & 2)) {
					if ((d | 0) == (c[781] | 0)) {
						x = (c[778] | 0) + m | 0;
						c[778] = x;
						c[781] = l;
						c[l + 4 >> 2] = x | 1;
						if ((l | 0) != (c[780] | 0)) break;
						c[780] = 0;
						c[777] = 0;
						break
					}
					if ((d | 0) == (c[780] | 0)) {
						x = (c[777] | 0) + m | 0;
						c[777] = x;
						c[780] = l;
						c[l + 4 >> 2] = x | 1;
						c[l + x >> 2] = x;
						break
					}
					x = (z & -8) + m | 0;
					w = z >>> 3;
					do
						if (z >>> 0 >= 256) {
							q = c[a + (b + 24) >> 2] | 0;
							e = c[a + (b + 12) >> 2] | 0;
							do
								if ((e | 0) == (d | 0)) {
									j = a + (b + 20) | 0;
									k = c[j >> 2] | 0;
									if (!k) {
										f = a + (b + 16) | 0;
										p = c[f >> 2] | 0;
										if (!p) {
											A = 0;
											break
										} else {
											B = p;
											C = f
										}
									} else {
										B = k;
										C = j
									}
									while (1) {
										j = B + 20 | 0;
										k = c[j >> 2] | 0;
										if (k) {
											B = k;
											C = j;
											continue
										}
										j = B + 16 | 0;
										k = c[j >> 2] | 0;
										if (!k) {
											D = B;
											E = C;
											break
										} else {
											B = k;
											C = j
										}
									}
									if (E >>> 0 < v >>> 0) Aa();
									else {
										c[E >> 2] = 0;
										A = D;
										break
									}
								} else {
									j = c[a + (b + 8) >> 2] | 0;
									if ((j >>> 0 >= v >>> 0 ? (k = j + 12 | 0, (c[k >> 2] | 0) == (d | 0)) : 0) ? (f = e + 8 | 0, (c[f >> 2] | 0) == (d | 0)) : 0) {
										c[k >> 2] = e;
										c[f >> 2] = j;
										A = e;
										break
									}
									Aa()
								}
							while (0);
							if (q) {
								e = c[a + (b + 28) >> 2] | 0;
								j = 3404 + (e << 2) | 0;
								if ((d | 0) == (c[j >> 2] | 0)) {
									c[j >> 2] = A;
									if (!A) {
										c[776] = c[776] & ~(1 << e);
										break
									}
								} else {
									if (q >>> 0 < (c[779] | 0) >>> 0) Aa();
									e = q + 16 | 0;
									if ((c[e >> 2] | 0) == (d | 0)) c[e >> 2] = A;
									else c[q + 20 >> 2] = A;
									if (!A) break
								}
								e = c[779] | 0;
								if (A >>> 0 < e >>> 0) Aa();
								c[A + 24 >> 2] = q;
								j = c[a + (b + 16) >> 2] | 0;
								do
									if (j)
										if (j >>> 0 < e >>> 0) Aa();
										else {
											c[A + 16 >> 2] = j;
											c[j + 24 >> 2] = A;
											break
										}
								while (0);
								j = c[a + (b + 20) >> 2] | 0;
								if (j)
									if (j >>> 0 < (c[779] | 0) >>> 0) Aa();
									else {
										c[A + 20 >> 2] = j;
										c[j + 24 >> 2] = A;
										break
									}
							}
						} else {
							j = c[a + (b + 8) >> 2] | 0;
							e = c[a + (b + 12) >> 2] | 0;
							q = 3140 + (w << 1 << 2) | 0;
							do
								if ((j | 0) != (q | 0)) {
									if (j >>> 0 >= v >>> 0 ? (c[j + 12 >> 2] | 0) == (d | 0) : 0) break;
									Aa()
								}
							while (0);
							if ((e | 0) == (j | 0)) {
								c[775] = c[775] & ~(1 << w);
								break
							}
							do
								if ((e | 0) == (q | 0)) F = e + 8 | 0;
								else {
									if (e >>> 0 >= v >>> 0 ? (f = e + 8 | 0, (c[f >> 2] | 0) == (d | 0)) : 0) {
										F = f;
										break
									}
									Aa()
								}
							while (0);
							c[j + 12 >> 2] = e;
							c[F >> 2] = j
						}
					while (0);
					c[l + 4 >> 2] = x | 1;
					c[l + x >> 2] = x;
					if ((l | 0) == (c[780] | 0)) {
						c[777] = x;
						break
					} else G = x
				} else {
					c[y >> 2] = z & -2;
					c[l + 4 >> 2] = m | 1;
					c[l + m >> 2] = m;
					G = m
				}
				v = G >>> 3;
				if (G >>> 0 < 256) {
					w = v << 1;
					h = 3140 + (w << 2) | 0;
					g = c[775] | 0;
					i = 1 << v;
					if (g & i) {
						v = 3140 + (w + 2 << 2) | 0;
						q = c[v >> 2] | 0;
						if (q >>> 0 < (c[779] | 0) >>> 0) Aa();
						else {
							H = v;
							I = q
						}
					} else {
						c[775] = g | i;
						H = 3140 + (w + 2 << 2) | 0;
						I = h
					}
					c[H >> 2] = l;
					c[I + 12 >> 2] = l;
					c[l + 8 >> 2] = I;
					c[l + 12 >> 2] = h;
					break
				}
				h = G >>> 8;
				if (h)
					if (G >>> 0 > 16777215) J = 31;
					else {
						w = (h + 1048320 | 0) >>> 16 & 8;
						i = h << w;
						h = (i + 520192 | 0) >>> 16 & 4;
						g = i << h;
						i = (g + 245760 | 0) >>> 16 & 2;
						q = 14 - (h | w | i) + (g << i >>> 15) | 0;
						J = G >>> (q + 7 | 0) & 1 | q << 1
					}
				else J = 0;
				q = 3404 + (J << 2) | 0;
				c[l + 28 >> 2] = J;
				c[l + 20 >> 2] = 0;
				c[l + 16 >> 2] = 0;
				i = c[776] | 0;
				g = 1 << J;
				if (!(i & g)) {
					c[776] = i | g;
					c[q >> 2] = l;
					c[l + 24 >> 2] = q;
					c[l + 12 >> 2] = l;
					c[l + 8 >> 2] = l;
					break
				}
				g = c[q >> 2] | 0;
				b: do
					if ((c[g + 4 >> 2] & -8 | 0) != (G | 0)) {
						q = G << ((J | 0) == 31 ? 0 : 25 - (J >>> 1) | 0);
						i = g;
						while (1) {
							w = i + 16 + (q >>> 31 << 2) | 0;
							h = c[w >> 2] | 0;
							if (!h) {
								K = w;
								L = i;
								break
							}
							if ((c[h + 4 >> 2] & -8 | 0) == (G | 0)) {
								M = h;
								break b
							} else {
								q = q << 1;
								i = h
							}
						}
						if (K >>> 0 < (c[779] | 0) >>> 0) Aa();
						else {
							c[K >> 2] = l;
							c[l + 24 >> 2] = L;
							c[l + 12 >> 2] = l;
							c[l + 8 >> 2] = l;
							break a
						}
					} else M = g; while (0);
				g = M + 8 | 0;
				z = c[g >> 2] | 0;
				y = c[779] | 0;
				if (z >>> 0 >= y >>> 0 & M >>> 0 >= y >>> 0) {
					c[z + 12 >> 2] = l;
					c[g >> 2] = l;
					c[l + 8 >> 2] = z;
					c[l + 12 >> 2] = M;
					c[l + 24 >> 2] = 0;
					break
				} else Aa()
			}
		while (0);
		return
	}

	function Xe(a, b) {
		a = a | 0;
		b = b | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		e = a + 4 | 0;
		f = c[e >> 2] | 0;
		g = a + 100 | 0;
		if (f >>> 0 < (c[g >> 2] | 0) >>> 0) {
			c[e >> 2] = f + 1;
			h = d[f >> 0] | 0
		} else h = Gd(a) | 0;
		switch (h | 0) {
			case 43:
			case 45:
				{
					f = (h | 0) == 45 & 1;i = c[e >> 2] | 0;
					if (i >>> 0 < (c[g >> 2] | 0) >>> 0) {
						c[e >> 2] = i + 1;
						j = d[i >> 0] | 0
					} else j = Gd(a) | 0;
					if ((b | 0) != 0 & (j + -48 | 0) >>> 0 > 9 ? (c[g >> 2] | 0) != 0 : 0) {
						c[e >> 2] = (c[e >> 2] | 0) + -1;
						k = j;
						l = f
					} else {
						k = j;
						l = f
					}
					break
				}
			default:
				{
					k = h;l = 0
				}
		}
		if ((k + -48 | 0) >>> 0 > 9)
			if (!(c[g >> 2] | 0)) {
				m = -2147483648;
				n = 0
			} else {
				c[e >> 2] = (c[e >> 2] | 0) + -1;
				m = -2147483648;
				n = 0
			}
		else {
			h = k;
			k = 0;
			while (1) {
				f = h + -48 + (k * 10 | 0) | 0;
				j = c[e >> 2] | 0;
				if (j >>> 0 < (c[g >> 2] | 0) >>> 0) {
					c[e >> 2] = j + 1;
					o = d[j >> 0] | 0
				} else o = Gd(a) | 0;
				if ((o + -48 | 0) >>> 0 < 10 & (f | 0) < 214748364) {
					h = o;
					k = f
				} else {
					p = f;
					q = o;
					break
				}
			}
			o = ((p | 0) < 0) << 31 >> 31;
			if ((q + -48 | 0) >>> 0 < 10) {
				k = p;
				h = o;
				f = q;
				while (1) {
					j = tp(k | 0, h | 0, 10, 0) | 0;
					b = D;
					i = jp(f | 0, ((f | 0) < 0) << 31 >> 31 | 0, -48, -1) | 0;
					r = jp(i | 0, D | 0, j | 0, b | 0) | 0;
					b = D;
					j = c[e >> 2] | 0;
					if (j >>> 0 < (c[g >> 2] | 0) >>> 0) {
						c[e >> 2] = j + 1;
						s = d[j >> 0] | 0
					} else s = Gd(a) | 0;
					if ((s + -48 | 0) >>> 0 < 10 & ((b | 0) < 21474836 | (b | 0) == 21474836 & r >>> 0 < 2061584302)) {
						k = r;
						h = b;
						f = s
					} else {
						t = r;
						u = b;
						v = s;
						break
					}
				}
			} else {
				t = p;
				u = o;
				v = q
			}
			if ((v + -48 | 0) >>> 0 < 10)
				do {
					v = c[e >> 2] | 0;
					if (v >>> 0 < (c[g >> 2] | 0) >>> 0) {
						c[e >> 2] = v + 1;
						w = d[v >> 0] | 0
					} else w = Gd(a) | 0
				} while ((w + -48 | 0) >>> 0 < 10);
			if (c[g >> 2] | 0) c[e >> 2] = (c[e >> 2] | 0) + -1;
			e = (l | 0) != 0;
			l = hp(0, 0, t | 0, u | 0) | 0;
			m = e ? D : u;
			n = e ? l : t
		}
		D = m;
		return n | 0
	}

	function Ye(a) {
		a = a | 0;
		if (!(c[a + 68 >> 2] | 0)) je(a);
		return
	}

	function Ze(a) {
		a = a | 0;
		if (!(c[a + 68 >> 2] | 0)) je(a);
		return
	}

	function _e(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		b = a + 20 | 0;
		d = a + 28 | 0;
		if ((c[b >> 2] | 0) >>> 0 > (c[d >> 2] | 0) >>> 0 ? (qb[c[a + 36 >> 2] & 31](a, 0, 0) | 0, (c[b >> 2] | 0) == 0) : 0) e = -1;
		else {
			f = a + 4 | 0;
			g = c[f >> 2] | 0;
			h = a + 8 | 0;
			i = c[h >> 2] | 0;
			if (g >>> 0 < i >>> 0) qb[c[a + 40 >> 2] & 31](a, g - i | 0, 1) | 0;
			c[a + 16 >> 2] = 0;
			c[d >> 2] = 0;
			c[b >> 2] = 0;
			c[h >> 2] = 0;
			c[f >> 2] = 0;
			e = 0
		}
		return e | 0
	}

	function $e(e, f, g, j, l) {
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = j | 0;
		l = l | 0;
		var m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0,
			wa = 0,
			xa = 0,
			ya = 0,
			za = 0,
			Aa = 0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0,
			La = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0,
			Ua = 0,
			Va = 0,
			Wa = 0,
			Xa = 0,
			Ya = 0,
			Za = 0,
			_a = 0,
			$a = 0,
			ab = 0.0,
			bb = 0.0,
			cb = 0,
			db = 0,
			eb = 0,
			fb = 0,
			gb = 0,
			hb = 0.0,
			ib = 0.0,
			jb = 0.0,
			kb = 0.0,
			lb = 0,
			mb = 0,
			nb = 0,
			ob = 0,
			pb = 0,
			qb = 0,
			rb = 0,
			sb = 0,
			tb = 0.0,
			ub = 0,
			vb = 0,
			wb = 0,
			xb = 0,
			yb = 0,
			zb = 0,
			Ab = 0,
			Bb = 0,
			Cb = 0,
			Db = 0,
			Eb = 0,
			Fb = 0,
			Gb = 0,
			Hb = 0,
			Ib = 0,
			Jb = 0,
			Kb = 0,
			Lb = 0,
			Mb = 0,
			Nb = 0,
			Ob = 0,
			Pb = 0,
			Qb = 0,
			Rb = 0,
			Sb = 0,
			Tb = 0,
			Ub = 0,
			Vb = 0.0,
			Wb = 0.0,
			Xb = 0.0,
			Yb = 0,
			Zb = 0,
			_b = 0,
			$b = 0,
			ac = 0,
			bc = 0,
			cc = 0,
			dc = 0,
			ec = 0,
			fc = 0,
			gc = 0,
			hc = 0,
			ic = 0,
			jc = 0,
			kc = 0,
			lc = 0,
			mc = 0,
			nc = 0,
			oc = 0,
			pc = 0,
			qc = 0,
			rc = 0,
			sc = 0,
			tc = 0,
			uc = 0,
			vc = 0,
			wc = 0,
			xc = 0,
			yc = 0,
			zc = 0,
			Ac = 0,
			Bc = 0,
			Cc = 0,
			Dc = 0,
			Ec = 0;
		m = i;
		i = i + 624 | 0;
		n = m + 24 | 0;
		o = m + 16 | 0;
		p = m + 532 | 0;
		q = m + 600 | 0;
		r = m;
		s = m + 560 | 0;
		t = m + 8 | 0;
		u = m + 528 | 0;
		v = (e | 0) != 0;
		w = s + 40 | 0;
		x = w;
		y = s + 39 | 0;
		s = t + 4 | 0;
		z = q + 12 | 0;
		A = q + 11 | 0;
		q = p;
		B = z;
		C = B - q | 0;
		E = -2 - q | 0;
		F = B + 2 | 0;
		G = n + 288 | 0;
		H = p + 9 | 0;
		I = H;
		J = p + 8 | 0;
		K = 0;
		L = f;
		f = 0;
		M = 0;
		a: while (1) {
			do
				if ((K | 0) > -1)
					if ((f | 0) > (2147483647 - K | 0)) {
						c[(Bd() | 0) >> 2] = 75;
						N = -1;
						break
					} else {
						N = f + K | 0;
						break
					}
			else N = K; while (0);
			O = a[L >> 0] | 0;
			if (!(O << 24 >> 24)) {
				P = N;
				Q = M;
				R = 245;
				break
			} else {
				S = O;
				T = L
			}
			b: while (1) {
				switch (S << 24 >> 24) {
					case 37:
						{
							U = T;V = T;R = 9;
							break b;
							break
						}
					case 0:
						{
							W = T;X = T;
							break b;
							break
						}
					default:
						{}
				}
				O = T + 1 | 0;
				S = a[O >> 0] | 0;
				T = O
			}
			c: do
					if ((R | 0) == 9)
						while (1) {
							R = 0;
							if ((a[U + 1 >> 0] | 0) != 37) {
								W = U;
								X = V;
								break c
							}
							O = V + 1 | 0;
							Y = U + 2 | 0;
							if ((a[Y >> 0] | 0) == 37) {
								U = Y;
								V = O;
								R = 9
							} else {
								W = Y;
								X = O;
								break
							}
						}
				while (0);
				O = X - L | 0;
			if (v ? (c[e >> 2] & 32 | 0) == 0 : 0) we(L, O, e) | 0;
			if ((X | 0) != (L | 0)) {
				K = N;
				L = W;
				f = O;
				continue
			}
			Y = W + 1 | 0;
			Z = a[Y >> 0] | 0;
			_ = (Z << 24 >> 24) + -48 | 0;
			if (_ >>> 0 < 10) {
				aa = (a[W + 2 >> 0] | 0) == 36;
				ba = aa ? W + 3 | 0 : Y;
				ca = a[ba >> 0] | 0;
				da = aa ? _ : -1;
				ea = aa ? 1 : M;
				fa = ba
			} else {
				ca = Z;
				da = -1;
				ea = M;
				fa = Y
			}
			Y = ca << 24 >> 24;
			d: do
				if ((Y & -32 | 0) == 32) {
					Z = Y;
					ba = ca;
					aa = 0;
					_ = fa;
					while (1) {
						if (!(1 << Z + -32 & 75913)) {
							ga = ba;
							ha = aa;
							ia = _;
							break d
						}
						ja = 1 << (ba << 24 >> 24) + -32 | aa;
						ka = _ + 1 | 0;
						la = a[ka >> 0] | 0;
						Z = la << 24 >> 24;
						if ((Z & -32 | 0) != 32) {
							ga = la;
							ha = ja;
							ia = ka;
							break
						} else {
							ba = la;
							aa = ja;
							_ = ka
						}
					}
				} else {
					ga = ca;
					ha = 0;
					ia = fa
				}
			while (0);
			do
				if (ga << 24 >> 24 == 42) {
					Y = ia + 1 | 0;
					_ = (a[Y >> 0] | 0) + -48 | 0;
					if (_ >>> 0 < 10 ? (a[ia + 2 >> 0] | 0) == 36 : 0) {
						c[l + (_ << 2) >> 2] = 10;
						ma = 1;
						na = ia + 3 | 0;
						oa = c[j + ((a[Y >> 0] | 0) + -48 << 3) >> 2] | 0
					} else {
						if (ea) {
							pa = -1;
							break a
						}
						if (!v) {
							qa = ha;
							ra = Y;
							sa = 0;
							ta = 0;
							break
						}
						_ = (c[g >> 2] | 0) + (4 - 1) & ~(4 - 1);
						aa = c[_ >> 2] | 0;
						c[g >> 2] = _ + 4;
						ma = 0;
						na = Y;
						oa = aa
					}
					if ((oa | 0) < 0) {
						qa = ha | 8192;
						ra = na;
						sa = ma;
						ta = 0 - oa | 0
					} else {
						qa = ha;
						ra = na;
						sa = ma;
						ta = oa
					}
				} else {
					aa = (ga << 24 >> 24) + -48 | 0;
					if (aa >>> 0 < 10) {
						Y = ia;
						_ = 0;
						ba = aa;
						while (1) {
							aa = (_ * 10 | 0) + ba | 0;
							Z = Y + 1 | 0;
							ba = (a[Z >> 0] | 0) + -48 | 0;
							if (ba >>> 0 >= 10) {
								ua = aa;
								va = Z;
								break
							} else {
								Y = Z;
								_ = aa
							}
						}
						if ((ua | 0) < 0) {
							pa = -1;
							break a
						} else {
							qa = ha;
							ra = va;
							sa = ea;
							ta = ua
						}
					} else {
						qa = ha;
						ra = ia;
						sa = ea;
						ta = 0
					}
				}
			while (0);
			e: do
				if ((a[ra >> 0] | 0) == 46) {
					_ = ra + 1 | 0;
					Y = a[_ >> 0] | 0;
					if (Y << 24 >> 24 != 42) {
						ba = (Y << 24 >> 24) + -48 | 0;
						if (ba >>> 0 < 10) {
							wa = _;
							xa = 0;
							ya = ba
						} else {
							za = _;
							Aa = 0;
							break
						}
						while (1) {
							_ = (xa * 10 | 0) + ya | 0;
							ba = wa + 1 | 0;
							ya = (a[ba >> 0] | 0) + -48 | 0;
							if (ya >>> 0 >= 10) {
								za = ba;
								Aa = _;
								break e
							} else {
								wa = ba;
								xa = _
							}
						}
					}
					_ = ra + 2 | 0;
					ba = (a[_ >> 0] | 0) + -48 | 0;
					if (ba >>> 0 < 10 ? (a[ra + 3 >> 0] | 0) == 36 : 0) {
						c[l + (ba << 2) >> 2] = 10;
						za = ra + 4 | 0;
						Aa = c[j + ((a[_ >> 0] | 0) + -48 << 3) >> 2] | 0;
						break
					}
					if (sa) {
						pa = -1;
						break a
					}
					if (v) {
						ba = (c[g >> 2] | 0) + (4 - 1) & ~(4 - 1);
						Y = c[ba >> 2] | 0;
						c[g >> 2] = ba + 4;
						za = _;
						Aa = Y
					} else {
						za = _;
						Aa = 0
					}
				} else {
					za = ra;
					Aa = -1
				}
			while (0);
			_ = za;
			Y = 0;
			while (1) {
				ba = (a[_ >> 0] | 0) + -65 | 0;
				if (ba >>> 0 > 57) {
					pa = -1;
					break a
				}
				aa = _ + 1 | 0;
				Z = a[19790 + (Y * 58 | 0) + ba >> 0] | 0;
				ba = Z & 255;
				if ((ba + -1 | 0) >>> 0 < 8) {
					_ = aa;
					Y = ba
				} else {
					Ba = aa;
					Ca = Z;
					Da = ba;
					Ea = _;
					Fa = Y;
					break
				}
			}
			if (!(Ca << 24 >> 24)) {
				pa = -1;
				break
			}
			Y = (da | 0) > -1;
			do
				if (Ca << 24 >> 24 == 19)
					if (Y) {
						pa = -1;
						break a
					} else R = 52;
			else {
				if (Y) {
					c[l + (da << 2) >> 2] = Da;
					_ = j + (da << 3) | 0;
					ba = c[_ + 4 >> 2] | 0;
					Z = r;
					c[Z >> 2] = c[_ >> 2];
					c[Z + 4 >> 2] = ba;
					R = 52;
					break
				}
				if (!v) {
					pa = 0;
					break a
				}
				ef(r, Da, g)
			} while (0);
			if ((R | 0) == 52 ? (R = 0, !v) : 0) {
				K = N;
				L = Ba;
				f = O;
				M = sa;
				continue
			}
			Y = a[Ea >> 0] | 0;
			ba = (Fa | 0) != 0 & (Y & 15 | 0) == 3 ? Y & -33 : Y;
			Y = qa & -65537;
			Z = (qa & 8192 | 0) == 0 ? qa : Y;
			f: do switch (ba | 0) {
					case 110:
						{
							switch (Fa | 0) {
								case 0:
									{
										c[c[r >> 2] >> 2] = N;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 1:
									{
										c[c[r >> 2] >> 2] = N;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 2:
									{
										_ = c[r >> 2] | 0;c[_ >> 2] = N;c[_ + 4 >> 2] = ((N | 0) < 0) << 31 >> 31;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 3:
									{
										b[c[r >> 2] >> 1] = N;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 4:
									{
										a[c[r >> 2] >> 0] = N;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 6:
									{
										c[c[r >> 2] >> 2] = N;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								case 7:
									{
										_ = c[r >> 2] | 0;c[_ >> 2] = N;c[_ + 4 >> 2] = ((N | 0) < 0) << 31 >> 31;K = N;L = Ba;f = O;M = sa;
										continue a;
										break
									}
								default:
									{
										K = N;L = Ba;f = O;M = sa;
										continue a
									}
							}
							break
						}
					case 112:
						{
							Ga = Z | 8;Ha = Aa >>> 0 > 8 ? Aa : 8;Ia = 120;R = 64;
							break
						}
					case 88:
					case 120:
						{
							Ga = Z;Ha = Aa;Ia = ba;R = 64;
							break
						}
					case 111:
						{
							_ = r;aa = c[_ >> 2] | 0;ka = c[_ + 4 >> 2] | 0;
							if ((aa | 0) == 0 & (ka | 0) == 0) Ja = w;
							else {
								_ = w;
								ja = aa;
								aa = ka;
								while (1) {
									ka = _ + -1 | 0;
									a[ka >> 0] = ja & 7 | 48;
									ja = kp(ja | 0, aa | 0, 3) | 0;
									aa = D;
									if ((ja | 0) == 0 & (aa | 0) == 0) {
										Ja = ka;
										break
									} else _ = ka
								}
							}
							if (!(Z & 8)) {
								Ka = Ja;
								La = Z;
								Ma = Aa;
								Na = 0;
								Oa = 20270;
								R = 77
							} else {
								_ = x - Ja + 1 | 0;
								Ka = Ja;
								La = Z;
								Ma = (Aa | 0) < (_ | 0) ? _ : Aa;
								Na = 0;
								Oa = 20270;
								R = 77
							}
							break
						}
					case 105:
					case 100:
						{
							_ = r;aa = c[_ >> 2] | 0;ja = c[_ + 4 >> 2] | 0;
							if ((ja | 0) < 0) {
								_ = hp(0, 0, aa | 0, ja | 0) | 0;
								ka = D;
								la = r;
								c[la >> 2] = _;
								c[la + 4 >> 2] = ka;
								Pa = _;
								Qa = ka;
								Ra = 1;
								Sa = 20270;
								R = 76;
								break f
							}
							if (!(Z & 2048)) {
								ka = Z & 1;
								Pa = aa;
								Qa = ja;
								Ra = ka;
								Sa = (ka | 0) == 0 ? 20270 : 20272;
								R = 76
							} else {
								Pa = aa;
								Qa = ja;
								Ra = 1;
								Sa = 20271;
								R = 76
							}
							break
						}
					case 117:
						{
							ja = r;Pa = c[ja >> 2] | 0;Qa = c[ja + 4 >> 2] | 0;Ra = 0;Sa = 20270;R = 76;
							break
						}
					case 99:
						{
							a[y >> 0] = c[r >> 2];Ta = y;Ua = Y;Va = 1;Wa = 0;Xa = 20270;Ya = w;
							break
						}
					case 109:
						{
							Za = Cd(c[(Bd() | 0) >> 2] | 0) | 0;R = 82;
							break
						}
					case 115:
						{
							ja = c[r >> 2] | 0;Za = (ja | 0) != 0 ? ja : 20280;R = 82;
							break
						}
					case 67:
						{
							c[t >> 2] = c[r >> 2];c[s >> 2] = 0;c[r >> 2] = t;_a = -1;R = 86;
							break
						}
					case 83:
						{
							if (!Aa) {
								gf(e, 32, ta, 0, Z);
								$a = 0;
								R = 98
							} else {
								_a = Aa;
								R = 86
							}
							break
						}
					case 65:
					case 71:
					case 70:
					case 69:
					case 97:
					case 103:
					case 102:
					case 101:
						{
							ab = +h[r >> 3];c[o >> 2] = 0;h[k >> 3] = ab;
							if ((c[k + 4 >> 2] | 0) >= 0)
								if (!(Z & 2048)) {
									ja = Z & 1;
									bb = ab;
									cb = ja;
									db = (ja | 0) == 0 ? 20288 : 20293
								} else {
									bb = ab;
									cb = 1;
									db = 20290
								}
							else {
								bb = -ab;
								cb = 1;
								db = 20287
							}
							h[k >> 3] = bb;ja = c[k + 4 >> 2] & 2146435072;do
								if (ja >>> 0 < 2146435072 | (ja | 0) == 2146435072 & 0 < 0) {
									ab = +Xd(bb, o) * 2.0;
									aa = ab != 0.0;
									if (aa) c[o >> 2] = (c[o >> 2] | 0) + -1;
									ka = ba | 32;
									if ((ka | 0) == 97) {
										_ = ba & 32;
										la = (_ | 0) == 0 ? db : db + 9 | 0;
										eb = cb | 2;
										fb = 12 - Aa | 0;
										do
											if (!(Aa >>> 0 > 11 | (fb | 0) == 0)) {
												gb = fb;
												hb = 8.0;
												while (1) {
													gb = gb + -1 | 0;
													ib = hb * 16.0;
													if (!gb) {
														jb = ib;
														break
													} else hb = ib
												}
												if ((a[la >> 0] | 0) == 45) {
													kb = -(jb + (-ab - jb));
													break
												} else {
													kb = ab + jb - jb;
													break
												}
											} else kb = ab; while (0);
										fb = c[o >> 2] | 0;
										gb = (fb | 0) < 0 ? 0 - fb | 0 : fb;
										lb = ff(gb, ((gb | 0) < 0) << 31 >> 31, z) | 0;
										if ((lb | 0) == (z | 0)) {
											a[A >> 0] = 48;
											mb = A
										} else mb = lb;
										a[mb + -1 >> 0] = (fb >> 31 & 2) + 43;
										fb = mb + -2 | 0;
										a[fb >> 0] = ba + 15;
										lb = (Aa | 0) < 1;
										gb = (Z & 8 | 0) == 0;
										hb = kb;
										nb = p;
										while (1) {
											ob = ~~hb;
											pb = nb + 1 | 0;
											a[nb >> 0] = d[20254 + ob >> 0] | _;
											hb = (hb - +(ob | 0)) * 16.0;
											do
												if ((pb - q | 0) == 1) {
													if (gb & (lb & hb == 0.0)) {
														qb = pb;
														break
													}
													a[pb >> 0] = 46;
													qb = nb + 2 | 0
												} else qb = pb; while (0);
											if (!(hb != 0.0)) {
												rb = qb;
												break
											} else nb = qb
										}
										nb = rb;
										lb = (Aa | 0) != 0 & (E + nb | 0) < (Aa | 0) ? F + Aa - fb | 0 : C - fb + nb | 0;
										gb = lb + eb | 0;
										gf(e, 32, ta, gb, Z);
										if (!(c[e >> 2] & 32)) we(la, eb, e) | 0;
										gf(e, 48, ta, gb, Z ^ 65536);
										_ = nb - q | 0;
										if (!(c[e >> 2] & 32)) we(p, _, e) | 0;
										nb = B - fb | 0;
										gf(e, 48, lb - (_ + nb) | 0, 0, 0);
										if (!(c[e >> 2] & 32)) we(fb, nb, e) | 0;
										gf(e, 32, ta, gb, Z ^ 8192);
										sb = (gb | 0) < (ta | 0) ? ta : gb;
										break
									}
									gb = (Aa | 0) < 0 ? 6 : Aa;
									if (aa) {
										nb = (c[o >> 2] | 0) + -28 | 0;
										c[o >> 2] = nb;
										tb = ab * 268435456.0;
										ub = nb
									} else {
										tb = ab;
										ub = c[o >> 2] | 0
									}
									nb = (ub | 0) < 0 ? n : G;
									_ = nb;
									hb = tb;
									lb = nb;
									while (1) {
										pb = ~~hb >>> 0;
										c[lb >> 2] = pb;
										ob = lb + 4 | 0;
										hb = (hb - +(pb >>> 0)) * 1.0e9;
										if (!(hb != 0.0)) {
											vb = ob;
											break
										} else lb = ob
									}
									lb = c[o >> 2] | 0;
									if ((lb | 0) > 0) {
										aa = lb;
										fb = nb;
										eb = vb;
										while (1) {
											la = (aa | 0) > 29 ? 29 : aa;
											ob = eb + -4 | 0;
											do
												if (ob >>> 0 < fb >>> 0) wb = fb;
												else {
													pb = 0;
													xb = ob;
													while (1) {
														yb = mp(c[xb >> 2] | 0, 0, la | 0) | 0;
														zb = jp(yb | 0, D | 0, pb | 0, 0) | 0;
														yb = D;
														Ab = vp(zb | 0, yb | 0, 1e9, 0) | 0;
														c[xb >> 2] = Ab;
														Ab = up(zb | 0, yb | 0, 1e9, 0) | 0;
														xb = xb + -4 | 0;
														if (xb >>> 0 < fb >>> 0) {
															Bb = Ab;
															break
														} else pb = Ab
													}
													if (!Bb) {
														wb = fb;
														break
													}
													pb = fb + -4 | 0;
													c[pb >> 2] = Bb;
													wb = pb
												}
											while (0);
											ob = eb;
											while (1) {
												if (ob >>> 0 <= wb >>> 0) {
													Cb = ob;
													break
												}
												pb = ob + -4 | 0;
												if (!(c[pb >> 2] | 0)) ob = pb;
												else {
													Cb = ob;
													break
												}
											}
											ob = (c[o >> 2] | 0) - la | 0;
											c[o >> 2] = ob;
											if ((ob | 0) > 0) {
												aa = ob;
												fb = wb;
												eb = Cb
											} else {
												Db = ob;
												Eb = wb;
												Fb = Cb;
												break
											}
										}
									} else {
										Db = lb;
										Eb = nb;
										Fb = vb
									}
									if ((Db | 0) < 0) {
										eb = ((gb + 25 | 0) / 9 | 0) + 1 | 0;
										fb = (ka | 0) == 102;
										aa = Db;
										ob = Eb;
										pb = Fb;
										while (1) {
											xb = 0 - aa | 0;
											Ab = (xb | 0) > 9 ? 9 : xb;
											do
												if (ob >>> 0 < pb >>> 0) {
													xb = (1 << Ab) + -1 | 0;
													yb = 1e9 >>> Ab;
													zb = 0;
													Gb = ob;
													while (1) {
														Hb = c[Gb >> 2] | 0;
														c[Gb >> 2] = (Hb >>> Ab) + zb;
														Ib = $(Hb & xb, yb) | 0;
														Gb = Gb + 4 | 0;
														if (Gb >>> 0 >= pb >>> 0) {
															Jb = Ib;
															break
														} else zb = Ib
													}
													zb = (c[ob >> 2] | 0) == 0 ? ob + 4 | 0 : ob;
													if (!Jb) {
														Kb = zb;
														Lb = pb;
														break
													}
													c[pb >> 2] = Jb;
													Kb = zb;
													Lb = pb + 4 | 0
												} else {
													Kb = (c[ob >> 2] | 0) == 0 ? ob + 4 | 0 : ob;
													Lb = pb
												}
											while (0);
											la = fb ? nb : Kb;
											zb = (Lb - la >> 2 | 0) > (eb | 0) ? la + (eb << 2) | 0 : Lb;
											aa = (c[o >> 2] | 0) + Ab | 0;
											c[o >> 2] = aa;
											if ((aa | 0) >= 0) {
												Mb = Kb;
												Nb = zb;
												break
											} else {
												ob = Kb;
												pb = zb
											}
										}
									} else {
										Mb = Eb;
										Nb = Fb
									}
									do
										if (Mb >>> 0 < Nb >>> 0) {
											pb = (_ - Mb >> 2) * 9 | 0;
											ob = c[Mb >> 2] | 0;
											if (ob >>> 0 < 10) {
												Ob = pb;
												break
											} else {
												Pb = pb;
												Qb = 10
											}
											while (1) {
												Qb = Qb * 10 | 0;
												pb = Pb + 1 | 0;
												if (ob >>> 0 < Qb >>> 0) {
													Ob = pb;
													break
												} else Pb = pb
											}
										} else Ob = 0; while (0);
									ob = (ka | 0) == 103;
									Ab = (gb | 0) != 0;
									pb = gb - ((ka | 0) != 102 ? Ob : 0) + ((Ab & ob) << 31 >> 31) | 0;
									if ((pb | 0) < (((Nb - _ >> 2) * 9 | 0) + -9 | 0)) {
										aa = pb + 9216 | 0;
										pb = (aa | 0) / 9 | 0;
										eb = nb + (pb + -1023 << 2) | 0;
										fb = ((aa | 0) % 9 | 0) + 1 | 0;
										if ((fb | 0) < 9) {
											aa = 10;
											lb = fb;
											while (1) {
												fb = aa * 10 | 0;
												lb = lb + 1 | 0;
												if ((lb | 0) == 9) {
													Rb = fb;
													break
												} else aa = fb
											}
										} else Rb = 10;
										aa = c[eb >> 2] | 0;
										lb = (aa >>> 0) % (Rb >>> 0) | 0;
										if ((lb | 0) == 0 ? (nb + (pb + -1022 << 2) | 0) == (Nb | 0) : 0) {
											Sb = Mb;
											Tb = eb;
											Ub = Ob
										} else R = 163;
										do
											if ((R | 0) == 163) {
												R = 0;
												hb = (((aa >>> 0) / (Rb >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0;
												ka = (Rb | 0) / 2 | 0;
												do
													if (lb >>> 0 < ka >>> 0) Vb = .5;
													else {
														if ((lb | 0) == (ka | 0) ? (nb + (pb + -1022 << 2) | 0) == (Nb | 0) : 0) {
															Vb = 1.0;
															break
														}
														Vb = 1.5
													}
												while (0);
												do
													if (!cb) {
														Wb = hb;
														Xb = Vb
													} else {
														if ((a[db >> 0] | 0) != 45) {
															Wb = hb;
															Xb = Vb;
															break
														}
														Wb = -hb;
														Xb = -Vb
													}
												while (0);
												ka = aa - lb | 0;
												c[eb >> 2] = ka;
												if (!(Wb + Xb != Wb)) {
													Sb = Mb;
													Tb = eb;
													Ub = Ob;
													break
												}
												fb = ka + Rb | 0;
												c[eb >> 2] = fb;
												if (fb >>> 0 > 999999999) {
													fb = Mb;
													ka = eb;
													while (1) {
														zb = ka + -4 | 0;
														c[ka >> 2] = 0;
														if (zb >>> 0 < fb >>> 0) {
															la = fb + -4 | 0;
															c[la >> 2] = 0;
															Yb = la
														} else Yb = fb;
														la = (c[zb >> 2] | 0) + 1 | 0;
														c[zb >> 2] = la;
														if (la >>> 0 > 999999999) {
															fb = Yb;
															ka = zb
														} else {
															Zb = Yb;
															_b = zb;
															break
														}
													}
												} else {
													Zb = Mb;
													_b = eb
												}
												ka = (_ - Zb >> 2) * 9 | 0;
												fb = c[Zb >> 2] | 0;
												if (fb >>> 0 < 10) {
													Sb = Zb;
													Tb = _b;
													Ub = ka;
													break
												} else {
													$b = ka;
													ac = 10
												}
												while (1) {
													ac = ac * 10 | 0;
													ka = $b + 1 | 0;
													if (fb >>> 0 < ac >>> 0) {
														Sb = Zb;
														Tb = _b;
														Ub = ka;
														break
													} else $b = ka
												}
											}
										while (0);
										eb = Tb + 4 | 0;
										bc = Sb;
										cc = Ub;
										dc = Nb >>> 0 > eb >>> 0 ? eb : Nb
									} else {
										bc = Mb;
										cc = Ob;
										dc = Nb
									}
									eb = 0 - cc | 0;
									lb = dc;
									while (1) {
										if (lb >>> 0 <= bc >>> 0) {
											ec = 0;
											fc = lb;
											break
										}
										aa = lb + -4 | 0;
										if (!(c[aa >> 2] | 0)) lb = aa;
										else {
											ec = 1;
											fc = lb;
											break
										}
									}
									do
										if (ob) {
											lb = (Ab & 1 ^ 1) + gb | 0;
											if ((lb | 0) > (cc | 0) & (cc | 0) > -5) {
												gc = ba + -1 | 0;
												hc = lb + -1 - cc | 0
											} else {
												gc = ba + -2 | 0;
												hc = lb + -1 | 0
											}
											lb = Z & 8;
											if (lb) {
												ic = gc;
												jc = hc;
												kc = lb;
												break
											}
											do
												if (ec) {
													lb = c[fc + -4 >> 2] | 0;
													if (!lb) {
														lc = 9;
														break
													}
													if (!((lb >>> 0) % 10 | 0)) {
														mc = 10;
														nc = 0
													} else {
														lc = 0;
														break
													}
													while (1) {
														mc = mc * 10 | 0;
														aa = nc + 1 | 0;
														if ((lb >>> 0) % (mc >>> 0) | 0) {
															lc = aa;
															break
														} else nc = aa
													}
												} else lc = 9; while (0);
											lb = ((fc - _ >> 2) * 9 | 0) + -9 | 0;
											if ((gc | 32 | 0) == 102) {
												aa = lb - lc | 0;
												pb = (aa | 0) < 0 ? 0 : aa;
												ic = gc;
												jc = (hc | 0) < (pb | 0) ? hc : pb;
												kc = 0;
												break
											} else {
												pb = lb + cc - lc | 0;
												lb = (pb | 0) < 0 ? 0 : pb;
												ic = gc;
												jc = (hc | 0) < (lb | 0) ? hc : lb;
												kc = 0;
												break
											}
										} else {
											ic = ba;
											jc = gb;
											kc = Z & 8
										}
									while (0);
									gb = jc | kc;
									_ = (gb | 0) != 0 & 1;
									Ab = (ic | 32 | 0) == 102;
									if (Ab) {
										oc = (cc | 0) > 0 ? cc : 0;
										pc = 0
									} else {
										ob = (cc | 0) < 0 ? eb : cc;
										lb = ff(ob, ((ob | 0) < 0) << 31 >> 31, z) | 0;
										if ((B - lb | 0) < 2) {
											ob = lb;
											while (1) {
												pb = ob + -1 | 0;
												a[pb >> 0] = 48;
												if ((B - pb | 0) < 2) ob = pb;
												else {
													qc = pb;
													break
												}
											}
										} else qc = lb;
										a[qc + -1 >> 0] = (cc >> 31 & 2) + 43;
										ob = qc + -2 | 0;
										a[ob >> 0] = ic;
										oc = B - ob | 0;
										pc = ob
									}
									ob = cb + 1 + jc + _ + oc | 0;
									gf(e, 32, ta, ob, Z);
									if (!(c[e >> 2] & 32)) we(db, cb, e) | 0;
									gf(e, 48, ta, ob, Z ^ 65536);
									do
										if (Ab) {
											eb = bc >>> 0 > nb >>> 0 ? nb : bc;
											pb = eb;
											while (1) {
												aa = ff(c[pb >> 2] | 0, 0, H) | 0;
												do
													if ((pb | 0) == (eb | 0)) {
														if ((aa | 0) != (H | 0)) {
															rc = aa;
															break
														}
														a[J >> 0] = 48;
														rc = J
													} else {
														if (aa >>> 0 > p >>> 0) sc = aa;
														else {
															rc = aa;
															break
														}
														while (1) {
															fb = sc + -1 | 0;
															a[fb >> 0] = 48;
															if (fb >>> 0 > p >>> 0) sc = fb;
															else {
																rc = fb;
																break
															}
														}
													}
												while (0);
												if (!(c[e >> 2] & 32)) we(rc, I - rc | 0, e) | 0;
												aa = pb + 4 | 0;
												if (aa >>> 0 > nb >>> 0) {
													tc = aa;
													break
												} else pb = aa
											}
											do
												if (gb) {
													if (c[e >> 2] & 32) break;
													we(20322, 1, e) | 0
												}
											while (0);
											if ((jc | 0) > 0 & tc >>> 0 < fc >>> 0) {
												pb = jc;
												eb = tc;
												while (1) {
													aa = ff(c[eb >> 2] | 0, 0, H) | 0;
													if (aa >>> 0 > p >>> 0) {
														fb = aa;
														while (1) {
															ka = fb + -1 | 0;
															a[ka >> 0] = 48;
															if (ka >>> 0 > p >>> 0) fb = ka;
															else {
																uc = ka;
																break
															}
														}
													} else uc = aa;
													if (!(c[e >> 2] & 32)) we(uc, (pb | 0) > 9 ? 9 : pb, e) | 0;
													eb = eb + 4 | 0;
													fb = pb + -9 | 0;
													if (!((pb | 0) > 9 & eb >>> 0 < fc >>> 0)) {
														vc = fb;
														break
													} else pb = fb
												}
											} else vc = jc;
											gf(e, 48, vc + 9 | 0, 9, 0)
										} else {
											pb = ec ? fc : bc + 4 | 0;
											if ((jc | 0) > -1) {
												eb = (kc | 0) == 0;
												fb = jc;
												ka = bc;
												while (1) {
													zb = ff(c[ka >> 2] | 0, 0, H) | 0;
													if ((zb | 0) == (H | 0)) {
														a[J >> 0] = 48;
														wc = J
													} else wc = zb;
													do
														if ((ka | 0) == (bc | 0)) {
															zb = wc + 1 | 0;
															if (!(c[e >> 2] & 32)) we(wc, 1, e) | 0;
															if (eb & (fb | 0) < 1) {
																xc = zb;
																break
															}
															if (c[e >> 2] & 32) {
																xc = zb;
																break
															}
															we(20322, 1, e) | 0;
															xc = zb
														} else {
															if (wc >>> 0 > p >>> 0) yc = wc;
															else {
																xc = wc;
																break
															}
															while (1) {
																zb = yc + -1 | 0;
																a[zb >> 0] = 48;
																if (zb >>> 0 > p >>> 0) yc = zb;
																else {
																	xc = zb;
																	break
																}
															}
														}
													while (0);
													aa = I - xc | 0;
													if (!(c[e >> 2] & 32)) we(xc, (fb | 0) > (aa | 0) ? aa : fb, e) | 0;
													zb = fb - aa | 0;
													ka = ka + 4 | 0;
													if (!(ka >>> 0 < pb >>> 0 & (zb | 0) > -1)) {
														zc = zb;
														break
													} else fb = zb
												}
											} else zc = jc;
											gf(e, 48, zc + 18 | 0, 18, 0);
											if (c[e >> 2] & 32) break;
											we(pc, B - pc | 0, e) | 0
										}
									while (0);
									gf(e, 32, ta, ob, Z ^ 8192);
									sb = (ob | 0) < (ta | 0) ? ta : ob
								} else {
									gb = (ba & 32 | 0) != 0;
									nb = bb != bb | 0.0 != 0.0;
									Ab = nb ? 0 : cb;
									_ = Ab + 3 | 0;
									gf(e, 32, ta, _, Y);
									lb = c[e >> 2] | 0;
									if (!(lb & 32)) {
										we(db, Ab, e) | 0;
										Ac = c[e >> 2] | 0
									} else Ac = lb;
									if (!(Ac & 32)) we(nb ? (gb ? 20314 : 20318) : gb ? 20306 : 20310, 3, e) | 0;
									gf(e, 32, ta, _, Z ^ 8192);
									sb = (_ | 0) < (ta | 0) ? ta : _
								}
							while (0);
							K = N;L = Ba;f = sb;M = sa;
							continue a;
							break
						}
					default:
						{
							Ta = L;Ua = Z;Va = Aa;Wa = 0;Xa = 20270;Ya = w
						}
				}
				while (0);
				g: do
					if ((R | 0) == 64) {
						R = 0;
						ba = r;
						O = c[ba >> 2] | 0;
						ja = c[ba + 4 >> 2] | 0;
						ba = Ia & 32;
						if (!((O | 0) == 0 & (ja | 0) == 0)) {
							_ = w;
							gb = O;
							O = ja;
							while (1) {
								ja = _ + -1 | 0;
								a[ja >> 0] = d[20254 + (gb & 15) >> 0] | ba;
								gb = kp(gb | 0, O | 0, 4) | 0;
								O = D;
								if ((gb | 0) == 0 & (O | 0) == 0) {
									Bc = ja;
									break
								} else _ = ja
							}
							_ = r;
							if ((Ga & 8 | 0) == 0 | (c[_ >> 2] | 0) == 0 & (c[_ + 4 >> 2] | 0) == 0) {
								Ka = Bc;
								La = Ga;
								Ma = Ha;
								Na = 0;
								Oa = 20270;
								R = 77
							} else {
								Ka = Bc;
								La = Ga;
								Ma = Ha;
								Na = 2;
								Oa = 20270 + (Ia >> 4) | 0;
								R = 77
							}
						} else {
							Ka = w;
							La = Ga;
							Ma = Ha;
							Na = 0;
							Oa = 20270;
							R = 77
						}
					} else
			if ((R | 0) == 76) {
				R = 0;
				Ka = ff(Pa, Qa, w) | 0;
				La = Z;
				Ma = Aa;
				Na = Ra;
				Oa = Sa;
				R = 77
			} else if ((R | 0) == 82) {
				R = 0;
				_ = Le(Za, 0, Aa) | 0;
				O = (_ | 0) == 0;
				Ta = Za;
				Ua = Y;
				Va = O ? Aa : _ - Za | 0;
				Wa = 0;
				Xa = 20270;
				Ya = O ? Za + Aa | 0 : _
			} else if ((R | 0) == 86) {
				R = 0;
				_ = 0;
				O = 0;
				gb = c[r >> 2] | 0;
				while (1) {
					ba = c[gb >> 2] | 0;
					if (!ba) {
						Cc = _;
						Dc = O;
						break
					}
					ja = he(u, ba) | 0;
					if ((ja | 0) < 0 | ja >>> 0 > (_a - _ | 0) >>> 0) {
						Cc = _;
						Dc = ja;
						break
					}
					ba = ja + _ | 0;
					if (_a >>> 0 > ba >>> 0) {
						_ = ba;
						O = ja;
						gb = gb + 4 | 0
					} else {
						Cc = ba;
						Dc = ja;
						break
					}
				}
				if ((Dc | 0) < 0) {
					pa = -1;
					break a
				}
				gf(e, 32, ta, Cc, Z);
				if (!Cc) {
					$a = 0;
					R = 98
				} else {
					gb = 0;
					O = c[r >> 2] | 0;
					while (1) {
						_ = c[O >> 2] | 0;
						if (!_) {
							$a = Cc;
							R = 98;
							break g
						}
						ja = he(u, _) | 0;
						gb = ja + gb | 0;
						if ((gb | 0) > (Cc | 0)) {
							$a = Cc;
							R = 98;
							break g
						}
						if (!(c[e >> 2] & 32)) we(u, ja, e) | 0;
						if (gb >>> 0 >= Cc >>> 0) {
							$a = Cc;
							R = 98;
							break
						} else O = O + 4 | 0
					}
				}
			}
			while (0);
			if ((R | 0) == 98) {
				R = 0;
				gf(e, 32, ta, $a, Z ^ 8192);
				K = N;
				L = Ba;
				f = (ta | 0) > ($a | 0) ? ta : $a;
				M = sa;
				continue
			}
			if ((R | 0) == 77) {
				R = 0;
				Y = (Ma | 0) > -1 ? La & -65537 : La;
				O = r;
				gb = (c[O >> 2] | 0) != 0 | (c[O + 4 >> 2] | 0) != 0;
				if ((Ma | 0) != 0 | gb) {
					O = (gb & 1 ^ 1) + (x - Ka) | 0;
					Ta = Ka;
					Ua = Y;
					Va = (Ma | 0) > (O | 0) ? Ma : O;
					Wa = Na;
					Xa = Oa;
					Ya = w
				} else {
					Ta = w;
					Ua = Y;
					Va = 0;
					Wa = Na;
					Xa = Oa;
					Ya = w
				}
			}
			Y = Ya - Ta | 0;
			O = (Va | 0) < (Y | 0) ? Y : Va;
			gb = Wa + O | 0;
			ja = (ta | 0) < (gb | 0) ? gb : ta;
			gf(e, 32, ja, gb, Ua);
			if (!(c[e >> 2] & 32)) we(Xa, Wa, e) | 0;
			gf(e, 48, ja, gb, Ua ^ 65536);
			gf(e, 48, O, Y, 0);
			if (!(c[e >> 2] & 32)) we(Ta, Y, e) | 0;
			gf(e, 32, ja, gb, Ua ^ 8192);
			K = N;
			L = Ba;
			f = ja;
			M = sa
		}
		h: do
			if ((R | 0) == 245)
				if (!e)
					if (Q) {
						sa = 1;
						while (1) {
							M = c[l + (sa << 2) >> 2] | 0;
							if (!M) {
								Ec = sa;
								break
							}
							ef(j + (sa << 3) | 0, M, g);
							sa = sa + 1 | 0;
							if ((sa | 0) >= 10) {
								pa = 1;
								break h
							}
						}
						if ((Ec | 0) < 10) {
							sa = Ec;
							while (1) {
								if (c[l + (sa << 2) >> 2] | 0) {
									pa = -1;
									break h
								}
								sa = sa + 1 | 0;
								if ((sa | 0) >= 10) {
									pa = 1;
									break
								}
							}
						} else pa = 1
					} else pa = 0;
		else pa = P;
		while (0);
		i = m;
		return pa | 0
	}

	function af(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return qe(a, b, c) | 0
	}

	function bf(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0.0;
		e = i;
		i = i + 112 | 0;
		f = e;
		g = f;
		h = g + 112 | 0;
		do {
			c[g >> 2] = 0;
			g = g + 4 | 0
		} while ((g | 0) < (h | 0));
		g = f + 4 | 0;
		c[g >> 2] = a;
		h = f + 8 | 0;
		c[h >> 2] = -1;
		c[f + 44 >> 2] = a;
		c[f + 76 >> 2] = -1;
		Fd(f, 0);
		j = +Dd(f, d, 1);
		d = (c[g >> 2] | 0) - (c[h >> 2] | 0) + (c[f + 108 >> 2] | 0) | 0;
		if (b) c[b >> 2] = (d | 0) != 0 ? a + d | 0 : a;
		i = e;
		return +j
	}

	function cf(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0;
		g = i;
		i = i + 112 | 0;
		h = g;
		c[h >> 2] = 0;
		j = h + 4 | 0;
		c[j >> 2] = a;
		c[h + 44 >> 2] = a;
		k = h + 8 | 0;
		c[k >> 2] = (a | 0) < 0 ? -1 : a + 2147483647 | 0;
		c[h + 76 >> 2] = -1;
		Fd(h, 0);
		l = Ed(h, d, 1, e, f) | 0;
		if (b) c[b >> 2] = a + ((c[j >> 2] | 0) + (c[h + 108 >> 2] | 0) - (c[k >> 2] | 0));
		i = g;
		return l | 0
	}

	function df(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0;
		e = a + 20 | 0;
		f = c[e >> 2] | 0;
		g = (c[a + 16 >> 2] | 0) - f | 0;
		a = g >>> 0 > d >>> 0 ? d : g;
		lp(f | 0, b | 0, a | 0) | 0;
		c[e >> 2] = (c[e >> 2] | 0) + a;
		return d | 0
	}

	function ef(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			i = 0,
			j = 0.0;
		a: do
				if (b >>> 0 <= 20)
					do switch (b | 0) {
						case 9:
							{
								e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);f = c[e >> 2] | 0;c[d >> 2] = e + 4;c[a >> 2] = f;
								break a;
								break
							}
						case 10:
							{
								f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[f >> 2] | 0;c[d >> 2] = f + 4;f = a;c[f >> 2] = e;c[f + 4 >> 2] = ((e | 0) < 0) << 31 >> 31;
								break a;
								break
							}
						case 11:
							{
								e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);f = c[e >> 2] | 0;c[d >> 2] = e + 4;e = a;c[e >> 2] = f;c[e + 4 >> 2] = 0;
								break a;
								break
							}
						case 12:
							{
								e = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);f = e;g = c[f >> 2] | 0;i = c[f + 4 >> 2] | 0;c[d >> 2] = e + 8;e = a;c[e >> 2] = g;c[e + 4 >> 2] = i;
								break a;
								break
							}
						case 13:
							{
								i = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[i >> 2] | 0;c[d >> 2] = i + 4;i = (e & 65535) << 16 >> 16;e = a;c[e >> 2] = i;c[e + 4 >> 2] = ((i | 0) < 0) << 31 >> 31;
								break a;
								break
							}
						case 14:
							{
								i = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[i >> 2] | 0;c[d >> 2] = i + 4;i = a;c[i >> 2] = e & 65535;c[i + 4 >> 2] = 0;
								break a;
								break
							}
						case 15:
							{
								i = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[i >> 2] | 0;c[d >> 2] = i + 4;i = (e & 255) << 24 >> 24;e = a;c[e >> 2] = i;c[e + 4 >> 2] = ((i | 0) < 0) << 31 >> 31;
								break a;
								break
							}
						case 16:
							{
								i = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[i >> 2] | 0;c[d >> 2] = i + 4;i = a;c[i >> 2] = e & 255;c[i + 4 >> 2] = 0;
								break a;
								break
							}
						case 17:
							{
								i = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);j = +h[i >> 3];c[d >> 2] = i + 8;h[a >> 3] = j;
								break a;
								break
							}
						case 18:
							{
								i = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);j = +h[i >> 3];c[d >> 2] = i + 8;h[a >> 3] = j;
								break a;
								break
							}
						default:
							break a
					}
					while (0); while (0);
			return
	}

	function ff(b, c, d) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		if (c >>> 0 > 0 | (c | 0) == 0 & b >>> 0 > 4294967295) {
			e = d;
			f = b;
			g = c;
			while (1) {
				c = vp(f | 0, g | 0, 10, 0) | 0;
				h = e + -1 | 0;
				a[h >> 0] = c | 48;
				c = up(f | 0, g | 0, 10, 0) | 0;
				if (g >>> 0 > 9 | (g | 0) == 9 & f >>> 0 > 4294967295) {
					e = h;
					f = c;
					g = D
				} else {
					i = h;
					j = c;
					break
				}
			}
			k = i;
			l = j
		} else {
			k = d;
			l = b
		}
		if (!l) m = k;
		else {
			b = k;
			k = l;
			while (1) {
				l = b + -1 | 0;
				a[l >> 0] = (k >>> 0) % 10 | 0 | 48;
				if (k >>> 0 < 10) {
					m = l;
					break
				} else {
					b = l;
					k = (k >>> 0) / 10 | 0
				}
			}
		}
		return m | 0
	}

	function gf(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		g = i;
		i = i + 256 | 0;
		h = g;
		do
			if ((d | 0) > (e | 0) & (f & 73728 | 0) == 0) {
				j = d - e | 0;
				ip(h | 0, b | 0, (j >>> 0 > 256 ? 256 : j) | 0) | 0;
				k = c[a >> 2] | 0;
				l = (k & 32 | 0) == 0;
				if (j >>> 0 > 255) {
					m = d - e | 0;
					n = j;
					o = k;
					k = l;
					while (1) {
						if (k) {
							we(h, 256, a) | 0;
							p = c[a >> 2] | 0
						} else p = o;
						n = n + -256 | 0;
						k = (p & 32 | 0) == 0;
						if (n >>> 0 <= 255) break;
						else o = p
					}
					if (k) q = m & 255;
					else break
				} else if (l) q = j;
				else break;
				we(h, q, a) | 0
			}
		while (0);
		i = g;
		return
	}

	function hf(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0;
		a = c[772] | 0;
		kf(7852, a, 7908);
		c[1793] = 8600;
		c[1795] = 8620;
		c[1794] = 0;
		b = c[2147] | 0;
		ng(7172 + b | 0, 7852);
		c[7172 + (b + 72) >> 2] = 0;
		c[7172 + (b + 76) >> 2] = -1;
		b = c[773] | 0;
		lf(7956, b, 7916);
		c[1815] = 8680;
		c[1816] = 8700;
		d = c[2167] | 0;
		ng(7260 + d | 0, 7956);
		e = d + 72 | 0;
		c[7260 + e >> 2] = 0;
		f = d + 76 | 0;
		c[7260 + f >> 2] = -1;
		g = c[771] | 0;
		lf(8004, g, 7924);
		c[1836] = 8680;
		c[1837] = 8700;
		ng(7344 + d | 0, 8004);
		c[7344 + e >> 2] = 0;
		c[7344 + f >> 2] = -1;
		h = c[7344 + ((c[(c[1836] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0;
		c[1857] = 8680;
		c[1858] = 8700;
		ng(7428 + d | 0, h);
		c[7428 + e >> 2] = 0;
		c[7428 + f >> 2] = -1;
		c[7172 + ((c[(c[1793] | 0) + -12 >> 2] | 0) + 72) >> 2] = 7260;
		f = 7344 + ((c[(c[1836] | 0) + -12 >> 2] | 0) + 4) | 0;
		c[f >> 2] = c[f >> 2] | 8192;
		c[7344 + ((c[(c[1836] | 0) + -12 >> 2] | 0) + 72) >> 2] = 7260;
		mf(8052, a, 7932);
		c[1878] = 8640;
		c[1880] = 8660;
		c[1879] = 0;
		a = c[2157] | 0;
		ng(7512 + a | 0, 8052);
		c[7512 + (a + 72) >> 2] = 0;
		c[7512 + (a + 76) >> 2] = -1;
		nf(8108, b, 7940);
		c[1900] = 8720;
		c[1901] = 8740;
		b = c[2177] | 0;
		ng(7600 + b | 0, 8108);
		a = b + 72 | 0;
		c[7600 + a >> 2] = 0;
		f = b + 76 | 0;
		c[7600 + f >> 2] = -1;
		nf(8156, g, 7948);
		c[1921] = 8720;
		c[1922] = 8740;
		ng(7684 + b | 0, 8156);
		c[7684 + a >> 2] = 0;
		c[7684 + f >> 2] = -1;
		g = c[7684 + ((c[(c[1921] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0;
		c[1942] = 8720;
		c[1943] = 8740;
		ng(7768 + b | 0, g);
		c[7768 + a >> 2] = 0;
		c[7768 + f >> 2] = -1;
		c[7512 + ((c[(c[1878] | 0) + -12 >> 2] | 0) + 72) >> 2] = 7600;
		f = 7684 + ((c[(c[1921] | 0) + -12 >> 2] | 0) + 4) | 0;
		c[f >> 2] = c[f >> 2] | 8192;
		c[7684 + ((c[(c[1921] | 0) + -12 >> 2] | 0) + 72) >> 2] = 7600;
		return
	}

	function jf(a) {
		a = a | 0;
		Wg(7260) | 0;
		Wg(7428) | 0;
		$g(7600) | 0;
		$g(7768) | 0;
		return
	}

	function kf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = i;
		i = i + 16 | 0;
		g = f + 4 | 0;
		h = f;
		qg(b);
		c[b >> 2] = 8404;
		c[b + 32 >> 2] = d;
		c[b + 40 >> 2] = e;
		c[b + 48 >> 2] = -1;
		a[b + 52 >> 0] = 0;
		Dl(g, b + 4 | 0);
		c[h >> 2] = c[g >> 2];
		Ff(b, h);
		El(h);
		i = f;
		return
	}

	function lf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = i;
		i = i + 16 | 0;
		g = f + 4 | 0;
		h = f;
		qg(b);
		c[b >> 2] = 8340;
		c[b + 32 >> 2] = d;
		Dl(g, b + 4 | 0);
		c[h >> 2] = c[g >> 2];
		g = Gl(h, 9928) | 0;
		El(h);
		c[b + 36 >> 2] = g;
		c[b + 40 >> 2] = e;
		a[b + 44 >> 0] = (xb[c[(c[g >> 2] | 0) + 28 >> 2] & 63](g) | 0) & 1;
		i = f;
		return
	}

	function mf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = i;
		i = i + 16 | 0;
		g = f + 4 | 0;
		h = f;
		Fg(b);
		c[b >> 2] = 8276;
		c[b + 32 >> 2] = d;
		c[b + 40 >> 2] = e;
		c[b + 48 >> 2] = -1;
		a[b + 52 >> 0] = 0;
		Dl(g, b + 4 | 0);
		c[h >> 2] = c[g >> 2];
		uf(b, h);
		El(h);
		i = f;
		return
	}

	function nf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = i;
		i = i + 16 | 0;
		g = f + 4 | 0;
		h = f;
		Fg(b);
		c[b >> 2] = 8212;
		c[b + 32 >> 2] = d;
		Dl(g, b + 4 | 0);
		c[h >> 2] = c[g >> 2];
		g = Gl(h, 9936) | 0;
		El(h);
		c[b + 36 >> 2] = g;
		c[b + 40 >> 2] = e;
		a[b + 44 >> 0] = (xb[c[(c[g >> 2] | 0) + 28 >> 2] & 63](g) | 0) & 1;
		i = f;
		return
	}

	function of () {
		hf(0);
		bb(111, 20324, n | 0) | 0;
		return
	}

	function pf(a) {
		a = a | 0;
		Dg(a);
		Fc(a);
		return
	}

	function qf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0;
		xb[c[(c[b >> 2] | 0) + 24 >> 2] & 63](b) | 0;
		e = Gl(d, 9936) | 0;
		c[b + 36 >> 2] = e;
		a[b + 44 >> 0] = (xb[c[(c[e >> 2] | 0) + 28 >> 2] & 63](e) | 0) & 1;
		return
	}

	function rf(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		b = i;
		i = i + 16 | 0;
		d = b + 8 | 0;
		e = b;
		f = a + 36 | 0;
		g = a + 40 | 0;
		h = d + 8 | 0;
		j = d;
		k = a + 32 | 0;
		a: while (1) {
			a = c[f >> 2] | 0;
			l = Eb[c[(c[a >> 2] | 0) + 20 >> 2] & 31](a, c[g >> 2] | 0, d, h, e) | 0;
			a = (c[e >> 2] | 0) - j | 0;
			if ((xe(d, 1, a, c[k >> 2] | 0) | 0) != (a | 0)) {
				m = -1;
				break
			}
			switch (l | 0) {
				case 1:
					break;
				case 2:
					{
						m = -1;
						break a;
						break
					}
				default:
					{
						n = 4;
						break a
					}
			}
		}
		if ((n | 0) == 4) m = ((ue(c[k >> 2] | 0) | 0) != 0) << 31 >> 31;
		i = b;
		return m | 0
	}

	function sf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0;
		a: do
			if (!(a[b + 44 >> 0] | 0))
				if ((e | 0) > 0) {
					f = d;
					g = 0;
					while (1) {
						if ((Db[c[(c[b >> 2] | 0) + 52 >> 2] & 31](b, c[f >> 2] | 0) | 0) == -1) {
							h = g;
							break a
						}
						i = g + 1 | 0;
						if ((i | 0) < (e | 0)) {
							f = f + 4 | 0;
							g = i
						} else {
							h = i;
							break
						}
					}
				} else h = 0;
		else h = xe(d, 4, e, c[b + 32 >> 2] | 0) | 0;
		while (0);
		return h | 0
	}

	function tf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 16 | 0;
		g = e + 8 | 0;
		h = e + 4 | 0;
		j = e;
		k = (d | 0) == -1;
		a: do
			if (!k) {
				c[g >> 2] = d;
				if (a[b + 44 >> 0] | 0)
					if ((xe(g, 4, 1, c[b + 32 >> 2] | 0) | 0) == 1) {
						l = 11;
						break
					} else {
						m = -1;
						break
					}
				c[h >> 2] = f;
				n = g + 4 | 0;
				o = b + 36 | 0;
				p = b + 40 | 0;
				q = f + 8 | 0;
				r = f;
				s = b + 32 | 0;
				t = g;
				while (1) {
					u = c[o >> 2] | 0;
					v = Ab[c[(c[u >> 2] | 0) + 12 >> 2] & 15](u, c[p >> 2] | 0, t, n, j, f, q, h) | 0;
					if ((c[j >> 2] | 0) == (t | 0)) {
						m = -1;
						break a
					}
					if ((v | 0) == 3) {
						w = t;
						break
					}
					u = (v | 0) == 1;
					if (v >>> 0 >= 2) {
						m = -1;
						break a
					}
					v = (c[h >> 2] | 0) - r | 0;
					if ((xe(f, 1, v, c[s >> 2] | 0) | 0) != (v | 0)) {
						m = -1;
						break a
					}
					if (u) t = u ? c[j >> 2] | 0 : t;
					else {
						l = 11;
						break a
					}
				}
				if ((xe(w, 1, 1, c[s >> 2] | 0) | 0) != 1) m = -1;
				else l = 11
			} else l = 11; while (0);
		if ((l | 0) == 11) m = k ? 0 : d;
		i = e;
		return m | 0
	}

	function uf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		e = Gl(d, 9936) | 0;
		d = b + 36 | 0;
		c[d >> 2] = e;
		f = b + 44 | 0;
		c[f >> 2] = xb[c[(c[e >> 2] | 0) + 24 >> 2] & 63](e) | 0;
		e = c[d >> 2] | 0;
		a[b + 53 >> 0] = (xb[c[(c[e >> 2] | 0) + 28 >> 2] & 63](e) | 0) & 1;
		return
	}

	function vf(a) {
		a = a | 0;
		Dg(a);
		Fc(a);
		return
	}

	function wf(a) {
		a = a | 0;
		return zf(a, 0) | 0
	}

	function xf(a) {
		a = a | 0;
		return zf(a, 1) | 0
	}

	function yf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 16 | 0;
		g = e + 8 | 0;
		h = e + 4 | 0;
		j = e;
		k = b + 52 | 0;
		l = (a[k >> 0] | 0) != 0;
		a: do
			if ((d | 0) == -1)
				if (l) m = -1;
				else {
					n = c[b + 48 >> 2] | 0;
					a[k >> 0] = (n | 0) != -1 & 1;
					m = n
				}
		else {
			n = b + 48 | 0;
			b: do
				if (l) {
					c[h >> 2] = c[n >> 2];
					o = c[b + 36 >> 2] | 0;
					switch (Ab[c[(c[o >> 2] | 0) + 12 >> 2] & 15](o, c[b + 40 >> 2] | 0, h, h + 4 | 0, j, f, f + 8 | 0, g) | 0) {
						case 1:
						case 2:
							{
								m = -1;
								break a;
								break
							}
						case 3:
							{
								a[f >> 0] = c[n >> 2];c[g >> 2] = f + 1;
								break
							}
						default:
							{}
					}
					o = b + 32 | 0;
					while (1) {
						p = c[g >> 2] | 0;
						if (p >>> 0 <= f >>> 0) break b;
						q = p + -1 | 0;
						c[g >> 2] = q;
						if ((Ce(a[q >> 0] | 0, c[o >> 2] | 0) | 0) == -1) {
							m = -1;
							break a
						}
					}
				}
			while (0);
			c[n >> 2] = d;
			a[k >> 0] = 1;
			m = d
		}
		while (0);
		i = e;
		return m | 0
	}

	function zf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 16 | 0;
		g = e + 8 | 0;
		h = e + 4 | 0;
		j = e;
		k = b + 52 | 0;
		a: do
			if (a[k >> 0] | 0) {
				l = b + 48 | 0;
				m = c[l >> 2] | 0;
				if (d) {
					c[l >> 2] = -1;
					a[k >> 0] = 0;
					n = m
				} else n = m
			} else {
				m = c[b + 44 >> 2] | 0;
				l = (m | 0) > 1 ? m : 1;
				m = b + 32 | 0;
				if ((l | 0) > 0) {
					o = 0;
					do {
						p = ye(c[m >> 2] | 0) | 0;
						if ((p | 0) == -1) {
							n = -1;
							break a
						}
						a[f + o >> 0] = p;
						o = o + 1 | 0
					} while ((o | 0) < (l | 0))
				}
				b: do
					if (!(a[b + 53 >> 0] | 0)) {
						o = b + 40 | 0;
						p = b + 36 | 0;
						q = g + 4 | 0;
						r = l;
						c: while (1) {
							s = c[o >> 2] | 0;
							t = s;
							u = c[t >> 2] | 0;
							v = c[t + 4 >> 2] | 0;
							t = c[p >> 2] | 0;
							w = f + r | 0;
							switch (Ab[c[(c[t >> 2] | 0) + 16 >> 2] & 15](t, s, f, w, h, g, q, j) | 0) {
								case 2:
									{
										n = -1;
										break a;
										break
									}
								case 3:
									{
										x = r;
										break c;
										break
									}
								case 1:
									break;
								default:
									{
										y = r;
										break b
									}
							}
							s = c[o >> 2] | 0;
							c[s >> 2] = u;
							c[s + 4 >> 2] = v;
							if ((r | 0) == 8) {
								n = -1;
								break a
							}
							v = ye(c[m >> 2] | 0) | 0;
							if ((v | 0) == -1) {
								n = -1;
								break a
							}
							a[w >> 0] = v;
							r = r + 1 | 0
						}
						c[g >> 2] = a[f >> 0];
						y = x
					} else {
						c[g >> 2] = a[f >> 0];
						y = l
					}
				while (0);
				if (d) {
					l = c[g >> 2] | 0;
					c[b + 48 >> 2] = l;
					n = l;
					break
				} else z = y;
				while (1) {
					if ((z | 0) <= 0) break;
					z = z + -1 | 0;
					if ((Ce(a[f + z >> 0] | 0, c[m >> 2] | 0) | 0) == -1) {
						n = -1;
						break a
					}
				}
				n = c[g >> 2] | 0
			}
		while (0);
		i = e;
		return n | 0
	}

	function Af(a) {
		a = a | 0;
		og(a);
		Fc(a);
		return
	}

	function Bf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0;
		xb[c[(c[b >> 2] | 0) + 24 >> 2] & 63](b) | 0;
		e = Gl(d, 9928) | 0;
		c[b + 36 >> 2] = e;
		a[b + 44 >> 0] = (xb[c[(c[e >> 2] | 0) + 28 >> 2] & 63](e) | 0) & 1;
		return
	}

	function Cf(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		b = i;
		i = i + 16 | 0;
		d = b + 8 | 0;
		e = b;
		f = a + 36 | 0;
		g = a + 40 | 0;
		h = d + 8 | 0;
		j = d;
		k = a + 32 | 0;
		a: while (1) {
			a = c[f >> 2] | 0;
			l = Eb[c[(c[a >> 2] | 0) + 20 >> 2] & 31](a, c[g >> 2] | 0, d, h, e) | 0;
			a = (c[e >> 2] | 0) - j | 0;
			if ((xe(d, 1, a, c[k >> 2] | 0) | 0) != (a | 0)) {
				m = -1;
				break
			}
			switch (l | 0) {
				case 1:
					break;
				case 2:
					{
						m = -1;
						break a;
						break
					}
				default:
					{
						n = 4;
						break a
					}
			}
		}
		if ((n | 0) == 4) m = ((ue(c[k >> 2] | 0) | 0) != 0) << 31 >> 31;
		i = b;
		return m | 0
	}

	function Df(b, e, f) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0;
		a: do
			if (!(a[b + 44 >> 0] | 0))
				if ((f | 0) > 0) {
					g = e;
					h = 0;
					while (1) {
						if ((Db[c[(c[b >> 2] | 0) + 52 >> 2] & 31](b, d[g >> 0] | 0) | 0) == -1) {
							i = h;
							break a
						}
						j = h + 1 | 0;
						if ((j | 0) < (f | 0)) {
							g = g + 1 | 0;
							h = j
						} else {
							i = j;
							break
						}
					}
				} else i = 0;
		else i = xe(e, 1, f, c[b + 32 >> 2] | 0) | 0;
		while (0);
		return i | 0
	}

	function Ef(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 16 | 0;
		g = e + 8 | 0;
		h = e + 4 | 0;
		j = e;
		k = (d | 0) == -1;
		a: do
			if (!k) {
				a[g >> 0] = d;
				if (a[b + 44 >> 0] | 0)
					if ((xe(g, 1, 1, c[b + 32 >> 2] | 0) | 0) == 1) {
						l = 11;
						break
					} else {
						m = -1;
						break
					}
				c[h >> 2] = f;
				n = g + 1 | 0;
				o = b + 36 | 0;
				p = b + 40 | 0;
				q = f + 8 | 0;
				r = f;
				s = b + 32 | 0;
				t = g;
				while (1) {
					u = c[o >> 2] | 0;
					v = Ab[c[(c[u >> 2] | 0) + 12 >> 2] & 15](u, c[p >> 2] | 0, t, n, j, f, q, h) | 0;
					if ((c[j >> 2] | 0) == (t | 0)) {
						m = -1;
						break a
					}
					if ((v | 0) == 3) {
						w = t;
						break
					}
					u = (v | 0) == 1;
					if (v >>> 0 >= 2) {
						m = -1;
						break a
					}
					v = (c[h >> 2] | 0) - r | 0;
					if ((xe(f, 1, v, c[s >> 2] | 0) | 0) != (v | 0)) {
						m = -1;
						break a
					}
					if (u) t = u ? c[j >> 2] | 0 : t;
					else {
						l = 11;
						break a
					}
				}
				if ((xe(w, 1, 1, c[s >> 2] | 0) | 0) != 1) m = -1;
				else l = 11
			} else l = 11; while (0);
		if ((l | 0) == 11) m = k ? 0 : d;
		i = e;
		return m | 0
	}

	function Ff(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		e = Gl(d, 9928) | 0;
		d = b + 36 | 0;
		c[d >> 2] = e;
		f = b + 44 | 0;
		c[f >> 2] = xb[c[(c[e >> 2] | 0) + 24 >> 2] & 63](e) | 0;
		e = c[d >> 2] | 0;
		a[b + 53 >> 0] = (xb[c[(c[e >> 2] | 0) + 28 >> 2] & 63](e) | 0) & 1;
		return
	}

	function Gf(a) {
		a = a | 0;
		og(a);
		Fc(a);
		return
	}

	function Hf(a) {
		a = a | 0;
		return Kf(a, 0) | 0
	}

	function If(a) {
		a = a | 0;
		return Kf(a, 1) | 0
	}

	function Jf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 16 | 0;
		g = e + 4 | 0;
		h = e + 8 | 0;
		j = e;
		k = b + 52 | 0;
		l = (a[k >> 0] | 0) != 0;
		a: do
			if ((d | 0) == -1)
				if (l) m = -1;
				else {
					n = c[b + 48 >> 2] | 0;
					a[k >> 0] = (n | 0) != -1 & 1;
					m = n
				}
		else {
			n = b + 48 | 0;
			b: do
				if (l) {
					a[h >> 0] = c[n >> 2];
					o = c[b + 36 >> 2] | 0;
					switch (Ab[c[(c[o >> 2] | 0) + 12 >> 2] & 15](o, c[b + 40 >> 2] | 0, h, h + 1 | 0, j, f, f + 8 | 0, g) | 0) {
						case 1:
						case 2:
							{
								m = -1;
								break a;
								break
							}
						case 3:
							{
								a[f >> 0] = c[n >> 2];c[g >> 2] = f + 1;
								break
							}
						default:
							{}
					}
					o = b + 32 | 0;
					while (1) {
						p = c[g >> 2] | 0;
						if (p >>> 0 <= f >>> 0) break b;
						q = p + -1 | 0;
						c[g >> 2] = q;
						if ((Ce(a[q >> 0] | 0, c[o >> 2] | 0) | 0) == -1) {
							m = -1;
							break a
						}
					}
				}
			while (0);
			c[n >> 2] = d;
			a[k >> 0] = 1;
			m = d
		}
		while (0);
		i = e;
		return m | 0
	}

	function Kf(b, e) {
		b = b | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0;
		f = i;
		i = i + 32 | 0;
		g = f + 16 | 0;
		h = f + 8 | 0;
		j = f + 4 | 0;
		k = f;
		l = b + 52 | 0;
		a: do
			if (a[l >> 0] | 0) {
				m = b + 48 | 0;
				n = c[m >> 2] | 0;
				if (e) {
					c[m >> 2] = -1;
					a[l >> 0] = 0;
					o = n
				} else o = n
			} else {
				n = c[b + 44 >> 2] | 0;
				m = (n | 0) > 1 ? n : 1;
				n = b + 32 | 0;
				if ((m | 0) > 0) {
					p = 0;
					do {
						q = ye(c[n >> 2] | 0) | 0;
						if ((q | 0) == -1) {
							o = -1;
							break a
						}
						a[g + p >> 0] = q;
						p = p + 1 | 0
					} while ((p | 0) < (m | 0))
				}
				b: do
					if (!(a[b + 53 >> 0] | 0)) {
						p = b + 40 | 0;
						q = b + 36 | 0;
						r = h + 1 | 0;
						s = m;
						c: while (1) {
							t = c[p >> 2] | 0;
							u = t;
							v = c[u >> 2] | 0;
							w = c[u + 4 >> 2] | 0;
							u = c[q >> 2] | 0;
							x = g + s | 0;
							switch (Ab[c[(c[u >> 2] | 0) + 16 >> 2] & 15](u, t, g, x, j, h, r, k) | 0) {
								case 2:
									{
										o = -1;
										break a;
										break
									}
								case 3:
									{
										y = s;
										break c;
										break
									}
								case 1:
									break;
								default:
									{
										z = s;
										break b
									}
							}
							t = c[p >> 2] | 0;
							c[t >> 2] = v;
							c[t + 4 >> 2] = w;
							if ((s | 0) == 8) {
								o = -1;
								break a
							}
							w = ye(c[n >> 2] | 0) | 0;
							if ((w | 0) == -1) {
								o = -1;
								break a
							}
							a[x >> 0] = w;
							s = s + 1 | 0
						}
						a[h >> 0] = a[g >> 0] | 0;
						z = y
					} else {
						a[h >> 0] = a[g >> 0] | 0;
						z = m
					}
				while (0);
				if (e) {
					m = a[h >> 0] | 0;
					c[b + 48 >> 2] = m & 255;
					A = m
				} else {
					m = z;
					while (1) {
						if ((m | 0) <= 0) break;
						m = m + -1 | 0;
						if ((Ce(d[g + m >> 0] | 0, c[n >> 2] | 0) | 0) == -1) {
							o = -1;
							break a
						}
					}
					A = a[h >> 0] | 0
				}
				o = A & 255
			}
		while (0);
		i = f;
		return o | 0
	}

	function Lf(b, d) {
		b = b | 0;
		d = d | 0;
		if (!(a[d >> 0] & 1)) {
			c[b >> 2] = c[d >> 2];
			c[b + 4 >> 2] = c[d + 4 >> 2];
			c[b + 8 >> 2] = c[d + 8 >> 2]
		} else Mf(b, c[d + 8 >> 2] | 0, c[d + 4 >> 2] | 0);
		return
	}

	function Mf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		if (e >>> 0 > 4294967279) Ac(b);
		if (e >>> 0 < 11) {
			a[b >> 0] = e << 1;
			f = b + 1 | 0
		} else {
			g = e + 16 & -16;
			h = Dc(g) | 0;
			c[b + 8 >> 2] = h;
			c[b >> 2] = g | 1;
			c[b + 4 >> 2] = e;
			f = h
		}
		lp(f | 0, d | 0, e | 0) | 0;
		a[f + e >> 0] = 0;
		return
	}

	function Nf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		if (d >>> 0 > 4294967279) Ac(b);
		if (d >>> 0 < 11) {
			a[b >> 0] = d << 1;
			f = b + 1 | 0
		} else {
			g = d + 16 & -16;
			h = Dc(g) | 0;
			c[b + 8 >> 2] = h;
			c[b >> 2] = g | 1;
			c[b + 4 >> 2] = d;
			f = h
		}
		ip(f | 0, e | 0, d | 0) | 0;
		a[f + d >> 0] = 0;
		return
	}

	function Of(b) {
		b = b | 0;
		if (a[b >> 0] & 1) Fc(c[b + 8 >> 2] | 0);
		return
	}

	function Pf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		if ((b | 0) != (d | 0)) {
			e = a[d >> 0] | 0;
			f = (e & 1) == 0;
			Rf(b, f ? d + 1 | 0 : c[d + 8 >> 2] | 0, f ? (e & 255) >>> 1 : c[d + 4 >> 2] | 0) | 0
		}
		return b | 0
	}

	function Qf(a, b) {
		a = a | 0;
		b = b | 0;
		return Rf(a, b, Pe(b) | 0) | 0
	}

	function Rf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		f = a[b >> 0] | 0;
		if (!(f & 1)) {
			g = 10;
			h = f
		} else {
			f = c[b >> 2] | 0;
			g = (f & -2) + -1 | 0;
			h = f & 255
		}
		f = (h & 1) == 0;
		do
			if (g >>> 0 >= e >>> 0) {
				if (f) i = b + 1 | 0;
				else i = c[b + 8 >> 2] | 0;
				np(i | 0, d | 0, e | 0) | 0;
				a[i + e >> 0] = 0;
				if (!(a[b >> 0] & 1)) {
					a[b >> 0] = e << 1;
					break
				} else {
					c[b + 4 >> 2] = e;
					break
				}
			} else {
				if (f) j = (h & 255) >>> 1;
				else j = c[b + 4 >> 2] | 0;
				Wf(b, g, e - g | 0, j, 0, j, e, d)
			}
		while (0);
		return b | 0
	}

	function Sf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = a[b >> 0] | 0;
		g = (f & 1) == 0;
		if (g) h = (f & 255) >>> 1;
		else h = c[b + 4 >> 2] | 0;
		do
			if (h >>> 0 >= d >>> 0)
				if (g) {
					a[b + 1 + d >> 0] = 0;
					a[b >> 0] = d << 1;
					break
				} else {
					a[(c[b + 8 >> 2] | 0) + d >> 0] = 0;
					c[b + 4 >> 2] = d;
					break
				}
		else Tf(b, d - h | 0, e) | 0; while (0);
		return
	}

	function Tf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		if (d) {
			f = a[b >> 0] | 0;
			if (!(f & 1)) {
				g = 10;
				h = f
			} else {
				f = c[b >> 2] | 0;
				g = (f & -2) + -1 | 0;
				h = f & 255
			}
			if (!(h & 1)) i = (h & 255) >>> 1;
			else i = c[b + 4 >> 2] | 0;
			if ((g - i | 0) >>> 0 < d >>> 0) {
				Xf(b, g, d - g + i | 0, i, i, 0, 0);
				j = a[b >> 0] | 0
			} else j = h;
			if (!(j & 1)) k = b + 1 | 0;
			else k = c[b + 8 >> 2] | 0;
			ip(k + i | 0, e | 0, d | 0) | 0;
			e = i + d | 0;
			if (!(a[b >> 0] & 1)) a[b >> 0] = e << 1;
			else c[b + 4 >> 2] = e;
			a[k + e >> 0] = 0
		}
		return b | 0
	}

	function Uf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		if (d >>> 0 > 4294967279) Ac(b);
		e = a[b >> 0] | 0;
		if (!(e & 1)) {
			f = 10;
			g = e
		} else {
			e = c[b >> 2] | 0;
			f = (e & -2) + -1 | 0;
			g = e & 255
		}
		if (!(g & 1)) h = (g & 255) >>> 1;
		else h = c[b + 4 >> 2] | 0;
		e = h >>> 0 > d >>> 0 ? h : d;
		if (e >>> 0 < 11) i = 10;
		else i = (e + 16 & -16) + -1 | 0;
		do
			if ((i | 0) != (f | 0)) {
				do
					if ((i | 0) != 10) {
						e = Dc(i + 1 | 0) | 0;
						if (!(g & 1)) {
							j = e;
							k = 1;
							l = b + 1 | 0;
							m = 0;
							break
						} else {
							j = e;
							k = 1;
							l = c[b + 8 >> 2] | 0;
							m = 1;
							break
						}
					} else {
						j = b + 1 | 0;
						k = 0;
						l = c[b + 8 >> 2] | 0;
						m = 1
					}
				while (0);
				if (!(g & 1)) n = (g & 255) >>> 1;
				else n = c[b + 4 >> 2] | 0;
				lp(j | 0, l | 0, n + 1 | 0) | 0;
				if (m) Fc(l);
				if (k) {
					c[b >> 2] = i + 1 | 1;
					c[b + 4 >> 2] = h;
					c[b + 8 >> 2] = j;
					break
				} else {
					a[b >> 0] = h << 1;
					break
				}
			}
		while (0);
		return
	}

	function Vf(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a[b >> 0] | 0;
		f = (e & 1) != 0;
		if (f) {
			g = (c[b >> 2] & -2) + -1 | 0;
			h = c[b + 4 >> 2] | 0
		} else {
			g = 10;
			h = (e & 255) >>> 1
		}
		if ((h | 0) == (g | 0)) {
			Xf(b, g, 1, g, g, 0, 0);
			if (!(a[b >> 0] & 1)) i = 7;
			else i = 8
		} else if (f) i = 8;
		else i = 7;
		if ((i | 0) == 7) {
			a[b >> 0] = (h << 1) + 2;
			j = b + 1 | 0;
			k = h + 1 | 0
		} else if ((i | 0) == 8) {
			i = c[b + 8 >> 2] | 0;
			f = h + 1 | 0;
			c[b + 4 >> 2] = f;
			j = i;
			k = f
		}
		a[j + h >> 0] = d;
		a[j + k >> 0] = 0;
		return
	}

	function Wf(b, d, e, f, g, h, i, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0;
		if ((-18 - d | 0) >>> 0 < e >>> 0) Ac(b);
		if (!(a[b >> 0] & 1)) k = b + 1 | 0;
		else k = c[b + 8 >> 2] | 0;
		if (d >>> 0 < 2147483623) {
			l = e + d | 0;
			e = d << 1;
			m = l >>> 0 < e >>> 0 ? e : l;
			n = m >>> 0 < 11 ? 11 : m + 16 & -16
		} else n = -17;
		m = Dc(n) | 0;
		if (g) lp(m | 0, k | 0, g | 0) | 0;
		if (i) lp(m + g | 0, j | 0, i | 0) | 0;
		j = f - h | 0;
		if ((j | 0) != (g | 0)) lp(m + (i + g) | 0, k + (h + g) | 0, j - g | 0) | 0;
		if ((d | 0) != 10) Fc(k);
		c[b + 8 >> 2] = m;
		c[b >> 2] = n | 1;
		n = j + i | 0;
		c[b + 4 >> 2] = n;
		a[m + n >> 0] = 0;
		return
	}

	function Xf(b, d, e, f, g, h, i) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0;
		if ((-17 - d | 0) >>> 0 < e >>> 0) Ac(b);
		if (!(a[b >> 0] & 1)) j = b + 1 | 0;
		else j = c[b + 8 >> 2] | 0;
		if (d >>> 0 < 2147483623) {
			k = e + d | 0;
			e = d << 1;
			l = k >>> 0 < e >>> 0 ? e : k;
			m = l >>> 0 < 11 ? 11 : l + 16 & -16
		} else m = -17;
		l = Dc(m) | 0;
		if (g) lp(l | 0, j | 0, g | 0) | 0;
		k = f - h | 0;
		if ((k | 0) != (g | 0)) lp(l + (i + g) | 0, j + (h + g) | 0, k - g | 0) | 0;
		if ((d | 0) != 10) Fc(j);
		c[b + 8 >> 2] = l;
		c[b >> 2] = m | 1;
		return
	}

	function Yf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		if (e >>> 0 > 1073741807) Ac(b);
		if (e >>> 0 < 2) {
			a[b >> 0] = e << 1;
			f = b + 4 | 0
		} else {
			g = e + 4 & -4;
			h = Dc(g << 2) | 0;
			c[b + 8 >> 2] = h;
			c[b >> 2] = g | 1;
			c[b + 4 >> 2] = e;
			f = h
		}
		Re(f, d, e) | 0;
		c[f + (e << 2) >> 2] = 0;
		return
	}

	function Zf(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		if (d >>> 0 > 1073741807) Ac(b);
		if (d >>> 0 < 2) {
			a[b >> 0] = d << 1;
			f = b + 4 | 0
		} else {
			g = d + 4 & -4;
			h = Dc(g << 2) | 0;
			c[b + 8 >> 2] = h;
			c[b >> 2] = g | 1;
			c[b + 4 >> 2] = d;
			f = h
		}
		Te(f, e, d) | 0;
		c[f + (d << 2) >> 2] = 0;
		return
	}

	function _f(b) {
		b = b | 0;
		if (a[b >> 0] & 1) Fc(c[b + 8 >> 2] | 0);
		return
	}

	function $f(a, b) {
		a = a | 0;
		b = b | 0;
		return ag(a, b, Qe(b) | 0) | 0
	}

	function ag(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		f = a[b >> 0] | 0;
		if (!(f & 1)) {
			g = 1;
			h = f
		} else {
			f = c[b >> 2] | 0;
			g = (f & -2) + -1 | 0;
			h = f & 255
		}
		f = (h & 1) == 0;
		do
			if (g >>> 0 >= e >>> 0) {
				if (f) i = b + 4 | 0;
				else i = c[b + 8 >> 2] | 0;
				Se(i, d, e) | 0;
				c[i + (e << 2) >> 2] = 0;
				if (!(a[b >> 0] & 1)) {
					a[b >> 0] = e << 1;
					break
				} else {
					c[b + 4 >> 2] = e;
					break
				}
			} else {
				if (f) j = (h & 255) >>> 1;
				else j = c[b + 4 >> 2] | 0;
				dg(b, g, e - g | 0, j, 0, j, e, d)
			}
		while (0);
		return b | 0
	}

	function bg(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		if (d >>> 0 > 1073741807) Ac(b);
		e = a[b >> 0] | 0;
		if (!(e & 1)) {
			f = 1;
			g = e
		} else {
			e = c[b >> 2] | 0;
			f = (e & -2) + -1 | 0;
			g = e & 255
		}
		if (!(g & 1)) h = (g & 255) >>> 1;
		else h = c[b + 4 >> 2] | 0;
		e = h >>> 0 > d >>> 0 ? h : d;
		if (e >>> 0 < 2) i = 1;
		else i = (e + 4 & -4) + -1 | 0;
		do
			if ((i | 0) != (f | 0)) {
				do
					if ((i | 0) != 1) {
						e = Dc((i << 2) + 4 | 0) | 0;
						if (!(g & 1)) {
							j = e;
							k = 1;
							l = b + 4 | 0;
							m = 0;
							break
						} else {
							j = e;
							k = 1;
							l = c[b + 8 >> 2] | 0;
							m = 1;
							break
						}
					} else {
						j = b + 4 | 0;
						k = 0;
						l = c[b + 8 >> 2] | 0;
						m = 1
					}
				while (0);
				if (!(g & 1)) n = (g & 255) >>> 1;
				else n = c[b + 4 >> 2] | 0;
				Re(j, l, n + 1 | 0) | 0;
				if (m) Fc(l);
				if (k) {
					c[b >> 2] = i + 1 | 1;
					c[b + 4 >> 2] = h;
					c[b + 8 >> 2] = j;
					break
				} else {
					a[b >> 0] = h << 1;
					break
				}
			}
		while (0);
		return
	}

	function cg(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a[b >> 0] | 0;
		f = (e & 1) != 0;
		if (f) {
			g = (c[b >> 2] & -2) + -1 | 0;
			h = c[b + 4 >> 2] | 0
		} else {
			g = 1;
			h = (e & 255) >>> 1
		}
		if ((h | 0) == (g | 0)) {
			eg(b, g, 1, g, g, 0, 0);
			if (!(a[b >> 0] & 1)) i = 7;
			else i = 8
		} else if (f) i = 8;
		else i = 7;
		if ((i | 0) == 7) {
			a[b >> 0] = (h << 1) + 2;
			j = b + 4 | 0;
			k = h + 1 | 0
		} else if ((i | 0) == 8) {
			i = c[b + 8 >> 2] | 0;
			f = h + 1 | 0;
			c[b + 4 >> 2] = f;
			j = i;
			k = f
		}
		c[j + (h << 2) >> 2] = d;
		c[j + (k << 2) >> 2] = 0;
		return
	}

	function dg(b, d, e, f, g, h, i, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0;
		if ((1073741806 - d | 0) >>> 0 < e >>> 0) Ac(b);
		if (!(a[b >> 0] & 1)) k = b + 4 | 0;
		else k = c[b + 8 >> 2] | 0;
		if (d >>> 0 < 536870887) {
			l = e + d | 0;
			e = d << 1;
			m = l >>> 0 < e >>> 0 ? e : l;
			n = m >>> 0 < 2 ? 2 : m + 4 & -4
		} else n = 1073741807;
		m = Dc(n << 2) | 0;
		if (g) Re(m, k, g) | 0;
		if (i) Re(m + (g << 2) | 0, j, i) | 0;
		j = f - h | 0;
		if ((j | 0) != (g | 0)) Re(m + (i + g << 2) | 0, k + (h + g << 2) | 0, j - g | 0) | 0;
		if ((d | 0) != 1) Fc(k);
		c[b + 8 >> 2] = m;
		c[b >> 2] = n | 1;
		n = j + i | 0;
		c[b + 4 >> 2] = n;
		c[m + (n << 2) >> 2] = 0;
		return
	}

	function eg(b, d, e, f, g, h, i) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0;
		if ((1073741807 - d | 0) >>> 0 < e >>> 0) Ac(b);
		if (!(a[b >> 0] & 1)) j = b + 4 | 0;
		else j = c[b + 8 >> 2] | 0;
		if (d >>> 0 < 536870887) {
			k = e + d | 0;
			e = d << 1;
			l = k >>> 0 < e >>> 0 ? e : k;
			m = l >>> 0 < 2 ? 2 : l + 4 & -4
		} else m = 1073741807;
		l = Dc(m << 2) | 0;
		if (g) Re(l, j, g) | 0;
		k = f - h | 0;
		if ((k | 0) != (g | 0)) Re(l + (i + g << 2) | 0, j + (h + g << 2) | 0, k - g | 0) | 0;
		if ((d | 0) != 1) Fc(j);
		c[b + 8 >> 2] = l;
		c[b >> 2] = m | 1;
		return
	}

	function fg(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		f = d;
		g = e - f | 0;
		if (g >>> 0 > 4294967279) Ac(b);
		if (g >>> 0 < 11) {
			a[b >> 0] = g << 1;
			h = b + 1 | 0
		} else {
			i = g + 16 & -16;
			j = Dc(i) | 0;
			c[b + 8 >> 2] = j;
			c[b >> 2] = i | 1;
			c[b + 4 >> 2] = g;
			h = j
		}
		j = e - f | 0;
		if ((d | 0) != (e | 0)) {
			f = d;
			d = h;
			while (1) {
				a[d >> 0] = a[f >> 0] | 0;
				f = f + 1 | 0;
				if ((f | 0) == (e | 0)) break;
				else d = d + 1 | 0
			}
		}
		a[h + j >> 0] = 0;
		return
	}

	function gg(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		f = d;
		g = e - f | 0;
		h = g >> 2;
		if (h >>> 0 > 1073741807) Ac(b);
		if (h >>> 0 < 2) {
			a[b >> 0] = g >>> 1;
			i = b + 4 | 0
		} else {
			g = h + 4 & -4;
			j = Dc(g << 2) | 0;
			c[b + 8 >> 2] = j;
			c[b >> 2] = g | 1;
			c[b + 4 >> 2] = h;
			i = j
		}
		j = (e - f | 0) >>> 2;
		if ((d | 0) != (e | 0)) {
			f = d;
			d = i;
			while (1) {
				c[d >> 2] = c[f >> 2];
				f = f + 4 | 0;
				if ((f | 0) == (e | 0)) break;
				else d = d + 4 | 0
			}
		}
		c[i + (j << 2) >> 2] = 0;
		return
	}

	function hg(a, b) {
		a = a | 0;
		b = b | 0;
		c[a + 16 >> 2] = (c[a + 24 >> 2] | 0) == 0 | b;
		return
	}

	function ig(a) {
		a = a | 0;
		jg(a);
		return
	}

	function jg(a) {
		a = a | 0;
		c[a >> 2] = 8756;
		lg(a, 0);
		El(a + 28 | 0);
		rd(c[a + 32 >> 2] | 0);
		rd(c[a + 36 >> 2] | 0);
		rd(c[a + 48 >> 2] | 0);
		rd(c[a + 60 >> 2] | 0);
		return
	}

	function kg(a) {
		a = a | 0;
		jg(a);
		Fc(a);
		return
	}

	function lg(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0;
		d = c[a + 40 >> 2] | 0;
		e = a + 32 | 0;
		f = a + 36 | 0;
		if (d) {
			g = d;
			do {
				g = g + -1 | 0;
				yb[c[(c[e >> 2] | 0) + (g << 2) >> 2] & 0](b, a, c[(c[f >> 2] | 0) + (g << 2) >> 2] | 0)
			} while ((g | 0) != 0)
		}
		return
	}

	function mg(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = i;
		i = i + 16 | 0;
		d = b;
		Dl(d, a + 28 | 0);
		i = b;
		return c[d >> 2] | 0
	}

	function ng(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		c[a + 24 >> 2] = b;
		c[a + 16 >> 2] = (b | 0) == 0 & 1;
		c[a + 20 >> 2] = 0;
		c[a + 4 >> 2] = 4098;
		c[a + 12 >> 2] = 0;
		c[a + 8 >> 2] = 6;
		b = a + 28 | 0;
		d = a + 32 | 0;
		a = d + 40 | 0;
		do {
			c[d >> 2] = 0;
			d = d + 4 | 0
		} while ((d | 0) < (a | 0));
		Cl(b);
		return
	}

	function og(a) {
		a = a | 0;
		c[a >> 2] = 8468;
		El(a + 4 | 0);
		return
	}

	function pg(a) {
		a = a | 0;
		c[a >> 2] = 8468;
		El(a + 4 | 0);
		Fc(a);
		return
	}

	function qg(a) {
		a = a | 0;
		var b = 0;
		c[a >> 2] = 8468;
		Cl(a + 4 | 0);
		b = a + 8 | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		c[b + 12 >> 2] = 0;
		c[b + 16 >> 2] = 0;
		c[b + 20 >> 2] = 0;
		return
	}

	function rg(a, b) {
		a = a | 0;
		b = b | 0;
		return
	}

	function sg(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return a | 0
	}

	function tg(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		g = a;
		c[g >> 2] = 0;
		c[g + 4 >> 2] = 0;
		g = a + 8 | 0;
		c[g >> 2] = -1;
		c[g + 4 >> 2] = -1;
		return
	}

	function ug(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		e = a;
		c[e >> 2] = 0;
		c[e + 4 >> 2] = 0;
		e = a + 8 | 0;
		c[e >> 2] = -1;
		c[e + 4 >> 2] = -1;
		return
	}

	function vg(a) {
		a = a | 0;
		return 0
	}

	function wg(a) {
		a = a | 0;
		return 0
	}

	function xg(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0;
		f = b + 12 | 0;
		g = b + 16 | 0;
		a: do
			if ((e | 0) > 0) {
				h = d;
				i = 0;
				while (1) {
					j = c[f >> 2] | 0;
					if (j >>> 0 < (c[g >> 2] | 0) >>> 0) {
						c[f >> 2] = j + 1;
						k = a[j >> 0] | 0
					} else {
						j = xb[c[(c[b >> 2] | 0) + 40 >> 2] & 63](b) | 0;
						if ((j | 0) == -1) {
							l = i;
							break a
						}
						k = j & 255
					}
					a[h >> 0] = k;
					j = i + 1 | 0;
					if ((j | 0) < (e | 0)) {
						h = h + 1 | 0;
						i = j
					} else {
						l = j;
						break
					}
				}
			} else l = 0; while (0);
		return l | 0
	}

	function yg(a) {
		a = a | 0;
		return -1
	}

	function zg(a) {
		a = a | 0;
		var b = 0,
			e = 0;
		if ((xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0) == -1) b = -1;
		else {
			e = a + 12 | 0;
			a = c[e >> 2] | 0;
			c[e >> 2] = a + 1;
			b = d[a >> 0] | 0
		}
		return b | 0
	}

	function Ag(a, b) {
		a = a | 0;
		b = b | 0;
		return -1
	}

	function Bg(b, e, f) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		g = b + 24 | 0;
		h = b + 28 | 0;
		a: do
			if ((f | 0) > 0) {
				i = e;
				j = 0;
				while (1) {
					k = c[g >> 2] | 0;
					if (k >>> 0 >= (c[h >> 2] | 0) >>> 0) {
						if ((Db[c[(c[b >> 2] | 0) + 52 >> 2] & 31](b, d[i >> 0] | 0) | 0) == -1) {
							l = j;
							break a
						}
					} else {
						m = a[i >> 0] | 0;
						c[g >> 2] = k + 1;
						a[k >> 0] = m
					}
					m = j + 1 | 0;
					if ((m | 0) < (f | 0)) {
						i = i + 1 | 0;
						j = m
					} else {
						l = m;
						break
					}
				}
			} else l = 0; while (0);
		return l | 0
	}

	function Cg(a, b) {
		a = a | 0;
		b = b | 0;
		return -1
	}

	function Dg(a) {
		a = a | 0;
		c[a >> 2] = 8532;
		El(a + 4 | 0);
		return
	}

	function Eg(a) {
		a = a | 0;
		c[a >> 2] = 8532;
		El(a + 4 | 0);
		Fc(a);
		return
	}

	function Fg(a) {
		a = a | 0;
		var b = 0;
		c[a >> 2] = 8532;
		Cl(a + 4 | 0);
		b = a + 8 | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		c[b + 12 >> 2] = 0;
		c[b + 16 >> 2] = 0;
		c[b + 20 >> 2] = 0;
		return
	}

	function Gg(a, b) {
		a = a | 0;
		b = b | 0;
		return
	}

	function Hg(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return a | 0
	}

	function Ig(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		g = a;
		c[g >> 2] = 0;
		c[g + 4 >> 2] = 0;
		g = a + 8 | 0;
		c[g >> 2] = -1;
		c[g + 4 >> 2] = -1;
		return
	}

	function Jg(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		e = a;
		c[e >> 2] = 0;
		c[e + 4 >> 2] = 0;
		e = a + 8 | 0;
		c[e >> 2] = -1;
		c[e + 4 >> 2] = -1;
		return
	}

	function Kg(a) {
		a = a | 0;
		return 0
	}

	function Lg(a) {
		a = a | 0;
		return 0
	}

	function Mg(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0;
		e = a + 12 | 0;
		f = a + 16 | 0;
		a: do
			if ((d | 0) > 0) {
				g = b;
				h = 0;
				while (1) {
					i = c[e >> 2] | 0;
					if (i >>> 0 >= (c[f >> 2] | 0) >>> 0) {
						j = xb[c[(c[a >> 2] | 0) + 40 >> 2] & 63](a) | 0;
						if ((j | 0) == -1) {
							k = h;
							break a
						} else l = j
					} else {
						c[e >> 2] = i + 4;
						l = c[i >> 2] | 0
					}
					c[g >> 2] = l;
					i = h + 1 | 0;
					if ((i | 0) < (d | 0)) {
						g = g + 4 | 0;
						h = i
					} else {
						k = i;
						break
					}
				}
			} else k = 0; while (0);
		return k | 0
	}

	function Ng(a) {
		a = a | 0;
		return -1
	}

	function Og(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		if ((xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0) == -1) b = -1;
		else {
			d = a + 12 | 0;
			a = c[d >> 2] | 0;
			c[d >> 2] = a + 4;
			b = c[a >> 2] | 0
		}
		return b | 0
	}

	function Pg(a, b) {
		a = a | 0;
		b = b | 0;
		return -1
	}

	function Qg(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a + 24 | 0;
		f = a + 28 | 0;
		a: do
			if ((d | 0) > 0) {
				g = b;
				h = 0;
				while (1) {
					i = c[e >> 2] | 0;
					if (i >>> 0 >= (c[f >> 2] | 0) >>> 0) {
						if ((Db[c[(c[a >> 2] | 0) + 52 >> 2] & 31](a, c[g >> 2] | 0) | 0) == -1) {
							j = h;
							break a
						}
					} else {
						k = c[g >> 2] | 0;
						c[e >> 2] = i + 4;
						c[i >> 2] = k
					}
					k = h + 1 | 0;
					if ((k | 0) < (d | 0)) {
						g = g + 4 | 0;
						h = k
					} else {
						j = k;
						break
					}
				}
			} else j = 0; while (0);
		return j | 0
	}

	function Rg(a, b) {
		a = a | 0;
		b = b | 0;
		return -1
	}

	function Sg(a) {
		a = a | 0;
		jg(a + 8 | 0);
		return
	}

	function Tg(a) {
		a = a | 0;
		jg(a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 8) | 0);
		return
	}

	function Ug(a) {
		a = a | 0;
		jg(a + 8 | 0);
		Fc(a);
		return
	}

	function Vg(a) {
		a = a | 0;
		Ug(a + (c[(c[a >> 2] | 0) + -12 >> 2] | 0) | 0);
		return
	}

	function Wg(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0;
		d = i;
		i = i + 16 | 0;
		e = d;
		if (c[b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0) {
			eh(e, b);
			if ((a[e >> 0] | 0) != 0 ? (f = c[b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0, (xb[c[(c[f >> 2] | 0) + 24 >> 2] & 63](f) | 0) == -1) : 0) {
				f = b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
				c[f >> 2] = c[f >> 2] | 1
			}
			fh(e)
		}
		i = d;
		return b | 0
	}

	function Xg(a) {
		a = a | 0;
		jg(a + 8 | 0);
		return
	}

	function Yg(a) {
		a = a | 0;
		jg(a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 8) | 0);
		return
	}

	function Zg(a) {
		a = a | 0;
		jg(a + 8 | 0);
		Fc(a);
		return
	}

	function _g(a) {
		a = a | 0;
		Zg(a + (c[(c[a >> 2] | 0) + -12 >> 2] | 0) | 0);
		return
	}

	function $g(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0;
		d = i;
		i = i + 16 | 0;
		e = d;
		if (c[b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0) {
			mh(e, b);
			if ((a[e >> 0] | 0) != 0 ? (f = c[b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0, (xb[c[(c[f >> 2] | 0) + 24 >> 2] & 63](f) | 0) == -1) : 0) {
				f = b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
				c[f >> 2] = c[f >> 2] | 1
			}
			nh(e)
		}
		i = d;
		return b | 0
	}

	function ah(a) {
		a = a | 0;
		jg(a + 4 | 0);
		return
	}

	function bh(a) {
		a = a | 0;
		jg(a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 4) | 0);
		return
	}

	function ch(a) {
		a = a | 0;
		jg(a + 4 | 0);
		Fc(a);
		return
	}

	function dh(a) {
		a = a | 0;
		ch(a + (c[(c[a >> 2] | 0) + -12 >> 2] | 0) | 0);
		return
	}

	function eh(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		a[b >> 0] = 0;
		c[b + 4 >> 2] = d;
		e = c[(c[d >> 2] | 0) + -12 >> 2] | 0;
		if (!(c[d + (e + 16) >> 2] | 0)) {
			f = c[d + (e + 72) >> 2] | 0;
			if (f) Wg(f) | 0;
			a[b >> 0] = 1
		}
		return
	}

	function fh(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = a + 4 | 0;
		a = c[b >> 2] | 0;
		d = c[(c[a >> 2] | 0) + -12 >> 2] | 0;
		if (((((c[a + (d + 24) >> 2] | 0) != 0 ? (c[a + (d + 16) >> 2] | 0) == 0 : 0) ? (c[a + (d + 4) >> 2] & 8192 | 0) != 0 : 0) ? !(Fa() | 0) : 0) ? (d = c[b >> 2] | 0, a = c[d + ((c[(c[d >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0, (xb[c[(c[a >> 2] | 0) + 24 >> 2] & 63](a) | 0) == -1) : 0) {
			a = c[b >> 2] | 0;
			b = a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
			c[b >> 2] = c[b >> 2] | 1
		}
		return
	}

	function gh(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		e = i;
		i = i + 32 | 0;
		f = e + 20 | 0;
		g = e + 16 | 0;
		h = e + 8 | 0;
		j = e;
		eh(h, b);
		if (a[h >> 0] | 0) {
			c[j >> 2] = mg(b + (c[(c[b >> 2] | 0) + -12 >> 2] | 0) | 0) | 0;
			k = Gl(j, 9040) | 0;
			El(j);
			j = c[(c[b >> 2] | 0) + -12 >> 2] | 0;
			l = c[b + (j + 24) >> 2] | 0;
			m = b + j | 0;
			n = b + (j + 76) | 0;
			j = c[n >> 2] | 0;
			if ((j | 0) == -1) {
				c[f >> 2] = mg(m) | 0;
				o = Gl(f, 9868) | 0;
				p = Db[c[(c[o >> 2] | 0) + 28 >> 2] & 31](o, 32) | 0;
				El(f);
				o = p << 24 >> 24;
				c[n >> 2] = o;
				q = o
			} else q = j;
			j = c[(c[k >> 2] | 0) + 16 >> 2] | 0;
			c[g >> 2] = l;
			c[f >> 2] = c[g >> 2];
			if (!(Eb[j & 31](k, f, m, q & 255, d) | 0)) {
				d = b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
				c[d >> 2] = c[d >> 2] | 5
			}
		}
		fh(h);
		i = e;
		return b | 0
	}

	function hh(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		eh(f, b);
		a: do
			if (a[f >> 0] | 0) {
				g = c[b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0;
				h = g;
				do
					if (g) {
						j = h + 24 | 0;
						k = c[j >> 2] | 0;
						if ((k | 0) == (c[h + 28 >> 2] | 0))
							if ((Db[c[(c[g >> 2] | 0) + 52 >> 2] & 31](h, d & 255) | 0) == -1) break;
							else break a;
						else {
							c[j >> 2] = k + 1;
							a[k >> 0] = d;
							break a
						}
					}
				while (0);
				h = b + ((c[(c[b >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
				c[h >> 2] = c[h >> 2] | 1
			}
		while (0);
		fh(f);
		i = e;
		return b | 0
	}

	function ih(a) {
		a = a | 0;
		jg(a + 4 | 0);
		return
	}

	function jh(a) {
		a = a | 0;
		jg(a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 4) | 0);
		return
	}

	function kh(a) {
		a = a | 0;
		jg(a + 4 | 0);
		Fc(a);
		return
	}

	function lh(a) {
		a = a | 0;
		kh(a + (c[(c[a >> 2] | 0) + -12 >> 2] | 0) | 0);
		return
	}

	function mh(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		a[b >> 0] = 0;
		c[b + 4 >> 2] = d;
		e = c[(c[d >> 2] | 0) + -12 >> 2] | 0;
		if (!(c[d + (e + 16) >> 2] | 0)) {
			f = c[d + (e + 72) >> 2] | 0;
			if (f) $g(f) | 0;
			a[b >> 0] = 1
		}
		return
	}

	function nh(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = a + 4 | 0;
		a = c[b >> 2] | 0;
		d = c[(c[a >> 2] | 0) + -12 >> 2] | 0;
		if (((((c[a + (d + 24) >> 2] | 0) != 0 ? (c[a + (d + 16) >> 2] | 0) == 0 : 0) ? (c[a + (d + 4) >> 2] & 8192 | 0) != 0 : 0) ? !(Fa() | 0) : 0) ? (d = c[b >> 2] | 0, a = c[d + ((c[(c[d >> 2] | 0) + -12 >> 2] | 0) + 24) >> 2] | 0, (xb[c[(c[a >> 2] | 0) + 24 >> 2] & 63](a) | 0) == -1) : 0) {
			a = c[b >> 2] | 0;
			b = a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 16) | 0;
			c[b >> 2] = c[b >> 2] | 1
		}
		return
	}

	function oh(a, b) {
		a = a | 0;
		b = b | 0;
		return
	}

	function ph(a) {
		a = a | 0;
		jg(a + 12 | 0);
		return
	}

	function qh(a) {
		a = a | 0;
		jg(a + -8 + 12 | 0);
		return
	}

	function rh(a) {
		a = a | 0;
		jg(a + ((c[(c[a >> 2] | 0) + -12 >> 2] | 0) + 12) | 0);
		return
	}

	function sh(a) {
		a = a | 0;
		jg(a + 12 | 0);
		Fc(a);
		return
	}

	function th(a) {
		a = a | 0;
		sh(a + -8 | 0);
		return
	}

	function uh(a) {
		a = a | 0;
		sh(a + (c[(c[a >> 2] | 0) + -12 >> 2] | 0) | 0);
		return
	}

	function vh(a) {
		a = a | 0;
		jg(a);
		Fc(a);
		return
	}

	function wh(a) {
		a = a | 0;
		var b = 0;
		b = a + 16 | 0;
		c[b >> 2] = c[b >> 2] | 1;
		return
	}

	function xh(a) {
		a = a | 0;
		return
	}

	function yh(a) {
		a = a | 0;
		return
	}

	function zh(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Ah(b, c, d, e, f) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0;
		a: do
			if ((e | 0) == (f | 0)) {
				g = c;
				h = 6
			} else {
				b = e;
				i = c;
				while (1) {
					if ((i | 0) == (d | 0)) {
						j = -1;
						break a
					}
					k = a[i >> 0] | 0;
					l = a[b >> 0] | 0;
					if (k << 24 >> 24 < l << 24 >> 24) {
						j = -1;
						break a
					}
					if (l << 24 >> 24 < k << 24 >> 24) {
						j = 1;
						break a
					}
					k = i + 1 | 0;
					b = b + 1 | 0;
					if ((b | 0) == (f | 0)) {
						g = k;
						h = 6;
						break
					} else i = k
				}
			}
		while (0);
		if ((h | 0) == 6) j = (g | 0) != (d | 0) & 1;
		return j | 0
	}

	function Bh(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		fg(a, c, d);
		return
	}

	function Ch(b, c, d) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0;
		if ((c | 0) == (d | 0)) e = 0;
		else {
			b = 0;
			f = c;
			while (1) {
				c = (a[f >> 0] | 0) + (b << 4) | 0;
				g = c & -268435456;
				h = (g >>> 24 | g) ^ c;
				f = f + 1 | 0;
				if ((f | 0) == (d | 0)) {
					e = h;
					break
				} else b = h
			}
		}
		return e | 0
	}

	function Dh(a) {
		a = a | 0;
		return
	}

	function Eh(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Fh(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0;
		a: do
			if ((e | 0) == (f | 0)) {
				g = b;
				h = 6
			} else {
				a = e;
				i = b;
				while (1) {
					if ((i | 0) == (d | 0)) {
						j = -1;
						break a
					}
					k = c[i >> 2] | 0;
					l = c[a >> 2] | 0;
					if ((k | 0) < (l | 0)) {
						j = -1;
						break a
					}
					if ((l | 0) < (k | 0)) {
						j = 1;
						break a
					}
					k = i + 4 | 0;
					a = a + 4 | 0;
					if ((a | 0) == (f | 0)) {
						g = k;
						h = 6;
						break
					} else i = k
				}
			}
		while (0);
		if ((h | 0) == 6) j = (g | 0) != (d | 0) & 1;
		return j | 0
	}

	function Gh(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		gg(a, c, d);
		return
	}

	function Hh(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0;
		if ((b | 0) == (d | 0)) e = 0;
		else {
			a = 0;
			f = b;
			while (1) {
				b = (c[f >> 2] | 0) + (a << 4) | 0;
				g = b & -268435456;
				h = (g >>> 24 | g) ^ b;
				f = f + 4 | 0;
				if ((f | 0) == (d | 0)) {
					e = h;
					break
				} else a = h
			}
		}
		return e | 0
	}

	function Ih(a) {
		a = a | 0;
		return
	}

	function Jh(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Kh(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		j = i;
		i = i + 64 | 0;
		k = j + 48 | 0;
		l = j + 16 | 0;
		m = j + 4 | 0;
		n = j + 8 | 0;
		o = j + 52 | 0;
		p = j;
		q = j + 12 | 0;
		r = j + 24 | 0;
		s = j + 20 | 0;
		a: do
			if (!(c[f + 4 >> 2] & 1)) {
				c[m >> 2] = -1;
				t = c[(c[b >> 2] | 0) + 16 >> 2] | 0;
				c[n >> 2] = c[d >> 2];
				c[o >> 2] = c[e >> 2];
				c[l >> 2] = c[n >> 2];
				c[k >> 2] = c[o >> 2];
				u = vb[t & 63](b, l, k, f, g, m) | 0;
				c[d >> 2] = u;
				switch (c[m >> 2] | 0) {
					case 0:
						{
							a[h >> 0] = 0;v = u;
							break a;
							break
						}
					case 1:
						{
							a[h >> 0] = 1;v = u;
							break a;
							break
						}
					default:
						{
							a[h >> 0] = 1;c[g >> 2] = 4;v = u;
							break a
						}
				}
			} else {
				u = mg(f) | 0;
				c[p >> 2] = u;
				t = Gl(p, 9868) | 0;
				ep(u) | 0;
				u = mg(f) | 0;
				c[q >> 2] = u;
				w = Gl(q, 10008) | 0;
				ep(u) | 0;
				ub[c[(c[w >> 2] | 0) + 24 >> 2] & 63](r, w);
				ub[c[(c[w >> 2] | 0) + 28 >> 2] & 63](r + 12 | 0, w);
				c[s >> 2] = c[e >> 2];
				c[k >> 2] = c[s >> 2];
				a[h >> 0] = (tn(d, k, r, r + 24 | 0, t, g, 1) | 0) == (r | 0) & 1;
				t = c[d >> 2] | 0;
				Of(r + 12 | 0);
				Of(r);
				v = t
			}
		while (0);
		i = j;
		return v | 0
	}

	function Lh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = un(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Mh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = vn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Nh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = wn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Oh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = xn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Ph(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = yn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Qh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = zn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Rh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = An(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Sh(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Bn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Th(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Cn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function Uh(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0;
		b = i;
		i = i + 240 | 0;
		k = b;
		l = b + 208 | 0;
		m = b + 188 | 0;
		n = b + 200 | 0;
		o = b + 8 | 0;
		p = b + 4 | 0;
		q = b + 24 | 0;
		r = b + 184 | 0;
		s = b + 204 | 0;
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		t = mg(g) | 0;
		c[n >> 2] = t;
		g = Gl(n, 9868) | 0;
		Bb[c[(c[g >> 2] | 0) + 32 >> 2] & 7](g, 20897, 20923, l) | 0;
		ep(t) | 0;
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		if (!(a[o >> 0] & 1)) u = 10;
		else u = (c[o >> 2] & -2) + -1 | 0;
		Sf(o, u, 0);
		u = o + 8 | 0;
		t = o + 1 | 0;
		g = (a[o >> 0] & 1) == 0 ? t : c[u >> 2] | 0;
		c[p >> 2] = g;
		c[r >> 2] = q;
		c[s >> 2] = 0;
		n = o + 4 | 0;
		v = c[e >> 2] | 0;
		w = g;
		a: while (1) {
			if (v)
				if ((c[v + 12 >> 2] | 0) == (c[v + 16 >> 2] | 0) ? (xb[c[(c[v >> 2] | 0) + 36 >> 2] & 63](v) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					x = 0
				} else x = v;
			else x = 0;
			g = (x | 0) == 0;
			y = c[f >> 2] | 0;
			do
				if (y) {
					if ((c[y + 12 >> 2] | 0) != (c[y + 16 >> 2] | 0))
						if (g) {
							z = y;
							break
						} else {
							A = x;
							B = y;
							C = w;
							break a
						}
					if ((xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0) != -1)
						if (g) {
							z = y;
							break
						} else {
							A = x;
							B = y;
							C = w;
							break a
						}
					else {
						c[f >> 2] = 0;
						D = 13;
						break
					}
				} else D = 13; while (0);
			if ((D | 0) == 13) {
				D = 0;
				if (g) {
					A = x;
					B = 0;
					C = w;
					break
				} else z = 0
			}
			y = a[o >> 0] | 0;
			E = (y & 1) == 0 ? (y & 255) >>> 1 : c[n >> 2] | 0;
			if ((c[p >> 2] | 0) == (w + E | 0)) {
				Sf(o, E << 1, 0);
				if (!(a[o >> 0] & 1)) F = 10;
				else F = (c[o >> 2] & -2) + -1 | 0;
				Sf(o, F, 0);
				y = (a[o >> 0] & 1) == 0 ? t : c[u >> 2] | 0;
				c[p >> 2] = y + E;
				G = y
			} else G = w;
			y = x + 12 | 0;
			E = c[y >> 2] | 0;
			H = x + 16 | 0;
			if ((E | 0) == (c[H >> 2] | 0)) I = xb[c[(c[x >> 2] | 0) + 36 >> 2] & 63](x) | 0;
			else I = d[E >> 0] | 0;
			if (Vh(I & 255, 16, G, p, s, 0, m, q, r, l) | 0) {
				A = x;
				B = z;
				C = G;
				break
			}
			E = c[y >> 2] | 0;
			if ((E | 0) == (c[H >> 2] | 0)) {
				xb[c[(c[x >> 2] | 0) + 40 >> 2] & 63](x) | 0;
				v = x;
				w = G;
				continue
			} else {
				c[y >> 2] = E + 1;
				v = x;
				w = G;
				continue
			}
		}
		Sf(o, (c[p >> 2] | 0) - C | 0, 0);
		C = (a[o >> 0] & 1) == 0 ? t : c[u >> 2] | 0;
		u = Wh() | 0;
		c[k >> 2] = j;
		if ((Dn(C, u, 22281, k) | 0) != 1) c[h >> 2] = 4;
		if (A)
			if ((c[A + 12 >> 2] | 0) == (c[A + 16 >> 2] | 0) ? (xb[c[(c[A >> 2] | 0) + 36 >> 2] & 63](A) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				J = 0
			} else J = A;
		else J = 0;
		A = (J | 0) == 0;
		do
			if (B) {
				if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					D = 37;
					break
				}
				if (!A) D = 38
			} else D = 37; while (0);
		if ((D | 0) == 37 ? A : 0) D = 38;
		if ((D | 0) == 38) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(o);
		Of(m);
		i = b;
		return h | 0
	}

	function Vh(b, d, e, f, g, h, i, j, k, l) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		var m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0;
		m = c[f >> 2] | 0;
		n = (m | 0) == (e | 0);
		do
			if (n) {
				o = (a[l + 24 >> 0] | 0) == b << 24 >> 24;
				if (!o ? (a[l + 25 >> 0] | 0) != b << 24 >> 24 : 0) {
					p = 5;
					break
				}
				c[f >> 2] = e + 1;
				a[e >> 0] = o ? 43 : 45;
				c[g >> 2] = 0;
				q = 0
			} else p = 5; while (0);
		a: do
			if ((p | 0) == 5) {
				o = a[i >> 0] | 0;
				if (b << 24 >> 24 == h << 24 >> 24 ? (((o & 1) == 0 ? (o & 255) >>> 1 : c[i + 4 >> 2] | 0) | 0) != 0 : 0) {
					o = c[k >> 2] | 0;
					if ((o - j | 0) >= 160) {
						q = 0;
						break
					}
					r = c[g >> 2] | 0;
					c[k >> 2] = o + 4;
					c[o >> 2] = r;
					c[g >> 2] = 0;
					q = 0;
					break
				}
				r = l + 26 | 0;
				o = l;
				while (1) {
					if ((a[o >> 0] | 0) == b << 24 >> 24) {
						s = o;
						break
					}
					o = o + 1 | 0;
					if ((o | 0) == (r | 0)) {
						s = r;
						break
					}
				}
				r = s - l | 0;
				if ((r | 0) > 23) q = -1;
				else {
					switch (d | 0) {
						case 10:
						case 8:
							{
								if ((r | 0) >= (d | 0)) {
									q = -1;
									break a
								}
								break
							}
						case 16:
							{
								if ((r | 0) >= 22) {
									if (n) {
										q = -1;
										break a
									}
									if ((m - e | 0) >= 3) {
										q = -1;
										break a
									}
									if ((a[m + -1 >> 0] | 0) != 48) {
										q = -1;
										break a
									}
									c[g >> 2] = 0;
									o = a[20897 + r >> 0] | 0;
									c[f >> 2] = m + 1;
									a[m >> 0] = o;
									q = 0;
									break a
								}
								break
							}
						default:
							{}
					}
					o = a[20897 + r >> 0] | 0;
					c[f >> 2] = m + 1;
					a[m >> 0] = o;
					c[g >> 2] = (c[g >> 2] | 0) + 1;
					q = 0
				}
			}
		while (0);
		return q | 0
	}

	function Wh() {
		if ((a[1328] | 0) == 0 ? (Ba(1328) | 0) != 0 : 0) {
			c[2608] = Od(2147483647, 22284, 0) | 0;
			Ha(1328)
		}
		return c[2608] | 0
	}

	function Xh(a) {
		a = a | 0;
		return
	}

	function Yh(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Zh(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		j = i;
		i = i + 64 | 0;
		k = j + 48 | 0;
		l = j + 16 | 0;
		m = j + 4 | 0;
		n = j + 8 | 0;
		o = j + 52 | 0;
		p = j;
		q = j + 12 | 0;
		r = j + 24 | 0;
		s = j + 20 | 0;
		a: do
			if (!(c[f + 4 >> 2] & 1)) {
				c[m >> 2] = -1;
				t = c[(c[b >> 2] | 0) + 16 >> 2] | 0;
				c[n >> 2] = c[d >> 2];
				c[o >> 2] = c[e >> 2];
				c[l >> 2] = c[n >> 2];
				c[k >> 2] = c[o >> 2];
				u = vb[t & 63](b, l, k, f, g, m) | 0;
				c[d >> 2] = u;
				switch (c[m >> 2] | 0) {
					case 0:
						{
							a[h >> 0] = 0;v = u;
							break a;
							break
						}
					case 1:
						{
							a[h >> 0] = 1;v = u;
							break a;
							break
						}
					default:
						{
							a[h >> 0] = 1;c[g >> 2] = 4;v = u;
							break a
						}
				}
			} else {
				u = mg(f) | 0;
				c[p >> 2] = u;
				t = Gl(p, 9860) | 0;
				ep(u) | 0;
				u = mg(f) | 0;
				c[q >> 2] = u;
				w = Gl(q, 10016) | 0;
				ep(u) | 0;
				ub[c[(c[w >> 2] | 0) + 24 >> 2] & 63](r, w);
				ub[c[(c[w >> 2] | 0) + 28 >> 2] & 63](r + 12 | 0, w);
				c[s >> 2] = c[e >> 2];
				c[k >> 2] = c[s >> 2];
				a[h >> 0] = (En(d, k, r, r + 24 | 0, t, g, 1) | 0) == (r | 0) & 1;
				t = c[d >> 2] | 0;
				_f(r + 12 | 0);
				_f(r);
				v = t
			}
		while (0);
		i = j;
		return v | 0
	}

	function _h(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Fn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function $h(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Gn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function ai(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Hn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function bi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = In(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function ci(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Jn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function di(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Kn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function ei(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Ln(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function fi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Mn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function gi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Nn(a, k, j, e, f, g) | 0;
		i = h;
		return m | 0
	}

	function hi(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0;
		b = i;
		i = i + 320 | 0;
		j = b;
		k = b + 200 | 0;
		l = b + 188 | 0;
		m = b + 8 | 0;
		n = b + 176 | 0;
		o = b + 4 | 0;
		p = b + 16 | 0;
		q = b + 304 | 0;
		r = b + 308 | 0;
		c[l >> 2] = 0;
		c[l + 4 >> 2] = 0;
		c[l + 8 >> 2] = 0;
		s = mg(f) | 0;
		c[m >> 2] = s;
		f = Gl(m, 9860) | 0;
		Bb[c[(c[f >> 2] | 0) + 48 >> 2] & 7](f, 20897, 20923, k) | 0;
		ep(s) | 0;
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		s = n + 1 | 0;
		f = (a[n >> 0] & 1) == 0 ? s : c[t >> 2] | 0;
		c[o >> 2] = f;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		m = n + 4 | 0;
		u = c[d >> 2] | 0;
		v = f;
		a: while (1) {
			if (u) {
				f = c[u + 12 >> 2] | 0;
				if ((f | 0) == (c[u + 16 >> 2] | 0)) w = xb[c[(c[u >> 2] | 0) + 36 >> 2] & 63](u) | 0;
				else w = c[f >> 2] | 0;
				if ((w | 0) == -1) {
					c[d >> 2] = 0;
					x = 0;
					y = 1
				} else {
					x = u;
					y = 0
				}
			} else {
				x = 0;
				y = 1
			}
			f = c[e >> 2] | 0;
			do
				if (f) {
					z = c[f + 12 >> 2] | 0;
					if ((z | 0) == (c[f + 16 >> 2] | 0)) A = xb[c[(c[f >> 2] | 0) + 36 >> 2] & 63](f) | 0;
					else A = c[z >> 2] | 0;
					if ((A | 0) != -1)
						if (y) {
							B = f;
							break
						} else {
							C = x;
							D = f;
							E = v;
							break a
						}
					else {
						c[e >> 2] = 0;
						F = 16;
						break
					}
				} else F = 16; while (0);
			if ((F | 0) == 16) {
				F = 0;
				if (y) {
					C = x;
					D = 0;
					E = v;
					break
				} else B = 0
			}
			f = a[n >> 0] | 0;
			z = (f & 1) == 0 ? (f & 255) >>> 1 : c[m >> 2] | 0;
			if ((c[o >> 2] | 0) == (v + z | 0)) {
				Sf(n, z << 1, 0);
				if (!(a[n >> 0] & 1)) G = 10;
				else G = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, G, 0);
				f = (a[n >> 0] & 1) == 0 ? s : c[t >> 2] | 0;
				c[o >> 2] = f + z;
				H = f
			} else H = v;
			f = x + 12 | 0;
			z = c[f >> 2] | 0;
			I = x + 16 | 0;
			if ((z | 0) == (c[I >> 2] | 0)) J = xb[c[(c[x >> 2] | 0) + 36 >> 2] & 63](x) | 0;
			else J = c[z >> 2] | 0;
			if (ii(J, 16, H, o, r, 0, l, p, q, k) | 0) {
				C = x;
				D = B;
				E = H;
				break
			}
			z = c[f >> 2] | 0;
			if ((z | 0) == (c[I >> 2] | 0)) {
				xb[c[(c[x >> 2] | 0) + 40 >> 2] & 63](x) | 0;
				u = x;
				v = H;
				continue
			} else {
				c[f >> 2] = z + 4;
				u = x;
				v = H;
				continue
			}
		}
		Sf(n, (c[o >> 2] | 0) - E | 0, 0);
		E = (a[n >> 0] & 1) == 0 ? s : c[t >> 2] | 0;
		t = Wh() | 0;
		c[j >> 2] = h;
		if ((Dn(E, t, 22281, j) | 0) != 1) c[g >> 2] = 4;
		if (C) {
			j = c[C + 12 >> 2] | 0;
			if ((j | 0) == (c[C + 16 >> 2] | 0)) K = xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0;
			else K = c[j >> 2] | 0;
			if ((K | 0) == -1) {
				c[d >> 2] = 0;
				L = 1
			} else L = 0
		} else L = 1;
		do
			if (D) {
				K = c[D + 12 >> 2] | 0;
				if ((K | 0) == (c[D + 16 >> 2] | 0)) M = xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0;
				else M = c[K >> 2] | 0;
				if ((M | 0) != -1)
					if (L) break;
					else {
						F = 45;
						break
					}
				else {
					c[e >> 2] = 0;
					F = 43;
					break
				}
			} else F = 43; while (0);
		if ((F | 0) == 43 ? L : 0) F = 45;
		if ((F | 0) == 45) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(n);
		Of(l);
		i = b;
		return g | 0
	}

	function ii(b, d, e, f, g, h, i, j, k, l) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		var m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0;
		m = c[f >> 2] | 0;
		n = (m | 0) == (e | 0);
		do
			if (n) {
				o = (c[l + 96 >> 2] | 0) == (b | 0);
				if (!o ? (c[l + 100 >> 2] | 0) != (b | 0) : 0) {
					p = 5;
					break
				}
				c[f >> 2] = e + 1;
				a[e >> 0] = o ? 43 : 45;
				c[g >> 2] = 0;
				q = 0
			} else p = 5; while (0);
		a: do
			if ((p | 0) == 5) {
				o = a[i >> 0] | 0;
				if ((b | 0) == (h | 0) ? (((o & 1) == 0 ? (o & 255) >>> 1 : c[i + 4 >> 2] | 0) | 0) != 0 : 0) {
					o = c[k >> 2] | 0;
					if ((o - j | 0) >= 160) {
						q = 0;
						break
					}
					r = c[g >> 2] | 0;
					c[k >> 2] = o + 4;
					c[o >> 2] = r;
					c[g >> 2] = 0;
					q = 0;
					break
				}
				r = l + 104 | 0;
				o = l;
				while (1) {
					if ((c[o >> 2] | 0) == (b | 0)) {
						s = o;
						break
					}
					o = o + 4 | 0;
					if ((o | 0) == (r | 0)) {
						s = r;
						break
					}
				}
				r = s - l | 0;
				o = r >> 2;
				if ((r | 0) > 92) q = -1;
				else {
					switch (d | 0) {
						case 10:
						case 8:
							{
								if ((o | 0) >= (d | 0)) {
									q = -1;
									break a
								}
								break
							}
						case 16:
							{
								if ((r | 0) >= 88) {
									if (n) {
										q = -1;
										break a
									}
									if ((m - e | 0) >= 3) {
										q = -1;
										break a
									}
									if ((a[m + -1 >> 0] | 0) != 48) {
										q = -1;
										break a
									}
									c[g >> 2] = 0;
									r = a[20897 + o >> 0] | 0;
									c[f >> 2] = m + 1;
									a[m >> 0] = r;
									q = 0;
									break a
								}
								break
							}
						default:
							{}
					}
					r = a[20897 + o >> 0] | 0;
					c[f >> 2] = m + 1;
					a[m >> 0] = r;
					c[g >> 2] = (c[g >> 2] | 0) + 1;
					q = 0
				}
			}
		while (0);
		return q | 0
	}

	function ji(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		j = mg(d) | 0;
		c[h >> 2] = j;
		d = Gl(h, 9868) | 0;
		Bb[c[(c[d >> 2] | 0) + 32 >> 2] & 7](d, 20897, 20923, e) | 0;
		e = Gl(h, 10008) | 0;
		a[f >> 0] = xb[c[(c[e >> 2] | 0) + 16 >> 2] & 63](e) | 0;
		ub[c[(c[e >> 2] | 0) + 20 >> 2] & 63](b, e);
		ep(j) | 0;
		i = g;
		return
	}

	function ki(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0;
		h = i;
		i = i + 16 | 0;
		j = h;
		k = mg(d) | 0;
		c[j >> 2] = k;
		d = Gl(j, 9868) | 0;
		Bb[c[(c[d >> 2] | 0) + 32 >> 2] & 7](d, 20897, 20929, e) | 0;
		e = Gl(j, 10008) | 0;
		a[f >> 0] = xb[c[(c[e >> 2] | 0) + 12 >> 2] & 63](e) | 0;
		a[g >> 0] = xb[c[(c[e >> 2] | 0) + 16 >> 2] & 63](e) | 0;
		ub[c[(c[e >> 2] | 0) + 20 >> 2] & 63](b, e);
		ep(k) | 0;
		i = h;
		return
	}

	function li(b, e, f, g, h, i, j, k, l, m, n, o) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		var p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0;
		a: do
			if (b << 24 >> 24 == i << 24 >> 24)
				if (a[e >> 0] | 0) {
					a[e >> 0] = 0;
					p = c[h >> 2] | 0;
					c[h >> 2] = p + 1;
					a[p >> 0] = 46;
					p = a[k >> 0] | 0;
					if ((((p & 1) == 0 ? (p & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0 ? (p = c[m >> 2] | 0, (p - l | 0) < 160) : 0) {
						q = c[n >> 2] | 0;
						c[m >> 2] = p + 4;
						c[p >> 2] = q;
						r = 0
					} else r = 0
				} else r = -1;
		else {
			if (b << 24 >> 24 == j << 24 >> 24 ? (q = a[k >> 0] | 0, (((q & 1) == 0 ? (q & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0) : 0) {
				if (!(a[e >> 0] | 0)) {
					r = -1;
					break
				}
				q = c[m >> 2] | 0;
				if ((q - l | 0) >= 160) {
					r = 0;
					break
				}
				p = c[n >> 2] | 0;
				c[m >> 2] = q + 4;
				c[q >> 2] = p;
				c[n >> 2] = 0;
				r = 0;
				break
			}
			p = o + 32 | 0;
			q = o;
			while (1) {
				if ((a[q >> 0] | 0) == b << 24 >> 24) {
					s = q;
					break
				}
				q = q + 1 | 0;
				if ((q | 0) == (p | 0)) {
					s = p;
					break
				}
			}
			p = s - o | 0;
			if ((p | 0) > 31) r = -1;
			else {
				q = a[20897 + p >> 0] | 0;
				switch (p | 0) {
					case 24:
					case 25:
						{
							t = c[h >> 2] | 0;
							if ((t | 0) != (g | 0) ? (d[t + -1 >> 0] & 95 | 0) != (d[f >> 0] & 127 | 0) : 0) {
								r = -1;
								break a
							}
							c[h >> 2] = t + 1;a[t >> 0] = q;r = 0;
							break a;
							break
						}
					case 23:
					case 22:
						{
							a[f >> 0] = 80;t = c[h >> 2] | 0;c[h >> 2] = t + 1;a[t >> 0] = q;r = 0;
							break a;
							break
						}
					default:
						{
							t = q & 95;
							if ((((t | 0) == (a[f >> 0] | 0) ? (a[f >> 0] = t | 128, (a[e >> 0] | 0) != 0) : 0) ? (a[e >> 0] = 0, t = a[k >> 0] | 0, (((t & 1) == 0 ? (t & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0) : 0) ? (t = c[m >> 2] | 0, (t - l | 0) < 160) : 0) {
								u = c[n >> 2] | 0;
								c[m >> 2] = t + 4;
								c[t >> 2] = u
							}
							u = c[h >> 2] | 0;c[h >> 2] = u + 1;a[u >> 0] = q;
							if ((p | 0) > 21) {
								r = 0;
								break a
							}
							c[n >> 2] = (c[n >> 2] | 0) + 1;r = 0;
							break a
						}
				}
			}
		}
		while (0);
		return r | 0
	}

	function mi(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		h = mg(b) | 0;
		c[g >> 2] = h;
		b = Gl(g, 9860) | 0;
		Bb[c[(c[b >> 2] | 0) + 48 >> 2] & 7](b, 20897, 20923, d) | 0;
		d = Gl(g, 10016) | 0;
		c[e >> 2] = xb[c[(c[d >> 2] | 0) + 16 >> 2] & 63](d) | 0;
		ub[c[(c[d >> 2] | 0) + 20 >> 2] & 63](a, d);
		ep(h) | 0;
		i = f;
		return
	}

	function ni(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		j = mg(b) | 0;
		c[h >> 2] = j;
		b = Gl(h, 9860) | 0;
		Bb[c[(c[b >> 2] | 0) + 48 >> 2] & 7](b, 20897, 20929, d) | 0;
		d = Gl(h, 10016) | 0;
		c[e >> 2] = xb[c[(c[d >> 2] | 0) + 12 >> 2] & 63](d) | 0;
		c[f >> 2] = xb[c[(c[d >> 2] | 0) + 16 >> 2] & 63](d) | 0;
		ub[c[(c[d >> 2] | 0) + 20 >> 2] & 63](a, d);
		ep(j) | 0;
		i = g;
		return
	}

	function oi(b, e, f, g, h, i, j, k, l, m, n, o) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		var p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0;
		a: do
			if ((b | 0) == (i | 0))
				if (a[e >> 0] | 0) {
					a[e >> 0] = 0;
					p = c[h >> 2] | 0;
					c[h >> 2] = p + 1;
					a[p >> 0] = 46;
					p = a[k >> 0] | 0;
					if ((((p & 1) == 0 ? (p & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0 ? (p = c[m >> 2] | 0, (p - l | 0) < 160) : 0) {
						q = c[n >> 2] | 0;
						c[m >> 2] = p + 4;
						c[p >> 2] = q;
						r = 0
					} else r = 0
				} else r = -1;
		else {
			if ((b | 0) == (j | 0) ? (q = a[k >> 0] | 0, (((q & 1) == 0 ? (q & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0) : 0) {
				if (!(a[e >> 0] | 0)) {
					r = -1;
					break
				}
				q = c[m >> 2] | 0;
				if ((q - l | 0) >= 160) {
					r = 0;
					break
				}
				p = c[n >> 2] | 0;
				c[m >> 2] = q + 4;
				c[q >> 2] = p;
				c[n >> 2] = 0;
				r = 0;
				break
			}
			p = o + 128 | 0;
			q = o;
			while (1) {
				if ((c[q >> 2] | 0) == (b | 0)) {
					s = q;
					break
				}
				q = q + 4 | 0;
				if ((q | 0) == (p | 0)) {
					s = p;
					break
				}
			}
			p = s - o | 0;
			q = p >> 2;
			if ((p | 0) <= 124) {
				t = a[20897 + q >> 0] | 0;
				switch (q | 0) {
					case 24:
					case 25:
						{
							q = c[h >> 2] | 0;
							if ((q | 0) != (g | 0) ? (d[q + -1 >> 0] & 95 | 0) != (d[f >> 0] & 127 | 0) : 0) {
								r = -1;
								break a
							}
							c[h >> 2] = q + 1;a[q >> 0] = t;r = 0;
							break a;
							break
						}
					case 23:
					case 22:
						{
							a[f >> 0] = 80;
							break
						}
					default:
						{
							q = t & 95;
							if ((((q | 0) == (a[f >> 0] | 0) ? (a[f >> 0] = q | 128, (a[e >> 0] | 0) != 0) : 0) ? (a[e >> 0] = 0, q = a[k >> 0] | 0, (((q & 1) == 0 ? (q & 255) >>> 1 : c[k + 4 >> 2] | 0) | 0) != 0) : 0) ? (q = c[m >> 2] | 0, (q - l | 0) < 160) : 0) {
								u = c[n >> 2] | 0;
								c[m >> 2] = q + 4;
								c[q >> 2] = u
							}
						}
				}
				u = c[h >> 2] | 0;
				c[h >> 2] = u + 1;
				a[u >> 0] = t;
				if ((p | 0) > 84) r = 0;
				else {
					c[n >> 2] = (c[n >> 2] | 0) + 1;
					r = 0
				}
			} else r = -1
		}
		while (0);
		return r | 0
	}

	function pi(a) {
		a = a | 0;
		return
	}

	function qi(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function ri(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		h = i;
		i = i + 32 | 0;
		j = h + 20 | 0;
		k = h + 16 | 0;
		l = h + 12 | 0;
		m = h;
		if (!(c[e + 4 >> 2] & 1)) {
			n = c[(c[b >> 2] | 0) + 24 >> 2] | 0;
			c[k >> 2] = c[d >> 2];
			c[j >> 2] = c[k >> 2];
			o = Eb[n & 31](b, j, e, f, g & 1) | 0
		} else {
			f = mg(e) | 0;
			c[l >> 2] = f;
			e = Gl(l, 10008) | 0;
			ep(f) | 0;
			f = c[e >> 2] | 0;
			if (g) ub[c[f + 24 >> 2] & 63](m, e);
			else ub[c[f + 28 >> 2] & 63](m, e);
			e = a[m >> 0] | 0;
			f = (e & 1) == 0;
			g = m + 1 | 0;
			l = m + 8 | 0;
			j = f ? g : m + 1 | 0;
			b = f ? g : c[m + 8 >> 2] | 0;
			g = m + 4 | 0;
			f = (e & 1) == 0;
			if ((b | 0) != ((f ? j : c[l >> 2] | 0) + (f ? (e & 255) >>> 1 : c[g >> 2] | 0) | 0)) {
				e = b;
				do {
					b = a[e >> 0] | 0;
					f = c[d >> 2] | 0;
					do
						if (f) {
							n = f + 24 | 0;
							k = c[n >> 2] | 0;
							if ((k | 0) != (c[f + 28 >> 2] | 0)) {
								c[n >> 2] = k + 1;
								a[k >> 0] = b;
								break
							}
							if ((Db[c[(c[f >> 2] | 0) + 52 >> 2] & 31](f, b & 255) | 0) == -1) c[d >> 2] = 0
						}
					while (0);
					e = e + 1 | 0;
					b = a[m >> 0] | 0;
					f = (b & 1) == 0
				} while ((e | 0) != ((f ? j : c[l >> 2] | 0) + (f ? (b & 255) >>> 1 : c[g >> 2] | 0) | 0))
			}
			g = c[d >> 2] | 0;
			Of(m);
			o = g
		}
		i = h;
		return o | 0
	}

	function si(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 64 | 0;
		h = b;
		j = b + 20 | 0;
		k = b + 28 | 0;
		l = b + 40 | 0;
		m = b + 12 | 0;
		n = b + 4 | 0;
		o = b + 8 | 0;
		p = b + 16 | 0;
		a[j >> 0] = a[22286] | 0;
		a[j + 1 >> 0] = a[22287] | 0;
		a[j + 2 >> 0] = a[22288] | 0;
		a[j + 3 >> 0] = a[22289] | 0;
		a[j + 4 >> 0] = a[22290] | 0;
		a[j + 5 >> 0] = a[22291] | 0;
		ti(j + 1 | 0, 22292, 1, c[e + 4 >> 2] | 0);
		q = Wh() | 0;
		c[h >> 2] = g;
		g = k + (On(k, 12, q, j, h) | 0) | 0;
		j = ui(k, g, e) | 0;
		q = mg(e) | 0;
		c[o >> 2] = q;
		vi(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[d >> 2];
		d = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = cc(h, l, d, m, e, f) | 0;
		i = b;
		return p | 0
	}

	function ti(b, c, d, e) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		if (!(e & 2048)) f = b;
		else {
			a[b >> 0] = 43;
			f = b + 1 | 0
		}
		if (!(e & 512)) g = f;
		else {
			a[f >> 0] = 35;
			g = f + 1 | 0
		}
		f = a[c >> 0] | 0;
		if (!(f << 24 >> 24)) h = g;
		else {
			b = c;
			c = g;
			g = f;
			while (1) {
				b = b + 1 | 0;
				f = c + 1 | 0;
				a[c >> 0] = g;
				g = a[b >> 0] | 0;
				if (!(g << 24 >> 24)) {
					h = f;
					break
				} else c = f
			}
		}
		a: do switch (e & 74 | 0) {
				case 64:
					{
						a[h >> 0] = 111;
						break
					}
				case 8:
					{
						if (!(e & 16384)) {
							a[h >> 0] = 120;
							break a
						} else {
							a[h >> 0] = 88;
							break a
						}
						break
					}
				default:
					if (d) {
						a[h >> 0] = 100;
						break a
					} else {
						a[h >> 0] = 117;
						break a
					}
			}
			while (0);
			return
	}

	function ui(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		a: do switch (c[e + 4 >> 2] & 176 | 0) {
				case 16:
					{
						f = a[b >> 0] | 0;
						switch (f << 24 >> 24) {
							case 43:
							case 45:
								{
									g = b + 1 | 0;
									break a;
									break
								}
							default:
								{}
						}
						if ((d - b | 0) > 1 & f << 24 >> 24 == 48) {
							switch (a[b + 1 >> 0] | 0) {
								case 88:
								case 120:
									break;
								default:
									{
										h = 7;
										break a
									}
							}
							g = b + 2 | 0
						} else h = 7;
						break
					}
				case 32:
					{
						g = d;
						break
					}
				default:
					h = 7
			}
			while (0);
			if ((h | 0) == 7) g = b;
		return g | 0
	}

	function vi(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		k = i;
		i = i + 16 | 0;
		l = k;
		m = Gl(j, 9868) | 0;
		n = Gl(j, 10008) | 0;
		ub[c[(c[n >> 2] | 0) + 20 >> 2] & 63](l, n);
		j = a[l >> 0] | 0;
		o = l + 4 | 0;
		if (((j & 1) == 0 ? (j & 255) >>> 1 : c[o >> 2] | 0) | 0) {
			c[h >> 2] = f;
			j = a[b >> 0] | 0;
			switch (j << 24 >> 24) {
				case 43:
				case 45:
					{
						p = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, j) | 0;j = c[h >> 2] | 0;c[h >> 2] = j + 1;a[j >> 0] = p;q = b + 1 | 0;
						break
					}
				default:
					q = b
			}
			a: do
				if ((e - q | 0) > 1 ? (a[q >> 0] | 0) == 48 : 0) {
					p = q + 1 | 0;
					switch (a[p >> 0] | 0) {
						case 88:
						case 120:
							break;
						default:
							{
								r = q;
								break a
							}
					}
					j = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, 48) | 0;
					s = c[h >> 2] | 0;
					c[h >> 2] = s + 1;
					a[s >> 0] = j;
					j = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, a[p >> 0] | 0) | 0;
					p = c[h >> 2] | 0;
					c[h >> 2] = p + 1;
					a[p >> 0] = j;
					r = q + 2 | 0
				} else r = q; while (0);
			if ((r | 0) != (e | 0) ? (q = e + -1 | 0, r >>> 0 < q >>> 0) : 0) {
				j = r;
				p = q;
				do {
					q = a[j >> 0] | 0;
					a[j >> 0] = a[p >> 0] | 0;
					a[p >> 0] = q;
					j = j + 1 | 0;
					p = p + -1 | 0
				} while (j >>> 0 < p >>> 0)
			}
			p = xb[c[(c[n >> 2] | 0) + 16 >> 2] & 63](n) | 0;
			n = l + 8 | 0;
			j = l + 1 | 0;
			if (r >>> 0 < e >>> 0) {
				q = 0;
				s = 0;
				t = r;
				while (1) {
					u = a[((a[l >> 0] & 1) == 0 ? j : c[n >> 2] | 0) + s >> 0] | 0;
					if (u << 24 >> 24 != 0 & (q | 0) == (u << 24 >> 24 | 0)) {
						u = c[h >> 2] | 0;
						c[h >> 2] = u + 1;
						a[u >> 0] = p;
						u = a[l >> 0] | 0;
						v = 0;
						w = (s >>> 0 < (((u & 1) == 0 ? (u & 255) >>> 1 : c[o >> 2] | 0) + -1 | 0) >>> 0 & 1) + s | 0
					} else {
						v = q;
						w = s
					}
					u = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, a[t >> 0] | 0) | 0;
					x = c[h >> 2] | 0;
					c[h >> 2] = x + 1;
					a[x >> 0] = u;
					t = t + 1 | 0;
					if (t >>> 0 >= e >>> 0) break;
					else {
						q = v + 1 | 0;
						s = w
					}
				}
			}
			w = b;
			s = f + (r - w) | 0;
			r = c[h >> 2] | 0;
			if ((s | 0) == (r | 0)) {
				y = w;
				z = s
			} else {
				v = r + -1 | 0;
				if (s >>> 0 < v >>> 0) {
					r = s;
					s = v;
					do {
						v = a[r >> 0] | 0;
						a[r >> 0] = a[s >> 0] | 0;
						a[s >> 0] = v;
						r = r + 1 | 0;
						s = s + -1 | 0
					} while (r >>> 0 < s >>> 0)
				}
				y = w;
				z = c[h >> 2] | 0
			}
		} else {
			Bb[c[(c[m >> 2] | 0) + 32 >> 2] & 7](m, b, e, f) | 0;
			m = b;
			b = f + (e - m) | 0;
			c[h >> 2] = b;
			y = m;
			z = b
		}
		c[g >> 2] = (d | 0) == (e | 0) ? z : f + (d - y) | 0;
		Of(l);
		i = k;
		return
	}

	function wi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		a = i;
		i = i + 96 | 0;
		h = a;
		j = a + 8 | 0;
		k = a + 32 | 0;
		l = a + 54 | 0;
		m = a + 16 | 0;
		n = a + 24 | 0;
		o = a + 20 | 0;
		p = a + 28 | 0;
		q = j;
		c[q >> 2] = 37;
		c[q + 4 >> 2] = 0;
		ti(j + 1 | 0, 22294, 1, c[d + 4 >> 2] | 0);
		q = Wh() | 0;
		r = h;
		c[r >> 2] = f;
		c[r + 4 >> 2] = g;
		g = k + (On(k, 22, q, j, h) | 0) | 0;
		j = ui(k, g, d) | 0;
		q = mg(d) | 0;
		c[o >> 2] = q;
		vi(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[b >> 2];
		b = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = cc(h, l, b, m, d, e) | 0;
		i = a;
		return p | 0
	}

	function xi(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 64 | 0;
		h = b;
		j = b + 20 | 0;
		k = b + 28 | 0;
		l = b + 40 | 0;
		m = b + 12 | 0;
		n = b + 4 | 0;
		o = b + 8 | 0;
		p = b + 16 | 0;
		a[j >> 0] = a[22286] | 0;
		a[j + 1 >> 0] = a[22287] | 0;
		a[j + 2 >> 0] = a[22288] | 0;
		a[j + 3 >> 0] = a[22289] | 0;
		a[j + 4 >> 0] = a[22290] | 0;
		a[j + 5 >> 0] = a[22291] | 0;
		ti(j + 1 | 0, 22292, 0, c[e + 4 >> 2] | 0);
		q = Wh() | 0;
		c[h >> 2] = g;
		g = k + (On(k, 12, q, j, h) | 0) | 0;
		j = ui(k, g, e) | 0;
		q = mg(e) | 0;
		c[o >> 2] = q;
		vi(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[d >> 2];
		d = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = cc(h, l, d, m, e, f) | 0;
		i = b;
		return p | 0
	}

	function yi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		a = i;
		i = i + 112 | 0;
		h = a;
		j = a + 8 | 0;
		k = a + 32 | 0;
		l = a + 55 | 0;
		m = a + 16 | 0;
		n = a + 24 | 0;
		o = a + 20 | 0;
		p = a + 28 | 0;
		q = j;
		c[q >> 2] = 37;
		c[q + 4 >> 2] = 0;
		ti(j + 1 | 0, 22294, 0, c[d + 4 >> 2] | 0);
		q = Wh() | 0;
		r = h;
		c[r >> 2] = f;
		c[r + 4 >> 2] = g;
		g = k + (On(k, 23, q, j, h) | 0) | 0;
		j = ui(k, g, d) | 0;
		q = mg(d) | 0;
		c[o >> 2] = q;
		vi(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[b >> 2];
		b = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = cc(h, l, b, m, d, e) | 0;
		i = a;
		return p | 0
	}

	function zi(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		var g = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		a = i;
		i = i + 160 | 0;
		g = a + 52 | 0;
		j = a + 16 | 0;
		k = a + 40 | 0;
		l = a;
		m = a + 32 | 0;
		n = a + 72 | 0;
		o = a + 68 | 0;
		p = a + 102 | 0;
		q = a + 64 | 0;
		r = a + 60 | 0;
		s = a + 48 | 0;
		t = a + 56 | 0;
		u = m;
		c[u >> 2] = 37;
		c[u + 4 >> 2] = 0;
		u = Ai(m + 1 | 0, 22297, c[d + 4 >> 2] | 0) | 0;
		c[o >> 2] = n;
		v = Wh() | 0;
		if (u) {
			c[l >> 2] = c[d + 8 >> 2];
			h[l + 8 >> 3] = f;
			w = On(n, 30, v, m, l) | 0
		} else {
			h[k >> 3] = f;
			w = On(n, 30, v, m, k) | 0
		}
		if ((w | 0) > 29) {
			k = Wh() | 0;
			c[j >> 2] = c[d + 8 >> 2];
			h[j + 8 >> 3] = f;
			v = Pn(o, k, m, j) | 0;
			j = c[o >> 2] | 0;
			if (!j) md();
			else {
				x = j;
				y = j;
				z = v
			}
		} else {
			x = c[o >> 2] | 0;
			y = 0;
			z = w
		}
		w = x + z | 0;
		o = ui(x, w, d) | 0;
		if ((x | 0) != (n | 0)) {
			v = qd(z << 1) | 0;
			if (!v) md();
			else {
				A = x;
				B = v;
				C = v
			}
		} else {
			A = n;
			B = 0;
			C = p
		}
		p = mg(d) | 0;
		c[s >> 2] = p;
		Bi(A, o, w, C, q, r, s);
		ep(p) | 0;
		c[t >> 2] = c[b >> 2];
		b = c[q >> 2] | 0;
		q = c[r >> 2] | 0;
		c[g >> 2] = c[t >> 2];
		t = cc(g, C, b, q, d, e) | 0;
		rd(B);
		rd(y);
		i = a;
		return t | 0
	}

	function Ai(b, c, d) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		if (!(d & 2048)) e = b;
		else {
			a[b >> 0] = 43;
			e = b + 1 | 0
		}
		if (!(d & 1024)) f = e;
		else {
			a[e >> 0] = 35;
			f = e + 1 | 0
		}
		e = d & 260;
		b = d >>> 14;
		d = (e | 0) == 260;
		if (d) {
			g = f;
			h = 0
		} else {
			a[f >> 0] = 46;
			a[f + 1 >> 0] = 42;
			g = f + 2 | 0;
			h = 1
		}
		f = a[c >> 0] | 0;
		if (!(f << 24 >> 24)) i = g;
		else {
			j = c;
			c = g;
			g = f;
			while (1) {
				j = j + 1 | 0;
				f = c + 1 | 0;
				a[c >> 0] = g;
				g = a[j >> 0] | 0;
				if (!(g << 24 >> 24)) {
					i = f;
					break
				} else c = f
			}
		}
		a: do switch (e | 0) {
				case 4:
					{
						if (!(b & 1)) {
							a[i >> 0] = 102;
							break a
						} else {
							a[i >> 0] = 70;
							break a
						}
						break
					}
				case 256:
					{
						if (!(b & 1)) {
							a[i >> 0] = 101;
							break a
						} else {
							a[i >> 0] = 69;
							break a
						}
						break
					}
				default:
					{
						c = (b & 1 | 0) != 0;
						if (d)
							if (c) {
								a[i >> 0] = 65;
								break a
							} else {
								a[i >> 0] = 97;
								break a
							}
						else if (c) {
							a[i >> 0] = 71;
							break a
						} else {
							a[i >> 0] = 103;
							break a
						}
					}
			}
			while (0);
			return h | 0
	}

	function Bi(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0;
		k = i;
		i = i + 16 | 0;
		l = k;
		m = Gl(j, 9868) | 0;
		n = Gl(j, 10008) | 0;
		ub[c[(c[n >> 2] | 0) + 20 >> 2] & 63](l, n);
		c[h >> 2] = f;
		j = a[b >> 0] | 0;
		switch (j << 24 >> 24) {
			case 43:
			case 45:
				{
					o = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, j) | 0;j = c[h >> 2] | 0;c[h >> 2] = j + 1;a[j >> 0] = o;p = b + 1 | 0;
					break
				}
			default:
				p = b
		}
		o = e;
		a: do
			if ((o - p | 0) > 1 ? (a[p >> 0] | 0) == 48 : 0) {
				j = p + 1 | 0;
				switch (a[j >> 0] | 0) {
					case 88:
					case 120:
						break;
					default:
						{
							q = 4;
							break a
						}
				}
				r = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, 48) | 0;
				s = c[h >> 2] | 0;
				c[h >> 2] = s + 1;
				a[s >> 0] = r;
				r = p + 2 | 0;
				s = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, a[j >> 0] | 0) | 0;
				j = c[h >> 2] | 0;
				c[h >> 2] = j + 1;
				a[j >> 0] = s;
				if (r >>> 0 < e >>> 0) {
					s = r;
					while (1) {
						j = a[s >> 0] | 0;
						if (!(Nd(j, Wh() | 0) | 0)) {
							t = r;
							u = s;
							break a
						}
						j = s + 1 | 0;
						if (j >>> 0 < e >>> 0) s = j;
						else {
							t = r;
							u = j;
							break
						}
					}
				} else {
					t = r;
					u = r
				}
			} else q = 4; while (0);
		b: do
			if ((q | 0) == 4)
				if (p >>> 0 < e >>> 0) {
					s = p;
					while (1) {
						j = a[s >> 0] | 0;
						if (!(Md(j, Wh() | 0) | 0)) {
							t = p;
							u = s;
							break b
						}
						j = s + 1 | 0;
						if (j >>> 0 < e >>> 0) s = j;
						else {
							t = p;
							u = j;
							break
						}
					}
				} else {
					t = p;
					u = p
				}
		while (0);
		p = a[l >> 0] | 0;
		q = l + 4 | 0;
		if (((p & 1) == 0 ? (p & 255) >>> 1 : c[q >> 2] | 0) | 0) {
			if ((t | 0) != (u | 0) ? (p = u + -1 | 0, t >>> 0 < p >>> 0) : 0) {
				s = t;
				r = p;
				do {
					p = a[s >> 0] | 0;
					a[s >> 0] = a[r >> 0] | 0;
					a[r >> 0] = p;
					s = s + 1 | 0;
					r = r + -1 | 0
				} while (s >>> 0 < r >>> 0)
			}
			r = xb[c[(c[n >> 2] | 0) + 16 >> 2] & 63](n) | 0;
			s = l + 8 | 0;
			p = l + 1 | 0;
			if (t >>> 0 < u >>> 0) {
				j = 0;
				v = 0;
				w = t;
				while (1) {
					x = a[((a[l >> 0] & 1) == 0 ? p : c[s >> 2] | 0) + v >> 0] | 0;
					if (x << 24 >> 24 > 0 & (j | 0) == (x << 24 >> 24 | 0)) {
						x = c[h >> 2] | 0;
						c[h >> 2] = x + 1;
						a[x >> 0] = r;
						x = a[l >> 0] | 0;
						y = 0;
						z = (v >>> 0 < (((x & 1) == 0 ? (x & 255) >>> 1 : c[q >> 2] | 0) + -1 | 0) >>> 0 & 1) + v | 0
					} else {
						y = j;
						z = v
					}
					x = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, a[w >> 0] | 0) | 0;
					A = c[h >> 2] | 0;
					c[h >> 2] = A + 1;
					a[A >> 0] = x;
					w = w + 1 | 0;
					if (w >>> 0 >= u >>> 0) break;
					else {
						j = y + 1 | 0;
						v = z
					}
				}
			}
			z = f + (t - b) | 0;
			v = c[h >> 2] | 0;
			if ((z | 0) != (v | 0) ? (y = v + -1 | 0, z >>> 0 < y >>> 0) : 0) {
				v = z;
				z = y;
				do {
					y = a[v >> 0] | 0;
					a[v >> 0] = a[z >> 0] | 0;
					a[z >> 0] = y;
					v = v + 1 | 0;
					z = z + -1 | 0
				} while (v >>> 0 < z >>> 0);
				B = m
			} else B = m
		} else {
			Bb[c[(c[m >> 2] | 0) + 32 >> 2] & 7](m, t, u, c[h >> 2] | 0) | 0;
			c[h >> 2] = (c[h >> 2] | 0) + (u - t);
			B = m
		}
		c: do
			if (u >>> 0 < e >>> 0) {
				t = u;
				while (1) {
					z = a[t >> 0] | 0;
					if (z << 24 >> 24 == 46) {
						C = t;
						break
					}
					v = Db[c[(c[B >> 2] | 0) + 28 >> 2] & 31](m, z) | 0;
					z = c[h >> 2] | 0;
					c[h >> 2] = z + 1;
					a[z >> 0] = v;
					v = t + 1 | 0;
					if (v >>> 0 < e >>> 0) t = v;
					else {
						D = v;
						break c
					}
				}
				t = xb[c[(c[n >> 2] | 0) + 12 >> 2] & 63](n) | 0;
				v = c[h >> 2] | 0;
				c[h >> 2] = v + 1;
				a[v >> 0] = t;
				D = C + 1 | 0
			} else D = u; while (0);
		Bb[c[(c[m >> 2] | 0) + 32 >> 2] & 7](m, D, e, c[h >> 2] | 0) | 0;
		m = (c[h >> 2] | 0) + (o - D) | 0;
		c[h >> 2] = m;
		c[g >> 2] = (d | 0) == (e | 0) ? m : f + (d - b) | 0;
		Of(l);
		i = k;
		return
	}

	function Ci(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		var g = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0;
		a = i;
		i = i + 176 | 0;
		g = a + 76 | 0;
		j = a + 16 | 0;
		k = a + 40 | 0;
		l = a + 8 | 0;
		m = a + 24 | 0;
		n = a;
		o = a + 80 | 0;
		p = a + 60 | 0;
		q = a + 110 | 0;
		r = a + 72 | 0;
		s = a + 68 | 0;
		t = a + 56 | 0;
		u = a + 64 | 0;
		v = n;
		c[v >> 2] = 37;
		c[v + 4 >> 2] = 0;
		v = Ai(n + 1 | 0, 22298, c[d + 4 >> 2] | 0) | 0;
		c[p >> 2] = o;
		w = Wh() | 0;
		if (v) {
			c[m >> 2] = c[d + 8 >> 2];
			h[m + 8 >> 3] = f;
			x = On(o, 30, w, n, m) | 0
		} else {
			h[l >> 3] = f;
			x = On(o, 30, w, n, l) | 0
		}
		if ((x | 0) > 29) {
			l = Wh() | 0;
			if (v) {
				c[k >> 2] = c[d + 8 >> 2];
				h[k + 8 >> 3] = f;
				y = Pn(p, l, n, k) | 0
			} else {
				h[j >> 3] = f;
				y = Pn(p, l, n, j) | 0
			}
			j = c[p >> 2] | 0;
			if (!j) md();
			else {
				z = j;
				A = j;
				B = y
			}
		} else {
			z = c[p >> 2] | 0;
			A = 0;
			B = x
		}
		x = z + B | 0;
		p = ui(z, x, d) | 0;
		if ((z | 0) != (o | 0)) {
			y = qd(B << 1) | 0;
			if (!y) md();
			else {
				C = z;
				D = y;
				E = y
			}
		} else {
			C = o;
			D = 0;
			E = q
		}
		q = mg(d) | 0;
		c[t >> 2] = q;
		Bi(C, p, x, E, r, s, t);
		ep(q) | 0;
		c[u >> 2] = c[b >> 2];
		b = c[r >> 2] | 0;
		r = c[s >> 2] | 0;
		c[g >> 2] = c[u >> 2];
		u = cc(g, E, b, r, d, e) | 0;
		rd(D);
		rd(A);
		i = a;
		return u | 0
	}

	function Di(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 80 | 0;
		h = b;
		j = b + 72 | 0;
		k = b + 52 | 0;
		l = b + 12 | 0;
		m = b + 8 | 0;
		n = b + 4 | 0;
		a[j >> 0] = a[22300] | 0;
		a[j + 1 >> 0] = a[22301] | 0;
		a[j + 2 >> 0] = a[22302] | 0;
		a[j + 3 >> 0] = a[22303] | 0;
		a[j + 4 >> 0] = a[22304] | 0;
		a[j + 5 >> 0] = a[22305] | 0;
		o = Wh() | 0;
		c[h >> 2] = g;
		g = On(k, 20, o, j, h) | 0;
		j = k + g | 0;
		o = ui(k, j, e) | 0;
		p = mg(e) | 0;
		c[m >> 2] = p;
		q = Gl(m, 9868) | 0;
		ep(p) | 0;
		Bb[c[(c[q >> 2] | 0) + 32 >> 2] & 7](q, k, j, l) | 0;
		q = l + g | 0;
		c[n >> 2] = c[d >> 2];
		c[h >> 2] = c[n >> 2];
		n = cc(h, l, (o | 0) == (j | 0) ? q : l + (o - k) | 0, q, e, f) | 0;
		i = b;
		return n | 0
	}

	function Ei(a) {
		a = a | 0;
		return
	}

	function Fi(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Gi(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0;
		h = i;
		i = i + 32 | 0;
		j = h + 20 | 0;
		k = h + 16 | 0;
		l = h + 12 | 0;
		m = h;
		if (!(c[e + 4 >> 2] & 1)) {
			n = c[(c[b >> 2] | 0) + 24 >> 2] | 0;
			c[k >> 2] = c[d >> 2];
			c[j >> 2] = c[k >> 2];
			o = Eb[n & 31](b, j, e, f, g & 1) | 0
		} else {
			f = mg(e) | 0;
			c[l >> 2] = f;
			e = Gl(l, 10016) | 0;
			ep(f) | 0;
			f = c[e >> 2] | 0;
			if (g) ub[c[f + 24 >> 2] & 63](m, e);
			else ub[c[f + 28 >> 2] & 63](m, e);
			e = a[m >> 0] | 0;
			f = (e & 1) == 0;
			g = m + 4 | 0;
			l = m + 8 | 0;
			j = f ? g : m + 4 | 0;
			b = f ? g : c[m + 8 >> 2] | 0;
			g = (e & 1) == 0;
			if ((b | 0) != ((g ? j : c[l >> 2] | 0) + ((g ? (e & 255) >>> 1 : c[j >> 2] | 0) << 2) | 0)) {
				e = b;
				do {
					b = c[e >> 2] | 0;
					g = c[d >> 2] | 0;
					if (g) {
						f = g + 24 | 0;
						n = c[f >> 2] | 0;
						if ((n | 0) == (c[g + 28 >> 2] | 0)) p = Db[c[(c[g >> 2] | 0) + 52 >> 2] & 31](g, b) | 0;
						else {
							c[f >> 2] = n + 4;
							c[n >> 2] = b;
							p = b
						}
						if ((p | 0) == -1) c[d >> 2] = 0
					}
					e = e + 4 | 0;
					b = a[m >> 0] | 0;
					n = (b & 1) == 0
				} while ((e | 0) != ((n ? j : c[l >> 2] | 0) + ((n ? (b & 255) >>> 1 : c[j >> 2] | 0) << 2) | 0))
			}
			j = c[d >> 2] | 0;
			_f(m);
			o = j
		}
		i = h;
		return o | 0
	}

	function Hi(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 128 | 0;
		h = b;
		j = b + 104 | 0;
		k = b + 112 | 0;
		l = b + 8 | 0;
		m = b + 4 | 0;
		n = b + 96 | 0;
		o = b + 92 | 0;
		p = b + 100 | 0;
		a[j >> 0] = a[22286] | 0;
		a[j + 1 >> 0] = a[22287] | 0;
		a[j + 2 >> 0] = a[22288] | 0;
		a[j + 3 >> 0] = a[22289] | 0;
		a[j + 4 >> 0] = a[22290] | 0;
		a[j + 5 >> 0] = a[22291] | 0;
		ti(j + 1 | 0, 22292, 1, c[e + 4 >> 2] | 0);
		q = Wh() | 0;
		c[h >> 2] = g;
		g = k + (On(k, 12, q, j, h) | 0) | 0;
		j = ui(k, g, e) | 0;
		q = mg(e) | 0;
		c[o >> 2] = q;
		Ii(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[d >> 2];
		d = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = Qn(h, l, d, m, e, f) | 0;
		i = b;
		return p | 0
	}

	function Ii(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		k = i;
		i = i + 16 | 0;
		l = k;
		m = Gl(j, 9860) | 0;
		n = Gl(j, 10016) | 0;
		ub[c[(c[n >> 2] | 0) + 20 >> 2] & 63](l, n);
		j = a[l >> 0] | 0;
		o = l + 4 | 0;
		if (((j & 1) == 0 ? (j & 255) >>> 1 : c[o >> 2] | 0) | 0) {
			c[h >> 2] = f;
			j = a[b >> 0] | 0;
			switch (j << 24 >> 24) {
				case 43:
				case 45:
					{
						p = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, j) | 0;j = c[h >> 2] | 0;c[h >> 2] = j + 4;c[j >> 2] = p;q = b + 1 | 0;
						break
					}
				default:
					q = b
			}
			a: do
				if ((e - q | 0) > 1 ? (a[q >> 0] | 0) == 48 : 0) {
					p = q + 1 | 0;
					switch (a[p >> 0] | 0) {
						case 88:
						case 120:
							break;
						default:
							{
								r = q;
								break a
							}
					}
					j = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, 48) | 0;
					s = c[h >> 2] | 0;
					c[h >> 2] = s + 4;
					c[s >> 2] = j;
					j = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, a[p >> 0] | 0) | 0;
					p = c[h >> 2] | 0;
					c[h >> 2] = p + 4;
					c[p >> 2] = j;
					r = q + 2 | 0
				} else r = q; while (0);
			if ((r | 0) != (e | 0) ? (q = e + -1 | 0, r >>> 0 < q >>> 0) : 0) {
				j = r;
				p = q;
				do {
					q = a[j >> 0] | 0;
					a[j >> 0] = a[p >> 0] | 0;
					a[p >> 0] = q;
					j = j + 1 | 0;
					p = p + -1 | 0
				} while (j >>> 0 < p >>> 0)
			}
			p = xb[c[(c[n >> 2] | 0) + 16 >> 2] & 63](n) | 0;
			n = l + 8 | 0;
			j = l + 1 | 0;
			if (r >>> 0 < e >>> 0) {
				q = 0;
				s = 0;
				t = r;
				while (1) {
					u = a[((a[l >> 0] & 1) == 0 ? j : c[n >> 2] | 0) + s >> 0] | 0;
					if (u << 24 >> 24 != 0 & (q | 0) == (u << 24 >> 24 | 0)) {
						u = c[h >> 2] | 0;
						c[h >> 2] = u + 4;
						c[u >> 2] = p;
						u = a[l >> 0] | 0;
						v = 0;
						w = (s >>> 0 < (((u & 1) == 0 ? (u & 255) >>> 1 : c[o >> 2] | 0) + -1 | 0) >>> 0 & 1) + s | 0
					} else {
						v = q;
						w = s
					}
					u = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, a[t >> 0] | 0) | 0;
					x = c[h >> 2] | 0;
					c[h >> 2] = x + 4;
					c[x >> 2] = u;
					t = t + 1 | 0;
					if (t >>> 0 >= e >>> 0) break;
					else {
						q = v + 1 | 0;
						s = w
					}
				}
			}
			w = b;
			s = f + (r - w << 2) | 0;
			r = c[h >> 2] | 0;
			if ((s | 0) != (r | 0)) {
				v = r + -4 | 0;
				if (s >>> 0 < v >>> 0) {
					q = s;
					t = v;
					do {
						v = c[q >> 2] | 0;
						c[q >> 2] = c[t >> 2];
						c[t >> 2] = v;
						q = q + 4 | 0;
						t = t + -4 | 0
					} while (q >>> 0 < t >>> 0);
					y = w;
					z = r
				} else {
					y = w;
					z = r
				}
			} else {
				y = w;
				z = s
			}
		} else {
			Bb[c[(c[m >> 2] | 0) + 48 >> 2] & 7](m, b, e, f) | 0;
			m = b;
			b = f + (e - m << 2) | 0;
			c[h >> 2] = b;
			y = m;
			z = b
		}
		c[g >> 2] = (d | 0) == (e | 0) ? z : f + (d - y << 2) | 0;
		Of(l);
		i = k;
		return
	}

	function Ji(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		a = i;
		i = i + 224 | 0;
		h = a;
		j = a + 8 | 0;
		k = a + 196 | 0;
		l = a + 24 | 0;
		m = a + 20 | 0;
		n = a + 16 | 0;
		o = a + 188 | 0;
		p = a + 192 | 0;
		q = j;
		c[q >> 2] = 37;
		c[q + 4 >> 2] = 0;
		ti(j + 1 | 0, 22294, 1, c[d + 4 >> 2] | 0);
		q = Wh() | 0;
		r = h;
		c[r >> 2] = f;
		c[r + 4 >> 2] = g;
		g = k + (On(k, 22, q, j, h) | 0) | 0;
		j = ui(k, g, d) | 0;
		q = mg(d) | 0;
		c[o >> 2] = q;
		Ii(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[b >> 2];
		b = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = Qn(h, l, b, m, d, e) | 0;
		i = a;
		return p | 0
	}

	function Ki(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 128 | 0;
		h = b;
		j = b + 104 | 0;
		k = b + 112 | 0;
		l = b + 8 | 0;
		m = b + 4 | 0;
		n = b + 96 | 0;
		o = b + 92 | 0;
		p = b + 100 | 0;
		a[j >> 0] = a[22286] | 0;
		a[j + 1 >> 0] = a[22287] | 0;
		a[j + 2 >> 0] = a[22288] | 0;
		a[j + 3 >> 0] = a[22289] | 0;
		a[j + 4 >> 0] = a[22290] | 0;
		a[j + 5 >> 0] = a[22291] | 0;
		ti(j + 1 | 0, 22292, 0, c[e + 4 >> 2] | 0);
		q = Wh() | 0;
		c[h >> 2] = g;
		g = k + (On(k, 12, q, j, h) | 0) | 0;
		j = ui(k, g, e) | 0;
		q = mg(e) | 0;
		c[o >> 2] = q;
		Ii(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[d >> 2];
		d = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = Qn(h, l, d, m, e, f) | 0;
		i = b;
		return p | 0
	}

	function Li(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		a = i;
		i = i + 240 | 0;
		h = a;
		j = a + 8 | 0;
		k = a + 204 | 0;
		l = a + 24 | 0;
		m = a + 20 | 0;
		n = a + 16 | 0;
		o = a + 196 | 0;
		p = a + 200 | 0;
		q = j;
		c[q >> 2] = 37;
		c[q + 4 >> 2] = 0;
		ti(j + 1 | 0, 22294, 0, c[d + 4 >> 2] | 0);
		q = Wh() | 0;
		r = h;
		c[r >> 2] = f;
		c[r + 4 >> 2] = g;
		g = k + (On(k, 23, q, j, h) | 0) | 0;
		j = ui(k, g, d) | 0;
		q = mg(d) | 0;
		c[o >> 2] = q;
		Ii(k, j, g, l, m, n, o);
		ep(q) | 0;
		c[p >> 2] = c[b >> 2];
		b = c[m >> 2] | 0;
		m = c[n >> 2] | 0;
		c[h >> 2] = c[p >> 2];
		p = Qn(h, l, b, m, d, e) | 0;
		i = a;
		return p | 0
	}

	function Mi(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		var g = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		a = i;
		i = i + 336 | 0;
		g = a + 280 | 0;
		j = a + 16 | 0;
		k = a + 40 | 0;
		l = a;
		m = a + 32 | 0;
		n = a + 300 | 0;
		o = a + 296 | 0;
		p = a + 52 | 0;
		q = a + 48 | 0;
		r = a + 288 | 0;
		s = a + 284 | 0;
		t = a + 292 | 0;
		u = m;
		c[u >> 2] = 37;
		c[u + 4 >> 2] = 0;
		u = Ai(m + 1 | 0, 22297, c[d + 4 >> 2] | 0) | 0;
		c[o >> 2] = n;
		v = Wh() | 0;
		if (u) {
			c[l >> 2] = c[d + 8 >> 2];
			h[l + 8 >> 3] = f;
			w = On(n, 30, v, m, l) | 0
		} else {
			h[k >> 3] = f;
			w = On(n, 30, v, m, k) | 0
		}
		if ((w | 0) > 29) {
			k = Wh() | 0;
			c[j >> 2] = c[d + 8 >> 2];
			h[j + 8 >> 3] = f;
			v = Pn(o, k, m, j) | 0;
			j = c[o >> 2] | 0;
			if (!j) md();
			else {
				x = j;
				y = j;
				z = v
			}
		} else {
			x = c[o >> 2] | 0;
			y = 0;
			z = w
		}
		w = x + z | 0;
		o = ui(x, w, d) | 0;
		if ((x | 0) != (n | 0)) {
			v = qd(z << 3) | 0;
			if (!v) md();
			else {
				A = x;
				B = v;
				C = v
			}
		} else {
			A = n;
			B = 0;
			C = p
		}
		p = mg(d) | 0;
		c[s >> 2] = p;
		Ni(A, o, w, C, q, r, s);
		ep(p) | 0;
		c[t >> 2] = c[b >> 2];
		p = c[q >> 2] | 0;
		q = c[r >> 2] | 0;
		c[g >> 2] = c[t >> 2];
		t = Qn(g, C, p, q, d, e) | 0;
		c[b >> 2] = t;
		if (B) rd(B);
		rd(y);
		i = a;
		return t | 0
	}

	function Ni(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0;
		k = i;
		i = i + 16 | 0;
		l = k;
		m = Gl(j, 9860) | 0;
		n = Gl(j, 10016) | 0;
		ub[c[(c[n >> 2] | 0) + 20 >> 2] & 63](l, n);
		c[h >> 2] = f;
		j = a[b >> 0] | 0;
		switch (j << 24 >> 24) {
			case 43:
			case 45:
				{
					o = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, j) | 0;j = c[h >> 2] | 0;c[h >> 2] = j + 4;c[j >> 2] = o;p = b + 1 | 0;
					break
				}
			default:
				p = b
		}
		o = e;
		a: do
			if ((o - p | 0) > 1 ? (a[p >> 0] | 0) == 48 : 0) {
				j = p + 1 | 0;
				switch (a[j >> 0] | 0) {
					case 88:
					case 120:
						break;
					default:
						{
							q = 4;
							break a
						}
				}
				r = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, 48) | 0;
				s = c[h >> 2] | 0;
				c[h >> 2] = s + 4;
				c[s >> 2] = r;
				r = p + 2 | 0;
				s = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, a[j >> 0] | 0) | 0;
				j = c[h >> 2] | 0;
				c[h >> 2] = j + 4;
				c[j >> 2] = s;
				if (r >>> 0 < e >>> 0) {
					s = r;
					while (1) {
						j = a[s >> 0] | 0;
						if (!(Nd(j, Wh() | 0) | 0)) {
							t = r;
							u = s;
							break a
						}
						j = s + 1 | 0;
						if (j >>> 0 < e >>> 0) s = j;
						else {
							t = r;
							u = j;
							break
						}
					}
				} else {
					t = r;
					u = r
				}
			} else q = 4; while (0);
		b: do
			if ((q | 0) == 4)
				if (p >>> 0 < e >>> 0) {
					s = p;
					while (1) {
						j = a[s >> 0] | 0;
						if (!(Md(j, Wh() | 0) | 0)) {
							t = p;
							u = s;
							break b
						}
						j = s + 1 | 0;
						if (j >>> 0 < e >>> 0) s = j;
						else {
							t = p;
							u = j;
							break
						}
					}
				} else {
					t = p;
					u = p
				}
		while (0);
		p = a[l >> 0] | 0;
		q = l + 4 | 0;
		if (((p & 1) == 0 ? (p & 255) >>> 1 : c[q >> 2] | 0) | 0) {
			if ((t | 0) != (u | 0) ? (p = u + -1 | 0, t >>> 0 < p >>> 0) : 0) {
				s = t;
				r = p;
				do {
					p = a[s >> 0] | 0;
					a[s >> 0] = a[r >> 0] | 0;
					a[r >> 0] = p;
					s = s + 1 | 0;
					r = r + -1 | 0
				} while (s >>> 0 < r >>> 0)
			}
			r = xb[c[(c[n >> 2] | 0) + 16 >> 2] & 63](n) | 0;
			s = l + 8 | 0;
			p = l + 1 | 0;
			if (t >>> 0 < u >>> 0) {
				j = 0;
				v = 0;
				w = t;
				while (1) {
					x = a[((a[l >> 0] & 1) == 0 ? p : c[s >> 2] | 0) + v >> 0] | 0;
					if (x << 24 >> 24 > 0 & (j | 0) == (x << 24 >> 24 | 0)) {
						x = c[h >> 2] | 0;
						c[h >> 2] = x + 4;
						c[x >> 2] = r;
						x = a[l >> 0] | 0;
						y = 0;
						z = (v >>> 0 < (((x & 1) == 0 ? (x & 255) >>> 1 : c[q >> 2] | 0) + -1 | 0) >>> 0 & 1) + v | 0
					} else {
						y = j;
						z = v
					}
					x = Db[c[(c[m >> 2] | 0) + 44 >> 2] & 31](m, a[w >> 0] | 0) | 0;
					A = c[h >> 2] | 0;
					c[h >> 2] = A + 4;
					c[A >> 2] = x;
					w = w + 1 | 0;
					if (w >>> 0 >= u >>> 0) break;
					else {
						j = y + 1 | 0;
						v = z
					}
				}
			}
			z = f + (t - b << 2) | 0;
			v = c[h >> 2] | 0;
			if ((z | 0) != (v | 0)) {
				y = v + -4 | 0;
				if (z >>> 0 < y >>> 0) {
					j = z;
					w = y;
					do {
						y = c[j >> 2] | 0;
						c[j >> 2] = c[w >> 2];
						c[w >> 2] = y;
						j = j + 4 | 0;
						w = w + -4 | 0
					} while (j >>> 0 < w >>> 0);
					B = m;
					C = v
				} else {
					B = m;
					C = v
				}
			} else {
				B = m;
				C = z
			}
		} else {
			Bb[c[(c[m >> 2] | 0) + 48 >> 2] & 7](m, t, u, c[h >> 2] | 0) | 0;
			z = (c[h >> 2] | 0) + (u - t << 2) | 0;
			c[h >> 2] = z;
			B = m;
			C = z
		}
		c: do
			if (u >>> 0 < e >>> 0) {
				z = u;
				while (1) {
					t = a[z >> 0] | 0;
					if (t << 24 >> 24 == 46) {
						D = z;
						break
					}
					v = Db[c[(c[B >> 2] | 0) + 44 >> 2] & 31](m, t) | 0;
					t = c[h >> 2] | 0;
					w = t + 4 | 0;
					c[h >> 2] = w;
					c[t >> 2] = v;
					v = z + 1 | 0;
					if (v >>> 0 < e >>> 0) z = v;
					else {
						E = w;
						F = v;
						break c
					}
				}
				z = xb[c[(c[n >> 2] | 0) + 12 >> 2] & 63](n) | 0;
				v = c[h >> 2] | 0;
				w = v + 4 | 0;
				c[h >> 2] = w;
				c[v >> 2] = z;
				E = w;
				F = D + 1 | 0
			} else {
				E = C;
				F = u
			}
		while (0);
		Bb[c[(c[m >> 2] | 0) + 48 >> 2] & 7](m, F, e, E) | 0;
		E = (c[h >> 2] | 0) + (o - F << 2) | 0;
		c[h >> 2] = E;
		c[g >> 2] = (d | 0) == (e | 0) ? E : f + (d - b << 2) | 0;
		Of(l);
		i = k;
		return
	}

	function Oi(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		var g = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0;
		a = i;
		i = i + 352 | 0;
		g = a + 304 | 0;
		j = a + 16 | 0;
		k = a + 40 | 0;
		l = a + 8 | 0;
		m = a + 24 | 0;
		n = a;
		o = a + 308 | 0;
		p = a + 288 | 0;
		q = a + 60 | 0;
		r = a + 56 | 0;
		s = a + 300 | 0;
		t = a + 296 | 0;
		u = a + 292 | 0;
		v = n;
		c[v >> 2] = 37;
		c[v + 4 >> 2] = 0;
		v = Ai(n + 1 | 0, 22298, c[d + 4 >> 2] | 0) | 0;
		c[p >> 2] = o;
		w = Wh() | 0;
		if (v) {
			c[m >> 2] = c[d + 8 >> 2];
			h[m + 8 >> 3] = f;
			x = On(o, 30, w, n, m) | 0
		} else {
			h[l >> 3] = f;
			x = On(o, 30, w, n, l) | 0
		}
		if ((x | 0) > 29) {
			l = Wh() | 0;
			if (v) {
				c[k >> 2] = c[d + 8 >> 2];
				h[k + 8 >> 3] = f;
				y = Pn(p, l, n, k) | 0
			} else {
				h[j >> 3] = f;
				y = Pn(p, l, n, j) | 0
			}
			j = c[p >> 2] | 0;
			if (!j) md();
			else {
				z = j;
				A = j;
				B = y
			}
		} else {
			z = c[p >> 2] | 0;
			A = 0;
			B = x
		}
		x = z + B | 0;
		p = ui(z, x, d) | 0;
		if ((z | 0) != (o | 0)) {
			y = qd(B << 3) | 0;
			if (!y) md();
			else {
				C = z;
				D = y;
				E = y
			}
		} else {
			C = o;
			D = 0;
			E = q
		}
		q = mg(d) | 0;
		c[t >> 2] = q;
		Ni(C, p, x, E, r, s, t);
		ep(q) | 0;
		c[u >> 2] = c[b >> 2];
		q = c[r >> 2] | 0;
		r = c[s >> 2] | 0;
		c[g >> 2] = c[u >> 2];
		u = Qn(g, E, q, r, d, e) | 0;
		c[b >> 2] = u;
		if (D) rd(D);
		rd(A);
		i = a;
		return u | 0
	}

	function Pi(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		b = i;
		i = i + 192 | 0;
		h = b;
		j = b + 180 | 0;
		k = b + 160 | 0;
		l = b + 12 | 0;
		m = b + 8 | 0;
		n = b + 4 | 0;
		a[j >> 0] = a[22300] | 0;
		a[j + 1 >> 0] = a[22301] | 0;
		a[j + 2 >> 0] = a[22302] | 0;
		a[j + 3 >> 0] = a[22303] | 0;
		a[j + 4 >> 0] = a[22304] | 0;
		a[j + 5 >> 0] = a[22305] | 0;
		o = Wh() | 0;
		c[h >> 2] = g;
		g = On(k, 20, o, j, h) | 0;
		j = k + g | 0;
		o = ui(k, j, e) | 0;
		p = mg(e) | 0;
		c[m >> 2] = p;
		q = Gl(m, 9860) | 0;
		ep(p) | 0;
		Bb[c[(c[q >> 2] | 0) + 48 >> 2] & 7](q, k, j, l) | 0;
		q = l + (g << 2) | 0;
		c[n >> 2] = c[d >> 2];
		c[h >> 2] = c[n >> 2];
		n = Qn(h, l, (o | 0) == (j | 0) ? q : l + (o - k << 2) | 0, q, e, f) | 0;
		i = b;
		return n | 0
	}

	function Qi(e, f, g, h, j, k, l, m) {
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0;
		n = i;
		i = i + 32 | 0;
		o = n + 16 | 0;
		p = n + 12 | 0;
		q = n + 8 | 0;
		r = n + 4 | 0;
		s = n;
		t = mg(h) | 0;
		c[q >> 2] = t;
		u = Gl(q, 9868) | 0;
		ep(t) | 0;
		c[j >> 2] = 0;
		t = u + 8 | 0;
		q = c[f >> 2] | 0;
		a: do
			if ((l | 0) != (m | 0)) {
				v = l;
				w = q;
				b: while (1) {
					x = w;
					if (w)
						if ((c[w + 12 >> 2] | 0) == (c[w + 16 >> 2] | 0) ? (xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0) == -1 : 0) {
							c[f >> 2] = 0;
							y = 0;
							z = 0
						} else {
							y = w;
							z = x
						}
					else {
						y = 0;
						z = x
					}
					x = (y | 0) == 0;
					A = c[g >> 2] | 0;
					B = A;
					do
						if (A) {
							if ((c[A + 12 >> 2] | 0) == (c[A + 16 >> 2] | 0) ? (xb[c[(c[A >> 2] | 0) + 36 >> 2] & 63](A) | 0) == -1 : 0) {
								c[g >> 2] = 0;
								C = 0;
								D = 11;
								break
							}
							if (x) {
								E = A;
								F = B
							} else {
								G = y;
								D = 12;
								break b
							}
						} else {
							C = B;
							D = 11
						}
					while (0);
					if ((D | 0) == 11) {
						D = 0;
						if (x) {
							G = y;
							D = 12;
							break
						} else {
							E = 0;
							F = C
						}
					}
					c: do
						if ((qb[c[(c[u >> 2] | 0) + 36 >> 2] & 31](u, a[v >> 0] | 0, 0) | 0) << 24 >> 24 == 37) {
							B = v + 1 | 0;
							if ((B | 0) == (m | 0)) {
								H = y;
								D = 15;
								break b
							}
							A = qb[c[(c[u >> 2] | 0) + 36 >> 2] & 31](u, a[B >> 0] | 0, 0) | 0;
							switch (A << 24 >> 24) {
								case 48:
								case 69:
									{
										I = v + 2 | 0;
										if ((I | 0) == (m | 0)) {
											J = y;
											D = 18;
											break b
										}
										K = B;L = qb[c[(c[u >> 2] | 0) + 36 >> 2] & 31](u, a[I >> 0] | 0, 0) | 0;M = A;
										break
									}
								default:
									{
										K = v;L = A;M = 0
									}
							}
							A = c[(c[e >> 2] | 0) + 36 >> 2] | 0;
							c[r >> 2] = z;
							c[s >> 2] = F;
							c[p >> 2] = c[r >> 2];
							c[o >> 2] = c[s >> 2];
							c[f >> 2] = Ab[A & 15](e, p, o, h, j, k, L, M) | 0;
							N = K + 2 | 0
						} else {
							A = a[v >> 0] | 0;
							if (A << 24 >> 24 > -1 ? (I = c[t >> 2] | 0, (b[I + (A << 24 >> 24 << 1) >> 1] & 8192) != 0) : 0) {
								A = v;
								while (1) {
									B = A + 1 | 0;
									if ((B | 0) == (m | 0)) {
										O = m;
										break
									}
									P = a[B >> 0] | 0;
									if (P << 24 >> 24 <= -1) {
										O = B;
										break
									}
									if (!(b[I + (P << 24 >> 24 << 1) >> 1] & 8192)) {
										O = B;
										break
									} else A = B
								}
								A = y;
								I = E;
								B = E;
								while (1) {
									if (A)
										if ((c[A + 12 >> 2] | 0) == (c[A + 16 >> 2] | 0) ? (xb[c[(c[A >> 2] | 0) + 36 >> 2] & 63](A) | 0) == -1 : 0) {
											c[f >> 2] = 0;
											Q = 0
										} else Q = A;
									else Q = 0;
									P = (Q | 0) == 0;
									do
										if (B) {
											if ((c[B + 12 >> 2] | 0) != (c[B + 16 >> 2] | 0))
												if (P) {
													R = I;
													S = B;
													break
												} else {
													N = O;
													break c
												}
											if ((xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) != -1)
												if (P ^ (I | 0) == 0) {
													R = I;
													S = I;
													break
												} else {
													N = O;
													break c
												}
											else {
												c[g >> 2] = 0;
												T = 0;
												D = 37;
												break
											}
										} else {
											T = I;
											D = 37
										}
									while (0);
									if ((D | 0) == 37) {
										D = 0;
										if (P) {
											N = O;
											break c
										} else {
											R = T;
											S = 0
										}
									}
									U = Q + 12 | 0;
									V = c[U >> 2] | 0;
									W = Q + 16 | 0;
									if ((V | 0) == (c[W >> 2] | 0)) X = xb[c[(c[Q >> 2] | 0) + 36 >> 2] & 63](Q) | 0;
									else X = d[V >> 0] | 0;
									if ((X & 255) << 24 >> 24 <= -1) {
										N = O;
										break c
									}
									if (!(b[(c[t >> 2] | 0) + (X << 24 >> 24 << 1) >> 1] & 8192)) {
										N = O;
										break c
									}
									V = c[U >> 2] | 0;
									if ((V | 0) == (c[W >> 2] | 0)) {
										xb[c[(c[Q >> 2] | 0) + 40 >> 2] & 63](Q) | 0;
										A = Q;
										I = R;
										B = S;
										continue
									} else {
										c[U >> 2] = V + 1;
										A = Q;
										I = R;
										B = S;
										continue
									}
								}
							}
							B = y + 12 | 0;
							I = c[B >> 2] | 0;
							A = y + 16 | 0;
							if ((I | 0) == (c[A >> 2] | 0)) Y = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
							else Y = d[I >> 0] | 0;
							I = Db[c[(c[u >> 2] | 0) + 12 >> 2] & 31](u, Y & 255) | 0;
							if (I << 24 >> 24 != (Db[c[(c[u >> 2] | 0) + 12 >> 2] & 31](u, a[v >> 0] | 0) | 0) << 24 >> 24) {
								D = 55;
								break b
							}
							I = c[B >> 2] | 0;
							if ((I | 0) == (c[A >> 2] | 0)) xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
							else c[B >> 2] = I + 1;
							N = v + 1 | 0
						}
					while (0);
					x = c[f >> 2] | 0;
					if ((N | 0) != (m | 0) & (c[j >> 2] | 0) == 0) {
						v = N;
						w = x
					} else {
						Z = x;
						break a
					}
				}
				if ((D | 0) == 12) {
					c[j >> 2] = 4;
					Z = G;
					break
				} else if ((D | 0) == 15) {
					c[j >> 2] = 4;
					Z = H;
					break
				} else if ((D | 0) == 18) {
					c[j >> 2] = 4;
					Z = J;
					break
				} else if ((D | 0) == 55) {
					c[j >> 2] = 4;
					Z = c[f >> 2] | 0;
					break
				}
			} else Z = q; while (0);
		if (Z)
			if ((c[Z + 12 >> 2] | 0) == (c[Z + 16 >> 2] | 0) ? (xb[c[(c[Z >> 2] | 0) + 36 >> 2] & 63](Z) | 0) == -1 : 0) {
				c[f >> 2] = 0;
				_ = 0
			} else _ = Z;
		else _ = 0;
		Z = (_ | 0) == 0;
		f = c[g >> 2] | 0;
		do
			if (f) {
				if ((c[f + 12 >> 2] | 0) == (c[f + 16 >> 2] | 0) ? (xb[c[(c[f >> 2] | 0) + 36 >> 2] & 63](f) | 0) == -1 : 0) {
					c[g >> 2] = 0;
					D = 65;
					break
				}
				if (!Z) D = 66
			} else D = 65; while (0);
		if ((D | 0) == 65 ? Z : 0) D = 66;
		if ((D | 0) == 66) c[j >> 2] = c[j >> 2] | 2;
		i = n;
		return _ | 0
	}

	function Ri(a) {
		a = a | 0;
		return
	}

	function Si(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Ti(a) {
		a = a | 0;
		return 2
	}

	function Ui(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = Qi(a, k, j, e, f, g, 22306, 22314) | 0;
		i = h;
		return m | 0
	}

	function Vi(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		j = i;
		i = i + 16 | 0;
		k = j + 12 | 0;
		l = j + 8 | 0;
		m = j + 4 | 0;
		n = j;
		o = b + 8 | 0;
		p = xb[c[(c[o >> 2] | 0) + 20 >> 2] & 63](o) | 0;
		c[m >> 2] = c[d >> 2];
		c[n >> 2] = c[e >> 2];
		e = a[p >> 0] | 0;
		d = (e & 1) == 0;
		o = d ? p + 1 | 0 : c[p + 8 >> 2] | 0;
		q = o + (d ? (e & 255) >>> 1 : c[p + 4 >> 2] | 0) | 0;
		c[l >> 2] = c[m >> 2];
		c[k >> 2] = c[n >> 2];
		n = Qi(b, l, k, f, g, h, o, q) | 0;
		i = j;
		return n | 0
	}

	function Wi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9868) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		Xi(a, g + 24 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function Xi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 4 | 0;
		k = h;
		l = a + 8 | 0;
		a = xb[c[c[l >> 2] >> 2] & 63](l) | 0;
		c[k >> 2] = c[e >> 2];
		c[j >> 2] = c[k >> 2];
		k = (tn(d, j, a, a + 168 | 0, g, f, 0) | 0) - a | 0;
		if ((k | 0) < 168) c[b >> 2] = ((k | 0) / 12 | 0 | 0) % 7 | 0;
		i = h;
		return
	}

	function Yi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9868) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		Zi(a, g + 16 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function Zi(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 4 | 0;
		k = h;
		l = a + 8 | 0;
		a = xb[c[(c[l >> 2] | 0) + 4 >> 2] & 63](l) | 0;
		c[k >> 2] = c[e >> 2];
		c[j >> 2] = c[k >> 2];
		k = (tn(d, j, a, a + 288 | 0, g, f, 0) | 0) - a | 0;
		if ((k | 0) < 288) c[b >> 2] = ((k | 0) / 12 | 0 | 0) % 12 | 0;
		i = h;
		return
	}

	function _i(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9868) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		$i(a, g + 20 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function $i(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 4) | 0;
		if (!(c[f >> 2] & 4)) {
			if ((j | 0) < 69) k = j + 2e3 | 0;
			else k = (j + -69 | 0) >>> 0 < 31 ? j + 1900 | 0 : j;
			c[b >> 2] = k + -1900
		}
		i = a;
		return
	}

	function aj(b, d, e, f, g, h, j, k) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0;
		k = i;
		i = i + 144 | 0;
		l = k + 48 | 0;
		m = k + 76 | 0;
		n = k + 92 | 0;
		o = k + 108 | 0;
		p = k + 124 | 0;
		q = k + 8 | 0;
		r = k + 12 | 0;
		s = k + 80 | 0;
		t = k + 16 | 0;
		u = k + 20 | 0;
		v = k + 24 | 0;
		w = k + 28 | 0;
		x = k + 96 | 0;
		y = k + 104 | 0;
		z = k + 112 | 0;
		A = k + 120 | 0;
		B = k + 128 | 0;
		C = k + 132 | 0;
		D = k + 52 | 0;
		E = k + 56 | 0;
		F = k + 60 | 0;
		G = k + 64 | 0;
		H = k + 68 | 0;
		I = k + 72 | 0;
		J = k + 4 | 0;
		K = k;
		L = k + 88 | 0;
		M = k + 84 | 0;
		N = k + 32 | 0;
		O = k + 36 | 0;
		P = k + 100 | 0;
		Q = k + 40 | 0;
		R = k + 116 | 0;
		S = k + 44 | 0;
		c[g >> 2] = 0;
		T = mg(f) | 0;
		c[n >> 2] = T;
		U = Gl(n, 9868) | 0;
		ep(T) | 0;
		do switch (j << 24 >> 24 | 0) {
			case 65:
			case 97:
				{
					c[o >> 2] = c[e >> 2];c[l >> 2] = c[o >> 2];Xi(b, h + 24 | 0, d, l, g, U);V = 26;
					break
				}
			case 104:
			case 66:
			case 98:
				{
					c[p >> 2] = c[e >> 2];c[l >> 2] = c[p >> 2];Zi(b, h + 16 | 0, d, l, g, U);V = 26;
					break
				}
			case 99:
				{
					T = b + 8 | 0;n = xb[c[(c[T >> 2] | 0) + 12 >> 2] & 63](T) | 0;c[q >> 2] = c[d >> 2];c[r >> 2] = c[e >> 2];T = a[n >> 0] | 0;W = (T & 1) == 0;X = W ? n + 1 | 0 : c[n + 8 >> 2] | 0;Y = X + (W ? (T & 255) >>> 1 : c[n + 4 >> 2] | 0) | 0;c[m >> 2] = c[q >> 2];c[l >> 2] = c[r >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, X, Y) | 0;V = 26;
					break
				}
			case 101:
			case 100:
				{
					c[s >> 2] = c[e >> 2];c[l >> 2] = c[s >> 2];bj(b, h + 12 | 0, d, l, g, U);V = 26;
					break
				}
			case 68:
				{
					c[t >> 2] = c[d >> 2];c[u >> 2] = c[e >> 2];c[m >> 2] = c[t >> 2];c[l >> 2] = c[u >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, 22314, 22322) | 0;V = 26;
					break
				}
			case 70:
				{
					c[v >> 2] = c[d >> 2];c[w >> 2] = c[e >> 2];c[m >> 2] = c[v >> 2];c[l >> 2] = c[w >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, 22322, 22330) | 0;V = 26;
					break
				}
			case 72:
				{
					c[x >> 2] = c[e >> 2];c[l >> 2] = c[x >> 2];cj(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 73:
				{
					c[y >> 2] = c[e >> 2];c[l >> 2] = c[y >> 2];dj(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 106:
				{
					c[z >> 2] = c[e >> 2];c[l >> 2] = c[z >> 2];ej(b, h + 28 | 0, d, l, g, U);V = 26;
					break
				}
			case 109:
				{
					c[A >> 2] = c[e >> 2];c[l >> 2] = c[A >> 2];fj(b, h + 16 | 0, d, l, g, U);V = 26;
					break
				}
			case 77:
				{
					c[B >> 2] = c[e >> 2];c[l >> 2] = c[B >> 2];gj(b, h + 4 | 0, d, l, g, U);V = 26;
					break
				}
			case 116:
			case 110:
				{
					c[C >> 2] = c[e >> 2];c[l >> 2] = c[C >> 2];hj(b, d, l, g, U);V = 26;
					break
				}
			case 112:
				{
					c[D >> 2] = c[e >> 2];c[l >> 2] = c[D >> 2];ij(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 114:
				{
					c[E >> 2] = c[d >> 2];c[F >> 2] = c[e >> 2];c[m >> 2] = c[E >> 2];c[l >> 2] = c[F >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, 22330, 22341) | 0;V = 26;
					break
				}
			case 82:
				{
					c[G >> 2] = c[d >> 2];c[H >> 2] = c[e >> 2];c[m >> 2] = c[G >> 2];c[l >> 2] = c[H >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, 22341, 22346) | 0;V = 26;
					break
				}
			case 83:
				{
					c[I >> 2] = c[e >> 2];c[l >> 2] = c[I >> 2];jj(b, h, d, l, g, U);V = 26;
					break
				}
			case 84:
				{
					c[J >> 2] = c[d >> 2];c[K >> 2] = c[e >> 2];c[m >> 2] = c[J >> 2];c[l >> 2] = c[K >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, 22346, 22354) | 0;V = 26;
					break
				}
			case 119:
				{
					c[L >> 2] = c[e >> 2];c[l >> 2] = c[L >> 2];kj(b, h + 24 | 0, d, l, g, U);V = 26;
					break
				}
			case 120:
				{
					Y = c[(c[b >> 2] | 0) + 20 >> 2] | 0;c[M >> 2] = c[d >> 2];c[N >> 2] = c[e >> 2];c[m >> 2] = c[M >> 2];c[l >> 2] = c[N >> 2];Z = vb[Y & 63](b, m, l, f, g, h) | 0;
					break
				}
			case 88:
				{
					Y = b + 8 | 0;X = xb[c[(c[Y >> 2] | 0) + 24 >> 2] & 63](Y) | 0;c[O >> 2] = c[d >> 2];c[P >> 2] = c[e >> 2];Y = a[X >> 0] | 0;n = (Y & 1) == 0;T = n ? X + 1 | 0 : c[X + 8 >> 2] | 0;W = T + (n ? (Y & 255) >>> 1 : c[X + 4 >> 2] | 0) | 0;c[m >> 2] = c[O >> 2];c[l >> 2] = c[P >> 2];c[d >> 2] = Qi(b, m, l, f, g, h, T, W) | 0;V = 26;
					break
				}
			case 121:
				{
					c[Q >> 2] = c[e >> 2];c[l >> 2] = c[Q >> 2];$i(b, h + 20 | 0, d, l, g, U);V = 26;
					break
				}
			case 89:
				{
					c[R >> 2] = c[e >> 2];c[l >> 2] = c[R >> 2];lj(b, h + 20 | 0, d, l, g, U);V = 26;
					break
				}
			case 37:
				{
					c[S >> 2] = c[e >> 2];c[l >> 2] = c[S >> 2];mj(b, d, l, g, U);V = 26;
					break
				}
			default:
				{
					c[g >> 2] = c[g >> 2] | 4;V = 26
				}
		}
		while (0);
		if ((V | 0) == 26) Z = c[d >> 2] | 0;
		i = k;
		return Z | 0
	}

	function bj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j + -1 | 0) >>> 0 < 31 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function cj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 24 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function dj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j + -1 | 0) >>> 0 < 12 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function ej(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 3) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 366 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function fj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 13 & (g & 4 | 0) == 0) c[b >> 2] = j + -1;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function gj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 60 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function hj(a, e, f, g, h) {
		a = a | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		a = h + 8 | 0;
		a: while (1) {
			h = c[e >> 2] | 0;
			do
				if (h)
					if ((c[h + 12 >> 2] | 0) == (c[h + 16 >> 2] | 0))
						if ((xb[c[(c[h >> 2] | 0) + 36 >> 2] & 63](h) | 0) == -1) {
							c[e >> 2] = 0;
							i = 0;
							break
						} else {
							i = c[e >> 2] | 0;
							break
						}
			else i = h;
			else i = 0;
			while (0);
			h = (i | 0) == 0;
			j = c[f >> 2] | 0;
			do
				if (j) {
					if ((c[j + 12 >> 2] | 0) != (c[j + 16 >> 2] | 0))
						if (h) {
							k = j;
							break
						} else {
							l = j;
							break a
						}
					if ((xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0) != -1)
						if (h) {
							k = j;
							break
						} else {
							l = j;
							break a
						}
					else {
						c[f >> 2] = 0;
						m = 12;
						break
					}
				} else m = 12; while (0);
			if ((m | 0) == 12) {
				m = 0;
				if (h) {
					l = 0;
					break
				} else k = 0
			}
			j = c[e >> 2] | 0;
			n = c[j + 12 >> 2] | 0;
			if ((n | 0) == (c[j + 16 >> 2] | 0)) o = xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0;
			else o = d[n >> 0] | 0;
			if ((o & 255) << 24 >> 24 <= -1) {
				l = k;
				break
			}
			if (!(b[(c[a >> 2] | 0) + (o << 24 >> 24 << 1) >> 1] & 8192)) {
				l = k;
				break
			}
			n = c[e >> 2] | 0;
			j = n + 12 | 0;
			p = c[j >> 2] | 0;
			if ((p | 0) == (c[n + 16 >> 2] | 0)) {
				xb[c[(c[n >> 2] | 0) + 40 >> 2] & 63](n) | 0;
				continue
			} else {
				c[j >> 2] = p + 1;
				continue
			}
		}
		k = c[e >> 2] | 0;
		do
			if (k)
				if ((c[k + 12 >> 2] | 0) == (c[k + 16 >> 2] | 0))
					if ((xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0) == -1) {
						c[e >> 2] = 0;
						q = 0;
						break
					} else {
						q = c[e >> 2] | 0;
						break
					}
		else q = k;
		else q = 0;
		while (0);
		k = (q | 0) == 0;
		do
			if (l) {
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					m = 32;
					break
				}
				if (!k) m = 33
			} else m = 32; while (0);
		if ((m | 0) == 32 ? k : 0) m = 33;
		if ((m | 0) == 33) c[g >> 2] = c[g >> 2] | 2;
		return
	}

	function ij(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0;
		j = i;
		i = i + 16 | 0;
		k = j + 4 | 0;
		l = j;
		m = b + 8 | 0;
		b = xb[c[(c[m >> 2] | 0) + 8 >> 2] & 63](m) | 0;
		m = a[b >> 0] | 0;
		if (!(m & 1)) n = (m & 255) >>> 1;
		else n = c[b + 4 >> 2] | 0;
		m = a[b + 12 >> 0] | 0;
		if (!(m & 1)) o = (m & 255) >>> 1;
		else o = c[b + 16 >> 2] | 0;
		do
			if ((n | 0) != (0 - o | 0)) {
				c[l >> 2] = c[f >> 2];
				c[k >> 2] = c[l >> 2];
				m = tn(e, k, b, b + 24 | 0, h, g, 0) | 0;
				p = c[d >> 2] | 0;
				if ((m | 0) == (b | 0) & (p | 0) == 12) {
					c[d >> 2] = 0;
					break
				}
				if ((p | 0) < 12 & (m - b | 0) == 12) c[d >> 2] = p + 12
			} else c[g >> 2] = c[g >> 2] | 4; while (0);
		i = j;
		return
	}

	function jj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 61 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function kj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 1) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 7 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function lj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Rn(d, h, f, g, 4) | 0;
		if (!(c[f >> 2] & 4)) c[b >> 2] = j + -1900;
		i = a;
		return
	}

	function mj(a, b, e, f, g) {
		a = a | 0;
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		a = c[b >> 2] | 0;
		do
			if (a)
				if ((c[a + 12 >> 2] | 0) == (c[a + 16 >> 2] | 0))
					if ((xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0) == -1) {
						c[b >> 2] = 0;
						h = 0;
						break
					} else {
						h = c[b >> 2] | 0;
						break
					}
		else h = a;
		else h = 0;
		while (0);
		a = (h | 0) == 0;
		h = c[e >> 2] | 0;
		do
			if (h) {
				if ((c[h + 12 >> 2] | 0) == (c[h + 16 >> 2] | 0) ? (xb[c[(c[h >> 2] | 0) + 36 >> 2] & 63](h) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					i = 11;
					break
				}
				if (a) {
					j = h;
					i = 13
				} else i = 12
			} else i = 11; while (0);
		if ((i | 0) == 11)
			if (a) i = 12;
			else {
				j = 0;
				i = 13
			}
		a: do
			if ((i | 0) == 12) c[f >> 2] = c[f >> 2] | 6;
			else
		if ((i | 0) == 13) {
			a = c[b >> 2] | 0;
			h = c[a + 12 >> 2] | 0;
			if ((h | 0) == (c[a + 16 >> 2] | 0)) k = xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0;
			else k = d[h >> 0] | 0;
			if ((qb[c[(c[g >> 2] | 0) + 36 >> 2] & 31](g, k & 255, 0) | 0) << 24 >> 24 != 37) {
				c[f >> 2] = c[f >> 2] | 4;
				break
			}
			h = c[b >> 2] | 0;
			a = h + 12 | 0;
			l = c[a >> 2] | 0;
			if ((l | 0) == (c[h + 16 >> 2] | 0)) {
				xb[c[(c[h >> 2] | 0) + 40 >> 2] & 63](h) | 0;
				m = c[b >> 2] | 0;
				if (!m) n = 0;
				else {
					o = m;
					i = 21
				}
			} else {
				c[a >> 2] = l + 1;
				o = h;
				i = 21
			}
			do
				if ((i | 0) == 21)
					if ((c[o + 12 >> 2] | 0) == (c[o + 16 >> 2] | 0))
						if ((xb[c[(c[o >> 2] | 0) + 36 >> 2] & 63](o) | 0) == -1) {
							c[b >> 2] = 0;
							n = 0;
							break
						} else {
							n = c[b >> 2] | 0;
							break
						}
			else n = o; while (0);
			h = (n | 0) == 0;
			do
				if (j) {
					if ((c[j + 12 >> 2] | 0) == (c[j + 16 >> 2] | 0) ? (xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0) == -1 : 0) {
						c[e >> 2] = 0;
						i = 30;
						break
					}
					if (h) break a
				} else i = 30; while (0);
			if ((i | 0) == 30 ? !h : 0) break;
			c[f >> 2] = c[f >> 2] | 2
		}
		while (0);
		return
	}

	function nj(a, b, d, e, f, g, h, j) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0;
		k = i;
		i = i + 32 | 0;
		l = k + 16 | 0;
		m = k + 12 | 0;
		n = k + 8 | 0;
		o = k + 4 | 0;
		p = k;
		q = mg(e) | 0;
		c[n >> 2] = q;
		r = Gl(n, 9860) | 0;
		ep(q) | 0;
		c[f >> 2] = 0;
		q = c[b >> 2] | 0;
		a: do
			if ((h | 0) != (j | 0)) {
				n = h;
				s = q;
				b: while (1) {
					t = s;
					if (s) {
						u = c[s + 12 >> 2] | 0;
						if ((u | 0) == (c[s + 16 >> 2] | 0)) v = xb[c[(c[s >> 2] | 0) + 36 >> 2] & 63](s) | 0;
						else v = c[u >> 2] | 0;
						if ((v | 0) == -1) {
							c[b >> 2] = 0;
							w = 0;
							x = 1;
							y = 0
						} else {
							w = s;
							x = 0;
							y = t
						}
					} else {
						w = 0;
						x = 1;
						y = t
					}
					t = c[d >> 2] | 0;
					u = t;
					do
						if (t) {
							z = c[t + 12 >> 2] | 0;
							if ((z | 0) == (c[t + 16 >> 2] | 0)) A = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
							else A = c[z >> 2] | 0;
							if ((A | 0) != -1)
								if (x) {
									B = t;
									C = u;
									break
								} else {
									D = w;
									E = 16;
									break b
								}
							else {
								c[d >> 2] = 0;
								F = 0;
								E = 14;
								break
							}
						} else {
							F = u;
							E = 14
						}
					while (0);
					if ((E | 0) == 14) {
						E = 0;
						if (x) {
							D = w;
							E = 16;
							break
						} else {
							B = 0;
							C = F
						}
					}
					c: do
						if ((qb[c[(c[r >> 2] | 0) + 52 >> 2] & 31](r, c[n >> 2] | 0, 0) | 0) << 24 >> 24 == 37) {
							u = n + 4 | 0;
							if ((u | 0) == (j | 0)) {
								G = w;
								E = 19;
								break b
							}
							t = qb[c[(c[r >> 2] | 0) + 52 >> 2] & 31](r, c[u >> 2] | 0, 0) | 0;
							switch (t << 24 >> 24) {
								case 48:
								case 69:
									{
										z = n + 8 | 0;
										if ((z | 0) == (j | 0)) {
											H = w;
											E = 22;
											break b
										}
										I = u;J = qb[c[(c[r >> 2] | 0) + 52 >> 2] & 31](r, c[z >> 2] | 0, 0) | 0;K = t;
										break
									}
								default:
									{
										I = n;J = t;K = 0
									}
							}
							t = c[(c[a >> 2] | 0) + 36 >> 2] | 0;
							c[o >> 2] = y;
							c[p >> 2] = C;
							c[m >> 2] = c[o >> 2];
							c[l >> 2] = c[p >> 2];
							c[b >> 2] = Ab[t & 15](a, m, l, e, f, g, J, K) | 0;
							L = I + 8 | 0
						} else {
							if (qb[c[(c[r >> 2] | 0) + 12 >> 2] & 31](r, 8192, c[n >> 2] | 0) | 0) M = n;
							else {
								t = w + 12 | 0;
								z = c[t >> 2] | 0;
								u = w + 16 | 0;
								if ((z | 0) == (c[u >> 2] | 0)) N = xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0;
								else N = c[z >> 2] | 0;
								z = Db[c[(c[r >> 2] | 0) + 28 >> 2] & 31](r, N) | 0;
								if ((z | 0) != (Db[c[(c[r >> 2] | 0) + 28 >> 2] & 31](r, c[n >> 2] | 0) | 0)) {
									E = 59;
									break b
								}
								z = c[t >> 2] | 0;
								if ((z | 0) == (c[u >> 2] | 0)) xb[c[(c[w >> 2] | 0) + 40 >> 2] & 63](w) | 0;
								else c[t >> 2] = z + 4;
								L = n + 4 | 0;
								break
							}
							while (1) {
								z = M + 4 | 0;
								if ((z | 0) == (j | 0)) {
									O = j;
									break
								}
								if (qb[c[(c[r >> 2] | 0) + 12 >> 2] & 31](r, 8192, c[z >> 2] | 0) | 0) M = z;
								else {
									O = z;
									break
								}
							}
							z = w;
							t = B;
							u = B;
							while (1) {
								if (z) {
									P = c[z + 12 >> 2] | 0;
									if ((P | 0) == (c[z + 16 >> 2] | 0)) Q = xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0;
									else Q = c[P >> 2] | 0;
									if ((Q | 0) == -1) {
										c[b >> 2] = 0;
										R = 1;
										S = 0
									} else {
										R = 0;
										S = z
									}
								} else {
									R = 1;
									S = 0
								}
								do
									if (u) {
										P = c[u + 12 >> 2] | 0;
										if ((P | 0) == (c[u + 16 >> 2] | 0)) T = xb[c[(c[u >> 2] | 0) + 36 >> 2] & 63](u) | 0;
										else T = c[P >> 2] | 0;
										if ((T | 0) != -1)
											if (R ^ (t | 0) == 0) {
												U = t;
												V = t;
												break
											} else {
												L = O;
												break c
											}
										else {
											c[d >> 2] = 0;
											W = 0;
											E = 42;
											break
										}
									} else {
										W = t;
										E = 42
									}
								while (0);
								if ((E | 0) == 42) {
									E = 0;
									if (R) {
										L = O;
										break c
									} else {
										U = W;
										V = 0
									}
								}
								P = S + 12 | 0;
								X = c[P >> 2] | 0;
								Y = S + 16 | 0;
								if ((X | 0) == (c[Y >> 2] | 0)) Z = xb[c[(c[S >> 2] | 0) + 36 >> 2] & 63](S) | 0;
								else Z = c[X >> 2] | 0;
								if (!(qb[c[(c[r >> 2] | 0) + 12 >> 2] & 31](r, 8192, Z) | 0)) {
									L = O;
									break c
								}
								X = c[P >> 2] | 0;
								if ((X | 0) == (c[Y >> 2] | 0)) {
									xb[c[(c[S >> 2] | 0) + 40 >> 2] & 63](S) | 0;
									z = S;
									t = U;
									u = V;
									continue
								} else {
									c[P >> 2] = X + 4;
									z = S;
									t = U;
									u = V;
									continue
								}
							}
						}
					while (0);
					u = c[b >> 2] | 0;
					if ((L | 0) != (j | 0) & (c[f >> 2] | 0) == 0) {
						n = L;
						s = u
					} else {
						_ = u;
						break a
					}
				}
				if ((E | 0) == 16) {
					c[f >> 2] = 4;
					_ = D;
					break
				} else if ((E | 0) == 19) {
					c[f >> 2] = 4;
					_ = G;
					break
				} else if ((E | 0) == 22) {
					c[f >> 2] = 4;
					_ = H;
					break
				} else if ((E | 0) == 59) {
					c[f >> 2] = 4;
					_ = c[b >> 2] | 0;
					break
				}
			} else _ = q; while (0);
		if (_) {
			q = c[_ + 12 >> 2] | 0;
			if ((q | 0) == (c[_ + 16 >> 2] | 0)) $ = xb[c[(c[_ >> 2] | 0) + 36 >> 2] & 63](_) | 0;
			else $ = c[q >> 2] | 0;
			if (($ | 0) == -1) {
				c[b >> 2] = 0;
				aa = 0;
				ba = 1
			} else {
				aa = _;
				ba = 0
			}
		} else {
			aa = 0;
			ba = 1
		}
		_ = c[d >> 2] | 0;
		do
			if (_) {
				b = c[_ + 12 >> 2] | 0;
				if ((b | 0) == (c[_ + 16 >> 2] | 0)) ca = xb[c[(c[_ >> 2] | 0) + 36 >> 2] & 63](_) | 0;
				else ca = c[b >> 2] | 0;
				if ((ca | 0) != -1)
					if (ba) break;
					else {
						E = 74;
						break
					}
				else {
					c[d >> 2] = 0;
					E = 72;
					break
				}
			} else E = 72; while (0);
		if ((E | 0) == 72 ? ba : 0) E = 74;
		if ((E | 0) == 74) c[f >> 2] = c[f >> 2] | 2;
		i = k;
		return aa | 0
	}

	function oj(a) {
		a = a | 0;
		return
	}

	function pj(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function qj(a) {
		a = a | 0;
		return 2
	}

	function rj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h + 8 | 0;
		l = h + 4 | 0;
		m = h;
		c[l >> 2] = c[b >> 2];
		c[m >> 2] = c[d >> 2];
		c[k >> 2] = c[l >> 2];
		c[j >> 2] = c[m >> 2];
		m = nj(a, k, j, e, f, g, 10436, 10468) | 0;
		i = h;
		return m | 0
	}

	function sj(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		j = i;
		i = i + 16 | 0;
		k = j + 12 | 0;
		l = j + 8 | 0;
		m = j + 4 | 0;
		n = j;
		o = b + 8 | 0;
		p = xb[c[(c[o >> 2] | 0) + 20 >> 2] & 63](o) | 0;
		c[m >> 2] = c[d >> 2];
		c[n >> 2] = c[e >> 2];
		e = a[p >> 0] | 0;
		d = (e & 1) == 0;
		o = p + 4 | 0;
		q = d ? o : c[p + 8 >> 2] | 0;
		p = q + ((d ? (e & 255) >>> 1 : c[o >> 2] | 0) << 2) | 0;
		c[l >> 2] = c[m >> 2];
		c[k >> 2] = c[n >> 2];
		n = nj(b, l, k, f, g, h, q, p) | 0;
		i = j;
		return n | 0
	}

	function tj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9860) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		uj(a, g + 24 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function uj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 4 | 0;
		k = h;
		l = a + 8 | 0;
		a = xb[c[c[l >> 2] >> 2] & 63](l) | 0;
		c[k >> 2] = c[e >> 2];
		c[j >> 2] = c[k >> 2];
		k = (En(d, j, a, a + 168 | 0, g, f, 0) | 0) - a | 0;
		if ((k | 0) < 168) c[b >> 2] = ((k | 0) / 12 | 0 | 0) % 7 | 0;
		i = h;
		return
	}

	function vj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9860) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		wj(a, g + 16 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function wj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 4 | 0;
		k = h;
		l = a + 8 | 0;
		a = xb[c[(c[l >> 2] | 0) + 4 >> 2] & 63](l) | 0;
		c[k >> 2] = c[e >> 2];
		c[j >> 2] = c[k >> 2];
		k = (En(d, j, a, a + 288 | 0, g, f, 0) | 0) - a | 0;
		if ((k | 0) < 288) c[b >> 2] = ((k | 0) / 12 | 0 | 0) % 12 | 0;
		i = h;
		return
	}

	function xj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 8 | 0;
		k = h + 4 | 0;
		l = h;
		m = mg(e) | 0;
		c[k >> 2] = m;
		e = Gl(k, 9860) | 0;
		ep(m) | 0;
		c[l >> 2] = c[d >> 2];
		c[j >> 2] = c[l >> 2];
		yj(a, g + 20 | 0, b, j, f, e);
		i = h;
		return c[b >> 2] | 0
	}

	function yj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 4) | 0;
		if (!(c[f >> 2] & 4)) {
			if ((j | 0) < 69) k = j + 2e3 | 0;
			else k = (j + -69 | 0) >>> 0 < 31 ? j + 1900 | 0 : j;
			c[b >> 2] = k + -1900
		}
		i = a;
		return
	}

	function zj(b, d, e, f, g, h, j, k) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0;
		k = i;
		i = i + 144 | 0;
		l = k + 48 | 0;
		m = k + 76 | 0;
		n = k + 92 | 0;
		o = k + 108 | 0;
		p = k + 124 | 0;
		q = k + 8 | 0;
		r = k + 12 | 0;
		s = k + 80 | 0;
		t = k + 16 | 0;
		u = k + 20 | 0;
		v = k + 24 | 0;
		w = k + 28 | 0;
		x = k + 96 | 0;
		y = k + 104 | 0;
		z = k + 112 | 0;
		A = k + 120 | 0;
		B = k + 128 | 0;
		C = k + 132 | 0;
		D = k + 52 | 0;
		E = k + 56 | 0;
		F = k + 60 | 0;
		G = k + 64 | 0;
		H = k + 68 | 0;
		I = k + 72 | 0;
		J = k + 4 | 0;
		K = k;
		L = k + 88 | 0;
		M = k + 84 | 0;
		N = k + 32 | 0;
		O = k + 36 | 0;
		P = k + 100 | 0;
		Q = k + 40 | 0;
		R = k + 116 | 0;
		S = k + 44 | 0;
		c[g >> 2] = 0;
		T = mg(f) | 0;
		c[n >> 2] = T;
		U = Gl(n, 9860) | 0;
		ep(T) | 0;
		do switch (j << 24 >> 24 | 0) {
			case 65:
			case 97:
				{
					c[o >> 2] = c[e >> 2];c[l >> 2] = c[o >> 2];uj(b, h + 24 | 0, d, l, g, U);V = 26;
					break
				}
			case 104:
			case 66:
			case 98:
				{
					c[p >> 2] = c[e >> 2];c[l >> 2] = c[p >> 2];wj(b, h + 16 | 0, d, l, g, U);V = 26;
					break
				}
			case 99:
				{
					T = b + 8 | 0;n = xb[c[(c[T >> 2] | 0) + 12 >> 2] & 63](T) | 0;c[q >> 2] = c[d >> 2];c[r >> 2] = c[e >> 2];T = a[n >> 0] | 0;W = (T & 1) == 0;X = n + 4 | 0;Y = W ? X : c[n + 8 >> 2] | 0;n = Y + ((W ? (T & 255) >>> 1 : c[X >> 2] | 0) << 2) | 0;c[m >> 2] = c[q >> 2];c[l >> 2] = c[r >> 2];c[d >> 2] = nj(b, m, l, f, g, h, Y, n) | 0;V = 26;
					break
				}
			case 101:
			case 100:
				{
					c[s >> 2] = c[e >> 2];c[l >> 2] = c[s >> 2];Aj(b, h + 12 | 0, d, l, g, U);V = 26;
					break
				}
			case 68:
				{
					c[t >> 2] = c[d >> 2];c[u >> 2] = c[e >> 2];c[m >> 2] = c[t >> 2];c[l >> 2] = c[u >> 2];c[d >> 2] = nj(b, m, l, f, g, h, 10468, 10500) | 0;V = 26;
					break
				}
			case 70:
				{
					c[v >> 2] = c[d >> 2];c[w >> 2] = c[e >> 2];c[m >> 2] = c[v >> 2];c[l >> 2] = c[w >> 2];c[d >> 2] = nj(b, m, l, f, g, h, 10500, 10532) | 0;V = 26;
					break
				}
			case 72:
				{
					c[x >> 2] = c[e >> 2];c[l >> 2] = c[x >> 2];Bj(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 73:
				{
					c[y >> 2] = c[e >> 2];c[l >> 2] = c[y >> 2];Cj(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 106:
				{
					c[z >> 2] = c[e >> 2];c[l >> 2] = c[z >> 2];Dj(b, h + 28 | 0, d, l, g, U);V = 26;
					break
				}
			case 109:
				{
					c[A >> 2] = c[e >> 2];c[l >> 2] = c[A >> 2];Ej(b, h + 16 | 0, d, l, g, U);V = 26;
					break
				}
			case 77:
				{
					c[B >> 2] = c[e >> 2];c[l >> 2] = c[B >> 2];Fj(b, h + 4 | 0, d, l, g, U);V = 26;
					break
				}
			case 116:
			case 110:
				{
					c[C >> 2] = c[e >> 2];c[l >> 2] = c[C >> 2];Gj(b, d, l, g, U);V = 26;
					break
				}
			case 112:
				{
					c[D >> 2] = c[e >> 2];c[l >> 2] = c[D >> 2];Hj(b, h + 8 | 0, d, l, g, U);V = 26;
					break
				}
			case 114:
				{
					c[E >> 2] = c[d >> 2];c[F >> 2] = c[e >> 2];c[m >> 2] = c[E >> 2];c[l >> 2] = c[F >> 2];c[d >> 2] = nj(b, m, l, f, g, h, 10532, 10576) | 0;V = 26;
					break
				}
			case 82:
				{
					c[G >> 2] = c[d >> 2];c[H >> 2] = c[e >> 2];c[m >> 2] = c[G >> 2];c[l >> 2] = c[H >> 2];c[d >> 2] = nj(b, m, l, f, g, h, 10576, 10596) | 0;V = 26;
					break
				}
			case 83:
				{
					c[I >> 2] = c[e >> 2];c[l >> 2] = c[I >> 2];Ij(b, h, d, l, g, U);V = 26;
					break
				}
			case 84:
				{
					c[J >> 2] = c[d >> 2];c[K >> 2] = c[e >> 2];c[m >> 2] = c[J >> 2];c[l >> 2] = c[K >> 2];c[d >> 2] = nj(b, m, l, f, g, h, 10596, 10628) | 0;V = 26;
					break
				}
			case 119:
				{
					c[L >> 2] = c[e >> 2];c[l >> 2] = c[L >> 2];Jj(b, h + 24 | 0, d, l, g, U);V = 26;
					break
				}
			case 120:
				{
					n = c[(c[b >> 2] | 0) + 20 >> 2] | 0;c[M >> 2] = c[d >> 2];c[N >> 2] = c[e >> 2];c[m >> 2] = c[M >> 2];c[l >> 2] = c[N >> 2];Z = vb[n & 63](b, m, l, f, g, h) | 0;
					break
				}
			case 88:
				{
					n = b + 8 | 0;Y = xb[c[(c[n >> 2] | 0) + 24 >> 2] & 63](n) | 0;c[O >> 2] = c[d >> 2];c[P >> 2] = c[e >> 2];n = a[Y >> 0] | 0;X = (n & 1) == 0;T = Y + 4 | 0;W = X ? T : c[Y + 8 >> 2] | 0;Y = W + ((X ? (n & 255) >>> 1 : c[T >> 2] | 0) << 2) | 0;c[m >> 2] = c[O >> 2];c[l >> 2] = c[P >> 2];c[d >> 2] = nj(b, m, l, f, g, h, W, Y) | 0;V = 26;
					break
				}
			case 121:
				{
					c[Q >> 2] = c[e >> 2];c[l >> 2] = c[Q >> 2];yj(b, h + 20 | 0, d, l, g, U);V = 26;
					break
				}
			case 89:
				{
					c[R >> 2] = c[e >> 2];c[l >> 2] = c[R >> 2];Kj(b, h + 20 | 0, d, l, g, U);V = 26;
					break
				}
			case 37:
				{
					c[S >> 2] = c[e >> 2];c[l >> 2] = c[S >> 2];Lj(b, d, l, g, U);V = 26;
					break
				}
			default:
				{
					c[g >> 2] = c[g >> 2] | 4;V = 26
				}
		}
		while (0);
		if ((V | 0) == 26) Z = c[d >> 2] | 0;
		i = k;
		return Z | 0
	}

	function Aj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j + -1 | 0) >>> 0 < 31 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Bj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 24 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Cj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j + -1 | 0) >>> 0 < 12 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Dj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 3) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 366 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Ej(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 13 & (g & 4 | 0) == 0) c[b >> 2] = j + -1;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Fj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 60 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Gj(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		a: while (1) {
			a = c[b >> 2] | 0;
			do
				if (a) {
					g = c[a + 12 >> 2] | 0;
					if ((g | 0) == (c[a + 16 >> 2] | 0)) h = xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0;
					else h = c[g >> 2] | 0;
					if ((h | 0) == -1) {
						c[b >> 2] = 0;
						i = 1;
						break
					} else {
						i = (c[b >> 2] | 0) == 0;
						break
					}
				} else i = 1; while (0);
			a = c[d >> 2] | 0;
			do
				if (a) {
					g = c[a + 12 >> 2] | 0;
					if ((g | 0) == (c[a + 16 >> 2] | 0)) j = xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0;
					else j = c[g >> 2] | 0;
					if ((j | 0) != -1)
						if (i) {
							k = a;
							break
						} else {
							l = a;
							break a
						}
					else {
						c[d >> 2] = 0;
						m = 15;
						break
					}
				} else m = 15; while (0);
			if ((m | 0) == 15) {
				m = 0;
				if (i) {
					l = 0;
					break
				} else k = 0
			}
			a = c[b >> 2] | 0;
			g = c[a + 12 >> 2] | 0;
			if ((g | 0) == (c[a + 16 >> 2] | 0)) n = xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0;
			else n = c[g >> 2] | 0;
			if (!(qb[c[(c[f >> 2] | 0) + 12 >> 2] & 31](f, 8192, n) | 0)) {
				l = k;
				break
			}
			g = c[b >> 2] | 0;
			a = g + 12 | 0;
			o = c[a >> 2] | 0;
			if ((o | 0) == (c[g + 16 >> 2] | 0)) {
				xb[c[(c[g >> 2] | 0) + 40 >> 2] & 63](g) | 0;
				continue
			} else {
				c[a >> 2] = o + 4;
				continue
			}
		}
		k = c[b >> 2] | 0;
		do
			if (k) {
				n = c[k + 12 >> 2] | 0;
				if ((n | 0) == (c[k + 16 >> 2] | 0)) p = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else p = c[n >> 2] | 0;
				if ((p | 0) == -1) {
					c[b >> 2] = 0;
					q = 1;
					break
				} else {
					q = (c[b >> 2] | 0) == 0;
					break
				}
			} else q = 1; while (0);
		do
			if (l) {
				b = c[l + 12 >> 2] | 0;
				if ((b | 0) == (c[l + 16 >> 2] | 0)) r = xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0;
				else r = c[b >> 2] | 0;
				if ((r | 0) != -1)
					if (q) break;
					else {
						m = 39;
						break
					}
				else {
					c[d >> 2] = 0;
					m = 37;
					break
				}
			} else m = 37; while (0);
		if ((m | 0) == 37 ? q : 0) m = 39;
		if ((m | 0) == 39) c[e >> 2] = c[e >> 2] | 2;
		return
	}

	function Hj(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0;
		j = i;
		i = i + 16 | 0;
		k = j + 4 | 0;
		l = j;
		m = b + 8 | 0;
		b = xb[c[(c[m >> 2] | 0) + 8 >> 2] & 63](m) | 0;
		m = a[b >> 0] | 0;
		if (!(m & 1)) n = (m & 255) >>> 1;
		else n = c[b + 4 >> 2] | 0;
		m = a[b + 12 >> 0] | 0;
		if (!(m & 1)) o = (m & 255) >>> 1;
		else o = c[b + 16 >> 2] | 0;
		do
			if ((n | 0) != (0 - o | 0)) {
				c[l >> 2] = c[f >> 2];
				c[k >> 2] = c[l >> 2];
				m = En(e, k, b, b + 24 | 0, h, g, 0) | 0;
				p = c[d >> 2] | 0;
				if ((m | 0) == (b | 0) & (p | 0) == 12) {
					c[d >> 2] = 0;
					break
				}
				if ((p | 0) < 12 & (m - b | 0) == 12) c[d >> 2] = p + 12
			} else c[g >> 2] = c[g >> 2] | 4; while (0);
		i = j;
		return
	}

	function Ij(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 2) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 61 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Jj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 1) | 0;
		g = c[f >> 2] | 0;
		if ((j | 0) < 7 & (g & 4 | 0) == 0) c[b >> 2] = j;
		else c[f >> 2] = g | 4;
		i = a;
		return
	}

	function Kj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0;
		a = i;
		i = i + 16 | 0;
		h = a + 4 | 0;
		j = a;
		c[j >> 2] = c[e >> 2];
		c[h >> 2] = c[j >> 2];
		j = Sn(d, h, f, g, 4) | 0;
		if (!(c[f >> 2] & 4)) c[b >> 2] = j + -1900;
		i = a;
		return
	}

	function Lj(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		a = c[b >> 2] | 0;
		do
			if (a) {
				g = c[a + 12 >> 2] | 0;
				if ((g | 0) == (c[a + 16 >> 2] | 0)) h = xb[c[(c[a >> 2] | 0) + 36 >> 2] & 63](a) | 0;
				else h = c[g >> 2] | 0;
				if ((h | 0) == -1) {
					c[b >> 2] = 0;
					i = 1;
					break
				} else {
					i = (c[b >> 2] | 0) == 0;
					break
				}
			} else i = 1; while (0);
		h = c[d >> 2] | 0;
		do
			if (h) {
				a = c[h + 12 >> 2] | 0;
				if ((a | 0) == (c[h + 16 >> 2] | 0)) j = xb[c[(c[h >> 2] | 0) + 36 >> 2] & 63](h) | 0;
				else j = c[a >> 2] | 0;
				if ((j | 0) != -1)
					if (i) {
						k = h;
						l = 17;
						break
					} else {
						l = 16;
						break
					}
				else {
					c[d >> 2] = 0;
					l = 14;
					break
				}
			} else l = 14; while (0);
		if ((l | 0) == 14)
			if (i) l = 16;
			else {
				k = 0;
				l = 17
			}
		a: do
			if ((l | 0) == 16) c[e >> 2] = c[e >> 2] | 6;
			else
		if ((l | 0) == 17) {
			i = c[b >> 2] | 0;
			h = c[i + 12 >> 2] | 0;
			if ((h | 0) == (c[i + 16 >> 2] | 0)) m = xb[c[(c[i >> 2] | 0) + 36 >> 2] & 63](i) | 0;
			else m = c[h >> 2] | 0;
			if ((qb[c[(c[f >> 2] | 0) + 52 >> 2] & 31](f, m, 0) | 0) << 24 >> 24 != 37) {
				c[e >> 2] = c[e >> 2] | 4;
				break
			}
			h = c[b >> 2] | 0;
			i = h + 12 | 0;
			j = c[i >> 2] | 0;
			if ((j | 0) == (c[h + 16 >> 2] | 0)) {
				xb[c[(c[h >> 2] | 0) + 40 >> 2] & 63](h) | 0;
				a = c[b >> 2] | 0;
				if (!a) n = 1;
				else {
					o = a;
					l = 25
				}
			} else {
				c[i >> 2] = j + 4;
				o = h;
				l = 25
			}
			do
				if ((l | 0) == 25) {
					h = c[o + 12 >> 2] | 0;
					if ((h | 0) == (c[o + 16 >> 2] | 0)) p = xb[c[(c[o >> 2] | 0) + 36 >> 2] & 63](o) | 0;
					else p = c[h >> 2] | 0;
					if ((p | 0) == -1) {
						c[b >> 2] = 0;
						n = 1;
						break
					} else {
						n = (c[b >> 2] | 0) == 0;
						break
					}
				}
			while (0);
			do
				if (k) {
					h = c[k + 12 >> 2] | 0;
					if ((h | 0) == (c[k + 16 >> 2] | 0)) q = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
					else q = c[h >> 2] | 0;
					if ((q | 0) != -1)
						if (n) break a;
						else break;
					else {
						c[d >> 2] = 0;
						l = 37;
						break
					}
				} else l = 37; while (0);
			if ((l | 0) == 37 ? !n : 0) break;
			c[e >> 2] = c[e >> 2] | 2
		}
		while (0);
		return
	}

	function Mj(a) {
		a = a | 0;
		Nj(a + 8 | 0);
		return
	}

	function Nj(a) {
		a = a | 0;
		var b = 0;
		b = c[a >> 2] | 0;
		if ((b | 0) != (Wh() | 0)) Ld(c[a >> 2] | 0);
		return
	}

	function Oj(a) {
		a = a | 0;
		Nj(a + 8 | 0);
		Fc(a);
		return
	}

	function Pj(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0;
		f = i;
		i = i + 112 | 0;
		e = f + 4 | 0;
		k = f;
		c[k >> 2] = e + 100;
		Qj(b + 8 | 0, e, k, g, h, j);
		j = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		if ((e | 0) == (j | 0)) l = k;
		else {
			d = e;
			e = k;
			while (1) {
				k = a[d >> 0] | 0;
				do
					if (e) {
						h = e + 24 | 0;
						g = c[h >> 2] | 0;
						if ((g | 0) == (c[e + 28 >> 2] | 0)) {
							b = (Db[c[(c[e >> 2] | 0) + 52 >> 2] & 31](e, k & 255) | 0) == -1;
							m = b ? 0 : e;
							break
						} else {
							c[h >> 2] = g + 1;
							a[g >> 0] = k;
							m = e;
							break
						}
					} else m = 0; while (0);
				d = d + 1 | 0;
				if ((d | 0) == (j | 0)) {
					l = m;
					break
				} else e = m
			}
		}
		i = f;
		return l | 0
	}

	function Qj(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0;
		j = i;
		i = i + 16 | 0;
		k = j;
		a[k >> 0] = 37;
		l = k + 1 | 0;
		a[l >> 0] = g;
		m = k + 2 | 0;
		a[m >> 0] = h;
		a[k + 3 >> 0] = 0;
		if (h << 24 >> 24) {
			a[l >> 0] = h;
			a[m >> 0] = g
		}
		c[e >> 2] = d + (Ja(d | 0, (c[e >> 2] | 0) - d | 0, k | 0, f | 0, c[b >> 2] | 0) | 0);
		i = j;
		return
	}

	function Rj(a) {
		a = a | 0;
		Nj(a + 8 | 0);
		return
	}

	function Sj(a) {
		a = a | 0;
		Nj(a + 8 | 0);
		Fc(a);
		return
	}

	function Tj(a, b, d, e, f, g, h) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0;
		e = i;
		i = i + 416 | 0;
		d = e + 8 | 0;
		j = e;
		c[j >> 2] = d + 400;
		Uj(a + 8 | 0, d, j, f, g, h);
		h = c[j >> 2] | 0;
		j = c[b >> 2] | 0;
		if ((d | 0) == (h | 0)) k = j;
		else {
			b = d;
			d = j;
			while (1) {
				j = c[b >> 2] | 0;
				if (!d) l = 0;
				else {
					g = d + 24 | 0;
					f = c[g >> 2] | 0;
					if ((f | 0) == (c[d + 28 >> 2] | 0)) m = Db[c[(c[d >> 2] | 0) + 52 >> 2] & 31](d, j) | 0;
					else {
						c[g >> 2] = f + 4;
						c[f >> 2] = j;
						m = j
					}
					l = (m | 0) == -1 ? 0 : d
				}
				b = b + 4 | 0;
				if ((b | 0) == (h | 0)) {
					k = l;
					break
				} else d = l
			}
		}
		i = e;
		return k | 0
	}

	function Uj(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		h = i;
		i = i + 128 | 0;
		j = h + 16 | 0;
		k = h + 12 | 0;
		l = h;
		m = h + 8 | 0;
		c[k >> 2] = j + 100;
		Qj(a, j, k, e, f, g);
		g = l;
		c[g >> 2] = 0;
		c[g + 4 >> 2] = 0;
		c[m >> 2] = j;
		j = (c[d >> 2] | 0) - b >> 2;
		g = Pd(c[a >> 2] | 0) | 0;
		a = ce(b, m, j, l) | 0;
		if (g) Pd(g) | 0;
		c[d >> 2] = b + (a << 2);
		i = h;
		return
	}

	function Vj(a) {
		a = a | 0;
		return
	}

	function Wj(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Xj(a) {
		a = a | 0;
		return 127
	}

	function Yj(a) {
		a = a | 0;
		return 127
	}

	function Zj(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function _j(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function $j(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function ak(a, b) {
		a = a | 0;
		b = b | 0;
		Nf(a, 1, 45);
		return
	}

	function bk(a) {
		a = a | 0;
		return 0
	}

	function ck(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function dk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function ek(a) {
		a = a | 0;
		return
	}

	function fk(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function gk(a) {
		a = a | 0;
		return 127
	}

	function hk(a) {
		a = a | 0;
		return 127
	}

	function ik(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function jk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function kk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function lk(a, b) {
		a = a | 0;
		b = b | 0;
		Nf(a, 1, 45);
		return
	}

	function mk(a) {
		a = a | 0;
		return 0
	}

	function nk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function ok(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function pk(a) {
		a = a | 0;
		return
	}

	function qk(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function rk(a) {
		a = a | 0;
		return 2147483647
	}

	function sk(a) {
		a = a | 0;
		return 2147483647
	}

	function tk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function uk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function vk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function wk(a, b) {
		a = a | 0;
		b = b | 0;
		Zf(a, 1, 45);
		return
	}

	function xk(a) {
		a = a | 0;
		return 0
	}

	function yk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function zk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function Ak(a) {
		a = a | 0;
		return
	}

	function Bk(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Ck(a) {
		a = a | 0;
		return 2147483647
	}

	function Dk(a) {
		a = a | 0;
		return 2147483647
	}

	function Ek(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function Fk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function Gk(a, b) {
		a = a | 0;
		b = b | 0;
		c[a >> 2] = 0;
		c[a + 4 >> 2] = 0;
		c[a + 8 >> 2] = 0;
		return
	}

	function Hk(a, b) {
		a = a | 0;
		b = b | 0;
		Zf(a, 1, 45);
		return
	}

	function Ik(a) {
		a = a | 0;
		return 0
	}

	function Jk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function Kk(b, c) {
		b = b | 0;
		c = c | 0;
		a[b >> 0] = 2;
		a[b + 1 >> 0] = 3;
		a[b + 2 >> 0] = 0;
		a[b + 3 >> 0] = 4;
		return
	}

	function Lk(a) {
		a = a | 0;
		return
	}

	function Mk(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Nk(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0;
		b = i;
		i = i + 240 | 0;
		k = b + 24 | 0;
		l = b;
		m = b + 136 | 0;
		n = b + 8 | 0;
		o = b + 4 | 0;
		p = b + 20 | 0;
		q = b + 236 | 0;
		r = b + 16 | 0;
		s = b + 124 | 0;
		c[n >> 2] = m;
		t = n + 4 | 0;
		c[t >> 2] = 112;
		c[p >> 2] = mg(g) | 0;
		u = Gl(p, 9868) | 0;
		a[q >> 0] = 0;
		c[r >> 2] = c[e >> 2];
		v = c[g + 4 >> 2] | 0;
		c[k >> 2] = c[r >> 2];
		if (Pk(d, k, f, p, v, h, q, u, n, o, m + 100 | 0) | 0) {
			Bb[c[(c[u >> 2] | 0) + 32 >> 2] & 7](u, 22354, 22364, s) | 0;
			u = c[o >> 2] | 0;
			m = c[n >> 2] | 0;
			v = u - m | 0;
			if ((v | 0) > 98) {
				f = qd(v + 2 | 0) | 0;
				if (!f) md();
				else {
					w = f;
					x = f
				}
			} else {
				w = 0;
				x = k
			}
			if (!(a[q >> 0] | 0)) y = x;
			else {
				a[x >> 0] = 45;
				y = x + 1 | 0
			}
			x = s + 10 | 0;
			q = s;
			if (m >>> 0 < u >>> 0) {
				u = s + 1 | 0;
				f = u + 1 | 0;
				v = f + 1 | 0;
				r = v + 1 | 0;
				g = r + 1 | 0;
				z = g + 1 | 0;
				A = z + 1 | 0;
				B = A + 1 | 0;
				C = B + 1 | 0;
				D = y;
				E = m;
				while (1) {
					m = a[E >> 0] | 0;
					if ((a[s >> 0] | 0) != m << 24 >> 24)
						if ((a[u >> 0] | 0) != m << 24 >> 24)
							if ((a[f >> 0] | 0) != m << 24 >> 24)
								if ((a[v >> 0] | 0) != m << 24 >> 24)
									if ((a[r >> 0] | 0) != m << 24 >> 24)
										if ((a[g >> 0] | 0) != m << 24 >> 24)
											if ((a[z >> 0] | 0) != m << 24 >> 24)
												if ((a[A >> 0] | 0) != m << 24 >> 24)
													if ((a[B >> 0] | 0) == m << 24 >> 24) F = B;
													else F = (a[C >> 0] | 0) == m << 24 >> 24 ? C : x;
					else F = A;
					else F = z;
					else F = g;
					else F = r;
					else F = v;
					else F = f;
					else F = u;
					else F = s;
					a[D >> 0] = a[22354 + (F - q) >> 0] | 0;
					E = E + 1 | 0;
					m = D + 1 | 0;
					if (E >>> 0 >= (c[o >> 2] | 0) >>> 0) {
						G = m;
						break
					} else D = m
				}
			} else G = y;
			a[G >> 0] = 0;
			c[l >> 2] = j;
			Be(k, 22365, l) | 0;
			if (w) rd(w)
		}
		w = c[d >> 2] | 0;
		do
			if (w)
				if ((c[w + 12 >> 2] | 0) == (c[w + 16 >> 2] | 0))
					if ((xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0) == -1) {
						c[d >> 2] = 0;
						H = 0;
						break
					} else {
						H = c[d >> 2] | 0;
						break
					}
		else H = w;
		else H = 0;
		while (0);
		w = (H | 0) == 0;
		H = c[e >> 2] | 0;
		do
			if (H) {
				if ((c[H + 12 >> 2] | 0) == (c[H + 16 >> 2] | 0) ? (xb[c[(c[H >> 2] | 0) + 36 >> 2] & 63](H) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					I = 25;
					break
				}
				if (!w) I = 26
			} else I = 25; while (0);
		if ((I | 0) == 25 ? w : 0) I = 26;
		if ((I | 0) == 26) c[h >> 2] = c[h >> 2] | 2;
		h = c[d >> 2] | 0;
		ep(c[p >> 2] | 0) | 0;
		p = c[n >> 2] | 0;
		c[n >> 2] = 0;
		if (p) tb[c[t >> 2] & 127](p);
		i = b;
		return h | 0
	}

	function Ok(a) {
		a = a | 0;
		return
	}

	function Pk(e, f, g, h, j, k, l, m, n, o, p) {
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		p = p | 0;
		var q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0,
			wa = 0,
			xa = 0,
			ya = 0,
			za = 0,
			Aa = 0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0,
			La = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0,
			Ua = 0,
			Va = 0,
			Wa = 0,
			Xa = 0,
			Ya = 0,
			Za = 0,
			_a = 0,
			$a = 0,
			ab = 0,
			bb = 0,
			cb = 0,
			db = 0,
			eb = 0,
			fb = 0,
			gb = 0,
			hb = 0,
			ib = 0,
			jb = 0;
		q = i;
		i = i + 512 | 0;
		r = q + 488 | 0;
		s = q;
		t = q + 432 | 0;
		u = q + 464 | 0;
		v = q + 468 | 0;
		w = q + 492 | 0;
		x = q + 496 | 0;
		y = q + 497 | 0;
		z = q + 440 | 0;
		A = q + 404 | 0;
		B = q + 416 | 0;
		C = q + 472 | 0;
		D = q + 452 | 0;
		E = q + 400 | 0;
		F = q + 484 | 0;
		c[r >> 2] = p;
		c[t >> 2] = s;
		p = t + 4 | 0;
		c[p >> 2] = 112;
		c[u >> 2] = s;
		c[v >> 2] = s + 400;
		c[z >> 2] = 0;
		c[z + 4 >> 2] = 0;
		c[z + 8 >> 2] = 0;
		c[A >> 2] = 0;
		c[A + 4 >> 2] = 0;
		c[A + 8 >> 2] = 0;
		c[B >> 2] = 0;
		c[B + 4 >> 2] = 0;
		c[B + 8 >> 2] = 0;
		c[C >> 2] = 0;
		c[C + 4 >> 2] = 0;
		c[C + 8 >> 2] = 0;
		c[D >> 2] = 0;
		c[D + 4 >> 2] = 0;
		c[D + 8 >> 2] = 0;
		Sk(g, h, w, x, y, z, A, B, C, E);
		c[o >> 2] = c[n >> 2];
		h = m + 8 | 0;
		m = B + 4 | 0;
		g = C + 4 | 0;
		G = C + 8 | 0;
		H = C + 1 | 0;
		I = B + 8 | 0;
		J = B + 1 | 0;
		K = (j & 512 | 0) != 0;
		j = A + 8 | 0;
		L = A + 1 | 0;
		M = A + 4 | 0;
		N = D + 4 | 0;
		O = D + 8 | 0;
		P = D + 1 | 0;
		Q = w + 3 | 0;
		R = z + 4 | 0;
		S = s;
		s = 0;
		T = 0;
		a: while (1) {
			U = c[e >> 2] | 0;
			do
				if (U)
					if ((c[U + 12 >> 2] | 0) == (c[U + 16 >> 2] | 0))
						if ((xb[c[(c[U >> 2] | 0) + 36 >> 2] & 63](U) | 0) == -1) {
							c[e >> 2] = 0;
							V = 0;
							break
						} else {
							V = c[e >> 2] | 0;
							break
						}
			else V = U;
			else V = 0;
			while (0);
			U = (V | 0) == 0;
			W = c[f >> 2] | 0;
			do
				if (W) {
					if ((c[W + 12 >> 2] | 0) != (c[W + 16 >> 2] | 0))
						if (U) {
							X = W;
							break
						} else {
							Y = S;
							Z = T;
							_ = 202;
							break a
						}
					if ((xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0) != -1)
						if (U) {
							X = W;
							break
						} else {
							Y = S;
							Z = T;
							_ = 202;
							break a
						}
					else {
						c[f >> 2] = 0;
						_ = 12;
						break
					}
				} else _ = 12; while (0);
			if ((_ | 0) == 12) {
				_ = 0;
				if (U) {
					Y = S;
					Z = T;
					_ = 202;
					break
				} else X = 0
			}
			b: do switch (a[w + s >> 0] | 0) {
					case 1:
						{
							if ((s | 0) == 3) {
								$ = S;
								aa = T
							} else {
								W = c[e >> 2] | 0;
								ba = c[W + 12 >> 2] | 0;
								if ((ba | 0) == (c[W + 16 >> 2] | 0)) ca = xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0;
								else ca = d[ba >> 0] | 0;
								if ((ca & 255) << 24 >> 24 <= -1) {
									_ = 26;
									break a
								}
								if (!(b[(c[h >> 2] | 0) + (ca << 24 >> 24 << 1) >> 1] & 8192)) {
									_ = 26;
									break a
								}
								ba = c[e >> 2] | 0;
								W = ba + 12 | 0;
								da = c[W >> 2] | 0;
								if ((da | 0) == (c[ba + 16 >> 2] | 0)) ea = xb[c[(c[ba >> 2] | 0) + 40 >> 2] & 63](ba) | 0;
								else {
									c[W >> 2] = da + 1;
									ea = d[da >> 0] | 0
								}
								Vf(D, ea & 255);
								fa = X;
								ga = X;
								_ = 28
							}
							break
						}
					case 0:
						{
							if ((s | 0) == 3) {
								$ = S;
								aa = T
							} else {
								fa = X;
								ga = X;
								_ = 28
							}
							break
						}
					case 3:
						{
							da = a[B >> 0] | 0;W = (da & 1) == 0 ? (da & 255) >>> 1 : c[m >> 2] | 0;ba = a[C >> 0] | 0;ha = (ba & 1) == 0 ? (ba & 255) >>> 1 : c[g >> 2] | 0;
							if ((W | 0) == (0 - ha | 0)) {
								$ = S;
								aa = T
							} else {
								ba = (W | 0) == 0;
								W = c[e >> 2] | 0;
								ia = c[W + 12 >> 2] | 0;
								ja = c[W + 16 >> 2] | 0;
								ka = (ia | 0) == (ja | 0);
								if (ba | (ha | 0) == 0) {
									if (ka) la = xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0;
									else la = d[ia >> 0] | 0;
									ha = la & 255;
									if (ba) {
										if (ha << 24 >> 24 != (a[((a[C >> 0] & 1) == 0 ? H : c[G >> 2] | 0) >> 0] | 0)) {
											$ = S;
											aa = T;
											break b
										}
										ba = c[e >> 2] | 0;
										ma = ba + 12 | 0;
										na = c[ma >> 2] | 0;
										if ((na | 0) == (c[ba + 16 >> 2] | 0)) xb[c[(c[ba >> 2] | 0) + 40 >> 2] & 63](ba) | 0;
										else c[ma >> 2] = na + 1;
										a[l >> 0] = 1;
										na = a[C >> 0] | 0;
										$ = S;
										aa = ((na & 1) == 0 ? (na & 255) >>> 1 : c[g >> 2] | 0) >>> 0 > 1 ? C : T;
										break b
									}
									if (ha << 24 >> 24 != (a[((a[B >> 0] & 1) == 0 ? J : c[I >> 2] | 0) >> 0] | 0)) {
										a[l >> 0] = 1;
										$ = S;
										aa = T;
										break b
									}
									ha = c[e >> 2] | 0;
									na = ha + 12 | 0;
									ma = c[na >> 2] | 0;
									if ((ma | 0) == (c[ha + 16 >> 2] | 0)) xb[c[(c[ha >> 2] | 0) + 40 >> 2] & 63](ha) | 0;
									else c[na >> 2] = ma + 1;
									ma = a[B >> 0] | 0;
									$ = S;
									aa = ((ma & 1) == 0 ? (ma & 255) >>> 1 : c[m >> 2] | 0) >>> 0 > 1 ? B : T;
									break b
								}
								if (ka) {
									ka = xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0;
									ma = c[e >> 2] | 0;
									oa = ka;
									pa = a[B >> 0] | 0;
									qa = ma;
									ra = c[ma + 12 >> 2] | 0;
									sa = c[ma + 16 >> 2] | 0
								} else {
									oa = d[ia >> 0] | 0;
									pa = da;
									qa = W;
									ra = ia;
									sa = ja
								}
								ja = qa + 12 | 0;
								ia = (ra | 0) == (sa | 0);
								if ((oa & 255) << 24 >> 24 == (a[((pa & 1) == 0 ? J : c[I >> 2] | 0) >> 0] | 0)) {
									if (ia) xb[c[(c[qa >> 2] | 0) + 40 >> 2] & 63](qa) | 0;
									else c[ja >> 2] = ra + 1;
									ja = a[B >> 0] | 0;
									$ = S;
									aa = ((ja & 1) == 0 ? (ja & 255) >>> 1 : c[m >> 2] | 0) >>> 0 > 1 ? B : T;
									break b
								}
								if (ia) ta = xb[c[(c[qa >> 2] | 0) + 36 >> 2] & 63](qa) | 0;
								else ta = d[ra >> 0] | 0;
								if ((ta & 255) << 24 >> 24 != (a[((a[C >> 0] & 1) == 0 ? H : c[G >> 2] | 0) >> 0] | 0)) {
									_ = 82;
									break a
								}
								ia = c[e >> 2] | 0;
								ja = ia + 12 | 0;
								W = c[ja >> 2] | 0;
								if ((W | 0) == (c[ia + 16 >> 2] | 0)) xb[c[(c[ia >> 2] | 0) + 40 >> 2] & 63](ia) | 0;
								else c[ja >> 2] = W + 1;
								a[l >> 0] = 1;
								W = a[C >> 0] | 0;
								$ = S;
								aa = ((W & 1) == 0 ? (W & 255) >>> 1 : c[g >> 2] | 0) >>> 0 > 1 ? C : T
							}
							break
						}
					case 2:
						{
							if (!(s >>> 0 < 2 | (T | 0) != 0) ? !(K | (s | 0) == 2 & (a[Q >> 0] | 0) != 0) : 0) {
								$ = S;
								aa = 0;
								break b
							}
							W = a[A >> 0] | 0;ja = (W & 1) == 0;ia = c[j >> 2] | 0;da = ja ? L : ia;ma = da;c: do
								if ((s | 0) != 0 ? (d[w + (s + -1) >> 0] | 0) < 2 : 0) {
									ka = ja ? (W & 255) >>> 1 : c[M >> 2] | 0;
									na = da + ka | 0;
									ha = c[h >> 2] | 0;
									d: do
										if (!ka) ua = ma;
										else {
											ba = da;
											va = ma;
											while (1) {
												wa = a[ba >> 0] | 0;
												if (wa << 24 >> 24 <= -1) {
													ua = va;
													break d
												}
												if (!(b[ha + (wa << 24 >> 24 << 1) >> 1] & 8192)) {
													ua = va;
													break d
												}
												ba = ba + 1 | 0;
												wa = ba;
												if ((ba | 0) == (na | 0)) {
													ua = wa;
													break
												} else va = wa
											}
										}
									while (0);
									na = ua - ma | 0;
									ha = a[D >> 0] | 0;
									ka = (ha & 1) == 0;
									va = ka ? (ha & 255) >>> 1 : c[N >> 2] | 0;
									if (va >>> 0 >= na >>> 0) {
										ha = ka ? P : c[O >> 2] | 0;
										ka = ha + va | 0;
										if ((ua | 0) == (ma | 0)) xa = ua;
										else {
											ba = da;
											wa = ha + (va - na) | 0;
											while (1) {
												if ((a[wa >> 0] | 0) != (a[ba >> 0] | 0)) {
													xa = ma;
													break c
												}
												wa = wa + 1 | 0;
												if ((wa | 0) == (ka | 0)) {
													xa = ua;
													break
												} else ba = ba + 1 | 0
											}
										}
									} else xa = ma
								} else xa = ma; while (0);ma = (W & 1) == 0;da = (ma ? L : ia) + (ma ? (W & 255) >>> 1 : c[M >> 2] | 0) | 0;ma = xa;e: do
								if ((ma | 0) == (da | 0)) ya = da;
								else {
									ja = X;
									ba = X;
									ka = ma;
									while (1) {
										wa = c[e >> 2] | 0;
										do
											if (wa)
												if ((c[wa + 12 >> 2] | 0) == (c[wa + 16 >> 2] | 0))
													if ((xb[c[(c[wa >> 2] | 0) + 36 >> 2] & 63](wa) | 0) == -1) {
														c[e >> 2] = 0;
														za = 0;
														break
													} else {
														za = c[e >> 2] | 0;
														break
													}
										else za = wa;
										else za = 0;
										while (0);
										wa = (za | 0) == 0;
										do
											if (ba) {
												if ((c[ba + 12 >> 2] | 0) != (c[ba + 16 >> 2] | 0))
													if (wa) {
														Aa = ja;
														Ba = ba;
														break
													} else {
														ya = ka;
														break e
													}
												if ((xb[c[(c[ba >> 2] | 0) + 36 >> 2] & 63](ba) | 0) != -1)
													if (wa ^ (ja | 0) == 0) {
														Aa = ja;
														Ba = ja;
														break
													} else {
														ya = ka;
														break e
													}
												else {
													c[f >> 2] = 0;
													Ca = 0;
													_ = 107;
													break
												}
											} else {
												Ca = ja;
												_ = 107
											}
										while (0);
										if ((_ | 0) == 107) {
											_ = 0;
											if (wa) {
												ya = ka;
												break e
											} else {
												Aa = Ca;
												Ba = 0
											}
										}
										na = c[e >> 2] | 0;
										va = c[na + 12 >> 2] | 0;
										if ((va | 0) == (c[na + 16 >> 2] | 0)) Da = xb[c[(c[na >> 2] | 0) + 36 >> 2] & 63](na) | 0;
										else Da = d[va >> 0] | 0;
										if ((Da & 255) << 24 >> 24 != (a[ka >> 0] | 0)) {
											ya = ka;
											break e
										}
										va = c[e >> 2] | 0;
										na = va + 12 | 0;
										ha = c[na >> 2] | 0;
										if ((ha | 0) == (c[va + 16 >> 2] | 0)) xb[c[(c[va >> 2] | 0) + 40 >> 2] & 63](va) | 0;
										else c[na >> 2] = ha + 1;
										ka = ka + 1 | 0;
										ha = a[A >> 0] | 0;
										na = (ha & 1) == 0;
										va = (na ? L : c[j >> 2] | 0) + (na ? (ha & 255) >>> 1 : c[M >> 2] | 0) | 0;
										if ((ka | 0) == (va | 0)) {
											ya = va;
											break
										} else {
											ja = Aa;
											ba = Ba
										}
									}
								}while (0);
							if (K ? (ma = a[A >> 0] | 0, da = (ma & 1) == 0, (ya | 0) != ((da ? L : c[j >> 2] | 0) + (da ? (ma & 255) >>> 1 : c[M >> 2] | 0) | 0)) : 0) {
								_ = 119;
								break a
							} else {
								$ = S;
								aa = T
							}
							break
						}
					case 4:
						{
							ma = a[y >> 0] | 0;da = X;W = X;ia = S;ba = 0;f: while (1) {
								ja = c[e >> 2] | 0;
								do
									if (ja)
										if ((c[ja + 12 >> 2] | 0) == (c[ja + 16 >> 2] | 0))
											if ((xb[c[(c[ja >> 2] | 0) + 36 >> 2] & 63](ja) | 0) == -1) {
												c[e >> 2] = 0;
												Ea = 0;
												break
											} else {
												Ea = c[e >> 2] | 0;
												break
											}
								else Ea = ja;
								else Ea = 0;
								while (0);
								ja = (Ea | 0) == 0;
								do
									if (W) {
										if ((c[W + 12 >> 2] | 0) != (c[W + 16 >> 2] | 0))
											if (ja) {
												Fa = da;
												Ga = W;
												break
											} else {
												Ha = ia;
												Ia = da;
												Ja = ba;
												break f
											}
										if ((xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0) != -1)
											if (ja ^ (da | 0) == 0) {
												Fa = da;
												Ga = da;
												break
											} else {
												Ha = ia;
												Ia = da;
												Ja = ba;
												break f
											}
										else {
											c[f >> 2] = 0;
											Ka = 0;
											_ = 130;
											break
										}
									} else {
										Ka = da;
										_ = 130
									}
								while (0);
								if ((_ | 0) == 130) {
									_ = 0;
									if (ja) {
										Ha = ia;
										Ia = Ka;
										Ja = ba;
										break
									} else {
										Fa = Ka;
										Ga = 0
									}
								}
								ka = c[e >> 2] | 0;
								va = c[ka + 12 >> 2] | 0;
								if ((va | 0) == (c[ka + 16 >> 2] | 0)) La = xb[c[(c[ka >> 2] | 0) + 36 >> 2] & 63](ka) | 0;
								else La = d[va >> 0] | 0;
								va = La & 255;
								if (va << 24 >> 24 > -1 ? (b[(c[h >> 2] | 0) + (La << 24 >> 24 << 1) >> 1] & 2048) != 0 : 0) {
									ka = c[o >> 2] | 0;
									if ((ka | 0) == (c[r >> 2] | 0)) {
										Tn(n, o, r);
										Ma = c[o >> 2] | 0
									} else Ma = ka;
									c[o >> 2] = Ma + 1;
									a[Ma >> 0] = va;
									Na = ia;
									Oa = ba + 1 | 0
								} else {
									ka = a[z >> 0] | 0;
									if (!(va << 24 >> 24 == ma << 24 >> 24 & ((ba | 0) != 0 ? (((ka & 1) == 0 ? (ka & 255) >>> 1 : c[R >> 2] | 0) | 0) != 0 : 0))) {
										Ha = ia;
										Ia = Fa;
										Ja = ba;
										break
									}
									if ((ia | 0) == (c[v >> 2] | 0)) {
										Un(t, u, v);
										Pa = c[u >> 2] | 0
									} else Pa = ia;
									ka = Pa + 4 | 0;
									c[u >> 2] = ka;
									c[Pa >> 2] = ba;
									Na = ka;
									Oa = 0
								}
								ka = c[e >> 2] | 0;
								va = ka + 12 | 0;
								ha = c[va >> 2] | 0;
								if ((ha | 0) == (c[ka + 16 >> 2] | 0)) {
									xb[c[(c[ka >> 2] | 0) + 40 >> 2] & 63](ka) | 0;
									da = Fa;
									W = Ga;
									ia = Na;
									ba = Oa;
									continue
								} else {
									c[va >> 2] = ha + 1;
									da = Fa;
									W = Ga;
									ia = Na;
									ba = Oa;
									continue
								}
							}
							if ((Ja | 0) != 0 ? (c[t >> 2] | 0) != (Ha | 0) : 0) {
								if ((Ha | 0) == (c[v >> 2] | 0)) {
									Un(t, u, v);
									Qa = c[u >> 2] | 0
								} else Qa = Ha;
								ba = Qa + 4 | 0;
								c[u >> 2] = ba;
								c[Qa >> 2] = Ja;
								Ra = ba
							} else Ra = Ha;ba = c[E >> 2] | 0;
							if ((ba | 0) > 0) {
								ia = c[e >> 2] | 0;
								do
									if (ia)
										if ((c[ia + 12 >> 2] | 0) == (c[ia + 16 >> 2] | 0))
											if ((xb[c[(c[ia >> 2] | 0) + 36 >> 2] & 63](ia) | 0) == -1) {
												c[e >> 2] = 0;
												Sa = 0;
												break
											} else {
												Sa = c[e >> 2] | 0;
												break
											}
								else Sa = ia;
								else Sa = 0;
								while (0);
								ia = (Sa | 0) == 0;
								do
									if (Ia) {
										if ((c[Ia + 12 >> 2] | 0) == (c[Ia + 16 >> 2] | 0) ? (xb[c[(c[Ia >> 2] | 0) + 36 >> 2] & 63](Ia) | 0) == -1 : 0) {
											c[f >> 2] = 0;
											_ = 162;
											break
										}
										if (ia) Ta = Ia;
										else {
											_ = 167;
											break a
										}
									} else _ = 162; while (0);
								if ((_ | 0) == 162) {
									_ = 0;
									if (ia) {
										_ = 167;
										break a
									} else Ta = 0
								}
								W = c[e >> 2] | 0;
								da = c[W + 12 >> 2] | 0;
								if ((da | 0) == (c[W + 16 >> 2] | 0)) Ua = xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0;
								else Ua = d[da >> 0] | 0;
								if ((Ua & 255) << 24 >> 24 != (a[x >> 0] | 0)) {
									_ = 167;
									break a
								}
								da = c[e >> 2] | 0;
								W = da + 12 | 0;
								ma = c[W >> 2] | 0;
								if ((ma | 0) == (c[da + 16 >> 2] | 0)) xb[c[(c[da >> 2] | 0) + 40 >> 2] & 63](da) | 0;
								else c[W >> 2] = ma + 1;
								if ((ba | 0) > 0) {
									ma = Ta;
									W = Ta;
									da = ba;
									while (1) {
										ha = c[e >> 2] | 0;
										do
											if (ha)
												if ((c[ha + 12 >> 2] | 0) == (c[ha + 16 >> 2] | 0))
													if ((xb[c[(c[ha >> 2] | 0) + 36 >> 2] & 63](ha) | 0) == -1) {
														c[e >> 2] = 0;
														Va = 0;
														break
													} else {
														Va = c[e >> 2] | 0;
														break
													}
										else Va = ha;
										else Va = 0;
										while (0);
										ha = (Va | 0) == 0;
										do
											if (W) {
												if ((c[W + 12 >> 2] | 0) != (c[W + 16 >> 2] | 0))
													if (ha) {
														Wa = ma;
														Xa = W;
														break
													} else {
														_ = 189;
														break a
													}
												if ((xb[c[(c[W >> 2] | 0) + 36 >> 2] & 63](W) | 0) != -1)
													if (ha ^ (ma | 0) == 0) {
														Wa = ma;
														Xa = ma;
														break
													} else {
														_ = 189;
														break a
													}
												else {
													c[f >> 2] = 0;
													Ya = 0;
													_ = 182;
													break
												}
											} else {
												Ya = ma;
												_ = 182
											}
										while (0);
										if ((_ | 0) == 182) {
											_ = 0;
											if (ha) {
												_ = 189;
												break a
											} else {
												Wa = Ya;
												Xa = 0
											}
										}
										ja = c[e >> 2] | 0;
										va = c[ja + 12 >> 2] | 0;
										if ((va | 0) == (c[ja + 16 >> 2] | 0)) Za = xb[c[(c[ja >> 2] | 0) + 36 >> 2] & 63](ja) | 0;
										else Za = d[va >> 0] | 0;
										if ((Za & 255) << 24 >> 24 <= -1) {
											_ = 189;
											break a
										}
										if (!(b[(c[h >> 2] | 0) + (Za << 24 >> 24 << 1) >> 1] & 2048)) {
											_ = 189;
											break a
										}
										if ((c[o >> 2] | 0) == (c[r >> 2] | 0)) Tn(n, o, r);
										va = c[e >> 2] | 0;
										ja = c[va + 12 >> 2] | 0;
										if ((ja | 0) == (c[va + 16 >> 2] | 0)) _a = xb[c[(c[va >> 2] | 0) + 36 >> 2] & 63](va) | 0;
										else _a = d[ja >> 0] | 0;
										ja = c[o >> 2] | 0;
										c[o >> 2] = ja + 1;
										a[ja >> 0] = _a;
										ja = da;
										da = da + -1 | 0;
										c[E >> 2] = da;
										va = c[e >> 2] | 0;
										ka = va + 12 | 0;
										na = c[ka >> 2] | 0;
										if ((na | 0) == (c[va + 16 >> 2] | 0)) xb[c[(c[va >> 2] | 0) + 40 >> 2] & 63](va) | 0;
										else c[ka >> 2] = na + 1;
										if ((ja | 0) <= 1) break;
										else {
											ma = Wa;
											W = Xa
										}
									}
								}
							}
							if ((c[o >> 2] | 0) == (c[n >> 2] | 0)) {
								_ = 200;
								break a
							} else {
								$ = Ra;
								aa = T
							}
							break
						}
					default:
						{
							$ = S;aa = T
						}
				}
				while (0);
				g: do
					if ((_ | 0) == 28)
						while (1) {
							_ = 0;
							U = c[e >> 2] | 0;
							do
								if (U)
									if ((c[U + 12 >> 2] | 0) == (c[U + 16 >> 2] | 0))
										if ((xb[c[(c[U >> 2] | 0) + 36 >> 2] & 63](U) | 0) == -1) {
											c[e >> 2] = 0;
											$a = 0;
											break
										} else {
											$a = c[e >> 2] | 0;
											break
										}
							else $a = U;
							else $a = 0;
							while (0);
							U = ($a | 0) == 0;
							do
								if (ga) {
									if ((c[ga + 12 >> 2] | 0) != (c[ga + 16 >> 2] | 0))
										if (U) {
											ab = fa;
											bb = ga;
											break
										} else {
											$ = S;
											aa = T;
											break g
										}
									if ((xb[c[(c[ga >> 2] | 0) + 36 >> 2] & 63](ga) | 0) != -1)
										if (U ^ (fa | 0) == 0) {
											ab = fa;
											bb = fa;
											break
										} else {
											$ = S;
											aa = T;
											break g
										}
									else {
										c[f >> 2] = 0;
										cb = 0;
										_ = 38;
										break
									}
								} else {
									cb = fa;
									_ = 38
								}
							while (0);
							if ((_ | 0) == 38) {
								_ = 0;
								if (U) {
									$ = S;
									aa = T;
									break g
								} else {
									ab = cb;
									bb = 0
								}
							}
							ha = c[e >> 2] | 0;
							W = c[ha + 12 >> 2] | 0;
							if ((W | 0) == (c[ha + 16 >> 2] | 0)) db = xb[c[(c[ha >> 2] | 0) + 36 >> 2] & 63](ha) | 0;
							else db = d[W >> 0] | 0;
							if ((db & 255) << 24 >> 24 <= -1) {
								$ = S;
								aa = T;
								break g
							}
							if (!(b[(c[h >> 2] | 0) + (db << 24 >> 24 << 1) >> 1] & 8192)) {
								$ = S;
								aa = T;
								break g
							}
							W = c[e >> 2] | 0;
							ha = W + 12 | 0;
							ma = c[ha >> 2] | 0;
							if ((ma | 0) == (c[W + 16 >> 2] | 0)) eb = xb[c[(c[W >> 2] | 0) + 40 >> 2] & 63](W) | 0;
							else {
								c[ha >> 2] = ma + 1;
								eb = d[ma >> 0] | 0
							}
							Vf(D, eb & 255);
							fa = ab;
							ga = bb;
							_ = 28
						}
				while (0);
				s = s + 1 | 0;
			if (s >>> 0 >= 4) {
				Y = $;
				Z = aa;
				_ = 202;
				break
			} else {
				S = $;
				T = aa
			}
		}
		h: do
			if ((_ | 0) == 26) {
				c[k >> 2] = c[k >> 2] | 4;
				fb = 0
			} else
		if ((_ | 0) == 82) {
			c[k >> 2] = c[k >> 2] | 4;
			fb = 0
		} else if ((_ | 0) == 119) {
			c[k >> 2] = c[k >> 2] | 4;
			fb = 0
		} else if ((_ | 0) == 167) {
			c[k >> 2] = c[k >> 2] | 4;
			fb = 0
		} else if ((_ | 0) == 189) {
			c[k >> 2] = c[k >> 2] | 4;
			fb = 0
		} else if ((_ | 0) == 200) {
			c[k >> 2] = c[k >> 2] | 4;
			fb = 0
		} else if ((_ | 0) == 202) {
			i: do
				if (Z) {
					aa = Z + 1 | 0;
					T = Z + 8 | 0;
					$ = Z + 4 | 0;
					S = 1;
					j: while (1) {
						s = a[Z >> 0] | 0;
						if (!(s & 1)) gb = (s & 255) >>> 1;
						else gb = c[$ >> 2] | 0;
						if (S >>> 0 >= gb >>> 0) break i;
						s = c[e >> 2] | 0;
						do
							if (s)
								if ((c[s + 12 >> 2] | 0) == (c[s + 16 >> 2] | 0))
									if ((xb[c[(c[s >> 2] | 0) + 36 >> 2] & 63](s) | 0) == -1) {
										c[e >> 2] = 0;
										hb = 0;
										break
									} else {
										hb = c[e >> 2] | 0;
										break
									}
						else hb = s;
						else hb = 0;
						while (0);
						s = (hb | 0) == 0;
						U = c[f >> 2] | 0;
						do
							if (U) {
								if ((c[U + 12 >> 2] | 0) == (c[U + 16 >> 2] | 0) ? (xb[c[(c[U >> 2] | 0) + 36 >> 2] & 63](U) | 0) == -1 : 0) {
									c[f >> 2] = 0;
									_ = 218;
									break
								}
								if (!s) break j
							} else _ = 218; while (0);
						if ((_ | 0) == 218 ? (_ = 0, s) : 0) break;
						U = c[e >> 2] | 0;
						bb = c[U + 12 >> 2] | 0;
						if ((bb | 0) == (c[U + 16 >> 2] | 0)) ib = xb[c[(c[U >> 2] | 0) + 36 >> 2] & 63](U) | 0;
						else ib = d[bb >> 0] | 0;
						if (!(a[Z >> 0] & 1)) jb = aa;
						else jb = c[T >> 2] | 0;
						if ((ib & 255) << 24 >> 24 != (a[jb + S >> 0] | 0)) break;
						bb = S + 1 | 0;
						U = c[e >> 2] | 0;
						ga = U + 12 | 0;
						ab = c[ga >> 2] | 0;
						if ((ab | 0) == (c[U + 16 >> 2] | 0)) {
							xb[c[(c[U >> 2] | 0) + 40 >> 2] & 63](U) | 0;
							S = bb;
							continue
						} else {
							c[ga >> 2] = ab + 1;
							S = bb;
							continue
						}
					}
					c[k >> 2] = c[k >> 2] | 4;
					fb = 0;
					break h
				}while (0);S = c[t >> 2] | 0;
			if ((S | 0) != (Y | 0) ? (c[F >> 2] = 0, Tk(z, S, Y, F), (c[F >> 2] | 0) != 0) : 0) {
				c[k >> 2] = c[k >> 2] | 4;
				fb = 0
			} else fb = 1
		}
		while (0);
		Of(D);
		Of(C);
		Of(B);
		Of(A);
		Of(z);
		z = c[t >> 2] | 0;
		c[t >> 2] = 0;
		if (z) tb[c[p >> 2] & 127](z);
		i = q;
		return fb | 0
	}

	function Qk(a) {
		a = a | 0;
		return
	}

	function Rk(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0;
		b = i;
		i = i + 144 | 0;
		k = b;
		l = b + 28 | 0;
		m = b + 8 | 0;
		n = b + 24 | 0;
		o = b + 20 | 0;
		p = b + 128 | 0;
		q = b + 16 | 0;
		c[m >> 2] = l;
		r = m + 4 | 0;
		c[r >> 2] = 112;
		s = mg(g) | 0;
		c[o >> 2] = s;
		t = Gl(o, 9868) | 0;
		a[p >> 0] = 0;
		u = c[e >> 2] | 0;
		c[q >> 2] = u;
		v = c[g + 4 >> 2] | 0;
		c[k >> 2] = c[q >> 2];
		q = u;
		if (Pk(d, k, f, o, v, h, p, t, m, n, l + 100 | 0) | 0) {
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			if (a[p >> 0] | 0) Vf(j, Db[c[(c[t >> 2] | 0) + 28 >> 2] & 31](t, 45) | 0);
			p = Db[c[(c[t >> 2] | 0) + 28 >> 2] & 31](t, 48) | 0;
			t = c[m >> 2] | 0;
			l = c[n >> 2] | 0;
			n = l + -1 | 0;
			a: do
				if (t >>> 0 < n >>> 0) {
					v = t;
					while (1) {
						if ((a[v >> 0] | 0) != p << 24 >> 24) {
							w = v;
							break a
						}
						o = v + 1 | 0;
						if (o >>> 0 < n >>> 0) v = o;
						else {
							w = o;
							break
						}
					}
				} else w = t; while (0);
			Vn(j, w, l) | 0
		}
		l = c[d >> 2] | 0;
		do
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0))
					if ((xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1) {
						c[d >> 2] = 0;
						x = 0;
						break
					} else {
						x = c[d >> 2] | 0;
						break
					}
		else x = l;
		else x = 0;
		while (0);
		l = (x | 0) == 0;
		do
			if (u) {
				if ((c[q + 12 >> 2] | 0) == (c[q + 16 >> 2] | 0) ? (xb[c[(c[u >> 2] | 0) + 36 >> 2] & 63](q) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 21;
					break
				}
				if (!l) y = 22
			} else y = 21; while (0);
		if ((y | 0) == 21 ? l : 0) y = 22;
		if ((y | 0) == 22) c[h >> 2] = c[h >> 2] | 2;
		h = c[d >> 2] | 0;
		ep(s) | 0;
		s = c[m >> 2] | 0;
		c[m >> 2] = 0;
		if (s) tb[c[r >> 2] & 127](s);
		i = b;
		return h | 0
	}

	function Sk(b, d, e, f, g, h, j, k, l, m) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		n = i;
		i = i + 112 | 0;
		o = n;
		p = n + 40 | 0;
		q = n + 76 | 0;
		r = n + 4 | 0;
		s = n + 88 | 0;
		t = n + 100 | 0;
		u = n + 28 | 0;
		v = n + 64 | 0;
		w = n + 52 | 0;
		x = n + 16 | 0;
		if (b) {
			b = Gl(d, 9476) | 0;
			ub[c[(c[b >> 2] | 0) + 44 >> 2] & 63](o, b);
			y = c[o >> 2] | 0;
			a[e >> 0] = y;
			a[e + 1 >> 0] = y >> 8;
			a[e + 2 >> 0] = y >> 16;
			a[e + 3 >> 0] = y >> 24;
			ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](p, b);
			if (!(a[l >> 0] & 1)) {
				a[l + 1 >> 0] = 0;
				a[l >> 0] = 0
			} else {
				a[c[l + 8 >> 2] >> 0] = 0;
				c[l + 4 >> 2] = 0
			}
			Uf(l, 0);
			c[l >> 2] = c[p >> 2];
			c[l + 4 >> 2] = c[p + 4 >> 2];
			c[l + 8 >> 2] = c[p + 8 >> 2];
			c[p >> 2] = 0;
			c[p + 4 >> 2] = 0;
			c[p + 8 >> 2] = 0;
			Of(p);
			ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](q, b);
			if (!(a[k >> 0] & 1)) {
				a[k + 1 >> 0] = 0;
				a[k >> 0] = 0
			} else {
				a[c[k + 8 >> 2] >> 0] = 0;
				c[k + 4 >> 2] = 0
			}
			Uf(k, 0);
			c[k >> 2] = c[q >> 2];
			c[k + 4 >> 2] = c[q + 4 >> 2];
			c[k + 8 >> 2] = c[q + 8 >> 2];
			c[q >> 2] = 0;
			c[q + 4 >> 2] = 0;
			c[q + 8 >> 2] = 0;
			Of(q);
			a[f >> 0] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			a[g >> 0] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](r, b);
			if (!(a[h >> 0] & 1)) {
				a[h + 1 >> 0] = 0;
				a[h >> 0] = 0
			} else {
				a[c[h + 8 >> 2] >> 0] = 0;
				c[h + 4 >> 2] = 0
			}
			Uf(h, 0);
			c[h >> 2] = c[r >> 2];
			c[h + 4 >> 2] = c[r + 4 >> 2];
			c[h + 8 >> 2] = c[r + 8 >> 2];
			c[r >> 2] = 0;
			c[r + 4 >> 2] = 0;
			c[r + 8 >> 2] = 0;
			Of(r);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](s, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[s >> 2];
			c[j + 4 >> 2] = c[s + 4 >> 2];
			c[j + 8 >> 2] = c[s + 8 >> 2];
			c[s >> 2] = 0;
			c[s + 4 >> 2] = 0;
			c[s + 8 >> 2] = 0;
			Of(s);
			z = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		} else {
			b = Gl(d, 9412) | 0;
			ub[c[(c[b >> 2] | 0) + 44 >> 2] & 63](t, b);
			d = c[t >> 2] | 0;
			a[e >> 0] = d;
			a[e + 1 >> 0] = d >> 8;
			a[e + 2 >> 0] = d >> 16;
			a[e + 3 >> 0] = d >> 24;
			ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](u, b);
			if (!(a[l >> 0] & 1)) {
				a[l + 1 >> 0] = 0;
				a[l >> 0] = 0
			} else {
				a[c[l + 8 >> 2] >> 0] = 0;
				c[l + 4 >> 2] = 0
			}
			Uf(l, 0);
			c[l >> 2] = c[u >> 2];
			c[l + 4 >> 2] = c[u + 4 >> 2];
			c[l + 8 >> 2] = c[u + 8 >> 2];
			c[u >> 2] = 0;
			c[u + 4 >> 2] = 0;
			c[u + 8 >> 2] = 0;
			Of(u);
			ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](v, b);
			if (!(a[k >> 0] & 1)) {
				a[k + 1 >> 0] = 0;
				a[k >> 0] = 0
			} else {
				a[c[k + 8 >> 2] >> 0] = 0;
				c[k + 4 >> 2] = 0
			}
			Uf(k, 0);
			c[k >> 2] = c[v >> 2];
			c[k + 4 >> 2] = c[v + 4 >> 2];
			c[k + 8 >> 2] = c[v + 8 >> 2];
			c[v >> 2] = 0;
			c[v + 4 >> 2] = 0;
			c[v + 8 >> 2] = 0;
			Of(v);
			a[f >> 0] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			a[g >> 0] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](w, b);
			if (!(a[h >> 0] & 1)) {
				a[h + 1 >> 0] = 0;
				a[h >> 0] = 0
			} else {
				a[c[h + 8 >> 2] >> 0] = 0;
				c[h + 4 >> 2] = 0
			}
			Uf(h, 0);
			c[h >> 2] = c[w >> 2];
			c[h + 4 >> 2] = c[w + 4 >> 2];
			c[h + 8 >> 2] = c[w + 8 >> 2];
			c[w >> 2] = 0;
			c[w + 4 >> 2] = 0;
			c[w + 8 >> 2] = 0;
			Of(w);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](x, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[x >> 2];
			c[j + 4 >> 2] = c[x + 4 >> 2];
			c[j + 8 >> 2] = c[x + 8 >> 2];
			c[x >> 2] = 0;
			c[x + 4 >> 2] = 0;
			c[x + 8 >> 2] = 0;
			Of(x);
			z = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		}
		c[m >> 2] = z;
		i = n;
		return
	}

	function Tk(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0;
		g = a[b >> 0] | 0;
		h = b + 4 | 0;
		i = c[h >> 2] | 0;
		a: do
			if (((g & 1) == 0 ? (g & 255) >>> 1 : i) | 0) {
				if ((d | 0) == (e | 0)) {
					j = g;
					k = i
				} else {
					l = e + -4 | 0;
					if (l >>> 0 > d >>> 0) {
						m = d;
						n = l;
						do {
							l = c[m >> 2] | 0;
							c[m >> 2] = c[n >> 2];
							c[n >> 2] = l;
							m = m + 4 | 0;
							n = n + -4 | 0
						} while (m >>> 0 < n >>> 0)
					}
					j = a[b >> 0] | 0;
					k = c[h >> 2] | 0
				}
				n = (j & 1) == 0;
				m = n ? b + 1 | 0 : c[b + 8 >> 2] | 0;
				l = e + -4 | 0;
				o = m + (n ? (j & 255) >>> 1 : k) | 0;
				n = a[m >> 0] | 0;
				p = n << 24 >> 24 < 1 | n << 24 >> 24 == 127;
				b: do
					if (l >>> 0 > d >>> 0) {
						q = n;
						r = m;
						s = d;
						t = p;
						while (1) {
							if (!t ? (q << 24 >> 24 | 0) != (c[s >> 2] | 0) : 0) break;
							r = (o - r | 0) > 1 ? r + 1 | 0 : r;
							s = s + 4 | 0;
							u = a[r >> 0] | 0;
							v = u << 24 >> 24 < 1 | u << 24 >> 24 == 127;
							if (s >>> 0 >= l >>> 0) {
								w = u;
								x = v;
								break b
							} else {
								q = u;
								t = v
							}
						}
						c[f >> 2] = 4;
						break a
					} else {
						w = n;
						x = p
					}
				while (0);
				if (!x ? ((c[l >> 2] | 0) + -1 | 0) >>> 0 >= w << 24 >> 24 >>> 0 : 0) c[f >> 2] = 4
			}
		while (0);
		return
	}

	function Uk(a) {
		a = a | 0;
		return
	}

	function Vk(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Wk(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0;
		b = i;
		i = i + 576 | 0;
		k = b + 432 | 0;
		l = b;
		m = b + 24 | 0;
		n = b + 16 | 0;
		o = b + 8 | 0;
		p = b + 4 | 0;
		q = b + 572 | 0;
		r = b + 424 | 0;
		s = b + 472 | 0;
		c[n >> 2] = m;
		t = n + 4 | 0;
		c[t >> 2] = 112;
		c[p >> 2] = mg(g) | 0;
		u = Gl(p, 9860) | 0;
		a[q >> 0] = 0;
		c[r >> 2] = c[e >> 2];
		v = c[g + 4 >> 2] | 0;
		c[k >> 2] = c[r >> 2];
		if (Xk(d, k, f, p, v, h, q, u, n, o, m + 400 | 0) | 0) {
			Bb[c[(c[u >> 2] | 0) + 48 >> 2] & 7](u, 22369, 22379, k) | 0;
			u = c[o >> 2] | 0;
			m = c[n >> 2] | 0;
			v = u - m | 0;
			if ((v | 0) > 392) {
				f = qd((v >> 2) + 2 | 0) | 0;
				if (!f) md();
				else {
					w = f;
					x = f
				}
			} else {
				w = 0;
				x = s
			}
			if (!(a[q >> 0] | 0)) y = x;
			else {
				a[x >> 0] = 45;
				y = x + 1 | 0
			}
			x = k + 40 | 0;
			q = k;
			if (m >>> 0 < u >>> 0) {
				u = k + 4 | 0;
				f = u + 4 | 0;
				v = f + 4 | 0;
				r = v + 4 | 0;
				g = r + 4 | 0;
				z = g + 4 | 0;
				A = z + 4 | 0;
				B = A + 4 | 0;
				C = B + 4 | 0;
				D = y;
				E = m;
				while (1) {
					m = c[E >> 2] | 0;
					if ((c[k >> 2] | 0) != (m | 0))
						if ((c[u >> 2] | 0) != (m | 0))
							if ((c[f >> 2] | 0) != (m | 0))
								if ((c[v >> 2] | 0) != (m | 0))
									if ((c[r >> 2] | 0) != (m | 0))
										if ((c[g >> 2] | 0) != (m | 0))
											if ((c[z >> 2] | 0) != (m | 0))
												if ((c[A >> 2] | 0) != (m | 0))
													if ((c[B >> 2] | 0) == (m | 0)) F = B;
													else F = (c[C >> 2] | 0) == (m | 0) ? C : x;
					else F = A;
					else F = z;
					else F = g;
					else F = r;
					else F = v;
					else F = f;
					else F = u;
					else F = k;
					a[D >> 0] = a[22369 + (F - q >> 2) >> 0] | 0;
					E = E + 4 | 0;
					m = D + 1 | 0;
					if (E >>> 0 >= (c[o >> 2] | 0) >>> 0) {
						G = m;
						break
					} else D = m
				}
			} else G = y;
			a[G >> 0] = 0;
			c[l >> 2] = j;
			Be(s, 22365, l) | 0;
			if (w) rd(w)
		}
		w = c[d >> 2] | 0;
		do
			if (w) {
				l = c[w + 12 >> 2] | 0;
				if ((l | 0) == (c[w + 16 >> 2] | 0)) H = xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0;
				else H = c[l >> 2] | 0;
				if ((H | 0) == -1) {
					c[d >> 2] = 0;
					I = 1;
					break
				} else {
					I = (c[d >> 2] | 0) == 0;
					break
				}
			} else I = 1; while (0);
		H = c[e >> 2] | 0;
		do
			if (H) {
				w = c[H + 12 >> 2] | 0;
				if ((w | 0) == (c[H + 16 >> 2] | 0)) J = xb[c[(c[H >> 2] | 0) + 36 >> 2] & 63](H) | 0;
				else J = c[w >> 2] | 0;
				if ((J | 0) != -1)
					if (I) break;
					else {
						K = 30;
						break
					}
				else {
					c[e >> 2] = 0;
					K = 28;
					break
				}
			} else K = 28; while (0);
		if ((K | 0) == 28 ? I : 0) K = 30;
		if ((K | 0) == 30) c[h >> 2] = c[h >> 2] | 2;
		h = c[d >> 2] | 0;
		ep(c[p >> 2] | 0) | 0;
		p = c[n >> 2] | 0;
		c[n >> 2] = 0;
		if (p) tb[c[t >> 2] & 127](p);
		i = b;
		return h | 0
	}

	function Xk(b, e, f, g, h, j, k, l, m, n, o) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		var p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0,
			wa = 0,
			xa = 0,
			ya = 0,
			za = 0,
			Aa = 0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0,
			La = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0,
			Ua = 0,
			Va = 0,
			Wa = 0,
			Xa = 0,
			Ya = 0,
			Za = 0,
			_a = 0,
			$a = 0,
			ab = 0,
			bb = 0,
			cb = 0,
			db = 0,
			eb = 0,
			fb = 0,
			gb = 0,
			hb = 0,
			ib = 0,
			jb = 0,
			kb = 0,
			lb = 0,
			mb = 0,
			nb = 0,
			ob = 0,
			pb = 0,
			rb = 0,
			sb = 0,
			ub = 0,
			vb = 0,
			wb = 0,
			yb = 0,
			zb = 0;
		p = i;
		i = i + 512 | 0;
		q = p + 40 | 0;
		r = p + 88 | 0;
		s = p + 32 | 0;
		t = p + 24 | 0;
		u = p + 80 | 0;
		v = p + 504 | 0;
		w = p + 496 | 0;
		x = p + 500 | 0;
		y = p + 44 | 0;
		z = p;
		A = p + 68 | 0;
		B = p + 12 | 0;
		C = p + 56 | 0;
		D = p + 492 | 0;
		E = p + 488 | 0;
		c[q >> 2] = o;
		c[s >> 2] = r;
		o = s + 4 | 0;
		c[o >> 2] = 112;
		c[t >> 2] = r;
		c[u >> 2] = r + 400;
		c[y >> 2] = 0;
		c[y + 4 >> 2] = 0;
		c[y + 8 >> 2] = 0;
		c[z >> 2] = 0;
		c[z + 4 >> 2] = 0;
		c[z + 8 >> 2] = 0;
		c[A >> 2] = 0;
		c[A + 4 >> 2] = 0;
		c[A + 8 >> 2] = 0;
		c[B >> 2] = 0;
		c[B + 4 >> 2] = 0;
		c[B + 8 >> 2] = 0;
		c[C >> 2] = 0;
		c[C + 4 >> 2] = 0;
		c[C + 8 >> 2] = 0;
		Zk(f, g, v, w, x, y, z, A, B, D);
		c[n >> 2] = c[m >> 2];
		g = A + 4 | 0;
		f = B + 4 | 0;
		F = B + 8 | 0;
		G = A + 8 | 0;
		H = (h & 512 | 0) != 0;
		h = z + 8 | 0;
		I = z + 4 | 0;
		J = C + 4 | 0;
		K = C + 8 | 0;
		L = v + 3 | 0;
		M = y + 4 | 0;
		N = r;
		r = 0;
		O = 0;
		a: while (1) {
			P = c[b >> 2] | 0;
			do
				if (P) {
					Q = c[P + 12 >> 2] | 0;
					if ((Q | 0) == (c[P + 16 >> 2] | 0)) R = xb[c[(c[P >> 2] | 0) + 36 >> 2] & 63](P) | 0;
					else R = c[Q >> 2] | 0;
					if ((R | 0) == -1) {
						c[b >> 2] = 0;
						S = 1;
						break
					} else {
						S = (c[b >> 2] | 0) == 0;
						break
					}
				} else S = 1; while (0);
			P = c[e >> 2] | 0;
			do
				if (P) {
					Q = c[P + 12 >> 2] | 0;
					if ((Q | 0) == (c[P + 16 >> 2] | 0)) T = xb[c[(c[P >> 2] | 0) + 36 >> 2] & 63](P) | 0;
					else T = c[Q >> 2] | 0;
					if ((T | 0) != -1)
						if (S) {
							U = P;
							break
						} else {
							V = N;
							W = O;
							X = 217;
							break a
						}
					else {
						c[e >> 2] = 0;
						X = 15;
						break
					}
				} else X = 15; while (0);
			if ((X | 0) == 15) {
				X = 0;
				if (S) {
					V = N;
					W = O;
					X = 217;
					break
				} else U = 0
			}
			b: do switch (a[v + r >> 0] | 0) {
					case 1:
						{
							if ((r | 0) == 3) {
								Y = N;
								Z = O
							} else {
								P = c[b >> 2] | 0;
								Q = c[P + 12 >> 2] | 0;
								if ((Q | 0) == (c[P + 16 >> 2] | 0)) _ = xb[c[(c[P >> 2] | 0) + 36 >> 2] & 63](P) | 0;
								else _ = c[Q >> 2] | 0;
								if (!(qb[c[(c[l >> 2] | 0) + 12 >> 2] & 31](l, 8192, _) | 0)) {
									X = 28;
									break a
								}
								Q = c[b >> 2] | 0;
								P = Q + 12 | 0;
								$ = c[P >> 2] | 0;
								if (($ | 0) == (c[Q + 16 >> 2] | 0)) aa = xb[c[(c[Q >> 2] | 0) + 40 >> 2] & 63](Q) | 0;
								else {
									c[P >> 2] = $ + 4;
									aa = c[$ >> 2] | 0
								}
								cg(C, aa);
								ba = U;
								ca = U;
								X = 30
							}
							break
						}
					case 0:
						{
							if ((r | 0) == 3) {
								Y = N;
								Z = O
							} else {
								ba = U;
								ca = U;
								X = 30
							}
							break
						}
					case 3:
						{
							$ = a[A >> 0] | 0;P = ($ & 1) == 0 ? ($ & 255) >>> 1 : c[g >> 2] | 0;Q = a[B >> 0] | 0;da = (Q & 1) == 0 ? (Q & 255) >>> 1 : c[f >> 2] | 0;
							if ((P | 0) == (0 - da | 0)) {
								Y = N;
								Z = O
							} else {
								Q = (P | 0) == 0;
								P = c[b >> 2] | 0;
								ea = c[P + 12 >> 2] | 0;
								fa = c[P + 16 >> 2] | 0;
								ga = (ea | 0) == (fa | 0);
								if (Q | (da | 0) == 0) {
									if (ga) ha = xb[c[(c[P >> 2] | 0) + 36 >> 2] & 63](P) | 0;
									else ha = c[ea >> 2] | 0;
									if (Q) {
										if ((ha | 0) != (c[((a[B >> 0] & 1) == 0 ? f : c[F >> 2] | 0) >> 2] | 0)) {
											Y = N;
											Z = O;
											break b
										}
										Q = c[b >> 2] | 0;
										da = Q + 12 | 0;
										ia = c[da >> 2] | 0;
										if ((ia | 0) == (c[Q + 16 >> 2] | 0)) xb[c[(c[Q >> 2] | 0) + 40 >> 2] & 63](Q) | 0;
										else c[da >> 2] = ia + 4;
										a[k >> 0] = 1;
										ia = a[B >> 0] | 0;
										Y = N;
										Z = ((ia & 1) == 0 ? (ia & 255) >>> 1 : c[f >> 2] | 0) >>> 0 > 1 ? B : O;
										break b
									}
									if ((ha | 0) != (c[((a[A >> 0] & 1) == 0 ? g : c[G >> 2] | 0) >> 2] | 0)) {
										a[k >> 0] = 1;
										Y = N;
										Z = O;
										break b
									}
									ia = c[b >> 2] | 0;
									da = ia + 12 | 0;
									Q = c[da >> 2] | 0;
									if ((Q | 0) == (c[ia + 16 >> 2] | 0)) xb[c[(c[ia >> 2] | 0) + 40 >> 2] & 63](ia) | 0;
									else c[da >> 2] = Q + 4;
									Q = a[A >> 0] | 0;
									Y = N;
									Z = ((Q & 1) == 0 ? (Q & 255) >>> 1 : c[g >> 2] | 0) >>> 0 > 1 ? A : O;
									break b
								}
								if (ga) {
									ga = xb[c[(c[P >> 2] | 0) + 36 >> 2] & 63](P) | 0;
									Q = c[b >> 2] | 0;
									ja = ga;
									ka = a[A >> 0] | 0;
									la = Q;
									ma = c[Q + 12 >> 2] | 0;
									na = c[Q + 16 >> 2] | 0
								} else {
									ja = c[ea >> 2] | 0;
									ka = $;
									la = P;
									ma = ea;
									na = fa
								}
								fa = la + 12 | 0;
								ea = (ma | 0) == (na | 0);
								if ((ja | 0) == (c[((ka & 1) == 0 ? g : c[G >> 2] | 0) >> 2] | 0)) {
									if (ea) xb[c[(c[la >> 2] | 0) + 40 >> 2] & 63](la) | 0;
									else c[fa >> 2] = ma + 4;
									fa = a[A >> 0] | 0;
									Y = N;
									Z = ((fa & 1) == 0 ? (fa & 255) >>> 1 : c[g >> 2] | 0) >>> 0 > 1 ? A : O;
									break b
								}
								if (ea) oa = xb[c[(c[la >> 2] | 0) + 36 >> 2] & 63](la) | 0;
								else oa = c[ma >> 2] | 0;
								if ((oa | 0) != (c[((a[B >> 0] & 1) == 0 ? f : c[F >> 2] | 0) >> 2] | 0)) {
									X = 86;
									break a
								}
								ea = c[b >> 2] | 0;
								fa = ea + 12 | 0;
								P = c[fa >> 2] | 0;
								if ((P | 0) == (c[ea + 16 >> 2] | 0)) xb[c[(c[ea >> 2] | 0) + 40 >> 2] & 63](ea) | 0;
								else c[fa >> 2] = P + 4;
								a[k >> 0] = 1;
								P = a[B >> 0] | 0;
								Y = N;
								Z = ((P & 1) == 0 ? (P & 255) >>> 1 : c[f >> 2] | 0) >>> 0 > 1 ? B : O
							}
							break
						}
					case 2:
						{
							if (!(r >>> 0 < 2 | (O | 0) != 0) ? !(H | (r | 0) == 2 & (a[L >> 0] | 0) != 0) : 0) {
								Y = N;
								Z = 0;
								break b
							}
							P = a[z >> 0] | 0;fa = c[h >> 2] | 0;ea = (P & 1) == 0 ? I : fa;$ = ea;c: do
								if ((r | 0) != 0 ? (d[v + (r + -1) >> 0] | 0) < 2 : 0) {
									Q = (P & 1) == 0;
									d: do
										if ((ea | 0) == ((Q ? I : fa) + ((Q ? (P & 255) >>> 1 : c[I >> 2] | 0) << 2) | 0)) {
											pa = P;
											qa = fa;
											ra = $
										} else {
											ga = ea;
											da = $;
											while (1) {
												if (!(qb[c[(c[l >> 2] | 0) + 12 >> 2] & 31](l, 8192, c[ga >> 2] | 0) | 0)) {
													sa = da;
													break
												}
												ga = ga + 4 | 0;
												ia = ga;
												ta = a[z >> 0] | 0;
												ua = c[h >> 2] | 0;
												va = (ta & 1) == 0;
												if ((ga | 0) == ((va ? I : ua) + ((va ? (ta & 255) >>> 1 : c[I >> 2] | 0) << 2) | 0)) {
													pa = ta;
													qa = ua;
													ra = ia;
													break d
												} else da = ia
											}
											pa = a[z >> 0] | 0;
											qa = c[h >> 2] | 0;
											ra = sa
										}
									while (0);
									Q = (pa & 1) == 0 ? I : qa;
									da = Q;
									ga = ra - da >> 2;
									ia = a[C >> 0] | 0;
									ua = (ia & 1) == 0;
									ta = ua ? (ia & 255) >>> 1 : c[J >> 2] | 0;
									if (ta >>> 0 >= ga >>> 0) {
										ia = ua ? J : c[K >> 2] | 0;
										ua = ia + (ta << 2) | 0;
										if (!ga) {
											wa = qa;
											xa = pa;
											ya = ra
										} else {
											va = Q;
											Q = ia + (ta - ga << 2) | 0;
											while (1) {
												if ((c[Q >> 2] | 0) != (c[va >> 2] | 0)) {
													wa = qa;
													xa = pa;
													ya = da;
													break c
												}
												Q = Q + 4 | 0;
												if ((Q | 0) == (ua | 0)) {
													wa = qa;
													xa = pa;
													ya = ra;
													break
												} else va = va + 4 | 0
											}
										}
									} else {
										wa = qa;
										xa = pa;
										ya = da
									}
								} else {
									wa = fa;
									xa = P;
									ya = $
								}while (0);$ = (xa & 1) == 0;P = ($ ? I : wa) + (($ ? (xa & 255) >>> 1 : c[I >> 2] | 0) << 2) | 0;$ = ya;e: do
								if (($ | 0) == (P | 0)) za = P;
								else {
									fa = U;
									ea = U;
									va = $;
									while (1) {
										ua = c[b >> 2] | 0;
										do
											if (ua) {
												Q = c[ua + 12 >> 2] | 0;
												if ((Q | 0) == (c[ua + 16 >> 2] | 0)) Aa = xb[c[(c[ua >> 2] | 0) + 36 >> 2] & 63](ua) | 0;
												else Aa = c[Q >> 2] | 0;
												if ((Aa | 0) == -1) {
													c[b >> 2] = 0;
													Ba = 1;
													break
												} else {
													Ba = (c[b >> 2] | 0) == 0;
													break
												}
											} else Ba = 1; while (0);
										do
											if (ea) {
												ua = c[ea + 12 >> 2] | 0;
												if ((ua | 0) == (c[ea + 16 >> 2] | 0)) Ca = xb[c[(c[ea >> 2] | 0) + 36 >> 2] & 63](ea) | 0;
												else Ca = c[ua >> 2] | 0;
												if ((Ca | 0) != -1)
													if (Ba ^ (fa | 0) == 0) {
														Da = fa;
														Ea = fa;
														break
													} else {
														za = va;
														break e
													}
												else {
													c[e >> 2] = 0;
													Fa = 0;
													X = 114;
													break
												}
											} else {
												Fa = fa;
												X = 114
											}
										while (0);
										if ((X | 0) == 114) {
											X = 0;
											if (Ba) {
												za = va;
												break e
											} else {
												Da = Fa;
												Ea = 0
											}
										}
										ua = c[b >> 2] | 0;
										Q = c[ua + 12 >> 2] | 0;
										if ((Q | 0) == (c[ua + 16 >> 2] | 0)) Ga = xb[c[(c[ua >> 2] | 0) + 36 >> 2] & 63](ua) | 0;
										else Ga = c[Q >> 2] | 0;
										if ((Ga | 0) != (c[va >> 2] | 0)) {
											za = va;
											break e
										}
										Q = c[b >> 2] | 0;
										ua = Q + 12 | 0;
										ga = c[ua >> 2] | 0;
										if ((ga | 0) == (c[Q + 16 >> 2] | 0)) xb[c[(c[Q >> 2] | 0) + 40 >> 2] & 63](Q) | 0;
										else c[ua >> 2] = ga + 4;
										va = va + 4 | 0;
										ga = a[z >> 0] | 0;
										ua = (ga & 1) == 0;
										Q = (ua ? I : c[h >> 2] | 0) + ((ua ? (ga & 255) >>> 1 : c[I >> 2] | 0) << 2) | 0;
										if ((va | 0) == (Q | 0)) {
											za = Q;
											break
										} else {
											fa = Da;
											ea = Ea
										}
									}
								}while (0);
							if (H ? ($ = a[z >> 0] | 0, P = ($ & 1) == 0, (za | 0) != ((P ? I : c[h >> 2] | 0) + ((P ? ($ & 255) >>> 1 : c[I >> 2] | 0) << 2) | 0)) : 0) {
								X = 126;
								break a
							} else {
								Y = N;
								Z = O
							}
							break
						}
					case 4:
						{
							$ = c[x >> 2] | 0;P = U;ea = U;fa = N;va = 0;f: while (1) {
								da = c[b >> 2] | 0;
								do
									if (da) {
										Q = c[da + 12 >> 2] | 0;
										if ((Q | 0) == (c[da + 16 >> 2] | 0)) Ha = xb[c[(c[da >> 2] | 0) + 36 >> 2] & 63](da) | 0;
										else Ha = c[Q >> 2] | 0;
										if ((Ha | 0) == -1) {
											c[b >> 2] = 0;
											Ia = 1;
											break
										} else {
											Ia = (c[b >> 2] | 0) == 0;
											break
										}
									} else Ia = 1; while (0);
								do
									if (ea) {
										da = c[ea + 12 >> 2] | 0;
										if ((da | 0) == (c[ea + 16 >> 2] | 0)) Ja = xb[c[(c[ea >> 2] | 0) + 36 >> 2] & 63](ea) | 0;
										else Ja = c[da >> 2] | 0;
										if ((Ja | 0) != -1)
											if (Ia ^ (P | 0) == 0) {
												Ka = P;
												La = P;
												break
											} else {
												Ma = fa;
												Na = P;
												Oa = va;
												break f
											}
										else {
											c[e >> 2] = 0;
											Pa = 0;
											X = 140;
											break
										}
									} else {
										Pa = P;
										X = 140
									}
								while (0);
								if ((X | 0) == 140) {
									X = 0;
									if (Ia) {
										Ma = fa;
										Na = Pa;
										Oa = va;
										break
									} else {
										Ka = Pa;
										La = 0
									}
								}
								da = c[b >> 2] | 0;
								Q = c[da + 12 >> 2] | 0;
								if ((Q | 0) == (c[da + 16 >> 2] | 0)) Qa = xb[c[(c[da >> 2] | 0) + 36 >> 2] & 63](da) | 0;
								else Qa = c[Q >> 2] | 0;
								if (qb[c[(c[l >> 2] | 0) + 12 >> 2] & 31](l, 2048, Qa) | 0) {
									Q = c[n >> 2] | 0;
									if ((Q | 0) == (c[q >> 2] | 0)) {
										Wn(m, n, q);
										Ra = c[n >> 2] | 0
									} else Ra = Q;
									c[n >> 2] = Ra + 4;
									c[Ra >> 2] = Qa;
									Sa = fa;
									Ta = va + 1 | 0
								} else {
									Q = a[y >> 0] | 0;
									if (!((Qa | 0) == ($ | 0) & ((va | 0) != 0 ? (((Q & 1) == 0 ? (Q & 255) >>> 1 : c[M >> 2] | 0) | 0) != 0 : 0))) {
										Ma = fa;
										Na = Ka;
										Oa = va;
										break
									}
									if ((fa | 0) == (c[u >> 2] | 0)) {
										Un(s, t, u);
										Ua = c[t >> 2] | 0
									} else Ua = fa;
									Q = Ua + 4 | 0;
									c[t >> 2] = Q;
									c[Ua >> 2] = va;
									Sa = Q;
									Ta = 0
								}
								Q = c[b >> 2] | 0;
								da = Q + 12 | 0;
								ga = c[da >> 2] | 0;
								if ((ga | 0) == (c[Q + 16 >> 2] | 0)) {
									xb[c[(c[Q >> 2] | 0) + 40 >> 2] & 63](Q) | 0;
									P = Ka;
									ea = La;
									fa = Sa;
									va = Ta;
									continue
								} else {
									c[da >> 2] = ga + 4;
									P = Ka;
									ea = La;
									fa = Sa;
									va = Ta;
									continue
								}
							}
							if ((Oa | 0) != 0 ? (c[s >> 2] | 0) != (Ma | 0) : 0) {
								if ((Ma | 0) == (c[u >> 2] | 0)) {
									Un(s, t, u);
									Va = c[t >> 2] | 0
								} else Va = Ma;
								va = Va + 4 | 0;
								c[t >> 2] = va;
								c[Va >> 2] = Oa;
								Wa = va
							} else Wa = Ma;va = c[D >> 2] | 0;
							if ((va | 0) > 0) {
								fa = c[b >> 2] | 0;
								do
									if (fa) {
										ea = c[fa + 12 >> 2] | 0;
										if ((ea | 0) == (c[fa + 16 >> 2] | 0)) Xa = xb[c[(c[fa >> 2] | 0) + 36 >> 2] & 63](fa) | 0;
										else Xa = c[ea >> 2] | 0;
										if ((Xa | 0) == -1) {
											c[b >> 2] = 0;
											Ya = 1;
											break
										} else {
											Ya = (c[b >> 2] | 0) == 0;
											break
										}
									} else Ya = 1; while (0);
								do
									if (Na) {
										fa = c[Na + 12 >> 2] | 0;
										if ((fa | 0) == (c[Na + 16 >> 2] | 0)) Za = xb[c[(c[Na >> 2] | 0) + 36 >> 2] & 63](Na) | 0;
										else Za = c[fa >> 2] | 0;
										if ((Za | 0) != -1)
											if (Ya) {
												_a = Na;
												break
											} else {
												X = 180;
												break a
											}
										else {
											c[e >> 2] = 0;
											X = 174;
											break
										}
									} else X = 174; while (0);
								if ((X | 0) == 174) {
									X = 0;
									if (Ya) {
										X = 180;
										break a
									} else _a = 0
								}
								fa = c[b >> 2] | 0;
								ea = c[fa + 12 >> 2] | 0;
								if ((ea | 0) == (c[fa + 16 >> 2] | 0)) $a = xb[c[(c[fa >> 2] | 0) + 36 >> 2] & 63](fa) | 0;
								else $a = c[ea >> 2] | 0;
								if (($a | 0) != (c[w >> 2] | 0)) {
									X = 180;
									break a
								}
								ea = c[b >> 2] | 0;
								fa = ea + 12 | 0;
								P = c[fa >> 2] | 0;
								if ((P | 0) == (c[ea + 16 >> 2] | 0)) xb[c[(c[ea >> 2] | 0) + 40 >> 2] & 63](ea) | 0;
								else c[fa >> 2] = P + 4;
								if ((va | 0) > 0) {
									P = _a;
									fa = _a;
									ea = va;
									while (1) {
										$ = c[b >> 2] | 0;
										do
											if ($) {
												ga = c[$ + 12 >> 2] | 0;
												if ((ga | 0) == (c[$ + 16 >> 2] | 0)) ab = xb[c[(c[$ >> 2] | 0) + 36 >> 2] & 63]($) | 0;
												else ab = c[ga >> 2] | 0;
												if ((ab | 0) == -1) {
													c[b >> 2] = 0;
													bb = 1;
													break
												} else {
													bb = (c[b >> 2] | 0) == 0;
													break
												}
											} else bb = 1; while (0);
										do
											if (fa) {
												$ = c[fa + 12 >> 2] | 0;
												if (($ | 0) == (c[fa + 16 >> 2] | 0)) cb = xb[c[(c[fa >> 2] | 0) + 36 >> 2] & 63](fa) | 0;
												else cb = c[$ >> 2] | 0;
												if ((cb | 0) != -1)
													if (bb ^ (P | 0) == 0) {
														db = P;
														eb = P;
														break
													} else {
														X = 204;
														break a
													}
												else {
													c[e >> 2] = 0;
													fb = 0;
													X = 198;
													break
												}
											} else {
												fb = P;
												X = 198
											}
										while (0);
										if ((X | 0) == 198) {
											X = 0;
											if (bb) {
												X = 204;
												break a
											} else {
												db = fb;
												eb = 0
											}
										}
										$ = c[b >> 2] | 0;
										ga = c[$ + 12 >> 2] | 0;
										if ((ga | 0) == (c[$ + 16 >> 2] | 0)) gb = xb[c[(c[$ >> 2] | 0) + 36 >> 2] & 63]($) | 0;
										else gb = c[ga >> 2] | 0;
										if (!(qb[c[(c[l >> 2] | 0) + 12 >> 2] & 31](l, 2048, gb) | 0)) {
											X = 204;
											break a
										}
										if ((c[n >> 2] | 0) == (c[q >> 2] | 0)) Wn(m, n, q);
										ga = c[b >> 2] | 0;
										$ = c[ga + 12 >> 2] | 0;
										if (($ | 0) == (c[ga + 16 >> 2] | 0)) hb = xb[c[(c[ga >> 2] | 0) + 36 >> 2] & 63](ga) | 0;
										else hb = c[$ >> 2] | 0;
										$ = c[n >> 2] | 0;
										c[n >> 2] = $ + 4;
										c[$ >> 2] = hb;
										$ = ea;
										ea = ea + -1 | 0;
										c[D >> 2] = ea;
										ga = c[b >> 2] | 0;
										da = ga + 12 | 0;
										Q = c[da >> 2] | 0;
										if ((Q | 0) == (c[ga + 16 >> 2] | 0)) xb[c[(c[ga >> 2] | 0) + 40 >> 2] & 63](ga) | 0;
										else c[da >> 2] = Q + 4;
										if (($ | 0) <= 1) break;
										else {
											P = db;
											fa = eb
										}
									}
								}
							}
							if ((c[n >> 2] | 0) == (c[m >> 2] | 0)) {
								X = 215;
								break a
							} else {
								Y = Wa;
								Z = O
							}
							break
						}
					default:
						{
							Y = N;Z = O
						}
				}
				while (0);
				g: do
					if ((X | 0) == 30)
						while (1) {
							X = 0;
							fa = c[b >> 2] | 0;
							do
								if (fa) {
									P = c[fa + 12 >> 2] | 0;
									if ((P | 0) == (c[fa + 16 >> 2] | 0)) ib = xb[c[(c[fa >> 2] | 0) + 36 >> 2] & 63](fa) | 0;
									else ib = c[P >> 2] | 0;
									if ((ib | 0) == -1) {
										c[b >> 2] = 0;
										jb = 1;
										break
									} else {
										jb = (c[b >> 2] | 0) == 0;
										break
									}
								} else jb = 1; while (0);
							do
								if (ca) {
									fa = c[ca + 12 >> 2] | 0;
									if ((fa | 0) == (c[ca + 16 >> 2] | 0)) kb = xb[c[(c[ca >> 2] | 0) + 36 >> 2] & 63](ca) | 0;
									else kb = c[fa >> 2] | 0;
									if ((kb | 0) != -1)
										if (jb ^ (ba | 0) == 0) {
											lb = ba;
											mb = ba;
											break
										} else {
											Y = N;
											Z = O;
											break g
										}
									else {
										c[e >> 2] = 0;
										nb = 0;
										X = 43;
										break
									}
								} else {
									nb = ba;
									X = 43
								}
							while (0);
							if ((X | 0) == 43) {
								X = 0;
								if (jb) {
									Y = N;
									Z = O;
									break g
								} else {
									lb = nb;
									mb = 0
								}
							}
							fa = c[b >> 2] | 0;
							P = c[fa + 12 >> 2] | 0;
							if ((P | 0) == (c[fa + 16 >> 2] | 0)) ob = xb[c[(c[fa >> 2] | 0) + 36 >> 2] & 63](fa) | 0;
							else ob = c[P >> 2] | 0;
							if (!(qb[c[(c[l >> 2] | 0) + 12 >> 2] & 31](l, 8192, ob) | 0)) {
								Y = N;
								Z = O;
								break g
							}
							P = c[b >> 2] | 0;
							fa = P + 12 | 0;
							ea = c[fa >> 2] | 0;
							if ((ea | 0) == (c[P + 16 >> 2] | 0)) pb = xb[c[(c[P >> 2] | 0) + 40 >> 2] & 63](P) | 0;
							else {
								c[fa >> 2] = ea + 4;
								pb = c[ea >> 2] | 0
							}
							cg(C, pb);
							ba = lb;
							ca = mb;
							X = 30
						}
				while (0);
				r = r + 1 | 0;
			if (r >>> 0 >= 4) {
				V = Y;
				W = Z;
				X = 217;
				break
			} else {
				N = Y;
				O = Z
			}
		}
		h: do
			if ((X | 0) == 28) {
				c[j >> 2] = c[j >> 2] | 4;
				rb = 0
			} else
		if ((X | 0) == 86) {
			c[j >> 2] = c[j >> 2] | 4;
			rb = 0
		} else if ((X | 0) == 126) {
			c[j >> 2] = c[j >> 2] | 4;
			rb = 0
		} else if ((X | 0) == 180) {
			c[j >> 2] = c[j >> 2] | 4;
			rb = 0
		} else if ((X | 0) == 204) {
			c[j >> 2] = c[j >> 2] | 4;
			rb = 0
		} else if ((X | 0) == 215) {
			c[j >> 2] = c[j >> 2] | 4;
			rb = 0
		} else if ((X | 0) == 217) {
			i: do
				if (W) {
					Z = W + 4 | 0;
					O = W + 8 | 0;
					Y = 1;
					j: while (1) {
						N = a[W >> 0] | 0;
						if (!(N & 1)) sb = (N & 255) >>> 1;
						else sb = c[Z >> 2] | 0;
						if (Y >>> 0 >= sb >>> 0) break i;
						N = c[b >> 2] | 0;
						do
							if (N) {
								r = c[N + 12 >> 2] | 0;
								if ((r | 0) == (c[N + 16 >> 2] | 0)) ub = xb[c[(c[N >> 2] | 0) + 36 >> 2] & 63](N) | 0;
								else ub = c[r >> 2] | 0;
								if ((ub | 0) == -1) {
									c[b >> 2] = 0;
									vb = 1;
									break
								} else {
									vb = (c[b >> 2] | 0) == 0;
									break
								}
							} else vb = 1; while (0);
						N = c[e >> 2] | 0;
						do
							if (N) {
								r = c[N + 12 >> 2] | 0;
								if ((r | 0) == (c[N + 16 >> 2] | 0)) wb = xb[c[(c[N >> 2] | 0) + 36 >> 2] & 63](N) | 0;
								else wb = c[r >> 2] | 0;
								if ((wb | 0) != -1)
									if (vb) break;
									else break j;
								else {
									c[e >> 2] = 0;
									X = 236;
									break
								}
							} else X = 236; while (0);
						if ((X | 0) == 236 ? (X = 0, vb) : 0) break;
						N = c[b >> 2] | 0;
						r = c[N + 12 >> 2] | 0;
						if ((r | 0) == (c[N + 16 >> 2] | 0)) yb = xb[c[(c[N >> 2] | 0) + 36 >> 2] & 63](N) | 0;
						else yb = c[r >> 2] | 0;
						if (!(a[W >> 0] & 1)) zb = Z;
						else zb = c[O >> 2] | 0;
						if ((yb | 0) != (c[zb + (Y << 2) >> 2] | 0)) break;
						r = Y + 1 | 0;
						N = c[b >> 2] | 0;
						mb = N + 12 | 0;
						ca = c[mb >> 2] | 0;
						if ((ca | 0) == (c[N + 16 >> 2] | 0)) {
							xb[c[(c[N >> 2] | 0) + 40 >> 2] & 63](N) | 0;
							Y = r;
							continue
						} else {
							c[mb >> 2] = ca + 4;
							Y = r;
							continue
						}
					}
					c[j >> 2] = c[j >> 2] | 4;
					rb = 0;
					break h
				}while (0);Y = c[s >> 2] | 0;
			if ((Y | 0) != (V | 0) ? (c[E >> 2] = 0, Tk(y, Y, V, E), (c[E >> 2] | 0) != 0) : 0) {
				c[j >> 2] = c[j >> 2] | 4;
				rb = 0
			} else rb = 1
		}
		while (0);
		_f(C);
		_f(B);
		_f(A);
		_f(z);
		Of(y);
		y = c[s >> 2] | 0;
		c[s >> 2] = 0;
		if (y) tb[c[o >> 2] & 127](y);
		i = p;
		return rb | 0
	}

	function Yk(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0;
		b = i;
		i = i + 432 | 0;
		k = b + 4 | 0;
		l = b + 16 | 0;
		m = b + 8 | 0;
		n = b + 420 | 0;
		o = b;
		p = b + 424 | 0;
		q = b + 416 | 0;
		c[m >> 2] = l;
		r = m + 4 | 0;
		c[r >> 2] = 112;
		s = mg(g) | 0;
		c[o >> 2] = s;
		t = Gl(o, 9860) | 0;
		a[p >> 0] = 0;
		u = c[e >> 2] | 0;
		c[q >> 2] = u;
		v = c[g + 4 >> 2] | 0;
		c[k >> 2] = c[q >> 2];
		q = u;
		if (Xk(d, k, f, o, v, h, p, t, m, n, l + 400 | 0) | 0) {
			if (!(a[j >> 0] & 1)) a[j >> 0] = 0;
			else c[c[j + 8 >> 2] >> 2] = 0;
			c[j + 4 >> 2] = 0;
			if (a[p >> 0] | 0) cg(j, Db[c[(c[t >> 2] | 0) + 44 >> 2] & 31](t, 45) | 0);
			p = Db[c[(c[t >> 2] | 0) + 44 >> 2] & 31](t, 48) | 0;
			t = c[m >> 2] | 0;
			l = c[n >> 2] | 0;
			n = l + -4 | 0;
			a: do
				if (t >>> 0 < n >>> 0) {
					v = t;
					while (1) {
						if ((c[v >> 2] | 0) != (p | 0)) {
							w = v;
							break a
						}
						o = v + 4 | 0;
						if (o >>> 0 < n >>> 0) v = o;
						else {
							w = o;
							break
						}
					}
				} else w = t; while (0);
			Xn(j, w, l) | 0
		}
		l = c[d >> 2] | 0;
		do
			if (l) {
				w = c[l + 12 >> 2] | 0;
				if ((w | 0) == (c[l + 16 >> 2] | 0)) x = xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0;
				else x = c[w >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 1;
					break
				} else {
					y = (c[d >> 2] | 0) == 0;
					break
				}
			} else y = 1; while (0);
		do
			if (u) {
				x = c[q + 12 >> 2] | 0;
				if ((x | 0) == (c[q + 16 >> 2] | 0)) z = xb[c[(c[u >> 2] | 0) + 36 >> 2] & 63](q) | 0;
				else z = c[x >> 2] | 0;
				if ((z | 0) != -1)
					if (y) break;
					else {
						A = 26;
						break
					}
				else {
					c[e >> 2] = 0;
					A = 24;
					break
				}
			} else A = 24; while (0);
		if ((A | 0) == 24 ? y : 0) A = 26;
		if ((A | 0) == 26) c[h >> 2] = c[h >> 2] | 2;
		h = c[d >> 2] | 0;
		ep(s) | 0;
		s = c[m >> 2] | 0;
		c[m >> 2] = 0;
		if (s) tb[c[r >> 2] & 127](s);
		i = b;
		return h | 0
	}

	function Zk(b, d, e, f, g, h, j, k, l, m) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		n = i;
		i = i + 112 | 0;
		o = n;
		p = n + 40 | 0;
		q = n + 76 | 0;
		r = n + 4 | 0;
		s = n + 88 | 0;
		t = n + 100 | 0;
		u = n + 28 | 0;
		v = n + 64 | 0;
		w = n + 52 | 0;
		x = n + 16 | 0;
		if (b) {
			b = Gl(d, 9604) | 0;
			ub[c[(c[b >> 2] | 0) + 44 >> 2] & 63](o, b);
			y = c[o >> 2] | 0;
			a[e >> 0] = y;
			a[e + 1 >> 0] = y >> 8;
			a[e + 2 >> 0] = y >> 16;
			a[e + 3 >> 0] = y >> 24;
			ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](p, b);
			if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
			else c[c[l + 8 >> 2] >> 2] = 0;
			c[l + 4 >> 2] = 0;
			bg(l, 0);
			c[l >> 2] = c[p >> 2];
			c[l + 4 >> 2] = c[p + 4 >> 2];
			c[l + 8 >> 2] = c[p + 8 >> 2];
			c[p >> 2] = 0;
			c[p + 4 >> 2] = 0;
			c[p + 8 >> 2] = 0;
			_f(p);
			ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](q, b);
			if (!(a[k >> 0] & 1)) a[k >> 0] = 0;
			else c[c[k + 8 >> 2] >> 2] = 0;
			c[k + 4 >> 2] = 0;
			bg(k, 0);
			c[k >> 2] = c[q >> 2];
			c[k + 4 >> 2] = c[q + 4 >> 2];
			c[k + 8 >> 2] = c[q + 8 >> 2];
			c[q >> 2] = 0;
			c[q + 4 >> 2] = 0;
			c[q + 8 >> 2] = 0;
			_f(q);
			c[f >> 2] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			c[g >> 2] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](r, b);
			if (!(a[h >> 0] & 1)) {
				a[h + 1 >> 0] = 0;
				a[h >> 0] = 0
			} else {
				a[c[h + 8 >> 2] >> 0] = 0;
				c[h + 4 >> 2] = 0
			}
			Uf(h, 0);
			c[h >> 2] = c[r >> 2];
			c[h + 4 >> 2] = c[r + 4 >> 2];
			c[h + 8 >> 2] = c[r + 8 >> 2];
			c[r >> 2] = 0;
			c[r + 4 >> 2] = 0;
			c[r + 8 >> 2] = 0;
			Of(r);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](s, b);
			if (!(a[j >> 0] & 1)) a[j >> 0] = 0;
			else c[c[j + 8 >> 2] >> 2] = 0;
			c[j + 4 >> 2] = 0;
			bg(j, 0);
			c[j >> 2] = c[s >> 2];
			c[j + 4 >> 2] = c[s + 4 >> 2];
			c[j + 8 >> 2] = c[s + 8 >> 2];
			c[s >> 2] = 0;
			c[s + 4 >> 2] = 0;
			c[s + 8 >> 2] = 0;
			_f(s);
			z = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		} else {
			b = Gl(d, 9540) | 0;
			ub[c[(c[b >> 2] | 0) + 44 >> 2] & 63](t, b);
			d = c[t >> 2] | 0;
			a[e >> 0] = d;
			a[e + 1 >> 0] = d >> 8;
			a[e + 2 >> 0] = d >> 16;
			a[e + 3 >> 0] = d >> 24;
			ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](u, b);
			if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
			else c[c[l + 8 >> 2] >> 2] = 0;
			c[l + 4 >> 2] = 0;
			bg(l, 0);
			c[l >> 2] = c[u >> 2];
			c[l + 4 >> 2] = c[u + 4 >> 2];
			c[l + 8 >> 2] = c[u + 8 >> 2];
			c[u >> 2] = 0;
			c[u + 4 >> 2] = 0;
			c[u + 8 >> 2] = 0;
			_f(u);
			ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](v, b);
			if (!(a[k >> 0] & 1)) a[k >> 0] = 0;
			else c[c[k + 8 >> 2] >> 2] = 0;
			c[k + 4 >> 2] = 0;
			bg(k, 0);
			c[k >> 2] = c[v >> 2];
			c[k + 4 >> 2] = c[v + 4 >> 2];
			c[k + 8 >> 2] = c[v + 8 >> 2];
			c[v >> 2] = 0;
			c[v + 4 >> 2] = 0;
			c[v + 8 >> 2] = 0;
			_f(v);
			c[f >> 2] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			c[g >> 2] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](w, b);
			if (!(a[h >> 0] & 1)) {
				a[h + 1 >> 0] = 0;
				a[h >> 0] = 0
			} else {
				a[c[h + 8 >> 2] >> 0] = 0;
				c[h + 4 >> 2] = 0
			}
			Uf(h, 0);
			c[h >> 2] = c[w >> 2];
			c[h + 4 >> 2] = c[w + 4 >> 2];
			c[h + 8 >> 2] = c[w + 8 >> 2];
			c[w >> 2] = 0;
			c[w + 4 >> 2] = 0;
			c[w + 8 >> 2] = 0;
			Of(w);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](x, b);
			if (!(a[j >> 0] & 1)) a[j >> 0] = 0;
			else c[c[j + 8 >> 2] >> 2] = 0;
			c[j + 4 >> 2] = 0;
			bg(j, 0);
			c[j >> 2] = c[x >> 2];
			c[j + 4 >> 2] = c[x + 4 >> 2];
			c[j + 8 >> 2] = c[x + 8 >> 2];
			c[x >> 2] = 0;
			c[x + 4 >> 2] = 0;
			c[x + 8 >> 2] = 0;
			_f(x);
			z = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		}
		c[m >> 2] = z;
		i = n;
		return
	}

	function _k(a) {
		a = a | 0;
		return
	}

	function $k(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function al(b, d, e, f, g, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = +j;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		b = i;
		i = i + 384 | 0;
		k = b;
		l = b + 8 | 0;
		m = b + 76 | 0;
		n = b + 36 | 0;
		o = b + 176 | 0;
		p = b + 68 | 0;
		q = b + 276 | 0;
		r = b + 380 | 0;
		s = b + 381 | 0;
		t = b + 40 | 0;
		u = b + 16 | 0;
		v = b + 56 | 0;
		w = b + 52 | 0;
		x = b + 280 | 0;
		y = b + 32 | 0;
		z = b + 28 | 0;
		A = b + 72 | 0;
		c[n >> 2] = m;
		h[k >> 3] = j;
		B = Ae(m, 100, 22380, k) | 0;
		if (B >>> 0 > 99) {
			m = Wh() | 0;
			h[l >> 3] = j;
			C = Pn(n, m, 22380, l) | 0;
			l = c[n >> 2] | 0;
			if (!l) md();
			m = qd(C) | 0;
			if (!m) md();
			else {
				D = m;
				E = l;
				F = m;
				G = C
			}
		} else {
			D = 0;
			E = 0;
			F = o;
			G = B
		}
		B = mg(f) | 0;
		c[p >> 2] = B;
		o = Gl(p, 9868) | 0;
		C = c[n >> 2] | 0;
		Bb[c[(c[o >> 2] | 0) + 32 >> 2] & 7](o, C, C + G | 0, F) | 0;
		if (!G) H = 0;
		else H = (a[c[n >> 2] >> 0] | 0) == 45;
		c[t >> 2] = 0;
		c[t + 4 >> 2] = 0;
		c[t + 8 >> 2] = 0;
		c[u >> 2] = 0;
		c[u + 4 >> 2] = 0;
		c[u + 8 >> 2] = 0;
		c[v >> 2] = 0;
		c[v + 4 >> 2] = 0;
		c[v + 8 >> 2] = 0;
		bl(e, H, p, q, r, s, t, u, v, w);
		e = c[w >> 2] | 0;
		if ((G | 0) > (e | 0)) {
			w = a[v >> 0] | 0;
			n = a[u >> 0] | 0;
			I = (G - e << 1 | 1) + e + ((w & 1) == 0 ? (w & 255) >>> 1 : c[v + 4 >> 2] | 0) + ((n & 1) == 0 ? (n & 255) >>> 1 : c[u + 4 >> 2] | 0) | 0
		} else {
			n = a[v >> 0] | 0;
			w = a[u >> 0] | 0;
			I = e + 2 + ((n & 1) == 0 ? (n & 255) >>> 1 : c[v + 4 >> 2] | 0) + ((w & 1) == 0 ? (w & 255) >>> 1 : c[u + 4 >> 2] | 0) | 0
		}
		if (I >>> 0 > 100) {
			w = qd(I) | 0;
			if (!w) md();
			else {
				J = w;
				K = w
			}
		} else {
			J = 0;
			K = x
		}
		cl(K, y, z, c[f + 4 >> 2] | 0, F, F + G | 0, o, H, q, a[r >> 0] | 0, a[s >> 0] | 0, t, u, v, e);
		c[A >> 2] = c[d >> 2];
		d = c[y >> 2] | 0;
		y = c[z >> 2] | 0;
		c[k >> 2] = c[A >> 2];
		A = cc(k, K, d, y, f, g) | 0;
		if (!J) L = B;
		else {
			rd(J);
			L = c[p >> 2] | 0
		}
		Of(v);
		Of(u);
		Of(t);
		ep(L) | 0;
		if (D) rd(D);
		if (E) rd(E);
		i = b;
		return A | 0
	}

	function bl(b, d, e, f, g, h, j, k, l, m) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0;
		n = i;
		i = i + 112 | 0;
		o = n + 12 | 0;
		p = n + 40 | 0;
		q = n + 92 | 0;
		r = n;
		s = n + 80 | 0;
		t = n + 96 | 0;
		u = n + 108 | 0;
		v = n + 56 | 0;
		w = n + 52 | 0;
		x = n + 16 | 0;
		y = n + 28 | 0;
		z = n + 68 | 0;
		if (b) {
			b = Gl(e, 9476) | 0;
			A = c[b >> 2] | 0;
			if (d) {
				ub[c[A + 44 >> 2] & 63](o, b);
				B = c[o >> 2] | 0;
				a[f >> 0] = B;
				a[f + 1 >> 0] = B >> 8;
				a[f + 2 >> 0] = B >> 16;
				a[f + 3 >> 0] = B >> 24;
				ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](p, b);
				if (!(a[l >> 0] & 1)) {
					a[l + 1 >> 0] = 0;
					a[l >> 0] = 0
				} else {
					a[c[l + 8 >> 2] >> 0] = 0;
					c[l + 4 >> 2] = 0
				}
				Uf(l, 0);
				c[l >> 2] = c[p >> 2];
				c[l + 4 >> 2] = c[p + 4 >> 2];
				c[l + 8 >> 2] = c[p + 8 >> 2];
				c[p >> 2] = 0;
				c[p + 4 >> 2] = 0;
				c[p + 8 >> 2] = 0;
				Of(p);
				C = b
			} else {
				ub[c[A + 40 >> 2] & 63](q, b);
				A = c[q >> 2] | 0;
				a[f >> 0] = A;
				a[f + 1 >> 0] = A >> 8;
				a[f + 2 >> 0] = A >> 16;
				a[f + 3 >> 0] = A >> 24;
				ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](r, b);
				if (!(a[l >> 0] & 1)) {
					a[l + 1 >> 0] = 0;
					a[l >> 0] = 0
				} else {
					a[c[l + 8 >> 2] >> 0] = 0;
					c[l + 4 >> 2] = 0
				}
				Uf(l, 0);
				c[l >> 2] = c[r >> 2];
				c[l + 4 >> 2] = c[r + 4 >> 2];
				c[l + 8 >> 2] = c[r + 8 >> 2];
				c[r >> 2] = 0;
				c[r + 4 >> 2] = 0;
				c[r + 8 >> 2] = 0;
				Of(r);
				C = b
			}
			a[g >> 0] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			a[h >> 0] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[C >> 2] | 0) + 20 >> 2] & 63](s, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[s >> 2];
			c[j + 4 >> 2] = c[s + 4 >> 2];
			c[j + 8 >> 2] = c[s + 8 >> 2];
			c[s >> 2] = 0;
			c[s + 4 >> 2] = 0;
			c[s + 8 >> 2] = 0;
			Of(s);
			ub[c[(c[C >> 2] | 0) + 24 >> 2] & 63](t, b);
			if (!(a[k >> 0] & 1)) {
				a[k + 1 >> 0] = 0;
				a[k >> 0] = 0
			} else {
				a[c[k + 8 >> 2] >> 0] = 0;
				c[k + 4 >> 2] = 0
			}
			Uf(k, 0);
			c[k >> 2] = c[t >> 2];
			c[k + 4 >> 2] = c[t + 4 >> 2];
			c[k + 8 >> 2] = c[t + 8 >> 2];
			c[t >> 2] = 0;
			c[t + 4 >> 2] = 0;
			c[t + 8 >> 2] = 0;
			Of(t);
			D = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		} else {
			b = Gl(e, 9412) | 0;
			e = c[b >> 2] | 0;
			if (d) {
				ub[c[e + 44 >> 2] & 63](u, b);
				d = c[u >> 2] | 0;
				a[f >> 0] = d;
				a[f + 1 >> 0] = d >> 8;
				a[f + 2 >> 0] = d >> 16;
				a[f + 3 >> 0] = d >> 24;
				ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](v, b);
				if (!(a[l >> 0] & 1)) {
					a[l + 1 >> 0] = 0;
					a[l >> 0] = 0
				} else {
					a[c[l + 8 >> 2] >> 0] = 0;
					c[l + 4 >> 2] = 0
				}
				Uf(l, 0);
				c[l >> 2] = c[v >> 2];
				c[l + 4 >> 2] = c[v + 4 >> 2];
				c[l + 8 >> 2] = c[v + 8 >> 2];
				c[v >> 2] = 0;
				c[v + 4 >> 2] = 0;
				c[v + 8 >> 2] = 0;
				Of(v);
				E = b
			} else {
				ub[c[e + 40 >> 2] & 63](w, b);
				e = c[w >> 2] | 0;
				a[f >> 0] = e;
				a[f + 1 >> 0] = e >> 8;
				a[f + 2 >> 0] = e >> 16;
				a[f + 3 >> 0] = e >> 24;
				ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](x, b);
				if (!(a[l >> 0] & 1)) {
					a[l + 1 >> 0] = 0;
					a[l >> 0] = 0
				} else {
					a[c[l + 8 >> 2] >> 0] = 0;
					c[l + 4 >> 2] = 0
				}
				Uf(l, 0);
				c[l >> 2] = c[x >> 2];
				c[l + 4 >> 2] = c[x + 4 >> 2];
				c[l + 8 >> 2] = c[x + 8 >> 2];
				c[x >> 2] = 0;
				c[x + 4 >> 2] = 0;
				c[x + 8 >> 2] = 0;
				Of(x);
				E = b
			}
			a[g >> 0] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			a[h >> 0] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[E >> 2] | 0) + 20 >> 2] & 63](y, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[y >> 2];
			c[j + 4 >> 2] = c[y + 4 >> 2];
			c[j + 8 >> 2] = c[y + 8 >> 2];
			c[y >> 2] = 0;
			c[y + 4 >> 2] = 0;
			c[y + 8 >> 2] = 0;
			Of(y);
			ub[c[(c[E >> 2] | 0) + 24 >> 2] & 63](z, b);
			if (!(a[k >> 0] & 1)) {
				a[k + 1 >> 0] = 0;
				a[k >> 0] = 0
			} else {
				a[c[k + 8 >> 2] >> 0] = 0;
				c[k + 4 >> 2] = 0
			}
			Uf(k, 0);
			c[k >> 2] = c[z >> 2];
			c[k + 4 >> 2] = c[z + 4 >> 2];
			c[k + 8 >> 2] = c[z + 8 >> 2];
			c[z >> 2] = 0;
			c[z + 4 >> 2] = 0;
			c[z + 8 >> 2] = 0;
			Of(z);
			D = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		}
		c[m >> 2] = D;
		i = n;
		return
	}

	function cl(d, e, f, g, h, i, j, k, l, m, n, o, p, q, r) {
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		p = p | 0;
		q = q | 0;
		r = r | 0;
		var s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0;
		c[f >> 2] = d;
		s = q + 4 | 0;
		t = q + 8 | 0;
		u = q + 1 | 0;
		v = p + 4 | 0;
		w = (g & 512 | 0) == 0;
		x = p + 8 | 0;
		y = p + 1 | 0;
		z = j + 8 | 0;
		A = (r | 0) > 0;
		B = o + 4 | 0;
		C = o + 8 | 0;
		D = o + 1 | 0;
		E = r + 1 | 0;
		F = -2 - r - ((r | 0) < 0 ? ~r : -1) | 0;
		G = (r | 0) > 0;
		H = h;
		h = 0;
		while (1) {
			switch (a[l + h >> 0] | 0) {
				case 0:
					{
						c[e >> 2] = c[f >> 2];I = H;
						break
					}
				case 1:
					{
						c[e >> 2] = c[f >> 2];J = Db[c[(c[j >> 2] | 0) + 28 >> 2] & 31](j, 32) | 0;K = c[f >> 2] | 0;c[f >> 2] = K + 1;a[K >> 0] = J;I = H;
						break
					}
				case 3:
					{
						J = a[q >> 0] | 0;K = (J & 1) == 0;
						if (!((K ? (J & 255) >>> 1 : c[s >> 2] | 0) | 0)) I = H;
						else {
							J = a[(K ? u : c[t >> 2] | 0) >> 0] | 0;
							K = c[f >> 2] | 0;
							c[f >> 2] = K + 1;
							a[K >> 0] = J;
							I = H
						}
						break
					}
				case 2:
					{
						J = a[p >> 0] | 0;K = (J & 1) == 0;L = K ? (J & 255) >>> 1 : c[v >> 2] | 0;
						if (w | (L | 0) == 0) I = H;
						else {
							J = K ? y : c[x >> 2] | 0;
							K = J + L | 0;
							M = c[f >> 2] | 0;
							if (!L) N = M;
							else {
								L = M;
								M = J;
								while (1) {
									a[L >> 0] = a[M >> 0] | 0;
									M = M + 1 | 0;
									J = L + 1 | 0;
									if ((M | 0) == (K | 0)) {
										N = J;
										break
									} else L = J
								}
							}
							c[f >> 2] = N;
							I = H
						}
						break
					}
				case 4:
					{
						L = c[f >> 2] | 0;K = k ? H + 1 | 0 : H;M = K;J = c[z >> 2] | 0;a: do
							if (K >>> 0 < i >>> 0) {
								O = K;
								while (1) {
									P = a[O >> 0] | 0;
									if (P << 24 >> 24 <= -1) {
										Q = O;
										break a
									}
									if (!(b[J + (P << 24 >> 24 << 1) >> 1] & 2048)) {
										Q = O;
										break a
									}
									P = O + 1 | 0;
									if (P >>> 0 < i >>> 0) O = P;
									else {
										Q = P;
										break
									}
								}
							} else Q = K; while (0);J = Q;
						if (A) {
							O = -2 - J - ~(J >>> 0 > M >>> 0 ? M : J) | 0;
							J = F >>> 0 > O >>> 0 ? F : O;
							if (Q >>> 0 > K >>> 0 & G) {
								O = Q;
								P = r;
								while (1) {
									O = O + -1 | 0;
									R = a[O >> 0] | 0;
									S = c[f >> 2] | 0;
									c[f >> 2] = S + 1;
									a[S >> 0] = R;
									R = (P | 0) > 1;
									if (!(O >>> 0 > K >>> 0 & R)) {
										T = R;
										break
									} else P = P + -1 | 0
								}
							} else T = G;
							P = E + J | 0;
							O = Q + (J + 1) | 0;
							if (T) U = Db[c[(c[j >> 2] | 0) + 28 >> 2] & 31](j, 48) | 0;
							else U = 0;
							M = c[f >> 2] | 0;
							c[f >> 2] = M + 1;
							if ((P | 0) > 0) {
								R = M;
								S = P;
								while (1) {
									a[R >> 0] = U;
									P = c[f >> 2] | 0;
									c[f >> 2] = P + 1;
									if ((S | 0) > 1) {
										R = P;
										S = S + -1 | 0
									} else {
										V = P;
										break
									}
								}
							} else V = M;
							a[V >> 0] = m;
							W = O
						} else W = Q;
						if ((W | 0) != (K | 0)) {
							S = a[o >> 0] | 0;
							R = (S & 1) == 0;
							if (!((R ? (S & 255) >>> 1 : c[B >> 2] | 0) | 0)) X = -1;
							else X = a[(R ? D : c[C >> 2] | 0) >> 0] | 0;
							if ((W | 0) != (K | 0)) {
								R = W;
								S = X;
								J = 0;
								P = 0;
								while (1) {
									if ((P | 0) == (S | 0)) {
										Y = c[f >> 2] | 0;
										c[f >> 2] = Y + 1;
										a[Y >> 0] = n;
										Y = J + 1 | 0;
										Z = a[o >> 0] | 0;
										_ = (Z & 1) == 0;
										if (Y >>> 0 < (_ ? (Z & 255) >>> 1 : c[B >> 2] | 0) >>> 0) {
											Z = a[(_ ? D : c[C >> 2] | 0) + Y >> 0] | 0;
											$ = Z << 24 >> 24 == 127 ? -1 : Z << 24 >> 24;
											aa = Y;
											ba = 0
										} else {
											$ = P;
											aa = Y;
											ba = 0
										}
									} else {
										$ = S;
										aa = J;
										ba = P
									}
									R = R + -1 | 0;
									Y = a[R >> 0] | 0;
									Z = c[f >> 2] | 0;
									c[f >> 2] = Z + 1;
									a[Z >> 0] = Y;
									if ((R | 0) == (K | 0)) break;
									else {
										S = $;
										J = aa;
										P = ba + 1 | 0
									}
								}
							}
						} else {
							P = Db[c[(c[j >> 2] | 0) + 28 >> 2] & 31](j, 48) | 0;
							J = c[f >> 2] | 0;
							c[f >> 2] = J + 1;
							a[J >> 0] = P
						}
						P = c[f >> 2] | 0;
						if ((L | 0) != (P | 0) ? (J = P + -1 | 0, L >>> 0 < J >>> 0) : 0) {
							P = L;
							S = J;
							do {
								J = a[P >> 0] | 0;
								a[P >> 0] = a[S >> 0] | 0;
								a[S >> 0] = J;
								P = P + 1 | 0;
								S = S + -1 | 0
							} while (P >>> 0 < S >>> 0);
							I = K
						} else I = K;
						break
					}
				default:
					I = H
			}
			h = h + 1 | 0;
			if ((h | 0) == 4) break;
			else H = I
		}
		I = a[q >> 0] | 0;
		q = (I & 1) == 0;
		H = q ? (I & 255) >>> 1 : c[s >> 2] | 0;
		if (H >>> 0 > 1) {
			s = q ? u : c[t >> 2] | 0;
			t = s + H | 0;
			u = c[f >> 2] | 0;
			if ((H | 0) == 1) ca = u;
			else {
				H = u;
				u = s + 1 | 0;
				while (1) {
					a[H >> 0] = a[u >> 0] | 0;
					s = H + 1 | 0;
					u = u + 1 | 0;
					if ((u | 0) == (t | 0)) {
						ca = s;
						break
					} else H = s
				}
			}
			c[f >> 2] = ca
		}
		switch (g & 176 | 0) {
			case 32:
				{
					c[e >> 2] = c[f >> 2];
					break
				}
			case 16:
				break;
			default:
				c[e >> 2] = d
		}
		return
	}

	function dl(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		b = i;
		i = i + 176 | 0;
		j = b + 20 | 0;
		k = b + 24 | 0;
		l = b + 60 | 0;
		m = b + 64 | 0;
		n = b + 65 | 0;
		o = b;
		p = b + 48 | 0;
		q = b + 32 | 0;
		r = b + 12 | 0;
		s = b + 68 | 0;
		t = b + 44 | 0;
		u = b + 28 | 0;
		v = b + 16 | 0;
		w = mg(f) | 0;
		c[k >> 2] = w;
		x = Gl(k, 9868) | 0;
		y = a[h >> 0] | 0;
		z = (y & 1) == 0;
		A = h + 4 | 0;
		if (!((z ? (y & 255) >>> 1 : c[A >> 2] | 0) | 0)) B = 0;
		else {
			y = a[(z ? h + 1 | 0 : c[h + 8 >> 2] | 0) >> 0] | 0;
			B = y << 24 >> 24 == (Db[c[(c[x >> 2] | 0) + 28 >> 2] & 31](x, 45) | 0) << 24 >> 24
		}
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		c[p >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p + 8 >> 2] = 0;
		c[q >> 2] = 0;
		c[q + 4 >> 2] = 0;
		c[q + 8 >> 2] = 0;
		bl(e, B, k, l, m, n, o, p, q, r);
		e = a[h >> 0] | 0;
		y = c[A >> 2] | 0;
		A = (e & 1) == 0 ? (e & 255) >>> 1 : y;
		z = c[r >> 2] | 0;
		if ((A | 0) > (z | 0)) {
			r = a[q >> 0] | 0;
			C = a[p >> 0] | 0;
			D = (A - z << 1 | 1) + z + ((r & 1) == 0 ? (r & 255) >>> 1 : c[q + 4 >> 2] | 0) + ((C & 1) == 0 ? (C & 255) >>> 1 : c[p + 4 >> 2] | 0) | 0
		} else {
			C = a[q >> 0] | 0;
			r = a[p >> 0] | 0;
			D = z + 2 + ((C & 1) == 0 ? (C & 255) >>> 1 : c[q + 4 >> 2] | 0) + ((r & 1) == 0 ? (r & 255) >>> 1 : c[p + 4 >> 2] | 0) | 0
		}
		if (D >>> 0 > 100) {
			r = qd(D) | 0;
			if (!r) md();
			else {
				E = r;
				F = r
			}
		} else {
			E = 0;
			F = s
		}
		s = (e & 1) == 0;
		r = s ? h + 1 | 0 : c[h + 8 >> 2] | 0;
		cl(F, t, u, c[f + 4 >> 2] | 0, r, r + (s ? (e & 255) >>> 1 : y) | 0, x, B, l, a[m >> 0] | 0, a[n >> 0] | 0, o, p, q, z);
		c[v >> 2] = c[d >> 2];
		d = c[t >> 2] | 0;
		t = c[u >> 2] | 0;
		c[j >> 2] = c[v >> 2];
		v = cc(j, F, d, t, f, g) | 0;
		if (!E) G = w;
		else {
			rd(E);
			G = c[k >> 2] | 0
		}
		Of(q);
		Of(p);
		Of(o);
		ep(G) | 0;
		i = b;
		return v | 0
	}

	function el(a) {
		a = a | 0;
		return
	}

	function fl(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function gl(b, d, e, f, g, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = +j;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		b = i;
		i = i + 992 | 0;
		k = b;
		l = b + 8 | 0;
		m = b + 888 | 0;
		n = b + 20 | 0;
		o = b + 432 | 0;
		p = b + 16 | 0;
		q = b + 988 | 0;
		r = b + 880 | 0;
		s = b + 836 | 0;
		t = b + 840 | 0;
		u = b + 852 | 0;
		v = b + 864 | 0;
		w = b + 876 | 0;
		x = b + 24 | 0;
		y = b + 832 | 0;
		z = b + 424 | 0;
		A = b + 884 | 0;
		c[n >> 2] = m;
		h[k >> 3] = j;
		B = Ae(m, 100, 22380, k) | 0;
		if (B >>> 0 > 99) {
			m = Wh() | 0;
			h[l >> 3] = j;
			C = Pn(n, m, 22380, l) | 0;
			l = c[n >> 2] | 0;
			if (!l) md();
			m = qd(C << 2) | 0;
			if (!m) md();
			else {
				D = m;
				E = l;
				F = m;
				G = C
			}
		} else {
			D = 0;
			E = 0;
			F = o;
			G = B
		}
		B = mg(f) | 0;
		c[p >> 2] = B;
		o = Gl(p, 9860) | 0;
		C = c[n >> 2] | 0;
		Bb[c[(c[o >> 2] | 0) + 48 >> 2] & 7](o, C, C + G | 0, F) | 0;
		if (!G) H = 0;
		else H = (a[c[n >> 2] >> 0] | 0) == 45;
		c[t >> 2] = 0;
		c[t + 4 >> 2] = 0;
		c[t + 8 >> 2] = 0;
		c[u >> 2] = 0;
		c[u + 4 >> 2] = 0;
		c[u + 8 >> 2] = 0;
		c[v >> 2] = 0;
		c[v + 4 >> 2] = 0;
		c[v + 8 >> 2] = 0;
		hl(e, H, p, q, r, s, t, u, v, w);
		e = c[w >> 2] | 0;
		if ((G | 0) > (e | 0)) {
			w = a[v >> 0] | 0;
			n = a[u >> 0] | 0;
			I = (G - e << 1 | 1) + e + ((w & 1) == 0 ? (w & 255) >>> 1 : c[v + 4 >> 2] | 0) + ((n & 1) == 0 ? (n & 255) >>> 1 : c[u + 4 >> 2] | 0) | 0
		} else {
			n = a[v >> 0] | 0;
			w = a[u >> 0] | 0;
			I = e + 2 + ((n & 1) == 0 ? (n & 255) >>> 1 : c[v + 4 >> 2] | 0) + ((w & 1) == 0 ? (w & 255) >>> 1 : c[u + 4 >> 2] | 0) | 0
		}
		if (I >>> 0 > 100) {
			w = qd(I << 2) | 0;
			if (!w) md();
			else {
				J = w;
				K = w
			}
		} else {
			J = 0;
			K = x
		}
		il(K, y, z, c[f + 4 >> 2] | 0, F, F + (G << 2) | 0, o, H, q, c[r >> 2] | 0, c[s >> 2] | 0, t, u, v, e);
		c[A >> 2] = c[d >> 2];
		d = c[y >> 2] | 0;
		y = c[z >> 2] | 0;
		c[k >> 2] = c[A >> 2];
		A = Qn(k, K, d, y, f, g) | 0;
		if (!J) L = B;
		else {
			rd(J);
			L = c[p >> 2] | 0
		}
		_f(v);
		_f(u);
		Of(t);
		ep(L) | 0;
		if (D) rd(D);
		if (E) rd(E);
		i = b;
		return A | 0
	}

	function hl(b, d, e, f, g, h, j, k, l, m) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		n = i;
		i = i + 112 | 0;
		o = n + 12 | 0;
		p = n + 40 | 0;
		q = n + 92 | 0;
		r = n;
		s = n + 80 | 0;
		t = n + 96 | 0;
		u = n + 108 | 0;
		v = n + 56 | 0;
		w = n + 52 | 0;
		x = n + 16 | 0;
		y = n + 28 | 0;
		z = n + 68 | 0;
		if (b) {
			b = Gl(e, 9604) | 0;
			A = c[b >> 2] | 0;
			if (d) {
				ub[c[A + 44 >> 2] & 63](o, b);
				B = c[o >> 2] | 0;
				a[f >> 0] = B;
				a[f + 1 >> 0] = B >> 8;
				a[f + 2 >> 0] = B >> 16;
				a[f + 3 >> 0] = B >> 24;
				ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](p, b);
				if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
				else c[c[l + 8 >> 2] >> 2] = 0;
				c[l + 4 >> 2] = 0;
				bg(l, 0);
				c[l >> 2] = c[p >> 2];
				c[l + 4 >> 2] = c[p + 4 >> 2];
				c[l + 8 >> 2] = c[p + 8 >> 2];
				c[p >> 2] = 0;
				c[p + 4 >> 2] = 0;
				c[p + 8 >> 2] = 0;
				_f(p)
			} else {
				ub[c[A + 40 >> 2] & 63](q, b);
				A = c[q >> 2] | 0;
				a[f >> 0] = A;
				a[f + 1 >> 0] = A >> 8;
				a[f + 2 >> 0] = A >> 16;
				a[f + 3 >> 0] = A >> 24;
				ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](r, b);
				if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
				else c[c[l + 8 >> 2] >> 2] = 0;
				c[l + 4 >> 2] = 0;
				bg(l, 0);
				c[l >> 2] = c[r >> 2];
				c[l + 4 >> 2] = c[r + 4 >> 2];
				c[l + 8 >> 2] = c[r + 8 >> 2];
				c[r >> 2] = 0;
				c[r + 4 >> 2] = 0;
				c[r + 8 >> 2] = 0;
				_f(r)
			}
			c[g >> 2] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			c[h >> 2] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](s, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[s >> 2];
			c[j + 4 >> 2] = c[s + 4 >> 2];
			c[j + 8 >> 2] = c[s + 8 >> 2];
			c[s >> 2] = 0;
			c[s + 4 >> 2] = 0;
			c[s + 8 >> 2] = 0;
			Of(s);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](t, b);
			if (!(a[k >> 0] & 1)) a[k >> 0] = 0;
			else c[c[k + 8 >> 2] >> 2] = 0;
			c[k + 4 >> 2] = 0;
			bg(k, 0);
			c[k >> 2] = c[t >> 2];
			c[k + 4 >> 2] = c[t + 4 >> 2];
			c[k + 8 >> 2] = c[t + 8 >> 2];
			c[t >> 2] = 0;
			c[t + 4 >> 2] = 0;
			c[t + 8 >> 2] = 0;
			_f(t);
			C = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		} else {
			b = Gl(e, 9540) | 0;
			e = c[b >> 2] | 0;
			if (d) {
				ub[c[e + 44 >> 2] & 63](u, b);
				d = c[u >> 2] | 0;
				a[f >> 0] = d;
				a[f + 1 >> 0] = d >> 8;
				a[f + 2 >> 0] = d >> 16;
				a[f + 3 >> 0] = d >> 24;
				ub[c[(c[b >> 2] | 0) + 32 >> 2] & 63](v, b);
				if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
				else c[c[l + 8 >> 2] >> 2] = 0;
				c[l + 4 >> 2] = 0;
				bg(l, 0);
				c[l >> 2] = c[v >> 2];
				c[l + 4 >> 2] = c[v + 4 >> 2];
				c[l + 8 >> 2] = c[v + 8 >> 2];
				c[v >> 2] = 0;
				c[v + 4 >> 2] = 0;
				c[v + 8 >> 2] = 0;
				_f(v)
			} else {
				ub[c[e + 40 >> 2] & 63](w, b);
				e = c[w >> 2] | 0;
				a[f >> 0] = e;
				a[f + 1 >> 0] = e >> 8;
				a[f + 2 >> 0] = e >> 16;
				a[f + 3 >> 0] = e >> 24;
				ub[c[(c[b >> 2] | 0) + 28 >> 2] & 63](x, b);
				if (!(a[l >> 0] & 1)) a[l >> 0] = 0;
				else c[c[l + 8 >> 2] >> 2] = 0;
				c[l + 4 >> 2] = 0;
				bg(l, 0);
				c[l >> 2] = c[x >> 2];
				c[l + 4 >> 2] = c[x + 4 >> 2];
				c[l + 8 >> 2] = c[x + 8 >> 2];
				c[x >> 2] = 0;
				c[x + 4 >> 2] = 0;
				c[x + 8 >> 2] = 0;
				_f(x)
			}
			c[g >> 2] = xb[c[(c[b >> 2] | 0) + 12 >> 2] & 63](b) | 0;
			c[h >> 2] = xb[c[(c[b >> 2] | 0) + 16 >> 2] & 63](b) | 0;
			ub[c[(c[b >> 2] | 0) + 20 >> 2] & 63](y, b);
			if (!(a[j >> 0] & 1)) {
				a[j + 1 >> 0] = 0;
				a[j >> 0] = 0
			} else {
				a[c[j + 8 >> 2] >> 0] = 0;
				c[j + 4 >> 2] = 0
			}
			Uf(j, 0);
			c[j >> 2] = c[y >> 2];
			c[j + 4 >> 2] = c[y + 4 >> 2];
			c[j + 8 >> 2] = c[y + 8 >> 2];
			c[y >> 2] = 0;
			c[y + 4 >> 2] = 0;
			c[y + 8 >> 2] = 0;
			Of(y);
			ub[c[(c[b >> 2] | 0) + 24 >> 2] & 63](z, b);
			if (!(a[k >> 0] & 1)) a[k >> 0] = 0;
			else c[c[k + 8 >> 2] >> 2] = 0;
			c[k + 4 >> 2] = 0;
			bg(k, 0);
			c[k >> 2] = c[z >> 2];
			c[k + 4 >> 2] = c[z + 4 >> 2];
			c[k + 8 >> 2] = c[z + 8 >> 2];
			c[z >> 2] = 0;
			c[z + 4 >> 2] = 0;
			c[z + 8 >> 2] = 0;
			_f(z);
			C = xb[c[(c[b >> 2] | 0) + 36 >> 2] & 63](b) | 0
		}
		c[m >> 2] = C;
		i = n;
		return
	}

	function il(b, d, e, f, g, h, i, j, k, l, m, n, o, p, q) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		n = n | 0;
		o = o | 0;
		p = p | 0;
		q = q | 0;
		var r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0;
		c[e >> 2] = b;
		r = p + 4 | 0;
		s = p + 8 | 0;
		t = o + 4 | 0;
		u = (f & 512 | 0) == 0;
		v = o + 8 | 0;
		w = (q | 0) > 0;
		x = n + 4 | 0;
		y = n + 8 | 0;
		z = n + 1 | 0;
		A = (q | 0) > 0;
		B = g;
		g = 0;
		while (1) {
			switch (a[k + g >> 0] | 0) {
				case 0:
					{
						c[d >> 2] = c[e >> 2];C = B;
						break
					}
				case 1:
					{
						c[d >> 2] = c[e >> 2];D = Db[c[(c[i >> 2] | 0) + 44 >> 2] & 31](i, 32) | 0;E = c[e >> 2] | 0;c[e >> 2] = E + 4;c[E >> 2] = D;C = B;
						break
					}
				case 3:
					{
						D = a[p >> 0] | 0;E = (D & 1) == 0;
						if (!((E ? (D & 255) >>> 1 : c[r >> 2] | 0) | 0)) C = B;
						else {
							D = c[(E ? r : c[s >> 2] | 0) >> 2] | 0;
							E = c[e >> 2] | 0;
							c[e >> 2] = E + 4;
							c[E >> 2] = D;
							C = B
						}
						break
					}
				case 2:
					{
						D = a[o >> 0] | 0;E = (D & 1) == 0;F = E ? (D & 255) >>> 1 : c[t >> 2] | 0;
						if (u | (F | 0) == 0) C = B;
						else {
							D = E ? t : c[v >> 2] | 0;
							E = D + (F << 2) | 0;
							G = c[e >> 2] | 0;
							if (F) {
								H = G;
								I = D;
								while (1) {
									c[H >> 2] = c[I >> 2];
									I = I + 4 | 0;
									if ((I | 0) == (E | 0)) break;
									else H = H + 4 | 0
								}
							}
							c[e >> 2] = G + (F << 2);
							C = B
						}
						break
					}
				case 4:
					{
						H = c[e >> 2] | 0;E = j ? B + 4 | 0 : B;a: do
							if (E >>> 0 < h >>> 0) {
								I = E;
								while (1) {
									if (!(qb[c[(c[i >> 2] | 0) + 12 >> 2] & 31](i, 2048, c[I >> 2] | 0) | 0)) {
										J = I;
										break a
									}
									D = I + 4 | 0;
									if (D >>> 0 < h >>> 0) I = D;
									else {
										J = D;
										break
									}
								}
							} else J = E; while (0);
						if (w) {
							if (J >>> 0 > E >>> 0 & A) {
								F = c[e >> 2] | 0;
								G = J;
								I = q;
								while (1) {
									D = G + -4 | 0;
									K = F + 4 | 0;
									c[F >> 2] = c[D >> 2];
									L = I + -1 | 0;
									M = (I | 0) > 1;
									if (D >>> 0 > E >>> 0 & M) {
										F = K;
										G = D;
										I = L
									} else {
										N = D;
										O = L;
										P = M;
										Q = K;
										break
									}
								}
								c[e >> 2] = Q;
								R = P;
								S = N;
								T = O
							} else {
								R = A;
								S = J;
								T = q
							}
							if (R) U = Db[c[(c[i >> 2] | 0) + 44 >> 2] & 31](i, 48) | 0;
							else U = 0;
							I = c[e >> 2] | 0;
							G = T + ((T | 0) < 0 ? ~T : -1) | 0;
							if ((T | 0) > 0) {
								F = I;
								K = T;
								while (1) {
									c[F >> 2] = U;
									if ((K | 0) > 1) {
										F = F + 4 | 0;
										K = K + -1 | 0
									} else break
								}
							}
							c[e >> 2] = I + (G + 2 << 2);
							c[I + (G + 1 << 2) >> 2] = l;
							V = S
						} else V = J;
						if ((V | 0) == (E | 0)) {
							K = Db[c[(c[i >> 2] | 0) + 44 >> 2] & 31](i, 48) | 0;
							F = c[e >> 2] | 0;
							M = F + 4 | 0;
							c[e >> 2] = M;
							c[F >> 2] = K;
							W = M
						} else {
							M = a[n >> 0] | 0;
							K = (M & 1) == 0;
							F = c[x >> 2] | 0;
							if (!((K ? (M & 255) >>> 1 : F) | 0)) X = -1;
							else X = a[(K ? z : c[y >> 2] | 0) >> 0] | 0;
							if ((V | 0) != (E | 0)) {
								K = V;
								M = X;
								L = 0;
								D = 0;
								while (1) {
									Y = c[e >> 2] | 0;
									if ((D | 0) == (M | 0)) {
										Z = Y + 4 | 0;
										c[e >> 2] = Z;
										c[Y >> 2] = m;
										_ = L + 1 | 0;
										$ = a[n >> 0] | 0;
										aa = ($ & 1) == 0;
										if (_ >>> 0 < (aa ? ($ & 255) >>> 1 : F) >>> 0) {
											$ = a[(aa ? z : c[y >> 2] | 0) + _ >> 0] | 0;
											ba = Z;
											ca = $ << 24 >> 24 == 127 ? -1 : $ << 24 >> 24;
											da = _;
											ea = 0
										} else {
											ba = Z;
											ca = D;
											da = _;
											ea = 0
										}
									} else {
										ba = Y;
										ca = M;
										da = L;
										ea = D
									}
									K = K + -4 | 0;
									Y = c[K >> 2] | 0;
									c[e >> 2] = ba + 4;
									c[ba >> 2] = Y;
									if ((K | 0) == (E | 0)) break;
									else {
										M = ca;
										L = da;
										D = ea + 1 | 0
									}
								}
							}
							W = c[e >> 2] | 0
						}
						if ((H | 0) != (W | 0) ? (D = W + -4 | 0, H >>> 0 < D >>> 0) : 0) {
							L = H;
							M = D;
							do {
								D = c[L >> 2] | 0;
								c[L >> 2] = c[M >> 2];
								c[M >> 2] = D;
								L = L + 4 | 0;
								M = M + -4 | 0
							} while (L >>> 0 < M >>> 0);
							C = E
						} else C = E;
						break
					}
				default:
					C = B
			}
			g = g + 1 | 0;
			if ((g | 0) == 4) break;
			else B = C
		}
		C = a[p >> 0] | 0;
		p = (C & 1) == 0;
		B = p ? (C & 255) >>> 1 : c[r >> 2] | 0;
		if (B >>> 0 > 1) {
			C = p ? r : c[s >> 2] | 0;
			s = C + 4 | 0;
			r = C + (B << 2) | 0;
			C = c[e >> 2] | 0;
			p = r - s | 0;
			if ((B | 0) != 1) {
				B = C;
				g = s;
				while (1) {
					c[B >> 2] = c[g >> 2];
					g = g + 4 | 0;
					if ((g | 0) == (r | 0)) break;
					else B = B + 4 | 0
				}
			}
			c[e >> 2] = C + (p >>> 2 << 2)
		}
		switch (f & 176 | 0) {
			case 32:
				{
					c[d >> 2] = c[e >> 2];
					break
				}
			case 16:
				break;
			default:
				c[d >> 2] = b
		}
		return
	}

	function jl(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0;
		b = i;
		i = i + 480 | 0;
		j = b + 4 | 0;
		k = b;
		l = b + 468 | 0;
		m = b + 432 | 0;
		n = b + 436 | 0;
		o = b + 444 | 0;
		p = b + 456 | 0;
		q = b + 420 | 0;
		r = b + 416 | 0;
		s = b + 8 | 0;
		t = b + 408 | 0;
		u = b + 440 | 0;
		v = b + 412 | 0;
		w = mg(f) | 0;
		c[k >> 2] = w;
		x = Gl(k, 9860) | 0;
		y = a[h >> 0] | 0;
		z = (y & 1) == 0;
		A = h + 4 | 0;
		if (!((z ? (y & 255) >>> 1 : c[A >> 2] | 0) | 0)) B = 0;
		else {
			y = c[(z ? A : c[h + 8 >> 2] | 0) >> 2] | 0;
			B = (y | 0) == (Db[c[(c[x >> 2] | 0) + 44 >> 2] & 31](x, 45) | 0)
		}
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		c[p >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p + 8 >> 2] = 0;
		c[q >> 2] = 0;
		c[q + 4 >> 2] = 0;
		c[q + 8 >> 2] = 0;
		hl(e, B, k, l, m, n, o, p, q, r);
		e = a[h >> 0] | 0;
		y = c[A >> 2] | 0;
		z = (e & 1) == 0 ? (e & 255) >>> 1 : y;
		C = c[r >> 2] | 0;
		if ((z | 0) > (C | 0)) {
			r = a[q >> 0] | 0;
			D = a[p >> 0] | 0;
			E = (z - C << 1 | 1) + C + ((r & 1) == 0 ? (r & 255) >>> 1 : c[q + 4 >> 2] | 0) + ((D & 1) == 0 ? (D & 255) >>> 1 : c[p + 4 >> 2] | 0) | 0
		} else {
			D = a[q >> 0] | 0;
			r = a[p >> 0] | 0;
			E = C + 2 + ((D & 1) == 0 ? (D & 255) >>> 1 : c[q + 4 >> 2] | 0) + ((r & 1) == 0 ? (r & 255) >>> 1 : c[p + 4 >> 2] | 0) | 0
		}
		if (E >>> 0 > 100) {
			r = qd(E << 2) | 0;
			if (!r) md();
			else {
				F = r;
				G = r
			}
		} else {
			F = 0;
			G = s
		}
		s = (e & 1) == 0;
		r = s ? A : c[h + 8 >> 2] | 0;
		il(G, t, u, c[f + 4 >> 2] | 0, r, r + ((s ? (e & 255) >>> 1 : y) << 2) | 0, x, B, l, c[m >> 2] | 0, c[n >> 2] | 0, o, p, q, C);
		c[v >> 2] = c[d >> 2];
		d = c[t >> 2] | 0;
		t = c[u >> 2] | 0;
		c[j >> 2] = c[v >> 2];
		v = Qn(j, G, d, t, f, g) | 0;
		if (!F) H = w;
		else {
			rd(F);
			H = c[k >> 2] | 0
		}
		_f(q);
		_f(p);
		Of(o);
		ep(H) | 0;
		i = b;
		return v | 0
	}

	function kl(a) {
		a = a | 0;
		return
	}

	function ll(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function ml(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		e = Kd((a[d >> 0] & 1) == 0 ? d + 1 | 0 : c[d + 8 >> 2] | 0, 1) | 0;
		return e >>> ((e | 0) != (-1 | 0) & 1) | 0
	}

	function nl(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		d = i;
		i = i + 16 | 0;
		j = d;
		c[j >> 2] = 0;
		c[j + 4 >> 2] = 0;
		c[j + 8 >> 2] = 0;
		k = a[h >> 0] | 0;
		l = (k & 1) == 0;
		m = l ? h + 1 | 0 : c[h + 8 >> 2] | 0;
		n = l ? (k & 255) >>> 1 : c[h + 4 >> 2] | 0;
		h = m + n | 0;
		if ((n | 0) > 0) {
			n = m;
			do {
				Vf(j, a[n >> 0] | 0);
				n = n + 1 | 0
			} while (n >>> 0 < h >>> 0)
		}
		h = Jd((e | 0) == -1 ? -1 : e << 1, f, g, (a[j >> 0] & 1) == 0 ? j + 1 | 0 : c[j + 8 >> 2] | 0) | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		g = Pe(h) | 0;
		f = h + g | 0;
		if ((g | 0) > 0) {
			g = h;
			do {
				Vf(b, a[g >> 0] | 0);
				g = g + 1 | 0
			} while (g >>> 0 < f >>> 0)
		}
		Of(j);
		i = d;
		return
	}

	function ol(a, b) {
		a = a | 0;
		b = b | 0;
		return
	}

	function pl(a) {
		a = a | 0;
		return
	}

	function ql(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function rl(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		e = Kd((a[d >> 0] & 1) == 0 ? d + 1 | 0 : c[d + 8 >> 2] | 0, 1) | 0;
		return e >>> ((e | 0) != (-1 | 0) & 1) | 0
	}

	function sl(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0;
		d = i;
		i = i + 176 | 0;
		j = d + 24 | 0;
		k = d + 40 | 0;
		l = d + 168 | 0;
		m = d + 172 | 0;
		n = d + 8 | 0;
		o = d;
		p = d + 32 | 0;
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o >> 2] = 10344;
		q = a[h >> 0] | 0;
		r = (q & 1) == 0;
		s = h + 4 | 0;
		t = r ? s : c[h + 8 >> 2] | 0;
		h = r ? (q & 255) >>> 1 : c[s >> 2] | 0;
		s = t + (h << 2) | 0;
		q = k + 32 | 0;
		if ((h | 0) > 0) {
			h = t;
			do {
				c[m >> 2] = h;
				t = Ab[c[(c[o >> 2] | 0) + 12 >> 2] & 15](o, j, h, s, m, k, q, l) | 0;
				if (k >>> 0 < (c[l >> 2] | 0) >>> 0) {
					r = k;
					do {
						Vf(n, a[r >> 0] | 0);
						r = r + 1 | 0
					} while (r >>> 0 < (c[l >> 2] | 0) >>> 0)
				}
				h = c[m >> 2] | 0
			} while ((t | 0) != 2 & h >>> 0 < s >>> 0)
		}
		s = Jd((e | 0) == -1 ? -1 : e << 1, f, g, (a[n >> 0] & 1) == 0 ? n + 1 | 0 : c[n + 8 >> 2] | 0) | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p >> 2] = 10392;
		g = Pe(s) | 0;
		f = s + g | 0;
		e = f;
		h = k + 128 | 0;
		if ((g | 0) > 0) {
			g = s;
			do {
				c[m >> 2] = g;
				s = Ab[c[(c[p >> 2] | 0) + 16 >> 2] & 15](p, j, g, (e - g | 0) > 32 ? g + 32 | 0 : f, m, k, h, l) | 0;
				if (k >>> 0 < (c[l >> 2] | 0) >>> 0) {
					q = k;
					do {
						cg(b, c[q >> 2] | 0);
						q = q + 4 | 0
					} while (q >>> 0 < (c[l >> 2] | 0) >>> 0)
				}
				g = c[m >> 2] | 0
			} while ((s | 0) != 2 & g >>> 0 < f >>> 0)
		}
		Of(n);
		i = d;
		return
	}

	function tl(a, b) {
		a = a | 0;
		b = b | 0;
		return
	}

	function ul(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0;
		c[a + 4 >> 2] = b + -1;
		c[a >> 2] = 9844;
		b = a + 8 | 0;
		Yn(b, 28);
		Mf(a + 144 | 0, 22284, 1);
		d = c[b >> 2] | 0;
		b = a + 12 | 0;
		e = c[b >> 2] | 0;
		if ((e | 0) != (d | 0)) {
			f = e;
			while (1) {
				e = f + -4 | 0;
				if ((e | 0) == (d | 0)) {
					g = e;
					break
				} else f = e
			}
			c[b >> 2] = g
		}
		c[335] = 0;
		c[334] = 8772;
		Zn(a, 1336);
		c[337] = 0;
		c[336] = 8812;
		_n(a, 1344);
		Xl(1352, 0, 0, 1);
		$n(a, 1352);
		c[343] = 0;
		c[342] = 10132;
		ao(a, 1368);
		c[345] = 0;
		c[344] = 10200;
		bo(a, 1376);
		c[347] = 0;
		c[346] = 9952;
		c[348] = Wh() | 0;
		co(a, 1384);
		c[351] = 0;
		c[350] = 10248;
		eo(a, 1400);
		c[353] = 0;
		c[352] = 10296;
		fo(a, 1408);
		Om(1416, 1);
		go(a, 1416);
		Pm(1440, 1);
		ho(a, 1440);
		c[369] = 0;
		c[368] = 8852;
		io(a, 1472);
		c[371] = 0;
		c[370] = 8924;
		jo(a, 1480);
		c[373] = 0;
		c[372] = 8996;
		ko(a, 1488);
		c[375] = 0;
		c[374] = 9056;
		lo(a, 1496);
		c[377] = 0;
		c[376] = 9364;
		mo(a, 1504);
		c[379] = 0;
		c[378] = 9428;
		no(a, 1512);
		c[381] = 0;
		c[380] = 9492;
		oo(a, 1520);
		c[383] = 0;
		c[382] = 9556;
		po(a, 1528);
		c[385] = 0;
		c[384] = 9620;
		qo(a, 1536);
		c[387] = 0;
		c[386] = 9656;
		ro(a, 1544);
		c[389] = 0;
		c[388] = 9692;
		so(a, 1552);
		c[391] = 0;
		c[390] = 9728;
		to(a, 1560);
		c[393] = 0;
		c[392] = 9116;
		c[394] = 9164;
		uo(a, 1568);
		c[397] = 0;
		c[396] = 9208;
		c[398] = 9256;
		vo(a, 1584);
		c[401] = 0;
		c[400] = 10112;
		c[402] = Wh() | 0;
		c[400] = 9300;
		wo(a, 1600);
		c[405] = 0;
		c[404] = 10112;
		c[406] = Wh() | 0;
		c[404] = 9332;
		xo(a, 1616);
		c[409] = 0;
		c[408] = 9764;
		yo(a, 1632);
		c[411] = 0;
		c[410] = 9804;
		zo(a, 1640);
		return
	}

	function vl() {
		if ((a[1648] | 0) == 0 ? (Ba(1648) | 0) != 0 : 0) {
			zl() | 0;
			c[2658] = 10628;
			Ha(1648)
		}
		return c[2658] | 0
	}

	function wl(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0;
		dp(b);
		e = a + 8 | 0;
		f = c[e >> 2] | 0;
		if ((c[a + 12 >> 2] | 0) - f >> 2 >>> 0 > d >>> 0) g = f;
		else {
			Ao(e, d + 1 | 0);
			g = c[e >> 2] | 0
		}
		f = c[g + (d << 2) >> 2] | 0;
		if (!f) h = g;
		else {
			ep(f) | 0;
			h = c[e >> 2] | 0
		}
		c[h + (d << 2) >> 2] = b;
		return
	}

	function xl(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0;
		c[a >> 2] = 9844;
		b = a + 8 | 0;
		d = a + 12 | 0;
		e = c[b >> 2] | 0;
		if ((c[d >> 2] | 0) != (e | 0)) {
			f = e;
			e = 0;
			do {
				g = c[f + (e << 2) >> 2] | 0;
				if (g) ep(g) | 0;
				e = e + 1 | 0;
				f = c[b >> 2] | 0
			} while (e >>> 0 < (c[d >> 2] | 0) - f >> 2 >>> 0)
		}
		Of(a + 144 | 0);
		Bo(b);
		return
	}

	function yl(a) {
		a = a | 0;
		xl(a);
		Fc(a);
		return
	}

	function zl() {
		ul(1656, 1);
		c[2657] = 1656;
		return 10628
	}

	function Al() {
		var a = 0;
		a = c[(vl() | 0) >> 2] | 0;
		c[2659] = a;
		dp(a);
		return 10636
	}

	function Bl() {
		if ((a[1816] | 0) == 0 ? (Ba(1816) | 0) != 0 : 0) {
			Al() | 0;
			c[2660] = 10636;
			Ha(1816)
		}
		return c[2660] | 0
	}

	function Cl(a) {
		a = a | 0;
		var b = 0;
		b = c[(Bl() | 0) >> 2] | 0;
		c[a >> 2] = b;
		dp(b);
		return
	}

	function Dl(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		d = c[b >> 2] | 0;
		c[a >> 2] = d;
		dp(d);
		return
	}

	function El(a) {
		a = a | 0;
		ep(c[a >> 2] | 0) | 0;
		return
	}

	function Fl(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = i;
		i = i + 16 | 0;
		d = b;
		if ((c[a >> 2] | 0) != -1) {
			c[d >> 2] = a;
			c[d + 4 >> 2] = 113;
			c[d + 8 >> 2] = 0;
			fp(a, d, 114)
		}
		i = b;
		return (c[a + 4 >> 2] | 0) + -1 | 0
	}

	function Gl(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		d = c[a >> 2] | 0;
		a = Fl(b) | 0;
		return c[(c[d + 8 >> 2] | 0) + (a << 2) >> 2] | 0
	}

	function Hl(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Il(a) {
		a = a | 0;
		if (a) tb[c[(c[a >> 2] | 0) + 4 >> 2] & 127](a);
		return
	}

	function Jl(a) {
		a = a | 0;
		var b = 0;
		b = c[2464] | 0;
		c[2464] = b + 1;
		c[a + 4 >> 2] = b + 1;
		return
	}

	function Kl(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Ll(a, d, e) {
		a = a | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		if (e >>> 0 < 128) f = (b[(c[(wd() | 0) >> 2] | 0) + (e << 1) >> 1] & d) << 16 >> 16 != 0;
		else f = 0;
		return f | 0
	}

	function Ml(a, d, f, g) {
		a = a | 0;
		d = d | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0;
		a = (f - d | 0) >>> 2;
		if ((d | 0) != (f | 0)) {
			h = d;
			i = g;
			while (1) {
				g = c[h >> 2] | 0;
				if (g >>> 0 < 128) j = e[(c[(wd() | 0) >> 2] | 0) + (g << 1) >> 1] | 0;
				else j = 0;
				b[i >> 1] = j;
				h = h + 4 | 0;
				if ((h | 0) == (f | 0)) break;
				else i = i + 2 | 0
			}
		}
		return d + (a << 2) | 0
	}

	function Nl(a, d, e, f) {
		a = a | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0;
		a: do
			if ((e | 0) == (f | 0)) g = f;
			else {
				a = e;
				while (1) {
					h = c[a >> 2] | 0;
					if (h >>> 0 < 128 ? (b[(c[(wd() | 0) >> 2] | 0) + (h << 1) >> 1] & d) << 16 >> 16 != 0 : 0) {
						g = a;
						break a
					}
					a = a + 4 | 0;
					if ((a | 0) == (f | 0)) {
						g = f;
						break
					}
				}
			}
		while (0);
		return g | 0
	}

	function Ol(a, d, e, f) {
		a = a | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0;
		a: do
			if ((e | 0) == (f | 0)) g = f;
			else {
				a = e;
				while (1) {
					h = c[a >> 2] | 0;
					if (h >>> 0 >= 128) {
						g = a;
						break a
					}
					if (!((b[(c[(wd() | 0) >> 2] | 0) + (h << 1) >> 1] & d) << 16 >> 16)) {
						g = a;
						break a
					}
					a = a + 4 | 0;
					if ((a | 0) == (f | 0)) {
						g = f;
						break
					}
				}
			}
		while (0);
		return g | 0
	}

	function Pl(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		if (b >>> 0 < 128) d = c[(c[(yd() | 0) >> 2] | 0) + (b << 2) >> 2] | 0;
		else d = b;
		return d | 0
	}

	function Ql(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0;
		a = (d - b | 0) >>> 2;
		if ((b | 0) != (d | 0)) {
			e = b;
			do {
				f = c[e >> 2] | 0;
				if (f >>> 0 < 128) g = c[(c[(yd() | 0) >> 2] | 0) + (f << 2) >> 2] | 0;
				else g = f;
				c[e >> 2] = g;
				e = e + 4 | 0
			} while ((e | 0) != (d | 0))
		}
		return b + (a << 2) | 0
	}

	function Rl(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		if (b >>> 0 < 128) d = c[(c[(xd() | 0) >> 2] | 0) + (b << 2) >> 2] | 0;
		else d = b;
		return d | 0
	}

	function Sl(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0;
		a = (d - b | 0) >>> 2;
		if ((b | 0) != (d | 0)) {
			e = b;
			do {
				f = c[e >> 2] | 0;
				if (f >>> 0 < 128) g = c[(c[(xd() | 0) >> 2] | 0) + (f << 2) >> 2] | 0;
				else g = f;
				c[e >> 2] = g;
				e = e + 4 | 0
			} while ((e | 0) != (d | 0))
		}
		return b + (a << 2) | 0
	}

	function Tl(a, b) {
		a = a | 0;
		b = b | 0;
		return b << 24 >> 24 | 0
	}

	function Ul(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		if ((d | 0) != (e | 0)) {
			b = d;
			d = f;
			while (1) {
				c[d >> 2] = a[b >> 0];
				b = b + 1 | 0;
				if ((b | 0) == (e | 0)) break;
				else d = d + 4 | 0
			}
		}
		return e | 0
	}

	function Vl(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return (b >>> 0 < 128 ? b & 255 : c) | 0
	}

	function Wl(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0;
		b = (e - d | 0) >>> 2;
		if ((d | 0) != (e | 0)) {
			h = d;
			i = g;
			while (1) {
				g = c[h >> 2] | 0;
				a[i >> 0] = g >>> 0 < 128 ? g & 255 : f;
				h = h + 4 | 0;
				if ((h | 0) == (e | 0)) break;
				else i = i + 1 | 0
			}
		}
		return d + (b << 2) | 0
	}

	function Xl(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		c[b + 4 >> 2] = f + -1;
		c[b >> 2] = 9884;
		f = b + 8 | 0;
		c[f >> 2] = d;
		a[b + 12 >> 0] = e & 1;
		if (!d) c[f >> 2] = c[(wd() | 0) >> 2];
		return
	}

	function Yl(b) {
		b = b | 0;
		var d = 0;
		c[b >> 2] = 9884;
		d = c[b + 8 >> 2] | 0;
		if ((d | 0) != 0 ? (a[b + 12 >> 0] | 0) != 0 : 0) Gc(d);
		return
	}

	function Zl(a) {
		a = a | 0;
		Yl(a);
		Fc(a);
		return
	}

	function _l(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		if (b << 24 >> 24 > -1) d = c[(c[(yd() | 0) >> 2] | 0) + ((b & 255) << 2) >> 2] & 255;
		else d = b;
		return d | 0
	}

	function $l(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		if ((d | 0) != (e | 0)) {
			b = d;
			do {
				d = a[b >> 0] | 0;
				if (d << 24 >> 24 > -1) f = c[(c[(yd() | 0) >> 2] | 0) + (d << 24 >> 24 << 2) >> 2] & 255;
				else f = d;
				a[b >> 0] = f;
				b = b + 1 | 0
			} while ((b | 0) != (e | 0))
		}
		return e | 0
	}

	function am(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		if (b << 24 >> 24 > -1) d = c[(c[(xd() | 0) >> 2] | 0) + (b << 24 >> 24 << 2) >> 2] & 255;
		else d = b;
		return d | 0
	}

	function bm(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		if ((d | 0) != (e | 0)) {
			b = d;
			do {
				d = a[b >> 0] | 0;
				if (d << 24 >> 24 > -1) f = c[(c[(xd() | 0) >> 2] | 0) + (d << 24 >> 24 << 2) >> 2] & 255;
				else f = d;
				a[b >> 0] = f;
				b = b + 1 | 0
			} while ((b | 0) != (e | 0))
		}
		return e | 0
	}

	function cm(a, b) {
		a = a | 0;
		b = b | 0;
		return b | 0
	}

	function dm(b, c, d, e) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		if ((c | 0) != (d | 0)) {
			b = c;
			c = e;
			while (1) {
				a[c >> 0] = a[b >> 0] | 0;
				b = b + 1 | 0;
				if ((b | 0) == (d | 0)) break;
				else c = c + 1 | 0
			}
		}
		return d | 0
	}

	function em(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return (b << 24 >> 24 > -1 ? b : c) | 0
	}

	function fm(b, c, d, e, f) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		if ((c | 0) != (d | 0)) {
			b = c;
			c = f;
			while (1) {
				f = a[b >> 0] | 0;
				a[c >> 0] = f << 24 >> 24 > -1 ? f : e;
				b = b + 1 | 0;
				if ((b | 0) == (d | 0)) break;
				else c = c + 1 | 0
			}
		}
		return d | 0
	}

	function gm(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function hm(a, b, d, e, f, g, h, i) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		c[f >> 2] = d;
		c[i >> 2] = g;
		return 3
	}

	function im(a, b, d, e, f, g, h, i) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		c[f >> 2] = d;
		c[i >> 2] = g;
		return 3
	}

	function jm(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		c[f >> 2] = d;
		return 3
	}

	function km(a) {
		a = a | 0;
		return 1
	}

	function lm(a) {
		a = a | 0;
		return 1
	}

	function mm(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		b = d - c | 0;
		return (b >>> 0 < e >>> 0 ? b : e) | 0
	}

	function nm(a) {
		a = a | 0;
		return 1
	}

	function om(a) {
		a = a | 0;
		sn(a);
		Fc(a);
		return
	}

	function pm(b, d, e, f, g, h, j, k) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		l = i;
		i = i + 16 | 0;
		m = l;
		n = l + 8 | 0;
		a: do
			if ((e | 0) == (f | 0)) o = f;
			else {
				p = e;
				while (1) {
					if (!(c[p >> 2] | 0)) {
						o = p;
						break a
					}
					p = p + 4 | 0;
					if ((p | 0) == (f | 0)) {
						o = f;
						break
					}
				}
			}
		while (0);
		c[k >> 2] = h;
		c[g >> 2] = e;
		p = j;
		q = b + 8 | 0;
		b: do
			if ((h | 0) == (j | 0) | (e | 0) == (f | 0)) {
				r = e;
				s = 29
			} else {
				b = e;
				t = h;
				u = o;
				c: while (1) {
					v = d;
					w = c[v + 4 >> 2] | 0;
					x = m;
					c[x >> 2] = c[v >> 2];
					c[x + 4 >> 2] = w;
					w = Pd(c[q >> 2] | 0) | 0;
					x = fe(t, g, u - b >> 2, p - t | 0, d) | 0;
					if (w) Pd(w) | 0;
					switch (x | 0) {
						case 0:
							{
								y = 1;
								break b;
								break
							}
						case -1:
							{
								z = b;A = t;
								break c;
								break
							}
						default:
							{}
					}
					w = (c[k >> 2] | 0) + x | 0;
					c[k >> 2] = w;
					if ((w | 0) == (j | 0)) {
						s = 15;
						break
					}
					if ((u | 0) == (f | 0)) {
						B = c[g >> 2] | 0;
						C = w;
						D = f
					} else {
						w = Pd(c[q >> 2] | 0) | 0;
						x = ee(n, 0, d) | 0;
						if (w) Pd(w) | 0;
						if ((x | 0) == -1) {
							y = 2;
							break b
						}
						if (x >>> 0 > (p - (c[k >> 2] | 0) | 0) >>> 0) {
							y = 1;
							break b
						}
						if (x) {
							w = x;
							x = n;
							while (1) {
								v = a[x >> 0] | 0;
								E = c[k >> 2] | 0;
								c[k >> 2] = E + 1;
								a[E >> 0] = v;
								w = w + -1 | 0;
								if (!w) break;
								else x = x + 1 | 0
							}
						}
						x = (c[g >> 2] | 0) + 4 | 0;
						c[g >> 2] = x;
						d: do
							if ((x | 0) == (f | 0)) F = f;
							else {
								w = x;
								while (1) {
									if (!(c[w >> 2] | 0)) {
										F = w;
										break d
									}
									w = w + 4 | 0;
									if ((w | 0) == (f | 0)) {
										F = f;
										break
									}
								}
							}
						while (0);
						B = x;
						C = c[k >> 2] | 0;
						D = F
					}
					if ((C | 0) == (j | 0) | (B | 0) == (f | 0)) {
						r = B;
						s = 29;
						break b
					} else {
						b = B;
						t = C;
						u = D
					}
				}
				if ((s | 0) == 15) {
					r = c[g >> 2] | 0;
					s = 29;
					break
				}
				c[k >> 2] = A;
				e: do
					if ((z | 0) == (c[g >> 2] | 0)) G = z;
					else {
						u = z;
						t = A;
						while (1) {
							b = c[u >> 2] | 0;
							w = Pd(c[q >> 2] | 0) | 0;
							v = ee(t, b, m) | 0;
							if (w) Pd(w) | 0;
							if ((v | 0) == -1) {
								G = u;
								break e
							}
							t = (c[k >> 2] | 0) + v | 0;
							c[k >> 2] = t;
							v = u + 4 | 0;
							if ((v | 0) == (c[g >> 2] | 0)) {
								G = v;
								break
							} else u = v
						}
					}
				while (0);
				c[g >> 2] = G;
				y = 2
			}
		while (0);
		if ((s | 0) == 29) y = (r | 0) != (f | 0) & 1;
		i = l;
		return y | 0
	}

	function qm(b, d, e, f, g, h, j, k) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0;
		l = i;
		i = i + 16 | 0;
		m = l;
		a: do
			if ((e | 0) == (f | 0)) n = f;
			else {
				o = e;
				while (1) {
					if (!(a[o >> 0] | 0)) {
						n = o;
						break a
					}
					o = o + 1 | 0;
					if ((o | 0) == (f | 0)) {
						n = f;
						break
					}
				}
			}
		while (0);
		c[k >> 2] = h;
		c[g >> 2] = e;
		o = j;
		p = b + 8 | 0;
		b: do
			if ((h | 0) == (j | 0) | (e | 0) == (f | 0)) {
				q = e;
				r = 29
			} else {
				b = e;
				s = h;
				t = n;
				c: while (1) {
					u = d;
					v = c[u + 4 >> 2] | 0;
					w = m;
					c[w >> 2] = c[u >> 2];
					c[w + 4 >> 2] = v;
					v = t;
					w = Pd(c[p >> 2] | 0) | 0;
					u = be(s, g, v - b | 0, o - s >> 2, d) | 0;
					if (w) Pd(w) | 0;
					switch (u | 0) {
						case 0:
							{
								x = 2;
								break b;
								break
							}
						case -1:
							{
								y = b;z = s;A = v;
								break c;
								break
							}
						default:
							{}
					}
					v = (c[k >> 2] | 0) + (u << 2) | 0;
					c[k >> 2] = v;
					if ((v | 0) == (j | 0)) {
						r = 19;
						break
					}
					u = c[g >> 2] | 0;
					if ((t | 0) == (f | 0)) {
						B = u;
						C = v;
						D = f
					} else {
						w = Pd(c[p >> 2] | 0) | 0;
						E = $d(v, u, 1, d) | 0;
						if (w) Pd(w) | 0;
						if (E) {
							x = 2;
							break b
						}
						c[k >> 2] = (c[k >> 2] | 0) + 4;
						E = (c[g >> 2] | 0) + 1 | 0;
						c[g >> 2] = E;
						d: do
							if ((E | 0) == (f | 0)) F = f;
							else {
								w = E;
								while (1) {
									if (!(a[w >> 0] | 0)) {
										F = w;
										break d
									}
									w = w + 1 | 0;
									if ((w | 0) == (f | 0)) {
										F = f;
										break
									}
								}
							}
						while (0);
						B = E;
						C = c[k >> 2] | 0;
						D = F
					}
					if ((C | 0) == (j | 0) | (B | 0) == (f | 0)) {
						q = B;
						r = 29;
						break b
					} else {
						b = B;
						s = C;
						t = D
					}
				}
				if ((r | 0) == 19) {
					q = c[g >> 2] | 0;
					r = 29;
					break
				}
				c[k >> 2] = z;
				e: do
					if ((y | 0) != (c[g >> 2] | 0)) {
						t = y;
						s = z;
						f: while (1) {
							b = Pd(c[p >> 2] | 0) | 0;
							w = $d(s, t, A - t | 0, m) | 0;
							if (b) Pd(b) | 0;
							switch (w | 0) {
								case -1:
									{
										G = t;r = 13;
										break f;
										break
									}
								case -2:
									{
										H = t;r = 14;
										break f;
										break
									}
								case 0:
									{
										I = t + 1 | 0;
										break
									}
								default:
									I = t + w | 0
							}
							s = (c[k >> 2] | 0) + 4 | 0;
							c[k >> 2] = s;
							if ((I | 0) == (c[g >> 2] | 0)) {
								J = I;
								break e
							} else t = I
						}
						if ((r | 0) == 13) {
							c[g >> 2] = G;
							x = 2;
							break b
						} else if ((r | 0) == 14) {
							c[g >> 2] = H;
							x = 1;
							break b
						}
					} else J = y; while (0);
				c[g >> 2] = J;
				x = (J | 0) != (f | 0) & 1
			}
		while (0);
		if ((r | 0) == 29) x = (q | 0) != (f | 0) & 1;
		i = l;
		return x | 0
	}

	function rm(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0;
		h = i;
		i = i + 16 | 0;
		j = h;
		c[g >> 2] = e;
		e = Pd(c[b + 8 >> 2] | 0) | 0;
		b = ee(j, 0, d) | 0;
		if (e) Pd(e) | 0;
		switch (b | 0) {
			case 0:
			case -1:
				{
					k = 2;
					break
				}
			default:
				{
					e = b + -1 | 0;
					if (e >>> 0 <= (f - (c[g >> 2] | 0) | 0) >>> 0)
						if (!e) k = 0;
						else {
							f = e;
							e = j;
							while (1) {
								j = a[e >> 0] | 0;
								b = c[g >> 2] | 0;
								c[g >> 2] = b + 1;
								a[b >> 0] = j;
								f = f + -1 | 0;
								if (!f) {
									k = 0;
									break
								} else e = e + 1 | 0
							}
						}
					else k = 1
				}
		}
		i = h;
		return k | 0
	}

	function sm(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0;
		b = a + 8 | 0;
		a = Pd(c[b >> 2] | 0) | 0;
		d = de(0, 0, 4) | 0;
		if (a) Pd(a) | 0;
		if (!d) {
			d = c[b >> 2] | 0;
			if (d) {
				b = Pd(d) | 0;
				if (!b) e = 0;
				else {
					Pd(b) | 0;
					e = 0
				}
			} else e = 1
		} else e = -1;
		return e | 0
	}

	function tm(a) {
		a = a | 0;
		return 0
	}

	function um(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		g = e;
		h = a + 8 | 0;
		a: do
			if ((d | 0) == (e | 0) | (f | 0) == 0) i = 0;
			else {
				a = d;
				j = 0;
				k = 0;
				while (1) {
					l = Pd(c[h >> 2] | 0) | 0;
					m = _d(a, g - a | 0, b) | 0;
					if (l) Pd(l) | 0;
					switch (m | 0) {
						case -2:
						case -1:
							{
								i = j;
								break a;
								break
							}
						case 0:
							{
								n = a + 1 | 0;o = 1;
								break
							}
						default:
							{
								n = a + m | 0;o = m
							}
					}
					m = o + j | 0;
					k = k + 1 | 0;
					if ((n | 0) == (e | 0) | k >>> 0 >= f >>> 0) {
						i = m;
						break a
					} else {
						a = n;
						j = m
					}
				}
			}
		while (0);
		return i | 0
	}

	function vm(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = c[a + 8 >> 2] | 0;
		if (b) {
			a = Pd(b) | 0;
			if (!a) d = 4;
			else {
				Pd(a) | 0;
				d = 4
			}
		} else d = 1;
		return d | 0
	}

	function wm(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function xm(a, b, d, e, f, g, h, j) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0;
		b = i;
		i = i + 16 | 0;
		a = b + 4 | 0;
		k = b;
		c[a >> 2] = d;
		c[k >> 2] = g;
		l = Do(d, e, a, g, h, k, 1114111, 0) | 0;
		c[f >> 2] = c[a >> 2];
		c[j >> 2] = c[k >> 2];
		i = b;
		return l | 0
	}

	function ym(a, b, d, e, f, g, h, j) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0;
		b = i;
		i = i + 16 | 0;
		a = b + 4 | 0;
		k = b;
		c[a >> 2] = d;
		c[k >> 2] = g;
		l = Eo(d, e, a, g, h, k, 1114111, 0) | 0;
		c[f >> 2] = c[a >> 2];
		c[j >> 2] = c[k >> 2];
		i = b;
		return l | 0
	}

	function zm(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		c[f >> 2] = d;
		return 3
	}

	function Am(a) {
		a = a | 0;
		return 0
	}

	function Bm(a) {
		a = a | 0;
		return 0
	}

	function Cm(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		return Fo(c, d, e, 1114111, 0) | 0
	}

	function Dm(a) {
		a = a | 0;
		return 4
	}

	function Em(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Fm(a, b, d, e, f, g, h, j) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0;
		b = i;
		i = i + 16 | 0;
		a = b + 4 | 0;
		k = b;
		c[a >> 2] = d;
		c[k >> 2] = g;
		l = Go(d, e, a, g, h, k, 1114111, 0) | 0;
		c[f >> 2] = c[a >> 2];
		c[j >> 2] = c[k >> 2];
		i = b;
		return l | 0
	}

	function Gm(a, b, d, e, f, g, h, j) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0;
		b = i;
		i = i + 16 | 0;
		a = b + 4 | 0;
		k = b;
		c[a >> 2] = d;
		c[k >> 2] = g;
		l = Ho(d, e, a, g, h, k, 1114111, 0) | 0;
		c[f >> 2] = c[a >> 2];
		c[j >> 2] = c[k >> 2];
		i = b;
		return l | 0
	}

	function Hm(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		c[f >> 2] = d;
		return 3
	}

	function Im(a) {
		a = a | 0;
		return 0
	}

	function Jm(a) {
		a = a | 0;
		return 0
	}

	function Km(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		return Io(c, d, e, 1114111, 0) | 0
	}

	function Lm(a) {
		a = a | 0;
		return 4
	}

	function Mm(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Nm(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Om(b, d) {
		b = b | 0;
		d = d | 0;
		c[b + 4 >> 2] = d + -1;
		c[b >> 2] = 10032;
		a[b + 8 >> 0] = 46;
		a[b + 9 >> 0] = 44;
		d = b + 12 | 0;
		c[d >> 2] = 0;
		c[d + 4 >> 2] = 0;
		c[d + 8 >> 2] = 0;
		return
	}

	function Pm(a, b) {
		a = a | 0;
		b = b | 0;
		c[a + 4 >> 2] = b + -1;
		c[a >> 2] = 10072;
		c[a + 8 >> 2] = 46;
		c[a + 12 >> 2] = 44;
		b = a + 16 | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		return
	}

	function Qm(a) {
		a = a | 0;
		c[a >> 2] = 10032;
		Of(a + 12 | 0);
		return
	}

	function Rm(a) {
		a = a | 0;
		Qm(a);
		Fc(a);
		return
	}

	function Sm(a) {
		a = a | 0;
		c[a >> 2] = 10072;
		Of(a + 16 | 0);
		return
	}

	function Tm(a) {
		a = a | 0;
		Sm(a);
		Fc(a);
		return
	}

	function Um(b) {
		b = b | 0;
		return a[b + 8 >> 0] | 0
	}

	function Vm(a) {
		a = a | 0;
		return c[a + 8 >> 2] | 0
	}

	function Wm(b) {
		b = b | 0;
		return a[b + 9 >> 0] | 0
	}

	function Xm(a) {
		a = a | 0;
		return c[a + 12 >> 2] | 0
	}

	function Ym(a, b) {
		a = a | 0;
		b = b | 0;
		Lf(a, b + 12 | 0);
		return
	}

	function Zm(a, b) {
		a = a | 0;
		b = b | 0;
		Lf(a, b + 16 | 0);
		return
	}

	function _m(a, b) {
		a = a | 0;
		b = b | 0;
		Mf(a, 22386, 4);
		return
	}

	function $m(a, b) {
		a = a | 0;
		b = b | 0;
		Yf(a, 10644, Qe(10644) | 0);
		return
	}

	function an(a, b) {
		a = a | 0;
		b = b | 0;
		Mf(a, 22391, 5);
		return
	}

	function bn(a, b) {
		a = a | 0;
		b = b | 0;
		Yf(a, 10664, Qe(10664) | 0);
		return
	}

	function cn(a) {
		a = a | 0;
		var b = 0;
		switch (c[a + 4 >> 2] & 74 | 0) {
			case 64:
				{
					b = 8;
					break
				}
			case 8:
				{
					b = 16;
					break
				}
			case 0:
				{
					b = 0;
					break
				}
			default:
				b = 10
		}
		return b | 0
	}

	function dn(b) {
		b = b | 0;
		if ((a[1824] | 0) == 0 ? (Ba(1824) | 0) != 0 : 0) {
			if ((a[1832] | 0) == 0 ? (Ba(1832) | 0) != 0 : 0) {
				b = 10688;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 10856);
				bb(115, 0, n | 0) | 0;
				Ha(1832)
			}
			Qf(10688, 22397) | 0;
			Qf(10700, 22404) | 0;
			Qf(10712, 22411) | 0;
			Qf(10724, 22419) | 0;
			Qf(10736, 22429) | 0;
			Qf(10748, 22438) | 0;
			Qf(10760, 22445) | 0;
			Qf(10772, 22454) | 0;
			Qf(10784, 22458) | 0;
			Qf(10796, 22462) | 0;
			Qf(10808, 22466) | 0;
			Qf(10820, 22470) | 0;
			Qf(10832, 22474) | 0;
			Qf(10844, 22478) | 0;
			c[2714] = 10688;
			Ha(1824)
		}
		return c[2714] | 0
	}

	function en(b) {
		b = b | 0;
		if ((a[1840] | 0) == 0 ? (Ba(1840) | 0) != 0 : 0) {
			if ((a[1848] | 0) == 0 ? (Ba(1848) | 0) != 0 : 0) {
				b = 10860;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 11028);
				bb(116, 0, n | 0) | 0;
				Ha(1848)
			}
			$f(10860, 11028) | 0;
			$f(10872, 11056) | 0;
			$f(10884, 11084) | 0;
			$f(10896, 11116) | 0;
			$f(10908, 11156) | 0;
			$f(10920, 11192) | 0;
			$f(10932, 11220) | 0;
			$f(10944, 11256) | 0;
			$f(10956, 11272) | 0;
			$f(10968, 11288) | 0;
			$f(10980, 11304) | 0;
			$f(10992, 11320) | 0;
			$f(11004, 11336) | 0;
			$f(11016, 11352) | 0;
			c[2842] = 10860;
			Ha(1840)
		}
		return c[2842] | 0
	}

	function fn(b) {
		b = b | 0;
		if ((a[1856] | 0) == 0 ? (Ba(1856) | 0) != 0 : 0) {
			if ((a[1864] | 0) == 0 ? (Ba(1864) | 0) != 0 : 0) {
				b = 11372;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 11660);
				bb(117, 0, n | 0) | 0;
				Ha(1864)
			}
			Qf(11372, 22482) | 0;
			Qf(11384, 22490) | 0;
			Qf(11396, 22499) | 0;
			Qf(11408, 22505) | 0;
			Qf(11420, 22511) | 0;
			Qf(11432, 22515) | 0;
			Qf(11444, 22520) | 0;
			Qf(11456, 22525) | 0;
			Qf(11468, 22532) | 0;
			Qf(11480, 22542) | 0;
			Qf(11492, 22550) | 0;
			Qf(11504, 22559) | 0;
			Qf(11516, 22568) | 0;
			Qf(11528, 22572) | 0;
			Qf(11540, 22576) | 0;
			Qf(11552, 22580) | 0;
			Qf(11564, 22511) | 0;
			Qf(11576, 22584) | 0;
			Qf(11588, 22588) | 0;
			Qf(11600, 22592) | 0;
			Qf(11612, 22596) | 0;
			Qf(11624, 22600) | 0;
			Qf(11636, 22604) | 0;
			Qf(11648, 22608) | 0;
			c[2915] = 11372;
			Ha(1856)
		}
		return c[2915] | 0
	}

	function gn(b) {
		b = b | 0;
		if ((a[1872] | 0) == 0 ? (Ba(1872) | 0) != 0 : 0) {
			if ((a[1880] | 0) == 0 ? (Ba(1880) | 0) != 0 : 0) {
				b = 11664;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 11952);
				bb(118, 0, n | 0) | 0;
				Ha(1880)
			}
			$f(11664, 11952) | 0;
			$f(11676, 11984) | 0;
			$f(11688, 12020) | 0;
			$f(11700, 12044) | 0;
			$f(11712, 12068) | 0;
			$f(11724, 12084) | 0;
			$f(11736, 12104) | 0;
			$f(11748, 12124) | 0;
			$f(11760, 12152) | 0;
			$f(11772, 12192) | 0;
			$f(11784, 12224) | 0;
			$f(11796, 12260) | 0;
			$f(11808, 12296) | 0;
			$f(11820, 12312) | 0;
			$f(11832, 12328) | 0;
			$f(11844, 12344) | 0;
			$f(11856, 12068) | 0;
			$f(11868, 12360) | 0;
			$f(11880, 12376) | 0;
			$f(11892, 12392) | 0;
			$f(11904, 12408) | 0;
			$f(11916, 12424) | 0;
			$f(11928, 12440) | 0;
			$f(11940, 12456) | 0;
			c[3118] = 11664;
			Ha(1872)
		}
		return c[3118] | 0
	}

	function hn(b) {
		b = b | 0;
		if ((a[1888] | 0) == 0 ? (Ba(1888) | 0) != 0 : 0) {
			if ((a[1896] | 0) == 0 ? (Ba(1896) | 0) != 0 : 0) {
				b = 12476;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 12764);
				bb(119, 0, n | 0) | 0;
				Ha(1896)
			}
			Qf(12476, 22612) | 0;
			Qf(12488, 22615) | 0;
			c[3191] = 12476;
			Ha(1888)
		}
		return c[3191] | 0
	}

	function jn(b) {
		b = b | 0;
		if ((a[1904] | 0) == 0 ? (Ba(1904) | 0) != 0 : 0) {
			if ((a[1912] | 0) == 0 ? (Ba(1912) | 0) != 0 : 0) {
				b = 12768;
				do {
					c[b >> 2] = 0;
					c[b + 4 >> 2] = 0;
					c[b + 8 >> 2] = 0;
					b = b + 12 | 0
				} while ((b | 0) != 13056);
				bb(120, 0, n | 0) | 0;
				Ha(1912)
			}
			$f(12768, 13056) | 0;
			$f(12780, 13068) | 0;
			c[3270] = 12768;
			Ha(1904)
		}
		return c[3270] | 0
	}

	function kn(b) {
		b = b | 0;
		if ((a[1920] | 0) == 0 ? (Ba(1920) | 0) != 0 : 0) {
			Mf(13084, 22618, 8);
			bb(121, 13084, n | 0) | 0;
			Ha(1920)
		}
		return 13084
	}

	function ln(b) {
		b = b | 0;
		if ((a[1928] | 0) == 0 ? (Ba(1928) | 0) != 0 : 0) {
			Yf(13132, 13096, Qe(13096) | 0);
			bb(122, 13132, n | 0) | 0;
			Ha(1928)
		}
		return 13132
	}

	function mn(b) {
		b = b | 0;
		if ((a[1936] | 0) == 0 ? (Ba(1936) | 0) != 0 : 0) {
			Mf(13144, 22627, 8);
			bb(121, 13144, n | 0) | 0;
			Ha(1936)
		}
		return 13144
	}

	function nn(b) {
		b = b | 0;
		if ((a[1944] | 0) == 0 ? (Ba(1944) | 0) != 0 : 0) {
			Yf(13192, 13156, Qe(13156) | 0);
			bb(122, 13192, n | 0) | 0;
			Ha(1944)
		}
		return 13192
	}

	function on(b) {
		b = b | 0;
		if ((a[1952] | 0) == 0 ? (Ba(1952) | 0) != 0 : 0) {
			Mf(13204, 22636, 20);
			bb(121, 13204, n | 0) | 0;
			Ha(1952)
		}
		return 13204
	}

	function pn(b) {
		b = b | 0;
		if ((a[1960] | 0) == 0 ? (Ba(1960) | 0) != 0 : 0) {
			Yf(13300, 13216, Qe(13216) | 0);
			bb(122, 13300, n | 0) | 0;
			Ha(1960)
		}
		return 13300
	}

	function qn(b) {
		b = b | 0;
		if ((a[1968] | 0) == 0 ? (Ba(1968) | 0) != 0 : 0) {
			Mf(13312, 22657, 11);
			bb(121, 13312, n | 0) | 0;
			Ha(1968)
		}
		return 13312
	}

	function rn(b) {
		b = b | 0;
		if ((a[1976] | 0) == 0 ? (Ba(1976) | 0) != 0 : 0) {
			Yf(13372, 13324, Qe(13324) | 0);
			bb(122, 13372, n | 0) | 0;
			Ha(1976)
		}
		return 13372
	}

	function sn(a) {
		a = a | 0;
		var b = 0;
		c[a >> 2] = 9952;
		b = a + 8 | 0;
		a = c[b >> 2] | 0;
		if ((a | 0) != (Wh() | 0)) Ld(c[b >> 2] | 0);
		return
	}

	function tn(b, e, f, g, h, j, k) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0;
		l = i;
		i = i + 112 | 0;
		m = l;
		n = (g - f | 0) / 12 | 0;
		if (n >>> 0 > 100) {
			o = qd(n) | 0;
			if (!o) md();
			else {
				p = o;
				q = o
			}
		} else {
			p = 0;
			q = m
		}
		if ((f | 0) == (g | 0)) {
			r = 0;
			s = n
		} else {
			m = f;
			o = 0;
			t = n;
			n = q;
			while (1) {
				u = a[m >> 0] | 0;
				if (!(u & 1)) v = (u & 255) >>> 1;
				else v = c[m + 4 >> 2] | 0;
				if (!v) {
					a[n >> 0] = 2;
					w = o + 1 | 0;
					x = t + -1 | 0
				} else {
					a[n >> 0] = 1;
					w = o;
					x = t
				}
				m = m + 12 | 0;
				if ((m | 0) == (g | 0)) {
					r = w;
					s = x;
					break
				} else {
					o = w;
					t = x;
					n = n + 1 | 0
				}
			}
		}
		n = (f | 0) == (g | 0);
		x = (f | 0) == (g | 0);
		t = 0;
		w = r;
		r = s;
		a: while (1) {
			s = c[b >> 2] | 0;
			do
				if (s)
					if ((c[s + 12 >> 2] | 0) == (c[s + 16 >> 2] | 0))
						if ((xb[c[(c[s >> 2] | 0) + 36 >> 2] & 63](s) | 0) == -1) {
							c[b >> 2] = 0;
							y = 0;
							break
						} else {
							y = c[b >> 2] | 0;
							break
						}
			else y = s;
			else y = 0;
			while (0);
			s = (y | 0) == 0;
			o = c[e >> 2] | 0;
			if (o)
				if ((c[o + 12 >> 2] | 0) == (c[o + 16 >> 2] | 0) ? (xb[c[(c[o >> 2] | 0) + 36 >> 2] & 63](o) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					z = 0
				} else z = o;
			else z = 0;
			o = (z | 0) == 0;
			m = c[b >> 2] | 0;
			if (!((r | 0) != 0 & (s ^ o))) {
				A = o;
				B = m;
				C = z;
				break
			}
			o = c[m + 12 >> 2] | 0;
			if ((o | 0) == (c[m + 16 >> 2] | 0)) D = xb[c[(c[m >> 2] | 0) + 36 >> 2] & 63](m) | 0;
			else D = d[o >> 0] | 0;
			o = D & 255;
			if (k) E = o;
			else E = Db[c[(c[h >> 2] | 0) + 12 >> 2] & 31](h, o) | 0;
			o = t + 1 | 0;
			if (n) {
				F = 0;
				G = w;
				H = r
			} else {
				m = 0;
				s = f;
				v = w;
				u = r;
				I = q;
				while (1) {
					do
						if ((a[I >> 0] | 0) == 1) {
							if (!(a[s >> 0] & 1)) J = s + 1 | 0;
							else J = c[s + 8 >> 2] | 0;
							K = a[J + t >> 0] | 0;
							if (k) L = K;
							else L = Db[c[(c[h >> 2] | 0) + 12 >> 2] & 31](h, K) | 0;
							if (E << 24 >> 24 != L << 24 >> 24) {
								a[I >> 0] = 0;
								M = m;
								N = v;
								O = u + -1 | 0;
								break
							}
							K = a[s >> 0] | 0;
							if (!(K & 1)) P = (K & 255) >>> 1;
							else P = c[s + 4 >> 2] | 0;
							if ((P | 0) == (o | 0)) {
								a[I >> 0] = 2;
								M = 1;
								N = v + 1 | 0;
								O = u + -1 | 0
							} else {
								M = 1;
								N = v;
								O = u
							}
						} else {
							M = m;
							N = v;
							O = u
						}
					while (0);
					s = s + 12 | 0;
					if ((s | 0) == (g | 0)) {
						F = M;
						G = N;
						H = O;
						break
					} else {
						m = M;
						v = N;
						u = O;
						I = I + 1 | 0
					}
				}
			}
			if (!F) {
				t = o;
				w = G;
				r = H;
				continue
			}
			I = c[b >> 2] | 0;
			u = I + 12 | 0;
			v = c[u >> 2] | 0;
			if ((v | 0) == (c[I + 16 >> 2] | 0)) xb[c[(c[I >> 2] | 0) + 40 >> 2] & 63](I) | 0;
			else c[u >> 2] = v + 1;
			if ((G + H | 0) >>> 0 < 2 | x) {
				t = o;
				w = G;
				r = H;
				continue
			} else {
				Q = f;
				R = G;
				S = q
			}
			while (1) {
				if ((a[S >> 0] | 0) == 2) {
					v = a[Q >> 0] | 0;
					if (!(v & 1)) T = (v & 255) >>> 1;
					else T = c[Q + 4 >> 2] | 0;
					if ((T | 0) != (o | 0)) {
						a[S >> 0] = 0;
						U = R + -1 | 0
					} else U = R
				} else U = R;
				v = Q + 12 | 0;
				if ((v | 0) == (g | 0)) {
					t = o;
					w = U;
					r = H;
					continue a
				} else {
					Q = v;
					R = U;
					S = S + 1 | 0
				}
			}
		}
		do
			if (B)
				if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0))
					if ((xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1) {
						c[b >> 2] = 0;
						V = 0;
						break
					} else {
						V = c[b >> 2] | 0;
						break
					}
		else V = B;
		else V = 0;
		while (0);
		B = (V | 0) == 0;
		do
			if (!A) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					W = 65;
					break
				}
				if (!B) W = 66
			} else W = 65; while (0);
		if ((W | 0) == 65 ? B : 0) W = 66;
		if ((W | 0) == 66) c[j >> 2] = c[j >> 2] | 2;
		b: do
			if ((f | 0) == (g | 0)) W = 70;
			else {
				B = f;
				e = q;
				while (1) {
					if ((a[e >> 0] | 0) == 2) {
						X = B;
						break b
					}
					B = B + 12 | 0;
					if ((B | 0) == (g | 0)) {
						W = 70;
						break
					} else e = e + 1 | 0
				}
			}
		while (0);
		if ((W | 0) == 70) {
			c[j >> 2] = c[j >> 2] | 4;
			X = g
		}
		rd(p);
		i = l;
		return X | 0
	}

	function un(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		b = i;
		i = i + 224 | 0;
		k = b + 198 | 0;
		l = b + 196 | 0;
		m = b + 16 | 0;
		n = b + 4 | 0;
		o = b + 192 | 0;
		p = b + 32 | 0;
		q = b;
		r = b + 28 | 0;
		s = cn(g) | 0;
		ji(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = a[l >> 0] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 0
				} else y = l;
			else y = 0;
			u = (y | 0) == 0;
			z = c[f >> 2] | 0;
			do
				if (z) {
					if ((c[z + 12 >> 2] | 0) != (c[z + 16 >> 2] | 0))
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					if ((xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) != -1)
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						E = 13;
						break
					}
				} else E = 13; while (0);
			if ((E | 0) == 13) {
				E = 0;
				if (u) {
					B = y;
					C = 0;
					D = x;
					break
				} else A = 0
			}
			z = a[n >> 0] | 0;
			F = (z & 1) == 0 ? (z & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + F | 0)) {
				Sf(n, F << 1, 0);
				if (!(a[n >> 0] & 1)) G = 10;
				else G = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, G, 0);
				z = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = z + F;
				H = z
			} else H = x;
			z = y + 12 | 0;
			F = c[z >> 2] | 0;
			I = y + 16 | 0;
			if ((F | 0) == (c[I >> 2] | 0)) J = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else J = d[F >> 0] | 0;
			if (Vh(J & 255, s, H, o, r, w, m, p, q, k) | 0) {
				B = y;
				C = A;
				D = H;
				break
			}
			F = c[z >> 2] | 0;
			if ((F | 0) == (c[I >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				l = y;
				x = H;
				continue
			} else {
				c[z >> 2] = F + 1;
				l = y;
				x = H;
				continue
			}
		}
		H = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((H & 1) == 0 ? (H & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			H = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = H;
			K = r
		} else K = x;
		c[j >> 2] = bp(D, c[o >> 2] | 0, h, s) | 0;
		Tk(m, p, K, h);
		if (B)
			if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				L = 0
			} else L = B;
		else L = 0;
		B = (L | 0) == 0;
		do
			if (C) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					E = 38;
					break
				}
				if (!B) E = 39
			} else E = 38; while (0);
		if ((E | 0) == 38 ? B : 0) E = 39;
		if ((E | 0) == 39) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = b;
		return h | 0
	}

	function vn(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0;
		b = i;
		i = i + 224 | 0;
		k = b + 198 | 0;
		l = b + 196 | 0;
		m = b + 16 | 0;
		n = b + 4 | 0;
		o = b + 192 | 0;
		p = b + 32 | 0;
		q = b;
		r = b + 28 | 0;
		s = cn(g) | 0;
		ji(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = a[l >> 0] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 0
				} else y = l;
			else y = 0;
			u = (y | 0) == 0;
			z = c[f >> 2] | 0;
			do
				if (z) {
					if ((c[z + 12 >> 2] | 0) != (c[z + 16 >> 2] | 0))
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							E = x;
							break a
						}
					if ((xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) != -1)
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							E = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						F = 13;
						break
					}
				} else F = 13; while (0);
			if ((F | 0) == 13) {
				F = 0;
				if (u) {
					B = y;
					C = 0;
					E = x;
					break
				} else A = 0
			}
			z = a[n >> 0] | 0;
			G = (z & 1) == 0 ? (z & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + G | 0)) {
				Sf(n, G << 1, 0);
				if (!(a[n >> 0] & 1)) H = 10;
				else H = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, H, 0);
				z = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = z + G;
				I = z
			} else I = x;
			z = y + 12 | 0;
			G = c[z >> 2] | 0;
			J = y + 16 | 0;
			if ((G | 0) == (c[J >> 2] | 0)) K = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else K = d[G >> 0] | 0;
			if (Vh(K & 255, s, I, o, r, w, m, p, q, k) | 0) {
				B = y;
				C = A;
				E = I;
				break
			}
			G = c[z >> 2] | 0;
			if ((G | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				l = y;
				x = I;
				continue
			} else {
				c[z >> 2] = G + 1;
				l = y;
				x = I;
				continue
			}
		}
		I = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			I = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = I;
			L = r
		} else L = x;
		x = ap(E, c[o >> 2] | 0, h, s) | 0;
		s = j;
		c[s >> 2] = x;
		c[s + 4 >> 2] = D;
		Tk(m, p, L, h);
		if (B)
			if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				M = 0
			} else M = B;
		else M = 0;
		B = (M | 0) == 0;
		do
			if (C) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					F = 38;
					break
				}
				if (!B) F = 39
			} else F = 38; while (0);
		if ((F | 0) == 38 ? B : 0) F = 39;
		if ((F | 0) == 39) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = b;
		return h | 0
	}

	function wn(e, f, g, h, j, k) {
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0;
		e = i;
		i = i + 224 | 0;
		l = e + 198 | 0;
		m = e + 196 | 0;
		n = e + 16 | 0;
		o = e + 4 | 0;
		p = e + 192 | 0;
		q = e + 32 | 0;
		r = e;
		s = e + 28 | 0;
		t = cn(h) | 0;
		ji(n, h, l, m);
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		if (!(a[o >> 0] & 1)) u = 10;
		else u = (c[o >> 2] & -2) + -1 | 0;
		Sf(o, u, 0);
		u = o + 8 | 0;
		h = o + 1 | 0;
		v = (a[o >> 0] & 1) == 0 ? h : c[u >> 2] | 0;
		c[p >> 2] = v;
		c[r >> 2] = q;
		c[s >> 2] = 0;
		w = o + 4 | 0;
		x = a[m >> 0] | 0;
		m = c[f >> 2] | 0;
		y = v;
		a: while (1) {
			if (m)
				if ((c[m + 12 >> 2] | 0) == (c[m + 16 >> 2] | 0) ? (xb[c[(c[m >> 2] | 0) + 36 >> 2] & 63](m) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					z = 0
				} else z = m;
			else z = 0;
			v = (z | 0) == 0;
			A = c[g >> 2] | 0;
			do
				if (A) {
					if ((c[A + 12 >> 2] | 0) != (c[A + 16 >> 2] | 0))
						if (v) {
							B = A;
							break
						} else {
							C = z;
							D = A;
							E = y;
							break a
						}
					if ((xb[c[(c[A >> 2] | 0) + 36 >> 2] & 63](A) | 0) != -1)
						if (v) {
							B = A;
							break
						} else {
							C = z;
							D = A;
							E = y;
							break a
						}
					else {
						c[g >> 2] = 0;
						F = 13;
						break
					}
				} else F = 13; while (0);
			if ((F | 0) == 13) {
				F = 0;
				if (v) {
					C = z;
					D = 0;
					E = y;
					break
				} else B = 0
			}
			A = a[o >> 0] | 0;
			G = (A & 1) == 0 ? (A & 255) >>> 1 : c[w >> 2] | 0;
			if ((c[p >> 2] | 0) == (y + G | 0)) {
				Sf(o, G << 1, 0);
				if (!(a[o >> 0] & 1)) H = 10;
				else H = (c[o >> 2] & -2) + -1 | 0;
				Sf(o, H, 0);
				A = (a[o >> 0] & 1) == 0 ? h : c[u >> 2] | 0;
				c[p >> 2] = A + G;
				I = A
			} else I = y;
			A = z + 12 | 0;
			G = c[A >> 2] | 0;
			J = z + 16 | 0;
			if ((G | 0) == (c[J >> 2] | 0)) K = xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0;
			else K = d[G >> 0] | 0;
			if (Vh(K & 255, t, I, p, s, x, n, q, r, l) | 0) {
				C = z;
				D = B;
				E = I;
				break
			}
			G = c[A >> 2] | 0;
			if ((G | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[z >> 2] | 0) + 40 >> 2] & 63](z) | 0;
				m = z;
				y = I;
				continue
			} else {
				c[A >> 2] = G + 1;
				m = z;
				y = I;
				continue
			}
		}
		I = a[n >> 0] | 0;
		y = c[r >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[n + 4 >> 2] | 0) | 0) != 0 ? (y - q | 0) < 160 : 0) {
			I = c[s >> 2] | 0;
			s = y + 4 | 0;
			c[r >> 2] = s;
			c[y >> 2] = I;
			L = s
		} else L = y;
		b[k >> 1] = $o(E, c[p >> 2] | 0, j, t) | 0;
		Tk(n, q, L, j);
		if (C)
			if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
				c[f >> 2] = 0;
				M = 0
			} else M = C;
		else M = 0;
		C = (M | 0) == 0;
		do
			if (D) {
				if ((c[D + 12 >> 2] | 0) == (c[D + 16 >> 2] | 0) ? (xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0) == -1 : 0) {
					c[g >> 2] = 0;
					F = 38;
					break
				}
				if (!C) F = 39
			} else F = 38; while (0);
		if ((F | 0) == 38 ? C : 0) F = 39;
		if ((F | 0) == 39) c[j >> 2] = c[j >> 2] | 2;
		j = c[f >> 2] | 0;
		Of(o);
		Of(n);
		i = e;
		return j | 0
	}

	function xn(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		b = i;
		i = i + 224 | 0;
		k = b + 198 | 0;
		l = b + 196 | 0;
		m = b + 16 | 0;
		n = b + 4 | 0;
		o = b + 192 | 0;
		p = b + 32 | 0;
		q = b;
		r = b + 28 | 0;
		s = cn(g) | 0;
		ji(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = a[l >> 0] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 0
				} else y = l;
			else y = 0;
			u = (y | 0) == 0;
			z = c[f >> 2] | 0;
			do
				if (z) {
					if ((c[z + 12 >> 2] | 0) != (c[z + 16 >> 2] | 0))
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					if ((xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) != -1)
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						E = 13;
						break
					}
				} else E = 13; while (0);
			if ((E | 0) == 13) {
				E = 0;
				if (u) {
					B = y;
					C = 0;
					D = x;
					break
				} else A = 0
			}
			z = a[n >> 0] | 0;
			F = (z & 1) == 0 ? (z & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + F | 0)) {
				Sf(n, F << 1, 0);
				if (!(a[n >> 0] & 1)) G = 10;
				else G = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, G, 0);
				z = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = z + F;
				H = z
			} else H = x;
			z = y + 12 | 0;
			F = c[z >> 2] | 0;
			I = y + 16 | 0;
			if ((F | 0) == (c[I >> 2] | 0)) J = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else J = d[F >> 0] | 0;
			if (Vh(J & 255, s, H, o, r, w, m, p, q, k) | 0) {
				B = y;
				C = A;
				D = H;
				break
			}
			F = c[z >> 2] | 0;
			if ((F | 0) == (c[I >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				l = y;
				x = H;
				continue
			} else {
				c[z >> 2] = F + 1;
				l = y;
				x = H;
				continue
			}
		}
		H = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((H & 1) == 0 ? (H & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			H = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = H;
			K = r
		} else K = x;
		c[j >> 2] = _o(D, c[o >> 2] | 0, h, s) | 0;
		Tk(m, p, K, h);
		if (B)
			if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				L = 0
			} else L = B;
		else L = 0;
		B = (L | 0) == 0;
		do
			if (C) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					E = 38;
					break
				}
				if (!B) E = 39
			} else E = 38; while (0);
		if ((E | 0) == 38 ? B : 0) E = 39;
		if ((E | 0) == 39) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = b;
		return h | 0
	}

	function yn(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		b = i;
		i = i + 224 | 0;
		k = b + 198 | 0;
		l = b + 196 | 0;
		m = b + 16 | 0;
		n = b + 4 | 0;
		o = b + 192 | 0;
		p = b + 32 | 0;
		q = b;
		r = b + 28 | 0;
		s = cn(g) | 0;
		ji(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = a[l >> 0] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 0
				} else y = l;
			else y = 0;
			u = (y | 0) == 0;
			z = c[f >> 2] | 0;
			do
				if (z) {
					if ((c[z + 12 >> 2] | 0) != (c[z + 16 >> 2] | 0))
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					if ((xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) != -1)
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							D = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						E = 13;
						break
					}
				} else E = 13; while (0);
			if ((E | 0) == 13) {
				E = 0;
				if (u) {
					B = y;
					C = 0;
					D = x;
					break
				} else A = 0
			}
			z = a[n >> 0] | 0;
			F = (z & 1) == 0 ? (z & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + F | 0)) {
				Sf(n, F << 1, 0);
				if (!(a[n >> 0] & 1)) G = 10;
				else G = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, G, 0);
				z = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = z + F;
				H = z
			} else H = x;
			z = y + 12 | 0;
			F = c[z >> 2] | 0;
			I = y + 16 | 0;
			if ((F | 0) == (c[I >> 2] | 0)) J = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else J = d[F >> 0] | 0;
			if (Vh(J & 255, s, H, o, r, w, m, p, q, k) | 0) {
				B = y;
				C = A;
				D = H;
				break
			}
			F = c[z >> 2] | 0;
			if ((F | 0) == (c[I >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				l = y;
				x = H;
				continue
			} else {
				c[z >> 2] = F + 1;
				l = y;
				x = H;
				continue
			}
		}
		H = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((H & 1) == 0 ? (H & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			H = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = H;
			K = r
		} else K = x;
		c[j >> 2] = Zo(D, c[o >> 2] | 0, h, s) | 0;
		Tk(m, p, K, h);
		if (B)
			if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				L = 0
			} else L = B;
		else L = 0;
		B = (L | 0) == 0;
		do
			if (C) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					E = 38;
					break
				}
				if (!B) E = 39
			} else E = 38; while (0);
		if ((E | 0) == 38 ? B : 0) E = 39;
		if ((E | 0) == 39) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = b;
		return h | 0
	}

	function zn(b, e, f, g, h, j) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0;
		b = i;
		i = i + 224 | 0;
		k = b + 198 | 0;
		l = b + 196 | 0;
		m = b + 16 | 0;
		n = b + 4 | 0;
		o = b + 192 | 0;
		p = b + 32 | 0;
		q = b;
		r = b + 28 | 0;
		s = cn(g) | 0;
		ji(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = a[l >> 0] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l)
				if ((c[l + 12 >> 2] | 0) == (c[l + 16 >> 2] | 0) ? (xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					y = 0
				} else y = l;
			else y = 0;
			u = (y | 0) == 0;
			z = c[f >> 2] | 0;
			do
				if (z) {
					if ((c[z + 12 >> 2] | 0) != (c[z + 16 >> 2] | 0))
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							E = x;
							break a
						}
					if ((xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) != -1)
						if (u) {
							A = z;
							break
						} else {
							B = y;
							C = z;
							E = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						F = 13;
						break
					}
				} else F = 13; while (0);
			if ((F | 0) == 13) {
				F = 0;
				if (u) {
					B = y;
					C = 0;
					E = x;
					break
				} else A = 0
			}
			z = a[n >> 0] | 0;
			G = (z & 1) == 0 ? (z & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + G | 0)) {
				Sf(n, G << 1, 0);
				if (!(a[n >> 0] & 1)) H = 10;
				else H = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, H, 0);
				z = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = z + G;
				I = z
			} else I = x;
			z = y + 12 | 0;
			G = c[z >> 2] | 0;
			J = y + 16 | 0;
			if ((G | 0) == (c[J >> 2] | 0)) K = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else K = d[G >> 0] | 0;
			if (Vh(K & 255, s, I, o, r, w, m, p, q, k) | 0) {
				B = y;
				C = A;
				E = I;
				break
			}
			G = c[z >> 2] | 0;
			if ((G | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				l = y;
				x = I;
				continue
			} else {
				c[z >> 2] = G + 1;
				l = y;
				x = I;
				continue
			}
		}
		I = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			I = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = I;
			L = r
		} else L = x;
		x = Yo(E, c[o >> 2] | 0, h, s) | 0;
		s = j;
		c[s >> 2] = x;
		c[s + 4 >> 2] = D;
		Tk(m, p, L, h);
		if (B)
			if ((c[B + 12 >> 2] | 0) == (c[B + 16 >> 2] | 0) ? (xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				M = 0
			} else M = B;
		else M = 0;
		B = (M | 0) == 0;
		do
			if (C) {
				if ((c[C + 12 >> 2] | 0) == (c[C + 16 >> 2] | 0) ? (xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					F = 38;
					break
				}
				if (!B) F = 39
			} else F = 38; while (0);
		if ((F | 0) == 38 ? B : 0) F = 39;
		if ((F | 0) == 39) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = b;
		return h | 0
	}

	function An(b, e, f, h, j, k) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 256 | 0;
		l = b + 208 | 0;
		m = b + 200 | 0;
		n = b + 240 | 0;
		o = b;
		p = b + 188 | 0;
		q = b + 184 | 0;
		r = b + 16 | 0;
		s = b + 176 | 0;
		t = b + 180 | 0;
		u = b + 241 | 0;
		v = b + 242 | 0;
		ki(o, h, l, m, n);
		c[p >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p + 8 >> 2] = 0;
		if (!(a[p >> 0] & 1)) w = 10;
		else w = (c[p >> 2] & -2) + -1 | 0;
		Sf(p, w, 0);
		w = p + 8 | 0;
		h = p + 1 | 0;
		x = (a[p >> 0] & 1) == 0 ? h : c[w >> 2] | 0;
		c[q >> 2] = x;
		c[s >> 2] = r;
		c[t >> 2] = 0;
		a[u >> 0] = 1;
		a[v >> 0] = 69;
		y = p + 4 | 0;
		z = a[m >> 0] | 0;
		m = a[n >> 0] | 0;
		n = c[e >> 2] | 0;
		A = x;
		a: while (1) {
			if (n)
				if ((c[n + 12 >> 2] | 0) == (c[n + 16 >> 2] | 0) ? (xb[c[(c[n >> 2] | 0) + 36 >> 2] & 63](n) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					B = 0
				} else B = n;
			else B = 0;
			x = (B | 0) == 0;
			C = c[f >> 2] | 0;
			do
				if (C) {
					if ((c[C + 12 >> 2] | 0) != (c[C + 16 >> 2] | 0))
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					if ((xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) != -1)
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					else {
						c[f >> 2] = 0;
						H = 13;
						break
					}
				} else H = 13; while (0);
			if ((H | 0) == 13) {
				H = 0;
				if (x) {
					E = B;
					F = 0;
					G = A;
					break
				} else D = 0
			}
			C = a[p >> 0] | 0;
			I = (C & 1) == 0 ? (C & 255) >>> 1 : c[y >> 2] | 0;
			if ((c[q >> 2] | 0) == (A + I | 0)) {
				Sf(p, I << 1, 0);
				if (!(a[p >> 0] & 1)) J = 10;
				else J = (c[p >> 2] & -2) + -1 | 0;
				Sf(p, J, 0);
				C = (a[p >> 0] & 1) == 0 ? h : c[w >> 2] | 0;
				c[q >> 2] = C + I;
				K = C
			} else K = A;
			C = B + 12 | 0;
			I = c[C >> 2] | 0;
			L = B + 16 | 0;
			if ((I | 0) == (c[L >> 2] | 0)) M = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else M = d[I >> 0] | 0;
			if (li(M & 255, u, v, K, q, z, m, o, r, s, t, l) | 0) {
				E = B;
				F = D;
				G = K;
				break
			}
			I = c[C >> 2] | 0;
			if ((I | 0) == (c[L >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				n = B;
				A = K;
				continue
			} else {
				c[C >> 2] = I + 1;
				n = B;
				A = K;
				continue
			}
		}
		K = a[o >> 0] | 0;
		A = c[s >> 2] | 0;
		if (!((a[u >> 0] | 0) == 0 ? 1 : (((K & 1) == 0 ? (K & 255) >>> 1 : c[o + 4 >> 2] | 0) | 0) == 0) ? (A - r | 0) < 160 : 0) {
			K = c[t >> 2] | 0;
			t = A + 4 | 0;
			c[s >> 2] = t;
			c[A >> 2] = K;
			N = t
		} else N = A;
		g[k >> 2] = +Xo(G, c[q >> 2] | 0, j);
		Tk(o, r, N, j);
		if (E)
			if ((c[E + 12 >> 2] | 0) == (c[E + 16 >> 2] | 0) ? (xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				O = 0
			} else O = E;
		else O = 0;
		E = (O | 0) == 0;
		do
			if (F) {
				if ((c[F + 12 >> 2] | 0) == (c[F + 16 >> 2] | 0) ? (xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					H = 38;
					break
				}
				if (!E) H = 39
			} else H = 38; while (0);
		if ((H | 0) == 38 ? E : 0) H = 39;
		if ((H | 0) == 39) c[j >> 2] = c[j >> 2] | 2;
		j = c[e >> 2] | 0;
		Of(p);
		Of(o);
		i = b;
		return j | 0
	}

	function Bn(b, e, f, g, j, k) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 256 | 0;
		l = b + 208 | 0;
		m = b + 200 | 0;
		n = b + 240 | 0;
		o = b;
		p = b + 188 | 0;
		q = b + 184 | 0;
		r = b + 16 | 0;
		s = b + 176 | 0;
		t = b + 180 | 0;
		u = b + 241 | 0;
		v = b + 242 | 0;
		ki(o, g, l, m, n);
		c[p >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p + 8 >> 2] = 0;
		if (!(a[p >> 0] & 1)) w = 10;
		else w = (c[p >> 2] & -2) + -1 | 0;
		Sf(p, w, 0);
		w = p + 8 | 0;
		g = p + 1 | 0;
		x = (a[p >> 0] & 1) == 0 ? g : c[w >> 2] | 0;
		c[q >> 2] = x;
		c[s >> 2] = r;
		c[t >> 2] = 0;
		a[u >> 0] = 1;
		a[v >> 0] = 69;
		y = p + 4 | 0;
		z = a[m >> 0] | 0;
		m = a[n >> 0] | 0;
		n = c[e >> 2] | 0;
		A = x;
		a: while (1) {
			if (n)
				if ((c[n + 12 >> 2] | 0) == (c[n + 16 >> 2] | 0) ? (xb[c[(c[n >> 2] | 0) + 36 >> 2] & 63](n) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					B = 0
				} else B = n;
			else B = 0;
			x = (B | 0) == 0;
			C = c[f >> 2] | 0;
			do
				if (C) {
					if ((c[C + 12 >> 2] | 0) != (c[C + 16 >> 2] | 0))
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					if ((xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) != -1)
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					else {
						c[f >> 2] = 0;
						H = 13;
						break
					}
				} else H = 13; while (0);
			if ((H | 0) == 13) {
				H = 0;
				if (x) {
					E = B;
					F = 0;
					G = A;
					break
				} else D = 0
			}
			C = a[p >> 0] | 0;
			I = (C & 1) == 0 ? (C & 255) >>> 1 : c[y >> 2] | 0;
			if ((c[q >> 2] | 0) == (A + I | 0)) {
				Sf(p, I << 1, 0);
				if (!(a[p >> 0] & 1)) J = 10;
				else J = (c[p >> 2] & -2) + -1 | 0;
				Sf(p, J, 0);
				C = (a[p >> 0] & 1) == 0 ? g : c[w >> 2] | 0;
				c[q >> 2] = C + I;
				K = C
			} else K = A;
			C = B + 12 | 0;
			I = c[C >> 2] | 0;
			L = B + 16 | 0;
			if ((I | 0) == (c[L >> 2] | 0)) M = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else M = d[I >> 0] | 0;
			if (li(M & 255, u, v, K, q, z, m, o, r, s, t, l) | 0) {
				E = B;
				F = D;
				G = K;
				break
			}
			I = c[C >> 2] | 0;
			if ((I | 0) == (c[L >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				n = B;
				A = K;
				continue
			} else {
				c[C >> 2] = I + 1;
				n = B;
				A = K;
				continue
			}
		}
		K = a[o >> 0] | 0;
		A = c[s >> 2] | 0;
		if (!((a[u >> 0] | 0) == 0 ? 1 : (((K & 1) == 0 ? (K & 255) >>> 1 : c[o + 4 >> 2] | 0) | 0) == 0) ? (A - r | 0) < 160 : 0) {
			K = c[t >> 2] | 0;
			t = A + 4 | 0;
			c[s >> 2] = t;
			c[A >> 2] = K;
			N = t
		} else N = A;
		h[k >> 3] = +Wo(G, c[q >> 2] | 0, j);
		Tk(o, r, N, j);
		if (E)
			if ((c[E + 12 >> 2] | 0) == (c[E + 16 >> 2] | 0) ? (xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				O = 0
			} else O = E;
		else O = 0;
		E = (O | 0) == 0;
		do
			if (F) {
				if ((c[F + 12 >> 2] | 0) == (c[F + 16 >> 2] | 0) ? (xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					H = 38;
					break
				}
				if (!E) H = 39
			} else H = 38; while (0);
		if ((H | 0) == 38 ? E : 0) H = 39;
		if ((H | 0) == 39) c[j >> 2] = c[j >> 2] | 2;
		j = c[e >> 2] | 0;
		Of(p);
		Of(o);
		i = b;
		return j | 0
	}

	function Cn(b, e, f, g, j, k) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 256 | 0;
		l = b + 208 | 0;
		m = b + 200 | 0;
		n = b + 240 | 0;
		o = b;
		p = b + 188 | 0;
		q = b + 184 | 0;
		r = b + 16 | 0;
		s = b + 176 | 0;
		t = b + 180 | 0;
		u = b + 241 | 0;
		v = b + 242 | 0;
		ki(o, g, l, m, n);
		c[p >> 2] = 0;
		c[p + 4 >> 2] = 0;
		c[p + 8 >> 2] = 0;
		if (!(a[p >> 0] & 1)) w = 10;
		else w = (c[p >> 2] & -2) + -1 | 0;
		Sf(p, w, 0);
		w = p + 8 | 0;
		g = p + 1 | 0;
		x = (a[p >> 0] & 1) == 0 ? g : c[w >> 2] | 0;
		c[q >> 2] = x;
		c[s >> 2] = r;
		c[t >> 2] = 0;
		a[u >> 0] = 1;
		a[v >> 0] = 69;
		y = p + 4 | 0;
		z = a[m >> 0] | 0;
		m = a[n >> 0] | 0;
		n = c[e >> 2] | 0;
		A = x;
		a: while (1) {
			if (n)
				if ((c[n + 12 >> 2] | 0) == (c[n + 16 >> 2] | 0) ? (xb[c[(c[n >> 2] | 0) + 36 >> 2] & 63](n) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					B = 0
				} else B = n;
			else B = 0;
			x = (B | 0) == 0;
			C = c[f >> 2] | 0;
			do
				if (C) {
					if ((c[C + 12 >> 2] | 0) != (c[C + 16 >> 2] | 0))
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					if ((xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0) != -1)
						if (x) {
							D = C;
							break
						} else {
							E = B;
							F = C;
							G = A;
							break a
						}
					else {
						c[f >> 2] = 0;
						H = 13;
						break
					}
				} else H = 13; while (0);
			if ((H | 0) == 13) {
				H = 0;
				if (x) {
					E = B;
					F = 0;
					G = A;
					break
				} else D = 0
			}
			C = a[p >> 0] | 0;
			I = (C & 1) == 0 ? (C & 255) >>> 1 : c[y >> 2] | 0;
			if ((c[q >> 2] | 0) == (A + I | 0)) {
				Sf(p, I << 1, 0);
				if (!(a[p >> 0] & 1)) J = 10;
				else J = (c[p >> 2] & -2) + -1 | 0;
				Sf(p, J, 0);
				C = (a[p >> 0] & 1) == 0 ? g : c[w >> 2] | 0;
				c[q >> 2] = C + I;
				K = C
			} else K = A;
			C = B + 12 | 0;
			I = c[C >> 2] | 0;
			L = B + 16 | 0;
			if ((I | 0) == (c[L >> 2] | 0)) M = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else M = d[I >> 0] | 0;
			if (li(M & 255, u, v, K, q, z, m, o, r, s, t, l) | 0) {
				E = B;
				F = D;
				G = K;
				break
			}
			I = c[C >> 2] | 0;
			if ((I | 0) == (c[L >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				n = B;
				A = K;
				continue
			} else {
				c[C >> 2] = I + 1;
				n = B;
				A = K;
				continue
			}
		}
		K = a[o >> 0] | 0;
		A = c[s >> 2] | 0;
		if (!((a[u >> 0] | 0) == 0 ? 1 : (((K & 1) == 0 ? (K & 255) >>> 1 : c[o + 4 >> 2] | 0) | 0) == 0) ? (A - r | 0) < 160 : 0) {
			K = c[t >> 2] | 0;
			t = A + 4 | 0;
			c[s >> 2] = t;
			c[A >> 2] = K;
			N = t
		} else N = A;
		h[k >> 3] = +Vo(G, c[q >> 2] | 0, j);
		Tk(o, r, N, j);
		if (E)
			if ((c[E + 12 >> 2] | 0) == (c[E + 16 >> 2] | 0) ? (xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0) == -1 : 0) {
				c[e >> 2] = 0;
				O = 0
			} else O = E;
		else O = 0;
		E = (O | 0) == 0;
		do
			if (F) {
				if ((c[F + 12 >> 2] | 0) == (c[F + 16 >> 2] | 0) ? (xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0) == -1 : 0) {
					c[f >> 2] = 0;
					H = 38;
					break
				}
				if (!E) H = 39
			} else H = 38; while (0);
		if ((H | 0) == 38 ? E : 0) H = 39;
		if ((H | 0) == 39) c[j >> 2] = c[j >> 2] | 2;
		j = c[e >> 2] | 0;
		Of(p);
		Of(o);
		i = b;
		return j | 0
	}

	function Dn(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		c[g >> 2] = e;
		e = Pd(b) | 0;
		b = He(a, d, g) | 0;
		if (e) Pd(e) | 0;
		i = f;
		return b | 0
	}

	function En(b, d, e, f, g, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0;
		k = i;
		i = i + 112 | 0;
		l = k;
		m = (f - e | 0) / 12 | 0;
		if (m >>> 0 > 100) {
			n = qd(m) | 0;
			if (!n) md();
			else {
				o = n;
				p = n
			}
		} else {
			o = 0;
			p = l
		}
		if ((e | 0) == (f | 0)) {
			q = 0;
			r = m
		} else {
			l = e;
			n = 0;
			s = m;
			m = p;
			while (1) {
				t = a[l >> 0] | 0;
				if (!(t & 1)) u = (t & 255) >>> 1;
				else u = c[l + 4 >> 2] | 0;
				if (!u) {
					a[m >> 0] = 2;
					v = n + 1 | 0;
					w = s + -1 | 0
				} else {
					a[m >> 0] = 1;
					v = n;
					w = s
				}
				l = l + 12 | 0;
				if ((l | 0) == (f | 0)) {
					q = v;
					r = w;
					break
				} else {
					n = v;
					s = w;
					m = m + 1 | 0
				}
			}
		}
		m = (e | 0) == (f | 0);
		w = (e | 0) == (f | 0);
		s = 0;
		v = q;
		q = r;
		a: while (1) {
			r = c[b >> 2] | 0;
			do
				if (r) {
					n = c[r + 12 >> 2] | 0;
					if ((n | 0) == (c[r + 16 >> 2] | 0)) x = xb[c[(c[r >> 2] | 0) + 36 >> 2] & 63](r) | 0;
					else x = c[n >> 2] | 0;
					if ((x | 0) == -1) {
						c[b >> 2] = 0;
						y = 1;
						break
					} else {
						y = (c[b >> 2] | 0) == 0;
						break
					}
				} else y = 1; while (0);
			r = c[d >> 2] | 0;
			if (r) {
				n = c[r + 12 >> 2] | 0;
				if ((n | 0) == (c[r + 16 >> 2] | 0)) z = xb[c[(c[r >> 2] | 0) + 36 >> 2] & 63](r) | 0;
				else z = c[n >> 2] | 0;
				if ((z | 0) == -1) {
					c[d >> 2] = 0;
					A = 0;
					B = 1
				} else {
					A = r;
					B = 0
				}
			} else {
				A = 0;
				B = 1
			}
			r = c[b >> 2] | 0;
			if (!((q | 0) != 0 & (y ^ B))) {
				C = r;
				D = A;
				break
			}
			n = c[r + 12 >> 2] | 0;
			if ((n | 0) == (c[r + 16 >> 2] | 0)) E = xb[c[(c[r >> 2] | 0) + 36 >> 2] & 63](r) | 0;
			else E = c[n >> 2] | 0;
			if (j) F = E;
			else F = Db[c[(c[g >> 2] | 0) + 28 >> 2] & 31](g, E) | 0;
			n = s + 1 | 0;
			if (m) {
				G = 0;
				H = v;
				I = q
			} else {
				r = 0;
				l = e;
				u = v;
				t = q;
				J = p;
				while (1) {
					do
						if ((a[J >> 0] | 0) == 1) {
							if (!(a[l >> 0] & 1)) K = l + 4 | 0;
							else K = c[l + 8 >> 2] | 0;
							L = c[K + (s << 2) >> 2] | 0;
							if (j) M = L;
							else M = Db[c[(c[g >> 2] | 0) + 28 >> 2] & 31](g, L) | 0;
							if ((F | 0) != (M | 0)) {
								a[J >> 0] = 0;
								N = r;
								O = u;
								P = t + -1 | 0;
								break
							}
							L = a[l >> 0] | 0;
							if (!(L & 1)) Q = (L & 255) >>> 1;
							else Q = c[l + 4 >> 2] | 0;
							if ((Q | 0) == (n | 0)) {
								a[J >> 0] = 2;
								N = 1;
								O = u + 1 | 0;
								P = t + -1 | 0
							} else {
								N = 1;
								O = u;
								P = t
							}
						} else {
							N = r;
							O = u;
							P = t
						}
					while (0);
					l = l + 12 | 0;
					if ((l | 0) == (f | 0)) {
						G = N;
						H = O;
						I = P;
						break
					} else {
						r = N;
						u = O;
						t = P;
						J = J + 1 | 0
					}
				}
			}
			if (!G) {
				s = n;
				v = H;
				q = I;
				continue
			}
			J = c[b >> 2] | 0;
			t = J + 12 | 0;
			u = c[t >> 2] | 0;
			if ((u | 0) == (c[J + 16 >> 2] | 0)) xb[c[(c[J >> 2] | 0) + 40 >> 2] & 63](J) | 0;
			else c[t >> 2] = u + 4;
			if ((H + I | 0) >>> 0 < 2 | w) {
				s = n;
				v = H;
				q = I;
				continue
			} else {
				R = e;
				S = H;
				T = p
			}
			while (1) {
				if ((a[T >> 0] | 0) == 2) {
					u = a[R >> 0] | 0;
					if (!(u & 1)) U = (u & 255) >>> 1;
					else U = c[R + 4 >> 2] | 0;
					if ((U | 0) != (n | 0)) {
						a[T >> 0] = 0;
						V = S + -1 | 0
					} else V = S
				} else V = S;
				u = R + 12 | 0;
				if ((u | 0) == (f | 0)) {
					s = n;
					v = V;
					q = I;
					continue a
				} else {
					R = u;
					S = V;
					T = T + 1 | 0
				}
			}
		}
		do
			if (C) {
				T = c[C + 12 >> 2] | 0;
				if ((T | 0) == (c[C + 16 >> 2] | 0)) W = xb[c[(c[C >> 2] | 0) + 36 >> 2] & 63](C) | 0;
				else W = c[T >> 2] | 0;
				if ((W | 0) == -1) {
					c[b >> 2] = 0;
					X = 1;
					break
				} else {
					X = (c[b >> 2] | 0) == 0;
					break
				}
			} else X = 1; while (0);
		do
			if (D) {
				b = c[D + 12 >> 2] | 0;
				if ((b | 0) == (c[D + 16 >> 2] | 0)) Y = xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0;
				else Y = c[b >> 2] | 0;
				if ((Y | 0) != -1)
					if (X) break;
					else {
						Z = 74;
						break
					}
				else {
					c[d >> 2] = 0;
					Z = 72;
					break
				}
			} else Z = 72; while (0);
		if ((Z | 0) == 72 ? X : 0) Z = 74;
		if ((Z | 0) == 74) c[h >> 2] = c[h >> 2] | 2;
		b: do
			if ((e | 0) == (f | 0)) Z = 78;
			else {
				X = e;
				d = p;
				while (1) {
					if ((a[d >> 0] | 0) == 2) {
						_ = X;
						break b
					}
					X = X + 12 | 0;
					if ((X | 0) == (f | 0)) {
						Z = 78;
						break
					} else d = d + 1 | 0
				}
			}
		while (0);
		if ((Z | 0) == 78) {
			c[h >> 2] = c[h >> 2] | 4;
			_ = f
		}
		rd(o);
		i = k;
		return _ | 0
	}

	function Fn(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 304 | 0;
		j = b + 160 | 0;
		k = b + 280 | 0;
		l = b + 264 | 0;
		m = b + 284 | 0;
		n = b + 300 | 0;
		o = b;
		p = b + 276 | 0;
		q = b + 296 | 0;
		r = cn(f) | 0;
		mi(l, f, j, k);
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		if (!(a[m >> 0] & 1)) s = 10;
		else s = (c[m >> 2] & -2) + -1 | 0;
		Sf(m, s, 0);
		s = m + 8 | 0;
		f = m + 1 | 0;
		t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
		c[n >> 2] = t;
		c[p >> 2] = o;
		c[q >> 2] = 0;
		u = m + 4 | 0;
		v = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		w = t;
		a: while (1) {
			if (k) {
				t = c[k + 12 >> 2] | 0;
				if ((t | 0) == (c[k + 16 >> 2] | 0)) x = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else x = c[t >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 0;
					z = 1
				} else {
					y = k;
					z = 0
				}
			} else {
				y = 0;
				z = 1
			}
			t = c[e >> 2] | 0;
			do
				if (t) {
					A = c[t + 12 >> 2] | 0;
					if ((A | 0) == (c[t + 16 >> 2] | 0)) B = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
					else B = c[A >> 2] | 0;
					if ((B | 0) != -1)
						if (z) {
							C = t;
							break
						} else {
							D = y;
							E = t;
							F = w;
							break a
						}
					else {
						c[e >> 2] = 0;
						G = 16;
						break
					}
				} else G = 16; while (0);
			if ((G | 0) == 16) {
				G = 0;
				if (z) {
					D = y;
					E = 0;
					F = w;
					break
				} else C = 0
			}
			t = a[m >> 0] | 0;
			A = (t & 1) == 0 ? (t & 255) >>> 1 : c[u >> 2] | 0;
			if ((c[n >> 2] | 0) == (w + A | 0)) {
				Sf(m, A << 1, 0);
				if (!(a[m >> 0] & 1)) H = 10;
				else H = (c[m >> 2] & -2) + -1 | 0;
				Sf(m, H, 0);
				t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
				c[n >> 2] = t + A;
				I = t
			} else I = w;
			t = y + 12 | 0;
			A = c[t >> 2] | 0;
			J = y + 16 | 0;
			if ((A | 0) == (c[J >> 2] | 0)) K = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else K = c[A >> 2] | 0;
			if (ii(K, r, I, n, q, v, l, o, p, j) | 0) {
				D = y;
				E = C;
				F = I;
				break
			}
			A = c[t >> 2] | 0;
			if ((A | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				k = y;
				w = I;
				continue
			} else {
				c[t >> 2] = A + 4;
				k = y;
				w = I;
				continue
			}
		}
		I = a[l >> 0] | 0;
		w = c[p >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[l + 4 >> 2] | 0) | 0) != 0 ? (w - o | 0) < 160 : 0) {
			I = c[q >> 2] | 0;
			q = w + 4 | 0;
			c[p >> 2] = q;
			c[w >> 2] = I;
			L = q
		} else L = w;
		c[h >> 2] = bp(F, c[n >> 2] | 0, g, r) | 0;
		Tk(l, o, L, g);
		if (D) {
			L = c[D + 12 >> 2] | 0;
			if ((L | 0) == (c[D + 16 >> 2] | 0)) M = xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0;
			else M = c[L >> 2] | 0;
			if ((M | 0) == -1) {
				c[d >> 2] = 0;
				N = 1
			} else N = 0
		} else N = 1;
		do
			if (E) {
				M = c[E + 12 >> 2] | 0;
				if ((M | 0) == (c[E + 16 >> 2] | 0)) O = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
				else O = c[M >> 2] | 0;
				if ((O | 0) != -1)
					if (N) break;
					else {
						G = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					G = 44;
					break
				}
			} else G = 44; while (0);
		if ((G | 0) == 44 ? N : 0) G = 46;
		if ((G | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(m);
		Of(l);
		i = b;
		return g | 0
	}

	function Gn(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0;
		b = i;
		i = i + 304 | 0;
		j = b + 160 | 0;
		k = b + 280 | 0;
		l = b + 264 | 0;
		m = b + 284 | 0;
		n = b + 300 | 0;
		o = b;
		p = b + 276 | 0;
		q = b + 296 | 0;
		r = cn(f) | 0;
		mi(l, f, j, k);
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		if (!(a[m >> 0] & 1)) s = 10;
		else s = (c[m >> 2] & -2) + -1 | 0;
		Sf(m, s, 0);
		s = m + 8 | 0;
		f = m + 1 | 0;
		t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
		c[n >> 2] = t;
		c[p >> 2] = o;
		c[q >> 2] = 0;
		u = m + 4 | 0;
		v = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		w = t;
		a: while (1) {
			if (k) {
				t = c[k + 12 >> 2] | 0;
				if ((t | 0) == (c[k + 16 >> 2] | 0)) x = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else x = c[t >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 0;
					z = 1
				} else {
					y = k;
					z = 0
				}
			} else {
				y = 0;
				z = 1
			}
			t = c[e >> 2] | 0;
			do
				if (t) {
					A = c[t + 12 >> 2] | 0;
					if ((A | 0) == (c[t + 16 >> 2] | 0)) B = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
					else B = c[A >> 2] | 0;
					if ((B | 0) != -1)
						if (z) {
							C = t;
							break
						} else {
							E = y;
							F = t;
							G = w;
							break a
						}
					else {
						c[e >> 2] = 0;
						H = 16;
						break
					}
				} else H = 16; while (0);
			if ((H | 0) == 16) {
				H = 0;
				if (z) {
					E = y;
					F = 0;
					G = w;
					break
				} else C = 0
			}
			t = a[m >> 0] | 0;
			A = (t & 1) == 0 ? (t & 255) >>> 1 : c[u >> 2] | 0;
			if ((c[n >> 2] | 0) == (w + A | 0)) {
				Sf(m, A << 1, 0);
				if (!(a[m >> 0] & 1)) I = 10;
				else I = (c[m >> 2] & -2) + -1 | 0;
				Sf(m, I, 0);
				t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
				c[n >> 2] = t + A;
				J = t
			} else J = w;
			t = y + 12 | 0;
			A = c[t >> 2] | 0;
			K = y + 16 | 0;
			if ((A | 0) == (c[K >> 2] | 0)) L = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else L = c[A >> 2] | 0;
			if (ii(L, r, J, n, q, v, l, o, p, j) | 0) {
				E = y;
				F = C;
				G = J;
				break
			}
			A = c[t >> 2] | 0;
			if ((A | 0) == (c[K >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				k = y;
				w = J;
				continue
			} else {
				c[t >> 2] = A + 4;
				k = y;
				w = J;
				continue
			}
		}
		J = a[l >> 0] | 0;
		w = c[p >> 2] | 0;
		if ((((J & 1) == 0 ? (J & 255) >>> 1 : c[l + 4 >> 2] | 0) | 0) != 0 ? (w - o | 0) < 160 : 0) {
			J = c[q >> 2] | 0;
			q = w + 4 | 0;
			c[p >> 2] = q;
			c[w >> 2] = J;
			M = q
		} else M = w;
		w = ap(G, c[n >> 2] | 0, g, r) | 0;
		r = h;
		c[r >> 2] = w;
		c[r + 4 >> 2] = D;
		Tk(l, o, M, g);
		if (E) {
			M = c[E + 12 >> 2] | 0;
			if ((M | 0) == (c[E + 16 >> 2] | 0)) N = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
			else N = c[M >> 2] | 0;
			if ((N | 0) == -1) {
				c[d >> 2] = 0;
				O = 1
			} else O = 0
		} else O = 1;
		do
			if (F) {
				N = c[F + 12 >> 2] | 0;
				if ((N | 0) == (c[F + 16 >> 2] | 0)) P = xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0;
				else P = c[N >> 2] | 0;
				if ((P | 0) != -1)
					if (O) break;
					else {
						H = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					H = 44;
					break
				}
			} else H = 44; while (0);
		if ((H | 0) == 44 ? O : 0) H = 46;
		if ((H | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(m);
		Of(l);
		i = b;
		return g | 0
	}

	function Hn(d, e, f, g, h, j) {
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0;
		d = i;
		i = i + 304 | 0;
		k = d + 160 | 0;
		l = d + 280 | 0;
		m = d + 264 | 0;
		n = d + 284 | 0;
		o = d + 300 | 0;
		p = d;
		q = d + 276 | 0;
		r = d + 296 | 0;
		s = cn(g) | 0;
		mi(m, g, k, l);
		c[n >> 2] = 0;
		c[n + 4 >> 2] = 0;
		c[n + 8 >> 2] = 0;
		if (!(a[n >> 0] & 1)) t = 10;
		else t = (c[n >> 2] & -2) + -1 | 0;
		Sf(n, t, 0);
		t = n + 8 | 0;
		g = n + 1 | 0;
		u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
		c[o >> 2] = u;
		c[q >> 2] = p;
		c[r >> 2] = 0;
		v = n + 4 | 0;
		w = c[l >> 2] | 0;
		l = c[e >> 2] | 0;
		x = u;
		a: while (1) {
			if (l) {
				u = c[l + 12 >> 2] | 0;
				if ((u | 0) == (c[l + 16 >> 2] | 0)) y = xb[c[(c[l >> 2] | 0) + 36 >> 2] & 63](l) | 0;
				else y = c[u >> 2] | 0;
				if ((y | 0) == -1) {
					c[e >> 2] = 0;
					z = 0;
					A = 1
				} else {
					z = l;
					A = 0
				}
			} else {
				z = 0;
				A = 1
			}
			u = c[f >> 2] | 0;
			do
				if (u) {
					B = c[u + 12 >> 2] | 0;
					if ((B | 0) == (c[u + 16 >> 2] | 0)) C = xb[c[(c[u >> 2] | 0) + 36 >> 2] & 63](u) | 0;
					else C = c[B >> 2] | 0;
					if ((C | 0) != -1)
						if (A) {
							D = u;
							break
						} else {
							E = z;
							F = u;
							G = x;
							break a
						}
					else {
						c[f >> 2] = 0;
						H = 16;
						break
					}
				} else H = 16; while (0);
			if ((H | 0) == 16) {
				H = 0;
				if (A) {
					E = z;
					F = 0;
					G = x;
					break
				} else D = 0
			}
			u = a[n >> 0] | 0;
			B = (u & 1) == 0 ? (u & 255) >>> 1 : c[v >> 2] | 0;
			if ((c[o >> 2] | 0) == (x + B | 0)) {
				Sf(n, B << 1, 0);
				if (!(a[n >> 0] & 1)) I = 10;
				else I = (c[n >> 2] & -2) + -1 | 0;
				Sf(n, I, 0);
				u = (a[n >> 0] & 1) == 0 ? g : c[t >> 2] | 0;
				c[o >> 2] = u + B;
				J = u
			} else J = x;
			u = z + 12 | 0;
			B = c[u >> 2] | 0;
			K = z + 16 | 0;
			if ((B | 0) == (c[K >> 2] | 0)) L = xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0;
			else L = c[B >> 2] | 0;
			if (ii(L, s, J, o, r, w, m, p, q, k) | 0) {
				E = z;
				F = D;
				G = J;
				break
			}
			B = c[u >> 2] | 0;
			if ((B | 0) == (c[K >> 2] | 0)) {
				xb[c[(c[z >> 2] | 0) + 40 >> 2] & 63](z) | 0;
				l = z;
				x = J;
				continue
			} else {
				c[u >> 2] = B + 4;
				l = z;
				x = J;
				continue
			}
		}
		J = a[m >> 0] | 0;
		x = c[q >> 2] | 0;
		if ((((J & 1) == 0 ? (J & 255) >>> 1 : c[m + 4 >> 2] | 0) | 0) != 0 ? (x - p | 0) < 160 : 0) {
			J = c[r >> 2] | 0;
			r = x + 4 | 0;
			c[q >> 2] = r;
			c[x >> 2] = J;
			M = r
		} else M = x;
		b[j >> 1] = $o(G, c[o >> 2] | 0, h, s) | 0;
		Tk(m, p, M, h);
		if (E) {
			M = c[E + 12 >> 2] | 0;
			if ((M | 0) == (c[E + 16 >> 2] | 0)) N = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
			else N = c[M >> 2] | 0;
			if ((N | 0) == -1) {
				c[e >> 2] = 0;
				O = 1
			} else O = 0
		} else O = 1;
		do
			if (F) {
				N = c[F + 12 >> 2] | 0;
				if ((N | 0) == (c[F + 16 >> 2] | 0)) P = xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0;
				else P = c[N >> 2] | 0;
				if ((P | 0) != -1)
					if (O) break;
					else {
						H = 46;
						break
					}
				else {
					c[f >> 2] = 0;
					H = 44;
					break
				}
			} else H = 44; while (0);
		if ((H | 0) == 44 ? O : 0) H = 46;
		if ((H | 0) == 46) c[h >> 2] = c[h >> 2] | 2;
		h = c[e >> 2] | 0;
		Of(n);
		Of(m);
		i = d;
		return h | 0
	}

	function In(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 304 | 0;
		j = b + 160 | 0;
		k = b + 280 | 0;
		l = b + 264 | 0;
		m = b + 284 | 0;
		n = b + 300 | 0;
		o = b;
		p = b + 276 | 0;
		q = b + 296 | 0;
		r = cn(f) | 0;
		mi(l, f, j, k);
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		if (!(a[m >> 0] & 1)) s = 10;
		else s = (c[m >> 2] & -2) + -1 | 0;
		Sf(m, s, 0);
		s = m + 8 | 0;
		f = m + 1 | 0;
		t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
		c[n >> 2] = t;
		c[p >> 2] = o;
		c[q >> 2] = 0;
		u = m + 4 | 0;
		v = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		w = t;
		a: while (1) {
			if (k) {
				t = c[k + 12 >> 2] | 0;
				if ((t | 0) == (c[k + 16 >> 2] | 0)) x = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else x = c[t >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 0;
					z = 1
				} else {
					y = k;
					z = 0
				}
			} else {
				y = 0;
				z = 1
			}
			t = c[e >> 2] | 0;
			do
				if (t) {
					A = c[t + 12 >> 2] | 0;
					if ((A | 0) == (c[t + 16 >> 2] | 0)) B = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
					else B = c[A >> 2] | 0;
					if ((B | 0) != -1)
						if (z) {
							C = t;
							break
						} else {
							D = y;
							E = t;
							F = w;
							break a
						}
					else {
						c[e >> 2] = 0;
						G = 16;
						break
					}
				} else G = 16; while (0);
			if ((G | 0) == 16) {
				G = 0;
				if (z) {
					D = y;
					E = 0;
					F = w;
					break
				} else C = 0
			}
			t = a[m >> 0] | 0;
			A = (t & 1) == 0 ? (t & 255) >>> 1 : c[u >> 2] | 0;
			if ((c[n >> 2] | 0) == (w + A | 0)) {
				Sf(m, A << 1, 0);
				if (!(a[m >> 0] & 1)) H = 10;
				else H = (c[m >> 2] & -2) + -1 | 0;
				Sf(m, H, 0);
				t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
				c[n >> 2] = t + A;
				I = t
			} else I = w;
			t = y + 12 | 0;
			A = c[t >> 2] | 0;
			J = y + 16 | 0;
			if ((A | 0) == (c[J >> 2] | 0)) K = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else K = c[A >> 2] | 0;
			if (ii(K, r, I, n, q, v, l, o, p, j) | 0) {
				D = y;
				E = C;
				F = I;
				break
			}
			A = c[t >> 2] | 0;
			if ((A | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				k = y;
				w = I;
				continue
			} else {
				c[t >> 2] = A + 4;
				k = y;
				w = I;
				continue
			}
		}
		I = a[l >> 0] | 0;
		w = c[p >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[l + 4 >> 2] | 0) | 0) != 0 ? (w - o | 0) < 160 : 0) {
			I = c[q >> 2] | 0;
			q = w + 4 | 0;
			c[p >> 2] = q;
			c[w >> 2] = I;
			L = q
		} else L = w;
		c[h >> 2] = _o(F, c[n >> 2] | 0, g, r) | 0;
		Tk(l, o, L, g);
		if (D) {
			L = c[D + 12 >> 2] | 0;
			if ((L | 0) == (c[D + 16 >> 2] | 0)) M = xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0;
			else M = c[L >> 2] | 0;
			if ((M | 0) == -1) {
				c[d >> 2] = 0;
				N = 1
			} else N = 0
		} else N = 1;
		do
			if (E) {
				M = c[E + 12 >> 2] | 0;
				if ((M | 0) == (c[E + 16 >> 2] | 0)) O = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
				else O = c[M >> 2] | 0;
				if ((O | 0) != -1)
					if (N) break;
					else {
						G = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					G = 44;
					break
				}
			} else G = 44; while (0);
		if ((G | 0) == 44 ? N : 0) G = 46;
		if ((G | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(m);
		Of(l);
		i = b;
		return g | 0
	}

	function Jn(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		b = i;
		i = i + 304 | 0;
		j = b + 160 | 0;
		k = b + 280 | 0;
		l = b + 264 | 0;
		m = b + 284 | 0;
		n = b + 300 | 0;
		o = b;
		p = b + 276 | 0;
		q = b + 296 | 0;
		r = cn(f) | 0;
		mi(l, f, j, k);
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		if (!(a[m >> 0] & 1)) s = 10;
		else s = (c[m >> 2] & -2) + -1 | 0;
		Sf(m, s, 0);
		s = m + 8 | 0;
		f = m + 1 | 0;
		t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
		c[n >> 2] = t;
		c[p >> 2] = o;
		c[q >> 2] = 0;
		u = m + 4 | 0;
		v = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		w = t;
		a: while (1) {
			if (k) {
				t = c[k + 12 >> 2] | 0;
				if ((t | 0) == (c[k + 16 >> 2] | 0)) x = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else x = c[t >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 0;
					z = 1
				} else {
					y = k;
					z = 0
				}
			} else {
				y = 0;
				z = 1
			}
			t = c[e >> 2] | 0;
			do
				if (t) {
					A = c[t + 12 >> 2] | 0;
					if ((A | 0) == (c[t + 16 >> 2] | 0)) B = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
					else B = c[A >> 2] | 0;
					if ((B | 0) != -1)
						if (z) {
							C = t;
							break
						} else {
							D = y;
							E = t;
							F = w;
							break a
						}
					else {
						c[e >> 2] = 0;
						G = 16;
						break
					}
				} else G = 16; while (0);
			if ((G | 0) == 16) {
				G = 0;
				if (z) {
					D = y;
					E = 0;
					F = w;
					break
				} else C = 0
			}
			t = a[m >> 0] | 0;
			A = (t & 1) == 0 ? (t & 255) >>> 1 : c[u >> 2] | 0;
			if ((c[n >> 2] | 0) == (w + A | 0)) {
				Sf(m, A << 1, 0);
				if (!(a[m >> 0] & 1)) H = 10;
				else H = (c[m >> 2] & -2) + -1 | 0;
				Sf(m, H, 0);
				t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
				c[n >> 2] = t + A;
				I = t
			} else I = w;
			t = y + 12 | 0;
			A = c[t >> 2] | 0;
			J = y + 16 | 0;
			if ((A | 0) == (c[J >> 2] | 0)) K = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else K = c[A >> 2] | 0;
			if (ii(K, r, I, n, q, v, l, o, p, j) | 0) {
				D = y;
				E = C;
				F = I;
				break
			}
			A = c[t >> 2] | 0;
			if ((A | 0) == (c[J >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				k = y;
				w = I;
				continue
			} else {
				c[t >> 2] = A + 4;
				k = y;
				w = I;
				continue
			}
		}
		I = a[l >> 0] | 0;
		w = c[p >> 2] | 0;
		if ((((I & 1) == 0 ? (I & 255) >>> 1 : c[l + 4 >> 2] | 0) | 0) != 0 ? (w - o | 0) < 160 : 0) {
			I = c[q >> 2] | 0;
			q = w + 4 | 0;
			c[p >> 2] = q;
			c[w >> 2] = I;
			L = q
		} else L = w;
		c[h >> 2] = Zo(F, c[n >> 2] | 0, g, r) | 0;
		Tk(l, o, L, g);
		if (D) {
			L = c[D + 12 >> 2] | 0;
			if ((L | 0) == (c[D + 16 >> 2] | 0)) M = xb[c[(c[D >> 2] | 0) + 36 >> 2] & 63](D) | 0;
			else M = c[L >> 2] | 0;
			if ((M | 0) == -1) {
				c[d >> 2] = 0;
				N = 1
			} else N = 0
		} else N = 1;
		do
			if (E) {
				M = c[E + 12 >> 2] | 0;
				if ((M | 0) == (c[E + 16 >> 2] | 0)) O = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
				else O = c[M >> 2] | 0;
				if ((O | 0) != -1)
					if (N) break;
					else {
						G = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					G = 44;
					break
				}
			} else G = 44; while (0);
		if ((G | 0) == 44 ? N : 0) G = 46;
		if ((G | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(m);
		Of(l);
		i = b;
		return g | 0
	}

	function Kn(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0;
		b = i;
		i = i + 304 | 0;
		j = b + 160 | 0;
		k = b + 280 | 0;
		l = b + 264 | 0;
		m = b + 284 | 0;
		n = b + 300 | 0;
		o = b;
		p = b + 276 | 0;
		q = b + 296 | 0;
		r = cn(f) | 0;
		mi(l, f, j, k);
		c[m >> 2] = 0;
		c[m + 4 >> 2] = 0;
		c[m + 8 >> 2] = 0;
		if (!(a[m >> 0] & 1)) s = 10;
		else s = (c[m >> 2] & -2) + -1 | 0;
		Sf(m, s, 0);
		s = m + 8 | 0;
		f = m + 1 | 0;
		t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
		c[n >> 2] = t;
		c[p >> 2] = o;
		c[q >> 2] = 0;
		u = m + 4 | 0;
		v = c[k >> 2] | 0;
		k = c[d >> 2] | 0;
		w = t;
		a: while (1) {
			if (k) {
				t = c[k + 12 >> 2] | 0;
				if ((t | 0) == (c[k + 16 >> 2] | 0)) x = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else x = c[t >> 2] | 0;
				if ((x | 0) == -1) {
					c[d >> 2] = 0;
					y = 0;
					z = 1
				} else {
					y = k;
					z = 0
				}
			} else {
				y = 0;
				z = 1
			}
			t = c[e >> 2] | 0;
			do
				if (t) {
					A = c[t + 12 >> 2] | 0;
					if ((A | 0) == (c[t + 16 >> 2] | 0)) B = xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0;
					else B = c[A >> 2] | 0;
					if ((B | 0) != -1)
						if (z) {
							C = t;
							break
						} else {
							E = y;
							F = t;
							G = w;
							break a
						}
					else {
						c[e >> 2] = 0;
						H = 16;
						break
					}
				} else H = 16; while (0);
			if ((H | 0) == 16) {
				H = 0;
				if (z) {
					E = y;
					F = 0;
					G = w;
					break
				} else C = 0
			}
			t = a[m >> 0] | 0;
			A = (t & 1) == 0 ? (t & 255) >>> 1 : c[u >> 2] | 0;
			if ((c[n >> 2] | 0) == (w + A | 0)) {
				Sf(m, A << 1, 0);
				if (!(a[m >> 0] & 1)) I = 10;
				else I = (c[m >> 2] & -2) + -1 | 0;
				Sf(m, I, 0);
				t = (a[m >> 0] & 1) == 0 ? f : c[s >> 2] | 0;
				c[n >> 2] = t + A;
				J = t
			} else J = w;
			t = y + 12 | 0;
			A = c[t >> 2] | 0;
			K = y + 16 | 0;
			if ((A | 0) == (c[K >> 2] | 0)) L = xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0;
			else L = c[A >> 2] | 0;
			if (ii(L, r, J, n, q, v, l, o, p, j) | 0) {
				E = y;
				F = C;
				G = J;
				break
			}
			A = c[t >> 2] | 0;
			if ((A | 0) == (c[K >> 2] | 0)) {
				xb[c[(c[y >> 2] | 0) + 40 >> 2] & 63](y) | 0;
				k = y;
				w = J;
				continue
			} else {
				c[t >> 2] = A + 4;
				k = y;
				w = J;
				continue
			}
		}
		J = a[l >> 0] | 0;
		w = c[p >> 2] | 0;
		if ((((J & 1) == 0 ? (J & 255) >>> 1 : c[l + 4 >> 2] | 0) | 0) != 0 ? (w - o | 0) < 160 : 0) {
			J = c[q >> 2] | 0;
			q = w + 4 | 0;
			c[p >> 2] = q;
			c[w >> 2] = J;
			M = q
		} else M = w;
		w = Yo(G, c[n >> 2] | 0, g, r) | 0;
		r = h;
		c[r >> 2] = w;
		c[r + 4 >> 2] = D;
		Tk(l, o, M, g);
		if (E) {
			M = c[E + 12 >> 2] | 0;
			if ((M | 0) == (c[E + 16 >> 2] | 0)) N = xb[c[(c[E >> 2] | 0) + 36 >> 2] & 63](E) | 0;
			else N = c[M >> 2] | 0;
			if ((N | 0) == -1) {
				c[d >> 2] = 0;
				O = 1
			} else O = 0
		} else O = 1;
		do
			if (F) {
				N = c[F + 12 >> 2] | 0;
				if ((N | 0) == (c[F + 16 >> 2] | 0)) P = xb[c[(c[F >> 2] | 0) + 36 >> 2] & 63](F) | 0;
				else P = c[N >> 2] | 0;
				if ((P | 0) != -1)
					if (O) break;
					else {
						H = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					H = 44;
					break
				}
			} else H = 44; while (0);
		if ((H | 0) == 44 ? O : 0) H = 46;
		if ((H | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(m);
		Of(l);
		i = b;
		return g | 0
	}

	function Ln(b, d, e, f, h, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		h = h | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0;
		b = i;
		i = i + 352 | 0;
		k = b + 208 | 0;
		l = b + 184 | 0;
		m = b + 4 | 0;
		n = b + 8 | 0;
		o = b + 196 | 0;
		p = b;
		q = b + 24 | 0;
		r = b + 192 | 0;
		s = b + 188 | 0;
		t = b + 337 | 0;
		u = b + 336 | 0;
		ni(n, f, k, l, m);
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		if (!(a[o >> 0] & 1)) v = 10;
		else v = (c[o >> 2] & -2) + -1 | 0;
		Sf(o, v, 0);
		v = o + 8 | 0;
		f = o + 1 | 0;
		w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
		c[p >> 2] = w;
		c[r >> 2] = q;
		c[s >> 2] = 0;
		a[t >> 0] = 1;
		a[u >> 0] = 69;
		x = o + 4 | 0;
		y = c[l >> 2] | 0;
		l = c[m >> 2] | 0;
		m = c[d >> 2] | 0;
		z = w;
		a: while (1) {
			if (m) {
				w = c[m + 12 >> 2] | 0;
				if ((w | 0) == (c[m + 16 >> 2] | 0)) A = xb[c[(c[m >> 2] | 0) + 36 >> 2] & 63](m) | 0;
				else A = c[w >> 2] | 0;
				if ((A | 0) == -1) {
					c[d >> 2] = 0;
					B = 0;
					C = 1
				} else {
					B = m;
					C = 0
				}
			} else {
				B = 0;
				C = 1
			}
			w = c[e >> 2] | 0;
			do
				if (w) {
					D = c[w + 12 >> 2] | 0;
					if ((D | 0) == (c[w + 16 >> 2] | 0)) E = xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0;
					else E = c[D >> 2] | 0;
					if ((E | 0) != -1)
						if (C) {
							F = w;
							break
						} else {
							G = B;
							H = w;
							I = z;
							break a
						}
					else {
						c[e >> 2] = 0;
						J = 16;
						break
					}
				} else J = 16; while (0);
			if ((J | 0) == 16) {
				J = 0;
				if (C) {
					G = B;
					H = 0;
					I = z;
					break
				} else F = 0
			}
			w = a[o >> 0] | 0;
			D = (w & 1) == 0 ? (w & 255) >>> 1 : c[x >> 2] | 0;
			if ((c[p >> 2] | 0) == (z + D | 0)) {
				Sf(o, D << 1, 0);
				if (!(a[o >> 0] & 1)) K = 10;
				else K = (c[o >> 2] & -2) + -1 | 0;
				Sf(o, K, 0);
				w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
				c[p >> 2] = w + D;
				L = w
			} else L = z;
			w = B + 12 | 0;
			D = c[w >> 2] | 0;
			M = B + 16 | 0;
			if ((D | 0) == (c[M >> 2] | 0)) N = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else N = c[D >> 2] | 0;
			if (oi(N, t, u, L, p, y, l, n, q, r, s, k) | 0) {
				G = B;
				H = F;
				I = L;
				break
			}
			D = c[w >> 2] | 0;
			if ((D | 0) == (c[M >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				m = B;
				z = L;
				continue
			} else {
				c[w >> 2] = D + 4;
				m = B;
				z = L;
				continue
			}
		}
		L = a[n >> 0] | 0;
		z = c[r >> 2] | 0;
		if (!((a[t >> 0] | 0) == 0 ? 1 : (((L & 1) == 0 ? (L & 255) >>> 1 : c[n + 4 >> 2] | 0) | 0) == 0) ? (z - q | 0) < 160 : 0) {
			L = c[s >> 2] | 0;
			s = z + 4 | 0;
			c[r >> 2] = s;
			c[z >> 2] = L;
			O = s
		} else O = z;
		g[j >> 2] = +Xo(I, c[p >> 2] | 0, h);
		Tk(n, q, O, h);
		if (G) {
			O = c[G + 12 >> 2] | 0;
			if ((O | 0) == (c[G + 16 >> 2] | 0)) P = xb[c[(c[G >> 2] | 0) + 36 >> 2] & 63](G) | 0;
			else P = c[O >> 2] | 0;
			if ((P | 0) == -1) {
				c[d >> 2] = 0;
				Q = 1
			} else Q = 0
		} else Q = 1;
		do
			if (H) {
				P = c[H + 12 >> 2] | 0;
				if ((P | 0) == (c[H + 16 >> 2] | 0)) R = xb[c[(c[H >> 2] | 0) + 36 >> 2] & 63](H) | 0;
				else R = c[P >> 2] | 0;
				if ((R | 0) != -1)
					if (Q) break;
					else {
						J = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					J = 44;
					break
				}
			} else J = 44; while (0);
		if ((J | 0) == 44 ? Q : 0) J = 46;
		if ((J | 0) == 46) c[h >> 2] = c[h >> 2] | 2;
		h = c[d >> 2] | 0;
		Of(o);
		Of(n);
		i = b;
		return h | 0
	}

	function Mn(b, d, e, f, g, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0;
		b = i;
		i = i + 352 | 0;
		k = b + 208 | 0;
		l = b + 184 | 0;
		m = b + 4 | 0;
		n = b + 8 | 0;
		o = b + 196 | 0;
		p = b;
		q = b + 24 | 0;
		r = b + 192 | 0;
		s = b + 188 | 0;
		t = b + 337 | 0;
		u = b + 336 | 0;
		ni(n, f, k, l, m);
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		if (!(a[o >> 0] & 1)) v = 10;
		else v = (c[o >> 2] & -2) + -1 | 0;
		Sf(o, v, 0);
		v = o + 8 | 0;
		f = o + 1 | 0;
		w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
		c[p >> 2] = w;
		c[r >> 2] = q;
		c[s >> 2] = 0;
		a[t >> 0] = 1;
		a[u >> 0] = 69;
		x = o + 4 | 0;
		y = c[l >> 2] | 0;
		l = c[m >> 2] | 0;
		m = c[d >> 2] | 0;
		z = w;
		a: while (1) {
			if (m) {
				w = c[m + 12 >> 2] | 0;
				if ((w | 0) == (c[m + 16 >> 2] | 0)) A = xb[c[(c[m >> 2] | 0) + 36 >> 2] & 63](m) | 0;
				else A = c[w >> 2] | 0;
				if ((A | 0) == -1) {
					c[d >> 2] = 0;
					B = 0;
					C = 1
				} else {
					B = m;
					C = 0
				}
			} else {
				B = 0;
				C = 1
			}
			w = c[e >> 2] | 0;
			do
				if (w) {
					D = c[w + 12 >> 2] | 0;
					if ((D | 0) == (c[w + 16 >> 2] | 0)) E = xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0;
					else E = c[D >> 2] | 0;
					if ((E | 0) != -1)
						if (C) {
							F = w;
							break
						} else {
							G = B;
							H = w;
							I = z;
							break a
						}
					else {
						c[e >> 2] = 0;
						J = 16;
						break
					}
				} else J = 16; while (0);
			if ((J | 0) == 16) {
				J = 0;
				if (C) {
					G = B;
					H = 0;
					I = z;
					break
				} else F = 0
			}
			w = a[o >> 0] | 0;
			D = (w & 1) == 0 ? (w & 255) >>> 1 : c[x >> 2] | 0;
			if ((c[p >> 2] | 0) == (z + D | 0)) {
				Sf(o, D << 1, 0);
				if (!(a[o >> 0] & 1)) K = 10;
				else K = (c[o >> 2] & -2) + -1 | 0;
				Sf(o, K, 0);
				w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
				c[p >> 2] = w + D;
				L = w
			} else L = z;
			w = B + 12 | 0;
			D = c[w >> 2] | 0;
			M = B + 16 | 0;
			if ((D | 0) == (c[M >> 2] | 0)) N = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else N = c[D >> 2] | 0;
			if (oi(N, t, u, L, p, y, l, n, q, r, s, k) | 0) {
				G = B;
				H = F;
				I = L;
				break
			}
			D = c[w >> 2] | 0;
			if ((D | 0) == (c[M >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				m = B;
				z = L;
				continue
			} else {
				c[w >> 2] = D + 4;
				m = B;
				z = L;
				continue
			}
		}
		L = a[n >> 0] | 0;
		z = c[r >> 2] | 0;
		if (!((a[t >> 0] | 0) == 0 ? 1 : (((L & 1) == 0 ? (L & 255) >>> 1 : c[n + 4 >> 2] | 0) | 0) == 0) ? (z - q | 0) < 160 : 0) {
			L = c[s >> 2] | 0;
			s = z + 4 | 0;
			c[r >> 2] = s;
			c[z >> 2] = L;
			O = s
		} else O = z;
		h[j >> 3] = +Wo(I, c[p >> 2] | 0, g);
		Tk(n, q, O, g);
		if (G) {
			O = c[G + 12 >> 2] | 0;
			if ((O | 0) == (c[G + 16 >> 2] | 0)) P = xb[c[(c[G >> 2] | 0) + 36 >> 2] & 63](G) | 0;
			else P = c[O >> 2] | 0;
			if ((P | 0) == -1) {
				c[d >> 2] = 0;
				Q = 1
			} else Q = 0
		} else Q = 1;
		do
			if (H) {
				P = c[H + 12 >> 2] | 0;
				if ((P | 0) == (c[H + 16 >> 2] | 0)) R = xb[c[(c[H >> 2] | 0) + 36 >> 2] & 63](H) | 0;
				else R = c[P >> 2] | 0;
				if ((R | 0) != -1)
					if (Q) break;
					else {
						J = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					J = 44;
					break
				}
			} else J = 44; while (0);
		if ((J | 0) == 44 ? Q : 0) J = 46;
		if ((J | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(o);
		Of(n);
		i = b;
		return g | 0
	}

	function Nn(b, d, e, f, g, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0;
		b = i;
		i = i + 352 | 0;
		k = b + 208 | 0;
		l = b + 184 | 0;
		m = b + 4 | 0;
		n = b + 8 | 0;
		o = b + 196 | 0;
		p = b;
		q = b + 24 | 0;
		r = b + 192 | 0;
		s = b + 188 | 0;
		t = b + 337 | 0;
		u = b + 336 | 0;
		ni(n, f, k, l, m);
		c[o >> 2] = 0;
		c[o + 4 >> 2] = 0;
		c[o + 8 >> 2] = 0;
		if (!(a[o >> 0] & 1)) v = 10;
		else v = (c[o >> 2] & -2) + -1 | 0;
		Sf(o, v, 0);
		v = o + 8 | 0;
		f = o + 1 | 0;
		w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
		c[p >> 2] = w;
		c[r >> 2] = q;
		c[s >> 2] = 0;
		a[t >> 0] = 1;
		a[u >> 0] = 69;
		x = o + 4 | 0;
		y = c[l >> 2] | 0;
		l = c[m >> 2] | 0;
		m = c[d >> 2] | 0;
		z = w;
		a: while (1) {
			if (m) {
				w = c[m + 12 >> 2] | 0;
				if ((w | 0) == (c[m + 16 >> 2] | 0)) A = xb[c[(c[m >> 2] | 0) + 36 >> 2] & 63](m) | 0;
				else A = c[w >> 2] | 0;
				if ((A | 0) == -1) {
					c[d >> 2] = 0;
					B = 0;
					C = 1
				} else {
					B = m;
					C = 0
				}
			} else {
				B = 0;
				C = 1
			}
			w = c[e >> 2] | 0;
			do
				if (w) {
					D = c[w + 12 >> 2] | 0;
					if ((D | 0) == (c[w + 16 >> 2] | 0)) E = xb[c[(c[w >> 2] | 0) + 36 >> 2] & 63](w) | 0;
					else E = c[D >> 2] | 0;
					if ((E | 0) != -1)
						if (C) {
							F = w;
							break
						} else {
							G = B;
							H = w;
							I = z;
							break a
						}
					else {
						c[e >> 2] = 0;
						J = 16;
						break
					}
				} else J = 16; while (0);
			if ((J | 0) == 16) {
				J = 0;
				if (C) {
					G = B;
					H = 0;
					I = z;
					break
				} else F = 0
			}
			w = a[o >> 0] | 0;
			D = (w & 1) == 0 ? (w & 255) >>> 1 : c[x >> 2] | 0;
			if ((c[p >> 2] | 0) == (z + D | 0)) {
				Sf(o, D << 1, 0);
				if (!(a[o >> 0] & 1)) K = 10;
				else K = (c[o >> 2] & -2) + -1 | 0;
				Sf(o, K, 0);
				w = (a[o >> 0] & 1) == 0 ? f : c[v >> 2] | 0;
				c[p >> 2] = w + D;
				L = w
			} else L = z;
			w = B + 12 | 0;
			D = c[w >> 2] | 0;
			M = B + 16 | 0;
			if ((D | 0) == (c[M >> 2] | 0)) N = xb[c[(c[B >> 2] | 0) + 36 >> 2] & 63](B) | 0;
			else N = c[D >> 2] | 0;
			if (oi(N, t, u, L, p, y, l, n, q, r, s, k) | 0) {
				G = B;
				H = F;
				I = L;
				break
			}
			D = c[w >> 2] | 0;
			if ((D | 0) == (c[M >> 2] | 0)) {
				xb[c[(c[B >> 2] | 0) + 40 >> 2] & 63](B) | 0;
				m = B;
				z = L;
				continue
			} else {
				c[w >> 2] = D + 4;
				m = B;
				z = L;
				continue
			}
		}
		L = a[n >> 0] | 0;
		z = c[r >> 2] | 0;
		if (!((a[t >> 0] | 0) == 0 ? 1 : (((L & 1) == 0 ? (L & 255) >>> 1 : c[n + 4 >> 2] | 0) | 0) == 0) ? (z - q | 0) < 160 : 0) {
			L = c[s >> 2] | 0;
			s = z + 4 | 0;
			c[r >> 2] = s;
			c[z >> 2] = L;
			O = s
		} else O = z;
		h[j >> 3] = +Vo(I, c[p >> 2] | 0, g);
		Tk(n, q, O, g);
		if (G) {
			O = c[G + 12 >> 2] | 0;
			if ((O | 0) == (c[G + 16 >> 2] | 0)) P = xb[c[(c[G >> 2] | 0) + 36 >> 2] & 63](G) | 0;
			else P = c[O >> 2] | 0;
			if ((P | 0) == -1) {
				c[d >> 2] = 0;
				Q = 1
			} else Q = 0
		} else Q = 1;
		do
			if (H) {
				P = c[H + 12 >> 2] | 0;
				if ((P | 0) == (c[H + 16 >> 2] | 0)) R = xb[c[(c[H >> 2] | 0) + 36 >> 2] & 63](H) | 0;
				else R = c[P >> 2] | 0;
				if ((R | 0) != -1)
					if (Q) break;
					else {
						J = 46;
						break
					}
				else {
					c[e >> 2] = 0;
					J = 44;
					break
				}
			} else J = 44; while (0);
		if ((J | 0) == 44 ? Q : 0) J = 46;
		if ((J | 0) == 46) c[g >> 2] = c[g >> 2] | 2;
		g = c[d >> 2] | 0;
		Of(o);
		Of(n);
		i = b;
		return g | 0
	}

	function On(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		c[h >> 2] = f;
		f = Pd(d) | 0;
		d = Ge(a, b, e, h) | 0;
		if (f) Pd(f) | 0;
		i = g;
		return d | 0
	}

	function Pn(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		c[g >> 2] = e;
		e = Pd(b) | 0;
		b = De(a, d, g) | 0;
		if (e) Pd(e) | 0;
		i = f;
		return b | 0
	}

	function Qn(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0;
		j = i;
		i = i + 16 | 0;
		k = j;
		l = c[b >> 2] | 0;
		a: do
			if (!l) m = 0;
			else {
				n = f;
				o = d;
				p = n - o >> 2;
				q = g + 12 | 0;
				r = c[q >> 2] | 0;
				s = (r | 0) > (p | 0) ? r - p | 0 : 0;
				p = e;
				r = p - o | 0;
				o = r >> 2;
				if ((r | 0) > 0 ? (qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, d, o) | 0) != (o | 0) : 0) {
					c[b >> 2] = 0;
					m = 0;
					break
				}
				do
					if ((s | 0) > 0) {
						Zf(k, s, h);
						if ((qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, (a[k >> 0] & 1) == 0 ? k + 4 | 0 : c[k + 8 >> 2] | 0, s) | 0) == (s | 0)) {
							_f(k);
							break
						} else {
							c[b >> 2] = 0;
							_f(k);
							m = 0;
							break a
						}
					}
				while (0);
				s = n - p | 0;
				o = s >> 2;
				if ((s | 0) > 0 ? (qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, e, o) | 0) != (o | 0) : 0) {
					c[b >> 2] = 0;
					m = 0;
					break
				}
				c[q >> 2] = 0;
				m = l
			}
		while (0);
		i = j;
		return m | 0
	}

	function Rn(a, e, f, g, h) {
		a = a | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0;
		i = c[a >> 2] | 0;
		do
			if (i)
				if ((c[i + 12 >> 2] | 0) == (c[i + 16 >> 2] | 0))
					if ((xb[c[(c[i >> 2] | 0) + 36 >> 2] & 63](i) | 0) == -1) {
						c[a >> 2] = 0;
						j = 0;
						break
					} else {
						j = c[a >> 2] | 0;
						break
					}
		else j = i;
		else j = 0;
		while (0);
		i = (j | 0) == 0;
		j = c[e >> 2] | 0;
		do
			if (j) {
				if ((c[j + 12 >> 2] | 0) == (c[j + 16 >> 2] | 0) ? (xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0) == -1 : 0) {
					c[e >> 2] = 0;
					k = 11;
					break
				}
				if (i) {
					l = j;
					k = 13
				} else k = 12
			} else k = 11; while (0);
		if ((k | 0) == 11)
			if (i) k = 12;
			else {
				l = 0;
				k = 13
			}
		a: do
			if ((k | 0) == 12) {
				c[f >> 2] = c[f >> 2] | 6;
				m = 0
			} else
		if ((k | 0) == 13) {
			i = c[a >> 2] | 0;
			j = c[i + 12 >> 2] | 0;
			if ((j | 0) == (c[i + 16 >> 2] | 0)) n = xb[c[(c[i >> 2] | 0) + 36 >> 2] & 63](i) | 0;
			else n = d[j >> 0] | 0;
			j = n & 255;
			if (j << 24 >> 24 > -1 ? (i = g + 8 | 0, (b[(c[i >> 2] | 0) + (n << 24 >> 24 << 1) >> 1] & 2048) != 0) : 0) {
				o = (qb[c[(c[g >> 2] | 0) + 36 >> 2] & 31](g, j, 0) | 0) << 24 >> 24;
				j = c[a >> 2] | 0;
				p = j + 12 | 0;
				q = c[p >> 2] | 0;
				if ((q | 0) == (c[j + 16 >> 2] | 0)) {
					xb[c[(c[j >> 2] | 0) + 40 >> 2] & 63](j) | 0;
					r = h;
					s = l;
					t = l;
					u = o
				} else {
					c[p >> 2] = q + 1;
					r = h;
					s = l;
					t = l;
					u = o
				}
				while (1) {
					o = u + -48 | 0;
					q = r + -1 | 0;
					p = c[a >> 2] | 0;
					do
						if (p)
							if ((c[p + 12 >> 2] | 0) == (c[p + 16 >> 2] | 0))
								if ((xb[c[(c[p >> 2] | 0) + 36 >> 2] & 63](p) | 0) == -1) {
									c[a >> 2] = 0;
									v = 0;
									break
								} else {
									v = c[a >> 2] | 0;
									break
								}
					else v = p;
					else v = 0;
					while (0);
					p = (v | 0) == 0;
					if (t)
						if ((c[t + 12 >> 2] | 0) == (c[t + 16 >> 2] | 0))
							if ((xb[c[(c[t >> 2] | 0) + 36 >> 2] & 63](t) | 0) == -1) {
								c[e >> 2] = 0;
								w = 0;
								x = 0
							} else {
								w = s;
								x = s
							}
					else {
						w = s;
						x = t
					} else {
						w = s;
						x = 0
					}
					j = c[a >> 2] | 0;
					if (!((r | 0) > 1 & (p ^ (x | 0) == 0))) {
						y = j;
						z = w;
						A = o;
						break
					}
					p = c[j + 12 >> 2] | 0;
					if ((p | 0) == (c[j + 16 >> 2] | 0)) B = xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0;
					else B = d[p >> 0] | 0;
					p = B & 255;
					if (p << 24 >> 24 <= -1) {
						m = o;
						break a
					}
					if (!(b[(c[i >> 2] | 0) + (B << 24 >> 24 << 1) >> 1] & 2048)) {
						m = o;
						break a
					}
					j = ((qb[c[(c[g >> 2] | 0) + 36 >> 2] & 31](g, p, 0) | 0) << 24 >> 24) + (o * 10 | 0) | 0;
					p = c[a >> 2] | 0;
					C = p + 12 | 0;
					D = c[C >> 2] | 0;
					if ((D | 0) == (c[p + 16 >> 2] | 0)) {
						xb[c[(c[p >> 2] | 0) + 40 >> 2] & 63](p) | 0;
						r = q;
						s = w;
						t = x;
						u = j;
						continue
					} else {
						c[C >> 2] = D + 1;
						r = q;
						s = w;
						t = x;
						u = j;
						continue
					}
				}
				do
					if (y)
						if ((c[y + 12 >> 2] | 0) == (c[y + 16 >> 2] | 0))
							if ((xb[c[(c[y >> 2] | 0) + 36 >> 2] & 63](y) | 0) == -1) {
								c[a >> 2] = 0;
								E = 0;
								break
							} else {
								E = c[a >> 2] | 0;
								break
							}
				else E = y;
				else E = 0;
				while (0);
				i = (E | 0) == 0;
				do
					if (z) {
						if ((c[z + 12 >> 2] | 0) == (c[z + 16 >> 2] | 0) ? (xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0) == -1 : 0) {
							c[e >> 2] = 0;
							k = 50;
							break
						}
						if (i) {
							m = A;
							break a
						}
					} else k = 50; while (0);
				if ((k | 0) == 50 ? !i : 0) {
					m = A;
					break
				}
				c[f >> 2] = c[f >> 2] | 2;
				m = A;
				break
			}
			c[f >> 2] = c[f >> 2] | 4;
			m = 0
		}
		while (0);
		return m | 0
	}

	function Gb(a) {
		a = a | 0;
		var b = 0;
		b = i;
		i = i + a | 0;
		i = i + 15 & -16;
		return b | 0
	}

	function Hb() {
		return i | 0
	}

	function Ib(a) {
		a = a | 0;
		i = a
	}

	function Jb(a, b) {
		a = a | 0;
		b = b | 0;
		i = a;
		j = b
	}

	function Kb(a, b) {
		a = a | 0;
		b = b | 0;
		if (!o) {
			o = a;
			p = b
		}
	}

	function Lb(b) {
		b = b | 0;
		a[k >> 0] = a[b >> 0];
		a[k + 1 >> 0] = a[b + 1 >> 0];
		a[k + 2 >> 0] = a[b + 2 >> 0];
		a[k + 3 >> 0] = a[b + 3 >> 0]
	}

	function Mb(b) {
		b = b | 0;
		a[k >> 0] = a[b >> 0];
		a[k + 1 >> 0] = a[b + 1 >> 0];
		a[k + 2 >> 0] = a[b + 2 >> 0];
		a[k + 3 >> 0] = a[b + 3 >> 0];
		a[k + 4 >> 0] = a[b + 4 >> 0];
		a[k + 5 >> 0] = a[b + 5 >> 0];
		a[k + 6 >> 0] = a[b + 6 >> 0];
		a[k + 7 >> 0] = a[b + 7 >> 0]
	}

	function Nb(a) {
		a = a | 0;
		D = a
	}

	function Ob() {
		return D | 0
	}

	function Pb(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0;
		d = i;
		i = i + 160 | 0;
		e = d + 144 | 0;
		f = d;
		g = f + 64 | 0;
		h = f + 8 | 0;
		c[h >> 2] = 2404;
		j = f + 12 | 0;
		c[f >> 2] = 2444;
		c[g >> 2] = 2464;
		c[f + 4 >> 2] = 0;
		ng(f + 64 | 0, j);
		c[f + 136 >> 2] = 0;
		c[f + 140 >> 2] = -1;
		c[f >> 2] = 2384;
		c[f + 64 >> 2] = 2424;
		c[h >> 2] = 2404;
		qg(j);
		c[j >> 2] = 2480;
		h = f + 44 | 0;
		c[h >> 2] = 0;
		c[h + 4 >> 2] = 0;
		c[h + 8 >> 2] = 0;
		c[h + 12 >> 2] = 0;
		c[f + 60 >> 2] = 24;
		c[e >> 2] = 0;
		c[e + 4 >> 2] = 0;
		c[e + 8 >> 2] = 0;
		Xb(j, e);
		Of(e);
		gh(f + 8 | 0, b) | 0;
		Zb(a, j);
		_b(f, 2536);
		ig(g);
		i = d;
		return
	}

	function Qb(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0.0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0.0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0;
		f = i;
		i = i + 80 | 0;
		g = f + 64 | 0;
		h = f + 48 | 0;
		j = f + 32 | 0;
		k = f + 16 | 0;
		l = f;
		if ((d | 0) > 0 & (e | 0) > 0) {
			m = 0;
			n = 0;
			o = e;
			p = 0;
			q = d;
			while (1) {
				r = $(m, e) | 0;
				s = +(m | 0);
				t = 0;
				u = n;
				v = o;
				w = p;
				x = q;
				while (1) {
					y = t + r << 2;
					z = a[b + y >> 0] | 0;
					A = a[b + (y | 1) >> 0] | 0;
					B = a[b + (y | 2) >> 0] | 0;
					y = z & 255;
					if (z << 24 >> 24 != -1) {
						z = B & 255;
						if (B << 24 >> 24 != -1 ? (B = A & 255, (B + y | 0) != (0 - z | 0)) : 0) {
							c[l >> 2] = y;
							c[l + 4 >> 2] = B;
							c[l + 8 >> 2] = z;
							ze(14228, l) | 0;
							C = u;
							D = v;
							E = w;
							F = x
						} else {
							C = u;
							D = v;
							E = w;
							F = x
						}
					} else {
						G = +(t | 0);
						z = ~~+Td(+(v | 0), G);
						B = ~~+Sd(+(u | 0), G);
						y = ~~+Td(+(x | 0), s);
						C = B;
						D = z;
						E = ~~+Sd(+(w | 0), s);
						F = y
					}
					t = t + 1 | 0;
					if ((t | 0) == (e | 0)) {
						H = C;
						I = D;
						J = E;
						K = F;
						break
					} else {
						u = C;
						v = D;
						w = E;
						x = F
					}
				}
				m = m + 1 | 0;
				if ((m | 0) == (d | 0)) {
					L = H;
					M = I;
					N = J;
					O = K;
					break
				} else {
					n = H;
					o = I;
					p = J;
					q = K
				}
			}
		} else {
			L = 0;
			M = e;
			N = 0;
			O = d
		}
		K = (L - M | 0) / 4 | 0;
		q = ~~+Td(+(e + -1 | 0), +(K + L | 0));
		L = (N - O | 0) / 4 | 0;
		J = ~~+Td(+(d + -1 | 0), +(L + N | 0));
		N = ~~+Sd(0.0, +(M - K | 0));
		K = ~~+Sd(0.0, +(O - L | 0));
		if ((N | 0) <= (q | 0)) {
			L = $(K, e) | 0;
			O = $(J, e) | 0;
			M = N;
			while (1) {
				d = M + L | 0;
				p = d << 2;
				I = a[b + p >> 0] | 0;
				o = a[b + (p | 1) >> 0] | 0;
				H = a[b + (p | 2) >> 0] | 0;
				p = I & 255;
				if (I << 24 >> 24 != -1 ? (I = H & 255, H << 24 >> 24 != -1) : 0) {
					H = o & 255;
					if ((H + p | 0) != (0 - I | 0)) {
						c[k >> 2] = p;
						c[k + 4 >> 2] = H;
						c[k + 8 >> 2] = I;
						ze(14228, k) | 0
					}
					I = d << 4;
					a[b + I >> 0] = 0;
					a[b + (I | 1) >> 0] = 0;
					a[b + (I | 2) >> 0] = -1;
					a[b + (I | 3) >> 0] = -1
				}
				I = M + O | 0;
				d = I << 2;
				H = a[b + d >> 0] | 0;
				p = a[b + (d | 1) >> 0] | 0;
				o = a[b + (d | 2) >> 0] | 0;
				d = H & 255;
				if (H << 24 >> 24 != -1 ? (H = o & 255, o << 24 >> 24 != -1) : 0) {
					o = p & 255;
					if ((o + d | 0) != (0 - H | 0)) {
						c[j >> 2] = d;
						c[j + 4 >> 2] = o;
						c[j + 8 >> 2] = H;
						ze(14228, j) | 0
					}
					H = I << 4;
					a[b + H >> 0] = 0;
					a[b + (H | 1) >> 0] = 0;
					a[b + (H | 2) >> 0] = -1;
					a[b + (H | 3) >> 0] = -1
				}
				if ((M | 0) < (q | 0)) M = M + 1 | 0;
				else break
			}
		}
		if ((K | 0) > (J | 0)) {
			i = f;
			return
		} else P = K;
		while (1) {
			K = $(P, e) | 0;
			M = K + N | 0;
			j = M << 2;
			O = a[b + j >> 0] | 0;
			k = a[b + (j | 1) >> 0] | 0;
			L = a[b + (j | 2) >> 0] | 0;
			j = O & 255;
			if (O << 24 >> 24 != -1 ? (O = L & 255, L << 24 >> 24 != -1) : 0) {
				L = k & 255;
				if ((L + j | 0) != (0 - O | 0)) {
					c[h >> 2] = j;
					c[h + 4 >> 2] = L;
					c[h + 8 >> 2] = O;
					ze(14228, h) | 0
				}
				O = M << 4;
				a[b + O >> 0] = 0;
				a[b + (O | 1) >> 0] = 0;
				a[b + (O | 2) >> 0] = -1;
				a[b + (O | 3) >> 0] = -1
			}
			O = K + q | 0;
			K = O << 2;
			M = a[b + K >> 0] | 0;
			L = a[b + (K | 1) >> 0] | 0;
			j = a[b + (K | 2) >> 0] | 0;
			K = M & 255;
			if (M << 24 >> 24 != -1 ? (M = j & 255, j << 24 >> 24 != -1) : 0) {
				j = L & 255;
				if ((j + K | 0) != (0 - M | 0)) {
					c[g >> 2] = K;
					c[g + 4 >> 2] = j;
					c[g + 8 >> 2] = M;
					ze(14228, g) | 0
				}
				M = O << 4;
				a[b + M >> 0] = 0;
				a[b + (M | 1) >> 0] = 0;
				a[b + (M | 2) >> 0] = -1;
				a[b + (M | 3) >> 0] = -1
			}
			if ((P | 0) < (J | 0)) P = P + 1 | 0;
			else break
		}
		i = f;
		return
	}

	function Rb(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		h = i;
		i = i + 16 | 0;
		j = h + 12 | 0;
		k = h;
		l = $b(7260, 14255, 5) | 0;
		c[j >> 2] = mg(l + (c[(c[l >> 2] | 0) + -12 >> 2] | 0) | 0) | 0;
		m = Gl(j, 9868) | 0;
		n = Db[c[(c[m >> 2] | 0) + 28 >> 2] & 31](m, 10) | 0;
		El(j);
		hh(l, n) | 0;
		Wg(l) | 0;
		Qb(d, e, f);
		l = $b(7260, 14261, 16) | 0;
		c[j >> 2] = mg(l + (c[(c[l >> 2] | 0) + -12 >> 2] | 0) | 0) | 0;
		n = Gl(j, 9868) | 0;
		m = Db[c[(c[n >> 2] | 0) + 28 >> 2] & 31](n, 10) | 0;
		El(j);
		hh(l, m) | 0;
		Wg(l) | 0;
		l = Sb(b, d, e, f) | 0;
		d = qc(l, 0, 0) | 0;
		m = gh(7260, d) | 0;
		c[j >> 2] = mg(m + (c[(c[m >> 2] | 0) + -12 >> 2] | 0) | 0) | 0;
		n = Gl(j, 9868) | 0;
		o = Db[c[(c[n >> 2] | 0) + 28 >> 2] & 31](n, 10) | 0;
		El(j);
		hh(m, o) | 0;
		Wg(m) | 0;
		Tb(l, b, e, f, g);
		if (!l) {
			Pb(k, d);
			p = a[k >> 0] | 0;
			q = p & 1;
			r = q << 24 >> 24 == 0;
			s = k + 4 | 0;
			t = c[s >> 2] | 0;
			u = p & 255;
			v = u >>> 1;
			w = r ? v : t;
			x = w + 1 | 0;
			y = Ec(x) | 0;
			z = k + 8 | 0;
			A = c[z >> 2] | 0;
			B = k + 1 | 0;
			C = r ? B : A;
			Oe(y, C) | 0;
			Of(k);
			i = h;
			return y | 0
		}
		wc(l);
		Fc(l);
		Pb(k, d);
		p = a[k >> 0] | 0;
		q = p & 1;
		r = q << 24 >> 24 == 0;
		s = k + 4 | 0;
		t = c[s >> 2] | 0;
		u = p & 255;
		v = u >>> 1;
		w = r ? v : t;
		x = w + 1 | 0;
		y = Ec(x) | 0;
		z = k + 8 | 0;
		A = c[z >> 2] | 0;
		B = k + 1 | 0;
		C = r ? B : A;
		Oe(y, C) | 0;
		Of(k);
		i = h;
		return y | 0
	}

	function Sb(b, e, f, g) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0.0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0.0,
			M = 0.0,
			N = 0.0,
			O = 0,
			P = 0;
		h = i;
		i = i + 32 | 0;
		j = h + 12 | 0;
		k = h;
		l = Dc(76) | 0;
		m = $(g, f) | 0;
		vc(l, m, $(f << 3, g) | 0, 0);
		if ((m | 0) <= 0) Da(14278, 14286, 362, 14296);
		n = l + 4 | 0;
		o = c[n >> 2] | 0;
		if ((o + (m * 28 | 0) | 0) >>> 0 > (c[l + 8 >> 2] | 0) >>> 0) {
			xc(l, m);
			p = c[n >> 2] | 0
		} else p = o;
		if ((m | 0) == 1) {
			c[p >> 2] = 0;
			c[p + 24 >> 2] = 0;
			o = p + 20 | 0;
			a[o >> 0] = a[o >> 0] & -3;
			o = (c[n >> 2] | 0) + 20 | 0;
			a[o >> 0] = a[o >> 0] & -5;
			c[n >> 2] = (c[n >> 2] | 0) + 28;
			o = l + 24 | 0;
			c[o >> 2] = (c[o >> 2] | 0) + 1
		} else {
			ip(p | 0, 0, m * 28 | 0) | 0;
			p = l + 24 | 0;
			c[p >> 2] = (c[p >> 2] | 0) + m;
			c[n >> 2] = (c[n >> 2] | 0) + (m * 28 | 0)
		}
		m = Ub(b, e, f, g) | 0;
		q = +Vb(b, f, g);
		c[j >> 2] = 0;
		n = j + 4 | 0;
		c[n >> 2] = 0;
		c[j + 8 >> 2] = 0;
		p = Dc(8) | 0;
		c[j >> 2] = p;
		o = p + 8 | 0;
		c[j + 8 >> 2] = o;
		r = p;
		c[r >> 2] = 0;
		c[r + 4 >> 2] = 0;
		c[n >> 2] = o;
		do
			if ((f | 0) > 0) {
				o = (g | 0) > 0;
				r = k + 4 | 0;
				s = l + 24 | 0;
				t = l + 36 | 0;
				u = g + -1 | 0;
				v = f + -1 | 0;
				w = 0;
				a: while (1) {
					if (o) {
						x = $(w, g) | 0;
						y = x + 1 | 0;
						z = (w | 0) < (v | 0);
						A = w + 1 | 0;
						B = $(A, g) | 0;
						C = 0;
						while (1) {
							Wb(k, b, e, m, f, g, w, C);
							D = c[k >> 2] | 0;
							E = c[r >> 2] | 0;
							ac(j, D, E);
							F = D;
							if (D) {
								if ((E | 0) != (D | 0)) c[r >> 2] = E + (~((E + -4 - F | 0) >>> 2) << 2);
								Fc(D)
							}
							D = C + x | 0;
							F = c[j >> 2] | 0;
							if ((D | 0) <= -1) {
								G = 19;
								break a
							}
							if ((c[s >> 2] | 0) <= (D | 0)) {
								G = 19;
								break a
							}
							E = (c[l >> 2] | 0) + (D * 28 | 0) + 24 | 0;
							H = c[E >> 2] | 0;
							I = (H | 0) > 0;
							J = (c[F + 4 >> 2] | 0) - (I ? 0 : H) | 0;
							K = (I ? H : 0) + (c[F >> 2] | 0) | 0;
							c[t >> 2] = ((K | 0) < (J | 0) ? K : J) + (c[t >> 2] | 0);
							c[E >> 2] = K - J;
							if ((C | 0) < (u | 0)) {
								J = D << 2;
								K = y + C << 2;
								L = +((d[b + J >> 0] | 0) - (d[b + K >> 0] | 0) | 0);
								M = +((d[b + (J | 1) >> 0] | 0) - (d[b + (K | 1) >> 0] | 0) | 0);
								N = +((d[b + (J | 2) >> 0] | 0) - (d[b + (K | 2) >> 0] | 0) | 0);
								K = ~~(+Y(+ -(q * +(~~(M * M) + ~~(L * L) + ~~(N * N) | 0))) * 5.0e3);
								bc(l, D, D + 1 | 0, K, K)
							}
							if (z) {
								K = D << 2;
								J = C + B << 2;
								N = +((d[b + K >> 0] | 0) - (d[b + J >> 0] | 0) | 0);
								L = +((d[b + (K | 1) >> 0] | 0) - (d[b + (J | 1) >> 0] | 0) | 0);
								M = +((d[b + (K | 2) >> 0] | 0) - (d[b + (J | 2) >> 0] | 0) | 0);
								J = ~~(+Y(+ -(q * +(~~(L * L) + ~~(N * N) + ~~(M * M) | 0))) * 5.0e3);
								bc(l, D, D + g | 0, J, J)
							}
							C = C + 1 | 0;
							if ((C | 0) >= (g | 0)) {
								O = A;
								break
							}
						}
					} else O = w + 1 | 0;
					if ((O | 0) < (f | 0)) w = O;
					else {
						G = 26;
						break
					}
				}
				if ((G | 0) == 19) Da(14305, 14286, 390, 14328);
				else if ((G | 0) == 26) {
					P = c[j >> 2] | 0;
					break
				}
			} else P = p; while (0);
		if (!P) {
			i = h;
			return l | 0
		}
		p = c[n >> 2] | 0;
		if ((p | 0) != (P | 0)) c[n >> 2] = p + (~((p + -4 - P | 0) >>> 2) << 2);
		Fc(P);
		i = h;
		return l | 0
	}

	function Tb(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		c[550] = 0;
		c[551] = 153;
		c[552] = 0;
		c[553] = 0;
		c[554] = 255;
		c[555] = 0;
		c[556] = 255;
		c[558] = 0;
		c[559] = 255;
		c[560] = 255;
		c[561] = 0;
		c[562] = 255;
		c[563] = 204;
		c[564] = 0;
		c[565] = 255;
		c[566] = 153;
		c[567] = 153;
		c[568] = 204;
		c[569] = 0;
		c[570] = 51;
		c[571] = 255;
		c[572] = 51;
		c[573] = 204;
		c[574] = 153;
		c[575] = 51;
		c[576] = 1;
		c[577] = 153;
		c[578] = 0;
		c[579] = 153;
		c[580] = 0;
		c[581] = 0;
		c[582] = 153;
		c[583] = 0;
		c[584] = 255;
		c[585] = 152;
		c[586] = 0;
		c[587] = 204;
		c[588] = 255;
		c[589] = 153;
		c[590] = 153;
		c[591] = 0;
		if ((e | 0) <= 0) return;
		h = (f | 0) > 0;
		i = 2200 + (g * 12 | 0) | 0;
		j = 2200 + (g * 12 | 0) + 4 | 0;
		k = 2200 + (g * 12 | 0) + 8 | 0;
		g = 0;
		do {
			if (h) {
				l = $(g, f) | 0;
				m = 0;
				do {
					n = m + l | 0;
					o = c[b >> 2] | 0;
					if ((c[o + (n * 28 | 0) + 4 >> 2] | 0) != 0 ? (a[o + (n * 28 | 0) + 20 >> 0] & 1) != 0 : 0) {
						o = n << 2;
						a[d + o >> 0] = 0;
						a[d + (o | 1) >> 0] = 0;
						a[d + (o | 2) >> 0] = 0;
						a[d + (o | 3) >> 0] = 0
					} else {
						o = n << 2;
						a[d + o >> 0] = c[i >> 2];
						a[d + (o | 1) >> 0] = c[j >> 2];
						a[d + (o | 2) >> 0] = c[k >> 2];
						a[d + (o | 3) >> 0] = -103
					}
					m = m + 1 | 0
				} while ((m | 0) != (f | 0))
			}
			g = g + 1 | 0
		} while ((g | 0) != (e | 0));
		return
	}

	function Ub(b, e, f, h) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0.0,
			Q = 0.0,
			R = 0.0,
			S = 0.0,
			T = 0.0,
			U = 0.0;
		j = i;
		i = i + 16 | 0;
		k = j;
		l = c[592] | 0;
		m = i;
		i = i + ((1 * (l << 2) | 0) + 15 & -16) | 0;
		n = i;
		i = i + ((1 * (l << 2) | 0) + 15 & -16) | 0;
		if ((f | 0) > 0) {
			o = (h | 0) > 0;
			p = l;
			q = 0;
			r = 0;
			s = 0;
			while (1) {
				a: do
					if (o) {
						t = $(s, h) | 0;
						u = p;
						v = q;
						w = r;
						x = 0;
						while (1) {
							y = x + t << 2;
							z = a[e + y >> 0] | 0;
							A = y | 1;
							B = a[e + A >> 0] | 0;
							C = y | 2;
							D = a[e + C >> 0] | 0;
							E = z & 255;
							if (z << 24 >> 24 != -1) {
								z = D & 255;
								if (D << 24 >> 24 != -1) {
									D = B & 255;
									if ((D + E | 0) == (0 - z | 0)) {
										F = -1;
										G = u
									} else {
										c[k >> 2] = E;
										c[k + 4 >> 2] = D;
										c[k + 8 >> 2] = z;
										ze(14228, k) | 0;
										F = -1;
										G = c[592] | 0
									}
								} else {
									F = 1;
									G = u
								}
							} else {
								F = 0;
								G = u
							}
							z = ~~(+((d[b + A >> 0] | 0) + (d[b + y >> 0] | 0) + (d[b + C >> 0] | 0) | 0) / 3.0 * +(G | 0) * .00390625);
							switch (F | 0) {
								case 0:
									{
										C = m + (z << 2) | 0;g[C >> 2] = +g[C >> 2] + 1.0;H = v;I = w + 1 | 0;
										break
									}
								case 1:
									{
										C = n + (z << 2) | 0;g[C >> 2] = +g[C >> 2] + 1.0;H = v + 1 | 0;I = w;
										break
									}
								default:
									{
										H = v;I = w
									}
							}
							x = x + 1 | 0;
							if ((x | 0) == (h | 0)) {
								J = G;
								K = H;
								L = I;
								break a
							} else {
								u = G;
								v = H;
								w = I
							}
						}
					} else {
						J = p;
						K = q;
						L = r
					}while (0);s = s + 1 | 0;
				if ((s | 0) == (f | 0)) {
					M = J;
					N = K;
					O = L;
					break
				} else {
					p = J;
					q = K;
					r = L
				}
			}
		} else {
			M = l;
			N = 0;
			O = 0
		}
		l = i;
		i = i + ((1 * (M << 2) | 0) + 15 & -16) | 0;
		if ((M | 0) <= 0) {
			i = j;
			return l | 0
		}
		P = +(O | 0);
		Q = +(N | 0);
		N = 0;
		do {
			R = +g[m + (N << 2) >> 2];
			S = +g[n + (N << 2) >> 2];
			if ((~~(R + S) | 0) > 0) {
				T = R == 0.0 ? 0.0 : R / P;
				U = T / (T + (S == 0.0 ? 0.0 : S / Q))
			} else U = .5;
			g[l + (N << 2) >> 2] = U;
			N = N + 1 | 0
		} while ((N | 0) < (M | 0));
		i = j;
		return l | 0
	}

	function Vb(b, c, e) {
		b = b | 0;
		c = c | 0;
		e = e | 0;
		var f = 0,
			g = 0.0,
			h = 0.0,
			i = 0.0,
			j = 0.0,
			k = 0.0,
			l = 0.0,
			m = 0.0,
			n = 0.0,
			o = 0.0,
			p = 0.0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0.0,
			G = 0.0,
			H = 0.0,
			I = 0,
			J = 0,
			K = 0,
			L = 0;
		if ((c | 0) <= 0) {
			f = 0;
			g = +(c | 0);
			h = g * 2.0;
			i = +(e | 0);
			j = h * i;
			k = j - g;
			l = k - i;
			m = +(f | 0);
			n = m * 2.0;
			o = l / n;
			p = o;
			return +p
		}
		q = (e | 0) > 0;
		r = e + -1 | 0;
		s = c + -1 | 0;
		t = 0;
		u = 0;
		while (1) {
			if (q) {
				v = $(t, e) | 0;
				w = v + 1 | 0;
				x = t + 1 | 0;
				y = $(x, e) | 0;
				if ((t | 0) < (s | 0)) {
					z = 0;
					A = u;
					while (1) {
						B = z + v << 2;
						C = a[b + B >> 0] | 0;
						D = d[b + (B | 2) >> 0] | 0;
						E = d[b + (B | 1) >> 0] | 0;
						if ((z | 0) < (r | 0)) {
							B = w + z << 2;
							F = +((C & 255) - (d[b + B >> 0] | 0) | 0);
							G = +(E - (d[b + (B | 1) >> 0] | 0) | 0);
							H = +(D - (d[b + (B | 2) >> 0] | 0) | 0);
							I = ~~(F * F) + A + ~~(G * G) + ~~(H * H) | 0
						} else I = A;
						B = z + y << 2;
						H = +((C & 255) - (d[b + B >> 0] | 0) | 0);
						G = +(E - (d[b + (B | 1) >> 0] | 0) | 0);
						F = +(D - (d[b + (B | 2) >> 0] | 0) | 0);
						B = ~~(H * H) + I + ~~(G * G) + ~~(F * F) | 0;
						z = z + 1 | 0;
						if ((z | 0) == (e | 0)) {
							J = x;
							K = B;
							break
						} else A = B
					}
				} else {
					A = 0;
					z = u;
					while (1) {
						y = A + v << 2;
						if ((A | 0) < (r | 0)) {
							B = w + A << 2;
							F = +((d[b + y >> 0] | 0) - (d[b + B >> 0] | 0) | 0);
							G = +((d[b + (y | 1) >> 0] | 0) - (d[b + (B | 1) >> 0] | 0) | 0);
							H = +((d[b + (y | 2) >> 0] | 0) - (d[b + (B | 2) >> 0] | 0) | 0);
							L = ~~(F * F) + z + ~~(G * G) + ~~(H * H) | 0
						} else L = z;
						A = A + 1 | 0;
						if ((A | 0) == (e | 0)) {
							J = x;
							K = L;
							break
						} else z = L
					}
				}
			} else {
				J = t + 1 | 0;
				K = u
			}
			if ((J | 0) == (c | 0)) {
				f = K;
				break
			} else {
				t = J;
				u = K
			}
		}
		g = +(c | 0);
		h = g * 2.0;
		i = +(e | 0);
		j = h * i;
		k = j - g;
		l = k - i;
		m = +(f | 0);
		n = m * 2.0;
		o = l / n;
		p = o;
		return +p
	}

	function Wb(b, e, f, h, j, k, l, m) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		h = h | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		m = m | 0;
		var n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0.0,
			t = 0.0;
		j = i;
		i = i + 16 | 0;
		n = j;
		o = ($(l, k) | 0) + m << 2;
		m = a[f + o >> 0] | 0;
		k = o | 1;
		l = a[f + k >> 0] | 0;
		p = o | 2;
		q = a[f + p >> 0] | 0;
		f = m & 255;
		if (m << 24 >> 24 != -1) {
			m = q & 255;
			if (q << 24 >> 24 != -1) {
				q = l & 255;
				if ((q + f | 0) == (0 - m | 0)) r = -1;
				else {
					c[n >> 2] = f;
					c[n + 4 >> 2] = q;
					c[n + 8 >> 2] = m;
					ze(14228, n) | 0;
					r = -1
				}
			} else r = 1
		} else r = 0;
		c[b >> 2] = 0;
		n = b + 4 | 0;
		c[n >> 2] = 0;
		c[b + 8 >> 2] = 0;
		m = Dc(8) | 0;
		c[b >> 2] = m;
		q = m + 8 | 0;
		c[b + 8 >> 2] = q;
		b = m;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[n >> 2] = q;
		switch (r | 0) {
			case 0:
				{
					c[m >> 2] = 1e7;c[m + 4 >> 2] = 0;i = j;
					return
				}
			case 1:
				{
					c[m >> 2] = 0;c[m + 4 >> 2] = 1e7;i = j;
					return
				}
			default:
				{
					s = +g[h + (~~(+((d[e + k >> 0] | 0) + (d[e + o >> 0] | 0) + (d[e + p >> 0] | 0) | 0) / 3.0 * +(c[592] | 0) * .00390625) << 2) >> 2];
					if (s > 0.0 & s < 1.0) {
						t = s;
						c[m >> 2] = ~~- +Z(+t);
						c[m + 4 >> 2] = ~~- +Z(+(1.0 - t));
						i = j;
						return
					} else {
						c[m >> 2] = ~~(s * 1.0e7);
						c[m + 4 >> 2] = ~~((1.0 - s) * 1.0e7);
						i = j;
						return
					}
				}
		}
	}

	function Xb(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		e = b + 32 | 0;
		Pf(e, d) | 0;
		d = b + 44 | 0;
		c[d >> 2] = 0;
		f = b + 48 | 0;
		g = c[f >> 2] | 0;
		if (g & 8) {
			h = a[e >> 0] | 0;
			if (!(h & 1)) {
				i = ((h & 255) >>> 1) + (e + 1) | 0;
				c[d >> 2] = i;
				j = i;
				k = e + 1 | 0;
				l = e + 1 | 0
			} else {
				i = (c[b + 40 >> 2] | 0) + (c[b + 36 >> 2] | 0) | 0;
				c[d >> 2] = i;
				h = c[b + 40 >> 2] | 0;
				j = i;
				k = h;
				l = h
			}
			c[b + 8 >> 2] = k;
			c[b + 12 >> 2] = l;
			c[b + 16 >> 2] = j
		}
		if (!(g & 16)) return;
		g = a[e >> 0] | 0;
		if (!(g & 1)) {
			j = (g & 255) >>> 1;
			c[d >> 2] = e + 1 + j;
			m = 10;
			n = j
		} else {
			j = c[b + 36 >> 2] | 0;
			c[d >> 2] = (c[b + 40 >> 2] | 0) + j;
			m = (c[e >> 2] & -2) + -1 | 0;
			n = j
		}
		Sf(e, m, 0);
		m = a[e >> 0] | 0;
		if (!(m & 1)) {
			o = e + 1 | 0;
			p = (m & 255) >>> 1;
			q = e + 1 | 0
		} else {
			e = c[b + 40 >> 2] | 0;
			o = e;
			p = c[b + 36 >> 2] | 0;
			q = e
		}
		e = b + 24 | 0;
		c[e >> 2] = q;
		c[b + 20 >> 2] = q;
		c[b + 28 >> 2] = o + p;
		if (!(c[f >> 2] & 3)) return;
		c[e >> 2] = q + n;
		return
	}

	function Yb(a) {
		a = a | 0;
		Ma(a | 0) | 0;
		Mc()
	}

	function Zb(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		e = c[d + 48 >> 2] | 0;
		if (e & 16) {
			f = d + 44 | 0;
			g = c[f >> 2] | 0;
			h = c[d + 24 >> 2] | 0;
			if (g >>> 0 < h >>> 0) {
				c[f >> 2] = h;
				i = h
			} else i = g;
			g = c[d + 20 >> 2] | 0;
			h = i - g | 0;
			if (h >>> 0 > 4294967279) Ac(b);
			if (h >>> 0 < 11) {
				a[b >> 0] = h << 1;
				j = b + 1 | 0
			} else {
				f = h + 16 & -16;
				k = Dc(f) | 0;
				c[b + 8 >> 2] = k;
				c[b >> 2] = f | 1;
				c[b + 4 >> 2] = h;
				j = k
			}
			if ((g | 0) == (i | 0)) l = j;
			else {
				k = g;
				g = j;
				while (1) {
					a[g >> 0] = a[k >> 0] | 0;
					k = k + 1 | 0;
					if ((k | 0) == (i | 0)) break;
					else g = g + 1 | 0
				}
				l = j + h | 0
			}
			a[l >> 0] = 0;
			return
		}
		if (!(e & 8)) {
			c[b >> 2] = 0;
			c[b + 4 >> 2] = 0;
			c[b + 8 >> 2] = 0;
			return
		}
		e = c[d + 8 >> 2] | 0;
		l = c[d + 16 >> 2] | 0;
		d = l - e | 0;
		if (d >>> 0 > 4294967279) Ac(b);
		if (d >>> 0 < 11) {
			a[b >> 0] = d << 1;
			m = b + 1 | 0
		} else {
			h = d + 16 & -16;
			j = Dc(h) | 0;
			c[b + 8 >> 2] = j;
			c[b >> 2] = h | 1;
			c[b + 4 >> 2] = d;
			m = j
		}
		if ((e | 0) == (l | 0)) n = m;
		else {
			j = e;
			e = m;
			while (1) {
				a[e >> 0] = a[j >> 0] | 0;
				j = j + 1 | 0;
				if ((j | 0) == (l | 0)) break;
				else e = e + 1 | 0
			}
			n = m + d | 0
		}
		a[n >> 0] = 0;
		return
	}

	function _b(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		d = c[b >> 2] | 0;
		c[a >> 2] = d;
		c[a + (c[d + -12 >> 2] | 0) >> 2] = c[b + 32 >> 2];
		c[a + 8 >> 2] = c[b + 36 >> 2];
		b = a + 12 | 0;
		c[b >> 2] = 2480;
		Of(a + 44 | 0);
		og(b);
		return
	}

	function $b(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		f = i;
		i = i + 32 | 0;
		g = f + 16 | 0;
		h = f + 8 | 0;
		j = f;
		eh(h, b);
		if (!(a[h >> 0] | 0)) {
			fh(h);
			i = f;
			return b | 0
		}
		k = c[(c[b >> 2] | 0) + -12 >> 2] | 0;
		c[j >> 2] = c[b + (k + 24) >> 2];
		l = b + k | 0;
		m = c[b + (k + 4) >> 2] | 0;
		n = d + e | 0;
		e = b + (k + 76) | 0;
		k = c[e >> 2] | 0;
		if ((k | 0) == -1) {
			c[g >> 2] = mg(l) | 0;
			o = Gl(g, 9868) | 0;
			p = Db[c[(c[o >> 2] | 0) + 28 >> 2] & 31](o, 32) | 0;
			El(g);
			o = p << 24 >> 24;
			c[e >> 2] = o;
			q = o
		} else q = k;
		c[g >> 2] = c[j >> 2];
		if (cc(g, d, (m & 176 | 0) == 32 ? n : d, n, l, q & 255) | 0) {
			fh(h);
			i = f;
			return b | 0
		}
		q = c[(c[b >> 2] | 0) + -12 >> 2] | 0;
		hg(b + q | 0, c[b + (q + 16) >> 2] | 5);
		fh(h);
		i = f;
		return b | 0
	}

	function ac(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		e = b;
		f = d - e >> 2;
		g = a + 8 | 0;
		h = c[g >> 2] | 0;
		i = c[a >> 2] | 0;
		j = i;
		if (f >>> 0 <= h - j >> 2 >>> 0) {
			k = a + 4 | 0;
			l = (c[k >> 2] | 0) - j >> 2;
			m = f >>> 0 > l >>> 0;
			n = m ? b + (l << 2) | 0 : d;
			l = n;
			o = l - e | 0;
			np(i | 0, b | 0, o | 0) | 0;
			p = i + (o >> 2 << 2) | 0;
			if (!m) {
				m = c[k >> 2] | 0;
				if ((m | 0) == (p | 0)) return;
				c[k >> 2] = m + (~((m + -4 - p | 0) >>> 2) << 2);
				return
			}
			if ((n | 0) == (d | 0)) return;
			p = c[k >> 2] | 0;
			m = (d + -4 - l | 0) >>> 2;
			l = n;
			n = p;
			while (1) {
				c[n >> 2] = c[l >> 2];
				l = l + 4 | 0;
				if ((l | 0) == (d | 0)) break;
				else n = n + 4 | 0
			}
			c[k >> 2] = p + (m + 1 << 2);
			return
		}
		if (!i) q = h;
		else {
			h = a + 4 | 0;
			m = c[h >> 2] | 0;
			if ((m | 0) != (i | 0)) c[h >> 2] = m + (~((m + -4 - j | 0) >>> 2) << 2);
			Fc(i);
			c[g >> 2] = 0;
			c[h >> 2] = 0;
			c[a >> 2] = 0;
			q = 0
		}
		if (f >>> 0 > 1073741823) Bc(a);
		h = q - 0 | 0;
		if (h >> 2 >>> 0 < 536870911) {
			q = h >> 1;
			h = q >>> 0 < f >>> 0 ? f : q;
			if (h >>> 0 > 1073741823) Bc(a);
			else r = h
		} else r = 1073741823;
		h = Dc(r << 2) | 0;
		q = a + 4 | 0;
		c[q >> 2] = h;
		c[a >> 2] = h;
		c[g >> 2] = h + (r << 2);
		if ((b | 0) == (d | 0)) return;
		r = (d + -4 - e | 0) >>> 2;
		e = b;
		b = h;
		while (1) {
			c[b >> 2] = c[e >> 2];
			e = e + 4 | 0;
			if ((e | 0) == (d | 0)) break;
			else b = b + 4 | 0
		}
		c[q >> 2] = h + (r + 1 << 2);
		return
	}

	function bc(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0;
		if ((b | 0) <= -1) Da(14341, 14286, 402, 14366);
		g = c[a + 24 >> 2] | 0;
		if ((g | 0) <= (b | 0)) Da(14341, 14286, 402, 14366);
		if (!((d | 0) > -1 & (g | 0) > (d | 0))) Da(14375, 14286, 403, 14366);
		if ((b | 0) == (d | 0)) Da(14400, 14286, 404, 14366);
		if ((e | 0) <= -1) Da(14409, 14286, 405, 14366);
		if ((f | 0) <= -1) Da(14418, 14286, 406, 14366);
		g = a + 16 | 0;
		h = c[g >> 2] | 0;
		if ((h | 0) == (c[a + 20 >> 2] | 0)) {
			yc(a);
			i = c[g >> 2] | 0
		} else i = h;
		h = i + 16 | 0;
		c[g >> 2] = i + 32;
		g = c[a >> 2] | 0;
		a = g + (b * 28 | 0) | 0;
		b = g + (d * 28 | 0) | 0;
		c[i + 8 >> 2] = h;
		c[i + 24 >> 2] = i;
		c[i + 4 >> 2] = c[a >> 2];
		c[a >> 2] = i;
		c[i + 20 >> 2] = c[b >> 2];
		c[b >> 2] = h;
		c[i >> 2] = b;
		c[h >> 2] = a;
		c[i + 12 >> 2] = e;
		c[i + 28 >> 2] = f;
		return
	}

	function cc(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		j = i;
		i = i + 16 | 0;
		k = j;
		l = c[b >> 2] | 0;
		if (!l) {
			m = 0;
			i = j;
			return m | 0
		}
		n = f;
		f = d;
		o = n - f | 0;
		p = g + 12 | 0;
		g = c[p >> 2] | 0;
		q = (g | 0) > (o | 0) ? g - o | 0 : 0;
		o = e;
		g = o - f | 0;
		if ((g | 0) > 0 ? (qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, d, g) | 0) != (g | 0) : 0) {
			c[b >> 2] = 0;
			m = 0;
			i = j;
			return m | 0
		}
		do
			if ((q | 0) > 0) {
				Nf(k, q, h);
				if ((qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, (a[k >> 0] & 1) == 0 ? k + 1 | 0 : c[k + 8 >> 2] | 0, q) | 0) == (q | 0)) {
					Of(k);
					break
				}
				c[b >> 2] = 0;
				Of(k);
				m = 0;
				i = j;
				return m | 0
			}
		while (0);
		k = n - o | 0;
		if ((k | 0) > 0 ? (qb[c[(c[l >> 2] | 0) + 48 >> 2] & 31](l, e, k) | 0) != (k | 0) : 0) {
			c[b >> 2] = 0;
			m = 0;
			i = j;
			return m | 0
		}
		c[p >> 2] = 0;
		m = l;
		i = j;
		return m | 0
	}

	function dc(a) {
		a = a | 0;
		c[a >> 2] = 2480;
		Of(a + 32 | 0);
		og(a);
		return
	}

	function ec(a) {
		a = a | 0;
		c[a >> 2] = 2480;
		Of(a + 32 | 0);
		og(a);
		Fc(a);
		return
	}

	function fc(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		i = d + 44 | 0;
		j = c[i >> 2] | 0;
		k = d + 24 | 0;
		l = c[k >> 2] | 0;
		if (j >>> 0 < l >>> 0) {
			c[i >> 2] = l;
			m = l
		} else m = j;
		j = m;
		i = h & 24;
		if (!i) {
			n = b;
			c[n >> 2] = 0;
			c[n + 4 >> 2] = 0;
			n = b + 8 | 0;
			c[n >> 2] = -1;
			c[n + 4 >> 2] = -1;
			return
		}
		if ((g | 0) == 1 & (i | 0) == 24) {
			i = b;
			c[i >> 2] = 0;
			c[i + 4 >> 2] = 0;
			i = b + 8 | 0;
			c[i >> 2] = -1;
			c[i + 4 >> 2] = -1;
			return
		}
		a: do switch (g | 0) {
				case 0:
					{
						o = 0;p = 0;
						break
					}
				case 1:
					{
						if (!(h & 8)) {
							i = l - (c[d + 20 >> 2] | 0) | 0;
							o = i;
							p = ((i | 0) < 0) << 31 >> 31;
							break a
						} else {
							i = (c[d + 12 >> 2] | 0) - (c[d + 8 >> 2] | 0) | 0;
							o = i;
							p = ((i | 0) < 0) << 31 >> 31;
							break a
						}
						break
					}
				case 2:
					{
						i = d + 32 | 0;
						if (!(a[i >> 0] & 1)) q = i + 1 | 0;
						else q = c[d + 40 >> 2] | 0;i = m - q | 0;o = i;p = ((i | 0) < 0) << 31 >> 31;
						break
					}
				default:
					{
						i = b;c[i >> 2] = 0;c[i + 4 >> 2] = 0;i = b + 8 | 0;c[i >> 2] = -1;c[i + 4 >> 2] = -1;
						return
					}
			}
			while (0);
			q = jp(o | 0, p | 0, e | 0, f | 0) | 0;
		f = D;
		if ((f | 0) >= 0) {
			e = d + 32 | 0;
			if (!(a[e >> 0] & 1)) r = e + 1 | 0;
			else r = c[d + 40 >> 2] | 0;
			e = m - r | 0;
			r = ((e | 0) < 0) << 31 >> 31;
			if (!((r | 0) < (f | 0) | (r | 0) == (f | 0) & e >>> 0 < q >>> 0)) {
				e = h & 8;
				if (!((q | 0) == 0 & (f | 0) == 0)) {
					if ((e | 0) != 0 ? (c[d + 12 >> 2] | 0) == 0 : 0) {
						r = b;
						c[r >> 2] = 0;
						c[r + 4 >> 2] = 0;
						r = b + 8 | 0;
						c[r >> 2] = -1;
						c[r + 4 >> 2] = -1;
						return
					}
					if ((h & 16 | 0) != 0 & (l | 0) == 0) {
						l = b;
						c[l >> 2] = 0;
						c[l + 4 >> 2] = 0;
						l = b + 8 | 0;
						c[l >> 2] = -1;
						c[l + 4 >> 2] = -1;
						return
					}
				}
				if (e) {
					c[d + 12 >> 2] = (c[d + 8 >> 2] | 0) + q;
					c[d + 16 >> 2] = j
				}
				if (h & 16) c[k >> 2] = (c[d + 20 >> 2] | 0) + q;
				d = b;
				c[d >> 2] = 0;
				c[d + 4 >> 2] = 0;
				d = b + 8 | 0;
				c[d >> 2] = q;
				c[d + 4 >> 2] = f;
				return
			}
		}
		f = b;
		c[f >> 2] = 0;
		c[f + 4 >> 2] = 0;
		f = b + 8 | 0;
		c[f >> 2] = -1;
		c[f + 4 >> 2] = -1;
		return
	}

	function gc(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		f = d + 8 | 0;
		Cb[c[(c[b >> 2] | 0) + 16 >> 2] & 15](a, b, c[f >> 2] | 0, c[f + 4 >> 2] | 0, 0, e);
		return
	}

	function hc(a) {
		a = a | 0;
		var b = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		b = a + 44 | 0;
		e = c[b >> 2] | 0;
		f = c[a + 24 >> 2] | 0;
		if (e >>> 0 < f >>> 0) {
			c[b >> 2] = f;
			g = f
		} else g = e;
		if (!(c[a + 48 >> 2] & 8)) {
			h = -1;
			return h | 0
		}
		e = a + 16 | 0;
		f = c[e >> 2] | 0;
		b = a + 12 | 0;
		if (f >>> 0 < g >>> 0) {
			a = c[b >> 2] | 0;
			c[e >> 2] = g;
			i = a;
			j = g
		} else {
			i = c[b >> 2] | 0;
			j = f
		}
		if (i >>> 0 >= j >>> 0) {
			h = -1;
			return h | 0
		}
		h = d[i >> 0] | 0;
		return h | 0
	}

	function ic(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		e = b + 44 | 0;
		f = c[e >> 2] | 0;
		g = c[b + 24 >> 2] | 0;
		if (f >>> 0 < g >>> 0) {
			c[e >> 2] = g;
			h = g
		} else h = f;
		f = h;
		h = b + 8 | 0;
		g = c[h >> 2] | 0;
		e = b + 12 | 0;
		i = c[e >> 2] | 0;
		j = g;
		if (g >>> 0 >= i >>> 0) {
			k = -1;
			return k | 0
		}
		if ((d | 0) == -1) {
			c[h >> 2] = g;
			c[e >> 2] = i + -1;
			c[b + 16 >> 2] = f;
			k = 0;
			return k | 0
		}
		if (!(c[b + 48 >> 2] & 16)) {
			g = d & 255;
			l = i + -1 | 0;
			if (g << 24 >> 24 == (a[l >> 0] | 0)) {
				m = g;
				n = l
			} else {
				k = -1;
				return k | 0
			}
		} else {
			m = d & 255;
			n = i + -1 | 0
		}
		c[h >> 2] = j;
		c[e >> 2] = n;
		c[b + 16 >> 2] = f;
		a[n >> 0] = m;
		k = d;
		return k | 0
	}

	function jc(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		if ((d | 0) == -1) {
			g = 0;
			i = e;
			return g | 0
		}
		h = b + 12 | 0;
		j = b + 8 | 0;
		k = (c[h >> 2] | 0) - (c[j >> 2] | 0) | 0;
		l = b + 24 | 0;
		m = c[l >> 2] | 0;
		n = b + 28 | 0;
		o = c[n >> 2] | 0;
		if ((m | 0) == (o | 0)) {
			p = b + 48 | 0;
			if (!(c[p >> 2] & 16)) {
				g = -1;
				i = e;
				return g | 0
			}
			q = b + 20 | 0;
			r = c[q >> 2] | 0;
			s = b + 44 | 0;
			t = (c[s >> 2] | 0) - r | 0;
			u = b + 32 | 0;
			Vf(u, 0);
			if (!(a[u >> 0] & 1)) v = 10;
			else v = (c[u >> 2] & -2) + -1 | 0;
			Sf(u, v, 0);
			v = a[u >> 0] | 0;
			if (!(v & 1)) {
				w = u + 1 | 0;
				x = (v & 255) >>> 1
			} else {
				w = c[b + 40 >> 2] | 0;
				x = c[b + 36 >> 2] | 0
			}
			v = w + x | 0;
			c[q >> 2] = w;
			c[n >> 2] = v;
			n = w + (m - r) | 0;
			c[l >> 2] = n;
			r = w + t | 0;
			c[s >> 2] = r;
			y = p;
			z = s;
			A = n;
			B = r;
			C = v
		} else {
			v = b + 44 | 0;
			y = b + 48 | 0;
			z = v;
			A = m;
			B = c[v >> 2] | 0;
			C = o
		}
		o = A + 1 | 0;
		c[f >> 2] = o;
		v = c[(o >>> 0 < B >>> 0 ? z : f) >> 2] | 0;
		c[z >> 2] = v;
		if (c[y >> 2] & 8) {
			y = b + 32 | 0;
			if (!(a[y >> 0] & 1)) D = y + 1 | 0;
			else D = c[b + 40 >> 2] | 0;
			c[j >> 2] = D;
			c[h >> 2] = D + k;
			c[b + 16 >> 2] = v
		}
		if ((A | 0) == (C | 0)) {
			g = Db[c[(c[b >> 2] | 0) + 52 >> 2] & 31](b, d & 255) | 0;
			i = e;
			return g | 0
		} else {
			c[l >> 2] = o;
			a[A >> 0] = d;
			g = d & 255;
			i = e;
			return g | 0
		}
		return 0
	}

	function kc(a) {
		a = a | 0;
		_b(a, 2536);
		ig(a + 64 | 0);
		return
	}

	function lc(a) {
		a = a | 0;
		_b(a, 2536);
		ig(a + 64 | 0);
		Fc(a);
		return
	}

	function mc(a) {
		a = a | 0;
		var b = 0;
		b = a + -8 | 0;
		_b(b, 2536);
		ig(b + 64 | 0);
		return
	}

	function nc(a) {
		a = a | 0;
		var b = 0;
		b = a + -8 | 0;
		_b(b, 2536);
		ig(b + 64 | 0);
		Fc(b);
		return
	}

	function oc(a) {
		a = a | 0;
		var b = 0;
		b = c[(c[a >> 2] | 0) + -12 >> 2] | 0;
		_b(a + b | 0, 2536);
		ig(a + (b + 64) | 0);
		return
	}

	function pc(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = c[(c[a >> 2] | 0) + -12 >> 2] | 0;
		d = a + b | 0;
		_b(d, 2536);
		ig(a + (b + 64) | 0);
		Fc(d);
		return
	}

	function qc(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0;
		f = b + 28 | 0;
		if (!(c[f >> 2] | 0)) {
			g = Dc(16) | 0;
			h = c[b + 32 >> 2] | 0;
			c[g + 4 >> 2] = 0;
			c[g + 8 >> 2] = 0;
			c[g >> 2] = 128;
			c[g + 12 >> 2] = h;
			c[f >> 2] = g
		}
		g = b + 44 | 0;
		c[g >> 2] = e;
		h = b + 40 | 0;
		if (!((c[h >> 2] | 0) != 0 | d ^ 1)) {
			i = c[b + 32 >> 2] | 0;
			if (!i) lb(1);
			tb[i & 127](14566);
			lb(1)
		}
		if (!((e | 0) == 0 | d)) {
			e = c[b + 32 >> 2] | 0;
			if (!e) lb(1);
			tb[e & 127](14625);
			lb(1)
		}
		if (!d) {
			e = b + 48 | 0;
			i = b + 60 | 0;
			j = b + 52 | 0;
			k = b + 72 | 0;
			c[k >> 2] = 0;
			c[e >> 2] = 0;
			c[e + 4 >> 2] = 0;
			c[e + 8 >> 2] = 0;
			c[e + 12 >> 2] = 0;
			c[e + 16 >> 2] = 0;
			l = c[b >> 2] | 0;
			m = b + 4 | 0;
			if (l >>> 0 < (c[m >> 2] | 0) >>> 0) {
				n = l;
				do {
					l = n + 8 | 0;
					c[l >> 2] = 0;
					o = n + 20 | 0;
					p = a[o >> 0] | 0;
					q = p & -7;
					a[o >> 0] = q;
					c[n + 12 >> 2] = c[k >> 2];
					r = c[n + 24 >> 2] | 0;
					do
						if ((r | 0) > 0) {
							a[o >> 0] = p & -8;
							c[n + 4 >> 2] = 1;
							s = c[i >> 2] | 0;
							if (!s) c[j >> 2] = n;
							else c[s + 8 >> 2] = n;
							c[i >> 2] = n;
							c[l >> 2] = n;
							c[n + 16 >> 2] = 1
						} else {
							if ((r | 0) >= 0) {
								c[n + 4 >> 2] = 0;
								break
							}
							a[o >> 0] = q | 1;
							c[n + 4 >> 2] = 1;
							s = c[i >> 2] | 0;
							if (!s) c[j >> 2] = n;
							else c[s + 8 >> 2] = n;
							c[i >> 2] = n;
							c[l >> 2] = n;
							c[n + 16 >> 2] = 1
						}
					while (0);
					n = n + 28 | 0
				} while (n >>> 0 < (c[m >> 2] | 0) >>> 0);
				t = e;
				u = i;
				v = k;
				w = b;
				x = j
			} else {
				t = e;
				u = i;
				v = k;
				w = b;
				x = j
			}
		} else {
			rc(b);
			t = b + 48 | 0;
			u = b + 60 | 0;
			v = b + 72 | 0;
			w = b;
			x = b + 52 | 0
		}
		j = b + 56 | 0;
		k = b + 56 | 0;
		i = b + 64 | 0;
		e = b + 68 | 0;
		m = 0;
		a: while (1) {
			if ((m | 0) != 0 ? (c[m + 8 >> 2] = 0, (c[m + 4 >> 2] | 0) != 0) : 0) y = m;
			else z = 29;
			if ((z | 0) == 29)
				while (1) {
					z = 0;
					n = c[t >> 2] | 0;
					if (!n) {
						l = c[x >> 2] | 0;
						c[t >> 2] = l;
						c[j >> 2] = c[u >> 2];
						c[x >> 2] = 0;
						c[u >> 2] = 0;
						if (!l) break a;
						else A = l
					} else A = n;
					n = A + 8 | 0;
					l = c[n >> 2] | 0;
					if ((l | 0) == (A | 0)) {
						c[k >> 2] = 0;
						B = 0
					} else B = l;
					c[t >> 2] = B;
					c[n >> 2] = 0;
					if (!(c[A + 4 >> 2] | 0)) z = 29;
					else {
						y = A;
						break
					}
				}
			n = c[y >> 2] | 0;
			l = (n | 0) == 0;
			b: do
				if (!(a[y + 20 >> 0] & 1))
					if (l) z = 86;
					else {
						q = y + 12 | 0;
						o = y + 16 | 0;
						r = n;
						c: while (1) {
							do
								if (c[r + 12 >> 2] | 0) {
									p = c[r >> 2] | 0;
									s = p + 4 | 0;
									C = p + 20 | 0;
									D = a[C >> 0] | 0;
									if (c[s >> 2] | 0) {
										if (D & 1) {
											E = r;
											break c
										}
										F = p + 12 | 0;
										G = c[q >> 2] | 0;
										if ((c[F >> 2] | 0) > (G | 0)) break;
										H = p + 16 | 0;
										I = c[o >> 2] | 0;
										if ((c[H >> 2] | 0) <= (I | 0)) break;
										c[s >> 2] = c[r + 8 >> 2];
										c[F >> 2] = G;
										c[H >> 2] = I + 1;
										break
									}
									a[C >> 0] = D & -2;
									c[s >> 2] = c[r + 8 >> 2];
									c[p + 12 >> 2] = c[q >> 2];
									c[p + 16 >> 2] = (c[o >> 2] | 0) + 1;
									s = p + 8 | 0;
									if (!(c[s >> 2] | 0)) {
										D = c[u >> 2] | 0;
										if (!D) c[x >> 2] = p;
										else c[D + 8 >> 2] = p;
										c[u >> 2] = p;
										c[s >> 2] = p
									}
									s = c[g >> 2] | 0;
									if ((s | 0) != 0 ? (a[C >> 0] & 4) == 0 : 0) {
										D = s + 8 | 0;
										I = c[D >> 2] | 0;
										H = (I | 0) == 0;
										if (!H)
											if (((c[I >> 2] | 0) + 4 | 0) >>> 0 > (c[I + 4 >> 2] | 0) >>> 0) {
												G = c[I + 8 >> 2] | 0;
												if (!G) z = 52;
												else {
													c[D >> 2] = G;
													J = G
												}
											} else J = I;
										else z = 52;
										if ((z | 0) == 52) {
											z = 0;
											G = c[s >> 2] | 0;
											F = Ec((G << 2) + 12 | 0) | 0;
											if (H) c[s + 4 >> 2] = F;
											else c[I + 8 >> 2] = F;
											c[D >> 2] = F;
											D = F + 12 | 0;
											c[F >> 2] = D;
											c[F + 4 >> 2] = D + (G << 2);
											c[F + 8 >> 2] = 0;
											J = F
										}
										F = c[J >> 2] | 0;
										c[J >> 2] = F + 4;
										c[F >> 2] = (p - (c[w >> 2] | 0) | 0) / 28 | 0;
										a[C >> 0] = a[C >> 0] | 4
									}
								}
							while (0);
							r = c[r + 4 >> 2] | 0;
							if (!r) {
								z = 86;
								break b
							}
						}
						c[v >> 2] = (c[v >> 2] | 0) + 1;
						K = E
					}
			else if (!l) {
				r = y + 12 | 0;
				o = y + 16 | 0;
				q = n;
				d: while (1) {
					C = q + 8 | 0;
					p = c[C >> 2] | 0;
					do
						if (c[p + 12 >> 2] | 0) {
							F = c[q >> 2] | 0;
							G = F + 4 | 0;
							D = F + 20 | 0;
							I = a[D >> 0] | 0;
							if (c[G >> 2] | 0) {
								if (!(I & 1)) {
									L = p;
									break d
								}
								s = F + 12 | 0;
								H = c[r >> 2] | 0;
								if ((c[s >> 2] | 0) > (H | 0)) break;
								M = F + 16 | 0;
								N = c[o >> 2] | 0;
								if ((c[M >> 2] | 0) <= (N | 0)) break;
								c[G >> 2] = p;
								c[s >> 2] = H;
								c[M >> 2] = N + 1;
								break
							}
							a[D >> 0] = I | 1;
							c[G >> 2] = c[C >> 2];
							c[F + 12 >> 2] = c[r >> 2];
							c[F + 16 >> 2] = (c[o >> 2] | 0) + 1;
							G = F + 8 | 0;
							if (!(c[G >> 2] | 0)) {
								I = c[u >> 2] | 0;
								if (!I) c[x >> 2] = F;
								else c[I + 8 >> 2] = F;
								c[u >> 2] = F;
								c[G >> 2] = F
							}
							G = c[g >> 2] | 0;
							if ((G | 0) != 0 ? (a[D >> 0] & 4) == 0 : 0) {
								I = G + 8 | 0;
								N = c[I >> 2] | 0;
								M = (N | 0) == 0;
								if (!M)
									if (((c[N >> 2] | 0) + 4 | 0) >>> 0 > (c[N + 4 >> 2] | 0) >>> 0) {
										H = c[N + 8 >> 2] | 0;
										if (!H) z = 76;
										else {
											c[I >> 2] = H;
											O = H
										}
									} else O = N;
								else z = 76;
								if ((z | 0) == 76) {
									z = 0;
									H = c[G >> 2] | 0;
									s = Ec((H << 2) + 12 | 0) | 0;
									if (M) c[G + 4 >> 2] = s;
									else c[N + 8 >> 2] = s;
									c[I >> 2] = s;
									I = s + 12 | 0;
									c[s >> 2] = I;
									c[s + 4 >> 2] = I + (H << 2);
									c[s + 8 >> 2] = 0;
									O = s
								}
								s = c[O >> 2] | 0;
								c[O >> 2] = s + 4;
								c[s >> 2] = (F - (c[w >> 2] | 0) | 0) / 28 | 0;
								a[D >> 0] = a[D >> 0] | 4
							}
						}
					while (0);
					q = c[q + 4 >> 2] | 0;
					if (!q) {
						z = 86;
						break b
					}
				}
				c[v >> 2] = (c[v >> 2] | 0) + 1;
				if (!L) {
					m = 0;
					continue a
				} else K = L
			} else z = 86;
			while (0);
			if ((z | 0) == 86) {
				z = 0;
				c[v >> 2] = (c[v >> 2] | 0) + 1;
				m = 0;
				continue
			}
			c[y + 8 >> 2] = y;
			sc(b, K);
			n = c[i >> 2] | 0;
			if (!n) {
				m = y;
				continue
			} else P = n;
			while (1) {
				n = P + 4 | 0;
				l = c[n >> 2] | 0;
				c[n >> 2] = 0;
				if (P) {
					n = P;
					do {
						c[i >> 2] = c[n + 4 >> 2];
						q = c[n >> 2] | 0;
						o = (c[f >> 2] | 0) + 8 | 0;
						c[n >> 2] = c[o >> 2];
						c[o >> 2] = n;
						if (!(c[i >> 2] | 0)) c[e >> 2] = 0;
						if (!(a[q + 20 >> 0] & 1)) uc(b, q);
						else tc(b, q);
						n = c[i >> 2] | 0
					} while ((n | 0) != 0)
				}
				c[i >> 2] = l;
				if (!l) {
					m = y;
					continue a
				} else P = l
			}
		}
		if (d ? (d = c[h >> 2] | 0, (d & 63 | 0) != 0) : 0) {
			Q = d;
			R = Q + 1 | 0;
			c[h >> 2] = R;
			S = b + 36 | 0;
			T = c[S >> 2] | 0;
			return T | 0
		}
		d = c[f >> 2] | 0;
		if (d) {
			P = d + 4 | 0;
			y = c[P >> 2] | 0;
			if (y) {
				m = y;
				do {
					y = m;
					m = c[m >> 2] | 0;
					Gc(y);
					c[P >> 2] = m
				} while ((m | 0) != 0)
			}
			Fc(d)
		}
		c[f >> 2] = 0;
		Q = c[h >> 2] | 0;
		R = Q + 1 | 0;
		c[h >> 2] = R;
		S = b + 36 | 0;
		T = c[S >> 2] | 0;
		return T | 0
	}

	function rc(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0;
		d = b + 52 | 0;
		e = c[d >> 2] | 0;
		f = b + 48 | 0;
		g = b + 60 | 0;
		h = b + 68 | 0;
		i = b + 64 | 0;
		j = b + 72 | 0;
		c[f >> 2] = 0;
		c[f + 4 >> 2] = 0;
		c[f + 8 >> 2] = 0;
		c[f + 12 >> 2] = 0;
		c[f + 16 >> 2] = 0;
		c[f + 20 >> 2] = 0;
		c[j >> 2] = (c[j >> 2] | 0) + 1;
		if (!e) return;
		f = b + 28 | 0;
		k = b + 44 | 0;
		l = e;
		do {
			e = l + 8 | 0;
			m = c[e >> 2] | 0;
			n = l;
			l = (m | 0) == (l | 0) ? 0 : m;
			c[e >> 2] = 0;
			m = n + 20 | 0;
			a[m >> 0] = a[m >> 0] & -3;
			o = c[g >> 2] | 0;
			if (!o) c[d >> 2] = n;
			else c[o + 8 >> 2] = n;
			c[g >> 2] = n;
			c[e >> 2] = n;
			e = c[n + 24 >> 2] | 0;
			if (!e) {
				o = n + 4 | 0;
				if (c[o >> 2] | 0) {
					c[o >> 2] = 2;
					o = c[f >> 2] | 0;
					p = o + 8 | 0;
					q = c[p >> 2] | 0;
					if (!q) {
						r = o + 4 | 0;
						s = c[r >> 2] | 0;
						t = c[o >> 2] | 0;
						o = Ec(t << 3 | 4) | 0;
						c[r >> 2] = o;
						u = o + 4 | 0;
						c[p >> 2] = u;
						o = t + -1 | 0;
						if (u >>> 0 < (u + (o << 3) | 0) >>> 0) {
							t = u;
							while (1) {
								v = t + 8 | 0;
								c[t >> 2] = v;
								if (v >>> 0 < ((c[p >> 2] | 0) + (o << 3) | 0) >>> 0) t = v;
								else {
									w = v;
									break
								}
							}
						} else w = u;
						c[w >> 2] = 0;
						c[c[r >> 2] >> 2] = s;
						x = c[p >> 2] | 0
					} else x = q;
					c[p >> 2] = c[x >> 2];
					c[x >> 2] = n;
					t = c[h >> 2] | 0;
					if (!t) c[i >> 2] = x;
					else c[t + 4 >> 2] = x;
					c[h >> 2] = x;
					c[x + 4 >> 2] = 0
				}
			} else {
				t = n + 4 | 0;
				o = (c[t >> 2] | 0) != 0;
				v = a[m >> 0] | 0;
				if ((e | 0) > 0) {
					if (!(o & (v & 1) == 0)) {
						a[m >> 0] = v & -2;
						y = c[n >> 2] | 0;
						if (y) {
							z = y;
							do {
								y = c[z >> 2] | 0;
								A = y + 20 | 0;
								if (!(a[A >> 0] & 2)) {
									B = y + 4 | 0;
									C = c[B >> 2] | 0;
									if ((C | 0) == (c[z + 8 >> 2] | 0)) {
										c[B >> 2] = 2;
										D = c[f >> 2] | 0;
										E = D + 8 | 0;
										F = c[E >> 2] | 0;
										if (!F) {
											G = D + 4 | 0;
											H = c[G >> 2] | 0;
											I = c[D >> 2] | 0;
											D = Ec(I << 3 | 4) | 0;
											c[G >> 2] = D;
											J = D + 4 | 0;
											c[E >> 2] = J;
											D = I + -1 | 0;
											if (J >>> 0 < (J + (D << 3) | 0) >>> 0) {
												I = J;
												while (1) {
													K = I + 8 | 0;
													c[I >> 2] = K;
													if (K >>> 0 < ((c[E >> 2] | 0) + (D << 3) | 0) >>> 0) I = K;
													else {
														L = K;
														break
													}
												}
											} else L = J;
											c[L >> 2] = 0;
											c[c[G >> 2] >> 2] = H;
											M = c[E >> 2] | 0
										} else M = F;
										c[E >> 2] = c[M >> 2];
										c[M >> 2] = y;
										I = c[h >> 2] | 0;
										if (!I) c[i >> 2] = M;
										else c[I + 4 >> 2] = M;
										c[h >> 2] = M;
										c[M + 4 >> 2] = 0;
										N = c[B >> 2] | 0
									} else N = C;
									if ((((N | 0) != 0 ? (a[A >> 0] & 1) != 0 : 0) ? (c[z + 12 >> 2] | 0) > 0 : 0) ? (I = y + 8 | 0, (c[I >> 2] | 0) == 0) : 0) {
										D = c[g >> 2] | 0;
										if (!D) c[d >> 2] = y;
										else c[D + 8 >> 2] = y;
										c[g >> 2] = y;
										c[I >> 2] = y
									}
								}
								z = c[z + 4 >> 2] | 0
							} while ((z | 0) != 0)
						}
						z = c[k >> 2] | 0;
						if ((z | 0) != 0 ? (a[m >> 0] & 4) == 0 : 0) {
							e = z + 8 | 0;
							p = c[e >> 2] | 0;
							q = (p | 0) == 0;
							if (!q)
								if (((c[p >> 2] | 0) + 4 | 0) >>> 0 > (c[p + 4 >> 2] | 0) >>> 0) {
									s = c[p + 8 >> 2] | 0;
									if (!s) O = 46;
									else {
										c[e >> 2] = s;
										P = s
									}
								} else P = p;
							else O = 46;
							if ((O | 0) == 46) {
								O = 0;
								s = c[z >> 2] | 0;
								r = Ec((s << 2) + 12 | 0) | 0;
								if (q) c[z + 4 >> 2] = r;
								else c[p + 8 >> 2] = r;
								c[e >> 2] = r;
								e = r + 12 | 0;
								c[r >> 2] = e;
								c[r + 4 >> 2] = e + (s << 2);
								c[r + 8 >> 2] = 0;
								P = r
							}
							r = c[P >> 2] | 0;
							c[P >> 2] = r + 4;
							c[r >> 2] = (n - (c[b >> 2] | 0) | 0) / 28 | 0;
							a[m >> 0] = a[m >> 0] | 4
						}
					}
				} else if ((v & 1) == 0 | o ^ 1) {
					a[m >> 0] = v | 1;
					r = c[n >> 2] | 0;
					if (r) {
						s = r;
						do {
							r = c[s >> 2] | 0;
							e = r + 20 | 0;
							if (!(a[e >> 0] & 2)) {
								p = r + 4 | 0;
								z = c[p >> 2] | 0;
								q = s + 8 | 0;
								if ((z | 0) == (c[q >> 2] | 0)) {
									c[p >> 2] = 2;
									u = c[f >> 2] | 0;
									I = u + 8 | 0;
									D = c[I >> 2] | 0;
									if (!D) {
										K = u + 4 | 0;
										Q = c[K >> 2] | 0;
										R = c[u >> 2] | 0;
										u = Ec(R << 3 | 4) | 0;
										c[K >> 2] = u;
										S = u + 4 | 0;
										c[I >> 2] = S;
										u = R + -1 | 0;
										if (S >>> 0 < (S + (u << 3) | 0) >>> 0) {
											R = S;
											while (1) {
												T = R + 8 | 0;
												c[R >> 2] = T;
												if (T >>> 0 < ((c[I >> 2] | 0) + (u << 3) | 0) >>> 0) R = T;
												else {
													U = T;
													break
												}
											}
										} else U = S;
										c[U >> 2] = 0;
										c[c[K >> 2] >> 2] = Q;
										V = c[I >> 2] | 0
									} else V = D;
									c[I >> 2] = c[V >> 2];
									c[V >> 2] = r;
									R = c[h >> 2] | 0;
									if (!R) c[i >> 2] = V;
									else c[R + 4 >> 2] = V;
									c[h >> 2] = V;
									c[V + 4 >> 2] = 0;
									W = c[p >> 2] | 0
								} else W = z;
								if ((((W | 0) != 0 ? (a[e >> 0] & 1) == 0 : 0) ? (c[(c[q >> 2] | 0) + 12 >> 2] | 0) > 0 : 0) ? (R = r + 8 | 0, (c[R >> 2] | 0) == 0) : 0) {
									u = c[g >> 2] | 0;
									if (!u) c[d >> 2] = r;
									else c[u + 8 >> 2] = r;
									c[g >> 2] = r;
									c[R >> 2] = r
								}
							}
							s = c[s + 4 >> 2] | 0
						} while ((s | 0) != 0)
					}
					s = c[k >> 2] | 0;
					if ((s | 0) != 0 ? (a[m >> 0] & 4) == 0 : 0) {
						v = s + 8 | 0;
						o = c[v >> 2] | 0;
						R = (o | 0) == 0;
						if (!R)
							if (((c[o >> 2] | 0) + 4 | 0) >>> 0 > (c[o + 4 >> 2] | 0) >>> 0) {
								u = c[o + 8 >> 2] | 0;
								if (!u) O = 78;
								else {
									c[v >> 2] = u;
									X = u
								}
							} else X = o;
						else O = 78;
						if ((O | 0) == 78) {
							O = 0;
							u = c[s >> 2] | 0;
							y = Ec((u << 2) + 12 | 0) | 0;
							if (R) c[s + 4 >> 2] = y;
							else c[o + 8 >> 2] = y;
							c[v >> 2] = y;
							v = y + 12 | 0;
							c[y >> 2] = v;
							c[y + 4 >> 2] = v + (u << 2);
							c[y + 8 >> 2] = 0;
							X = y
						}
						y = c[X >> 2] | 0;
						c[X >> 2] = y + 4;
						c[y >> 2] = (n - (c[b >> 2] | 0) | 0) / 28 | 0;
						a[m >> 0] = a[m >> 0] | 4
					}
				}
				c[t >> 2] = 1;
				c[n + 12 >> 2] = c[j >> 2];
				c[n + 16 >> 2] = 1
			}
		} while ((l | 0) != 0);
		l = c[i >> 2] | 0;
		if (!l) return;
		j = b + 28 | 0;
		X = l;
		do {
			c[i >> 2] = c[X + 4 >> 2];
			l = c[X >> 2] | 0;
			O = (c[j >> 2] | 0) + 8 | 0;
			c[X >> 2] = c[O >> 2];
			c[O >> 2] = X;
			if (!(c[i >> 2] | 0)) c[h >> 2] = 0;
			if (!(a[l + 20 >> 0] & 1)) uc(b, l);
			else tc(b, l);
			X = c[i >> 2] | 0
		} while ((X | 0) != 0);
		return
	}

	function sc(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0;
		d = b + 12 | 0;
		e = c[d >> 2] | 0;
		f = c[b + 8 >> 2] | 0;
		g = c[f >> 2] | 0;
		h = c[g + 4 >> 2] | 0;
		if ((h | 0) == 1) {
			i = e;
			j = g
		} else {
			g = h;
			h = e;
			while (1) {
				e = c[(c[g + 8 >> 2] | 0) + 12 >> 2] | 0;
				k = (h | 0) > (e | 0) ? e : h;
				e = c[g >> 2] | 0;
				g = c[e + 4 >> 2] | 0;
				if ((g | 0) == 1) {
					i = k;
					j = e;
					break
				} else h = k
			}
		}
		h = c[j + 24 >> 2] | 0;
		j = (i | 0) > (h | 0) ? h : i;
		i = c[b >> 2] | 0;
		h = c[i + 4 >> 2] | 0;
		if ((h | 0) == 1) {
			l = j;
			m = i
		} else {
			i = h;
			h = j;
			while (1) {
				j = c[i + 12 >> 2] | 0;
				g = (h | 0) > (j | 0) ? j : h;
				j = c[i >> 2] | 0;
				i = c[j + 4 >> 2] | 0;
				if ((i | 0) == 1) {
					l = g;
					m = j;
					break
				} else h = g
			}
		}
		h = 0 - (c[m + 24 >> 2] | 0) | 0;
		m = (l | 0) > (h | 0) ? h : l;
		l = f + 12 | 0;
		c[l >> 2] = (c[l >> 2] | 0) + m;
		c[d >> 2] = (c[d >> 2] | 0) - m;
		d = c[f >> 2] | 0;
		f = d + 4 | 0;
		l = c[f >> 2] | 0;
		if ((l | 0) == 1) {
			n = f;
			o = d
		} else {
			h = a + 28 | 0;
			i = a + 64 | 0;
			g = l;
			l = f;
			f = d;
			while (1) {
				d = g + 12 | 0;
				c[d >> 2] = (c[d >> 2] | 0) + m;
				d = (c[g + 8 >> 2] | 0) + 12 | 0;
				j = c[d >> 2] | 0;
				c[d >> 2] = j - m;
				if ((j | 0) == (m | 0)) {
					c[l >> 2] = 2;
					j = c[h >> 2] | 0;
					d = j + 8 | 0;
					k = c[d >> 2] | 0;
					if (!k) {
						e = j + 4 | 0;
						p = c[e >> 2] | 0;
						q = c[j >> 2] | 0;
						j = Ec(q << 3 | 4) | 0;
						c[e >> 2] = j;
						r = j + 4 | 0;
						c[d >> 2] = r;
						j = q + -1 | 0;
						if (r >>> 0 < (r + (j << 3) | 0) >>> 0) {
							q = r;
							while (1) {
								s = q + 8 | 0;
								c[q >> 2] = s;
								if (s >>> 0 < ((c[d >> 2] | 0) + (j << 3) | 0) >>> 0) q = s;
								else {
									t = s;
									break
								}
							}
						} else t = r;
						c[t >> 2] = 0;
						c[c[e >> 2] >> 2] = p;
						u = c[d >> 2] | 0
					} else u = k;
					c[d >> 2] = c[u >> 2];
					c[u >> 2] = f;
					c[u + 4 >> 2] = c[i >> 2];
					c[i >> 2] = u
				}
				q = c[g >> 2] | 0;
				j = q + 4 | 0;
				g = c[j >> 2] | 0;
				if ((g | 0) == 1) {
					n = j;
					o = q;
					break
				} else {
					l = j;
					f = q
				}
			}
		}
		f = o + 24 | 0;
		l = c[f >> 2] | 0;
		c[f >> 2] = l - m;
		if ((l | 0) == (m | 0)) {
			c[n >> 2] = 2;
			n = c[a + 28 >> 2] | 0;
			l = n + 8 | 0;
			f = c[l >> 2] | 0;
			if (!f) {
				g = n + 4 | 0;
				u = c[g >> 2] | 0;
				i = c[n >> 2] | 0;
				n = Ec(i << 3 | 4) | 0;
				c[g >> 2] = n;
				t = n + 4 | 0;
				c[l >> 2] = t;
				n = i + -1 | 0;
				if (t >>> 0 < (t + (n << 3) | 0) >>> 0) {
					i = t;
					while (1) {
						h = i + 8 | 0;
						c[i >> 2] = h;
						if (h >>> 0 < ((c[l >> 2] | 0) + (n << 3) | 0) >>> 0) i = h;
						else {
							v = h;
							break
						}
					}
				} else v = t;
				c[v >> 2] = 0;
				c[c[g >> 2] >> 2] = u;
				w = c[l >> 2] | 0
			} else w = f;
			c[l >> 2] = c[w >> 2];
			c[w >> 2] = o;
			o = a + 64 | 0;
			c[w + 4 >> 2] = c[o >> 2];
			c[o >> 2] = w
		}
		w = c[b >> 2] | 0;
		b = w + 4 | 0;
		o = c[b >> 2] | 0;
		if ((o | 0) == 1) {
			x = b;
			y = w
		} else {
			l = a + 28 | 0;
			f = a + 64 | 0;
			u = o;
			o = b;
			b = w;
			while (1) {
				w = (c[u + 8 >> 2] | 0) + 12 | 0;
				c[w >> 2] = (c[w >> 2] | 0) + m;
				w = u + 12 | 0;
				g = c[w >> 2] | 0;
				c[w >> 2] = g - m;
				if ((g | 0) == (m | 0)) {
					c[o >> 2] = 2;
					g = c[l >> 2] | 0;
					w = g + 8 | 0;
					v = c[w >> 2] | 0;
					if (!v) {
						t = g + 4 | 0;
						i = c[t >> 2] | 0;
						n = c[g >> 2] | 0;
						g = Ec(n << 3 | 4) | 0;
						c[t >> 2] = g;
						h = g + 4 | 0;
						c[w >> 2] = h;
						g = n + -1 | 0;
						if (h >>> 0 < (h + (g << 3) | 0) >>> 0) {
							n = h;
							while (1) {
								q = n + 8 | 0;
								c[n >> 2] = q;
								if (q >>> 0 < ((c[w >> 2] | 0) + (g << 3) | 0) >>> 0) n = q;
								else {
									z = q;
									break
								}
							}
						} else z = h;
						c[z >> 2] = 0;
						c[c[t >> 2] >> 2] = i;
						A = c[w >> 2] | 0
					} else A = v;
					c[w >> 2] = c[A >> 2];
					c[A >> 2] = b;
					c[A + 4 >> 2] = c[f >> 2];
					c[f >> 2] = A
				}
				n = c[u >> 2] | 0;
				g = n + 4 | 0;
				u = c[g >> 2] | 0;
				if ((u | 0) == 1) {
					x = g;
					y = n;
					break
				} else {
					o = g;
					b = n
				}
			}
		}
		b = y + 24 | 0;
		o = (c[b >> 2] | 0) + m | 0;
		c[b >> 2] = o;
		if (o) {
			B = a + 36 | 0;
			C = c[B >> 2] | 0;
			D = C + m | 0;
			c[B >> 2] = D;
			return
		}
		c[x >> 2] = 2;
		x = c[a + 28 >> 2] | 0;
		o = x + 8 | 0;
		b = c[o >> 2] | 0;
		if (!b) {
			u = x + 4 | 0;
			A = c[u >> 2] | 0;
			f = c[x >> 2] | 0;
			x = Ec(f << 3 | 4) | 0;
			c[u >> 2] = x;
			z = x + 4 | 0;
			c[o >> 2] = z;
			x = f + -1 | 0;
			if (z >>> 0 < (z + (x << 3) | 0) >>> 0) {
				f = z;
				while (1) {
					l = f + 8 | 0;
					c[f >> 2] = l;
					if (l >>> 0 < ((c[o >> 2] | 0) + (x << 3) | 0) >>> 0) f = l;
					else {
						E = l;
						break
					}
				}
			} else E = z;
			c[E >> 2] = 0;
			c[c[u >> 2] >> 2] = A;
			F = c[o >> 2] | 0
		} else F = b;
		c[o >> 2] = c[F >> 2];
		c[F >> 2] = y;
		y = a + 64 | 0;
		c[F + 4 >> 2] = c[y >> 2];
		c[y >> 2] = F;
		B = a + 36 | 0;
		C = c[B >> 2] | 0;
		D = C + m | 0;
		c[B >> 2] = D;
		return
	}

	function tc(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		e = c[d >> 2] | 0;
		if (e) {
			f = b + 72 | 0;
			g = e;
			e = 0;
			h = 2147483647;
			while (1) {
				a: do
					if (((c[g + 12 >> 2] | 0) != 0 ? (i = c[g >> 2] | 0, (a[i + 20 >> 0] & 1) != 0) : 0) ? (j = c[i + 4 >> 2] | 0, (j | 0) != 0) : 0) {
						k = i + 12 | 0;
						l = c[f >> 2] | 0;
						b: do
							if ((c[k >> 2] | 0) == (l | 0)) {
								m = 0;
								n = i;
								o = 8
							} else {
								p = k;
								q = j;
								r = 0;
								s = i;
								c: while (1) {
									t = r + 1 | 0;
									switch (q | 0) {
										case 2:
											{
												u = e;v = h;
												break a;
												break
											}
										case 1:
											{
												w = p;x = t;y = s;
												break c;
												break
											}
										default:
											{}
									}
									z = c[q >> 2] | 0;
									A = z + 12 | 0;
									if ((c[A >> 2] | 0) == (l | 0)) {
										m = t;
										n = z;
										o = 8;
										break b
									}
									p = A;
									q = c[z + 4 >> 2] | 0;
									r = t;
									s = z
								}
								c[w >> 2] = l;
								c[y + 16 >> 2] = 1;
								B = x
							}
						while (0);
						if ((o | 0) == 8) {
							o = 0;
							B = (c[n + 16 >> 2] | 0) + m | 0
						}
						if ((B | 0) != 2147483647) {
							i = (B | 0) < (h | 0);
							j = i ? g : e;
							k = i ? B : h;
							i = c[g >> 2] | 0;
							s = i + 12 | 0;
							if ((c[s >> 2] | 0) == (l | 0)) {
								u = j;
								v = k
							} else {
								r = s;
								s = B;
								q = i;
								while (1) {
									c[r >> 2] = l;
									c[q + 16 >> 2] = s;
									q = c[c[q + 4 >> 2] >> 2] | 0;
									r = q + 12 | 0;
									if ((c[r >> 2] | 0) == (l | 0)) {
										u = j;
										v = k;
										break
									} else s = s + -1 | 0
								}
							}
						} else {
							u = e;
							v = h
						}
					} else {
						u = e;
						v = h
					}while (0);g = c[g + 4 >> 2] | 0;
				if (!g) {
					C = u;
					D = v;
					break
				} else {
					e = u;
					h = v
				}
			}
			c[d + 4 >> 2] = C;
			if (C) {
				c[d + 12 >> 2] = c[b + 72 >> 2];
				c[d + 16 >> 2] = D + 1;
				return
			}
		} else c[d + 4 >> 2] = 0;
		D = c[b + 44 >> 2] | 0;
		if ((D | 0) != 0 ? (C = d + 20 | 0, (a[C >> 0] & 4) == 0) : 0) {
			v = D + 8 | 0;
			h = c[v >> 2] | 0;
			u = (h | 0) == 0;
			if (!u)
				if (((c[h >> 2] | 0) + 4 | 0) >>> 0 > (c[h + 4 >> 2] | 0) >>> 0) {
					e = c[h + 8 >> 2] | 0;
					if (!e) o = 25;
					else {
						c[v >> 2] = e;
						E = e
					}
				} else E = h;
			else o = 25;
			if ((o | 0) == 25) {
				o = c[D >> 2] | 0;
				e = Ec((o << 2) + 12 | 0) | 0;
				if (u) c[D + 4 >> 2] = e;
				else c[h + 8 >> 2] = e;
				c[v >> 2] = e;
				v = e + 12 | 0;
				c[e >> 2] = v;
				c[e + 4 >> 2] = v + (o << 2);
				c[e + 8 >> 2] = 0;
				E = e
			}
			e = c[E >> 2] | 0;
			c[E >> 2] = e + 4;
			c[e >> 2] = (d - (c[b >> 2] | 0) | 0) / 28 | 0;
			a[C >> 0] = a[C >> 0] | 4
		}
		C = c[d >> 2] | 0;
		if (!C) return;
		e = b + 28 | 0;
		E = b + 68 | 0;
		o = b + 64 | 0;
		v = b + 60 | 0;
		h = b + 52 | 0;
		b = C;
		do {
			C = c[b >> 2] | 0;
			if ((a[C + 20 >> 0] & 1) != 0 ? (D = C + 4 | 0, u = c[D >> 2] | 0, (u | 0) != 0) : 0) {
				if ((c[b + 12 >> 2] | 0) != 0 ? (g = C + 8 | 0, (c[g >> 2] | 0) == 0) : 0) {
					B = c[v >> 2] | 0;
					if (!B) c[h >> 2] = C;
					else c[B + 8 >> 2] = C;
					c[v >> 2] = C;
					c[g >> 2] = C
				}
				if ((u + -1 | 0) >>> 0 >= 2 ? (c[u >> 2] | 0) == (d | 0) : 0) {
					c[D >> 2] = 2;
					D = c[e >> 2] | 0;
					u = D + 8 | 0;
					g = c[u >> 2] | 0;
					if (!g) {
						B = D + 4 | 0;
						m = c[B >> 2] | 0;
						n = c[D >> 2] | 0;
						D = Ec(n << 3 | 4) | 0;
						c[B >> 2] = D;
						x = D + 4 | 0;
						c[u >> 2] = x;
						D = n + -1 | 0;
						if (x >>> 0 < (x + (D << 3) | 0) >>> 0) {
							n = x;
							while (1) {
								y = n + 8 | 0;
								c[n >> 2] = y;
								if (y >>> 0 < ((c[u >> 2] | 0) + (D << 3) | 0) >>> 0) n = y;
								else {
									F = y;
									break
								}
							}
						} else F = x;
						c[F >> 2] = 0;
						c[c[B >> 2] >> 2] = m;
						G = c[u >> 2] | 0
					} else G = g;
					c[u >> 2] = c[G >> 2];
					c[G >> 2] = C;
					n = c[E >> 2] | 0;
					if (!n) c[o >> 2] = G;
					else c[n + 4 >> 2] = G;
					c[E >> 2] = G;
					c[G + 4 >> 2] = 0
				}
			}
			b = c[b + 4 >> 2] | 0
		} while ((b | 0) != 0);
		return
	}

	function uc(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		e = c[d >> 2] | 0;
		if (e) {
			f = b + 72 | 0;
			g = e;
			e = 0;
			h = 2147483647;
			while (1) {
				a: do
					if (((c[(c[g + 8 >> 2] | 0) + 12 >> 2] | 0) != 0 ? (i = c[g >> 2] | 0, (a[i + 20 >> 0] & 1) == 0) : 0) ? (j = c[i + 4 >> 2] | 0, (j | 0) != 0) : 0) {
						k = i + 12 | 0;
						l = c[f >> 2] | 0;
						b: do
							if ((c[k >> 2] | 0) == (l | 0)) {
								m = 0;
								n = i;
								o = 8
							} else {
								p = k;
								q = j;
								r = 0;
								s = i;
								c: while (1) {
									t = r + 1 | 0;
									switch (q | 0) {
										case 2:
											{
												u = e;v = h;
												break a;
												break
											}
										case 1:
											{
												w = p;x = t;y = s;
												break c;
												break
											}
										default:
											{}
									}
									z = c[q >> 2] | 0;
									A = z + 12 | 0;
									if ((c[A >> 2] | 0) == (l | 0)) {
										m = t;
										n = z;
										o = 8;
										break b
									}
									p = A;
									q = c[z + 4 >> 2] | 0;
									r = t;
									s = z
								}
								c[w >> 2] = l;
								c[y + 16 >> 2] = 1;
								B = x
							}
						while (0);
						if ((o | 0) == 8) {
							o = 0;
							B = (c[n + 16 >> 2] | 0) + m | 0
						}
						if ((B | 0) != 2147483647) {
							i = (B | 0) < (h | 0);
							j = i ? g : e;
							k = i ? B : h;
							i = c[g >> 2] | 0;
							s = i + 12 | 0;
							if ((c[s >> 2] | 0) == (l | 0)) {
								u = j;
								v = k
							} else {
								r = s;
								s = B;
								q = i;
								while (1) {
									c[r >> 2] = l;
									c[q + 16 >> 2] = s;
									q = c[c[q + 4 >> 2] >> 2] | 0;
									r = q + 12 | 0;
									if ((c[r >> 2] | 0) == (l | 0)) {
										u = j;
										v = k;
										break
									} else s = s + -1 | 0
								}
							}
						} else {
							u = e;
							v = h
						}
					} else {
						u = e;
						v = h
					}while (0);g = c[g + 4 >> 2] | 0;
				if (!g) {
					C = u;
					D = v;
					break
				} else {
					e = u;
					h = v
				}
			}
			c[d + 4 >> 2] = C;
			if (C) {
				c[d + 12 >> 2] = c[b + 72 >> 2];
				c[d + 16 >> 2] = D + 1;
				return
			}
		} else c[d + 4 >> 2] = 0;
		D = c[b + 44 >> 2] | 0;
		if ((D | 0) != 0 ? (C = d + 20 | 0, (a[C >> 0] & 4) == 0) : 0) {
			v = D + 8 | 0;
			h = c[v >> 2] | 0;
			u = (h | 0) == 0;
			if (!u)
				if (((c[h >> 2] | 0) + 4 | 0) >>> 0 > (c[h + 4 >> 2] | 0) >>> 0) {
					e = c[h + 8 >> 2] | 0;
					if (!e) o = 25;
					else {
						c[v >> 2] = e;
						E = e
					}
				} else E = h;
			else o = 25;
			if ((o | 0) == 25) {
				o = c[D >> 2] | 0;
				e = Ec((o << 2) + 12 | 0) | 0;
				if (u) c[D + 4 >> 2] = e;
				else c[h + 8 >> 2] = e;
				c[v >> 2] = e;
				v = e + 12 | 0;
				c[e >> 2] = v;
				c[e + 4 >> 2] = v + (o << 2);
				c[e + 8 >> 2] = 0;
				E = e
			}
			e = c[E >> 2] | 0;
			c[E >> 2] = e + 4;
			c[e >> 2] = (d - (c[b >> 2] | 0) | 0) / 28 | 0;
			a[C >> 0] = a[C >> 0] | 4
		}
		C = c[d >> 2] | 0;
		if (!C) return;
		e = b + 28 | 0;
		E = b + 68 | 0;
		o = b + 64 | 0;
		v = b + 60 | 0;
		h = b + 52 | 0;
		b = C;
		do {
			C = c[b >> 2] | 0;
			if ((a[C + 20 >> 0] & 1) == 0 ? (D = C + 4 | 0, u = c[D >> 2] | 0, (u | 0) != 0) : 0) {
				if ((c[(c[b + 8 >> 2] | 0) + 12 >> 2] | 0) != 0 ? (g = C + 8 | 0, (c[g >> 2] | 0) == 0) : 0) {
					B = c[v >> 2] | 0;
					if (!B) c[h >> 2] = C;
					else c[B + 8 >> 2] = C;
					c[v >> 2] = C;
					c[g >> 2] = C
				}
				if ((u + -1 | 0) >>> 0 >= 2 ? (c[u >> 2] | 0) == (d | 0) : 0) {
					c[D >> 2] = 2;
					D = c[e >> 2] | 0;
					u = D + 8 | 0;
					g = c[u >> 2] | 0;
					if (!g) {
						B = D + 4 | 0;
						m = c[B >> 2] | 0;
						n = c[D >> 2] | 0;
						D = Ec(n << 3 | 4) | 0;
						c[B >> 2] = D;
						x = D + 4 | 0;
						c[u >> 2] = x;
						D = n + -1 | 0;
						if (x >>> 0 < (x + (D << 3) | 0) >>> 0) {
							n = x;
							while (1) {
								y = n + 8 | 0;
								c[n >> 2] = y;
								if (y >>> 0 < ((c[u >> 2] | 0) + (D << 3) | 0) >>> 0) n = y;
								else {
									F = y;
									break
								}
							}
						} else F = x;
						c[F >> 2] = 0;
						c[c[B >> 2] >> 2] = m;
						G = c[u >> 2] | 0
					} else G = g;
					c[u >> 2] = c[G >> 2];
					c[G >> 2] = C;
					n = c[E >> 2] | 0;
					if (!n) c[o >> 2] = G;
					else c[n + 4 >> 2] = G;
					c[E >> 2] = G;
					c[G + 4 >> 2] = 0
				}
			}
			b = c[b + 4 >> 2] | 0
		} while ((b | 0) != 0);
		return
	}

	function vc(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		c[a + 24 >> 2] = 0;
		c[a + 28 >> 2] = 0;
		c[a + 32 >> 2] = e;
		f = (b | 0) < 16 ? 16 : b;
		b = (d | 0) < 16 ? 16 : d;
		d = qd(f * 28 | 0) | 0;
		c[a >> 2] = d;
		g = qd(b << 5) | 0;
		c[a + 12 >> 2] = g;
		if (!((g | 0) == 0 | (d | 0) == 0)) {
			c[a + 4 >> 2] = d;
			c[a + 8 >> 2] = d + (f * 28 | 0);
			c[a + 16 >> 2] = g;
			c[a + 20 >> 2] = g + (b << 1 << 4);
			c[a + 40 >> 2] = 0;
			c[a + 36 >> 2] = 0;
			return
		}
		if (!e) lb(1);
		tb[e & 127](14674);
		lb(1)
	}

	function wc(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0;
		b = a + 28 | 0;
		d = c[b >> 2] | 0;
		if (d) {
			e = d + 4 | 0;
			f = c[e >> 2] | 0;
			if (f) {
				g = f;
				do {
					f = g;
					g = c[g >> 2] | 0;
					Gc(f);
					c[e >> 2] = g
				} while ((g | 0) != 0)
			}
			Fc(d);
			c[b >> 2] = 0
		}
		rd(c[a >> 2] | 0);
		rd(c[a + 12 >> 2] | 0);
		return
	}

	function xc(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		d = a + 8 | 0;
		e = c[a >> 2] | 0;
		f = e;
		g = (c[d >> 2] | 0) - f | 0;
		h = ((g | 0) / 56 | 0) + ((g | 0) / 28 | 0) | 0;
		g = a + 24 | 0;
		i = (c[g >> 2] | 0) + b | 0;
		b = (h | 0) < (i | 0) ? i : h;
		h = td(e, b * 28 | 0) | 0;
		c[a >> 2] = h;
		i = h;
		if (!h) {
			j = c[a + 32 >> 2] | 0;
			if (!j) lb(1);
			tb[j & 127](14674);
			lb(1)
		}
		c[a + 4 >> 2] = h + ((c[g >> 2] | 0) * 28 | 0);
		c[d >> 2] = h + (b * 28 | 0);
		if ((h | 0) == (e | 0)) return;
		e = c[a + 12 >> 2] | 0;
		h = c[a + 16 >> 2] | 0;
		if (e >>> 0 >= h >>> 0) return;
		a = i - f | 0;
		f = e;
		do {
			c[f >> 2] = (c[f >> 2] | 0) + a;
			f = f + 16 | 0
		} while (f >>> 0 < h >>> 0);
		return
	}

	function yc(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		b = a + 20 | 0;
		d = a + 12 | 0;
		e = c[d >> 2] | 0;
		f = e;
		g = (c[b >> 2] | 0) - f >> 4;
		h = a + 16 | 0;
		i = c[h >> 2] | 0;
		j = g + ((g | 0) / 2 | 0) | 0;
		g = (j & 1) + j | 0;
		j = td(e, g << 4) | 0;
		c[d >> 2] = j;
		d = j;
		if (!j) {
			k = c[a + 32 >> 2] | 0;
			if (!k) lb(1);
			tb[k & 127](14674);
			lb(1)
		}
		k = j + (i - f >> 4 << 4) | 0;
		c[h >> 2] = k;
		c[b >> 2] = j + (g << 4);
		if ((j | 0) == (e | 0)) return;
		e = c[a >> 2] | 0;
		g = c[a + 4 >> 2] | 0;
		if (e >>> 0 < g >>> 0) {
			a = d - f | 0;
			b = e;
			do {
				e = c[b >> 2] | 0;
				if (e) c[b >> 2] = e + a;
				b = b + 28 | 0
			} while (b >>> 0 < g >>> 0)
		}
		if (j >>> 0 >= k >>> 0) return;
		g = d - f | 0;
		f = j;
		do {
			j = f + 4 | 0;
			d = c[j >> 2] | 0;
			if (d) c[j >> 2] = d + g;
			d = f + 8 | 0;
			c[d >> 2] = (c[d >> 2] | 0) + g;
			f = f + 16 | 0
		} while (f >>> 0 < k >>> 0);
		return
	}

	function zc(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0;
		d = i;
		i = i + 16 | 0;
		e = d;
		c[e >> 2] = b;
		b = c[771] | 0;
		Ee(b, a, e) | 0;
		ve(10, b) | 0;
		Aa()
	}

	function Ac(a) {
		a = a | 0;
		Da(14944, 14973, 1164, 15061)
	}

	function Bc(a) {
		a = a | 0;
		Da(15082, 15105, 303, 15061)
	}

	function Cc() {
		var a = 0,
			b = 0;
		a = i;
		i = i + 16 | 0;
		if (!(Va(2828, 2) | 0)) {
			b = Ra(c[706] | 0) | 0;
			i = a;
			return b | 0
		} else zc(15193, a);
		return 0
	}

	function Dc(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0;
		b = (a | 0) == 0 ? 1 : a;
		a = qd(b) | 0;
		a: do
			if (!a) {
				while (1) {
					d = Nc() | 0;
					if (!d) break;
					zb[d & 3]();
					d = qd(b) | 0;
					if (d) {
						e = d;
						break a
					}
				}
				d = Ea(4) | 0;
				c[d >> 2] = 2688;
				cb(d | 0, 40, 23)
			} else e = a; while (0);
		return e | 0
	}

	function Ec(a) {
		a = a | 0;
		return Dc(a) | 0
	}

	function Fc(a) {
		a = a | 0;
		rd(a);
		return
	}

	function Gc(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Hc(a) {
		a = a | 0;
		c[a >> 2] = 2688;
		return
	}

	function Ic(a) {
		a = a | 0;
		return
	}

	function Jc(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Kc(a) {
		a = a | 0;
		return 15242
	}

	function Lc(a) {
		a = a | 0;
		var b = 0;
		b = i;
		i = i + 16 | 0;
		zb[a & 3]();
		zc(15257, b)
	}

	function Mc() {
		var a = 0,
			b = 0;
		a = Cc() | 0;
		if (((a | 0) != 0 ? (b = c[a >> 2] | 0, (b | 0) != 0) : 0) ? (a = b + 48 | 0, (c[a >> 2] & -256 | 0) == 1126902528 ? (c[a + 4 >> 2] | 0) == 1129074247 : 0) : 0) Lc(c[b + 12 >> 2] | 0);
		b = c[669] | 0;
		c[669] = b + 0;
		Lc(b)
	}

	function Nc() {
		var a = 0;
		a = c[675] | 0;
		c[675] = a + 0;
		return a | 0
	}

	function Oc(a) {
		a = a | 0;
		return
	}

	function Pc(a) {
		a = a | 0;
		return
	}

	function Qc(a) {
		a = a | 0;
		return
	}

	function Rc(a) {
		a = a | 0;
		return
	}

	function Sc(a) {
		a = a | 0;
		return
	}

	function Tc(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Uc(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Vc(a) {
		a = a | 0;
		Fc(a);
		return
	}

	function Wc(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0;
		e = i;
		i = i + 64 | 0;
		f = e;
		if ((a | 0) != (b | 0))
			if ((b | 0) != 0 ? (g = ad(b, 72, 88, 0) | 0, (g | 0) != 0) : 0) {
				b = f;
				h = b + 56 | 0;
				do {
					c[b >> 2] = 0;
					b = b + 4 | 0
				} while ((b | 0) < (h | 0));
				c[f >> 2] = g;
				c[f + 8 >> 2] = a;
				c[f + 12 >> 2] = -1;
				c[f + 48 >> 2] = 1;
				Fb[c[(c[g >> 2] | 0) + 28 >> 2] & 15](g, f, c[d >> 2] | 0, 1);
				if ((c[f + 24 >> 2] | 0) == 1) {
					c[d >> 2] = c[f + 16 >> 2];
					j = 1
				} else j = 0;
				k = j
			} else k = 0;
		else k = 1;
		i = e;
		return k | 0
	}

	function Xc(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0;
		b = d + 16 | 0;
		g = c[b >> 2] | 0;
		do
			if (g) {
				if ((g | 0) != (e | 0)) {
					h = d + 36 | 0;
					c[h >> 2] = (c[h >> 2] | 0) + 1;
					c[d + 24 >> 2] = 2;
					a[d + 54 >> 0] = 1;
					break
				}
				h = d + 24 | 0;
				if ((c[h >> 2] | 0) == 2) c[h >> 2] = f
			} else {
				c[b >> 2] = e;
				c[d + 24 >> 2] = f;
				c[d + 36 >> 2] = 1
			}
		while (0);
		return
	}

	function Yc(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		if ((a | 0) == (c[b + 8 >> 2] | 0)) Xc(0, b, d, e);
		return
	}

	function Zc(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		if ((a | 0) == (c[b + 8 >> 2] | 0)) Xc(0, b, d, e);
		else {
			f = c[a + 8 >> 2] | 0;
			Fb[c[(c[f >> 2] | 0) + 28 >> 2] & 15](f, b, d, e)
		}
		return
	}

	function _c(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0;
		f = c[a + 4 >> 2] | 0;
		g = f >> 8;
		if (!(f & 1)) h = g;
		else h = c[(c[d >> 2] | 0) + g >> 2] | 0;
		g = c[a >> 2] | 0;
		Fb[c[(c[g >> 2] | 0) + 28 >> 2] & 15](g, b, d + h | 0, (f & 2 | 0) != 0 ? e : 2);
		return
	}

	function $c(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0;
		a: do
			if ((b | 0) != (c[d + 8 >> 2] | 0)) {
				g = c[b + 12 >> 2] | 0;
				h = b + 16 + (g << 3) | 0;
				_c(b + 16 | 0, d, e, f);
				if ((g | 0) > 1) {
					g = d + 54 | 0;
					i = b + 24 | 0;
					do {
						_c(i, d, e, f);
						if (a[g >> 0] | 0) break a;
						i = i + 8 | 0
					} while (i >>> 0 < h >>> 0)
				}
			} else Xc(0, d, e, f); while (0);
		return
	}

	function ad(d, e, f, g) {
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0;
		h = i;
		i = i + 64 | 0;
		j = h;
		k = c[d >> 2] | 0;
		l = d + (c[k + -8 >> 2] | 0) | 0;
		m = c[k + -4 >> 2] | 0;
		c[j >> 2] = f;
		c[j + 4 >> 2] = d;
		c[j + 8 >> 2] = e;
		c[j + 12 >> 2] = g;
		g = j + 16 | 0;
		e = j + 20 | 0;
		d = j + 24 | 0;
		k = j + 28 | 0;
		n = j + 32 | 0;
		o = j + 40 | 0;
		p = (m | 0) == (f | 0);
		q = g;
		r = q + 36 | 0;
		do {
			c[q >> 2] = 0;
			q = q + 4 | 0
		} while ((q | 0) < (r | 0));
		b[g + 36 >> 1] = 0;
		a[g + 38 >> 0] = 0;
		a: do
			if (p) {
				c[j + 48 >> 2] = 1;
				Cb[c[(c[f >> 2] | 0) + 20 >> 2] & 15](f, j, l, l, 1, 0);
				s = (c[d >> 2] | 0) == 1 ? l : 0
			} else {
				rb[c[(c[m >> 2] | 0) + 24 >> 2] & 3](m, j, l, 1, 0);
				switch (c[j + 36 >> 2] | 0) {
					case 0:
						{
							s = (c[o >> 2] | 0) == 1 & (c[k >> 2] | 0) == 1 & (c[n >> 2] | 0) == 1 ? c[e >> 2] | 0 : 0;
							break a;
							break
						}
					case 1:
						break;
					default:
						{
							s = 0;
							break a
						}
				}
				if ((c[d >> 2] | 0) != 1 ? !((c[o >> 2] | 0) == 0 & (c[k >> 2] | 0) == 1 & (c[n >> 2] | 0) == 1) : 0) {
					s = 0;
					break
				}
				s = c[g >> 2] | 0
			}
		while (0);
		i = h;
		return s | 0
	}

	function bd(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0;
		a[d + 53 >> 0] = 1;
		do
			if ((c[d + 4 >> 2] | 0) == (f | 0)) {
				a[d + 52 >> 0] = 1;
				b = d + 16 | 0;
				h = c[b >> 2] | 0;
				if (!h) {
					c[b >> 2] = e;
					c[d + 24 >> 2] = g;
					c[d + 36 >> 2] = 1;
					if (!((g | 0) == 1 ? (c[d + 48 >> 2] | 0) == 1 : 0)) break;
					a[d + 54 >> 0] = 1;
					break
				}
				if ((h | 0) != (e | 0)) {
					h = d + 36 | 0;
					c[h >> 2] = (c[h >> 2] | 0) + 1;
					a[d + 54 >> 0] = 1;
					break
				}
				h = d + 24 | 0;
				b = c[h >> 2] | 0;
				if ((b | 0) == 2) {
					c[h >> 2] = g;
					i = g
				} else i = b;
				if ((i | 0) == 1 ? (c[d + 48 >> 2] | 0) == 1 : 0) a[d + 54 >> 0] = 1
			}
		while (0);
		return
	}

	function cd(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0;
		a: do
			if ((b | 0) == (c[d + 8 >> 2] | 0)) {
				if ((c[d + 4 >> 2] | 0) == (e | 0) ? (h = d + 28 | 0, (c[h >> 2] | 0) != 1) : 0) c[h >> 2] = f
			} else {
				if ((b | 0) != (c[d >> 2] | 0)) {
					h = c[b + 12 >> 2] | 0;
					i = b + 16 + (h << 3) | 0;
					ed(b + 16 | 0, d, e, f, g);
					j = b + 24 | 0;
					if ((h | 0) <= 1) break;
					h = c[b + 8 >> 2] | 0;
					if ((h & 2 | 0) == 0 ? (k = d + 36 | 0, (c[k >> 2] | 0) != 1) : 0) {
						if (!(h & 1)) {
							h = d + 54 | 0;
							l = j;
							while (1) {
								if (a[h >> 0] | 0) break a;
								if ((c[k >> 2] | 0) == 1) break a;
								ed(l, d, e, f, g);
								l = l + 8 | 0;
								if (l >>> 0 >= i >>> 0) break a
							}
						}
						l = d + 24 | 0;
						h = d + 54 | 0;
						m = j;
						while (1) {
							if (a[h >> 0] | 0) break a;
							if ((c[k >> 2] | 0) == 1 ? (c[l >> 2] | 0) == 1 : 0) break a;
							ed(m, d, e, f, g);
							m = m + 8 | 0;
							if (m >>> 0 >= i >>> 0) break a
						}
					}
					m = d + 54 | 0;
					l = j;
					while (1) {
						if (a[m >> 0] | 0) break a;
						ed(l, d, e, f, g);
						l = l + 8 | 0;
						if (l >>> 0 >= i >>> 0) break a
					}
				}
				if ((c[d + 16 >> 2] | 0) != (e | 0) ? (i = d + 20 | 0, (c[i >> 2] | 0) != (e | 0)) : 0) {
					c[d + 32 >> 2] = f;
					l = d + 44 | 0;
					if ((c[l >> 2] | 0) == 4) break;
					m = c[b + 12 >> 2] | 0;
					j = b + 16 + (m << 3) | 0;
					k = d + 52 | 0;
					h = d + 53 | 0;
					n = d + 54 | 0;
					o = b + 8 | 0;
					p = d + 24 | 0;
					b: do
						if ((m | 0) > 0) {
							q = 0;
							r = 0;
							s = b + 16 | 0;
							while (1) {
								a[k >> 0] = 0;
								a[h >> 0] = 0;
								dd(s, d, e, e, 1, g);
								if (a[n >> 0] | 0) {
									t = q;
									u = r;
									v = 20;
									break b
								}
								do
									if (a[h >> 0] | 0) {
										if (!(a[k >> 0] | 0))
											if (!(c[o >> 2] & 1)) {
												t = q;
												u = 1;
												v = 20;
												break b
											} else {
												w = q;
												x = 1;
												break
											}
										if ((c[p >> 2] | 0) == 1) break b;
										if (!(c[o >> 2] & 2)) break b;
										else {
											w = 1;
											x = 1
										}
									} else {
										w = q;
										x = r
									}
								while (0);
								s = s + 8 | 0;
								if (s >>> 0 >= j >>> 0) {
									t = w;
									u = x;
									v = 20;
									break
								} else {
									q = w;
									r = x
								}
							}
						} else {
							t = 0;
							u = 0;
							v = 20
						}
					while (0);
					do
						if ((v | 0) == 20) {
							if ((!t ? (c[i >> 2] = e, j = d + 40 | 0, c[j >> 2] = (c[j >> 2] | 0) + 1, (c[d + 36 >> 2] | 0) == 1) : 0) ? (c[p >> 2] | 0) == 2 : 0) {
								a[n >> 0] = 1;
								if (u) break
							} else v = 24;
							if ((v | 0) == 24 ? u : 0) break;
							c[l >> 2] = 4;
							break a
						}
					while (0);
					c[l >> 2] = 3;
					break
				}
				if ((f | 0) == 1) c[d + 32 >> 2] = 1
			}
		while (0);
		return
	}

	function dd(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0;
		h = c[a + 4 >> 2] | 0;
		i = h >> 8;
		if (!(h & 1)) j = i;
		else j = c[(c[e >> 2] | 0) + i >> 2] | 0;
		i = c[a >> 2] | 0;
		Cb[c[(c[i >> 2] | 0) + 20 >> 2] & 15](i, b, d, e + j | 0, (h & 2 | 0) != 0 ? f : 2, g);
		return
	}

	function ed(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0;
		g = c[a + 4 >> 2] | 0;
		h = g >> 8;
		if (!(g & 1)) i = h;
		else i = c[(c[d >> 2] | 0) + h >> 2] | 0;
		h = c[a >> 2] | 0;
		rb[c[(c[h >> 2] | 0) + 24 >> 2] & 3](h, b, d + i | 0, (g & 2 | 0) != 0 ? e : 2, f);
		return
	}

	function fd(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		a: do
			if ((b | 0) == (c[d + 8 >> 2] | 0)) {
				if ((c[d + 4 >> 2] | 0) == (e | 0) ? (h = d + 28 | 0, (c[h >> 2] | 0) != 1) : 0) c[h >> 2] = f
			} else {
				if ((b | 0) != (c[d >> 2] | 0)) {
					h = c[b + 8 >> 2] | 0;
					rb[c[(c[h >> 2] | 0) + 24 >> 2] & 3](h, d, e, f, g);
					break
				}
				if ((c[d + 16 >> 2] | 0) != (e | 0) ? (h = d + 20 | 0, (c[h >> 2] | 0) != (e | 0)) : 0) {
					c[d + 32 >> 2] = f;
					i = d + 44 | 0;
					if ((c[i >> 2] | 0) == 4) break;
					j = d + 52 | 0;
					a[j >> 0] = 0;
					k = d + 53 | 0;
					a[k >> 0] = 0;
					l = c[b + 8 >> 2] | 0;
					Cb[c[(c[l >> 2] | 0) + 20 >> 2] & 15](l, d, e, e, 1, g);
					if (a[k >> 0] | 0) {
						if (!(a[j >> 0] | 0)) {
							m = 1;
							n = 13
						}
					} else {
						m = 0;
						n = 13
					}
					do
						if ((n | 0) == 13) {
							c[h >> 2] = e;
							j = d + 40 | 0;
							c[j >> 2] = (c[j >> 2] | 0) + 1;
							if ((c[d + 36 >> 2] | 0) == 1 ? (c[d + 24 >> 2] | 0) == 2 : 0) {
								a[d + 54 >> 0] = 1;
								if (m) break
							} else n = 16;
							if ((n | 0) == 16 ? m : 0) break;
							c[i >> 2] = 4;
							break a
						}
					while (0);
					c[i >> 2] = 3;
					break
				}
				if ((f | 0) == 1) c[d + 32 >> 2] = 1
			}
		while (0);
		return
	}

	function gd(b, d, e, f, g) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		do
			if ((b | 0) == (c[d + 8 >> 2] | 0)) {
				if ((c[d + 4 >> 2] | 0) == (e | 0) ? (g = d + 28 | 0, (c[g >> 2] | 0) != 1) : 0) c[g >> 2] = f
			} else if ((b | 0) == (c[d >> 2] | 0)) {
			if ((c[d + 16 >> 2] | 0) != (e | 0) ? (g = d + 20 | 0, (c[g >> 2] | 0) != (e | 0)) : 0) {
				c[d + 32 >> 2] = f;
				c[g >> 2] = e;
				g = d + 40 | 0;
				c[g >> 2] = (c[g >> 2] | 0) + 1;
				if ((c[d + 36 >> 2] | 0) == 1 ? (c[d + 24 >> 2] | 0) == 2 : 0) a[d + 54 >> 0] = 1;
				c[d + 44 >> 2] = 4;
				break
			}
			if ((f | 0) == 1) c[d + 32 >> 2] = 1
		} while (0);
		return
	}

	function hd(b, d, e, f, g, h) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		if ((b | 0) == (c[d + 8 >> 2] | 0)) bd(0, d, e, f, g);
		else {
			i = d + 52 | 0;
			j = a[i >> 0] | 0;
			k = d + 53 | 0;
			l = a[k >> 0] | 0;
			m = c[b + 12 >> 2] | 0;
			n = b + 16 + (m << 3) | 0;
			a[i >> 0] = 0;
			a[k >> 0] = 0;
			dd(b + 16 | 0, d, e, f, g, h);
			a: do
				if ((m | 0) > 1) {
					o = d + 24 | 0;
					p = b + 8 | 0;
					q = d + 54 | 0;
					r = b + 24 | 0;
					do {
						if (a[q >> 0] | 0) break a;
						if (!(a[i >> 0] | 0)) {
							if ((a[k >> 0] | 0) != 0 ? (c[p >> 2] & 1 | 0) == 0 : 0) break a
						} else {
							if ((c[o >> 2] | 0) == 1) break a;
							if (!(c[p >> 2] & 2)) break a
						}
						a[i >> 0] = 0;
						a[k >> 0] = 0;
						dd(r, d, e, f, g, h);
						r = r + 8 | 0
					} while (r >>> 0 < n >>> 0)
				}
			while (0);
			a[i >> 0] = j;
			a[k >> 0] = l
		}
		return
	}

	function id(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0;
		if ((a | 0) == (c[b + 8 >> 2] | 0)) bd(0, b, d, e, f);
		else {
			h = c[a + 8 >> 2] | 0;
			Cb[c[(c[h >> 2] | 0) + 20 >> 2] & 15](h, b, d, e, f, g)
		}
		return
	}

	function jd(a, b, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		if ((a | 0) == (c[b + 8 >> 2] | 0)) bd(0, b, d, e, f);
		return
	}

	function kd(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		c[f >> 2] = c[d >> 2];
		g = qb[c[(c[a >> 2] | 0) + 16 >> 2] & 31](a, b, f) | 0;
		if (g) c[d >> 2] = c[f >> 2];
		i = e;
		return g & 1 | 0
	}

	function ld(a) {
		a = a | 0;
		var b = 0;
		if (!a) b = 0;
		else b = (ad(a, 72, 120, 0) | 0) != 0;
		return b & 1 | 0
	}

	function md() {
		var a = 0;
		a = Ea(4) | 0;
		Hc(a);
		cb(a | 0, 40, 23)
	}

	function nd() {
		var a = 0,
			b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0;
		a = i;
		i = i + 48 | 0;
		b = a + 32 | 0;
		d = a + 24 | 0;
		e = a + 16 | 0;
		f = a;
		g = a + 36 | 0;
		a = Cc() | 0;
		if ((a | 0) != 0 ? (h = c[a >> 2] | 0, (h | 0) != 0) : 0) {
			a = h + 48 | 0;
			j = c[a >> 2] | 0;
			k = c[a + 4 >> 2] | 0;
			if (!((j & -256 | 0) == 1126902528 & (k | 0) == 1129074247)) {
				c[d >> 2] = c[708];
				zc(15486, d)
			}
			if ((j | 0) == 1126902529 & (k | 0) == 1129074247) l = c[h + 44 >> 2] | 0;
			else l = h + 80 | 0;
			c[g >> 2] = l;
			l = c[h >> 2] | 0;
			h = c[l + 4 >> 2] | 0;
			if (qb[c[(c[56 >> 2] | 0) + 16 >> 2] & 31](56, l, g) | 0) {
				l = c[g >> 2] | 0;
				g = c[708] | 0;
				k = xb[c[(c[l >> 2] | 0) + 8 >> 2] & 63](l) | 0;
				c[f >> 2] = g;
				c[f + 4 >> 2] = h;
				c[f + 8 >> 2] = k;
				zc(15400, f)
			} else {
				c[e >> 2] = c[708];
				c[e + 4 >> 2] = h;
				zc(15445, e)
			}
		}
		zc(15524, b)
	}

	function od() {
		var a = 0;
		a = i;
		i = i + 16 | 0;
		if (!(za(2824, 108) | 0)) {
			i = a;
			return
		} else zc(15297, a)
	}

	function pd(a) {
		a = a | 0;
		var b = 0;
		b = i;
		i = i + 16 | 0;
		rd(a);
		if (!(ab(c[706] | 0, 0) | 0)) {
			i = b;
			return
		} else zc(15347, b)
	}

	function qd(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0,
			wa = 0,
			xa = 0,
			ya = 0,
			za = 0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0,
			Ua = 0;
		do
			if (a >>> 0 < 245) {
				b = a >>> 0 < 11 ? 16 : a + 11 & -8;
				d = b >>> 3;
				e = c[775] | 0;
				f = e >>> d;
				if (f & 3) {
					g = (f & 1 ^ 1) + d | 0;
					h = g << 1;
					i = 3140 + (h << 2) | 0;
					j = 3140 + (h + 2 << 2) | 0;
					h = c[j >> 2] | 0;
					k = h + 8 | 0;
					l = c[k >> 2] | 0;
					do
						if ((i | 0) == (l | 0)) c[775] = e & ~(1 << g);
						else {
							if (l >>> 0 >= (c[779] | 0) >>> 0 ? (m = l + 12 | 0, (c[m >> 2] | 0) == (h | 0)) : 0) {
								c[m >> 2] = i;
								c[j >> 2] = l;
								break
							}
							Aa()
						}
					while (0);
					l = g << 3;
					c[h + 4 >> 2] = l | 3;
					j = h + (l | 4) | 0;
					c[j >> 2] = c[j >> 2] | 1;
					n = k;
					break
				}
				j = c[777] | 0;
				if (b >>> 0 > j >>> 0) {
					if (f) {
						l = 2 << d;
						i = f << d & (l | 0 - l);
						l = (i & 0 - i) + -1 | 0;
						i = l >>> 12 & 16;
						m = l >>> i;
						l = m >>> 5 & 8;
						o = m >>> l;
						m = o >>> 2 & 4;
						p = o >>> m;
						o = p >>> 1 & 2;
						q = p >>> o;
						p = q >>> 1 & 1;
						r = (l | i | m | o | p) + (q >>> p) | 0;
						p = r << 1;
						q = 3140 + (p << 2) | 0;
						o = 3140 + (p + 2 << 2) | 0;
						p = c[o >> 2] | 0;
						m = p + 8 | 0;
						i = c[m >> 2] | 0;
						do
							if ((q | 0) == (i | 0)) {
								c[775] = e & ~(1 << r);
								s = j
							} else {
								if (i >>> 0 >= (c[779] | 0) >>> 0 ? (l = i + 12 | 0, (c[l >> 2] | 0) == (p | 0)) : 0) {
									c[l >> 2] = q;
									c[o >> 2] = i;
									s = c[777] | 0;
									break
								}
								Aa()
							}
						while (0);
						i = r << 3;
						o = i - b | 0;
						c[p + 4 >> 2] = b | 3;
						q = p + b | 0;
						c[p + (b | 4) >> 2] = o | 1;
						c[p + i >> 2] = o;
						if (s) {
							i = c[780] | 0;
							j = s >>> 3;
							e = j << 1;
							d = 3140 + (e << 2) | 0;
							f = c[775] | 0;
							k = 1 << j;
							if (f & k) {
								j = 3140 + (e + 2 << 2) | 0;
								h = c[j >> 2] | 0;
								if (h >>> 0 < (c[779] | 0) >>> 0) Aa();
								else {
									t = j;
									u = h
								}
							} else {
								c[775] = f | k;
								t = 3140 + (e + 2 << 2) | 0;
								u = d
							}
							c[t >> 2] = i;
							c[u + 12 >> 2] = i;
							c[i + 8 >> 2] = u;
							c[i + 12 >> 2] = d
						}
						c[777] = o;
						c[780] = q;
						n = m;
						break
					}
					q = c[776] | 0;
					if (q) {
						o = (q & 0 - q) + -1 | 0;
						q = o >>> 12 & 16;
						d = o >>> q;
						o = d >>> 5 & 8;
						i = d >>> o;
						d = i >>> 2 & 4;
						e = i >>> d;
						i = e >>> 1 & 2;
						k = e >>> i;
						e = k >>> 1 & 1;
						f = c[3404 + ((o | q | d | i | e) + (k >>> e) << 2) >> 2] | 0;
						e = (c[f + 4 >> 2] & -8) - b | 0;
						k = f;
						i = f;
						while (1) {
							f = c[k + 16 >> 2] | 0;
							if (!f) {
								d = c[k + 20 >> 2] | 0;
								if (!d) {
									v = e;
									w = i;
									break
								} else x = d
							} else x = f;
							f = (c[x + 4 >> 2] & -8) - b | 0;
							d = f >>> 0 < e >>> 0;
							e = d ? f : e;
							k = x;
							i = d ? x : i
						}
						i = c[779] | 0;
						if (w >>> 0 >= i >>> 0 ? (k = w + b | 0, w >>> 0 < k >>> 0) : 0) {
							e = c[w + 24 >> 2] | 0;
							m = c[w + 12 >> 2] | 0;
							do
								if ((m | 0) == (w | 0)) {
									p = w + 20 | 0;
									r = c[p >> 2] | 0;
									if (!r) {
										d = w + 16 | 0;
										f = c[d >> 2] | 0;
										if (!f) {
											y = 0;
											break
										} else {
											z = f;
											A = d
										}
									} else {
										z = r;
										A = p
									}
									while (1) {
										p = z + 20 | 0;
										r = c[p >> 2] | 0;
										if (r) {
											z = r;
											A = p;
											continue
										}
										p = z + 16 | 0;
										r = c[p >> 2] | 0;
										if (!r) {
											B = z;
											C = A;
											break
										} else {
											z = r;
											A = p
										}
									}
									if (C >>> 0 < i >>> 0) Aa();
									else {
										c[C >> 2] = 0;
										y = B;
										break
									}
								} else {
									p = c[w + 8 >> 2] | 0;
									if ((p >>> 0 >= i >>> 0 ? (r = p + 12 | 0, (c[r >> 2] | 0) == (w | 0)) : 0) ? (d = m + 8 | 0, (c[d >> 2] | 0) == (w | 0)) : 0) {
										c[r >> 2] = m;
										c[d >> 2] = p;
										y = m;
										break
									}
									Aa()
								}
							while (0);
							do
								if (e) {
									m = c[w + 28 >> 2] | 0;
									i = 3404 + (m << 2) | 0;
									if ((w | 0) == (c[i >> 2] | 0)) {
										c[i >> 2] = y;
										if (!y) {
											c[776] = c[776] & ~(1 << m);
											break
										}
									} else {
										if (e >>> 0 < (c[779] | 0) >>> 0) Aa();
										m = e + 16 | 0;
										if ((c[m >> 2] | 0) == (w | 0)) c[m >> 2] = y;
										else c[e + 20 >> 2] = y;
										if (!y) break
									}
									m = c[779] | 0;
									if (y >>> 0 < m >>> 0) Aa();
									c[y + 24 >> 2] = e;
									i = c[w + 16 >> 2] | 0;
									do
										if (i)
											if (i >>> 0 < m >>> 0) Aa();
											else {
												c[y + 16 >> 2] = i;
												c[i + 24 >> 2] = y;
												break
											}
									while (0);
									i = c[w + 20 >> 2] | 0;
									if (i)
										if (i >>> 0 < (c[779] | 0) >>> 0) Aa();
										else {
											c[y + 20 >> 2] = i;
											c[i + 24 >> 2] = y;
											break
										}
								}
							while (0);
							if (v >>> 0 < 16) {
								e = v + b | 0;
								c[w + 4 >> 2] = e | 3;
								i = w + (e + 4) | 0;
								c[i >> 2] = c[i >> 2] | 1
							} else {
								c[w + 4 >> 2] = b | 3;
								c[w + (b | 4) >> 2] = v | 1;
								c[w + (v + b) >> 2] = v;
								i = c[777] | 0;
								if (i) {
									e = c[780] | 0;
									m = i >>> 3;
									i = m << 1;
									p = 3140 + (i << 2) | 0;
									d = c[775] | 0;
									r = 1 << m;
									if (d & r) {
										m = 3140 + (i + 2 << 2) | 0;
										f = c[m >> 2] | 0;
										if (f >>> 0 < (c[779] | 0) >>> 0) Aa();
										else {
											D = m;
											E = f
										}
									} else {
										c[775] = d | r;
										D = 3140 + (i + 2 << 2) | 0;
										E = p
									}
									c[D >> 2] = e;
									c[E + 12 >> 2] = e;
									c[e + 8 >> 2] = E;
									c[e + 12 >> 2] = p
								}
								c[777] = v;
								c[780] = k
							}
							n = w + 8 | 0;
							break
						}
						Aa()
					} else {
						F = b;
						G = 154
					}
				} else {
					F = b;
					G = 154
				}
			} else if (a >>> 0 <= 4294967231) {
			p = a + 11 | 0;
			e = p & -8;
			i = c[776] | 0;
			if (i) {
				r = 0 - e | 0;
				d = p >>> 8;
				if (d)
					if (e >>> 0 > 16777215) H = 31;
					else {
						p = (d + 1048320 | 0) >>> 16 & 8;
						f = d << p;
						d = (f + 520192 | 0) >>> 16 & 4;
						m = f << d;
						f = (m + 245760 | 0) >>> 16 & 2;
						q = 14 - (d | p | f) + (m << f >>> 15) | 0;
						H = e >>> (q + 7 | 0) & 1 | q << 1
					}
				else H = 0;
				q = c[3404 + (H << 2) >> 2] | 0;
				a: do
					if (!q) {
						I = r;
						J = 0;
						K = 0;
						G = 86
					} else {
						f = r;
						m = 0;
						p = e << ((H | 0) == 31 ? 0 : 25 - (H >>> 1) | 0);
						d = q;
						o = 0;
						while (1) {
							h = c[d + 4 >> 2] & -8;
							j = h - e | 0;
							if (j >>> 0 < f >>> 0)
								if ((h | 0) == (e | 0)) {
									L = j;
									M = d;
									N = d;
									G = 90;
									break a
								} else {
									O = j;
									P = d
								}
							else {
								O = f;
								P = o
							}
							j = c[d + 20 >> 2] | 0;
							d = c[d + 16 + (p >>> 31 << 2) >> 2] | 0;
							h = (j | 0) == 0 | (j | 0) == (d | 0) ? m : j;
							if (!d) {
								I = O;
								J = h;
								K = P;
								G = 86;
								break
							} else {
								f = O;
								m = h;
								p = p << 1;
								o = P
							}
						}
					}
				while (0);
				if ((G | 0) == 86) {
					if ((J | 0) == 0 & (K | 0) == 0) {
						q = 2 << H;
						r = i & (q | 0 - q);
						if (!r) {
							F = e;
							G = 154;
							break
						}
						q = (r & 0 - r) + -1 | 0;
						r = q >>> 12 & 16;
						b = q >>> r;
						q = b >>> 5 & 8;
						k = b >>> q;
						b = k >>> 2 & 4;
						o = k >>> b;
						k = o >>> 1 & 2;
						p = o >>> k;
						o = p >>> 1 & 1;
						Q = c[3404 + ((q | r | b | k | o) + (p >>> o) << 2) >> 2] | 0;
						R = 0
					} else {
						Q = J;
						R = K
					}
					if (!Q) {
						S = I;
						T = R
					} else {
						L = I;
						M = Q;
						N = R;
						G = 90
					}
				}
				if ((G | 0) == 90)
					while (1) {
						G = 0;
						o = (c[M + 4 >> 2] & -8) - e | 0;
						p = o >>> 0 < L >>> 0;
						k = p ? o : L;
						o = p ? M : N;
						p = c[M + 16 >> 2] | 0;
						if (p) {
							L = k;
							M = p;
							N = o;
							G = 90;
							continue
						}
						M = c[M + 20 >> 2] | 0;
						if (!M) {
							S = k;
							T = o;
							break
						} else {
							L = k;
							N = o;
							G = 90
						}
					}
				if ((T | 0) != 0 ? S >>> 0 < ((c[777] | 0) - e | 0) >>> 0 : 0) {
					i = c[779] | 0;
					if (T >>> 0 >= i >>> 0 ? (o = T + e | 0, T >>> 0 < o >>> 0) : 0) {
						k = c[T + 24 >> 2] | 0;
						p = c[T + 12 >> 2] | 0;
						do
							if ((p | 0) == (T | 0)) {
								b = T + 20 | 0;
								r = c[b >> 2] | 0;
								if (!r) {
									q = T + 16 | 0;
									m = c[q >> 2] | 0;
									if (!m) {
										U = 0;
										break
									} else {
										V = m;
										W = q
									}
								} else {
									V = r;
									W = b
								}
								while (1) {
									b = V + 20 | 0;
									r = c[b >> 2] | 0;
									if (r) {
										V = r;
										W = b;
										continue
									}
									b = V + 16 | 0;
									r = c[b >> 2] | 0;
									if (!r) {
										X = V;
										Y = W;
										break
									} else {
										V = r;
										W = b
									}
								}
								if (Y >>> 0 < i >>> 0) Aa();
								else {
									c[Y >> 2] = 0;
									U = X;
									break
								}
							} else {
								b = c[T + 8 >> 2] | 0;
								if ((b >>> 0 >= i >>> 0 ? (r = b + 12 | 0, (c[r >> 2] | 0) == (T | 0)) : 0) ? (q = p + 8 | 0, (c[q >> 2] | 0) == (T | 0)) : 0) {
									c[r >> 2] = p;
									c[q >> 2] = b;
									U = p;
									break
								}
								Aa()
							}
						while (0);
						do
							if (k) {
								p = c[T + 28 >> 2] | 0;
								i = 3404 + (p << 2) | 0;
								if ((T | 0) == (c[i >> 2] | 0)) {
									c[i >> 2] = U;
									if (!U) {
										c[776] = c[776] & ~(1 << p);
										break
									}
								} else {
									if (k >>> 0 < (c[779] | 0) >>> 0) Aa();
									p = k + 16 | 0;
									if ((c[p >> 2] | 0) == (T | 0)) c[p >> 2] = U;
									else c[k + 20 >> 2] = U;
									if (!U) break
								}
								p = c[779] | 0;
								if (U >>> 0 < p >>> 0) Aa();
								c[U + 24 >> 2] = k;
								i = c[T + 16 >> 2] | 0;
								do
									if (i)
										if (i >>> 0 < p >>> 0) Aa();
										else {
											c[U + 16 >> 2] = i;
											c[i + 24 >> 2] = U;
											break
										}
								while (0);
								i = c[T + 20 >> 2] | 0;
								if (i)
									if (i >>> 0 < (c[779] | 0) >>> 0) Aa();
									else {
										c[U + 20 >> 2] = i;
										c[i + 24 >> 2] = U;
										break
									}
							}
						while (0);
						b: do
							if (S >>> 0 >= 16) {
								c[T + 4 >> 2] = e | 3;
								c[T + (e | 4) >> 2] = S | 1;
								c[T + (S + e) >> 2] = S;
								k = S >>> 3;
								if (S >>> 0 < 256) {
									i = k << 1;
									p = 3140 + (i << 2) | 0;
									b = c[775] | 0;
									q = 1 << k;
									if (b & q) {
										k = 3140 + (i + 2 << 2) | 0;
										r = c[k >> 2] | 0;
										if (r >>> 0 < (c[779] | 0) >>> 0) Aa();
										else {
											Z = k;
											_ = r
										}
									} else {
										c[775] = b | q;
										Z = 3140 + (i + 2 << 2) | 0;
										_ = p
									}
									c[Z >> 2] = o;
									c[_ + 12 >> 2] = o;
									c[T + (e + 8) >> 2] = _;
									c[T + (e + 12) >> 2] = p;
									break
								}
								p = S >>> 8;
								if (p)
									if (S >>> 0 > 16777215) $ = 31;
									else {
										i = (p + 1048320 | 0) >>> 16 & 8;
										q = p << i;
										p = (q + 520192 | 0) >>> 16 & 4;
										b = q << p;
										q = (b + 245760 | 0) >>> 16 & 2;
										r = 14 - (p | i | q) + (b << q >>> 15) | 0;
										$ = S >>> (r + 7 | 0) & 1 | r << 1
									}
								else $ = 0;
								r = 3404 + ($ << 2) | 0;
								c[T + (e + 28) >> 2] = $;
								c[T + (e + 20) >> 2] = 0;
								c[T + (e + 16) >> 2] = 0;
								q = c[776] | 0;
								b = 1 << $;
								if (!(q & b)) {
									c[776] = q | b;
									c[r >> 2] = o;
									c[T + (e + 24) >> 2] = r;
									c[T + (e + 12) >> 2] = o;
									c[T + (e + 8) >> 2] = o;
									break
								}
								b = c[r >> 2] | 0;
								c: do
									if ((c[b + 4 >> 2] & -8 | 0) != (S | 0)) {
										r = S << (($ | 0) == 31 ? 0 : 25 - ($ >>> 1) | 0);
										q = b;
										while (1) {
											i = q + 16 + (r >>> 31 << 2) | 0;
											p = c[i >> 2] | 0;
											if (!p) {
												aa = i;
												ba = q;
												break
											}
											if ((c[p + 4 >> 2] & -8 | 0) == (S | 0)) {
												ca = p;
												break c
											} else {
												r = r << 1;
												q = p
											}
										}
										if (aa >>> 0 < (c[779] | 0) >>> 0) Aa();
										else {
											c[aa >> 2] = o;
											c[T + (e + 24) >> 2] = ba;
											c[T + (e + 12) >> 2] = o;
											c[T + (e + 8) >> 2] = o;
											break b
										}
									} else ca = b; while (0);
								b = ca + 8 | 0;
								q = c[b >> 2] | 0;
								r = c[779] | 0;
								if (q >>> 0 >= r >>> 0 & ca >>> 0 >= r >>> 0) {
									c[q + 12 >> 2] = o;
									c[b >> 2] = o;
									c[T + (e + 8) >> 2] = q;
									c[T + (e + 12) >> 2] = ca;
									c[T + (e + 24) >> 2] = 0;
									break
								} else Aa()
							} else {
								q = S + e | 0;
								c[T + 4 >> 2] = q | 3;
								b = T + (q + 4) | 0;
								c[b >> 2] = c[b >> 2] | 1
							}
						while (0);
						n = T + 8 | 0;
						break
					}
					Aa()
				} else {
					F = e;
					G = 154
				}
			} else {
				F = e;
				G = 154
			}
		} else {
			F = -1;
			G = 154
		}
		while (0);
		d: do
			if ((G | 0) == 154) {
				T = c[777] | 0;
				if (T >>> 0 >= F >>> 0) {
					S = T - F | 0;
					ca = c[780] | 0;
					if (S >>> 0 > 15) {
						c[780] = ca + F;
						c[777] = S;
						c[ca + (F + 4) >> 2] = S | 1;
						c[ca + T >> 2] = S;
						c[ca + 4 >> 2] = F | 3
					} else {
						c[777] = 0;
						c[780] = 0;
						c[ca + 4 >> 2] = T | 3;
						S = ca + (T + 4) | 0;
						c[S >> 2] = c[S >> 2] | 1
					}
					n = ca + 8 | 0;
					break
				}
				ca = c[778] | 0;
				if (ca >>> 0 > F >>> 0) {
					S = ca - F | 0;
					c[778] = S;
					ca = c[781] | 0;
					c[781] = ca + F;
					c[ca + (F + 4) >> 2] = S | 1;
					c[ca + 4 >> 2] = F | 3;
					n = ca + 8 | 0;
					break
				}
				if (!(c[893] | 0)) Ue();
				ca = F + 48 | 0;
				S = c[895] | 0;
				T = F + 47 | 0;
				ba = S + T | 0;
				aa = 0 - S | 0;
				S = ba & aa;
				if (S >>> 0 > F >>> 0) {
					$ = c[885] | 0;
					if (($ | 0) != 0 ? (_ = c[883] | 0, Z = _ + S | 0, Z >>> 0 <= _ >>> 0 | Z >>> 0 > $ >>> 0) : 0) {
						n = 0;
						break
					}
					e: do
						if (!(c[886] & 4)) {
							$ = c[781] | 0;
							f: do
								if ($) {
									Z = 3548;
									while (1) {
										_ = c[Z >> 2] | 0;
										if (_ >>> 0 <= $ >>> 0 ? (U = Z + 4 | 0, (_ + (c[U >> 2] | 0) | 0) >>> 0 > $ >>> 0) : 0) {
											da = Z;
											ea = U;
											break
										}
										Z = c[Z + 8 >> 2] | 0;
										if (!Z) {
											G = 172;
											break f
										}
									}
									Z = ba - (c[778] | 0) & aa;
									if (Z >>> 0 < 2147483647) {
										U = La(Z | 0) | 0;
										_ = (U | 0) == ((c[da >> 2] | 0) + (c[ea >> 2] | 0) | 0);
										X = _ ? Z : 0;
										if (_)
											if ((U | 0) == (-1 | 0)) fa = X;
											else {
												ga = U;
												ha = X;
												G = 192;
												break e
											}
										else {
											ia = U;
											ja = Z;
											ka = X;
											G = 182
										}
									} else fa = 0
								} else G = 172; while (0);
							do
								if ((G | 0) == 172) {
									$ = La(0) | 0;
									if (($ | 0) != (-1 | 0)) {
										X = $;
										Z = c[894] | 0;
										U = Z + -1 | 0;
										if (!(U & X)) la = S;
										else la = S - X + (U + X & 0 - Z) | 0;
										Z = c[883] | 0;
										X = Z + la | 0;
										if (la >>> 0 > F >>> 0 & la >>> 0 < 2147483647) {
											U = c[885] | 0;
											if ((U | 0) != 0 ? X >>> 0 <= Z >>> 0 | X >>> 0 > U >>> 0 : 0) {
												fa = 0;
												break
											}
											U = La(la | 0) | 0;
											X = (U | 0) == ($ | 0);
											Z = X ? la : 0;
											if (X) {
												ga = $;
												ha = Z;
												G = 192;
												break e
											} else {
												ia = U;
												ja = la;
												ka = Z;
												G = 182
											}
										} else fa = 0
									} else fa = 0
								}
							while (0);
							g: do
								if ((G | 0) == 182) {
									Z = 0 - ja | 0;
									do
										if (ca >>> 0 > ja >>> 0 & (ja >>> 0 < 2147483647 & (ia | 0) != (-1 | 0)) ? (U = c[895] | 0, $ = T - ja + U & 0 - U, $ >>> 0 < 2147483647) : 0)
											if ((La($ | 0) | 0) == (-1 | 0)) {
												La(Z | 0) | 0;
												fa = ka;
												break g
											} else {
												ma = $ + ja | 0;
												break
											}
									else ma = ja; while (0);
									if ((ia | 0) == (-1 | 0)) fa = ka;
									else {
										ga = ia;
										ha = ma;
										G = 192;
										break e
									}
								}
							while (0);
							c[886] = c[886] | 4;
							na = fa;
							G = 189
						} else {
							na = 0;
							G = 189
						}
					while (0);
					if ((((G | 0) == 189 ? S >>> 0 < 2147483647 : 0) ? (T = La(S | 0) | 0, ca = La(0) | 0, T >>> 0 < ca >>> 0 & ((T | 0) != (-1 | 0) & (ca | 0) != (-1 | 0))) : 0) ? (aa = ca - T | 0, ca = aa >>> 0 > (F + 40 | 0) >>> 0, ca) : 0) {
						ga = T;
						ha = ca ? aa : na;
						G = 192
					}
					if ((G | 0) == 192) {
						aa = (c[883] | 0) + ha | 0;
						c[883] = aa;
						if (aa >>> 0 > (c[884] | 0) >>> 0) c[884] = aa;
						aa = c[781] | 0;
						h: do
							if (aa) {
								ca = 3548;
								do {
									T = c[ca >> 2] | 0;
									ba = ca + 4 | 0;
									e = c[ba >> 2] | 0;
									if ((ga | 0) == (T + e | 0)) {
										oa = T;
										pa = ba;
										qa = e;
										ra = ca;
										G = 202;
										break
									}
									ca = c[ca + 8 >> 2] | 0
								} while ((ca | 0) != 0);
								if (((G | 0) == 202 ? (c[ra + 12 >> 2] & 8 | 0) == 0 : 0) ? aa >>> 0 < ga >>> 0 & aa >>> 0 >= oa >>> 0 : 0) {
									c[pa >> 2] = qa + ha;
									ca = (c[778] | 0) + ha | 0;
									e = aa + 8 | 0;
									ba = (e & 7 | 0) == 0 ? 0 : 0 - e & 7;
									e = ca - ba | 0;
									c[781] = aa + ba;
									c[778] = e;
									c[aa + (ba + 4) >> 2] = e | 1;
									c[aa + (ca + 4) >> 2] = 40;
									c[782] = c[897];
									break
								}
								ca = c[779] | 0;
								if (ga >>> 0 < ca >>> 0) {
									c[779] = ga;
									sa = ga
								} else sa = ca;
								ca = ga + ha | 0;
								e = 3548;
								while (1) {
									if ((c[e >> 2] | 0) == (ca | 0)) {
										ta = e;
										ua = e;
										G = 210;
										break
									}
									e = c[e + 8 >> 2] | 0;
									if (!e) {
										va = 3548;
										break
									}
								}
								if ((G | 0) == 210)
									if (!(c[ua + 12 >> 2] & 8)) {
										c[ta >> 2] = ga;
										e = ua + 4 | 0;
										c[e >> 2] = (c[e >> 2] | 0) + ha;
										e = ga + 8 | 0;
										ca = (e & 7 | 0) == 0 ? 0 : 0 - e & 7;
										e = ga + (ha + 8) | 0;
										ba = (e & 7 | 0) == 0 ? 0 : 0 - e & 7;
										e = ga + (ba + ha) | 0;
										T = ca + F | 0;
										Z = ga + T | 0;
										$ = e - (ga + ca) - F | 0;
										c[ga + (ca + 4) >> 2] = F | 3;
										i: do
											if ((e | 0) != (aa | 0)) {
												if ((e | 0) == (c[780] | 0)) {
													U = (c[777] | 0) + $ | 0;
													c[777] = U;
													c[780] = Z;
													c[ga + (T + 4) >> 2] = U | 1;
													c[ga + (U + T) >> 2] = U;
													break
												}
												U = ha + 4 | 0;
												X = c[ga + (U + ba) >> 2] | 0;
												if ((X & 3 | 0) == 1) {
													_ = X & -8;
													Y = X >>> 3;
													j: do
														if (X >>> 0 >= 256) {
															W = c[ga + ((ba | 24) + ha) >> 2] | 0;
															V = c[ga + (ha + 12 + ba) >> 2] | 0;
															k: do
																if ((V | 0) == (e | 0)) {
																	N = ba | 16;
																	L = ga + (U + N) | 0;
																	M = c[L >> 2] | 0;
																	if (!M) {
																		R = ga + (N + ha) | 0;
																		N = c[R >> 2] | 0;
																		if (!N) {
																			wa = 0;
																			break
																		} else {
																			xa = N;
																			ya = R
																		}
																	} else {
																		xa = M;
																		ya = L
																	}
																	while (1) {
																		L = xa + 20 | 0;
																		M = c[L >> 2] | 0;
																		if (M) {
																			xa = M;
																			ya = L;
																			continue
																		}
																		L = xa + 16 | 0;
																		M = c[L >> 2] | 0;
																		if (!M) {
																			za = xa;
																			Ba = ya;
																			break
																		} else {
																			xa = M;
																			ya = L
																		}
																	}
																	if (Ba >>> 0 < sa >>> 0) Aa();
																	else {
																		c[Ba >> 2] = 0;
																		wa = za;
																		break
																	}
																} else {
																	L = c[ga + ((ba | 8) + ha) >> 2] | 0;
																	do
																		if (L >>> 0 >= sa >>> 0) {
																			M = L + 12 | 0;
																			if ((c[M >> 2] | 0) != (e | 0)) break;
																			R = V + 8 | 0;
																			if ((c[R >> 2] | 0) != (e | 0)) break;
																			c[M >> 2] = V;
																			c[R >> 2] = L;
																			wa = V;
																			break k
																		}
																	while (0);
																	Aa()
																}
															while (0);
															if (!W) break;
															V = c[ga + (ha + 28 + ba) >> 2] | 0;
															L = 3404 + (V << 2) | 0;
															do
																if ((e | 0) != (c[L >> 2] | 0)) {
																	if (W >>> 0 < (c[779] | 0) >>> 0) Aa();
																	R = W + 16 | 0;
																	if ((c[R >> 2] | 0) == (e | 0)) c[R >> 2] = wa;
																	else c[W + 20 >> 2] = wa;
																	if (!wa) break j
																} else {
																	c[L >> 2] = wa;
																	if (wa) break;
																	c[776] = c[776] & ~(1 << V);
																	break j
																}
															while (0);
															V = c[779] | 0;
															if (wa >>> 0 < V >>> 0) Aa();
															c[wa + 24 >> 2] = W;
															L = ba | 16;
															R = c[ga + (L + ha) >> 2] | 0;
															do
																if (R)
																	if (R >>> 0 < V >>> 0) Aa();
																	else {
																		c[wa + 16 >> 2] = R;
																		c[R + 24 >> 2] = wa;
																		break
																	}
															while (0);
															R = c[ga + (U + L) >> 2] | 0;
															if (!R) break;
															if (R >>> 0 < (c[779] | 0) >>> 0) Aa();
															else {
																c[wa + 20 >> 2] = R;
																c[R + 24 >> 2] = wa;
																break
															}
														} else {
															R = c[ga + ((ba | 8) + ha) >> 2] | 0;
															V = c[ga + (ha + 12 + ba) >> 2] | 0;
															W = 3140 + (Y << 1 << 2) | 0;
															do
																if ((R | 0) != (W | 0)) {
																	if (R >>> 0 >= sa >>> 0 ? (c[R + 12 >> 2] | 0) == (e | 0) : 0) break;
																	Aa()
																}
															while (0);
															if ((V | 0) == (R | 0)) {
																c[775] = c[775] & ~(1 << Y);
																break
															}
															do
																if ((V | 0) == (W | 0)) Ca = V + 8 | 0;
																else {
																	if (V >>> 0 >= sa >>> 0 ? (L = V + 8 | 0, (c[L >> 2] | 0) == (e | 0)) : 0) {
																		Ca = L;
																		break
																	}
																	Aa()
																}
															while (0);
															c[R + 12 >> 2] = V;
															c[Ca >> 2] = R
														}
													while (0);
													Da = ga + ((_ | ba) + ha) | 0;
													Ea = _ + $ | 0
												} else {
													Da = e;
													Ea = $
												}
												Y = Da + 4 | 0;
												c[Y >> 2] = c[Y >> 2] & -2;
												c[ga + (T + 4) >> 2] = Ea | 1;
												c[ga + (Ea + T) >> 2] = Ea;
												Y = Ea >>> 3;
												if (Ea >>> 0 < 256) {
													U = Y << 1;
													X = 3140 + (U << 2) | 0;
													W = c[775] | 0;
													L = 1 << Y;
													do
														if (!(W & L)) {
															c[775] = W | L;
															Fa = 3140 + (U + 2 << 2) | 0;
															Ga = X
														} else {
															Y = 3140 + (U + 2 << 2) | 0;
															M = c[Y >> 2] | 0;
															if (M >>> 0 >= (c[779] | 0) >>> 0) {
																Fa = Y;
																Ga = M;
																break
															}
															Aa()
														}
													while (0);
													c[Fa >> 2] = Z;
													c[Ga + 12 >> 2] = Z;
													c[ga + (T + 8) >> 2] = Ga;
													c[ga + (T + 12) >> 2] = X;
													break
												}
												U = Ea >>> 8;
												do
													if (!U) Ha = 0;
													else {
														if (Ea >>> 0 > 16777215) {
															Ha = 31;
															break
														}
														L = (U + 1048320 | 0) >>> 16 & 8;
														W = U << L;
														_ = (W + 520192 | 0) >>> 16 & 4;
														M = W << _;
														W = (M + 245760 | 0) >>> 16 & 2;
														Y = 14 - (_ | L | W) + (M << W >>> 15) | 0;
														Ha = Ea >>> (Y + 7 | 0) & 1 | Y << 1
													}
												while (0);
												U = 3404 + (Ha << 2) | 0;
												c[ga + (T + 28) >> 2] = Ha;
												c[ga + (T + 20) >> 2] = 0;
												c[ga + (T + 16) >> 2] = 0;
												X = c[776] | 0;
												Y = 1 << Ha;
												if (!(X & Y)) {
													c[776] = X | Y;
													c[U >> 2] = Z;
													c[ga + (T + 24) >> 2] = U;
													c[ga + (T + 12) >> 2] = Z;
													c[ga + (T + 8) >> 2] = Z;
													break
												}
												Y = c[U >> 2] | 0;
												l: do
													if ((c[Y + 4 >> 2] & -8 | 0) != (Ea | 0)) {
														U = Ea << ((Ha | 0) == 31 ? 0 : 25 - (Ha >>> 1) | 0);
														X = Y;
														while (1) {
															W = X + 16 + (U >>> 31 << 2) | 0;
															M = c[W >> 2] | 0;
															if (!M) {
																Ia = W;
																Ja = X;
																break
															}
															if ((c[M + 4 >> 2] & -8 | 0) == (Ea | 0)) {
																Ka = M;
																break l
															} else {
																U = U << 1;
																X = M
															}
														}
														if (Ia >>> 0 < (c[779] | 0) >>> 0) Aa();
														else {
															c[Ia >> 2] = Z;
															c[ga + (T + 24) >> 2] = Ja;
															c[ga + (T + 12) >> 2] = Z;
															c[ga + (T + 8) >> 2] = Z;
															break i
														}
													} else Ka = Y; while (0);
												Y = Ka + 8 | 0;
												X = c[Y >> 2] | 0;
												U = c[779] | 0;
												if (X >>> 0 >= U >>> 0 & Ka >>> 0 >= U >>> 0) {
													c[X + 12 >> 2] = Z;
													c[Y >> 2] = Z;
													c[ga + (T + 8) >> 2] = X;
													c[ga + (T + 12) >> 2] = Ka;
													c[ga + (T + 24) >> 2] = 0;
													break
												} else Aa()
											} else {
												X = (c[778] | 0) + $ | 0;
												c[778] = X;
												c[781] = Z;
												c[ga + (T + 4) >> 2] = X | 1
											}
										while (0);
										n = ga + (ca | 8) | 0;
										break d
									} else va = 3548;
								while (1) {
									T = c[va >> 2] | 0;
									if (T >>> 0 <= aa >>> 0 ? (Z = c[va + 4 >> 2] | 0, $ = T + Z | 0, $ >>> 0 > aa >>> 0) : 0) {
										Ma = T;
										Na = Z;
										Oa = $;
										break
									}
									va = c[va + 8 >> 2] | 0
								}
								ca = Ma + (Na + -39) | 0;
								$ = Ma + (Na + -47 + ((ca & 7 | 0) == 0 ? 0 : 0 - ca & 7)) | 0;
								ca = aa + 16 | 0;
								Z = $ >>> 0 < ca >>> 0 ? aa : $;
								$ = Z + 8 | 0;
								T = ga + 8 | 0;
								e = (T & 7 | 0) == 0 ? 0 : 0 - T & 7;
								T = ha + -40 - e | 0;
								c[781] = ga + e;
								c[778] = T;
								c[ga + (e + 4) >> 2] = T | 1;
								c[ga + (ha + -36) >> 2] = 40;
								c[782] = c[897];
								T = Z + 4 | 0;
								c[T >> 2] = 27;
								c[$ >> 2] = c[887];
								c[$ + 4 >> 2] = c[888];
								c[$ + 8 >> 2] = c[889];
								c[$ + 12 >> 2] = c[890];
								c[887] = ga;
								c[888] = ha;
								c[890] = 0;
								c[889] = $;
								$ = Z + 28 | 0;
								c[$ >> 2] = 7;
								if ((Z + 32 | 0) >>> 0 < Oa >>> 0) {
									e = $;
									do {
										$ = e;
										e = e + 4 | 0;
										c[e >> 2] = 7
									} while (($ + 8 | 0) >>> 0 < Oa >>> 0)
								}
								if ((Z | 0) != (aa | 0)) {
									e = Z - aa | 0;
									c[T >> 2] = c[T >> 2] & -2;
									c[aa + 4 >> 2] = e | 1;
									c[Z >> 2] = e;
									$ = e >>> 3;
									if (e >>> 0 < 256) {
										ba = $ << 1;
										X = 3140 + (ba << 2) | 0;
										Y = c[775] | 0;
										U = 1 << $;
										if (Y & U) {
											$ = 3140 + (ba + 2 << 2) | 0;
											R = c[$ >> 2] | 0;
											if (R >>> 0 < (c[779] | 0) >>> 0) Aa();
											else {
												Pa = $;
												Qa = R
											}
										} else {
											c[775] = Y | U;
											Pa = 3140 + (ba + 2 << 2) | 0;
											Qa = X
										}
										c[Pa >> 2] = aa;
										c[Qa + 12 >> 2] = aa;
										c[aa + 8 >> 2] = Qa;
										c[aa + 12 >> 2] = X;
										break
									}
									X = e >>> 8;
									if (X)
										if (e >>> 0 > 16777215) Ra = 31;
										else {
											ba = (X + 1048320 | 0) >>> 16 & 8;
											U = X << ba;
											X = (U + 520192 | 0) >>> 16 & 4;
											Y = U << X;
											U = (Y + 245760 | 0) >>> 16 & 2;
											R = 14 - (X | ba | U) + (Y << U >>> 15) | 0;
											Ra = e >>> (R + 7 | 0) & 1 | R << 1
										}
									else Ra = 0;
									R = 3404 + (Ra << 2) | 0;
									c[aa + 28 >> 2] = Ra;
									c[aa + 20 >> 2] = 0;
									c[ca >> 2] = 0;
									U = c[776] | 0;
									Y = 1 << Ra;
									if (!(U & Y)) {
										c[776] = U | Y;
										c[R >> 2] = aa;
										c[aa + 24 >> 2] = R;
										c[aa + 12 >> 2] = aa;
										c[aa + 8 >> 2] = aa;
										break
									}
									Y = c[R >> 2] | 0;
									m: do
										if ((c[Y + 4 >> 2] & -8 | 0) != (e | 0)) {
											R = e << ((Ra | 0) == 31 ? 0 : 25 - (Ra >>> 1) | 0);
											U = Y;
											while (1) {
												ba = U + 16 + (R >>> 31 << 2) | 0;
												X = c[ba >> 2] | 0;
												if (!X) {
													Sa = ba;
													Ta = U;
													break
												}
												if ((c[X + 4 >> 2] & -8 | 0) == (e | 0)) {
													Ua = X;
													break m
												} else {
													R = R << 1;
													U = X
												}
											}
											if (Sa >>> 0 < (c[779] | 0) >>> 0) Aa();
											else {
												c[Sa >> 2] = aa;
												c[aa + 24 >> 2] = Ta;
												c[aa + 12 >> 2] = aa;
												c[aa + 8 >> 2] = aa;
												break h
											}
										} else Ua = Y; while (0);
									Y = Ua + 8 | 0;
									e = c[Y >> 2] | 0;
									ca = c[779] | 0;
									if (e >>> 0 >= ca >>> 0 & Ua >>> 0 >= ca >>> 0) {
										c[e + 12 >> 2] = aa;
										c[Y >> 2] = aa;
										c[aa + 8 >> 2] = e;
										c[aa + 12 >> 2] = Ua;
										c[aa + 24 >> 2] = 0;
										break
									} else Aa()
								}
							} else {
								e = c[779] | 0;
								if ((e | 0) == 0 | ga >>> 0 < e >>> 0) c[779] = ga;
								c[887] = ga;
								c[888] = ha;
								c[890] = 0;
								c[784] = c[893];
								c[783] = -1;
								e = 0;
								do {
									Y = e << 1;
									ca = 3140 + (Y << 2) | 0;
									c[3140 + (Y + 3 << 2) >> 2] = ca;
									c[3140 + (Y + 2 << 2) >> 2] = ca;
									e = e + 1 | 0
								} while ((e | 0) != 32);
								e = ga + 8 | 0;
								ca = (e & 7 | 0) == 0 ? 0 : 0 - e & 7;
								e = ha + -40 - ca | 0;
								c[781] = ga + ca;
								c[778] = e;
								c[ga + (ca + 4) >> 2] = e | 1;
								c[ga + (ha + -36) >> 2] = 40;
								c[782] = c[897]
							}
						while (0);
						aa = c[778] | 0;
						if (aa >>> 0 > F >>> 0) {
							S = aa - F | 0;
							c[778] = S;
							aa = c[781] | 0;
							c[781] = aa + F;
							c[aa + (F + 4) >> 2] = S | 1;
							c[aa + 4 >> 2] = F | 3;
							n = aa + 8 | 0;
							break
						}
					}
					c[(Bd() | 0) >> 2] = 12;
					n = 0
				} else n = 0
			}
		while (0);
		return n | 0
	}

	function rd(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0;
		a: do
			if (a) {
				b = a + -8 | 0;
				d = c[779] | 0;
				b: do
					if (b >>> 0 >= d >>> 0 ? (e = c[a + -4 >> 2] | 0, f = e & 3, (f | 0) != 1) : 0) {
						g = e & -8;
						h = a + (g + -8) | 0;
						do
							if (!(e & 1)) {
								i = c[b >> 2] | 0;
								if (!f) break a;
								j = -8 - i | 0;
								k = a + j | 0;
								l = i + g | 0;
								if (k >>> 0 < d >>> 0) break b;
								if ((k | 0) == (c[780] | 0)) {
									m = a + (g + -4) | 0;
									n = c[m >> 2] | 0;
									if ((n & 3 | 0) != 3) {
										o = k;
										p = l;
										break
									}
									c[777] = l;
									c[m >> 2] = n & -2;
									c[a + (j + 4) >> 2] = l | 1;
									c[h >> 2] = l;
									break a
								}
								n = i >>> 3;
								if (i >>> 0 < 256) {
									i = c[a + (j + 8) >> 2] | 0;
									m = c[a + (j + 12) >> 2] | 0;
									q = 3140 + (n << 1 << 2) | 0;
									do
										if ((i | 0) != (q | 0)) {
											if (i >>> 0 >= d >>> 0 ? (c[i + 12 >> 2] | 0) == (k | 0) : 0) break;
											Aa()
										}
									while (0);
									if ((m | 0) == (i | 0)) {
										c[775] = c[775] & ~(1 << n);
										o = k;
										p = l;
										break
									}
									do
										if ((m | 0) == (q | 0)) r = m + 8 | 0;
										else {
											if (m >>> 0 >= d >>> 0 ? (s = m + 8 | 0, (c[s >> 2] | 0) == (k | 0)) : 0) {
												r = s;
												break
											}
											Aa()
										}
									while (0);
									c[i + 12 >> 2] = m;
									c[r >> 2] = i;
									o = k;
									p = l;
									break
								}
								q = c[a + (j + 24) >> 2] | 0;
								n = c[a + (j + 12) >> 2] | 0;
								do
									if ((n | 0) == (k | 0)) {
										s = a + (j + 20) | 0;
										t = c[s >> 2] | 0;
										if (!t) {
											u = a + (j + 16) | 0;
											v = c[u >> 2] | 0;
											if (!v) {
												w = 0;
												break
											} else {
												x = v;
												y = u
											}
										} else {
											x = t;
											y = s
										}
										while (1) {
											s = x + 20 | 0;
											t = c[s >> 2] | 0;
											if (t) {
												x = t;
												y = s;
												continue
											}
											s = x + 16 | 0;
											t = c[s >> 2] | 0;
											if (!t) {
												z = x;
												A = y;
												break
											} else {
												x = t;
												y = s
											}
										}
										if (A >>> 0 < d >>> 0) Aa();
										else {
											c[A >> 2] = 0;
											w = z;
											break
										}
									} else {
										s = c[a + (j + 8) >> 2] | 0;
										if ((s >>> 0 >= d >>> 0 ? (t = s + 12 | 0, (c[t >> 2] | 0) == (k | 0)) : 0) ? (u = n + 8 | 0, (c[u >> 2] | 0) == (k | 0)) : 0) {
											c[t >> 2] = n;
											c[u >> 2] = s;
											w = n;
											break
										}
										Aa()
									}
								while (0);
								if (q) {
									n = c[a + (j + 28) >> 2] | 0;
									i = 3404 + (n << 2) | 0;
									if ((k | 0) == (c[i >> 2] | 0)) {
										c[i >> 2] = w;
										if (!w) {
											c[776] = c[776] & ~(1 << n);
											o = k;
											p = l;
											break
										}
									} else {
										if (q >>> 0 < (c[779] | 0) >>> 0) Aa();
										n = q + 16 | 0;
										if ((c[n >> 2] | 0) == (k | 0)) c[n >> 2] = w;
										else c[q + 20 >> 2] = w;
										if (!w) {
											o = k;
											p = l;
											break
										}
									}
									n = c[779] | 0;
									if (w >>> 0 < n >>> 0) Aa();
									c[w + 24 >> 2] = q;
									i = c[a + (j + 16) >> 2] | 0;
									do
										if (i)
											if (i >>> 0 < n >>> 0) Aa();
											else {
												c[w + 16 >> 2] = i;
												c[i + 24 >> 2] = w;
												break
											}
									while (0);
									i = c[a + (j + 20) >> 2] | 0;
									if (i)
										if (i >>> 0 < (c[779] | 0) >>> 0) Aa();
										else {
											c[w + 20 >> 2] = i;
											c[i + 24 >> 2] = w;
											o = k;
											p = l;
											break
										}
									else {
										o = k;
										p = l
									}
								} else {
									o = k;
									p = l
								}
							} else {
								o = b;
								p = g
							}
						while (0);
						if (o >>> 0 < h >>> 0 ? (f = a + (g + -4) | 0, e = c[f >> 2] | 0, (e & 1 | 0) != 0) : 0) {
							if (!(e & 2)) {
								if ((h | 0) == (c[781] | 0)) {
									i = (c[778] | 0) + p | 0;
									c[778] = i;
									c[781] = o;
									c[o + 4 >> 2] = i | 1;
									if ((o | 0) != (c[780] | 0)) break a;
									c[780] = 0;
									c[777] = 0;
									break a
								}
								if ((h | 0) == (c[780] | 0)) {
									i = (c[777] | 0) + p | 0;
									c[777] = i;
									c[780] = o;
									c[o + 4 >> 2] = i | 1;
									c[o + i >> 2] = i;
									break a
								}
								i = (e & -8) + p | 0;
								n = e >>> 3;
								do
									if (e >>> 0 >= 256) {
										q = c[a + (g + 16) >> 2] | 0;
										m = c[a + (g | 4) >> 2] | 0;
										do
											if ((m | 0) == (h | 0)) {
												s = a + (g + 12) | 0;
												u = c[s >> 2] | 0;
												if (!u) {
													t = a + (g + 8) | 0;
													v = c[t >> 2] | 0;
													if (!v) {
														B = 0;
														break
													} else {
														C = v;
														D = t
													}
												} else {
													C = u;
													D = s
												}
												while (1) {
													s = C + 20 | 0;
													u = c[s >> 2] | 0;
													if (u) {
														C = u;
														D = s;
														continue
													}
													s = C + 16 | 0;
													u = c[s >> 2] | 0;
													if (!u) {
														E = C;
														F = D;
														break
													} else {
														C = u;
														D = s
													}
												}
												if (F >>> 0 < (c[779] | 0) >>> 0) Aa();
												else {
													c[F >> 2] = 0;
													B = E;
													break
												}
											} else {
												s = c[a + g >> 2] | 0;
												if ((s >>> 0 >= (c[779] | 0) >>> 0 ? (u = s + 12 | 0, (c[u >> 2] | 0) == (h | 0)) : 0) ? (t = m + 8 | 0, (c[t >> 2] | 0) == (h | 0)) : 0) {
													c[u >> 2] = m;
													c[t >> 2] = s;
													B = m;
													break
												}
												Aa()
											}
										while (0);
										if (q) {
											m = c[a + (g + 20) >> 2] | 0;
											l = 3404 + (m << 2) | 0;
											if ((h | 0) == (c[l >> 2] | 0)) {
												c[l >> 2] = B;
												if (!B) {
													c[776] = c[776] & ~(1 << m);
													break
												}
											} else {
												if (q >>> 0 < (c[779] | 0) >>> 0) Aa();
												m = q + 16 | 0;
												if ((c[m >> 2] | 0) == (h | 0)) c[m >> 2] = B;
												else c[q + 20 >> 2] = B;
												if (!B) break
											}
											m = c[779] | 0;
											if (B >>> 0 < m >>> 0) Aa();
											c[B + 24 >> 2] = q;
											l = c[a + (g + 8) >> 2] | 0;
											do
												if (l)
													if (l >>> 0 < m >>> 0) Aa();
													else {
														c[B + 16 >> 2] = l;
														c[l + 24 >> 2] = B;
														break
													}
											while (0);
											l = c[a + (g + 12) >> 2] | 0;
											if (l)
												if (l >>> 0 < (c[779] | 0) >>> 0) Aa();
												else {
													c[B + 20 >> 2] = l;
													c[l + 24 >> 2] = B;
													break
												}
										}
									} else {
										l = c[a + g >> 2] | 0;
										m = c[a + (g | 4) >> 2] | 0;
										q = 3140 + (n << 1 << 2) | 0;
										do
											if ((l | 0) != (q | 0)) {
												if (l >>> 0 >= (c[779] | 0) >>> 0 ? (c[l + 12 >> 2] | 0) == (h | 0) : 0) break;
												Aa()
											}
										while (0);
										if ((m | 0) == (l | 0)) {
											c[775] = c[775] & ~(1 << n);
											break
										}
										do
											if ((m | 0) == (q | 0)) G = m + 8 | 0;
											else {
												if (m >>> 0 >= (c[779] | 0) >>> 0 ? (k = m + 8 | 0, (c[k >> 2] | 0) == (h | 0)) : 0) {
													G = k;
													break
												}
												Aa()
											}
										while (0);
										c[l + 12 >> 2] = m;
										c[G >> 2] = l
									}
								while (0);
								c[o + 4 >> 2] = i | 1;
								c[o + i >> 2] = i;
								if ((o | 0) == (c[780] | 0)) {
									c[777] = i;
									break a
								} else H = i
							} else {
								c[f >> 2] = e & -2;
								c[o + 4 >> 2] = p | 1;
								c[o + p >> 2] = p;
								H = p
							}
							h = H >>> 3;
							if (H >>> 0 < 256) {
								n = h << 1;
								g = 3140 + (n << 2) | 0;
								q = c[775] | 0;
								k = 1 << h;
								if (q & k) {
									h = 3140 + (n + 2 << 2) | 0;
									j = c[h >> 2] | 0;
									if (j >>> 0 < (c[779] | 0) >>> 0) Aa();
									else {
										I = h;
										J = j
									}
								} else {
									c[775] = q | k;
									I = 3140 + (n + 2 << 2) | 0;
									J = g
								}
								c[I >> 2] = o;
								c[J + 12 >> 2] = o;
								c[o + 8 >> 2] = J;
								c[o + 12 >> 2] = g;
								break a
							}
							g = H >>> 8;
							if (g)
								if (H >>> 0 > 16777215) K = 31;
								else {
									n = (g + 1048320 | 0) >>> 16 & 8;
									k = g << n;
									g = (k + 520192 | 0) >>> 16 & 4;
									q = k << g;
									k = (q + 245760 | 0) >>> 16 & 2;
									j = 14 - (g | n | k) + (q << k >>> 15) | 0;
									K = H >>> (j + 7 | 0) & 1 | j << 1
								}
							else K = 0;
							j = 3404 + (K << 2) | 0;
							c[o + 28 >> 2] = K;
							c[o + 20 >> 2] = 0;
							c[o + 16 >> 2] = 0;
							k = c[776] | 0;
							q = 1 << K;
							c: do
								if (k & q) {
									n = c[j >> 2] | 0;
									d: do
										if ((c[n + 4 >> 2] & -8 | 0) != (H | 0)) {
											g = H << ((K | 0) == 31 ? 0 : 25 - (K >>> 1) | 0);
											h = n;
											while (1) {
												s = h + 16 + (g >>> 31 << 2) | 0;
												t = c[s >> 2] | 0;
												if (!t) {
													L = s;
													M = h;
													break
												}
												if ((c[t + 4 >> 2] & -8 | 0) == (H | 0)) {
													N = t;
													break d
												} else {
													g = g << 1;
													h = t
												}
											}
											if (L >>> 0 < (c[779] | 0) >>> 0) Aa();
											else {
												c[L >> 2] = o;
												c[o + 24 >> 2] = M;
												c[o + 12 >> 2] = o;
												c[o + 8 >> 2] = o;
												break c
											}
										} else N = n; while (0);
									n = N + 8 | 0;
									l = c[n >> 2] | 0;
									m = c[779] | 0;
									if (l >>> 0 >= m >>> 0 & N >>> 0 >= m >>> 0) {
										c[l + 12 >> 2] = o;
										c[n >> 2] = o;
										c[o + 8 >> 2] = l;
										c[o + 12 >> 2] = N;
										c[o + 24 >> 2] = 0;
										break
									} else Aa()
								} else {
									c[776] = k | q;
									c[j >> 2] = o;
									c[o + 24 >> 2] = j;
									c[o + 12 >> 2] = o;
									c[o + 8 >> 2] = o
								}
							while (0);
							j = (c[783] | 0) + -1 | 0;
							c[783] = j;
							if (!j) O = 3556;
							else break a;
							while (1) {
								j = c[O >> 2] | 0;
								if (!j) break;
								else O = j + 8 | 0
							}
							c[783] = -1;
							break a
						}
					}
				while (0);
				Aa()
			}
		while (0);
		return
	}

	function sd(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0;
		if (a) {
			d = $(b, a) | 0;
			if ((b | a) >>> 0 > 65535) e = ((d >>> 0) / (a >>> 0) | 0 | 0) == (b | 0) ? d : -1;
			else e = d
		} else e = 0;
		d = qd(e) | 0;
		if ((d | 0) != 0 ? (c[d + -4 >> 2] & 3 | 0) != 0 : 0) ip(d | 0, 0, e | 0) | 0;
		return d | 0
	}

	function td(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0;
		do
			if (a) {
				if (b >>> 0 > 4294967231) {
					c[(Bd() | 0) >> 2] = 12;
					d = 0;
					break
				}
				e = Ve(a + -8 | 0, b >>> 0 < 11 ? 16 : b + 11 & -8) | 0;
				if (e) {
					d = e + 8 | 0;
					break
				}
				e = qd(b) | 0;
				if (!e) d = 0;
				else {
					f = c[a + -4 >> 2] | 0;
					g = (f & -8) - ((f & 3 | 0) == 0 ? 8 : 4) | 0;
					lp(e | 0, a | 0, (g >>> 0 < b >>> 0 ? g : b) | 0) | 0;
					rd(a);
					d = e
				}
			} else d = qd(b) | 0; while (0);
		return d | 0
	}

	function ud(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		d = Je(a, b, c) | 0;
		return d | 0
	}

	function vd(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		d = Ke(a, b, c) | 0;
		return d | 0
	}

	function wd() {
		return 3596
	}

	function xd() {
		return 3600
	}

	function yd() {
		return 3604
	}

	function zd(a) {
		a = a | 0;
		return ((a | 0) == 32 | (a + -9 | 0) >>> 0 < 5) & 1 | 0
	}

	function Ad(a) {
		a = a | 0;
		var b = 0;
		if ((a + -48 | 0) >>> 0 < 10) b = 1;
		else b = ((a | 32) + -97 | 0) >>> 0 < 6;
		return b & 1 | 0
	}

	function Bd() {
		var a = 0;
		if (!(c[709] | 0)) a = 3608;
		else a = c[(Ta() | 0) + 60 >> 2] | 0;
		return a | 0
	}

	function Cd(b) {
		b = b | 0;
		var c = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		c = 0;
		while (1) {
			if ((d[15545 + c >> 0] | 0) == (b | 0)) {
				e = c;
				f = 2;
				break
			}
			c = c + 1 | 0;
			if ((c | 0) == 87) {
				g = 87;
				h = 15633;
				f = 5;
				break
			}
		}
		if ((f | 0) == 2)
			if (!e) i = 15633;
			else {
				g = e;
				h = 15633;
				f = 5
			}
		if ((f | 0) == 5)
			while (1) {
				f = 0;
				e = h;
				while (1) {
					c = e + 1 | 0;
					if (!(a[e >> 0] | 0)) {
						j = c;
						break
					} else e = c
				}
				g = g + -1 | 0;
				if (!g) {
					i = j;
					break
				} else {
					h = j;
					f = 5
				}
			}
		return i | 0
	}

	function Dd(b, e, f) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0.0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0.0,
			_ = 0,
			aa = 0.0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0.0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0.0,
			ua = 0,
			va = 0.0,
			wa = 0.0,
			xa = 0,
			ya = 0.0,
			za = 0,
			Aa = 0.0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0.0,
			La = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0.0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0.0,
			Ua = 0.0,
			Va = 0,
			Wa = 0,
			Xa = 0,
			Ya = 0,
			Za = 0,
			_a = 0,
			$a = 0,
			ab = 0,
			bb = 0,
			cb = 0,
			db = 0,
			eb = 0,
			fb = 0,
			gb = 0,
			hb = 0,
			ib = 0,
			jb = 0,
			kb = 0,
			lb = 0,
			mb = 0,
			nb = 0,
			ob = 0,
			pb = 0,
			qb = 0,
			rb = 0,
			sb = 0,
			tb = 0,
			ub = 0,
			vb = 0,
			wb = 0,
			xb = 0,
			yb = 0,
			zb = 0,
			Ab = 0,
			Bb = 0,
			Cb = 0,
			Db = 0,
			Eb = 0,
			Fb = 0,
			Gb = 0,
			Hb = 0,
			Ib = 0,
			Jb = 0,
			Kb = 0,
			Lb = 0,
			Mb = 0,
			Nb = 0,
			Ob = 0,
			Pb = 0,
			Qb = 0,
			Rb = 0,
			Sb = 0,
			Tb = 0,
			Ub = 0,
			Vb = 0,
			Wb = 0,
			Xb = 0,
			Yb = 0,
			Zb = 0,
			_b = 0,
			$b = 0,
			ac = 0,
			bc = 0,
			cc = 0,
			dc = 0,
			ec = 0,
			fc = 0.0,
			gc = 0,
			hc = 0,
			ic = 0,
			jc = 0,
			kc = 0,
			lc = 0,
			mc = 0,
			nc = 0,
			oc = 0,
			pc = 0,
			qc = 0,
			rc = 0,
			sc = 0,
			tc = 0,
			uc = 0,
			vc = 0,
			wc = 0,
			xc = 0,
			yc = 0,
			zc = 0,
			Ac = 0,
			Bc = 0,
			Cc = 0,
			Dc = 0,
			Ec = 0,
			Fc = 0,
			Gc = 0,
			Hc = 0,
			Ic = 0,
			Jc = 0,
			Kc = 0,
			Lc = 0,
			Mc = 0,
			Nc = 0,
			Oc = 0,
			Pc = 0,
			Qc = 0,
			Rc = 0,
			Sc = 0,
			Tc = 0,
			Uc = 0,
			Vc = 0,
			Wc = 0,
			Xc = 0,
			Yc = 0,
			Zc = 0,
			_c = 0,
			$c = 0,
			ad = 0,
			bd = 0,
			cd = 0,
			dd = 0,
			ed = 0.0,
			fd = 0.0,
			gd = 0.0,
			hd = 0.0,
			id = 0.0,
			jd = 0.0,
			kd = 0.0,
			ld = 0,
			md = 0,
			nd = 0.0,
			od = 0,
			pd = 0.0;
		g = i;
		i = i + 512 | 0;
		h = g;
		switch (e | 0) {
			case 0:
				{
					j = 24;k = -149;l = 4;
					break
				}
			case 1:
				{
					j = 53;k = -1074;l = 4;
					break
				}
			case 2:
				{
					j = 53;k = -1074;l = 4;
					break
				}
			default:
				m = 0.0
		}
		a: do
			if ((l | 0) == 4) {
				e = b + 4 | 0;
				n = b + 100 | 0;
				do {
					o = c[e >> 2] | 0;
					if (o >>> 0 < (c[n >> 2] | 0) >>> 0) {
						c[e >> 2] = o + 1;
						p = d[o >> 0] | 0
					} else p = Gd(b) | 0
				} while ((zd(p) | 0) != 0);
				q = p;
				b: do switch (q | 0) {
						case 43:
						case 45:
							{
								o = 1 - (((q | 0) == 45 & 1) << 1) | 0;r = c[e >> 2] | 0;
								if (r >>> 0 < (c[n >> 2] | 0) >>> 0) {
									c[e >> 2] = r + 1;
									u = d[r >> 0] | 0;
									v = o;
									break b
								} else {
									u = Gd(b) | 0;
									v = o;
									break b
								}
								break
							}
						default:
							{
								u = q;v = 1
							}
					}
					while (0);
					o = u;
				r = 0;
				while (1) {
					if ((o | 32 | 0) != (a[17437 + r >> 0] | 0)) {
						w = o;
						x = r;
						break
					}
					do
						if (r >>> 0 < 7) {
							y = c[e >> 2] | 0;
							if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
								c[e >> 2] = y + 1;
								z = d[y >> 0] | 0;
								break
							} else {
								z = Gd(b) | 0;
								break
							}
						} else z = o; while (0);
					y = r + 1 | 0;
					if (y >>> 0 < 8) {
						o = z;
						r = y
					} else {
						w = z;
						x = y;
						break
					}
				}
				c: do switch (x | 0) {
						case 8:
							break;
						case 3:
							{
								l = 23;
								break
							}
						default:
							{
								r = (f | 0) != 0;
								if (r & x >>> 0 > 3)
									if ((x | 0) == 8) break c;
									else {
										l = 23;
										break c
									}
								d: do
									if (!x) {
										o = w;
										y = 0;
										while (1) {
											if ((o | 32 | 0) != (a[20314 + y >> 0] | 0)) {
												A = o;
												B = y;
												break d
											}
											do
												if (y >>> 0 < 2) {
													C = c[e >> 2] | 0;
													if (C >>> 0 < (c[n >> 2] | 0) >>> 0) {
														c[e >> 2] = C + 1;
														E = d[C >> 0] | 0;
														break
													} else {
														E = Gd(b) | 0;
														break
													}
												} else E = o; while (0);
											C = y + 1 | 0;
											if (C >>> 0 < 3) {
												o = E;
												y = C
											} else {
												A = E;
												B = C;
												break
											}
										}
									} else {
										A = w;
										B = x
									}while (0);
								switch (B | 0) {
									case 3:
										{
											y = c[e >> 2] | 0;
											if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
												c[e >> 2] = y + 1;
												F = d[y >> 0] | 0
											} else F = Gd(b) | 0;
											if ((F | 0) == 40) G = 1;
											else {
												if (!(c[n >> 2] | 0)) {
													m = s;
													break a
												}
												c[e >> 2] = (c[e >> 2] | 0) + -1;
												m = s;
												break a
											}
											while (1) {
												y = c[e >> 2] | 0;
												if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
													c[e >> 2] = y + 1;
													H = d[y >> 0] | 0
												} else H = Gd(b) | 0;
												if (!((H + -48 | 0) >>> 0 < 10 | (H + -65 | 0) >>> 0 < 26) ? !((H | 0) == 95 | (H + -97 | 0) >>> 0 < 26) : 0) {
													I = H;
													J = G;
													break
												}
												G = G + 1 | 0
											}
											if ((I | 0) == 41) {
												m = s;
												break a
											}
											y = (c[n >> 2] | 0) == 0;
											if (!y) c[e >> 2] = (c[e >> 2] | 0) + -1;
											if (!r) {
												c[(Bd() | 0) >> 2] = 22;
												Fd(b, 0);
												m = 0.0;
												break a
											}
											if (!J) {
												m = s;
												break a
											} else K = J;
											while (1) {
												K = K + -1 | 0;
												if (!y) c[e >> 2] = (c[e >> 2] | 0) + -1;
												if (!K) {
													m = s;
													break a
												}
											}
											break
										}
									case 0:
										{
											do
												if ((A | 0) == 48) {
													y = c[e >> 2] | 0;
													if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
														c[e >> 2] = y + 1;
														L = d[y >> 0] | 0
													} else L = Gd(b) | 0;
													if ((L | 32 | 0) != 120) {
														if (!(c[n >> 2] | 0)) {
															M = 48;
															break
														}
														c[e >> 2] = (c[e >> 2] | 0) + -1;
														M = 48;
														break
													}
													y = c[e >> 2] | 0;
													if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
														c[e >> 2] = y + 1;
														N = d[y >> 0] | 0;
														P = 0
													} else {
														N = Gd(b) | 0;
														P = 0
													}
													e: while (1) {
														switch (N | 0) {
															case 46:
																{
																	Q = P;l = 74;
																	break e;
																	break
																}
															case 48:
																break;
															default:
																{
																	R = 0;S = 0;T = 0;U = 0;V = N;W = P;X = 0;Y = 0;Z = 1.0;_ = 0;aa = 0.0;
																	break e
																}
														}
														y = c[e >> 2] | 0;
														if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
															c[e >> 2] = y + 1;
															N = d[y >> 0] | 0;
															P = 1;
															continue
														} else {
															N = Gd(b) | 0;
															P = 1;
															continue
														}
													}
													if ((l | 0) == 74) {
														y = c[e >> 2] | 0;
														if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
															c[e >> 2] = y + 1;
															ba = d[y >> 0] | 0
														} else ba = Gd(b) | 0;
														if ((ba | 0) == 48) {
															y = 0;
															r = 0;
															while (1) {
																o = c[e >> 2] | 0;
																if (o >>> 0 < (c[n >> 2] | 0) >>> 0) {
																	c[e >> 2] = o + 1;
																	ca = d[o >> 0] | 0
																} else ca = Gd(b) | 0;
																o = jp(y | 0, r | 0, -1, -1) | 0;
																C = D;
																if ((ca | 0) == 48) {
																	y = o;
																	r = C
																} else {
																	R = 0;
																	S = 0;
																	T = o;
																	U = C;
																	V = ca;
																	W = 1;
																	X = 1;
																	Y = 0;
																	Z = 1.0;
																	_ = 0;
																	aa = 0.0;
																	break
																}
															}
														} else {
															R = 0;
															S = 0;
															T = 0;
															U = 0;
															V = ba;
															W = Q;
															X = 1;
															Y = 0;
															Z = 1.0;
															_ = 0;
															aa = 0.0
														}
													}
													while (1) {
														r = V + -48 | 0;
														y = V | 32;
														if (r >>> 0 >= 10) {
															C = (V | 0) == 46;
															if (!(C | (y + -97 | 0) >>> 0 < 6)) {
																da = S;
																ea = T;
																fa = R;
																ga = U;
																ha = V;
																ia = W;
																ja = X;
																ka = _;
																la = aa;
																break
															}
															if (C)
																if (!X) {
																	ma = S;
																	na = R;
																	oa = S;
																	pa = R;
																	qa = W;
																	ra = 1;
																	sa = Y;
																	ta = Z;
																	ua = _;
																	va = aa
																} else {
																	da = S;
																	ea = T;
																	fa = R;
																	ga = U;
																	ha = 46;
																	ia = W;
																	ja = X;
																	ka = _;
																	la = aa;
																	break
																}
															else l = 86
														} else l = 86;
														if ((l | 0) == 86) {
															l = 0;
															C = (V | 0) > 57 ? y + -87 | 0 : r;
															do
																if (!((R | 0) < 0 | (R | 0) == 0 & S >>> 0 < 8)) {
																	if ((R | 0) < 0 | (R | 0) == 0 & S >>> 0 < 14) {
																		wa = Z * .0625;
																		xa = Y;
																		ya = wa;
																		za = _;
																		Aa = aa + wa * +(C | 0);
																		break
																	}
																	if ((Y | 0) != 0 | (C | 0) == 0) {
																		xa = Y;
																		ya = Z;
																		za = _;
																		Aa = aa
																	} else {
																		xa = 1;
																		ya = Z;
																		za = _;
																		Aa = aa + Z * .5
																	}
																} else {
																	xa = Y;
																	ya = Z;
																	za = C + (_ << 4) | 0;
																	Aa = aa
																}
															while (0);
															C = jp(S | 0, R | 0, 1, 0) | 0;
															ma = T;
															na = U;
															oa = C;
															pa = D;
															qa = 1;
															ra = X;
															sa = xa;
															ta = ya;
															ua = za;
															va = Aa
														}
														C = c[e >> 2] | 0;
														if (C >>> 0 < (c[n >> 2] | 0) >>> 0) {
															c[e >> 2] = C + 1;
															R = pa;
															S = oa;
															T = ma;
															U = na;
															V = d[C >> 0] | 0;
															W = qa;
															X = ra;
															Y = sa;
															Z = ta;
															_ = ua;
															aa = va;
															continue
														} else {
															R = pa;
															S = oa;
															T = ma;
															U = na;
															V = Gd(b) | 0;
															W = qa;
															X = ra;
															Y = sa;
															Z = ta;
															_ = ua;
															aa = va;
															continue
														}
													}
													if (!ia) {
														C = (c[n >> 2] | 0) == 0;
														if (!C) c[e >> 2] = (c[e >> 2] | 0) + -1;
														if (f) {
															if (!C ? (C = c[e >> 2] | 0, c[e >> 2] = C + -1, (ja | 0) != 0) : 0) c[e >> 2] = C + -2
														} else Fd(b, 0);
														m = +(v | 0) * 0.0;
														break a
													}
													C = (ja | 0) == 0;
													r = C ? da : ea;
													y = C ? fa : ga;
													if ((fa | 0) < 0 | (fa | 0) == 0 & da >>> 0 < 8) {
														C = da;
														o = fa;
														Ba = ka;
														while (1) {
															Ca = Ba << 4;
															C = jp(C | 0, o | 0, 1, 0) | 0;
															o = D;
															if (!((o | 0) < 0 | (o | 0) == 0 & C >>> 0 < 8)) {
																Da = Ca;
																break
															} else Ba = Ca
														}
													} else Da = ka;
													if ((ha | 32 | 0) == 112) {
														Ba = Xe(b, f) | 0;
														C = D;
														if ((Ba | 0) == 0 & (C | 0) == -2147483648) {
															if (!f) {
																Fd(b, 0);
																m = 0.0;
																break a
															}
															if (!(c[n >> 2] | 0)) {
																Ea = 0;
																Fa = 0
															} else {
																c[e >> 2] = (c[e >> 2] | 0) + -1;
																Ea = 0;
																Fa = 0
															}
														} else {
															Ea = Ba;
															Fa = C
														}
													} else if (!(c[n >> 2] | 0)) {
														Ea = 0;
														Fa = 0
													} else {
														c[e >> 2] = (c[e >> 2] | 0) + -1;
														Ea = 0;
														Fa = 0
													}
													C = mp(r | 0, y | 0, 2) | 0;
													Ba = jp(C | 0, D | 0, -32, -1) | 0;
													C = jp(Ba | 0, D | 0, Ea | 0, Fa | 0) | 0;
													Ba = D;
													if (!Da) {
														m = +(v | 0) * 0.0;
														break a
													}
													if ((Ba | 0) > 0 | (Ba | 0) == 0 & C >>> 0 > (0 - k | 0) >>> 0) {
														c[(Bd() | 0) >> 2] = 34;
														m = +(v | 0) * 1797693134862315708145274.0e284 * 1797693134862315708145274.0e284;
														break a
													}
													o = k + -106 | 0;
													Ca = ((o | 0) < 0) << 31 >> 31;
													if ((Ba | 0) < (Ca | 0) | (Ba | 0) == (Ca | 0) & C >>> 0 < o >>> 0) {
														c[(Bd() | 0) >> 2] = 34;
														m = +(v | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308;
														break a
													}
													if ((Da | 0) > -1) {
														o = C;
														Ca = Ba;
														Ga = Da;
														wa = la;
														while (1) {
															Ha = !(wa >= .5);
															Ia = Ha & 1 | Ga << 1;
															Ja = Ia ^ 1;
															Ka = wa + (Ha ? wa : wa + -1.0);
															Ha = jp(o | 0, Ca | 0, -1, -1) | 0;
															La = D;
															if ((Ia | 0) > -1) {
																o = Ha;
																Ca = La;
																Ga = Ja;
																wa = Ka
															} else {
																Ma = Ha;
																Na = La;
																Oa = Ja;
																Pa = Ka;
																break
															}
														}
													} else {
														Ma = C;
														Na = Ba;
														Oa = Da;
														Pa = la
													}
													Ga = hp(32, 0, k | 0, ((k | 0) < 0) << 31 >> 31 | 0) | 0;
													Ca = jp(Ma | 0, Na | 0, Ga | 0, D | 0) | 0;
													Ga = D;
													if (0 > (Ga | 0) | 0 == (Ga | 0) & j >>> 0 > Ca >>> 0)
														if ((Ca | 0) < 0) {
															Qa = 0;
															l = 127
														} else {
															Ra = Ca;
															l = 125
														}
													else {
														Ra = j;
														l = 125
													}
													if ((l | 0) == 125)
														if ((Ra | 0) < 53) {
															Qa = Ra;
															l = 127
														} else {
															Sa = Ra;
															Ta = +(v | 0);
															Ua = 0.0
														}
													if ((l | 0) == 127) {
														wa = +(v | 0);
														Sa = Qa;
														Ta = wa;
														Ua = +Rd(+Yd(1.0, 84 - Qa | 0), wa)
													}
													Ca = (Oa & 1 | 0) == 0 & (Pa != 0.0 & (Sa | 0) < 32);
													wa = Ta * (Ca ? 0.0 : Pa) + (Ua + Ta * +(((Ca & 1) + Oa | 0) >>> 0)) - Ua;
													if (!(wa != 0.0)) c[(Bd() | 0) >> 2] = 34;
													m = +Zd(wa, Ma);
													break a
												} else M = A; while (0);Ca = k + j | 0;Ga = 0 - Ca | 0;o = M;y = 0;f: while (1) {
												switch (o | 0) {
													case 46:
														{
															Va = y;l = 138;
															break f;
															break
														}
													case 48:
														break;
													default:
														{
															Wa = o;Xa = 0;Ya = 0;Za = y;_a = 0;
															break f
														}
												}
												r = c[e >> 2] | 0;
												if (r >>> 0 < (c[n >> 2] | 0) >>> 0) {
													c[e >> 2] = r + 1;
													o = d[r >> 0] | 0;
													y = 1;
													continue
												} else {
													o = Gd(b) | 0;
													y = 1;
													continue
												}
											}
											if ((l | 0) == 138) {
												y = c[e >> 2] | 0;
												if (y >>> 0 < (c[n >> 2] | 0) >>> 0) {
													c[e >> 2] = y + 1;
													$a = d[y >> 0] | 0
												} else $a = Gd(b) | 0;
												if (($a | 0) == 48) {
													y = 0;
													o = 0;
													while (1) {
														r = jp(y | 0, o | 0, -1, -1) | 0;
														Ja = D;
														La = c[e >> 2] | 0;
														if (La >>> 0 < (c[n >> 2] | 0) >>> 0) {
															c[e >> 2] = La + 1;
															ab = d[La >> 0] | 0
														} else ab = Gd(b) | 0;
														if ((ab | 0) == 48) {
															y = r;
															o = Ja
														} else {
															Wa = ab;
															Xa = r;
															Ya = Ja;
															Za = 1;
															_a = 1;
															break
														}
													}
												} else {
													Wa = $a;
													Xa = 0;
													Ya = 0;
													Za = Va;
													_a = 1
												}
											}
											c[h >> 2] = 0;o = Wa + -48 | 0;y = (Wa | 0) == 46;g: do
												if (y | o >>> 0 < 10) {
													Ja = h + 496 | 0;
													r = Wa;
													La = 0;
													Ha = 0;
													Ia = y;
													bb = o;
													cb = Xa;
													db = Ya;
													eb = Za;
													fb = _a;
													gb = 0;
													hb = 0;
													ib = 0;
													h: while (1) {
														do
															if (Ia)
																if (!fb) {
																	jb = La;
																	kb = Ha;
																	lb = La;
																	mb = Ha;
																	nb = eb;
																	ob = 1;
																	pb = gb;
																	qb = hb;
																	rb = ib
																} else {
																	sb = cb;
																	tb = db;
																	ub = La;
																	vb = Ha;
																	wb = eb;
																	xb = gb;
																	yb = hb;
																	zb = ib;
																	break h
																}
														else {
															Ab = jp(La | 0, Ha | 0, 1, 0) | 0;
															Bb = D;
															Cb = (r | 0) != 48;
															if ((hb | 0) >= 125) {
																if (!Cb) {
																	jb = cb;
																	kb = db;
																	lb = Ab;
																	mb = Bb;
																	nb = eb;
																	ob = fb;
																	pb = gb;
																	qb = hb;
																	rb = ib;
																	break
																}
																c[Ja >> 2] = c[Ja >> 2] | 1;
																jb = cb;
																kb = db;
																lb = Ab;
																mb = Bb;
																nb = eb;
																ob = fb;
																pb = gb;
																qb = hb;
																rb = ib;
																break
															}
															Db = h + (hb << 2) | 0;
															if (!gb) Eb = bb;
															else Eb = r + -48 + ((c[Db >> 2] | 0) * 10 | 0) | 0;
															c[Db >> 2] = Eb;
															Db = gb + 1 | 0;
															Fb = (Db | 0) == 9;
															jb = cb;
															kb = db;
															lb = Ab;
															mb = Bb;
															nb = 1;
															ob = fb;
															pb = Fb ? 0 : Db;
															qb = (Fb & 1) + hb | 0;
															rb = Cb ? Ab : ib
														} while (0);
														Ab = c[e >> 2] | 0;
														if (Ab >>> 0 < (c[n >> 2] | 0) >>> 0) {
															c[e >> 2] = Ab + 1;
															Gb = d[Ab >> 0] | 0
														} else Gb = Gd(b) | 0;
														bb = Gb + -48 | 0;
														Ia = (Gb | 0) == 46;
														if (!(Ia | bb >>> 0 < 10)) {
															Hb = Gb;
															Ib = lb;
															Jb = jb;
															Kb = mb;
															Lb = kb;
															Mb = nb;
															Nb = ob;
															Ob = pb;
															Pb = qb;
															Qb = rb;
															l = 161;
															break g
														} else {
															r = Gb;
															La = lb;
															Ha = mb;
															cb = jb;
															db = kb;
															eb = nb;
															fb = ob;
															gb = pb;
															hb = qb;
															ib = rb
														}
													}
													Rb = ub;
													Sb = vb;
													Tb = sb;
													Ub = tb;
													Vb = (wb | 0) != 0;
													Wb = xb;
													Xb = yb;
													Yb = zb;
													l = 169
												} else {
													Hb = Wa;
													Ib = 0;
													Jb = Xa;
													Kb = 0;
													Lb = Ya;
													Mb = Za;
													Nb = _a;
													Ob = 0;
													Pb = 0;
													Qb = 0;
													l = 161
												}while (0);do
												if ((l | 0) == 161) {
													o = (Nb | 0) == 0;
													y = o ? Ib : Jb;
													ib = o ? Kb : Lb;
													o = (Mb | 0) != 0;
													if (!((Hb | 32 | 0) == 101 & o))
														if ((Hb | 0) > -1) {
															Rb = Ib;
															Sb = Kb;
															Tb = y;
															Ub = ib;
															Vb = o;
															Wb = Ob;
															Xb = Pb;
															Yb = Qb;
															l = 169;
															break
														} else {
															Zb = Ib;
															_b = Kb;
															$b = o;
															ac = y;
															bc = ib;
															cc = Ob;
															dc = Pb;
															ec = Qb;
															l = 171;
															break
														}
													o = Xe(b, f) | 0;
													hb = D;
													if ((o | 0) == 0 & (hb | 0) == -2147483648) {
														if (!f) {
															Fd(b, 0);
															fc = 0.0;
															break
														}
														if (!(c[n >> 2] | 0)) {
															gc = 0;
															hc = 0
														} else {
															c[e >> 2] = (c[e >> 2] | 0) + -1;
															gc = 0;
															hc = 0
														}
													} else {
														gc = o;
														hc = hb
													}
													hb = jp(gc | 0, hc | 0, y | 0, ib | 0) | 0;
													ic = hb;
													jc = Ib;
													kc = D;
													lc = Kb;
													mc = Ob;
													nc = Pb;
													oc = Qb;
													l = 173
												}
											while (0);
											if ((l | 0) == 169)
												if (c[n >> 2] | 0) {
													c[e >> 2] = (c[e >> 2] | 0) + -1;
													if (Vb) {
														ic = Tb;
														jc = Rb;
														kc = Ub;
														lc = Sb;
														mc = Wb;
														nc = Xb;
														oc = Yb;
														l = 173
													} else l = 172
												} else {
													Zb = Rb;
													_b = Sb;
													$b = Vb;
													ac = Tb;
													bc = Ub;
													cc = Wb;
													dc = Xb;
													ec = Yb;
													l = 171
												}
											if ((l | 0) == 171)
												if ($b) {
													ic = ac;
													jc = Zb;
													kc = bc;
													lc = _b;
													mc = cc;
													nc = dc;
													oc = ec;
													l = 173
												} else l = 172;do
												if ((l | 0) == 172) {
													c[(Bd() | 0) >> 2] = 22;
													Fd(b, 0);
													fc = 0.0
												} else if ((l | 0) == 173) {
												hb = c[h >> 2] | 0;
												if (!hb) {
													fc = +(v | 0) * 0.0;
													break
												}
												if (((lc | 0) < 0 | (lc | 0) == 0 & jc >>> 0 < 10) & ((ic | 0) == (jc | 0) & (kc | 0) == (lc | 0)) ? j >>> 0 > 30 | (hb >>> j | 0) == 0 : 0) {
													fc = +(v | 0) * +(hb >>> 0);
													break
												}
												hb = (k | 0) / -2 | 0;
												ib = ((hb | 0) < 0) << 31 >> 31;
												if ((kc | 0) > (ib | 0) | (kc | 0) == (ib | 0) & ic >>> 0 > hb >>> 0) {
													c[(Bd() | 0) >> 2] = 34;
													fc = +(v | 0) * 1797693134862315708145274.0e284 * 1797693134862315708145274.0e284;
													break
												}
												hb = k + -106 | 0;
												ib = ((hb | 0) < 0) << 31 >> 31;
												if ((kc | 0) < (ib | 0) | (kc | 0) == (ib | 0) & ic >>> 0 < hb >>> 0) {
													c[(Bd() | 0) >> 2] = 34;
													fc = +(v | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308;
													break
												}
												if (!mc) pc = nc;
												else {
													if ((mc | 0) < 9) {
														hb = h + (nc << 2) | 0;
														ib = c[hb >> 2] | 0;
														y = mc;
														while (1) {
															o = ib * 10 | 0;
															y = y + 1 | 0;
															if ((y | 0) == 9) {
																qc = o;
																break
															} else ib = o
														}
														c[hb >> 2] = qc
													}
													pc = nc + 1 | 0
												}
												if ((oc | 0) < 9 ? (oc | 0) <= (ic | 0) & (ic | 0) < 18 : 0) {
													if ((ic | 0) == 9) {
														fc = +(v | 0) * +((c[h >> 2] | 0) >>> 0);
														break
													}
													if ((ic | 0) < 9) {
														fc = +(v | 0) * +((c[h >> 2] | 0) >>> 0) / +(c[3612 + (8 - ic << 2) >> 2] | 0);
														break
													}
													ib = j + 27 + ($(ic, -3) | 0) | 0;
													y = c[h >> 2] | 0;
													if ((ib | 0) > 30 | (y >>> ib | 0) == 0) {
														fc = +(v | 0) * +(y >>> 0) * +(c[3612 + (ic + -10 << 2) >> 2] | 0);
														break
													}
												}
												y = (ic | 0) % 9 | 0;
												if (!y) {
													rc = 0;
													sc = 0;
													tc = ic;
													uc = pc
												} else {
													ib = (ic | 0) > -1 ? y : y + 9 | 0;
													y = c[3612 + (8 - ib << 2) >> 2] | 0;
													if (pc) {
														o = 1e9 / (y | 0) | 0;
														gb = 0;
														fb = 0;
														eb = 0;
														db = ic;
														while (1) {
															cb = h + (eb << 2) | 0;
															Ha = c[cb >> 2] | 0;
															La = ((Ha >>> 0) / (y >>> 0) | 0) + fb | 0;
															c[cb >> 2] = La;
															cb = $((Ha >>> 0) % (y >>> 0) | 0, o) | 0;
															Ha = (eb | 0) == (gb | 0) & (La | 0) == 0;
															eb = eb + 1 | 0;
															La = Ha ? db + -9 | 0 : db;
															r = Ha ? eb & 127 : gb;
															if ((eb | 0) == (pc | 0)) {
																vc = cb;
																wc = r;
																xc = La;
																break
															} else {
																gb = r;
																fb = cb;
																db = La
															}
														}
														if (!vc) {
															yc = wc;
															zc = xc;
															Ac = pc
														} else {
															c[h + (pc << 2) >> 2] = vc;
															yc = wc;
															zc = xc;
															Ac = pc + 1 | 0
														}
													} else {
														yc = 0;
														zc = ic;
														Ac = 0
													}
													rc = yc;
													sc = 0;
													tc = 9 - ib + zc | 0;
													uc = Ac
												}
												i: while (1) {
													db = (tc | 0) < 18;
													fb = (tc | 0) == 18;
													gb = h + (rc << 2) | 0;
													eb = sc;
													o = uc;
													while (1) {
														if (!db) {
															if (!fb) {
																Bc = rc;
																Cc = eb;
																Dc = tc;
																Ec = o;
																break i
															}
															if ((c[gb >> 2] | 0) >>> 0 >= 9007199) {
																Bc = rc;
																Cc = eb;
																Dc = 18;
																Ec = o;
																break i
															}
														}
														y = 0;
														hb = o + 127 | 0;
														La = o;
														while (1) {
															cb = hb & 127;
															r = h + (cb << 2) | 0;
															Ha = mp(c[r >> 2] | 0, 0, 29) | 0;
															bb = jp(Ha | 0, D | 0, y | 0, 0) | 0;
															Ha = D;
															if (Ha >>> 0 > 0 | (Ha | 0) == 0 & bb >>> 0 > 1e9) {
																Ia = up(bb | 0, Ha | 0, 1e9, 0) | 0;
																Ja = vp(bb | 0, Ha | 0, 1e9, 0) | 0;
																Fc = Ja;
																Gc = Ia
															} else {
																Fc = bb;
																Gc = 0
															}
															c[r >> 2] = Fc;
															r = (cb | 0) == (rc | 0);
															bb = (cb | 0) != (La + 127 & 127 | 0) | r ? La : (Fc | 0) == 0 ? cb : La;
															if (r) {
																Hc = Gc;
																Ic = bb;
																break
															} else {
																y = Gc;
																hb = cb + -1 | 0;
																La = bb
															}
														}
														La = eb + -29 | 0;
														if (!Hc) {
															eb = La;
															o = Ic
														} else {
															Jc = La;
															Kc = Hc;
															Lc = Ic;
															break
														}
													}
													o = rc + 127 & 127;
													if ((o | 0) == (Lc | 0)) {
														eb = Lc + 127 & 127;
														gb = h + ((Lc + 126 & 127) << 2) | 0;
														c[gb >> 2] = c[gb >> 2] | c[h + (eb << 2) >> 2];
														Mc = eb
													} else Mc = Lc;
													c[h + (o << 2) >> 2] = Kc;
													rc = o;
													sc = Jc;
													tc = tc + 9 | 0;
													uc = Mc
												}
												j: while (1) {
													Nc = Ec + 1 & 127;
													ib = h + ((Ec + 127 & 127) << 2) | 0;
													o = Bc;
													eb = Cc;
													gb = Dc;
													while (1) {
														fb = (gb | 0) == 18;
														db = (gb | 0) > 27 ? 9 : 1;
														La = fb ^ 1;
														Oc = o;
														Pc = eb;
														while (1) {
															Qc = Oc & 127;
															Rc = (Qc | 0) == (Ec | 0);
															do
																if (!Rc) {
																	hb = c[h + (Qc << 2) >> 2] | 0;
																	if (hb >>> 0 < 9007199) {
																		l = 219;
																		break
																	}
																	if (hb >>> 0 > 9007199) break;
																	hb = Oc + 1 & 127;
																	if ((hb | 0) == (Ec | 0)) {
																		l = 219;
																		break
																	}
																	y = c[h + (hb << 2) >> 2] | 0;
																	if (y >>> 0 < 254740991) {
																		l = 219;
																		break
																	}
																	if (!(y >>> 0 > 254740991 | La)) {
																		Sc = Qc;
																		Tc = Oc;
																		Uc = Pc;
																		Vc = Ec;
																		break j
																	}
																} else l = 219; while (0);
															if ((l | 0) == 219 ? (l = 0, fb) : 0) {
																l = 220;
																break j
															}
															y = Pc + db | 0;
															if ((Oc | 0) == (Ec | 0)) {
																Oc = Ec;
																Pc = y
															} else {
																Wc = y;
																Xc = Oc;
																break
															}
														}
														fb = (1 << db) + -1 | 0;
														La = 1e9 >>> db;
														y = Xc;
														hb = 0;
														bb = Xc;
														cb = gb;
														while (1) {
															r = h + (bb << 2) | 0;
															Ia = c[r >> 2] | 0;
															Ja = (Ia >>> db) + hb | 0;
															c[r >> 2] = Ja;
															r = $(Ia & fb, La) | 0;
															Ia = (bb | 0) == (y | 0) & (Ja | 0) == 0;
															bb = bb + 1 & 127;
															Ja = Ia ? cb + -9 | 0 : cb;
															Ha = Ia ? bb : y;
															if ((bb | 0) == (Ec | 0)) {
																Yc = r;
																Zc = Ha;
																_c = Ja;
																break
															} else {
																y = Ha;
																hb = r;
																cb = Ja
															}
														}
														if (!Yc) {
															o = Zc;
															eb = Wc;
															gb = _c;
															continue
														}
														if ((Nc | 0) != (Zc | 0)) {
															$c = Wc;
															ad = Yc;
															bd = Zc;
															cd = _c;
															break
														}
														c[ib >> 2] = c[ib >> 2] | 1;
														o = Zc;
														eb = Wc;
														gb = _c
													}
													c[h + (Ec << 2) >> 2] = ad;
													Bc = bd;
													Cc = $c;
													Dc = cd;
													Ec = Nc
												}
												if ((l | 0) == 220)
													if (Rc) {
														c[h + (Nc + -1 << 2) >> 2] = 0;
														Sc = Ec;
														Tc = Oc;
														Uc = Pc;
														Vc = Nc
													} else {
														Sc = Qc;
														Tc = Oc;
														Uc = Pc;
														Vc = Ec
													}
												wa = +((c[h + (Sc << 2) >> 2] | 0) >>> 0);
												gb = Tc + 1 & 127;
												if ((gb | 0) == (Vc | 0)) {
													eb = Tc + 2 & 127;
													c[h + (eb + -1 << 2) >> 2] = 0;
													dd = eb
												} else dd = Vc;
												Ka = +(v | 0);
												ed = Ka * (wa * 1.0e9 + +((c[h + (gb << 2) >> 2] | 0) >>> 0));
												gb = Uc + 53 | 0;
												eb = gb - k | 0;
												o = (eb | 0) < (j | 0);
												ib = o & 1;
												cb = o ? ((eb | 0) < 0 ? 0 : eb) : j;
												if ((cb | 0) < 53) {
													wa = +Rd(+Yd(1.0, 105 - cb | 0), ed);
													fd = +Vd(ed, +Yd(1.0, 53 - cb | 0));
													gd = wa;
													hd = fd;
													id = wa + (ed - fd)
												} else {
													gd = 0.0;
													hd = 0.0;
													id = ed
												}
												hb = Tc + 2 & 127;
												do
													if ((hb | 0) == (dd | 0)) jd = hd;
													else {
														y = c[h + (hb << 2) >> 2] | 0;
														do
															if (y >>> 0 >= 5e8) {
																if (y >>> 0 > 5e8) {
																	kd = Ka * .75 + hd;
																	break
																}
																if ((Tc + 3 & 127 | 0) == (dd | 0)) {
																	kd = Ka * .5 + hd;
																	break
																} else {
																	kd = Ka * .75 + hd;
																	break
																}
															} else {
																if ((y | 0) == 0 ? (Tc + 3 & 127 | 0) == (dd | 0) : 0) {
																	kd = hd;
																	break
																}
																kd = Ka * .25 + hd
															}
														while (0);
														if ((53 - cb | 0) <= 1) {
															jd = kd;
															break
														}
														if (+Vd(kd, 1.0) != 0.0) {
															jd = kd;
															break
														}
														jd = kd + 1.0
													}
												while (0);
												Ka = id + jd - gd;
												do
													if ((gb & 2147483647 | 0) > (-2 - Ca | 0)) {
														if (!(+O(+Ka) >= 9007199254740992.0)) {
															ld = ib;
															md = Uc;
															nd = Ka
														} else {
															ld = o & (cb | 0) == (eb | 0) ? 0 : ib;
															md = Uc + 1 | 0;
															nd = Ka * .5
														}
														if ((md + 50 | 0) <= (Ga | 0) ? !(jd != 0.0 & (ld | 0) != 0) : 0) {
															od = md;
															pd = nd;
															break
														}
														c[(Bd() | 0) >> 2] = 34;
														od = md;
														pd = nd
													} else {
														od = Uc;
														pd = Ka
													}
												while (0);
												fc = +Zd(pd, od)
											} while (0);m = fc;
											break a;
											break
										}
									default:
										{
											if (c[n >> 2] | 0) c[e >> 2] = (c[e >> 2] | 0) + -1;c[(Bd() | 0) >> 2] = 22;Fd(b, 0);m = 0.0;
											break a
										}
								}
							}
					}
					while (0);
					if ((l | 0) == 23) {
						Ga = (c[n >> 2] | 0) == 0;
						if (!Ga) c[e >> 2] = (c[e >> 2] | 0) + -1;
						if ((f | 0) != 0 & x >>> 0 > 3) {
							Ca = x;
							do {
								if (!Ga) c[e >> 2] = (c[e >> 2] | 0) + -1;
								Ca = Ca + -1 | 0
							} while (Ca >>> 0 > 3)
						}
					}
				m = +(v | 0) * t
			}
		while (0);
		i = g;
		return +m
	}

	function Ed(b, e, f, g, h) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		var i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0;
		a: do
			if (e >>> 0 > 36) {
				c[(Bd() | 0) >> 2] = 22;
				i = 0;
				j = 0
			} else {
				k = b + 4 | 0;
				l = b + 100 | 0;
				do {
					m = c[k >> 2] | 0;
					if (m >>> 0 < (c[l >> 2] | 0) >>> 0) {
						c[k >> 2] = m + 1;
						n = d[m >> 0] | 0
					} else n = Gd(b) | 0
				} while ((zd(n) | 0) != 0);
				o = n;
				b: do switch (o | 0) {
						case 43:
						case 45:
							{
								m = ((o | 0) == 45) << 31 >> 31;p = c[k >> 2] | 0;
								if (p >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = p + 1;
									q = d[p >> 0] | 0;
									r = m;
									break b
								} else {
									q = Gd(b) | 0;
									r = m;
									break b
								}
								break
							}
						default:
							{
								q = o;r = 0
							}
					}
					while (0);
					m = (e | 0) == 0;
				do
					if ((e & -17 | 0) == 0 & (q | 0) == 48) {
						p = c[k >> 2] | 0;
						if (p >>> 0 < (c[l >> 2] | 0) >>> 0) {
							c[k >> 2] = p + 1;
							s = d[p >> 0] | 0
						} else s = Gd(b) | 0;
						if ((s | 32 | 0) != 120)
							if (m) {
								t = 8;
								u = s;
								v = 46;
								break
							} else {
								w = e;
								x = s;
								v = 32;
								break
							}
						p = c[k >> 2] | 0;
						if (p >>> 0 < (c[l >> 2] | 0) >>> 0) {
							c[k >> 2] = p + 1;
							y = d[p >> 0] | 0
						} else y = Gd(b) | 0;
						if ((d[17446 + (y + 1) >> 0] | 0) > 15) {
							p = (c[l >> 2] | 0) == 0;
							if (!p) c[k >> 2] = (c[k >> 2] | 0) + -1;
							if (!f) {
								Fd(b, 0);
								i = 0;
								j = 0;
								break a
							}
							if (p) {
								i = 0;
								j = 0;
								break a
							}
							c[k >> 2] = (c[k >> 2] | 0) + -1;
							i = 0;
							j = 0;
							break a
						} else {
							t = 16;
							u = y;
							v = 46
						}
					} else {
						p = m ? 10 : e;
						if ((d[17446 + (q + 1) >> 0] | 0) >>> 0 < p >>> 0) {
							w = p;
							x = q;
							v = 32
						} else {
							if (c[l >> 2] | 0) c[k >> 2] = (c[k >> 2] | 0) + -1;
							Fd(b, 0);
							c[(Bd() | 0) >> 2] = 22;
							i = 0;
							j = 0;
							break a
						}
					}
				while (0);
				if ((v | 0) == 32)
					if ((w | 0) == 10) {
						m = x + -48 | 0;
						if (m >>> 0 < 10) {
							p = m;
							m = 0;
							while (1) {
								z = (m * 10 | 0) + p | 0;
								A = c[k >> 2] | 0;
								if (A >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = A + 1;
									B = d[A >> 0] | 0
								} else B = Gd(b) | 0;
								p = B + -48 | 0;
								if (!(p >>> 0 < 10 & z >>> 0 < 429496729)) {
									C = z;
									E = B;
									break
								} else m = z
							}
							F = C;
							G = 0;
							H = E
						} else {
							F = 0;
							G = 0;
							H = x
						}
						m = H + -48 | 0;
						if (m >>> 0 < 10) {
							p = F;
							z = G;
							A = m;
							m = H;
							while (1) {
								I = tp(p | 0, z | 0, 10, 0) | 0;
								J = D;
								K = ((A | 0) < 0) << 31 >> 31;
								L = ~K;
								if (J >>> 0 > L >>> 0 | (J | 0) == (L | 0) & I >>> 0 > ~A >>> 0) {
									M = A;
									N = p;
									O = z;
									P = m;
									break
								}
								L = jp(I | 0, J | 0, A | 0, K | 0) | 0;
								K = D;
								J = c[k >> 2] | 0;
								if (J >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = J + 1;
									Q = d[J >> 0] | 0
								} else Q = Gd(b) | 0;
								J = Q + -48 | 0;
								if (J >>> 0 < 10 & (K >>> 0 < 429496729 | (K | 0) == 429496729 & L >>> 0 < 2576980378)) {
									p = L;
									z = K;
									A = J;
									m = Q
								} else {
									M = J;
									N = L;
									O = K;
									P = Q;
									break
								}
							}
							if (M >>> 0 > 9) {
								R = O;
								S = N;
								T = r
							} else {
								U = 10;
								V = N;
								W = O;
								X = P;
								v = 72
							}
						} else {
							R = G;
							S = F;
							T = r
						}
					} else {
						t = w;
						u = x;
						v = 46
					}
				c: do
					if ((v | 0) == 46) {
						if (!(t + -1 & t)) {
							m = a[17703 + ((t * 23 | 0) >>> 5 & 7) >> 0] | 0;
							A = a[17446 + (u + 1) >> 0] | 0;
							z = A & 255;
							if (z >>> 0 < t >>> 0) {
								p = z;
								z = 0;
								while (1) {
									K = p | z << m;
									L = c[k >> 2] | 0;
									if (L >>> 0 < (c[l >> 2] | 0) >>> 0) {
										c[k >> 2] = L + 1;
										Y = d[L >> 0] | 0
									} else Y = Gd(b) | 0;
									L = a[17446 + (Y + 1) >> 0] | 0;
									p = L & 255;
									if (!(K >>> 0 < 134217728 & p >>> 0 < t >>> 0)) {
										Z = K;
										_ = L;
										aa = Y;
										break
									} else z = K
								}
								ba = _;
								ca = 0;
								da = Z;
								ea = aa
							} else {
								ba = A;
								ca = 0;
								da = 0;
								ea = u
							}
							z = kp(-1, -1, m | 0) | 0;
							p = D;
							if ((ba & 255) >>> 0 >= t >>> 0 | (ca >>> 0 > p >>> 0 | (ca | 0) == (p | 0) & da >>> 0 > z >>> 0)) {
								U = t;
								V = da;
								W = ca;
								X = ea;
								v = 72;
								break
							} else {
								fa = da;
								ga = ca;
								ha = ba
							}
							while (1) {
								K = mp(fa | 0, ga | 0, m | 0) | 0;
								L = D;
								J = ha & 255 | K;
								K = c[k >> 2] | 0;
								if (K >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = K + 1;
									ia = d[K >> 0] | 0
								} else ia = Gd(b) | 0;
								ha = a[17446 + (ia + 1) >> 0] | 0;
								if ((ha & 255) >>> 0 >= t >>> 0 | (L >>> 0 > p >>> 0 | (L | 0) == (p | 0) & J >>> 0 > z >>> 0)) {
									U = t;
									V = J;
									W = L;
									X = ia;
									v = 72;
									break c
								} else {
									fa = J;
									ga = L
								}
							}
						}
						z = a[17446 + (u + 1) >> 0] | 0;
						p = z & 255;
						if (p >>> 0 < t >>> 0) {
							m = p;
							p = 0;
							while (1) {
								A = m + ($(p, t) | 0) | 0;
								L = c[k >> 2] | 0;
								if (L >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = L + 1;
									ja = d[L >> 0] | 0
								} else ja = Gd(b) | 0;
								L = a[17446 + (ja + 1) >> 0] | 0;
								m = L & 255;
								if (!(A >>> 0 < 119304647 & m >>> 0 < t >>> 0)) {
									ka = A;
									la = L;
									ma = ja;
									break
								} else p = A
							}
							na = la;
							oa = ka;
							pa = 0;
							qa = ma
						} else {
							na = z;
							oa = 0;
							pa = 0;
							qa = u
						}
						if ((na & 255) >>> 0 < t >>> 0) {
							p = up(-1, -1, t | 0, 0) | 0;
							m = D;
							A = pa;
							L = oa;
							J = na;
							K = qa;
							while (1) {
								if (A >>> 0 > m >>> 0 | (A | 0) == (m | 0) & L >>> 0 > p >>> 0) {
									U = t;
									V = L;
									W = A;
									X = K;
									v = 72;
									break c
								}
								I = tp(L | 0, A | 0, t | 0, 0) | 0;
								ra = D;
								sa = J & 255;
								if (ra >>> 0 > 4294967295 | (ra | 0) == -1 & I >>> 0 > ~sa >>> 0) {
									U = t;
									V = L;
									W = A;
									X = K;
									v = 72;
									break c
								}
								ta = jp(sa | 0, 0, I | 0, ra | 0) | 0;
								ra = D;
								I = c[k >> 2] | 0;
								if (I >>> 0 < (c[l >> 2] | 0) >>> 0) {
									c[k >> 2] = I + 1;
									ua = d[I >> 0] | 0
								} else ua = Gd(b) | 0;
								J = a[17446 + (ua + 1) >> 0] | 0;
								if ((J & 255) >>> 0 >= t >>> 0) {
									U = t;
									V = ta;
									W = ra;
									X = ua;
									v = 72;
									break
								} else {
									A = ra;
									L = ta;
									K = ua
								}
							}
						} else {
							U = t;
							V = oa;
							W = pa;
							X = qa;
							v = 72
						}
					}
				while (0);
				if ((v | 0) == 72)
					if ((d[17446 + (X + 1) >> 0] | 0) >>> 0 < U >>> 0) {
						do {
							K = c[k >> 2] | 0;
							if (K >>> 0 < (c[l >> 2] | 0) >>> 0) {
								c[k >> 2] = K + 1;
								va = d[K >> 0] | 0
							} else va = Gd(b) | 0
						} while ((d[17446 + (va + 1) >> 0] | 0) >>> 0 < U >>> 0);
						c[(Bd() | 0) >> 2] = 34;
						R = h;
						S = g;
						T = (g & 1 | 0) == 0 & 0 == 0 ? r : 0
					} else {
						R = W;
						S = V;
						T = r
					}
				if (c[l >> 2] | 0) c[k >> 2] = (c[k >> 2] | 0) + -1;
				if (!(R >>> 0 < h >>> 0 | (R | 0) == (h | 0) & S >>> 0 < g >>> 0)) {
					if (!((g & 1 | 0) != 0 | 0 != 0 | (T | 0) != 0)) {
						c[(Bd() | 0) >> 2] = 34;
						K = jp(g | 0, h | 0, -1, -1) | 0;
						i = D;
						j = K;
						break
					}
					if (R >>> 0 > h >>> 0 | (R | 0) == (h | 0) & S >>> 0 > g >>> 0) {
						c[(Bd() | 0) >> 2] = 34;
						i = h;
						j = g;
						break
					}
				}
				K = ((T | 0) < 0) << 31 >> 31;
				L = hp(S ^ T | 0, R ^ K | 0, T | 0, K | 0) | 0;
				i = D;
				j = L
			}
		while (0);
		D = i;
		return j | 0
	}

	function Fd(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0;
		c[a + 104 >> 2] = b;
		d = c[a + 4 >> 2] | 0;
		e = c[a + 8 >> 2] | 0;
		f = e - d | 0;
		c[a + 108 >> 2] = f;
		if ((b | 0) != 0 & (f | 0) > (b | 0)) c[a + 100 >> 2] = d + b;
		else c[a + 100 >> 2] = e;
		return
	}

	function Gd(b) {
		b = b | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0;
		e = b + 104 | 0;
		f = c[e >> 2] | 0;
		if ((f | 0) != 0 ? (c[b + 108 >> 2] | 0) >= (f | 0) : 0) g = 4;
		else {
			f = te(b) | 0;
			if ((f | 0) >= 0) {
				h = c[e >> 2] | 0;
				e = b + 8 | 0;
				if (h) {
					i = c[e >> 2] | 0;
					j = c[b + 4 >> 2] | 0;
					k = i;
					l = h - (c[b + 108 >> 2] | 0) + -1 | 0;
					if ((k - j | 0) > (l | 0)) {
						c[b + 100 >> 2] = j + l;
						m = i
					} else {
						n = k;
						o = i;
						g = 9
					}
				} else {
					i = c[e >> 2] | 0;
					n = i;
					o = i;
					g = 9
				}
				if ((g | 0) == 9) {
					c[b + 100 >> 2] = n;
					m = o
				}
				o = c[b + 4 >> 2] | 0;
				if (m) {
					n = b + 108 | 0;
					c[n >> 2] = m + 1 - o + (c[n >> 2] | 0)
				}
				n = o + -1 | 0;
				if ((d[n >> 0] | 0 | 0) == (f | 0)) p = f;
				else {
					a[n >> 0] = f;
					p = f
				}
			} else g = 4
		}
		if ((g | 0) == 4) {
			c[b + 100 >> 2] = 0;
			p = -1
		}
		return p | 0
	}

	function Hd(a) {
		a = a | 0;
		var b = 0;
		if (a >>> 0 > 4294963200) {
			c[(Bd() | 0) >> 2] = 0 - a;
			b = -1
		} else b = a;
		return b | 0
	}

	function Id(a) {
		a = a | 0;
		return 0
	}

	function Jd(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		return d | 0
	}

	function Kd(a, b) {
		a = a | 0;
		b = b | 0;
		return -1 | 0
	}

	function Ld(a) {
		a = a | 0;
		rd(a);
		return
	}

	function Md(a, b) {
		a = a | 0;
		b = b | 0;
		return (a + -48 | 0) >>> 0 < 10 | 0
	}

	function Nd(a, b) {
		a = a | 0;
		b = b | 0;
		return Ad(a) | 0
	}

	function Od(b, c, d) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0;
		if (((a[c >> 0] | 0) != 0 ? (Ne(c, 22284) | 0) != 0 : 0) ? (Ne(c, 17712) | 0) != 0 : 0) e = 0;
		else if (!d) e = sd(1, 4) | 0;
		else e = d;
		return e | 0
	}

	function Pd(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = (Ta() | 0) + 176 | 0;
		d = c[b >> 2] | 0;
		if (a) c[b >> 2] = a;
		return d | 0
	}

	function Qd(a, b) {
		a = +a;
		b = +b;
		var d = 0,
			e = 0,
			f = 0;
		h[k >> 3] = a;
		d = c[k >> 2] | 0;
		e = c[k + 4 >> 2] | 0;
		h[k >> 3] = b;
		f = c[k + 4 >> 2] & -2147483648 | e & 2147483647;
		c[k >> 2] = d;
		c[k + 4 >> 2] = f;
		return +(+h[k >> 3])
	}

	function Rd(a, b) {
		a = +a;
		b = +b;
		return +(+Qd(a, b))
	}

	function Sd(a, b) {
		a = +a;
		b = +b;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			i = 0,
			j = 0,
			l = 0,
			m = 0.0;
		h[k >> 3] = a;
		d = c[k >> 2] | 0;
		e = c[k + 4 >> 2] | 0;
		f = e & 2147483647;
		do
			if (!(f >>> 0 > 2146435072 | (f | 0) == 2146435072 & d >>> 0 > 0)) {
				h[k >> 3] = b;
				g = c[k >> 2] | 0;
				i = c[k + 4 >> 2] | 0;
				j = i & 2147483647;
				if (!(j >>> 0 > 2146435072 | (j | 0) == 2146435072 & g >>> 0 > 0)) {
					j = kp(d | 0, e | 0, 63) | 0;
					l = kp(g | 0, i | 0, 63) | 0;
					if ((j | 0) == (l | 0)) {
						m = a < b ? b : a;
						break
					} else {
						m = (e | 0) < 0 ? b : a;
						break
					}
				} else m = a
			} else m = b; while (0);
		return +m
	}

	function Td(a, b) {
		a = +a;
		b = +b;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			i = 0,
			j = 0,
			l = 0,
			m = 0.0;
		h[k >> 3] = a;
		d = c[k >> 2] | 0;
		e = c[k + 4 >> 2] | 0;
		f = e & 2147483647;
		do
			if (!(f >>> 0 > 2146435072 | (f | 0) == 2146435072 & d >>> 0 > 0)) {
				h[k >> 3] = b;
				g = c[k >> 2] | 0;
				i = c[k + 4 >> 2] | 0;
				j = i & 2147483647;
				if (!(j >>> 0 > 2146435072 | (j | 0) == 2146435072 & g >>> 0 > 0)) {
					j = kp(d | 0, e | 0, 63) | 0;
					l = kp(g | 0, i | 0, 63) | 0;
					if ((j | 0) == (l | 0)) {
						m = a < b ? a : b;
						break
					} else {
						m = (e | 0) < 0 ? a : b;
						break
					}
				} else m = a
			} else m = b; while (0);
		return +m
	}

	function Ud(a, b) {
		a = +a;
		b = +b;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			i = 0,
			j = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0.0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0.0;
		h[k >> 3] = a;
		d = c[k >> 2] | 0;
		e = c[k + 4 >> 2] | 0;
		h[k >> 3] = b;
		f = c[k >> 2] | 0;
		g = c[k + 4 >> 2] | 0;
		i = kp(d | 0, e | 0, 52) | 0;
		j = i & 2047;
		i = kp(f | 0, g | 0, 52) | 0;
		l = i & 2047;
		i = e & -2147483648;
		m = mp(f | 0, g | 0, 1) | 0;
		n = D;
		a: do
			if (!((m | 0) == 0 & (n | 0) == 0) ? (o = g & 2147483647, !(o >>> 0 > 2146435072 | (o | 0) == 2146435072 & f >>> 0 > 0 | (j | 0) == 2047)) : 0) {
				o = mp(d | 0, e | 0, 1) | 0;
				p = D;
				if (!(p >>> 0 > n >>> 0 | (p | 0) == (n | 0) & o >>> 0 > m >>> 0)) return +((o | 0) == (m | 0) & (p | 0) == (n | 0) ? a * 0.0 : a);
				if (!j) {
					p = mp(d | 0, e | 0, 12) | 0;
					o = D;
					if ((o | 0) > -1 | (o | 0) == -1 & p >>> 0 > 4294967295) {
						q = p;
						p = o;
						o = 0;
						while (1) {
							r = o + -1 | 0;
							q = mp(q | 0, p | 0, 1) | 0;
							p = D;
							if (!((p | 0) > -1 | (p | 0) == -1 & q >>> 0 > 4294967295)) {
								s = r;
								break
							} else o = r
						}
					} else s = 0;
					o = mp(d | 0, e | 0, 1 - s | 0) | 0;
					t = o;
					u = D;
					v = s
				} else {
					t = d;
					u = e & 1048575 | 1048576;
					v = j
				}
				if (!l) {
					o = mp(f | 0, g | 0, 12) | 0;
					q = D;
					if ((q | 0) > -1 | (q | 0) == -1 & o >>> 0 > 4294967295) {
						p = o;
						o = q;
						q = 0;
						while (1) {
							r = q + -1 | 0;
							p = mp(p | 0, o | 0, 1) | 0;
							o = D;
							if (!((o | 0) > -1 | (o | 0) == -1 & p >>> 0 > 4294967295)) {
								w = r;
								break
							} else q = r
						}
					} else w = 0;
					q = mp(f | 0, g | 0, 1 - w | 0) | 0;
					x = q;
					y = D;
					z = w
				} else {
					x = f;
					y = g & 1048575 | 1048576;
					z = l
				}
				q = hp(t | 0, u | 0, x | 0, y | 0) | 0;
				p = D;
				o = (p | 0) > -1 | (p | 0) == -1 & q >>> 0 > 4294967295;
				b: do
					if ((v | 0) > (z | 0)) {
						r = o;
						A = q;
						B = p;
						C = t;
						E = u;
						F = v;
						while (1) {
							if (r)
								if ((C | 0) == (x | 0) & (E | 0) == (y | 0)) break;
								else {
									G = A;
									H = B
								}
							else {
								G = C;
								H = E
							}
							I = mp(G | 0, H | 0, 1) | 0;
							J = D;
							K = F + -1 | 0;
							L = hp(I | 0, J | 0, x | 0, y | 0) | 0;
							M = D;
							N = (M | 0) > -1 | (M | 0) == -1 & L >>> 0 > 4294967295;
							if ((K | 0) > (z | 0)) {
								r = N;
								A = L;
								B = M;
								C = I;
								E = J;
								F = K
							} else {
								O = N;
								P = I;
								Q = J;
								R = L;
								S = M;
								T = K;
								break b
							}
						}
						U = a * 0.0;
						break a
					} else {
						O = o;
						P = t;
						Q = u;
						R = q;
						S = p;
						T = v
					}
				while (0);
				if (O)
					if ((P | 0) == (x | 0) & (Q | 0) == (y | 0)) {
						U = a * 0.0;
						break
					} else {
						V = S;
						W = R
					}
				else {
					V = Q;
					W = P
				}
				if (V >>> 0 < 1048576 | (V | 0) == 1048576 & W >>> 0 < 0) {
					p = W;
					q = V;
					o = T;
					while (1) {
						F = mp(p | 0, q | 0, 1) | 0;
						E = D;
						C = o + -1 | 0;
						if (E >>> 0 < 1048576 | (E | 0) == 1048576 & F >>> 0 < 0) {
							p = F;
							q = E;
							o = C
						} else {
							X = F;
							Y = E;
							Z = C;
							break
						}
					}
				} else {
					X = W;
					Y = V;
					Z = T
				}
				if ((Z | 0) > 0) {
					o = jp(X | 0, Y | 0, 0, -1048576) | 0;
					q = D;
					p = mp(Z | 0, 0, 52) | 0;
					_ = q | D;
					$ = o | p
				} else {
					p = kp(X | 0, Y | 0, 1 - Z | 0) | 0;
					_ = D;
					$ = p
				}
				c[k >> 2] = $;
				c[k + 4 >> 2] = _ | i;
				U = +h[k >> 3]
			} else aa = 3; while (0);
		if ((aa | 0) == 3) {
			ba = a * b;
			U = ba / ba
		}
		return +U
	}

	function Vd(a, b) {
		a = +a;
		b = +b;
		return +(+Ud(a, b))
	}

	function Wd(a, b) {
		a = +a;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			i = 0.0,
			j = 0.0,
			l = 0,
			m = 0.0;
		h[k >> 3] = a;
		d = c[k >> 2] | 0;
		e = c[k + 4 >> 2] | 0;
		f = kp(d | 0, e | 0, 52) | 0;
		g = f & 2047;
		switch (g | 0) {
			case 0:
				{
					if (a != 0.0) {
						i = +Wd(a * 18446744073709551616.0, b);
						j = i;
						l = (c[b >> 2] | 0) + -64 | 0
					} else {
						j = a;
						l = 0
					}
					c[b >> 2] = l;m = j;
					break
				}
			case 2047:
				{
					m = a;
					break
				}
			default:
				{
					c[b >> 2] = g + -1022;c[k >> 2] = d;c[k + 4 >> 2] = e & -2146435073 | 1071644672;m = +h[k >> 3]
				}
		}
		return +m
	}

	function Xd(a, b) {
		a = +a;
		b = b | 0;
		return +(+Wd(a, b))
	}

	function Yd(a, b) {
		a = +a;
		b = b | 0;
		var d = 0.0,
			e = 0,
			f = 0,
			g = 0,
			i = 0.0;
		if ((b | 0) > 1023) {
			d = a * 8988465674311579538646525.0e283;
			e = b + -1023 | 0;
			if ((e | 0) > 1023) {
				f = b + -2046 | 0;
				g = (f | 0) > 1023 ? 1023 : f;
				i = d * 8988465674311579538646525.0e283
			} else {
				g = e;
				i = d
			}
		} else if ((b | 0) < -1022) {
			d = a * 2.2250738585072014e-308;
			e = b + 1022 | 0;
			if ((e | 0) < -1022) {
				f = b + 2044 | 0;
				g = (f | 0) < -1022 ? -1022 : f;
				i = d * 2.2250738585072014e-308
			} else {
				g = e;
				i = d
			}
		} else {
			g = b;
			i = a
		}
		b = mp(g + 1023 | 0, 0, 52) | 0;
		g = D;
		c[k >> 2] = b;
		c[k + 4 >> 2] = g;
		return +(i * +h[k >> 3])
	}

	function Zd(a, b) {
		a = +a;
		b = b | 0;
		return +(+Yd(a, b))
	}

	function _d(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return $d(0, a, b, (c | 0) != 0 ? c : 3644) | 0
	}

	function $d(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		j = (f | 0) == 0 ? 3648 : f;
		f = c[j >> 2] | 0;
		a: do
			if (!d)
				if (!f) k = 0;
				else l = 15;
		else {
			m = (b | 0) == 0 ? h : b;
			if (!e) k = -2;
			else {
				if (!f) {
					n = a[d >> 0] | 0;
					o = n & 255;
					if (n << 24 >> 24 > -1) {
						c[m >> 2] = o;
						k = n << 24 >> 24 != 0 & 1;
						break
					}
					n = o + -194 | 0;
					if (n >>> 0 > 50) {
						l = 15;
						break
					}
					o = c[2880 + (n << 2) >> 2] | 0;
					n = e + -1 | 0;
					if (!n) p = o;
					else {
						q = n;
						r = o;
						s = d + 1 | 0;
						l = 9
					}
				} else {
					q = e;
					r = f;
					s = d;
					l = 9
				}
				b: do
					if ((l | 0) == 9) {
						o = a[s >> 0] | 0;
						n = (o & 255) >>> 3;
						if ((n + -16 | n + (r >> 26)) >>> 0 > 7) {
							l = 15;
							break a
						} else {
							t = q;
							u = o;
							v = r;
							w = s
						}
						while (1) {
							w = w + 1 | 0;
							v = (u & 255) + -128 | v << 6;
							t = t + -1 | 0;
							if ((v | 0) >= 0) {
								x = v;
								y = t;
								break
							}
							if (!t) {
								p = v;
								break b
							}
							u = a[w >> 0] | 0;
							if ((u & -64) << 24 >> 24 != -128) {
								l = 15;
								break a
							}
						}
						c[j >> 2] = 0;
						c[m >> 2] = x;
						k = e - y | 0;
						break a
					}
				while (0);
				c[j >> 2] = p;
				k = -2
			}
		}
		while (0);
		if ((l | 0) == 15) {
			c[j >> 2] = 0;
			c[(Bd() | 0) >> 2] = 84;
			k = -1
		}
		i = g;
		return k | 0
	}

	function ae(a) {
		a = a | 0;
		var b = 0;
		if (!a) b = 1;
		else b = (c[a >> 2] | 0) == 0;
		return b & 1 | 0
	}

	function be(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0;
		g = i;
		i = i + 1040 | 0;
		h = g + 8 | 0;
		j = g;
		k = c[b >> 2] | 0;
		c[j >> 2] = k;
		l = (a | 0) != 0;
		m = l ? e : 256;
		e = l ? a : h;
		a = k;
		a: do
			if ((m | 0) != 0 & (k | 0) != 0) {
				n = d;
				o = m;
				p = a;
				q = 0;
				r = e;
				while (1) {
					s = n >>> 2;
					t = s >>> 0 >= o >>> 0;
					if (!(n >>> 0 > 131 | t)) {
						u = n;
						v = o;
						w = p;
						x = q;
						y = r;
						break a
					}
					z = t ? o : s;
					s = n - z | 0;
					t = ce(r, j, z, f) | 0;
					if ((t | 0) == -1) {
						A = s;
						B = r;
						break
					}
					z = (r | 0) == (h | 0);
					C = z ? 0 : t;
					D = o - C | 0;
					E = z ? r : r + (t << 2) | 0;
					z = t + q | 0;
					t = c[j >> 2] | 0;
					if ((o | 0) != (C | 0) & (t | 0) != 0) {
						n = s;
						o = D;
						p = t;
						q = z;
						r = E
					} else {
						u = s;
						v = D;
						w = t;
						x = z;
						y = E;
						break a
					}
				}
				u = A;
				v = 0;
				w = c[j >> 2] | 0;
				x = -1;
				y = B
			} else {
				u = d;
				v = m;
				w = a;
				x = 0;
				y = e
			}
		while (0);
		b: do
			if ((w | 0) != 0 ? (v | 0) != 0 & (u | 0) != 0 : 0) {
				e = u;
				a = v;
				m = w;
				d = x;
				B = y;
				while (1) {
					A = $d(B, m, e, f) | 0;
					if ((A + 2 | 0) >>> 0 < 3) {
						F = A;
						G = d;
						break
					}
					m = (c[j >> 2] | 0) + A | 0;
					c[j >> 2] = m;
					a = a + -1 | 0;
					h = d + 1 | 0;
					if (!((a | 0) != 0 & (e | 0) != (A | 0))) {
						H = h;
						break b
					} else {
						e = e - A | 0;
						d = h;
						B = B + 4 | 0
					}
				}
				switch (F | 0) {
					case -1:
						{
							H = -1;
							break b;
							break
						}
					case 0:
						{
							c[j >> 2] = 0;H = G;
							break b;
							break
						}
					default:
						{
							c[f >> 2] = 0;H = G;
							break b
						}
				}
			} else H = x; while (0);
		if (l) c[b >> 2] = c[j >> 2];
		i = g;
		return H | 0
	}

	function ce(b, e, f, g) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0;
		h = c[e >> 2] | 0;
		if ((g | 0) != 0 ? (i = c[g >> 2] | 0, (i | 0) != 0) : 0)
			if (!b) {
				j = f;
				k = i;
				l = h;
				m = 16
			} else {
				c[g >> 2] = 0;
				n = b;
				o = f;
				p = i;
				q = h;
				m = 37
			}
		else if (!b) {
			r = f;
			s = h;
			m = 7
		} else {
			t = b;
			u = f;
			v = h;
			m = 6
		}
		a: while (1)
			if ((m | 0) == 6) {
				m = 0;
				if (!u) {
					w = v;
					m = 26;
					break
				} else {
					x = t;
					y = u;
					z = v
				}
				while (1) {
					h = a[z >> 0] | 0;
					do
						if (((h & 255) + -1 | 0) >>> 0 < 127 ? y >>> 0 > 4 & (z & 3 | 0) == 0 : 0) {
							i = x;
							g = y;
							A = z;
							while (1) {
								B = c[A >> 2] | 0;
								if ((B + -16843009 | B) & -2139062144) {
									C = i;
									D = g;
									E = B;
									F = A;
									m = 32;
									break
								}
								c[i >> 2] = B & 255;
								c[i + 4 >> 2] = d[A + 1 >> 0];
								c[i + 8 >> 2] = d[A + 2 >> 0];
								B = A + 4 | 0;
								G = i + 16 | 0;
								c[i + 12 >> 2] = d[A + 3 >> 0];
								H = g + -4 | 0;
								if (H >>> 0 > 4) {
									i = G;
									g = H;
									A = B
								} else {
									I = B;
									J = G;
									K = H;
									m = 31;
									break
								}
							}
							if ((m | 0) == 31) {
								m = 0;
								L = J;
								M = K;
								N = a[I >> 0] | 0;
								O = I;
								break
							} else if ((m | 0) == 32) {
								m = 0;
								L = C;
								M = D;
								N = E & 255;
								O = F;
								break
							}
						} else {
							L = x;
							M = y;
							N = h;
							O = z
						}
					while (0);
					h = N & 255;
					if ((h + -1 | 0) >>> 0 >= 127) {
						P = L;
						Q = M;
						R = h;
						S = O;
						break
					}
					A = O + 1 | 0;
					c[L >> 2] = h;
					y = M + -1 | 0;
					if (!y) {
						w = A;
						m = 26;
						break a
					} else {
						x = L + 4 | 0;
						z = A
					}
				}
				A = R + -194 | 0;
				if (A >>> 0 > 50) {
					T = P;
					U = Q;
					V = S;
					m = 48;
					break
				}
				n = P;
				o = Q;
				p = c[2880 + (A << 2) >> 2] | 0;
				q = S + 1 | 0;
				m = 37;
				continue
			} else
		if ((m | 0) == 7) {
			m = 0;
			A = a[s >> 0] | 0;
			if (((A & 255) + -1 | 0) >>> 0 < 127 ? (s & 3 | 0) == 0 : 0) {
				h = c[s >> 2] | 0;
				if (!((h + -16843009 | h) & -2139062144)) {
					g = r;
					i = s;
					while (1) {
						H = i + 4 | 0;
						G = g + -4 | 0;
						B = c[H >> 2] | 0;
						if (!((B + -16843009 | B) & -2139062144)) {
							g = G;
							i = H
						} else {
							W = G;
							X = B;
							Y = H;
							break
						}
					}
				} else {
					W = r;
					X = h;
					Y = s
				}
				Z = W;
				_ = X & 255;
				$ = Y
			} else {
				Z = r;
				_ = A;
				$ = s
			}
			i = _ & 255;
			if ((i + -1 | 0) >>> 0 < 127) {
				r = Z + -1 | 0;
				s = $ + 1 | 0;
				m = 7;
				continue
			} else {
				aa = Z;
				ba = i;
				ca = $
			}
			i = ba + -194 | 0;
			if (i >>> 0 > 50) {
				T = b;
				U = aa;
				V = ca;
				m = 48;
				break
			}
			j = aa;
			k = c[2880 + (i << 2) >> 2] | 0;
			l = ca + 1 | 0;
			m = 16;
			continue
		} else if ((m | 0) == 16) {
			m = 0;
			i = (d[l >> 0] | 0) >>> 3;
			if ((i + -16 | i + (k >> 26)) >>> 0 > 7) {
				m = 17;
				break
			}
			i = l + 1 | 0;
			if (k & 33554432) {
				if ((a[i >> 0] & -64) << 24 >> 24 != -128) {
					m = 20;
					break
				}
				g = l + 2 | 0;
				if (!(k & 524288)) da = g;
				else {
					if ((a[g >> 0] & -64) << 24 >> 24 != -128) {
						m = 23;
						break
					}
					da = l + 3 | 0
				}
			} else da = i;
			r = j + -1 | 0;
			s = da;
			m = 7;
			continue
		} else if ((m | 0) == 37) {
			m = 0;
			i = d[q >> 0] | 0;
			g = i >>> 3;
			if ((g + -16 | g + (p >> 26)) >>> 0 > 7) {
				m = 38;
				break
			}
			g = q + 1 | 0;
			H = i + -128 | p << 6;
			if ((H | 0) < 0) {
				i = d[g >> 0] | 0;
				if ((i & 192 | 0) != 128) {
					m = 41;
					break
				}
				B = q + 2 | 0;
				G = i + -128 | H << 6;
				if ((G | 0) < 0) {
					i = d[B >> 0] | 0;
					if ((i & 192 | 0) != 128) {
						m = 44;
						break
					}
					ea = i + -128 | G << 6;
					fa = q + 3 | 0
				} else {
					ea = G;
					fa = B
				}
			} else {
				ea = H;
				fa = g
			}
			c[n >> 2] = ea;
			t = n + 4 | 0;
			u = o + -1 | 0;
			v = fa;
			m = 6;
			continue
		}
		if ((m | 0) == 17) {
			ga = b;
			ha = j;
			ia = k;
			ja = l + -1 | 0;
			m = 47
		} else if ((m | 0) == 20) {
			ga = b;
			ha = j;
			ia = k;
			ja = l + -1 | 0;
			m = 47
		} else if ((m | 0) == 23) {
			ga = b;
			ha = j;
			ia = k;
			ja = l + -1 | 0;
			m = 47
		} else if ((m | 0) == 26) {
			c[e >> 2] = w;
			ka = f
		} else if ((m | 0) == 38) {
			ga = n;
			ha = o;
			ia = p;
			ja = q + -1 | 0;
			m = 47
		} else if ((m | 0) == 41) {
			la = n;
			ma = q + -1 | 0;
			m = 52
		} else if ((m | 0) == 44) {
			la = n;
			ma = q + -1 | 0;
			m = 52
		}
		if ((m | 0) == 47)
			if (!ia) {
				T = ga;
				U = ha;
				V = ja;
				m = 48
			} else {
				la = ga;
				ma = ja;
				m = 52
			}
		if ((m | 0) == 48)
			if (!(a[V >> 0] | 0)) {
				if (T) {
					c[T >> 2] = 0;
					c[e >> 2] = 0
				}
				ka = f - U | 0
			} else {
				la = T;
				ma = V;
				m = 52
			}
		if ((m | 0) == 52) {
			c[(Bd() | 0) >> 2] = 84;
			if (!la) ka = -1;
			else {
				c[e >> 2] = ma;
				ka = -1
			}
		}
		return ka | 0
	}

	function de(b, e, f) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		a: do
			if (!e) j = 0;
			else {
				do
					if (f) {
						k = (b | 0) == 0 ? h : b;
						l = a[e >> 0] | 0;
						m = l & 255;
						if (l << 24 >> 24 > -1) {
							c[k >> 2] = m;
							j = l << 24 >> 24 != 0 & 1;
							break a
						}
						l = m + -194 | 0;
						if (l >>> 0 <= 50) {
							m = e + 1 | 0;
							n = c[2880 + (l << 2) >> 2] | 0;
							if (f >>> 0 < 4 ? (n & -2147483648 >>> ((f * 6 | 0) + -6 | 0) | 0) != 0 : 0) break;
							l = d[m >> 0] | 0;
							m = l >>> 3;
							if ((m + -16 | m + (n >> 26)) >>> 0 <= 7) {
								m = l + -128 | n << 6;
								if ((m | 0) >= 0) {
									c[k >> 2] = m;
									j = 2;
									break a
								}
								n = d[e + 2 >> 0] | 0;
								if ((n & 192 | 0) == 128) {
									l = n + -128 | m << 6;
									if ((l | 0) >= 0) {
										c[k >> 2] = l;
										j = 3;
										break a
									}
									m = d[e + 3 >> 0] | 0;
									if ((m & 192 | 0) == 128) {
										c[k >> 2] = m + -128 | l << 6;
										j = 4;
										break a
									}
								}
							}
						}
					}
				while (0);
				c[(Bd() | 0) >> 2] = 84;
				j = -1
			}
		while (0);
		i = g;
		return j | 0
	}

	function ee(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		do
			if (b) {
				if (d >>> 0 < 128) {
					a[b >> 0] = d;
					f = 1;
					break
				}
				if (d >>> 0 < 2048) {
					a[b >> 0] = d >>> 6 | 192;
					a[b + 1 >> 0] = d & 63 | 128;
					f = 2;
					break
				}
				if (d >>> 0 < 55296 | (d & -8192 | 0) == 57344) {
					a[b >> 0] = d >>> 12 | 224;
					a[b + 1 >> 0] = d >>> 6 & 63 | 128;
					a[b + 2 >> 0] = d & 63 | 128;
					f = 3;
					break
				}
				if ((d + -65536 | 0) >>> 0 < 1048576) {
					a[b >> 0] = d >>> 18 | 240;
					a[b + 1 >> 0] = d >>> 12 & 63 | 128;
					a[b + 2 >> 0] = d >>> 6 & 63 | 128;
					a[b + 3 >> 0] = d & 63 | 128;
					f = 4;
					break
				} else {
					c[(Bd() | 0) >> 2] = 84;
					f = -1;
					break
				}
			} else f = 1; while (0);
		return f | 0
	}

	function fe(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		f = i;
		i = i + 272 | 0;
		g = f + 8 | 0;
		h = f;
		j = c[b >> 2] | 0;
		c[h >> 2] = j;
		k = (a | 0) != 0;
		l = k ? e : 256;
		e = k ? a : g;
		a = j;
		a: do
			if ((l | 0) != 0 & (j | 0) != 0) {
				m = d;
				n = l;
				o = a;
				p = 0;
				q = e;
				while (1) {
					r = m >>> 0 >= n >>> 0;
					if (!(r | m >>> 0 > 32)) {
						s = m;
						t = n;
						u = o;
						v = p;
						w = q;
						break a
					}
					x = r ? n : m;
					r = m - x | 0;
					y = ge(q, h, x, 0) | 0;
					if ((y | 0) == -1) {
						z = r;
						A = q;
						break
					}
					x = (q | 0) == (g | 0);
					B = x ? 0 : y;
					C = n - B | 0;
					D = x ? q : q + y | 0;
					x = y + p | 0;
					y = c[h >> 2] | 0;
					if ((n | 0) != (B | 0) & (y | 0) != 0) {
						m = r;
						n = C;
						o = y;
						p = x;
						q = D
					} else {
						s = r;
						t = C;
						u = y;
						v = x;
						w = D;
						break a
					}
				}
				s = z;
				t = 0;
				u = c[h >> 2] | 0;
				v = -1;
				w = A
			} else {
				s = d;
				t = l;
				u = a;
				v = 0;
				w = e
			}
		while (0);
		b: do
			if ((u | 0) != 0 ? (t | 0) != 0 & (s | 0) != 0 : 0) {
				e = s;
				a = t;
				l = u;
				d = v;
				A = w;
				while (1) {
					z = ee(A, c[l >> 2] | 0, 0) | 0;
					if ((z + 1 | 0) >>> 0 < 2) {
						E = z;
						F = d;
						break
					}
					l = (c[h >> 2] | 0) + 4 | 0;
					c[h >> 2] = l;
					e = e + -1 | 0;
					g = d + 1 | 0;
					if (!((a | 0) != (z | 0) & (e | 0) != 0)) {
						G = g;
						break b
					} else {
						a = a - z | 0;
						d = g;
						A = A + z | 0
					}
				}
				if (!E) {
					c[h >> 2] = 0;
					G = F
				} else G = -1
			} else G = v; while (0);
		if (k) c[b >> 2] = c[h >> 2];
		i = f;
		return G | 0
	}

	function ge(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		a: do
			if (!b) {
				h = c[d >> 2] | 0;
				j = c[h >> 2] | 0;
				if (!j) k = 0;
				else {
					l = 0;
					m = j;
					j = h;
					while (1) {
						if (m >>> 0 > 127) {
							h = ee(g, m, 0) | 0;
							if ((h | 0) == -1) {
								k = -1;
								break a
							} else n = h
						} else n = 1;
						h = n + l | 0;
						j = j + 4 | 0;
						m = c[j >> 2] | 0;
						if (!m) {
							k = h;
							break
						} else l = h
					}
				}
			} else {
				b: do
					if (e >>> 0 > 3) {
						l = b;
						m = e;
						j = c[d >> 2] | 0;
						while (1) {
							h = c[j >> 2] | 0;
							if ((h + -1 | 0) >>> 0 > 126) {
								if (!h) {
									o = l;
									p = m;
									break
								}
								q = ee(l, h, 0) | 0;
								if ((q | 0) == -1) {
									k = -1;
									break a
								}
								r = l + q | 0;
								s = m - q | 0;
								t = j
							} else {
								a[l >> 0] = h;
								r = l + 1 | 0;
								s = m + -1 | 0;
								t = c[d >> 2] | 0
							}
							j = t + 4 | 0;
							c[d >> 2] = j;
							if (s >>> 0 <= 3) {
								u = r;
								v = s;
								break b
							} else {
								l = r;
								m = s
							}
						}
						a[o >> 0] = 0;
						c[d >> 2] = 0;
						k = e - p | 0;
						break a
					} else {
						u = b;
						v = e
					}while (0);
				if (v) {
					m = u;
					l = v;
					j = c[d >> 2] | 0;
					while (1) {
						h = c[j >> 2] | 0;
						if ((h + -1 | 0) >>> 0 > 126) {
							if (!h) {
								w = m;
								x = l;
								y = 19;
								break
							}
							q = ee(g, h, 0) | 0;
							if ((q | 0) == -1) {
								k = -1;
								break a
							}
							if (l >>> 0 < q >>> 0) {
								z = l;
								y = 22;
								break
							}
							ee(m, c[j >> 2] | 0, 0) | 0;
							A = m + q | 0;
							B = l - q | 0;
							C = j
						} else {
							a[m >> 0] = h;
							A = m + 1 | 0;
							B = l + -1 | 0;
							C = c[d >> 2] | 0
						}
						j = C + 4 | 0;
						c[d >> 2] = j;
						if (!B) {
							k = e;
							break a
						} else {
							m = A;
							l = B
						}
					}
					if ((y | 0) == 19) {
						a[w >> 0] = 0;
						c[d >> 2] = 0;
						k = e - x | 0;
						break
					} else if ((y | 0) == 22) {
						k = e - z | 0;
						break
					}
				} else k = e
			}
		while (0);
		i = f;
		return k | 0
	}

	function he(a, b) {
		a = a | 0;
		b = b | 0;
		var c = 0;
		if (!a) c = 0;
		else c = ee(a, b, 0) | 0;
		return c | 0
	}

	function ie(a) {
		a = a | 0;
		return 0
	}

	function je(a) {
		a = a | 0;
		return
	}

	function ke(b, e) {
		b = b | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		h = e & 255;
		a[g >> 0] = h;
		j = b + 16 | 0;
		k = c[j >> 2] | 0;
		if (!k)
			if (!(se(b) | 0)) {
				l = c[j >> 2] | 0;
				m = 4
			} else n = -1;
		else {
			l = k;
			m = 4
		}
		do
			if ((m | 0) == 4) {
				k = b + 20 | 0;
				j = c[k >> 2] | 0;
				if (j >>> 0 < l >>> 0 ? (o = e & 255, (o | 0) != (a[b + 75 >> 0] | 0)) : 0) {
					c[k >> 2] = j + 1;
					a[j >> 0] = h;
					n = o;
					break
				}
				if ((qb[c[b + 36 >> 2] & 31](b, g, 1) | 0) == 1) n = d[g >> 0] | 0;
				else n = -1
			}
		while (0);
		i = f;
		return n | 0
	}

	function le(a) {
		a = a | 0;
		var b = 0,
			d = 0;
		b = i;
		i = i + 16 | 0;
		d = b;
		c[d >> 2] = c[a + 60 >> 2];
		a = Hd(fb(6, d | 0) | 0) | 0;
		i = b;
		return a | 0
	}

	function me(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0;
		f = i;
		i = i + 48 | 0;
		g = f + 16 | 0;
		h = f;
		j = f + 32 | 0;
		c[j >> 2] = d;
		k = j + 4 | 0;
		l = b + 48 | 0;
		m = c[l >> 2] | 0;
		c[k >> 2] = e - ((m | 0) != 0 & 1);
		n = b + 44 | 0;
		c[j + 8 >> 2] = c[n >> 2];
		c[j + 12 >> 2] = m;
		if (!(c[709] | 0)) {
			c[g >> 2] = c[b + 60 >> 2];
			c[g + 4 >> 2] = j;
			c[g + 8 >> 2] = 2;
			o = Hd(mb(145, g | 0) | 0) | 0
		} else {
			gb(109, b | 0);
			c[h >> 2] = c[b + 60 >> 2];
			c[h + 4 >> 2] = j;
			c[h + 8 >> 2] = 2;
			j = Hd(mb(145, h | 0) | 0) | 0;
			Ya(0);
			o = j
		}
		if ((o | 0) >= 1) {
			j = c[k >> 2] | 0;
			if (o >>> 0 > j >>> 0) {
				k = c[n >> 2] | 0;
				n = b + 4 | 0;
				c[n >> 2] = k;
				h = k;
				c[b + 8 >> 2] = h + (o - j);
				if (!(c[l >> 2] | 0)) p = e;
				else {
					c[n >> 2] = h + 1;
					a[d + (e + -1) >> 0] = a[h >> 0] | 0;
					p = e
				}
			} else p = o
		} else {
			c[b >> 2] = c[b >> 2] | o & 48 ^ 16;
			c[b + 8 >> 2] = 0;
			c[b + 4 >> 2] = 0;
			p = o
		}
		i = f;
		return p | 0
	}

	function ne(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0;
		e = i;
		i = i + 32 | 0;
		f = e;
		g = e + 20 | 0;
		c[f >> 2] = c[a + 60 >> 2];
		c[f + 4 >> 2] = 0;
		c[f + 8 >> 2] = b;
		c[f + 12 >> 2] = g;
		c[f + 16 >> 2] = d;
		if ((Hd(kb(140, f | 0) | 0) | 0) < 0) {
			c[g >> 2] = -1;
			h = -1
		} else h = c[g >> 2] | 0;
		i = e;
		return h | 0
	}

	function oe(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		e = i;
		i = i + 48 | 0;
		f = e + 16 | 0;
		g = e;
		h = e + 32 | 0;
		j = a + 28 | 0;
		k = c[j >> 2] | 0;
		c[h >> 2] = k;
		l = a + 20 | 0;
		m = (c[l >> 2] | 0) - k | 0;
		c[h + 4 >> 2] = m;
		c[h + 8 >> 2] = b;
		c[h + 12 >> 2] = d;
		b = a + 60 | 0;
		k = a + 44 | 0;
		n = h;
		h = 2;
		o = m + d | 0;
		while (1) {
			if (!(c[709] | 0)) {
				c[f >> 2] = c[b >> 2];
				c[f + 4 >> 2] = n;
				c[f + 8 >> 2] = h;
				p = Hd(nb(146, f | 0) | 0) | 0
			} else {
				gb(110, a | 0);
				c[g >> 2] = c[b >> 2];
				c[g + 4 >> 2] = n;
				c[g + 8 >> 2] = h;
				m = Hd(nb(146, g | 0) | 0) | 0;
				Ya(0);
				p = m
			}
			if ((o | 0) == (p | 0)) {
				q = 6;
				break
			}
			if ((p | 0) < 0) {
				r = n;
				s = h;
				q = 8;
				break
			}
			m = o - p | 0;
			t = c[n + 4 >> 2] | 0;
			if (p >>> 0 <= t >>> 0)
				if ((h | 0) == 2) {
					c[j >> 2] = (c[j >> 2] | 0) + p;
					u = t;
					v = p;
					w = n;
					x = 2
				} else {
					u = t;
					v = p;
					w = n;
					x = h
				}
			else {
				y = c[k >> 2] | 0;
				c[j >> 2] = y;
				c[l >> 2] = y;
				u = c[n + 12 >> 2] | 0;
				v = p - t | 0;
				w = n + 8 | 0;
				x = h + -1 | 0
			}
			c[w >> 2] = (c[w >> 2] | 0) + v;
			c[w + 4 >> 2] = u - v;
			n = w;
			h = x;
			o = m
		}
		if ((q | 0) == 6) {
			o = c[k >> 2] | 0;
			c[a + 16 >> 2] = o + (c[a + 48 >> 2] | 0);
			k = o;
			c[j >> 2] = k;
			c[l >> 2] = k;
			z = d
		} else if ((q | 0) == 8) {
			c[a + 16 >> 2] = 0;
			c[j >> 2] = 0;
			c[l >> 2] = 0;
			c[a >> 2] = c[a >> 2] | 32;
			if ((s | 0) == 2) z = 0;
			else z = d - (c[r + 4 >> 2] | 0) | 0
		}
		i = e;
		return z | 0
	}

	function pe(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		f = i;
		i = i + 80 | 0;
		g = f;
		c[b + 36 >> 2] = 6;
		if ((c[b >> 2] & 64 | 0) == 0 ? (c[g >> 2] = c[b + 60 >> 2], c[g + 4 >> 2] = 21505, c[g + 8 >> 2] = f + 12, (Wa(54, g | 0) | 0) != 0) : 0) a[b + 75 >> 0] = -1;
		g = oe(b, d, e) | 0;
		i = f;
		return g | 0
	}

	function qe(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		e = a + 84 | 0;
		f = c[e >> 2] | 0;
		g = d + 256 | 0;
		h = Le(f, 0, g) | 0;
		i = (h | 0) == 0 ? g : h - f | 0;
		h = i >>> 0 < d >>> 0 ? i : d;
		lp(b | 0, f | 0, h | 0) | 0;
		c[a + 4 >> 2] = f + h;
		b = f + i | 0;
		c[a + 8 >> 2] = b;
		c[e >> 2] = b;
		return h | 0
	}

	function re(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0;
		d = b + 74 | 0;
		e = a[d >> 0] | 0;
		a[d >> 0] = e + 255 | e;
		e = b + 20 | 0;
		d = b + 44 | 0;
		if ((c[e >> 2] | 0) >>> 0 > (c[d >> 2] | 0) >>> 0) qb[c[b + 36 >> 2] & 31](b, 0, 0) | 0;
		c[b + 16 >> 2] = 0;
		c[b + 28 >> 2] = 0;
		c[e >> 2] = 0;
		e = c[b >> 2] | 0;
		if (e & 20)
			if (!(e & 4)) f = -1;
			else {
				c[b >> 2] = e | 32;
				f = -1
			}
		else {
			e = c[d >> 2] | 0;
			c[b + 8 >> 2] = e;
			c[b + 4 >> 2] = e;
			f = 0
		}
		return f | 0
	}

	function se(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0;
		d = b + 74 | 0;
		e = a[d >> 0] | 0;
		a[d >> 0] = e + 255 | e;
		e = c[b >> 2] | 0;
		if (!(e & 8)) {
			c[b + 8 >> 2] = 0;
			c[b + 4 >> 2] = 0;
			d = c[b + 44 >> 2] | 0;
			c[b + 28 >> 2] = d;
			c[b + 20 >> 2] = d;
			c[b + 16 >> 2] = d + (c[b + 48 >> 2] | 0);
			f = 0
		} else {
			c[b >> 2] = e | 32;
			f = -1
		}
		return f | 0
	}

	function te(a) {
		a = a | 0;
		var b = 0,
			e = 0,
			f = 0;
		b = i;
		i = i + 16 | 0;
		e = b;
		if ((c[a + 8 >> 2] | 0) == 0 ? (re(a) | 0) != 0 : 0) f = -1;
		else if ((qb[c[a + 32 >> 2] & 31](a, e, 1) | 0) == 1) f = d[e >> 0] | 0;
		else f = -1;
		i = b;
		return f | 0
	}

	function ue(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		do
			if (a) {
				if ((c[a + 76 >> 2] | 0) <= -1) {
					b = _e(a) | 0;
					break
				}
				d = (ie(a) | 0) == 0;
				e = _e(a) | 0;
				if (d) b = e;
				else {
					je(a);
					b = e
				}
			} else {
				if (!(c[774] | 0)) f = 0;
				else f = ue(c[774] | 0) | 0;
				eb(2864);
				e = c[715] | 0;
				if (!e) g = f;
				else {
					d = e;
					e = f;
					while (1) {
						if ((c[d + 76 >> 2] | 0) > -1) h = ie(d) | 0;
						else h = 0;
						if ((c[d + 20 >> 2] | 0) >>> 0 > (c[d + 28 >> 2] | 0) >>> 0) i = _e(d) | 0 | e;
						else i = e;
						if (h) je(d);
						d = c[d + 56 >> 2] | 0;
						if (!d) {
							g = i;
							break
						} else e = i
					}
				}
				Xa(2864);
				b = g
			}
		while (0);
		return b | 0
	}

	function ve(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		if ((c[d + 76 >> 2] | 0) >= 0 ? (ie(d) | 0) != 0 : 0) {
			if ((a[d + 75 >> 0] | 0) != (b | 0) ? (e = d + 20 | 0, f = c[e >> 2] | 0, f >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) : 0) {
				c[e >> 2] = f + 1;
				a[f >> 0] = b;
				g = b & 255
			} else g = ke(d, b) | 0;
			je(d);
			h = g
		} else i = 3;
		do
			if ((i | 0) == 3) {
				if ((a[d + 75 >> 0] | 0) != (b | 0) ? (g = d + 20 | 0, f = c[g >> 2] | 0, f >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) : 0) {
					c[g >> 2] = f + 1;
					a[f >> 0] = b;
					h = b & 255;
					break
				}
				h = ke(d, b) | 0
			}
		while (0);
		return h | 0
	}

	function we(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		f = e + 16 | 0;
		g = c[f >> 2] | 0;
		if (!g)
			if (!(se(e) | 0)) {
				h = c[f >> 2] | 0;
				i = 4
			} else j = 0;
		else {
			h = g;
			i = 4
		}
		a: do
			if ((i | 0) == 4) {
				g = e + 20 | 0;
				f = c[g >> 2] | 0;
				if ((h - f | 0) >>> 0 < d >>> 0) {
					j = qb[c[e + 36 >> 2] & 31](e, b, d) | 0;
					break
				}
				b: do
					if ((a[e + 75 >> 0] | 0) > -1) {
						k = d;
						while (1) {
							if (!k) {
								l = d;
								m = b;
								n = f;
								o = 0;
								break b
							}
							p = k + -1 | 0;
							if ((a[b + p >> 0] | 0) == 10) {
								q = k;
								break
							} else k = p
						}
						if ((qb[c[e + 36 >> 2] & 31](e, b, q) | 0) >>> 0 < q >>> 0) {
							j = q;
							break a
						}
						l = d - q | 0;
						m = b + q | 0;
						n = c[g >> 2] | 0;
						o = q
					} else {
						l = d;
						m = b;
						n = f;
						o = 0
					}
				while (0);
				lp(n | 0, m | 0, l | 0) | 0;
				c[g >> 2] = (c[g >> 2] | 0) + l;
				j = o + l | 0
			}
		while (0);
		return j | 0
	}

	function xe(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		f = $(d, b) | 0;
		if ((c[e + 76 >> 2] | 0) > -1) {
			g = (ie(e) | 0) == 0;
			h = we(a, f, e) | 0;
			if (g) i = h;
			else {
				je(e);
				i = h
			}
		} else i = we(a, f, e) | 0;
		if ((i | 0) == (f | 0)) j = d;
		else j = (i >>> 0) / (b >>> 0) | 0;
		return j | 0
	}

	function ye(a) {
		a = a | 0;
		var b = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0;
		if ((c[a + 76 >> 2] | 0) >= 0 ? (ie(a) | 0) != 0 : 0) {
			b = a + 4 | 0;
			e = c[b >> 2] | 0;
			if (e >>> 0 < (c[a + 8 >> 2] | 0) >>> 0) {
				c[b >> 2] = e + 1;
				f = d[e >> 0] | 0
			} else f = te(a) | 0;
			g = f
		} else h = 3;
		do
			if ((h | 0) == 3) {
				f = a + 4 | 0;
				e = c[f >> 2] | 0;
				if (e >>> 0 < (c[a + 8 >> 2] | 0) >>> 0) {
					c[f >> 2] = e + 1;
					g = d[e >> 0] | 0;
					break
				} else {
					g = te(a) | 0;
					break
				}
			}
		while (0);
		return g | 0
	}

	function ze(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0;
		d = i;
		i = i + 16 | 0;
		e = d;
		c[e >> 2] = b;
		b = Ee(c[773] | 0, a, e) | 0;
		i = d;
		return b | 0
	}

	function Ae(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		c[g >> 2] = e;
		e = Ge(a, b, d, g) | 0;
		i = f;
		return e | 0
	}

	function Be(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		c[f >> 2] = d;
		d = He(a, b, f) | 0;
		i = e;
		return d | 0
	}

	function Ce(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0;
		do
			if ((b | 0) != -1) {
				if ((c[d + 76 >> 2] | 0) > -1) e = ie(d) | 0;
				else e = 0;
				if (!((c[d + 8 >> 2] | 0) == 0 ? (re(d) | 0) != 0 : 0)) f = 6;
				if ((f | 0) == 6 ? (g = d + 4 | 0, h = c[g >> 2] | 0, h >>> 0 > ((c[d + 44 >> 2] | 0) + -8 | 0) >>> 0) : 0) {
					i = h + -1 | 0;
					c[g >> 2] = i;
					a[i >> 0] = b;
					c[d >> 2] = c[d >> 2] & -17;
					if (!e) {
						j = b;
						break
					}
					je(d);
					j = b;
					break
				}
				if (e) {
					je(d);
					j = -1
				} else j = -1
			} else j = -1; while (0);
		return j | 0
	}

	function De(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		g = qd(240) | 0;
		do
			if (g) {
				c[f >> 2] = c[d >> 2];
				h = Ge(g, 240, b, f) | 0;
				if (h >>> 0 < 240) {
					j = td(g, h + 1 | 0) | 0;
					c[a >> 2] = (j | 0) != 0 ? j : g;
					k = h;
					break
				}
				rd(g);
				if ((h | 0) >= 0 ? (j = h + 1 | 0, h = qd(j) | 0, c[a >> 2] = h, (h | 0) != 0) : 0) k = Ge(h, j, b, d) | 0;
				else k = -1
			} else k = -1; while (0);
		i = e;
		return k | 0
	}

	function Ee(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0;
		f = i;
		i = i + 224 | 0;
		g = f + 120 | 0;
		h = f + 80 | 0;
		j = f;
		k = f + 136 | 0;
		l = h;
		m = l + 40 | 0;
		do {
			c[l >> 2] = 0;
			l = l + 4 | 0
		} while ((l | 0) < (m | 0));
		c[g >> 2] = c[e >> 2];
		if (($e(0, d, g, j, h) | 0) < 0) n = -1;
		else {
			if ((c[b + 76 >> 2] | 0) > -1) o = ie(b) | 0;
			else o = 0;
			e = c[b >> 2] | 0;
			l = e & 32;
			if ((a[b + 74 >> 0] | 0) < 1) c[b >> 2] = e & -33;
			e = b + 48 | 0;
			if (!(c[e >> 2] | 0)) {
				m = b + 44 | 0;
				p = c[m >> 2] | 0;
				c[m >> 2] = k;
				q = b + 28 | 0;
				c[q >> 2] = k;
				r = b + 20 | 0;
				c[r >> 2] = k;
				c[e >> 2] = 80;
				s = b + 16 | 0;
				c[s >> 2] = k + 80;
				k = $e(b, d, g, j, h) | 0;
				if (!p) t = k;
				else {
					qb[c[b + 36 >> 2] & 31](b, 0, 0) | 0;
					u = (c[r >> 2] | 0) == 0 ? -1 : k;
					c[m >> 2] = p;
					c[e >> 2] = 0;
					c[s >> 2] = 0;
					c[q >> 2] = 0;
					c[r >> 2] = 0;
					t = u
				}
			} else t = $e(b, d, g, j, h) | 0;
			h = c[b >> 2] | 0;
			c[b >> 2] = h | l;
			if (o) je(b);
			n = (h & 32 | 0) == 0 ? t : -1
		}
		i = f;
		return n | 0
	}

	function Fe(e, f, j) {
		e = e | 0;
		f = f | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0,
			I = 0,
			J = 0,
			K = 0,
			L = 0,
			M = 0,
			N = 0,
			O = 0,
			P = 0,
			Q = 0,
			R = 0,
			S = 0,
			T = 0,
			U = 0,
			V = 0,
			W = 0,
			X = 0,
			Y = 0,
			Z = 0,
			_ = 0,
			$ = 0,
			aa = 0,
			ba = 0,
			ca = 0,
			da = 0,
			ea = 0,
			fa = 0,
			ga = 0,
			ha = 0,
			ia = 0,
			ja = 0,
			ka = 0,
			la = 0,
			ma = 0,
			na = 0,
			oa = 0,
			pa = 0,
			qa = 0,
			ra = 0,
			sa = 0,
			ta = 0,
			ua = 0,
			va = 0,
			wa = 0,
			xa = 0,
			ya = 0,
			za = 0,
			Aa = 0,
			Ba = 0,
			Ca = 0,
			Da = 0,
			Ea = 0,
			Fa = 0,
			Ga = 0,
			Ha = 0,
			Ia = 0,
			Ja = 0,
			Ka = 0,
			La = 0,
			Ma = 0,
			Na = 0,
			Oa = 0,
			Pa = 0,
			Qa = 0,
			Ra = 0,
			Sa = 0,
			Ta = 0,
			Ua = 0,
			Va = 0,
			Wa = 0,
			Xa = 0,
			Ya = 0,
			Za = 0.0,
			_a = 0,
			$a = 0,
			ab = 0,
			bb = 0,
			cb = 0,
			db = 0,
			eb = 0,
			fb = 0,
			gb = 0,
			hb = 0,
			ib = 0,
			jb = 0;
		k = i;
		i = i + 304 | 0;
		l = k + 16 | 0;
		m = k + 8 | 0;
		n = k + 33 | 0;
		o = k;
		p = k + 32 | 0;
		if ((c[e + 76 >> 2] | 0) > -1) q = ie(e) | 0;
		else q = 0;
		r = a[f >> 0] | 0;
		a: do
			if (r << 24 >> 24) {
				s = e + 4 | 0;
				t = e + 100 | 0;
				u = e + 108 | 0;
				v = e + 8 | 0;
				w = n + 10 | 0;
				x = n + 33 | 0;
				y = m + 4 | 0;
				z = n + 46 | 0;
				A = n + 94 | 0;
				B = r;
				C = 0;
				E = f;
				F = 0;
				G = 0;
				H = 0;
				b: while (1) {
					c: do
						if (!(zd(B & 255) | 0)) {
							I = (a[E >> 0] | 0) == 37;
							d: do
								if (I) {
									J = E + 1 | 0;
									K = a[J >> 0] | 0;
									e: do switch (K << 24 >> 24) {
											case 37:
												{
													break d;
													break
												}
											case 42:
												{
													L = 0;M = E + 2 | 0;
													break
												}
											default:
												{
													N = (K & 255) + -48 | 0;
													if (N >>> 0 < 10 ? (a[E + 2 >> 0] | 0) == 36 : 0) {
														c[l >> 2] = c[j >> 2];
														O = N;
														while (1) {
															N = (c[l >> 2] | 0) + (4 - 1) & ~(4 - 1);
															P = c[N >> 2] | 0;
															c[l >> 2] = N + 4;
															if (O >>> 0 > 1) O = O + -1 | 0;
															else {
																Q = P;
																break
															}
														}
														L = Q;
														M = E + 3 | 0;
														break e
													}
													O = (c[j >> 2] | 0) + (4 - 1) & ~(4 - 1);P = c[O >> 2] | 0;c[j >> 2] = O + 4;L = P;M = J
												}
										}
										while (0);
										J = a[M >> 0] | 0;
									K = J & 255;
									if ((K + -48 | 0) >>> 0 < 10) {
										P = K;
										K = M;
										O = 0;
										while (1) {
											N = (O * 10 | 0) + -48 + P | 0;
											R = K + 1 | 0;
											S = a[R >> 0] | 0;
											P = S & 255;
											if ((P + -48 | 0) >>> 0 >= 10) {
												T = S;
												U = R;
												V = N;
												break
											} else {
												K = R;
												O = N
											}
										}
									} else {
										T = J;
										U = M;
										V = 0
									}
									if (T << 24 >> 24 == 109) {
										O = U + 1 | 0;
										W = a[O >> 0] | 0;
										X = (L | 0) != 0 & 1;
										Y = O;
										Z = 0;
										_ = 0
									} else {
										W = T;
										X = 0;
										Y = U;
										Z = G;
										_ = H
									}
									O = Y + 1 | 0;
									switch (W & 255 | 0) {
										case 104:
											{
												K = (a[O >> 0] | 0) == 104;$ = K ? Y + 2 | 0 : O;aa = K ? -2 : -1;
												break
											}
										case 108:
											{
												K = (a[O >> 0] | 0) == 108;$ = K ? Y + 2 | 0 : O;aa = K ? 3 : 1;
												break
											}
										case 106:
											{
												$ = O;aa = 3;
												break
											}
										case 116:
										case 122:
											{
												$ = O;aa = 1;
												break
											}
										case 76:
											{
												$ = O;aa = 2;
												break
											}
										case 110:
										case 112:
										case 67:
										case 83:
										case 91:
										case 99:
										case 115:
										case 88:
										case 71:
										case 70:
										case 69:
										case 65:
										case 103:
										case 102:
										case 101:
										case 97:
										case 120:
										case 117:
										case 111:
										case 105:
										case 100:
											{
												$ = Y;aa = 0;
												break
											}
										default:
											{
												ba = X;ca = C;da = Z;ea = _;fa = 152;
												break b
											}
									}
									O = d[$ >> 0] | 0;
									K = (O & 47 | 0) == 3;
									P = K ? O | 32 : O;
									O = K ? 1 : aa;
									switch (P | 0) {
										case 99:
											{
												ga = F;ha = (V | 0) < 1 ? 1 : V;
												break
											}
										case 91:
											{
												ga = F;ha = V;
												break
											}
										case 110:
											{
												if (!L) {
													ia = C;
													ja = $;
													ka = F;
													la = Z;
													ma = _;
													break c
												}
												switch (O | 0) {
													case -2:
														{
															a[L >> 0] = F;ia = C;ja = $;ka = F;la = Z;ma = _;
															break c;
															break
														}
													case -1:
														{
															b[L >> 1] = F;ia = C;ja = $;ka = F;la = Z;ma = _;
															break c;
															break
														}
													case 0:
														{
															c[L >> 2] = F;ia = C;ja = $;ka = F;la = Z;ma = _;
															break c;
															break
														}
													case 1:
														{
															c[L >> 2] = F;ia = C;ja = $;ka = F;la = Z;ma = _;
															break c;
															break
														}
													case 3:
														{
															K = L;c[K >> 2] = F;c[K + 4 >> 2] = ((F | 0) < 0) << 31 >> 31;ia = C;ja = $;ka = F;la = Z;ma = _;
															break c;
															break
														}
													default:
														{
															ia = C;ja = $;ka = F;la = Z;ma = _;
															break c
														}
												}
												break
											}
										default:
											{
												Fd(e, 0);do {
													K = c[s >> 2] | 0;
													if (K >>> 0 < (c[t >> 2] | 0) >>> 0) {
														c[s >> 2] = K + 1;
														na = d[K >> 0] | 0
													} else na = Gd(e) | 0
												} while ((zd(na) | 0) != 0);J = c[s >> 2] | 0;
												if (!(c[t >> 2] | 0)) oa = J;
												else {
													K = J + -1 | 0;
													c[s >> 2] = K;
													oa = K
												}
												ga = (c[u >> 2] | 0) + F + oa - (c[v >> 2] | 0) | 0;ha = V
											}
									}
									Fd(e, ha);
									K = c[s >> 2] | 0;
									J = c[t >> 2] | 0;
									if (K >>> 0 < J >>> 0) {
										c[s >> 2] = K + 1;
										pa = J
									} else {
										if ((Gd(e) | 0) < 0) {
											ba = X;
											ca = C;
											da = Z;
											ea = _;
											fa = 152;
											break b
										}
										pa = c[t >> 2] | 0
									}
									if (pa) c[s >> 2] = (c[s >> 2] | 0) + -1;
									f: do switch (P | 0) {
											case 91:
											case 99:
											case 115:
												{
													J = (P | 0) == 99;g: do
														if ((P & 239 | 0) == 99) {
															ip(n | 0, -1, 257) | 0;
															a[n >> 0] = 0;
															if ((P | 0) == 115) {
																a[x >> 0] = 0;
																a[w >> 0] = 0;
																a[w + 1 >> 0] = 0;
																a[w + 2 >> 0] = 0;
																a[w + 3 >> 0] = 0;
																a[w + 4 >> 0] = 0;
																qa = $
															} else qa = $
														} else {
															K = $ + 1 | 0;
															N = (a[K >> 0] | 0) == 94;
															R = N & 1;
															S = N ? K : $;
															ra = N ? $ + 2 | 0 : K;
															ip(n | 0, N & 1 | 0, 257) | 0;
															a[n >> 0] = 0;
															switch (a[ra >> 0] | 0) {
																case 45:
																	{
																		N = (R ^ 1) & 255;a[z >> 0] = N;sa = N;ta = S + 2 | 0;
																		break
																	}
																case 93:
																	{
																		N = (R ^ 1) & 255;a[A >> 0] = N;sa = N;ta = S + 2 | 0;
																		break
																	}
																default:
																	{
																		sa = (R ^ 1) & 255;ta = ra
																	}
															}
															ra = ta;
															while (1) {
																R = a[ra >> 0] | 0;
																h: do switch (R << 24 >> 24) {
																		case 0:
																			{
																				ba = X;ca = C;da = Z;ea = _;fa = 152;
																				break b;
																				break
																			}
																		case 93:
																			{
																				qa = ra;
																				break g;
																				break
																			}
																		case 45:
																			{
																				S = ra + 1 | 0;N = a[S >> 0] | 0;
																				switch (N << 24 >> 24) {
																					case 93:
																					case 0:
																						{
																							ua = 45;va = ra;
																							break h;
																							break
																						}
																					default:
																						{}
																				}
																				K = a[ra + -1 >> 0] | 0;
																				if ((K & 255) < (N & 255)) {
																					wa = K & 255;
																					do {
																						wa = wa + 1 | 0;
																						a[n + wa >> 0] = sa;
																						K = a[S >> 0] | 0
																					} while ((wa | 0) < (K & 255 | 0));
																					ua = K;
																					va = S
																				} else {
																					ua = N;
																					va = S
																				}
																				break
																			}
																		default:
																			{
																				ua = R;va = ra
																			}
																	}
																	while (0);
																	a[n + ((ua & 255) + 1) >> 0] = sa;
																ra = va + 1 | 0
															}
														}while (0);ra = J ? ha + 1 | 0 : 31;R = (O | 0) == 1;wa = (X | 0) != 0;i: do
														if (R) {
															if (wa) {
																K = qd(ra << 2) | 0;
																if (!K) {
																	ba = X;
																	ca = C;
																	da = 0;
																	ea = K;
																	fa = 152;
																	break b
																} else xa = K
															} else xa = L;
															c[m >> 2] = 0;
															c[y >> 2] = 0;
															K = 0;
															ya = ra;
															za = xa;
															j: while (1) {
																Aa = (za | 0) == 0;
																Ba = K;
																while (1) {
																	k: while (1) {
																		Ca = c[s >> 2] | 0;
																		if (Ca >>> 0 < (c[t >> 2] | 0) >>> 0) {
																			c[s >> 2] = Ca + 1;
																			Da = d[Ca >> 0] | 0
																		} else Da = Gd(e) | 0;
																		if (!(a[n + (Da + 1) >> 0] | 0)) {
																			Ea = Ba;
																			Fa = za;
																			break j
																		}
																		a[p >> 0] = Da;
																		switch ($d(o, p, 1, m) | 0) {
																			case -1:
																				{
																					ba = X;ca = C;da = 0;ea = za;fa = 152;
																					break b;
																					break
																				}
																			case -2:
																				break;
																			default:
																				break k
																		}
																	}
																	if (Aa) Ga = Ba;
																	else {
																		c[za + (Ba << 2) >> 2] = c[o >> 2];
																		Ga = Ba + 1 | 0
																	}
																	if (wa & (Ga | 0) == (ya | 0)) break;
																	else Ba = Ga
																}
																Ba = ya << 1 | 1;
																Aa = td(za, Ba << 2) | 0;
																if (!Aa) {
																	ba = X;
																	ca = C;
																	da = 0;
																	ea = za;
																	fa = 152;
																	break b
																}
																S = ya;
																ya = Ba;
																za = Aa;
																K = S
															}
															if (!(ae(m) | 0)) {
																ba = X;
																ca = C;
																da = 0;
																ea = Fa;
																fa = 152;
																break b
															} else {
																Ha = Ea;
																Ia = 0;
																Ja = Fa
															}
														} else {
															if (wa) {
																K = qd(ra) | 0;
																if (!K) {
																	ba = X;
																	ca = C;
																	da = 0;
																	ea = 0;
																	fa = 152;
																	break b
																} else {
																	Ka = 0;
																	La = ra;
																	Ma = K
																}
																while (1) {
																	K = Ka;
																	do {
																		za = c[s >> 2] | 0;
																		if (za >>> 0 < (c[t >> 2] | 0) >>> 0) {
																			c[s >> 2] = za + 1;
																			Na = d[za >> 0] | 0
																		} else Na = Gd(e) | 0;
																		if (!(a[n + (Na + 1) >> 0] | 0)) {
																			Ha = K;
																			Ia = Ma;
																			Ja = 0;
																			break i
																		}
																		a[Ma + K >> 0] = Na;
																		K = K + 1 | 0
																	} while ((K | 0) != (La | 0));
																	K = La << 1 | 1;
																	za = td(Ma, K) | 0;
																	if (!za) {
																		ba = X;
																		ca = C;
																		da = Ma;
																		ea = 0;
																		fa = 152;
																		break b
																	} else {
																		ya = La;
																		La = K;
																		Ma = za;
																		Ka = ya
																	}
																}
															}
															if (!L) {
																ya = pa;
																while (1) {
																	za = c[s >> 2] | 0;
																	if (za >>> 0 < ya >>> 0) {
																		c[s >> 2] = za + 1;
																		Oa = d[za >> 0] | 0
																	} else Oa = Gd(e) | 0;
																	if (!(a[n + (Oa + 1) >> 0] | 0)) {
																		Ha = 0;
																		Ia = 0;
																		Ja = 0;
																		break i
																	}
																	ya = c[t >> 2] | 0
																}
															} else {
																ya = pa;
																za = 0;
																while (1) {
																	K = c[s >> 2] | 0;
																	if (K >>> 0 < ya >>> 0) {
																		c[s >> 2] = K + 1;
																		Pa = d[K >> 0] | 0
																	} else Pa = Gd(e) | 0;
																	if (!(a[n + (Pa + 1) >> 0] | 0)) {
																		Ha = za;
																		Ia = L;
																		Ja = 0;
																		break i
																	}
																	a[L + za >> 0] = Pa;
																	ya = c[t >> 2] | 0;
																	za = za + 1 | 0
																}
															}
														}while (0);ra = c[s >> 2] | 0;
													if (!(c[t >> 2] | 0)) Qa = ra;
													else {
														za = ra + -1 | 0;
														c[s >> 2] = za;
														Qa = za
													}
													za = Qa - (c[v >> 2] | 0) + (c[u >> 2] | 0) | 0;
													if (!za) {
														Ra = X;
														Sa = C;
														Ta = Ia;
														Ua = Ja;
														break b
													}
													if (!((za | 0) == (ha | 0) | J ^ 1)) {
														Ra = X;
														Sa = C;
														Ta = Ia;
														Ua = Ja;
														break b
													}
													do
														if (wa)
															if (R) {
																c[L >> 2] = Ja;
																break
															} else {
																c[L >> 2] = Ia;
																break
															}
													while (0);
													if (J) {
														Va = qa;
														Wa = Ia;
														Xa = Ja
													} else {
														if (Ja) c[Ja + (Ha << 2) >> 2] = 0;
														if (!Ia) {
															Va = qa;
															Wa = 0;
															Xa = Ja;
															break f
														}
														a[Ia + Ha >> 0] = 0;
														Va = qa;
														Wa = Ia;
														Xa = Ja
													}
													break
												}
											case 120:
											case 88:
											case 112:
												{
													Ya = 16;fa = 134;
													break
												}
											case 111:
												{
													Ya = 8;fa = 134;
													break
												}
											case 117:
											case 100:
												{
													Ya = 10;fa = 134;
													break
												}
											case 105:
												{
													Ya = 0;fa = 134;
													break
												}
											case 71:
											case 103:
											case 70:
											case 102:
											case 69:
											case 101:
											case 65:
											case 97:
												{
													Za = +Dd(e, O, 0);
													if ((c[u >> 2] | 0) == ((c[v >> 2] | 0) - (c[s >> 2] | 0) | 0)) {
														Ra = X;
														Sa = C;
														Ta = Z;
														Ua = _;
														break b
													}
													if (!L) {
														Va = $;
														Wa = Z;
														Xa = _
													} else switch (O | 0) {
														case 0:
															{
																g[L >> 2] = Za;Va = $;Wa = Z;Xa = _;
																break f;
																break
															}
														case 1:
															{
																h[L >> 3] = Za;Va = $;Wa = Z;Xa = _;
																break f;
																break
															}
														case 2:
															{
																h[L >> 3] = Za;Va = $;Wa = Z;Xa = _;
																break f;
																break
															}
														default:
															{
																Va = $;Wa = Z;Xa = _;
																break f
															}
													}
													break
												}
											default:
												{
													Va = $;Wa = Z;Xa = _
												}
										}
										while (0);
										l: do
											if ((fa | 0) == 134) {
												fa = 0;
												R = Ed(e, Ya, 0, -1, -1) | 0;
												if ((c[u >> 2] | 0) == ((c[v >> 2] | 0) - (c[s >> 2] | 0) | 0)) {
													Ra = X;
													Sa = C;
													Ta = Z;
													Ua = _;
													break b
												}
												if ((L | 0) != 0 & (P | 0) == 112) {
													c[L >> 2] = R;
													Va = $;
													Wa = Z;
													Xa = _;
													break
												}
												if (!L) {
													Va = $;
													Wa = Z;
													Xa = _
												} else switch (O | 0) {
													case -2:
														{
															a[L >> 0] = R;Va = $;Wa = Z;Xa = _;
															break l;
															break
														}
													case -1:
														{
															b[L >> 1] = R;Va = $;Wa = Z;Xa = _;
															break l;
															break
														}
													case 0:
														{
															c[L >> 2] = R;Va = $;Wa = Z;Xa = _;
															break l;
															break
														}
													case 1:
														{
															c[L >> 2] = R;Va = $;Wa = Z;Xa = _;
															break l;
															break
														}
													case 3:
														{
															wa = L;c[wa >> 2] = R;c[wa + 4 >> 2] = D;Va = $;Wa = Z;Xa = _;
															break l;
															break
														}
													default:
														{
															Va = $;Wa = Z;Xa = _;
															break l
														}
												}
											}
									while (0);
									ia = ((L | 0) != 0 & 1) + C | 0;
									ja = Va;
									ka = (c[u >> 2] | 0) + ga + (c[s >> 2] | 0) - (c[v >> 2] | 0) | 0;
									la = Wa;
									ma = Xa;
									break c
								}
							while (0);
							O = E + (I & 1) | 0;
							Fd(e, 0);
							P = c[s >> 2] | 0;
							if (P >>> 0 < (c[t >> 2] | 0) >>> 0) {
								c[s >> 2] = P + 1;
								_a = d[P >> 0] | 0
							} else _a = Gd(e) | 0;
							if ((_a | 0) != (d[O >> 0] | 0)) {
								$a = _a;
								ab = C;
								bb = G;
								cb = H;
								fa = 21;
								break b
							}
							ia = C;
							ja = O;
							ka = F + 1 | 0;
							la = G;
							ma = H
						} else {
							O = E;
							while (1) {
								P = O + 1 | 0;
								if (!(zd(d[P >> 0] | 0) | 0)) {
									db = O;
									break
								} else O = P
							}
							Fd(e, 0);
							do {
								O = c[s >> 2] | 0;
								if (O >>> 0 < (c[t >> 2] | 0) >>> 0) {
									c[s >> 2] = O + 1;
									eb = d[O >> 0] | 0
								} else eb = Gd(e) | 0
							} while ((zd(eb) | 0) != 0);
							O = c[s >> 2] | 0;
							if (!(c[t >> 2] | 0)) fb = O;
							else {
								I = O + -1 | 0;
								c[s >> 2] = I;
								fb = I
							}
							ia = C;
							ja = db;
							ka = (c[u >> 2] | 0) + F + fb - (c[v >> 2] | 0) | 0;
							la = G;
							ma = H
						}while (0);E = ja + 1 | 0;B = a[E >> 0] | 0;
					if (!(B << 24 >> 24)) {
						gb = ia;
						break a
					} else {
						C = ia;
						F = ka;
						G = la;
						H = ma
					}
				}
				if ((fa | 0) == 21) {
					if (c[t >> 2] | 0) c[s >> 2] = (c[s >> 2] | 0) + -1;
					if ((ab | 0) != 0 | ($a | 0) > -1) {
						gb = ab;
						break
					} else {
						hb = 0;
						ib = bb;
						jb = cb;
						fa = 153
					}
				} else if ((fa | 0) == 152)
					if (!ca) {
						hb = ba;
						ib = da;
						jb = ea;
						fa = 153
					} else {
						Ra = ba;
						Sa = ca;
						Ta = da;
						Ua = ea
					}
				if ((fa | 0) == 153) {
					Ra = hb;
					Sa = -1;
					Ta = ib;
					Ua = jb
				}
				if (!Ra) gb = Sa;
				else {
					rd(Ta);
					rd(Ua);
					gb = Sa
				}
			} else gb = 0; while (0);
		if (q) je(e);
		i = k;
		return gb | 0
	}

	function Ge(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0;
		g = i;
		i = i + 128 | 0;
		h = g + 112 | 0;
		j = g;
		k = j;
		l = 3652;
		m = k + 112 | 0;
		do {
			c[k >> 2] = c[l >> 2];
			k = k + 4 | 0;
			l = l + 4 | 0
		} while ((k | 0) < (m | 0));
		if ((d + -1 | 0) >>> 0 > 2147483646)
			if (!d) {
				n = h;
				o = 1;
				p = 4
			} else {
				c[(Bd() | 0) >> 2] = 75;
				q = -1
			}
		else {
			n = b;
			o = d;
			p = 4
		}
		if ((p | 0) == 4) {
			p = -2 - n | 0;
			d = o >>> 0 > p >>> 0 ? p : o;
			c[j + 48 >> 2] = d;
			o = j + 20 | 0;
			c[o >> 2] = n;
			c[j + 44 >> 2] = n;
			p = n + d | 0;
			n = j + 16 | 0;
			c[n >> 2] = p;
			c[j + 28 >> 2] = p;
			p = Ee(j, e, f) | 0;
			if (!d) q = p;
			else {
				d = c[o >> 2] | 0;
				a[d + (((d | 0) == (c[n >> 2] | 0)) << 31 >> 31) >> 0] = 0;
				q = p
			}
		}
		i = g;
		return q | 0
	}

	function He(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0;
		e = i;
		i = i + 112 | 0;
		f = e;
		g = f;
		h = g + 112 | 0;
		do {
			c[g >> 2] = 0;
			g = g + 4 | 0
		} while ((g | 0) < (h | 0));
		c[f + 32 >> 2] = 26;
		c[f + 44 >> 2] = a;
		c[f + 76 >> 2] = -1;
		c[f + 84 >> 2] = a;
		a = Fe(f, b, d) | 0;
		i = e;
		return a | 0
	}

	function Ie(a, b) {
		a = a | 0;
		b = b | 0;
		return +(+bf(a, b, 2))
	}

	function Je(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		var d = 0;
		d = cf(a, b, c, -1, -1) | 0;
		return d | 0
	}

	function Ke(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		var d = 0;
		d = cf(a, b, c, 0, -2147483648) | 0;
		return d | 0
	}

	function Le(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0;
		f = d & 255;
		g = (e | 0) != 0;
		a: do
			if (g & (b & 3 | 0) != 0) {
				h = d & 255;
				i = e;
				j = b;
				while (1) {
					if ((a[j >> 0] | 0) == h << 24 >> 24) {
						k = i;
						l = j;
						m = 6;
						break a
					}
					n = j + 1 | 0;
					o = i + -1 | 0;
					p = (o | 0) != 0;
					if (p & (n & 3 | 0) != 0) {
						i = o;
						j = n
					} else {
						q = o;
						r = p;
						s = n;
						m = 5;
						break
					}
				}
			} else {
				q = e;
				r = g;
				s = b;
				m = 5
			}
		while (0);
		if ((m | 0) == 5)
			if (r) {
				k = q;
				l = s;
				m = 6
			} else {
				t = 0;
				u = s
			}
		b: do
			if ((m | 0) == 6) {
				s = d & 255;
				if ((a[l >> 0] | 0) == s << 24 >> 24) {
					t = k;
					u = l
				} else {
					q = $(f, 16843009) | 0;
					c: do
						if (k >>> 0 > 3) {
							r = k;
							b = l;
							while (1) {
								g = c[b >> 2] ^ q;
								if ((g & -2139062144 ^ -2139062144) & g + -16843009) {
									v = r;
									w = b;
									break
								}
								g = b + 4 | 0;
								e = r + -4 | 0;
								if (e >>> 0 > 3) {
									r = e;
									b = g
								} else {
									x = e;
									y = g;
									m = 11;
									break c
								}
							}
							z = v;
							A = w
						} else {
							x = k;
							y = l;
							m = 11
						}
					while (0);
					if ((m | 0) == 11)
						if (!x) {
							t = 0;
							u = y;
							break
						} else {
							z = x;
							A = y
						}
					while (1) {
						if ((a[A >> 0] | 0) == s << 24 >> 24) {
							t = z;
							u = A;
							break b
						}
						q = A + 1 | 0;
						z = z + -1 | 0;
						if (!z) {
							t = 0;
							u = q;
							break
						} else A = q
					}
				}
			}
		while (0);
		return ((t | 0) != 0 ? u : 0) | 0
	}

	function Sn(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			D = 0,
			E = 0,
			F = 0,
			G = 0;
		g = c[a >> 2] | 0;
		do
			if (g) {
				h = c[g + 12 >> 2] | 0;
				if ((h | 0) == (c[g + 16 >> 2] | 0)) i = xb[c[(c[g >> 2] | 0) + 36 >> 2] & 63](g) | 0;
				else i = c[h >> 2] | 0;
				if ((i | 0) == -1) {
					c[a >> 2] = 0;
					j = 1;
					break
				} else {
					j = (c[a >> 2] | 0) == 0;
					break
				}
			} else j = 1; while (0);
		i = c[b >> 2] | 0;
		do
			if (i) {
				g = c[i + 12 >> 2] | 0;
				if ((g | 0) == (c[i + 16 >> 2] | 0)) k = xb[c[(c[i >> 2] | 0) + 36 >> 2] & 63](i) | 0;
				else k = c[g >> 2] | 0;
				if ((k | 0) != -1)
					if (j) {
						l = i;
						m = 17;
						break
					} else {
						m = 16;
						break
					}
				else {
					c[b >> 2] = 0;
					m = 14;
					break
				}
			} else m = 14; while (0);
		if ((m | 0) == 14)
			if (j) m = 16;
			else {
				l = 0;
				m = 17
			}
		a: do
			if ((m | 0) == 16) {
				c[d >> 2] = c[d >> 2] | 6;
				n = 0
			} else
		if ((m | 0) == 17) {
			j = c[a >> 2] | 0;
			i = c[j + 12 >> 2] | 0;
			if ((i | 0) == (c[j + 16 >> 2] | 0)) o = xb[c[(c[j >> 2] | 0) + 36 >> 2] & 63](j) | 0;
			else o = c[i >> 2] | 0;
			if (!(qb[c[(c[e >> 2] | 0) + 12 >> 2] & 31](e, 2048, o) | 0)) {
				c[d >> 2] = c[d >> 2] | 4;
				n = 0;
				break
			}
			i = (qb[c[(c[e >> 2] | 0) + 52 >> 2] & 31](e, o, 0) | 0) << 24 >> 24;
			j = c[a >> 2] | 0;
			k = j + 12 | 0;
			g = c[k >> 2] | 0;
			if ((g | 0) == (c[j + 16 >> 2] | 0)) {
				xb[c[(c[j >> 2] | 0) + 40 >> 2] & 63](j) | 0;
				p = f;
				q = l;
				r = l;
				s = i
			} else {
				c[k >> 2] = g + 4;
				p = f;
				q = l;
				r = l;
				s = i
			}
			while (1) {
				i = s + -48 | 0;
				g = p + -1 | 0;
				k = c[a >> 2] | 0;
				do
					if (k) {
						j = c[k + 12 >> 2] | 0;
						if ((j | 0) == (c[k + 16 >> 2] | 0)) t = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
						else t = c[j >> 2] | 0;
						if ((t | 0) == -1) {
							c[a >> 2] = 0;
							u = 1;
							break
						} else {
							u = (c[a >> 2] | 0) == 0;
							break
						}
					} else u = 1; while (0);
				do
					if (r) {
						k = c[r + 12 >> 2] | 0;
						if ((k | 0) == (c[r + 16 >> 2] | 0)) v = xb[c[(c[r >> 2] | 0) + 36 >> 2] & 63](r) | 0;
						else v = c[k >> 2] | 0;
						if ((v | 0) == -1) {
							c[b >> 2] = 0;
							w = 0;
							x = 0;
							y = 1;
							break
						} else {
							w = q;
							x = q;
							y = (q | 0) == 0;
							break
						}
					} else {
						w = q;
						x = 0;
						y = 1
					}
				while (0);
				k = c[a >> 2] | 0;
				if (!((p | 0) > 1 & (u ^ y))) {
					z = k;
					A = w;
					B = i;
					break
				}
				j = c[k + 12 >> 2] | 0;
				if ((j | 0) == (c[k + 16 >> 2] | 0)) C = xb[c[(c[k >> 2] | 0) + 36 >> 2] & 63](k) | 0;
				else C = c[j >> 2] | 0;
				if (!(qb[c[(c[e >> 2] | 0) + 12 >> 2] & 31](e, 2048, C) | 0)) {
					n = i;
					break a
				}
				j = ((qb[c[(c[e >> 2] | 0) + 52 >> 2] & 31](e, C, 0) | 0) << 24 >> 24) + (i * 10 | 0) | 0;
				k = c[a >> 2] | 0;
				h = k + 12 | 0;
				D = c[h >> 2] | 0;
				if ((D | 0) == (c[k + 16 >> 2] | 0)) {
					xb[c[(c[k >> 2] | 0) + 40 >> 2] & 63](k) | 0;
					p = g;
					q = w;
					r = x;
					s = j;
					continue
				} else {
					c[h >> 2] = D + 4;
					p = g;
					q = w;
					r = x;
					s = j;
					continue
				}
			}
			do
				if (z) {
					j = c[z + 12 >> 2] | 0;
					if ((j | 0) == (c[z + 16 >> 2] | 0)) E = xb[c[(c[z >> 2] | 0) + 36 >> 2] & 63](z) | 0;
					else E = c[j >> 2] | 0;
					if ((E | 0) == -1) {
						c[a >> 2] = 0;
						F = 1;
						break
					} else {
						F = (c[a >> 2] | 0) == 0;
						break
					}
				} else F = 1; while (0);
			do
				if (A) {
					j = c[A + 12 >> 2] | 0;
					if ((j | 0) == (c[A + 16 >> 2] | 0)) G = xb[c[(c[A >> 2] | 0) + 36 >> 2] & 63](A) | 0;
					else G = c[j >> 2] | 0;
					if ((G | 0) != -1)
						if (F) {
							n = B;
							break a
						} else break;
					else {
						c[b >> 2] = 0;
						m = 60;
						break
					}
				} else m = 60; while (0);
			if ((m | 0) == 60 ? !F : 0) {
				n = B;
				break
			}
			c[d >> 2] = c[d >> 2] | 2;
			n = B
		}
		while (0);
		return n | 0
	}

	function Tn(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a + 4 | 0;
		f = (c[e >> 2] | 0) != 112;
		g = c[a >> 2] | 0;
		h = g;
		i = (c[d >> 2] | 0) - h | 0;
		j = i >>> 0 < 2147483647 ? i << 1 : -1;
		i = (c[b >> 2] | 0) - h | 0;
		h = td(f ? g : 0, j) | 0;
		if (!h) md();
		if (!f) {
			f = c[a >> 2] | 0;
			c[a >> 2] = h;
			if (!f) k = h;
			else {
				tb[c[e >> 2] & 127](f);
				k = c[a >> 2] | 0
			}
		} else {
			c[a >> 2] = h;
			k = h
		}
		c[e >> 2] = 123;
		c[b >> 2] = k + i;
		c[d >> 2] = (c[a >> 2] | 0) + j;
		return
	}

	function Un(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a + 4 | 0;
		f = (c[e >> 2] | 0) != 112;
		g = c[a >> 2] | 0;
		h = g;
		i = (c[d >> 2] | 0) - h | 0;
		j = i >>> 0 < 2147483647 ? i << 1 : -1;
		i = (c[b >> 2] | 0) - h >> 2;
		h = td(f ? g : 0, j) | 0;
		if (!h) md();
		if (!f) {
			f = c[a >> 2] | 0;
			c[a >> 2] = h;
			if (!f) k = h;
			else {
				tb[c[e >> 2] & 127](f);
				k = c[a >> 2] | 0
			}
		} else {
			c[a >> 2] = h;
			k = h
		}
		c[e >> 2] = 123;
		c[b >> 2] = k + (i << 2);
		c[d >> 2] = (c[a >> 2] | 0) + (j >>> 2 << 2);
		return
	}

	function Vn(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		f = d;
		g = a[b >> 0] | 0;
		if (!(g & 1)) {
			h = 10;
			i = (g & 255) >>> 1;
			j = g
		} else {
			g = c[b >> 2] | 0;
			h = (g & -2) + -1 | 0;
			i = c[b + 4 >> 2] | 0;
			j = g & 255
		}
		g = e - f | 0;
		do
			if ((e | 0) != (d | 0)) {
				if ((h - i | 0) >>> 0 < g >>> 0) {
					Xf(b, h, i + g - h | 0, i, i, 0, 0);
					k = a[b >> 0] | 0
				} else k = j;
				if (!(k & 1)) l = b + 1 | 0;
				else l = c[b + 8 >> 2] | 0;
				m = e + (i - f) | 0;
				if ((d | 0) != (e | 0)) {
					n = d;
					o = l + i | 0;
					while (1) {
						a[o >> 0] = a[n >> 0] | 0;
						n = n + 1 | 0;
						if ((n | 0) == (e | 0)) break;
						else o = o + 1 | 0
					}
				}
				a[l + m >> 0] = 0;
				o = i + g | 0;
				if (!(a[b >> 0] & 1)) {
					a[b >> 0] = o << 1;
					break
				} else {
					c[b + 4 >> 2] = o;
					break
				}
			}
		while (0);
		return b | 0
	}

	function Wn(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0;
		e = a + 4 | 0;
		f = (c[e >> 2] | 0) != 112;
		g = c[a >> 2] | 0;
		h = g;
		i = (c[d >> 2] | 0) - h | 0;
		j = i >>> 0 < 2147483647 ? i << 1 : -1;
		i = (c[b >> 2] | 0) - h >> 2;
		h = td(f ? g : 0, j) | 0;
		if (!h) md();
		if (!f) {
			f = c[a >> 2] | 0;
			c[a >> 2] = h;
			if (!f) k = h;
			else {
				tb[c[e >> 2] & 127](f);
				k = c[a >> 2] | 0
			}
		} else {
			c[a >> 2] = h;
			k = h
		}
		c[e >> 2] = 123;
		c[b >> 2] = k + (i << 2);
		c[d >> 2] = (c[a >> 2] | 0) + (j >>> 2 << 2);
		return
	}

	function Xn(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		f = d;
		g = a[b >> 0] | 0;
		if (!(g & 1)) {
			h = 1;
			i = (g & 255) >>> 1;
			j = g
		} else {
			g = c[b >> 2] | 0;
			h = (g & -2) + -1 | 0;
			i = c[b + 4 >> 2] | 0;
			j = g & 255
		}
		g = e - f >> 2;
		do
			if (g) {
				if ((h - i | 0) >>> 0 < g >>> 0) {
					eg(b, h, i + g - h | 0, i, i, 0, 0);
					k = a[b >> 0] | 0
				} else k = j;
				if (!(k & 1)) l = b + 4 | 0;
				else l = c[b + 8 >> 2] | 0;
				m = i + ((e - f | 0) >>> 2) | 0;
				if ((d | 0) != (e | 0)) {
					n = d;
					o = l + (i << 2) | 0;
					while (1) {
						c[o >> 2] = c[n >> 2];
						n = n + 4 | 0;
						if ((n | 0) == (e | 0)) break;
						else o = o + 4 | 0
					}
				}
				c[l + (m << 2) >> 2] = 0;
				o = i + g | 0;
				if (!(a[b >> 0] & 1)) {
					a[b >> 0] = o << 1;
					break
				} else {
					c[b + 4 >> 2] = o;
					break
				}
			}
		while (0);
		return b | 0
	}

	function Yn(b, d) {
		b = b | 0;
		d = d | 0;
		c[b >> 2] = 0;
		c[b + 4 >> 2] = 0;
		c[b + 8 >> 2] = 0;
		a[b + 128 >> 0] = 0;
		if (d) {
			Uo(b, d);
			Qo(b, d)
		}
		return
	}

	function Zn(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(8796) | 0);
		return
	}

	function _n(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(8836) | 0);
		return
	}

	function $n(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9868) | 0);
		return
	}

	function ao(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9860) | 0);
		return
	}

	function bo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9928) | 0);
		return
	}

	function co(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9936) | 0);
		return
	}

	function eo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9992) | 0);
		return
	}

	function fo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(1e4) | 0);
		return
	}

	function go(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(10008) | 0);
		return
	}

	function ho(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(10016) | 0);
		return
	}

	function io(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(8908) | 0);
		return
	}

	function jo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(8980) | 0);
		return
	}

	function ko(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9040) | 0);
		return
	}

	function lo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9100) | 0);
		return
	}

	function mo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9412) | 0);
		return
	}

	function no(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9476) | 0);
		return
	}

	function oo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9540) | 0);
		return
	}

	function po(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9604) | 0);
		return
	}

	function qo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9640) | 0);
		return
	}

	function ro(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9676) | 0);
		return
	}

	function so(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9712) | 0);
		return
	}

	function to(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9748) | 0);
		return
	}

	function uo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9192) | 0);
		return
	}

	function vo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9284) | 0);
		return
	}

	function wo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9316) | 0);
		return
	}

	function xo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9348) | 0);
		return
	}

	function yo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9788) | 0);
		return
	}

	function zo(a, b) {
		a = a | 0;
		b = b | 0;
		wl(a, b, Fl(9828) | 0);
		return
	}

	function Ao(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		d = a + 4 | 0;
		e = c[d >> 2] | 0;
		f = c[a >> 2] | 0;
		g = e - f >> 2;
		if (g >>> 0 >= b >>> 0) {
			if (g >>> 0 > b >>> 0 ? (h = f + (b << 2) | 0, (e | 0) != (h | 0)) : 0) {
				f = e;
				while (1) {
					e = f + -4 | 0;
					if ((e | 0) == (h | 0)) {
						i = e;
						break
					} else f = e
				}
				c[d >> 2] = i
			}
		} else Po(a, b - g | 0);
		return
	}

	function Bo(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0;
		d = c[b >> 2] | 0;
		do
			if (d) {
				e = b + 4 | 0;
				f = c[e >> 2] | 0;
				if ((f | 0) != (d | 0)) {
					g = f;
					while (1) {
						f = g + -4 | 0;
						if ((f | 0) == (d | 0)) {
							h = f;
							break
						} else g = f
					}
					c[e >> 2] = h
				}
				if ((b + 16 | 0) == (d | 0)) {
					a[b + 128 >> 0] = 0;
					break
				} else {
					Fc(d);
					break
				}
			}
		while (0);
		return
	}

	function Co(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0,
			f = 0;
		b = a + 4 | 0;
		d = c[b >> 2] | 0;
		e = c[b + 4 >> 2] | 0;
		b = (c[a >> 2] | 0) + (e >> 1) | 0;
		if (!(e & 1)) f = d;
		else f = c[(c[b >> 2] | 0) + d >> 2] | 0;
		tb[f & 127](b);
		return
	}

	function Do(d, f, g, h, i, j, k, l) {
		d = d | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		var m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0;
		c[g >> 2] = d;
		c[j >> 2] = h;
		d = i;
		if (l & 2)
			if ((d - h | 0) < 3) m = 1;
			else {
				c[j >> 2] = h + 1;
				a[h >> 0] = -17;
				h = c[j >> 2] | 0;
				c[j >> 2] = h + 1;
				a[h >> 0] = -69;
				h = c[j >> 2] | 0;
				c[j >> 2] = h + 1;
				a[h >> 0] = -65;
				n = 4
			}
		else n = 4;
		a: do
			if ((n | 0) == 4) {
				h = f;
				l = c[g >> 2] | 0;
				if (l >>> 0 < f >>> 0) {
					i = l;
					while (1) {
						l = b[i >> 1] | 0;
						o = l & 65535;
						if (o >>> 0 > k >>> 0) {
							m = 2;
							break a
						}
						do
							if ((l & 65535) < 128) {
								p = c[j >> 2] | 0;
								if ((d - p | 0) < 1) {
									m = 1;
									break a
								}
								c[j >> 2] = p + 1;
								a[p >> 0] = l
							} else {
								if ((l & 65535) < 2048) {
									p = c[j >> 2] | 0;
									if ((d - p | 0) < 2) {
										m = 1;
										break a
									}
									c[j >> 2] = p + 1;
									a[p >> 0] = o >>> 6 | 192;
									p = c[j >> 2] | 0;
									c[j >> 2] = p + 1;
									a[p >> 0] = o & 63 | 128;
									break
								}
								if ((l & 65535) < 55296) {
									p = c[j >> 2] | 0;
									if ((d - p | 0) < 3) {
										m = 1;
										break a
									}
									c[j >> 2] = p + 1;
									a[p >> 0] = o >>> 12 | 224;
									p = c[j >> 2] | 0;
									c[j >> 2] = p + 1;
									a[p >> 0] = o >>> 6 & 63 | 128;
									p = c[j >> 2] | 0;
									c[j >> 2] = p + 1;
									a[p >> 0] = o & 63 | 128;
									break
								}
								if ((l & 65535) >= 56320) {
									if ((l & 65535) < 57344) {
										m = 2;
										break a
									}
									p = c[j >> 2] | 0;
									if ((d - p | 0) < 3) {
										m = 1;
										break a
									}
									c[j >> 2] = p + 1;
									a[p >> 0] = o >>> 12 | 224;
									p = c[j >> 2] | 0;
									c[j >> 2] = p + 1;
									a[p >> 0] = o >>> 6 & 63 | 128;
									p = c[j >> 2] | 0;
									c[j >> 2] = p + 1;
									a[p >> 0] = o & 63 | 128;
									break
								}
								if ((h - i | 0) < 4) {
									m = 1;
									break a
								}
								p = i + 2 | 0;
								q = e[p >> 1] | 0;
								if ((q & 64512 | 0) != 56320) {
									m = 2;
									break a
								}
								if ((d - (c[j >> 2] | 0) | 0) < 4) {
									m = 1;
									break a
								}
								r = o & 960;
								if (((r << 10) + 65536 | o << 10 & 64512 | q & 1023) >>> 0 > k >>> 0) {
									m = 2;
									break a
								}
								c[g >> 2] = p;
								p = (r >>> 6) + 1 | 0;
								r = c[j >> 2] | 0;
								c[j >> 2] = r + 1;
								a[r >> 0] = p >>> 2 | 240;
								r = c[j >> 2] | 0;
								c[j >> 2] = r + 1;
								a[r >> 0] = o >>> 2 & 15 | p << 4 & 48 | 128;
								p = c[j >> 2] | 0;
								c[j >> 2] = p + 1;
								a[p >> 0] = o << 4 & 48 | q >>> 6 & 15 | 128;
								p = c[j >> 2] | 0;
								c[j >> 2] = p + 1;
								a[p >> 0] = q & 63 | 128
							}
						while (0);
						i = (c[g >> 2] | 0) + 2 | 0;
						c[g >> 2] = i;
						if (i >>> 0 >= f >>> 0) {
							m = 0;
							break
						}
					}
				} else m = 0
			}
		while (0);
		return m | 0
	}

	function Eo(e, f, g, h, i, j, k, l) {
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		l = l | 0;
		var m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0;
		c[g >> 2] = e;
		c[j >> 2] = h;
		if (l & 4) {
			l = c[g >> 2] | 0;
			e = f;
			if ((((e - l | 0) > 2 ? (a[l >> 0] | 0) == -17 : 0) ? (a[l + 1 >> 0] | 0) == -69 : 0) ? (a[l + 2 >> 0] | 0) == -65 : 0) {
				c[g >> 2] = l + 3;
				m = c[j >> 2] | 0;
				n = e
			} else {
				m = h;
				n = e
			}
		} else {
			m = h;
			n = f
		}
		h = i;
		e = c[g >> 2] | 0;
		l = e >>> 0 < f >>> 0;
		a: do
			if (l & m >>> 0 < i >>> 0) {
				o = e;
				p = m;
				while (1) {
					q = a[o >> 0] | 0;
					r = q & 255;
					if (r >>> 0 > k >>> 0) {
						s = 2;
						break a
					}
					do
						if (q << 24 >> 24 > -1) {
							b[p >> 1] = q & 255;
							c[g >> 2] = o + 1
						} else {
							if ((q & 255) < 194) {
								s = 2;
								break a
							}
							if ((q & 255) < 224) {
								if ((n - o | 0) < 2) {
									s = 1;
									break a
								}
								t = d[o + 1 >> 0] | 0;
								if ((t & 192 | 0) != 128) {
									s = 2;
									break a
								}
								u = t & 63 | r << 6 & 1984;
								if (u >>> 0 > k >>> 0) {
									s = 2;
									break a
								}
								b[p >> 1] = u;
								c[g >> 2] = o + 2;
								break
							}
							if ((q & 255) < 240) {
								if ((n - o | 0) < 3) {
									s = 1;
									break a
								}
								u = a[o + 1 >> 0] | 0;
								t = a[o + 2 >> 0] | 0;
								switch (r | 0) {
									case 224:
										{
											if ((u & -32) << 24 >> 24 != -96) {
												s = 2;
												break a
											}
											break
										}
									case 237:
										{
											if ((u & -32) << 24 >> 24 != -128) {
												s = 2;
												break a
											}
											break
										}
									default:
										if ((u & -64) << 24 >> 24 != -128) {
											s = 2;
											break a
										}
								}
								v = t & 255;
								if ((v & 192 | 0) != 128) {
									s = 2;
									break a
								}
								t = (u & 255) << 6 & 4032 | r << 12 | v & 63;
								if ((t & 65535) >>> 0 > k >>> 0) {
									s = 2;
									break a
								}
								b[p >> 1] = t;
								c[g >> 2] = o + 3;
								break
							}
							if ((q & 255) >= 245) {
								s = 2;
								break a
							}
							if ((n - o | 0) < 4) {
								s = 1;
								break a
							}
							t = a[o + 1 >> 0] | 0;
							v = a[o + 2 >> 0] | 0;
							u = a[o + 3 >> 0] | 0;
							switch (r | 0) {
								case 240:
									{
										if ((t + 112 & 255) >= 48) {
											s = 2;
											break a
										}
										break
									}
								case 244:
									{
										if ((t & -16) << 24 >> 24 != -128) {
											s = 2;
											break a
										}
										break
									}
								default:
									if ((t & -64) << 24 >> 24 != -128) {
										s = 2;
										break a
									}
							}
							w = v & 255;
							if ((w & 192 | 0) != 128) {
								s = 2;
								break a
							}
							v = u & 255;
							if ((v & 192 | 0) != 128) {
								s = 2;
								break a
							}
							if ((h - p | 0) < 4) {
								s = 1;
								break a
							}
							u = r & 7;
							x = t & 255;
							t = w << 6;
							y = v & 63;
							if ((x << 12 & 258048 | u << 18 | t & 4032 | y) >>> 0 > k >>> 0) {
								s = 2;
								break a
							}
							b[p >> 1] = x << 2 & 60 | w >>> 4 & 3 | ((x >>> 4 & 3 | u << 2) << 6) + 16320 | 55296;
							u = p + 2 | 0;
							c[j >> 2] = u;
							b[u >> 1] = y | t & 960 | 56320;
							c[g >> 2] = (c[g >> 2] | 0) + 4
						}
					while (0);
					p = (c[j >> 2] | 0) + 2 | 0;
					c[j >> 2] = p;
					o = c[g >> 2] | 0;
					r = o >>> 0 < f >>> 0;
					if (!(r & p >>> 0 < i >>> 0)) {
						z = r;
						A = 39;
						break
					}
				}
			} else {
				z = l;
				A = 39
			}
		while (0);
		if ((A | 0) == 39) s = z & 1;
		return s | 0
	}

	function Fo(b, c, e, f, g) {
		b = b | 0;
		c = c | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0;
		h = c;
		if ((((g & 4 | 0) != 0 ? (h - b | 0) > 2 : 0) ? (a[b >> 0] | 0) == -17 : 0) ? (a[b + 1 >> 0] | 0) == -69 : 0) i = (a[b + 2 >> 0] | 0) == -65 ? b + 3 | 0 : b;
		else i = b;
		a: do
			if ((e | 0) != 0 & i >>> 0 < c >>> 0) {
				g = i;
				j = 0;
				b: while (1) {
					k = a[g >> 0] | 0;
					l = k & 255;
					if (l >>> 0 > f >>> 0) {
						m = g;
						n = 42;
						break a
					}
					do
						if (k << 24 >> 24 > -1) {
							o = g + 1 | 0;
							p = j
						} else {
							if ((k & 255) < 194) {
								m = g;
								n = 42;
								break a
							}
							if ((k & 255) < 224) {
								if ((h - g | 0) < 2) {
									m = g;
									n = 42;
									break a
								}
								q = d[g + 1 >> 0] | 0;
								if ((q & 192 | 0) != 128) {
									m = g;
									n = 42;
									break a
								}
								if ((q & 63 | l << 6 & 1984) >>> 0 > f >>> 0) {
									m = g;
									n = 42;
									break a
								}
								o = g + 2 | 0;
								p = j;
								break
							}
							if ((k & 255) < 240) {
								q = g;
								if ((h - q | 0) < 3) {
									m = g;
									n = 42;
									break a
								}
								r = a[g + 1 >> 0] | 0;
								s = a[g + 2 >> 0] | 0;
								switch (l | 0) {
									case 224:
										{
											if ((r & -32) << 24 >> 24 != -96) {
												t = q;
												n = 20;
												break b
											}
											break
										}
									case 237:
										{
											if ((r & -32) << 24 >> 24 != -128) {
												u = q;
												n = 22;
												break b
											}
											break
										}
									default:
										if ((r & -64) << 24 >> 24 != -128) {
											v = q;
											n = 24;
											break b
										}
								}
								q = s & 255;
								if ((q & 192 | 0) != 128) {
									m = g;
									n = 42;
									break a
								}
								if (((r & 255) << 6 & 4032 | l << 12 & 61440 | q & 63) >>> 0 > f >>> 0) {
									m = g;
									n = 42;
									break a
								}
								o = g + 3 | 0;
								p = j;
								break
							}
							if ((k & 255) >= 245) {
								m = g;
								n = 42;
								break a
							}
							q = g;
							if ((e - j | 0) >>> 0 < 2 | (h - q | 0) < 4) {
								m = g;
								n = 42;
								break a
							}
							r = a[g + 1 >> 0] | 0;
							s = a[g + 2 >> 0] | 0;
							w = a[g + 3 >> 0] | 0;
							switch (l | 0) {
								case 240:
									{
										if ((r + 112 & 255) >= 48) {
											x = q;
											n = 32;
											break b
										}
										break
									}
								case 244:
									{
										if ((r & -16) << 24 >> 24 != -128) {
											y = q;
											n = 34;
											break b
										}
										break
									}
								default:
									if ((r & -64) << 24 >> 24 != -128) {
										z = q;
										n = 36;
										break b
									}
							}
							q = s & 255;
							if ((q & 192 | 0) != 128) {
								m = g;
								n = 42;
								break a
							}
							s = w & 255;
							if ((s & 192 | 0) != 128) {
								m = g;
								n = 42;
								break a
							}
							if (((r & 255) << 12 & 258048 | l << 18 & 1835008 | q << 6 & 4032 | s & 63) >>> 0 > f >>> 0) {
								m = g;
								n = 42;
								break a
							}
							o = g + 4 | 0;
							p = j + 1 | 0
						}
					while (0);
					j = p + 1 | 0;
					if (!(j >>> 0 < e >>> 0 & o >>> 0 < c >>> 0)) {
						m = o;
						n = 42;
						break a
					} else g = o
				}
				if ((n | 0) == 20) {
					A = t - b | 0;
					break
				} else if ((n | 0) == 22) {
					A = u - b | 0;
					break
				} else if ((n | 0) == 24) {
					A = v - b | 0;
					break
				} else if ((n | 0) == 32) {
					A = x - b | 0;
					break
				} else if ((n | 0) == 34) {
					A = y - b | 0;
					break
				} else if ((n | 0) == 36) {
					A = z - b | 0;
					break
				}
			} else {
				m = i;
				n = 42
			}
		while (0);
		if ((n | 0) == 42) A = m - b | 0;
		return A | 0
	}

	function Go(b, d, e, f, g, h, i, j) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		var k = 0,
			l = 0,
			m = 0,
			n = 0;
		c[e >> 2] = b;
		c[h >> 2] = f;
		b = g;
		if (j & 2)
			if ((b - f | 0) < 3) k = 1;
			else {
				c[h >> 2] = f + 1;
				a[f >> 0] = -17;
				f = c[h >> 2] | 0;
				c[h >> 2] = f + 1;
				a[f >> 0] = -69;
				f = c[h >> 2] | 0;
				c[h >> 2] = f + 1;
				a[f >> 0] = -65;
				l = 4
			}
		else l = 4;
		a: do
			if ((l | 0) == 4) {
				f = c[e >> 2] | 0;
				if (f >>> 0 < d >>> 0) {
					j = f;
					while (1) {
						f = c[j >> 2] | 0;
						if (f >>> 0 > i >>> 0 | (f & -2048 | 0) == 55296) {
							k = 2;
							break a
						}
						do
							if (f >>> 0 >= 128) {
								if (f >>> 0 < 2048) {
									g = c[h >> 2] | 0;
									if ((b - g | 0) < 2) {
										k = 1;
										break a
									}
									c[h >> 2] = g + 1;
									a[g >> 0] = f >>> 6 | 192;
									g = c[h >> 2] | 0;
									c[h >> 2] = g + 1;
									a[g >> 0] = f & 63 | 128;
									break
								}
								g = c[h >> 2] | 0;
								m = b - g | 0;
								if (f >>> 0 < 65536) {
									if ((m | 0) < 3) {
										k = 1;
										break a
									}
									c[h >> 2] = g + 1;
									a[g >> 0] = f >>> 12 | 224;
									n = c[h >> 2] | 0;
									c[h >> 2] = n + 1;
									a[n >> 0] = f >>> 6 & 63 | 128;
									n = c[h >> 2] | 0;
									c[h >> 2] = n + 1;
									a[n >> 0] = f & 63 | 128;
									break
								} else {
									if ((m | 0) < 4) {
										k = 1;
										break a
									}
									c[h >> 2] = g + 1;
									a[g >> 0] = f >>> 18 | 240;
									g = c[h >> 2] | 0;
									c[h >> 2] = g + 1;
									a[g >> 0] = f >>> 12 & 63 | 128;
									g = c[h >> 2] | 0;
									c[h >> 2] = g + 1;
									a[g >> 0] = f >>> 6 & 63 | 128;
									g = c[h >> 2] | 0;
									c[h >> 2] = g + 1;
									a[g >> 0] = f & 63 | 128;
									break
								}
							} else {
								g = c[h >> 2] | 0;
								if ((b - g | 0) < 1) {
									k = 1;
									break a
								}
								c[h >> 2] = g + 1;
								a[g >> 0] = f
							}
						while (0);
						j = (c[e >> 2] | 0) + 4 | 0;
						c[e >> 2] = j;
						if (j >>> 0 >= d >>> 0) {
							k = 0;
							break
						}
					}
				} else k = 0
			}
		while (0);
		return k | 0
	}

	function Ho(b, e, f, g, h, i, j, k) {
		b = b | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		j = j | 0;
		k = k | 0;
		var l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0;
		c[f >> 2] = b;
		c[i >> 2] = g;
		if (k & 4) {
			k = c[f >> 2] | 0;
			b = e;
			if ((((b - k | 0) > 2 ? (a[k >> 0] | 0) == -17 : 0) ? (a[k + 1 >> 0] | 0) == -69 : 0) ? (a[k + 2 >> 0] | 0) == -65 : 0) {
				c[f >> 2] = k + 3;
				l = c[i >> 2] | 0;
				m = b
			} else {
				l = g;
				m = b
			}
		} else {
			l = g;
			m = e
		}
		g = c[f >> 2] | 0;
		b = g >>> 0 < e >>> 0;
		a: do
			if (b & l >>> 0 < h >>> 0) {
				k = g;
				n = l;
				while (1) {
					o = a[k >> 0] | 0;
					p = o & 255;
					do
						if (o << 24 >> 24 > -1) {
							if (p >>> 0 > j >>> 0) {
								q = 2;
								break a
							}
							c[n >> 2] = p;
							c[f >> 2] = k + 1
						} else {
							if ((o & 255) < 194) {
								q = 2;
								break a
							}
							if ((o & 255) < 224) {
								if ((m - k | 0) < 2) {
									q = 1;
									break a
								}
								r = d[k + 1 >> 0] | 0;
								if ((r & 192 | 0) != 128) {
									q = 2;
									break a
								}
								s = r & 63 | p << 6 & 1984;
								if (s >>> 0 > j >>> 0) {
									q = 2;
									break a
								}
								c[n >> 2] = s;
								c[f >> 2] = k + 2;
								break
							}
							if ((o & 255) < 240) {
								if ((m - k | 0) < 3) {
									q = 1;
									break a
								}
								s = a[k + 1 >> 0] | 0;
								r = a[k + 2 >> 0] | 0;
								switch (p | 0) {
									case 224:
										{
											if ((s & -32) << 24 >> 24 != -96) {
												q = 2;
												break a
											}
											break
										}
									case 237:
										{
											if ((s & -32) << 24 >> 24 != -128) {
												q = 2;
												break a
											}
											break
										}
									default:
										if ((s & -64) << 24 >> 24 != -128) {
											q = 2;
											break a
										}
								}
								t = r & 255;
								if ((t & 192 | 0) != 128) {
									q = 2;
									break a
								}
								r = (s & 255) << 6 & 4032 | p << 12 & 61440 | t & 63;
								if (r >>> 0 > j >>> 0) {
									q = 2;
									break a
								}
								c[n >> 2] = r;
								c[f >> 2] = k + 3;
								break
							}
							if ((o & 255) >= 245) {
								q = 2;
								break a
							}
							if ((m - k | 0) < 4) {
								q = 1;
								break a
							}
							r = a[k + 1 >> 0] | 0;
							t = a[k + 2 >> 0] | 0;
							s = a[k + 3 >> 0] | 0;
							switch (p | 0) {
								case 240:
									{
										if ((r + 112 & 255) >= 48) {
											q = 2;
											break a
										}
										break
									}
								case 244:
									{
										if ((r & -16) << 24 >> 24 != -128) {
											q = 2;
											break a
										}
										break
									}
								default:
									if ((r & -64) << 24 >> 24 != -128) {
										q = 2;
										break a
									}
							}
							u = t & 255;
							if ((u & 192 | 0) != 128) {
								q = 2;
								break a
							}
							t = s & 255;
							if ((t & 192 | 0) != 128) {
								q = 2;
								break a
							}
							s = (r & 255) << 12 & 258048 | p << 18 & 1835008 | u << 6 & 4032 | t & 63;
							if (s >>> 0 > j >>> 0) {
								q = 2;
								break a
							}
							c[n >> 2] = s;
							c[f >> 2] = k + 4
						}
					while (0);
					n = (c[i >> 2] | 0) + 4 | 0;
					c[i >> 2] = n;
					k = c[f >> 2] | 0;
					p = k >>> 0 < e >>> 0;
					if (!(p & n >>> 0 < h >>> 0)) {
						v = p;
						w = 38;
						break
					}
				}
			} else {
				v = b;
				w = 38
			}
		while (0);
		if ((w | 0) == 38) q = v & 1;
		return q | 0
	}

	function Io(b, c, e, f, g) {
		b = b | 0;
		c = c | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		var h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0;
		h = c;
		if ((((g & 4 | 0) != 0 ? (h - b | 0) > 2 : 0) ? (a[b >> 0] | 0) == -17 : 0) ? (a[b + 1 >> 0] | 0) == -69 : 0) i = (a[b + 2 >> 0] | 0) == -65 ? b + 3 | 0 : b;
		else i = b;
		a: do
			if ((e | 0) != 0 & i >>> 0 < c >>> 0) {
				g = i;
				j = 0;
				b: while (1) {
					k = a[g >> 0] | 0;
					l = k & 255;
					do
						if (k << 24 >> 24 > -1) {
							if (l >>> 0 > f >>> 0) {
								m = g;
								n = 42;
								break a
							}
							o = g + 1 | 0
						} else {
							if ((k & 255) < 194) {
								m = g;
								n = 42;
								break a
							}
							if ((k & 255) < 224) {
								if ((h - g | 0) < 2) {
									m = g;
									n = 42;
									break a
								}
								p = d[g + 1 >> 0] | 0;
								if ((p & 192 | 0) != 128) {
									m = g;
									n = 42;
									break a
								}
								if ((p & 63 | l << 6 & 1984) >>> 0 > f >>> 0) {
									m = g;
									n = 42;
									break a
								}
								o = g + 2 | 0;
								break
							}
							if ((k & 255) < 240) {
								p = g;
								if ((h - p | 0) < 3) {
									m = g;
									n = 42;
									break a
								}
								q = a[g + 1 >> 0] | 0;
								r = a[g + 2 >> 0] | 0;
								switch (l | 0) {
									case 224:
										{
											if ((q & -32) << 24 >> 24 != -96) {
												s = p;
												n = 20;
												break b
											}
											break
										}
									case 237:
										{
											if ((q & -32) << 24 >> 24 != -128) {
												t = p;
												n = 22;
												break b
											}
											break
										}
									default:
										if ((q & -64) << 24 >> 24 != -128) {
											u = p;
											n = 24;
											break b
										}
								}
								p = r & 255;
								if ((p & 192 | 0) != 128) {
									m = g;
									n = 42;
									break a
								}
								if (((q & 255) << 6 & 4032 | l << 12 & 61440 | p & 63) >>> 0 > f >>> 0) {
									m = g;
									n = 42;
									break a
								}
								o = g + 3 | 0;
								break
							}
							if ((k & 255) >= 245) {
								m = g;
								n = 42;
								break a
							}
							p = g;
							if ((h - p | 0) < 4) {
								m = g;
								n = 42;
								break a
							}
							q = a[g + 1 >> 0] | 0;
							r = a[g + 2 >> 0] | 0;
							v = a[g + 3 >> 0] | 0;
							switch (l | 0) {
								case 240:
									{
										if ((q + 112 & 255) >= 48) {
											w = p;
											n = 32;
											break b
										}
										break
									}
								case 244:
									{
										if ((q & -16) << 24 >> 24 != -128) {
											x = p;
											n = 34;
											break b
										}
										break
									}
								default:
									if ((q & -64) << 24 >> 24 != -128) {
										y = p;
										n = 36;
										break b
									}
							}
							p = r & 255;
							if ((p & 192 | 0) != 128) {
								m = g;
								n = 42;
								break a
							}
							r = v & 255;
							if ((r & 192 | 0) != 128) {
								m = g;
								n = 42;
								break a
							}
							if (((q & 255) << 12 & 258048 | l << 18 & 1835008 | p << 6 & 4032 | r & 63) >>> 0 > f >>> 0) {
								m = g;
								n = 42;
								break a
							}
							o = g + 4 | 0
						}
					while (0);
					j = j + 1 | 0;
					if (!(j >>> 0 < e >>> 0 & o >>> 0 < c >>> 0)) {
						m = o;
						n = 42;
						break a
					} else g = o
				}
				if ((n | 0) == 20) {
					z = s - b | 0;
					break
				} else if ((n | 0) == 22) {
					z = t - b | 0;
					break
				} else if ((n | 0) == 24) {
					z = u - b | 0;
					break
				} else if ((n | 0) == 32) {
					z = w - b | 0;
					break
				} else if ((n | 0) == 34) {
					z = x - b | 0;
					break
				} else if ((n | 0) == 36) {
					z = y - b | 0;
					break
				}
			} else {
				m = i;
				n = 42
			}
		while (0);
		if ((n | 0) == 42) z = m - b | 0;
		return z | 0
	}

	function Jo(a) {
		a = a | 0;
		Of(10844);
		Of(10832);
		Of(10820);
		Of(10808);
		Of(10796);
		Of(10784);
		Of(10772);
		Of(10760);
		Of(10748);
		Of(10736);
		Of(10724);
		Of(10712);
		Of(10700);
		Of(10688);
		return
	}

	function Ko(a) {
		a = a | 0;
		_f(11016);
		_f(11004);
		_f(10992);
		_f(10980);
		_f(10968);
		_f(10956);
		_f(10944);
		_f(10932);
		_f(10920);
		_f(10908);
		_f(10896);
		_f(10884);
		_f(10872);
		_f(10860);
		return
	}

	function Lo(a) {
		a = a | 0;
		Of(11648);
		Of(11636);
		Of(11624);
		Of(11612);
		Of(11600);
		Of(11588);
		Of(11576);
		Of(11564);
		Of(11552);
		Of(11540);
		Of(11528);
		Of(11516);
		Of(11504);
		Of(11492);
		Of(11480);
		Of(11468);
		Of(11456);
		Of(11444);
		Of(11432);
		Of(11420);
		Of(11408);
		Of(11396);
		Of(11384);
		Of(11372);
		return
	}

	function Mo(a) {
		a = a | 0;
		_f(11940);
		_f(11928);
		_f(11916);
		_f(11904);
		_f(11892);
		_f(11880);
		_f(11868);
		_f(11856);
		_f(11844);
		_f(11832);
		_f(11820);
		_f(11808);
		_f(11796);
		_f(11784);
		_f(11772);
		_f(11760);
		_f(11748);
		_f(11736);
		_f(11724);
		_f(11712);
		_f(11700);
		_f(11688);
		_f(11676);
		_f(11664);
		return
	}

	function No(a) {
		a = a | 0;
		Of(12752);
		Of(12740);
		Of(12728);
		Of(12716);
		Of(12704);
		Of(12692);
		Of(12680);
		Of(12668);
		Of(12656);
		Of(12644);
		Of(12632);
		Of(12620);
		Of(12608);
		Of(12596);
		Of(12584);
		Of(12572);
		Of(12560);
		Of(12548);
		Of(12536);
		Of(12524);
		Of(12512);
		Of(12500);
		Of(12488);
		Of(12476);
		return
	}

	function Oo(a) {
		a = a | 0;
		_f(13044);
		_f(13032);
		_f(13020);
		_f(13008);
		_f(12996);
		_f(12984);
		_f(12972);
		_f(12960);
		_f(12948);
		_f(12936);
		_f(12924);
		_f(12912);
		_f(12900);
		_f(12888);
		_f(12876);
		_f(12864);
		_f(12852);
		_f(12840);
		_f(12828);
		_f(12816);
		_f(12804);
		_f(12792);
		_f(12780);
		_f(12768);
		return
	}

	function Po(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0;
		d = i;
		i = i + 32 | 0;
		e = d;
		f = c[a + 8 >> 2] | 0;
		g = c[a + 4 >> 2] | 0;
		if (f - g >> 2 >>> 0 < b >>> 0) {
			h = c[a >> 2] | 0;
			j = g - h >> 2;
			g = j + b | 0;
			if (g >>> 0 > 1073741823) Bc(a);
			k = f - h | 0;
			if (k >> 2 >>> 0 < 536870911) {
				h = k >> 1;
				l = h >>> 0 < g >>> 0 ? g : h
			} else l = 1073741823;
			Ro(e, l, j, a + 16 | 0);
			j = e + 8 | 0;
			l = c[j >> 2] | 0;
			ip(l | 0, 0, b << 2 | 0) | 0;
			c[j >> 2] = l + (b << 2);
			So(a, e);
			To(e)
		} else Qo(a, b);
		i = d;
		return
	}

	function Qo(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0;
		d = a + 4 | 0;
		a = b;
		b = c[d >> 2] | 0;
		do {
			c[b >> 2] = 0;
			b = (c[d >> 2] | 0) + 4 | 0;
			c[d >> 2] = b;
			a = a + -1 | 0
		} while ((a | 0) != 0);
		return
	}

	function Ro(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0;
		c[b + 12 >> 2] = 0;
		c[b + 16 >> 2] = f;
		do
			if (d) {
				g = f + 112 | 0;
				if (d >>> 0 < 29 & (a[g >> 0] | 0) == 0) {
					a[g >> 0] = 1;
					h = f;
					break
				} else {
					h = Dc(d << 2) | 0;
					break
				}
			} else h = 0; while (0);
		c[b >> 2] = h;
		f = h + (e << 2) | 0;
		c[b + 8 >> 2] = f;
		c[b + 4 >> 2] = f;
		c[b + 12 >> 2] = h + (d << 2);
		return
	}

	function So(a, b) {
		a = a | 0;
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0;
		d = c[a >> 2] | 0;
		e = a + 4 | 0;
		f = b + 4 | 0;
		g = (c[e >> 2] | 0) - d | 0;
		h = (c[f >> 2] | 0) + (0 - (g >> 2) << 2) | 0;
		c[f >> 2] = h;
		lp(h | 0, d | 0, g | 0) | 0;
		g = c[a >> 2] | 0;
		c[a >> 2] = c[f >> 2];
		c[f >> 2] = g;
		g = b + 8 | 0;
		d = c[e >> 2] | 0;
		c[e >> 2] = c[g >> 2];
		c[g >> 2] = d;
		d = a + 8 | 0;
		a = b + 12 | 0;
		g = c[d >> 2] | 0;
		c[d >> 2] = c[a >> 2];
		c[a >> 2] = g;
		c[b >> 2] = c[f >> 2];
		return
	}

	function To(b) {
		b = b | 0;
		var d = 0,
			e = 0,
			f = 0,
			g = 0,
			h = 0;
		d = c[b + 4 >> 2] | 0;
		e = b + 8 | 0;
		f = c[e >> 2] | 0;
		if ((f | 0) != (d | 0)) {
			g = f;
			while (1) {
				f = g + -4 | 0;
				if ((f | 0) == (d | 0)) {
					h = f;
					break
				} else g = f
			}
			c[e >> 2] = h
		}
		h = c[b >> 2] | 0;
		do
			if (h) {
				e = c[b + 16 >> 2] | 0;
				if ((e | 0) == (h | 0)) {
					a[e + 112 >> 0] = 0;
					break
				} else {
					Fc(h);
					break
				}
			}
		while (0);
		return
	}

	function Uo(b, d) {
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		if (d >>> 0 > 1073741823) Bc(b);
		e = b + 128 | 0;
		if (d >>> 0 < 29 & (a[e >> 0] | 0) == 0) {
			a[e >> 0] = 1;
			f = b + 16 | 0
		} else f = Dc(d << 2) | 0;
		c[b + 4 >> 2] = f;
		c[b >> 2] = f;
		c[b + 8 >> 2] = f + (d << 2);
		return
	}

	function Vo(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0.0,
			k = 0,
			l = 0.0;
		e = i;
		i = i + 16 | 0;
		f = e;
		do
			if ((a | 0) != (b | 0)) {
				g = Bd() | 0;
				h = c[g >> 2] | 0;
				c[g >> 2] = 0;
				Wh() | 0;
				j = +Ie(a, f);
				k = c[g >> 2] | 0;
				if (!k) c[g >> 2] = h;
				if ((c[f >> 2] | 0) != (b | 0)) {
					c[d >> 2] = 4;
					l = 0.0;
					break
				}
				if ((k | 0) == 34) {
					c[d >> 2] = 4;
					l = j
				} else l = j
			} else {
				c[d >> 2] = 4;
				l = 0.0
			}
		while (0);
		i = e;
		return +l
	}

	function Wo(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			j = 0.0,
			k = 0,
			l = 0.0;
		e = i;
		i = i + 16 | 0;
		f = e;
		do
			if ((a | 0) != (b | 0)) {
				g = Bd() | 0;
				h = c[g >> 2] | 0;
				c[g >> 2] = 0;
				Wh() | 0;
				j = +Ie(a, f);
				k = c[g >> 2] | 0;
				if (!k) c[g >> 2] = h;
				if ((c[f >> 2] | 0) != (b | 0)) {
					c[d >> 2] = 4;
					l = 0.0;
					break
				}
				if ((k | 0) == 34) {
					c[d >> 2] = 4;
					l = j
				} else l = j
			} else {
				c[d >> 2] = 4;
				l = 0.0
			}
		while (0);
		i = e;
		return +l
	}

	function Xo(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0.0,
			h = 0,
			j = 0,
			k = 0.0,
			l = 0;
		e = i;
		i = i + 16 | 0;
		f = e;
		do
			if ((a | 0) == (b | 0)) {
				c[d >> 2] = 4;
				g = 0.0
			} else {
				h = Bd() | 0;
				j = c[h >> 2] | 0;
				c[h >> 2] = 0;
				Wh() | 0;
				k = +Ie(a, f);
				l = c[h >> 2] | 0;
				if (!l) c[h >> 2] = j;
				if ((c[f >> 2] | 0) != (b | 0)) {
					c[d >> 2] = 4;
					g = 0.0;
					break
				}
				if ((l | 0) == 34) c[d >> 2] = 4;
				g = k
			}
		while (0);
		i = e;
		return +g
	}

	function Yo(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		do
			if ((b | 0) != (d | 0)) {
				if ((a[b >> 0] | 0) == 45) {
					c[e >> 2] = 4;
					j = 0;
					k = 0;
					break
				}
				l = Bd() | 0;
				m = c[l >> 2] | 0;
				c[l >> 2] = 0;
				n = ud(b, h, f, Wh() | 0) | 0;
				o = c[l >> 2] | 0;
				if (!o) c[l >> 2] = m;
				if ((c[h >> 2] | 0) != (d | 0)) {
					c[e >> 2] = 4;
					j = 0;
					k = 0;
					break
				}
				if ((o | 0) == 34) {
					c[e >> 2] = 4;
					j = -1;
					k = -1
				} else {
					j = D;
					k = n
				}
			} else {
				c[e >> 2] = 4;
				j = 0;
				k = 0
			}
		while (0);
		D = j;
		i = g;
		return k | 0
	}

	function Zo(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		do
			if ((b | 0) != (d | 0)) {
				if ((a[b >> 0] | 0) == 45) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				k = Bd() | 0;
				l = c[k >> 2] | 0;
				c[k >> 2] = 0;
				m = ud(b, h, f, Wh() | 0) | 0;
				n = D;
				o = c[k >> 2] | 0;
				if (!o) c[k >> 2] = l;
				if ((c[h >> 2] | 0) != (d | 0)) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				if (n >>> 0 > 0 | (n | 0) == 0 & m >>> 0 > 4294967295 | (o | 0) == 34) {
					c[e >> 2] = 4;
					j = -1;
					break
				} else {
					j = m;
					break
				}
			} else {
				c[e >> 2] = 4;
				j = 0
			}
		while (0);
		i = g;
		return j | 0
	}

	function _o(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		do
			if ((b | 0) != (d | 0)) {
				if ((a[b >> 0] | 0) == 45) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				k = Bd() | 0;
				l = c[k >> 2] | 0;
				c[k >> 2] = 0;
				m = ud(b, h, f, Wh() | 0) | 0;
				n = D;
				o = c[k >> 2] | 0;
				if (!o) c[k >> 2] = l;
				if ((c[h >> 2] | 0) != (d | 0)) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				if (n >>> 0 > 0 | (n | 0) == 0 & m >>> 0 > 4294967295 | (o | 0) == 34) {
					c[e >> 2] = 4;
					j = -1;
					break
				} else {
					j = m;
					break
				}
			} else {
				c[e >> 2] = 4;
				j = 0
			}
		while (0);
		i = g;
		return j | 0
	}

	function $o(b, d, e, f) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		g = i;
		i = i + 16 | 0;
		h = g;
		do
			if ((b | 0) != (d | 0)) {
				if ((a[b >> 0] | 0) == 45) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				k = Bd() | 0;
				l = c[k >> 2] | 0;
				c[k >> 2] = 0;
				m = ud(b, h, f, Wh() | 0) | 0;
				n = D;
				o = c[k >> 2] | 0;
				if (!o) c[k >> 2] = l;
				if ((c[h >> 2] | 0) != (d | 0)) {
					c[e >> 2] = 4;
					j = 0;
					break
				}
				if (n >>> 0 > 0 | (n | 0) == 0 & m >>> 0 > 65535 | (o | 0) == 34) {
					c[e >> 2] = 4;
					j = -1;
					break
				} else {
					j = m & 65535;
					break
				}
			} else {
				c[e >> 2] = 4;
				j = 0
			}
		while (0);
		i = g;
		return j | 0
	}

	function ap(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		do
			if ((a | 0) != (b | 0)) {
				h = Bd() | 0;
				j = c[h >> 2] | 0;
				c[h >> 2] = 0;
				k = vd(a, g, e, Wh() | 0) | 0;
				l = D;
				m = c[h >> 2] | 0;
				if (!m) c[h >> 2] = j;
				if ((c[g >> 2] | 0) != (b | 0)) {
					c[d >> 2] = 4;
					n = 0;
					o = 0;
					break
				}
				if ((m | 0) == 34) {
					c[d >> 2] = 4;
					m = (l | 0) > 0 | (l | 0) == 0 & k >>> 0 > 0;
					D = m ? 2147483647 : -2147483648;
					i = f;
					return (m ? -1 : 0) | 0
				} else {
					n = l;
					o = k
				}
			} else {
				c[d >> 2] = 4;
				n = 0;
				o = 0
			}
		while (0);
		D = n;
		i = f;
		return o | 0
	}

	function bp(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0;
		f = i;
		i = i + 16 | 0;
		g = f;
		a: do
			if ((a | 0) == (b | 0)) {
				c[d >> 2] = 4;
				h = 0
			} else {
				j = Bd() | 0;
				k = c[j >> 2] | 0;
				c[j >> 2] = 0;
				l = vd(a, g, e, Wh() | 0) | 0;
				m = D;
				n = c[j >> 2] | 0;
				if (!n) c[j >> 2] = k;
				if ((c[g >> 2] | 0) != (b | 0)) {
					c[d >> 2] = 4;
					h = 0;
					break
				}
				do
					if ((n | 0) == 34) {
						c[d >> 2] = 4;
						if ((m | 0) > 0 | (m | 0) == 0 & l >>> 0 > 0) {
							h = 2147483647;
							break a
						}
					} else {
						if ((m | 0) < -1 | (m | 0) == -1 & l >>> 0 < 2147483648) {
							c[d >> 2] = 4;
							break
						}
						if ((m | 0) > 0 | (m | 0) == 0 & l >>> 0 > 2147483647) {
							c[d >> 2] = 4;
							h = 2147483647;
							break a
						} else {
							h = l;
							break a
						}
					}
				while (0);
				h = -2147483648
			}
		while (0);
		i = f;
		return h | 0
	}

	function cp(a) {
		a = a | 0;
		return
	}

	function dp(a) {
		a = a | 0;
		var b = 0;
		b = a + 4 | 0;
		c[b >> 2] = (c[b >> 2] | 0) + 1;
		return
	}

	function ep(a) {
		a = a | 0;
		var b = 0,
			d = 0,
			e = 0;
		b = a + 4 | 0;
		d = c[b >> 2] | 0;
		c[b >> 2] = d + -1;
		if (!d) {
			tb[c[(c[a >> 2] | 0) + 8 >> 2] & 127](a);
			e = 1
		} else e = 0;
		return e | 0
	}

	function fp(a, b, d) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		ib(13384) | 0;
		if ((c[a >> 2] | 0) == 1)
			do xa(13412, 13384) | 0; while ((c[a >> 2] | 0) == 1);
		if (!(c[a >> 2] | 0)) {
			c[a >> 2] = 1;
			Ua(13384) | 0;
			tb[d & 127](b);
			ib(13384) | 0;
			c[a >> 2] = -1;
			Ua(13384) | 0;
			Za(13412) | 0
		} else Ua(13384) | 0;
		return
	}

	function gp() {}

	function hp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0;
		e = b - d >>> 0;
		e = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0;
		return (D = e, a - c >>> 0 | 0) | 0
	}

	function ip(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			i = 0;
		f = b + e | 0;
		if ((e | 0) >= 20) {
			d = d & 255;
			g = b & 3;
			h = d | d << 8 | d << 16 | d << 24;
			i = f & ~3;
			if (g) {
				g = b + 4 - g | 0;
				while ((b | 0) < (g | 0)) {
					a[b >> 0] = d;
					b = b + 1 | 0
				}
			}
			while ((b | 0) < (i | 0)) {
				c[b >> 2] = h;
				b = b + 4 | 0
			}
		}
		while ((b | 0) < (f | 0)) {
			a[b >> 0] = d;
			b = b + 1 | 0
		}
		return b - e | 0
	}

	function jp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0;
		e = a + c >>> 0;
		return (D = b + d + (e >>> 0 < a >>> 0 | 0) >>> 0, e | 0) | 0
	}

	function kp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		if ((c | 0) < 32) {
			D = b >>> c;
			return a >>> c | (b & (1 << c) - 1) << 32 - c
		}
		D = 0;
		return b >>> c - 32 | 0
	}

	function lp(b, d, e) {
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0;
		if ((e | 0) >= 4096) return Na(b | 0, d | 0, e | 0) | 0;
		f = b | 0;
		if ((b & 3) == (d & 3)) {
			while (b & 3) {
				if (!e) return f | 0;
				a[b >> 0] = a[d >> 0] | 0;
				b = b + 1 | 0;
				d = d + 1 | 0;
				e = e - 1 | 0
			}
			while ((e | 0) >= 4) {
				c[b >> 2] = c[d >> 2];
				b = b + 4 | 0;
				d = d + 4 | 0;
				e = e - 4 | 0
			}
		}
		while ((e | 0) > 0) {
			a[b >> 0] = a[d >> 0] | 0;
			b = b + 1 | 0;
			d = d + 1 | 0;
			e = e - 1 | 0
		}
		return f | 0
	}

	function mp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		if ((c | 0) < 32) {
			D = b << c | (a & (1 << c) - 1 << 32 - c) >>> 32 - c;
			return a << c
		}
		D = a << c - 32;
		return 0
	}

	function np(b, c, d) {
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0;
		if ((c | 0) < (b | 0) & (b | 0) < (c + d | 0)) {
			e = b;
			c = c + d | 0;
			b = b + d | 0;
			while ((d | 0) > 0) {
				b = b - 1 | 0;
				c = c - 1 | 0;
				d = d - 1 | 0;
				a[b >> 0] = a[c >> 0] | 0
			}
			b = e
		} else lp(b, c, d) | 0;
		return b | 0
	}

	function op(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		if ((c | 0) < 32) {
			D = b >> c;
			return a >>> c | (b & (1 << c) - 1) << 32 - c
		}
		D = (b | 0) < 0 ? -1 : 0;
		return b >> c - 32 | 0
	}

	function pp(b) {
		b = b | 0;
		var c = 0;
		c = a[m + (b & 255) >> 0] | 0;
		if ((c | 0) < 8) return c | 0;
		c = a[m + (b >> 8 & 255) >> 0] | 0;
		if ((c | 0) < 8) return c + 8 | 0;
		c = a[m + (b >> 16 & 255) >> 0] | 0;
		if ((c | 0) < 8) return c + 16 | 0;
		return (a[m + (b >>> 24) >> 0] | 0) + 24 | 0
	}

	function qp(a, b) {
		a = a | 0;
		b = b | 0;
		var c = 0,
			d = 0,
			e = 0,
			f = 0;
		c = a & 65535;
		d = b & 65535;
		e = $(d, c) | 0;
		f = a >>> 16;
		a = (e >>> 16) + ($(d, f) | 0) | 0;
		d = b >>> 16;
		b = $(d, c) | 0;
		return (D = (a >>> 16) + ($(d, f) | 0) + (((a & 65535) + b | 0) >>> 16) | 0, a + b << 16 | e & 65535 | 0) | 0
	}

	function rp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0,
			f = 0,
			g = 0,
			h = 0,
			i = 0;
		e = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
		f = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
		g = d >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
		h = ((d | 0) < 0 ? -1 : 0) >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
		i = hp(e ^ a, f ^ b, e, f) | 0;
		b = D;
		a = g ^ e;
		e = h ^ f;
		return hp((wp(i, b, hp(g ^ c, h ^ d, g, h) | 0, D, 0) | 0) ^ a, D ^ e, a, e) | 0
	}

	function sp(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0,
			h = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0;
		f = i;
		i = i + 16 | 0;
		g = f | 0;
		h = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
		j = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
		k = e >> 31 | ((e | 0) < 0 ? -1 : 0) << 1;
		l = ((e | 0) < 0 ? -1 : 0) >> 31 | ((e | 0) < 0 ? -1 : 0) << 1;
		m = hp(h ^ a, j ^ b, h, j) | 0;
		b = D;
		wp(m, b, hp(k ^ d, l ^ e, k, l) | 0, D, g) | 0;
		l = hp(c[g >> 2] ^ h, c[g + 4 >> 2] ^ j, h, j) | 0;
		j = D;
		i = f;
		return (D = j, l) | 0
	}

	function tp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		var e = 0,
			f = 0;
		e = a;
		a = c;
		c = qp(e, a) | 0;
		f = D;
		return (D = ($(b, a) | 0) + ($(d, e) | 0) + f | f & 0, c | 0 | 0) | 0
	}

	function up(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		return wp(a, b, c, d, 0) | 0
	}

	function vp(a, b, d, e) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		var f = 0,
			g = 0;
		f = i;
		i = i + 16 | 0;
		g = f | 0;
		wp(a, b, d, e, g) | 0;
		i = f;
		return (D = c[g + 4 >> 2] | 0, c[g >> 2] | 0) | 0
	}

	function wp(a, b, d, e, f) {
		a = a | 0;
		b = b | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		var g = 0,
			h = 0,
			i = 0,
			j = 0,
			k = 0,
			l = 0,
			m = 0,
			n = 0,
			o = 0,
			p = 0,
			q = 0,
			r = 0,
			s = 0,
			t = 0,
			u = 0,
			v = 0,
			w = 0,
			x = 0,
			y = 0,
			z = 0,
			A = 0,
			B = 0,
			C = 0,
			E = 0,
			F = 0,
			G = 0,
			H = 0;
		g = a;
		h = b;
		i = h;
		j = d;
		k = e;
		l = k;
		if (!i) {
			m = (f | 0) != 0;
			if (!l) {
				if (m) {
					c[f >> 2] = (g >>> 0) % (j >>> 0);
					c[f + 4 >> 2] = 0
				}
				n = 0;
				o = (g >>> 0) / (j >>> 0) >>> 0;
				return (D = n, o) | 0
			} else {
				if (!m) {
					n = 0;
					o = 0;
					return (D = n, o) | 0
				}
				c[f >> 2] = a | 0;
				c[f + 4 >> 2] = b & 0;
				n = 0;
				o = 0;
				return (D = n, o) | 0
			}
		}
		m = (l | 0) == 0;
		do
			if (j) {
				if (!m) {
					p = (ba(l | 0) | 0) - (ba(i | 0) | 0) | 0;
					if (p >>> 0 <= 31) {
						q = p + 1 | 0;
						r = 31 - p | 0;
						s = p - 31 >> 31;
						t = q;
						u = g >>> (q >>> 0) & s | i << r;
						v = i >>> (q >>> 0) & s;
						w = 0;
						x = g << r;
						break
					}
					if (!f) {
						n = 0;
						o = 0;
						return (D = n, o) | 0
					}
					c[f >> 2] = a | 0;
					c[f + 4 >> 2] = h | b & 0;
					n = 0;
					o = 0;
					return (D = n, o) | 0
				}
				r = j - 1 | 0;
				if (r & j) {
					s = (ba(j | 0) | 0) + 33 - (ba(i | 0) | 0) | 0;
					q = 64 - s | 0;
					p = 32 - s | 0;
					y = p >> 31;
					z = s - 32 | 0;
					A = z >> 31;
					t = s;
					u = p - 1 >> 31 & i >>> (z >>> 0) | (i << p | g >>> (s >>> 0)) & A;
					v = A & i >>> (s >>> 0);
					w = g << q & y;
					x = (i << q | g >>> (z >>> 0)) & y | g << p & s - 33 >> 31;
					break
				}
				if (f) {
					c[f >> 2] = r & g;
					c[f + 4 >> 2] = 0
				}
				if ((j | 0) == 1) {
					n = h | b & 0;
					o = a | 0 | 0;
					return (D = n, o) | 0
				} else {
					r = pp(j | 0) | 0;
					n = i >>> (r >>> 0) | 0;
					o = i << 32 - r | g >>> (r >>> 0) | 0;
					return (D = n, o) | 0
				}
			} else {
				if (m) {
					if (f) {
						c[f >> 2] = (i >>> 0) % (j >>> 0);
						c[f + 4 >> 2] = 0
					}
					n = 0;
					o = (i >>> 0) / (j >>> 0) >>> 0;
					return (D = n, o) | 0
				}
				if (!g) {
					if (f) {
						c[f >> 2] = 0;
						c[f + 4 >> 2] = (i >>> 0) % (l >>> 0)
					}
					n = 0;
					o = (i >>> 0) / (l >>> 0) >>> 0;
					return (D = n, o) | 0
				}
				r = l - 1 | 0;
				if (!(r & l)) {
					if (f) {
						c[f >> 2] = a | 0;
						c[f + 4 >> 2] = r & i | b & 0
					}
					n = 0;
					o = i >>> ((pp(l | 0) | 0) >>> 0);
					return (D = n, o) | 0
				}
				r = (ba(l | 0) | 0) - (ba(i | 0) | 0) | 0;
				if (r >>> 0 <= 30) {
					s = r + 1 | 0;
					p = 31 - r | 0;
					t = s;
					u = i << p | g >>> (s >>> 0);
					v = i >>> (s >>> 0);
					w = 0;
					x = g << p;
					break
				}
				if (!f) {
					n = 0;
					o = 0;
					return (D = n, o) | 0
				}
				c[f >> 2] = a | 0;
				c[f + 4 >> 2] = h | b & 0;
				n = 0;
				o = 0;
				return (D = n, o) | 0
			}
		while (0);
		if (!t) {
			B = x;
			C = w;
			E = v;
			F = u;
			G = 0;
			H = 0
		} else {
			b = d | 0 | 0;
			d = k | e & 0;
			e = jp(b | 0, d | 0, -1, -1) | 0;
			k = D;
			h = x;
			x = w;
			w = v;
			v = u;
			u = t;
			t = 0;
			do {
				a = h;
				h = x >>> 31 | h << 1;
				x = t | x << 1;
				g = v << 1 | a >>> 31 | 0;
				a = v >>> 31 | w << 1 | 0;
				hp(e, k, g, a) | 0;
				i = D;
				l = i >> 31 | ((i | 0) < 0 ? -1 : 0) << 1;
				t = l & 1;
				v = hp(g, a, l & b, (((i | 0) < 0 ? -1 : 0) >> 31 | ((i | 0) < 0 ? -1 : 0) << 1) & d) | 0;
				w = D;
				u = u - 1 | 0
			} while ((u | 0) != 0);
			B = h;
			C = x;
			E = w;
			F = v;
			G = 0;
			H = t
		}
		t = C;
		C = 0;
		if (f) {
			c[f >> 2] = F;
			c[f + 4 >> 2] = E
		}
		n = (t | 0) >>> 31 | (B | C) << 1 | (C << 1 | t >>> 31) & 0 | G;
		o = (t << 1 | 0 >>> 31) & -2 | H;
		return (D = n, o) | 0
	}

	function xp(a, b, c, d, e, f, g, h) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		return pb[a & 7](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0) | 0
	}

	function yp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		return qb[a & 31](b | 0, c | 0, d | 0) | 0
	}

	function zp(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		rb[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0)
	}

	function Ap(a, b, c, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = +g;
		return sb[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0, +g) | 0
	}

	function Bp(a, b) {
		a = a | 0;
		b = b | 0;
		tb[a & 127](b | 0)
	}

	function Cp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		ub[a & 63](b | 0, c | 0)
	}

	function Dp(a, b, c, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		return vb[a & 63](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0) | 0
	}

	function Ep(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		return wb[a & 7](b | 0, c | 0, d | 0, e | 0, +f) | 0
	}

	function Fp(a, b) {
		a = a | 0;
		b = b | 0;
		return xb[a & 63](b | 0) | 0
	}

	function Gp(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		yb[a & 0](b | 0, c | 0, d | 0)
	}

	function Hp(a) {
		a = a | 0;
		zb[a & 3]()
	}

	function Ip(a, b, c, d, e, f, g, h, i) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		i = i | 0;
		return Ab[a & 15](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0) | 0
	}

	function Jp(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		return Bb[a & 7](b | 0, c | 0, d | 0, e | 0) | 0
	}

	function Kp(a, b, c, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		Cb[a & 15](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0)
	}

	function Lp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		return Db[a & 31](b | 0, c | 0) | 0
	}

	function Mp(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		return Eb[a & 31](b | 0, c | 0, d | 0, e | 0, f | 0) | 0
	}

	function Np(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		Fb[a & 15](b | 0, c | 0, d | 0, e | 0)
	}

	function Op(a, b, c, d, e, f, g) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		ca(0);
		return 0
	}

	function Pp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		ca(1);
		return 0
	}

	function Qp(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		ca(2)
	}

	function Rp(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = +f;
		ca(3);
		return 0
	}

	function Sp(a) {
		a = a | 0;
		ca(4)
	}

	function Tp(a, b) {
		a = a | 0;
		b = b | 0;
		ca(5)
	}

	function Up(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		ca(6);
		return 0
	}

	function Vp(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = +e;
		ca(7);
		return 0
	}

	function Wp(a) {
		a = a | 0;
		ca(8);
		return 0
	}

	function Xp(a, b, c) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		ca(9)
	}

	function Yp() {
		ca(10)
	}

	function Zp(a, b, c, d, e, f, g, h) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		g = g | 0;
		h = h | 0;
		ca(11);
		return 0
	}

	function _p(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		ca(12);
		return 0
	}

	function $p(a, b, c, d, e, f) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		f = f | 0;
		ca(13)
	}

	function aq(a, b) {
		a = a | 0;
		b = b | 0;
		ca(14);
		return 0
	}

	function bq(a, b, c, d, e) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		e = e | 0;
		ca(15);
		return 0
	}

	function cq(a, b, c, d) {
		a = a | 0;
		b = b | 0;
		c = c | 0;
		d = d | 0;
		ca(16)
	}

	// EMSCRIPTEN_END_FUNCS
	var pb = [Op, Pj, Tj, Nk, Rk, Wk, Yk, Op];
	var qb = [Pp, sg, xg, Bg, Wc, df, oe, ne, me, pe, Hg, Mg, sf, Qg, Df, Ch, Hh, ml, rl, $l, bm, em, Ll, Ql, Sl, Vl, af, Pp, Pp, Pp, Pp, Pp];
	var rb = [Qp, gd, fd, cd];
	var sb = [Rp, al, gl, Rp];
	var tb = [Sp, kc, lc, mc, nc, oc, pc, Sg, Ug, Tg, Vg, dc, ec, ph, sh, qh, th, rh, uh, ah, ch, bh, dh, Ic, Jc, Qc, Tc, Rc, Sc, Uc, Vc, Dg, pf, vf, og, Af, Gf, pg, Eg, Xg, Zg, Yg, _g, ih, kh, jh, lh, jg, vh, xh, zh, Il, Dh, Eh, Ih, Jh, Xh, Yh, pi, qi, Ei, Fi, Ri, Si, oj, pj, Mj, Oj, Rj, Sj, Vj, Wj, ek, fk, pk, qk, Ak, Bk, Lk, Mk, Uk, Vk, _k, $k, el, fl, kl, ll, pl, ql, xl, yl, Yl, Zl, sn, om, Qm, Rm, Sm, Tm, yh, Hl, Kl, gm, wm, Em, Mm, Nm, pd, Ye, Ze, jf, Ok, Jl, Co, Jo, Ko, Lo, Mo, No, Oo, Of, _f, rd, Sp, Sp, Sp, Sp];
	var ub = [Tp, rg, qf, uf, Bf, Ff, Gg, Zj, _j, $j, ak, ck, dk, ik, jk, kk, lk, nk, ok, tk, uk, vk, wk, yk, zk, Ek, Fk, Gk, Hk, Jk, Kk, ol, tl, Ym, _m, an, Zm, $m, bn, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp, Tp];
	var vb = [Up, Kh, Lh, Mh, Nh, Oh, Ph, Qh, Rh, Sh, Th, Uh, Zh, _h, $h, ai, bi, ci, di, ei, fi, gi, hi, wi, yi, Ji, Li, Ui, Vi, Wi, Yi, _i, rj, sj, tj, vj, xj, dl, jl, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up, Up];
	var wb = [Vp, zi, Ci, Mi, Oi, Vp, Vp, Vp];
	var xb = [Wp, vg, wg, hc, zg, Kc, le, rf, Lg, Ng, Og, Kg, wf, xf, Cf, yg, Hf, If, Ti, dn, fn, hn, on, qn, kn, mn, qj, en, gn, jn, pn, rn, ln, nn, Xj, Yj, bk, gk, hk, mk, rk, sk, xk, Ck, Dk, Ik, sm, tm, vm, Um, Wm, Vm, Xm, km, lm, nm, Am, Bm, Dm, Im, Jm, Lm, Wp, Wp];
	var yb = [Xp];
	var zb = [Yp, nd, od, Yp];
	var Ab = [Zp, aj, zj, pm, qm, hm, im, xm, ym, Fm, Gm, Zp, Zp, Zp, Zp, Zp];
	var Bb = [_p, dm, Ml, Nl, Ol, Ul, _p, _p];
	var Cb = [$p, fc, jd, id, hd, Ig, tg, nl, sl, $p, $p, $p, $p, $p, $p, $p];
	var Db = [aq, ic, jc, Pg, tf, yf, Rg, Ag, Ef, Jf, Cg, _l, am, cm, Pl, Rl, Tl, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq, aq];
	var Eb = [bq, Ah, Fh, ri, si, xi, Di, Gi, Hi, Ki, Pi, fm, rm, um, Wl, jm, mm, zm, Cm, Hm, Km, bq, bq, bq, bq, bq, bq, bq, bq, bq, bq, bq];
	var Fb = [cq, gc, Yc, Zc, $c, Jg, ug, Bh, Gh, cq, cq, cq, cq, cq, cq, cq];
	return {
		___cxa_can_catch: kd,
		_free: rd,
		___cxa_is_pointer_type: ld,
		_i64Add: jp,
		_memmove: np,
		_grabCut: Rb,
		_i64Subtract: hp,
		_memset: ip,
		_malloc: qd,
		_memcpy: lp,
		_bitshift64Lshr: kp,
		_fflush: ue,
		___errno_location: Bd,
		_bitshift64Shl: mp,
		__GLOBAL__sub_I_iostream_cpp: of ,
		runPostSets: gp,
		stackAlloc: Gb,
		stackSave: Hb,
		stackRestore: Ib,
		establishStackSpace: Jb,
		setThrew: Kb,
		setTempRet0: Nb,
		getTempRet0: Ob,
		dynCall_iiiiiiii: xp,
		dynCall_iiii: yp,
		dynCall_viiiii: zp,
		dynCall_iiiiiid: Ap,
		dynCall_vi: Bp,
		dynCall_vii: Cp,
		dynCall_iiiiiii: Dp,
		dynCall_iiiiid: Ep,
		dynCall_ii: Fp,
		dynCall_viii: Gp,
		dynCall_v: Hp,
		dynCall_iiiiiiiii: Ip,
		dynCall_iiiii: Jp,
		dynCall_viiiiii: Kp,
		dynCall_iii: Lp,
		dynCall_iiiiii: Mp,
		dynCall_viiii: Np
	}
})


// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _grabCut = Module["_grabCut"] = asm["_grabCut"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var __GLOBAL__sub_I_iostream_cpp = Module["__GLOBAL__sub_I_iostream_cpp"] = asm["__GLOBAL__sub_I_iostream_cpp"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = asm["dynCall_iiiiiid"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_iiiiid = Module["dynCall_iiiiid"] = asm["dynCall_iiiiid"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
Runtime.stackAlloc = asm["stackAlloc"];
Runtime.stackSave = asm["stackSave"];
Runtime.stackRestore = asm["stackRestore"];
Runtime.establishStackSpace = asm["establishStackSpace"];
Runtime.setTempRet0 = asm["setTempRet0"];
Runtime.getTempRet0 = asm["getTempRet0"];
if (memoryInitializer) {
	if (typeof Module["locateFile"] === "function") {
		memoryInitializer = Module["locateFile"](memoryInitializer)
	} else if (Module["memoryInitializerPrefixURL"]) {
		memoryInitializer = Module["memoryInitializerPrefixURL"] + memoryInitializer
	}
	if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
		var data = Module["readBinary"](memoryInitializer);
		HEAPU8.set(data, Runtime.GLOBAL_BASE)
	} else {
		addRunDependency("memory initializer");
		var applyMemoryInitializer = (function (data) {
			if (data.byteLength) data = new Uint8Array(data);
			HEAPU8.set(data, Runtime.GLOBAL_BASE);
			removeRunDependency("memory initializer")
		});
		var request = Module["memoryInitializerRequest"];
		if (request) {
			if (request.response) {
				setTimeout((function () {
					applyMemoryInitializer(request.response)
				}), 0)
			} else {
				request.addEventListener("load", (function () {
					if (request.status !== 200 && request.status !== 0) {
						console.warn("a problem seems to have happened with Module.memoryInitializerRequest, status: " + request.status)
					}
					if (!request.response || typeof request.response !== "object" || !request.response.byteLength) {
						console.warn("a problem seems to have happened with Module.memoryInitializerRequest response (expected ArrayBuffer): " + request.response)
					}
					applyMemoryInitializer(request.response)
				}))
			}
		} else {
			Browser.asyncLoad(memoryInitializer, applyMemoryInitializer, (function () {
				throw "could not load memory initializer " + memoryInitializer
			}))
		}
	}
}

function ExitStatus(status) {
	this.name = "ExitStatus";
	this.message = "Program terminated with exit(" + status + ")";
	this.status = status
}
ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;
var initialStackTop;
var preloadStartTime = null;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
	if (!Module["calledRun"]) run();
	if (!Module["calledRun"]) dependenciesFulfilled = runCaller
};
Module["callMain"] = Module.callMain = function callMain(args) {
	assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
	assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
	args = args || [];
	ensureInitRuntime();
	var argc = args.length + 1;

	function pad() {
		for (var i = 0; i < 4 - 1; i++) {
			argv.push(0)
		}
	}
	var argv = [allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL)];
	pad();
	for (var i = 0; i < argc - 1; i = i + 1) {
		argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_NORMAL));
		pad()
	}
	argv.push(0);
	argv = allocate(argv, "i32", ALLOC_NORMAL);
	initialStackTop = Runtime.stackSave();
	try {
		var ret = Module["_main"](argc, argv, 0);
		exit(ret, true)
	} catch (e) {
		if (e instanceof ExitStatus) {
			return
		} else if (e == "SimulateInfiniteLoop") {
			Module["noExitRuntime"] = true;
			Runtime.stackRestore(initialStackTop);
			return
		} else {
			if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [e, e.stack]);
			throw e
		}
	} finally {
		calledMain = true
	}
};

function run(args) {
	args = args || Module["arguments"];
	if (preloadStartTime === null) preloadStartTime = Date.now();
	if (runDependencies > 0) {
		return
	}
	preRun();
	if (runDependencies > 0) return;
	if (Module["calledRun"]) return;

	function doRun() {
		if (Module["calledRun"]) return;
		Module["calledRun"] = true;
		if (ABORT) return;
		ensureInitRuntime();
		preMain();
		if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
			Module.printErr("pre-main prep time: " + (Date.now() - preloadStartTime) + " ms")
		}
		if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
		if (Module["_main"] && shouldRunNow) Module["callMain"](args);
		postRun()
	}
	if (Module["setStatus"]) {
		Module["setStatus"]("Running...");
		setTimeout((function () {
			setTimeout((function () {
				Module["setStatus"]("")
			}), 1);
			doRun()
		}), 1)
	} else {
		doRun()
	}
}
Module["run"] = Module.run = run;

function exit(status, implicit) {
	if (implicit && Module["noExitRuntime"]) {
		return
	}
	if (Module["noExitRuntime"]) {} else {
		ABORT = true;
		EXITSTATUS = status;
		STACKTOP = initialStackTop;
		exitRuntime();
		if (Module["onExit"]) Module["onExit"](status)
	}
	if (ENVIRONMENT_IS_NODE) {
		process["stdout"]["once"]("drain", (function () {
			process["exit"](status)
		}));
		console.log(" ");
		setTimeout((function () {
			process["exit"](status)
		}), 500)
	} else if (ENVIRONMENT_IS_SHELL && typeof quit === "function") {
		quit(status)
	}
	throw new ExitStatus(status)
}
Module["exit"] = Module.exit = exit;
var abortDecorators = [];

function abort(what) {
	if (what !== undefined) {
		Module.print(what);
		Module.printErr(what);
		what = JSON.stringify(what)
	} else {
		what = ""
	}
	ABORT = true;
	EXITSTATUS = 1;
	var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
	var output = "abort(" + what + ") at " + stackTrace() + extra;
	if (abortDecorators) {
		abortDecorators.forEach((function (decorator) {
			output = decorator(output, what)
		}))
	}
	throw output
}
Module["abort"] = Module.abort = abort;
if (Module["preInit"]) {
	if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
	while (Module["preInit"].length > 0) {
		Module["preInit"].pop()()
	}
}
var shouldRunNow = true;
if (Module["noInitialRun"]) {
	shouldRunNow = false
}
run()