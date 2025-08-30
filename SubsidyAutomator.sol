// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SubsidyAutomator {

    address public government;

    struct Vendor {
        address producerAddress;
        uint milestoneGoal;
        uint currentProgress;
        uint rewardAmount;
        bool isPaid;
        bool isActive;
    }

    mapping(address => Vendor) public vendors;

    constructor() {
        government = msg.sender;
    }

    modifier onlyGovernment() {
        require(msg.sender == government, "Only the government can perform this action.");
        _;
    }

    function addVendor(address _producerAddress, uint _milestoneGoal, uint _rewardAmount) public onlyGovernment {
        require(_producerAddress != address(0), "Invalid producer address.");
        require(!vendors[_producerAddress].isActive, "This vendor is already registered.");

        vendors[_producerAddress] = Vendor({
            producerAddress: _producerAddress,
            milestoneGoal: _milestoneGoal,
            rewardAmount: _rewardAmount,
            currentProgress: 0,
            isPaid: false,
            isActive: true
        });
    }

    function depositSubsidy() public payable onlyGovernment {
    }

    function updateProgress(address _vendorAddress, uint _newProgress) public onlyGovernment {
        require(vendors[_vendorAddress].isActive, "This vendor is not registered.");
        
        Vendor storage vendor = vendors[_vendorAddress];
        require(!vendor.isPaid, "This vendor has already been paid out.");

        vendor.currentProgress += _newProgress;
    }

    function withdrawSubsidy() public {
        Vendor storage vendor = vendors[msg.sender];

        require(vendor.isActive, "You are not a registered vendor.");
        require(vendor.currentProgress >= vendor.milestoneGoal, "Milestone has not been met yet.");
        require(!vendor.isPaid, "Subsidy has already been paid.");
        require(address(this).balance >= vendor.rewardAmount, "Insufficient funds in contract for this payout.");

        vendor.isPaid = true;
        payable(vendor.producerAddress).transfer(vendor.rewardAmount);
    }
}

