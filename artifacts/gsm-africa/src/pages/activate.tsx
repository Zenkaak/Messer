import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Zap, ChevronDown, Clock, CheckCircle2, XCircle, AlertCircle, Trash2, Plus, Server, ArrowLeft, ChevronRight } from "lucide-react";

type Activation = {
  id: number;
  toolName: string;
  toolCategory: string;
  username: string;
  serialKey: string;
  orderRef: string | null;
  status: string;
  activationCode: string | null;
  notes: string | null;
  createdAt: string;
};

const TOOL_CATEGORIES = [
  // ── Server / Credit Tools ─────────────────────────────────────────────────
  { name: "Ultra Tool",               tools: ["Ultra Tool Credit", "Ultra Tool Annual", "Ultra Tool Monthly"] },
  { name: "Multiunlock Tool",         tools: ["Multiunlock Credit", "Multiunlock Subscription"] },
  { name: "Xiaomi Repair Tool (XRT)", tools: ["XRT Credit", "XRT Activation", "XRT Premium"] },
  { name: "iRemoval Pro Tools",       tools: ["iRemoval Pro Credit", "iRemoval Activation", "iRemoval LPRO Max"] },
  { name: "NC Auth Tool",             tools: ["NC Auth Credit", "NC Auth Subscription"] },
  { name: "BMT Pro Tool",             tools: ["BMT Pro Credit", "BMT Pro Activation"] },
  { name: "Pandora Box",              tools: ["Pandora Box Activation", "Pandora Box Credit", "Pandora Box Annual"] },
  { name: "Unlocktool",               tools: ["Unlocktool Credit", "Unlocktool Activation", "Unlocktool Subscription"] },
  { name: "Chimera Tool",             tools: ["Chimera Pro Credits", "Chimera Activation", "Chimera Annual"] },
  { name: "Power Tool",               tools: ["Power Tool Credit", "Power Tool Activation"] },
  { name: "Mummy Auth Tool",          tools: ["Mummy Auth Credit", "Mummy Auth Activation"] },
  { name: "Piranha Tool",             tools: ["Piranha Tool Credit", "Piranha Activation"] },
  { name: "Flexunlock Tool",          tools: ["Flexunlock Credit", "Flexunlock Subscription"] },
  { name: "TSM Tool Pro",             tools: ["TSM Tool Credit", "TSM Tool Activation", "TSM Tool Annual"] },
  { name: "Motounlocktool",           tools: ["Motounlocktool Credit", "Motounlocktool Activation"] },
  { name: "Android Win Tool (AWT)",   tools: ["AWT Credit", "AWT Activation", "AWT Premium"] },
  { name: "Wuxinji Platform",         tools: ["Wuxinji Credit", "Wuxinji Monthly", "Wuxinji Schematics"] },
  { name: "Zhizhen Schematics",       tools: ["Zhizhen Credit", "Zhizhen Annual"] },
  { name: "Ameer Tool",               tools: ["Ameer Tool Credit", "Ameer Hardware Activation"] },
  { name: "Tojo360 Tool",             tools: ["Tojo360 Credit", "Tojo360 Activation"] },
  { name: "Mh Unlocker Pro",          tools: ["Mh Unlocker Credit", "Mh Unlocker Activation"] },
  { name: "Samsungtool.Us",           tools: ["Samsungtool Credits", "Samsungtool Subscription"] },
  { name: "Adam Auth Tool",           tools: ["Adam Auth Credit", "Adam Auth Annual"] },
  { name: "Open Menu",                tools: ["Open Menu Credit", "Open Menu Activation"] },
  // ── Hardware Dongles / Boxes ──────────────────────────────────────────────
  { name: "Z3X Box / Samsung Pro",    tools: ["Z3X Box Activation", "Z3X Samsung Tool Pro", "Z3X LG Tool", "Z3X SE Tool"] },
  { name: "NCK Box / NCK Pro",        tools: ["NCK Box Activation", "NCK Pro Dongle", "NCK Pro Credits"] },
  { name: "Sigma Box",                tools: ["Sigma Box Activation", "Sigma Box Credits", "Sigma Box Annual"] },
  { name: "Octoplus Box",             tools: ["Octoplus Samsung Activation", "Octoplus LG Activation", "Octoplus FRP Tool", "Octoplus Box Credits", "Octoplus Huawei Module", "Octoplus iPhone Module"] },
  { name: "UMT Pro (Ultimate)",       tools: ["UMT Pro Activation", "UMT Pro Credits", "UMT Dongle Annual", "UMT QcFire Credits"] },
  { name: "Miracle Box / Key",        tools: ["Miracle Box Activation", "Miracle Key Credits", "Miracle Thunder Credits", "Miracle Eagle Credits"] },
  { name: "EFT Dongle / Pro",         tools: ["EFT Dongle Activation", "EFT Pro Credits", "EFT Pro Android"] },
  { name: "MRT Dongle",               tools: ["MRT Dongle Activation", "MRT Credits", "MRT Pro"] },
  { name: "Infinity Box / CM2",       tools: ["Infinity Box Activation", "CM2 Dongle Credits", "Infinity Credits", "CM2 Pro MTK"] },
  { name: "Riff Box / JTAG Easy",     tools: ["Riff Box Activation", "JTAG Easy Activation", "JTAG Pro Credits", "Riff Box 2 Credits"] },
  { name: "Medusa Pro / Pro II",      tools: ["Medusa Pro Activation", "Medusa Pro II Credits", "Medusa Box Credits"] },
  { name: "UFi Box",                  tools: ["UFi Box Activation", "UFi Box Credits", "UFi Box EMMC"] },
  { name: "HCU Client / DC Unlocker", tools: ["HCU Client Credits", "DC Unlocker Credits", "DC Phoenix Credits"] },
  { name: "Hydra Dongle",             tools: ["Hydra Dongle Activation", "Hydra Credits"] },
  { name: "GPG Dragon Box",           tools: ["GPG Dragon Activation", "GPG Dragon Credits"] },
  { name: "JAF Box / MXKEY",         tools: ["JAF Box Activation", "MXKEY Credits"] },
  { name: "ATF Box / ATF Nitro",      tools: ["ATF Box Activation", "ATF Nitro Credits"] },
  { name: "Se-Tool / SJT",           tools: ["Se-Tool Activation", "SJT Credits"] },
  { name: "BEST Dongle",              tools: ["BEST Dongle Activation", "BEST Credits"] },
  { name: "Furious Gold",             tools: ["Furious Gold Activation", "Furious Gold Pack A", "Furious Gold Pack B"] },
  { name: "Rotor Box",                tools: ["Rotor Box Activation", "Rotor Box Credits"] },
  { name: "SL3 Dongle",              tools: ["SL3 Activation", "SL3 Credits"] },
  // ── iPhone / iCloud Services ──────────────────────────────────────────────
  { name: "iCloud Bypass / Removal",  tools: ["iCloud Bypass A12+", "iCloud Removal Standard", "iCloud LPRO Max", "HFZ Activator Bypass", "iRemoval iCloud Remove"] },
  { name: "iPhone Network Unlock",    tools: ["iPhone AT&T USA Unlock", "iPhone T-Mobile USA Unlock", "iPhone Verizon USA Unlock", "iPhone Sprint USA Unlock", "iPhone Rogers Canada", "iPhone Telus Canada", "iPhone Bell Canada", "iPhone Vodafone UK", "iPhone EE UK", "iPhone Telstra AU", "iPhone Optus AU", "iPhone Three UK", "iPhone SFR France", "iPhone Orange France", "iPhone Deutsche Telekom"] },
  { name: "GSX / Apple Services",     tools: ["GSX Instant Check", "GSX Warranty Check", "GSX FMI Check", "Apple SIM Lock Status", "Apple MDM Bypass"] },
  { name: "iPad Services",            tools: ["iPad iCloud Bypass", "iPad Unlock", "iPad MDM Remove"] },
  // ── Samsung Services ──────────────────────────────────────────────────────
  { name: "Samsung Unlock",           tools: ["Samsung NCK Unlock", "Samsung Remote Unlock", "Samsung FRP Remove IMEI", "Samsung FRP Remove SN", "Samsung Knox Remove", "Samsung Reactivation Lock"] },
  { name: "Samsung Repair",           tools: ["Samsung IMEI Repair", "Samsung Network Repair", "Samsung Firmware Flash"] },
  // ── Huawei / Honor ────────────────────────────────────────────────────────
  { name: "Huawei / Honor",           tools: ["Huawei NCK Unlock", "Huawei FRP Remove", "Huawei FRP by EMUI", "Honor FRP SN/IMEI", "Huawei Bootloader Code"] },
  // ── FRP Bypass ────────────────────────────────────────────────────────────
  { name: "FRP Bypass",               tools: ["FRP Bypass Android 11", "FRP Bypass Android 12", "FRP Bypass Android 13", "FRP Bypass Android 14", "FRP Bypass (Remote ADB)", "FRP Bypass Any Brand"] },
  // ── Other Android Brands ──────────────────────────────────────────────────
  { name: "Xiaomi / Redmi",           tools: ["Xiaomi FRP Remove", "Xiaomi Bootloader Unlock", "Xiaomi Speed Tool Credits", "Xiaomi Remote Unlock"] },
  { name: "OPPO / OnePlus / Realme",  tools: ["OPPO FRP Remove", "OnePlus Network Unlock", "Realme FRP Bypass", "OPPO Bootloader Unlock"] },
  { name: "Motorola / Lenovo",        tools: ["Motorola NCK Unlock", "Motorola FRP Bypass", "Moto Bootloader Unlock", "Lenovo FRP Remove"] },
  { name: "Nokia Services",           tools: ["Nokia NCK Unlock", "Nokia FRP Remove", "Nokia Root & Flash"] },
  { name: "HTC Services",             tools: ["HTC NCK Unlock", "HTC Bootloader Code", "HTC FRP Remove"] },
  { name: "Tecno / Infinix",          tools: ["Tecno FRP Remove", "Infinix FRP Remove", "Tecno Network Unlock", "Infinix Unlock"] },
  { name: "LG Services",              tools: ["LG NCK Unlock", "LG Network Unlock Remote", "LG FRP Remove", "LG Bootloader Unlock"] },
  { name: "Vivo / IQOO",             tools: ["Vivo FRP Remove", "Vivo Network Unlock", "IQOO Bootloader Code"] },
  { name: "ZTE / Alcatel",           tools: ["ZTE NCK Unlock", "ZTE FRP Remove", "Alcatel NCK Unlock", "Alcatel FRP Remove"] },
  { name: "Sony Xperia",             tools: ["Sony NCK Unlock", "Sony Bootloader Code", "Sony FRP Remove"] },
  // ── IMEI Services ─────────────────────────────────────────────────────────
  { name: "IMEI Repair / Change",     tools: ["IMEI Repair Samsung", "IMEI Repair Huawei", "IMEI Repair iPhone", "IMEI Repair Any Brand"] },
  { name: "IMEI Blacklist Removal",   tools: ["Blacklist Removal USA", "Blacklist Removal UK", "Blacklist Removal Canada", "Blacklist Removal AU"] },
  { name: "IMEI Check Services",      tools: ["IMEI Carrier Check", "IMEI Blacklist Check", "IMEI Warranty Check", "IMEI Full Info Report"] },
  // ── Network / Carrier Credits ─────────────────────────────────────────────
  { name: "USA Carrier Credits",      tools: ["AT&T NCK Credits", "T-Mobile BYOD Credits", "Verizon Credits", "Sprint Credits", "Cricket Unlock", "Metro PCS Unlock", "Boost Mobile Unlock", "Dish Network Unlock"] },
  { name: "UK / EU Credits",          tools: ["Vodafone UK Credits", "EE UK Credits", "O2 UK Credits", "Three UK Credits", "Orange FR Credits", "Deutsche Telekom Credits", "Proximus BE Credits"] },
  { name: "Canada Credits",           tools: ["Rogers Credits", "Telus Credits", "Bell Credits", "Freedom Mobile Credits", "Koodo Credits"] },
  { name: "Australia Credits",        tools: ["Telstra Credits", "Optus Credits", "Vodafone AU Credits"] },
  // ── Gaming / Entertainment ────────────────────────────────────────────────
  { name: "PlayStation Credits",      tools: ["PSN Gift Card USA", "PSN Gift Card UK", "PSN Gift Card EU"] },
  // ── Flash Files & Firmware ────────────────────────────────────────────────
  { name: "Flash Files / Firmware",   tools: ["Samsung Firmware", "Xiaomi Firmware", "Huawei Firmware", "MTK Firmware", "Qualcomm Firmware"] },
  { name: "ISP / Pinout Services",    tools: ["ISP Pinout Samsung", "ISP Pinout Huawei", "ISP Pinout iPhone"] },
  // ── General ───────────────────────────────────────────────────────────────
  { name: "Dongle & License Renewal", tools: ["Dongle Activation", "License Renewal", "Annual Subscription"] },
  { name: "Repair Software",          tools: ["Software License", "Repair Software Pack", "Diagnostic Software"] },
  { name: "Other / Custom",           tools: ["Custom Activation", "Custom Service Request"] },
];

