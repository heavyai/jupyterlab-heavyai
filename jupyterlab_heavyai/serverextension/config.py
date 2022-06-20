from traitlets import Instance, default
from traitlets.config import Configurable

from .session import BaseHeavyAISessionManager, HeavyAISessionManager


class HeavyAIConfig(Configurable):
    """
    Allows configuration of access to HeavyAI.
    """

    heavyai_session_manager = Instance(
        BaseHeavyAISessionManager,
        config=True,
        help="A manager instance that knows how to get data for an active"
        " HeavyAI session",
    )

    @default("heavyai_session_manager")
    def _default_heavyai_session_manager(self):
        """
        Default to session in an ephemeral file, others as environment
        variables.
        """
        return HeavyAISessionManager(config=self.config)
