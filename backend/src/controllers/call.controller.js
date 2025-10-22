import Call from "../models/call.model.js";
import { fetchArchivedCalls } from "../lib/archiver.js";

// Save a call record
export const addCall = async (req, res) => {
  try {
    const { receiver, type, direction, status, startedAt, endedAt, duration } = req.body;
    const caller = req.user._id;
    const call = await Call.create({
      caller,
      receiver,
      type,
      direction,
      status,
      startedAt,
      endedAt,
      duration,
    });
    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all call records for the logged-in user
export const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 100));
    const before = req.query.before; // ISO date or callId

    const query = { $or: [{ caller: userId }, { receiver: userId }] };
    if (before) {
      if (!isNaN(Date.parse(before))) {
        query.startedAt = { $lt: new Date(before) };
      } else if (/^[0-9a-fA-F]{24}$/.test(before)) {
        query._id = { $lt: before };
      }
    }

    let dbCalls = await Call.find(query)
      .sort({ startedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    let dbHasMore = false;
    if (dbCalls.length > limit) {
      dbHasMore = true;
      dbCalls = dbCalls.slice(0, limit);
    }

    // Oldest first for UI
    dbCalls = dbCalls.reverse();

    let combined = [...dbCalls];
    let hasMore = dbHasMore;
    if (!dbHasMore && before) {
      const remaining = Math.max(0, limit - combined.length);
      if (remaining > 0) {
        const { calls: archived, hasMore: arcMore } = await fetchArchivedCalls({
          userId,
          before,
          limit: remaining,
        });
        combined = [...archived, ...combined];
        hasMore = arcMore;
      }
    }

    res.status(200).json({ calls: combined, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a call record by ID
export const deleteCall = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const call = await Call.findById(id);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }
    // Only allow caller or receiver to delete
    if (
      String(call.caller) !== String(userId) &&
      String(call.receiver) !== String(userId)
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await call.deleteOne();
    res.status(200).json({ success: true, message: "Call deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 