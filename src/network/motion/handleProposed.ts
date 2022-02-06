import { CouncilEvents, TimelineItemTypes } from "../../../tools/constants.js";
import { getMotionCall, getMotionProposalCall, getMotionVoting, handleWrappedCall, isProposalMotion } from "./motionHelpers.js";
import { handleBusinessWhenMotionProposed } from "./handleMotionBusiness.js";
import { insertMotion } from "../../mongo/service/motion.js";
import { getAlertCollection, getProposalCollection, getUserCollection } from "../../mongo/index.js";
import { botParams } from "../../../config.js";
import { InlineKeyboard } from "grammy";
import { escapeMarkdown, getAccountName, send } from "../../../tools/utils.js";

const sendNewMessages = async (motion) => {
    const alertCol = await getAlertCollection();
    const userCol = await getUserCollection();
    const chain = botParams.settings.network.name.toLowerCase();
    const inlineKeyboard = new InlineKeyboard().url("PolkAssembly",
        `https://${chain}.polkassembly.io/motion/${motion.index}`);
    for (const proposalMotion of motion.treasuryProposals) {
        const proposalIndex = proposalMotion.index
        const proposalCol = await getProposalCollection();
        const proposal = await proposalCol.findOne({ proposalIndex })
        if (proposal.proposer === proposal.beneficiary) {
            const alerts = await alertCol.find(
                { address: proposal.beneficiary }
            ).toArray();
            for (const alert of alerts) {
                if (alert && alert.new) {
                    const user = await userCol.findOne({ chatId: alert.chatId });
                    if (user && !user.blocked) {
                        const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                            "A motion has just been created for a proposal of which this wallet is " +
                            "beneficiary and proposer\\.\n\n" +
                            `*Proposal Index*: _${proposalMotion.index}_`;
                        await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                    }
                }
            }
            return;
        }
        const alertsBeneficiary = await alertCol.find(
            { address: proposal.beneficiary }
        ).toArray();
        for (const alertBeneficiary of alertsBeneficiary) {
            if (alertBeneficiary && alertBeneficiary.new) {
                const user = await userCol.findOne({ chatId: alertBeneficiary.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "A motion has just been created for a proposal of which this wallet is " +
                        "beneficiary\\.\n\n" +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
        const alertsProposer = await alertCol.find(
            { address: proposal.proposer }
        ).toArray();
        for (const alertProposer of alertsProposer) {
            if (alertProposer && alertProposer.new) {
                const user = await userCol.findOne({ chatId: alertProposer.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "A motion has just been created for a proposal of which this wallet is " +
                        "proposer\\.\n\n" +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
    }

};


export const handleProposed = async (event, extrinsic, indexer, blockEvents) => {
    const eventData = event.data.toJSON();
    const [proposer, motionIndex, hash, threshold] = eventData;

    const rawProposal = await getMotionCall(hash, indexer);
    const proposalCall = await getMotionProposalCall(hash, indexer);
    const voting = await getMotionVoting(indexer.blockHash, hash);

    const timelineItem = {
        type: TimelineItemTypes.event,
        method: CouncilEvents.Proposed,
        args: {
            proposer,
            index: motionIndex,
            hash,
            threshold,
        },
        indexer,
    };

    const state = {
        indexer,
        state: CouncilEvents.Proposed,
        data: eventData,
    };

    const treasuryProposals = [];
    const others = [];
    await handleWrappedCall(
        rawProposal,
        proposer,
        indexer,
        blockEvents,
        async (call) => {
            const { section, method, args } = call;
            if (isProposalMotion(section, method)) {
                const treasuryProposalIndex = args[0].toJSON();
                treasuryProposals.push({
                    index: treasuryProposalIndex,
                    method,
                });

            }
        },
    );
    const obj = {
        indexer,
        hash,
        proposer,
        index: motionIndex,
        threshold,
        proposal: proposalCall,
        voting,
        isFinal: false,
        state,
        timeline: [timelineItem],
        treasuryProposals,
        others
    };
    //is new
    await insertMotion(obj) 

    await handleBusinessWhenMotionProposed(obj, rawProposal, indexer, blockEvents);

    sendNewMessages(obj)
};