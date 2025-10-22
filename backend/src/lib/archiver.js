import { gzipSync, gunzipSync } from "zlib";
import { createHash } from "crypto";
import { getStorageBucket } from "./firebase.js";
import Archive from "../models/archive.model.js";
import Message from "../models/message.model.js";
import Call from "../models/call.model.js";

function floorToUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDay(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildChatKey(a, b) {
  const x = String(a);
  const y = String(b);
  return [x, y].sort().join("_");
}

function jsonlGzip(items) {
  const jsonl = items.map((it) => JSON.stringify(it)).join("\n");
  const buf = Buffer.from(jsonl, "utf8");
  return gzipSync(buf);
}

async function saveToBucket(storagePath, buffer) {
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: {
      contentType: "application/json",
      contentEncoding: "gzip",
    },
    resumable: false,
    validation: false,
  });
  const [meta] = await file.getMetadata();
  return meta;
}

export async function archiveOldData({ days = 3, batchLimit = 2000 } = {}) {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // --- Direct Messages ---
  const directOld = await Message.find({ groupId: { $exists: false }, createdAt: { $lt: threshold } })
    .select("senderId receiverId text image video audio document fileName deletedFor isDeletedForEveryone createdAt updatedAt delivered deliveredAt seen seenAt readBy replyTo replyToText replyToSenderName")
    .sort({ createdAt: 1 })
    .limit(batchLimit)
    .lean();

  await archiveByGrouping(directOld, (m) => ({
    category: "direct",
    chatKey: buildChatKey(m.senderId, m.receiverId),
    day: floorToUtcDay(m.createdAt),
    storageBase: (group) => `archives/messages/direct/${group.chatKey}/${formatDay(group.day)}.jsonl.gz`,
  }));

  // --- Group Messages ---
  const groupOld = await Message.find({ groupId: { $exists: true, $ne: null }, createdAt: { $lt: threshold } })
    .select("groupId senderId text image video audio document fileName deletedFor isDeletedForEveryone createdAt updatedAt delivered deliveredAt seen seenAt readBy replyTo replyToText replyToSenderName")
    .sort({ createdAt: 1 })
    .limit(batchLimit)
    .lean();

  await archiveByGrouping(groupOld, (m) => ({
    category: "group",
    groupId: m.groupId,
    day: floorToUtcDay(m.createdAt),
    storageBase: (group) => `archives/messages/group/${String(group.groupId)}/${formatDay(group.day)}.jsonl.gz`,
  }));

  // --- Calls (per-user) ---
  const callOld = await Call.find({ startedAt: { $lt: threshold } })
    .select("caller receiver type direction status startedAt endedAt duration createdAt updatedAt")
    .sort({ startedAt: 1 })
    .limit(batchLimit)
    .lean();

  // Duplicate each call for caller and receiver manifests (so each user has their own archive)
  const perUserRecords = [];
  for (const c of callOld) {
    perUserRecords.push({ ...c, __userKey: String(c.caller) });
    perUserRecords.push({ ...c, __userKey: String(c.receiver) });
  }
  await archiveByGrouping(perUserRecords, (c) => ({
    category: "call",
    chatKey: c.__userKey,
    day: floorToUtcDay(c.startedAt || c.createdAt),
    storageBase: (group) => `archives/calls/user/${group.chatKey}/${formatDay(group.day)}.jsonl.gz`,
  }));
}

async function archiveByGrouping(records, groupingFn) {
  if (!records || records.length === 0) return;

  // Group records by key+day
  const buckets = new Map();
  for (const r of records) {
    const g = groupingFn(r);
    const key = JSON.stringify({
      category: g.category,
      chatKey: g.chatKey || null,
      groupId: g.groupId || null,
      day: g.day.toISOString(),
    });
    const arr = buckets.get(key) || [];
    arr.push(r);
    buckets.set(key, arr);
  }

  // Process each bucket: skip if archive exists for that day
  for (const [key, items] of buckets.entries()) {
    const { category, chatKey, groupId, day } = JSON.parse(key);
    const dayDate = new Date(day);
    const startAt = new Date(items[0].createdAt || items[0].startedAt || dayDate);
    const endAt = new Date(items[items.length - 1].createdAt || items[items.length - 1].startedAt || dayDate);

    const existing = await Archive.findOne({ category, chatKey, groupId, day: dayDate });
    if (existing) continue; // already archived this day

    const storagePath = items[0].storageBase
      ? items[0].storageBase({ category, chatKey, groupId, day: dayDate })
      : // recreate same logic as groupingFn
        (category === "direct"
          ? `archives/messages/direct/${chatKey}/${formatDay(dayDate)}.jsonl.gz`
          : category === "group"
          ? `archives/messages/group/${String(groupId)}/${formatDay(dayDate)}.jsonl.gz`
          : `archives/calls/user/${chatKey}/${formatDay(dayDate)}.jsonl.gz`);

    // Remove helper fields before persisting
    const serializable = items.map(({ __userKey, ...rest }) => rest);

    const buffer = jsonlGzip(serializable);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const meta = await saveToBucket(storagePath, buffer);

    await Archive.create({
      category,
      chatKey: chatKey || null,
      groupId: groupId || null,
      day: dayDate,
      startAt,
      endAt,
      storagePath,
      recordCount: serializable.length,
      compressedBytes: Number(meta.size || buffer.length),
      uncompressedBytes: buffer.length, // approximate
      checksum,
    });

    // Delete archived records from Mongo
    if (category === "direct" || category === "group") {
      const ids = serializable.map((m) => m._id).filter(Boolean);
      if (ids.length) await Message.deleteMany({ _id: { $in: ids } });
    } else if (category === "call") {
      const callIds = serializable.map((c) => c._id).filter(Boolean);
      if (callIds.length) await Call.deleteMany({ _id: { $in: callIds } });
    }
  }
}

