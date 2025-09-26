import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import razorpay from "razorpay";
import transactionModel from "../models/transactionModel.js";
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing details" });
    }
    const isUserAlreadyExist = await userModel.findOne({ email });
    if (isUserAlreadyExist) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await userModel.create({
      name,
      email,
      password: hashedPassword,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token);
    res.status(201).json({
      message: "User Registration successful",
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.log("error in user registration", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credential" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token);
    res.status(200).json({
      success: true,
      message: "User login successful",
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Error in user login:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const userCredits = async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing user id" });
    }
    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      credit: user.creditBalance,
      user: { name: user.name },
    });
  } catch (error) {
    console.log("error in userCredits", error.message);
    res.status(500).json({ message: "internal server error" });
  }
};
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Test Key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Test Key Secret
});

export const paymentRazorpay = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId; // from JWT

    if (!userId || !planId) {
      console.log("data not recive");
      return res
        .status(400)
        .json({ success: false, message: "Missing details" });
    }

    const userData = await userModel.findById(userId);
    if (!userData)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    let credits, plan, amount;
    switch (planId) {
      case "Basic":
        credits = 100;
        amount = 10;
        plan = "Basic";
        break;
      case "Advanced":
        credits = 500;
        amount = 50;
        plan = "Advanced";
        break;
      case "Business":
        credits = 5000;
        amount = 250;
        plan = "Business";
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Plan not found" });
    }

    const newTransaction = await transactionModel.create({
      userId,
      plan,
      amount,
      credits,
      date: Date.now(),
    });

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: process.env.CURRENCY || "INR",
      receipt: newTransaction._id.toString(),
      payment_capture: 1, // auto-capture payment
    };

    const order = await razorpayInstance.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.log("Razorpay error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;

    if (!razorpay_order_id)
      return res.status(400).json({ success: false, message: "Order ID missing" });

    // Corrected: use `orders` instead of `order`
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

    if (orderInfo.status === "paid") {
      const transactionData = await transactionModel.findById(orderInfo.receipt);
      if (transactionData.payment) {
        return res
          .status(400)
          .json({ success: false, message: "Payment already processed" });
      }

      const userData = await userModel.findById(transactionData.userId);
      const creditBalance = userData.creditBalance + transactionData.credits;

      await userModel.findByIdAndUpdate(userData._id, { creditBalance });
      await transactionModel.findByIdAndUpdate(transactionData._id, {
        payment: true,
      });

      res.status(200).json({ success: true, message: "Credits Added" });
    } else {
      res.status(400).json({ success: false, message: "Payment not completed yet" });
    }
  } catch (error) {
    console.error("Verify Razorpay error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
