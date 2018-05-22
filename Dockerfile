FROM jupyter/scipy-notebook:1085ca054a5f

RUN conda install -y -c conda-forge \
    pymapd==0.3.2 \
    altair==2.0.1

RUN pip install \
    vdom \
    git+https://github.com/Quansight/ibis.git@0d1d81400a7a06943f3c99037c348c26942b0ffe

USER root
RUN echo "$NB_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/notebook
USER $NB_USER
