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
mkdir -p $BUILD_PATH_LAYERS/packages/shared
cp $CWD/packages/shared/package.json $BUILD_PATH_LAYERS/packages/shared/package.json
cp $CWD/packages/shared/package-lock.json $BUILD_PATH_LAYERS/packages/shared/package-lock.json

cd $BUILD_PATH_LAYERS
echo "installing production only dependencies"
mv $CWD/packages/shared/dist packages/shared/dist
npm ci --production --omit=dev --platform=linux --arch=x64 --ignore-scripts

echo "zip node_modules directory"
mkdir -p ./nodejs
mv node_modules nodejs/node_modules
rm ./nodejs/node_modules/@nftcom/shared
mv ./packages/shared nodejs/node_modules/@nftcom/shared
rm -rf packages
rm package.json
rm package-lock.json

zip -q -r archive.zip *
rm -rf nodejs

echo "exiting to root directory"
cd $CWD

echo "Done."