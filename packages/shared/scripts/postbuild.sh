#!/usr/bin/env bash

DIST="../../dist/packages/shared"
cp package.json $DIST
cp -r ./src/db/rds-combined-ca-bundle.cer ${DIST}/src/db/rds-combined-ca-bundle.cer