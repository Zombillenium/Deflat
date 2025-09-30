// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DFT is ERC20, Ownable {
    uint256 public baseBurnRate; 
    uint256 public maxBurnRate;  

    constructor(uint256 initialSupply) ERC20("Deflat Token", "DFT") Ownable(msg.sender) {
    _mint(msg.sender, initialSupply);
    baseBurnRate = 50;   // 0.5%
    maxBurnRate = 1000;  // 10%
	}

    function setBurnRates(uint256 _base, uint256 _max) external onlyOwner {
        require(_base <= _max, "Base > Max");
        baseBurnRate = _base;
        maxBurnRate = _max;
    }

    function _getBurnRate() internal view returns (uint256) {
        // (Plus tard on modifiera selon cours)
        return baseBurnRate;
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 burnRate = _getBurnRate();
        uint256 burnAmount = (amount * burnRate) / 10000; 
        uint256 sendAmount = amount - burnAmount;

        if (burnAmount > 0) {
            _burn(_msgSender(), burnAmount);
        }

        return super.transfer(to, sendAmount);
    }
    
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 burnRate = _getBurnRate();
        uint256 burnAmount = (amount * burnRate) / 10000;
        uint256 sendAmount = amount - burnAmount;

        if (burnAmount > 0) {
            _burn(from, burnAmount);
        }
        return super.transferFrom(from, to, sendAmount);
    }


}

