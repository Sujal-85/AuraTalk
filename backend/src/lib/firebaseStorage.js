import { bucket } from "./firebaseAdmin.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export const uploadToFirebase = async (file, folder = "uploads") => {
  try {
    if (!file) return null;

    // file can be a base64 string or a buffer-like object
    let buffer;
    let fileName;
    let contentType;

    if (typeof file === "string" && file.startsWith("data:")) {
      // Handle base64
      const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid base64 string");
      }
      contentType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
      const extension = contentType.split("/")[1] || "png";
      fileName = `${folder}/${uuidv4()}.${extension}`;
    } else {
      // Handle file object (if passed from multer or similar)
      buffer = file.buffer;
      fileName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;
      contentType = file.mimetype;
    }

    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: contentType,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on("error", (error) => {
        console.error("Firebase upload error:", error);
        reject(error);
      });

      blobStream.on("finish", async () => {
        // Make the file public or get a signed URL
        // For simple chat apps, public URL is often easier if bucket permissions allow
        // Alternatively, use getSignedUrl
        try {
          await blob.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          resolve(publicUrl);
        } catch (makePublicError) {
          // If makePublic fails, try signed URL as fallback
          const [url] = await blob.getSignedUrl({
            action: "read",
            expires: "03-01-2500", // Far future
          });
          resolve(url);
        }
      });

      blobStream.end(buffer);
    });
  } catch (error) {
    console.error("Error in uploadToFirebase:", error);
    throw error;
  }
};
