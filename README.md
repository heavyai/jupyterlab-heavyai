# jupyterlab-omnisci

Connect to OmniSci, query their databases, and render the OmniSci-flavored Vega specification,
all within JupyterLab.

[![](https://img.shields.io/pypi/v/jupyterlab-omnisci.svg?style=flat-square)](https://pypi.python.org/pypi/jupyterlab-omnisci) [![](https://img.shields.io/npm/v/jupyterlab-omnisci.svg?style=flat-square)](https://www.npmjs.com/package/jupyterlab-omnisci)

[![binder logo](https://beta.mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/4.%20Extract%20Use%20Cases%20-%20VL%20examples.ipynb)

![example](./screenshot.png)

## Installation

First, install JupyterLab and `pymapd` as well the `jupyterlab-omnisci` Python package:

```bash
conda install -c conda-forge pymapd nodejs

pip install jupyterlab-omnisci
```

Then install the `jupyterlab-omnisci` JupyterLab extension.

```bash
jupyter labextension install @jupyter-widgets/jupyterlab-manager@0.40.x --no-build
jupyter labextension install jupyterlab-omnisci
```

Then launch JupyterLab:

```bash
jupyter lab
```

## Executing SQL Queries

You can open an OmiSci SQL editor by going to **File > New > OmniSci SQL Editor** or clicking the icon on the launcher.

Input your database credentials by clicking on the blue icon on the right:

![](./sqlcon.png)

Then you can input an SQL query and hit the triangle to see the results:

![](./sql.png)

To set a default connection that will be saved and used for new editors, go to **Settings > Set Default Omnisci Connection...**.

## Getting started with Ibis

Once you have set a default connection, you can run the **Inject Ibis OmniSci Connection** command to prefil a cell to connect to it with Ibis.

![](./inject-ibis-con.gif)

## Creating Visualizations

Check out the [introduction notebook](./notebooks/Introduction.ipynb) to see how to use OmniSci within your notebooks [![](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/Quansight/jupyterlab-omnisci/master?urlpath=lab/tree/notebooks/Introduction.ipynb).

## FAQ

1. Something isn't working right. What should I do?
   _[Open an issue!](https://github.com/Quansight/jupyterlab-omnisci/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D+) It's likely not your fault, many of these integrations are new and we need your feedback to understand what use cases are important_.

## Installing from source

To install from source, run the following in a terminal:

```bash
git clone git@github.com:Quansight/jupyterlab-omnisci.git
git clone git@github.com:jakevdp/altair-transform.git
git clone git@github.com:ian-r-rose/vega-ibis-transform.git

cd jupyterlab-omnisci
conda env create -f binder/environment.yml
conda activate jupyterlab-omnisci
pip install -e ../altair-transform -e ../vega-ibis-transform -e .

jlpm install
jlpm run build

jupyter labextension install @jupyter-widgets/jupyterlab-manager@0.40.x --no-build

jupyter labextension install .
```

## Releasing

First create a test environment:

```bash
conda create -n tmp -c conda-forge pymapd nodejs
conda activate tmp
```

Then bump the Python version in `setup.py` and upload a test version:

```bash
pip install --upgrade setuptools wheel twine
rm -rf dist/
python setup.py sdist bdist_wheel
twine upload --repository-url https://test.pypi.org/legacy/ dist/*
```

Install the test version in your new environment:

```bash
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple jupyterlab_omnisci
```

Now bump the version for the Javascript package in `package.json`. The run a build,
create a tarball, and install it as a JupyterLab extension:

```bash
yarn run build
yarn pack --filename out.tgz
jupyter labextension install @jupyter-widgets/jupyterlab-manager@0.40.x --no-build
jupyter labextension install out.tgz
```

Now open JupyterLab and run through all the notebooks in `notebooks` to make sure
they still render correctly.

Now you can publish the Python package:

```bash
twine upload dist/*
```

And publish the node package:

```
npm publish out.tgz
```
