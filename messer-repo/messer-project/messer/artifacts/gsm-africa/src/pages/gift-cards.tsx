import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWalletBalance } from "@/hooks/use-wallet";
import { QRCodeSVG } from "qrcode.react";
import {
  Gift, CheckCircle2, ArrowLeft, ChevronRight,
  Gamepad2, Tv, ShoppingBag, Smartphone, Search,
  Globe, X, Copy, Check, ArrowRight,
} from "lucide-react";

type CardEntry = {
  id: string;
  brand: string;
  region: string;
  currency: string;
  symbol: string;
  denominations: number[];
  emoji: string;
  category: "Gaming" | "Streaming" | "Shopping" | "Mobile" | "Telecom";
  bg: string;
  accent: string;
};

const GIFT_CARDS: CardEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  //  PLAYSTATION / PSN
  // ═══════════════════════════════════════════════════════════════
  { id:"psn-us",   brand:"PlayStation",  region:"USA",           currency:"USD", symbol:"$",  denominations:[10,20,25,50,100],    emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-uk",   brand:"PlayStation",  region:"UK",            currency:"GBP", symbol:"£",  denominations:[10,15,25,50],        emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-eu",   brand:"PlayStation",  region:"EU",            currency:"EUR", symbol:"€",  denominations:[10,20,50,100],       emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-au",   brand:"PlayStation",  region:"Australia",     currency:"AUD", symbol:"A$", denominations:[10,20,50,100],       emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-ca",   brand:"PlayStation",  region:"Canada",        currency:"CAD", symbol:"C$", denominations:[10,20,50,100],       emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-jp",   brand:"PlayStation",  region:"Japan",         currency:"JPY", symbol:"¥",  denominations:[1000,3000,5000,10000], emoji:"🎮", category:"Gaming",  bg:"#003087", accent:"#0070d1" },
  { id:"psn-br",   brand:"PlayStation",  region:"Brazil",        currency:"BRL", symbol:"R$", denominations:[30,60,100,150,250],  emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-mx",   brand:"PlayStation",  region:"Mexico",        currency:"MXN", symbol:"$",  denominations:[200,500,1000],       emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-sa",   brand:"PlayStation",  region:"Saudi Arabia",  currency:"SAR", symbol:"﷼",  denominations:[25,50,100,200],      emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-ae",   brand:"PlayStation",  region:"UAE",           currency:"AED", symbol:"د",  denominations:[30,60,120,250],      emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-tr",   brand:"PlayStation",  region:"Turkey",        currency:"TRY", symbol:"₺",  denominations:[50,100,250,500],     emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-hk",   brand:"PlayStation",  region:"Hong Kong",     currency:"HKD", symbol:"HK$", denominations:[50,100,200,400],   emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-sg",   brand:"PlayStation",  region:"Singapore",     currency:"SGD", symbol:"S$", denominations:[15,30,50,100],      emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-in",   brand:"PlayStation",  region:"India",         currency:"INR", symbol:"₹",  denominations:[499,999,2499,4999],  emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-ar",   brand:"PlayStation",  region:"Argentina",     currency:"ARS", symbol:"$",  denominations:[500,1500,3000],      emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  { id:"psn-za",   brand:"PlayStation",  region:"South Africa",  currency:"ZAR", symbol:"R",  denominations:[100,250,500,1000],   emoji:"🎮", category:"Gaming",    bg:"#003087", accent:"#0070d1" },
  // ═══════════════════════════════════════════════════════════════
  //  XBOX / MICROSOFT
  // ═══════════════════════════════════════════════════════════════
  { id:"xbox-us",  brand:"Xbox",         region:"USA",           currency:"USD", symbol:"$",  denominations:[10,15,25,50,100],    emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-uk",  brand:"Xbox",         region:"UK",            currency:"GBP", symbol:"£",  denominations:[10,15,25,50],        emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-eu",  brand:"Xbox",         region:"EU",            currency:"EUR", symbol:"€",  denominations:[10,15,25,50,100],    emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-au",  brand:"Xbox",         region:"Australia",     currency:"AUD", symbol:"A$", denominations:[10,25,50,100],       emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-ca",  brand:"Xbox",         region:"Canada",        currency:"CAD", symbol:"C$", denominations:[10,25,50,100],       emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-br",  brand:"Xbox",         region:"Brazil",        currency:"BRL", symbol:"R$", denominations:[30,60,100,200],      emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-mx",  brand:"Xbox",         region:"Mexico",        currency:"MXN", symbol:"$",  denominations:[200,500,1000],       emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-sa",  brand:"Xbox",         region:"Saudi Arabia",  currency:"SAR", symbol:"﷼",  denominations:[25,50,100,200],      emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-ae",  brand:"Xbox",         region:"UAE",           currency:"AED", symbol:"د",  denominations:[30,60,120,200],      emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-tr",  brand:"Xbox",         region:"Turkey",        currency:"TRY", symbol:"₺",  denominations:[50,100,250,500],     emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-ar",  brand:"Xbox",         region:"Argentina",     currency:"ARS", symbol:"$",  denominations:[500,1500,3000],      emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  { id:"xbox-za",  brand:"Xbox",         region:"South Africa",  currency:"ZAR", symbol:"R",  denominations:[100,250,500,1000],   emoji:"🟢", category:"Gaming",    bg:"#107C10", accent:"#52b043" },
  // ═══════════════════════════════════════════════════════════════
  //  NINTENDO ESHOP
  // ═══════════════════════════════════════════════════════════════
  { id:"nin-us",   brand:"Nintendo eShop", region:"USA",         currency:"USD", symbol:"$",  denominations:[10,20,35,50],        emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-uk",   brand:"Nintendo eShop", region:"UK",          currency:"GBP", symbol:"£",  denominations:[10,15,25,35,50],     emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-eu",   brand:"Nintendo eShop", region:"EU",          currency:"EUR", symbol:"€",  denominations:[10,15,25,35,50],     emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-au",   brand:"Nintendo eShop", region:"Australia",   currency:"AUD", symbol:"A$", denominations:[10,20,50],           emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-ca",   brand:"Nintendo eShop", region:"Canada",      currency:"CAD", symbol:"C$", denominations:[10,20,35,50],        emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-jp",   brand:"Nintendo eShop", region:"Japan",       currency:"JPY", symbol:"¥",  denominations:[1000,3000,5000],     emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-br",   brand:"Nintendo eShop", region:"Brazil",      currency:"BRL", symbol:"R$", denominations:[30,75,150],          emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  { id:"nin-mx",   brand:"Nintendo eShop", region:"Mexico",      currency:"MXN", symbol:"$",  denominations:[200,500],            emoji:"🔴", category:"Gaming",    bg:"#E4000F", accent:"#ff3341" },
  // ═══════════════════════════════════════════════════════════════
  //  STEAM
  // ═══════════════════════════════════════════════════════════════
  { id:"steam-us", brand:"Steam",         region:"USA",          currency:"USD", symbol:"$",  denominations:[5,10,20,50,100],     emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-uk", brand:"Steam",         region:"UK",           currency:"GBP", symbol:"£",  denominations:[5,10,20,50],         emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-eu", brand:"Steam",         region:"EU",           currency:"EUR", symbol:"€",  denominations:[5,10,20,50,100],     emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-au", brand:"Steam",         region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,20,50,100],       emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-ca", brand:"Steam",         region:"Canada",       currency:"CAD", symbol:"C$", denominations:[10,20,50,100],       emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-tr", brand:"Steam",         region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[25,50,100,250],      emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-br", brand:"Steam",         region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[20,50,100,250],      emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-in", brand:"Steam",         region:"India",        currency:"INR", symbol:"₹",  denominations:[100,250,500,1000],   emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-ar", brand:"Steam",         region:"Argentina",    currency:"ARS", symbol:"$",  denominations:[500,1000,2000],      emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  { id:"steam-sg", brand:"Steam",         region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[10,20,50],           emoji:"🖥️", category:"Gaming",    bg:"#171A21", accent:"#2a3f5e" },
  // ═══════════════════════════════════════════════════════════════
  //  ROBLOX
  // ═══════════════════════════════════════════════════════════════
  { id:"rblx-us",  brand:"Roblox",        region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50],           emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-uk",  brand:"Roblox",        region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,25,50],           emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-eu",  brand:"Roblox",        region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,25,50],           emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-au",  brand:"Roblox",        region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,25,50],           emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-ca",  brand:"Roblox",        region:"Canada",       currency:"CAD", symbol:"C$", denominations:[10,25,50],           emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-br",  brand:"Roblox",        region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[30,75,150],          emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-tr",  brand:"Roblox",        region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[30,75,150],          emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  { id:"rblx-sa",  brand:"Roblox",        region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[20,50,100],          emoji:"🧱", category:"Gaming",    bg:"#E8283B", accent:"#ff4154" },
  // ═══════════════════════════════════════════════════════════════
  //  FORTNITE / EPIC GAMES
  // ═══════════════════════════════════════════════════════════════
  { id:"fort-us",  brand:"Fortnite",      region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50],           emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  { id:"fort-uk",  brand:"Fortnite",      region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,25,50],           emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  { id:"fort-eu",  brand:"Fortnite",      region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,25,50],           emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  { id:"fort-au",  brand:"Fortnite",      region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,25,50],           emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  { id:"fort-br",  brand:"Fortnite",      region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[30,75,150],          emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  { id:"fort-tr",  brand:"Fortnite",      region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[30,75,150],          emoji:"⚡", category:"Gaming",    bg:"#4B2998", accent:"#7b5dca" },
  // ═══════════════════════════════════════════════════════════════
  //  CALL OF DUTY / BATTLE.NET
  // ═══════════════════════════════════════════════════════════════
  { id:"cod-us",   brand:"Call of Duty",  region:"USA",          currency:"USD", symbol:"$",  denominations:[20,40],              emoji:"🎯", category:"Gaming",    bg:"#1C1C1E", accent:"#f5a623" },
  { id:"cod-uk",   brand:"Call of Duty",  region:"UK",           currency:"GBP", symbol:"£",  denominations:[20,40],              emoji:"🎯", category:"Gaming",    bg:"#1C1C1E", accent:"#f5a623" },
  { id:"cod-eu",   brand:"Call of Duty",  region:"EU",           currency:"EUR", symbol:"€",  denominations:[20,40],              emoji:"🎯", category:"Gaming",    bg:"#1C1C1E", accent:"#f5a623" },
  { id:"cod-sa",   brand:"Call of Duty",  region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[50,100],             emoji:"🎯", category:"Gaming",    bg:"#1C1C1E", accent:"#f5a623" },
  // ═══════════════════════════════════════════════════════════════
  //  EA / EA PLAY
  // ═══════════════════════════════════════════════════════════════
  { id:"ea-us",    brand:"EA Play",       region:"USA",          currency:"USD", symbol:"$",  denominations:[5,15],               emoji:"🏟️", category:"Gaming",    bg:"#F55B0E", accent:"#ff7033" },
  { id:"ea-uk",    brand:"EA Play",       region:"UK",           currency:"GBP", symbol:"£",  denominations:[5,15],               emoji:"🏟️", category:"Gaming",    bg:"#F55B0E", accent:"#ff7033" },
  { id:"ea-eu",    brand:"EA Play",       region:"EU",           currency:"EUR", symbol:"€",  denominations:[5,15],               emoji:"🏟️", category:"Gaming",    bg:"#F55B0E", accent:"#ff7033" },
  // ═══════════════════════════════════════════════════════════════
  //  MINECRAFT
  // ═══════════════════════════════════════════════════════════════
  { id:"mc-us",    brand:"Minecraft",     region:"USA",          currency:"USD", symbol:"$",  denominations:[10,20,30],           emoji:"⛏️", category:"Gaming",    bg:"#5F7C17", accent:"#7daa1f" },
  { id:"mc-eu",    brand:"Minecraft",     region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,20,30],           emoji:"⛏️", category:"Gaming",    bg:"#5F7C17", accent:"#7daa1f" },
  // ═══════════════════════════════════════════════════════════════
  //  PUBG MOBILE
  // ═══════════════════════════════════════════════════════════════
  { id:"pubg-us",  brand:"PUBG Mobile",   region:"Global",       currency:"USD", symbol:"$",  denominations:[5,10,20,50,100],     emoji:"🪖", category:"Gaming",    bg:"#F7A600", accent:"#ffc533" },
  { id:"pubg-sa",  brand:"PUBG Mobile",   region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[15,30,60,120],       emoji:"🪖", category:"Gaming",    bg:"#F7A600", accent:"#ffc533" },
  { id:"pubg-tr",  brand:"PUBG Mobile",   region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[20,50,100,250],      emoji:"🪖", category:"Gaming",    bg:"#F7A600", accent:"#ffc533" },
  // ═══════════════════════════════════════════════════════════════
  //  FREE FIRE / GARENA
  // ═══════════════════════════════════════════════════════════════
  { id:"ff-id",    brand:"Free Fire",     region:"Indonesia",    currency:"IDR", symbol:"Rp", denominations:[10000,50000,100000,200000], emoji:"🔥", category:"Gaming", bg:"#FF7700", accent:"#ff9933" },
  { id:"ff-ph",    brand:"Free Fire",     region:"Philippines",  currency:"PHP", symbol:"₱",  denominations:[50,100,300,500],     emoji:"🔥", category:"Gaming",    bg:"#FF7700", accent:"#ff9933" },
  { id:"ff-my",    brand:"Free Fire",     region:"Malaysia",     currency:"MYR", symbol:"RM", denominations:[5,10,30,50],         emoji:"🔥", category:"Gaming",    bg:"#FF7700", accent:"#ff9933" },
  { id:"ff-sg",    brand:"Free Fire",     region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[5,10,30,50],         emoji:"🔥", category:"Gaming",    bg:"#FF7700", accent:"#ff9933" },
  { id:"ff-bd",    brand:"Free Fire",     region:"Bangladesh",   currency:"BDT", symbol:"৳",  denominations:[50,100,500,1000],    emoji:"🔥", category:"Gaming",    bg:"#FF7700", accent:"#ff9933" },
  // ═══════════════════════════════════════════════════════════════
  //  MOBILE LEGENDS
  // ═══════════════════════════════════════════════════════════════
  { id:"ml-us",    brand:"Mobile Legends", region:"Global",      currency:"USD", symbol:"$",  denominations:[5,10,25,50],         emoji:"⚔️", category:"Gaming",    bg:"#003F8A", accent:"#0066cc" },
  { id:"ml-id",    brand:"Mobile Legends", region:"Indonesia",   currency:"IDR", symbol:"Rp", denominations:[10000,50000,100000], emoji:"⚔️", category:"Gaming",    bg:"#003F8A", accent:"#0066cc" },
  { id:"ml-ph",    brand:"Mobile Legends", region:"Philippines", currency:"PHP", symbol:"₱",  denominations:[50,100,300,500],     emoji:"⚔️", category:"Gaming",    bg:"#003F8A", accent:"#0066cc" },
  // ═══════════════════════════════════════════════════════════════
  //  RAZER GOLD
  // ═══════════════════════════════════════════════════════════════
  { id:"rz-us",    brand:"Razer Gold",    region:"Global USD",   currency:"USD", symbol:"$",  denominations:[5,10,25,50,100],     emoji:"💚", category:"Gaming",    bg:"#1A1A1A", accent:"#44D62C" },
  { id:"rz-my",    brand:"Razer Gold",    region:"Malaysia",     currency:"MYR", symbol:"RM", denominations:[5,10,30,50,100],     emoji:"💚", category:"Gaming",    bg:"#1A1A1A", accent:"#44D62C" },
  { id:"rz-id",    brand:"Razer Gold",    region:"Indonesia",    currency:"IDR", symbol:"Rp", denominations:[20000,50000,100000,200000], emoji:"💚", category:"Gaming", bg:"#1A1A1A", accent:"#44D62C" },
  { id:"rz-ph",    brand:"Razer Gold",    region:"Philippines",  currency:"PHP", symbol:"₱",  denominations:[50,100,300,500],     emoji:"💚", category:"Gaming",    bg:"#1A1A1A", accent:"#44D62C" },
  { id:"rz-sg",    brand:"Razer Gold",    region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[5,10,30,50,100],     emoji:"💚", category:"Gaming",    bg:"#1A1A1A", accent:"#44D62C" },
  // ═══════════════════════════════════════════════════════════════
  //  VALORANT
  // ═══════════════════════════════════════════════════════════════
  { id:"val-us",   brand:"Valorant",      region:"USA",          currency:"USD", symbol:"$",  denominations:[5,10,25,50],         emoji:"🔺", category:"Gaming",    bg:"#FF4655", accent:"#ff6b77" },
  { id:"val-eu",   brand:"Valorant",      region:"EU",           currency:"EUR", symbol:"€",  denominations:[5,10,25,50],         emoji:"🔺", category:"Gaming",    bg:"#FF4655", accent:"#ff6b77" },
  { id:"val-tr",   brand:"Valorant",      region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[20,50,100,250],      emoji:"🔺", category:"Gaming",    bg:"#FF4655", accent:"#ff6b77" },
  { id:"val-sa",   brand:"Valorant",      region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[15,30,60,120],       emoji:"🔺", category:"Gaming",    bg:"#FF4655", accent:"#ff6b77" },
  // ═══════════════════════════════════════════════════════════════
  //  LEAGUE OF LEGENDS
  // ═══════════════════════════════════════════════════════════════
  { id:"lol-us",   brand:"League of Legends", region:"NA",       currency:"USD", symbol:"$",  denominations:[5,10,20,50],         emoji:"⚗️", category:"Gaming",    bg:"#C89B3C", accent:"#f0c060" },
  { id:"lol-eu",   brand:"League of Legends", region:"EU West",  currency:"EUR", symbol:"€",  denominations:[5,10,20,50],         emoji:"⚗️", category:"Gaming",    bg:"#C89B3C", accent:"#f0c060" },
  { id:"lol-tr",   brand:"League of Legends", region:"Turkey",   currency:"TRY", symbol:"₺",  denominations:[20,50,100,250],      emoji:"⚗️", category:"Gaming",    bg:"#C89B3C", accent:"#f0c060" },
  { id:"lol-kr",   brand:"League of Legends", region:"Korea",    currency:"KRW", symbol:"₩",  denominations:[10000,30000,50000],  emoji:"⚗️", category:"Gaming",    bg:"#C89B3C", accent:"#f0c060" },
  // ═══════════════════════════════════════════════════════════════
  //  NETFLIX
  // ═══════════════════════════════════════════════════════════════
  { id:"nf-us",    brand:"Netflix",        region:"USA",          currency:"USD", symbol:"$",  denominations:[15,25,60,100],       emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-uk",    brand:"Netflix",        region:"UK",           currency:"GBP", symbol:"£",  denominations:[15,25,50],           emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-eu",    brand:"Netflix",        region:"EU",           currency:"EUR", symbol:"€",  denominations:[15,25,50,100],       emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-au",    brand:"Netflix",        region:"Australia",    currency:"AUD", symbol:"A$", denominations:[20,35,70],           emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-ca",    brand:"Netflix",        region:"Canada",       currency:"CAD", symbol:"C$", denominations:[20,35,60],           emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-br",    brand:"Netflix",        region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[45,90,180],          emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-mx",    brand:"Netflix",        region:"Mexico",       currency:"MXN", symbol:"$",  denominations:[179,239,419],        emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-tr",    brand:"Netflix",        region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[60,100,200],         emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-in",    brand:"Netflix",        region:"India",        currency:"INR", symbol:"₹",  denominations:[149,199,499],        emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  { id:"nf-sg",    brand:"Netflix",        region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[20,35,60],           emoji:"🎬", category:"Streaming", bg:"#E50914", accent:"#ff1a24" },
  // ═══════════════════════════════════════════════════════════════
  //  SPOTIFY
  // ═══════════════════════════════════════════════════════════════
  { id:"sp-us",    brand:"Spotify",        region:"USA",          currency:"USD", symbol:"$",  denominations:[10,30,60],           emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-uk",    brand:"Spotify",        region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,30,60],           emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-eu",    brand:"Spotify",        region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,30,60],           emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-au",    brand:"Spotify",        region:"Australia",    currency:"AUD", symbol:"A$", denominations:[13,40,80],           emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-ca",    brand:"Spotify",        region:"Canada",       currency:"CAD", symbol:"C$", denominations:[13,40,80],           emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-br",    brand:"Spotify",        region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[17,51,100],          emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-tr",    brand:"Spotify",        region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[18,54,108],          emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  { id:"sp-in",    brand:"Spotify",        region:"India",        currency:"INR", symbol:"₹",  denominations:[119,699],            emoji:"🎵", category:"Streaming", bg:"#1DB954", accent:"#1ed760" },
  // ═══════════════════════════════════════════════════════════════
  //  DISNEY+
  // ═══════════════════════════════════════════════════════════════
  { id:"dsp-us",   brand:"Disney+",        region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50],           emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  { id:"dsp-uk",   brand:"Disney+",        region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,25,50],           emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  { id:"dsp-eu",   brand:"Disney+",        region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,25,50],           emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  { id:"dsp-au",   brand:"Disney+",        region:"Australia",    currency:"AUD", symbol:"A$", denominations:[15,30,60],           emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  { id:"dsp-ca",   brand:"Disney+",        region:"Canada",       currency:"CAD", symbol:"C$", denominations:[15,30,60],           emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  { id:"dsp-sa",   brand:"Disney+",        region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[25,75],              emoji:"✨", category:"Streaming", bg:"#113CCF", accent:"#1a4fff" },
  // ═══════════════════════════════════════════════════════════════
  //  YOUTUBE PREMIUM
  // ═══════════════════════════════════════════════════════════════
  { id:"yt-us",    brand:"YouTube Premium", region:"USA",         currency:"USD", symbol:"$",  denominations:[14,42,140],          emoji:"▶️", category:"Streaming", bg:"#FF0000", accent:"#ff3333" },
  { id:"yt-uk",    brand:"YouTube Premium", region:"UK",          currency:"GBP", symbol:"£",  denominations:[12,36,120],          emoji:"▶️", category:"Streaming", bg:"#FF0000", accent:"#ff3333" },
  { id:"yt-au",    brand:"YouTube Premium", region:"Australia",   currency:"AUD", symbol:"A$", denominations:[15,45,150],          emoji:"▶️", category:"Streaming", bg:"#FF0000", accent:"#ff3333" },
  // ═══════════════════════════════════════════════════════════════
  //  HULU
  // ═══════════════════════════════════════════════════════════════
  { id:"hulu-us",  brand:"Hulu",           region:"USA",          currency:"USD", symbol:"$",  denominations:[25,50,100],          emoji:"📺", category:"Streaming", bg:"#1CE783", accent:"#00e673" },
  // ═══════════════════════════════════════════════════════════════
  //  AMAZON
  // ═══════════════════════════════════════════════════════════════
  { id:"amz-us",   brand:"Amazon",         region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50,100,200],   emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-uk",   brand:"Amazon",         region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-de",   brand:"Amazon",         region:"Germany",      currency:"EUR", symbol:"€",  denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-fr",   brand:"Amazon",         region:"France",       currency:"EUR", symbol:"€",  denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-it",   brand:"Amazon",         region:"Italy",        currency:"EUR", symbol:"€",  denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-es",   brand:"Amazon",         region:"Spain",        currency:"EUR", symbol:"€",  denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-au",   brand:"Amazon",         region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-ca",   brand:"Amazon",         region:"Canada",       currency:"CAD", symbol:"C$", denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-jp",   brand:"Amazon",         region:"Japan",        currency:"JPY", symbol:"¥",  denominations:[1000,3000,5000,10000], emoji:"📦", category:"Shopping", bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-in",   brand:"Amazon",         region:"India",        currency:"INR", symbol:"₹",  denominations:[500,1000,2000,5000], emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-ae",   brand:"Amazon",         region:"UAE",          currency:"AED", symbol:"د",  denominations:[25,50,100,200],      emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-sa",   brand:"Amazon",         region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[25,50,100,200],      emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-br",   brand:"Amazon",         region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[30,75,150,300],      emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-mx",   brand:"Amazon",         region:"Mexico",       currency:"MXN", symbol:"$",  denominations:[200,500,1000,2000],  emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-sg",   brand:"Amazon",         region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[10,25,50,100],       emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  { id:"amz-tr",   brand:"Amazon",         region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[50,100,250,500],     emoji:"📦", category:"Shopping",  bg:"#232F3E", accent:"#FF9900" },
  // ═══════════════════════════════════════════════════════════════
  //  APPLE iTunes / APP STORE
  // ═══════════════════════════════════════════════════════════════
  { id:"apl-us",   brand:"Apple",          region:"USA",          currency:"USD", symbol:"$",  denominations:[10,15,25,50,100,200], emoji:"🍎", category:"Shopping", bg:"#555", accent:"#888" },
  { id:"apl-uk",   brand:"Apple",          region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,15,25,50,100],    emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-eu",   brand:"Apple",          region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,15,25,50,100],    emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-au",   brand:"Apple",          region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,20,30,50,100],    emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-ca",   brand:"Apple",          region:"Canada",       currency:"CAD", symbol:"C$", denominations:[10,15,25,50,100],    emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-jp",   brand:"Apple",          region:"Japan",        currency:"JPY", symbol:"¥",  denominations:[1500,3000,5000,10000], emoji:"🍎", category:"Shopping", bg:"#555", accent:"#888" },
  { id:"apl-sa",   brand:"Apple",          region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[25,50,100,200],      emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-ae",   brand:"Apple",          region:"UAE",          currency:"AED", symbol:"د",  denominations:[25,50,100,200],      emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-br",   brand:"Apple",          region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[30,75,150,300],      emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-mx",   brand:"Apple",          region:"Mexico",       currency:"MXN", symbol:"$",  denominations:[200,500,1000],       emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-in",   brand:"Apple",          region:"India",        currency:"INR", symbol:"₹",  denominations:[500,1000,2000,5000], emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-tr",   brand:"Apple",          region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[50,100,250,500],     emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-hk",   brand:"Apple",          region:"Hong Kong",    currency:"HKD", symbol:"HK$", denominations:[50,100,200,400],   emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-sg",   brand:"Apple",          region:"Singapore",    currency:"SGD", symbol:"S$", denominations:[15,30,50,100],      emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-kr",   brand:"Apple",          region:"South Korea",  currency:"KRW", symbol:"₩",  denominations:[10000,30000,50000],  emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  { id:"apl-za",   brand:"Apple",          region:"South Africa", currency:"ZAR", symbol:"R",  denominations:[100,250,500,1000],   emoji:"🍎", category:"Shopping",  bg:"#555", accent:"#888" },
  // ═══════════════════════════════════════════════════════════════
  //  GOOGLE PLAY
  // ═══════════════════════════════════════════════════════════════
  { id:"gp-us",    brand:"Google Play",    region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50,100,200],   emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-uk",    brand:"Google Play",    region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,15,25,50,100],    emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-eu",    brand:"Google Play",    region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,15,25,50,100],    emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-au",    brand:"Google Play",    region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,25,50,100],       emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-ca",    brand:"Google Play",    region:"Canada",       currency:"CAD", symbol:"C$", denominations:[10,25,50,100],       emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-jp",    brand:"Google Play",    region:"Japan",        currency:"JPY", symbol:"¥",  denominations:[1000,3000,5000],     emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-in",    brand:"Google Play",    region:"India",        currency:"INR", symbol:"₹",  denominations:[250,500,1000,2000],  emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-br",    brand:"Google Play",    region:"Brazil",       currency:"BRL", symbol:"R$", denominations:[25,50,100,200],      emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-mx",    brand:"Google Play",    region:"Mexico",       currency:"MXN", symbol:"$",  denominations:[100,250,500],        emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-sa",    brand:"Google Play",    region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[20,50,100,200],      emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-ae",    brand:"Google Play",    region:"UAE",          currency:"AED", symbol:"د",  denominations:[20,50,100,200],      emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-tr",    brand:"Google Play",    region:"Turkey",       currency:"TRY", symbol:"₺",  denominations:[25,50,100,250],      emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-hk",    brand:"Google Play",    region:"Hong Kong",    currency:"HKD", symbol:"HK$", denominations:[30,75,150,300],    emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-id",    brand:"Google Play",    region:"Indonesia",    currency:"IDR", symbol:"Rp", denominations:[20000,50000,100000], emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-ph",    brand:"Google Play",    region:"Philippines",  currency:"PHP", symbol:"₱",  denominations:[100,300,500,1000],   emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  { id:"gp-za",    brand:"Google Play",    region:"South Africa", currency:"ZAR", symbol:"R",  denominations:[50,100,250,500],     emoji:"▶️", category:"Mobile",    bg:"#4285F4", accent:"#5a9cf0" },
  // ═══════════════════════════════════════════════════════════════
  //  CASH APP / PAYPAL
  // ═══════════════════════════════════════════════════════════════
  { id:"cash-us",  brand:"Cash App",       region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50,100],       emoji:"💸", category:"Mobile",    bg:"#00D632", accent:"#00f03a" },
  { id:"pp-us",    brand:"PayPal",         region:"USA",          currency:"USD", symbol:"$",  denominations:[10,25,50,100],       emoji:"💳", category:"Mobile",    bg:"#003087", accent:"#009cde" },
  { id:"pp-uk",    brand:"PayPal",         region:"UK",           currency:"GBP", symbol:"£",  denominations:[10,25,50,100],       emoji:"💳", category:"Mobile",    bg:"#003087", accent:"#009cde" },
  { id:"pp-eu",    brand:"PayPal",         region:"EU",           currency:"EUR", symbol:"€",  denominations:[10,25,50,100],       emoji:"💳", category:"Mobile",    bg:"#003087", accent:"#009cde" },
  { id:"pp-au",    brand:"PayPal",         region:"Australia",    currency:"AUD", symbol:"A$", denominations:[10,25,50,100],       emoji:"💳", category:"Mobile",    bg:"#003087", accent:"#009cde" },
  // ═══════════════════════════════════════════════════════════════
  //  TELECOM / DATA
  // ═══════════════════════════════════════════════════════════════
  { id:"mtn-ng",   brand:"MTN",            region:"Nigeria",      currency:"NGN", symbol:"₦",  denominations:[200,500,1000,2000,5000], emoji:"📱", category:"Telecom", bg:"#FFCB04", accent:"#ffe033" },
  { id:"mtn-gh",   brand:"MTN",            region:"Ghana",        currency:"GHS", symbol:"₵",  denominations:[5,10,20,50,100],     emoji:"📱", category:"Telecom",   bg:"#FFCB04", accent:"#ffe033" },
  { id:"mtn-za",   brand:"MTN",            region:"South Africa", currency:"ZAR", symbol:"R",  denominations:[10,20,50,100,200],   emoji:"📱", category:"Telecom",   bg:"#FFCB04", accent:"#ffe033" },
  { id:"mtn-ug",   brand:"MTN",            region:"Uganda",       currency:"UGX", symbol:"Ush", denominations:[1000,5000,10000,20000], emoji:"📱", category:"Telecom", bg:"#FFCB04", accent:"#ffe033" },
  { id:"mtn-cm",   brand:"MTN",            region:"Cameroon",     currency:"XAF", symbol:"Fr", denominations:[500,1000,5000,10000], emoji:"📱", category:"Telecom",  bg:"#FFCB04", accent:"#ffe033" },
  { id:"afl-ng",   brand:"Airtel",         region:"Nigeria",      currency:"NGN", symbol:"₦",  denominations:[200,500,1000,2000],  emoji:"📶", category:"Telecom",   bg:"#E40000", accent:"#ff2222" },
  { id:"afl-in",   brand:"Airtel",         region:"India",        currency:"INR", symbol:"₹",  denominations:[100,300,500,1000],   emoji:"📶", category:"Telecom",   bg:"#E40000", accent:"#ff2222" },
  { id:"saf-ke",   brand:"Safaricom",      region:"Kenya",        currency:"KES", symbol:"Ksh", denominations:[100,200,500,1000,2000], emoji:"📲", category:"Telecom", bg:"#4CAF50", accent:"#5dbe5d" },
  { id:"etis-eg",  brand:"Etisalat",       region:"Egypt",        currency:"EGP", symbol:"E£", denominations:[25,50,100,200],      emoji:"📡", category:"Telecom",   bg:"#FF6A00", accent:"#ff8c33" },
  { id:"or-eg",    brand:"Orange",         region:"Egypt",        currency:"EGP", symbol:"E£", denominations:[25,50,100,200],      emoji:"🟠", category:"Telecom",   bg:"#FF7900", accent:"#ffa033" },
  { id:"vod-eg",   brand:"Vodafone",       region:"Egypt",        currency:"EGP", symbol:"E£", denominations:[25,50,100,200],      emoji:"📞", category:"Telecom",   bg:"#E60000", accent:"#ff3333" },
  { id:"zain-sa",  brand:"Zain",           region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[10,25,50,100],       emoji:"📡", category:"Telecom",   bg:"#EE1C25", accent:"#ff4444" },
  { id:"zain-kw",  brand:"Zain",           region:"Kuwait",       currency:"KWD", symbol:"KD", denominations:[1,2,5,10],           emoji:"📡", category:"Telecom",   bg:"#EE1C25", accent:"#ff4444" },
  { id:"zain-bh",  brand:"Zain",           region:"Bahrain",      currency:"BHD", symbol:"BD", denominations:[1,2,5,10],           emoji:"📡", category:"Telecom",   bg:"#EE1C25", accent:"#ff4444" },
  { id:"mob-sa",   brand:"Mobily",         region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[10,25,50,100],       emoji:"📳", category:"Telecom",   bg:"#00984A", accent:"#00c061" },
  { id:"stc-sa",   brand:"STC Pay",        region:"Saudi Arabia", currency:"SAR", symbol:"﷼",  denominations:[10,25,50,100,200],   emoji:"💜", category:"Telecom",   bg:"#7E1D8C", accent:"#a0229e" },
  { id:"du-ae",    brand:"Du Telecom",     region:"UAE",          currency:"AED", symbol:"د",  denominations:[25,50,100,200],      emoji:"📱", category:"Telecom",   bg:"#D90074", accent:"#ff0099" },
  { id:"eti-ae",   brand:"Etisalat UAE",   region:"UAE",          currency:"AED", symbol:"د",  denominations:[25,50,100,200],      emoji:"📡", category:"Telecom",   bg:"#00964D", accent:"#00c060" },
];

type Category = "All" | "Gaming" | "Streaming" | "Shopping" | "Mobile" | "Telecom";

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  All:       <Globe size={13} />,
  Gaming:    <Gamepad2 size={13} />,
  Streaming: <Tv size={13} />,
  Shopping:  <ShoppingBag size={13} />,
  Mobile:    <Smartphone size={13} />,
  Telecom:   <Gift size={13} />,
};

const SUPPORT_WHATSAPP = "254756816951";

const BRAND_IMAGES: Record<string, string> = {
  "PlayStation":        "https://img.logo.dev/playstation.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Xbox":               "https://img.logo.dev/xbox.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Nintendo eShop":     "https://img.logo.dev/nintendo.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Steam":              "https://img.logo.dev/steampowered.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Roblox":             "https://img.logo.dev/roblox.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Fortnite":           "https://img.logo.dev/epicgames.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Call of Duty":       "https://img.logo.dev/callofduty.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "EA Play":            "https://img.logo.dev/ea.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Minecraft":          "https://img.logo.dev/minecraft.net?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Valorant":           "https://img.logo.dev/playvalorant.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Apex Legends":       "https://img.logo.dev/ea.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Ubisoft":            "https://img.logo.dev/ubisoft.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Battlenet":          "https://img.logo.dev/blizzard.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Razer Gold":         "https://img.logo.dev/razer.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "League of Legends":  "https://img.logo.dev/leagueoflegends.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "PUBG Mobile":        "https://img.logo.dev/pubg.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Free Fire":          "https://img.logo.dev/garena.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Mobile Legends":     "https://img.logo.dev/moonton.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Netflix":            "https://img.logo.dev/netflix.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Spotify":            "https://img.logo.dev/spotify.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "YouTube Premium":    "https://img.logo.dev/youtube.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Hulu":               "https://img.logo.dev/hulu.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Disney+":            "https://img.logo.dev/disneyplus.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Twitch":             "https://img.logo.dev/twitch.tv?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Amazon":             "https://img.logo.dev/amazon.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Google Play":        "https://img.logo.dev/google.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Apple":              "https://img.logo.dev/apple.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Cash App":           "https://img.logo.dev/cash.app?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "PayPal":             "https://img.logo.dev/paypal.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "eBay":               "https://img.logo.dev/ebay.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Crunchyroll":        "https://img.logo.dev/crunchyroll.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Deezer":             "https://img.logo.dev/deezer.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Tidal":              "https://img.logo.dev/tidal.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Paramount+":         "https://img.logo.dev/paramountplus.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Audible":            "https://img.logo.dev/audible.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Discord Nitro":      "https://img.logo.dev/discord.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Binance":            "https://img.logo.dev/binance.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "T-Mobile":           "https://img.logo.dev/t-mobile.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "AT&T":               "https://img.logo.dev/att.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Verizon":            "https://img.logo.dev/verizon.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
  "Lycamobile":         "https://img.logo.dev/lycamobile.com?token=pk_TCgqx3C7R9Oke-Nl5P9SYw",
};

const EUR_TO_USD = 1.08;
const GBP_TO_USD = 1.27;
const AUD_TO_USD = 0.65;
const CAD_TO_USD = 0.73;
const JPY_TO_USD = 0.0067;
const BRL_TO_USD = 0.19;
const MXN_TO_USD = 0.058;
const SAR_TO_USD = 0.27;
const AED_TO_USD = 0.27;
const TRY_TO_USD = 0.031;
const HKD_TO_USD = 0.13;
const SGD_TO_USD = 0.74;
const INR_TO_USD = 0.012;
const ARS_TO_USD = 0.0011;
const ZAR_TO_USD = 0.055;

export function toUSD(amount: number, currency: string): number {
  const rates: Record<string, number> = {
    USD: 1, EUR: EUR_TO_USD, GBP: GBP_TO_USD, AUD: AUD_TO_USD,
    CAD: CAD_TO_USD, JPY: JPY_TO_USD, BRL: BRL_TO_USD, MXN: MXN_TO_USD,
    SAR: SAR_TO_USD, AED: AED_TO_USD, TRY: TRY_TO_USD, HKD: HKD_TO_USD,
    SGD: SGD_TO_USD, INR: INR_TO_USD, ARS: ARS_TO_USD, ZAR: ZAR_TO_USD,
  };
  const rate = rates[currency] ?? 1;
  return Math.max(13, Math.ceil(amount * rate * 100) / 100);
}

function getBrandImage(brand: string): string | null {
  if (BRAND_IMAGES[brand]) return BRAND_IMAGES[brand];
  const b = brand.toLowerCase();
  for (const [key, url] of Object.entries(BRAND_IMAGES)) {
    if (b.includes(key.toLowerCase()) || key.toLowerCase().includes(b)) return url;
  }
  return null;
}

function getBrandDomain(brand: string): string | null {
  const domainMap: Record<string, string> = {
    "PlayStation": "playstation.com", "Xbox": "xbox.com", "Nintendo eShop": "nintendo.com",
    "Steam": "steampowered.com", "Roblox": "roblox.com", "Fortnite": "epicgames.com",
    "Call of Duty": "callofduty.com", "EA Play": "ea.com", "Minecraft": "minecraft.net",
    "Valorant": "playvalorant.com", "Apex Legends": "ea.com", "Ubisoft": "ubisoft.com",
    "Battlenet": "blizzard.com", "Razer Gold": "razer.com", "League of Legends": "leagueoflegends.com",
    "PUBG Mobile": "pubg.com", "Free Fire": "garena.com", "Mobile Legends": "moonton.com",
    "Netflix": "netflix.com", "Spotify": "spotify.com", "YouTube Premium": "youtube.com",
    "Hulu": "hulu.com", "Disney+": "disneyplus.com", "Twitch": "twitch.tv",
    "Amazon": "amazon.com", "Google Play": "google.com", "Apple": "apple.com",
    "Cash App": "cash.app", "PayPal": "paypal.com", "eBay": "ebay.com",
    "Crunchyroll": "crunchyroll.com", "Deezer": "deezer.com", "Tidal": "tidal.com",
    "Paramount+": "paramountplus.com", "Audible": "audible.com", "Discord Nitro": "discord.com",
    "Binance": "binance.com", "T-Mobile": "t-mobile.com", "AT&T": "att.com",
    "Verizon": "verizon.com", "Lycamobile": "lycamobile.com",
  };
  if (domainMap[brand]) return domainMap[brand];
  const b = brand.toLowerCase();
  for (const [key, domain] of Object.entries(domainMap)) {
    if (b.includes(key.toLowerCase()) || key.toLowerCase().includes(b)) return domain;
  }
  return null;
}

function BrandLogo({ brand, emoji, size = "md" }: { brand: string; emoji: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const primaryUrl = getBrandImage(brand);
  const domain = getBrandDomain(brand);
  const fallbackUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
  const [stage, setStage] = useState<"primary" | "fallback" | "emoji">(primaryUrl ? "primary" : fallbackUrl ? "fallback" : "emoji");
  const dim = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-12 h-12" : size === "xl" ? "w-16 h-16" : "w-9 h-9";
  const textSize = size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : size === "xl" ? "text-5xl" : "text-3xl";
  const currentUrl = stage === "primary" ? primaryUrl : stage === "fallback" ? fallbackUrl : null;
  if (currentUrl) {
    return (
      <img
        src={currentUrl}
        className={`${dim} object-contain rounded-xl bg-white p-1.5 shadow-sm`}
        onError={() => setStage(stage === "primary" && fallbackUrl ? "fallback" : "emoji")}
        alt={brand}
      />
    );
  }
  return <span className={textSize}>{emoji}</span>;
}

type GcStep =
  | { type: "form" }
  | { type: "payment_select" }
  | { type: "nowpayments_pending"; orderId: number; activationId: number; paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string }
  | { type: "manual_pending"; orderId: number; activationId: number; paymentMethod: string; details: Record<string, unknown>; total: number }
  | { type: "done"; orderId: number; activationId: number };

type PayMethod = "wallet" | "nowpayments" | "mpesa" | "binance_pay" | "usdt_manual";

export function GiftCardsPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, token, user } = useAuth();
  const { toast } = useToast();
  const { data: walletBalance = 0 } = useWalletBalance();

  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null);
  const [selectedDenom, setSelectedDenom] = useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [gcStep, setGcStep] = useState<GcStep>({ type: "form" });
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [phone, setPhone] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Prefill email from logged-in user
  useEffect(() => {
    if (user?.email && !recipientEmail) setRecipientEmail(user.email);
  }, [user]);

  // NOWPayments polling
  useEffect(() => {
    if (gcStep.type !== "nowpayments_pending") return;
    const { orderId, paymentId } = gcStep;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/nowpayments/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ orderId, paymentId }),
        });
        const d = await res.json() as { paymentStatus: string };
        if (d.paymentStatus === "paid") {
          clearInterval(interval);
          setGcStep(s => s.type === "nowpayments_pending" ? { type: "done", orderId: s.orderId, activationId: s.activationId } : s);
        } else if (d.paymentStatus === "failed") {
          clearInterval(interval);
          toast({ title: "Payment failed or expired", variant: "destructive" });
          setGcStep({ type: "payment_select" });
        }
      } catch { /* retry next tick */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [gcStep]);

  const filtered = useMemo(() => {
    const USD_EUR_ONLY = GIFT_CARDS.filter((c) => c.currency === "USD" || c.currency === "EUR");
    let cards = category === "All" ? USD_EUR_ONLY : USD_EUR_ONLY.filter((c) => c.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter((c) =>
        c.brand.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
      );
    }
    const currencyPriority = (c: string) => c === "USD" ? 0 : c === "EUR" ? 1 : 2;
    return [...cards].sort((a, b) => {
      if (a.brand === b.brand) return currencyPriority(a.currency) - currencyPriority(b.currency);
      return 0;
    });
  }, [category, search]);

  const counts = useMemo(() => {
    const cats: Category[] = ["Gaming", "Streaming", "Shopping", "Mobile", "Telecom"];
    const result: Record<string, number> = { All: GIFT_CARDS.length };
    for (const c of cats) result[c] = GIFT_CARDS.filter((g) => g.category === c).length;
    return result;
  }, []);

  function selectCard(card: CardEntry) {
    setSelectedCard(card);
    setSelectedDenom(null);
    setRecipientEmail("");
    setMessage("");
    setGcStep({ type: "form" });
    setPayMethod(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleContinueToPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !selectedDenom) {
      toast({ variant: "destructive", title: "Please select a gift card and denomination" });
      return;
    }
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast({ variant: "destructive", title: "Please enter a valid recipient email" });
      return;
    }
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "Please sign in to place an order" });
      return;
    }
    setGcStep({ type: "payment_select" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePlaceOrder() {
    if (!selectedCard || !selectedDenom || !payMethod) return;
    const isUsd = selectedCard.currency === "USD";
    const priceUsd = isUsd ? selectedDenom : undefined;

    if (payMethod === "wallet" && isUsd && walletBalance < selectedDenom) {
      toast({ variant: "destructive", title: "Insufficient wallet balance", description: `You have $${walletBalance.toFixed(2)} but need $${selectedDenom.toFixed(2)}.` });
      return;
    }
    if (payMethod === "nowpayments" && (!priceUsd || priceUsd < 13)) {
      toast({ variant: "destructive", title: "Amount too low", description: "NOWPayments requires a minimum of $13.00." });
      return;
    }
    if (payMethod === "mpesa" && !phone) {
      toast({ variant: "destructive", title: "Phone number required for M-Pesa" });
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/gift-cards/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          brand: selectedCard.brand,
          region: selectedCard.region,
          currency: selectedCard.currency,
          symbol: selectedCard.symbol,
          denomination: selectedDenom,
          recipientEmail,
          giftMessage: message || undefined,
          paymentMethod: payMethod,
          priceUsd,
          payCurrency: payMethod === "nowpayments" ? npCurrency : undefined,
          customerPhone: payMethod === "mpesa" ? phone : undefined,
        }),
      });
      const data = await res.json() as {
        orderId?: number;
        activationId?: number;
        status?: string;
        total?: number;
        custom?: Record<string, unknown> | null;
        nowpayments?: { paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null;
        mpesa?: { checkoutRequestId: string; message: string } | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      const orderId = data.orderId!;
      const activationId = data.activationId!;

      if (data.status === "paid" || payMethod === "wallet") {
        setGcStep({ type: "done", orderId, activationId });
        toast({ title: "Order placed!", description: "Your gift card code will be delivered within 1-24 hours." });
      } else if (data.nowpayments) {
        const np = data.nowpayments;
        setGcStep({ type: "nowpayments_pending", orderId, activationId, paymentId: np.paymentId, payAddress: np.payAddress, payAmount: np.payAmount, payCurrency: np.payCurrency, expiresAt: np.expiresAt });
      } else if (data.custom) {
        setGcStep({ type: "manual_pending", orderId, activationId, paymentMethod: payMethod, details: data.custom, total: data.total ?? 0 });
      } else if (data.mpesa) {
        toast({ title: "STK Push sent!", description: data.mpesa.message });
      } else {
        setGcStep({ type: "done", orderId, activationId });
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to submit" });
    } finally {
      setLoading(false);
    }
  }

  const [customDenomStr, setCustomDenomStr] = useState("");

  function resetAll() {
    setSelectedCard(null);
    setSelectedDenom(null);
    setCustomDenomStr("");
    setRecipientEmail("");
    setMessage("");
    setGcStep({ type: "form" });
    setPayMethod(null);
  }

  const CATEGORIES: Category[] = ["All", "Gaming", "Streaming", "Shopping", "Mobile", "Telecom"];

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-10">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#0a4c6a 100%)" }} className="px-4 pt-4 pb-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-1.5">
            {selectedCard ? (
              <button onClick={resetAll} className="text-blue-300/60 hover:text-blue-200 mr-1">
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <Gift size={17} className="text-blue-300" />
            <h1 className="text-white font-black text-base">Gift Cards</h1>
            {!selectedCard && (
              <span className="ml-auto text-blue-300/60 text-[11px]">{GIFT_CARDS.length} cards · {CATEGORIES.length - 1} categories</span>
            )}
          </div>
          <p className="text-blue-200/50 text-[11px] ml-7">
            {selectedCard
              ? `${selectedCard.brand} · ${selectedCard.region} · ${selectedCard.currency}`
              : "Digital gift cards for gaming, streaming, shopping & telecom — worldwide regions"}
          </p>

          {/* Search bar (only on browse) */}
          {!selectedCard && (
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search brand or region (e.g. PlayStation, Nigeria…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 mt-4 space-y-4">

        {/* ── ORDER FORM ─────────────────────────────────────────────────────── */}
        {selectedCard && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Card header */}
            <div
              className="px-5 pt-5 pb-4 flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${selectedCard.bg} 0%, ${selectedCard.accent} 100%)` }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden">
                <BrandLogo brand={selectedCard.brand} emoji={selectedCard.emoji} size="lg" />
              </div>
              <div>
                <p className="text-white font-black text-base leading-tight">{selectedCard.brand}</p>
                <p className="text-white/70 text-xs">{selectedCard.region} · {selectedCard.currency}</p>
              </div>
              <button onClick={resetAll} className="ml-auto text-white/60 hover:text-white text-xs underline">
                Change
              </button>
            </div>

            {/* ── Done ──────────────────────────────────────────────────── */}
            {gcStep.type === "done" ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h2 className="text-lg font-black text-gray-800">Order Placed!</h2>
                <p className="text-gray-500 text-sm">
                  Your gift card code will be delivered within <strong>1–24 hours</strong>.
                  Reference: <strong>GC-{gcStep.activationId}</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={resetAll} className="py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 text-sm">
                    Buy Another
                  </button>
                  <button onClick={() => navigate("/account/activations")} className="py-3 bg-[#1a2332] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">
                    View Orders <ArrowRight size={14} />
                  </button>
                </div>
              </div>

            ) : gcStep.type === "nowpayments_pending" ? (
              /* ── NOWPayments QR pending ──────────────────────────────── */
              <div className="p-5 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Send Crypto Payment</p>
                  <p className="text-2xl font-black text-gray-900">{gcStep.payAmount} {gcStep.payCurrency.toUpperCase()}</p>
                  {gcStep.expiresAt && <p className="text-[11px] text-gray-400">Expires: {new Date(gcStep.expiresAt).toLocaleTimeString()}</p>}
                  <QRCodeSVG value={gcStep.payAddress} size={140} level="M" className="rounded-xl border-4 border-gray-100 shadow-md mt-1" />
                  <p className="text-[10px] text-gray-400">Scan QR or copy address below</p>
                </div>
                {[
                  { label: "Payment Address", value: gcStep.payAddress, key: "addr" },
                  { label: `Amount (${gcStep.payCurrency.toUpperCase()})`, value: `${gcStep.payAmount}`, key: "amt" },
                ].map(({ label, value, key }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{label}</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-700 break-all">{value}</div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }}
                        className={`shrink-0 px-3 rounded-xl text-xs font-bold flex items-center gap-1 ${copiedKey === key ? "bg-green-600 text-white" : "bg-[#1a2332] text-white"}`}
                      >
                        {copiedKey === key ? <><Check size={12} /> Done</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">Checking every 30s for confirmation…</p>
                </div>
                <button onClick={() => setGcStep({ type: "payment_select" })} className="w-full py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-2xl">
                  Cancel &amp; Go Back
                </button>
              </div>

            ) : gcStep.type === "manual_pending" ? (
              /* ── Manual payment pending (Binance / USDT) ─────────────── */
              (() => {
                const isBinance = gcStep.paymentMethod === "binance_pay";
                const binanceId = gcStep.details.binanceId as string | undefined;
                const usdtAddr = gcStep.details.address as string | undefined;
                return (
                  <div className="p-5 space-y-4">
                    <div className="text-center pt-2">
                      <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
                        <span className="text-3xl">{isBinance ? "🟡" : "💲"}</span>
                      </div>
                      <h2 className="text-base font-black text-gray-800">Order #{gcStep.orderId} Placed!</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Now send payment — we verify within 10-30 minutes.</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Amount Due</span><span className="font-black text-gray-900">${gcStep.total.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Method</span><span className="font-bold text-gray-700">{isBinance ? "Binance Pay" : "USDT TRC20"}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Reference</span><span className="font-black text-blue-600">ORDER-{gcStep.orderId}</span></div>
                    </div>
                    {isBinance && binanceId ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest mb-1">Binance Pay ID</p>
                        <p className="text-3xl font-black text-gray-900 tracking-widest">{binanceId}</p>
                        <p className="text-[10px] text-yellow-700 mt-1">Include <strong>ORDER-{gcStep.orderId}</strong> in the payment note.</p>
                      </div>
                    ) : usdtAddr ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-1">USDT TRC20 Address</p>
                        <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                          <span className="font-mono text-[10px] text-gray-700 break-all flex-1">{usdtAddr}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(usdtAddr); setCopiedKey("usdt"); setTimeout(() => setCopiedKey(null), 2000); }}
                            className={`shrink-0 px-2 py-1 rounded text-xs font-bold ${copiedKey === "usdt" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}
                          >
                            {copiedKey === "usdt" ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-green-800 mt-1">Network: TRON (TRC20) only</p>
                        <p className="text-[10px] text-green-700">Include <strong>ORDER-{gcStep.orderId}</strong> as memo.</p>
                      </div>
                    ) : null}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs text-blue-700">Payment instructions sent to your email. Our team verifies within <strong>10-30 minutes</strong>.</p>
                    </div>
                    <button onClick={() => navigate("/account/activations")} className="w-full py-3.5 bg-[#1a2332] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2">
                      View My Orders <ArrowRight size={16} />
                    </button>
                    <button onClick={resetAll} className="w-full py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-2xl">
                      Buy Another Card
                    </button>
                  </div>
                );
              })()

            ) : gcStep.type === "payment_select" && selectedCard && selectedDenom ? (
              /* ── Payment method selection ────────────────────────────── */
              <div className="p-5 space-y-4">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-600 font-semibold">Order Summary</p>
                    <p className="text-sm font-black text-blue-800 mt-0.5">{selectedCard.brand} {selectedCard.region} · {selectedCard.symbol}{selectedDenom.toLocaleString()}</p>
                    <p className="text-xs text-blue-500 mt-0.5">To: {recipientEmail}</p>
                  </div>
                  {selectedCard.currency === "USD" && <span className="text-xl font-black text-blue-700">${selectedDenom.toFixed(2)}</span>}
                </div>

                {/* Payment methods */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Payment Method</p>
                  <div className="space-y-2.5">

                    {/* M-Pesa — POPULAR */}
                    <button type="button" onClick={() => setPayMethod("mpesa")}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "mpesa" ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40"}`}>
                      <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-black text-[11px] leading-tight text-center">M<br/>PESA</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-900">M-Pesa</p>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-orange-500 text-white px-1.5 py-0.5 rounded-full">POPULAR</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">STK Push · Kenya · Instant</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "mpesa" ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
                        {payMethod === "mpesa" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* GSM World Wallet */}
                    <button type="button" onClick={() => setPayMethod("wallet")}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "wallet" ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"}`}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white text-lg">💳</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-900">GSM World Wallet</p>
                        </div>
                        <p className="text-xs mt-0.5">
                          <span className={walletBalance < (selectedDenom ?? 0) ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                            ${walletBalance.toFixed(2)} available
                          </span>
                          {walletBalance < (selectedDenom ?? 0)
                            ? <span className="text-gray-400 ml-1">· Insufficient balance</span>
                            : <span className="text-gray-400 ml-1">· Instant · No fees</span>}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "wallet" ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                        {payMethod === "wallet" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* NOWPayments — CRYPTO */}
                    {(selectedDenom ?? 0) >= 13 && (
                      <button type="button" onClick={() => setPayMethod("nowpayments")}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "nowpayments" ? "border-purple-500 bg-purple-50 shadow-sm" : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40"}`}>
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-yellow-400 text-lg font-black">₿</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900">Crypto (NOWPayments)</p>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-purple-600 text-white px-1.5 py-0.5 rounded-full">CRYPTO</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">BTC · ETH · USDT · 100+ coins</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "nowpayments" ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                          {payMethod === "nowpayments" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    )}

                    {/* Binance Pay — MANUAL */}
                    <button type="button" onClick={() => setPayMethod("binance_pay")}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "binance_pay" ? "border-yellow-500 bg-yellow-50 shadow-sm" : "border-gray-200 bg-white hover:border-yellow-300 hover:bg-yellow-50/40"}`}>
                      <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-gray-900 font-black text-sm">BNB</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-900">Binance Pay</p>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-gray-600 text-white px-1.5 py-0.5 rounded-full">MANUAL</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Manual — Admin confirms within 10-30 min</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "binance_pay" ? "border-yellow-600 bg-yellow-500" : "border-gray-300"}`}>
                        {payMethod === "binance_pay" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* USDT TRC20 Manual — MANUAL */}
                    <button type="button" onClick={() => setPayMethod("usdt_manual")}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "usdt_manual" ? "border-teal-500 bg-teal-50 shadow-sm" : "border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/40"}`}>
                      <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-black text-xl">₮</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-900">USDT TRC20</p>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-gray-600 text-white px-1.5 py-0.5 rounded-full">MANUAL</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Manual transfer — Admin confirms within 10-30 min</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "usdt_manual" ? "border-teal-600 bg-teal-500" : "border-gray-300"}`}>
                        {payMethod === "usdt_manual" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* Need a different method */}
                    <div className="flex items-center justify-center pt-1">
                      <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                        Need a different method? Contact support →
                      </a>
                    </div>
                  </div>
                </div>

                {/* NOWPayments currency selector */}
                {payMethod === "nowpayments" && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Crypto Currency</p>
                    <select value={npCurrency} onChange={(e) => setNpCurrency(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-500">
                      <option value="usdttrc20">USDT (TRC20)</option>
                      <option value="usdterc20">USDT (ERC20)</option>
                      <option value="btc">Bitcoin (BTC)</option>
                      <option value="eth">Ethereum (ETH)</option>
                      <option value="bnbbsc">BNB (BSC)</option>
                      <option value="ltc">Litecoin (LTC)</option>
                    </select>
                  </div>
                )}

                {/* M-Pesa phone input */}
                {payMethod === "mpesa" && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">M-Pesa Phone Number</label>
                    <input
                      type="tel"
                      placeholder="254712345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Format: 254XXXXXXXXX (no + sign)</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setGcStep({ type: "form" })}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-700">
                    Back
                  </button>
                  <button type="button" onClick={handlePlaceOrder}
                    disabled={loading || !payMethod || (payMethod === "wallet" && walletBalance < selectedDenom)}
                    className="flex-[2] py-3.5 rounded-2xl font-black text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: selectedCard.bg }}>
                    {loading ? "Placing Order…" : "Place Order"}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Need help? <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-green-600 font-semibold">WhatsApp us</a>
                </p>
              </div>

            ) : (
              <form onSubmit={handleContinueToPayment} className="p-5 space-y-5">
                {/* Denomination */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Amount</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCard.denominations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setSelectedDenom(d); setCustomDenomStr(""); }}
                        className={`px-4 py-2.5 rounded-xl font-black text-sm border-2 transition-all ${
                          selectedDenom === d && !customDenomStr
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                        }`}
                      >
                        {selectedCard.symbol}{d.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-sm font-black text-gray-500 shrink-0">{selectedCard.symbol}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Custom amount"
                      value={customDenomStr}
                      onChange={(e) => {
                        setCustomDenomStr(e.target.value);
                        const v = parseFloat(e.target.value);
                        setSelectedDenom(isNaN(v) || v <= 0 ? null : v);
                      }}
                      className={`flex-1 px-3 py-2.5 border-2 rounded-xl text-sm font-bold focus:outline-none transition-colors ${
                        customDenomStr ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"
                      }`}
                    />
                  </div>
                </div>

                {/* Recipient email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Recipient Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">The gift card code will be sent to this address</p>
                </div>

                {/* Optional message */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Gift Message <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Write a personal message to go with the gift card…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Summary */}
                {selectedDenom && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">Order Summary</p>
                      <p className="text-sm font-black text-blue-800 mt-0.5">
                        {selectedCard.brand} {selectedCard.region} · {selectedCard.symbol}{selectedDenom.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-lg font-black text-blue-700">{selectedCard.symbol}{selectedDenom.toLocaleString()}</span>
                  </div>
                )}

                {!isAuthenticated ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-red-700 font-semibold">
                      You must <Link href="/login" className="underline font-bold">sign in</Link> before placing an order.
                    </p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!selectedDenom || !recipientEmail || !isAuthenticated}
                  className="w-full py-4 rounded-2xl font-black text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: selectedCard.bg }}
                >
                  Continue to Payment
                </button>

                <p className="text-[11px] text-gray-400 text-center">
                  Need help? <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-green-600 font-semibold">WhatsApp us</a>
                </p>
              </form>
            )}
          </div>
        )}

        {/* ── BROWSE CATALOG ──────────────────────────────────────────────────── */}
        {!selectedCard && (
          <>
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    category === cat
                      ? "bg-[#1a2332] text-white border-[#1a2332]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {CATEGORY_ICONS[cat]}
                  {cat}
                  <span className={`text-[10px] ${category === cat ? "text-white/60" : "text-gray-400"}`}>
                    {counts[cat]}
                  </span>
                </button>
              ))}
            </div>

            {/* Results count */}
            {(search || category !== "All") && (
              <p className="text-xs text-gray-400">
                Showing <strong>{filtered.length}</strong> gift cards
                {search && <> matching "<strong>{search}</strong>"</>}
              </p>
            )}

            {/* Card grid */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No gift cards found. Try a different search.</p>
                <button onClick={() => { setSearch(""); setCategory("All"); }} className="mt-3 text-blue-500 text-sm underline">Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filtered.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                  >
                    {/* Gift card visual — landscape credit-card proportions */}
                    <div
                      className="relative overflow-hidden flex flex-col"
                      style={{
                        background: `linear-gradient(140deg, ${card.bg} 0%, ${card.accent} 60%, ${card.bg}cc 100%)`,
                        aspectRatio: "1.586 / 1",
                      }}
                    >
                      {/* Background decorative circles */}
                      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                      <div className="absolute -left-4 -bottom-4 w-20 h-20 rounded-full bg-black/15" />
                      <div className="absolute right-4 bottom-6 w-8 h-8 rounded-full bg-white/5" />

                      {/* Top row: brand label + Gift Card badge */}
                      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2.5 pt-2">
                        <span className="text-white/80 text-[7px] font-black uppercase tracking-[0.2em]">{card.brand}</span>
                        <span className="bg-white/25 border border-white/40 rounded-full px-1.5 py-0.5 text-white text-[7px] font-black uppercase tracking-widest">Gift Card</span>
                      </div>

                      {/* Centered large brand logo */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/20 backdrop-blur-[2px] rounded-2xl p-2 shadow-lg">
                          <BrandLogo brand={card.brand} emoji={card.emoji} size="xl" />
                        </div>
                      </div>

                      {/* Bottom: region + denomination */}
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 flex items-end justify-between">
                        <p className="text-white/70 text-[8px] font-semibold">{card.region}</p>
                        <p className="text-white font-black text-[9px] drop-shadow">
                          {card.symbol}{Math.min(...card.denominations).toLocaleString()}+
                        </p>
                      </div>
                    </div>

                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-gray-800 text-[12px] leading-tight line-clamp-1">{card.brand}</p>
                        <ChevronRight size={11} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{card.region} · {card.currency}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Info banner */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <Gift size={19} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-700 text-sm">How it works</p>
                <ol className="mt-1 space-y-0.5 text-[12px] text-gray-500 list-decimal list-inside">
                  <li>Pick a gift card brand and region</li>
                  <li>Choose the amount you want</li>
                  <li>Enter the recipient's email address</li>
                  <li>Add an optional personal message</li>
                  <li>We deliver the code within 1–24 hours</li>
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
