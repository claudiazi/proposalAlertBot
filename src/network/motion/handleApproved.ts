import { updateMotionByHash } from "../../mongo/service/motion.js";
import { CouncilEvents, TimelineItemTypes, TreasuryProposalMethods } from "../../../tools/constants.js";
import { updateProposal } from "../../mongo/service/treasuryProposal.js";
import { getAlertCollection, getMotionCollection, getProposalCollection, getUserCollection } from "../../mongo/index.js";
import { botParams } from "../../../config.js";
import { InlineKeyboard } from "grammy";
import { escapeMarkdown, getAccountName, send } from "../../../tools/utils.js";


const sendApprovedMessages = async (motion) => {
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
                if (alert && alert.done) {
                    const user = await userCol.findOne({ chatId: alert.chatId });
                    if (user && !user.blocked) {
                        const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                            "The motion created for a proposal of which this wallet is " +
                            "beneficiary and proposer has just been approved\\!\n\n" +
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
            if (alertBeneficiary && alertBeneficiary.done) {
                const user = await userCol.findOne({ chatId: alertBeneficiary.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "The motion created for a proposal of which this wallet is " +
                        "beneficiary has just been approved\\!\n\n" +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
        const alertsProposer = await alertCol.find(
            { address: proposal.proposer }
        ).toArray();
        for (const alertProposer of alertsProposer) {
            if (alertProposer && alertProposer.done) {
                const user = await userCol.findOne({ chatId: alertProposer.chatId });
                if (user && !user.blocked) {
                    const message = `*Alert for ${escapeMarkdown(await getAccountName(proposal.beneficiary, true))}*\n\n` +
                        "The motion created for a proposal of which this wallet is " +
                        "proposer has just been approved\\!\n\n" +
                        `*Proposal Index*: _${proposalMotion.index}_`;
                    await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
                }
            }
        }
    }

};

const handleProposal = async (proposalInfo, indexer) => {
    const { index: treasuryProposalIndex, method } = proposalInfo;

    const isApproved = TreasuryProposalMethods.approveProposal === method;
    if (!isApproved) {
        return;
    }

    const state = {
        indexer,
        state: CouncilEvents.Approved,
    };

    await updateProposal(treasuryProposalIndex, { state });
};

const handleBusinessWhenMotionApproved = async (motionHash, indexer) => {
    const col = await getMotionCollection();
    const motion = await col.findOne({ hash: motionHash, isFinal: false });
    if (!motion) {
        return;
    }

    for (const proposalInfo of motion.treasuryProposals || []) {
        await handleProposal(proposalInfo, indexer);
    }
    sendApprovedMessages(motion)
};

export const handleApproved = async (event, extrinsic, indexer) => {
    const eventData = event.data.toJSON();
    const [hash] = eventData;

    const state = {
        state: CouncilEvents.Approved,
        data: eventData,
        indexer,
    };

    const timelineItem = {
        type: TimelineItemTypes.event,
        method: CouncilEvents.Approved,
        args: {
            hash,
        },
        indexer,
    };

    const updates = { state };
    await updateMotionByHash(hash, updates, timelineItem);
    await handleBusinessWhenMotionApproved(hash, indexer);
};