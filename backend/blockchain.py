from web3 import Web3
from eth_account import Account
import json
import os
import hashlib

# Load ABI — copy from artifacts/contracts/CertChain.sol/CertChain.json after `npx hardhat compile`
ABI_PATH = os.path.join(os.path.dirname(__file__), "CertChain_ABI.json")
with open(ABI_PATH) as f:
    CONTRACT_ABI = json.load(f)

w3 = Web3(Web3.HTTPProvider(os.getenv("SEPOLIA_RPC_URL", "")))
account = Account.from_key(os.getenv("PRIVATE_KEY", "0x" + "0" * 64))
contract = w3.eth.contract(
    address=os.getenv("CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000"),
    abi=CONTRACT_ABI
)


def generate_credential_hash(
    holder_name: str,
    course_title: str,
    issuer_name: str,
    issued_at: str
) -> str:
    """
    Deterministic SHA-256 hash from credential content fields.
    Returns hex string prefixed with 0x.
    """
    content = f"{holder_name}::{course_title}::{issuer_name}::{issued_at}"
    return "0x" + hashlib.sha256(content.encode()).hexdigest()


def issue_on_chain(credential_hash: str, metadata_uri: str) -> str:
    """
    Sends a signed transaction to issue the credential on Sepolia.
    Returns the transaction hash as a hex string.
    Blocks until the transaction is mined (~15 seconds on Sepolia).
    """
    hash_bytes = bytes.fromhex(credential_hash[2:])  # strip 0x prefix

    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price

    txn = contract.functions.issueCredential(
        hash_bytes,
        metadata_uri
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 200000,
        "gasPrice": gas_price,
    })

    signed = account.sign_transaction(txn)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        raise Exception("Transaction failed on-chain")

    return tx_hash.hex()


def verify_on_chain(credential_hash: str) -> dict:
    """
    Pure read call — no gas, instant.
    Returns verification result directly from the blockchain.
    """
    hash_bytes = bytes.fromhex(credential_hash[2:])

    valid, revoked, issuer, timestamp, metadata_uri = contract.functions.verifyCredential(
        hash_bytes
    ).call()

    return {
        "valid": valid,
        "revoked": revoked,
        "issuer_address": issuer,
        "timestamp": timestamp,
        "metadata_uri": metadata_uri,
        "etherscan_url": f"https://sepolia.etherscan.io/address/{os.getenv('CONTRACT_ADDRESS', '')}"
    }


def revoke_on_chain(credential_hash: str) -> str:
    """
    Revoke a credential on-chain.
    Only works if the calling wallet is the original issuer.
    Returns the transaction hash.
    """
    hash_bytes = bytes.fromhex(credential_hash[2:])
    nonce = w3.eth.get_transaction_count(account.address)

    txn = contract.functions.revokeCredential(hash_bytes).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 100000,
        "gasPrice": w3.eth.gas_price,
    })

    signed = account.sign_transaction(txn)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex()
