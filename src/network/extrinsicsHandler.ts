import { GenericCall } from "@polkadot/types";
import { logger } from "../../tools/logger.js";
import { Modules, MultisigMethods, ProxyMethods, SudoMethods, TipMethods, UtilityMethods } from "../../tools/constants.js";
import { calcMultisigAddress, isExtrinsicSuccess, tryInitCall } from "../../tools/utils.js";
import { hexToU8a } from "@polkadot/util";
import { botParams } from "../../config.js";

const extractExtrinsicEvents = (events, extrinsicIndex) => {
    return events.filter((event) => {
        const { phase } = event;
        return !phase.isNull && phase.value.toNumber() === extrinsicIndex;
    });
};

const handleCall = async (call, author, extrinsicIndexer, events) => {
    // await handleTipCall(call, author, extrinsicIndexer);
    // await handleAcceptCurator(call, author, extrinsicIndexer);
}

const unwrapProxy = async (call, signer, extrinsicIndexer, events) => {
    const real = call.args[0].toJSON();
    const innerCall = call.args[2];
    await handleWrappedCall(innerCall, real, extrinsicIndexer, events);
}

const handleMultisig = async (call, signer, extrinsicIndexer, events) => {
    const registry = await botParams.api.getBlockRegistry(hexToU8a(extrinsicIndexer.blockHash));
    //const registry = await findRegistry(extrinsicIndexer);
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
        logger.error(`error when parse multiSig`, extrinsicIndexer);
        return;
    }

    await handleWrappedCall(innerCall, multisigAddr, extrinsicIndexer);
}

const unwrapBatch = async (call, signer, extrinsicIndexer, events) => {
    // TODO: not handle call after the BatchInterrupted event
    for (const innerCall of call.args[0]) {
        await handleWrappedCall(innerCall, signer, extrinsicIndexer, events);
    }
}

const unwrapSudo = async (call, signer, extrinsicIndexer, events) => {
    const innerCall = call.args[0];
    await handleWrappedCall(innerCall, signer, extrinsicIndexer, events);
}

const handleWrappedCall = async (call, signer, extrinsicIndexer, events?) => {
    const { section, method } = call;

    if (Modules.Proxy === section && ProxyMethods.proxy === method) {
        await unwrapProxy(call, signer, extrinsicIndexer, events);
    } else if (
        Modules.Multisig === section &&
        MultisigMethods.asMulti === method
    ) {
        await handleMultisig(call, signer, extrinsicIndexer, events);
    } else if (Modules.Utility === section && UtilityMethods.batch === method) {
        await unwrapBatch(call, signer, extrinsicIndexer, events);
    } else if (Modules.Sudo === section && SudoMethods.sudo) {
        await unwrapSudo(call, signer, extrinsicIndexer, events);
    }

    await handleCall(call, signer, extrinsicIndexer, events);
}

const extractAndHandleCall = async (extrinsic, events = [], extrinsicIndexer) => {
    const signer = extrinsic.signer.toString();
    const call = extrinsic.method;

    await handleWrappedCall(call, signer, extrinsicIndexer, events);
}

export const handleExtrinsics = async (extrinsics = [], allEvents = [], blockIndexer) => {
    let index = 0;
    for (const extrinsic of extrinsics) {
        const events = extractExtrinsicEvents(allEvents, index);
        const extrinsicIndexer = { ...blockIndexer, extrinsicIndex: index++ };

        if (!isExtrinsicSuccess(events)) {
            continue;
        }

        await extractAndHandleCall(extrinsic, events, extrinsicIndexer);
    }
}