async function downloadAndParse(storagePath) {
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);
  const [buf] = await file.download();
  const json = gunzipSync(buf).toString("utf8");
  const lines = json.split(/\n+/).filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

export async function fetchArchivedDirectMessages({ myId, otherUserId, before, limit }) {
  const chatKey = buildChatKey(myId, otherUserId);
  const ts = before ? new Date(before) : new Date();
  const archives = await Archive.find({ category: "direct", chatKey, endAt: { $lt: ts } })
    .sort({ endAt: -1 })
    .limit(3)
    .lean();
  let out = [];
  let hasMore = false;
  for (const a of archives) {
    const items = await downloadAndParse(a.storagePath);
    // Older first -> take those < before, then from the end backwards
    const eligible = items.filter((m) => new Date(m.createdAt) < ts);
    // Take from the end backwards (newest of the old)
    for (let i = eligible.length - 1; i >= 0 && out.length < limit; i--) {
      const m = eligible[i];
      // Per-user deletion filter
      if (m.isDeletedForEveryone) {
        out.push({ ...m, text: "this message is deleted", image: null, video: null, audio: null, document: null, fileName: null });
      } else if (!Array.isArray(m.deletedFor) || !m.deletedFor.map(String).includes(String(myId))) {
        out.push(m);
      }
    }
    if (out.length >= limit) {
      hasMore = true; // assume there may be more in earlier archives
      break;
    }
  }
  out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { messages: out, hasMore };
}

export async function fetchArchivedGroupMessages({ groupId, userId, before, limit }) {
  const ts = before ? new Date(before) : new Date();
  const archives = await Archive.find({ category: "group", groupId, endAt: { $lt: ts } })
    .sort({ endAt: -1 })
    .limit(3)
    .lean();
  let out = [];
  let hasMore = false;
  for (const a of archives) {
    const items = await downloadAndParse(a.storagePath);
    const eligible = items.filter((m) => new Date(m.createdAt) < ts);
    for (let i = eligible.length - 1; i >= 0 && out.length < limit; i--) {
      const m = eligible[i];
      if (m.isDeletedForEveryone) {
        out.push({ ...m, text: "this message is deleted", image: null, video: null, audio: null, document: null, fileName: null });
      } else if (!Array.isArray(m.deletedFor) || !m.deletedFor.map(String).includes(String(userId))) {
        out.push(m);
      }
    }
    if (out.length >= limit) {
      hasMore = true;
      break;
    }
  }
  out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { messages: out, hasMore };
}

export async function fetchArchivedCalls({ userId, before, limit }) {
  const ts = before ? new Date(before) : new Date();
  const archives = await Archive.find({ category: "call", chatKey: String(userId), endAt: { $lt: ts } })
    .sort({ endAt: -1 })
    .limit(3)
    .lean();
  let out = [];
  let hasMore = false;
  for (const a of archives) {
    const items = await downloadAndParse(a.storagePath);
    const eligible = items.filter((c) => new Date(c.startedAt || c.createdAt) < ts);
    for (let i = eligible.length - 1; i >= 0 && out.length < limit; i--) {
      out.push(eligible[i]);
    }
    if (out.length >= limit) {
      hasMore = true;
      break;
    }
  }
  out.sort((a, b) => new Date(a.startedAt || a.createdAt) - new Date(b.startedAt || b.createdAt));
  return { calls: out, hasMore };
}
