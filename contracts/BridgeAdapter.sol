// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { OFTAdapter } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";

/// @title BridgeAdapter (revived with hard guards)
/// @notice OFTAdapter wrapping an existing ERC20 (canonical USDC) with real
///         on-chain circuit-breakers. Pause/owner come from OAppCore parent
///         (Ownable) + Pausable mixed in here.
///
/// Circuit-breakers:
///   1. pause() — owner-only emergency brake; applies to all debits/credits.
///      When paused, outbound _debit reverts. Inbound _credit also reverts
///      via whenNotPaused — LayerZero stores the payload as retryable.
///      Operators MUST call EndpointV2 retry/clear after unpause to release
///      stuck inbound messages (see DEPLOY.md Appendix A).
///   2. allowedEid — per-EID allowlist; _debit checks _dstEid and _credit
///      checks _srcEid. Initially empty (no EID allowed) — owner must call
///      setEidAllowed for each peer before traffic flows.
///   3. Daily USDC cap (6-decimals subunits) — sliding 24h window reset on
///      first outbound debit past the window boundary (no off-chain cron).
///      dailyCap == 0 means no cap. Use setDailyCap(0) to disable.
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
    /// @notice Set daily cap in 6-decimal subunits. 0 disables cap and
    ///         returns to unlimited mode. Emits DailyCapUpdated.
    function setDailyCap(uint256 _newCap) external onlyOwner {
        uint256 old = dailyCap;
        dailyCap = _newCap;
        emit DailyCapUpdated(old, _newCap);
    }

    /// @notice Owner-only manual window roll. Resets spent to 0 and
    ///         anchors new window to current block.timestamp. Use only
    ///         for emergency cap bypass — prefer automatic roll on next
    ///         _debit after 24h (see _debit). Emits DailyWindowRolled.
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
    ///      transfer happens. Daily cap accounting uses the actual
    ///      amountSentLD returned by OFTAdapter to avoid dust/rounding drift.
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
        }
        (amountSentLD, amountReceivedLD) = OFTAdapter._debit(_from, _amountLD, _minAmountLD, _dstEid);
        if (dailyCap != 0) {
            // use actual amountSentLD rather than requested _amountLD
            dailySpent += amountSentLD;
        }
        return (amountSentLD, amountReceivedLD);
    }

    /// @dev Inbound guard — paused check blocks _credit via whenNotPaused
    ///      (payload becomes retryable on EndpointV2, not lost) + EID
    ///      allowlist rejects unknown srcEid even if setPeer was mis-set.
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override whenNotPaused returns (uint256 amountReceivedLD) {
        if (!allowedEid[_srcEid]) revert EidNotAllowed(_srcEid);
        return OFTAdapter._credit(_to, _amountLD, _srcEid);
    }
}
