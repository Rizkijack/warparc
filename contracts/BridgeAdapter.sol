// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";

contract BridgeAdapter is OFTAdapter {
	constructor(
		address _token,
		address _lzEndpoint,
		address _delegate
	) OFTAdapter(_token, _lzEndpoint, _delegate) {}
}
