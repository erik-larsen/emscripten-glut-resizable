set -o verbose
emcc emscripten/test/hello_world_gles.c -g -O0 -s WASM=1 -o hello_world_gles.html
