import { Router } from "express";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controller/address.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", getAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.patch("/:id/default", setDefaultAddress);

export default router;
