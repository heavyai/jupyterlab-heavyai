import json
import os

from traitlets.config import Configurable
from traitlets import Unicode


class BaseHeavyAISessionManager(Configurable):
    """
    A class managing getting session data for a connection
    to an HeavyAI backend.

    The base implementation returns empty data.
    """

    def get_session(self):
        return {}


class HeavyAISessionManager(BaseHeavyAISessionManager):
    """
    An HeavyAI session manager that gets the session ID from an ephemeral file,
    and gets the rest of the connection data from environment variables.

    The static file should be plain text with nothing but a valid session ID.
    """

    session_file = Unicode(
        help="The path on disk to look for a session file", config=True
    )
    protocol = Unicode(
        default_value="HEAVYAI_PROTOCOL",
        help="The environment variable for the protocol of the HeavyAI server",
        config=True,
    )
    host = Unicode(
        default_value="HEAVYAI_HOST",
        help="The environment variable for the host of the HeavyAI server",
        config=True,
    )
    port = Unicode(
        default_value="HEAVYAI_PORT",
        help="The environment variable for the port of the HeavyAI server",
        config=True,
    )

    def get_session(self):
        """
        Get session data for an HeavyAI session.

        This gets server location information from environment variables,
        and a session ID from the configurable session_file.
        """
        try:
            with open(self.session_file) as f:
                data = json.loads(f.read())
        except FileNotFoundError:
            data = {}
        out = {
            "session": data.get("session", ""),
            "connection": {
                "protocol": os.environ.get(self.protocol, ""),
                "host": os.environ.get(self.host, ""),
                "port": os.environ.get(self.port, ""),
            },
            "environment": {
                "protocol": self.protocol,
                "host": self.host,
                "port": self.port,
            },
            "query": data.get("query", ""),
        }
        return out
