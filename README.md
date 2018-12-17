# jupyterlab-omnisci

Connect to OmniSci, query their databases, and render the OmniSci-flavored Vega specification,
all within JupyterLab.

![example](./screenshot.png)

## Installation

First, install JupyterLab as well the `jupyterlab-omnisci` Python package and
`jupyterlab-omnisci` JupyterLab extension:

```bash
pip install jupyterlab-omnisci[altair]
jupyter labextension install jupyterlab-omnisci
jupyter lab
```

## Executing SQL Querries

You can open an OmiSci SQL editor by going to **File > New > OmniSci SQL Editor** or clicking the icon on the launcher.

Input your database credentials by clicking on the blue icon on the right:

![](https://user-images.githubusercontent.com/1186124/49897086-243ba800-fe23-11e8-8bf4-78f35d4fe9ce.png)

Then you can input an SQL query and hit the triangle to see the results:

![](https://user-images.githubusercontent.com/1186124/49897052-0e2de780-fe23-11e8-9265-4bfad02c1f7e.png)

To set a default connection that will be saved and used for new editors, go to **Settings > Set Default Omnisci Connection...**.

## Creating Visualizations

Check out the [introduction notebook](./notebooks/Introduction.ipynb) to see how to use OmniSci within your notebooks [![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/Introduction.ipynb).

## FAQ

1. Something isn't working right. What should I do?
   _Open an issue! It's likely not your fault, many of these integrations are new and we need your feedback to understand what use cases are important_.

## Installing from source

To install from source, run the following in a terminal:

```bash
git clone https://github.com/Quansight/jupyterlab-omnisci
cd jupyterlab-omnisci
conda create -f environment.yml
conda activate jupyterlab-omnisci
jlpm install
jlpm run build
jupyter labextension install .
pip install -e .
```
