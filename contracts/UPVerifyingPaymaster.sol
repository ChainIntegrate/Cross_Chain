// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

/// @title UPVerifyingPaymaster
/// @notice ERC-4337 (EntryPoint v0.6) paymaster that pays the gas of a user operation only when an
/// off-chain service has approved it: the operation's `paymasterAndData` must carry a signature by
/// the paymaster's `signer` over the operation, this chain, this paymaster and a validity window.
/// Which operations to approve (accounts, contracts, quotas, budgets) is decided by the service, not
/// stored here. The owner funds it by sending native currency to it (forwarded to the EntryPoint
/// deposit), sets the signer and a maximum cost per operation, and is the only one who can withdraw.
/// @dev EXPERIMENTAL, unaudited. Same constructor as UPPaymaster (EntryPoint, owner), so the address
/// through a deterministic factory is the same on every chain for a given owner. The signer is set
/// after deployment and can be replaced; the cost cap starts at 0: nothing is paid until the owner
/// sets both. The cap is a second line of defence: it bounds what each operation can cost the
/// deposit even if the signer key is stolen.
///
/// paymasterAndData = paymaster (20 bytes) ++ validUntil (uint48, 6 bytes) ++ validAfter (uint48,
/// 6 bytes) ++ signature (65 bytes: r, s, v). The signer signs, with EIP-191 personal_sign,
/// getHash(userOp, validUntil, validAfter). validUntil 0 means no expiry, as in the EntryPoint.
///
/// Validation reads this contract's own storage (signer, cap). Bundlers that apply the ERC-7562
/// rules would need it staked; the site's own relayer does not apply them (Extension4337 reads the
/// Key Manager's storage anyway).
contract UPVerifyingPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;
    address public pendingOwner;
    address public signer;
    uint256 public maxCostPerOp;

    uint256 private constant VALID_UNTIL_OFFSET = 20;
    uint256 private constant SIGNATURE_OFFSET = 32;
    uint256 private constant PAYMASTER_DATA_LENGTH = 97;
    // secp256k1n / 2: signatures with a higher s are malleable copies and are refused.
    uint256 private constant HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    event SignerChanged(address indexed signer);
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

    /// @notice What the signer signs (with personal_sign) to approve an operation. Covers every
    /// field of the operation except paymasterAndData and signature, plus this chain, this
    /// paymaster and the validity window, so an approval cannot be reused for another operation,
    /// chain or paymaster. The operation's nonce makes each approval single-use.
    function getHash(UserOperation calldata userOp, uint48 validUntil, uint48 validAfter) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                block.chainid,
                address(this),
                validUntil,
                validAfter
            )
        );
    }

    /// @dev Called by the EntryPoint during validation. Returns "signature failed" (with the
    /// validity window, when it could be read) for: no signer set, a cost above the cap, malformed
    /// paymasterAndData, or a signature that is not the signer's. The EntryPoint itself enforces
    /// validUntil / validAfter.
    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32, uint256 maxCost)
        external
        view
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        bytes calldata data = userOp.paymasterAndData;
        if (data.length != PAYMASTER_DATA_LENGTH) return ("", 1);
        uint48 validUntil = uint48(bytes6(data[VALID_UNTIL_OFFSET:VALID_UNTIL_OFFSET + 6]));
        uint48 validAfter = uint48(bytes6(data[VALID_UNTIL_OFFSET + 6:SIGNATURE_OFFSET]));
        bool failed = signer == address(0) || maxCost > maxCostPerOp
            || _recover(_toEthSignedMessageHash(getHash(userOp, validUntil, validAfter)), data[SIGNATURE_OFFSET:]) != signer;
        return ("", _packValidationData(failed, validUntil, validAfter));
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

    /// @notice Sets or replaces the approving key; address(0) stops all sponsoring at once.
    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
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

    // EntryPoint v0.6 validationData: low 160 bits 0 = valid, 1 = signature failed; then validUntil
    // (48 bits), then validAfter (48 bits).
    function _packValidationData(bool failed, uint48 validUntil, uint48 validAfter) private pure returns (uint256) {
        return (failed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }

    function _toEthSignedMessageHash(bytes32 hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /// @dev 65-byte (r, s, v) signatures only; malleable (high s) or invalid ones recover nothing.
    function _recover(bytes32 hash, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) return address(0);
        return ecrecover(hash, v, r, s);
    }
}
