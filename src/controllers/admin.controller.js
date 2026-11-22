import { serviceHandler } from "../utils/helpers/controllerHelpers.js";
import * as AdminService from "../services/admin.service.js";

export const getAdminStats = serviceHandler(() => AdminService.getAdminStats());

export const getSellerStats = serviceHandler((req) =>
  AdminService.getSellerStats(req.seller._id)
);

export const listUsers = serviceHandler((req) =>
  AdminService.listUsers(req.query.role, req.query)
);

export const updateUserStatus = serviceHandler((req) =>
  AdminService.updateUserStatus(req.params.id, req.body.isActive)
);
