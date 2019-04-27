ARG DOCKER_NOTEBOOK_BASE=jupyter/scipy-notebook:latest

# Reference OmniSci to grab the client tools
# https://hub.docker.com/r/omnisci/core-os-cpu
# https://hub.docker.com/r/omnisci/core-clients-base
FROM omnisci/core-os-cpu AS core

######################################

FROM $DOCKER_NOTEBOOK_BASE

LABEL maintainer="OmniSci <info@omnisci.com>"

USER root

RUN apt update && \
    apt-get install -y vim pigz less awscli

RUN mkdir -p /omnisci/bin
# TODO add other cli tools
COPY --from=core /omnisci/bin/omnisql /omnisci/bin/*Importer /omnisci/bin/omnisci-jdbc-*.jar /omnisci/bin/
ENV PATH="${PATH}:/omnisci/bin"

USER $NB_USER

ENV PATH="${PATH}:/omnisci/bin"

# ARG JUPYTERHUB_VERSION
# RUN python3 -m pip install --no-cache jupyterhub==$JUPYTERHUB_VERSION

# update conda and pip
# install gcc because ibis requires regex which will fail to build without it
ARG JUPYTERHUB_VERSION
RUN conda update -y -n base conda pip && \
    conda install -y -n base gcc_linux-64 vega nodejs jupyterhub=$JUPYTERHUB_VERSION boto3

# Build
# TODO move to a build-stage FROM

COPY --chown=1000 ./ /tmp/src/
WORKDIR /tmp/src

RUN conda env update -n base -f binder/environment.yml
# See README.md:
# RUN pip install git+https://github.com/jakevdp/altair.git@vl3-rc8

RUN conda init bash
RUN jlpm install
RUN jlpm run build
# Disabled until it has been updated for JL 1.0
# RUN jupyter labextension install @jupyter-widgets/jupyterlab-manager@0.38.x
RUN jupyter labextension install .
RUN pip install -e .

# Include example notebooks in the image
WORKDIR $HOME
RUN mkdir omnisci_examples
COPY --chown=1000 notebooks/*.ipynb omnisci_examples/
# make them read-only so it's not mistaken changes are persistent
RUN chmod -R ugo-w omnisci_examples

# https://rapids.ai/start.html
# https://anaconda.org/rapidsai/repo
ARG RAPIDS_VERSION
RUN conda install -y -n base \
    -c nvidia -c rapidsai -c pytorch -c numba -c conda-forge -c defaults \
    cudf=$RAPIDS_VERSION cuml=$RAPIDS_VERSION dask-cuda=$RAPIDS_VERSION dask-cudf=$RAPIDS_VERSION nvstrings=0.3

# ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/lib
ENV LD_LIBRARY_PATH=/usr/local/cuda/lib64/:/opt/conda/lib

ENV JUPYTER_ENABLE_LAB=yes
