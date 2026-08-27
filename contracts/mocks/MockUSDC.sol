// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal ERC20 used solely by scripts/local-test.js to instantiate
///         BridgeAdapter (which needs an innerToken).
/// @dev WARNING: test-only, never deploy to live/testnet. Mint is
///      restricted to deployer to prevent open minting if ever mis-deployed.
contract MockUSDC {
	string public name = "MockUSDC";
	string public symbol = "USDC";
	uint8 public constant decimals = 6;
	uint256 public totalSupply;
	mapping(address => uint256) public balanceOf;
	mapping(address => mapping(address => uint256)) public allowance;
	address public immutable deployer;

	constructor() {
		deployer = msg.sender;
	}

	function mint(address to, uint256 amount) external {
		require(msg.sender == deployer, "MockUSDC: only deployer can mint");
		balanceOf[to] += amount;
		totalSupply += amount;
	}

	function approve(address spender, uint256 amount) external returns (bool) {
		allowance[msg.sender][spender] = amount;
		return true;
	}

	function transfer(address to, uint256 amount) external returns (bool) {
		balanceOf[msg.sender] -= amount;
		balanceOf[to] += amount;
		return true;
	}

	function transferFrom(address from, address to, uint256 amount) external returns (bool) {
		allowance[from][msg.sender] -= amount;
		balanceOf[from] -= amount;
		balanceOf[to] += amount;
		return true;
	}
}
