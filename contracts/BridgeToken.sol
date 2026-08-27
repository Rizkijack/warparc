// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";

/// @title BridgeToken (revived legacy ABT)
/// @notice Burn-and-mint OFT wrapper for the ABT demo token. Pause + owner
///         inheritance mirrors BridgeAdapter. No daily cap (ABT is a demo).
///         When paused, both _debit and _credit revert via whenNotPaused —
///         inbound payloads become retryable on EndpointV2 and must be
///         retried/cleared after unpause (same as BridgeAdapter).
contract BridgeToken is OFT, Pausable {
    error ZeroAddress();
    error NameInvalid();
    error SymbolInvalid();

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) {
        if (_lzEndpoint == address(0)) revert ZeroAddress();
        if (_delegate == address(0)) revert ZeroAddress();
        if (bytes(_name).length == 0 || bytes(_name).length > 32) revert NameInvalid();
        if (bytes(_symbol).length == 0 || bytes(_symbol).length > 16) revert SymbolInvalid();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
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
