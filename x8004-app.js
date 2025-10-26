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

  // Improved error handler
  function handleContractError(error, operation) {
    console.error(`${operation} failed:`, error);
    
    // Handle common error cases
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return "Transaction would fail. Check if you have sufficient USDC approved or if the contract is working correctly.";
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return "Insufficient funds for gas. Please check your ETH balance.";
    }
    
    if (error.message && error.message.includes('revert')) {
      return "Transaction reverted by contract. This may be due to incorrect parameters or contract state.";
    }
    
    if (error.message) {
      return error.message;
    }
    
    return "Unknown error occurred. Check console for details.";
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
      let accounts;
      try {
        accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
      } catch (accountError) {
        console.error("Account request failed:", accountError);
        hideLoading("connectButton", "Connect Wallet");
        showMessage("Wallet connection cancelled by user", "error");
        return;
      }

      // Check network
      let chainId;
      try {
        chainId = await window.ethereum.request({
          method: "eth_chainId",
        });
      } catch (chainError) {
        console.error("Chain ID request failed:", chainError);
        hideLoading("connectButton", "Connect Wallet");
        showMessage("Failed to get network information", "error");
        return;
      }

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
          // Mint functions with specific signature
          "function mint() external returns (bool)", // 0x1249c58b
          // Other possible mint functions
          "function mint(address to, uint256 amount) external returns (bool)",
          "function mint(uint256 amount) external returns (bool)",
          // Purchase functions
          "function purchase(address to, uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function purchase(address to, uint256 amountOut) external returns (bool)",
          "function purchase(uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function purchase(uint256 amountOut) external returns (bool)",
          // Buy functions
          "function buy(address to, uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function buy(address to, uint256 amountOut) external returns (bool)",
          "function buy(uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function buy(uint256 amountOut) external returns (bool)",
          // Exchange functions
          "function exchange(address to, uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function exchange(address to, uint256 amountOut) external returns (bool)",
          "function exchange(uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function exchange(uint256 amountOut) external returns (bool)",
          // Generic functions that might be used
          "function getToken(address to, uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function getToken(address to, uint256 amountOut) external returns (bool)",
          "function getToken(uint256 amountOut, uint256 amountIn) external returns (bool)",
          "function getToken(uint256 amountOut) external returns (bool)"
        ],
        signer // Use signer for write operations
      );

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

      // Check contract functions for debugging
      await checkContractFunctions();

      showMessage("Wallet connected successfully!", "success");
    } catch (error) {
      console.error("Wallet connection error:", error);
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

  // Check contract functions
  async function checkContractFunctions() {
    try {
      console.log("🔍 Checking contract functions...");
      
      // Check if token contract has name and symbol
      try {
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        console.log("Token info:", { name, symbol });
        // Update UI to show correct token name
        if (elements.tokenBalance) {
          const currentText = elements.tokenBalance.textContent;
          if (currentText.includes("BASE8004")) {
            // This line is no longer needed as we're using the correct token name directly
          }
        }
      } catch (error) {
        console.log("Could not get token info:", error.message);
      }
      
      // Check if token contract has balanceOf
      try {
        const balance = await tokenContract.balanceOf(userAddress);
        console.log("Token balance:", ethers.utils.formatEther(balance));
      } catch (error) {
        console.log("Could not get token balance:", error.message);
      }
      
      // Try to get contract code
      try {
        const code = await provider.getCode(CONFIG.TOKEN_ADDRESS);
        console.log("Contract code length:", code.length);
        if (code === "0x") {
          console.log("⚠️  Warning: No contract code found at address");
        }
      } catch (error) {
        console.log("Could not get contract code:", error.message);
      }
      
      // Try to inspect the contract interface
      try {
        console.log("Contract functions:");
        const functions = Object.keys(tokenContract.interface.functions);
        console.log("Available functions:", functions);
        
        // Look for mint-related functions
        const mintFunctions = functions.filter(func => 
          func.includes('mint') || func.includes('purchase') || func.includes('buy') || func.includes('exchange') || func.includes('swap')
        );
        console.log("Potential mint functions:", mintFunctions);
        
        // Look for functions that might handle USDC payment
        const paymentFunctions = functions.filter(func =>
          func.includes('pay') || func.includes('transfer') || func.includes('send')
        );
        console.log("Potential payment functions:", paymentFunctions);
      } catch (error) {
        console.log("Could not inspect contract interface:", error.message);
      }
      
    } catch (error) {
      console.error("Contract check failed:", error);
    }
  }

  // New function to handle USDC payment for minting
  async function purchaseTokens() {
    try {
      console.log("🛒 Starting token purchase process...");
      
      // Amounts (updated to use 8004 tokens as per exchange ratio)
      const amountOut = ethers.utils.parseEther("8004"); // 8004 tokens with 18 decimals
      const amountIn = ethers.utils.parseUnits("1", 6);   // 1 USDC with 6 decimals
      
      console.log("Purchase parameters:", { 
        to: userAddress, 
        amountOut: amountOut.toString(),
        amountIn: amountIn.toString()
      });
      
      // Check user's USDC balance first
      const usdcBalance = await usdcContract.balanceOf(userAddress);
      console.log("User USDC balance:", ethers.utils.formatUnits(usdcBalance, 6));
      
      if (usdcBalance.lt(amountIn)) {
        throw new Error("Insufficient USDC balance. You need at least 1 USDC to mint 8004 tokens.");
      }
      
      // Check allowance
      const allowance = await usdcContract.allowance(userAddress, CONFIG.TOKEN_ADDRESS);
      console.log("USDC allowance:", ethers.utils.formatUnits(allowance, 6));
      
      if (allowance.lt(amountIn)) {
        throw new Error("Insufficient USDC allowance. Please approve USDC first.");
      }
      
      // Try to find the right function to call
      let tx;
      let purchaseSuccess = false;
      let lastError = null;
      
      // First try the specific mint function with signature 0x1249c58b (no parameters)
      console.log("Trying specific mint function (0x1249c58b)...");
      try {
        tx = await tokenContract.connect(signer).mint();
        purchaseSuccess = true;
        console.log("✅ Success with specific mint function (0x1249c58b)");
      } catch (mintError) {
        console.log("Specific mint function failed:", mintError.message);
        lastError = mintError;
      }
      
      // If that fails, try other common function names
      if (!purchaseSuccess) {
        // Common function names for purchasing tokens with USDC
        const purchaseFunctions = [
          'purchase',
          'buy',
          'mint', // Generic mint function
          'exchange',
          'swap',
          'getToken',
          'mintTokens'
        ];
        
        // Try each function with different parameter combinations
        for (const funcName of purchaseFunctions) {
          if (tokenContract.interface.functions[funcName]) {
            console.log(`Trying function: ${funcName}`);
            
            // Different parameter combinations to try
            const paramCombinations = [
              [userAddress, amountOut, amountIn],
              [userAddress, amountOut],
              [amountOut, amountIn],
              [amountOut],
              [userAddress],
              []
            ];
            
            for (const params of paramCombinations) {
              try {
                console.log(`  Trying with params:`, params);
                tx = await tokenContract.connect(signer)[funcName](...params);
                purchaseSuccess = true;
                console.log(`✅ Success with ${funcName} and params:`, params);
                break;
              } catch (paramError) {
                console.log(`    Failed with params:`, params, "Error:", paramError.message);
                lastError = paramError;
              }
            }
            
            if (purchaseSuccess) break;
          }
        }
      }
      
      // If no specific function worked, try transferring USDC and then minting
      if (!purchaseSuccess) {
        console.log("Trying USDC transfer approach...");
        try {
          // Transfer USDC to contract
          showMessage("Transferring USDC to contract...", "info");
          const transferTx = await usdcContract.transfer(CONFIG.TOKEN_ADDRESS, amountIn);
          await transferTx.wait();
          console.log("USDC transferred to contract");
          
          // Then try to mint
          showMessage("Minting tokens...", "info");
          const mintTx = await tokenContract.connect(signer).mint();
          tx = mintTx;
          purchaseSuccess = true;
          console.log("✅ Success with transfer-then-mint approach");
        } catch (transferError) {
          console.log("Transfer approach failed:", transferError.message);
          lastError = transferError;
        }
      }
      
      if (!purchaseSuccess) {
        const errorMessage = handleContractError(lastError || new Error("Could not find a working method to purchase tokens"), "Purchase");
        throw new Error(errorMessage);
      }
      
      return tx;
    } catch (error) {
      console.error("Purchase error:", error);
      throw error;
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

      console.log("USDC allowance:", allowance.toString(), "Required:", requiredAmount.toString());

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
        "USDC approved successfully! (10 USDC = 10 mints of 8004 tokens each)",
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
        userAddress: userAddress
      });

      // Purchase tokens - user pays 1 USDC to get 8004 tokens
      try {
        showMessage("Please confirm purchase transaction in your wallet...", "info");
        
        // Use the dedicated purchase function
        const tx = await purchaseTokens();
        
        showMessage("Purchase transaction submitted, waiting for confirmation...", "info");
        const receipt = await tx.wait();
        
        const txLink = `https://basescan.org/tx/${receipt.transactionHash}`;
        showMessage(
          `<strong>Purchase Successful!</strong><br>
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

      hideLoading("mintBtn", "Step 2: Mint");
    } catch (error) {
      console.error("❌ Mint error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      if (error.code === 4001) {
        showMessage("User cancelled transaction", "error");
      } else if (error.message) {
        showMessage("Purchase failed: " + error.message, "error");
      } else {
        showMessage(
          "Purchase failed. Please check console (F12) for details.",
          "error"
        );
      }
      hideLoading("mintBtn", "Step 2: Mint");
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
