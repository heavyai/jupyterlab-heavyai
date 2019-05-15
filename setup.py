"""A setuptools based setup module for omnisci renderers"""
# To use a consistent encoding
from codecs import open
from os import path

from setuptools import find_packages, setup

here = path.abspath(path.dirname(__file__))

# Get the long description from the README file
with open(path.join(here, "README.md"), encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="jupyterlab-omnisci",  # Required
    version="0.9.0",  # Required
    description="Omnisci integration with JupyterLab",  # Required
    long_description=long_description,  # Optional
    long_description_content_type="text/markdown",  # Optional (see note above)
    url="https://github.com/Quansight/jupyterlab-omnisci",  # Optional
    packages=find_packages(),
    install_requires=[
        "vdom",
        "pyyaml",
        "altair==3.0.1",
        "ipywidgets",
        "ibis-framework==1.0.0",
        "vega_datasets",
        "jupyterlab==1.0.0a3"
    ]
)
