/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPGlobalRegistry.sol";


/**
 * @title Private Property Token Registry.
 * @notice Tracks all the valid tokens.
 */
contract PPTokenRegistry is IPPTokenRegistry, OwnableAndInitializable {

  bytes32 public constant ROLE_TOKEN_REGISTRAR = bytes32("TOKEN_REGISTRAR");

  struct Details {
    bool active;
    address factory;
  }

  IPPGlobalRegistry public globalRegistry;

  address[] public tokenList;

  // Token address => Details
  mapping(address => Details) public tokens;

  modifier onlyFactory() {
    require(
      globalRegistry.getACL().hasRole(msg.sender, ROLE_TOKEN_REGISTRAR),
      "Invalid registrar"
    );

    _;
  }

  function initialize(IPPGlobalRegistry _ppGlobalRegistry) external isInitializer {
    globalRegistry = _ppGlobalRegistry;
  }

  // FACTORY INTERFACE

  function addToken(address _token) external onlyFactory {
    Details storage token = tokens[_token];

    token.active = true;
    token.factory = msg.sender;

    tokenList.push(_token);

    emit AddToken(_token, Ownable(_token).owner(), msg.sender);
  }

  // REQUIRES
  function requireValidToken(address _token) external view {
    require(tokens[_token].active == true, "Token address is invalid");
  }

  // GETTERS

  function isValid(address _token) external view returns (bool) {
    return tokens[_token].active;
  }

  function getAllTokens() external view returns (address[] memory) {
    return tokenList;
  }
}
