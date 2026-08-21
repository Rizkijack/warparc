// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal mock of LayerZero EndpointV2 for LOCAL testing only.
/// It satisfies the OFT constructor (setDelegate) so the OFT can deploy on a
/// bare Hardhat node. It does NOT perform real cross-chain messaging, and the
/// OFT's quote()/send() cross-chain paths are NOT exercised by this mock.
/// The frontend OFT_ABI encoding is validated via the view/state functions.
contract MockEndpoint {
    uint32 public immutable eid;
    address public delegate;

    constructor(uint32 _eid) {
        eid = _eid;
    }

    // Called by OFT/OAppCore constructor
    function setDelegate(address _delegate) external {
        delegate = _delegate;
    }

    // NOTE: this signature does NOT match ILayerZeroEndpointV2.quote(MessagingParams, address).
    // Any real cross-chain quote/send attempt routed through this mock WILL revert at ABI
    // decode — by design, only the view/state functions are asserted by local-test.js.
    function quote(bytes calldata, bytes calldata, address, address)
        external
        pure
        returns (uint256, uint256)
    {
        return (0, 0);
    }
}
