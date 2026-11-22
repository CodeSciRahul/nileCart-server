import { serviceHandler } from "../utils/helpers/controllerHelpers.js";
import * as SellerService from "../services/seller.service.js";

export const applyForSeller = serviceHandler(
  (req) => SellerService.applyForSeller(req.user, req.body),
  201
);

export const getMySellerProfile = serviceHandler((req) =>
  SellerService.getMySellerProfile(req.seller)
);

export const updateMySellerProfile = serviceHandler((req) =>
  SellerService.updateMySellerProfile(req.seller, req.body)
);

export const getSellerBySlug = serviceHandler((req) =>
  SellerService.getSellerBySlug(req.params.slug)
);

export const listSellers = serviceHandler((req) =>
  SellerService.listSellers(req.query.status, req.query)
);

export const approveSeller = serviceHandler((req) =>
  SellerService.approveSeller(req.params.id, req.body)
);

export const rejectSeller = serviceHandler((req) =>
  SellerService.rejectSeller(req.params.id, req.body)
);

export const deactivateSeller = serviceHandler((req) =>
  SellerService.deactivateSeller(req.params.id, req.body)
);

export const reactivateSeller = serviceHandler((req) =>
  SellerService.reactivateSeller(req.params.id)
);

export const getSellerById = serviceHandler((req) =>
  SellerService.getSellerById(req.params.id)
);
