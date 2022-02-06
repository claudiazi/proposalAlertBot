import { GenericCall } from "@polkadot/types";
import { hexToU8a } from "@polkadot/util";
import { calcMultisigAddress, normalizeCall } from "../../../tools/utils.js";
import { botParams } from "../../../config.js";
import { getMotionCollection } from "../../mongo/index.js";
import { logger } from "../../../tools/logger.js";
import { BountyMethods, Modules, MultisigMethods, ProxyMethods, SudoMethods, TreasuryProposalMethods, UtilityMethods } from "../../../tools/constants.js";

export const getOutstandingMotions = async (address) => {
    const motionCol = await getMotionCollection();
    let outstandingMotions = [];
    const openMotions = await motionCol.find({ isFinal: false }).toArray();
    for (const motion of openMotions) {
        const voted = motion.voting.ayes.includes(address) || motion.voting.nays.includes(address);
        if (!voted) {
            outstandingMotions.push(motion);
        }
    }
    return outstandingMotions;
};

export const getMotionProposal = async (blockHash, motionHash) => {
    const blockApi = await botParams.api.at(blockHash);
    return await blockApi.query.council.proposalOf(motionHash);
};

export const getMotionCall = async (motionHash, indexer) => {
    const raw = await getMotionProposal(indexer.blockHash, motionHash);
    const registry = await botParams.api.getBlockRegistry(hexToU8a(indexer.blockHash));
    //const registry = await findRegistry(indexer);
    return new GenericCall(registry.registry, raw.toHex());
};

export const getMotionProposalCall = async (motionHash, indexer) => {
    const raw = await getMotionProposal(indexer.blockHash, motionHash);
    const registry = await botParams.api.getBlockRegistry(hexToU8a(indexer.blockHash));
    //const registry = await findRegistry(indexer);
    return normalizeCall(new GenericCall(registry.registry, raw.toHex()));
};

export const getMotionVoting = async (blockHash, motionHash) => {
    const blockApi = await botParams.api.at(blockHash);

    const raw = await blockApi.query.council.voting(motionHash);
    return raw.toJSON();
};

export const getMotionVotingFromStorageByHeight = async (motionHash, blockHeight) => {
    const blockHash = await botParams.api.rpc.chain.getBlockHash(blockHeight);
    return await getMotionVoting(blockHash, motionHash);
  }

export const unwrapProxy = async (call, signer, indexer, events, cb) => {
    const real = call.args[0].toJSON();
    const innerCall = call.args[2];
    await handleWrappedCall(innerCall, real, indexer, events, cb);
};

export const handleMultisig = async (call, signer, indexer, events, cb) => {
    const registry = await botParams.api.getBlockRegistry(hexToU8a(indexer.blockHash));
    const callHex = call.args[3];
    const threshold = call.args[0].toNumber();
    const otherSignatories = call.args[1].toJSON();
    const multisigAddr = calcMultisigAddress(
        [signer, ...otherSignatories],
        threshold,
        registry.registry.chainSS58
    );

    let innerCall;
    try {
        innerCall = new GenericCall(registry.registry, callHex);
    } catch (e) {
        logger.error(`error when parse multiSig`, indexer);
        return;
    }

    await handleWrappedCall(innerCall, multisigAddr, indexer, events, cb);
};

export const unwrapBatch = async (call, signer, indexer, events, cb) => {
    // TODO: not handle call after the BatchInterrupted event
    for (const innerCall of call.args[0]) {
        await handleWrappedCall(innerCall, signer, indexer, events, cb);
    }
};

export const unwrapSudo = async (call, signer, indexer, events, cb) => {
    const innerCall = call.args[0];
    await handleWrappedCall(innerCall, signer, indexer, events, cb);
};

export const handleWrappedCall = async (call, signer, indexer, events, callback) => {
    const { section, method } = call;

    if (Modules.Proxy === section && ProxyMethods.proxy === method) {
        await unwrapProxy(call, signer, indexer, events, callback);
    } else if (
        Modules.Multisig === section &&
        MultisigMethods.asMulti === method
    ) {
        await handleMultisig(call, signer, indexer, events, callback);
    } else if (Modules.Utility === section && UtilityMethods.batch === method) {
        await unwrapBatch(call, signer, indexer, events, callback);
    } else if (Modules.Sudo === section && SudoMethods.sudo) {
        await unwrapSudo(call, signer, indexer, events, callback);
    }

    await callback(call, signer, indexer, events);
};

export const isProposalMotion = (section, method) => {
    return Modules.Treasury === section &&
        [
            TreasuryProposalMethods.approveProposal,
            TreasuryProposalMethods.rejectProposal,
        ].includes(method);
};