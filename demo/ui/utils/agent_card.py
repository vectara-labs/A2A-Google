import requests
from common.types import AgentCard
from utils.wallet import get_balance

def get_agent_card(remote_agent_address: str) -> AgentCard:
  """Get the agent card."""
  response = requests.get(
      f"http://{remote_agent_address}/.well-known/agent.json"
  )
  if response.status_code == 200:
    print(response.json())
    agent_data = response.json()
    agent_data['walletBalance'] = get_balance(agent_data['walletAddress'])
    return AgentCard(**agent_data)
  return None
