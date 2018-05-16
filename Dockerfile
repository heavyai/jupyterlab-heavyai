FROM jupyter/scipy-notebook:1085ca054a5f

RUN conda install -y -c conda-forge \
    pymapd==0.3.2 \
    altair==2.0.1

RUN pip install \
    vdom \
    git+https://github.com/Quansight/ibis.git@8fdcfc55031653ebb0ce03a4c1a737d7f77b60b2

USER root
RUN echo "$NB_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/notebook
USER $NB_USER