const TOOL_DETAILS: Record<string, { price: string; status: string; notes: string }> = {
  // Server tools
  "Ultra Tool Credit": { price: "$5", status: "Available", notes: "One-time activation credit." },
  "Ultra Tool Annual": { price: "$17", status: "Available", notes: "Annual access package." },
  "Ultra Tool Monthly": { price: "$6", status: "Available", notes: "Monthly access package." },
  "Multiunlock Credit": { price: "$6", status: "Available", notes: "Multiunlock credit request." },
  "Multiunlock Subscription": { price: "$17", status: "Available", notes: "Subscription activation." },
  "XRT Credit": { price: "$5", status: "Available", notes: "Xiaomi Repair Tool credit." },
  "XRT Activation": { price: "$7", status: "Available", notes: "XRT activation request." },
  "XRT Premium": { price: "$17", status: "Available", notes: "Premium access tier." },
  "iRemoval Pro Credit": { price: "$5", status: "Available", notes: "iRemoval Pro credit." },
  "iRemoval Activation": { price: "$7", status: "Available", notes: "iRemoval activation request." },
  "iRemoval LPRO Max": { price: "$12", status: "Available", notes: "LPRO Max bypass Windows & MacOS." },
  "NC Auth Credit": { price: "$5", status: "Available", notes: "NC Auth credit request." },
  "NC Auth Subscription": { price: "$17", status: "Available", notes: "NC Auth subscription." },
  "BMT Pro Credit": { price: "$5", status: "Available", notes: "BMT Pro credit request." },
  "BMT Pro Activation": { price: "$7", status: "Available", notes: "BMT Pro activation request." },
  "Pandora Box Activation": { price: "$10", status: "Available", notes: "Pandora Box full activation." },
  "Pandora Box Credit": { price: "$6", status: "Available", notes: "Pandora Box credit unit." },
  "Pandora Box Annual": { price: "$35", status: "Available", notes: "Pandora Box annual subscription." },
  "Unlocktool Credit": { price: "$5", status: "Available", notes: "Unlocktool one-time credit." },
  "Unlocktool Activation": { price: "$9", status: "Available", notes: "Unlocktool account activation." },
  "Unlocktool Subscription": { price: "$20", status: "Available", notes: "Unlocktool monthly subscription." },
  "Chimera Pro Credits": { price: "$6", status: "Available", notes: "Chimera Pro credit units." },
  "Chimera Activation": { price: "$10", status: "Available", notes: "Chimera full activation." },
  "Chimera Annual": { price: "$30", status: "Available", notes: "Chimera annual plan." },
  "Power Tool Credit": { price: "$5", status: "Available", notes: "Power Tool credit." },
  "Power Tool Activation": { price: "$8", status: "Available", notes: "Power Tool activation." },
  "Mummy Auth Credit": { price: "$5", status: "Available", notes: "Mummy Auth credit unit." },
  "Mummy Auth Activation": { price: "$8", status: "Available", notes: "Mummy Auth activation." },
  "Piranha Tool Credit": { price: "$5", status: "Available", notes: "Piranha Tool credit." },
  "Piranha Activation": { price: "$8", status: "Available", notes: "Piranha full activation." },
  "Flexunlock Credit": { price: "$5", status: "Available", notes: "Flexunlock credit unit." },
  "Flexunlock Subscription": { price: "$17", status: "Available", notes: "Flexunlock subscription." },
  "TSM Tool Credit": { price: "$5", status: "Available", notes: "TSM Tool Pro credit." },
  "TSM Tool Activation": { price: "$9", status: "Available", notes: "TSM Tool Pro activation." },
  "TSM Tool Annual": { price: "$30", status: "Available", notes: "TSM Tool annual plan." },
  "Motounlocktool Credit": { price: "$5", status: "Available", notes: "Motounlocktool credit." },
  "Motounlocktool Activation": { price: "$8", status: "Available", notes: "Motounlocktool activation." },
  "AWT Credit": { price: "$5", status: "Available", notes: "Android Win Tool credit." },
  "AWT Activation": { price: "$8", status: "Available", notes: "AWT account activation." },
  "AWT Premium": { price: "$17", status: "Available", notes: "AWT premium plan." },
  "Wuxinji Credit": { price: "$6", status: "Available", notes: "Wuxinji platform credit." },
  "Wuxinji Monthly": { price: "$17", status: "Available", notes: "Wuxinji monthly access." },
  "Wuxinji Schematics": { price: "$9", status: "Available", notes: "Wuxinji schematic access." },
  "Zhizhen Credit": { price: "$6", status: "Available", notes: "Zhizhen schematics credit." },
  "Zhizhen Annual": { price: "$20", status: "Available", notes: "Zhizhen annual plan." },
  "Ameer Tool Credit": { price: "$5", status: "Available", notes: "Ameer Tool credit." },
  "Ameer Hardware Activation": { price: "$15", status: "Available", notes: "Ameer hardware tool activation." },
  "Tojo360 Credit": { price: "$5", status: "Available", notes: "Tojo360 credit unit." },
  "Tojo360 Activation": { price: "$9", status: "Available", notes: "Tojo360 full activation." },
  "Mh Unlocker Credit": { price: "$5", status: "Available", notes: "Mh Unlocker Pro credit." },
  "Mh Unlocker Activation": { price: "$9", status: "Available", notes: "Mh Unlocker activation." },
  "Samsungtool Credits": { price: "$6", status: "Available", notes: "Samsungtool.Us credits." },
  "Samsungtool Subscription": { price: "$17", status: "Available", notes: "Samsungtool subscription." },
  "Adam Auth Credit": { price: "$5", status: "Available", notes: "Adam Auth credit." },
  "Adam Auth Annual": { price: "$20", status: "Available", notes: "Adam Auth annual plan." },
  "Open Menu Credit": { price: "$5", status: "Available", notes: "Open Menu credit." },
  "Open Menu Activation": { price: "$9", status: "Available", notes: "Open Menu activation." },
  // Hardware dongles
  "Z3X Box Activation": { price: "$12", status: "Available", notes: "Z3X Box software activation." },
  "Z3X Samsung Tool Pro": { price: "$10", status: "Available", notes: "Samsung Tool Pro activation." },
  "Z3X LG Tool": { price: "$10", status: "Available", notes: "Z3X LG Tool activation." },
  "Z3X SE Tool": { price: "$10", status: "Available", notes: "Z3X SE Tool activation." },
  "NCK Box Activation": { price: "$15", status: "Available", notes: "NCK Box full activation." },
  "NCK Pro Dongle": { price: "$12", status: "Available", notes: "NCK Pro dongle activation." },
  "NCK Pro Credits": { price: "$5", status: "Available", notes: "NCK Pro credit units." },
  "Sigma Box Activation": { price: "$12", status: "Available", notes: "Sigma Box activation." },
  "Sigma Box Credits": { price: "$5", status: "Available", notes: "Sigma Box credit units." },
  "Sigma Box Annual": { price: "$30", status: "Available", notes: "Sigma Box annual plan." },
  "Octoplus Samsung Activation": { price: "$10", status: "Available", notes: "Octoplus Samsung module." },
  "Octoplus LG Activation": { price: "$10", status: "Available", notes: "Octoplus LG module." },
  "Octoplus FRP Tool": { price: "$8", status: "Available", notes: "Octoplus FRP Bypass module." },
  "Octoplus Box Credits": { price: "$5", status: "Available", notes: "Octoplus credit units." },
  "Octoplus Huawei Module": { price: "$10", status: "Available", notes: "Octoplus Huawei module activation." },
  "Octoplus iPhone Module": { price: "$10", status: "Available", notes: "Octoplus iPhone module activation." },
  "UMT Pro Activation": { price: "$15", status: "Available", notes: "UMT Pro full activation." },
  "UMT Pro Credits": { price: "$5", status: "Available", notes: "UMT Pro credit units." },
  "UMT Dongle Annual": { price: "$40", status: "Available", notes: "UMT dongle annual renewal." },
  "UMT QcFire Credits": { price: "$5", status: "Available", notes: "UMT QcFire module credits." },
  "Miracle Box Activation": { price: "$10", status: "Available", notes: "Miracle Box activation." },
  "Miracle Key Credits": { price: "$5", status: "Available", notes: "Miracle Key credit units." },
  "Miracle Thunder Credits": { price: "$5", status: "Available", notes: "Miracle Thunder credits." },
  "Miracle Eagle Credits": { price: "$5", status: "Available", notes: "Miracle Eagle credits." },
  "EFT Dongle Activation": { price: "$10", status: "Available", notes: "EFT Dongle activation." },
  "EFT Pro Credits": { price: "$5", status: "Available", notes: "EFT Pro credit units." },
  "EFT Pro Android": { price: "$8", status: "Available", notes: "EFT Pro Android module." },
  "MRT Dongle Activation": { price: "$10", status: "Available", notes: "MRT Dongle activation." },
  "MRT Credits": { price: "$5", status: "Available", notes: "MRT credit units." },
  "MRT Pro": { price: "$12", status: "Available", notes: "MRT Pro upgrade." },
  "Infinity Box Activation": { price: "$12", status: "Available", notes: "Infinity Box activation." },
  "CM2 Dongle Credits": { price: "$5", status: "Available", notes: "CM2 Dongle credit units." },
  "Infinity Credits": { price: "$5", status: "Available", notes: "Infinity Box credit units." },
  "CM2 Pro MTK": { price: "$8", status: "Available", notes: "CM2 Pro MTK module." },
  "Riff Box Activation": { price: "$12", status: "Available", notes: "Riff Box JTAG activation." },
  "JTAG Easy Activation": { price: "$10", status: "Available", notes: "JTAG Easy activation." },
  "JTAG Pro Credits": { price: "$5", status: "Available", notes: "JTAG Pro credit units." },
  "Riff Box 2 Credits": { price: "$5", status: "Available", notes: "Riff Box 2 credit units." },
  "Medusa Pro Activation": { price: "$12", status: "Available", notes: "Medusa Pro activation." },
  "Medusa Pro II Credits": { price: "$5", status: "Available", notes: "Medusa Pro II credits." },
  "Medusa Box Credits": { price: "$5", status: "Available", notes: "Medusa Box credits." },
  "UFi Box Activation": { price: "$12", status: "Available", notes: "UFi Box emmc/isp tool activation." },
  "UFi Box Credits": { price: "$5", status: "Available", notes: "UFi Box credit units." },
  "UFi Box EMMC": { price: "$8", status: "Available", notes: "UFi Box EMMC service." },
  "HCU Client Credits": { price: "$5", status: "Available", notes: "HCU Client credit units." },
  "DC Unlocker Credits": { price: "$5", status: "Available", notes: "DC Unlocker credit units." },
  "DC Phoenix Credits": { price: "$5", status: "Available", notes: "DC Phoenix credit units." },
  "Hydra Dongle Activation": { price: "$12", status: "Available", notes: "Hydra Dongle activation." },
  "Hydra Credits": { price: "$5", status: "Available", notes: "Hydra credit units." },
  "GPG Dragon Activation": { price: "$12", status: "Available", notes: "GPG Dragon box activation." },
  "GPG Dragon Credits": { price: "$5", status: "Available", notes: "GPG Dragon credits." },
  "JAF Box Activation": { price: "$10", status: "Available", notes: "JAF Box activation." },
  "MXKEY Credits": { price: "$5", status: "Available", notes: "MXKEY credit units." },
  "ATF Box Activation": { price: "$12", status: "Available", notes: "ATF Box activation." },
  "ATF Nitro Credits": { price: "$5", status: "Available", notes: "ATF Nitro credits." },
  "Se-Tool Activation": { price: "$10", status: "Available", notes: "Se-Tool activation." },
  "SJT Credits": { price: "$5", status: "Available", notes: "SJT credit units." },
  "BEST Dongle Activation": { price: "$12", status: "Available", notes: "BEST Dongle activation." },
  "BEST Credits": { price: "$5", status: "Available", notes: "BEST credits." },
  "Furious Gold Activation": { price: "$15", status: "Available", notes: "Furious Gold activation." },
  "Furious Gold Pack A": { price: "$10", status: "Available", notes: "Furious Gold Pack A unlock." },
  "Furious Gold Pack B": { price: "$10", status: "Available", notes: "Furious Gold Pack B unlock." },
  "Rotor Box Activation": { price: "$10", status: "Available", notes: "Rotor Box activation." },
  "Rotor Box Credits": { price: "$5", status: "Available", notes: "Rotor Box credits." },
  "SL3 Activation": { price: "$10", status: "Available", notes: "SL3 Dongle activation." },
  "SL3 Credits": { price: "$5", status: "Available", notes: "SL3 credits." },
  // iPhone / iCloud
  "iCloud Bypass A12+": { price: "$18", status: "Available", notes: "A12+ iCloud bypass service." },
  "iCloud Removal Standard": { price: "$15", status: "Available", notes: "Standard iCloud removal." },
  "iCloud LPRO Max": { price: "$20", status: "Available", notes: "LPRO Max iCloud bypass." },
  "HFZ Activator Bypass": { price: "$20", status: "Available", notes: "HFZ Activator iCloud bypass." },
  "iRemoval iCloud Remove": { price: "$15", status: "Available", notes: "iRemoval Pro iCloud remove." },
  "iPhone AT&T USA Unlock": { price: "$8", status: "Available", notes: "AT&T USA iPhone unlock." },
  "iPhone T-Mobile USA Unlock": { price: "$8", status: "Available", notes: "T-Mobile USA iPhone unlock." },
  "iPhone Verizon USA Unlock": { price: "$10", status: "Available", notes: "Verizon USA iPhone unlock." },
  "iPhone Sprint USA Unlock": { price: "$10", status: "Available", notes: "Sprint USA iPhone unlock." },
  "iPhone Rogers Canada": { price: "$12", status: "Available", notes: "Rogers Canada iPhone unlock." },
  "iPhone Telus Canada": { price: "$12", status: "Available", notes: "Telus Canada iPhone unlock." },
  "iPhone Bell Canada": { price: "$12", status: "Available", notes: "Bell Canada iPhone unlock." },
  "iPhone Vodafone UK": { price: "$10", status: "Available", notes: "Vodafone UK iPhone unlock." },
  "iPhone EE UK": { price: "$10", status: "Available", notes: "EE UK iPhone unlock." },
  "iPhone Telstra AU": { price: "$12", status: "Available", notes: "Telstra Australia iPhone unlock." },
  "iPhone Optus AU": { price: "$12", status: "Available", notes: "Optus Australia iPhone unlock." },
  "iPhone Three UK": { price: "$10", status: "Available", notes: "Three UK iPhone unlock." },
  "iPhone SFR France": { price: "$10", status: "Available", notes: "SFR France iPhone unlock." },
  "iPhone Orange France": { price: "$10", status: "Available", notes: "Orange France iPhone unlock." },
  "iPhone Deutsche Telekom": { price: "$10", status: "Available", notes: "Deutsche Telekom iPhone unlock." },
  "GSX Instant Check": { price: "$2", status: "Available", notes: "Instant Apple GSX check." },
  "GSX Warranty Check": { price: "$2", status: "Available", notes: "Apple warranty status check." },
  "GSX FMI Check": { price: "$2", status: "Available", notes: "Find My iPhone status check." },
  "Apple SIM Lock Status": { price: "$1", status: "Available", notes: "SIM lock status check." },
  "Apple MDM Bypass": { price: "$25", status: "Available", notes: "Apple MDM/DEP profile bypass." },
  "iPad iCloud Bypass": { price: "$20", status: "Available", notes: "iPad iCloud bypass service." },
  "iPad Unlock": { price: "$15", status: "Available", notes: "iPad network unlock." },
  "iPad MDM Remove": { price: "$25", status: "Available", notes: "iPad MDM profile removal." },
  // Samsung
  "Samsung NCK Unlock": { price: "$5", status: "Available", notes: "Samsung NCK network unlock." },
  "Samsung Remote Unlock": { price: "$6", status: "Available", notes: "Samsung remote unlock service." },
  "Samsung FRP Remove IMEI": { price: "$8", status: "Available", notes: "Samsung FRP remove by IMEI." },
  "Samsung FRP Remove SN": { price: "$8", status: "Available", notes: "Samsung FRP remove by serial." },
  "Samsung Knox Remove": { price: "$12", status: "Available", notes: "Samsung Knox removal." },
  "Samsung Reactivation Lock": { price: "$15", status: "Available", notes: "Samsung reactivation lock bypass." },
  "Samsung IMEI Repair": { price: "$10", status: "Available", notes: "Samsung IMEI repair service." },
  "Samsung Network Repair": { price: "$8", status: "Available", notes: "Samsung network band repair." },
  "Samsung Firmware Flash": { price: "$7", status: "Available", notes: "Samsung official firmware flash." },
  // Huawei
  "Huawei NCK Unlock": { price: "$6", status: "Available", notes: "Huawei NCK unlock code." },
  "Huawei FRP Remove": { price: "$8", status: "Available", notes: "Huawei FRP bypass service." },
  "Huawei FRP by EMUI": { price: "$9", status: "Available", notes: "Huawei FRP by EMUI version." },
  "Honor FRP SN/IMEI": { price: "$8", status: "Available", notes: "Honor FRP by SN or IMEI." },
  "Huawei Bootloader Code": { price: "$10", status: "Available", notes: "Huawei bootloader unlock code." },
  // FRP
  "FRP Bypass Android 11": { price: "$5", status: "Available", notes: "FRP bypass for Android 11." },
  "FRP Bypass Android 12": { price: "$5", status: "Available", notes: "FRP bypass for Android 12." },
  "FRP Bypass Android 13": { price: "$6", status: "Available", notes: "FRP bypass for Android 13." },
  "FRP Bypass Android 14": { price: "$7", status: "Available", notes: "FRP bypass for Android 14." },
  "FRP Bypass (Remote ADB)": { price: "$8", status: "Available", notes: "Remote ADB FRP bypass." },
  "FRP Bypass Any Brand": { price: "$6", status: "Available", notes: "FRP bypass any Android brand." },
  // Xiaomi
  "Xiaomi FRP Remove": { price: "$5", status: "Available", notes: "Xiaomi FRP removal service." },
  "Xiaomi Bootloader Unlock": { price: "$7", status: "Available", notes: "Xiaomi/Redmi bootloader unlock." },
  "Xiaomi Speed Tool Credits": { price: "$5", status: "Available", notes: "Xiaomi Speed Tool credits." },
  "Xiaomi Remote Unlock": { price: "$8", status: "Available", notes: "Xiaomi remote network unlock." },
  // OPPO/OnePlus/Realme
  "OPPO FRP Remove": { price: "$6", status: "Available", notes: "OPPO FRP bypass service." },
  "OnePlus Network Unlock": { price: "$8", status: "Available", notes: "OnePlus network unlock." },
  "Realme FRP Bypass": { price: "$6", status: "Available", notes: "Realme FRP bypass service." },
  "OPPO Bootloader Unlock": { price: "$7", status: "Available", notes: "OPPO bootloader unlock code." },
  // Motorola
  "Motorola NCK Unlock": { price: "$5", status: "Available", notes: "Motorola NCK unlock code." },
  "Motorola FRP Bypass": { price: "$6", status: "Available", notes: "Motorola FRP bypass." },
  "Moto Bootloader Unlock": { price: "$7", status: "Available", notes: "Motorola bootloader unlock." },
  "Lenovo FRP Remove": { price: "$6", status: "Available", notes: "Lenovo FRP removal service." },
  // Nokia
  "Nokia NCK Unlock": { price: "$5", status: "Available", notes: "Nokia NCK unlock code." },
  "Nokia FRP Remove": { price: "$6", status: "Available", notes: "Nokia FRP removal service." },
  "Nokia Root & Flash": { price: "$8", status: "Available", notes: "Nokia root and firmware flash." },
  // HTC
  "HTC NCK Unlock": { price: "$6", status: "Available", notes: "HTC NCK network unlock." },
  "HTC Bootloader Code": { price: "$8", status: "Available", notes: "HTC bootloader unlock code." },
  "HTC FRP Remove": { price: "$6", status: "Available", notes: "HTC FRP removal." },
  // Tecno/Infinix
  "Tecno FRP Remove": { price: "$5", status: "Available", notes: "Tecno FRP bypass service." },
  "Infinix FRP Remove": { price: "$5", status: "Available", notes: "Infinix FRP bypass service." },
  "Tecno Network Unlock": { price: "$6", status: "Available", notes: "Tecno network unlock code." },
  "Infinix Unlock": { price: "$6", status: "Available", notes: "Infinix network unlock." },
  // LG
  "LG NCK Unlock": { price: "$5", status: "Available", notes: "LG NCK network unlock code." },
  "LG Network Unlock Remote": { price: "$7", status: "Available", notes: "LG remote network unlock." },
  "LG FRP Remove": { price: "$6", status: "Available", notes: "LG FRP removal service." },
  "LG Bootloader Unlock": { price: "$8", status: "Available", notes: "LG bootloader unlock." },
  // Vivo
  "Vivo FRP Remove": { price: "$5", status: "Available", notes: "Vivo FRP bypass service." },
  "Vivo Network Unlock": { price: "$7", status: "Available", notes: "Vivo network unlock." },
  "IQOO Bootloader Code": { price: "$7", status: "Available", notes: "IQOO bootloader unlock code." },
  // ZTE/Alcatel
  "ZTE NCK Unlock": { price: "$5", status: "Available", notes: "ZTE NCK unlock code." },
  "ZTE FRP Remove": { price: "$5", status: "Available", notes: "ZTE FRP bypass." },
  "Alcatel NCK Unlock": { price: "$5", status: "Available", notes: "Alcatel NCK unlock code." },
  "Alcatel FRP Remove": { price: "$5", status: "Available", notes: "Alcatel FRP bypass." },
  // Sony
  "Sony NCK Unlock": { price: "$6", status: "Available", notes: "Sony Xperia NCK unlock." },
  "Sony Bootloader Code": { price: "$8", status: "Available", notes: "Sony bootloader unlock code." },
  "Sony FRP Remove": { price: "$6", status: "Available", notes: "Sony FRP removal service." },
  // IMEI services
  "IMEI Repair Samsung": { price: "$10", status: "Available", notes: "Samsung IMEI repair." },
  "IMEI Repair Huawei": { price: "$10", status: "Available", notes: "Huawei IMEI repair." },
  "IMEI Repair iPhone": { price: "$15", status: "Available", notes: "iPhone IMEI repair." },
  "IMEI Repair Any Brand": { price: "$12", status: "Available", notes: "Any brand IMEI repair." },
  "Blacklist Removal USA": { price: "$20", status: "Available", notes: "USA blacklist removal." },
  "Blacklist Removal UK": { price: "$20", status: "Available", notes: "UK blacklist removal." },
  "Blacklist Removal Canada": { price: "$20", status: "Available", notes: "Canada blacklist removal." },
  "Blacklist Removal AU": { price: "$20", status: "Available", notes: "Australia blacklist removal." },
  "IMEI Carrier Check": { price: "$1", status: "Available", notes: "Carrier check by IMEI." },
  "IMEI Blacklist Check": { price: "$1", status: "Available", notes: "Blacklist status by IMEI." },
  "IMEI Warranty Check": { price: "$1", status: "Available", notes: "Warranty status by IMEI." },
  "IMEI Full Info Report": { price: "$2", status: "Available", notes: "Full IMEI info report." },
  // USA Carrier
  "AT&T NCK Credits": { price: "$6", status: "Available", notes: "AT&T NCK unlock credits." },
  "T-Mobile BYOD Credits": { price: "$6", status: "Available", notes: "T-Mobile BYOD unlock credits." },
  "Verizon Credits": { price: "$7", status: "Available", notes: "Verizon unlock credits." },
  "Sprint Credits": { price: "$6", status: "Available", notes: "Sprint unlock credits." },
  "Cricket Unlock": { price: "$6", status: "Available", notes: "Cricket network unlock." },
  "Metro PCS Unlock": { price: "$6", status: "Available", notes: "Metro PCS unlock service." },
  "Boost Mobile Unlock": { price: "$7", status: "Available", notes: "Boost Mobile unlock service." },
  "Dish Network Unlock": { price: "$7", status: "Available", notes: "Dish Network unlock service." },
  // UK/EU
  "Vodafone UK Credits": { price: "$8", status: "Available", notes: "Vodafone UK unlock credits." },
  "EE UK Credits": { price: "$8", status: "Available", notes: "EE UK unlock credits." },
  "O2 UK Credits": { price: "$8", status: "Available", notes: "O2 UK unlock credits." },
  "Three UK Credits": { price: "$8", status: "Available", notes: "Three UK unlock credits." },
  "Orange FR Credits": { price: "$8", status: "Available", notes: "Orange France unlock credits." },
  "Deutsche Telekom Credits": { price: "$8", status: "Available", notes: "Deutsche Telekom unlock credits." },
  "Proximus BE Credits": { price: "$8", status: "Available", notes: "Proximus Belgium unlock credits." },
  // Canada
  "Rogers Credits": { price: "$10", status: "Available", notes: "Rogers Canada unlock credits." },
  "Telus Credits": { price: "$10", status: "Available", notes: "Telus Canada unlock credits." },
  "Bell Credits": { price: "$10", status: "Available", notes: "Bell Canada unlock credits." },
  "Freedom Mobile Credits": { price: "$10", status: "Available", notes: "Freedom Mobile unlock credits." },
  "Koodo Credits": { price: "$10", status: "Available", notes: "Koodo Canada unlock credits." },
  // Australia
  "Telstra Credits": { price: "$10", status: "Available", notes: "Telstra AU unlock credits." },
  "Optus Credits": { price: "$10", status: "Available", notes: "Optus AU unlock credits." },
  "Vodafone AU Credits": { price: "$10", status: "Available", notes: "Vodafone AU unlock credits." },
  // PlayStation
  "PSN Gift Card USA": { price: "$10", status: "Available", notes: "PlayStation Network USA gift card." },
  "PSN Gift Card UK": { price: "$10", status: "Available", notes: "PlayStation Network UK gift card." },
  "PSN Gift Card EU": { price: "$10", status: "Available", notes: "PlayStation Network EU gift card." },
  // Firmware
  "Samsung Firmware": { price: "$3", status: "Available", notes: "Official Samsung firmware file." },
  "Xiaomi Firmware": { price: "$3", status: "Available", notes: "Official Xiaomi firmware file." },
  "Huawei Firmware": { price: "$3", status: "Available", notes: "Official Huawei firmware file." },
  "MTK Firmware": { price: "$3", status: "Available", notes: "MTK chipset firmware file." },
  "Qualcomm Firmware": { price: "$3", status: "Available", notes: "Qualcomm chipset firmware file." },
  "ISP Pinout Samsung": { price: "$3", status: "Available", notes: "Samsung ISP/JTAG pinout diagram." },
  "ISP Pinout Huawei": { price: "$3", status: "Available", notes: "Huawei ISP pinout diagram." },
  "ISP Pinout iPhone": { price: "$4", status: "Available", notes: "iPhone ISP pinout diagram." },
  // Renewals
  "Dongle Activation": { price: "$17", status: "Available", notes: "Generic dongle activation request." },
  "License Renewal": { price: "$3", status: "Available", notes: "License renewal request." },
  "Annual Subscription": { price: "$17", status: "Available", notes: "Annual subscription renewal." },
  "Software License": { price: "$6", status: "Available", notes: "Repair software license." },
  "Repair Software Pack": { price: "$10", status: "Available", notes: "Full repair software bundle." },
  "Diagnostic Software": { price: "$8", status: "Available", notes: "Phone diagnostic tool license." },
  "Custom Activation": { price: "$5", status: "Available", notes: "Custom tool activation request." },
  "Custom Service Request": { price: "$5", status: "Available", notes: "Custom service — contact support." },
};

