const _ = require('lodash');
const { assert } = require('chai');
const { hexToAscii } = require('web3-utils');

module.exports = contract => {
  const LockerProposalManager = contract.fromArtifact('LockerProposalManager');
  return {
    async withdrawLockerProposal(locker, newOwner, depositManager, options) {
      const proposalData = locker.contract.methods.withdraw(newOwner, depositManager).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async burnLockerProposal(locker, fundRa, options) {
      const proposalData = locker.contract.methods.burn(fundRa.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async approveBurnLockerProposal(locker, fundRa, options) {
      const proposalData = fundRa.contract.methods.approveBurn(locker.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(fundRa.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async mintLockerProposal(locker, fundRA, options) {
      const proposalData = fundRA.contract.methods.mint(locker.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(fundRA.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async approveMintLockerProposal(locker, fundRA, options) {
      const proposalData = locker.contract.methods.approveMint(fundRA.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async approveAndMintLockerProposal(locker, fundRA, options) {
      const proposalData = locker.contract.methods.approveAndMint(fundRA.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async burnWithReputationLockerProposal(locker, fundRA, options) {
      const proposalData = locker.contract.methods.burnWithReputation(fundRA.address).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async changeOwnersLockerProposal(locker, owners, shares, totalShares, options) {
      const proposalData = locker.contract.methods.changeOwners(owners, shares, totalShares).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async changeLockerProposalManagerProposal(locker, newProposalManager, options) {
      const proposalData = locker.contract.methods.setProposalManager(newProposalManager).encodeABI();
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const res = await proposalManager.propose(locker.address, '0', true, true, false, proposalData, '', options);
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async ayeLockerProposal(locker, proposalId, options) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      return proposalManager.aye(proposalId, true, options);
    },
    async nayLockerProposal(locker, proposalId, options) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      return proposalManager.nay(proposalId, options);
    },
    async abstainLockerProposal(locker, proposalId, options) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      return proposalManager.abstain(proposalId, true, options);
    },
    async getLockerProposal(locker, proposalId) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      return proposalManager.proposals(proposalId);
    },
    async setDefaultProposalConfig(locker, _support, _minAcceptQuorum, _timeout, _committingTimeout, options) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const proposalData = proposalManager.contract.methods
        .setDefaultProposalConfig(_support, _minAcceptQuorum, _timeout, _committingTimeout)
        .encodeABI();
      const res = await proposalManager.propose(
        proposalManager.address,
        '0',
        true,
        true,
        false,
        proposalData,
        '',
        options
      );
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async setProposalConfig(locker, _marker, _support, _minAcceptQuorum, _timeout, _committingTimeout, options) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const proposalData = proposalManager.contract.methods
        .setProposalConfig(_marker, _support, _minAcceptQuorum, _timeout, _committingTimeout)
        .encodeABI();
      const res = await proposalManager.propose(
        proposalManager.address,
        '0',
        true,
        true,
        false,
        proposalData,
        '',
        options
      );
      return _.find(res.logs, l => l.args.proposalId).args.proposalId;
    },
    async getLockerProposalVotingProgress(locker, proposalId) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      return proposalManager.getProposalVotingProgress(proposalId);
    },
    async validateProposalSuccess(locker, proposalId) {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const proposal = await proposalManager.proposals(proposalId);
      assert.equal(proposal.status, '2');
    },
    async validateProposalError(locker, proposalId, errorMessage = '') {
      const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      const proposal = await proposalManager.proposals(proposalId);
      assert.equal(proposal.status, '1');
      const executeResult = await proposalManager.executeProposal(proposalId, '0');
      assert.equal(hexToAscii(executeResult.logs[0].args.response).indexOf(errorMessage) > -1, true);
    }
  };
};
