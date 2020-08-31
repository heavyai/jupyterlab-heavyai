# Contributing

We welcome new contributions from anyone, including new ideas, reports of issues, code changes, etc.

## Installing from source

To install from source, run the following in a terminal:

```bash
git clone git@github.com:omnisci/jupyterlab-omnisci.git

cd jupyterlab-omnisci
conda env create -f binder/environment.yml
conda activate jupyterlab-omnisci

pip install -e .[dev]

jlpm install
jlpm run build

jupyter labextension install @jupyter-widgets/jupyterlab-manager .
jupyter serverextension enable --sys-prefix jupyterlab_omnisci.serverextension
```

Now you can build the docs:

```bash
jupyter-book build book
```

And update the formatting of any files you change:

```bash
yarn run prettier
black jupyterlab_omnisci
```

## Releasing

First create a test environment:

```bash
conda env create -f binder/environment.yml --name tmp
conda activate tmp
```

Then bump the Python version in `setup.py` and upload a test version:

```bash
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
jlpm
jlpm run build
jlpm pack --filename out.tgz
jupyter labextension install @jupyter-widgets/jupyterlab-manager ibis-vega-transform --no-build
jupyter labextension install out.tgz
```

Now open JupyterLab and run through all the notebooks in `notebooks` to make sure
they still render correctly.

Now you can publish the Python package:

```bash
twine upload dist/*
```

And publish the node package:

```bash
npm publish out.tgz
```

And add a git tag for the release and push:

```bash
git tag <new version>
git push
git push --tags
```
