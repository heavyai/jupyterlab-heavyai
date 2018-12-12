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

There are a variety of ways to create visualizations based on OmniSci data in JupyterLab.

You can use [OmniSci's backend Vega rendering](https://www.omnisci.com/docs/latest/6_vegaTutorials.html)
inside your notebooks with the `omnisci_vega` and `omnisci_vegalite` cell magics
(
[![](https://raw.githubusercontent.com/jupyter/design/master/logos/Badges/nbviewer_badge.svg)](http://nbviewer.jupyter.org/github/Quansight/jupyterlab-omnisci/blob/master/notebooks/Renderers.ipynb)
[![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/Renderers.ipynb)
). You can also create an SQL editor to live query your Ibis table using the `omnisci_sqleditor` cell magic
(
[![](https://raw.githubusercontent.com/jupyter/design/master/logos/Badges/nbviewer_badge.svg)](http://nbviewer.jupyter.org/github/Quansight/jupyterlab-omnisci/blob/master/notebooks/SQL%20Editor.ipynb)
[![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/SQL%20Editor.ipynb)
).

If you like using [Altair](https://altair-viz.github.io/) to compose your visualizations, there are a couple of ways
to integrate that with an OmniSci database. There is preliminary support for visualizations with aggregates in them (sum, groupby, etc)
so that those aggregates are executed in the database and only the post aggregated data is sent to the browser (
[![](https://raw.githubusercontent.com/jupyter/design/master/logos/Badges/nbviewer_badge.svg)](http://nbviewer.jupyter.org/github/Quansight/jupyterlab-omnisci/blob/master/notebooks/Ibis%20+%20Altair%20+%20Extraction.ipynb)
[![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/Ibis%20+%20Altair%20+%20Extraction.ipynb)
). Instead, if you would like to use OmniSci's builtin Vega rendering capabilities, you can tell have Altair defer to those (
[![](https://raw.githubusercontent.com/jupyter/design/master/logos/Badges/nbviewer_badge.svg)](http://nbviewer.jupyter.org/github/Quansight/jupyterlab-omnisci/blob/master/notebooks/Ibis%20+%20Altair.ipynb)
[![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/Ibis%20+%20Altair.ipynb)
).

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
