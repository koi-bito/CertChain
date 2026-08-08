const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertChain", function () {
  let certChain, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const CertChain = await ethers.getContractFactory("CertChain");
    certChain = await CertChain.deploy();
    await certChain.waitForDeployment();
  });

  it("should issue a credential", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-credential-kunal"));
    await certChain.issueCredential(hash, "https://certchain.app/meta/1");

    const [valid, revoked, issuer, timestamp, uri] =
      await certChain.verifyCredential(hash);

    expect(valid).to.equal(true);
    expect(revoked).to.equal(false);
    expect(issuer).to.equal(owner.address);
    expect(uri).to.equal("https://certchain.app/meta/1");
  });

  it("should not allow duplicate credentials", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-test"));
    await certChain.issueCredential(hash, "uri1");
    await expect(
      certChain.issueCredential(hash, "uri2")
    ).to.be.revertedWith("Credential already exists");
  });

  it("should allow issuer to revoke", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("revoke-test"));
    await certChain.issueCredential(hash, "uri");
    await certChain.revokeCredential(hash);

    const [, revoked] = await certChain.verifyCredential(hash);
    expect(revoked).to.equal(true);
  });

  it("should not allow non-issuer to revoke", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("non-issuer-test"));
    await certChain.issueCredential(hash, "uri");
    await expect(
      certChain.connect(addr1).revokeCredential(hash)
    ).to.be.revertedWith("Not the issuer");
  });

  it("should return empty array for issuer with no credentials", async function () {
    const creds = await certChain.getIssuerCredentials(addr1.address);
    expect(creds.length).to.equal(0);
  });

  it("should track multiple credentials per issuer", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("cred-1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("cred-2"));
    await certChain.issueCredential(hash1, "uri1");
    await certChain.issueCredential(hash2, "uri2");

    const creds = await certChain.getIssuerCredentials(owner.address);
    expect(creds.length).to.equal(2);
  });
});
