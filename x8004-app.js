/**
 * BASE8004 Token Mint
 */

(function () {
  // Configuration
  const CONFIG = {
    USDC_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    TOKEN_ADDRESS: "0x20f4c2f4113360bec894825a070e24175ee4ecb8",
    CHAIN_ID: 8453, // Base Mainnet
    RPC_URL:
      "https://rpc.ankr.com/base/68021733c8afbc5b36c633174d7f7d891178f30738f94fe93c3ae8a9a78182c1",
    MINT_RATIO: 8004,
  };

  let provider, signer, userAddress;
  let usdcContract, tokenContract;
  let isApproved = false;

  // DOM Elements
  const elements = {
    connectButton: document.getElementById("connectButton"),
    approveBtn: document.getElementById("approveBtn"),
    mintBtn: document.getElementById("mintBtn"),
    approveText: document.getElementById("approveText"),
    mintText: document.getElementById("mintText"),
    walletAddress: document.getElementById("walletAddress"),
    usdtBalance: document.getElementById("usdtBalance"),
    tokenBalance: document.getElementById("tokenBalance"),
    mintSection: document.getElementById("mintSection"),
    message: document.getElementById("message"),
  };

  // Utility Functions
  function showMessage(text, type) {
    if (elements.message) {
      elements.message.innerHTML = text;
      elements.message.className = type;
      elements.message.classList.add("show");

      if (type === "success" || type === "info") {
        setTimeout(() => {
          elements.message.style.display = "none";
        }, 5000);
      }
    }
  }

  function showLoading(btnId, text) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="loading"></span>${text}`;
    }
  }

  function hideLoading(btnId, text) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = text;
    }
  }

  function shortAddress(addr) {
    return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "Not Connected";
  }

  // Connect Wallet
  async function connectWallet() {
    try {
      if (typeof window.ethereum === "undefined") {
        showMessage("Please install MetaMask wallet", "error");
        return;
      }

      showLoading("connectButton", "Connecting...");

      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      // Check network
      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
        showMessage("Please switch to Base Mainnet", "error");
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }], // Base Mainnet (8453)
          });
        } catch (switchError) {
          // If chain doesn't exist, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x2105",
                    chainName: "Base",
                    nativeCurrency: {
                      name: "Ethereum",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: [CONFIG.RPC_URL],
                    blockExplorerUrls: ["https://basescan.org"],
                  },
                ],
              });
            } catch (addError) {
              hideLoading("connectButton", "Connect Wallet");
              showMessage("Failed to add Base network", "error");
              return;
            }
          } else {
            hideLoading("connectButton", "Connect Wallet");
            return;
          }
        }
      }

      // Initialize ethers
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      userAddress = accounts[0];

      // Initialize contracts
      usdcContract = new ethers.Contract(
        CONFIG.USDC_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
          "function approve(address,uint256) returns (bool)",
          "function allowance(address,address) view returns (uint256)",
        ],
        signer
      );

      tokenContract = new ethers.Contract(
        CONFIG.TOKEN_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
          "function name() view returns (string)",
          "function symbol() view returns (string)",
        ],
        provider
      );

      // No forwarder contract needed as we're not using a relayer

      // Update UI
      if (elements.walletAddress) {
        elements.walletAddress.textContent = shortAddress(userAddress);
      }
      if (elements.connectButton) {
        elements.connectButton.innerHTML = `<span class="btn-text">${shortAddress(
          userAddress
        )}</span>`;
      }
      if (elements.mintSection) {
        elements.mintSection.style.display = "block";
      }

      // Load balances
      await loadBalances();

      // Check approval status
      await checkApproval();

      showMessage("Wallet connected successfully!", "success");
    } catch (error) {
      console.error(error);
      showMessage("Connection failed: " + error.message, "error");
      hideLoading("connectButton", "Connect Wallet");
    }
  }

  // Load balances
  async function loadBalances() {
    try {
      const usdtBalance = await usdcContract.balanceOf(userAddress);
      const tokenBalance = await tokenContract.balanceOf(userAddress);

      if (elements.usdtBalance) {
        elements.usdtBalance.textContent =
          parseFloat(ethers.utils.formatUnits(usdtBalance, 6)).toFixed(2) +
          " USDC";
      }

      if (elements.tokenBalance) {
        elements.tokenBalance.textContent =
          parseFloat(ethers.utils.formatEther(tokenBalance)).toLocaleString() +
          " BASE8004";
      }
    } catch (error) {
      console.error("Failed to load balances:", error);
    }
  }

  // Check approval
  async function checkApproval() {
    try {
      const allowance = await usdcContract.allowance(
        userAddress,
        CONFIG.TOKEN_ADDRESS
      );
      const requiredAmount = ethers.utils.parseUnits("1", 6); // USDC has 6 decimals on Base

      if (allowance.gte(requiredAmount)) {
        isApproved = true;
        if (elements.approveBtn) elements.approveBtn.disabled = true;
        if (elements.approveText)
          elements.approveText.textContent = "✓ Approved";
        if (elements.mintBtn) elements.mintBtn.disabled = false;
      } else {
        isApproved = false;
        if (elements.approveBtn) elements.approveBtn.disabled = false;
        if (elements.approveText)
          elements.approveText.textContent = "Step 1: Approve USDC";
        if (elements.mintBtn) elements.mintBtn.disabled = true;
      }
    } catch (error) {
      console.error("Failed to check approval:", error);
    }
  }

  // Approve USDC
  window.approveUSDC = async function () {
    try {
      showLoading("approveBtn", "Approving...");
      showMessage("Please confirm approval in your wallet...", "info");

      // Approve 10 USDC for multiple mints (USDC has 6 decimals on Base)
      const approveAmount = ethers.utils.parseUnits("10", 6);
      const tx = await usdcContract.approve(
        CONFIG.TOKEN_ADDRESS,
        approveAmount
      );

      showMessage(
        "Approval transaction submitted, waiting for confirmation...",
        "info"
      );
      await tx.wait();

      isApproved = true;
      if (elements.approveBtn) elements.approveBtn.disabled = true;
      if (elements.approveText) elements.approveText.textContent = "✓ Approved";
      if (elements.mintBtn) elements.mintBtn.disabled = false;

      showMessage(
        "USDC approved successfully! (10 USDC = 10 mints)",
        "success"
      );
    } catch (error) {
      console.error(error);
      if (error.code === 4001) {
        showMessage("User cancelled approval", "error");
      } else {
        showMessage("Approval failed: " + error.message, "error");
      }
      hideLoading("approveBtn", "Step 1: Approve USDC");
    }
  };

  // Mint tokens
  window.mintTokens = async function () {
    try {
      console.log("🚀 Starting mint process...");

      if (!isApproved) {
        showMessage("Please approve USDC first", "error");
        return;
      }

      showLoading("mintBtn", "Minting...");
      showMessage("Preparing to mint tokens...", "info");

      console.log("📝 Config:", {
        TOKEN_ADDRESS: CONFIG.TOKEN_ADDRESS,
      });

      // Direct minting without relayer
      try {
        showMessage("Please confirm mint transaction in your wallet...", "info");
        
        // Call mint function directly on the token contract
        const tx = await tokenContract.connect(signer).mint({
          gasLimit: 300000
        });
        
        showMessage("Mint transaction submitted, waiting for confirmation...", "info");
        const receipt = await tx.wait();
        
        const txLink = `https://basescan.org/tx/${receipt.transactionHash}`;
        showMessage(
          `<strong>Mint Successful!</strong><br>
                    +8004 BASE8004 Tokens<br>
                    <a href="${txLink}" target="_blank" style="color: var(--primary); text-decoration: underline;">View Transaction</a>`,
          "success"
        );

        // Refresh balances after a few seconds
        setTimeout(async () => {
          await loadBalances();
          await checkApproval();
        }, 3000);
      } catch (error) {
        throw error;
      }

      hideLoading("mintBtn", "Step 2: Mint (Gasless)");
    } catch (error) {
      console.error("❌ Mint error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      if (error.code === 4001) {
        showMessage("User cancelled signature", "error");
      } else if (error.message) {
        showMessage("Mint failed: " + error.message, "error");
      } else {
        showMessage(
          "Mint failed. Please check console (F12) for details.",
          "error"
        );
      }
      hideLoading("mintBtn", "Step 2: Mint (Gasless)");
    }
  };

  // Event Listeners
  document.addEventListener("DOMContentLoaded", () => {
    if (elements.connectButton) {
      elements.connectButton.addEventListener("click", connectWallet);
    }

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        location.reload();
      });

      window.ethereum.on("chainChanged", () => {
        location.reload();
      });
    }
  });
})();
