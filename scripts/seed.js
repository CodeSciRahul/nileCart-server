import mongoose from "mongoose";
import { connectDB } from "../src/config/database.js";
import Category from "../src/models/Category.js";
import Brand from "../src/models/Brand.js";
import Product from "../src/models/Product.js";
import Banner from "../src/models/Banner.js";
import Announcement from "../src/models/Announcement.js";
import Coupon from "../src/models/Coupon.js";
import CouponRedemption from "../src/models/CouponRedemption.js";
import User from "../src/models/User.js";
import Seller from "../src/models/Seller.js";

const departments = [
  { name: "Women", slug: "women", department: "women", displayOrder: 1, showInNav: true },
  { name: "Men", slug: "men", department: "men", displayOrder: 2, showInNav: true },
  { name: "Accessories", slug: "accessories-dept", department: "accessories", displayOrder: 3, showInNav: true },
  { name: "Beauty", slug: "beauty-dept", department: "beauty", displayOrder: 4, showInNav: true },
];

const subcategories = [
  { name: "Tops", slug: "tops", parentSlug: "women", image: "/assets/cropped/tile_2_tops.jpg", displayOrder: 1, showInNav: true },
  { name: "Dresses", slug: "dresses", parentSlug: "women", image: "/src/assets/images/product_silk_slip_dress_1794411614638.jpg", displayOrder: 2, showInNav: true },
  { name: "Bottoms", slug: "bottoms", parentSlug: "women", image: "/src/assets/images/product_pleated_trousers_1794411614579.jpg", displayOrder: 3, showInNav: true },
  { name: "Co-Ords & Jumpsuits", slug: "co-ords", parentSlug: "women", image: "/assets/cropped/foryou_1_burgundy_set.jpg", displayOrder: 4, showInNav: true },
  { name: "Denim", slug: "denim", parentSlug: "women", image: "/assets/cropped/foryou_3_grey_sweats.jpg", displayOrder: 5, showInNav: true },
  { name: "Autumn/Winter 2026", slug: "autumn-winter", parentSlug: "women", image: "/src/assets/images/hero_luxury_unisex_campaign_1794412822515.jpg", displayOrder: 6, showInNav: true },
  { name: "Lingerie & Loungewear", slug: "lingerie", parentSlug: "women", image: "/assets/cropped/foryou_2_white_hoodie.jpg", displayOrder: 7, showInNav: true },
  { name: "Accessories", slug: "accessories", parentSlug: "accessories-dept", image: "/assets/cropped/tile_1_acc.jpg", displayOrder: 8, showInNav: true },
  { name: "Jewellery", slug: "jewellery", parentSlug: "accessories-dept", image: "/assets/cropped/tile_1_acc.jpg", displayOrder: 9, showInNav: true },
  { name: "Beauty & Fragrances", slug: "beauty", parentSlug: "beauty-dept", image: "/assets/cropped/trending_1_sparkles.jpg", displayOrder: 10, showInNav: true },
  { name: "Bags", slug: "bags", parentSlug: "accessories-dept", image: "/src/assets/images/product_luxury_leather_duffle_1794412824104.jpg", displayOrder: 11, showInNav: true },
  { name: "Activewear", slug: "activewear", parentSlug: "women", image: "/assets/cropped/foryou_3_grey_sweats.jpg", displayOrder: 12, showInNav: true },
  { name: "Jackets & Outerwear", slug: "outerwear", parentSlug: "women", image: "/src/assets/images/product_luxury_cashmere_coat_1794412822491.jpg", displayOrder: 13, showInNav: true },
];

