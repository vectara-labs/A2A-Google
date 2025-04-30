import mesop as me
from state.state import AppState
from state.host_agent_service import UpdateAppState, UpdateWalletBalances, ListRemoteAgents
from state.agent_state import AgentState

@me.content_component
def polling_buttons():
    """Polling buttons component"""
    state = me.state(AppState)
    with me.box(
        style=me.Style(
            display="flex",
            justify_content="end",
        )
    ):
      me.button_toggle(
          value=[str(state.polling_interval)],
        buttons=[
          me.ButtonToggleButton(label="1s", value="1"),
          me.ButtonToggleButton(label="5s", value="5"),
          me.ButtonToggleButton(label="30s", value="30"),
          me.ButtonToggleButton(label="Disable", value="0")
        ],
        multiple=False,
        hide_selection_indicator=True,
        disabled=False,
        on_change=on_change,
        style=me.Style(
            margin=me.Margin(bottom=20),

        ),
      )
      with me.content_button(
        type="raised",
        on_click=force_refresh,
      ):
        me.icon("refresh")
    me.slot()

def on_change(e: me.ButtonToggleChangeEvent):
  state = me.state(AppState)
  state.polling_interval = int(e.value)

async def force_refresh(e: me.ClickEvent):
    """Refresh app state event handler"""
    yield
    app_state = me.state(AppState)
    agent_state = me.state(AgentState)
    # Update wallet balances first
    # await UpdateWalletBalances(agent_state)
    
    # Then refresh the entire app state
    await UpdateAppState(app_state, app_state.current_conversation_id)
    yield

