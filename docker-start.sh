#!/bin/bash
set -euxo

sudo chown -R $NB_USER:$NB_GID $YARN_CACHE_FOLDER

jlpm
jlpm build
jupyter labextension link --no-build
jlpm watch &

set +euxo
