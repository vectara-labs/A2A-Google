from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import os
import time

load_dotenv()

private_key_agent_1 = os.getenv("PRIVATE_KEY_AGENT_1")
private_key_agent_2 = os.getenv("PRIVATE_KEY_AGENT_2")
provider = os.getenv("PROVIDER")


class Wallet:
    def __init__(self, private_key: str, provider: str):
        self.private_key = private_key
        self.provider = provider
        self.acct = Account.from_key(private_key)
        self.address = self.acct.address
        self.w3 = Web3(Web3.HTTPProvider(self.provider))

    def get_balance(self) -> float:
        balance_wei = self.w3.eth.get_balance(self.address)
        balance_trbtc = self.w3.from_wei(balance_wei, 'ether')
        return balance_trbtc
    
    def transfer(self, to_address: str, amount_trbtc: float) -> str:
        nonce = self.w3.eth.get_transaction_count(self.address)
        gas_price = self.w3.eth.gas_price

        tx = {
            'nonce': nonce,
            'to': to_address,
            'value': self.w3.to_wei(amount_trbtc, 'ether'),
            'gas': 21000,
            'gasPrice': gas_price,
            'chainId': 31  # RSK testnet
        }

        signed_tx = self.acct.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        return self.w3.to_hex(tx_hash)
    
    def get_tx_status(self, tx_hash: str) -> str:
        print("Waiting for transaction confirmation...")
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                receipt = self.w3.eth.get_transaction_receipt(tx_hash)
                if receipt is not None:
                    return "Success" if receipt.status == 1 else "Failed"
            except:
                pass  # tx might not be mined yet
            time.sleep(3)
        return "Pending or Timeout"




def get_balance(address: str) -> float:
    w3 = Web3(Web3.HTTPProvider(provider))
    balance_wei = w3.eth.get_balance(address)
    balance_trbtc = w3.from_wei(balance_wei, 'ether')
    return balance_trbtc