"""A setuptools based setup module for omnisci renderers"""
from setuptools import setup, find_packages
# To use a consistent encoding
from codecs import open
from os import path

here = path.abspath(path.dirname(__file__))

# Get the long description from the README file
with open(path.join(here, 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='jupyter-omnisci-renderer',  # Required
    version='0.0.0',  # Required
    description='Mimerenderer extensions for JupyterLab-Omnisci integration',  # Required
    long_description=long_description,  # Optional
    long_description_content_type='text/markdown',  # Optional (see note above)
    url='https://github.com/Quansight/jupyterlab-omnisci',  # Optional
    py_modules=['omnisci_renderer'],
    install_requires=[
        'vdom',
        'pymapd',
        'pyyaml',
        'jupyterlab'
    ],  # Optional
    extras_require={  # Optional
        'altair': [
            'altair',
            'ibis-framework'
        ],
    },
)
