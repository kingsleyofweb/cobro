// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILimitOrderReactor {
    struct SignedOrder {
        bytes order;
        bytes signature;
    }

    /// @notice Executes a single signed limit order
    function execute(SignedOrder calldata order) external payable;

    /// @notice Executes a batch of signed limit orders atomically
    function executeBatch(SignedOrder[] calldata orders) external payable;
}
