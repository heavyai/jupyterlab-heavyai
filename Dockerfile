FROM jupyter/scipy-notebook

RUN conda install -y -c conda-forge \
    jupyterlab=0.32.0 \
    pymapd

RUN pip install vdom altair==2.0.0rc2

USER root
RUN echo "$NB_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/notebook
USER $NB_USER
