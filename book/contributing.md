# Contributing

We welcome new contributions from anyone, including new ideas, reports of issues, code changes, etc.

## Installing from source

To install from source, run the following in a terminal:

```bash
git clone git@github.com:heavyai/jupyterlab-heavyai.git

cd jupyterlab-heavyai
conda env create -f binder/environment.yml
conda activate jupyterlab-heavyai

pip install -e .[dev]

jlpm install
jlpm run build

jupyter labextension install @jupyter-widgets/jupyterlab-manager .
jupyter serverextension enable --sys-prefix jupyterlab_heavyai.serverextension
```

Now you can build the docs:

```bash
jupyter-book build book
```

And update the formatting of any files you change:

```bash
yarn run prettier
black jupyterlab_heavyai
```

## Releasing

First create a test environment:

```bash
mamba env create -f binder/environment.yml --name release_jupyterlab_heavyai
conda activate tmp
```

Then bump the Python version in `pyproject.toml`, build and install the output.

```bash
flit build
pip install dist/*.whl
```

Now bump the version for the Javascript package in `package.json`. The run a build,
create a tarball, and install it as a JupyterLab extension:

```bash
jlpm
jlpm run build
jlpm pack --filename out.tgz
jupyter labextension install out.tgz
```

Now open JupyterLab and run through all the notebooks in `book` to make sure
they still render correctly:

```bash
jupyter lab
```

Now you can publish the Python package:

```bash
flit publish
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
