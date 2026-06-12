import { toPublicImageUrls } from "./storedImageHelpers.js";

export const getProductListPrice = (product) => {
  if (!product?.variants?.length) return { price: 0, mrp: 0, discountPercent: 0 };
  const variant = product.variants[0];
  const price = variant.price;
  const mrp = variant.mrp;
  const discountPercent =
    product.discountPercent ||
    (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);
  return { price, mrp, discountPercent, variant };
};

export const formatProductCard = (product) => {
  const { price, mrp, discountPercent } = getProductListPrice(product);
  console.log("product", product?.variants)
  console.log("variants", product?.variants?.map((variant) => variant.images))
  return {
    _id: product._id,
    title: product?.title,
    slug: product?.slug,
    images: product?.images,
    category: product?.category,
    brand: product?.brand,
    price,
    mrp,
    variants: product?.variants || [],
    originalPrice: mrp,
    discount: discountPercent,
    discountPercent,
    rating: product?.rating?.average ?? 0,
    ratingCount: product?.rating?.count ?? 0,
    isTrending: product?.isTrending,
    isNewArrival: product?.isNewArrival,
    isOnSale: product?.isOnSale,
  };
};

export const findVariant = (product, variantSku) =>
  product.variants.find((v) => String(v.sku) === String(variantSku));
