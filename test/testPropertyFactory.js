const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

const { ether, gwei, assertRevert, assertEthBalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

contract('PPTokenFactory', accounts => {
  const [owner, alice, anywhere] = accounts;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

    this.ppGlobalRegistry = await PPGlobalRegistry.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppGlobalRegistry.address, this.galtToken.address, 0, 0);
    await this.ppGlobalRegistry.setFactory(this.ppTokenFactory.address);

    await this.ppTokenFactory.setFeeManager(owner);
    await this.ppTokenFactory.setFeeCollector(owner);
    await this.ppTokenFactory.setEthFee(ethFee);
    await this.ppTokenFactory.setGaltFee(galtFee);
  });

  it('should correctly accept GALT fee', async function() {
    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    await this.galtToken.approve(this.ppTokenFactory.address, galtFee, { from: alice });
    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, { from: alice });

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), galtFee);

    await this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere);
    await assertRevert(this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere, { from: alice }));

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    assert.equal(await this.galtToken.balanceOf(anywhere), galtFee);
  });

  it('should correctly accept ETH fee', async function() {
    const aliceBalanceBefore = await web3.eth.getBalance(alice);
    let factoryBalanceBefore = await web3.eth.getBalance(this.ppTokenFactory.address);

    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, {
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
});
