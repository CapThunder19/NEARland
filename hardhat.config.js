import "@nomicfoundation/hardhat-toolbox";

// Private key removed before version control.
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

export default {
  solidity: "0.8.20",
  networks: {
    qie: {
      url: "https://rpc1mainnet.qie.digital/",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 1990
    }
  }
};
