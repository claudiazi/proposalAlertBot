import { getProposalCollection } from "../index.js";

export const insertProposal = async (proposalObj) => {
    const col = await getProposalCollection();
    const { proposalIndex } = proposalObj;
    const maybeInDb = await col.findOne({ proposalIndex });
    if (maybeInDb) {
        return;
    }

    await col.insertOne(proposalObj);
};

export const updateProposal = async (proposalIndex, updates, timelineItem?, motionInfo?) => {
    const col = await getProposalCollection();
    let update = {
        $set: updates,
        $push: {}
    };

    if (timelineItem) {
        update = {
            ...update,
            $push: { timeline: timelineItem },
        };
    }

    if (motionInfo) {
        update = {
            ...update,
            $push: { motions: motionInfo }
        };
    }

    await col.updateOne({ proposalIndex }, update);
    
};