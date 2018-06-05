FROM jupyter/scipy-notebook:1085ca054a5f

RUN conda install -y -c conda-forge \
    altair==2.0.1

RUN pip install \
    vdom \
    git+https://github.com/Quansight/ibis.git@master \
    git+https://github.com/mapd/pymapd@master

USER root
RUN echo "$NB_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/notebook
USER $NB_USER
