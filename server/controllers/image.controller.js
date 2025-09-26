import axios from "axios";
import userModel from "../models/userModel.js";
import FormData from "form-data";

export const generateImage = async (req, res) => {
  try {
    // prefer authenticated user id (set by auth middleware) but fall back to body
    const { prompt } = req.body;
    const userId = req.userId || req.body.userId;
    if (!userId || !prompt) {
      return res.status(400).json({ success: false, message: "Missing details: userId and prompt are required" });
    }
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    // ensure creditBalance is a number and positive
    if (typeof user.creditBalance !== 'number' || user.creditBalance <= 0) {
      return res
        .status(401)
        .json({
          success: false,
          message: "No Credits Balance",
          creditBalance: user.creditBalance,
        });
    }
    const formData = new FormData();
    formData.append('prompt', prompt);
    // axios needs FormData headers (especially boundary) when sending form-data
    const headers = {
      'x-api-key': process.env.CLIPDROP_API,
      ...formData.getHeaders?.(),
    };
    const { data } = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
      headers,
      responseType: 'arraybuffer',
    });
    const base64Image = Buffer.from(data, 'binary').toString('base64');
    const resultImage = `data:image/png;base64,${base64Image}`;
    await userModel.findByIdAndUpdate(user._id, { creditBalance: user.creditBalance - 1 });
    res.status(200).json({ success: true, message: 'Image generated', creditBalance: user.creditBalance - 1, resultImage });

  } catch (error) {
    console.log("error in generateImage", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};
