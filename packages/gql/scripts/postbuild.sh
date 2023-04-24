#!/usr/bin/env bash

DIST="../../dist/packages/gql"
cp package.json $DIST
cp -r ./src/schema/*.graphql ${DIST}/src/schema/