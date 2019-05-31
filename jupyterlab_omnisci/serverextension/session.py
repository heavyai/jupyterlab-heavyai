import os

from traitlets.config import Configurable
from traitlets import Unicode


class BaseOmniSciSessionManager(Configurable):
    """
    A class managing getting session data for a connection
    to an OmniSci backend.
    """

    def get_session(self):
        return {}


class OmniSciSessionManager(BaseOmniSciSessionManager):
    """
    An OmniSci session manager that gets the session ID from an ephemeral file,
    and gets the rest of the connection data from environment variables.

    The static file should be plain text with nothing but a valid session ID.
    """
    session_file = Unicode(
        help="The path on disk to look for a session file",
        config=True,
    )
    protocol = Unicode(
        default_value="OMNISCI_PROTOCOL",
        help="The environment variable for the protocol of the OmniSci server",
        config=True,
    )
    host = Unicode(
        default_value="OMNISCI_HOST",
        help="The environment variable for the host of the OmniSci server",
        config=True,
    )
    port = Unicode(
        default_value="OMNISCI_PORT",
        help="The environment variable for the port of the OmniSci server",
        config=True,
    )

    def get_session(self):
        if not os.path.exists(self.session_file):
            session = ''
        else:
            try:
                with open(self.session_file) as f:
                    session = f.read().strip()
            except:
                session = ''
        port = os.environ.get('OMNISCI_PORT', '')
        host = os.environ.get('OMNISCI_HOST', '')
        protocol = os.environ.get('OMNISCI_PROTOCOL', '')
        data = {
            'session': session,
            'connection': {
                'host': host,
                'port': port,
                'protocol': protocol,
            }
        }
        return data
