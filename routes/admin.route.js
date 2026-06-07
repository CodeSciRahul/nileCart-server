import { Router } from "express";
import {
  listSellers,
  approveSeller,
  rejectSeller,
  deactivateSeller,
} from "../controller/seller.controller.js";
import { listUsers, updateUserStatus } from "../controller/admin.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/sellers", listSellers);
router.patch("/sellers/:id/approve", approveSeller);
router.patch("/sellers/:id/reject", rejectSeller);
router.patch("/sellers/:id/deactivate", deactivateSeller);

router.get("/users", listUsers);
router.patch("/users/:id/status", updateUserStatus);

export default router;