const SUPPORT_WHATSAPP = "254700000000";

function statusStyle(s: string) {
  switch (s) {
    case "active":   return { bg: "bg-green-50 border-green-200",  text: "text-green-700",  badge: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={15} className="text-green-600" /> };
    case "rejected": return { bg: "bg-red-50 border-red-200",      text: "text-red-700",    badge: "bg-red-100 text-red-700",      icon: <XCircle size={15} className="text-red-600" /> };
    case "expired":  return { bg: "bg-gray-50 border-gray-200",    text: "text-gray-600",   badge: "bg-gray-100 text-gray-600",    icon: <AlertCircle size={15} className="text-gray-500" /> };
    default:         return { bg: "bg-amber-50 border-amber-200",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700",  icon: <Clock size={15} className="text-amber-600" /> };
  }
}

export function ActivatePage() {
  const { isAuthenticated, token } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"new" | "history" | "details">("new");
  const [toolCategory, setToolCategory] = useState("");
  const [toolName, setToolName] = useState("");
  const [username, setUsername] = useState("");
  const [serialKey, setSerialKey] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [detailsTool, setDetailsTool] = useState<string | null>(null);
  const [detailsActivation, setDetailsActivation] = useState<Activation | null>(null);

  const [activations, setActivations] = useState<Activation[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const selectedCat = TOOL_CATEGORIES.find((c) => c.name === toolCategory);
  const allTools = useMemo(() => TOOL_CATEGORIES.flatMap((c) => c.tools.map((tool) => ({ category: c.name, tool }))), []);

  async function loadHistory() {
    if (!token) return;
    setHistLoading(true);
    try {
      const res = await fetch("/api/activations", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json() as { activations: Activation[] };
      setActivations(data.activations ?? []);
    } catch {
      toast({ variant: "destructive", title: "Could not load activations" });
    } finally {
      setHistLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && tab === "history") loadHistory();
  }, [tab, isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toolCategory || !toolName || !username || !serialKey) {
      toast({ variant: "destructive", title: "Fill all required fields" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/activations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toolName, toolCategory, username, serialKey, orderRef: orderRef || undefined }),
      });
      const data = await res.json() as { activation?: Activation; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setSubmitted(true);
      toast({ title: "Activation submitted!", description: "Our team will process it within 1–10 minutes." });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Submission failed" });
    } finally {
      setLoading(false);
    }
  }

  async function cancelActivation(id: number) {
    if (!token) return;
    try {
      await fetch(`/api/activations/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setActivations((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Activation cancelled" });
    } catch {
      toast({ variant: "destructive", title: "Could not cancel" });
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
          <Zap size={28} className="text-orange-600" />
        </div>
        <h2 className="text-xl font-black text-gray-800">Tool Activation</h2>
        <p className="text-gray-500 text-sm">Sign in to submit and track tool activation requests</p>
        <Link href="/login">
          <button className="bg-[#1a2332] text-white font-black px-8 py-3 rounded-2xl">Sign In</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-8">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#7c3a00 100%)" }} className="px-4 pt-4 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/credits" className="text-orange-300/60 hover:text-orange-200">
            <ArrowLeft size={16} />
          </Link>
          <Zap size={17} className="text-orange-300" />
          <h1 className="text-white font-black text-base">Tool Activation</h1>
        </div>
        <p className="text-orange-200/60 text-xs ml-7">Submit activation requests · Track status · View history</p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex mx-4 mt-4 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {(["new", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === t ? "bg-orange-600 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t === "new" ? "New Activation" : "My Activations"}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4">

        {/* ── New Activation Form ───────────────────────────────────────── */}
        {tab === "new" && (
          submitted ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-lg font-black text-gray-800">Request Submitted!</h2>
              <p className="text-gray-500 text-sm">Your tool activation request has been received. Processing typically takes <strong>1–10 minutes</strong>.</p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => { setSubmitted(false); setToolCategory(""); setToolName(""); setUsername(""); setSerialKey(""); setOrderRef(""); }}
                  className="py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 text-sm flex items-center justify-center gap-1.5"
                >
                  <Plus size={15} /> New Request
                </button>
                <button
                  onClick={() => { setTab("details"); loadHistory(); }}
                  className="py-3 bg-orange-600 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-1.5"
                >
                  <Clock size={15} /> View Details
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Info banner */}
              {/* Tool Category */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Tool</p>

                <div className="relative">
                  <select
                    value={toolCategory}
                    onChange={(e) => { setToolCategory(e.target.value); setToolName(""); }}
                    required
                    className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 pr-10"
                  >
                    <option value="">— Select tool category —</option>
                    {TOOL_CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {selectedCat && (
                  <div className="relative">
                    <select
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      required
                      className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 pr-10"
                    >
                      <option value="">— Select specific tool / credit type —</option>
                      {selectedCat.tools.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
                {toolName && (
                  <button
                    type="button"
                    onClick={() => setDetailsTool(toolName)}
                    className="w-full flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left"
                  >
                    <div>
                      <p className="text-xs font-bold text-blue-700">Selected Tool</p>
                      <p className="text-sm font-semibold text-slate-900">{toolName}</p>
                    </div>
                    <ChevronRight size={15} className="text-blue-600" />
                  </button>
                )}
              </div>

              {/* Credentials */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activation Details</p>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your tool account username"
                    required
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Serial / License Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={serialKey}
                    onChange={(e) => setSerialKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    required
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Order Reference <span className="text-gray-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder="Order ID or transaction reference"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                ) : (
                  <><Zap size={18} /> Submit Activation Request</>
                )}
              </button>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Tools List</p>
                  <span className="text-[11px] text-gray-500">{allTools.length} tools</span>
                </div>
                <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
                  {allTools.map(({ category, tool }) => (
                    <button
                      key={`${category}-${tool}`}
                      type="button"
                      onClick={() => setDetailsTool(tool)}
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:bg-orange-50 hover:border-orange-300 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tool}</p>
                        <p className="text-[11px] text-gray-500">{category}</p>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="text-[11px]">{TOOL_DETAILS[tool]?.price ?? "$5"}</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )
        )}

        {/* ── History ──────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-3">
            {histLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)
            ) : activations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Server size={28} className="text-gray-300" />
                </div>
                <p className="font-bold text-gray-500">No activations yet</p>
                <p className="text-gray-400 text-xs">Submit your first tool activation request</p>
                <button
                  onClick={() => setTab("new")}
                  className="bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-1.5"
                >
                  <Plus size={14} /> New Activation
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{activations.length} Activation{activations.length !== 1 ? "s" : ""}</p>
                  <button onClick={loadHistory} className="text-orange-600 text-[11px] font-semibold">Refresh</button>
                </div>
                {activations.map((a) => {
                  const st = statusStyle(a.status);
                  return (
                    <div key={a.id} className={`w-full text-left bg-white border ${st.bg} rounded-2xl p-4 shadow-sm`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-800 text-[13px] line-clamp-1">{a.toolName}</p>
                          <p className="text-[11px] text-gray-500">{a.toolCategory}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {st.icon}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${st.badge}`}>{a.status}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-gray-400">Username: </span>
                          <span className="font-semibold text-gray-700">{a.username}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Serial: </span>
                          <span className="font-mono text-gray-700 text-[10px]">
                            {a.serialKey.length > 12 ? `${a.serialKey.slice(0, 8)}…` : a.serialKey}
                          </span>
                        </div>
                        {a.orderRef && (
                          <div className="col-span-2">
                            <span className="text-gray-400">Order: </span>
                            <span className="font-semibold text-gray-700">{a.orderRef}</span>
                          </div>
                        )}
                        {a.activationCode && (
                          <div className="col-span-2 mt-1 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                            <span className="text-green-600 font-bold text-[10px] uppercase">Activation Code: </span>
                            <span className="font-mono font-black text-green-800 text-xs">{a.activationCode}</span>
                          </div>
                        )}
                        {a.notes && a.status !== "pending" && (
                          <div className={`col-span-2 rounded-lg px-2.5 py-1.5 mt-1 ${st.bg}`}>
                            <span className={`text-[11px] ${st.text}`}>{a.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400">
                          {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailsActivation(a)}
                            className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                          >
                            View details
                          </button>
                          {a.status === "pending" && (
                            <button
                              onClick={() => cancelActivation(a.id)}
                              className="flex items-center gap-1 text-[11px] text-red-500 font-semibold hover:text-red-700"
                            >
                              <Trash2 size={12} /> Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        {tab === "details" && (
          <div className="space-y-3 pb-20">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">View Details</p>
                <p className="text-sm text-gray-600">Tap any activation to see full status and notes.</p>
              </div>
              <button onClick={() => setTab("history")} className="text-orange-600 text-sm font-bold">Back</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex gap-2.5 animate-pulse">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-800 text-[12px] leading-relaxed font-semibold">
                  Request taking long? Contact support.
                </p>
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hi, my activation request is taking long. Please help.")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-1 text-[11px] font-black text-green-700 underline underline-offset-2"
                >
                  WhatsApp support
                </a>
              </div>
            </div>
            {histLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)
            ) : activations.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-center">
                <p className="font-bold text-gray-500">No activations yet</p>
                <button onClick={() => setTab("new")} className="mt-3 bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm">New Activation</button>
              </div>
            ) : (
              activations.map((a) => {
                const st = statusStyle(a.status);
                return (
                  <div key={a.id} className={`w-full text-left bg-white border ${st.bg} rounded-2xl p-4 shadow-sm`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 text-[13px] line-clamp-1">{a.toolName}</p>
                        <p className="text-[11px] text-gray-500">{a.toolCategory}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {st.icon}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${st.badge}`}>{a.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <div><span className="text-gray-400">Username: </span><span className="font-semibold text-gray-700">{a.username}</span></div>
                      <div><span className="text-gray-400">Serial: </span><span className="font-mono text-gray-700 text-[10px]">{a.serialKey.length > 12 ? `${a.serialKey.slice(0, 8)}…` : a.serialKey}</span></div>
                      {a.orderRef && <div className="col-span-2"><span className="text-gray-400">Order: </span><span className="font-semibold text-gray-700">{a.orderRef}</span></div>}
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDetailsActivation(a)}
                        className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {detailsActivation && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4 pb-20" onClick={() => setDetailsActivation(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activation Details</p>
                <h3 className="text-lg font-black text-slate-900">{detailsActivation.toolName}</h3>
              </div>
              <button type="button" onClick={() => setDetailsActivation(null)} className="text-gray-400">
                <XCircle size={20} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Status:</strong> {detailsActivation.status}</p>
              <p><strong>Category:</strong> {detailsActivation.toolCategory}</p>
              <p><strong>Username:</strong> {detailsActivation.username}</p>
              <p><strong>Serial:</strong> {detailsActivation.serialKey}</p>
              {detailsActivation.orderRef && <p><strong>Order:</strong> {detailsActivation.orderRef}</p>}
              {detailsActivation.activationCode && <p><strong>Code:</strong> {detailsActivation.activationCode}</p>}
              {detailsActivation.notes && <p><strong>Notes:</strong> {detailsActivation.notes}</p>}
              <p><strong>Created:</strong> {new Date(detailsActivation.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
      {detailsTool && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setDetailsTool(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tool Details</p>
                <h3 className="text-lg font-black text-slate-900">{detailsTool}</h3>
              </div>
              <button type="button" onClick={() => setDetailsTool(null)} className="text-gray-400">
                <XCircle size={20} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Price:</strong> {TOOL_DETAILS[detailsTool]?.price ?? "$5"}</p>
              <p><strong>Status:</strong> {TOOL_DETAILS[detailsTool]?.status ?? "Available"}</p>
              <p><strong>Notes:</strong> {TOOL_DETAILS[detailsTool]?.notes ?? "Click to request activation."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
