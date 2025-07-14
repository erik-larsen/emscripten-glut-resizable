set -o verbose
emcc hello_world_gles.c -g -O0 -s WASM=1 -o hello_world_gles.html
emcc test_glut_resize.c -g -O0 -s WASM=1 -o test_glut_resize.html