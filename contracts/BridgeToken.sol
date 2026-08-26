// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";

/// @title BridgeToken (revived legacy ABT)
/// @notice Burn-and-mint OFT wrapper for the ABT demo token. Pause + owner
///         inheritance mirrors BridgeAdapter. No daily cap (ABT is a demo).
contract BridgeToken is OFT, Pausable {
    error ZeroAddress();

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) {
        if (_lzEndpoint == address(0)) revert ZeroAddress();
        if (_delegate == address(0)) revert ZeroAddress();
        if (bytes(_name).length == 0 || bytes(_name).length > 32) revert("BridgeToken: name invalid");
        if (bytes(_symbol).length == 0 || bytes(_symbol).length > 16) revert("BridgeToken: symbol invalid");
    }

    function pause() external {
        require(msg.sender == owner(), "BridgeToken: not owner");
        _pause();
    }

    function unpause() external {
        require(msg.sender == owner(), "BridgeToken: not owner");
        _unpause();
    }

    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override whenNotPaused returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        return OFT._debit(_from, _amountLD, _minAmountLD, _dstEid);
    }

    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override whenNotPaused returns (uint256 amountReceivedLD) {
        return OFT._credit(_to, _amountLD, _srcEid);
    }
}
