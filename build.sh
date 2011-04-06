#!/bin/bash
# makefile this please
rm -r build
mkdir build
cd build
cp /usr/local/bin/node .
cp -r ../src/* .
cp -r ../midicore/ .
shar . > ../noke.run
