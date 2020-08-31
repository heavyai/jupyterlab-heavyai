# Installation

This repository provides a Python package as well as a JupyterLab extension. Both need to be installed, along with JupyterLab 2.x.

## Pip

```bash
pip install jupyterlab-omnisci
```

Then install the `jupyterlab-omnisci` JupyterLab extension as well as Jupyter Widgets, if you want to use their support:

```bash
jupyter labextension install \
    @jupyter-widgets/jupyterlab-manager \
    jupyterlab-omnisci
```

## Conda

*(pending new conda release, not working yet)*

This will install both the Python package as well as the JupyterLab extension.

```bash
conda install -c conda-forge jupyterlab-omnisci
jupyter lab build
```
