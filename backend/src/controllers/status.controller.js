import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import { uploadToFirebase } from "../lib/firebaseStorage.js";

export const getFeed = async (req, res) => {
  try {
    const now = new Date();
    const statuses = await Status.find({ expiresAt: { $gt: now } })
      .populate("userId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ statuses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMine = async (req, res) => {
  try {
    const now = new Date();
    const statuses = await Status.find({
      userId: req.user._id,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ statuses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const postStatus = async (req, res) => {
  try {
    const { type, text } = req.body;

    let mediaUrl = null;

    if (type === "image" || type === "video") {
      if (req.file) {
        mediaUrl = await uploadToFirebase(req.file, "statuses");
      } else if (req.body.mediaUrl) {
        mediaUrl = await uploadToFirebase(req.body.mediaUrl, "statuses");
      }
    }

    const status = await Status.create({
      userId: req.user._id,
      type,
      text: text || null,
      mediaUrl: mediaUrl || null,
    });

    res.status(201).json({ status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleLike = async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: "Status not found" });

    const userId = req.user._id.toString();
    const liked = status.likes.map(id => id.toString()).includes(userId);

    if (liked) {
      status.likes = status.likes.filter(id => id.toString() !== userId);
    } else {
      status.likes.push(req.user._id);
    }

    await status.save();
    res.status(200).json({ likes: status.likes, liked: !liked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required" });

    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: "Status not found" });

    status.comments.push({ userId: req.user._id, text: text.trim() });
    await status.save();

    const newComment = status.comments[status.comments.length - 1];
    await status.populate(`comments.${status.comments.length - 1}.userId`, "fullName profilePic");

    res.status(201).json({ comment: newComment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteStatus = async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    res.status(200).json({ message: "Status deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
