**Glt Project is an international decentralized land and real estate property registry governed by DAO (Decentralized autonomous organization) and self-governance protocol for communities of homeowners built on top of Ethereum blockchain.**

This repo contains smart contracts for Private Property Registries in Galt Project. Private property registry is ERC721 Ownable Smart contract on Ethereum. Anyone can create a private registry using the smart contract Factory by paying a fee in ETH or GALT and become its owner. The private registry Owner has the ability to create tokens with geographic coordinates and other linked data(address, floor, apartment or room number, photo and video, etc.). Tokens can be created for commercial purposes, as digital objects representing the right of ownership, lease rights, leasing agreements, shares in co-op, membership rights, etc. As well as for the self-government of property owners.

it is still experimental software that has not yet been publicly audited.

You can find Factory of Private Property Reigstries by address: [0xd4e20E82d6B74C21C6C93F6B84BA5d499fD7B24e](http://etherscan.io/address/0xd4e20E82d6B74C21C6C93F6B84BA5d499fD7B24e)

:bomb: **Security review status: Internal audit**

Unfortunately, we do not currently have sufficient resources for a full audit of the smart contracts. 

Our team believes that the Galt Project will enable people to transact land and real estate without borders and third parties. As well as creating self-governing communities without corruption and with transparent governance processes. 
You can contribute to this by checking the code and creating an issue or PR, or by making a small donation to the address of the team **0x98064493535B22F6EbDf475341F0A6DaaBb7b538**.

# Contracts overview

- **PPACL.sol**  - access control list. It is used as a single registry for roles management;
- **PPGlobalRegistry.sol** - smart contracts registry.
- **PPToken.sol** - Property Token (ERC721 Token contract). Each Token contains geographic coordinates and other linked data(address, floor, apartment or room number, photo and video, etc.). and represents a particular land plot, whole building, or room in the building;
- **PPTokenController.sol** -  After the token has been transferred to the Token Owner, a change in its geographical coordinates and data, as well as the destruction of the token, can only occur through the Token modification contract(Controller). For this, the Owner of the token or the Owner of the Private Property Registry should create a proposal for changing the data. Proposal must be approved by the other party;
- **PPMarket.sol** - contract for placing sales orders for Property Tokens.

## Usage

* `make cleanup` - remove solidity build artifacts
* `make compile` - compile solidity files, executes `make cleanup` before compilation
* `make test` - run tests
* `make coverage` - run solidity coverage
* `make lint` - run solidity and javascript linters
* `make ganache` - run local pre-configured ganache

For more information check out `Makefile`
