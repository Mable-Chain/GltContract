const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { BN } = require('web3-utils');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPToken = contract.fromArtifact('PPToken');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPLockerFactory = contract.fromArtifact('PPLockerFactory');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
const PPLocker = contract.fromArtifact('PPLocker');
// const LockerProposalManager = contract.fromArtifact('LockerProposalManager');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const EthFeeRegistry = contract.fromArtifact('EthFeeRegistry');
const PPBridgedLockerFactory = contract.fromArtifact('PPBridgedLockerFactory');
const PPACL = contract.fromArtifact('PPACL');
const MockRA = contract.fromArtifact('MockRA');
const LockerProposalManagerFactory = contract.fromArtifact('LockerProposalManagerFactory');
const LockerProposalManager = contract.fromArtifact('LockerProposalManager');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const _ = require('lodash');
const { ether, assertRevert, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);
const {
  withdrawLockerProposal,
  approveMintLockerProposal,
  burnLockerProposal,
  validateProposalError,
  validateProposalSuccess,
  ayeLockerProposal,
  changeOwnersLockerProposal,
  getLockerProposalVotingProgress,
  setDefaultProposalConfig,
  setProposalConfig,
  changeLockerProposalManagerProposal
} = require('./proposalHelpers')(contract);

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe('PPLockers', () => {
  const [alice, bob, dan, lola, registryOwner, minter, feeManager, feeReceiver, mockProposalManager] = accounts;
  const owner = defaultSender;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppLockerRegistry = await PPLockerRegistry.new();
    this.ppFeeRegistry = await EthFeeRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);
    await this.ppLockerRegistry.initialize(this.ppgr.address);
    await this.ppFeeRegistry.initialize(feeManager, feeReceiver, [], []);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);

    const lockerProposalManagerFactory = await LockerProposalManagerFactory.new();
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, lockerProposalManagerFactory.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_FEE_REGISTRY(), this.ppFeeRegistry.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_LOCKER_REGISTRY(), this.ppLockerRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
    await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), this.ppLockerFactory.address, true);

    // Fees setup
    await this.ppTokenFactory.setFeeManager(feeManager);
    await this.ppTokenFactory.setFeeCollector(feeReceiver);
    await this.ppTokenFactory.setEthFee(ethFee, { from: feeManager });
    await this.ppTokenFactory.setGaltFee(galtFee, { from: feeManager });

    await this.ppLockerFactory.setFeeManager(feeManager);
    await this.ppLockerFactory.setFeeCollector(feeReceiver);
    await this.ppLockerFactory.setEthFee(ethFee, { from: feeManager });
    await this.ppLockerFactory.setGaltFee(galtFee, { from: feeManager });
  });

  it('should correctly build a locker with no fee', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      123,
      utf8ToHex('foo'),
      'bar',
      'buzz',
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
    const lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
    const locker = await PPLocker.at(lockerAddress);

    assert.equal(await this.ppLockerRegistry.isValid(lockerAddress), true);

    const blockNumberBeforeDeposit = await web3.eth.getBlockNumber();

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });

    const blockNumberAfterDeposit = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), 123);

    assert.equal(await token.ownerOf(aliceTokenId), locker.address);
    assert.equal(await locker.tokenContract(), token.address);
    assert.equal(await locker.tokenId(), aliceTokenId);
    assert.equal(await locker.tokenDeposited(), true);
    assert.equal(await locker.reputationOf(alice), 123);
    assert.equal(await locker.totalReputation(), 123);
    const lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice]);
    assert.sameMembers(lockerInfo._ownersReputation, ['123']);

    // create fake RA contract and mint reputation to it
    const ra = await MockRA.new('MockRA');
    await approveMintLockerProposal(locker, ra, { from: alice });

    await assertRevert(locker.withdraw(alice, alice, { from: alice }), 'Not the proposal manager');

    const withdrawProposalId = await withdrawLockerProposal(locker, bob, dan, { from: alice });
    await validateProposalError(locker, withdrawProposalId, 'RAs counter should be 0');

    assert.sameMembers(await locker.getTras(), [ra.address]);

    await ra.setMinted(token.address, aliceTokenId, '1');
    await assertRevert(locker.burn(ra.address, { from: alice }), 'Not the proposal manager');
    const burnProposalId = await burnLockerProposal(locker, ra, { from: alice });
    await validateProposalError(locker, burnProposalId, 'Reputation not completely burned');
    await ra.setMinted(token.address, aliceTokenId, '0');

    // burn reputation and withdraw token back
    await burnLockerProposal(locker, ra, { from: alice });
    await withdrawLockerProposal(locker, bob, dan, { from: alice });

    const blockNumberAfterBurn = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), 123);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterBurn), 0);

    assert.equal(await locker.reputationOf(alice), 0);
    assert.equal(await locker.totalReputation(), 0);

    assert.equal(await token.ownerOf(aliceTokenId), bob);
    assert.equal(await locker.depositManager(), dan);
  });

  it('should correctly change locker owners', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      ether(100),
      utf8ToHex('foo'),
      'bar',
      'buzz',
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.buildForOwner(
      alice,
      ether(100),
      ether(100),
      60 * 60 * 24 * 7,
      0,
      ['0x0e801ee1'],
      [ether(5)],
      [ether(5)],
      [60 * 60 * 24 * 7],
      [0],
      { from: alice, value: ether(10) }
    );
    const lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
    const locker = await PPLocker.at(lockerAddress);

    assert.equal(await this.ppLockerRegistry.isValid(lockerAddress), true);

    const blockNumberBeforeDeposit = await web3.eth.getBlockNumber();

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice, bob, dan], ['1', '1', '2'], '4', { from: alice });

    const blockNumberAfterDeposit = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));

    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));

    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));

    assert.equal(await token.ownerOf(aliceTokenId), locker.address);
    assert.equal(await locker.tokenContract(), token.address);
    assert.equal(await locker.tokenId(), aliceTokenId);
    assert.equal(await locker.tokenDeposited(), true);
    assert.equal(await locker.reputationOf(alice), ether(25));
    assert.equal(await locker.reputationOf(bob), ether(25));
    assert.equal(await locker.reputationOf(dan), ether(50));
    assert.equal(await locker.reputationOf(lola), 0);
    assert.equal(await locker.totalReputation(), ether(100));

    assert.equal(await locker.shareByOwner(alice), 1);
    assert.equal(await locker.shareByOwner(bob), 1);
    assert.equal(await locker.shareByOwner(lola), 0);
    assert.equal(await locker.shareByOwner(dan), 2);
    assert.equal(await locker.totalShares(), 4);

    let lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(25), ether(25), ether(50)]);

    // create fake RA contract and mint reputation to it
    const ra = await MockRA.new('MockRA');
    const approveMintProposalId = await approveMintLockerProposal(locker, ra, { from: alice });
    const approveMintProposal = await getLockerProposalVotingProgress(locker, approveMintProposalId);
    assert.equal(approveMintProposal.requiredSupport, ether(5));
    assert.equal(approveMintProposal.minAcceptQuorum, ether(5));
    assert.equal(await locker.getTrasCount(), 1);

    let changeOwnersProposalId = await changeOwnersLockerProposal(locker, [alice, bob, lola], ['1', '1', '1'], '3', {
      from: alice
    });
    await ayeLockerProposal(locker, changeOwnersProposalId, { from: bob });
    await assertRevert(
      ayeLockerProposal(locker, changeOwnersProposalId, { from: lola }),
      "Can't vote with 0 reputation -- Reason given: Can't vote with 0 reputation."
    );
    await ayeLockerProposal(locker, changeOwnersProposalId, { from: dan });
    await validateProposalError(locker, changeOwnersProposalId, 'RAs counter should be 0');

    assert.sameMembers(await locker.getTras(), [ra.address]);
    await ra.setMinted(token.address, aliceTokenId, '0');

    // burn reputation and withdraw token back
    const burnLockerProposalId = await burnLockerProposal(locker, ra, { from: alice });
    await ayeLockerProposal(locker, burnLockerProposalId, { from: bob });
    await ayeLockerProposal(locker, burnLockerProposalId, { from: dan });

    changeOwnersProposalId = await changeOwnersLockerProposal(locker, [alice, bob, lola], ['1', '1', '1'], '3', {
      from: alice
    });
    await ayeLockerProposal(locker, changeOwnersProposalId, { from: bob });
    await ayeLockerProposal(locker, changeOwnersProposalId, { from: dan });
    await validateProposalSuccess(locker, changeOwnersProposalId);

    const blockNumberAfterChangeOwners = await web3.eth.getBlockNumber();

    const ether33 = new BN(ether(100)).div(new BN(3)).toString(10);
    const ether99 = new BN(ether(100))
      .div(new BN(3))
      .mul(new BN(3))
      .toString(10);

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterChangeOwners), ether33);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterChangeOwners), ether33);
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterChangeOwners), ether33);
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterChangeOwners), 0);

    assert.equal(await locker.reputationOf(alice), ether33);
    assert.equal(await locker.reputationOf(bob), ether33);
    assert.equal(await locker.reputationOf(lola), ether33);
    assert.equal(await locker.reputationOf(dan), 0);
    assert.equal(await locker.totalReputation(), ether99);

    assert.equal(await locker.shareByOwner(alice), 1);
    assert.equal(await locker.shareByOwner(bob), 1);
    assert.equal(await locker.shareByOwner(lola), 1);
    assert.equal(await locker.shareByOwner(dan), 0);
    assert.equal(await locker.totalShares(), 3);

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, lola]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether33, ether33, ether33]);
  });

  it('should correctly change locker proposal manager config', async function() {
    const ether33 = new BN(ether(100)).div(new BN(3)).toString(10);

    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      ether(100),
      utf8ToHex('foo'),
      'bar',
      'buzz',
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.buildForOwner(
      alice,
      ether(100),
      ether(100),
      60 * 60 * 24 * 7,
      0,
      ['0x0e801ee1'],
      [ether(5)],
      [ether(5)],
      [60 * 60 * 24 * 7],
      [0],
      { from: alice, value: ether(10) }
    );
    const lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
    const locker = await PPLocker.at(lockerAddress);
    const proposalManager = await LockerProposalManager.at(await locker.proposalManager());

    let defaultProposalConfig = await proposalManager.defaultVotingConfig();
    assert.equal(ether(100), defaultProposalConfig.support);
    assert.equal(ether(100), defaultProposalConfig.minAcceptQuorum);
    assert.equal(60 * 60 * 24 * 7, defaultProposalConfig.timeout);
    assert.equal(0, defaultProposalConfig.committingTimeout);

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice, bob, dan], ['1', '1', '2'], '4', { from: alice });

    let lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(25), ether(25), ether(50)]);

    const proposalId = await setDefaultProposalConfig(locker, ether(10), ether(10), 60 * 60 * 24 * 5, 1, {
      from: alice
    });
    await ayeLockerProposal(locker, proposalId, { from: bob });
    await ayeLockerProposal(locker, proposalId, { from: dan });

    let proposalProgress = await proposalManager.getProposalVotingProgress(proposalId);
    let proposalVoting = await proposalManager.getProposalVoting(proposalId);
    assert.equal(ether(100), proposalProgress.requiredSupport);
    assert.equal(ether(100), proposalProgress.minAcceptQuorum);
    assert.equal(
      60 * 60 * 24 * 7,
      parseInt(proposalProgress.timeoutAt.toString(10)) - parseInt(proposalVoting.createdAt.toString(10))
    );

    defaultProposalConfig = await proposalManager.defaultVotingConfig();
    assert.equal(ether(10), defaultProposalConfig.support);
    assert.equal(ether(10), defaultProposalConfig.minAcceptQuorum);
    assert.equal(60 * 60 * 24 * 5, defaultProposalConfig.timeout);
    assert.equal(1, defaultProposalConfig.committingTimeout);

    let changeOwnersProposalId = await changeOwnersLockerProposal(locker, [alice, bob, lola], ['1', '1', '1'], '3', {
      from: alice
    });

    proposalProgress = await proposalManager.getProposalVotingProgress(changeOwnersProposalId);
    proposalVoting = await proposalManager.getProposalVoting(changeOwnersProposalId);
    assert.equal(ether(10), proposalProgress.requiredSupport);
    assert.equal(ether(10), proposalProgress.minAcceptQuorum);
    assert.equal(
      60 * 60 * 24 * 5,
      parseInt(proposalProgress.timeoutAt.toString(10)) - parseInt(proposalVoting.createdAt.toString(10))
    );

    await validateProposalSuccess(locker, changeOwnersProposalId);

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, lola]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether33, ether33, ether33]);

    const proposalData = locker.contract.methods.changeOwners([], [], '0').encodeABI();
    const changeProposalOwnersMarker = await proposalManager.getThresholdMarker(locker.address, proposalData);

    const changeOwnersMarkerProposalId = await setProposalConfig(
      locker,
      changeProposalOwnersMarker,
      ether(100),
      ether(100),
      60 * 60 * 24 * 9,
      0,
      { from: alice }
    );
    await validateProposalSuccess(locker, changeOwnersMarkerProposalId);

    proposalProgress = await proposalManager.getProposalVotingProgress(changeOwnersMarkerProposalId);
    proposalVoting = await proposalManager.getProposalVoting(changeOwnersMarkerProposalId);
    assert.equal(ether(10), proposalProgress.requiredSupport);
    assert.equal(ether(10), proposalProgress.minAcceptQuorum);
    assert.equal(
      60 * 60 * 24 * 5,
      parseInt(proposalProgress.timeoutAt.toString(10)) - parseInt(proposalVoting.createdAt.toString(10))
    );

    changeOwnersProposalId = await changeOwnersLockerProposal(locker, [alice, bob], ['1', '1'], '2', {
      from: alice
    });

    proposalProgress = await proposalManager.getProposalVotingProgress(changeOwnersProposalId);
    proposalVoting = await proposalManager.getProposalVoting(changeOwnersProposalId);
    assert.equal(ether(100), proposalProgress.requiredSupport);
    assert.equal(ether(100), proposalProgress.minAcceptQuorum);
    assert.equal(
      60 * 60 * 24 * 9,
      parseInt(proposalProgress.timeoutAt.toString(10)) - parseInt(proposalVoting.createdAt.toString(10))
    );

    await ayeLockerProposal(locker, changeOwnersProposalId, { from: bob });
    await assertRevert(
      ayeLockerProposal(locker, changeOwnersProposalId, { from: dan }),
      "Can't vote with 0 reputation"
    );
    await ayeLockerProposal(locker, changeOwnersProposalId, { from: lola });

    await validateProposalSuccess(locker, changeOwnersProposalId);
  });

  it('should correctly change locker proposal manager address', async function() {
    const ether33 = new BN(ether(100)).div(new BN(3)).toString(10);

    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      ether(100),
      utf8ToHex('foo'),
      'bar',
      'buzz',
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.buildForOwner(
      alice,
      ether(100),
      ether(100),
      60 * 60 * 24 * 7,
      0,
      ['0x0e801ee1'],
      [ether(5)],
      [ether(5)],
      [60 * 60 * 24 * 7],
      [0],
      { from: alice, value: ether(10) }
    );
    const lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
    const locker = await PPLocker.at(lockerAddress);
    const initialProposalManager = await locker.proposalManager();

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice, bob, dan], ['1', '1', '2'], '4', { from: alice });

    const proposalId = await changeLockerProposalManagerProposal(locker, mockProposalManager, {
      from: alice
    });
    assert.equal(await locker.proposalManager(), initialProposalManager);
    await ayeLockerProposal(locker, proposalId, { from: bob });
    await ayeLockerProposal(locker, proposalId, { from: dan });
    assert.equal(await locker.proposalManager(), mockProposalManager);

    let lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(25), ether(25), ether(50)]);

    await locker.changeOwners([alice, bob, lola], ['1', '1', '1'], '3', { from: mockProposalManager });

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, lola]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether33, ether33, ether33]);

    await assertRevert(locker.setProposalManager(alice, { from: alice }), 'Not the proposal manager');

    await locker.setProposalManager(initialProposalManager, { from: mockProposalManager });
    assert.equal(await locker.proposalManager(), initialProposalManager);
  });

  it('should correctly transfer share of owner', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      ether(100),
      utf8ToHex('foo'),
      'bar',
      'buzz',
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
    const lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
    const locker = await PPLocker.at(lockerAddress);

    assert.equal(await this.ppLockerRegistry.isValid(lockerAddress), true);

    const blockNumberBeforeDeposit = await web3.eth.getBlockNumber();

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice, bob, dan], ['1', '1', '2'], '4', { from: alice });

    const blockNumberAfterDeposit = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));

    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));

    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));

    assert.equal(await token.ownerOf(aliceTokenId), locker.address);
    assert.equal(await locker.tokenContract(), token.address);
    assert.equal(await locker.tokenId(), aliceTokenId);
    assert.equal(await locker.tokenDeposited(), true);
    assert.equal(await locker.reputationOf(alice), ether(25));
    assert.equal(await locker.reputationOf(bob), ether(25));
    assert.equal(await locker.reputationOf(dan), ether(50));
    assert.equal(await locker.reputationOf(lola), 0);
    assert.equal(await locker.totalReputation(), ether(100));

    assert.equal(await locker.shareByOwner(alice), 1);
    assert.equal(await locker.shareByOwner(bob), 1);
    assert.equal(await locker.shareByOwner(lola), 0);
    assert.equal(await locker.shareByOwner(dan), 2);
    assert.equal(await locker.totalShares(), 4);

    let lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice, bob, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(25), ether(25), ether(50)]);

    // create fake RA contract and mint reputation to it
    const ra = await MockRA.new('MockRA');
    const approveMintProposalId = await approveMintLockerProposal(locker, ra, { from: alice });
    await ayeLockerProposal(locker, approveMintProposalId, { from: bob });
    await ayeLockerProposal(locker, approveMintProposalId, { from: dan });
    assert.equal(await locker.getTrasCount(), 1);

    await ra.setOwnerReputationMinted(alice, token.address, aliceTokenId, '100');

    await assertRevert(locker.transferShare(lola, { from: alice }), 'Reputation should to be 0 in all communities');

    await ra.setOwnerReputationMinted(alice, token.address, aliceTokenId, '0');

    await ra.setOwnerReputationMinted(lola, token.address, aliceTokenId, '200');

    await locker.transferShare(lola, { from: alice });

    const blockNumberAfterTransferShare = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterTransferShare), ether(50));

    assert.equal(await locker.reputationOf(alice), 0);
    assert.equal(await locker.reputationOf(bob), ether(25));
    assert.equal(await locker.reputationOf(lola), ether(25));
    assert.equal(await locker.reputationOf(dan), ether(50));
    assert.equal(await locker.totalReputation(), ether(100));

    assert.equal(await locker.shareByOwner(alice), 0);
    assert.equal(await locker.shareByOwner(bob), 1);
    assert.equal(await locker.shareByOwner(lola), 1);
    assert.equal(await locker.shareByOwner(dan), 2);
    assert.equal(await locker.totalShares(), 4);

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [bob, lola, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(25), ether(25), ether(50)]);

    await this.ppFeeRegistry.setEthFeeKeysAndValues([await locker.TRANSFER_SHARE_FEE_KEY()], [ether(0.1)], {
      from: feeManager
    });

    const unauthorizedBalanceBefore = await web3.eth.getBalance(feeReceiver);

    await assertRevert(locker.transferShare(lola, { from: bob }), 'Fee and msg.value not equal');
    await locker.transferShare(lola, { from: bob, value: ether(0.1) });

    assert.equal(await web3.eth.getBalance(this.ppFeeRegistry.address), '0');
    const unauthorizedBalanceAfter = await web3.eth.getBalance(feeReceiver);
    assert.equal(new BN(unauthorizedBalanceAfter).sub(new BN(unauthorizedBalanceBefore)), ether(0.1));

    const blockNumberAfterSecondTransferShare = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterTransferShare), ether(50));

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterSecondTransferShare), ether(50));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterSecondTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterSecondTransferShare), ether(0));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterSecondTransferShare), ether(50));

    assert.equal(await locker.reputationOf(alice), 0);
    assert.equal(await locker.reputationOf(bob), ether(0));
    assert.equal(await locker.reputationOf(lola), ether(50));
    assert.equal(await locker.reputationOf(dan), ether(50));
    assert.equal(await locker.totalReputation(), ether(100));

    assert.equal(await locker.shareByOwner(alice), 0);
    assert.equal(await locker.shareByOwner(bob), 0);
    assert.equal(await locker.shareByOwner(lola), 2);
    assert.equal(await locker.shareByOwner(dan), 2);
    assert.equal(await locker.totalShares(), 4);

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [lola, dan]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(50), ether(50)]);

    await locker.transferShare(lola, { from: dan, value: ether(0.1) });

    const blockNumberAfterThirdTransferShare = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(dan, blockNumberBeforeDeposit), 0);

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterDeposit), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterDeposit), ether(50));

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterTransferShare), ether(25));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterTransferShare), ether(50));

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterSecondTransferShare), ether(50));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterSecondTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterSecondTransferShare), ether(0));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterSecondTransferShare), ether(50));

    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterThirdTransferShare), ether(100));
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterThirdTransferShare), 0);
    assert.equal(await locker.reputationOfAt(bob, blockNumberAfterThirdTransferShare), ether(0));
    assert.equal(await locker.reputationOfAt(dan, blockNumberAfterThirdTransferShare), ether(0));

    assert.equal(await locker.reputationOf(alice), 0);
    assert.equal(await locker.reputationOf(bob), ether(0));
    assert.equal(await locker.reputationOf(lola), ether(100));
    assert.equal(await locker.reputationOf(dan), ether(0));
    assert.equal(await locker.totalReputation(), ether(100));

    assert.equal(await locker.shareByOwner(alice), 0);
    assert.equal(await locker.shareByOwner(bob), 0);
    assert.equal(await locker.shareByOwner(lola), 4);
    assert.equal(await locker.shareByOwner(dan), 0);
    assert.equal(await locker.totalShares(), 4);

    lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [lola]);
    assert.sameMembers(lockerInfo._ownersReputation, [ether(100)]);

    await assertRevert(withdrawLockerProposal(locker, bob, dan, { from: dan }), 'Not the locker owner');

    const proposalId = await withdrawLockerProposal(locker, bob, dan, { from: lola });
    await validateProposalError(locker, proposalId, 'RAs counter should be 0');
    await burnLockerProposal(locker, ra, { from: lola });

    await withdrawLockerProposal(locker, bob, dan, { from: lola });

    const blockNumberAfterWithdraw = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOf(lola), 0);
    assert.equal(await locker.totalReputation(), 0);

    assert.equal(await locker.reputationOfAt(lola, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterDeposit), 0);
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterSecondTransferShare), ether(50));
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterThirdTransferShare), ether(100));
    assert.equal(await locker.reputationOfAt(lola, blockNumberAfterWithdraw), 0);

    assert.equal(await token.ownerOf(aliceTokenId), bob);
    assert.equal(await locker.depositManager(), dan);
  });

  describe('deposit commission', () => {
    let token;
    let anotherToken;
    let lockerAddress;
    let controller;
    let anotherController;
    let locker;
    let aliceTokenId;
    let res;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
      res = await this.ppTokenFactory.build('Land Plots', 'LPL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      anotherToken = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      anotherController = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });
      await anotherController.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      await controller.setInitialDetails(aliceTokenId, 2, 1, 123, utf8ToHex('foo'), 'bar', 'buzz', false, {
        from: minter
      });

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
      locker = await PPLocker.at(lockerAddress);
    });

    it('could accept only ETH payments', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), zeroAddress);

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'GALT_TOKEN not set'
      );
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(3) }),
        'Invalid ETH fee'
      );

      const ra = await MockRA.new('MockRA');
      await assertRevert(
        locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, {
          from: alice,
          value: ether(3)
        }),
        'Invalid ETH fee'
      );

      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(4) });
    });

    it('could accept only GALT payments', async function() {
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(123123) }),
        'Invalid ETH fee'
      );
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });
    });

    it('should require another ETH payment for another registry after withdrawal', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.ETH_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      await anotherController.setInitialDetails(
        anotherAliceTokenId,
        2,
        1,
        123,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(4) });

      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', {
          from: alice,
          value: ether(4)
        }),
        'Invalid ETH fee'
      );

      await locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', {
        from: alice,
        value: ether(42)
      });

      assert.equal(await web3.eth.getBalance(controller.address), ether(4));
      assert.equal(await web3.eth.getBalance(anotherController.address), ether(42));
    });

    it('should require another GALT payment for another registry after withdrawal', async function() {
      // marketGalt,marketEth,lockerGalt,lockerEth
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.GALT_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      await anotherController.setInitialDetails(
        anotherAliceTokenId,
        2,
        1,
        123,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });

      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      await this.galtToken.mint(alice, ether(42));

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(42), { from: alice });
      await locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', { from: alice });

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(4));
      assert.equal(await this.galtToken.balanceOf(anotherController.address), ether(42));
    });

    it('should correctly deposit to locker by depositAndMint', async function() {
      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });
      const ra = await MockRA.new('MockRA');
      await assertRevert(
        locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, { from: minter }),
        'Not the deposit manager'
      );
      await locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, { from: alice });

      assert.equal(await token.ownerOf(aliceTokenId), locker.address);
      assert.equal(await locker.tokenContract(), token.address);
      assert.equal(await locker.tokenId(), aliceTokenId);
      assert.equal(await locker.tokenDeposited(), true);
      assert.equal(await locker.totalReputation(), 123);

      const lockerInfo = await locker.getLockerInfo();
      assert.sameMembers(lockerInfo._owners, [alice]);
      assert.sameMembers(lockerInfo._ownersReputation, ['123']);

      assert.sameMembers(await locker.getTras(), [ra.address]);

      // burn reputation and withdraw token back
      await burnLockerProposal(locker, ra, { from: alice });
      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      assert.equal(await token.ownerOf(aliceTokenId), alice);
    });

    it('should prevent use bridged locker for regular token', async function() {
      const lockerProposalManagerFactory = await LockerProposalManagerFactory.new();
      const ppBridgedLockerFactory = await PPBridgedLockerFactory.new(
        this.ppgr.address,
        lockerProposalManagerFactory.address,
        1,
        1
      );
      await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), ppBridgedLockerFactory.address, true);

      res = await ppBridgedLockerFactory.build({ from: alice, value: 1 });
      const bridgedLockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
      const bridgedLocker = await PPLocker.at(bridgedLockerAddress);

      await token.approve(bridgedLocker.address, aliceTokenId, { from: alice });
      await assertRevert(
        bridgedLocker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'Token type is invalid'
      );
    });

    it('preset fee should work', async function() {
      await assertRevert(
        this.ppFeeRegistry.setEthFeeKeysAndValues(
          [utf8ToHex('PMANAGER_VOTE'), utf8ToHex('LOCKER_TRANSFER_SHARE')],
          [ether(0.01), ether(0.02)],
          { from: owner }
        ),
        'caller is not the feeManager'
      );

      await this.ppFeeRegistry.setEthFeeKeysAndValues(
        [utf8ToHex('PMANAGER_VOTE'), utf8ToHex('LOCKER_TRANSFER_SHARE')],
        [ether(0.01), ether(0.02)],
        { from: feeManager }
      );

      assert.equal(await this.ppFeeRegistry.ethFeeByKey(utf8ToHex('PMANAGER_VOTE')), ether(0.01));
      assert.equal(await this.ppFeeRegistry.ethFeeByKey(utf8ToHex('LOCKER_TRANSFER_SHARE')), ether(0.02));
    });

    it('proposal fee should work', async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      await controller.setInitialDetails(
        aliceTokenId,
        // tokenType
        2,
        1,
        ether(100),
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      await this.ppLockerFactory.setFeeManager(owner, { from: owner });

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      lockerAddress = _.find(res.logs, l => l.args.locker).args.locker;
      locker = await PPLocker.at(lockerAddress);
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice, bob], ['1', '1'], '2', { from: alice });

      const blockBeforeWithdraw = await web3.eth.getBlockNumber();
      assert.equal(await locker.reputationOf(alice), ether(50));
      assert.equal(await locker.reputationOf(bob), ether(50));

      assert.equal(await locker.reputationOfAt(alice, blockBeforeWithdraw), ether(50));
      assert.equal(await locker.reputationOf(bob, blockBeforeWithdraw), ether(50));

      await this.ppFeeRegistry.setEthFeeKeysAndValues([await proposalManager.VOTE_FEE_KEY()], [ether(0.1)], {
        from: feeManager
      });

      const proposalData = locker.contract.methods.withdraw(dan, dan).encodeABI();
      await assertRevert(
        proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', { from: alice }),
        'Fee and msg.value not equal'
      );

      const unauthorizedBalanceBefore = await web3.eth.getBalance(feeReceiver);

      res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', {
        from: alice,
        value: ether(0.1)
      });

      assert.equal(await web3.eth.getBalance(this.ppFeeRegistry.address), '0');
      const unauthorizedBalanceAfter = await web3.eth.getBalance(feeReceiver);
      assert.equal(new BN(unauthorizedBalanceAfter).sub(new BN(unauthorizedBalanceBefore)), ether(0.1));

      const proposalId = _.find(res.logs, l => l.args.proposalId).args.proposalId;
      let proposal = await proposalManager.proposals(proposalId);
      assert.equal(proposal.status, 1);

      await this.ppFeeRegistry.setContractEthFeeKeysAndValues(
        proposalManager.address,
        [await proposalManager.VOTE_FEE_KEY()],
        [ether(0.2)],
        {
          from: feeManager
        }
      );

      await assertRevert(
        proposalManager.aye(proposalId, true, { from: bob, value: ether(0.1) }),
        'Fee and msg.value not equal'
      );
      await proposalManager.aye(proposalId, true, { from: bob, value: ether(0.2), gas: 1000000 });
      proposal = await proposalManager.proposals(proposalId);
      assert.equal(proposal.status, 2);

      assert.equal(await token.ownerOf(aliceTokenId), dan);

      const blockAfterWithdraw = await web3.eth.getBlockNumber();

      assert.equal(await locker.reputationOfAt(alice, blockBeforeWithdraw), ether(50));
      assert.equal(await locker.reputationOf(bob, blockBeforeWithdraw), ether(50));

      assert.equal(await locker.reputationOfAt(alice, blockAfterWithdraw), ether(0));
      assert.equal(await locker.reputationOf(bob, blockAfterWithdraw), ether(0));

      await token.approve(locker.address, aliceTokenId, { from: dan });
      await locker.deposit(token.address, aliceTokenId, [dan], ['1'], '1', { from: dan });

      const blockAfterDeposit = await web3.eth.getBlockNumber();

      assert.equal(await locker.reputationOf(alice), ether(0));
      assert.equal(await locker.reputationOf(bob), ether(0));
      assert.equal(await locker.reputationOf(dan), ether(100));

      assert.equal(await locker.reputationOfAt(alice, blockBeforeWithdraw), ether(50));
      assert.equal(await locker.reputationOf(bob, blockBeforeWithdraw), ether(50));
      assert.equal(await locker.reputationOf(dan, blockBeforeWithdraw), ether(0));

      assert.equal(await locker.reputationOfAt(alice, blockAfterWithdraw), ether(0));
      assert.equal(await locker.reputationOf(bob, blockAfterWithdraw), ether(0));
      assert.equal(await locker.reputationOf(dan, blockAfterWithdraw), ether(0));

      assert.equal(await locker.reputationOfAt(alice, blockAfterDeposit), ether(0));
      assert.equal(await locker.reputationOf(bob, blockAfterDeposit), ether(0));
      assert.equal(await locker.reputationOf(dan, blockAfterDeposit), ether(100));
    });
  });
});
