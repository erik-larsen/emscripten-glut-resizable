# emscripten-glut-resizable
*Emscripten GLUT browser resizing fix*

## Latest info

See this [PR](https://github.com/emscripten-core/emscripten/pull/24699) for the most recent code and discussion. 

## Issue

When using GLUT and the window is resized with the canvas dependent upon it due to CSS scaling, the result is a stretched canvas with blocky pixel scaling:

![VT sample app](before.png)

Here's a CSS scaling example:

    <style>
        canvas {
            position: fixed;
            width: 75%;
            height: 75%;
        }
    </style>
    <canvas id="canvas"></canvas>

 While position fixed isn't strictly necessary, it more readily shows the problem as it makes the canvas size directly dependent upon the browser window.  For comparison, SDL behaves properly in this same scenario.

## Fix 

Three issues were found:
1. On window resize, glutReshapeFunc is never called.

2. Even with glutReshapeFunc working, the dimensions passed to it do not include CSS scaling.  Specifically, the canvas width and height are never updated with the canvas clientWidth and clientHeight, which does include scaling.

3. On GLUT program startup, glutMainLoop calls glutReshapeWindow, which is slightly problematic for the case of loading the page while already in fullscreen.  This is a problem because, while an initial resize is needed on startup, glutReshapeWindow also forces an exit from fullscreen mode.

Here are the proposed fixes:

1. Register a new resize callback `GLUT.reshapeHandler` using `window.addEventListener`, replacing `Browser.resizeListeners.push`. Previous work in this area (see below) utilized `resizeListeners`, however this fix takes a different route that is self-contained and I think simpler:
    - Using `window.addEventListener` keeps the fix entirely within `libglut.js`, avoiding any `libbrowser.js` changes as in previous attempts.  As well, `updateResizeListeners` doesn't pass CSS-scaled canvas dimensions, so changing `updateResizeListeners` implementation might be necessary and this could impact other non-GLUT clients, going beyond this GLUT-only fix.
    - Since `glutInit` already utilizes `window.addEventListener` for all other event handling, doing the same for the resize event seems consistent and simpler, as it avoids mixing event handling methods for GLUT.

2. Create a new resize callback function, `GLUT.reshapeHandler`, which does the following:
    - Updates `canvas` dimensions (via `Browser.setCanvasSize`) to `canvas.clientWidth` and `clientHeight`, so that CSS scaling is accounted for. If no CSS scaling is present, `clientWidth` and `clientHeight` match `canvas.width` and `height`, so these values are safe to use in all cases, scaling or not.
    - After updating the canvas size, pass `clientWidth` and `clientHeight` to `glutReshapeFunc`.  This is needed so that GLUT reshape callbacks can properly update their viewport transform by calling `glViewport` with the actual canvas dimensions.

3. At GLUT startup in `glutMainLoop`, call `GLUT.reshapeHandler` instead of `glutReshapeWindow`.  
    - As mentioned above, `glutReshapeWindow` has an unwanted side effect of always forcing an exit from fullscreen (and this is by design, according to the [GLUT API](https://www.opengl.org/resources/libraries/glut/spec3/node23.html)).


## Testing

Manual testing:
1. Window resizing with no CSS, CSS scaling, CSS pixel dimensions, and a mix of these for canvas width and height.
2. Entering and exiting fullscreen, and loading a page while already in fullscreen.
3. No DPI testing done (window.devicePixelRatio != 1), as GLUT is not currently DPI aware and this fix does not address it.  I did confirm on Retina Mac that this fix doesn't make this issue any better or worse.

Automated tests:
1. Added test/browser/test_glut_resize.c, with tests to assert canvas size matches target size under various scenarios (no CSS, CSS scaling, CSS pixel dimensions, and a mix of these), as well as canvas size always matching canvas client size (clientWidth and clientHeight).  
2. Since programmatic browser window resizing is not allowed for security reasons, these tests dispatch a resize event after each CSS style change as a workaround.
3. Also added tests to assert canvas size consistency after glutMainLoop and glutReshapeWindow API calls.

## Related work

All the previous work in this area worked toward enabling GLUT resize callbacks via Emscripten’s built-in event handling (specifically `Browser.resizeListeners` and `updateResizeListeners`).  As mentioned above, this fix takes a different approach that is entirely self-contained within `libglut.js`.  

This 2013 [commit](https://github.com/Emscripten-core/Emscripten/commit/6d6490e61ef9a63cbf314faa19e152796a21f3d3) added `GLUT.reshapeFunc` to `Browser.resizeListeners`, presumably to handle window resizing.  However there is no test code with that commit, and as of current Emscripten, `updateResizeListeners()` is never called on window resizing with GLUT programs, so this code is currently a no-op.

[Issue 7133](https://github.com/Emscripten-core/Emscripten/issues/7133) (that I logged in 2018, hi again!) got part of the way on a fix, but used `glutReshapeWindow` which has the previously mentioned side effect of exiting fullscreen.  This was closed unresolved.

[PR 9835](https://github.com/Emscripten-core/Emscripten/pull/9835) proposed a fix for 7133.  Also closed unresolved, this fix involved modifying `libbrowser.js` in order to get resize callbacks to GLUT via `resizeListeners`.  While this got resize callbacks working, in my testing it didn’t pass CSS-scaled canvas size in the callback (the all-important clientWidth and clientHeight).

I also looked at how SDL handles resizing, which uses `resizeEventListeners`, but decided the more straightforward fix was to use `addEventListener`.  Last, I looked at [GLFW CSS scaling test](https://github.com/emscripten-core/emscripten/blob/main/test/browser/test_glfw3_css_scaling.c) which was helpful in writing the automated tests and also to confirm that no DPI ratio work is addressed by this fix.
