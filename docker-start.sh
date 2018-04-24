#!/bin/bash
set -euxo

jlpm
jlpm build
jupyter labextension link --no-build
jlpm watch &

set +euxo
