from traitlets import Instance, default
from traitlets.config import Configurable

from .session import BaseOmniSciSessionManager, OmniSciSessionManager


class OmniSciConfig(Configurable):
    """
    Allows configuration of access to OmniSci.
    """

    omnisci_session_manager = Instance(
        BaseOmniSciSessionManager,
        config=True,
        help="A manager instance that knows how to get data for an active OmniSci session",
    )

    @default("omnisci_session_manager")
    def _default_omnisci_session_manager(self):
        """
        Default to session in an ephemeral file, others as environment variables.
        """
        return OmniSciSessionManager(config=self.config)
