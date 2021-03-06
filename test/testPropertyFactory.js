const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPToken = contract.fromArtifact('PPToken');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPACL = contract.fromArtifact('PPACL');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const _ = require('lodash');

const { ether, gwei, assertRevert, assertEthBalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe('PPTokenFactory', () => {
  const [alice, anywhere] = accounts;
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

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);

    await this.ppTokenFactory.setFeeManager(owner);
    await this.ppTokenFactory.setFeeCollector(owner);
    await this.ppTokenFactory.setEthFee(ethFee);
    await this.ppTokenFactory.setGaltFee(galtFee);
  });

  it('should correctly accept GALT fee', async function() {
    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    await this.galtToken.approve(this.ppTokenFactory.address, galtFee, { from: alice });
    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice
    });

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), galtFee);

    await this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere);
    await assertRevert(this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere, { from: alice }));

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    assert.equal(await this.galtToken.balanceOf(anywhere), galtFee);
  });

  it('should correctly accept ETH fee', async function() {
    const aliceBalanceBefore = await web3.eth.getBalance(alice);
    let factoryBalanceBefore = await web3.eth.getBalance(this.ppTokenFactory.address);

    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice,
      value: ethFee,
      gasPrice: gwei(0.1)
    });

    const aliceBalanceAfter = await web3.eth.getBalance(alice);
    let factoryBalanceAfter = await web3.eth.getBalance(this.ppTokenFactory.address);

    assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, `-${ethFee}`);
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, ethFee);

    const anyoneBalanceBefore = await web3.eth.getBalance(anywhere);
    factoryBalanceBefore = await web3.eth.getBalance(this.ppTokenFactory.address);

    await this.ppTokenFactory.withdrawEth(anywhere);
    await assertRevert(this.ppTokenFactory.withdrawEth(anywhere, { from: alice }));

    const anyoneBalanceAfter = await web3.eth.getBalance(anywhere);
    factoryBalanceAfter = await web3.eth.getBalance(this.ppTokenFactory.address);

    assertEthBalanceChanged(anyoneBalanceBefore, anyoneBalanceAfter, ethFee);
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, `-${ethFee}`);
  });

  it('should correctly set fees', async function() {
    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    await this.galtToken.approve(this.ppTokenFactory.address, galtFee, { from: alice });

    const inputLockerFee = ether(10);

    const res = await this.ppTokenFactory.build(
      'Buildings',
      'BDL',
      registryDataLink,
      ONE_HOUR,
      [utf8ToHex('LOCKER_ETH')],
      [inputLockerFee],
      utf8ToHex(''),
      { from: alice }
    );

    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);

    const controller = await PPTokenController.at(await token.controller());

    const resultLockerFee = await controller.fees(utf8ToHex('LOCKER_ETH'));

    assert.equal(inputLockerFee, resultLockerFee);
  });
});
