#!/bin/bash

set -o errexit # Exit on error
CWD=$(pwd)
BUILD_PATH_LAYERS=$CWD/layers
cd $CWD

# Package typescript code
npm install --prefer-offline --platform=linux --arch=x64
cd $CWD/packages/shared
npm run build
cd -
npx -y nx run monitors-hidden-nfts:build:production

echo "zip build directory"
cd dist/packages/monitors
zip -q -r archive.zip hidden-nfts/*

# Package node_modules
mkdir -p $BUILD_PATH_LAYERS
cp $CWD/package-lock.json $BUILD_PATH_LAYERS/package-lock.json
cp $CWD/package.json $BUILD_PATH_LAYERS/package.json

cd $BUILD_PATH_LAYERS
echo "installing production only dependencies"
npm ci --production --omit=dev --platform=linux --arch=x64 --ignore-scripts

echo "zip node_modules directory"
mkdir -p ./nodejs/packages/shared/dist
mv node_modules nodejs/node_modules
cp -r $CWD/packages/shared/dist nodejs/packages/shared
cp $CWD/packages/shared/package.json nodejs/packages/shared/package.json
zip -q -r archive.zip *
rm -rf nodejs

echo "exiting to root directory"
cd $CWD

echo "Done."