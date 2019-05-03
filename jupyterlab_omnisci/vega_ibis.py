import typing
import copy
import random
import warnings

import ibis
import altair
import pandas
from ipykernel.comm import Comm
from IPython import get_ipython

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
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            spec = self.to_dict()
        d = display({ MIMETYPE: EMPTY_VEGA }, raw=True, display_id=True)
        _add_target(self.data.ibis)

        compile_comm = Comm(target_name='jupyterlab-omnisci:vega-compiler', data=spec)

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

def _add_target(expr: ibis.Expr):
    def target_func(comm, msg):
        @comm.on_msg
        def _recv(msg):
            data = expr.execute()
            comm.send(data.to_dict(orient='records'))

    get_ipython().kernel.comm_manager.register_target('queryibis', target_func)

monkeypatch_altair()
