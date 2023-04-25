#!/usr/bin/env bash

DIST="../../dist/apps/gql"
cp package.json $DIST
cp -r ./src/schema/*.graphql ${DIST}/src/schema/