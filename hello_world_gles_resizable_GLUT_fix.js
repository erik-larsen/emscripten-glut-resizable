// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    err('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WEB) {
    if (document.currentScript) {
      scriptDirectory = document.currentScript.src;
    }
  } else { // worker
    scriptDirectory = self.location.href;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.split('/').slice(0, -1).join('/') + '/';
  } else {
    scriptDirectory = '';
  }


  Module['read'] = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// *** Environment setup code ***

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

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
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 5776;
/* global initializers */  __ATINIT__.push();


memoryInitializer = "data:application/octet-stream;base64,AAAAAAAAAADNzEw/zczMPQAAAAAAAIA/AAAAAM3MTD/NzEw+AACAP83MTD7NzEw+AACAPwAAgD9hdHRyaWJ1dGUgdmVjMyBwb3NpdGlvbjsKYXR0cmlidXRlIHZlYzMgbm9ybWFsOwoKdW5pZm9ybSBtYXQ0IE1vZGVsVmlld1Byb2plY3Rpb25NYXRyaXg7CnVuaWZvcm0gbWF0NCBOb3JtYWxNYXRyaXg7CnVuaWZvcm0gdmVjNCBMaWdodFNvdXJjZVBvc2l0aW9uOwp1bmlmb3JtIHZlYzQgTWF0ZXJpYWxDb2xvcjsKCnZhcnlpbmcgdmVjNCBDb2xvcjsKCnZvaWQgbWFpbih2b2lkKQp7CiAgICAvLyBUcmFuc2Zvcm0gdGhlIG5vcm1hbCB0byBleWUgY29vcmRpbmF0ZXMKICAgIHZlYzMgTiA9IG5vcm1hbGl6ZSh2ZWMzKE5vcm1hbE1hdHJpeCAqIHZlYzQobm9ybWFsLCAxLjApKSk7CgogICAgLy8gVGhlIExpZ2h0U291cmNlUG9zaXRpb24gaXMgYWN0dWFsbHkgaXRzIGRpcmVjdGlvbiBmb3IgZGlyZWN0aW9uYWwgbGlnaHQKICAgIHZlYzMgTCA9IG5vcm1hbGl6ZShMaWdodFNvdXJjZVBvc2l0aW9uLnh5eik7CgogICAgLy8gTXVsdGlwbHkgdGhlIGRpZmZ1c2UgdmFsdWUgYnkgdGhlIHZlcnRleCBjb2xvciAod2hpY2ggaXMgZml4ZWQgaW4gdGhpcyBjYXNlKQogICAgLy8gdG8gZ2V0IHRoZSBhY3R1YWwgY29sb3IgdGhhdCB3ZSB3aWxsIHVzZSB0byBkcmF3IHRoaXMgdmVydGV4IHdpdGgKICAgIGZsb2F0IGRpZmZ1c2UgPSBtYXgoZG90KE4sIEwpLCAwLjApOwogICAgQ29sb3IgPSBkaWZmdXNlICogTWF0ZXJpYWxDb2xvcjsKCiAgICAvLyBUcmFuc2Zvcm0gdGhlIHBvc2l0aW9uIHRvIGNsaXAgY29vcmRpbmF0ZXMKICAgIGdsX1Bvc2l0aW9uID0gTW9kZWxWaWV3UHJvamVjdGlvbk1hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7Cn0AAAAjaWZkZWYgR0xfRVMKcHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7CiNlbmRpZgp2YXJ5aW5nIHZlYzQgQ29sb3I7Cgp2b2lkIG1haW4odm9pZCkKewogICAgZ2xfRnJhZ0NvbG9yID0gQ29sb3I7Cn0AAACgQAAAoEAAACBBAACAPxEACgAREREAAAAABQAAAAAAAAkAAAAACwAAAAAAAAAAEQAPChEREQMKBwABEwkLCwAACQYLAAALAAYRAAAAERERAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAABEACgoREREACgAAAgAJCwAAAAkACwAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAwAAAAACQwAAAAAAAwAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAADQAAAAQNAAAAAAkOAAAAAAAOAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA8AAAAADwAAAAAJEAAAAAAAEAAAEAAAEgAAABISEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAEhISAAAAAAAACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAAAAAAAAAAACgAAAAAKAAAAAAkLAAAAAAALAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAADAAAAAAJDAAAAAAADAAADAAAMDEyMzQ1Njc4OUFCQ0RFRlQhIhkNAQIDEUscDBAECx0SHidobm9wcWIgBQYPExQVGggWBygkFxgJCg4bHyUjg4J9JiorPD0+P0NHSk1YWVpbXF1eX2BhY2RlZmdpamtscnN0eXp7fAAAAAAAAAAAAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIGRvd24ASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBCbG9jayBkZXZpY2UgcmVxdWlyZWQATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABEZXZpY2Ugbm90IGEgc3RyZWFtAE5vIGRhdGEgYXZhaWxhYmxlAERldmljZSB0aW1lb3V0AE91dCBvZiBzdHJlYW1zIHJlc291cmNlcwBMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UARmlsZSBkZXNjcmlwdG9yIGluIGJhZCBzdGF0ZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAFNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABQcm90b2NvbCBmYW1pbHkgbm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABDYW5ub3Qgc2VuZCBhZnRlciBzb2NrZXQgc2h1dGRvd24AT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFJlbW90ZSBJL08gZXJyb3IAUXVvdGEgZXhjZWVkZWQATm8gbWVkaXVtIGZvdW5kAFdyb25nIG1lZGl1bSB0eXBlAE5vIGVycm9yIGluZm9ybWF0aW9uAAAAAAAAAAAAAAAA8L8AAAAAAADwv1QNAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAwAAABgQAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXBYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKBBAADwQWVzMmdlYXJzACVkIGZyYW1lcyBpbiAlMy4xZiBzZWNvbmRzID0gJTYuM2YgRlBTCgB2ZXJ0ZXggc2hhZGVyIGluZm86ICVzCgBmcmFnbWVudCBzaGFkZXIgaW5mbzogJXMKAHBvc2l0aW9uAG5vcm1hbABpbmZvOiAlcwoATW9kZWxWaWV3UHJvamVjdGlvbk1hdHJpeABOb3JtYWxNYXRyaXgATGlnaHRTb3VyY2VQb3NpdGlvbgBNYXRlcmlhbENvbG9yAC0rICAgMFgweAAobnVsbCkALTBYKzBYIDBYLTB4KzB4IDB4AGluZgBJTkYAbmFuAE5BTgAu";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
    

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
   
  
   
  
     

  function ___unlock() {}

   

   

  
  var GL={counter:1,lastError:0,buffers:[],mappedBuffers:{},programs:[],framebuffers:[],renderbuffers:[],textures:[],uniforms:[],shaders:[],vaos:[],contexts:[],currentContext:null,offscreenCanvases:{},timerQueriesEXT:[],byteSizeByTypeRoot:5120,byteSizeByType:[1,1,2,2,4,4,4,2,3,4,8],programInfos:{},stringCache:{},tempFixedLengthArray:[],packAlignment:4,unpackAlignment:4,init:function () {
        GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
        for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
          GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i+1);
        }
  
        // For functions such as glDrawBuffers, glInvalidateFramebuffer and glInvalidateSubFramebuffer that need to pass a short array to the WebGL API,
        // create a set of short fixed-length arrays to avoid having to generate any garbage when calling those functions.
        for (var i = 0; i < 32; i++) {
          GL.tempFixedLengthArray.push(new Array(i));
        }
      },recordError:function recordError(errorCode) {
        if (!GL.lastError) {
          GL.lastError = errorCode;
        }
      },getNewId:function (table) {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
          table[i] = null;
        }
        return ret;
      },MINI_TEMP_BUFFER_SIZE:256,miniTempBuffer:null,miniTempBufferViews:[0],getSource:function (shader, count, string, length) {
        var source = '';
        for (var i = 0; i < count; ++i) {
          var frag;
          if (length) {
            var len = HEAP32[(((length)+(i*4))>>2)];
            if (len < 0) {
              frag = Pointer_stringify(HEAP32[(((string)+(i*4))>>2)]);
            } else {
              frag = Pointer_stringify(HEAP32[(((string)+(i*4))>>2)], len);
            }
          } else {
            frag = Pointer_stringify(HEAP32[(((string)+(i*4))>>2)]);
          }
          source += frag;
        }
        return source;
      },createContext:function (canvas, webGLContextAttributes) {
        if (typeof webGLContextAttributes['majorVersion'] === 'undefined' && typeof webGLContextAttributes['minorVersion'] === 'undefined') {
          webGLContextAttributes['majorVersion'] = 1;
          webGLContextAttributes['minorVersion'] = 0;
        }
  
  
        var ctx;
        var errorInfo = '?';
        function onContextCreationError(event) {
          errorInfo = event.statusMessage || errorInfo;
        }
        try {
          canvas.addEventListener('webglcontextcreationerror', onContextCreationError, false);
          try {
            if (webGLContextAttributes['majorVersion'] == 1 && webGLContextAttributes['minorVersion'] == 0) {
              ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
            } else if (webGLContextAttributes['majorVersion'] == 2 && webGLContextAttributes['minorVersion'] == 0) {
              ctx = canvas.getContext("webgl2", webGLContextAttributes);
            } else {
              throw 'Unsupported WebGL context version ' + majorVersion + '.' + minorVersion + '!'
            }
          } finally {
            canvas.removeEventListener('webglcontextcreationerror', onContextCreationError, false);
          }
          if (!ctx) throw ':(';
        } catch (e) {
          out('Could not create canvas: ' + [errorInfo, e, JSON.stringify(webGLContextAttributes)]);
          return 0;
        }
  
        if (!ctx) return 0;
        var context = GL.registerContext(ctx, webGLContextAttributes);
        return context;
      },registerContext:function (ctx, webGLContextAttributes) {
        var handle = GL.getNewId(GL.contexts);
        var context = {
          handle: handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes['majorVersion'],
          GLctx: ctx
        };
  
  
        // Store the created context object so that we can access the context given a canvas without having to pass the parameters again.
        if (ctx.canvas) ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes['enableExtensionsByDefault'] === 'undefined' || webGLContextAttributes['enableExtensionsByDefault']) {
          GL.initExtensions(context);
        }
        return handle;
      },makeContextCurrent:function (contextHandle) {
        var context = GL.contexts[contextHandle];
        if (!context) return false;
        GLctx = Module.ctx = context.GLctx; // Active WebGL context object.
        GL.currentContext = context; // Active Emscripten GL layer context object.
        return true;
      },getContext:function (contextHandle) {
        return GL.contexts[contextHandle];
      },deleteContext:function (contextHandle) {
        if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
        if (typeof JSEvents === 'object') JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas); // Release all JS event handlers on the DOM element that the GL context is associated with since the context is now deleted.
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined; // Make sure the canvas object no longer refers to the context object so there are no GC surprises.
        GL.contexts[contextHandle] = null;
      },initExtensions:function (context) {
        // If this function is called without a specific context object, init the extensions of the currently active context.
        if (!context) context = GL.currentContext;
  
        if (context.initExtensionsDone) return;
        context.initExtensionsDone = true;
  
        var GLctx = context.GLctx;
  
        context.maxVertexAttribs = GLctx.getParameter(GLctx.MAX_VERTEX_ATTRIBS);
  
        // Detect the presence of a few extensions manually, this GL interop layer itself will need to know if they exist.
  
        if (context.version < 2) {
          // Extension available from Firefox 26 and Google Chrome 30
          var instancedArraysExt = GLctx.getExtension('ANGLE_instanced_arrays');
          if (instancedArraysExt) {
            GLctx['vertexAttribDivisor'] = function(index, divisor) { instancedArraysExt['vertexAttribDivisorANGLE'](index, divisor); };
            GLctx['drawArraysInstanced'] = function(mode, first, count, primcount) { instancedArraysExt['drawArraysInstancedANGLE'](mode, first, count, primcount); };
            GLctx['drawElementsInstanced'] = function(mode, count, type, indices, primcount) { instancedArraysExt['drawElementsInstancedANGLE'](mode, count, type, indices, primcount); };
          }
  
          // Extension available from Firefox 25 and WebKit
          var vaoExt = GLctx.getExtension('OES_vertex_array_object');
          if (vaoExt) {
            GLctx['createVertexArray'] = function() { return vaoExt['createVertexArrayOES'](); };
            GLctx['deleteVertexArray'] = function(vao) { vaoExt['deleteVertexArrayOES'](vao); };
            GLctx['bindVertexArray'] = function(vao) { vaoExt['bindVertexArrayOES'](vao); };
            GLctx['isVertexArray'] = function(vao) { return vaoExt['isVertexArrayOES'](vao); };
          }
  
          var drawBuffersExt = GLctx.getExtension('WEBGL_draw_buffers');
          if (drawBuffersExt) {
            GLctx['drawBuffers'] = function(n, bufs) { drawBuffersExt['drawBuffersWEBGL'](n, bufs); };
          }
        }
  
        GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
  
        // These are the 'safe' feature-enabling extensions that don't add any performance impact related to e.g. debugging, and
        // should be enabled by default so that client GLES2/GL code will not need to go through extra hoops to get its stuff working.
        // As new extensions are ratified at http://www.khronos.org/registry/webgl/extensions/ , feel free to add your new extensions
        // here, as long as they don't produce a performance impact for users that might not be using those extensions.
        // E.g. debugging-related extensions should probably be off by default.
        var automaticallyEnabledExtensions = [ "OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives",
                                               "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture",
                                               "OES_element_index_uint", "EXT_texture_filter_anisotropic", "ANGLE_instanced_arrays",
                                               "OES_texture_float_linear", "OES_texture_half_float_linear", "WEBGL_compressed_texture_atc",
                                               "WEBKIT_WEBGL_compressed_texture_pvrtc", "WEBGL_compressed_texture_pvrtc",
                                               "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_frag_depth", "EXT_sRGB",
                                               "WEBGL_draw_buffers", "WEBGL_shared_resources", "EXT_shader_texture_lod", "EXT_color_buffer_float"];
  
        function shouldEnableAutomatically(extension) {
          var ret = false;
          automaticallyEnabledExtensions.forEach(function(include) {
            if (extension.indexOf(include) != -1) {
              ret = true;
            }
          });
          return ret;
        }
  
        var exts = GLctx.getSupportedExtensions();
        if (exts && exts.length > 0) {
          GLctx.getSupportedExtensions().forEach(function(ext) {
            if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
              GLctx.getExtension(ext); // Calling .getExtension enables that extension permanently, no need to store the return value to be enabled.
            }
          });
        }
      },populateUniformTable:function (program) {
        var p = GL.programs[program];
        GL.programInfos[program] = {
          uniforms: {},
          maxUniformLength: 0, // This is eagerly computed below, since we already enumerate all uniforms anyway.
          maxAttributeLength: -1, // This is lazily computed and cached, computed when/if first asked, "-1" meaning not computed yet.
          maxUniformBlockNameLength: -1 // Lazily computed as well
        };
  
        var ptable = GL.programInfos[program];
        var utable = ptable.uniforms;
        // A program's uniform table maps the string name of an uniform to an integer location of that uniform.
        // The global GL.uniforms map maps integer locations to WebGLUniformLocations.
        var numUniforms = GLctx.getProgramParameter(p, GLctx.ACTIVE_UNIFORMS);
        for (var i = 0; i < numUniforms; ++i) {
          var u = GLctx.getActiveUniform(p, i);
  
          var name = u.name;
          ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length+1);
  
          // Strip off any trailing array specifier we might have got, e.g. "[0]".
          if (name.indexOf(']', name.length-1) !== -1) {
            var ls = name.lastIndexOf('[');
            name = name.slice(0, ls);
          }
  
          // Optimize memory usage slightly: If we have an array of uniforms, e.g. 'vec3 colors[3];', then
          // only store the string 'colors' in utable, and 'colors[0]', 'colors[1]' and 'colors[2]' will be parsed as 'colors'+i.
          // Note that for the GL.uniforms table, we still need to fetch the all WebGLUniformLocations for all the indices.
          var loc = GLctx.getUniformLocation(p, name);
          if (loc != null)
          {
            var id = GL.getNewId(GL.uniforms);
            utable[name] = [u.size, id];
            GL.uniforms[id] = loc;
  
            for (var j = 1; j < u.size; ++j) {
              var n = name + '['+j+']';
              loc = GLctx.getUniformLocation(p, n);
              id = GL.getNewId(GL.uniforms);
  
              GL.uniforms[id] = loc;
            }
          }
        }
      }};function _glAttachShader(program, shader) {
      GLctx.attachShader(GL.programs[program],
                              GL.shaders[shader]);
    }

  function _glBindAttribLocation(program, index, name) {
      name = Pointer_stringify(name);
      GLctx.bindAttribLocation(GL.programs[program], index, name);
    }

  function _glBindBuffer(target, buffer) {
      var bufferObj = buffer ? GL.buffers[buffer] : null;
  
  
      GLctx.bindBuffer(target, bufferObj);
    }

  function _glBufferData(target, size, data, usage) {
      if (!data) {
        GLctx.bufferData(target, size, usage);
      } else {
        GLctx.bufferData(target, HEAPU8.subarray(data, data+size), usage);
      }
    }

  function _glClear(x0) { GLctx['clear'](x0) }

  function _glClearColor(x0, x1, x2, x3) { GLctx['clearColor'](x0, x1, x2, x3) }

  function _glCompileShader(shader) {
      GLctx.compileShader(GL.shaders[shader]);
    }

  function _glCreateProgram() {
      var id = GL.getNewId(GL.programs);
      var program = GLctx.createProgram();
      program.name = id;
      GL.programs[id] = program;
      return id;
    }

  function _glCreateShader(shaderType) {
      var id = GL.getNewId(GL.shaders);
      GL.shaders[id] = GLctx.createShader(shaderType);
      return id;
    }

  function _glDisableVertexAttribArray(index) {
      GLctx.disableVertexAttribArray(index);
    }

  function _glDrawArrays(mode, first, count) {
  
      GLctx.drawArrays(mode, first, count);
  
    }

  function _glEnable(x0) { GLctx['enable'](x0) }

  function _glEnableVertexAttribArray(index) {
      GLctx.enableVertexAttribArray(index);
    }

  function _glGenBuffers(n, buffers) {
      for (var i = 0; i < n; i++) {
        var buffer = GLctx.createBuffer();
        if (!buffer) {
          GL.recordError(0x0502 /* GL_INVALID_OPERATION */);
          while(i < n) HEAP32[(((buffers)+(i++*4))>>2)]=0;
          return;
        }
        var id = GL.getNewId(GL.buffers);
        buffer.name = id;
        GL.buffers[id] = buffer;
        HEAP32[(((buffers)+(i*4))>>2)]=id;
      }
    }

  function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
      var log = GLctx.getProgramInfoLog(GL.programs[program]);
      if (log === null) log = '(unknown error)';
  
      if (maxLength > 0 && infoLog) {
        var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
        if (length) HEAP32[((length)>>2)]=numBytesWrittenExclNull;
      } else {
        if (length) HEAP32[((length)>>2)]=0;
      }
    }

  function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
      var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
      if (log === null) log = '(unknown error)';
      if (maxLength > 0 && infoLog) {
        var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
        if (length) HEAP32[((length)>>2)]=numBytesWrittenExclNull;
      } else {
        if (length) HEAP32[((length)>>2)]=0;
      }
    }

  function _glGetUniformLocation(program, name) {
      name = Pointer_stringify(name);
  
      var arrayOffset = 0;
      // If user passed an array accessor "[index]", parse the array index off the accessor.
      if (name.indexOf(']', name.length-1) !== -1) {
        var ls = name.lastIndexOf('[');
        var arrayIndex = name.slice(ls+1, -1);
        if (arrayIndex.length > 0) {
          arrayOffset = parseInt(arrayIndex);
          if (arrayOffset < 0) {
            return -1;
          }
        }
        name = name.slice(0, ls);
      }
  
      var ptable = GL.programInfos[program];
      if (!ptable) {
        return -1;
      }
      var utable = ptable.uniforms;
      var uniformInfo = utable[name]; // returns pair [ dimension_of_uniform_array, uniform_location ]
      if (uniformInfo && arrayOffset < uniformInfo[0]) { // Check if user asked for an out-of-bounds element, i.e. for 'vec4 colors[3];' user could ask for 'colors[10]' which should return -1.
        return uniformInfo[1]+arrayOffset;
      } else {
        return -1;
      }
    }

  function _glLinkProgram(program) {
      GLctx.linkProgram(GL.programs[program]);
      GL.programInfos[program] = null; // uniforms no longer keep the same names after linking
      GL.populateUniformTable(program);
    }

  function _glShaderSource(shader, count, string, length) {
      var source = GL.getSource(shader, count, string, length);
  
  
      GLctx.shaderSource(GL.shaders[shader], source);
    }

  function _glUniform4fv(location, count, value) {
  
  
      var view;
      if (4*count <= GL.MINI_TEMP_BUFFER_SIZE) {
        // avoid allocation when uploading few enough uniforms
        view = GL.miniTempBufferViews[4*count-1];
        for (var i = 0; i < 4*count; i += 4) {
          view[i] = HEAPF32[(((value)+(4*i))>>2)];
          view[i+1] = HEAPF32[(((value)+(4*i+4))>>2)];
          view[i+2] = HEAPF32[(((value)+(4*i+8))>>2)];
          view[i+3] = HEAPF32[(((value)+(4*i+12))>>2)];
        }
      } else {
        view = HEAPF32.subarray((value)>>2,(value+count*16)>>2);
      }
      GLctx.uniform4fv(GL.uniforms[location], view);
    }

  function _glUniformMatrix4fv(location, count, transpose, value) {
  
  
      var view;
      if (16*count <= GL.MINI_TEMP_BUFFER_SIZE) {
        // avoid allocation when uploading few enough uniforms
        view = GL.miniTempBufferViews[16*count-1];
        for (var i = 0; i < 16*count; i += 16) {
          view[i] = HEAPF32[(((value)+(4*i))>>2)];
          view[i+1] = HEAPF32[(((value)+(4*i+4))>>2)];
          view[i+2] = HEAPF32[(((value)+(4*i+8))>>2)];
          view[i+3] = HEAPF32[(((value)+(4*i+12))>>2)];
          view[i+4] = HEAPF32[(((value)+(4*i+16))>>2)];
          view[i+5] = HEAPF32[(((value)+(4*i+20))>>2)];
          view[i+6] = HEAPF32[(((value)+(4*i+24))>>2)];
          view[i+7] = HEAPF32[(((value)+(4*i+28))>>2)];
          view[i+8] = HEAPF32[(((value)+(4*i+32))>>2)];
          view[i+9] = HEAPF32[(((value)+(4*i+36))>>2)];
          view[i+10] = HEAPF32[(((value)+(4*i+40))>>2)];
          view[i+11] = HEAPF32[(((value)+(4*i+44))>>2)];
          view[i+12] = HEAPF32[(((value)+(4*i+48))>>2)];
          view[i+13] = HEAPF32[(((value)+(4*i+52))>>2)];
          view[i+14] = HEAPF32[(((value)+(4*i+56))>>2)];
          view[i+15] = HEAPF32[(((value)+(4*i+60))>>2)];
        }
      } else {
        view = HEAPF32.subarray((value)>>2,(value+count*64)>>2);
      }
      GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
    }

  function _glUseProgram(program) {
      GLctx.useProgram(program ? GL.programs[program] : null);
    }

  function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
      GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
    }

  function _glViewport(x0, x1, x2, x3) { GLctx['viewport'](x0, x1, x2, x3) }

  
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (typeof setImmediate === 'undefined') {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = 'setimmediate';
          function Browser_setImmediate_messageHandler(event) {
            // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
            // so check for both cases.
            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true);
          setImmediate = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            if (ENVIRONMENT_IS_WORKER) {
              if (Module['setImmediates'] === undefined) Module['setImmediates'] = [];
              Module['setImmediates'].push(func);
              postMessage({target: emscriptenMainLoopMessageId}); // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, "*"); // On the main thread, can just send the message to itself.
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  
  function _emscripten_get_now() { abort() }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var browserIterationFunc;
      if (typeof arg !== 'undefined') {
        browserIterationFunc = function() {
          Module['dynCall_vi'](func, arg);
        };
      } else {
        browserIterationFunc = function() {
          Module['dynCall_v'](func);
        };
      }
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
  
          // catches pause/resume main loop from blocker execution
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          err('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
        checkStackCookie();
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) err('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
  
        // Canvas event setup
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === Module['canvas'] ||
                                document['mozPointerLockElement'] === Module['canvas'] ||
                                document['webkitPointerLockElement'] === Module['canvas'] ||
                                document['msPointerLockElement'] === Module['canvas'];
        }
        var canvas = Module['canvas'];
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
  
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                Module['canvas'].requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = document['exitFullscreen'] ||
                                    document['cancelFullScreen'] ||
                                    document['mozCancelFullScreen'] ||
                                    document['msExitFullscreen'] ||
                                    document['webkitCancelFullScreen'] ||
                                    function() {};
            canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
  
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
          window.removeEventListener("resize", GLUT.onResize, true);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullscreen();
        }
      },requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
          err('Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.');
          Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
          }
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll':
            delta = event.detail;
            break;
          case 'mousewheel':
            delta = event.wheelDelta;
            break;
          case 'wheel':
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
  
          // check if SDL is available
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
  
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
        Module['readAsync'](url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (dep) addRunDependency(dep);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function () {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};
  
  var GLUT={initTime:null,idleFunc:null,displayFunc:null,keyboardFunc:null,keyboardUpFunc:null,specialFunc:null,specialUpFunc:null,reshapeFunc:null,motionFunc:null,passiveMotionFunc:null,mouseFunc:null,buttons:0,modifiers:0,initWindowWidth:256,initWindowHeight:256,initDisplayMode:18,windowX:0,windowY:0,windowWidth:0,windowHeight:0,requestedAnimationFrame:false,saveModifiers:function (event) {
        GLUT.modifiers = 0;
        if (event['shiftKey'])
          GLUT.modifiers += 1; /* GLUT_ACTIVE_SHIFT */
        if (event['ctrlKey'])
          GLUT.modifiers += 2; /* GLUT_ACTIVE_CTRL */
        if (event['altKey'])
          GLUT.modifiers += 4; /* GLUT_ACTIVE_ALT */
      },onMousemove:function (event) {
        /* Send motion event only if the motion changed, prevents
         * spamming our app with uncessary callback call. It does happen in
         * Chrome on Windows.
         */
        var lastX = Browser.mouseX;
        var lastY = Browser.mouseY;
        Browser.calculateMouseEvent(event);
        var newX = Browser.mouseX;
        var newY = Browser.mouseY;
        if (newX == lastX && newY == lastY) return;
  
        if (GLUT.buttons == 0 && event.target == Module["canvas"] && GLUT.passiveMotionFunc) {
          event.preventDefault();
          GLUT.saveModifiers(event);
          Module['dynCall_vii'](GLUT.passiveMotionFunc, lastX, lastY);
        } else if (GLUT.buttons != 0 && GLUT.motionFunc) {
          event.preventDefault();
          GLUT.saveModifiers(event);
          Module['dynCall_vii'](GLUT.motionFunc, lastX, lastY);
        }
      },getSpecialKey:function (keycode) {
          var key = null;
          switch (keycode) {
            case 8:  key = 120 /* backspace */; break;
            case 46: key = 111 /* delete */; break;
  
            case 0x70 /*DOM_VK_F1*/: key = 1 /* GLUT_KEY_F1 */; break;
            case 0x71 /*DOM_VK_F2*/: key = 2 /* GLUT_KEY_F2 */; break;
            case 0x72 /*DOM_VK_F3*/: key = 3 /* GLUT_KEY_F3 */; break;
            case 0x73 /*DOM_VK_F4*/: key = 4 /* GLUT_KEY_F4 */; break;
            case 0x74 /*DOM_VK_F5*/: key = 5 /* GLUT_KEY_F5 */; break;
            case 0x75 /*DOM_VK_F6*/: key = 6 /* GLUT_KEY_F6 */; break;
            case 0x76 /*DOM_VK_F7*/: key = 7 /* GLUT_KEY_F7 */; break;
            case 0x77 /*DOM_VK_F8*/: key = 8 /* GLUT_KEY_F8 */; break;
            case 0x78 /*DOM_VK_F9*/: key = 9 /* GLUT_KEY_F9 */; break;
            case 0x79 /*DOM_VK_F10*/: key = 10 /* GLUT_KEY_F10 */; break;
            case 0x7a /*DOM_VK_F11*/: key = 11 /* GLUT_KEY_F11 */; break;
            case 0x7b /*DOM_VK_F12*/: key = 12 /* GLUT_KEY_F12 */; break;
            case 0x25 /*DOM_VK_LEFT*/: key = 100 /* GLUT_KEY_LEFT */; break;
            case 0x26 /*DOM_VK_UP*/: key = 101 /* GLUT_KEY_UP */; break;
            case 0x27 /*DOM_VK_RIGHT*/: key = 102 /* GLUT_KEY_RIGHT */; break;
            case 0x28 /*DOM_VK_DOWN*/: key = 103 /* GLUT_KEY_DOWN */; break;
            case 0x21 /*DOM_VK_PAGE_UP*/: key = 104 /* GLUT_KEY_PAGE_UP */; break;
            case 0x22 /*DOM_VK_PAGE_DOWN*/: key = 105 /* GLUT_KEY_PAGE_DOWN */; break;
            case 0x24 /*DOM_VK_HOME*/: key = 106 /* GLUT_KEY_HOME */; break;
            case 0x23 /*DOM_VK_END*/: key = 107 /* GLUT_KEY_END */; break;
            case 0x2d /*DOM_VK_INSERT*/: key = 108 /* GLUT_KEY_INSERT */; break;
  
            case 16   /*DOM_VK_SHIFT*/:
            case 0x05 /*DOM_VK_LEFT_SHIFT*/:
              key = 112 /* GLUT_KEY_SHIFT_L */;
              break;
            case 0x06 /*DOM_VK_RIGHT_SHIFT*/:
              key = 113 /* GLUT_KEY_SHIFT_R */;
              break;
  
            case 17   /*DOM_VK_CONTROL*/:
            case 0x03 /*DOM_VK_LEFT_CONTROL*/:
              key = 114 /* GLUT_KEY_CONTROL_L */;
              break;
            case 0x04 /*DOM_VK_RIGHT_CONTROL*/:
              key = 115 /* GLUT_KEY_CONTROL_R */;
              break;
  
            case 18   /*DOM_VK_ALT*/:
            case 0x02 /*DOM_VK_LEFT_ALT*/:
              key = 116 /* GLUT_KEY_ALT_L */;
              break;
            case 0x01 /*DOM_VK_RIGHT_ALT*/:
              key = 117 /* GLUT_KEY_ALT_R */;
              break;
          };
          return key;
      },getASCIIKey:function (event) {
        if (event['ctrlKey'] || event['altKey'] || event['metaKey']) return null;
  
        var keycode = event['keyCode'];
  
        /* The exact list is soooo hard to find in a canonical place! */
  
        if (48 <= keycode && keycode <= 57)
          return keycode; // numeric  TODO handle shift?
        if (65 <= keycode && keycode <= 90)
          return event['shiftKey'] ? keycode : keycode + 32;
        if (96 <= keycode && keycode <= 105)
          return keycode - 48; // numpad numbers    
        if (106 <= keycode && keycode <= 111)
          return keycode - 106 + 42; // *,+-./  TODO handle shift?
  
        switch (keycode) {
          case 9:  // tab key
          case 13: // return key
          case 27: // escape
          case 32: // space
          case 61: // equal
            return keycode;
        }
  
        var s = event['shiftKey'];
        switch (keycode) {
          case 186: return s ? 58 : 59; // colon / semi-colon
          case 187: return s ? 43 : 61; // add / equal (these two may be wrong)
          case 188: return s ? 60 : 44; // less-than / comma
          case 189: return s ? 95 : 45; // dash
          case 190: return s ? 62 : 46; // greater-than / period
          case 191: return s ? 63 : 47; // forward slash
          case 219: return s ? 123 : 91; // open bracket
          case 220: return s ? 124 : 47; // back slash
          case 221: return s ? 125 : 93; // close braket
          case 222: return s ? 34 : 39; // single quote
        }
  
        return null;
      },onKeydown:function (event) {
        if (GLUT.specialFunc || GLUT.keyboardFunc) {
          var key = GLUT.getSpecialKey(event['keyCode']);
          if (key !== null) {
            if( GLUT.specialFunc ) {
              event.preventDefault();
              GLUT.saveModifiers(event);
              Module['dynCall_viii'](GLUT.specialFunc, key, Browser.mouseX, Browser.mouseY);
            }
          }
          else
          {
            key = GLUT.getASCIIKey(event);
            if( key !== null && GLUT.keyboardFunc ) {
              event.preventDefault();
              GLUT.saveModifiers(event);
              Module['dynCall_viii'](GLUT.keyboardFunc, key, Browser.mouseX, Browser.mouseY);
            }
          }
        }
      },onKeyup:function (event) {
        if (GLUT.specialUpFunc || GLUT.keyboardUpFunc) {
          var key = GLUT.getSpecialKey(event['keyCode']);
          if (key !== null) {
            if(GLUT.specialUpFunc) {
              event.preventDefault ();
              GLUT.saveModifiers(event);
              Module['dynCall_viii'](GLUT.specialUpFunc, key, Browser.mouseX, Browser.mouseY);
            }
          }
          else
          {
            key = GLUT.getASCIIKey(event);
            if( key !== null && GLUT.keyboardUpFunc ) {
              event.preventDefault ();
              GLUT.saveModifiers(event);
              Module['dynCall_viii'](GLUT.keyboardUpFunc, key, Browser.mouseX, Browser.mouseY);
            }
          }
        }
      },touchHandler:function (event) {
        if (event.target != Module['canvas']) {
          return;
        }
  
        var touches = event.changedTouches,
            main = touches[0],
            type = "";
  
        switch(event.type) {
          case "touchstart": type = "mousedown"; break;
          case "touchmove": type = "mousemove"; break;
          case "touchend": type = "mouseup"; break;
          default: return;
        }
  
        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1, 
                                      main.screenX, main.screenY, 
                                      main.clientX, main.clientY, false, 
                                      false, false, false, 0/*main*/, null);
  
        main.target.dispatchEvent(simulatedEvent);
        event.preventDefault();
      },onMouseButtonDown:function (event) {
        Browser.calculateMouseEvent(event);
  
        GLUT.buttons |= (1 << event['button']);
  
        if (event.target == Module["canvas"] && GLUT.mouseFunc) {
          try {
            event.target.setCapture();
          } catch (e) {}
          event.preventDefault();
          GLUT.saveModifiers(event);
          Module['dynCall_viiii'](GLUT.mouseFunc, event['button'], 0/*GLUT_DOWN*/, Browser.mouseX, Browser.mouseY);
        }
      },onMouseButtonUp:function (event) {
        Browser.calculateMouseEvent(event);
  
        GLUT.buttons &= ~(1 << event['button']);
  
        if (GLUT.mouseFunc) {
          event.preventDefault();
          GLUT.saveModifiers(event);
          Module['dynCall_viiii'](GLUT.mouseFunc, event['button'], 1/*GLUT_UP*/, Browser.mouseX, Browser.mouseY);
        }
      },onMouseWheel:function (event) {
        Browser.calculateMouseEvent(event);
  
        // cross-browser wheel delta
        var e = window.event || event; // old IE support
        // Note the minus sign that flips browser wheel direction (positive direction scrolls page down) to native wheel direction (positive direction is mouse wheel up)
        var delta = -Browser.getMouseWheelDelta(event);
        delta = (delta == 0) ? 0 : (delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1)); // Quantize to integer so that minimum scroll is at least +/- 1.
  
        var button = 3; // wheel up
        if (delta < 0) {
          button = 4; // wheel down
        }
  
        if (GLUT.mouseFunc) {
          event.preventDefault();
          GLUT.saveModifiers(event);
          Module['dynCall_viiii'](GLUT.mouseFunc, button, 0/*GLUT_DOWN*/, Browser.mouseX, Browser.mouseY);
        }
      },onResize:function (event) {
          if (!(document["fullscreen"] || document["fullScreen"] || document["mozFullScreen"] || document["webkitIsFullScreen"]))
          {
            var rect = Module['canvas'].getBoundingClientRect();
            _glutReshapeWindow(rect.width,rect.height);
          }
        
      },onFullscreenEventChange:function (event) {
        var width;
        var height;
        if (document["fullscreen"] || document["fullScreen"] || document["mozFullScreen"] || document["webkitIsFullScreen"]) {
          width = screen["width"];
          height = screen["height"];
        } else {
          width = GLUT.windowWidth;
          height = GLUT.windowHeight;
          // TODO set position
          document.removeEventListener('fullscreenchange', GLUT.onFullscreenEventChange, true);
          document.removeEventListener('mozfullscreenchange', GLUT.onFullscreenEventChange, true);
          document.removeEventListener('webkitfullscreenchange', GLUT.onFullscreenEventChange, true);
          window.addEventListener("resize", GLUT.onResize, true);

        }
        Browser.setCanvasSize(width, height, true); // N.B. GLUT.reshapeFunc is also registered as a canvas resize callback.
                                                    // Just call it once here.
        /* Can't call _glutReshapeWindow as that requests cancelling fullscreen. */
        if (GLUT.reshapeFunc) {
          // console.log("GLUT.reshapeFunc (from FS): " + width + ", " + height);
          Module['dynCall_vii'](GLUT.reshapeFunc, width, height);
        }
        _glutPostRedisplay();
      },requestFullscreen:function () {
        Browser.requestFullscreen(/*lockPointer=*/false, /*resizeCanvas=*/false);
      },requestFullScreen:function () {
        err('GLUT.requestFullScreen() is deprecated. Please call GLUT.requestFullscreen instead.');
        GLUT.requestFullScreen = function() {
          return GLUT.requestFullscreen();
        }
        return GLUT.requestFullscreen();
      },exitFullscreen:function () {
        var CFS = document['exitFullscreen'] ||
                  document['cancelFullScreen'] ||
                  document['mozCancelFullScreen'] ||
                  document['webkitCancelFullScreen'] ||
            (function() {});
        CFS.apply(document, []);
      },cancelFullScreen:function () {
        err('GLUT.cancelFullScreen() is deprecated. Please call GLUT.exitFullscreen instead.');
        GLUT.cancelFullScreen = function() {
          return GLUT.exitFullscreen();
        }
        return GLUT.exitFullscreen();
      }};function _glutCreateWindow(name) {
      var contextAttributes = {
        antialias: ((GLUT.initDisplayMode & 0x0080 /*GLUT_MULTISAMPLE*/) != 0),
        depth: ((GLUT.initDisplayMode & 0x0010 /*GLUT_DEPTH*/) != 0),
        stencil: ((GLUT.initDisplayMode & 0x0020 /*GLUT_STENCIL*/) != 0),
        alpha: ((GLUT.initDisplayMode & 0x0008 /*GLUT_ALPHA*/) != 0)
      };
      Module.ctx = Browser.createContext(Module['canvas'], true, true, contextAttributes);
      return Module.ctx ? 1 /* a new GLUT window ID for the created context */ : 0 /* failure */;
    }

  function _glutDisplayFunc(func) {
      GLUT.displayFunc = func;
    }

  
  function _glutPostRedisplay() {
      if (GLUT.displayFunc && !GLUT.requestedAnimationFrame) {
        GLUT.requestedAnimationFrame = true;
        Browser.requestAnimationFrame(function() {
          GLUT.requestedAnimationFrame = false;
          Browser.mainLoop.runIter(function() {
            Module['dynCall_v'](GLUT.displayFunc);
          });
        });
      }
    }
    
  function _glutFullScreen() {
      GLUT.windowX = 0; // TODO
      GLUT.windowY = 0; // TODO
      GLUT.windowWidth  = Module['canvas'].width;
      GLUT.windowHeight = Module['canvas'].height;
      document.addEventListener('fullscreenchange', GLUT.onFullscreenEventChange, true);
      document.addEventListener('mozfullscreenchange', GLUT.onFullscreenEventChange, true);
      document.addEventListener('webkitfullscreenchange', GLUT.onFullscreenEventChange, true);
      window.removeEventListener("resize", GLUT.onResize, true);
      GLUT.requestFullscreen();
    }

  function _glutGet(type) {
      switch (type) {
        case 100: /* GLUT_WINDOW_X */
          return 0; /* TODO */
        case 101: /* GLUT_WINDOW_Y */
          return 0; /* TODO */
        case 102: /* GLUT_WINDOW_WIDTH */
          return Module['canvas'].width;
        case 103: /* GLUT_WINDOW_HEIGHT */
          return Module['canvas'].height;
        case 200: /* GLUT_SCREEN_WIDTH */
          return Module['canvas'].width;
        case 201: /* GLUT_SCREEN_HEIGHT */
          return Module['canvas'].height;
        case 500: /* GLUT_INIT_WINDOW_X */
          return 0; /* TODO */
        case 501: /* GLUT_INIT_WINDOW_Y */
          return 0; /* TODO */
        case 502: /* GLUT_INIT_WINDOW_WIDTH */
          return GLUT.initWindowWidth;
        case 503: /* GLUT_INIT_WINDOW_HEIGHT */
          return GLUT.initWindowHeight;
        case 700: /* GLUT_ELAPSED_TIME */
          var now = Date.now();
          return now - GLUT.initTime;
  
        default:
          throw "glutGet(" + type + ") not implemented yet";
      }
    }

  function _glutIdleFunc(func) {
      function callback() {
        if (GLUT.idleFunc) {
          Module['dynCall_v'](GLUT.idleFunc);
          Browser.safeSetTimeout(callback, 4); // HTML spec specifies a 4ms minimum delay on the main thread; workers might get more, but we standardize here
        }
      }
      if (!GLUT.idleFunc) {
        Browser.safeSetTimeout(callback, 0);
      }
      GLUT.idleFunc = func;
    }

  function _glutInit(argcp, argv) {
      // Ignore arguments
      GLUT.initTime = Date.now();
  
      var isTouchDevice = 'ontouchstart' in document.documentElement;
      if (isTouchDevice) {
        // onMouseButtonDown, onMouseButtonUp and onMousemove handlers
        // depend on Browser.mouseX / Browser.mouseY fields. Those fields
        // don't get updated by touch events. So register a touchHandler
        // function that translates the touch events to mouse events.
  
        // GLUT doesn't support touch, mouse only, so from touch events we
        // are only looking at single finger touches to emulate left click,
        // so we can use workaround and convert all touch events in mouse
        // events. See touchHandler.
        window.addEventListener("touchmove", GLUT.touchHandler, true);
        window.addEventListener("touchstart", GLUT.touchHandler, true);
        window.addEventListener("touchend", GLUT.touchHandler, true);
      }
  
      window.addEventListener("keydown", GLUT.onKeydown, true);
      window.addEventListener("keyup", GLUT.onKeyup, true);
      window.addEventListener("mousemove", GLUT.onMousemove, true);
      window.addEventListener("mousedown", GLUT.onMouseButtonDown, true);
      window.addEventListener("mouseup", GLUT.onMouseButtonUp, true);
      // IE9, Chrome, Safari, Opera
      window.addEventListener("mousewheel", GLUT.onMouseWheel, true);
      // Firefox
      window.addEventListener("DOMMouseScroll", GLUT.onMouseWheel, true);
  
      window.addEventListener("resize", GLUT.onResize, true);

      Browser.resizeListeners.push(function(width, height) {
        if (GLUT.reshapeFunc) {
          Module['dynCall_vii'](GLUT.reshapeFunc, width, height);
        }
      });
  
      __ATEXIT__.push(function() {
        if (isTouchDevice) {
          window.removeEventListener("touchmove", GLUT.touchHandler, true);
          window.removeEventListener("touchstart", GLUT.touchHandler, true);
          window.removeEventListener("touchend", GLUT.touchHandler, true);
        }
  
        window.removeEventListener("keydown", GLUT.onKeydown, true);
        window.removeEventListener("keyup", GLUT.onKeyup, true);
        window.removeEventListener("mousemove", GLUT.onMousemove, true);
        window.removeEventListener("mousedown", GLUT.onMouseButtonDown, true);
        window.removeEventListener("mouseup", GLUT.onMouseButtonUp, true);
        // IE9, Chrome, Safari, Opera
        window.removeEventListener("mousewheel", GLUT.onMouseWheel, true);
        // Firefox
        window.removeEventListener("DOMMouseScroll", GLUT.onMouseWheel, true);
  
        window.removeEventListener("resize", GLUT.onResize, true);

        Module["canvas"].width = Module["canvas"].height = 1;
      });
    }

  function _glutInitDisplayMode(mode) {
      GLUT.initDisplayMode = mode;
    }

  function _glutInitWindowSize(width, height) {
      Browser.setCanvasSize( GLUT.initWindowWidth = width,
                             GLUT.initWindowHeight = height );
    }

  
  function _glutReshapeWindow(width, height) {
      GLUT.exitFullscreen();
      Browser.setCanvasSize(width, height, true); // N.B. GLUT.reshapeFunc is also registered as a canvas resize callback.
                                                  // Just call it once here.
      if (GLUT.reshapeFunc) {
        Module['dynCall_vii'](GLUT.reshapeFunc, width, height);
      }
      _glutPostRedisplay();
    }
    
  function _glutMainLoop() {
      var rect = Module['canvas'].getBoundingClientRect();
      _glutReshapeWindow(rect.width,rect.height);
      _glutPostRedisplay();
      throw 'SimulateInfiniteLoop';
    }


  function _glutReshapeFunc(func) {
      GLUT.reshapeFunc = func;
    }   
    
  function _glutSpecialFunc(func) {
      GLUT.specialFunc = func;
    }

  function _glutSwapBuffers() {}



   

  var _llvm_cos_f64=Math_cos;

  var _llvm_sin_f64=Math_sin;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    } 
