import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    icon: String,
    link: String,
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true }
);

const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
