# jupyterlab-mapd

[![Build Status](https://travis-ci.com/Quansight/jupyter-mapd-renderer.svg?branch=master)](https://travis-ci.com/Quansight/jupyter-mapd-renderer)

Connect to MapD, query their databases, and render the MapD-flavored Vega specification,
all within JupyterLab

![example](./screenshot.png)

## Installation

Requirements:
* JupyterLab v0.32
* Access to a MapD server

To install the `jupyterlab-mapd` extension, run the following in a terminal:
```bash
jupyter labextension install jupyterlab-mapd
```

## Installing from source

To install from source, run the following in a terminal:
```bash
pip install \
    vdom \
    git+https://github.com/Quansight/ibis.git@0d1d81400a7a06943f3c99037c348c26942b0ffe \
    pymapd==0.3.2 \
    altair==2.0.1 \
    jupyterlab==0.32.1 \
    pyyaml

git clone https://github.com/Quansight/jupyter-mapd-renderer
cd jupyter-mapd-renderer
jlpm
jlpm build
jupyter labextension install
```

## Edit the default database connection

In JupyterLab, click **Settings > Advanced Settings** to modify the default database connections.

![](https://user-images.githubusercontent.com/4236275/39148358-1cd0ccb0-470a-11e8-9561-8b1e65b8b906.png)

## Developing with Docker

You can start developing on this locally with Docker

```bash
git clone https://github.com/Quansight/jupyter-mapd-renderer
cd jupyter-mapd-renderer
docker-compose up
```

Open link to Jupyterlab instance once it is built and shows up in the logs.
The app will be rebuilt when you change the jupyterlab extension. Reload
the page to get the changes.
