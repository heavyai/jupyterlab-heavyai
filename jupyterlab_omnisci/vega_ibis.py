import typing
import copy
import random

import ibis
import altair
import pandas
from ipykernel.comm import Comm
import mypy_extensions

__all__: typing.List[str] = []


# New Vega Lite renderer mimetype which can process ibis expressions in names
MIMETYPE = "application/vnd.vega.ibis.v5+json"

EMPTY_VEGA = {
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "An empty vega v5 spec",
  "width": 500,
  "height": 200,
  "padding": 5,
  "autosize": "pad",

  "signals": [],
  "data": [],
  "scales": [],
  "projections": [],
  "axes": [],
  "legends": [],
  "marks": []
}

def vega_ibis_transformer(data):
    """
    Saves the Ibis expression in `HASH_TO_IBIS` so we can access it later and
    replaces it with named data that has the hash of the expression. 
    """
    # Requires it to have ibis expression attached
    assert isinstance(data, ibis.Expr)

    ibis_expr = data

    expr_hash = hash(data)
    HASH_TO_IBIS[expr_hash] = data

    return {"name": f"{NAME_PREFIX}{expr_hash}"}


def vega_ibis_renderer(spec):
    """
    Exports the spec with a new mimetype that will trigger the ibis-vega pipeline.
    """
    compile_comm = Comm(target_name='jupyterlab-omnisci:vega-compiler', data=spec)
    display_id = display({ 'text/plain': '' }, display_id = True, raw=True) 

    @compile_comm.on_msg
    def _recv(msg):
        display_id.update({MIMETYPE: msg['content', 'data']}, raw=True)


    return { MIMETYPE: '' }


def empty(expr: ibis.Expr) -> pandas.DataFrame:
    """
    Creates an empty DF for a ibis expression, based on the schema

    https://github.com/ibis-project/ibis/issues/1676#issuecomment-441472528
    """
    return expr.schema().apply_to(pandas.DataFrame(columns=expr.columns))

def monkeypatch_altair():
    """
    Needed until https://github.com/altair-viz/altair/issues/843 is fixed to let Altair
    handle ibis inputs
    """
    original_chart_init = altair.Chart.__init__

    def updated_chart_init(self, data=None, *args, **kwargs):
        """
        If user passes in a Ibis expression, create an empty dataframe with
        those types and set the `ibis` attribute to the original ibis expression.
        """
        if data is not None and isinstance(data, ibis.Expr):
            expr = data
            data = empty(expr)
            data.ibis = expr

        return original_chart_init(self, data=data, *args, **kwargs)

    def ipython_display(self):
        spec = self.to_dict()
        _add_target()
        compile_comm = Comm(target_name='jupyterlab-omnisci:vega-compiler', data=spec)
        d = display({ MIMETYPE: EMPTY_VEGA }, raw=True, display_id=True)

        @compile_comm.on_msg
        def _recv(msg):
            vega_spec = msg['content']['data']
            if not vega_spec.get('$schema'):
                return
            transformed = _transform(vega_spec)
            d.update({ MIMETYPE: transformed}, raw=True)



    altair.Chart.__init__ = updated_chart_init
    altair.Chart._ipython_display_ = ipython_display

def _transform(spec):
    new = copy.deepcopy(spec)
    new['data'][0]['transform'] = [
        {
            'type': "queryibis",
            'query': {}
        }
    ]
    new['data'][0]['values'] = []
    return new

def _add_target():
    def target_func(comm, msg):
        @comm.on_msg
        def _recv(msg):
            # Use msg['content']['data'] for the data in the message

            # Send data to the frontend
            comm.send([{'a': 'A', 'b': random.randint(0,100)},
                {'a': 'B', 'b': random.randint(0,100)},
                {'a': 'C', 'b': random.randint(0,100)},
                {'a': 'D', 'b': random.randint(0,100)},
                {'a': 'E', 'b': random.randint(0,100)},
                {'a': 'F', 'b': random.randint(0,100)},
                {'a': 'G', 'b': random.randint(0,100)},
                {'a': 'H', 'b': random.randint(0,100)},
                {'a': 'I', 'b': random.randint(0,100)}])
    get_ipython().kernel.comm_manager.register_target('queryibis', target_func)

altair.renderers.register("vega-ibis", vega_ibis_renderer)
altair.data_transformers.register("vega-ibis", vega_ibis_transformer)
monkeypatch_altair()