var GLctx; GL.init();
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead."); Module["requestFullScreen"] = Module["requestFullscreen"]; Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else if (typeof self === 'object' && self['performance'] && typeof self['performance']['now'] === 'function') {
    _emscripten_get_now = function() { return self['performance']['now'](); };
  } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
    _emscripten_get_now = function() { return performance['now'](); };
  } else {
    _emscripten_get_now = Date.now;
  };
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { err("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_v": nullFunc_v, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_v": invoke_v, "invoke_vii": invoke_vii, "invoke_viii": invoke_viii, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_emscripten_get_now": _emscripten_get_now, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_glAttachShader": _glAttachShader, "_glBindAttribLocation": _glBindAttribLocation, "_glBindBuffer": _glBindBuffer, "_glBufferData": _glBufferData, "_glClear": _glClear, "_glClearColor": _glClearColor, "_glCompileShader": _glCompileShader, "_glCreateProgram": _glCreateProgram, "_glCreateShader": _glCreateShader, "_glDisableVertexAttribArray": _glDisableVertexAttribArray, "_glDrawArrays": _glDrawArrays, "_glEnable": _glEnable, "_glEnableVertexAttribArray": _glEnableVertexAttribArray, "_glGenBuffers": _glGenBuffers, "_glGetProgramInfoLog": _glGetProgramInfoLog, "_glGetShaderInfoLog": _glGetShaderInfoLog, "_glGetUniformLocation": _glGetUniformLocation, "_glLinkProgram": _glLinkProgram, "_glShaderSource": _glShaderSource, "_glUniform4fv": _glUniform4fv, "_glUniformMatrix4fv": _glUniformMatrix4fv, "_glUseProgram": _glUseProgram, "_glVertexAttribPointer": _glVertexAttribPointer, "_glViewport": _glViewport, "_glutCreateWindow": _glutCreateWindow, "_glutDisplayFunc": _glutDisplayFunc, "_glutFullScreen": _glutFullScreen, "_glutGet": _glutGet, "_glutIdleFunc": _glutIdleFunc, "_glutInit": _glutInit, "_glutInitDisplayMode": _glutInitDisplayMode, "_glutInitWindowSize": _glutInitWindowSize, "_glutMainLoop": _glutMainLoop, "_glutPostRedisplay": _glutPostRedisplay, "_glutReshapeFunc": _glutReshapeFunc, "_glutReshapeWindow": _glutReshapeWindow, "_glutSpecialFunc": _glutSpecialFunc, "_glutSwapBuffers": _glutSwapBuffers, "_llvm_cos_f64": _llvm_cos_f64, "_llvm_sin_f64": _llvm_sin_f64, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_viii=env.nullFunc_viii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_v=env.invoke_v;
  var invoke_vii=env.invoke_vii;
  var invoke_viii=env.invoke_viii;
  var ___lock=env.___lock;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var _emscripten_get_now=env._emscripten_get_now;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _glAttachShader=env._glAttachShader;
  var _glBindAttribLocation=env._glBindAttribLocation;
  var _glBindBuffer=env._glBindBuffer;
  var _glBufferData=env._glBufferData;
  var _glClear=env._glClear;
  var _glClearColor=env._glClearColor;
  var _glCompileShader=env._glCompileShader;
  var _glCreateProgram=env._glCreateProgram;
  var _glCreateShader=env._glCreateShader;
  var _glDisableVertexAttribArray=env._glDisableVertexAttribArray;
  var _glDrawArrays=env._glDrawArrays;
  var _glEnable=env._glEnable;
  var _glEnableVertexAttribArray=env._glEnableVertexAttribArray;
  var _glGenBuffers=env._glGenBuffers;
  var _glGetProgramInfoLog=env._glGetProgramInfoLog;
  var _glGetShaderInfoLog=env._glGetShaderInfoLog;
  var _glGetUniformLocation=env._glGetUniformLocation;
  var _glLinkProgram=env._glLinkProgram;
  var _glShaderSource=env._glShaderSource;
  var _glUniform4fv=env._glUniform4fv;
  var _glUniformMatrix4fv=env._glUniformMatrix4fv;
  var _glUseProgram=env._glUseProgram;
  var _glVertexAttribPointer=env._glVertexAttribPointer;
  var _glViewport=env._glViewport;
  var _glutCreateWindow=env._glutCreateWindow;
  var _glutDisplayFunc=env._glutDisplayFunc;
  var _glutFullScreen=env._glutFullScreen;
  var _glutGet=env._glutGet;
  var _glutIdleFunc=env._glutIdleFunc;
  var _glutInit=env._glutInit;
  var _glutInitDisplayMode=env._glutInitDisplayMode;
  var _glutInitWindowSize=env._glutInitWindowSize;
  var _glutMainLoop=env._glutMainLoop;
  var _glutPostRedisplay=env._glutPostRedisplay;
  var _glutReshapeFunc=env._glutReshapeFunc;
  var _glutReshapeWindow=env._glutReshapeWindow;
  var _glutSpecialFunc=env._glutSpecialFunc;
  var _glutSwapBuffers=env._glutSwapBuffers;
  var _llvm_cos_f64=env._llvm_cos_f64;
  var _llvm_sin_f64=env._llvm_sin_f64;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _perspective($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 $4 = +$4;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0;
 var $30 = 0.0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0, $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0;
 var $5 = 0, $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0, $65 = 0, $7 = 0.0, $8 = 0.0;
 var $9 = 0.0, $or$cond = 0, $or$cond3 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $10 = sp;
 $11 = sp + 88|0;
 $12 = sp + 80|0;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 _identity($10);
 $16 = $6;
 $17 = $16 / 2.0;
 $18 = $17;
 $19 = $18 * 3.1415926535897931;
 $20 = $19 / 180.0;
 $21 = $20;
 $15 = $21;
 $22 = $9;
 $23 = $8;
 $24 = $22 - $23;
 $25 = $24;
 $14 = $25;
 $26 = $15;
 $27 = $26;
 __sincos($27,$11,$12);
 $28 = $14;
 $29 = $28 == 0.0;
 $30 = +HEAPF64[$11>>3];
 $31 = $30 == 0.0;
 $or$cond = $29 | $31;
 $32 = $7;
 $33 = $32 == 0.0;
 $or$cond3 = $or$cond | $33;
 if ($or$cond3) {
  STACKTOP = sp;return;
 }
 $34 = +HEAPF64[$12>>3];
 $35 = +HEAPF64[$11>>3];
 $36 = $34 / $35;
 $13 = $36;
 $37 = $13;
 $38 = $7;
 $39 = $38;
 $40 = $37 / $39;
 $41 = $40;
 HEAPF32[$10>>2] = $41;
 $42 = $13;
 $43 = $42;
 $44 = ((($10)) + 20|0);
 HEAPF32[$44>>2] = $43;
 $45 = $9;
 $46 = $8;
 $47 = $45 + $46;
 $48 = - $47;
 $49 = $48;
 $50 = $14;
 $51 = $49 / $50;
 $52 = $51;
 $53 = ((($10)) + 40|0);
 HEAPF32[$53>>2] = $52;
 $54 = ((($10)) + 44|0);
 HEAPF32[$54>>2] = -1.0;
 $55 = $8;
 $56 = -2.0 * $55;
 $57 = $9;
 $58 = $56 * $57;
 $59 = $58;
 $60 = $14;
 $61 = $59 / $60;
 $62 = $61;
 $63 = ((($10)) + 56|0);
 HEAPF32[$63>>2] = $62;
 $64 = ((($10)) + 60|0);
 HEAPF32[$64>>2] = 0.0;
 $65 = $5;
 dest=$65; src=$10; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _identity($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $2 = sp;
 $1 = $0;
 dest=$2; stop=dest+64|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 HEAPF32[$2>>2] = 1.0;
 $3 = ((($2)) + 20|0);
 HEAPF32[$3>>2] = 1.0;
 $4 = ((($2)) + 40|0);
 HEAPF32[$4>>2] = 1.0;
 $5 = ((($2)) + 60|0);
 HEAPF32[$5>>2] = 1.0;
 $6 = $1;
 dest=$6; src=$2; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function __sincos($0,$1,$2) {
 $0 = +$0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0, $3 = 0.0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $7 = (+Math_sin((+$6)));
 $8 = $4;
 HEAPF64[$8>>3] = $7;
 $9 = $3;
 $10 = (+Math_cos((+$9)));
 $11 = $5;
 HEAPF64[$11>>3] = $10;
 STACKTOP = sp;return;
}
function _main($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp + 4|0;
 $2 = 0;
 HEAP32[$3>>2] = $0;
 $4 = $1;
 $5 = $4;
 _glutInit(($3|0),($5|0));
 _glutInitWindowSize(300,300);
 _glutInitDisplayMode(18);
 (_glutCreateWindow((3792|0))|0);
 _glutIdleFunc((4|0));
 _glutReshapeFunc((5|0));
 _glutDisplayFunc((6|0));
 _glutSpecialFunc((7|0));
 _gears_init();
 _glutMainLoop();
 STACKTOP = sp;return 0;
}
function _gears_idle() {
 var $0 = 0.0, $1 = 0.0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0;
 var $27 = 0, $28 = 0, $29 = 0.0, $3 = 0.0, $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0;
 var $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer = sp + 16|0;
 $4 = (_glutGet(700)|0);
 $5 = (+($4|0));
 $6 = $5 / 1000.0;
 $1 = $6;
 $7 = +HEAPF64[424];
 $8 = $7 < 0.0;
 if ($8) {
  $9 = $1;
  HEAPF64[424] = $9;
 }
 $10 = $1;
 $11 = +HEAPF64[424];
 $12 = $10 - $11;
 $0 = $12;
 $13 = $1;
 HEAPF64[424] = $13;
 $14 = $0;
 $15 = 70.0 * $14;
 $16 = +HEAPF32[1289];
 $17 = $16;
 $18 = $17 + $15;
 $19 = $18;
 HEAPF32[1289] = $19;
 $20 = +HEAPF32[1289];
 $21 = $20;
 $22 = $21 > 3600.0;
 if ($22) {
  $23 = +HEAPF32[1289];
  $24 = $23;
  $25 = $24 - 3600.0;
  $26 = $25;
  HEAPF32[1289] = $26;
 }
 _glutPostRedisplay();
 $27 = HEAP32[1288]|0;
 $28 = (($27) + 1)|0;
 HEAP32[1288] = $28;
 $29 = +HEAPF64[425];
 $30 = $29 < 0.0;
 if ($30) {
  $31 = $1;
  HEAPF64[425] = $31;
 }
 $32 = $1;
 $33 = +HEAPF64[425];
 $34 = $32 - $33;
 $35 = $34 >= 5.0;
 if (!($35)) {
  STACKTOP = sp;return;
 }
 $36 = $1;
 $37 = +HEAPF64[425];
 $38 = $36 - $37;
 $39 = $38;
 $2 = $39;
 $40 = HEAP32[1288]|0;
 $41 = (+($40|0));
 $42 = $2;
 $43 = $41 / $42;
 $3 = $43;
 $44 = HEAP32[1288]|0;
 $45 = $2;
 $46 = $45;
 $47 = $3;
 $48 = $47;
 HEAP32[$vararg_buffer>>2] = $44;
 $vararg_ptr1 = ((($vararg_buffer)) + 8|0);
 HEAPF64[$vararg_ptr1>>3] = $46;
 $vararg_ptr2 = ((($vararg_buffer)) + 16|0);
 HEAPF64[$vararg_ptr2>>3] = $48;
 (_printf(3801,$vararg_buffer)|0);
 $49 = $1;
 HEAPF64[425] = $49;
 HEAP32[1288] = 0;
 STACKTOP = sp;return;
}
function _gears_reshape($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $2;
 $5 = (+($4|0));
 $6 = $3;
 $7 = (+($6|0));
 $8 = $5 / $7;
 _perspective(4048,60.0,$8,1.0,1024.0);
 $9 = $2;
 $10 = $3;
 _glViewport(0,0,($9|0),($10|0));
 STACKTOP = sp;return;
}
function _gears_draw() {
 var $0 = 0, $1 = 0.0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0.0, $25 = 0.0, $26 = 0.0;
 var $27 = 0.0, $28 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $0 = sp;
 _identity($0);
 _glClearColor(0.0,0.0,0.0,0.0);
 _glClear(16640);
 _translate($0,0.0,0.0,-20.0);
 $1 = +HEAPF32[946];
 $2 = $1;
 $3 = 6.2831853071795862 * $2;
 $4 = $3 / 360.0;
 $5 = $4;
 _rotate($0,$5,1.0,0.0,0.0);
 $6 = +HEAPF32[947];
 $7 = $6;
 $8 = 6.2831853071795862 * $7;
 $9 = $8 / 360.0;
 $10 = $9;
 _rotate($0,$10,0.0,1.0,0.0);
 $11 = 0.0;
 $12 = 6.2831853071795862 * $11;
 $13 = $12 / 360.0;
 $14 = $13;
 _rotate($0,$14,0.0,0.0,1.0);
 $15 = HEAP32[1290]|0;
 $16 = +HEAPF32[1289];
 _draw_gear($15,$0,-3.0,-2.0,$16,16);
 $17 = HEAP32[1291]|0;
 $18 = +HEAPF32[1289];
 $19 = -2.0 * $18;
 $20 = $19;
 $21 = $20 - 9.0;
 $22 = $21;
 _draw_gear($17,$0,3.0999999046325684,-2.0,$22,32);
 $23 = HEAP32[1292]|0;
 $24 = +HEAPF32[1289];
 $25 = -2.0 * $24;
 $26 = $25;
 $27 = $26 - 25.0;
 $28 = $27;
 _draw_gear($23,$0,-3.0999999046325684,4.1999998092651367,$28,48);
 _glutSwapBuffers();
 STACKTOP = sp;return;
}
function _gears_special($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0.0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $3;
 switch ($6|0) {
 case 100:  {
  $7 = +HEAPF32[947];
  $8 = $7;
  $9 = $8 + 5.0;
  $10 = $9;
  HEAPF32[947] = $10;
  break;
 }
 case 102:  {
  $11 = +HEAPF32[947];
  $12 = $11;
  $13 = $12 - 5.0;
  $14 = $13;
  HEAPF32[947] = $14;
  break;
 }
 case 101:  {
  $15 = +HEAPF32[946];
  $16 = $15;
  $17 = $16 + 5.0;
  $18 = $17;
  HEAPF32[946] = $18;
  break;
 }
 case 103:  {
  $19 = +HEAPF32[946];
  $20 = $19;
  $21 = $20 - 5.0;
  $22 = $21;
  HEAPF32[946] = $22;
  break;
 }
 case 11:  {
  _glutFullScreen();
  break;
 }
 default: {
 }
 }
 STACKTOP = sp;return;
}
function _gears_init() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(560|0);
 $vararg_buffer4 = sp + 528|0;
 $vararg_buffer1 = sp + 520|0;
 $vararg_buffer = sp + 512|0;
 $3 = sp + 532|0;
 $4 = sp;
 _glEnable(2884);
 _glEnable(2929);
 HEAP32[$3>>2] = 64;
 $5 = (_glCreateShader(35633)|0);
 $0 = $5;
 $6 = $0;
 _glShaderSource(($6|0),1,($3|0),(0|0));
 $7 = $0;
 _glCompileShader(($7|0));
 $8 = $0;
 _glGetShaderInfoLog(($8|0),512,(0|0),($4|0));
 HEAP32[$vararg_buffer>>2] = $4;
 (_printf(3841,$vararg_buffer)|0);
 HEAP32[$3>>2] = 880;
 $9 = (_glCreateShader(35632)|0);
 $1 = $9;
 $10 = $1;
 _glShaderSource(($10|0),1,($3|0),(0|0));
 $11 = $1;
 _glCompileShader(($11|0));
 $12 = $1;
 _glGetShaderInfoLog(($12|0),512,(0|0),($4|0));
 HEAP32[$vararg_buffer1>>2] = $4;
 (_printf(3865,$vararg_buffer1)|0);
 $13 = (_glCreateProgram()|0);
 $2 = $13;
 $14 = $2;
 $15 = $0;
 _glAttachShader(($14|0),($15|0));
 $16 = $2;
 $17 = $1;
 _glAttachShader(($16|0),($17|0));
 $18 = $2;
 _glBindAttribLocation(($18|0),0,(3891|0));
 $19 = $2;
 _glBindAttribLocation(($19|0),1,(3900|0));
 $20 = $2;
 _glLinkProgram(($20|0));
 $21 = $2;
 _glGetProgramInfoLog(($21|0),512,(0|0),($4|0));
 HEAP32[$vararg_buffer4>>2] = $4;
 (_printf(3907,$vararg_buffer4)|0);
 $22 = $2;
 _glUseProgram(($22|0));
 $23 = $2;
 $24 = (_glGetUniformLocation(($23|0),(3917|0))|0);
 HEAP32[1293] = $24;
 $25 = $2;
 $26 = (_glGetUniformLocation(($25|0),(3943|0))|0);
 HEAP32[1294] = $26;
 $27 = $2;
 $28 = (_glGetUniformLocation(($27|0),(3956|0))|0);
 HEAP32[1296] = $28;
 $29 = $2;
 $30 = (_glGetUniformLocation(($29|0),(3976|0))|0);
 HEAP32[1295] = $30;
 $31 = HEAP32[1296]|0;
 _glUniform4fv(($31|0),1,(992|0));
 $32 = (_create_gear(1.0,4.0,1.0,20,0.69999998807907104)|0);
 HEAP32[1290] = $32;
 $33 = (_create_gear(0.5,2.0,2.0,10,0.69999998807907104)|0);
 HEAP32[1291] = $33;
 $34 = (_create_gear(1.2999999523162842,2.0,0.5,10,0.69999998807907104)|0);
 HEAP32[1292] = $34;
 STACKTOP = sp;return;
}
function _translate($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0, $4 = 0, $5 = 0.0;
 var $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $8 = sp;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 HEAPF32[$8>>2] = 1.0;
 $9 = ((($8)) + 4|0);
 HEAPF32[$9>>2] = 0.0;
 $10 = ((($9)) + 4|0);
 HEAPF32[$10>>2] = 0.0;
 $11 = ((($10)) + 4|0);
 HEAPF32[$11>>2] = 0.0;
 $12 = ((($11)) + 4|0);
 HEAPF32[$12>>2] = 0.0;
 $13 = ((($12)) + 4|0);
 HEAPF32[$13>>2] = 1.0;
 $14 = ((($13)) + 4|0);
 HEAPF32[$14>>2] = 0.0;
 $15 = ((($14)) + 4|0);
 HEAPF32[$15>>2] = 0.0;
 $16 = ((($15)) + 4|0);
 HEAPF32[$16>>2] = 0.0;
 $17 = ((($16)) + 4|0);
 HEAPF32[$17>>2] = 0.0;
 $18 = ((($17)) + 4|0);
 HEAPF32[$18>>2] = 1.0;
 $19 = ((($18)) + 4|0);
 HEAPF32[$19>>2] = 0.0;
 $20 = ((($19)) + 4|0);
 $21 = $5;
 HEAPF32[$20>>2] = $21;
 $22 = ((($20)) + 4|0);
 $23 = $6;
 HEAPF32[$22>>2] = $23;
 $24 = ((($22)) + 4|0);
 $25 = $7;
 HEAPF32[$24>>2] = $25;
 $26 = ((($24)) + 4|0);
 HEAPF32[$26>>2] = 1.0;
 $27 = $4;
 _multiply($27,$8);
 STACKTOP = sp;return;
}
function _rotate($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 $4 = +$4;
 var $10 = 0, $100 = 0.0, $101 = 0.0, $102 = 0.0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0.0, $114 = 0.0, $115 = 0.0, $116 = 0.0, $117 = 0.0;
 var $118 = 0.0, $119 = 0.0, $12 = 0, $120 = 0.0, $121 = 0.0, $122 = 0, $123 = 0.0, $124 = 0.0, $125 = 0.0, $126 = 0.0, $127 = 0.0, $128 = 0.0, $129 = 0.0, $13 = 0.0, $130 = 0.0, $131 = 0.0, $132 = 0.0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0.0, $30 = 0.0;
 var $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0.0, $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0, $5 = 0;
 var $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0;
 var $69 = 0.0, $7 = 0.0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0.0, $79 = 0, $8 = 0.0, $80 = 0.0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0.0;
 var $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0.0, $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0, $95 = 0.0, $96 = 0.0, $97 = 0.0, $98 = 0.0, $99 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(112|0);
 $10 = sp + 72|0;
 $11 = sp + 64|0;
 $12 = sp;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $13 = $6;
 $14 = $13;
 __sincos($14,$10,$11);
 $15 = $7;
 $16 = $7;
 $17 = $15 * $16;
 $18 = $17;
 $19 = +HEAPF64[$11>>3];
 $20 = 1.0 - $19;
 $21 = $18 * $20;
 $22 = +HEAPF64[$11>>3];
 $23 = $21 + $22;
 $24 = $23;
 HEAPF32[$12>>2] = $24;
 $25 = ((($12)) + 4|0);
 $26 = $8;
 $27 = $7;
 $28 = $26 * $27;
 $29 = $28;
 $30 = +HEAPF64[$11>>3];
 $31 = 1.0 - $30;
 $32 = $29 * $31;
 $33 = $9;
 $34 = $33;
 $35 = +HEAPF64[$10>>3];
 $36 = $34 * $35;
 $37 = $32 + $36;
 $38 = $37;
 HEAPF32[$25>>2] = $38;
 $39 = ((($25)) + 4|0);
 $40 = $7;
 $41 = $9;
 $42 = $40 * $41;
 $43 = $42;
 $44 = +HEAPF64[$11>>3];
 $45 = 1.0 - $44;
 $46 = $43 * $45;
 $47 = $8;
 $48 = $47;
 $49 = +HEAPF64[$10>>3];
 $50 = $48 * $49;
 $51 = $46 - $50;
 $52 = $51;
 HEAPF32[$39>>2] = $52;
 $53 = ((($39)) + 4|0);
 HEAPF32[$53>>2] = 0.0;
 $54 = ((($53)) + 4|0);
 $55 = $7;
 $56 = $8;
 $57 = $55 * $56;
 $58 = $57;
 $59 = +HEAPF64[$11>>3];
 $60 = 1.0 - $59;
 $61 = $58 * $60;
 $62 = $9;
 $63 = $62;
 $64 = +HEAPF64[$10>>3];
 $65 = $63 * $64;
 $66 = $61 - $65;
 $67 = $66;
 HEAPF32[$54>>2] = $67;
 $68 = ((($54)) + 4|0);
 $69 = $8;
 $70 = $8;
 $71 = $69 * $70;
 $72 = $71;
 $73 = +HEAPF64[$11>>3];
 $74 = 1.0 - $73;
 $75 = $72 * $74;
 $76 = +HEAPF64[$11>>3];
 $77 = $75 + $76;
 $78 = $77;
 HEAPF32[$68>>2] = $78;
 $79 = ((($68)) + 4|0);
 $80 = $8;
 $81 = $9;
 $82 = $80 * $81;
 $83 = $82;
 $84 = +HEAPF64[$11>>3];
 $85 = 1.0 - $84;
 $86 = $83 * $85;
 $87 = $7;
 $88 = $87;
 $89 = +HEAPF64[$10>>3];
 $90 = $88 * $89;
 $91 = $86 + $90;
 $92 = $91;
 HEAPF32[$79>>2] = $92;
 $93 = ((($79)) + 4|0);
 HEAPF32[$93>>2] = 0.0;
 $94 = ((($93)) + 4|0);
 $95 = $7;
 $96 = $9;
 $97 = $95 * $96;
 $98 = $97;
 $99 = +HEAPF64[$11>>3];
 $100 = 1.0 - $99;
 $101 = $98 * $100;
 $102 = $8;
 $103 = $102;
 $104 = +HEAPF64[$10>>3];
 $105 = $103 * $104;
 $106 = $101 + $105;
 $107 = $106;
 HEAPF32[$94>>2] = $107;
 $108 = ((($94)) + 4|0);
 $109 = $8;
 $110 = $9;
 $111 = $109 * $110;
 $112 = $111;
 $113 = +HEAPF64[$11>>3];
 $114 = 1.0 - $113;
 $115 = $112 * $114;
 $116 = $7;
 $117 = $116;
 $118 = +HEAPF64[$10>>3];
 $119 = $117 * $118;
 $120 = $115 - $119;
 $121 = $120;
 HEAPF32[$108>>2] = $121;
 $122 = ((($108)) + 4|0);
 $123 = $9;
 $124 = $9;
 $125 = $123 * $124;
 $126 = $125;
 $127 = +HEAPF64[$11>>3];
 $128 = 1.0 - $127;
 $129 = $126 * $128;
 $130 = +HEAPF64[$11>>3];
 $131 = $129 + $130;
 $132 = $131;
 HEAPF32[$122>>2] = $132;
 $133 = ((($122)) + 4|0);
 HEAPF32[$133>>2] = 0.0;
 $134 = ((($133)) + 4|0);
 HEAPF32[$134>>2] = 0.0;
 $135 = ((($134)) + 4|0);
 HEAPF32[$135>>2] = 0.0;
 $136 = ((($135)) + 4|0);
 HEAPF32[$136>>2] = 0.0;
 $137 = ((($136)) + 4|0);
 HEAPF32[$137>>2] = 1.0;
 $138 = $5;
 _multiply($138,$12);
 STACKTOP = sp;return;
}
function _draw_gear($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = +$3;
 $4 = +$4;
 $5 = $5|0;
 var $10 = 0.0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $12 = sp + 128|0;
 $13 = sp + 64|0;
 $14 = sp;
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $11 = $5;
 $16 = $7;
 dest=$12; src=$16; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $17 = $8;
 $18 = $9;
 _translate($12,$17,$18,0.0);
 $19 = $10;
 $20 = $19;
 $21 = 6.2831853071795862 * $20;
 $22 = $21 / 360.0;
 $23 = $22;
 _rotate($12,$23,0.0,0.0,1.0);
 dest=$14; src=4048; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _multiply($14,$12);
 $24 = HEAP32[1293]|0;
 _glUniformMatrix4fv(($24|0),1,0,($14|0));
 dest=$13; src=$12; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 _invert($13);
 _transpose($13);
 $25 = HEAP32[1294]|0;
 _glUniformMatrix4fv(($25|0),1,0,($13|0));
 $26 = HEAP32[1295]|0;
 $27 = $11;
 _glUniform4fv(($26|0),1,($27|0));
 $28 = $6;
 $29 = ((($28)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 _glBindBuffer(34962,($30|0));
 _glVertexAttribPointer(0,3,5126,0,24,(0|0));
 _glVertexAttribPointer(1,3,5126,0,24,((((0) + 12|0))|0));
 _glEnableVertexAttribArray(0);
 _glEnableVertexAttribArray(1);
 $15 = 0;
 while(1) {
  $31 = $15;
  $32 = $6;
  $33 = ((($32)) + 12|0);
  $34 = HEAP32[$33>>2]|0;
  $35 = ($31|0)<($34|0);
  if (!($35)) {
   break;
  }
  $36 = $6;
  $37 = ((($36)) + 8|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = $15;
  $40 = (($38) + ($39<<3)|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = $6;
  $43 = ((($42)) + 8|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = $15;
  $46 = (($44) + ($45<<3)|0);
  $47 = ((($46)) + 4|0);
  $48 = HEAP32[$47>>2]|0;
  _glDrawArrays(5,($41|0),($48|0));
  $49 = $15;
  $50 = (($49) + 1)|0;
  $15 = $50;
 }
 _glDisableVertexAttribArray(1);
 _glDisableVertexAttribArray(0);
 STACKTOP = sp;return;
}
function _multiply($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(112|0);
 $4 = sp;
 $7 = sp + 80|0;
 $10 = sp + 64|0;
 $2 = $0;
 $3 = $1;
 $8 = 0;
 while(1) {
  $11 = $8;
  $12 = ($11|0)<(16);
  if (!($12)) {
   break;
  }
  $13 = $8;
  $14 = (($4) + ($13<<2)|0);
  HEAPF32[$14>>2] = 0.0;
  $15 = $8;
  _div($10,$15,4);
  ;HEAP32[$7>>2]=HEAP32[$10>>2]|0;HEAP32[$7+4>>2]=HEAP32[$10+4>>2]|0;
  $16 = $3;
  $17 = HEAP32[$7>>2]|0;
  $18 = $17<<2;
  $19 = (($16) + ($18<<2)|0);
  $5 = $19;
  $20 = $2;
  $21 = ((($7)) + 4|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22<<2)|0);
  $6 = $23;
  $9 = 0;
  while(1) {
   $24 = $9;
   $25 = ($24|0)<(4);
   if (!($25)) {
    break;
   }
   $26 = $5;
   $27 = $9;
   $28 = (($26) + ($27<<2)|0);
   $29 = +HEAPF32[$28>>2];
   $30 = $6;
   $31 = $9;
   $32 = $31<<2;
   $33 = (($30) + ($32<<2)|0);
   $34 = +HEAPF32[$33>>2];
   $35 = $29 * $34;
   $36 = $8;
   $37 = (($4) + ($36<<2)|0);
   $38 = +HEAPF32[$37>>2];
   $39 = $38 + $35;
   HEAPF32[$37>>2] = $39;
   $40 = $9;
   $41 = (($40) + 1)|0;
   $9 = $41;
  }
  $42 = $8;
  $43 = (($42) + 1)|0;
  $8 = $43;
 }
 $44 = $2;
 dest=$44; src=$4; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _invert($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0;
 var $5 = 0.0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $2 = sp;
 $1 = $0;
 _identity($2);
 $3 = $1;
 $4 = ((($3)) + 48|0);
 $5 = +HEAPF32[$4>>2];
 $6 = - $5;
 $7 = ((($2)) + 48|0);
 HEAPF32[$7>>2] = $6;
 $8 = $1;
 $9 = ((($8)) + 52|0);
 $10 = +HEAPF32[$9>>2];
 $11 = - $10;
 $12 = ((($2)) + 52|0);
 HEAPF32[$12>>2] = $11;
 $13 = $1;
 $14 = ((($13)) + 56|0);
 $15 = +HEAPF32[$14>>2];
 $16 = - $15;
 $17 = ((($2)) + 56|0);
 HEAPF32[$17>>2] = $16;
 $18 = $1;
 $19 = ((($18)) + 56|0);
 HEAPF32[$19>>2] = 0.0;
 $20 = $1;
 $21 = ((($20)) + 52|0);
 HEAPF32[$21>>2] = 0.0;
 $22 = $1;
 $23 = ((($22)) + 48|0);
 HEAPF32[$23>>2] = 0.0;
 $24 = $1;
 _transpose($24);
 $25 = $1;
 _multiply($25,$2);
 STACKTOP = sp;return;
}
function _transpose($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0.0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0.0, $65 = 0, $7 = 0, $8 = 0.0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $2 = sp;
 $1 = $0;
 $3 = $1;
 $4 = +HEAPF32[$3>>2];
 HEAPF32[$2>>2] = $4;
 $5 = ((($2)) + 4|0);
 $6 = $1;
 $7 = ((($6)) + 16|0);
 $8 = +HEAPF32[$7>>2];
 HEAPF32[$5>>2] = $8;
 $9 = ((($5)) + 4|0);
 $10 = $1;
 $11 = ((($10)) + 32|0);
 $12 = +HEAPF32[$11>>2];
 HEAPF32[$9>>2] = $12;
 $13 = ((($9)) + 4|0);
 $14 = $1;
 $15 = ((($14)) + 48|0);
 $16 = +HEAPF32[$15>>2];
 HEAPF32[$13>>2] = $16;
 $17 = ((($13)) + 4|0);
 $18 = $1;
 $19 = ((($18)) + 4|0);
 $20 = +HEAPF32[$19>>2];
 HEAPF32[$17>>2] = $20;
 $21 = ((($17)) + 4|0);
 $22 = $1;
 $23 = ((($22)) + 20|0);
 $24 = +HEAPF32[$23>>2];
 HEAPF32[$21>>2] = $24;
 $25 = ((($21)) + 4|0);
 $26 = $1;
 $27 = ((($26)) + 36|0);
 $28 = +HEAPF32[$27>>2];
 HEAPF32[$25>>2] = $28;
 $29 = ((($25)) + 4|0);
 $30 = $1;
 $31 = ((($30)) + 52|0);
 $32 = +HEAPF32[$31>>2];
 HEAPF32[$29>>2] = $32;
 $33 = ((($29)) + 4|0);
 $34 = $1;
 $35 = ((($34)) + 8|0);
 $36 = +HEAPF32[$35>>2];
 HEAPF32[$33>>2] = $36;
 $37 = ((($33)) + 4|0);
 $38 = $1;
 $39 = ((($38)) + 24|0);
 $40 = +HEAPF32[$39>>2];
 HEAPF32[$37>>2] = $40;
 $41 = ((($37)) + 4|0);
 $42 = $1;
 $43 = ((($42)) + 40|0);
 $44 = +HEAPF32[$43>>2];
 HEAPF32[$41>>2] = $44;
 $45 = ((($41)) + 4|0);
 $46 = $1;
 $47 = ((($46)) + 56|0);
 $48 = +HEAPF32[$47>>2];
 HEAPF32[$45>>2] = $48;
 $49 = ((($45)) + 4|0);
 $50 = $1;
 $51 = ((($50)) + 12|0);
 $52 = +HEAPF32[$51>>2];
 HEAPF32[$49>>2] = $52;
 $53 = ((($49)) + 4|0);
 $54 = $1;
 $55 = ((($54)) + 28|0);
 $56 = +HEAPF32[$55>>2];
 HEAPF32[$53>>2] = $56;
 $57 = ((($53)) + 4|0);
 $58 = $1;
 $59 = ((($58)) + 44|0);
 $60 = +HEAPF32[$59>>2];
 HEAPF32[$57>>2] = $60;
 $61 = ((($57)) + 4|0);
 $62 = $1;
 $63 = ((($62)) + 60|0);
 $64 = +HEAPF32[$63>>2];
 HEAPF32[$61>>2] = $64;
 $65 = $1;
 dest=$65; src=$2; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 STACKTOP = sp;return;
}
function _create_gear($0,$1,$2,$3,$4) {
 $0 = +$0;
 $1 = +$1;
 $2 = +$2;
 $3 = $3|0;
 $4 = +$4;
 var $10 = 0.0, $100 = 0.0, $101 = 0.0, $102 = 0, $103 = 0, $104 = 0, $105 = 0.0, $106 = 0.0, $107 = 0.0, $108 = 0, $109 = 0.0, $11 = 0.0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0.0, $114 = 0.0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0.0, $119 = 0.0, $12 = 0.0, $120 = 0.0, $121 = 0, $122 = 0.0, $123 = 0.0, $124 = 0.0, $125 = 0.0, $126 = 0.0, $127 = 0.0, $128 = 0, $129 = 0, $13 = 0.0, $130 = 0.0, $131 = 0.0, $132 = 0, $133 = 0.0, $134 = 0.0, $135 = 0.0;
 var $136 = 0, $137 = 0.0, $138 = 0.0, $139 = 0, $14 = 0.0, $140 = 0.0, $141 = 0.0, $142 = 0.0, $143 = 0, $144 = 0.0, $145 = 0.0, $146 = 0, $147 = 0.0, $148 = 0.0, $149 = 0.0, $15 = 0, $150 = 0, $151 = 0.0, $152 = 0.0, $153 = 0;
 var $154 = 0.0, $155 = 0.0, $156 = 0.0, $157 = 0, $158 = 0.0, $159 = 0.0, $16 = 0, $160 = 0.0, $161 = 0.0, $162 = 0.0, $163 = 0, $164 = 0.0, $165 = 0.0, $166 = 0.0, $167 = 0.0, $168 = 0.0, $169 = 0, $17 = 0, $170 = 0.0, $171 = 0.0;
 var $172 = 0, $173 = 0.0, $174 = 0.0, $175 = 0.0, $176 = 0, $177 = 0.0, $178 = 0.0, $179 = 0, $18 = 0, $180 = 0.0, $181 = 0.0, $182 = 0.0, $183 = 0, $184 = 0.0, $185 = 0.0, $186 = 0.0, $187 = 0.0, $188 = 0.0, $189 = 0, $19 = 0;
 var $190 = 0.0, $191 = 0.0, $192 = 0.0, $193 = 0.0, $194 = 0.0, $195 = 0, $196 = 0.0, $197 = 0.0, $198 = 0, $199 = 0.0, $20 = 0, $200 = 0.0, $201 = 0.0, $202 = 0, $203 = 0.0, $204 = 0.0, $205 = 0, $206 = 0.0, $207 = 0.0, $208 = 0.0;
 var $209 = 0, $21 = 0, $210 = 0.0, $211 = 0.0, $212 = 0, $213 = 0.0, $214 = 0.0, $215 = 0.0, $216 = 0, $217 = 0.0, $218 = 0.0, $219 = 0, $22 = 0, $220 = 0.0, $221 = 0.0, $222 = 0.0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0.0, $239 = 0, $24 = 0, $240 = 0.0, $241 = 0.0, $242 = 0.0, $243 = 0.0, $244 = 0.0;
 var $245 = 0.0, $246 = 0, $247 = 0, $248 = 0, $249 = 0.0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0.0, $254 = 0.0, $255 = 0.0, $256 = 0.0, $257 = 0.0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0.0, $262 = 0;
 var $263 = 0, $264 = 0.0, $265 = 0.0, $266 = 0.0, $267 = 0.0, $268 = 0.0, $269 = 0.0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0.0, $274 = 0, $275 = 0, $276 = 0.0, $277 = 0.0, $278 = 0.0, $279 = 0.0, $28 = 0, $280 = 0.0;
 var $281 = 0.0, $282 = 0, $283 = 0, $284 = 0, $285 = 0.0, $286 = 0, $287 = 0, $288 = 0.0, $289 = 0.0, $29 = 0, $290 = 0.0, $291 = 0.0, $292 = 0.0, $293 = 0.0, $294 = 0, $295 = 0, $296 = 0, $297 = 0.0, $298 = 0, $299 = 0;
 var $30 = 0, $300 = 0.0, $301 = 0.0, $302 = 0.0, $303 = 0.0, $304 = 0.0, $305 = 0.0, $306 = 0, $307 = 0, $308 = 0, $309 = 0.0, $31 = 0, $310 = 0, $311 = 0, $312 = 0.0, $313 = 0.0, $314 = 0.0, $315 = 0.0, $316 = 0.0, $317 = 0.0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0.0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0.0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0.0, $357 = 0, $358 = 0, $359 = 0.0, $36 = 0.0, $360 = 0.0, $361 = 0, $362 = 0.0, $363 = 0, $364 = 0.0, $365 = 0.0, $366 = 0.0, $367 = 0, $368 = 0, $369 = 0, $37 = 0.0, $370 = 0, $371 = 0.0;
 var $372 = 0, $373 = 0, $374 = 0.0, $375 = 0.0, $376 = 0.0, $377 = 0.0, $378 = 0.0, $379 = 0.0, $38 = 0.0, $380 = 0, $381 = 0, $382 = 0, $383 = 0.0, $384 = 0, $385 = 0, $386 = 0.0, $387 = 0.0, $388 = 0.0, $389 = 0.0, $39 = 0.0;
 var $390 = 0.0, $391 = 0.0, $392 = 0, $393 = 0, $394 = 0, $395 = 0.0, $396 = 0, $397 = 0, $398 = 0.0, $399 = 0.0, $40 = 0.0, $400 = 0.0, $401 = 0.0, $402 = 0.0, $403 = 0.0, $404 = 0, $405 = 0, $406 = 0, $407 = 0.0, $408 = 0;
 var $409 = 0, $41 = 0.0, $410 = 0.0, $411 = 0.0, $412 = 0.0, $413 = 0.0, $414 = 0.0, $415 = 0.0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0.0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0.0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0.0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0.0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0.0, $457 = 0, $458 = 0, $459 = 0.0, $46 = 0.0, $460 = 0.0, $461 = 0.0, $462 = 0.0;
 var $463 = 0.0, $464 = 0.0, $465 = 0, $466 = 0, $467 = 0, $468 = 0.0, $469 = 0, $47 = 0.0, $470 = 0, $471 = 0.0, $472 = 0.0, $473 = 0.0, $474 = 0.0, $475 = 0.0, $476 = 0.0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0.0;
 var $481 = 0, $482 = 0, $483 = 0.0, $484 = 0.0, $485 = 0.0, $486 = 0.0, $487 = 0.0, $488 = 0.0, $489 = 0, $49 = 0.0, $490 = 0, $491 = 0, $492 = 0.0, $493 = 0, $494 = 0, $495 = 0.0, $496 = 0.0, $497 = 0.0, $498 = 0.0, $499 = 0.0;
 var $5 = 0, $50 = 0.0, $500 = 0.0, $501 = 0, $502 = 0, $503 = 0, $504 = 0.0, $505 = 0, $506 = 0, $507 = 0.0, $508 = 0.0, $509 = 0.0, $51 = 0.0, $510 = 0.0, $511 = 0.0, $512 = 0.0, $513 = 0, $514 = 0, $515 = 0, $516 = 0.0;
 var $517 = 0, $518 = 0, $519 = 0.0, $52 = 0.0, $520 = 0.0, $521 = 0.0, $522 = 0.0, $523 = 0.0, $524 = 0.0, $525 = 0, $526 = 0, $527 = 0.0, $528 = 0, $529 = 0.0, $53 = 0, $530 = 0.0, $531 = 0.0, $532 = 0.0, $533 = 0.0, $534 = 0.0;
 var $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0;
 var $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0;
 var $571 = 0, $572 = 0.0, $573 = 0, $574 = 0, $575 = 0.0, $576 = 0.0, $577 = 0.0, $578 = 0, $579 = 0.0, $58 = 0, $580 = 0.0, $581 = 0.0, $582 = 0, $583 = 0, $584 = 0, $585 = 0.0, $586 = 0, $587 = 0.0, $588 = 0.0, $589 = 0.0;
 var $59 = 0, $590 = 0.0, $591 = 0.0, $592 = 0.0, $593 = 0, $594 = 0, $595 = 0.0, $596 = 0, $597 = 0.0, $598 = 0.0, $599 = 0.0, $6 = 0.0, $60 = 0, $600 = 0.0, $601 = 0.0, $602 = 0.0, $603 = 0, $604 = 0, $605 = 0, $606 = 0.0;
 var $607 = 0, $608 = 0, $609 = 0.0, $61 = 0, $610 = 0.0, $611 = 0.0, $612 = 0.0, $613 = 0.0, $614 = 0.0, $615 = 0, $616 = 0, $617 = 0, $618 = 0.0, $619 = 0, $62 = 0, $620 = 0, $621 = 0.0, $622 = 0.0, $623 = 0.0, $624 = 0.0;
 var $625 = 0.0, $626 = 0.0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0;
 var $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0;
 var $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0.0, $666 = 0, $667 = 0.0, $668 = 0.0, $669 = 0, $67 = 0, $670 = 0.0, $671 = 0.0, $672 = 0.0, $673 = 0.0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0.0, $679 = 0;
 var $68 = 0, $680 = 0, $681 = 0.0, $682 = 0.0, $683 = 0.0, $684 = 0.0, $685 = 0.0, $686 = 0.0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0.0, $691 = 0, $692 = 0, $693 = 0.0, $694 = 0.0, $695 = 0.0, $696 = 0.0, $697 = 0.0;
 var $698 = 0.0, $699 = 0, $7 = 0.0, $70 = 0, $700 = 0, $701 = 0.0, $702 = 0, $703 = 0.0, $704 = 0.0, $705 = 0.0, $706 = 0.0, $707 = 0.0, $708 = 0.0, $709 = 0, $71 = 0, $710 = 0, $711 = 0.0, $712 = 0, $713 = 0.0, $714 = 0.0;
 var $715 = 0.0, $716 = 0.0, $717 = 0.0, $718 = 0.0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0.0, $730 = 0, $731 = 0, $732 = 0;
 var $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0.0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0.0, $750 = 0;
 var $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0.0, $758 = 0, $759 = 0, $76 = 0, $760 = 0.0, $761 = 0.0, $762 = 0, $763 = 0.0, $764 = 0, $765 = 0.0, $766 = 0.0, $767 = 0.0, $768 = 0, $769 = 0;
 var $77 = 0.0, $770 = 0, $771 = 0, $772 = 0.0, $773 = 0, $774 = 0, $775 = 0.0, $776 = 0.0, $777 = 0.0, $778 = 0.0, $779 = 0.0, $78 = 0.0, $780 = 0.0, $781 = 0, $782 = 0, $783 = 0, $784 = 0.0, $785 = 0, $786 = 0, $787 = 0.0;
 var $788 = 0.0, $789 = 0.0, $79 = 0, $790 = 0.0, $791 = 0.0, $792 = 0.0, $793 = 0, $794 = 0, $795 = 0, $796 = 0.0, $797 = 0, $798 = 0, $799 = 0.0, $8 = 0.0, $80 = 0.0, $800 = 0.0, $801 = 0.0, $802 = 0.0, $803 = 0.0, $804 = 0.0;
 var $805 = 0, $806 = 0, $807 = 0, $808 = 0.0, $809 = 0, $81 = 0.0, $810 = 0, $811 = 0.0, $812 = 0.0, $813 = 0.0, $814 = 0.0, $815 = 0.0, $816 = 0.0, $817 = 0, $818 = 0, $819 = 0, $82 = 0.0, $820 = 0, $821 = 0, $822 = 0;
 var $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0.0, $840 = 0;
 var $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0.0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0.0, $856 = 0, $857 = 0, $858 = 0.0, $859 = 0.0;
 var $86 = 0.0, $860 = 0, $861 = 0.0, $862 = 0, $863 = 0.0, $864 = 0.0, $865 = 0.0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0.0, $870 = 0.0, $871 = 0, $872 = 0, $873 = 0.0, $874 = 0.0, $875 = 0.0, $876 = 0.0, $877 = 0.0;
 var $878 = 0.0, $879 = 0, $88 = 0.0, $880 = 0, $881 = 0, $882 = 0.0, $883 = 0, $884 = 0, $885 = 0.0, $886 = 0.0, $887 = 0.0, $888 = 0.0, $889 = 0.0, $89 = 0, $890 = 0.0, $891 = 0, $892 = 0, $893 = 0, $894 = 0.0, $895 = 0;
 var $896 = 0, $897 = 0.0, $898 = 0.0, $899 = 0.0, $9 = 0, $90 = 0, $900 = 0.0, $901 = 0.0, $902 = 0.0, $903 = 0, $904 = 0, $905 = 0, $906 = 0.0, $907 = 0, $908 = 0, $909 = 0.0, $91 = 0, $910 = 0.0, $911 = 0.0, $912 = 0.0;
 var $913 = 0.0, $914 = 0.0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0.0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0.0, $930 = 0;
 var $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0.0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0;
 var $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0.0, $960 = 0, $961 = 0, $962 = 0, $97 = 0.0, $98 = 0.0, $99 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $17 = sp + 112|0;
 $18 = sp + 64|0;
 $19 = sp + 188|0;
 $22 = sp;
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $20 = 0;
 $30 = (_malloc(20)|0);
 $16 = $30;
 $31 = $16;
 $32 = ($31|0)==(0|0);
 if ($32) {
  $5 = 0;
  $962 = $5;
  STACKTOP = sp;return ($962|0);
 }
 $33 = $6;
 $11 = $33;
 $34 = $7;
 $35 = $34;
 $36 = $10;
 $37 = $36;
 $38 = $37 / 2.0;
 $39 = $35 - $38;
 $40 = $39;
 $12 = $40;
 $41 = $7;
 $42 = $41;
 $43 = $10;
 $44 = $43;
 $45 = $44 / 2.0;
 $46 = $42 + $45;
 $47 = $46;
 $13 = $47;
 $48 = $9;
 $49 = (+($48|0));
 $50 = 6.2831853071795862 / $49;
 $51 = $50 / 4.0;
 $52 = $51;
 $14 = $52;
 $53 = $9;
 $54 = ($53*7)|0;
 $55 = $16;
 $56 = ((($55)) + 12|0);
 HEAP32[$56>>2] = $54;
 $57 = $16;
 $58 = ((($57)) + 12|0);
 $59 = HEAP32[$58>>2]|0;
 $60 = (_calloc($59,8)|0);
 $61 = $16;
 $62 = ((($61)) + 8|0);
 HEAP32[$62>>2] = $60;
 $63 = $9;
 $64 = ($63*34)|0;
 $65 = (_calloc($64,24)|0);
 $66 = $16;
 HEAP32[$66>>2] = $65;
 $67 = $16;
 $68 = HEAP32[$67>>2]|0;
 $15 = $68;
 $21 = 0;
 while(1) {
  $69 = $21;
  $70 = $9;
  $71 = ($69|0)<($70|0);
  if (!($71)) {
   break;
  }
  $72 = $21;
  $73 = (+($72|0));
  $74 = $73 * 2.0;
  $75 = $74 * 3.1415926535897931;
  $76 = $9;
  $77 = (+($76|0));
  $78 = $75 / $77;
  __sincos($78,$17,$18);
  $79 = $21;
  $80 = (+($79|0));
  $81 = $80 * 2.0;
  $82 = $81 * 3.1415926535897931;
  $83 = $9;
  $84 = (+($83|0));
  $85 = $82 / $84;
  $86 = $14;
  $87 = $86;
  $88 = $85 + $87;
  $89 = ((($17)) + 8|0);
  $90 = ((($18)) + 8|0);
  __sincos($88,$89,$90);
  $91 = $21;
  $92 = (+($91|0));
  $93 = $92 * 2.0;
  $94 = $93 * 3.1415926535897931;
  $95 = $9;
  $96 = (+($95|0));
  $97 = $94 / $96;
  $98 = $14;
  $99 = $98 * 2.0;
  $100 = $99;
  $101 = $97 + $100;
  $102 = ((($17)) + 16|0);
  $103 = ((($18)) + 16|0);
  __sincos($101,$102,$103);
  $104 = $21;
  $105 = (+($104|0));
  $106 = $105 * 2.0;
  $107 = $106 * 3.1415926535897931;
  $108 = $9;
  $109 = (+($108|0));
  $110 = $107 / $109;
  $111 = $14;
  $112 = $111 * 3.0;
  $113 = $112;
  $114 = $110 + $113;
  $115 = ((($17)) + 24|0);
  $116 = ((($18)) + 24|0);
  __sincos($114,$115,$116);
  $117 = $21;
  $118 = (+($117|0));
  $119 = $118 * 2.0;
  $120 = $119 * 3.1415926535897931;
  $121 = $9;
  $122 = (+($121|0));
  $123 = $120 / $122;
  $124 = $14;
  $125 = $124 * 4.0;
  $126 = $125;
  $127 = $123 + $126;
  $128 = ((($17)) + 32|0);
  $129 = ((($18)) + 32|0);
  __sincos($127,$128,$129);
  $130 = $13;
  $131 = $130;
  $132 = ((($18)) + 8|0);
  $133 = +HEAPF64[$132>>3];
  $134 = $131 * $133;
  $135 = $134;
  HEAPF32[$22>>2] = $135;
  $136 = ((($22)) + 4|0);
  $137 = $13;
  $138 = $137;
  $139 = ((($17)) + 8|0);
  $140 = +HEAPF64[$139>>3];
  $141 = $138 * $140;
  $142 = $141;
  HEAPF32[$136>>2] = $142;
  $143 = ((($22)) + 8|0);
  $144 = $13;
  $145 = $144;
  $146 = ((($18)) + 16|0);
  $147 = +HEAPF64[$146>>3];
  $148 = $145 * $147;
  $149 = $148;
  HEAPF32[$143>>2] = $149;
  $150 = ((($143)) + 4|0);
  $151 = $13;
  $152 = $151;
  $153 = ((($17)) + 16|0);
  $154 = +HEAPF64[$153>>3];
  $155 = $152 * $154;
  $156 = $155;
  HEAPF32[$150>>2] = $156;
  $157 = ((($143)) + 8|0);
  $158 = $12;
  $159 = $158;
  $160 = +HEAPF64[$18>>3];
  $161 = $159 * $160;
  $162 = $161;
  HEAPF32[$157>>2] = $162;
  $163 = ((($157)) + 4|0);
  $164 = $12;
  $165 = $164;
  $166 = +HEAPF64[$17>>3];
  $167 = $165 * $166;
  $168 = $167;
  HEAPF32[$163>>2] = $168;
  $169 = ((($157)) + 8|0);
  $170 = $12;
  $171 = $170;
  $172 = ((($18)) + 24|0);
  $173 = +HEAPF64[$172>>3];
  $174 = $171 * $173;
  $175 = $174;
  HEAPF32[$169>>2] = $175;
  $176 = ((($169)) + 4|0);
  $177 = $12;
  $178 = $177;
  $179 = ((($17)) + 24|0);
  $180 = +HEAPF64[$179>>3];
  $181 = $178 * $180;
  $182 = $181;
  HEAPF32[$176>>2] = $182;
  $183 = ((($169)) + 8|0);
  $184 = $11;
  $185 = $184;
  $186 = +HEAPF64[$18>>3];
  $187 = $185 * $186;
  $188 = $187;
  HEAPF32[$183>>2] = $188;
  $189 = ((($183)) + 4|0);
  $190 = $11;
  $191 = $190;
  $192 = +HEAPF64[$17>>3];
  $193 = $191 * $192;
  $194 = $193;
  HEAPF32[$189>>2] = $194;
  $195 = ((($183)) + 8|0);
  $196 = $12;
  $197 = $196;
  $198 = ((($18)) + 32|0);
  $199 = +HEAPF64[$198>>3];
  $200 = $197 * $199;
  $201 = $200;
  HEAPF32[$195>>2] = $201;
  $202 = ((($195)) + 4|0);
  $203 = $12;
  $204 = $203;
  $205 = ((($17)) + 32|0);
  $206 = +HEAPF64[$205>>3];
  $207 = $204 * $206;
  $208 = $207;
  HEAPF32[$202>>2] = $208;
  $209 = ((($195)) + 8|0);
  $210 = $11;
  $211 = $210;
  $212 = ((($18)) + 32|0);
  $213 = +HEAPF64[$212>>3];
  $214 = $211 * $213;
  $215 = $214;
  HEAPF32[$209>>2] = $215;
  $216 = ((($209)) + 4|0);
  $217 = $11;
  $218 = $217;
  $219 = ((($17)) + 32|0);
  $220 = +HEAPF64[$219>>3];
  $221 = $218 * $220;
  $222 = $221;
  HEAPF32[$216>>2] = $222;
  $223 = $15;
  $224 = $16;
  $225 = HEAP32[$224>>2]|0;
  $226 = $223;
  $227 = $225;
  $228 = (($226) - ($227))|0;
  $229 = (($228|0) / 24)&-1;
  $230 = $16;
  $231 = ((($230)) + 8|0);
  $232 = HEAP32[$231>>2]|0;
  $233 = $20;
  $234 = (($232) + ($233<<3)|0);
  HEAP32[$234>>2] = $229;
  HEAPF32[$19>>2] = 0.0;
  $235 = ((($19)) + 4|0);
  HEAPF32[$235>>2] = 0.0;
  $236 = ((($19)) + 8|0);
  HEAPF32[$236>>2] = 1.0;
  $237 = $15;
  $238 = +HEAPF32[$22>>2];
  $239 = ((($22)) + 4|0);
  $240 = +HEAPF32[$239>>2];
  $241 = $8;
  $242 = 1.0 * $241;
  $243 = $242;
  $244 = $243 * 0.5;
  $245 = $244;
  $246 = (_vert($237,$238,$240,$245,$19)|0);
  $15 = $246;
  $247 = $15;
  $248 = ((($22)) + 8|0);
  $249 = +HEAPF32[$248>>2];
  $250 = ((($22)) + 8|0);
  $251 = ((($250)) + 4|0);
  $252 = +HEAPF32[$251>>2];
  $253 = $8;
  $254 = 1.0 * $253;
  $255 = $254;
  $256 = $255 * 0.5;
  $257 = $256;
  $258 = (_vert($247,$249,$252,$257,$19)|0);
  $15 = $258;
  $259 = $15;
  $260 = ((($22)) + 16|0);
  $261 = +HEAPF32[$260>>2];
  $262 = ((($22)) + 16|0);
  $263 = ((($262)) + 4|0);
  $264 = +HEAPF32[$263>>2];
  $265 = $8;
  $266 = 1.0 * $265;
  $267 = $266;
  $268 = $267 * 0.5;
  $269 = $268;
  $270 = (_vert($259,$261,$264,$269,$19)|0);
  $15 = $270;
  $271 = $15;
  $272 = ((($22)) + 24|0);
  $273 = +HEAPF32[$272>>2];
  $274 = ((($22)) + 24|0);
  $275 = ((($274)) + 4|0);
  $276 = +HEAPF32[$275>>2];
  $277 = $8;
  $278 = 1.0 * $277;
  $279 = $278;
  $280 = $279 * 0.5;
  $281 = $280;
  $282 = (_vert($271,$273,$276,$281,$19)|0);
  $15 = $282;
  $283 = $15;
  $284 = ((($22)) + 32|0);
  $285 = +HEAPF32[$284>>2];
  $286 = ((($22)) + 32|0);
  $287 = ((($286)) + 4|0);
  $288 = +HEAPF32[$287>>2];
  $289 = $8;
  $290 = 1.0 * $289;
  $291 = $290;
  $292 = $291 * 0.5;
  $293 = $292;
  $294 = (_vert($283,$285,$288,$293,$19)|0);
  $15 = $294;
  $295 = $15;
  $296 = ((($22)) + 40|0);
  $297 = +HEAPF32[$296>>2];
  $298 = ((($22)) + 40|0);
  $299 = ((($298)) + 4|0);
  $300 = +HEAPF32[$299>>2];
  $301 = $8;
  $302 = 1.0 * $301;
  $303 = $302;
  $304 = $303 * 0.5;
  $305 = $304;
  $306 = (_vert($295,$297,$300,$305,$19)|0);
  $15 = $306;
  $307 = $15;
  $308 = ((($22)) + 48|0);
  $309 = +HEAPF32[$308>>2];
  $310 = ((($22)) + 48|0);
  $311 = ((($310)) + 4|0);
  $312 = +HEAPF32[$311>>2];
  $313 = $8;
  $314 = 1.0 * $313;
  $315 = $314;
  $316 = $315 * 0.5;
  $317 = $316;
  $318 = (_vert($307,$309,$312,$317,$19)|0);
  $15 = $318;
  $319 = $15;
  $320 = $16;
  $321 = HEAP32[$320>>2]|0;
  $322 = $319;
  $323 = $321;
  $324 = (($322) - ($323))|0;
  $325 = (($324|0) / 24)&-1;
  $23 = $325;
  $326 = $23;
  $327 = $16;
  $328 = ((($327)) + 8|0);
  $329 = HEAP32[$328>>2]|0;
  $330 = $20;
  $331 = (($329) + ($330<<3)|0);
  $332 = HEAP32[$331>>2]|0;
  $333 = (($326) - ($332))|0;
  $334 = $16;
  $335 = ((($334)) + 8|0);
  $336 = HEAP32[$335>>2]|0;
  $337 = $20;
  $338 = (($336) + ($337<<3)|0);
  $339 = ((($338)) + 4|0);
  HEAP32[$339>>2] = $333;
  $340 = $20;
  $341 = (($340) + 1)|0;
  $20 = $341;
  $342 = $15;
  $343 = $16;
  $344 = HEAP32[$343>>2]|0;
  $345 = $342;
  $346 = $344;
  $347 = (($345) - ($346))|0;
  $348 = (($347|0) / 24)&-1;
  $349 = $16;
  $350 = ((($349)) + 8|0);
  $351 = HEAP32[$350>>2]|0;
  $352 = $20;
  $353 = (($351) + ($352<<3)|0);
  HEAP32[$353>>2] = $348;
  $354 = ((($22)) + 32|0);
  $355 = ((($354)) + 4|0);
  $356 = +HEAPF32[$355>>2];
  $357 = ((($22)) + 48|0);
  $358 = ((($357)) + 4|0);
  $359 = +HEAPF32[$358>>2];
  $360 = $356 - $359;
  HEAPF32[$19>>2] = $360;
  $361 = ((($22)) + 32|0);
  $362 = +HEAPF32[$361>>2];
  $363 = ((($22)) + 48|0);
  $364 = +HEAPF32[$363>>2];
  $365 = $362 - $364;
  $366 = - $365;
  $367 = ((($19)) + 4|0);
  HEAPF32[$367>>2] = $366;
  $368 = ((($19)) + 8|0);
  HEAPF32[$368>>2] = 0.0;
  $369 = $15;
  $370 = ((($22)) + 32|0);
  $371 = +HEAPF32[$370>>2];
  $372 = ((($22)) + 32|0);
  $373 = ((($372)) + 4|0);
  $374 = +HEAPF32[$373>>2];
  $375 = $8;
  $376 = -1.0 * $375;
  $377 = $376;
  $378 = $377 * 0.5;
  $379 = $378;
  $380 = (_vert($369,$371,$374,$379,$19)|0);
  $15 = $380;
  $381 = $15;
  $382 = ((($22)) + 32|0);
  $383 = +HEAPF32[$382>>2];
  $384 = ((($22)) + 32|0);
  $385 = ((($384)) + 4|0);
  $386 = +HEAPF32[$385>>2];
  $387 = $8;
  $388 = 1.0 * $387;
  $389 = $388;
  $390 = $389 * 0.5;
  $391 = $390;
  $392 = (_vert($381,$383,$386,$391,$19)|0);
  $15 = $392;
  $393 = $15;
  $394 = ((($22)) + 48|0);
  $395 = +HEAPF32[$394>>2];
  $396 = ((($22)) + 48|0);
  $397 = ((($396)) + 4|0);
  $398 = +HEAPF32[$397>>2];
  $399 = $8;
  $400 = -1.0 * $399;
  $401 = $400;
  $402 = $401 * 0.5;
  $403 = $402;
  $404 = (_vert($393,$395,$398,$403,$19)|0);
  $15 = $404;
  $405 = $15;
  $406 = ((($22)) + 48|0);
  $407 = +HEAPF32[$406>>2];
  $408 = ((($22)) + 48|0);
  $409 = ((($408)) + 4|0);
  $410 = +HEAPF32[$409>>2];
  $411 = $8;
  $412 = 1.0 * $411;
  $413 = $412;
  $414 = $413 * 0.5;
  $415 = $414;
  $416 = (_vert($405,$407,$410,$415,$19)|0);
  $15 = $416;
  $417 = $15;
  $418 = $16;
  $419 = HEAP32[$418>>2]|0;
  $420 = $417;
  $421 = $419;
  $422 = (($420) - ($421))|0;
  $423 = (($422|0) / 24)&-1;
  $24 = $423;
  $424 = $24;
  $425 = $16;
  $426 = ((($425)) + 8|0);
  $427 = HEAP32[$426>>2]|0;
  $428 = $20;
  $429 = (($427) + ($428<<3)|0);
  $430 = HEAP32[$429>>2]|0;
  $431 = (($424) - ($430))|0;
  $432 = $16;
  $433 = ((($432)) + 8|0);
  $434 = HEAP32[$433>>2]|0;
  $435 = $20;
  $436 = (($434) + ($435<<3)|0);
  $437 = ((($436)) + 4|0);
  HEAP32[$437>>2] = $431;
  $438 = $20;
  $439 = (($438) + 1)|0;
  $20 = $439;
  $440 = $15;
  $441 = $16;
  $442 = HEAP32[$441>>2]|0;
  $443 = $440;
  $444 = $442;
  $445 = (($443) - ($444))|0;
  $446 = (($445|0) / 24)&-1;
  $447 = $16;
  $448 = ((($447)) + 8|0);
  $449 = HEAP32[$448>>2]|0;
  $450 = $20;
  $451 = (($449) + ($450<<3)|0);
  HEAP32[$451>>2] = $446;
  HEAPF32[$19>>2] = 0.0;
  $452 = ((($19)) + 4|0);
  HEAPF32[$452>>2] = 0.0;
  $453 = ((($19)) + 8|0);
  HEAPF32[$453>>2] = -1.0;
  $454 = $15;
  $455 = ((($22)) + 48|0);
  $456 = +HEAPF32[$455>>2];
  $457 = ((($22)) + 48|0);
  $458 = ((($457)) + 4|0);
  $459 = +HEAPF32[$458>>2];
  $460 = $8;
  $461 = -1.0 * $460;
  $462 = $461;
  $463 = $462 * 0.5;
  $464 = $463;
  $465 = (_vert($454,$456,$459,$464,$19)|0);
  $15 = $465;
  $466 = $15;
  $467 = ((($22)) + 40|0);
  $468 = +HEAPF32[$467>>2];
  $469 = ((($22)) + 40|0);
  $470 = ((($469)) + 4|0);
  $471 = +HEAPF32[$470>>2];
  $472 = $8;
  $473 = -1.0 * $472;
  $474 = $473;
  $475 = $474 * 0.5;
  $476 = $475;
  $477 = (_vert($466,$468,$471,$476,$19)|0);
  $15 = $477;
  $478 = $15;
  $479 = ((($22)) + 32|0);
  $480 = +HEAPF32[$479>>2];
  $481 = ((($22)) + 32|0);
  $482 = ((($481)) + 4|0);
  $483 = +HEAPF32[$482>>2];
  $484 = $8;
  $485 = -1.0 * $484;
  $486 = $485;
  $487 = $486 * 0.5;
  $488 = $487;
  $489 = (_vert($478,$480,$483,$488,$19)|0);
  $15 = $489;
  $490 = $15;
  $491 = ((($22)) + 24|0);
  $492 = +HEAPF32[$491>>2];
  $493 = ((($22)) + 24|0);
  $494 = ((($493)) + 4|0);
  $495 = +HEAPF32[$494>>2];
  $496 = $8;
  $497 = -1.0 * $496;
  $498 = $497;
  $499 = $498 * 0.5;
  $500 = $499;
  $501 = (_vert($490,$492,$495,$500,$19)|0);
  $15 = $501;
  $502 = $15;
  $503 = ((($22)) + 16|0);
  $504 = +HEAPF32[$503>>2];
  $505 = ((($22)) + 16|0);
  $506 = ((($505)) + 4|0);
  $507 = +HEAPF32[$506>>2];
  $508 = $8;
  $509 = -1.0 * $508;
  $510 = $509;
  $511 = $510 * 0.5;
  $512 = $511;
  $513 = (_vert($502,$504,$507,$512,$19)|0);
  $15 = $513;
  $514 = $15;
  $515 = ((($22)) + 8|0);
  $516 = +HEAPF32[$515>>2];
  $517 = ((($22)) + 8|0);
  $518 = ((($517)) + 4|0);
  $519 = +HEAPF32[$518>>2];
  $520 = $8;
  $521 = -1.0 * $520;
  $522 = $521;
  $523 = $522 * 0.5;
  $524 = $523;
  $525 = (_vert($514,$516,$519,$524,$19)|0);
  $15 = $525;
  $526 = $15;
  $527 = +HEAPF32[$22>>2];
  $528 = ((($22)) + 4|0);
  $529 = +HEAPF32[$528>>2];
  $530 = $8;
  $531 = -1.0 * $530;
  $532 = $531;
  $533 = $532 * 0.5;
  $534 = $533;
  $535 = (_vert($526,$527,$529,$534,$19)|0);
  $15 = $535;
  $536 = $15;
  $537 = $16;
  $538 = HEAP32[$537>>2]|0;
  $539 = $536;
  $540 = $538;
  $541 = (($539) - ($540))|0;
  $542 = (($541|0) / 24)&-1;
  $25 = $542;
  $543 = $25;
  $544 = $16;
  $545 = ((($544)) + 8|0);
  $546 = HEAP32[$545>>2]|0;
  $547 = $20;
  $548 = (($546) + ($547<<3)|0);
  $549 = HEAP32[$548>>2]|0;
  $550 = (($543) - ($549))|0;
  $551 = $16;
  $552 = ((($551)) + 8|0);
  $553 = HEAP32[$552>>2]|0;
  $554 = $20;
  $555 = (($553) + ($554<<3)|0);
  $556 = ((($555)) + 4|0);
  HEAP32[$556>>2] = $550;
  $557 = $20;
  $558 = (($557) + 1)|0;
  $20 = $558;
  $559 = $15;
  $560 = $16;
  $561 = HEAP32[$560>>2]|0;
  $562 = $559;
  $563 = $561;
  $564 = (($562) - ($563))|0;
  $565 = (($564|0) / 24)&-1;
  $566 = $16;
  $567 = ((($566)) + 8|0);
  $568 = HEAP32[$567>>2]|0;
  $569 = $20;
  $570 = (($568) + ($569<<3)|0);
  HEAP32[$570>>2] = $565;
  $571 = ((($22)) + 4|0);
  $572 = +HEAPF32[$571>>2];
  $573 = ((($22)) + 16|0);
  $574 = ((($573)) + 4|0);
  $575 = +HEAPF32[$574>>2];
  $576 = $572 - $575;
  HEAPF32[$19>>2] = $576;
  $577 = +HEAPF32[$22>>2];
  $578 = ((($22)) + 16|0);
  $579 = +HEAPF32[$578>>2];
  $580 = $577 - $579;
  $581 = - $580;
  $582 = ((($19)) + 4|0);
  HEAPF32[$582>>2] = $581;
  $583 = ((($19)) + 8|0);
  HEAPF32[$583>>2] = 0.0;
  $584 = $15;
  $585 = +HEAPF32[$22>>2];
  $586 = ((($22)) + 4|0);
  $587 = +HEAPF32[$586>>2];
  $588 = $8;
  $589 = -1.0 * $588;
  $590 = $589;
  $591 = $590 * 0.5;
  $592 = $591;
  $593 = (_vert($584,$585,$587,$592,$19)|0);
  $15 = $593;
  $594 = $15;
  $595 = +HEAPF32[$22>>2];
  $596 = ((($22)) + 4|0);
  $597 = +HEAPF32[$596>>2];
  $598 = $8;
  $599 = 1.0 * $598;
  $600 = $599;
  $601 = $600 * 0.5;
  $602 = $601;
  $603 = (_vert($594,$595,$597,$602,$19)|0);
  $15 = $603;
  $604 = $15;
  $605 = ((($22)) + 16|0);
  $606 = +HEAPF32[$605>>2];
  $607 = ((($22)) + 16|0);
  $608 = ((($607)) + 4|0);
  $609 = +HEAPF32[$608>>2];
  $610 = $8;
  $611 = -1.0 * $610;
  $612 = $611;
  $613 = $612 * 0.5;
  $614 = $613;
  $615 = (_vert($604,$606,$609,$614,$19)|0);
  $15 = $615;
  $616 = $15;
  $617 = ((($22)) + 16|0);
  $618 = +HEAPF32[$617>>2];
  $619 = ((($22)) + 16|0);
  $620 = ((($619)) + 4|0);
  $621 = +HEAPF32[$620>>2];
  $622 = $8;
  $623 = 1.0 * $622;
  $624 = $623;
  $625 = $624 * 0.5;
  $626 = $625;
  $627 = (_vert($616,$618,$621,$626,$19)|0);
  $15 = $627;
  $628 = $15;
  $629 = $16;
  $630 = HEAP32[$629>>2]|0;
  $631 = $628;
  $632 = $630;
  $633 = (($631) - ($632))|0;
  $634 = (($633|0) / 24)&-1;
  $26 = $634;
  $635 = $26;
  $636 = $16;
  $637 = ((($636)) + 8|0);
  $638 = HEAP32[$637>>2]|0;
  $639 = $20;
  $640 = (($638) + ($639<<3)|0);
  $641 = HEAP32[$640>>2]|0;
  $642 = (($635) - ($641))|0;
  $643 = $16;
  $644 = ((($643)) + 8|0);
  $645 = HEAP32[$644>>2]|0;
  $646 = $20;
  $647 = (($645) + ($646<<3)|0);
  $648 = ((($647)) + 4|0);
  HEAP32[$648>>2] = $642;
  $649 = $20;
  $650 = (($649) + 1)|0;
  $20 = $650;
  $651 = $15;
  $652 = $16;
  $653 = HEAP32[$652>>2]|0;
  $654 = $651;
  $655 = $653;
  $656 = (($654) - ($655))|0;
  $657 = (($656|0) / 24)&-1;
  $658 = $16;
  $659 = ((($658)) + 8|0);
  $660 = HEAP32[$659>>2]|0;
  $661 = $20;
  $662 = (($660) + ($661<<3)|0);
  HEAP32[$662>>2] = $657;
  $663 = ((($22)) + 8|0);
  $664 = ((($663)) + 4|0);
  $665 = +HEAPF32[$664>>2];
  $666 = ((($22)) + 4|0);
  $667 = +HEAPF32[$666>>2];
  $668 = $665 - $667;
  HEAPF32[$19>>2] = $668;
  $669 = ((($22)) + 8|0);
  $670 = +HEAPF32[$669>>2];
  $671 = +HEAPF32[$22>>2];
  $672 = $670 - $671;
  $673 = - $672;
  $674 = ((($19)) + 4|0);
  HEAPF32[$674>>2] = $673;
  $675 = ((($19)) + 8|0);
  HEAPF32[$675>>2] = 0.0;
  $676 = $15;
  $677 = ((($22)) + 8|0);
  $678 = +HEAPF32[$677>>2];
  $679 = ((($22)) + 8|0);
  $680 = ((($679)) + 4|0);
  $681 = +HEAPF32[$680>>2];
  $682 = $8;
  $683 = -1.0 * $682;
  $684 = $683;
  $685 = $684 * 0.5;
  $686 = $685;
  $687 = (_vert($676,$678,$681,$686,$19)|0);
  $15 = $687;
  $688 = $15;
  $689 = ((($22)) + 8|0);
  $690 = +HEAPF32[$689>>2];
  $691 = ((($22)) + 8|0);
  $692 = ((($691)) + 4|0);
  $693 = +HEAPF32[$692>>2];
  $694 = $8;
  $695 = 1.0 * $694;
  $696 = $695;
  $697 = $696 * 0.5;
  $698 = $697;
  $699 = (_vert($688,$690,$693,$698,$19)|0);
  $15 = $699;
  $700 = $15;
  $701 = +HEAPF32[$22>>2];
  $702 = ((($22)) + 4|0);
  $703 = +HEAPF32[$702>>2];
  $704 = $8;
  $705 = -1.0 * $704;
  $706 = $705;
  $707 = $706 * 0.5;
  $708 = $707;
  $709 = (_vert($700,$701,$703,$708,$19)|0);
  $15 = $709;
  $710 = $15;
  $711 = +HEAPF32[$22>>2];
  $712 = ((($22)) + 4|0);
  $713 = +HEAPF32[$712>>2];
  $714 = $8;
  $715 = 1.0 * $714;
  $716 = $715;
  $717 = $716 * 0.5;
  $718 = $717;
  $719 = (_vert($710,$711,$713,$718,$19)|0);
  $15 = $719;
  $720 = $15;
  $721 = $16;
  $722 = HEAP32[$721>>2]|0;
  $723 = $720;
  $724 = $722;
  $725 = (($723) - ($724))|0;
  $726 = (($725|0) / 24)&-1;
  $27 = $726;
  $727 = $27;
  $728 = $16;
  $729 = ((($728)) + 8|0);
  $730 = HEAP32[$729>>2]|0;
  $731 = $20;
  $732 = (($730) + ($731<<3)|0);
  $733 = HEAP32[$732>>2]|0;
  $734 = (($727) - ($733))|0;
  $735 = $16;
  $736 = ((($735)) + 8|0);
  $737 = HEAP32[$736>>2]|0;
  $738 = $20;
  $739 = (($737) + ($738<<3)|0);
  $740 = ((($739)) + 4|0);
  HEAP32[$740>>2] = $734;
  $741 = $20;
  $742 = (($741) + 1)|0;
  $20 = $742;
  $743 = $15;
  $744 = $16;
  $745 = HEAP32[$744>>2]|0;
  $746 = $743;
  $747 = $745;
  $748 = (($746) - ($747))|0;
  $749 = (($748|0) / 24)&-1;
  $750 = $16;
  $751 = ((($750)) + 8|0);
  $752 = HEAP32[$751>>2]|0;
  $753 = $20;
  $754 = (($752) + ($753<<3)|0);
  HEAP32[$754>>2] = $749;
  $755 = ((($22)) + 24|0);
  $756 = ((($755)) + 4|0);
  $757 = +HEAPF32[$756>>2];
  $758 = ((($22)) + 8|0);
  $759 = ((($758)) + 4|0);
  $760 = +HEAPF32[$759>>2];
  $761 = $757 - $760;
  HEAPF32[$19>>2] = $761;
  $762 = ((($22)) + 24|0);
  $763 = +HEAPF32[$762>>2];
  $764 = ((($22)) + 8|0);
  $765 = +HEAPF32[$764>>2];
  $766 = $763 - $765;
  $767 = - $766;
  $768 = ((($19)) + 4|0);
  HEAPF32[$768>>2] = $767;
  $769 = ((($19)) + 8|0);
  HEAPF32[$769>>2] = 0.0;
  $770 = $15;
  $771 = ((($22)) + 24|0);
  $772 = +HEAPF32[$771>>2];
  $773 = ((($22)) + 24|0);
  $774 = ((($773)) + 4|0);
  $775 = +HEAPF32[$774>>2];
  $776 = $8;
  $777 = -1.0 * $776;
  $778 = $777;
  $779 = $778 * 0.5;
  $780 = $779;
  $781 = (_vert($770,$772,$775,$780,$19)|0);
  $15 = $781;
  $782 = $15;
  $783 = ((($22)) + 24|0);
  $784 = +HEAPF32[$783>>2];
  $785 = ((($22)) + 24|0);
  $786 = ((($785)) + 4|0);
  $787 = +HEAPF32[$786>>2];
  $788 = $8;
  $789 = 1.0 * $788;
  $790 = $789;
  $791 = $790 * 0.5;
  $792 = $791;
  $793 = (_vert($782,$784,$787,$792,$19)|0);
  $15 = $793;
  $794 = $15;
  $795 = ((($22)) + 8|0);
  $796 = +HEAPF32[$795>>2];
  $797 = ((($22)) + 8|0);
  $798 = ((($797)) + 4|0);
  $799 = +HEAPF32[$798>>2];
  $800 = $8;
  $801 = -1.0 * $800;
  $802 = $801;
  $803 = $802 * 0.5;
  $804 = $803;
  $805 = (_vert($794,$796,$799,$804,$19)|0);
  $15 = $805;
  $806 = $15;
  $807 = ((($22)) + 8|0);
  $808 = +HEAPF32[$807>>2];
  $809 = ((($22)) + 8|0);
  $810 = ((($809)) + 4|0);
  $811 = +HEAPF32[$810>>2];
  $812 = $8;
  $813 = 1.0 * $812;
  $814 = $813;
  $815 = $814 * 0.5;
  $816 = $815;
  $817 = (_vert($806,$808,$811,$816,$19)|0);
  $15 = $817;
  $818 = $15;
  $819 = $16;
  $820 = HEAP32[$819>>2]|0;
  $821 = $818;
  $822 = $820;
  $823 = (($821) - ($822))|0;
  $824 = (($823|0) / 24)&-1;
  $28 = $824;
  $825 = $28;
  $826 = $16;
  $827 = ((($826)) + 8|0);
  $828 = HEAP32[$827>>2]|0;
  $829 = $20;
  $830 = (($828) + ($829<<3)|0);
  $831 = HEAP32[$830>>2]|0;
  $832 = (($825) - ($831))|0;
  $833 = $16;
  $834 = ((($833)) + 8|0);
  $835 = HEAP32[$834>>2]|0;
  $836 = $20;
  $837 = (($835) + ($836<<3)|0);
  $838 = ((($837)) + 4|0);
  HEAP32[$838>>2] = $832;
  $839 = $20;
  $840 = (($839) + 1)|0;
  $20 = $840;
  $841 = $15;
  $842 = $16;
  $843 = HEAP32[$842>>2]|0;
  $844 = $841;
  $845 = $843;
  $846 = (($844) - ($845))|0;
  $847 = (($846|0) / 24)&-1;
  $848 = $16;
  $849 = ((($848)) + 8|0);
  $850 = HEAP32[$849>>2]|0;
  $851 = $20;
  $852 = (($850) + ($851<<3)|0);
  HEAP32[$852>>2] = $847;
  $853 = ((($22)) + 40|0);
  $854 = ((($853)) + 4|0);
  $855 = +HEAPF32[$854>>2];
  $856 = ((($22)) + 24|0);
  $857 = ((($856)) + 4|0);
  $858 = +HEAPF32[$857>>2];
  $859 = $855 - $858;
  HEAPF32[$19>>2] = $859;
  $860 = ((($22)) + 40|0);
  $861 = +HEAPF32[$860>>2];
  $862 = ((($22)) + 24|0);
  $863 = +HEAPF32[$862>>2];
  $864 = $861 - $863;
  $865 = - $864;
  $866 = ((($19)) + 4|0);
  HEAPF32[$866>>2] = $865;
  $867 = ((($19)) + 8|0);
  HEAPF32[$867>>2] = 0.0;
  $868 = $15;
  $869 = ((($22)) + 40|0);
  $870 = +HEAPF32[$869>>2];
  $871 = ((($22)) + 40|0);
  $872 = ((($871)) + 4|0);
  $873 = +HEAPF32[$872>>2];
  $874 = $8;
  $875 = -1.0 * $874;
  $876 = $875;
  $877 = $876 * 0.5;
  $878 = $877;
  $879 = (_vert($868,$870,$873,$878,$19)|0);
  $15 = $879;
  $880 = $15;
  $881 = ((($22)) + 40|0);
  $882 = +HEAPF32[$881>>2];
  $883 = ((($22)) + 40|0);
  $884 = ((($883)) + 4|0);
  $885 = +HEAPF32[$884>>2];
  $886 = $8;
  $887 = 1.0 * $886;
  $888 = $887;
  $889 = $888 * 0.5;
  $890 = $889;
  $891 = (_vert($880,$882,$885,$890,$19)|0);
  $15 = $891;
  $892 = $15;
  $893 = ((($22)) + 24|0);
  $894 = +HEAPF32[$893>>2];
  $895 = ((($22)) + 24|0);
  $896 = ((($895)) + 4|0);
  $897 = +HEAPF32[$896>>2];
  $898 = $8;
  $899 = -1.0 * $898;
  $900 = $899;
  $901 = $900 * 0.5;
  $902 = $901;
  $903 = (_vert($892,$894,$897,$902,$19)|0);
  $15 = $903;
  $904 = $15;
  $905 = ((($22)) + 24|0);
  $906 = +HEAPF32[$905>>2];
  $907 = ((($22)) + 24|0);
  $908 = ((($907)) + 4|0);
  $909 = +HEAPF32[$908>>2];
  $910 = $8;
  $911 = 1.0 * $910;
  $912 = $911;
  $913 = $912 * 0.5;
  $914 = $913;
  $915 = (_vert($904,$906,$909,$914,$19)|0);
  $15 = $915;
  $916 = $15;
  $917 = $16;
  $918 = HEAP32[$917>>2]|0;
  $919 = $916;
  $920 = $918;
  $921 = (($919) - ($920))|0;
  $922 = (($921|0) / 24)&-1;
  $29 = $922;
  $923 = $29;
  $924 = $16;
  $925 = ((($924)) + 8|0);
  $926 = HEAP32[$925>>2]|0;
  $927 = $20;
  $928 = (($926) + ($927<<3)|0);
  $929 = HEAP32[$928>>2]|0;
  $930 = (($923) - ($929))|0;
  $931 = $16;
  $932 = ((($931)) + 8|0);
  $933 = HEAP32[$932>>2]|0;
  $934 = $20;
  $935 = (($933) + ($934<<3)|0);
  $936 = ((($935)) + 4|0);
  HEAP32[$936>>2] = $930;
  $937 = $20;
  $938 = (($937) + 1)|0;
  $20 = $938;
  $939 = $21;
  $940 = (($939) + 1)|0;
  $21 = $940;
 }
 $941 = $15;
 $942 = $16;
 $943 = HEAP32[$942>>2]|0;
 $944 = $941;
 $945 = $943;
 $946 = (($944) - ($945))|0;
 $947 = (($946|0) / 24)&-1;
 $948 = $16;
 $949 = ((($948)) + 4|0);
 HEAP32[$949>>2] = $947;
 $950 = $16;
 $951 = ((($950)) + 16|0);
 _glGenBuffers(1,($951|0));
 $952 = $16;
 $953 = ((($952)) + 16|0);
 $954 = HEAP32[$953>>2]|0;
 _glBindBuffer(34962,($954|0));
 $955 = $16;
 $956 = ((($955)) + 4|0);
 $957 = HEAP32[$956>>2]|0;
 $958 = ($957*24)|0;
 $959 = $16;
 $960 = HEAP32[$959>>2]|0;
 _glBufferData(34962,($958|0),($960|0),35044);
 $961 = $16;
 $5 = $961;
 $962 = $5;
 STACKTOP = sp;return ($962|0);
}
function _vert($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 $4 = $4|0;
 var $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0.0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $10 = $6;
 $11 = $5;
 HEAPF32[$11>>2] = $10;
 $12 = $7;
 $13 = $5;
 $14 = ((($13)) + 4|0);
 HEAPF32[$14>>2] = $12;
 $15 = $8;
 $16 = $5;
 $17 = ((($16)) + 8|0);
 HEAPF32[$17>>2] = $15;
 $18 = $9;
 $19 = +HEAPF32[$18>>2];
 $20 = $5;
 $21 = ((($20)) + 12|0);
 HEAPF32[$21>>2] = $19;
 $22 = $9;
 $23 = ((($22)) + 4|0);
 $24 = +HEAPF32[$23>>2];
 $25 = $5;
 $26 = ((($25)) + 16|0);
 HEAPF32[$26>>2] = $24;
 $27 = $9;
 $28 = ((($27)) + 8|0);
 $29 = +HEAPF32[$28>>2];
 $30 = $5;
 $31 = ((($30)) + 20|0);
 HEAPF32[$31>>2] = $29;
 $32 = $5;
 $33 = ((($32)) + 24|0);
 STACKTOP = sp;return ($33|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$0169$i = 0, $$0170$i = 0, $$0171$i = 0, $$0192 = 0, $$0194 = 0, $$02014$i$i = 0, $$0202$lcssa$i$i = 0, $$02023$i$i = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$024372$i = 0, $$0259$i$i = 0, $$02604$i$i = 0, $$0261$lcssa$i$i = 0, $$02613$i$i = 0;
 var $$0267$i$i = 0, $$0268$i$i = 0, $$0318$i = 0, $$032012$i = 0, $$0321$lcssa$i = 0, $$032111$i = 0, $$0323$i = 0, $$0329$i = 0, $$0335$i = 0, $$0336$i = 0, $$0338$i = 0, $$0339$i = 0, $$0344$i = 0, $$1174$i = 0, $$1174$i$be = 0, $$1174$i$ph = 0, $$1176$i = 0, $$1176$i$be = 0, $$1176$i$ph = 0, $$124471$i = 0;
 var $$1263$i$i = 0, $$1263$i$i$be = 0, $$1263$i$i$ph = 0, $$1265$i$i = 0, $$1265$i$i$be = 0, $$1265$i$i$ph = 0, $$1319$i = 0, $$1324$i = 0, $$1340$i = 0, $$1346$i = 0, $$1346$i$be = 0, $$1346$i$ph = 0, $$1350$i = 0, $$1350$i$be = 0, $$1350$i$ph = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2331$i = 0, $$3$i = 0;
 var $$3$i$i = 0, $$3$i198 = 0, $$3$i198211 = 0, $$3326$i = 0, $$3348$i = 0, $$4$lcssa$i = 0, $$415$i = 0, $$415$i$ph = 0, $$4236$i = 0, $$4327$lcssa$i = 0, $$432714$i = 0, $$432714$i$ph = 0, $$4333$i = 0, $$533413$i = 0, $$533413$i$ph = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0;
 var $$pre$i16$i = 0, $$pre$i195 = 0, $$pre$i204 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$i205Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink320 = 0, $$sink321 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0;
 var $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0;
 var $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0;
 var $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0;
 var $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0;
 var $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0;
 var $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0;
 var $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0;
 var $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0;
 var $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0;
 var $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0;
 var $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0;
 var $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0;
 var $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0;
 var $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0;
 var $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0;
 var $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0;
 var $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0;
 var $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0;
 var $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0;
 var $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0;
 var $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0;
 var $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0;
 var $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0;
 var $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0;
 var $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0;
 var $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0;
 var $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0;
 var $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0;
 var $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0;
 var $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0;
 var $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0;
 var $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0;
 var $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0;
 var $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0;
 var $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0;
 var $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0;
 var $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0;
 var $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0;
 var $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0;
 var $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0;
 var $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0;
 var $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0;
 var $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0;
 var $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i203 = 0, $not$$i = 0, $or$cond$i = 0, $or$cond$i199 = 0, $or$cond1$i = 0, $or$cond1$i197 = 0, $or$cond11$i = 0, $or$cond2$i = 0;
 var $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond6$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $or$cond8$not$i = 0, $spec$select$i = 0, $spec$select$i201 = 0, $spec$select1$i = 0, $spec$select2$i = 0, $spec$select4$i = 0, $spec$select49$i = 0, $spec$select9$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[1297]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (5228 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[1297] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(5196)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (5228 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($69|0)==($65|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[1297] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($67) + ($75)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(5208)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (5228 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[1297] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(5196)>>2] = $76;
     HEAP32[(5208)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(5192)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (5492 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $$0169$i = $124;$$0170$i = $124;$$0171$i = $128;
     while(1) {
      $129 = ((($$0169$i)) + 16|0);
      $130 = HEAP32[$129>>2]|0;
      $131 = ($130|0)==(0|0);
      if ($131) {
       $132 = ((($$0169$i)) + 20|0);
       $133 = HEAP32[$132>>2]|0;
       $134 = ($133|0)==(0|0);
       if ($134) {
        break;
       } else {
        $136 = $133;
       }
      } else {
       $136 = $130;
      }
      $135 = ((($136)) + 4|0);
      $137 = HEAP32[$135>>2]|0;
      $138 = $137 & -8;
      $139 = (($138) - ($6))|0;
      $140 = ($139>>>0)<($$0171$i>>>0);
      $spec$select$i = $140 ? $139 : $$0171$i;
      $spec$select1$i = $140 ? $136 : $$0170$i;
      $$0169$i = $136;$$0170$i = $spec$select1$i;$$0171$i = $spec$select$i;
     }
     $141 = (($$0170$i) + ($6)|0);
     $142 = ($141>>>0)>($$0170$i>>>0);
     if ($142) {
      $143 = ((($$0170$i)) + 24|0);
      $144 = HEAP32[$143>>2]|0;
      $145 = ((($$0170$i)) + 12|0);
      $146 = HEAP32[$145>>2]|0;
      $147 = ($146|0)==($$0170$i|0);
      do {
       if ($147) {
        $152 = ((($$0170$i)) + 20|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ($153|0)==(0|0);
        if ($154) {
         $155 = ((($$0170$i)) + 16|0);
         $156 = HEAP32[$155>>2]|0;
         $157 = ($156|0)==(0|0);
         if ($157) {
          $$3$i = 0;
          break;
         } else {
          $$1174$i$ph = $156;$$1176$i$ph = $155;
         }
        } else {
         $$1174$i$ph = $153;$$1176$i$ph = $152;
        }
        $$1174$i = $$1174$i$ph;$$1176$i = $$1176$i$ph;
        while(1) {
         $158 = ((($$1174$i)) + 20|0);
         $159 = HEAP32[$158>>2]|0;
         $160 = ($159|0)==(0|0);
         if ($160) {
          $161 = ((($$1174$i)) + 16|0);
          $162 = HEAP32[$161>>2]|0;
          $163 = ($162|0)==(0|0);
          if ($163) {
           break;
          } else {
           $$1174$i$be = $162;$$1176$i$be = $161;
          }
         } else {
          $$1174$i$be = $159;$$1176$i$be = $158;
         }
         $$1174$i = $$1174$i$be;$$1176$i = $$1176$i$be;
        }
        HEAP32[$$1176$i>>2] = 0;
        $$3$i = $$1174$i;
       } else {
        $148 = ((($$0170$i)) + 8|0);
        $149 = HEAP32[$148>>2]|0;
        $150 = ((($149)) + 12|0);
        HEAP32[$150>>2] = $146;
        $151 = ((($146)) + 8|0);
        HEAP32[$151>>2] = $149;
        $$3$i = $146;
       }
      } while(0);
      $164 = ($144|0)==(0|0);
      do {
       if (!($164)) {
        $165 = ((($$0170$i)) + 28|0);
        $166 = HEAP32[$165>>2]|0;
        $167 = (5492 + ($166<<2)|0);
        $168 = HEAP32[$167>>2]|0;
        $169 = ($$0170$i|0)==($168|0);
        if ($169) {
         HEAP32[$167>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $170 = 1 << $166;
          $171 = $170 ^ -1;
          $172 = $98 & $171;
          HEAP32[(5192)>>2] = $172;
          break;
         }
        } else {
         $173 = ((($144)) + 16|0);
         $174 = HEAP32[$173>>2]|0;
         $175 = ($174|0)==($$0170$i|0);
         $176 = ((($144)) + 20|0);
         $$sink = $175 ? $173 : $176;
         HEAP32[$$sink>>2] = $$3$i;
         $177 = ($$3$i|0)==(0|0);
         if ($177) {
          break;
         }
        }
        $178 = ((($$3$i)) + 24|0);
        HEAP32[$178>>2] = $144;
        $179 = ((($$0170$i)) + 16|0);
        $180 = HEAP32[$179>>2]|0;
        $181 = ($180|0)==(0|0);
        if (!($181)) {
         $182 = ((($$3$i)) + 16|0);
         HEAP32[$182>>2] = $180;
         $183 = ((($180)) + 24|0);
         HEAP32[$183>>2] = $$3$i;
        }
        $184 = ((($$0170$i)) + 20|0);
        $185 = HEAP32[$184>>2]|0;
        $186 = ($185|0)==(0|0);
        if (!($186)) {
         $187 = ((($$3$i)) + 20|0);
         HEAP32[$187>>2] = $185;
         $188 = ((($185)) + 24|0);
         HEAP32[$188>>2] = $$3$i;
        }
       }
      } while(0);
      $189 = ($$0171$i>>>0)<(16);
      if ($189) {
       $190 = (($$0171$i) + ($6))|0;
       $191 = $190 | 3;
       $192 = ((($$0170$i)) + 4|0);
       HEAP32[$192>>2] = $191;
       $193 = (($$0170$i) + ($190)|0);
       $194 = ((($193)) + 4|0);
       $195 = HEAP32[$194>>2]|0;
       $196 = $195 | 1;
       HEAP32[$194>>2] = $196;
      } else {
       $197 = $6 | 3;
       $198 = ((($$0170$i)) + 4|0);
       HEAP32[$198>>2] = $197;
       $199 = $$0171$i | 1;
       $200 = ((($141)) + 4|0);
       HEAP32[$200>>2] = $199;
       $201 = (($141) + ($$0171$i)|0);
       HEAP32[$201>>2] = $$0171$i;
       $202 = ($33|0)==(0);
       if (!($202)) {
        $203 = HEAP32[(5208)>>2]|0;
        $204 = $33 >>> 3;
        $205 = $204 << 1;
        $206 = (5228 + ($205<<2)|0);
        $207 = 1 << $204;
        $208 = $207 & $8;
        $209 = ($208|0)==(0);
        if ($209) {
         $210 = $207 | $8;
         HEAP32[1297] = $210;
         $$pre$i = ((($206)) + 8|0);
         $$0$i = $206;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $211 = ((($206)) + 8|0);
         $212 = HEAP32[$211>>2]|0;
         $$0$i = $212;$$pre$phi$iZ2D = $211;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $203;
        $213 = ((($$0$i)) + 12|0);
        HEAP32[$213>>2] = $203;
        $214 = ((($203)) + 8|0);
        HEAP32[$214>>2] = $$0$i;
        $215 = ((($203)) + 12|0);
        HEAP32[$215>>2] = $206;
       }
       HEAP32[(5196)>>2] = $$0171$i;
       HEAP32[(5208)>>2] = $141;
      }
      $216 = ((($$0170$i)) + 8|0);
      $$0 = $216;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $217 = ($0>>>0)>(4294967231);
   if ($217) {
    $$0192 = -1;
   } else {
    $218 = (($0) + 11)|0;
    $219 = $218 & -8;
    $220 = HEAP32[(5192)>>2]|0;
    $221 = ($220|0)==(0);
    if ($221) {
     $$0192 = $219;
    } else {
     $222 = (0 - ($219))|0;
     $223 = $218 >>> 8;
     $224 = ($223|0)==(0);
     if ($224) {
      $$0335$i = 0;
     } else {
      $225 = ($219>>>0)>(16777215);
      if ($225) {
       $$0335$i = 31;
      } else {
       $226 = (($223) + 1048320)|0;
       $227 = $226 >>> 16;
       $228 = $227 & 8;
       $229 = $223 << $228;
       $230 = (($229) + 520192)|0;
       $231 = $230 >>> 16;
       $232 = $231 & 4;
       $233 = $232 | $228;
       $234 = $229 << $232;
       $235 = (($234) + 245760)|0;
       $236 = $235 >>> 16;
       $237 = $236 & 2;
       $238 = $233 | $237;
       $239 = (14 - ($238))|0;
       $240 = $234 << $237;
       $241 = $240 >>> 15;
       $242 = (($239) + ($241))|0;
       $243 = $242 << 1;
       $244 = (($242) + 7)|0;
       $245 = $219 >>> $244;
       $246 = $245 & 1;
       $247 = $246 | $243;
       $$0335$i = $247;
      }
     }
     $248 = (5492 + ($$0335$i<<2)|0);
     $249 = HEAP32[$248>>2]|0;
     $250 = ($249|0)==(0|0);
     L79: do {
      if ($250) {
       $$2331$i = 0;$$3$i198 = 0;$$3326$i = $222;
       label = 61;
      } else {
       $251 = ($$0335$i|0)==(31);
       $252 = $$0335$i >>> 1;
       $253 = (25 - ($252))|0;
       $254 = $251 ? 0 : $253;
       $255 = $219 << $254;
       $$0318$i = 0;$$0323$i = $222;$$0329$i = $249;$$0336$i = $255;$$0339$i = 0;
       while(1) {
        $256 = ((($$0329$i)) + 4|0);
        $257 = HEAP32[$256>>2]|0;
        $258 = $257 & -8;
        $259 = (($258) - ($219))|0;
        $260 = ($259>>>0)<($$0323$i>>>0);
        if ($260) {
         $261 = ($259|0)==(0);
         if ($261) {
          $$415$i$ph = $$0329$i;$$432714$i$ph = 0;$$533413$i$ph = $$0329$i;
          label = 65;
          break L79;
         } else {
          $$1319$i = $$0329$i;$$1324$i = $259;
         }
        } else {
         $$1319$i = $$0318$i;$$1324$i = $$0323$i;
        }
        $262 = ((($$0329$i)) + 20|0);
        $263 = HEAP32[$262>>2]|0;
        $264 = $$0336$i >>> 31;
        $265 = (((($$0329$i)) + 16|0) + ($264<<2)|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = ($263|0)==(0|0);
        $268 = ($263|0)==($266|0);
        $or$cond1$i197 = $267 | $268;
        $$1340$i = $or$cond1$i197 ? $$0339$i : $263;
        $269 = ($266|0)==(0|0);
        $spec$select4$i = $$0336$i << 1;
        if ($269) {
         $$2331$i = $$1340$i;$$3$i198 = $$1319$i;$$3326$i = $$1324$i;
         label = 61;
         break;
        } else {
         $$0318$i = $$1319$i;$$0323$i = $$1324$i;$$0329$i = $266;$$0336$i = $spec$select4$i;$$0339$i = $$1340$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 61) {
      $270 = ($$2331$i|0)==(0|0);
      $271 = ($$3$i198|0)==(0|0);
      $or$cond$i199 = $270 & $271;
      if ($or$cond$i199) {
       $272 = 2 << $$0335$i;
       $273 = (0 - ($272))|0;
       $274 = $272 | $273;
       $275 = $274 & $220;
       $276 = ($275|0)==(0);
       if ($276) {
        $$0192 = $219;
        break;
       }
       $277 = (0 - ($275))|0;
       $278 = $275 & $277;
       $279 = (($278) + -1)|0;
       $280 = $279 >>> 12;
       $281 = $280 & 16;
       $282 = $279 >>> $281;
       $283 = $282 >>> 5;
       $284 = $283 & 8;
       $285 = $284 | $281;
       $286 = $282 >>> $284;
       $287 = $286 >>> 2;
       $288 = $287 & 4;
       $289 = $285 | $288;
       $290 = $286 >>> $288;
       $291 = $290 >>> 1;
       $292 = $291 & 2;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 1;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = (($297) + ($298))|0;
       $300 = (5492 + ($299<<2)|0);
       $301 = HEAP32[$300>>2]|0;
       $$3$i198211 = 0;$$4333$i = $301;
      } else {
       $$3$i198211 = $$3$i198;$$4333$i = $$2331$i;
      }
      $302 = ($$4333$i|0)==(0|0);
      if ($302) {
       $$4$lcssa$i = $$3$i198211;$$4327$lcssa$i = $$3326$i;
      } else {
       $$415$i$ph = $$3$i198211;$$432714$i$ph = $$3326$i;$$533413$i$ph = $$4333$i;
       label = 65;
      }
     }
     if ((label|0) == 65) {
      $$415$i = $$415$i$ph;$$432714$i = $$432714$i$ph;$$533413$i = $$533413$i$ph;
      while(1) {
       $303 = ((($$533413$i)) + 4|0);
       $304 = HEAP32[$303>>2]|0;
       $305 = $304 & -8;
       $306 = (($305) - ($219))|0;
       $307 = ($306>>>0)<($$432714$i>>>0);
       $spec$select$i201 = $307 ? $306 : $$432714$i;
       $spec$select2$i = $307 ? $$533413$i : $$415$i;
       $308 = ((($$533413$i)) + 16|0);
       $309 = HEAP32[$308>>2]|0;
       $310 = ($309|0)==(0|0);
       if ($310) {
        $311 = ((($$533413$i)) + 20|0);
        $312 = HEAP32[$311>>2]|0;
        $314 = $312;
       } else {
        $314 = $309;
       }
       $313 = ($314|0)==(0|0);
       if ($313) {
        $$4$lcssa$i = $spec$select2$i;$$4327$lcssa$i = $spec$select$i201;
        break;
       } else {
        $$415$i = $spec$select2$i;$$432714$i = $spec$select$i201;$$533413$i = $314;
       }
      }
     }
     $315 = ($$4$lcssa$i|0)==(0|0);
     if ($315) {
      $$0192 = $219;
     } else {
      $316 = HEAP32[(5196)>>2]|0;
      $317 = (($316) - ($219))|0;
      $318 = ($$4327$lcssa$i>>>0)<($317>>>0);
      if ($318) {
       $319 = (($$4$lcssa$i) + ($219)|0);
       $320 = ($319>>>0)>($$4$lcssa$i>>>0);
       if ($320) {
        $321 = ((($$4$lcssa$i)) + 24|0);
        $322 = HEAP32[$321>>2]|0;
        $323 = ((($$4$lcssa$i)) + 12|0);
        $324 = HEAP32[$323>>2]|0;
        $325 = ($324|0)==($$4$lcssa$i|0);
        do {
         if ($325) {
          $330 = ((($$4$lcssa$i)) + 20|0);
          $331 = HEAP32[$330>>2]|0;
          $332 = ($331|0)==(0|0);
          if ($332) {
           $333 = ((($$4$lcssa$i)) + 16|0);
           $334 = HEAP32[$333>>2]|0;
           $335 = ($334|0)==(0|0);
           if ($335) {
            $$3348$i = 0;
            break;
           } else {
            $$1346$i$ph = $334;$$1350$i$ph = $333;
           }
          } else {
           $$1346$i$ph = $331;$$1350$i$ph = $330;
          }
          $$1346$i = $$1346$i$ph;$$1350$i = $$1350$i$ph;
          while(1) {
           $336 = ((($$1346$i)) + 20|0);
           $337 = HEAP32[$336>>2]|0;
           $338 = ($337|0)==(0|0);
           if ($338) {
            $339 = ((($$1346$i)) + 16|0);
            $340 = HEAP32[$339>>2]|0;
            $341 = ($340|0)==(0|0);
            if ($341) {
             break;
            } else {
             $$1346$i$be = $340;$$1350$i$be = $339;
            }
           } else {
            $$1346$i$be = $337;$$1350$i$be = $336;
           }
           $$1346$i = $$1346$i$be;$$1350$i = $$1350$i$be;
          }
          HEAP32[$$1350$i>>2] = 0;
          $$3348$i = $$1346$i;
         } else {
          $326 = ((($$4$lcssa$i)) + 8|0);
          $327 = HEAP32[$326>>2]|0;
          $328 = ((($327)) + 12|0);
          HEAP32[$328>>2] = $324;
          $329 = ((($324)) + 8|0);
          HEAP32[$329>>2] = $327;
          $$3348$i = $324;
         }
        } while(0);
        $342 = ($322|0)==(0|0);
        do {
         if ($342) {
          $425 = $220;
         } else {
          $343 = ((($$4$lcssa$i)) + 28|0);
          $344 = HEAP32[$343>>2]|0;
          $345 = (5492 + ($344<<2)|0);
          $346 = HEAP32[$345>>2]|0;
          $347 = ($$4$lcssa$i|0)==($346|0);
          if ($347) {
           HEAP32[$345>>2] = $$3348$i;
           $cond$i203 = ($$3348$i|0)==(0|0);
           if ($cond$i203) {
            $348 = 1 << $344;
            $349 = $348 ^ -1;
            $350 = $220 & $349;
            HEAP32[(5192)>>2] = $350;
            $425 = $350;
            break;
           }
          } else {
           $351 = ((($322)) + 16|0);
           $352 = HEAP32[$351>>2]|0;
           $353 = ($352|0)==($$4$lcssa$i|0);
           $354 = ((($322)) + 20|0);
           $$sink320 = $353 ? $351 : $354;
           HEAP32[$$sink320>>2] = $$3348$i;
           $355 = ($$3348$i|0)==(0|0);
           if ($355) {
            $425 = $220;
            break;
           }
          }
          $356 = ((($$3348$i)) + 24|0);
          HEAP32[$356>>2] = $322;
          $357 = ((($$4$lcssa$i)) + 16|0);
          $358 = HEAP32[$357>>2]|0;
          $359 = ($358|0)==(0|0);
          if (!($359)) {
           $360 = ((($$3348$i)) + 16|0);
           HEAP32[$360>>2] = $358;
           $361 = ((($358)) + 24|0);
           HEAP32[$361>>2] = $$3348$i;
          }
          $362 = ((($$4$lcssa$i)) + 20|0);
          $363 = HEAP32[$362>>2]|0;
          $364 = ($363|0)==(0|0);
          if ($364) {
           $425 = $220;
          } else {
           $365 = ((($$3348$i)) + 20|0);
           HEAP32[$365>>2] = $363;
           $366 = ((($363)) + 24|0);
           HEAP32[$366>>2] = $$3348$i;
           $425 = $220;
          }
         }
        } while(0);
        $367 = ($$4327$lcssa$i>>>0)<(16);
        L128: do {
         if ($367) {
          $368 = (($$4327$lcssa$i) + ($219))|0;
          $369 = $368 | 3;
          $370 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$370>>2] = $369;
          $371 = (($$4$lcssa$i) + ($368)|0);
          $372 = ((($371)) + 4|0);
          $373 = HEAP32[$372>>2]|0;
          $374 = $373 | 1;
          HEAP32[$372>>2] = $374;
         } else {
          $375 = $219 | 3;
          $376 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$376>>2] = $375;
          $377 = $$4327$lcssa$i | 1;
          $378 = ((($319)) + 4|0);
          HEAP32[$378>>2] = $377;
          $379 = (($319) + ($$4327$lcssa$i)|0);
          HEAP32[$379>>2] = $$4327$lcssa$i;
          $380 = $$4327$lcssa$i >>> 3;
          $381 = ($$4327$lcssa$i>>>0)<(256);
          if ($381) {
           $382 = $380 << 1;
           $383 = (5228 + ($382<<2)|0);
           $384 = HEAP32[1297]|0;
           $385 = 1 << $380;
           $386 = $384 & $385;
           $387 = ($386|0)==(0);
           if ($387) {
            $388 = $384 | $385;
            HEAP32[1297] = $388;
            $$pre$i204 = ((($383)) + 8|0);
            $$0344$i = $383;$$pre$phi$i205Z2D = $$pre$i204;
           } else {
            $389 = ((($383)) + 8|0);
            $390 = HEAP32[$389>>2]|0;
            $$0344$i = $390;$$pre$phi$i205Z2D = $389;
           }
           HEAP32[$$pre$phi$i205Z2D>>2] = $319;
           $391 = ((($$0344$i)) + 12|0);
           HEAP32[$391>>2] = $319;
           $392 = ((($319)) + 8|0);
           HEAP32[$392>>2] = $$0344$i;
           $393 = ((($319)) + 12|0);
           HEAP32[$393>>2] = $383;
           break;
          }
          $394 = $$4327$lcssa$i >>> 8;
          $395 = ($394|0)==(0);
          if ($395) {
           $$0338$i = 0;
          } else {
           $396 = ($$4327$lcssa$i>>>0)>(16777215);
           if ($396) {
            $$0338$i = 31;
           } else {
            $397 = (($394) + 1048320)|0;
            $398 = $397 >>> 16;
            $399 = $398 & 8;
            $400 = $394 << $399;
            $401 = (($400) + 520192)|0;
            $402 = $401 >>> 16;
            $403 = $402 & 4;
            $404 = $403 | $399;
            $405 = $400 << $403;
            $406 = (($405) + 245760)|0;
            $407 = $406 >>> 16;
            $408 = $407 & 2;
            $409 = $404 | $408;
            $410 = (14 - ($409))|0;
            $411 = $405 << $408;
            $412 = $411 >>> 15;
            $413 = (($410) + ($412))|0;
            $414 = $413 << 1;
            $415 = (($413) + 7)|0;
            $416 = $$4327$lcssa$i >>> $415;
            $417 = $416 & 1;
            $418 = $417 | $414;
            $$0338$i = $418;
           }
          }
          $419 = (5492 + ($$0338$i<<2)|0);
          $420 = ((($319)) + 28|0);
          HEAP32[$420>>2] = $$0338$i;
          $421 = ((($319)) + 16|0);
          $422 = ((($421)) + 4|0);
          HEAP32[$422>>2] = 0;
          HEAP32[$421>>2] = 0;
          $423 = 1 << $$0338$i;
          $424 = $425 & $423;
          $426 = ($424|0)==(0);
          if ($426) {
           $427 = $425 | $423;
           HEAP32[(5192)>>2] = $427;
           HEAP32[$419>>2] = $319;
           $428 = ((($319)) + 24|0);
           HEAP32[$428>>2] = $419;
           $429 = ((($319)) + 12|0);
           HEAP32[$429>>2] = $319;
           $430 = ((($319)) + 8|0);
           HEAP32[$430>>2] = $319;
           break;
          }
          $431 = HEAP32[$419>>2]|0;
          $432 = ((($431)) + 4|0);
          $433 = HEAP32[$432>>2]|0;
          $434 = $433 & -8;
          $435 = ($434|0)==($$4327$lcssa$i|0);
          L145: do {
           if ($435) {
            $$0321$lcssa$i = $431;
           } else {
            $436 = ($$0338$i|0)==(31);
            $437 = $$0338$i >>> 1;
            $438 = (25 - ($437))|0;
            $439 = $436 ? 0 : $438;
            $440 = $$4327$lcssa$i << $439;
            $$032012$i = $440;$$032111$i = $431;
            while(1) {
             $447 = $$032012$i >>> 31;
             $448 = (((($$032111$i)) + 16|0) + ($447<<2)|0);
             $443 = HEAP32[$448>>2]|0;
             $449 = ($443|0)==(0|0);
             if ($449) {
              break;
             }
             $441 = $$032012$i << 1;
             $442 = ((($443)) + 4|0);
             $444 = HEAP32[$442>>2]|0;
             $445 = $444 & -8;
             $446 = ($445|0)==($$4327$lcssa$i|0);
             if ($446) {
              $$0321$lcssa$i = $443;
              break L145;
             } else {
              $$032012$i = $441;$$032111$i = $443;
             }
            }
            HEAP32[$448>>2] = $319;
            $450 = ((($319)) + 24|0);
            HEAP32[$450>>2] = $$032111$i;
            $451 = ((($319)) + 12|0);
            HEAP32[$451>>2] = $319;
            $452 = ((($319)) + 8|0);
            HEAP32[$452>>2] = $319;
            break L128;
           }
          } while(0);
          $453 = ((($$0321$lcssa$i)) + 8|0);
          $454 = HEAP32[$453>>2]|0;
          $455 = ((($454)) + 12|0);
          HEAP32[$455>>2] = $319;
          HEAP32[$453>>2] = $319;
          $456 = ((($319)) + 8|0);
          HEAP32[$456>>2] = $454;
          $457 = ((($319)) + 12|0);
          HEAP32[$457>>2] = $$0321$lcssa$i;
          $458 = ((($319)) + 24|0);
          HEAP32[$458>>2] = 0;
         }
        } while(0);
        $459 = ((($$4$lcssa$i)) + 8|0);
        $$0 = $459;
        STACKTOP = sp;return ($$0|0);
       } else {
        $$0192 = $219;
       }
      } else {
       $$0192 = $219;
      }
     }
    }
   }
  }
 } while(0);
 $460 = HEAP32[(5196)>>2]|0;
 $461 = ($460>>>0)<($$0192>>>0);
 if (!($461)) {
  $462 = (($460) - ($$0192))|0;
  $463 = HEAP32[(5208)>>2]|0;
  $464 = ($462>>>0)>(15);
  if ($464) {
   $465 = (($463) + ($$0192)|0);
   HEAP32[(5208)>>2] = $465;
   HEAP32[(5196)>>2] = $462;
   $466 = $462 | 1;
   $467 = ((($465)) + 4|0);
   HEAP32[$467>>2] = $466;
   $468 = (($463) + ($460)|0);
   HEAP32[$468>>2] = $462;
   $469 = $$0192 | 3;
   $470 = ((($463)) + 4|0);
   HEAP32[$470>>2] = $469;
  } else {
   HEAP32[(5196)>>2] = 0;
   HEAP32[(5208)>>2] = 0;
   $471 = $460 | 3;
   $472 = ((($463)) + 4|0);
   HEAP32[$472>>2] = $471;
   $473 = (($463) + ($460)|0);
   $474 = ((($473)) + 4|0);
   $475 = HEAP32[$474>>2]|0;
   $476 = $475 | 1;
   HEAP32[$474>>2] = $476;
  }
  $477 = ((($463)) + 8|0);
  $$0 = $477;
  STACKTOP = sp;return ($$0|0);
 }
 $478 = HEAP32[(5200)>>2]|0;
 $479 = ($478>>>0)>($$0192>>>0);
 if ($479) {
  $480 = (($478) - ($$0192))|0;
  HEAP32[(5200)>>2] = $480;
  $481 = HEAP32[(5212)>>2]|0;
  $482 = (($481) + ($$0192)|0);
  HEAP32[(5212)>>2] = $482;
  $483 = $480 | 1;
  $484 = ((($482)) + 4|0);
  HEAP32[$484>>2] = $483;
  $485 = $$0192 | 3;
  $486 = ((($481)) + 4|0);
  HEAP32[$486>>2] = $485;
  $487 = ((($481)) + 8|0);
  $$0 = $487;
  STACKTOP = sp;return ($$0|0);
 }
 $488 = HEAP32[1415]|0;
 $489 = ($488|0)==(0);
 if ($489) {
  HEAP32[(5668)>>2] = 4096;
  HEAP32[(5664)>>2] = 4096;
  HEAP32[(5672)>>2] = -1;
  HEAP32[(5676)>>2] = -1;
  HEAP32[(5680)>>2] = 0;
  HEAP32[(5632)>>2] = 0;
  $490 = $1;
  $491 = $490 & -16;
  $492 = $491 ^ 1431655768;
  HEAP32[1415] = $492;
  $496 = 4096;
 } else {
  $$pre$i195 = HEAP32[(5668)>>2]|0;
  $496 = $$pre$i195;
 }
 $493 = (($$0192) + 48)|0;
 $494 = (($$0192) + 47)|0;
 $495 = (($496) + ($494))|0;
 $497 = (0 - ($496))|0;
 $498 = $495 & $497;
 $499 = ($498>>>0)>($$0192>>>0);
 if (!($499)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $500 = HEAP32[(5628)>>2]|0;
 $501 = ($500|0)==(0);
 if (!($501)) {
  $502 = HEAP32[(5620)>>2]|0;
  $503 = (($502) + ($498))|0;
  $504 = ($503>>>0)<=($502>>>0);
  $505 = ($503>>>0)>($500>>>0);
  $or$cond1$i = $504 | $505;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $506 = HEAP32[(5632)>>2]|0;
 $507 = $506 & 4;
 $508 = ($507|0)==(0);
 L178: do {
  if ($508) {
   $509 = HEAP32[(5212)>>2]|0;
   $510 = ($509|0)==(0|0);
   L180: do {
    if ($510) {
     label = 128;
    } else {
     $$0$i20$i = (5636);
     while(1) {
      $511 = HEAP32[$$0$i20$i>>2]|0;
      $512 = ($511>>>0)>($509>>>0);
      if (!($512)) {
       $513 = ((($$0$i20$i)) + 4|0);
       $514 = HEAP32[$513>>2]|0;
       $515 = (($511) + ($514)|0);
       $516 = ($515>>>0)>($509>>>0);
       if ($516) {
        break;
       }
      }
      $517 = ((($$0$i20$i)) + 8|0);
      $518 = HEAP32[$517>>2]|0;
      $519 = ($518|0)==(0|0);
      if ($519) {
       label = 128;
       break L180;
      } else {
       $$0$i20$i = $518;
      }
     }
     $542 = (($495) - ($478))|0;
     $543 = $542 & $497;
     $544 = ($543>>>0)<(2147483647);
     if ($544) {
      $545 = ((($$0$i20$i)) + 4|0);
      $546 = (_sbrk(($543|0))|0);
      $547 = HEAP32[$$0$i20$i>>2]|0;
      $548 = HEAP32[$545>>2]|0;
      $549 = (($547) + ($548)|0);
      $550 = ($546|0)==($549|0);
      if ($550) {
       $551 = ($546|0)==((-1)|0);
       if ($551) {
        $$2234243136$i = $543;
       } else {
        $$723947$i = $543;$$748$i = $546;
        label = 145;
        break L178;
       }
      } else {
       $$2247$ph$i = $546;$$2253$ph$i = $543;
       label = 136;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 128) {
     $520 = (_sbrk(0)|0);
     $521 = ($520|0)==((-1)|0);
     if ($521) {
      $$2234243136$i = 0;
     } else {
      $522 = $520;
      $523 = HEAP32[(5664)>>2]|0;
      $524 = (($523) + -1)|0;
      $525 = $524 & $522;
      $526 = ($525|0)==(0);
      $527 = (($524) + ($522))|0;
      $528 = (0 - ($523))|0;
      $529 = $527 & $528;
      $530 = (($529) - ($522))|0;
      $531 = $526 ? 0 : $530;
      $spec$select49$i = (($531) + ($498))|0;
      $532 = HEAP32[(5620)>>2]|0;
      $533 = (($spec$select49$i) + ($532))|0;
      $534 = ($spec$select49$i>>>0)>($$0192>>>0);
      $535 = ($spec$select49$i>>>0)<(2147483647);
      $or$cond$i = $534 & $535;
      if ($or$cond$i) {
       $536 = HEAP32[(5628)>>2]|0;
       $537 = ($536|0)==(0);
       if (!($537)) {
        $538 = ($533>>>0)<=($532>>>0);
        $539 = ($533>>>0)>($536>>>0);
        $or$cond2$i = $538 | $539;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $540 = (_sbrk(($spec$select49$i|0))|0);
       $541 = ($540|0)==($520|0);
       if ($541) {
        $$723947$i = $spec$select49$i;$$748$i = $520;
        label = 145;
        break L178;
       } else {
        $$2247$ph$i = $540;$$2253$ph$i = $spec$select49$i;
        label = 136;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 136) {
     $552 = (0 - ($$2253$ph$i))|0;
     $553 = ($$2247$ph$i|0)!=((-1)|0);
     $554 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $554 & $553;
     $555 = ($493>>>0)>($$2253$ph$i>>>0);
     $or$cond6$i = $555 & $or$cond7$i;
     if (!($or$cond6$i)) {
      $565 = ($$2247$ph$i|0)==((-1)|0);
      if ($565) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 145;
       break L178;
      }
     }
     $556 = HEAP32[(5668)>>2]|0;
     $557 = (($494) - ($$2253$ph$i))|0;
     $558 = (($557) + ($556))|0;
     $559 = (0 - ($556))|0;
     $560 = $558 & $559;
     $561 = ($560>>>0)<(2147483647);
     if (!($561)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
     $562 = (_sbrk(($560|0))|0);
     $563 = ($562|0)==((-1)|0);
     if ($563) {
      (_sbrk(($552|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $564 = (($560) + ($$2253$ph$i))|0;
      $$723947$i = $564;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
    }
   } while(0);
   $566 = HEAP32[(5632)>>2]|0;
   $567 = $566 | 4;
   HEAP32[(5632)>>2] = $567;
   $$4236$i = $$2234243136$i;
   label = 143;
  } else {
   $$4236$i = 0;
   label = 143;
  }
 } while(0);
 if ((label|0) == 143) {
  $568 = ($498>>>0)<(2147483647);
  if ($568) {
   $569 = (_sbrk(($498|0))|0);
   $570 = (_sbrk(0)|0);
   $571 = ($569|0)!=((-1)|0);
   $572 = ($570|0)!=((-1)|0);
   $or$cond5$i = $571 & $572;
   $573 = ($569>>>0)<($570>>>0);
   $or$cond8$i = $573 & $or$cond5$i;
   $574 = $570;
   $575 = $569;
   $576 = (($574) - ($575))|0;
   $577 = (($$0192) + 40)|0;
   $578 = ($576>>>0)>($577>>>0);
   $spec$select9$i = $578 ? $576 : $$4236$i;
   $or$cond8$not$i = $or$cond8$i ^ 1;
   $579 = ($569|0)==((-1)|0);
   $not$$i = $578 ^ 1;
   $580 = $579 | $not$$i;
   $or$cond50$i = $580 | $or$cond8$not$i;
   if (!($or$cond50$i)) {
    $$723947$i = $spec$select9$i;$$748$i = $569;
    label = 145;
   }
  }
 }
 if ((label|0) == 145) {
  $581 = HEAP32[(5620)>>2]|0;
  $582 = (($581) + ($$723947$i))|0;
  HEAP32[(5620)>>2] = $582;
  $583 = HEAP32[(5624)>>2]|0;
  $584 = ($582>>>0)>($583>>>0);
  if ($584) {
   HEAP32[(5624)>>2] = $582;
  }
  $585 = HEAP32[(5212)>>2]|0;
  $586 = ($585|0)==(0|0);
  L215: do {
   if ($586) {
    $587 = HEAP32[(5204)>>2]|0;
    $588 = ($587|0)==(0|0);
    $589 = ($$748$i>>>0)<($587>>>0);
    $or$cond11$i = $588 | $589;
    if ($or$cond11$i) {
     HEAP32[(5204)>>2] = $$748$i;
    }
    HEAP32[(5636)>>2] = $$748$i;
    HEAP32[(5640)>>2] = $$723947$i;
    HEAP32[(5648)>>2] = 0;
    $590 = HEAP32[1415]|0;
    HEAP32[(5224)>>2] = $590;
    HEAP32[(5220)>>2] = -1;
    HEAP32[(5240)>>2] = (5228);
    HEAP32[(5236)>>2] = (5228);
    HEAP32[(5248)>>2] = (5236);
    HEAP32[(5244)>>2] = (5236);
    HEAP32[(5256)>>2] = (5244);
    HEAP32[(5252)>>2] = (5244);
    HEAP32[(5264)>>2] = (5252);
    HEAP32[(5260)>>2] = (5252);
    HEAP32[(5272)>>2] = (5260);
    HEAP32[(5268)>>2] = (5260);
    HEAP32[(5280)>>2] = (5268);
    HEAP32[(5276)>>2] = (5268);
    HEAP32[(5288)>>2] = (5276);
    HEAP32[(5284)>>2] = (5276);
    HEAP32[(5296)>>2] = (5284);
    HEAP32[(5292)>>2] = (5284);
    HEAP32[(5304)>>2] = (5292);
    HEAP32[(5300)>>2] = (5292);
    HEAP32[(5312)>>2] = (5300);
    HEAP32[(5308)>>2] = (5300);
    HEAP32[(5320)>>2] = (5308);
    HEAP32[(5316)>>2] = (5308);
    HEAP32[(5328)>>2] = (5316);
    HEAP32[(5324)>>2] = (5316);
    HEAP32[(5336)>>2] = (5324);
    HEAP32[(5332)>>2] = (5324);
    HEAP32[(5344)>>2] = (5332);
    HEAP32[(5340)>>2] = (5332);
    HEAP32[(5352)>>2] = (5340);
    HEAP32[(5348)>>2] = (5340);
    HEAP32[(5360)>>2] = (5348);
    HEAP32[(5356)>>2] = (5348);
    HEAP32[(5368)>>2] = (5356);
    HEAP32[(5364)>>2] = (5356);
    HEAP32[(5376)>>2] = (5364);
    HEAP32[(5372)>>2] = (5364);
    HEAP32[(5384)>>2] = (5372);
    HEAP32[(5380)>>2] = (5372);
    HEAP32[(5392)>>2] = (5380);
    HEAP32[(5388)>>2] = (5380);
    HEAP32[(5400)>>2] = (5388);
    HEAP32[(5396)>>2] = (5388);
    HEAP32[(5408)>>2] = (5396);
    HEAP32[(5404)>>2] = (5396);
    HEAP32[(5416)>>2] = (5404);
    HEAP32[(5412)>>2] = (5404);
    HEAP32[(5424)>>2] = (5412);
    HEAP32[(5420)>>2] = (5412);
    HEAP32[(5432)>>2] = (5420);
    HEAP32[(5428)>>2] = (5420);
    HEAP32[(5440)>>2] = (5428);
    HEAP32[(5436)>>2] = (5428);
    HEAP32[(5448)>>2] = (5436);
    HEAP32[(5444)>>2] = (5436);
    HEAP32[(5456)>>2] = (5444);
    HEAP32[(5452)>>2] = (5444);
    HEAP32[(5464)>>2] = (5452);
    HEAP32[(5460)>>2] = (5452);
    HEAP32[(5472)>>2] = (5460);
    HEAP32[(5468)>>2] = (5460);
    HEAP32[(5480)>>2] = (5468);
    HEAP32[(5476)>>2] = (5468);
    HEAP32[(5488)>>2] = (5476);
    HEAP32[(5484)>>2] = (5476);
    $591 = (($$723947$i) + -40)|0;
    $592 = ((($$748$i)) + 8|0);
    $593 = $592;
    $594 = $593 & 7;
    $595 = ($594|0)==(0);
    $596 = (0 - ($593))|0;
    $597 = $596 & 7;
    $598 = $595 ? 0 : $597;
    $599 = (($$748$i) + ($598)|0);
    $600 = (($591) - ($598))|0;
    HEAP32[(5212)>>2] = $599;
    HEAP32[(5200)>>2] = $600;
    $601 = $600 | 1;
    $602 = ((($599)) + 4|0);
    HEAP32[$602>>2] = $601;
    $603 = (($$748$i) + ($591)|0);
    $604 = ((($603)) + 4|0);
    HEAP32[$604>>2] = 40;
    $605 = HEAP32[(5676)>>2]|0;
    HEAP32[(5216)>>2] = $605;
   } else {
    $$024372$i = (5636);
    while(1) {
     $606 = HEAP32[$$024372$i>>2]|0;
     $607 = ((($$024372$i)) + 4|0);
     $608 = HEAP32[$607>>2]|0;
     $609 = (($606) + ($608)|0);
     $610 = ($$748$i|0)==($609|0);
     if ($610) {
      label = 154;
      break;
     }
     $611 = ((($$024372$i)) + 8|0);
     $612 = HEAP32[$611>>2]|0;
     $613 = ($612|0)==(0|0);
     if ($613) {
      break;
     } else {
      $$024372$i = $612;
     }
    }
    if ((label|0) == 154) {
     $614 = ((($$024372$i)) + 4|0);
     $615 = ((($$024372$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($606>>>0)<=($585>>>0);
      $620 = ($$748$i>>>0)>($585>>>0);
      $or$cond51$i = $620 & $619;
      if ($or$cond51$i) {
       $621 = (($608) + ($$723947$i))|0;
       HEAP32[$614>>2] = $621;
       $622 = HEAP32[(5200)>>2]|0;
       $623 = (($622) + ($$723947$i))|0;
       $624 = ((($585)) + 8|0);
       $625 = $624;
       $626 = $625 & 7;
       $627 = ($626|0)==(0);
       $628 = (0 - ($625))|0;
       $629 = $628 & 7;
       $630 = $627 ? 0 : $629;
       $631 = (($585) + ($630)|0);
       $632 = (($623) - ($630))|0;
       HEAP32[(5212)>>2] = $631;
       HEAP32[(5200)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($631)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($585) + ($623)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(5676)>>2]|0;
       HEAP32[(5216)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(5204)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(5204)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124471$i = (5636);
    while(1) {
     $641 = HEAP32[$$124471$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 162;
      break;
     }
     $643 = ((($$124471$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124471$i = $644;
     }
    }
    if ((label|0) == 162) {
     $646 = ((($$124471$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124471$i>>2] = $$748$i;
      $650 = ((($$124471$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($585|0)==($668|0);
      L238: do {
       if ($676) {
        $677 = HEAP32[(5200)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(5200)>>2] = $678;
        HEAP32[(5212)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(5208)>>2]|0;
        $682 = ($681|0)==($668|0);
        if ($682) {
         $683 = HEAP32[(5196)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(5196)>>2] = $684;
         HEAP32[(5208)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L246: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[1297]|0;
            $703 = $702 & $701;
            HEAP32[1297] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1263$i$i$ph = $719;$$1265$i$i$ph = $715;
              }
             } else {
              $$1263$i$i$ph = $717;$$1265$i$i$ph = $716;
             }
             $$1263$i$i = $$1263$i$i$ph;$$1265$i$i = $$1265$i$i$ph;
             while(1) {
              $721 = ((($$1263$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if ($723) {
               $724 = ((($$1263$i$i)) + 16|0);
               $725 = HEAP32[$724>>2]|0;
               $726 = ($725|0)==(0|0);
               if ($726) {
                break;
               } else {
                $$1263$i$i$be = $725;$$1265$i$i$be = $724;
               }
              } else {
               $$1263$i$i$be = $722;$$1265$i$i$be = $721;
              }
              $$1263$i$i = $$1263$i$i$be;$$1265$i$i = $$1265$i$i$be;
             }
             HEAP32[$$1265$i$i>>2] = 0;
             $$3$i$i = $$1263$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (5492 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($731|0)==($668|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(5192)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(5192)>>2] = $736;
             break L246;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $739 = ($738|0)==($668|0);
             $740 = ((($707)) + 20|0);
             $$sink321 = $739 ? $737 : $740;
             HEAP32[$$sink321>>2] = $$3$i$i;
             $741 = ($$3$i$i|0)==(0|0);
             if ($741) {
              break L246;
             }
            }
           } while(0);
           $742 = ((($$3$i$i)) + 24|0);
           HEAP32[$742>>2] = $707;
           $743 = ((($668)) + 16|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = ($744|0)==(0|0);
           if (!($745)) {
            $746 = ((($$3$i$i)) + 16|0);
            HEAP32[$746>>2] = $744;
            $747 = ((($744)) + 24|0);
            HEAP32[$747>>2] = $$3$i$i;
           }
           $748 = ((($743)) + 4|0);
           $749 = HEAP32[$748>>2]|0;
           $750 = ($749|0)==(0|0);
           if ($750) {
            break;
           }
           $751 = ((($$3$i$i)) + 20|0);
           HEAP32[$751>>2] = $749;
           $752 = ((($749)) + 24|0);
           HEAP32[$752>>2] = $$3$i$i;
          }
         } while(0);
         $753 = (($668) + ($692)|0);
         $754 = (($692) + ($673))|0;
         $$0$i$i = $753;$$0259$i$i = $754;
        } else {
         $$0$i$i = $668;$$0259$i$i = $673;
        }
        $755 = ((($$0$i$i)) + 4|0);
        $756 = HEAP32[$755>>2]|0;
        $757 = $756 & -2;
        HEAP32[$755>>2] = $757;
        $758 = $$0259$i$i | 1;
        $759 = ((($672)) + 4|0);
        HEAP32[$759>>2] = $758;
        $760 = (($672) + ($$0259$i$i)|0);
        HEAP32[$760>>2] = $$0259$i$i;
        $761 = $$0259$i$i >>> 3;
        $762 = ($$0259$i$i>>>0)<(256);
        if ($762) {
         $763 = $761 << 1;
         $764 = (5228 + ($763<<2)|0);
         $765 = HEAP32[1297]|0;
         $766 = 1 << $761;
         $767 = $765 & $766;
         $768 = ($767|0)==(0);
         if ($768) {
          $769 = $765 | $766;
          HEAP32[1297] = $769;
          $$pre$i16$i = ((($764)) + 8|0);
          $$0267$i$i = $764;$$pre$phi$i17$iZ2D = $$pre$i16$i;
         } else {
          $770 = ((($764)) + 8|0);
          $771 = HEAP32[$770>>2]|0;
          $$0267$i$i = $771;$$pre$phi$i17$iZ2D = $770;
         }
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $672;
         $772 = ((($$0267$i$i)) + 12|0);
         HEAP32[$772>>2] = $672;
         $773 = ((($672)) + 8|0);
         HEAP32[$773>>2] = $$0267$i$i;
         $774 = ((($672)) + 12|0);
         HEAP32[$774>>2] = $764;
         break;
        }
        $775 = $$0259$i$i >>> 8;
        $776 = ($775|0)==(0);
        do {
         if ($776) {
          $$0268$i$i = 0;
         } else {
          $777 = ($$0259$i$i>>>0)>(16777215);
          if ($777) {
           $$0268$i$i = 31;
           break;
          }
          $778 = (($775) + 1048320)|0;
          $779 = $778 >>> 16;
          $780 = $779 & 8;
          $781 = $775 << $780;
          $782 = (($781) + 520192)|0;
          $783 = $782 >>> 16;
          $784 = $783 & 4;
          $785 = $784 | $780;
          $786 = $781 << $784;
          $787 = (($786) + 245760)|0;
          $788 = $787 >>> 16;
          $789 = $788 & 2;
          $790 = $785 | $789;
          $791 = (14 - ($790))|0;
          $792 = $786 << $789;
          $793 = $792 >>> 15;
          $794 = (($791) + ($793))|0;
          $795 = $794 << 1;
          $796 = (($794) + 7)|0;
          $797 = $$0259$i$i >>> $796;
          $798 = $797 & 1;
          $799 = $798 | $795;
          $$0268$i$i = $799;
         }
        } while(0);
        $800 = (5492 + ($$0268$i$i<<2)|0);
        $801 = ((($672)) + 28|0);
        HEAP32[$801>>2] = $$0268$i$i;
        $802 = ((($672)) + 16|0);
        $803 = ((($802)) + 4|0);
        HEAP32[$803>>2] = 0;
        HEAP32[$802>>2] = 0;
        $804 = HEAP32[(5192)>>2]|0;
        $805 = 1 << $$0268$i$i;
        $806 = $804 & $805;
        $807 = ($806|0)==(0);
        if ($807) {
         $808 = $804 | $805;
         HEAP32[(5192)>>2] = $808;
         HEAP32[$800>>2] = $672;
         $809 = ((($672)) + 24|0);
         HEAP32[$809>>2] = $800;
         $810 = ((($672)) + 12|0);
         HEAP32[$810>>2] = $672;
         $811 = ((($672)) + 8|0);
         HEAP32[$811>>2] = $672;
         break;
        }
        $812 = HEAP32[$800>>2]|0;
        $813 = ((($812)) + 4|0);
        $814 = HEAP32[$813>>2]|0;
        $815 = $814 & -8;
        $816 = ($815|0)==($$0259$i$i|0);
        L291: do {
         if ($816) {
          $$0261$lcssa$i$i = $812;
         } else {
          $817 = ($$0268$i$i|0)==(31);
          $818 = $$0268$i$i >>> 1;
          $819 = (25 - ($818))|0;
          $820 = $817 ? 0 : $819;
          $821 = $$0259$i$i << $820;
          $$02604$i$i = $821;$$02613$i$i = $812;
          while(1) {
           $828 = $$02604$i$i >>> 31;
           $829 = (((($$02613$i$i)) + 16|0) + ($828<<2)|0);
           $824 = HEAP32[$829>>2]|0;
           $830 = ($824|0)==(0|0);
           if ($830) {
            break;
           }
           $822 = $$02604$i$i << 1;
           $823 = ((($824)) + 4|0);
           $825 = HEAP32[$823>>2]|0;
           $826 = $825 & -8;
           $827 = ($826|0)==($$0259$i$i|0);
           if ($827) {
            $$0261$lcssa$i$i = $824;
            break L291;
           } else {
            $$02604$i$i = $822;$$02613$i$i = $824;
           }
          }
          HEAP32[$829>>2] = $672;
          $831 = ((($672)) + 24|0);
          HEAP32[$831>>2] = $$02613$i$i;
          $832 = ((($672)) + 12|0);
          HEAP32[$832>>2] = $672;
          $833 = ((($672)) + 8|0);
          HEAP32[$833>>2] = $672;
          break L238;
         }
        } while(0);
        $834 = ((($$0261$lcssa$i$i)) + 8|0);
        $835 = HEAP32[$834>>2]|0;
        $836 = ((($835)) + 12|0);
        HEAP32[$836>>2] = $672;
        HEAP32[$834>>2] = $672;
        $837 = ((($672)) + 8|0);
        HEAP32[$837>>2] = $835;
        $838 = ((($672)) + 12|0);
        HEAP32[$838>>2] = $$0261$lcssa$i$i;
        $839 = ((($672)) + 24|0);
        HEAP32[$839>>2] = 0;
       }
      } while(0);
      $968 = ((($660)) + 8|0);
      $$0 = $968;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (5636);
    while(1) {
     $840 = HEAP32[$$0$i$i$i>>2]|0;
     $841 = ($840>>>0)>($585>>>0);
     if (!($841)) {
      $842 = ((($$0$i$i$i)) + 4|0);
      $843 = HEAP32[$842>>2]|0;
      $844 = (($840) + ($843)|0);
      $845 = ($844>>>0)>($585>>>0);
      if ($845) {
       break;
      }
     }
     $846 = ((($$0$i$i$i)) + 8|0);
     $847 = HEAP32[$846>>2]|0;
     $$0$i$i$i = $847;
    }
    $848 = ((($844)) + -47|0);
    $849 = ((($848)) + 8|0);
    $850 = $849;
    $851 = $850 & 7;
    $852 = ($851|0)==(0);
    $853 = (0 - ($850))|0;
    $854 = $853 & 7;
    $855 = $852 ? 0 : $854;
    $856 = (($848) + ($855)|0);
    $857 = ((($585)) + 16|0);
    $858 = ($856>>>0)<($857>>>0);
    $859 = $858 ? $585 : $856;
    $860 = ((($859)) + 8|0);
    $861 = ((($859)) + 24|0);
    $862 = (($$723947$i) + -40)|0;
    $863 = ((($$748$i)) + 8|0);
    $864 = $863;
    $865 = $864 & 7;
    $866 = ($865|0)==(0);
    $867 = (0 - ($864))|0;
    $868 = $867 & 7;
    $869 = $866 ? 0 : $868;
    $870 = (($$748$i) + ($869)|0);
    $871 = (($862) - ($869))|0;
    HEAP32[(5212)>>2] = $870;
    HEAP32[(5200)>>2] = $871;
    $872 = $871 | 1;
    $873 = ((($870)) + 4|0);
    HEAP32[$873>>2] = $872;
    $874 = (($$748$i) + ($862)|0);
    $875 = ((($874)) + 4|0);
    HEAP32[$875>>2] = 40;
    $876 = HEAP32[(5676)>>2]|0;
    HEAP32[(5216)>>2] = $876;
    $877 = ((($859)) + 4|0);
    HEAP32[$877>>2] = 27;
    ;HEAP32[$860>>2]=HEAP32[(5636)>>2]|0;HEAP32[$860+4>>2]=HEAP32[(5636)+4>>2]|0;HEAP32[$860+8>>2]=HEAP32[(5636)+8>>2]|0;HEAP32[$860+12>>2]=HEAP32[(5636)+12>>2]|0;
    HEAP32[(5636)>>2] = $$748$i;
    HEAP32[(5640)>>2] = $$723947$i;
    HEAP32[(5648)>>2] = 0;
    HEAP32[(5644)>>2] = $860;
    $879 = $861;
    while(1) {
     $878 = ((($879)) + 4|0);
     HEAP32[$878>>2] = 7;
     $880 = ((($879)) + 8|0);
     $881 = ($880>>>0)<($844>>>0);
     if ($881) {
      $879 = $878;
     } else {
      break;
     }
    }
    $882 = ($859|0)==($585|0);
    if (!($882)) {
     $883 = $859;
     $884 = $585;
     $885 = (($883) - ($884))|0;
     $886 = HEAP32[$877>>2]|0;
     $887 = $886 & -2;
     HEAP32[$877>>2] = $887;
     $888 = $885 | 1;
     $889 = ((($585)) + 4|0);
     HEAP32[$889>>2] = $888;
     HEAP32[$859>>2] = $885;
     $890 = $885 >>> 3;
     $891 = ($885>>>0)<(256);
     if ($891) {
      $892 = $890 << 1;
      $893 = (5228 + ($892<<2)|0);
      $894 = HEAP32[1297]|0;
      $895 = 1 << $890;
      $896 = $894 & $895;
      $897 = ($896|0)==(0);
      if ($897) {
       $898 = $894 | $895;
       HEAP32[1297] = $898;
       $$pre$i$i = ((($893)) + 8|0);
       $$0206$i$i = $893;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $899 = ((($893)) + 8|0);
       $900 = HEAP32[$899>>2]|0;
       $$0206$i$i = $900;$$pre$phi$i$iZ2D = $899;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $585;
      $901 = ((($$0206$i$i)) + 12|0);
      HEAP32[$901>>2] = $585;
      $902 = ((($585)) + 8|0);
      HEAP32[$902>>2] = $$0206$i$i;
      $903 = ((($585)) + 12|0);
      HEAP32[$903>>2] = $893;
      break;
     }
     $904 = $885 >>> 8;
     $905 = ($904|0)==(0);
     if ($905) {
      $$0207$i$i = 0;
     } else {
      $906 = ($885>>>0)>(16777215);
      if ($906) {
       $$0207$i$i = 31;
      } else {
       $907 = (($904) + 1048320)|0;
       $908 = $907 >>> 16;
       $909 = $908 & 8;
       $910 = $904 << $909;
       $911 = (($910) + 520192)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 4;
       $914 = $913 | $909;
       $915 = $910 << $913;
       $916 = (($915) + 245760)|0;
       $917 = $916 >>> 16;
       $918 = $917 & 2;
       $919 = $914 | $918;
       $920 = (14 - ($919))|0;
       $921 = $915 << $918;
       $922 = $921 >>> 15;
       $923 = (($920) + ($922))|0;
       $924 = $923 << 1;
       $925 = (($923) + 7)|0;
       $926 = $885 >>> $925;
       $927 = $926 & 1;
       $928 = $927 | $924;
       $$0207$i$i = $928;
      }
     }
     $929 = (5492 + ($$0207$i$i<<2)|0);
     $930 = ((($585)) + 28|0);
     HEAP32[$930>>2] = $$0207$i$i;
     $931 = ((($585)) + 20|0);
     HEAP32[$931>>2] = 0;
     HEAP32[$857>>2] = 0;
     $932 = HEAP32[(5192)>>2]|0;
     $933 = 1 << $$0207$i$i;
     $934 = $932 & $933;
     $935 = ($934|0)==(0);
     if ($935) {
      $936 = $932 | $933;
      HEAP32[(5192)>>2] = $936;
      HEAP32[$929>>2] = $585;
      $937 = ((($585)) + 24|0);
      HEAP32[$937>>2] = $929;
      $938 = ((($585)) + 12|0);
      HEAP32[$938>>2] = $585;
      $939 = ((($585)) + 8|0);
      HEAP32[$939>>2] = $585;
      break;
     }
     $940 = HEAP32[$929>>2]|0;
     $941 = ((($940)) + 4|0);
     $942 = HEAP32[$941>>2]|0;
     $943 = $942 & -8;
     $944 = ($943|0)==($885|0);
     L325: do {
      if ($944) {
       $$0202$lcssa$i$i = $940;
      } else {
       $945 = ($$0207$i$i|0)==(31);
       $946 = $$0207$i$i >>> 1;
       $947 = (25 - ($946))|0;
       $948 = $945 ? 0 : $947;
       $949 = $885 << $948;
       $$02014$i$i = $949;$$02023$i$i = $940;
       while(1) {
        $956 = $$02014$i$i >>> 31;
        $957 = (((($$02023$i$i)) + 16|0) + ($956<<2)|0);
        $952 = HEAP32[$957>>2]|0;
        $958 = ($952|0)==(0|0);
        if ($958) {
         break;
        }
        $950 = $$02014$i$i << 1;
        $951 = ((($952)) + 4|0);
        $953 = HEAP32[$951>>2]|0;
        $954 = $953 & -8;
        $955 = ($954|0)==($885|0);
        if ($955) {
         $$0202$lcssa$i$i = $952;
         break L325;
        } else {
         $$02014$i$i = $950;$$02023$i$i = $952;
        }
       }
       HEAP32[$957>>2] = $585;
       $959 = ((($585)) + 24|0);
       HEAP32[$959>>2] = $$02023$i$i;
       $960 = ((($585)) + 12|0);
       HEAP32[$960>>2] = $585;
       $961 = ((($585)) + 8|0);
       HEAP32[$961>>2] = $585;
       break L215;
      }
     } while(0);
     $962 = ((($$0202$lcssa$i$i)) + 8|0);
     $963 = HEAP32[$962>>2]|0;
     $964 = ((($963)) + 12|0);
     HEAP32[$964>>2] = $585;
     HEAP32[$962>>2] = $585;
     $965 = ((($585)) + 8|0);
     HEAP32[$965>>2] = $963;
     $966 = ((($585)) + 12|0);
     HEAP32[$966>>2] = $$0202$lcssa$i$i;
     $967 = ((($585)) + 24|0);
     HEAP32[$967>>2] = 0;
    }
   }
  } while(0);
  $969 = HEAP32[(5200)>>2]|0;
  $970 = ($969>>>0)>($$0192>>>0);
  if ($970) {
   $971 = (($969) - ($$0192))|0;
   HEAP32[(5200)>>2] = $971;
   $972 = HEAP32[(5212)>>2]|0;
   $973 = (($972) + ($$0192)|0);
   HEAP32[(5212)>>2] = $973;
   $974 = $971 | 1;
   $975 = ((($973)) + 4|0);
   HEAP32[$975>>2] = $974;
   $976 = $$0192 | 3;
   $977 = ((($972)) + 4|0);
   HEAP32[$977>>2] = $976;
   $978 = ((($972)) + 8|0);
   $$0 = $978;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $979 = (___errno_location()|0);
 HEAP32[$979>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0194$i = 0, $$0194$in$i = 0, $$0346381 = 0, $$0347$lcssa = 0, $$0347380 = 0, $$0359 = 0, $$0366 = 0, $$1 = 0, $$1345 = 0, $$1350 = 0, $$1350$be = 0, $$1350$ph = 0, $$1353 = 0, $$1353$be = 0, $$1353$ph = 0, $$1361 = 0, $$1361$be = 0, $$1361$ph = 0, $$1365 = 0, $$1365$be = 0;
 var $$1365$ph = 0, $$2 = 0, $$3 = 0, $$3363 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink395 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond371 = 0, $cond372 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(5204)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(5208)>>2]|0;
   $18 = ($17|0)==($14|0);
   if ($18) {
    $79 = ((($7)) + 4|0);
    $80 = HEAP32[$79>>2]|0;
    $81 = $80 & 3;
    $82 = ($81|0)==(3);
    if (!($82)) {
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    }
    $83 = (($14) + ($15)|0);
    $84 = ((($14)) + 4|0);
    $85 = $15 | 1;
    $86 = $80 & -2;
    HEAP32[(5196)>>2] = $15;
    HEAP32[$79>>2] = $86;
    HEAP32[$84>>2] = $85;
    HEAP32[$83>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[1297]|0;
     $29 = $28 & $27;
     HEAP32[1297] = $29;
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1350$ph = $45;$$1353$ph = $41;
      }
     } else {
      $$1350$ph = $43;$$1353$ph = $42;
     }
     $$1350 = $$1350$ph;$$1353 = $$1353$ph;
     while(1) {
      $47 = ((($$1350)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if ($49) {
       $50 = ((($$1350)) + 16|0);
       $51 = HEAP32[$50>>2]|0;
       $52 = ($51|0)==(0|0);
       if ($52) {
        break;
       } else {
        $$1350$be = $51;$$1353$be = $50;
       }
      } else {
       $$1350$be = $48;$$1353$be = $47;
      }
      $$1350 = $$1350$be;$$1353 = $$1353$be;
     }
     HEAP32[$$1353>>2] = 0;
     $$3 = $$1350;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1345 = $15;$88 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (5492 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($57|0)==($14|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond371 = ($$3|0)==(0|0);
     if ($cond371) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(5192)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(5192)>>2] = $62;
      $$1 = $14;$$1345 = $15;$88 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $65 = ($64|0)==($14|0);
     $66 = ((($33)) + 20|0);
     $$sink = $65 ? $63 : $66;
     HEAP32[$$sink>>2] = $$3;
     $67 = ($$3|0)==(0|0);
     if ($67) {
      $$1 = $14;$$1345 = $15;$88 = $14;
      break;
     }
    }
    $68 = ((($$3)) + 24|0);
    HEAP32[$68>>2] = $33;
    $69 = ((($14)) + 16|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($70|0)==(0|0);
    if (!($71)) {
     $72 = ((($$3)) + 16|0);
     HEAP32[$72>>2] = $70;
     $73 = ((($70)) + 24|0);
     HEAP32[$73>>2] = $$3;
    }
    $74 = ((($69)) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($75|0)==(0|0);
    if ($76) {
     $$1 = $14;$$1345 = $15;$88 = $14;
    } else {
     $77 = ((($$3)) + 20|0);
     HEAP32[$77>>2] = $75;
     $78 = ((($75)) + 24|0);
     HEAP32[$78>>2] = $$3;
     $$1 = $14;$$1345 = $15;$88 = $14;
    }
   }
  } else {
   $$1 = $2;$$1345 = $6;$88 = $2;
  }
 } while(0);
 $87 = ($88>>>0)<($7>>>0);
 if (!($87)) {
  return;
 }
 $89 = ((($7)) + 4|0);
 $90 = HEAP32[$89>>2]|0;
 $91 = $90 & 1;
 $92 = ($91|0)==(0);
 if ($92) {
  return;
 }
 $93 = $90 & 2;
 $94 = ($93|0)==(0);
 if ($94) {
  $95 = HEAP32[(5212)>>2]|0;
  $96 = ($95|0)==($7|0);
  if ($96) {
   $97 = HEAP32[(5200)>>2]|0;
   $98 = (($97) + ($$1345))|0;
   HEAP32[(5200)>>2] = $98;
   HEAP32[(5212)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = HEAP32[(5208)>>2]|0;
   $102 = ($$1|0)==($101|0);
   if (!($102)) {
    return;
   }
   HEAP32[(5208)>>2] = 0;
   HEAP32[(5196)>>2] = 0;
   return;
  }
  $103 = HEAP32[(5208)>>2]|0;
  $104 = ($103|0)==($7|0);
  if ($104) {
   $105 = HEAP32[(5196)>>2]|0;
   $106 = (($105) + ($$1345))|0;
   HEAP32[(5196)>>2] = $106;
   HEAP32[(5208)>>2] = $88;
   $107 = $106 | 1;
   $108 = ((($$1)) + 4|0);
   HEAP32[$108>>2] = $107;
   $109 = (($88) + ($106)|0);
   HEAP32[$109>>2] = $106;
   return;
  }
  $110 = $90 & -8;
  $111 = (($110) + ($$1345))|0;
  $112 = $90 >>> 3;
  $113 = ($90>>>0)<(256);
  do {
   if ($113) {
    $114 = ((($7)) + 8|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ((($7)) + 12|0);
    $117 = HEAP32[$116>>2]|0;
    $118 = ($117|0)==($115|0);
    if ($118) {
     $119 = 1 << $112;
     $120 = $119 ^ -1;
     $121 = HEAP32[1297]|0;
     $122 = $121 & $120;
     HEAP32[1297] = $122;
     break;
    } else {
     $123 = ((($115)) + 12|0);
     HEAP32[$123>>2] = $117;
     $124 = ((($117)) + 8|0);
     HEAP32[$124>>2] = $115;
     break;
    }
   } else {
    $125 = ((($7)) + 24|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ((($7)) + 12|0);
    $128 = HEAP32[$127>>2]|0;
    $129 = ($128|0)==($7|0);
    do {
     if ($129) {
      $134 = ((($7)) + 16|0);
      $135 = ((($134)) + 4|0);
      $136 = HEAP32[$135>>2]|0;
      $137 = ($136|0)==(0|0);
      if ($137) {
       $138 = HEAP32[$134>>2]|0;
       $139 = ($138|0)==(0|0);
       if ($139) {
        $$3363 = 0;
        break;
       } else {
        $$1361$ph = $138;$$1365$ph = $134;
       }
      } else {
       $$1361$ph = $136;$$1365$ph = $135;
      }
      $$1361 = $$1361$ph;$$1365 = $$1365$ph;
      while(1) {
       $140 = ((($$1361)) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        $143 = ((($$1361)) + 16|0);
        $144 = HEAP32[$143>>2]|0;
        $145 = ($144|0)==(0|0);
        if ($145) {
         break;
        } else {
         $$1361$be = $144;$$1365$be = $143;
        }
       } else {
        $$1361$be = $141;$$1365$be = $140;
       }
       $$1361 = $$1361$be;$$1365 = $$1365$be;
      }
      HEAP32[$$1365>>2] = 0;
      $$3363 = $$1361;
     } else {
      $130 = ((($7)) + 8|0);
      $131 = HEAP32[$130>>2]|0;
      $132 = ((($131)) + 12|0);
      HEAP32[$132>>2] = $128;
      $133 = ((($128)) + 8|0);
      HEAP32[$133>>2] = $131;
      $$3363 = $128;
     }
    } while(0);
    $146 = ($126|0)==(0|0);
    if (!($146)) {
     $147 = ((($7)) + 28|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = (5492 + ($148<<2)|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($7|0);
     if ($151) {
      HEAP32[$149>>2] = $$3363;
      $cond372 = ($$3363|0)==(0|0);
      if ($cond372) {
       $152 = 1 << $148;
       $153 = $152 ^ -1;
       $154 = HEAP32[(5192)>>2]|0;
       $155 = $154 & $153;
       HEAP32[(5192)>>2] = $155;
       break;
      }
     } else {
      $156 = ((($126)) + 16|0);
      $157 = HEAP32[$156>>2]|0;
      $158 = ($157|0)==($7|0);
      $159 = ((($126)) + 20|0);
      $$sink395 = $158 ? $156 : $159;
      HEAP32[$$sink395>>2] = $$3363;
      $160 = ($$3363|0)==(0|0);
      if ($160) {
       break;
      }
     }
     $161 = ((($$3363)) + 24|0);
     HEAP32[$161>>2] = $126;
     $162 = ((($7)) + 16|0);
     $163 = HEAP32[$162>>2]|0;
     $164 = ($163|0)==(0|0);
     if (!($164)) {
      $165 = ((($$3363)) + 16|0);
      HEAP32[$165>>2] = $163;
      $166 = ((($163)) + 24|0);
      HEAP32[$166>>2] = $$3363;
     }
     $167 = ((($162)) + 4|0);
     $168 = HEAP32[$167>>2]|0;
     $169 = ($168|0)==(0|0);
     if (!($169)) {
      $170 = ((($$3363)) + 20|0);
      HEAP32[$170>>2] = $168;
      $171 = ((($168)) + 24|0);
      HEAP32[$171>>2] = $$3363;
     }
    }
   }
  } while(0);
  $172 = $111 | 1;
  $173 = ((($$1)) + 4|0);
  HEAP32[$173>>2] = $172;
  $174 = (($88) + ($111)|0);
  HEAP32[$174>>2] = $111;
  $175 = HEAP32[(5208)>>2]|0;
  $176 = ($$1|0)==($175|0);
  if ($176) {
   HEAP32[(5196)>>2] = $111;
   return;
  } else {
   $$2 = $111;
  }
 } else {
  $177 = $90 & -2;
  HEAP32[$89>>2] = $177;
  $178 = $$1345 | 1;
  $179 = ((($$1)) + 4|0);
  HEAP32[$179>>2] = $178;
  $180 = (($88) + ($$1345)|0);
  HEAP32[$180>>2] = $$1345;
  $$2 = $$1345;
 }
 $181 = $$2 >>> 3;
 $182 = ($$2>>>0)<(256);
 if ($182) {
  $183 = $181 << 1;
  $184 = (5228 + ($183<<2)|0);
  $185 = HEAP32[1297]|0;
  $186 = 1 << $181;
  $187 = $185 & $186;
  $188 = ($187|0)==(0);
  if ($188) {
   $189 = $185 | $186;
   HEAP32[1297] = $189;
   $$pre = ((($184)) + 8|0);
   $$0366 = $184;$$pre$phiZ2D = $$pre;
  } else {
   $190 = ((($184)) + 8|0);
   $191 = HEAP32[$190>>2]|0;
   $$0366 = $191;$$pre$phiZ2D = $190;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $192 = ((($$0366)) + 12|0);
  HEAP32[$192>>2] = $$1;
  $193 = ((($$1)) + 8|0);
  HEAP32[$193>>2] = $$0366;
  $194 = ((($$1)) + 12|0);
  HEAP32[$194>>2] = $184;
  return;
 }
 $195 = $$2 >>> 8;
 $196 = ($195|0)==(0);
 if ($196) {
  $$0359 = 0;
 } else {
  $197 = ($$2>>>0)>(16777215);
  if ($197) {
   $$0359 = 31;
  } else {
   $198 = (($195) + 1048320)|0;
   $199 = $198 >>> 16;
   $200 = $199 & 8;
   $201 = $195 << $200;
   $202 = (($201) + 520192)|0;
   $203 = $202 >>> 16;
   $204 = $203 & 4;
   $205 = $204 | $200;
   $206 = $201 << $204;
   $207 = (($206) + 245760)|0;
   $208 = $207 >>> 16;
   $209 = $208 & 2;
   $210 = $205 | $209;
   $211 = (14 - ($210))|0;
   $212 = $206 << $209;
   $213 = $212 >>> 15;
   $214 = (($211) + ($213))|0;
   $215 = $214 << 1;
   $216 = (($214) + 7)|0;
   $217 = $$2 >>> $216;
   $218 = $217 & 1;
   $219 = $218 | $215;
   $$0359 = $219;
  }
 }
 $220 = (5492 + ($$0359<<2)|0);
 $221 = ((($$1)) + 28|0);
 HEAP32[$221>>2] = $$0359;
 $222 = ((($$1)) + 16|0);
 $223 = ((($$1)) + 20|0);
 HEAP32[$223>>2] = 0;
 HEAP32[$222>>2] = 0;
 $224 = HEAP32[(5192)>>2]|0;
 $225 = 1 << $$0359;
 $226 = $224 & $225;
 $227 = ($226|0)==(0);
 L112: do {
  if ($227) {
   $228 = $224 | $225;
   HEAP32[(5192)>>2] = $228;
   HEAP32[$220>>2] = $$1;
   $229 = ((($$1)) + 24|0);
   HEAP32[$229>>2] = $220;
   $230 = ((($$1)) + 12|0);
   HEAP32[$230>>2] = $$1;
   $231 = ((($$1)) + 8|0);
   HEAP32[$231>>2] = $$1;
  } else {
   $232 = HEAP32[$220>>2]|0;
   $233 = ((($232)) + 4|0);
   $234 = HEAP32[$233>>2]|0;
   $235 = $234 & -8;
   $236 = ($235|0)==($$2|0);
   L115: do {
    if ($236) {
     $$0347$lcssa = $232;
    } else {
     $237 = ($$0359|0)==(31);
     $238 = $$0359 >>> 1;
     $239 = (25 - ($238))|0;
     $240 = $237 ? 0 : $239;
     $241 = $$2 << $240;
     $$0346381 = $241;$$0347380 = $232;
     while(1) {
      $248 = $$0346381 >>> 31;
      $249 = (((($$0347380)) + 16|0) + ($248<<2)|0);
      $244 = HEAP32[$249>>2]|0;
      $250 = ($244|0)==(0|0);
      if ($250) {
       break;
      }
      $242 = $$0346381 << 1;
      $243 = ((($244)) + 4|0);
      $245 = HEAP32[$243>>2]|0;
      $246 = $245 & -8;
      $247 = ($246|0)==($$2|0);
      if ($247) {
       $$0347$lcssa = $244;
       break L115;
      } else {
       $$0346381 = $242;$$0347380 = $244;
      }
     }
     HEAP32[$249>>2] = $$1;
     $251 = ((($$1)) + 24|0);
     HEAP32[$251>>2] = $$0347380;
     $252 = ((($$1)) + 12|0);
     HEAP32[$252>>2] = $$1;
     $253 = ((($$1)) + 8|0);
     HEAP32[$253>>2] = $$1;
     break L112;
    }
   } while(0);
   $254 = ((($$0347$lcssa)) + 8|0);
   $255 = HEAP32[$254>>2]|0;
   $256 = ((($255)) + 12|0);
   HEAP32[$256>>2] = $$1;
   HEAP32[$254>>2] = $$1;
   $257 = ((($$1)) + 8|0);
   HEAP32[$257>>2] = $255;
   $258 = ((($$1)) + 12|0);
   HEAP32[$258>>2] = $$0347$lcssa;
   $259 = ((($$1)) + 24|0);
   HEAP32[$259>>2] = 0;
  }
 } while(0);
 $260 = HEAP32[(5220)>>2]|0;
 $261 = (($260) + -1)|0;
 HEAP32[(5220)>>2] = $261;
 $262 = ($261|0)==(0);
 if (!($262)) {
  return;
 }
 $$0194$in$i = (5644);
 while(1) {
  $$0194$i = HEAP32[$$0194$in$i>>2]|0;
  $263 = ($$0194$i|0)==(0|0);
  $264 = ((($$0194$i)) + 8|0);
  if ($263) {
   break;
  } else {
   $$0194$in$i = $264;
  }
 }
 HEAP32[(5220)>>2] = -1;
 return;
}
function _calloc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $spec$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = Math_imul($1, $0)|0;
  $4 = $1 | $0;
  $5 = ($4>>>0)>(65535);
  if ($5) {
   $6 = (($3>>>0) / ($0>>>0))&-1;
   $7 = ($6|0)==($1|0);
   $spec$select = $7 ? $3 : -1;
   $$0 = $spec$select;
  } else {
   $$0 = $3;
  }
 }
 $8 = (_malloc($$0)|0);
 $9 = ($8|0)==(0|0);
 if ($9) {
  return ($8|0);
 }
 $10 = ((($8)) + -4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = $11 & 3;
 $13 = ($12|0)==(0);
 if ($13) {
  return ($8|0);
 }
 (_memset(($8|0),0,($$0|0))|0);
 return ($8|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_569($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 32|0;
 $vararg_buffer = sp + 16|0;
 $3 = sp;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$27 = $17;
   while(1) {
    $26 = ($27|0)<(0);
    if ($26) {
     break;
    }
    $35 = (($$04855) - ($27))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($27>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($27) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$27 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (5748|0);
}
function _dummy_569($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 8;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function _isdigit($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -48)|0;
 $2 = ($1>>>0)<(10);
 $3 = $2&1;
 return ($3|0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $spec$select = 0, $spec$select41 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $3 = sp + 208|0;
 $4 = sp + 160|0;
 $5 = sp + 80|0;
 $6 = sp;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $40 = $12;
  } else {
   $40 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 15]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $spec$select = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $spec$select;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $spec$select41 = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $39 = ($40|0)==(0);
  if (!($39)) {
   ___unlockfile($0);
  }
  $$0 = $spec$select41;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$0 = 0, $$0228 = 0, $$0229334 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240313 = 0, $$0240313371 = 0, $$0240333 = 0, $$0243 = 0, $$0243$ph = 0, $$0243$ph$be = 0, $$0247 = 0, $$0247$ph = 0, $$0249$lcssa = 0, $$0249321 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0;
 var $$0259 = 0, $$0262$lcssa = 0, $$0262328 = 0, $$0269$ph = 0, $$1 = 0, $$1230340 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241339 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0, $$1260 = 0, $$1263 = 0, $$1270 = 0, $$2 = 0, $$2234 = 0, $$2239 = 0, $$2242320 = 0;
 var $$2256 = 0, $$2256$ = 0, $$2261 = 0, $$2271 = 0, $$3257 = 0, $$3265 = 0, $$3272 = 0, $$3317 = 0, $$4258370 = 0, $$4266 = 0, $$5 = 0, $$6268 = 0, $$lcssa308 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$pre360 = 0, $$pre362 = 0, $$pre363 = 0, $$pre363$pre = 0, $$pre364 = 0;
 var $$pre368 = 0, $$sink = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0;
 var $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0.0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0;
 var $arglist_next3 = 0, $brmerge = 0, $brmerge326 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $or$cond = 0, $or$cond276 = 0, $or$cond278 = 0, $or$cond283 = 0, $spec$select = 0, $spec$select281 = 0, $spec$select284 = 0;
 var $spec$select291 = 0, $spec$select292 = 0, $spec$select293 = 0, $spec$select294 = 0, $spec$select295 = 0, $spec$select296 = 0, $spec$select297 = 0, $spec$select298 = 0, $spec$select299 = 0, $storemerge273$lcssa = 0, $storemerge273327 = 0, $storemerge274 = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $5 = sp + 56|0;
 $6 = sp + 40|0;
 $7 = sp;
 $8 = sp + 48|0;
 $9 = sp + 60|0;
 HEAP32[$5>>2] = $1;
 $10 = ($0|0)!=(0|0);
 $11 = ((($7)) + 40|0);
 $12 = $11;
 $13 = ((($7)) + 39|0);
 $14 = ((($8)) + 4|0);
 $$0243$ph = 0;$$0247$ph = 0;$$0269$ph = 0;
 L1: while(1) {
  $$0243 = $$0243$ph;$$0247 = $$0247$ph;
  while(1) {
   $15 = ($$0247|0)>(-1);
   do {
    if ($15) {
     $16 = (2147483647 - ($$0247))|0;
     $17 = ($$0243|0)>($16|0);
     if ($17) {
      $18 = (___errno_location()|0);
      HEAP32[$18>>2] = 75;
      $$1248 = -1;
      break;
     } else {
      $19 = (($$0243) + ($$0247))|0;
      $$1248 = $19;
      break;
     }
    } else {
     $$1248 = $$0247;
    }
   } while(0);
   $20 = HEAP32[$5>>2]|0;
   $21 = HEAP8[$20>>0]|0;
   $22 = ($21<<24>>24)==(0);
   if ($22) {
    label = 94;
    break L1;
   }
   $23 = $21;$25 = $20;
   L12: while(1) {
    switch ($23<<24>>24) {
    case 37:  {
     label = 10;
     break L12;
     break;
    }
    case 0:  {
     $$0249$lcssa = $25;
     break L12;
     break;
    }
    default: {
    }
    }
    $24 = ((($25)) + 1|0);
    HEAP32[$5>>2] = $24;
    $$pre = HEAP8[$24>>0]|0;
    $23 = $$pre;$25 = $24;
   }
   L15: do {
    if ((label|0) == 10) {
     label = 0;
     $$0249321 = $25;$27 = $25;
     while(1) {
      $26 = ((($27)) + 1|0);
      $28 = HEAP8[$26>>0]|0;
      $29 = ($28<<24>>24)==(37);
      if (!($29)) {
       $$0249$lcssa = $$0249321;
       break L15;
      }
      $30 = ((($$0249321)) + 1|0);
      $31 = ((($27)) + 2|0);
      HEAP32[$5>>2] = $31;
      $32 = HEAP8[$31>>0]|0;
      $33 = ($32<<24>>24)==(37);
      if ($33) {
       $$0249321 = $30;$27 = $31;
      } else {
       $$0249$lcssa = $30;
       break;
      }
     }
    }
   } while(0);
   $34 = $$0249$lcssa;
   $35 = $20;
   $36 = (($34) - ($35))|0;
   if ($10) {
    _out($0,$20,$36);
   }
   $37 = ($36|0)==(0);
   if ($37) {
    break;
   } else {
    $$0243 = $36;$$0247 = $$1248;
   }
  }
  $38 = HEAP32[$5>>2]|0;
  $39 = ((($38)) + 1|0);
  $40 = HEAP8[$39>>0]|0;
  $41 = $40 << 24 >> 24;
  $42 = (_isdigit($41)|0);
  $43 = ($42|0)==(0);
  $$pre360 = HEAP32[$5>>2]|0;
  if ($43) {
   $$0253 = -1;$$1270 = $$0269$ph;$$sink = 1;
  } else {
   $44 = ((($$pre360)) + 2|0);
   $45 = HEAP8[$44>>0]|0;
   $46 = ($45<<24>>24)==(36);
   if ($46) {
    $47 = ((($$pre360)) + 1|0);
    $48 = HEAP8[$47>>0]|0;
    $49 = $48 << 24 >> 24;
    $50 = (($49) + -48)|0;
    $$0253 = $50;$$1270 = 1;$$sink = 3;
   } else {
    $$0253 = -1;$$1270 = $$0269$ph;$$sink = 1;
   }
  }
  $51 = (($$pre360) + ($$sink)|0);
  HEAP32[$5>>2] = $51;
  $52 = HEAP8[$51>>0]|0;
  $53 = $52 << 24 >> 24;
  $54 = (($53) + -32)|0;
  $55 = ($54>>>0)>(31);
  $56 = 1 << $54;
  $57 = $56 & 75913;
  $58 = ($57|0)==(0);
  $brmerge326 = $55 | $58;
  if ($brmerge326) {
   $$0262$lcssa = 0;$$lcssa308 = $52;$storemerge273$lcssa = $51;
  } else {
   $$0262328 = 0;$60 = $54;$storemerge273327 = $51;
   while(1) {
    $59 = 1 << $60;
    $61 = $59 | $$0262328;
    $62 = ((($storemerge273327)) + 1|0);
    HEAP32[$5>>2] = $62;
    $63 = HEAP8[$62>>0]|0;
    $64 = $63 << 24 >> 24;
    $65 = (($64) + -32)|0;
    $66 = ($65>>>0)>(31);
    $67 = 1 << $65;
    $68 = $67 & 75913;
    $69 = ($68|0)==(0);
    $brmerge = $66 | $69;
    if ($brmerge) {
     $$0262$lcssa = $61;$$lcssa308 = $63;$storemerge273$lcssa = $62;
     break;
    } else {
     $$0262328 = $61;$60 = $65;$storemerge273327 = $62;
    }
   }
  }
  $70 = ($$lcssa308<<24>>24)==(42);
  if ($70) {
   $71 = ((($storemerge273$lcssa)) + 1|0);
   $72 = HEAP8[$71>>0]|0;
   $73 = $72 << 24 >> 24;
   $74 = (_isdigit($73)|0);
   $75 = ($74|0)==(0);
   if ($75) {
    label = 27;
   } else {
    $76 = HEAP32[$5>>2]|0;
    $77 = ((($76)) + 2|0);
    $78 = HEAP8[$77>>0]|0;
    $79 = ($78<<24>>24)==(36);
    if ($79) {
     $80 = ((($76)) + 1|0);
     $81 = HEAP8[$80>>0]|0;
     $82 = $81 << 24 >> 24;
     $83 = (($82) + -48)|0;
     $84 = (($4) + ($83<<2)|0);
     HEAP32[$84>>2] = 10;
     $85 = HEAP8[$80>>0]|0;
     $86 = $85 << 24 >> 24;
     $87 = (($86) + -48)|0;
     $88 = (($3) + ($87<<3)|0);
     $89 = $88;
     $90 = $89;
     $91 = HEAP32[$90>>2]|0;
     $92 = (($89) + 4)|0;
     $93 = $92;
     $94 = HEAP32[$93>>2]|0;
     $95 = ((($76)) + 3|0);
     $$0259 = $91;$$2271 = 1;$storemerge274 = $95;
    } else {
     label = 27;
    }
   }
   if ((label|0) == 27) {
    label = 0;
    $96 = ($$1270|0)==(0);
    if (!($96)) {
     $$0 = -1;
     break;
    }
    if ($10) {
     $arglist_current = HEAP32[$2>>2]|0;
     $97 = $arglist_current;
     $98 = ((0) + 4|0);
     $expanded4 = $98;
     $expanded = (($expanded4) - 1)|0;
     $99 = (($97) + ($expanded))|0;
     $100 = ((0) + 4|0);
     $expanded8 = $100;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $101 = $99 & $expanded6;
     $102 = $101;
     $103 = HEAP32[$102>>2]|0;
     $arglist_next = ((($102)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $358 = $103;
    } else {
     $358 = 0;
    }
    $104 = HEAP32[$5>>2]|0;
    $105 = ((($104)) + 1|0);
    $$0259 = $358;$$2271 = 0;$storemerge274 = $105;
   }
   HEAP32[$5>>2] = $storemerge274;
   $106 = ($$0259|0)<(0);
   $107 = $$0262$lcssa | 8192;
   $108 = (0 - ($$0259))|0;
   $spec$select291 = $106 ? $107 : $$0262$lcssa;
   $spec$select292 = $106 ? $108 : $$0259;
   $$1260 = $spec$select292;$$1263 = $spec$select291;$$3272 = $$2271;$112 = $storemerge274;
  } else {
   $109 = (_getint($5)|0);
   $110 = ($109|0)<(0);
   if ($110) {
    $$0 = -1;
    break;
   }
   $$pre362 = HEAP32[$5>>2]|0;
   $$1260 = $109;$$1263 = $$0262$lcssa;$$3272 = $$1270;$112 = $$pre362;
  }
  $111 = HEAP8[$112>>0]|0;
  $113 = ($111<<24>>24)==(46);
  do {
   if ($113) {
    $114 = ((($112)) + 1|0);
    $115 = HEAP8[$114>>0]|0;
    $116 = ($115<<24>>24)==(42);
    if (!($116)) {
     HEAP32[$5>>2] = $114;
     $152 = (_getint($5)|0);
     $$pre363$pre = HEAP32[$5>>2]|0;
     $$0254 = $152;$$pre363 = $$pre363$pre;
     break;
    }
    $117 = ((($112)) + 2|0);
    $118 = HEAP8[$117>>0]|0;
    $119 = $118 << 24 >> 24;
    $120 = (_isdigit($119)|0);
    $121 = ($120|0)==(0);
    if (!($121)) {
     $122 = HEAP32[$5>>2]|0;
     $123 = ((($122)) + 3|0);
     $124 = HEAP8[$123>>0]|0;
     $125 = ($124<<24>>24)==(36);
     if ($125) {
      $126 = ((($122)) + 2|0);
      $127 = HEAP8[$126>>0]|0;
      $128 = $127 << 24 >> 24;
      $129 = (($128) + -48)|0;
      $130 = (($4) + ($129<<2)|0);
      HEAP32[$130>>2] = 10;
      $131 = HEAP8[$126>>0]|0;
      $132 = $131 << 24 >> 24;
      $133 = (($132) + -48)|0;
      $134 = (($3) + ($133<<3)|0);
      $135 = $134;
      $136 = $135;
      $137 = HEAP32[$136>>2]|0;
      $138 = (($135) + 4)|0;
      $139 = $138;
      $140 = HEAP32[$139>>2]|0;
      $141 = ((($122)) + 4|0);
      HEAP32[$5>>2] = $141;
      $$0254 = $137;$$pre363 = $141;
      break;
     }
    }
    $142 = ($$3272|0)==(0);
    if (!($142)) {
     $$0 = -1;
     break L1;
    }
    if ($10) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $143 = $arglist_current2;
     $144 = ((0) + 4|0);
     $expanded11 = $144;
     $expanded10 = (($expanded11) - 1)|0;
     $145 = (($143) + ($expanded10))|0;
     $146 = ((0) + 4|0);
     $expanded15 = $146;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $147 = $145 & $expanded13;
     $148 = $147;
     $149 = HEAP32[$148>>2]|0;
     $arglist_next3 = ((($148)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $359 = $149;
    } else {
     $359 = 0;
    }
    $150 = HEAP32[$5>>2]|0;
    $151 = ((($150)) + 2|0);
    HEAP32[$5>>2] = $151;
    $$0254 = $359;$$pre363 = $151;
   } else {
    $$0254 = -1;$$pre363 = $112;
   }
  } while(0);
  $$0252 = 0;$154 = $$pre363;
  while(1) {
   $153 = HEAP8[$154>>0]|0;
   $155 = $153 << 24 >> 24;
   $156 = (($155) + -65)|0;
   $157 = ($156>>>0)>(57);
   if ($157) {
    $$0 = -1;
    break L1;
   }
   $158 = ((($154)) + 1|0);
   HEAP32[$5>>2] = $158;
   $159 = HEAP8[$154>>0]|0;
   $160 = $159 << 24 >> 24;
   $161 = (($160) + -65)|0;
   $162 = ((1008 + (($$0252*58)|0)|0) + ($161)|0);
   $163 = HEAP8[$162>>0]|0;
   $164 = $163&255;
   $165 = (($164) + -1)|0;
   $166 = ($165>>>0)<(8);
   if ($166) {
    $$0252 = $164;$154 = $158;
   } else {
    break;
   }
  }
  $167 = ($163<<24>>24)==(0);
  if ($167) {
   $$0 = -1;
   break;
  }
  $168 = ($163<<24>>24)==(19);
  $169 = ($$0253|0)>(-1);
  do {
   if ($168) {
    if ($169) {
     $$0 = -1;
     break L1;
    } else {
     label = 54;
    }
   } else {
    if ($169) {
     $170 = (($4) + ($$0253<<2)|0);
     HEAP32[$170>>2] = $164;
     $171 = (($3) + ($$0253<<3)|0);
     $172 = $171;
     $173 = $172;
     $174 = HEAP32[$173>>2]|0;
     $175 = (($172) + 4)|0;
     $176 = $175;
     $177 = HEAP32[$176>>2]|0;
     $178 = $6;
     $179 = $178;
     HEAP32[$179>>2] = $174;
     $180 = (($178) + 4)|0;
     $181 = $180;
     HEAP32[$181>>2] = $177;
     label = 54;
     break;
    }
    if (!($10)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg($6,$164,$2);
    $$pre364 = HEAP32[$5>>2]|0;
    $183 = $$pre364;
    label = 55;
   }
  } while(0);
  if ((label|0) == 54) {
   label = 0;
   if ($10) {
    $183 = $158;
    label = 55;
   } else {
    $$0243$ph$be = 0;
   }
  }
  L77: do {
   if ((label|0) == 55) {
    label = 0;
    $182 = ((($183)) + -1|0);
    $184 = HEAP8[$182>>0]|0;
    $185 = $184 << 24 >> 24;
    $186 = ($$0252|0)!=(0);
    $187 = $185 & 15;
    $188 = ($187|0)==(3);
    $or$cond276 = $186 & $188;
    $189 = $185 & -33;
    $$0235 = $or$cond276 ? $189 : $185;
    $190 = $$1263 & 8192;
    $191 = ($190|0)==(0);
    $192 = $$1263 & -65537;
    $spec$select = $191 ? $$1263 : $192;
    L79: do {
     switch ($$0235|0) {
     case 110:  {
      $trunc = $$0252&255;
      switch ($trunc<<24>>24) {
      case 0:  {
       $199 = HEAP32[$6>>2]|0;
       HEAP32[$199>>2] = $$1248;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 1:  {
       $200 = HEAP32[$6>>2]|0;
       HEAP32[$200>>2] = $$1248;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 2:  {
       $201 = ($$1248|0)<(0);
       $202 = $201 << 31 >> 31;
       $203 = HEAP32[$6>>2]|0;
       $204 = $203;
       $205 = $204;
       HEAP32[$205>>2] = $$1248;
       $206 = (($204) + 4)|0;
       $207 = $206;
       HEAP32[$207>>2] = $202;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 3:  {
       $208 = $$1248&65535;
       $209 = HEAP32[$6>>2]|0;
       HEAP16[$209>>1] = $208;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 4:  {
       $210 = $$1248&255;
       $211 = HEAP32[$6>>2]|0;
       HEAP8[$211>>0] = $210;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 6:  {
       $212 = HEAP32[$6>>2]|0;
       HEAP32[$212>>2] = $$1248;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      case 7:  {
       $213 = ($$1248|0)<(0);
       $214 = $213 << 31 >> 31;
       $215 = HEAP32[$6>>2]|0;
       $216 = $215;
       $217 = $216;
       HEAP32[$217>>2] = $$1248;
       $218 = (($216) + 4)|0;
       $219 = $218;
       HEAP32[$219>>2] = $214;
       $$0243$ph$be = 0;
       break L77;
       break;
      }
      default: {
       $$0243$ph$be = 0;
       break L77;
      }
      }
      break;
     }
     case 112:  {
      $220 = ($$0254>>>0)>(8);
      $221 = $220 ? $$0254 : 8;
      $222 = $spec$select | 8;
      $$1236 = 120;$$1255 = $221;$$3265 = $222;
      label = 67;
      break;
     }
     case 88: case 120:  {
      $$1236 = $$0235;$$1255 = $$0254;$$3265 = $spec$select;
      label = 67;
      break;
     }
     case 111:  {
      $238 = $6;
      $239 = $238;
      $240 = HEAP32[$239>>2]|0;
      $241 = (($238) + 4)|0;
      $242 = $241;
      $243 = HEAP32[$242>>2]|0;
      $244 = (_fmt_o($240,$243,$11)|0);
      $245 = $spec$select & 8;
      $246 = ($245|0)==(0);
      $247 = $244;
      $248 = (($12) - ($247))|0;
      $249 = ($$0254|0)>($248|0);
      $250 = (($248) + 1)|0;
      $251 = $246 | $249;
      $spec$select295 = $251 ? $$0254 : $250;
      $$0228 = $244;$$1233 = 0;$$1238 = 3990;$$2256 = $spec$select295;$$4266 = $spec$select;$277 = $240;$279 = $243;
      label = 73;
      break;
     }
     case 105: case 100:  {
      $252 = $6;
      $253 = $252;
      $254 = HEAP32[$253>>2]|0;
      $255 = (($252) + 4)|0;
      $256 = $255;
      $257 = HEAP32[$256>>2]|0;
      $258 = ($257|0)<(0);
      if ($258) {
       $259 = (_i64Subtract(0,0,($254|0),($257|0))|0);
       $260 = tempRet0;
       $261 = $6;
       $262 = $261;
       HEAP32[$262>>2] = $259;
       $263 = (($261) + 4)|0;
       $264 = $263;
       HEAP32[$264>>2] = $260;
       $$0232 = 1;$$0237 = 3990;$271 = $259;$272 = $260;
       label = 72;
       break L79;
      } else {
       $265 = $spec$select & 2048;
       $266 = ($265|0)==(0);
       $267 = $spec$select & 1;
       $268 = ($267|0)==(0);
       $$ = $268 ? 3990 : (3992);
       $spec$select296 = $266 ? $$ : (3991);
       $269 = $spec$select & 2049;
       $270 = ($269|0)!=(0);
       $spec$select297 = $270&1;
       $$0232 = $spec$select297;$$0237 = $spec$select296;$271 = $254;$272 = $257;
       label = 72;
       break L79;
      }
      break;
     }
     case 117:  {
      $193 = $6;
      $194 = $193;
      $195 = HEAP32[$194>>2]|0;
      $196 = (($193) + 4)|0;
      $197 = $196;
      $198 = HEAP32[$197>>2]|0;
      $$0232 = 0;$$0237 = 3990;$271 = $195;$272 = $198;
      label = 72;
      break;
     }
     case 99:  {
      $288 = $6;
      $289 = $288;
      $290 = HEAP32[$289>>2]|0;
      $291 = (($288) + 4)|0;
      $292 = $291;
      $293 = HEAP32[$292>>2]|0;
      $294 = $290&255;
      HEAP8[$13>>0] = $294;
      $$2 = $13;$$2234 = 0;$$2239 = 3990;$$5 = 1;$$6268 = $192;$$pre$phiZ2D = $12;
      break;
     }
     case 109:  {
      $295 = (___errno_location()|0);
      $296 = HEAP32[$295>>2]|0;
      $297 = (_strerror($296)|0);
      $$1 = $297;
      label = 77;
      break;
     }
     case 115:  {
      $298 = HEAP32[$6>>2]|0;
      $299 = ($298|0)==(0|0);
      $300 = $299 ? 4000 : $298;
      $$1 = $300;
      label = 77;
      break;
     }
     case 67:  {
      $307 = $6;
      $308 = $307;
      $309 = HEAP32[$308>>2]|0;
      $310 = (($307) + 4)|0;
      $311 = $310;
      $312 = HEAP32[$311>>2]|0;
      HEAP32[$8>>2] = $309;
      HEAP32[$14>>2] = 0;
      HEAP32[$6>>2] = $8;
      $$4258370 = -1;
      label = 81;
      break;
     }
     case 83:  {
      $313 = ($$0254|0)==(0);
      if ($313) {
       _pad_680($0,32,$$1260,0,$spec$select);
       $$0240313371 = 0;
       label = 91;
      } else {
       $$4258370 = $$0254;
       label = 81;
      }
      break;
     }
     case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
      $336 = +HEAPF64[$6>>3];
      $337 = (_fmt_fp($0,$336,$$1260,$$0254,$spec$select,$$0235)|0);
      $$0243$ph$be = $337;
      break L77;
      break;
     }
     default: {
      $$2 = $20;$$2234 = 0;$$2239 = 3990;$$5 = $$0254;$$6268 = $spec$select;$$pre$phiZ2D = $12;
     }
     }
    } while(0);
    L103: do {
     if ((label|0) == 67) {
      label = 0;
      $223 = $6;
      $224 = $223;
      $225 = HEAP32[$224>>2]|0;
      $226 = (($223) + 4)|0;
      $227 = $226;
      $228 = HEAP32[$227>>2]|0;
      $229 = $$1236 & 32;
      $230 = (_fmt_x($225,$228,$11,$229)|0);
      $231 = ($225|0)==(0);
      $232 = ($228|0)==(0);
      $233 = $231 & $232;
      $234 = $$3265 & 8;
      $235 = ($234|0)==(0);
      $or$cond278 = $235 | $233;
      $236 = $$1236 >>> 4;
      $237 = (3990 + ($236)|0);
      $spec$select293 = $or$cond278 ? 3990 : $237;
      $spec$select294 = $or$cond278 ? 0 : 2;
      $$0228 = $230;$$1233 = $spec$select294;$$1238 = $spec$select293;$$2256 = $$1255;$$4266 = $$3265;$277 = $225;$279 = $228;
      label = 73;
     }
     else if ((label|0) == 72) {
      label = 0;
      $273 = (_fmt_u($271,$272,$11)|0);
      $$0228 = $273;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $spec$select;$277 = $271;$279 = $272;
      label = 73;
     }
     else if ((label|0) == 77) {
      label = 0;
      $301 = (_memchr($$1,0,$$0254)|0);
      $302 = ($301|0)==(0|0);
      $303 = $301;
      $304 = $$1;
      $305 = (($303) - ($304))|0;
      $306 = (($$1) + ($$0254)|0);
      $$3257 = $302 ? $$0254 : $305;
      $$1250 = $302 ? $306 : $301;
      $$pre368 = $$1250;
      $$2 = $$1;$$2234 = 0;$$2239 = 3990;$$5 = $$3257;$$6268 = $192;$$pre$phiZ2D = $$pre368;
     }
     else if ((label|0) == 81) {
      label = 0;
      $314 = HEAP32[$6>>2]|0;
      $$0229334 = $314;$$0240333 = 0;
      while(1) {
       $315 = HEAP32[$$0229334>>2]|0;
       $316 = ($315|0)==(0);
       if ($316) {
        $$0240313 = $$0240333;
        break;
       }
       $317 = (_wctomb($9,$315)|0);
       $318 = ($317|0)<(0);
       $319 = (($$4258370) - ($$0240333))|0;
       $320 = ($317>>>0)>($319>>>0);
       $or$cond283 = $318 | $320;
       if ($or$cond283) {
        label = 85;
        break;
       }
       $321 = ((($$0229334)) + 4|0);
       $322 = (($317) + ($$0240333))|0;
       $323 = ($$4258370>>>0)>($322>>>0);
       if ($323) {
        $$0229334 = $321;$$0240333 = $322;
       } else {
        $$0240313 = $322;
        break;
       }
      }
      if ((label|0) == 85) {
       label = 0;
       if ($318) {
        $$0 = -1;
        break L1;
       } else {
        $$0240313 = $$0240333;
       }
      }
      _pad_680($0,32,$$1260,$$0240313,$spec$select);
      $324 = ($$0240313|0)==(0);
      if ($324) {
       $$0240313371 = 0;
       label = 91;
      } else {
       $325 = HEAP32[$6>>2]|0;
       $$1230340 = $325;$$1241339 = 0;
       while(1) {
        $326 = HEAP32[$$1230340>>2]|0;
        $327 = ($326|0)==(0);
        if ($327) {
         $$0240313371 = $$0240313;
         label = 91;
         break L103;
        }
        $328 = (_wctomb($9,$326)|0);
        $329 = (($328) + ($$1241339))|0;
        $330 = ($329|0)>($$0240313|0);
        if ($330) {
         $$0240313371 = $$0240313;
         label = 91;
         break L103;
        }
        $331 = ((($$1230340)) + 4|0);
        _out($0,$9,$328);
        $332 = ($329>>>0)<($$0240313>>>0);
        if ($332) {
         $$1230340 = $331;$$1241339 = $329;
        } else {
         $$0240313371 = $$0240313;
         label = 91;
         break;
        }
       }
      }
     }
    } while(0);
    if ((label|0) == 73) {
     label = 0;
     $274 = ($$2256|0)>(-1);
     $275 = $$4266 & -65537;
     $spec$select281 = $274 ? $275 : $$4266;
     $276 = ($277|0)!=(0);
     $278 = ($279|0)!=(0);
     $280 = $276 | $278;
     $281 = ($$2256|0)!=(0);
     $or$cond = $281 | $280;
     $282 = $$0228;
     $283 = (($12) - ($282))|0;
     $284 = $280 ^ 1;
     $285 = $284&1;
     $286 = (($283) + ($285))|0;
     $287 = ($$2256|0)>($286|0);
     $$2256$ = $287 ? $$2256 : $286;
     $spec$select298 = $or$cond ? $$2256$ : 0;
     $spec$select299 = $or$cond ? $$0228 : $11;
     $$2 = $spec$select299;$$2234 = $$1233;$$2239 = $$1238;$$5 = $spec$select298;$$6268 = $spec$select281;$$pre$phiZ2D = $12;
    }
    else if ((label|0) == 91) {
     label = 0;
     $333 = $spec$select ^ 8192;
     _pad_680($0,32,$$1260,$$0240313371,$333);
     $334 = ($$1260|0)>($$0240313371|0);
     $335 = $334 ? $$1260 : $$0240313371;
     $$0243$ph$be = $335;
     break;
    }
    $338 = $$2;
    $339 = (($$pre$phiZ2D) - ($338))|0;
    $340 = ($$5|0)<($339|0);
    $spec$select284 = $340 ? $339 : $$5;
    $341 = (($spec$select284) + ($$2234))|0;
    $342 = ($$1260|0)<($341|0);
    $$2261 = $342 ? $341 : $$1260;
    _pad_680($0,32,$$2261,$341,$$6268);
    _out($0,$$2239,$$2234);
    $343 = $$6268 ^ 65536;
    _pad_680($0,48,$$2261,$341,$343);
    _pad_680($0,48,$spec$select284,$339,0);
    _out($0,$$2,$339);
    $344 = $$6268 ^ 8192;
    _pad_680($0,32,$$2261,$341,$344);
    $$0243$ph$be = $$2261;
   }
  } while(0);
  $$0243$ph = $$0243$ph$be;$$0247$ph = $$1248;$$0269$ph = $$3272;
 }
 L125: do {
  if ((label|0) == 94) {
   $345 = ($0|0)==(0|0);
   if ($345) {
    $346 = ($$0269$ph|0)==(0);
    if ($346) {
     $$0 = 0;
    } else {
     $$2242320 = 1;
     while(1) {
      $347 = (($4) + ($$2242320<<2)|0);
      $348 = HEAP32[$347>>2]|0;
      $349 = ($348|0)==(0);
      if ($349) {
       break;
      }
      $350 = (($3) + ($$2242320<<3)|0);
      _pop_arg($350,$348,$2);
      $351 = (($$2242320) + 1)|0;
      $352 = ($351>>>0)<(10);
      if ($352) {
       $$2242320 = $351;
      } else {
       $$0 = 1;
       break L125;
      }
     }
     $$3317 = $$2242320;
     while(1) {
      $355 = (($4) + ($$3317<<2)|0);
      $356 = HEAP32[$355>>2]|0;
      $357 = ($356|0)==(0);
      $354 = (($$3317) + 1)|0;
      if (!($357)) {
       $$0 = -1;
       break L125;
      }
      $353 = ($354>>>0)<(10);
      if ($353) {
       $$3317 = $354;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _out($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 32;
 $5 = ($4|0)==(0);
 if ($5) {
  (___fwritex($1,$2,$0)|0);
 }
 return;
}
function _getint($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$04 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (_isdigit($3)|0);
 $5 = ($4|0)==(0);
 if ($5) {
  $$0$lcssa = 0;
 } else {
  $$04 = 0;
  while(1) {
   $6 = ($$04*10)|0;
   $7 = HEAP32[$0>>2]|0;
   $8 = HEAP8[$7>>0]|0;
   $9 = $8 << 24 >> 24;
   $10 = (($6) + -48)|0;
   $11 = (($10) + ($9))|0;
   $12 = ((($7)) + 1|0);
   HEAP32[$0>>2] = $12;
   $13 = HEAP8[$12>>0]|0;
   $14 = $13 << 24 >> 24;
   $15 = (_isdigit($14)|0);
   $16 = ($15|0)==(0);
   if ($16) {
    $$0$lcssa = $11;
    break;
   } else {
    $$04 = $11;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _pop_arg($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_x($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$05$lcssa = 0, $$056 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = ($0|0)==(0);
 $5 = ($1|0)==(0);
 $6 = $4 & $5;
 if ($6) {
  $$05$lcssa = $2;
 } else {
  $$056 = $2;$15 = $1;$8 = $0;
  while(1) {
   $7 = $8 & 15;
   $9 = (1472 + ($7)|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = $10&255;
   $12 = $11 | $3;
   $13 = $12&255;
   $14 = ((($$056)) + -1|0);
   HEAP8[$14>>0] = $13;
   $16 = (_bitshift64Lshr(($8|0),($15|0),4)|0);
   $17 = tempRet0;
   $18 = ($16|0)==(0);
   $19 = ($17|0)==(0);
   $20 = $18 & $19;
   if ($20) {
    $$05$lcssa = $14;
    break;
   } else {
    $$056 = $14;$15 = $17;$8 = $16;
   }
  }
 }
 return ($$05$lcssa|0);
}
function _fmt_o($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0);
 $4 = ($1|0)==(0);
 $5 = $3 & $4;
 if ($5) {
  $$0$lcssa = $2;
 } else {
  $$06 = $2;$11 = $1;$7 = $0;
  while(1) {
   $6 = $7&255;
   $8 = $6 & 7;
   $9 = $8 | 48;
   $10 = ((($$06)) + -1|0);
   HEAP8[$10>>0] = $9;
   $12 = (_bitshift64Lshr(($7|0),($11|0),3)|0);
   $13 = tempRet0;
   $14 = ($12|0)==(0);
   $15 = ($13|0)==(0);
   $16 = $14 & $15;
   if ($16) {
    $$0$lcssa = $10;
    break;
   } else {
    $$06 = $10;$11 = $13;$7 = $12;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = (___muldi3(($10|0),($11|0),10,0)|0);
   $13 = tempRet0;
   $14 = (_i64Subtract(($8|0),($9|0),($12|0),($13|0))|0);
   $15 = tempRet0;
   $16 = $14&255;
   $17 = $16 | 48;
   $18 = ((($$0914)) + -1|0);
   HEAP8[$18>>0] = $17;
   $19 = ($9>>>0)>(9);
   $20 = ($8>>>0)>(4294967295);
   $21 = ($9|0)==(9);
   $22 = $21 & $20;
   $23 = $19 | $22;
   if ($23) {
    $$0914 = $18;$8 = $10;$9 = $11;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $10;$$09$lcssa = $18;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $24 = ($$010$lcssa$off0|0)==(0);
 if ($24) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $25 = (($$012>>>0) / 10)&-1;
   $26 = ($25*10)|0;
   $27 = (($$012) - ($26))|0;
   $28 = $27 | 48;
   $29 = $28&255;
   $30 = ((($$111)) + -1|0);
   HEAP8[$30>>0] = $29;
   $31 = ($$012>>>0)<(10);
   if ($31) {
    $$1$lcssa = $30;
    break;
   } else {
    $$012 = $25;$$111 = $30;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___pthread_self_105()|0);
 $2 = ((($1)) + 188|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (___strerror_l($0,$3)|0);
 return ($4|0);
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$137$lcssa66 = 0, $$13745 = 0, $$140 = 0, $$23839 = 0, $$in = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   label = 16;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $38 = ($$036$lcssa64|0)==(0);
    if ($38) {
     label = 16;
     break;
    } else {
     $39 = $$035$lcssa65;
     break;
    }
   }
   $20 = Math_imul($3, 16843009)|0;
   $21 = ($$036$lcssa64>>>0)>(3);
   L13: do {
    if ($21) {
     $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
     while(1) {
      $22 = HEAP32[$$046>>2]|0;
      $23 = $22 ^ $20;
      $24 = (($23) + -16843009)|0;
      $25 = $23 & -2139062144;
      $26 = $25 ^ -2139062144;
      $27 = $26 & $24;
      $28 = ($27|0)==(0);
      if (!($28)) {
       $$137$lcssa66 = $$13745;$$in = $$046;
       break L13;
      }
      $29 = ((($$046)) + 4|0);
      $30 = (($$13745) + -4)|0;
      $31 = ($30>>>0)>(3);
      if ($31) {
       $$046 = $29;$$13745 = $30;
      } else {
       $$0$lcssa = $29;$$137$lcssa = $30;
       label = 11;
       break;
      }
     }
    } else {
     $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
     label = 11;
    }
   } while(0);
   if ((label|0) == 11) {
    $32 = ($$137$lcssa|0)==(0);
    if ($32) {
     label = 16;
     break;
    } else {
     $$137$lcssa66 = $$137$lcssa;$$in = $$0$lcssa;
    }
   }
   $$140 = $$in;$$23839 = $$137$lcssa66;
   while(1) {
    $33 = HEAP8[$$140>>0]|0;
    $34 = ($33<<24>>24)==($18<<24>>24);
    if ($34) {
     $39 = $$140;
     break L8;
    }
    $35 = ((($$140)) + 1|0);
    $36 = (($$23839) + -1)|0;
    $37 = ($36|0)==(0);
    if ($37) {
     label = 16;
     break;
    } else {
     $$140 = $35;$$23839 = $36;
    }
   }
  }
 } while(0);
 if ((label|0) == 16) {
  $39 = 0;
 }
 return ($39|0);
}
function _pad_680($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 if ($or$cond) {
  $9 = (($2) - ($3))|0;
  $10 = $1 << 24 >> 24;
  $11 = ($9>>>0)<(256);
  $12 = $11 ? $9 : 256;
  (_memset(($5|0),($10|0),($12|0))|0);
  $13 = ($9>>>0)>(255);
  if ($13) {
   $14 = (($2) - ($3))|0;
   $$011 = $9;
   while(1) {
    _out($0,$5,256);
    $15 = (($$011) + -256)|0;
    $16 = ($15>>>0)>(255);
    if ($16) {
     $$011 = $15;
    } else {
     break;
    }
   }
   $17 = $14 & 255;
   $$0$lcssa = $17;
  } else {
   $$0$lcssa = $9;
  }
  _out($0,$5,$$0$lcssa);
 }
 STACKTOP = sp;return;
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function _fmt_fp($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$ = 0, $$0 = 0, $$0463$lcssa = 0, $$0463588 = 0, $$0464599 = 0, $$0471 = 0.0, $$0479 = 0, $$0487657 = 0, $$0488 = 0, $$0488669 = 0, $$0488671 = 0, $$0497670 = 0, $$0498 = 0, $$0511586 = 0.0, $$0512 = 0, $$0513 = 0, $$0516652 = 0, $$0522 = 0, $$0523 = 0, $$0525 = 0;
 var $$0527 = 0, $$0529 = 0, $$0529$in646 = 0, $$0532651 = 0, $$1465 = 0, $$1467 = 0.0, $$1469 = 0.0, $$1472 = 0.0, $$1480 = 0, $$1482$lcssa = 0, $$1482683 = 0, $$1489656 = 0, $$1499 = 0, $$1510587 = 0, $$1514$lcssa = 0, $$1514614 = 0, $$1517 = 0, $$1526 = 0, $$1528 = 0, $$1530621 = 0;
 var $$1533$lcssa = 0, $$1533645 = 0, $$1604 = 0, $$2 = 0, $$2473 = 0.0, $$2476 = 0, $$2483 = 0, $$2490$lcssa = 0, $$2490638 = 0, $$2500$lcssa = 0, $$2500682 = 0, $$2515 = 0, $$2518634 = 0, $$2531 = 0, $$2534633 = 0, $$3 = 0.0, $$3477 = 0, $$3484$lcssa = 0, $$3484663 = 0, $$3501$lcssa = 0;
 var $$3501676 = 0, $$3535620 = 0, $$4 = 0.0, $$4478$lcssa = 0, $$4478594 = 0, $$4492 = 0, $$4502$lcssa = 0, $$4502662 = 0, $$4520 = 0, $$5$lcssa = 0, $$5486$lcssa = 0, $$5486639 = 0, $$5493603 = 0, $$5503 = 0, $$5521 = 0, $$560 = 0, $$5609 = 0, $$6 = 0, $$6494593 = 0, $$7495608 = 0;
 var $$8 = 0, $$8506 = 0, $$9 = 0, $$9507$lcssa = 0, $$9507625 = 0, $$lcssa583 = 0, $$lobit = 0, $$neg = 0, $$neg571 = 0, $$not = 0, $$pn = 0, $$pr = 0, $$pr564 = 0, $$pre = 0, $$pre$phi717Z2D = 0, $$pre$phi718Z2D = 0, $$pre720 = 0, $$sink757 = 0, $10 = 0, $100 = 0;
 var $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0;
 var $12 = 0, $120 = 0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0.0, $13 = 0, $130 = 0.0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0;
 var $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0.0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0;
 var $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0;
 var $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0;
 var $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0;
 var $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0;
 var $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0.0;
 var $247 = 0.0, $248 = 0, $249 = 0.0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0;
 var $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0;
 var $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0;
 var $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0;
 var $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0;
 var $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0;
 var $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0.0, $370 = 0, $371 = 0, $372 = 0, $373 = 0;
 var $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0.0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0;
 var $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0;
 var $410 = 0, $411 = 0, $412 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0, $56 = 0, $57 = 0.0, $58 = 0.0;
 var $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $not$ = 0, $or$cond = 0, $or$cond3$not = 0, $or$cond543 = 0, $or$cond546 = 0, $or$cond556 = 0, $or$cond559 = 0, $or$cond6 = 0, $scevgep711 = 0, $scevgep711712 = 0, $spec$select = 0, $spec$select539 = 0, $spec$select540 = 0, $spec$select540722 = 0, $spec$select540723 = 0;
 var $spec$select541 = 0, $spec$select544 = 0.0, $spec$select547 = 0, $spec$select548 = 0, $spec$select549 = 0, $spec$select551 = 0, $spec$select554 = 0, $spec$select557 = 0, $spec$select561 = 0.0, $spec$select562 = 0, $spec$select563 = 0, $spec$select565 = 0, $spec$select566 = 0, $spec$select567 = 0.0, $spec$select568 = 0.0, $spec$select569 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(560|0);
 $6 = sp + 32|0;
 $7 = sp + 536|0;
 $8 = sp;
 $9 = $8;
 $10 = sp + 540|0;
 HEAP32[$7>>2] = 0;
 $11 = ((($10)) + 12|0);
 $12 = (___DOUBLE_BITS_681($1)|0);
 $13 = tempRet0;
 $14 = ($13|0)<(0);
 if ($14) {
  $15 = - $1;
  $16 = (___DOUBLE_BITS_681($15)|0);
  $17 = tempRet0;
  $$0471 = $15;$$0522 = 1;$$0523 = 4007;$25 = $17;$412 = $16;
 } else {
  $18 = $4 & 2048;
  $19 = ($18|0)==(0);
  $20 = $4 & 1;
  $21 = ($20|0)==(0);
  $$ = $21 ? (4008) : (4013);
  $spec$select565 = $19 ? $$ : (4010);
  $22 = $4 & 2049;
  $23 = ($22|0)!=(0);
  $spec$select566 = $23&1;
  $$0471 = $1;$$0522 = $spec$select566;$$0523 = $spec$select565;$25 = $13;$412 = $12;
 }
 $24 = $25 & 2146435072;
 $26 = (0)==(0);
 $27 = ($24|0)==(2146435072);
 $28 = $26 & $27;
 do {
  if ($28) {
   $29 = $5 & 32;
   $30 = ($29|0)!=(0);
   $31 = $30 ? 4026 : 4030;
   $32 = ($$0471 != $$0471) | (0.0 != 0.0);
   $33 = $30 ? 4034 : 4038;
   $$0512 = $32 ? $33 : $31;
   $34 = (($$0522) + 3)|0;
   $35 = $4 & -65537;
   _pad_680($0,32,$2,$34,$35);
   _out($0,$$0523,$$0522);
   _out($0,$$0512,3);
   $36 = $4 ^ 8192;
   _pad_680($0,32,$2,$34,$36);
   $$sink757 = $34;
  } else {
   $37 = (+_frexpl($$0471,$7));
   $38 = $37 * 2.0;
   $39 = $38 != 0.0;
   if ($39) {
    $40 = HEAP32[$7>>2]|0;
    $41 = (($40) + -1)|0;
    HEAP32[$7>>2] = $41;
   }
   $42 = $5 | 32;
   $43 = ($42|0)==(97);
   if ($43) {
    $44 = $5 & 32;
    $45 = ($44|0)==(0);
    $46 = ((($$0523)) + 9|0);
    $spec$select = $45 ? $$0523 : $46;
    $47 = $$0522 | 2;
    $48 = ($3>>>0)>(11);
    $49 = (12 - ($3))|0;
    $50 = ($49|0)==(0);
    $51 = $48 | $50;
    do {
     if ($51) {
      $$1472 = $38;
     } else {
      $$0511586 = 8.0;$$1510587 = $49;
      while(1) {
       $52 = (($$1510587) + -1)|0;
       $53 = $$0511586 * 16.0;
       $54 = ($52|0)==(0);
       if ($54) {
        break;
       } else {
        $$0511586 = $53;$$1510587 = $52;
       }
      }
      $55 = HEAP8[$spec$select>>0]|0;
      $56 = ($55<<24>>24)==(45);
      if ($56) {
       $57 = - $38;
       $58 = $57 - $53;
       $59 = $53 + $58;
       $60 = - $59;
       $$1472 = $60;
       break;
      } else {
       $61 = $38 + $53;
       $62 = $61 - $53;
       $$1472 = $62;
       break;
      }
     }
    } while(0);
    $63 = HEAP32[$7>>2]|0;
    $64 = ($63|0)<(0);
    $65 = (0 - ($63))|0;
    $66 = $64 ? $65 : $63;
    $67 = ($66|0)<(0);
    $68 = $67 << 31 >> 31;
    $69 = (_fmt_u($66,$68,$11)|0);
    $70 = ($69|0)==($11|0);
    if ($70) {
     $71 = ((($10)) + 11|0);
     HEAP8[$71>>0] = 48;
     $$0513 = $71;
    } else {
     $$0513 = $69;
    }
    $72 = $63 >> 31;
    $73 = $72 & 2;
    $74 = (($73) + 43)|0;
    $75 = $74&255;
    $76 = ((($$0513)) + -1|0);
    HEAP8[$76>>0] = $75;
    $77 = (($5) + 15)|0;
    $78 = $77&255;
    $79 = ((($$0513)) + -2|0);
    HEAP8[$79>>0] = $78;
    $80 = ($3|0)<(1);
    $81 = $4 & 8;
    $82 = ($81|0)==(0);
    $$0525 = $8;$$2473 = $$1472;
    while(1) {
     $83 = (~~(($$2473)));
     $84 = (1472 + ($83)|0);
     $85 = HEAP8[$84>>0]|0;
     $86 = $85&255;
     $87 = $44 | $86;
     $88 = $87&255;
     $89 = ((($$0525)) + 1|0);
     HEAP8[$$0525>>0] = $88;
     $90 = (+($83|0));
     $91 = $$2473 - $90;
     $92 = $91 * 16.0;
     $93 = $89;
     $94 = (($93) - ($9))|0;
     $95 = ($94|0)==(1);
     if ($95) {
      $96 = $92 == 0.0;
      $or$cond3$not = $80 & $96;
      $or$cond = $82 & $or$cond3$not;
      if ($or$cond) {
       $$1526 = $89;
      } else {
       $97 = ((($$0525)) + 2|0);
       HEAP8[$89>>0] = 46;
       $$1526 = $97;
      }
     } else {
      $$1526 = $89;
     }
     $98 = $92 != 0.0;
     if ($98) {
      $$0525 = $$1526;$$2473 = $92;
     } else {
      break;
     }
    }
    $99 = ($3|0)==(0);
    $$pre720 = $$1526;
    if ($99) {
     label = 25;
    } else {
     $100 = (-2 - ($9))|0;
     $101 = (($100) + ($$pre720))|0;
     $102 = ($101|0)<($3|0);
     if ($102) {
      $103 = $11;
      $104 = $79;
      $105 = (($3) + 2)|0;
      $106 = (($105) + ($103))|0;
      $107 = (($106) - ($104))|0;
      $$0527 = $107;$$pre$phi717Z2D = $103;$$pre$phi718Z2D = $104;
     } else {
      label = 25;
     }
    }
    if ((label|0) == 25) {
     $108 = $11;
     $109 = $79;
     $110 = (($108) - ($9))|0;
     $111 = (($110) - ($109))|0;
     $112 = (($111) + ($$pre720))|0;
     $$0527 = $112;$$pre$phi717Z2D = $108;$$pre$phi718Z2D = $109;
    }
    $113 = (($$0527) + ($47))|0;
    _pad_680($0,32,$2,$113,$4);
    _out($0,$spec$select,$47);
    $114 = $4 ^ 65536;
    _pad_680($0,48,$2,$113,$114);
    $115 = (($$pre720) - ($9))|0;
    _out($0,$8,$115);
    $116 = (($$pre$phi717Z2D) - ($$pre$phi718Z2D))|0;
    $117 = (($115) + ($116))|0;
    $118 = (($$0527) - ($117))|0;
    _pad_680($0,48,$118,0,0);
    _out($0,$79,$116);
    $119 = $4 ^ 8192;
    _pad_680($0,32,$2,$113,$119);
    $$sink757 = $113;
    break;
   }
   $120 = ($3|0)<(0);
   $spec$select539 = $120 ? 6 : $3;
   if ($39) {
    $121 = $38 * 268435456.0;
    $122 = HEAP32[$7>>2]|0;
    $123 = (($122) + -28)|0;
    HEAP32[$7>>2] = $123;
    $$3 = $121;$$pr = $123;
   } else {
    $$pre = HEAP32[$7>>2]|0;
    $$3 = $38;$$pr = $$pre;
   }
   $124 = ($$pr|0)<(0);
   $125 = ((($6)) + 288|0);
   $$0498 = $124 ? $6 : $125;
   $$1499 = $$0498;$$4 = $$3;
   while(1) {
    $126 = (~~(($$4))>>>0);
    HEAP32[$$1499>>2] = $126;
    $127 = ((($$1499)) + 4|0);
    $128 = (+($126>>>0));
    $129 = $$4 - $128;
    $130 = $129 * 1.0E+9;
    $131 = $130 != 0.0;
    if ($131) {
     $$1499 = $127;$$4 = $130;
    } else {
     break;
    }
   }
   $132 = $$0498;
   $133 = ($$pr|0)>(0);
   if ($133) {
    $$1482683 = $$0498;$$2500682 = $127;$135 = $$pr;
    while(1) {
     $134 = ($135|0)<(29);
     $136 = $134 ? $135 : 29;
     $$0488669 = ((($$2500682)) + -4|0);
     $137 = ($$0488669>>>0)<($$1482683>>>0);
     if ($137) {
      $$2483 = $$1482683;
     } else {
      $$0488671 = $$0488669;$$0497670 = 0;
      while(1) {
       $138 = HEAP32[$$0488671>>2]|0;
       $139 = (_bitshift64Shl(($138|0),0,($136|0))|0);
       $140 = tempRet0;
       $141 = (_i64Add(($139|0),($140|0),($$0497670|0),0)|0);
       $142 = tempRet0;
       $143 = (___udivdi3(($141|0),($142|0),1000000000,0)|0);
       $144 = tempRet0;
       $145 = (___muldi3(($143|0),($144|0),1000000000,0)|0);
       $146 = tempRet0;
       $147 = (_i64Subtract(($141|0),($142|0),($145|0),($146|0))|0);
       $148 = tempRet0;
       HEAP32[$$0488671>>2] = $147;
       $$0488 = ((($$0488671)) + -4|0);
       $149 = ($$0488>>>0)<($$1482683>>>0);
       if ($149) {
        break;
       } else {
        $$0488671 = $$0488;$$0497670 = $143;
       }
      }
      $150 = ($143|0)==(0);
      if ($150) {
       $$2483 = $$1482683;
      } else {
       $151 = ((($$1482683)) + -4|0);
       HEAP32[$151>>2] = $143;
       $$2483 = $151;
      }
     }
     $152 = ($$2500682>>>0)>($$2483>>>0);
     L57: do {
      if ($152) {
       $$3501676 = $$2500682;
       while(1) {
        $154 = ((($$3501676)) + -4|0);
        $155 = HEAP32[$154>>2]|0;
        $156 = ($155|0)==(0);
        if (!($156)) {
         $$3501$lcssa = $$3501676;
         break L57;
        }
        $153 = ($154>>>0)>($$2483>>>0);
        if ($153) {
         $$3501676 = $154;
        } else {
         $$3501$lcssa = $154;
         break;
        }
       }
      } else {
       $$3501$lcssa = $$2500682;
      }
     } while(0);
     $157 = HEAP32[$7>>2]|0;
     $158 = (($157) - ($136))|0;
     HEAP32[$7>>2] = $158;
     $159 = ($158|0)>(0);
     if ($159) {
      $$1482683 = $$2483;$$2500682 = $$3501$lcssa;$135 = $158;
     } else {
      $$1482$lcssa = $$2483;$$2500$lcssa = $$3501$lcssa;$$pr564 = $158;
      break;
     }
    }
   } else {
    $$1482$lcssa = $$0498;$$2500$lcssa = $127;$$pr564 = $$pr;
   }
   $160 = ($$pr564|0)<(0);
   if ($160) {
    $161 = (($spec$select539) + 25)|0;
    $162 = (($161|0) / 9)&-1;
    $163 = (($162) + 1)|0;
    $164 = ($42|0)==(102);
    $$3484663 = $$1482$lcssa;$$4502662 = $$2500$lcssa;$166 = $$pr564;
    while(1) {
     $165 = (0 - ($166))|0;
     $167 = ($165|0)<(9);
     $168 = $167 ? $165 : 9;
     $169 = ($$3484663>>>0)<($$4502662>>>0);
     if ($169) {
      $173 = 1 << $168;
      $174 = (($173) + -1)|0;
      $175 = 1000000000 >>> $168;
      $$0487657 = 0;$$1489656 = $$3484663;
      while(1) {
       $176 = HEAP32[$$1489656>>2]|0;
       $177 = $176 & $174;
       $178 = $176 >>> $168;
       $179 = (($178) + ($$0487657))|0;
       HEAP32[$$1489656>>2] = $179;
       $180 = Math_imul($177, $175)|0;
       $181 = ((($$1489656)) + 4|0);
       $182 = ($181>>>0)<($$4502662>>>0);
       if ($182) {
        $$0487657 = $180;$$1489656 = $181;
       } else {
        break;
       }
      }
      $183 = HEAP32[$$3484663>>2]|0;
      $184 = ($183|0)==(0);
      $185 = ((($$3484663)) + 4|0);
      $spec$select540 = $184 ? $185 : $$3484663;
      $186 = ($180|0)==(0);
      if ($186) {
       $$5503 = $$4502662;$spec$select540723 = $spec$select540;
      } else {
       $187 = ((($$4502662)) + 4|0);
       HEAP32[$$4502662>>2] = $180;
       $$5503 = $187;$spec$select540723 = $spec$select540;
      }
     } else {
      $170 = HEAP32[$$3484663>>2]|0;
      $171 = ($170|0)==(0);
      $172 = ((($$3484663)) + 4|0);
      $spec$select540722 = $171 ? $172 : $$3484663;
      $$5503 = $$4502662;$spec$select540723 = $spec$select540722;
     }
     $188 = $164 ? $$0498 : $spec$select540723;
     $189 = $$5503;
     $190 = $188;
     $191 = (($189) - ($190))|0;
     $192 = $191 >> 2;
     $193 = ($192|0)>($163|0);
     $194 = (($188) + ($163<<2)|0);
     $spec$select541 = $193 ? $194 : $$5503;
     $195 = HEAP32[$7>>2]|0;
     $196 = (($195) + ($168))|0;
     HEAP32[$7>>2] = $196;
     $197 = ($196|0)<(0);
     if ($197) {
      $$3484663 = $spec$select540723;$$4502662 = $spec$select541;$166 = $196;
     } else {
      $$3484$lcssa = $spec$select540723;$$4502$lcssa = $spec$select541;
      break;
     }
    }
   } else {
    $$3484$lcssa = $$1482$lcssa;$$4502$lcssa = $$2500$lcssa;
   }
   $198 = ($$3484$lcssa>>>0)<($$4502$lcssa>>>0);
   if ($198) {
    $199 = $$3484$lcssa;
    $200 = (($132) - ($199))|0;
    $201 = $200 >> 2;
    $202 = ($201*9)|0;
    $203 = HEAP32[$$3484$lcssa>>2]|0;
    $204 = ($203>>>0)<(10);
    if ($204) {
     $$1517 = $202;
    } else {
     $$0516652 = $202;$$0532651 = 10;
     while(1) {
      $205 = ($$0532651*10)|0;
      $206 = (($$0516652) + 1)|0;
      $207 = ($203>>>0)<($205>>>0);
      if ($207) {
       $$1517 = $206;
       break;
      } else {
       $$0516652 = $206;$$0532651 = $205;
      }
     }
    }
   } else {
    $$1517 = 0;
   }
   $208 = ($42|0)==(102);
   $209 = $208 ? 0 : $$1517;
   $210 = (($spec$select539) - ($209))|0;
   $211 = ($42|0)==(103);
   $212 = ($spec$select539|0)!=(0);
   $213 = $212 & $211;
   $$neg = $213 << 31 >> 31;
   $214 = (($210) + ($$neg))|0;
   $215 = $$4502$lcssa;
   $216 = (($215) - ($132))|0;
   $217 = $216 >> 2;
   $218 = ($217*9)|0;
   $219 = (($218) + -9)|0;
   $220 = ($214|0)<($219|0);
   if ($220) {
    $221 = ((($$0498)) + 4|0);
    $222 = (($214) + 9216)|0;
    $223 = (($222|0) / 9)&-1;
    $224 = (($223) + -1024)|0;
    $225 = (($221) + ($224<<2)|0);
    $226 = ($223*9)|0;
    $227 = (($222) - ($226))|0;
    $228 = ($227|0)<(8);
    if ($228) {
     $$0529$in646 = $227;$$1533645 = 10;
     while(1) {
      $$0529 = (($$0529$in646) + 1)|0;
      $229 = ($$1533645*10)|0;
      $230 = ($$0529$in646|0)<(7);
      if ($230) {
       $$0529$in646 = $$0529;$$1533645 = $229;
      } else {
       $$1533$lcssa = $229;
       break;
      }
     }
    } else {
     $$1533$lcssa = 10;
    }
    $231 = HEAP32[$225>>2]|0;
    $232 = (($231>>>0) / ($$1533$lcssa>>>0))&-1;
    $233 = Math_imul($232, $$1533$lcssa)|0;
    $234 = (($231) - ($233))|0;
    $235 = ($234|0)==(0);
    $236 = ((($225)) + 4|0);
    $237 = ($236|0)==($$4502$lcssa|0);
    $or$cond543 = $237 & $235;
    if ($or$cond543) {
     $$4492 = $225;$$4520 = $$1517;$$8 = $$3484$lcssa;
    } else {
     $238 = $232 & 1;
     $239 = ($238|0)==(0);
     $spec$select544 = $239 ? 9007199254740992.0 : 9007199254740994.0;
     $240 = $$1533$lcssa >>> 1;
     $241 = ($234>>>0)<($240>>>0);
     $242 = ($234|0)==($240|0);
     $or$cond546 = $237 & $242;
     $spec$select561 = $or$cond546 ? 1.0 : 1.5;
     $spec$select567 = $241 ? 0.5 : $spec$select561;
     $243 = ($$0522|0)==(0);
     if ($243) {
      $$1467 = $spec$select567;$$1469 = $spec$select544;
     } else {
      $244 = HEAP8[$$0523>>0]|0;
      $245 = ($244<<24>>24)==(45);
      $246 = - $spec$select544;
      $247 = - $spec$select567;
      $spec$select568 = $245 ? $246 : $spec$select544;
      $spec$select569 = $245 ? $247 : $spec$select567;
      $$1467 = $spec$select569;$$1469 = $spec$select568;
     }
     $248 = (($231) - ($234))|0;
     HEAP32[$225>>2] = $248;
     $249 = $$1469 + $$1467;
     $250 = $249 != $$1469;
     if ($250) {
      $251 = (($248) + ($$1533$lcssa))|0;
      HEAP32[$225>>2] = $251;
      $252 = ($251>>>0)>(999999999);
      if ($252) {
       $$2490638 = $225;$$5486639 = $$3484$lcssa;
       while(1) {
        $253 = ((($$2490638)) + -4|0);
        HEAP32[$$2490638>>2] = 0;
        $254 = ($253>>>0)<($$5486639>>>0);
        if ($254) {
         $255 = ((($$5486639)) + -4|0);
         HEAP32[$255>>2] = 0;
         $$6 = $255;
        } else {
         $$6 = $$5486639;
        }
        $256 = HEAP32[$253>>2]|0;
        $257 = (($256) + 1)|0;
        HEAP32[$253>>2] = $257;
        $258 = ($257>>>0)>(999999999);
        if ($258) {
         $$2490638 = $253;$$5486639 = $$6;
        } else {
         $$2490$lcssa = $253;$$5486$lcssa = $$6;
         break;
        }
       }
      } else {
       $$2490$lcssa = $225;$$5486$lcssa = $$3484$lcssa;
      }
      $259 = $$5486$lcssa;
      $260 = (($132) - ($259))|0;
      $261 = $260 >> 2;
      $262 = ($261*9)|0;
      $263 = HEAP32[$$5486$lcssa>>2]|0;
      $264 = ($263>>>0)<(10);
      if ($264) {
       $$4492 = $$2490$lcssa;$$4520 = $262;$$8 = $$5486$lcssa;
      } else {
       $$2518634 = $262;$$2534633 = 10;
       while(1) {
        $265 = ($$2534633*10)|0;
        $266 = (($$2518634) + 1)|0;
        $267 = ($263>>>0)<($265>>>0);
        if ($267) {
         $$4492 = $$2490$lcssa;$$4520 = $266;$$8 = $$5486$lcssa;
         break;
        } else {
         $$2518634 = $266;$$2534633 = $265;
        }
       }
      }
     } else {
      $$4492 = $225;$$4520 = $$1517;$$8 = $$3484$lcssa;
     }
    }
    $268 = ((($$4492)) + 4|0);
    $269 = ($$4502$lcssa>>>0)>($268>>>0);
    $spec$select547 = $269 ? $268 : $$4502$lcssa;
    $$5521 = $$4520;$$8506 = $spec$select547;$$9 = $$8;
   } else {
    $$5521 = $$1517;$$8506 = $$4502$lcssa;$$9 = $$3484$lcssa;
   }
   $270 = (0 - ($$5521))|0;
   $271 = ($$8506>>>0)>($$9>>>0);
   L109: do {
    if ($271) {
     $$9507625 = $$8506;
     while(1) {
      $273 = ((($$9507625)) + -4|0);
      $274 = HEAP32[$273>>2]|0;
      $275 = ($274|0)==(0);
      if (!($275)) {
       $$9507$lcssa = $$9507625;$$lcssa583 = 1;
       break L109;
      }
      $272 = ($273>>>0)>($$9>>>0);
      if ($272) {
       $$9507625 = $273;
      } else {
       $$9507$lcssa = $273;$$lcssa583 = 0;
       break;
      }
     }
    } else {
     $$9507$lcssa = $$8506;$$lcssa583 = 0;
    }
   } while(0);
   do {
    if ($211) {
     $not$ = $212 ^ 1;
     $276 = $not$&1;
     $spec$select548 = (($spec$select539) + ($276))|0;
     $277 = ($spec$select548|0)>($$5521|0);
     $278 = ($$5521|0)>(-5);
     $or$cond6 = $277 & $278;
     if ($or$cond6) {
      $279 = (($5) + -1)|0;
      $$neg571 = (($spec$select548) + -1)|0;
      $280 = (($$neg571) - ($$5521))|0;
      $$0479 = $279;$$2476 = $280;
     } else {
      $281 = (($5) + -2)|0;
      $282 = (($spec$select548) + -1)|0;
      $$0479 = $281;$$2476 = $282;
     }
     $283 = $4 & 8;
     $284 = ($283|0)==(0);
     if ($284) {
      if ($$lcssa583) {
       $285 = ((($$9507$lcssa)) + -4|0);
       $286 = HEAP32[$285>>2]|0;
       $287 = ($286|0)==(0);
       if ($287) {
        $$2531 = 9;
       } else {
        $288 = (($286>>>0) % 10)&-1;
        $289 = ($288|0)==(0);
        if ($289) {
         $$1530621 = 0;$$3535620 = 10;
         while(1) {
          $290 = ($$3535620*10)|0;
          $291 = (($$1530621) + 1)|0;
          $292 = (($286>>>0) % ($290>>>0))&-1;
          $293 = ($292|0)==(0);
          if ($293) {
           $$1530621 = $291;$$3535620 = $290;
          } else {
           $$2531 = $291;
           break;
          }
         }
        } else {
         $$2531 = 0;
        }
       }
      } else {
       $$2531 = 9;
      }
      $294 = $$0479 | 32;
      $295 = ($294|0)==(102);
      $296 = $$9507$lcssa;
      $297 = (($296) - ($132))|0;
      $298 = $297 >> 2;
      $299 = ($298*9)|0;
      $300 = (($299) + -9)|0;
      if ($295) {
       $301 = (($300) - ($$2531))|0;
       $302 = ($301|0)>(0);
       $spec$select549 = $302 ? $301 : 0;
       $303 = ($$2476|0)<($spec$select549|0);
       $spec$select562 = $303 ? $$2476 : $spec$select549;
       $$1480 = $$0479;$$3477 = $spec$select562;
       break;
      } else {
       $304 = (($300) + ($$5521))|0;
       $305 = (($304) - ($$2531))|0;
       $306 = ($305|0)>(0);
       $spec$select551 = $306 ? $305 : 0;
       $307 = ($$2476|0)<($spec$select551|0);
       $spec$select563 = $307 ? $$2476 : $spec$select551;
       $$1480 = $$0479;$$3477 = $spec$select563;
       break;
      }
     } else {
      $$1480 = $$0479;$$3477 = $$2476;
     }
    } else {
     $$1480 = $5;$$3477 = $spec$select539;
    }
   } while(0);
   $308 = ($$3477|0)!=(0);
   $309 = $4 >>> 3;
   $$lobit = $309 & 1;
   $310 = $308 ? 1 : $$lobit;
   $311 = $$1480 | 32;
   $312 = ($311|0)==(102);
   if ($312) {
    $313 = ($$5521|0)>(0);
    $314 = $313 ? $$5521 : 0;
    $$2515 = 0;$$pn = $314;
   } else {
    $315 = ($$5521|0)<(0);
    $316 = $315 ? $270 : $$5521;
    $317 = ($316|0)<(0);
    $318 = $317 << 31 >> 31;
    $319 = (_fmt_u($316,$318,$11)|0);
    $320 = $11;
    $321 = $319;
    $322 = (($320) - ($321))|0;
    $323 = ($322|0)<(2);
    if ($323) {
     $$1514614 = $319;
     while(1) {
      $324 = ((($$1514614)) + -1|0);
      HEAP8[$324>>0] = 48;
      $325 = $324;
      $326 = (($320) - ($325))|0;
      $327 = ($326|0)<(2);
      if ($327) {
       $$1514614 = $324;
      } else {
       $$1514$lcssa = $324;
       break;
      }
     }
    } else {
     $$1514$lcssa = $319;
    }
    $328 = $$5521 >> 31;
    $329 = $328 & 2;
    $330 = (($329) + 43)|0;
    $331 = $330&255;
    $332 = ((($$1514$lcssa)) + -1|0);
    HEAP8[$332>>0] = $331;
    $333 = $$1480&255;
    $334 = ((($$1514$lcssa)) + -2|0);
    HEAP8[$334>>0] = $333;
    $335 = $334;
    $336 = (($320) - ($335))|0;
    $$2515 = $334;$$pn = $336;
   }
   $337 = (($$0522) + 1)|0;
   $338 = (($337) + ($$3477))|0;
   $$1528 = (($338) + ($310))|0;
   $339 = (($$1528) + ($$pn))|0;
   _pad_680($0,32,$2,$339,$4);
   _out($0,$$0523,$$0522);
   $340 = $4 ^ 65536;
   _pad_680($0,48,$2,$339,$340);
   if ($312) {
    $341 = ($$9>>>0)>($$0498>>>0);
    $spec$select554 = $341 ? $$0498 : $$9;
    $342 = ((($8)) + 9|0);
    $343 = $342;
    $344 = ((($8)) + 8|0);
    $$5493603 = $spec$select554;
    while(1) {
     $345 = HEAP32[$$5493603>>2]|0;
     $346 = (_fmt_u($345,0,$342)|0);
     $347 = ($$5493603|0)==($spec$select554|0);
     if ($347) {
      $353 = ($346|0)==($342|0);
      if ($353) {
       HEAP8[$344>>0] = 48;
       $$1465 = $344;
      } else {
       $$1465 = $346;
      }
     } else {
      $348 = ($346>>>0)>($8>>>0);
      if ($348) {
       $349 = $346;
       $350 = (($349) - ($9))|0;
       _memset(($8|0),48,($350|0))|0;
       $$0464599 = $346;
       while(1) {
        $351 = ((($$0464599)) + -1|0);
        $352 = ($351>>>0)>($8>>>0);
        if ($352) {
         $$0464599 = $351;
        } else {
         $$1465 = $351;
         break;
        }
       }
      } else {
       $$1465 = $346;
      }
     }
     $354 = $$1465;
     $355 = (($343) - ($354))|0;
     _out($0,$$1465,$355);
     $356 = ((($$5493603)) + 4|0);
     $357 = ($356>>>0)>($$0498>>>0);
     if ($357) {
      break;
     } else {
      $$5493603 = $356;
     }
    }
    $$not = $308 ^ 1;
    $358 = $4 & 8;
    $359 = ($358|0)==(0);
    $or$cond556 = $359 & $$not;
    if (!($or$cond556)) {
     _out($0,4042,1);
    }
    $360 = ($356>>>0)<($$9507$lcssa>>>0);
    $361 = ($$3477|0)>(0);
    $362 = $360 & $361;
    if ($362) {
     $$4478594 = $$3477;$$6494593 = $356;
     while(1) {
      $363 = HEAP32[$$6494593>>2]|0;
      $364 = (_fmt_u($363,0,$342)|0);
      $365 = ($364>>>0)>($8>>>0);
      if ($365) {
       $366 = $364;
       $367 = (($366) - ($9))|0;
       _memset(($8|0),48,($367|0))|0;
       $$0463588 = $364;
       while(1) {
        $368 = ((($$0463588)) + -1|0);
        $369 = ($368>>>0)>($8>>>0);
        if ($369) {
         $$0463588 = $368;
        } else {
         $$0463$lcssa = $368;
         break;
        }
       }
      } else {
       $$0463$lcssa = $364;
      }
      $370 = ($$4478594|0)<(9);
      $371 = $370 ? $$4478594 : 9;
      _out($0,$$0463$lcssa,$371);
      $372 = ((($$6494593)) + 4|0);
      $373 = (($$4478594) + -9)|0;
      $374 = ($372>>>0)<($$9507$lcssa>>>0);
      $375 = ($$4478594|0)>(9);
      $376 = $374 & $375;
      if ($376) {
       $$4478594 = $373;$$6494593 = $372;
      } else {
       $$4478$lcssa = $373;
       break;
      }
     }
    } else {
     $$4478$lcssa = $$3477;
    }
    $377 = (($$4478$lcssa) + 9)|0;
    _pad_680($0,48,$377,9,0);
   } else {
    $378 = ((($$9)) + 4|0);
    $spec$select557 = $$lcssa583 ? $$9507$lcssa : $378;
    $379 = ($$9>>>0)<($spec$select557>>>0);
    $380 = ($$3477|0)>(-1);
    $381 = $379 & $380;
    if ($381) {
     $382 = ((($8)) + 9|0);
     $383 = $4 & 8;
     $384 = ($383|0)==(0);
     $385 = $382;
     $386 = (0 - ($9))|0;
     $387 = ((($8)) + 8|0);
     $$5609 = $$3477;$$7495608 = $$9;
     while(1) {
      $388 = HEAP32[$$7495608>>2]|0;
      $389 = (_fmt_u($388,0,$382)|0);
      $390 = ($389|0)==($382|0);
      if ($390) {
       HEAP8[$387>>0] = 48;
       $$0 = $387;
      } else {
       $$0 = $389;
      }
      $391 = ($$7495608|0)==($$9|0);
      do {
       if ($391) {
        $395 = ((($$0)) + 1|0);
        _out($0,$$0,1);
        $396 = ($$5609|0)<(1);
        $or$cond559 = $384 & $396;
        if ($or$cond559) {
         $$2 = $395;
         break;
        }
        _out($0,4042,1);
        $$2 = $395;
       } else {
        $392 = ($$0>>>0)>($8>>>0);
        if (!($392)) {
         $$2 = $$0;
         break;
        }
        $scevgep711 = (($$0) + ($386)|0);
        $scevgep711712 = $scevgep711;
        _memset(($8|0),48,($scevgep711712|0))|0;
        $$1604 = $$0;
        while(1) {
         $393 = ((($$1604)) + -1|0);
         $394 = ($393>>>0)>($8>>>0);
         if ($394) {
          $$1604 = $393;
         } else {
          $$2 = $393;
          break;
         }
        }
       }
      } while(0);
      $397 = $$2;
      $398 = (($385) - ($397))|0;
      $399 = ($$5609|0)>($398|0);
      $400 = $399 ? $398 : $$5609;
      _out($0,$$2,$400);
      $401 = (($$5609) - ($398))|0;
      $402 = ((($$7495608)) + 4|0);
      $403 = ($402>>>0)<($spec$select557>>>0);
      $404 = ($401|0)>(-1);
      $405 = $403 & $404;
      if ($405) {
       $$5609 = $401;$$7495608 = $402;
      } else {
       $$5$lcssa = $401;
       break;
      }
     }
    } else {
     $$5$lcssa = $$3477;
    }
    $406 = (($$5$lcssa) + 18)|0;
    _pad_680($0,48,$406,18,0);
    $407 = $11;
    $408 = $$2515;
    $409 = (($407) - ($408))|0;
    _out($0,$$2515,$409);
   }
   $410 = $4 ^ 8192;
   _pad_680($0,32,$2,$339,$410);
   $$sink757 = $339;
  }
 } while(0);
 $411 = ($$sink757|0)<($2|0);
 $$560 = $411 ? $2 : $$sink757;
 STACKTOP = sp;return ($$560|0);
}
function ___DOUBLE_BITS_681($0) {
 $0 = +$0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$1 = HEAP32[tempDoublePtr>>2]|0;
 $2 = HEAP32[tempDoublePtr+4>>2]|0;
 tempRet0 = ($2);
 return ($1|0);
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = (___pthread_self_430()|0);
   $7 = ((($6)) + 188|0);
   $8 = HEAP32[$7>>2]|0;
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9|0)==(0|0);
   if ($10) {
    $11 = $1 & -128;
    $12 = ($11|0)==(57216);
    if ($12) {
     $14 = $1&255;
     HEAP8[$0>>0] = $14;
     $$0 = 1;
     break;
    } else {
     $13 = (___errno_location()|0);
     HEAP32[$13>>2] = 84;
     $$0 = -1;
     break;
    }
   }
   $15 = ($1>>>0)<(2048);
   if ($15) {
    $16 = $1 >>> 6;
    $17 = $16 | 192;
    $18 = $17&255;
    $19 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $18;
    $20 = $1 & 63;
    $21 = $20 | 128;
    $22 = $21&255;
    HEAP8[$19>>0] = $22;
    $$0 = 2;
    break;
   }
   $23 = ($1>>>0)<(55296);
   $24 = $1 & -8192;
   $25 = ($24|0)==(57344);
   $or$cond = $23 | $25;
   if ($or$cond) {
    $26 = $1 >>> 12;
    $27 = $26 | 224;
    $28 = $27&255;
    $29 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $28;
    $30 = $1 >>> 6;
    $31 = $30 & 63;
    $32 = $31 | 128;
    $33 = $32&255;
    $34 = ((($0)) + 2|0);
    HEAP8[$29>>0] = $33;
    $35 = $1 & 63;
    $36 = $35 | 128;
    $37 = $36&255;
    HEAP8[$34>>0] = $37;
    $$0 = 3;
    break;
   }
   $38 = (($1) + -65536)|0;
   $39 = ($38>>>0)<(1048576);
   if ($39) {
    $40 = $1 >>> 18;
    $41 = $40 | 240;
    $42 = $41&255;
    $43 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $42;
    $44 = $1 >>> 12;
    $45 = $44 & 63;
    $46 = $45 | 128;
    $47 = $46&255;
    $48 = ((($0)) + 2|0);
    HEAP8[$43>>0] = $47;
    $49 = $1 >>> 6;
    $50 = $49 & 63;
    $51 = $50 | 128;
    $52 = $51&255;
    $53 = ((($0)) + 3|0);
    HEAP8[$48>>0] = $52;
    $54 = $1 & 63;
    $55 = $54 | 128;
    $56 = $55&255;
    HEAP8[$53>>0] = $56;
    $$0 = 4;
    break;
   } else {
    $57 = (___errno_location()|0);
    HEAP32[$57>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___pthread_self_430() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3540|0);
}
function ___pthread_self_105() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___strerror_l($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $$115$ph = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$016 = 0;
 while(1) {
  $2 = (1488 + ($$016)|0);
  $3 = HEAP8[$2>>0]|0;
  $4 = $3&255;
  $5 = ($4|0)==($0|0);
  if ($5) {
   label = 4;
   break;
  }
  $6 = (($$016) + 1)|0;
  $7 = ($6|0)==(87);
  if ($7) {
   $$115$ph = 87;
   label = 5;
   break;
  } else {
   $$016 = $6;
  }
 }
 if ((label|0) == 4) {
  $8 = ($$016|0)==(0);
  if ($8) {
   $$012$lcssa = 1584;
  } else {
   $$115$ph = $$016;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  $$01214 = 1584;$$115 = $$115$ph;
  while(1) {
   $$113 = $$01214;
   while(1) {
    $9 = HEAP8[$$113>>0]|0;
    $10 = ($9<<24>>24)==(0);
    $11 = ((($$113)) + 1|0);
    if ($10) {
     break;
    } else {
     $$113 = $11;
    }
   }
   $12 = (($$115) + -1)|0;
   $13 = ($12|0)==(0);
   if ($13) {
    $$012$lcssa = $11;
    break;
   } else {
    $$01214 = $11;$$115 = $12;
   }
  }
 }
 $14 = ((($1)) + 20|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (___lctrans($$012$lcssa,$15)|0);
 return ($16|0);
}
function ___lctrans($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___lctrans_impl($0,$1)|0);
 return ($2|0);
}
function ___lctrans_impl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = HEAP32[$1>>2]|0;
  $4 = ((($1)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (___mo_lookup($3,$5,$0)|0);
  $$0 = $6;
 }
 $7 = ($$0|0)==(0|0);
 $8 = $7 ? $0 : $$0;
 return ($8|0);
}
function ___mo_lookup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$090 = 0, $$094 = 0, $$191 = 0, $$195 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond102 = 0, $or$cond104 = 0, $spec$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + 1794895138)|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (_swapc($6,$4)|0);
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (_swapc($9,$4)|0);
 $11 = ((($0)) + 16|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (_swapc($12,$4)|0);
 $14 = $1 >>> 2;
 $15 = ($7>>>0)<($14>>>0);
 L1: do {
  if ($15) {
   $16 = $7 << 2;
   $17 = (($1) - ($16))|0;
   $18 = ($10>>>0)<($17>>>0);
   $19 = ($13>>>0)<($17>>>0);
   $or$cond = $18 & $19;
   if ($or$cond) {
    $20 = $13 | $10;
    $21 = $20 & 3;
    $22 = ($21|0)==(0);
    if ($22) {
     $23 = $10 >>> 2;
     $24 = $13 >>> 2;
     $$090 = 0;$$094 = $7;
     while(1) {
      $25 = $$094 >>> 1;
      $26 = (($$090) + ($25))|0;
      $27 = $26 << 1;
      $28 = (($27) + ($23))|0;
      $29 = (($0) + ($28<<2)|0);
      $30 = HEAP32[$29>>2]|0;
      $31 = (_swapc($30,$4)|0);
      $32 = (($28) + 1)|0;
      $33 = (($0) + ($32<<2)|0);
      $34 = HEAP32[$33>>2]|0;
      $35 = (_swapc($34,$4)|0);
      $36 = ($35>>>0)<($1>>>0);
      $37 = (($1) - ($35))|0;
      $38 = ($31>>>0)<($37>>>0);
      $or$cond102 = $36 & $38;
      if (!($or$cond102)) {
       $$4 = 0;
       break L1;
      }
      $39 = (($35) + ($31))|0;
      $40 = (($0) + ($39)|0);
      $41 = HEAP8[$40>>0]|0;
      $42 = ($41<<24>>24)==(0);
      if (!($42)) {
       $$4 = 0;
       break L1;
      }
      $43 = (($0) + ($35)|0);
      $44 = (_strcmp($2,$43)|0);
      $45 = ($44|0)==(0);
      if ($45) {
       break;
      }
      $62 = ($$094|0)==(1);
      $63 = ($44|0)<(0);
      if ($62) {
       $$4 = 0;
       break L1;
      }
      $$191 = $63 ? $$090 : $26;
      $64 = (($$094) - ($25))|0;
      $$195 = $63 ? $25 : $64;
      $$090 = $$191;$$094 = $$195;
     }
     $46 = (($27) + ($24))|0;
     $47 = (($0) + ($46<<2)|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = (_swapc($48,$4)|0);
     $50 = (($46) + 1)|0;
     $51 = (($0) + ($50<<2)|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = (_swapc($52,$4)|0);
     $54 = ($53>>>0)<($1>>>0);
     $55 = (($1) - ($53))|0;
     $56 = ($49>>>0)<($55>>>0);
     $or$cond104 = $54 & $56;
     if ($or$cond104) {
      $57 = (($0) + ($53)|0);
      $58 = (($53) + ($49))|0;
      $59 = (($0) + ($58)|0);
      $60 = HEAP8[$59>>0]|0;
      $61 = ($60<<24>>24)==(0);
      $spec$select = $61 ? $57 : 0;
      $$4 = $spec$select;
     } else {
      $$4 = 0;
     }
    } else {
     $$4 = 0;
    }
   } else {
    $$4 = 0;
   }
  } else {
   $$4 = 0;
  }
 } while(0);
 return ($$4|0);
}
function _swapc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $spec$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 $3 = (_llvm_bswap_i32(($0|0))|0);
 $spec$select = $2 ? $0 : $3;
 return ($spec$select|0);
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$03846 = 0, $$042 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $$pre = 0, $$pre48 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$1 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 15]($2,$0,$1)|0);
    $$1 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)<(0);
   $21 = ($1|0)==(0);
   $or$cond = $20 | $21;
   L10: do {
    if ($or$cond) {
     $$139 = 0;$$141 = $0;$$143 = $1;$32 = $14;
    } else {
     $$03846 = $1;
     while(1) {
      $23 = (($$03846) + -1)|0;
      $24 = (($0) + ($23)|0);
      $25 = HEAP8[$24>>0]|0;
      $26 = ($25<<24>>24)==(10);
      if ($26) {
       break;
      }
      $22 = ($23|0)==(0);
      if ($22) {
       $$139 = 0;$$141 = $0;$$143 = $1;$32 = $14;
       break L10;
      } else {
       $$03846 = $23;
      }
     }
     $27 = ((($2)) + 36|0);
     $28 = HEAP32[$27>>2]|0;
     $29 = (FUNCTION_TABLE_iiii[$28 & 15]($2,$0,$$03846)|0);
     $30 = ($29>>>0)<($$03846>>>0);
     if ($30) {
      $$1 = $29;
      break L5;
     }
     $31 = (($0) + ($$03846)|0);
     $$042 = (($1) - ($$03846))|0;
     $$pre48 = HEAP32[$9>>2]|0;
     $$139 = $$03846;$$141 = $31;$$143 = $$042;$32 = $$pre48;
    }
   } while(0);
   (_memcpy(($32|0),($$141|0),($$143|0))|0);
   $33 = HEAP32[$9>>2]|0;
   $34 = (($33) + ($$143)|0);
   HEAP32[$9>>2] = $34;
   $35 = (($$139) + ($$143))|0;
   $$1 = $35;
  }
 } while(0);
 return ($$1|0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = $14;
  $18 = ((($0)) + 48|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($17) + ($19)|0);
  $21 = ((($0)) + 16|0);
  HEAP32[$21>>2] = $20;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((5752|0));
 return (5760|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((5752|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[884]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[884]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $26 = $17;
     } else {
      $26 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $25 = ($26|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 15]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 15]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _printf($0,$varargs) {
 $0 = $0|0;
 $varargs = $varargs|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 HEAP32[$1>>2] = $varargs;
 $2 = HEAP32[852]|0;
 $3 = (_vfprintf($2,$0,$1)|0);
 STACKTOP = sp;return ($3|0);
}
function _div($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (($1|0) / ($2|0))&-1;
 HEAP32[$0>>2] = $3;
 $4 = ((($0)) + 4|0);
 $5 = Math_imul($3, $2)|0;
 $6 = (($1) - ($5))|0;
 HEAP32[$4>>2] = $6;
 return;
}
function runPostSets() {
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _llvm_cttz_i32(x) { // Note: Currently doesn't take isZeroUndef()
    x = x | 0;
    return (x ? (31 - (Math_clz32((x ^ (x - 1))) | 0) | 0) : 32) | 0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&15](a1|0,a2|0,a3|0)|0;
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&7]();
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&7](a1|0,a2|0);
}


function dynCall_viii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  FUNCTION_TABLE_viii[index&7](a1|0,a2|0,a3|0);
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}
function b2() {
 ; nullFunc_v(2);
}
function b3(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_vii(3);
}
function b4(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_viii(4);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,b1,b1,b1,b1,___stdio_write,b1,b1,b1,b1,b1,b1,b1];
var FUNCTION_TABLE_v = [b2,b2,b2,b2,_gears_idle,b2,_gears_draw,b2];
var FUNCTION_TABLE_vii = [b3,b3,b3,b3,b3,_gears_reshape,b3,b3];
var FUNCTION_TABLE_viii = [b4,b4,b4,b4,b4,b4,b4,_gears_special];

  return { ___errno_location: ___errno_location, ___muldi3: ___muldi3, ___udivdi3: ___udivdi3, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _fflush: _fflush, _free: _free, _i64Add: _i64Add, _i64Subtract: _i64Subtract, _llvm_bswap_i32: _llvm_bswap_i32, _main: _main, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_v: dynCall_v, dynCall_vii: dynCall_vii, dynCall_viii: dynCall_viii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"]; asm["___muldi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____muldi3.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____udivdi3.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Subtract.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__main.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _main = Module["_main"] = asm["_main"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["ENV"]) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    memoryInitializer = locateFile(memoryInitializer);
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
    if (memoryInitializerBytes) {
      applyMemoryInitializer(memoryInitializerBytes.buffer);
    } else
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
          var data = tryParseAsDataURI(Module['memoryInitializerRequestURL']);
          if (data) {
            response = data.buffer;
          } else {
            // If you see this warning, the issue may be that you are using locateFile and defining it in JS. That
            // means that the HTML file doesn't know about it, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
          }
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(Module['thisProgram']);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
      exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



