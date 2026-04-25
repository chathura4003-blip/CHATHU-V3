const { sendReact } = require("../utils");
const msgMgr = require("../message-manager");
const db = require("../db");
const themeMgr = require("../theme-manager");

const DAILY_COINS = 500;
const DAILY_COOLDOWN = 86400000;
const STARTING_COINS = 1000;
const WORK_COOLDOWN = 3600000; // 1 hour
const WORK_MIN = 50;
const WORK_MAX = 500;
const WORK_JOBS = [
  "wrote a blog post",
  "fixed a bug",
  "delivered a package",
  "tutored a student",
  "sold stickers online",
  "cleaned the office",
  "took a freelance gig",
];

const SHOP_ITEMS = [
  { id: "vip", name: "⭐ VIP Badge", price: 5000, desc: "Show off your VIP status" },
  { id: "boost", name: "⚡ XP Boost", price: 2000, desc: "Double XP for 24h" },
  { id: "shield", name: "🛡️ Shield", price: 3000, desc: "Protection from theft" },
];

function getUser(jid) {
  const existing = db.get("users", jid);
  if (existing && existing.coins != null) return existing;
  if (existing) {
    const synced = { ...existing, coins: Number(existing.balance || 0) || STARTING_COINS };
    db.set("users", jid, synced);
    return synced;
  }
  const fresh = { coins: STARTING_COINS, items: [], lastDaily: 0, xp: 0 };
  db.set("users", jid, fresh);
  return fresh;
}

function isPremiumUser(jid) {
  return Boolean(db.get("users", jid)?.premium);
}

function formatCoins(value, premium) {
  if (premium) return "Unlimited";
  return `${Number(value || 0).toLocaleString()}`;
}

