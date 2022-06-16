# Installation

This repository provides a Python package as well as a JupyterLab extension. Both need to be installed, along with JupyterLab 2.x.

## Pip

```bash
pip install jupyterlab-heavyai
```

Then install the `jupyterlab-heavyai` JupyterLab extension as well as Jupyter Widgets, if you want to use their support:

```bash
jupyter labextension install \
    @jupyter-widgets/jupyterlab-manager \
    jupyterlab-heavyai
```

## Conda/Mamba

This will install both the Python package and the JupyterLab extension.

```bash
mamba install -c conda-forge jupyterlab-heavyai
jupyter lab build
```
