import { updateMotionByHash } from "../../mongo/service/motion.js";
import { BountyStatus, CouncilEvents, TimelineItemTypes, TreasuryProposalEvents } from "../../../tools/constants.js";
import { updateProposal } from "../../mongo/service/treasuryProposal.js";
import { getAlertCollection, getMotionCollection, getProposalCollection, getUserCollection } from "../../mongo/index.js";
import { botParams } from "../../../config.js";
import { InlineKeyboard } from "grammy";
import { escapeMarkdown, getAccountName, send } from "../../../tools/utils.js";

const sendDisapprovedMessages = async (motion) => {
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
              "beneficiary and proposer has just been rejected\\!\n\n" +
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
            "beneficiary has just been rejected\\!\n\n" +
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
            "proposer has just been rejected\\!\n\n" +
            `*Proposal Index*: _${proposalMotion.index}_`;
          await send(user.chatId, message, "MarkdownV2", inlineKeyboard);
        }
      }
    }
  }
};

async function handleProposal(treasuryProposalIndex, indexer) {
  const state = {
    indexer,
    // If a treasury proposal motion is not passed, we reset the treasury proposal state to `Proposed`
    state: TreasuryProposalEvents.Proposed,
  };

  await updateProposal(treasuryProposalIndex, { state });
}

async function handleBusinessWhenMotionDisapproved(motionHash, indexer) {
  const col = await getMotionCollection();
  const motion = await col.findOne({ hash: motionHash, isFinal: false });
  if (!motion) {
    return;
  }

  for (const { index } of motion.treasuryProposals || []) {
    await handleProposal(index, indexer);
  }
  sendDisapprovedMessages(motion)

}

export const handleDisapproved = async (event, extrinsic, indexer) => {
  const eventData = event.data.toJSON();
  const [hash] = eventData;

  const state = {
    state: CouncilEvents.Disapproved,
    data: eventData,
    indexer,
  };

  const timelineItem = {
    type: TimelineItemTypes.event,
    method: CouncilEvents.Disapproved,
    args: {
      hash,
    },
    indexer,
  };

  await handleBusinessWhenMotionDisapproved(hash, indexer);
  const updates = { state, isFinal: true };
  await updateMotionByHash(hash, updates, timelineItem);
};