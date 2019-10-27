/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPrivatePropertyToken.sol";


contract PrivatePropertyToken is ERC721Full, Ownable, IPrivatePropertyToken {
  event SetMinter(address indexed minter);
  event SetDataLink(string indexed dataLink);
  event SetGeoDataManager(address indexed geoDataManager);
  event SetDetails(
    address indexed geoDataManager,
    uint256 indexed privatePropertyId
  );
  event SetContour(
    address indexed geoDataManager,
    uint256 indexed privatePropertyId
  );

  struct Property {
    // (LAND_PLOT,BUILDING,ROOM) Type cannot be changed after token creation
    TokenType tokenType;
    // Geohash5z (x,y,z)
    uint256[] contour;
    // Meters above the sea
    int256 highestPoint;

    // USER_INPUT or CONTRACT
    AreaSource areaSource;
    // Calculated either by contract (for land plots and buildings) or by manual input
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;
  }

  uint256 public tokenIdCounter;
  address public minter;
  address public geoDataManager;

  string public dataLink;

  mapping(uint256 => Property) internal properties;

  modifier onlyMinter() {
    require(msg.sender == minter, "Only minter allowed");

    _;
  }

  modifier onlyGeoDataManager() {
    require(msg.sender == geoDataManager, "Only GeoDataManager allowed");

    _;
  }

  constructor(string memory _name, string memory _symbol) public ERC721Full(_name, _symbol) {
  }

  // OWNER INTERFACE

  function setDataLink(string memory _dataLink) public onlyOwner {
    dataLink = _dataLink;

    emit SetDataLink(_dataLink);
  }

  function setMinter(address _minter) public onlyOwner {
    minter = _minter;

    emit SetMinter(_minter);
  }

  function setGeoDataManager(address _geoDataManager) public onlyOwner {
    geoDataManager = _geoDataManager;

    emit SetGeoDataManager(_geoDataManager);
  }

  //  MINTER INTERFACE

  function mint(address _to) public onlyMinter {
    _mint(_to, nextTokenId());
  }

  // GEODATA MANAGER INTERFACE

  function setDetails(
    uint256 _privatePropertyId,
    TokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external
    onlyGeoDataManager
  {
    Property storage p = properties[_privatePropertyId];

    p.tokenType = _tokenType;
    p.areaSource = _areaSource;
    p.area = _area;
    p.ledgerIdentifier = _ledgerIdentifier;
    p.humanAddress = _humanAddress;
    p.dataLink = _dataLink;

    emit SetDetails(msg.sender, _privatePropertyId);
  }

  function setContour(
    uint256 _privatePropertyId,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external
    onlyGeoDataManager
  {
    Property storage p = properties[_privatePropertyId];

    p.contour = _contour;
    p.highestPoint = _highestPoint;

    emit SetContour(msg.sender, _privatePropertyId);
  }

  // INTERNAL

  function nextTokenId() internal returns (uint256) {
    tokenIdCounter += 1;
    return tokenIdCounter;
  }

  // GETTERS

  function tokensOfOwner(address _owner) external view returns (uint256[] memory) {
    return _tokensOfOwner(_owner);
  }

  function exists(uint256 _tokenId) external view returns (bool) {
    return _exists(_tokenId);
  }

  function getType(uint256 _tokenId) external view returns (TokenType) {
    return properties[_tokenId].tokenType;
  }

  function getContour(uint256 _tokenId) external view returns (uint256[] memory) {
    return properties[_tokenId].contour;
  }

  function getHighestPoint(uint256 _tokenId) external view returns (int256) {
    return properties[_tokenId].highestPoint;
  }

  function getHumanAddress(uint256 _tokenId) external view returns (string memory) {
    return properties[_tokenId].humanAddress;
  }

  function getArea(uint256 _tokenId) external view returns (uint256) {
    return properties[_tokenId].area;
  }

  function getAreaSource(uint256 _tokenId) external view returns (AreaSource) {
    return properties[_tokenId].areaSource;
  }

  function getLedgerIdentifier(uint256 _tokenId) external view returns (bytes32) {
    return properties[_tokenId].ledgerIdentifier;
  }

  function getDataLink(uint256 _tokenId) external view returns (string memory) {
    return properties[_tokenId].dataLink;
  }

  function getContourLength(uint256 _tokenId) external view returns (uint256) {
    return properties[_tokenId].contour.length;
  }

  function getDetails(uint256 _privatePropertyId)
    external
    view
    returns (
      TokenType tokenType,
      uint256[] memory contour,
      int256 highestPoint,
      AreaSource areaSource,
      uint256 area,
      bytes32 ledgerIdentifier,
      string memory humanAddress,
      string memory dataLink
    )
  {
    Property storage p = properties[_privatePropertyId];

    return (
      p.tokenType,
      p.contour,
      p.highestPoint,
      p.areaSource,
      p.area,
      p.ledgerIdentifier,
      p.humanAddress,
      p.dataLink
    );
  }
}