module.exports = {
  name: "balance",
  aliases: ["daily", "shop", "buy", "transfer", "bal", "work"],
  category: "economy",
  description: "Virtual economy system",

  async execute(sock, msg, from, args, cmdName, context) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const ownerRefs = context.owner ? [context.owner] : [];
    const tCtx = { sender, ownerRefs };

    await sendReact(sock, from, msg, "💰");

    const user = getUser(sender);
    const premium = isPremiumUser(sender);

    switch (cmdName) {
      case "balance":
      case "bal": {
        let reply = themeMgr.format("header", { title: "ғɪɴᴀɴᴄɪᴀʟ" }, tCtx);
        reply += "\n";
        reply += themeMgr.format("section", { title: "ᴘʀᴏғɪʟᴇ" }, tCtx);
        reply += themeMgr.format("item", { bullet: "user", content: `ᴜsᴇʀ  : @${sender.split('@')[0]}` }, tCtx);
        reply += themeMgr.format("item", { bullet: "default", content: `ʀᴀɴᴋ  : ${themeMgr.getBadge(sender, ownerRefs)}` }, tCtx);
        reply += themeMgr.format("footer", {}, tCtx);
        reply += "\n";

        reply += themeMgr.format("box_start", { title: "ᴀᴄᴄᴏᴜɴᴛ" }, tCtx);
        reply += themeMgr.format("box_item", { bullet: "economy", content: `Coins : ${formatCoins(user.coins, premium)}` }, tCtx);
        reply += themeMgr.format("box_item", { bullet: "creative", content: `Level : ${user.xp || 0}` }, tCtx);
        reply += themeMgr.format("box_item", { bullet: "default", content: `Assets: ${user.items?.length ? user.items.join(", ") : "None"}` }, tCtx);
        reply += themeMgr.format("box_end", {}, tCtx);
        
        reply += themeMgr.getSignature(sender, ownerRefs);
        
        await sock.sendMessage(from, { text: reply, mentions: [sender], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      case "daily": {
        if (premium) {
          await sock.sendMessage(from, {
            text: `✅ Premium active for @${sender.split("@")[0]}. Your wallet access is unlimited, so daily rewards are not required.`,
            mentions: [sender],
            contextInfo: { isForwarded: true, forwardingScore: 999 },
          }, { quoted: msg });
          break;
        }
        const now = Date.now();
        if (now - (user.lastDaily || 0) < DAILY_COOLDOWN) {
          const remaining = Math.ceil((user.lastDaily + DAILY_COOLDOWN - now) / 3600000);
          await msgMgr.sendTemp(sock, from, `⏳ Come back in *${remaining}h* for your next daily reward.`, 7000);
          await sendReact(sock, from, msg, "⏳");
          return;
        }
        user.coins += DAILY_COINS;
        user.lastDaily = now;
        db.set("users", sender, user);
        
        let reply = themeMgr.format("header", { title: "ᴅᴀɪʟʏ ʀᴇᴡᴀʀᴅ" }, tCtx);
        reply += "\n";
        reply += themeMgr.format("section", { title: "ᴄʟᴀɪᴍᴇᴅ" }, tCtx);
        reply += themeMgr.format("item", { bullet: "success", content: `Received: +${DAILY_COINS} coins` }, tCtx);
        reply += themeMgr.format("item", { bullet: "economy", content: `New Bal : ${formatCoins(user.coins, premium)}` }, tCtx);
        reply += themeMgr.format("footer", {}, tCtx);
        
        reply += themeMgr.getSignature(sender, ownerRefs);
        
        await sock.sendMessage(from, { text: reply, mentions: [sender], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      case "shop": {
        let shopMsg = themeMgr.format("header", { title: "ᴘʀᴇᴍɪᴜᴍ sʜᴏᴘ" }, tCtx);
        shopMsg += "\n";
        shopMsg += themeMgr.format("section", { title: "ɪᴛᴇᴍs ᴄᴀᴛᴀʟᴏɢ" }, tCtx);
        
        SHOP_ITEMS.forEach((item) => {
          shopMsg += themeMgr.format("item", { bullet: "default", content: `*${item.name}*` }, tCtx);
          shopMsg += `    ┕ Cost: ${item.price} — ${item.desc}\n`;
        });
        
        shopMsg += themeMgr.format("footer", {}, tCtx);
        shopMsg += themeMgr.getSignature(sender, ownerRefs);
        
        await sock.sendMessage(from, { text: shopMsg, mentions: [sender], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      case "buy": {
        const itemId = args[0]?.toLowerCase();
        const item = SHOP_ITEMS.find((i) => i.id === itemId);
        if (!item) {
          return msgMgr.sendTemp(sock, from, `❌ Unknown item. Type .shop to see available items.`, 5000);
        }
        if (!premium && user.coins < item.price) {
          return msgMgr.sendTemp(sock, from, `❌ Insufficient coins. You need ${item.price}, you have ${user.coins}.`, 6000);
        }
        if (!premium) user.coins -= item.price;
        user.items = user.items || [];
        if (!user.items.includes(item.id)) user.items.push(item.id);
        db.set("users", sender, user);
        
        let reply = themeMgr.format("header", { title: "ᴘᴜʀᴄʜᴀsᴇ" }, tCtx);
        reply += "\n";
        reply += themeMgr.format("section", { title: "ʀᴇᴄᴇɪᴘᴛ" }, tCtx);
        reply += themeMgr.format("item", { bullet: "success", content: `Item : ${item.name}` }, tCtx);
        reply += themeMgr.format("item", { bullet: "economy", content: `Bal  : ${formatCoins(user.coins, premium)}` }, tCtx);
        reply += themeMgr.format("footer", {}, tCtx);
        
        reply += themeMgr.getSignature(sender, ownerRefs);
        
        await sock.sendMessage(from, { text: reply, mentions: [sender], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      case "work": {
        if (premium) {
          user.coins = (user.coins || 0) + WORK_MAX;
          db.set("users", sender, user);
          await sock.sendMessage(from, {
            text: `✅ Premium bonus: +${WORK_MAX} coins (no cooldown).`,
            mentions: [sender],
          }, { quoted: msg });
          break;
        }
        const now = Date.now();
        const lastWork = user.lastWork || 0;
        if (now - lastWork < WORK_COOLDOWN) {
          const remaining = Math.ceil((lastWork + WORK_COOLDOWN - now) / 60000);
          await msgMgr.sendTemp(sock, from, `⏳ You are exhausted. Try again in *${remaining}m*.`, 6000);
          await sendReact(sock, from, msg, "⏳");
          return;
        }
        const earned = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;
        const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)];
        user.coins = (user.coins || 0) + earned;
        user.lastWork = now;
        db.set("users", sender, user);

        let reply = themeMgr.format("header", { title: "ᴡᴏʀᴋ ᴄᴏᴍᴘʟᴇᴛᴇ" }, tCtx);
        reply += "\n";
        reply += themeMgr.format("section", { title: "sʜɪғᴛ" }, tCtx);
        reply += themeMgr.format("item", { bullet: "default", content: `Task    : ${job}` }, tCtx);
        reply += themeMgr.format("item", { bullet: "success", content: `Earned  : +${earned} coins` }, tCtx);
        reply += themeMgr.format("item", { bullet: "economy", content: `New Bal : ${formatCoins(user.coins, premium)}` }, tCtx);
        reply += themeMgr.format("footer", {}, tCtx);
        reply += themeMgr.getSignature(sender, ownerRefs);

        await sock.sendMessage(from, { text: reply, mentions: [sender], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      case "transfer": {
        const mentioned =
          msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0];
        const amount = parseInt(args.find((a) => /^\d+$/.test(a)));
        if (!target || !amount || amount <= 0) {
          return msgMgr.sendTemp(sock, from, "⚠️ Usage: .transfer @user <amount>", 5000);
        }
        if (target === sender) {
          return msgMgr.sendTemp(sock, from, "❌ You cannot transfer to yourself.", 4000);
        }
        if (!premium && user.coins < amount) {
          return msgMgr.sendTemp(sock, from, `❌ You only have ${user.coins} coins.`, 5000);
        }
        if (!premium) user.coins -= amount;
        db.set("users", sender, user);
        const targetUser = getUser(target);
        targetUser.coins += amount;
        db.set("users", target, targetUser);
        
        let reply = themeMgr.format("header", { title: "ғᴜɴᴅ ᴛʀᴀɴsғᴇʀ" }, tCtx);
        reply += "\n";
        reply += themeMgr.format("section", { title: "ᴛʀᴀɴsᴀᴄᴛɪᴏɴ" }, tCtx);
        reply += themeMgr.format("item", { bullet: "user", content: `Sent to: @${target.split('@')[0]}` }, tCtx);
        reply += themeMgr.format("item", { bullet: "economy", content: `Amount : ${amount.toLocaleString()} coins` }, tCtx);
        reply += themeMgr.format("item", { bullet: "success", content: "Transfer Successful" }, tCtx);
        reply += themeMgr.format("footer", {}, tCtx);
        
        reply += themeMgr.getSignature(sender, ownerRefs);
        
        await sock.sendMessage(from, { text: reply, mentions: [sender, target], contextInfo: { isForwarded: true, forwardingScore: 999 } }, { quoted: msg });
        break;
      }

      default:
        await msgMgr.sendTemp(sock, from, "❓ Unknown economy command.", 4000);
    }

    await sendReact(sock, from, msg, "✅");
  },
};
