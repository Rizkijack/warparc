// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";


/// @title BridgeAdapter (revived with hard guards)
/// @notice OFTAdapter wrapping an existing ERC20 (canonical USDC) with real
///         on-chain circuit-breakers. Pause/owner come from OAppCore parent
///         (Ownable) + Pausable mixed in here.
///
/// Circuit-breakers:
///   1. pause() — owner-only emergency brake; applies to all debits/credits.
///   2. allowedEid — per-EID allowlist; _debit/_credit revert on foreign EID.
///   3. Daily USDC cap (6-decimals subunits) — sliding 24h window reset on
///      first outbound debit past the window boundary (no off-chain cron).
///
/// setPeer is inherited from OAppCore (onlyOwner). Constructor refuses
/// zero endpoint/delegate so a half-configured deploy cannot reach mainnet.
contract BridgeAdapter is OFTAdapter, Pausable {
    // ----- EID allowlist (circuit-breaker #1) -----
    mapping(uint32 eid => bool allowed) public allowedEid;
    event EidAllowlistUpdated(uint32 indexed eid, bool allowed);

    // ----- Daily volume cap (circuit-breaker #2) -----
    /// @dev 6-decimal USDC subunits; cap == 0 means no cap.
    uint256 public dailyCap;
    uint256 public dailySpent;
    uint256 public dayStartUtc;
    event DailyCapUpdated(uint256 oldCap, uint256 newCap);
    event DailyWindowRolled(uint256 newDayStartUtc);

    error ZeroAddress();
    error EidNotAllowed(uint32 eid);
    error DailyCapExceeded(uint256 requested, uint256 remaining);
    error ZeroCap();

    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) {
        if (_lzEndpoint == address(0)) revert ZeroAddress();
        if (_delegate == address(0)) revert ZeroAddress();
        // OFTAdapter (via OAppCore) already called endpoint.setDelegate(_delegate)
        // and Ownable(_delegate) — no need to repeat the transfer.
        dayStartUtc = block.timestamp;
    }

    // ----- Owner-only EID allowlist -----
    function setEidAllowed(uint32 _eid, bool _allowed) external onlyOwner {
        allowedEid[_eid] = _allowed;
        emit EidAllowlistUpdated(_eid, _allowed);
    }

    // ----- Owner-only daily cap -----
    function setDailyCap(uint256 _newCap) external onlyOwner {
        if (_newCap == 0) revert ZeroCap();
        uint256 old = dailyCap;
        dailyCap = _newCap;
        emit DailyCapUpdated(old, _newCap);
    }

    function rollDailyWindow() external onlyOwner {
        dayStartUtc = block.timestamp;
        dailySpent = 0;
        emit DailyWindowRolled(dayStartUtc);
    }

    // ----- Emergency brake -----
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }


    // ----- Hooks applied to every cross-chain send/receive -----
    /// @dev OFTAdapter._debit is `internal virtual`; we override to add the
    ///      pause + EID + daily-cap guards before the underlying escrow
    ///      transfer happens.
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override whenNotPaused returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        if (!allowedEid[_dstEid]) revert EidNotAllowed(_dstEid);
        if (block.timestamp >= dayStartUtc + 1 days) {
            dayStartUtc = block.timestamp;
            dailySpent = 0;
            emit DailyWindowRolled(dayStartUtc);
        }
        if (dailyCap != 0) {
            uint256 remaining = dailyCap > dailySpent ? dailyCap - dailySpent : 0;
            if (_amountLD > remaining) revert DailyCapExceeded(_amountLD, remaining);
            dailySpent += _amountLD;
        }
        return OFTAdapter._debit(_from, _amountLD, _minAmountLD, _dstEid);
    }

    /// @dev Reflective guard on the receive side too — if a destination OFT
    ///      is paused, no inbound credits will run.
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override whenNotPaused returns (uint256 amountReceivedLD) {
        return OFTAdapter._credit(_to, _amountLD, _srcEid);
    }
}
