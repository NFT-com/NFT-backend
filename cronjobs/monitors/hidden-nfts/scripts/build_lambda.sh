#!/bin/bash

set -o errexit # Exit on error
CWD=$(pwd)
BUILD_PATH_LAYERS=$CWD/layers
if [ -d "$BUILD_PATH_LAYERS" ]; then rm -Rf $BUILD_PATH_LAYERS; fi
cd $CWD

# Package typescript code
pnpm install --filter=@nftcom/hidden-nfts...
pnpm dlx turbo run build --filter=@nftcom/hidden-nfts... --force

echo "zip build directory"
cd dist/cronjobs/monitors
zip -q -r archive.zip hidden-nfts/*

# Package node_modules
mkdir -p $BUILD_PATH_LAYERS
cp $CWD/pnpm-lock.yaml $BUILD_PATH_LAYERS/pnpm-lock.yaml
cp $CWD/pnpm-workspace.yaml $BUILD_PATH_LAYERS/pnpm-workspace.yaml
mkdir -p $BUILD_PATH_LAYERS/cronjobs/monitors/hidden-nfts
cp $CWD/cronjobs/monitors/hidden-nfts/package.json $BUILD_PATH_LAYERS/cronjobs/monitors/hidden-nfts/package.json
mkdir -p $BUILD_PATH_LAYERS/packages/shared

cd $BUILD_PATH_LAYERS
echo "installing production only dependencies"
cp -r $CWD/dist/packages/shared packages
pnpm install --filter=@nftcom/hidden-nfts... --prod --shamefully-hoist

echo "zip node_modules directory"
mkdir -p ./nodejs
mv cronjobs nodejs/cronjobs
mv node_modules nodejs/node_modules
mv packages nodejs/packages
rm pnpm-lock.yaml
rm pnpm-workspace.yaml

zip -q -r archive.zip *
rm -rf nodejs

echo "exiting to root directory"
cd $CWD

echo "Done."