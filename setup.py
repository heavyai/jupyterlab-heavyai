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
    version="2.0.0",  # Required
    description="Omnisci integration with JupyterLab",  # Required
    long_description=long_description,  # Optional
    long_description_content_type="text/markdown",  # Optional (see note above)
    url="https://github.com/Quansight/jupyterlab-omnisci",  # Optional
    packages=find_packages(),
    install_requires=[
        "altair>=3.0.1",
        "ibis-framework>=1.1.0",
        "ibis-vega-transform==3.0.0",
        "ipywidgets",
        "jupyterlab>=1.2.0",
        "pymapd>=0.12.0",
        "pyyaml",
        "notebook<6",
        "vdom",
        "vega_datasets",
        "tornado<6"
    ],
)
