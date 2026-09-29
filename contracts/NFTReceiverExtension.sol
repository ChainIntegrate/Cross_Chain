// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title NFTReceiverExtension
 * @notice LSP17 extension that lets a Universal Profile (LSP0) accept ERC-721 and ERC-1155 tokens
 * sent with `safeTransferFrom`, and report the receiver interfaces through ERC-165.
 *
 * The UP forwards these calls to the extension with a plain CALL (never DELEGATECALL), appending
 * msg.sender and msg.value to the calldata. The extension only returns constants: it has no owner,
 * no storage, no funds and no other function, so it cannot read or change anything in the UP.
 * It is published at the same address on every chain through Nick's deterministic deployment proxy.
 */
contract NFTReceiverExtension {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02; // IERC721Receiver.onERC721Received.selector
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return 0xf23a6e61; // IERC1155Receiver.onERC1155Received.selector
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return 0xbc197c81; // IERC1155Receiver.onERC1155BatchReceived.selector
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // IERC165
            || interfaceId == 0x150b7a02 // IERC721Receiver
            || interfaceId == 0x4e2312e0; // IERC1155Receiver
    }
}
