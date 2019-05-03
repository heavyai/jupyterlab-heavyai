import typing

import ibis
import altair
import pandas
from ipykernel.comm import Comm
import mypy_extensions

__all__: typing.List[str] = []


# We need to persist this global mapping because the ibis hash
# is stored in the Vega Lite spec and is sent back whenever we need to compute
# new data.
HASH_TO_IBIS: typing.Dict[int, ibis.Expr] = {}

# New Vega Lite renderer mimetype which can process ibis expressions in names
MIMETYPE = "application/vnd.vega.ibis.v5+json"

NAME_PREFIX = 'ibis-'

ibis_expr = None

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
        compile_comm = Comm(target_name='jupyterlab-omnisci:vega-compiler', data=spec)
        d = display({ MIMETYPE: EMPTY_VEGA }, raw=True, display_id=True)

        @compile_comm.on_msg
        def _recv(msg):
            d.update({ MIMETYPE: msg['content']['data']}, raw=True)



    altair.Chart.__init__ = updated_chart_init
    altair.Chart._ipython_display_ = ipython_display

altair.renderers.register("vega-ibis", vega_ibis_renderer)
altair.data_transformers.register("vega-ibis", vega_ibis_transformer)
monkeypatch_altair()
