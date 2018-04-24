FROM jupyter/scipy-notebook

RUN conda install -y -c conda-forge \
    jupyterlab=0.32.0 \
    pymapd

RUN pip install vdom altair==2.0.0rc2