const seed = async () => {
  await connectDB();

  await Promise.all([
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Product.deleteMany({}),
    Banner.deleteMany({}),
    Announcement.deleteMany({}),
    Coupon.deleteMany({}),
    CouponRedemption.deleteMany({}),
  ]);

  const createdDepartments = await Category.insertMany(departments);
  const deptMap = Object.fromEntries(createdDepartments.map((d) => [d.slug, d]));

  const categoryDocs = subcategories.map(({ parentSlug, ...rest }) => ({
    ...rest,
    parent: deptMap[parentSlug]._id,
    department: deptMap[parentSlug].department,
  }));

  const createdCategories = await Category.insertMany(categoryDocs);
  const catMap = Object.fromEntries(createdCategories.map((c) => [c.slug, c._id]));

  const brand = await Brand.create({ name: "NILESCART", slug: "nilescart" });

  let platformUser = await User.findOne({ email: "platform-store@nilecart.local" });
  if (!platformUser) {
    platformUser = await User.create({
      email: "platform-store@nilecart.local",
      name: "Platform Store",
      role: "seller",
    });
  }

  let platformSeller = await Seller.findOne({ user: platformUser._id });
  if (!platformSeller) {
    platformSeller = await Seller.create({
      user: platformUser._id,
      storeName: "NILESCART Official",
      storeSlug: "nilescart-official",
      description: "Official store for contemporary luxury fashion collections",
      approvalStatus: "Approved",
      isVerified: true,
      isActive: true,
    });
  }

  const products = [
    {
      seller: platformSeller._id,
      title: "Unisex Oversized Double-Breasted Wool-Cashmere Overcoat",
      slug: "unisex-oversized-double-breasted-wool-cashmere-overcoat",
      category: catMap["outerwear"] || catMap["tops"],
      brand: brand._id,
      gender: "Unisex",
      images: [
        { url: "/src/assets/images/product_luxury_cashmere_coat_1794412822491.jpg", isCover: true },
        { url: "/src/assets/images/hero_luxury_unisex_campaign_1794412822515.jpg" }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 33,
      rating: { average: 4.9, count: 246 },
      description: "An architectural unisex overcoat spun from dense 850gsm Italian wool and Mongolian cashmere. Sculptural broad shoulders, deep notched lapels, horn button fastenings, and an elongated fluid drop designed to be worn across genders.",
      tags: ["coat", "cashmere", "wool", "overcoat", "unisex", "outerwear"],
      variants: [
        { sku: "COAT-BLK-XS", size: "XS", color: "Charcoal Obsidian", colorHex: "#1c1d21", stock: 10, price: 4990, mrp: 7490, images: [] },
        { sku: "COAT-BLK-S", size: "S", color: "Charcoal Obsidian", colorHex: "#1c1d21", stock: 15, price: 4990, mrp: 7490, images: [] },
        { sku: "COAT-BLK-M", size: "M", color: "Charcoal Obsidian", colorHex: "#1c1d21", stock: 20, price: 4990, mrp: 7490, images: [] },
        { sku: "COAT-CML-M", size: "M", color: "Warm Camel", colorHex: "#b89467", stock: 12, price: 4990, mrp: 7490, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Heavy Ribbed Cashmere & Camel Wool Turtleneck",
      slug: "heavy-ribbed-cashmere-camel-wool-turtleneck",
      category: catMap["tops"],
      brand: brand._id,
      gender: "Men",
      images: [
        { url: "/src/assets/images/product_luxury_mens_knitwear_1794412823242.jpg", isCover: true },
        { url: "/src/assets/images/hero_luxury_unisex_campaign_1794412822515.jpg" }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 36,
      rating: { average: 4.9, count: 182 },
      description: "Knitted on 5-gauge looms with 4-ply organic Mongolian camel wool and combed cashmere. Substantial ribbed fold-over collar, reinforced cuffs, and an authoritative masculine drape.",
      tags: ["knitwear", "turtleneck", "sweater", "cashmere", "men"],
      variants: [
        { sku: "KNIT-OAT-S", size: "S", color: "Oatmeal Camel", colorHex: "#c5b196", stock: 15, price: 2490, mrp: 3890, images: [] },
        { sku: "KNIT-OAT-M", size: "M", color: "Oatmeal Camel", colorHex: "#c5b196", stock: 25, price: 2490, mrp: 3890, images: [] },
        { sku: "KNIT-OAT-L", size: "L", color: "Oatmeal Camel", colorHex: "#c5b196", stock: 20, price: 2490, mrp: 3890, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Artisanal Full-Grain Calfskin Weekender Duffle",
      slug: "artisanal-full-grain-calfskin-weekender-duffle",
      category: catMap["accessories"] || catMap["bags"],
      brand: brand._id,
      gender: "Unisex",
      images: [
        { url: "/src/assets/images/product_luxury_leather_duffle_1794412824104.jpg", isCover: true }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 34,
      rating: { average: 5.0, count: 94 },
      description: "Masterfully hand-stitched from vegetable-tanned Italian calfskin leather. Featuring solid brushed antique brass hardware, reinforced rolled top handles, removable padded shoulder strap, and cotton drill interior lining.",
      tags: ["leather", "duffle", "bag", "travel", "accessories", "unisex"],
      variants: [
        { sku: "BAG-DUF-BRN", size: "One Size", color: "Espresso Brown", colorHex: "#2e1f18", stock: 12, price: 3290, mrp: 4990, images: [] },
        { sku: "BAG-DUF-BLK", size: "One Size", color: "Midnight Onyx", colorHex: "#141416", stock: 8, price: 3290, mrp: 4990, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Unisex Relaxed Fluid Wool Double-Breasted Suit",
      slug: "unisex-relaxed-fluid-wool-double-breasted-suit",
      category: catMap["co-ords"] || catMap["outerwear"],
      brand: brand._id,
      gender: "Unisex",
      images: [
        { url: "/src/assets/images/product_luxury_tailored_suit_1794412824648.jpg", isCover: true },
        { url: "/src/assets/images/hero_luxury_unisex_campaign_1794412822515.jpg" }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 35,
      rating: { average: 4.9, count: 156 },
      description: "Modern deconstructed suiting cut with generous ease. Includes an unlined double-breasted blazer with dropped shoulders, paired with matching wide-leg single-pleat trousers designed to stack gently over boots or loafers.",
      tags: ["suit", "tailoring", "double-breasted", "co-ords", "unisex"],
      variants: [
        { sku: "SUIT-CHO-S", size: "S", color: "Chocolate Espresso", colorHex: "#372b26", stock: 10, price: 3890, mrp: 5990, images: [] },
        { sku: "SUIT-CHO-M", size: "M", color: "Chocolate Espresso", colorHex: "#372b26", stock: 15, price: 3890, mrp: 5990, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Wine Peplum Knit Top & Ribbed Fishtail Skirt Co-Ord",
      slug: "wine-peplum-knit-top-ribbed-fishtail-skirt-co-ord",
      category: catMap["co-ords"],
      brand: brand._id,
      gender: "Women",
      images: [
        { url: "/assets/cropped/foryou_1_burgundy_set.jpg", isCover: true },
        { url: "/assets/cropped/trending_4_burgundy.jpg" }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 41,
      rating: { average: 4.9, count: 384 },
      description: "A striking 2-piece ensemble crafted from ultra-fine ribbed knit. Features a sculpted peplum cardigan with vintage gold sunburst buttons, paired with a flattering high-waist fishtail maxi skirt that elongates the silhouette.",
      tags: ["peplum", "co-ords", "skirt set", "burgundy", "women"],
      variants: [
        { sku: "CORD-BUR-S", size: "S", color: "Burgundy Wine", colorHex: "#6b1724", stock: 20, price: 1290, mrp: 2190, images: [] },
        { sku: "CORD-BUR-M", size: "M", color: "Burgundy Wine", colorHex: "#6b1724", stock: 25, price: 1290, mrp: 2190, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Pure Chalk Lace-Up Waist Cropped Hoodie",
      slug: "pure-chalk-lace-up-waist-cropped-hoodie",
      category: catMap["tops"],
      brand: brand._id,
      gender: "Women",
      images: [
        { url: "/assets/cropped/foryou_2_white_hoodie.jpg", isCover: true }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 30,
      rating: { average: 4.8, count: 192 },
      description: "Casual streetwear reinvented with feminine corsetry details. Soft fleece cropped hoodie with an intricate functional lace-up cord waist detail and dropped shoulders.",
      tags: ["hoodie", "cropped", "corset", "white", "women"],
      variants: [
        { sku: "HOD-WHT-S", size: "S", color: "Pure Chalk", colorHex: "#f8f8f8", stock: 15, price: 690, mrp: 990, images: [] },
        { sku: "HOD-WHT-M", size: "M", color: "Pure Chalk", colorHex: "#f8f8f8", stock: 20, price: 690, mrp: 990, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Heather Grey Cropped Zip-Hoodie & Wide Sweatpants Set",
      slug: "heather-grey-cropped-zip-hoodie-wide-sweatpants-set",
      category: catMap["co-ords"] || catMap["bottoms"],
      brand: brand._id,
      gender: "Unisex",
      images: [
        { url: "/assets/cropped/foryou_3_grey_sweats.jpg", isCover: true }
      ],
      isTrending: true,
      isOnSale: true,
      discountPercent: 40,
      rating: { average: 4.9, count: 521 },
      description: "The ultimate airport and off-duty uniform. Heavyweight 380gsm brushed fleece cropped zip-up hoodie paired with ultra-relaxed wide-leg sweatpants featuring a deep elastic waistband.",
      tags: ["sweatpants", "hoodie", "athleisure", "grey set", "unisex"],
      variants: [
        { sku: "SET-GRY-M", size: "M", color: "Heather Grey", colorHex: "#9e9e9e", stock: 30, price: 1490, mrp: 2490, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Wildflower Monarch Butterfly Wing Open Cardigan",
      slug: "wildflower-monarch-butterfly-wing-open-cardigan",
      category: catMap["tops"],
      brand: brand._id,
      gender: "Women",
      images: [
        { url: "/assets/cropped/foryou_4_butterfly_knit.jpg", isCover: true }
      ],
      isTrending: true,
      isNewArrival: true,
      isOnSale: true,
      discountPercent: 40,
      rating: { average: 4.9, count: 418 },
      description: "Viral statement piece crafted with jacquard knit butterfly wing patterns, delicate scalloped borders, and an open front silhouette designed to drape over summer slips and casual tops.",
      tags: ["butterfly", "cardigan", "knitwear", "statement", "women"],
      variants: [
        { sku: "CRD-ORG-S", size: "S", color: "Monarch Orange", colorHex: "#d95a1e", stock: 12, price: 890, mrp: 1490, images: [] },
        { sku: "CRD-ORG-M", size: "M", color: "Monarch Orange", colorHex: "#d95a1e", stock: 15, price: 890, mrp: 1490, images: [] },
      ],
    },
  ];

  await Product.insertMany(products);

  // Seed Banners matching Reference Project
  await Banner.insertMany([
    {
      title: "Tuscan Autumn/Winter 2026 Unisex Campaign",
      subtitle: "WARM UP YOUR WARDROBE",
      description: "UP TO 50% OFF",
      type: "hero",
      image: { url: "/src/assets/images/hero_luxury_unisex_campaign_1794412822515.jpg" },
      ctaText: "SHOP NOW",
      displayOrder: 1,
      isActive: true,
    },
    {
      title: "Tailored Minimalist Suiting for Men & Women",
      subtitle: "UNISEX ARCHITECTURE",
      description: "NEW DROPS FROM ₹ 890",
      type: "hero",
      image: { url: "/src/assets/images/hero_fashion_editorial_1794411612844.jpg" },
      ctaText: "EXPLORE CAPSULE",
      displayOrder: 2,
      isActive: true,
    },
    {
      title: "Iconic Nilescart Closet Showcase",
      subtitle: "SIGNATURE ARCHIVE",
      description: "UP TO 60% OFF",
      type: "hero",
      image: { url: "/assets/cropped/hero_pink_closet.jpg" },
      ctaText: "SHOP ARCHIVE",
      displayOrder: 3,
      isActive: true,
    },
    {
      title: "Member Prices Up to 50% Off + 3X Points",
      subtitle: "BLACK MEMBER EXCLUSIVE",
      type: "promotional",
      image: { url: "/assets/cropped/black_member_banner.jpg" },
      displayOrder: 4,
      isActive: true,
    },
    {
      title: "New Arrivals From ₹390",
      subtitle: "NEW SEASON CAPSULE",
      type: "promotional",
      image: { url: "/assets/cropped/new_arrivals_banner.jpg" },
      displayOrder: 5,
      isActive: true,
    },
    {
      title: "Clearance Sale Up to 60% Off",
      subtitle: "LIMITED STOCK ARCHIVE",
      type: "promotional",
      image: { url: "/assets/cropped/clearance_sale_banner.jpg" },
      displayOrder: 6,
      isActive: true,
    },
  ]);

  // Seed Top Bar Announcement
  await Announcement.create({
    message: "EASY RETURNS / FREE PICK UP",
    type: "top_bar",
    priority: 10,
    isActive: true,
  });

  // Seed Coupons
  await Coupon.create({
    code: "FRESH20",
    description: "20% off on all contemporary styles",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 499,
    maxDiscount: 1000,
    usageLimit: 5000,
    maxUsesPerUser: 5,
    eligibleUserType: "all",
    sponsoredBy: "platform",
    isActive: true,
  });

  await Coupon.create({
    code: "NILES20",
    description: "20% off VIP Member discount",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 499,
    maxDiscount: 1000,
    usageLimit: 5000,
    maxUsesPerUser: 5,
    eligibleUserType: "all",
    sponsoredBy: "platform",
    isActive: true,
  });

  await Coupon.create({
    code: "NILESCART20",
    description: "20% off Season Pass discount",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 499,
    maxDiscount: 1000,
    usageLimit: 5000,
    maxUsesPerUser: 5,
    eligibleUserType: "all",
    sponsoredBy: "platform",
    isActive: true,
  });

  await Coupon.create({
    code: "NILES10",
    description: "15% off VIP Code",
    discountType: "percentage",
    discountValue: 15,
    minOrderAmount: 299,
    maxDiscount: 500,
    usageLimit: 5000,
    maxUsesPerUser: 5,
    eligibleUserType: "all",
    sponsoredBy: "platform",
    isActive: true,
  });

  console.log("Seed completed successfully with NILESCART luxury contemporary catalog");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
