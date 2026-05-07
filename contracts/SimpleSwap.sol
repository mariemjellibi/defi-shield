// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleSwap {
    address public owner;
    
    mapping(address => uint256) public tokenA;
    mapping(address => uint256) public tokenB;
    
    uint256 public reserveA = 1000 ether;
    uint256 public reserveB = 1000 ether;

    constructor() {
        owner = msg.sender;
    }

    function getTokens() external {
        tokenA[msg.sender] += 10 ether;
    }

    // ⚠️ vulnerable — no slippage protection
    function swap(uint256 amountIn) external {
        require(amountIn > 0, "Amount must be > 0");
        require(tokenA[msg.sender] >= amountIn, "Not enough tokens");

        uint256 amountOut = (amountIn * reserveB) / reserveA;

        tokenA[msg.sender] -= amountIn;
        tokenB[msg.sender] += amountOut;
        reserveA += amountIn;
        reserveB -= amountOut;
    }

    function getPrice() external view returns (uint256) {
        return (reserveB * 1 ether) / reserveA;
    }
}