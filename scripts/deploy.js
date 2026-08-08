const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CertChain with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const CertChain = await ethers.getContractFactory("CertChain");
  console.log("\nDeploying CertChain...");
  const certChain = await CertChain.deploy();
  await certChain.waitForDeployment();

  const address = await certChain.getAddress();
  console.log(`\n✅ CertChain deployed to: ${address}`);
  console.log(`🔍 Verify on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  console.log(`\nAdd to your .env file:`);
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
