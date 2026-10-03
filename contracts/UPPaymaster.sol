// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

/// @title UPPaymaster
/// @notice ERC-4337 (EntryPoint v0.6) paymaster that pays the gas of user operations sent by
/// Universal Profiles on its allowlist, and of nothing else. The owner funds it by sending native
/// currency to it (forwarded to the EntryPoint deposit), manages the allowlist and the maximum cost
/// per operation, and is the only one who can withdraw.
/// @dev EXPERIMENTAL, unaudited. The constructor takes only the EntryPoint and the owner, so the
/// address through a deterministic factory is the same on every chain for a given owner. The cost
/// cap starts at 0: nothing is sponsored until the owner sets it and adds accounts.
contract UPPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;
    address public pendingOwner;
    uint256 public maxCostPerOp;
    mapping(address => bool) public sponsored;

    event Sponsored(address indexed account, bool enabled);
    event MaxCostPerOpChanged(uint256 maxCost);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotEntryPoint();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IEntryPoint entryPoint_, address owner_) {
        entryPoint = entryPoint_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @dev Called by the EntryPoint during validation. Returns validationData 1 ("rejected") for
    /// accounts not on the allowlist or operations that could cost more than maxCostPerOp. Reads
    /// only storage associated with the sender, as ERC-7562 allows for an unstaked paymaster.
    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32, uint256 maxCost)
        external
        view
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        if (!sponsored[userOp.sender] || maxCost > maxCostPerOp) return ("", 1);
        return ("", 0);
    }

    /// @dev Never called: validatePaymasterUserOp returns an empty context.
    function postOp(PostOpMode, bytes calldata, uint256) external view {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
    }

    /// @notice Funding: native currency sent here goes to this paymaster's EntryPoint deposit.
    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function deposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function setSponsored(address account, bool enabled) external onlyOwner {
        sponsored[account] = enabled;
        emit Sponsored(account, enabled);
    }

    function setMaxCostPerOp(uint256 maxCost) external onlyOwner {
        maxCostPerOp = maxCost;
        emit MaxCostPerOpChanged(maxCost);
    }

    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    /// @notice Two-step ownership transfer, so a typo cannot lock the funds.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
