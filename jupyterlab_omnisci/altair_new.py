import typing

import ibis
import altair
import ipykernel.comm
import mypy_extensions

__all__: typing.List[str] = []


# We need to persist this global mapping because the ibis hash
# is stored in the Vega Lite spec and is sent back whenever we need to compute
# new data.
HASH_TO_IBIS: typing.Dict[int, ibis.Expr] = {}

# New Vega Lite renderer mimetype which can process ibis expressions in names
MIMETYPE = "application/vnd.vegalite.v3+json; ibis=true"

NAME_PREFIX = 'ibis-'

# Comm opened by client to send expression and transforms
COMM_ID = 'vega-ibis'
COMM = ipykernel.comm.Comm(target_name=COMM_ID, data=None)


def vega_ibis_transformation(data):
    """
    Saves the Ibis expression in `HASH_TO_IBIS` so we can access it later and
    replaces it with named data that has the hash of the expression. 
    """
    # Requires dataframe to be pandas DF
    assert isinstance(data, pandas.DataFrame)
    expr = data.ibis
    # Requires it to have ibis expression attached
    assert isinstance(expr, ibis.Expr)

    expr_hash = hash(expr)
    HASH_TO_IBIS[expr_hash] = expr

    return {"name": f"{NAME_PREFIX}{expr_hash}"}


def vega_ibis_renderer(spec):
    """
    Exports the spec with a new mimetype that will trigger the ibis-vega pipeline.
    """
    return {MIMETYPE: spec}


CommData = mypy_extensions.TypedDict('CommData', {
    "data": typing.Dict[str, object],
    "expr_hash": int,
    "transform": typing.List[typing.Dict]
})


@COMM.on_msg
def comm_on_msg(msg) -> None:
    on_comm_data(msg["content"]["data"])

def on_comm_data(data: CommData) -> None:
    """
    Should process the vega data and send a message back with the updated data.
    """

    print(data)

altair.renderers.register("vega-ibis", vega_ibis_renderer)
altair.data_transformers.register("vega-ibis", vega_ibis_transformation)
