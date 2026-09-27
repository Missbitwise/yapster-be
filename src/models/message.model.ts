import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  status: "sent" | "delivered" | "read";
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },

    senderId: {
      type: String,
      required: true,
    },

    receiverId: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  }
);

// Cursor pagination index
messageSchema.index({
  conversationId: 1,
  createdAt: -1,
  _id: -1,
});

const Message = mongoose.model<IMessage>("Message", messageSchema);

export default Message;