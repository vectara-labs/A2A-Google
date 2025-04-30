import mesop as me

class AgentWallet:
    address: str
    balance: float
@me.stateclass
class AgentState:
  """Agents List State"""
  agent_dialog_open: bool = False
  agent_address: str = ""
  agent_name: str = ""
  agent_description: str = ""
  input_modes: list[str]
  output_modes: list[str]
  stream_supported: bool = False
  push_notifications_supported: bool = False
  error: str = ""
  agent_framework_type: str = ""
  wallet_address: str | None = None
  wallet_balance: float | None = None

