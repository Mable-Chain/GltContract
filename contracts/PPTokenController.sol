/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPPToken.sol";


contract PPTokenController is Ownable {
  using SafeMath for uint256;

  event SetGeoDataManager(address indexed geoDataManager);
  event NewProposal(
    uint256 indexed proposalId,
    uint256 indexed tokenId,
    address indexed creator
  );
  event ProposalExecuted(uint256 indexed proposalId);
  event ProposalExecutionFailed(uint256 indexed proposalId);
  event ProposalApproval(
    uint256 indexed proposalId,
    uint256 indexed tokenId
  );
  event SetBurnTimeout(uint256 indexed tokenId, uint256 timeout);
  event InitiateTokenBurn(uint256 indexed tokenId, uint256 timeoutAt);
  event BurnTokenByTimeout(uint256 indexed tokenId);
  event CancelTokenBurn(uint256 indexed tokenId);

  struct Proposal {
    address creator;
    bool executed;
    bool tokenOwnerApproved;
    bool geoDataManagerApproved;
    bytes data;
    string dataLink;
  }

  IERC721 public tokenContract;
  address public geoDataManager;
  uint256 public defaultBurnTimeoutDuration;
  uint256 internal idCounter;

  mapping(uint256 => Proposal) public proposals;
  // tokenId => timeoutDuration (in seconds)
  mapping(uint256 => uint256) public burnTimeoutDuration;
  // tokenId => burnTimeoutAt
  mapping(uint256 => uint256) public burnTimeoutAt;

  constructor(IERC721 _tokenContract, uint256 _defaultBurnTimeoutDuration) public {
    require(_defaultBurnTimeoutDuration > 0, "Invalid burn timeout duration");

    defaultBurnTimeoutDuration = _defaultBurnTimeoutDuration;

    tokenContract = _tokenContract;
  }

  // OWNER INTERFACE
  function setGeoDataManager(address _geoDataManager) external onlyOwner {
    geoDataManager = _geoDataManager;

    emit SetGeoDataManager(_geoDataManager);
  }

  function setBurnTimeoutDuration(uint256 _tokenId, uint256 _duration) external {
    require(tokenContract.ownerOf(_tokenId) == msg.sender, "Only token owner allowed");
    require(_duration > 0, "Invalid timeout duration");

    burnTimeoutDuration[_tokenId] = _duration;

    emit SetBurnTimeout(_tokenId, _duration);
  }

  function initiateTokenBurn(uint256 _tokenId) external onlyOwner {
    require(burnTimeoutAt[_tokenId] == 0, "Burn already initiated");
    require(tokenContract.ownerOf(_tokenId) != address(0), "Token doesn't exists");

    uint256 duration = burnTimeoutDuration[_tokenId];
    if (duration == 0) {
      duration = defaultBurnTimeoutDuration;
    }

    uint256 timeoutAt = block.timestamp.add(duration);
    burnTimeoutAt[_tokenId] = timeoutAt;

    emit InitiateTokenBurn(_tokenId, timeoutAt);
  }

  function cancelTokenBurn(uint256 _tokenId) external {
    require(burnTimeoutAt[_tokenId] != 0, "Burn not initiated");
    require(tokenContract.ownerOf(_tokenId) == msg.sender, "Only token owner allowed");

    burnTimeoutAt[_tokenId] = 0;

    emit CancelTokenBurn(_tokenId);
  }

  function burnTokenByTimeout(uint256 _tokenId) external {
    require(burnTimeoutAt[_tokenId] != 0, "Timeout not set");
    require(block.timestamp > burnTimeoutAt[_tokenId], "Timeout has not passed yet");
    require(tokenContract.ownerOf(_tokenId) != address(0), "Token already burned");

    IPPToken(address(tokenContract)).burn(_tokenId);

    emit BurnTokenByTimeout(_tokenId);
  }

  // USER INTERFACE

  function propose(
    bytes calldata _data,
    string calldata _dataLink
  )
    external
  {
    address msgSender = msg.sender;
    uint256 tokenId = fetchTokenId(_data);
    uint256 proposalId = nextId();

    Proposal storage p = proposals[proposalId];

    if (msgSender == geoDataManager) {
      p.geoDataManagerApproved = true;
    } else if (msgSender == tokenContract.ownerOf(tokenId)) {
      p.tokenOwnerApproved = true;
    } else {
      revert("Missing permissions");
    }

    p.creator = msgSender;
    p.data = _data;
    p.dataLink = _dataLink;

    emit NewProposal(proposalId, tokenId, msg.sender);
  }

  function approve(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    uint256 tokenId = fetchTokenId(p.data);

    if (p.geoDataManagerApproved == true) {
      require(msg.sender == tokenContract.ownerOf(tokenId), "Missing permissions");
      p.tokenOwnerApproved = true;
    } else if (p.tokenOwnerApproved == true) {
      require(msg.sender == geoDataManager, "Missing permissions");
      p.geoDataManagerApproved = true;
    } else {
      revert("Missing permissions");
    }

    emit ProposalApproval(_proposalId, tokenId);

    execute(_proposalId);
  }

  function execute(uint256 _proposalId) public {
    Proposal storage p = proposals[_proposalId];

    require(p.tokenOwnerApproved == true, "Token owner approval required");
    require(p.geoDataManagerApproved == true, "GeoDataManager approval required");
    require(p.executed == false, "Already executed");

    p.executed = true;

    (bool ok,) = address(tokenContract)
      .call
      .gas(gasleft().sub(50000))(p.data);

    if (ok == false) {
      emit ProposalExecutionFailed(_proposalId);
      p.executed = false;
    } else {
      emit ProposalExecuted(_proposalId);
    }
  }

  // INTERNAL

  // @dev Assuming that a tokenId is always the first argument in a method
  function fetchTokenId(bytes memory _data) public pure returns (uint256 tokenId) {
    assembly {
      tokenId := mload(add(_data, 0x24))
    }

    require(tokenId > 0, "Failed fetching tokenId from encoded data");
  }

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }
}