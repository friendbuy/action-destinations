#!/bin/sh

# Allow the service to run without chamber (for CI, docker-compose, etc)
if [ -z "$NO_CHAMBER" ];then
  exec chamber exec fab-5-engine -- node dist/src/app.js
else
  exec node dist/src/app.js
fi;
