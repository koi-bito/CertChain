// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertChain {

    struct Credential {
        address issuer;
        uint256 timestamp;
        string metadataURI;   // IPFS or backend URL with name, course, etc.
        bool exists;
        bool revoked;
    }

    // hash -> Credential
    mapping(bytes32 => Credential) public credentials;

    // issuer address -> list of hashes they issued
    mapping(address => bytes32[]) public issuerCredentials;

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed issuer,
        uint256 timestamp,
        string metadataURI
    );

    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed issuer
    );

    // Issue a new credential
    function issueCredential(
        bytes32 credentialHash,
        string calldata metadataURI
    ) external {
        require(!credentials[credentialHash].exists, "Credential already exists");

        credentials[credentialHash] = Credential({
            issuer: msg.sender,
            timestamp: block.timestamp,
            metadataURI: metadataURI,
            exists: true,
            revoked: false
        });

        issuerCredentials[msg.sender].push(credentialHash);

        emit CredentialIssued(credentialHash, msg.sender, block.timestamp, metadataURI);
    }

    // Verify - returns all info, free (read-only)
    function verifyCredential(bytes32 credentialHash)
        external
        view
        returns (
            bool valid,
            bool revoked,
            address issuer,
            uint256 timestamp,
            string memory metadataURI
        )
    {
        Credential memory cred = credentials[credentialHash];
        return (
            cred.exists,
            cred.revoked,
            cred.issuer,
            cred.timestamp,
            cred.metadataURI
        );
    }

    // Revoke - only original issuer can revoke
    function revokeCredential(bytes32 credentialHash) external {
        require(credentials[credentialHash].exists, "Credential does not exist");
        require(credentials[credentialHash].issuer == msg.sender, "Not the issuer");
        require(!credentials[credentialHash].revoked, "Already revoked");

        credentials[credentialHash].revoked = true;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    // Get all credentials issued by an address
    function getIssuerCredentials(address issuer)
        external
        view
        returns (bytes32[] memory)
    {
        return issuerCredentials[issuer];
    }
}
