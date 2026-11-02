// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";
import "./interfaces/ILimitOrderReactor.sol";
import "./interfaces/IPermit2.sol";

/**
 * @title CobroInvoiceRouter
 * @notice Facilitates 1-click atomic invoice payments on Celo using Textile FX (UniswapX LimitOrderReactor).
 * @dev The client pays with USDT/USDC, Textile swaps to cNGN via LimitOrderReactor,
 *      and the exact cNGN is immediately transferred to the freelancer in the same transaction.
 */
contract CobroInvoiceRouter {
    address public immutable reactor;
    IPermit2 public immutable permit2;
    address public owner;

    event InvoiceSettled(
        bytes32 indexed invoiceId,
        address indexed client,
        address indexed freelancer,
        address inputToken,
        uint256 inputAmountSpent,
        address outputToken,
        uint256 outputAmountDelivered
    );

    error IncompleteSettlement(uint256 received, uint256 expected);
    error ExecutionFailed();

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    constructor(address _reactor, address _permit2) {
        reactor = _reactor;
        permit2 = IPermit2(_permit2);
        owner = msg.sender;
    }

    /**
     * @notice Settles an invoice atomically using Textile's returned swap calldata.
     * @param invoiceId Unique identifier for the Cobro invoice.
     * @param freelancer Address of the freelancer receiving the settlement currency (e.g. cNGN).
     * @param sellToken Address of client's token being sold (e.g. USDT).
     * @param maxSellAmount Maximum amount of sellToken the client is willing to pay.
     * @param buyToken Address of the token the freelancer requested (e.g. cNGN).
     * @param exactBuyAmount Exact invoice amount that must be delivered to the freelancer.
     * @param textileSwapCalldata The exact raw calldata returned by Textile's RFQ API (`transactions.swap.data`).
     */
    function payInvoiceWithTextileSwap(
        bytes32 invoiceId,
        address freelancer,
        address sellToken,
        uint256 maxSellAmount,
        address buyToken,
        uint256 exactBuyAmount,
        bytes calldata textileSwapCalldata
    ) external returns (bool) {
        require(freelancer != address(0), "Invalid freelancer");

        // 1. Pull the maxSellAmount from client to this contract
        uint256 initialSellBal = IERC20(sellToken).balanceOf(address(this));
        IERC20(sellToken).transferFrom(msg.sender, address(this), maxSellAmount);

        // 2. Approve Permit2 / Reactor to pull the sell token for execution
        IERC20(sellToken).approve(address(permit2), maxSellAmount);
        permit2.approve(sellToken, reactor, uint160(maxSellAmount), uint48(block.timestamp + 120));

        // Track buyToken balance before swap
        uint256 buyBalBefore = IERC20(buyToken).balanceOf(address(this));

        // 3. Execute the Textile UniswapX LimitOrderReactor swap
        (bool success, bytes memory returnData) = reactor.call(textileSwapCalldata);
        if (!success) {
            revert ExecutionFailed();
        }

        // 4. Verify exact output received
        uint256 buyBalAfter = IERC20(buyToken).balanceOf(address(this));
        uint256 receivedBuyToken = buyBalAfter - buyBalBefore;
        if (receivedBuyToken < exactBuyAmount) {
            revert IncompleteSettlement(receivedBuyToken, exactBuyAmount);
        }

        // 5. Transfer exact output token to the freelancer
        IERC20(buyToken).transfer(freelancer, exactBuyAmount);

        // 6. Refund any unused sell tokens back to the client
        uint256 remainingSellBal = IERC20(sellToken).balanceOf(address(this)) - initialSellBal;
        if (remainingSellBal > 0) {
            IERC20(sellToken).transfer(msg.sender, remainingSellBal);
        }

        uint256 actualSellSpent = maxSellAmount - remainingSellBal;

        emit InvoiceSettled(
            invoiceId,
            msg.sender,
            freelancer,
            sellToken,
            actualSellSpent,
            buyToken,
            exactBuyAmount
        );

        return true;
    }

    /**
     * @notice Emergency withdrawal for any stuck tokens (safety measure).
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
