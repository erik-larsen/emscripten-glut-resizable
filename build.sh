set -o verbose
emcc emscripten/test/hello_world_gles.c -DANIMATE -g -O0 -s WASM=1 -o hello_world_gles.html
