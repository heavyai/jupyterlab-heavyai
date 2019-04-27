# Jupyter Hub and Notebook Loaded for OmniSci

[![Stability Experimental](https://img.shields.io/badge/stability-experimental-red.svg)](https://img.shields.io/badge/stability-experimental-red.svg)

Includes OmniSci client libraries and tools.

## Usage

```
import jupyterlab_omnisci
import ibis
import altair as alt

con = ibis.mapd.connect(
    host='bewdy.mapd.com', user='mapd', password='HyperInteractive',
    port=6274, database='mapd', protocol= 'binary'
)

omnisci_cli = ibis.mapd.connect(
    host='metis.mapd.com', user='mapd', password='HyperInteractive',
    port=443, database='mapd', protocol= 'https'
)
```

## Components Included

### JupyterHub

https://jupyterhub.readthedocs.io/en/stable/quickstart-docker.html

https://github.com/jupyterhub/jupyterhub-deploy-docker

https://hub.docker.com/r/jupyterhub/jupyterhub/

https://github.com/jupyterhub/dockerspawner

#### LDAP

https://github.com/jupyterhub/jupyterhub/tree/master/examples/bootstrap-script

### Jupyter Notebook

#### Base Image

For the notebook image, set `DOCKER_NOTEBOOK_BASE` in `this.env`.
See http://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html

The build process produces 2 images for notebooks.

For the CPU image, the default base image is
https://hub.docker.com/r/jupyter/scipy-notebook

For the image with GPU/CUDA support, we use a base image from
https://hub.docker.com/r/nvidia/cuda
then build custom images of
https://github.com/jupyter/docker-stacks
using `BASE_CONTAINER=nvidia/cuda:10.0-runtime-ubuntu18.04`.
So the stack of `scipy-notebook-cuda` is otherwise the same as `jupyter/scipy-notebook`.

### Libraries

pymapd

ibis

altair

#### Rapids

https://rapids.ai/

https://anaconda.org/rapidsai/cudf

https://hub.docker.com/r/rapidsai/rapidsai

#### OmniSci Clients

https://hub.docker.com/r/omnisci/core-os-cpu
(Alternatively, https://hub.docker.com/r/omnisci/core-clients-base, but that is not up to date.)

omnisql, etc
