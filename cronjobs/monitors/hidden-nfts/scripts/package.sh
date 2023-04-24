#!/bin/bash

set -o errexit # Exit on error
CWD=$(pwd)
BUILD_PATH_LAYERS=$CWD/layers
cd $CWD

# Package typescript code
pnpm install --filter=@nftcom/hidden-nfts...
pnpm dlx turbo run build --filter=@nftcom/hidden-nfts...

echo "zip build directory"
cd dist/cronjobs/monitors
zip -q -r archive.zip hidden-nfts/*

# Package node_modules
mkdir -p $BUILD_PATH_LAYERS
cp $CWD/pnpm-lock.json $BUILD_PATH_LAYERS/pnpm-lock.json
cp $CWD/pnpm-workspace.json $BUILD_PATH_LAYERS/pnpm-workspace.json
mkdir -p $BUILD_PATH_LAYERS/cronjobs/monitors/hidden-nfts
cp $CWD/cronjobs/monitors/hidden-nfts/package.json $BUILD_PATH_LAYERS/cronjobs/monitors/hidden-nfts/package.json
mkdir -p $BUILD_PATH_LAYERS/packages/shared

cd $BUILD_PATH_LAYERS
echo "installing production only dependencies"
mv $CWD/dist/packages/shared packages/shared
pnpm install --filter=@nftcom/hidden-nfts... --prod

echo "zip node_modules directory"
mkdir -p ./nodejs
mv ./packages nodejs
rm -rf packages
rm pnpm-lock.json
rm pnpm-workspace.json

zip -q -r archive.zip *
rm -rf nodejs

echo "exiting to root directory"
cd $CWD

echo "Done."