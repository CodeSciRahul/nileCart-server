import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Category from "../models/Category.model.js";
import Brand from "../models/Brand.model.js";
import Product from "../models/Product.model.js";
import Banner from "../models/Banner.model.js";
import Announcement from "../models/Announcement.model.js";
import Coupon from "../models/Coupon.model.js";
import User from "../models/User.model.js";
import Seller from "../models/Seller.model.js";

const categories = [
  { name: "Tops", slug: "tops", image: "https://img105.savana.com/v1/2e2992df39904be6be0b37fa12f49855_w360.webp", displayOrder: 1, showInNav: true },
  { name: "Bottoms", slug: "bottoms", image: "https://img105.savana.com/v1/d8eece4486724969bded3da88b84098a_w360.webp", displayOrder: 2, showInNav: true },
  { name: "Dresses", slug: "dresses", image: "https://img105.savana.com/v1/51fd5601c16b49e99a1ed4d35bf76f33_w360.webp", displayOrder: 3, showInNav: true },
  { name: "Accessories", slug: "accessories", image: "https://img105.savana.com/v1/4e09cf5cf45d4493814ef48ca2d71bbc_w360.webp", displayOrder: 4, showInNav: true },
  { name: "Bags", slug: "bags", image: "https://img105.savana.com/v1/c4d729bdfaa14786986463f4880b655a_w360.webp", displayOrder: 5, showInNav: true },
  { name: "Jewellery", slug: "jewellery", image: "https://img105.savana.com/v1/60c7d9a9d613402f881b04649143869d_w360.webp", displayOrder: 6, showInNav: true },
  { name: "Beauty", slug: "beauty", image: "https://img105.savana.com/v1/de890efbd67d4122b4ce9046f9a641b3_w360.webp", displayOrder: 7, showInNav: true },
  { name: "Swimwear", slug: "swimwear", image: "https://img105.savana.com/v1/0c5516debdd547d3a946cc6087a75e89_w360.webp", displayOrder: 8, showInNav: true },
  { name: "Sports & Gym", slug: "sports-gym", image: "https://img105.savana.com/v1/e02d1551119b44de9eff5d5e6dc7cdef_w360.webp", displayOrder: 9, showInNav: true },
  { name: "Lingerie", slug: "lingerie", displayOrder: 10, showInNav: true },
  { name: "Sale", slug: "sale", displayOrder: 11, showInNav: true },
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
  ]);

  const createdCategories = await Category.insertMany(categories);
  const catMap = Object.fromEntries(createdCategories.map((c) => [c.slug, c._id]));

  const brand = await Brand.create({ name: "Savana", slug: "savana" });

  const platformUser = await User.create({
    email: "platform-store@lightcollection.local",
    name: "Platform Store",
    role: "seller",
  });

  const platformSeller = await Seller.create({
    user: platformUser._id,
    storeName: "LightCollection Official",
    storeSlug: "lightcollection-official",
    description: "Official platform store for seeded catalog products",
    approvalStatus: "Approved",
    isVerified: true,
    isActive: true,
  });

  const products = [
    {
      seller: platformSeller._id,
      title: "Floral Print Mini Dress",
      slug: "floral-print-mini-dress",
      category: catMap.dresses,
      brand: brand._id,
      images: ["https://img105.savana.com/v1/goods-pic/3ad692c3126941d8829be475358c59ca_w360.webp"],
      isTrending: true,
      isOnSale: true,
      variants: [
        { sku: "DRS-001-S", size: "S", color: "Pink", stock: 20, price: 1499, mrp: 2499, images: [] },
        { sku: "DRS-001-M", size: "M", color: "Pink", stock: 15, price: 1499, mrp: 2499, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Ribbed Crop Top",
      slug: "ribbed-crop-top",
      category: catMap.tops,
      brand: brand._id,
      images: ["https://img105.savana.com/v1/goods-pic/b9ca5af623794f1d829d53ea896f67f9_w360.webp"],
      isTrending: true,
      variants: [
        { sku: "TOP-001-S", size: "S", color: "White", stock: 30, price: 999, mrp: 1499, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "High Waist Cargo Pants",
      slug: "high-waist-cargo-pants",
      category: catMap.bottoms,
      brand: brand._id,
      images: ["https://img105.savana.com/v1/goods-pic/a5b86c309e7b4335a5fdf9d29ef6b121_w360.webp"],
      variants: [
        { sku: "BTM-001-M", size: "M", color: "Khaki", stock: 18, price: 1724, mrp: 2299, images: [] },
      ],
    },
    {
      seller: platformSeller._id,
      title: "Premium Handbag",
      slug: "premium-handbag",
      category: catMap.bags,
      brand: brand._id,
      images: ["https://img105.savana.com/v1/goods-pic/2808ac17f0b84b16842a26f21b8a583e_w360.webp"],
      isTrending: true,
      isOnSale: true,
      variants: [
        { sku: "BAG-001", size: "OS", color: "Tan", stock: 10, price: 1749, mrp: 3499, images: [] },
      ],
    },
  ];

  await Product.insertMany(products);

  await Banner.insertMany([
    {
      title: "Summer Collection 2026",
      subtitle: "Up To 70% OFF",
      description: "Discover trendy dresses, co-ords and accessories crafted for modern women.",
      image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200",
      displayOrder: 1,
    },
    {
      title: "Pink Edit",
      subtitle: "Buy 2 Get 1 Free",
      description: "Fresh styles designed to make every day feel special.",
      image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200",
      displayOrder: 2,
    },
  ]);

  await Announcement.create({
    message: "Anniversary Sale • Up To 80% OFF + Free Shipping Above ₹999",
    icon: "🎉",
    priority: 10,
  });

  await Coupon.create({
    code: "SAVANA20",
    description: "20% off on orders above ₹999",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 999,
    maxDiscount: 500,
    usageLimit: 1000,
  });

  console.log("Seed completed successfully");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
