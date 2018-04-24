# jupyterlab-mapd

Connection to MapD, query their databases, and render the MapD-flavored Vega specification.

```bash
git clone https://github.com/Quansight/jupyter-mapd-renderer
cd jupyter-mapd-renderer
jlpm install
jlpm run build
jupyter labextension install .
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

# optionally insert sample data
docker-compose exec mapd /mapd/insert_sample_data
```

Open link to Jupyterlab instance once it is built and shows up in the logs.
The app will be rebuilt when you change the jupyterlab extension. Reload
the page to get the changes.
