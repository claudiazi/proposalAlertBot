import { updateMotionByHash } from "../../mongo/service/motion.js";
import { CouncilEvents, MotionState, TimelineItemTypes, TreasuryProposalMethods } from "../../../tools/constants.js";
import { getMotionVoting } from "./motionHelpers.js";
import { logger } from "../../../tools/logger.js";
import { updateProposal } from "../../mongo/service/treasuryProposal.js";
import { getAlertCollection, getMotionCollection, getProposalCollection, getUserCollection } from "../../mongo/index.js";
import { botParams } from "../../../config.js";
import { InlineKeyboard } from "grammy";
import { escapeMarkdown, getAccountName, send } from "../../../tools/utils.js";

const sendVotedMessages = async (motion, timelineItem) => {
    const alertCol = await getAlertCollection();
    const userCol = await getUserCollection();
    const chain = botParams.settings.network.name.toLowerCase();
    const inlineKeyboard = new InlineKeyboard().url("PolkAssembly",
        `https://${chain}.polkassembly.io/motion/${motion.index}`);
    for (const proposalMotion of motion.treasuryProposals) {
        const proposalIndex = proposalMotion.index
        const proposalCol = await getProposalCollection();
        const proposal = await proposalCol.findOne({ proposalIndex })
        const voter = timelineItem.args.voter
        const vote = timelineItem.args.approve
        if (proposal.proposer === proposal.beneficiary) {
            const alerts = await alertCol.find(
                { address: proposal.beneficiary }
            ).toArray();
            for (const alert of alerts) {
                if (alert && alert.voted) {
                    const user = await userCol.findOne({ chatId: alert.chatId });
                    if (user && !user.blocked) {
                        const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                            "The motion created for a proposal of which this wallet is " +
                            "beneficiary and proposer has just received a vote by " +
                            `${escapeMarkdown(await getAccountName(voter, true))}\\.\n\n` +
                            `Vote: ${vote ? "aye" : "nay"}\n\n` +
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
            if (alertBeneficiary && alertBeneficiary.voted) {
                const user = await userCol.findOne({ chatId: alertBeneficiary.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "The motion created for a proposal of which this wallet is " +
                        "beneficiary has just received a vote by " +
                        `${escapeMarkdown(await getAccountName(voter, true))}\\.\n\n` +
                        `Vote: ${vote ? "aye" : "nay"}\n\n` +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
        const alertsProposer = await alertCol.find(
            { address: proposal.proposer }
        ).toArray();
        for (const alertProposer of alertsProposer) {
            if (alertProposer && alertProposer.voted) {
                const user = await userCol.findOne({ chatId: alertProposer.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "The motion created for a proposal of which this wallet is " +
                        "proposer has just received a vote by " +
                        `${escapeMarkdown(await getAccountName(voter, true))}\\.\n\n` +
                        `Vote: ${vote ? "aye" : "nay"}\n\n` +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
    }

};

const getState = (name, motion, voting, indexer) => {
    return {
        indexer,
        state: name,
        data: {
            motionState: motion.state,
            motionVoting: voting,
        },
    };
}

const updateProposalState = async (proposalInfo, motion, voting, indexer) => {
    const { index: proposalIndex, method } = proposalInfo;
    const stateName =
        method === TreasuryProposalMethods.approveProposal
            ? MotionState.ApproveVoting
            : MotionState.RejectVoting;

    const state = getState(stateName, motion, voting, indexer);

    logger.info('proposal state updated by motion voted', indexer);
    await updateProposal(proposalIndex, { state });
}

const handleBusinessWhenMotionVoted = async (motionHash, voting, indexer, timelineItem) => {
    const col = await getMotionCollection();
    const motion = await col.findOne({ hash: motionHash });
    if (!motion) {
        logger.error(`cannot find motion when handle motion voted business, hash: ${motionHash}`, indexer);
        return;
    }

    for (const proposalInfo of motion.treasuryProposals || []) {
        await updateProposalState(proposalInfo, motion, voting, indexer);
    }
    sendVotedMessages(motion, timelineItem)
}

export const handleVoted = async (event, extrinsic, indexer) => {
    const eventData = event.data.toJSON();
    const [voter, hash, approve,] = eventData;

    const voting = await getMotionVoting(indexer.blockHash, hash);
    const updates = { voting };
    const timelineItem = {
        type: TimelineItemTypes.event,
        method: CouncilEvents.Voted,
        args: {
            voter,
            hash,
            approve,
        },
        indexer,
    };

    await updateMotionByHash(hash, updates, timelineItem);
    await handleBusinessWhenMotionVoted(hash, voting, indexer, timelineItem);
};