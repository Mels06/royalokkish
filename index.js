const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ─────────────────────────────────────────
// CONNEXIONS
// ─────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GAS_URL = process.env.GAS_URL;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// IDs autorisés (sécurité)
const USERS_AUTORISES = [
  process.env.TELEGRAM_USER_ID_1,
  process.env.TELEGRAM_USER_ID_2,
].filter(Boolean);

// ─────────────────────────────────────────
// BASE DE DONNÉES EN MÉMOIRE
// ─────────────────────────────────────────
let db = {
  produits: [],
  clients: [],
  ventes: [],
  charges: [],
  historique_stock: [],
};

// Sessions pour les conversations multi-étapes
let sessions = {};

// ─────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calculerMarge(achat, vente) {
  const marge = vente - achat;
  const taux = achat > 0 ? ((marge / achat) * 100).toFixed(1) : 0;
  return { marge: parseFloat(marge.toFixed(2)), taux: parseFloat(taux) };
}

function getAlertes() {
  return db.produits.filter((p) => p.stock <= 5 && p.stock > 0);
}

function getRuptures() {
  return db.produits.filter((p) => p.stock === 0);
}

function getStats() {
  const ca = db.ventes.reduce((s, v) => s + v.montant_total, 0);
  const cout_achats = db.ventes.reduce((s, v) => s + v.prix_achat_unitaire * v.quantite, 0);
  const total_charges = db.charges.reduce((s, c) => s + c.montant, 0);
  return {
    ca: parseFloat(ca.toFixed(2)),
    cout_achats: parseFloat(cout_achats.toFixed(2)),
    benefice_brut: parseFloat((ca - cout_achats).toFixed(2)),
    benefice_net: parseFloat((ca - cout_achats - total_charges).toFixed(2)),
    total_charges: parseFloat(total_charges.toFixed(2)),
    nb_produits: db.produits.length,
    nb_clients: db.clients.length,
    nb_ventes: db.ventes.length,
    alertes_stock: getAlertes().length,
    ruptures: getRuptures().length,
  };
}

async function envoyerVersSheets(action, data) {
  if (!GAS_URL) return;
  try {
    await axios.post(GAS_URL, { action, ...data });
  } catch (err) {
    console.error("Erreur envoi Sheets :", err.message);
  }
}

// ─────────────────────────────────────────
// TELEGRAM — Envoyer un message
// ─────────────────────────────────────────
async function sendMessage(chatId, text, options = {}) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...options,
    });
  } catch (err) {
    console.error("Erreur Telegram sendMessage :", err.message);
  }
}

// Clavier principal
function menuPrincipal() {
  return {
    keyboard: [
      ["📦 Produits", "👥 Clients"],
      ["💰 Ventes", "📊 Charges"],
      ["📈 Stats", "🚨 Alertes"],
      ["🤖 Analyser avec l'IA"],
    ],
    resize_keyboard: true,
  };
}

// ─────────────────────────────────────────
// TELEGRAM — Webhook (reçoit les messages)
// ─────────────────────────────────────────
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id.toString();
  const userId = msg.from.id.toString();
  const text = msg.text || "";

  // Vérifier si l'utilisateur est autorisé
  if (USERS_AUTORISES.length > 0 && !USERS_AUTORISES.includes(userId)) {
    return sendMessage(chatId, "⛔ Accès non autorisé.");
  }

  // Récupérer la session
  if (!sessions[chatId]) sessions[chatId] = { etape: null, data: {} };
  const session = sessions[chatId];

  // ── Commandes principales ──
  if (text === "/start" || text === "🏠 Menu") {
    session.etape = null;
    session.data = {};
    return sendMessage(chatId,
      `👋 Bonjour ! Je suis votre *Bot Commercial Royal Okkish*.\n\nChoisissez une option :`,
      { reply_markup: menuPrincipal() }
    );
  }

  // ── STATS ──
  if (text === "📈 Stats" || text === "/stats") {
    const s = getStats();
    return sendMessage(chatId,
      `📈 *TABLEAU DE BORD*\n\n` +
      `💰 CA total : *${s.ca} €*\n` +
      `📦 Coût achats : ${s.cout_achats} €\n` +
      `✅ Bénéfice brut : *${s.benefice_brut} €*\n` +
      `📊 Charges : ${s.total_charges} €\n` +
      `🏆 Bénéfice net : *${s.benefice_net} €*\n\n` +
      `🛍️ Produits : ${s.nb_produits}\n` +
      `👥 Clients : ${s.nb_clients}\n` +
      `🛒 Ventes : ${s.nb_ventes}\n` +
      `🚨 Alertes stock : ${s.alertes_stock}\n` +
      `🔴 Ruptures : ${s.ruptures}`,
      { reply_markup: menuPrincipal() }
    );
  }

  // ── ALERTES ──
  if (text === "🚨 Alertes" || text === "/alertes") {
    const alertes = getAlertes();
    const ruptures = getRuptures();

    let msg = `🚨 *ALERTES STOCK*\n\n`;

    if (ruptures.length > 0) {
      msg += `🔴 *Ruptures :*\n`;
      ruptures.forEach(p => msg += `• ${p.nom} — 0 unité\n`);
      msg += "\n";
    }

    if (alertes.length > 0) {
      msg += `🟡 *Stock bas (≤5) :*\n`;
      alertes.forEach(p => msg += `• ${p.nom} — ${p.stock} unité(s)\n`);
    }

    if (alertes.length === 0 && ruptures.length === 0) {
      msg += `✅ Tout le stock est OK !`;
    }

    return sendMessage(chatId, msg, { reply_markup: menuPrincipal() });
  }

  // ── VOIR LES PRODUITS ──
  if (text === "📦 Produits" || text === "/produits") {
    if (db.produits.length === 0) {
      return sendMessage(chatId,
        `📦 Aucun produit.\n\nPour ajouter un produit tapez :\n/ajouterproduit`,
        { reply_markup: {
          keyboard: [["➕ Ajouter produit"], ["🏠 Menu"]],
          resize_keyboard: true,
        }}
      );
    }

    let msg = `📦 *PRODUITS (${db.produits.length})*\n\n`;
    db.produits.forEach(p => {
      const { marge, taux } = calculerMarge(p.prix_achat, p.prix_vente);
      const statut = p.stock === 0 ? "🔴" : p.stock <= 5 ? "🟡" : "🟢";
      msg += `${statut} *${p.nom}*\n`;
      msg += `   Achat: ${p.prix_achat}€ | Vente: ${p.prix_vente}€ | Marge: ${marge}€ (${taux}%)\n`;
      msg += `   Stock: ${p.stock} unités\n\n`;
    });

    return sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [["➕ Ajouter produit"], ["🏠 Menu"]],
        resize_keyboard: true,
      }
    });
  }

  // ── AJOUTER PRODUIT (début) ──
  if (text === "➕ Ajouter produit" || text === "/ajouterproduit") {
    session.etape = "produit_nom";
    session.data = {};
    return sendMessage(chatId, `📦 *Nouveau produit*\n\nEntrez le *nom* du produit :`, {
      reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true }
    });
  }

  // ── VOIR LES CLIENTS ──
  if (text === "👥 Clients" || text === "/clients") {
    if (db.clients.length === 0) {
      return sendMessage(chatId,
        `👥 Aucun client.\n\nPour ajouter un client tapez :\n/ajouterclient`,
        { reply_markup: {
          keyboard: [["➕ Ajouter client"], ["🏠 Menu"]],
          resize_keyboard: true,
        }}
      );
    }

    let msg = `👥 *CLIENTS (${db.clients.length})*\n\n`;
    db.clients.forEach(c => {
      const ventes_client = db.ventes.filter(v => v.client_id === c.id);
      const ca = ventes_client.reduce((s, v) => s + v.montant_total, 0);
      msg += `👤 *${c.nom}*\n`;
      if (c.email) msg += `   📧 ${c.email}\n`;
      if (c.telephone) msg += `   📱 ${c.telephone}\n`;
      msg += `   🛒 ${ventes_client.length} achat(s) — CA: ${ca.toFixed(2)}€\n\n`;
    });

    return sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [["➕ Ajouter client"], ["🏠 Menu"]],
        resize_keyboard: true,
      }
    });
  }

  // ── AJOUTER CLIENT (début) ──
  if (text === "➕ Ajouter client" || text === "/ajouterclient") {
    session.etape = "client_nom";
    session.data = {};
    return sendMessage(chatId, `👥 *Nouveau client*\n\nEntrez le *nom* du client :`, {
      reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true }
    });
  }

  // ── VENTES ──
  if (text === "💰 Ventes" || text === "/ventes") {
    if (db.ventes.length === 0) {
      return sendMessage(chatId,
        `💰 Aucune vente enregistrée.\n\nPour enregistrer une vente :\n/ajoutervente`,
        { reply_markup: {
          keyboard: [["➕ Ajouter vente"], ["🏠 Menu"]],
          resize_keyboard: true,
        }}
      );
    }

    let msg = `💰 *VENTES (${db.ventes.length})*\n\n`;
    db.ventes.slice(0, 10).forEach(v => {
      msg += `🛒 *${v.produit_nom}* x${v.quantite}\n`;
      msg += `   Client: ${v.client_nom} | Total: ${v.montant_total}€ | Marge: ${v.marge_totale}€\n\n`;
    });

    return sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [["➕ Ajouter vente"], ["🏠 Menu"]],
        resize_keyboard: true,
      }
    });
  }

  // ── AJOUTER VENTE (début) ──
  if (text === "➕ Ajouter vente" || text === "/ajoutervente") {
    if (db.produits.length === 0) {
      return sendMessage(chatId, `⚠️ Ajoutez d'abord un produit !`, { reply_markup: menuPrincipal() });
    }
    session.etape = "vente_produit";
    session.data = {};

    const boutons = db.produits.map(p => [`${p.nom} (stock: ${p.stock})`]);
    boutons.push(["❌ Annuler"]);

    return sendMessage(chatId, `💰 *Nouvelle vente*\n\nChoisissez le produit :`, {
      reply_markup: { keyboard: boutons, resize_keyboard: true }
    });
  }

  // ── CHARGES ──
  if (text === "📊 Charges" || text === "/charges") {
    if (db.charges.length === 0) {
      return sendMessage(chatId,
        `📊 Aucune charge.\n\nPour ajouter une charge :\n/ajoutercharge`,
        { reply_markup: {
          keyboard: [["➕ Ajouter charge"], ["🏠 Menu"]],
          resize_keyboard: true,
        }}
      );
    }

    const total = db.charges.reduce((s, c) => s + c.montant, 0);
    let msg = `📊 *CHARGES (total: ${total.toFixed(2)}€)*\n\n`;
    db.charges.forEach(c => {
      msg += `• *${c.label}* — ${c.montant}€ (${c.categorie})\n`;
    });

    return sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [["➕ Ajouter charge"], ["🏠 Menu"]],
        resize_keyboard: true,
      }
    });
  }

  // ── AJOUTER CHARGE (début) ──
  if (text === "➕ Ajouter charge" || text === "/ajoutercharge") {
    session.etape = "charge_label";
    session.data = {};
    return sendMessage(chatId, `📊 *Nouvelle charge*\n\nEntrez le *libellé* (ex: Loyer, Publicité...) :`, {
      reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true }
    });
  }

  // ── IA ──
  if (text === "🤖 Analyser avec l'IA" || text === "/ia") {
    session.etape = "ia_question";
    return sendMessage(chatId, `🤖 *Assistant IA*\n\nPosez votre question sur votre business :`, {
      reply_markup: {
        keyboard: [
          ["Analyse ma rentabilité"],
          ["Quels produits restock en urgence ?"],
          ["Conseils pour augmenter le CA"],
          ["❌ Annuler"]
        ],
        resize_keyboard: true,
      }
    });
  }

  // ── ANNULER ──
  if (text === "❌ Annuler") {
    session.etape = null;
    session.data = {};
    return sendMessage(chatId, `❌ Annulé.`, { reply_markup: menuPrincipal() });
  }

  // ─────────────────────────────────────────
  // GESTION DES ÉTAPES (conversations)
  // ─────────────────────────────────────────

  // == PRODUIT ==
  if (session.etape === "produit_nom") {
    session.data.nom = text;
    session.etape = "produit_achat";
    return sendMessage(chatId, `💵 Prix d'*achat* (€) :`, {
      reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true }
    });
  }

  if (session.etape === "produit_achat") {
    const val = parseFloat(text);
    if (isNaN(val)) return sendMessage(chatId, `⚠️ Entrez un nombre valide.`);
    session.data.prix_achat = val;
    session.etape = "produit_vente";
    return sendMessage(chatId, `💰 Prix de *vente* (€) :`);
  }

  if (session.etape === "produit_vente") {
    const val = parseFloat(text);
    if (isNaN(val)) return sendMessage(chatId, `⚠️ Entrez un nombre valide.`);
    session.data.prix_vente = val;
    session.etape = "produit_stock";
    return sendMessage(chatId, `📦 *Stock* initial :`);
  }

  if (session.etape === "produit_stock") {
    const val = parseInt(text);
    if (isNaN(val)) return sendMessage(chatId, `⚠️ Entrez un nombre entier.`);
    session.data.stock = val;
    session.etape = "produit_categorie";
    return sendMessage(chatId, `🏷️ *Catégorie* (ex: Vêtements, Accessoires...) :`, {
      reply_markup: {
        keyboard: [["Vêtements"], ["Accessoires"], ["Autre"], ["❌ Annuler"]],
        resize_keyboard: true,
      }
    });
  }

  if (session.etape === "produit_categorie") {
    session.data.categorie = text;

    const produit = {
      id: genId(),
      nom: session.data.nom,
      prix_achat: session.data.prix_achat,
      prix_vente: session.data.prix_vente,
      stock: session.data.stock,
      categorie: session.data.categorie,
      cree_le: new Date().toISOString(),
    };

    db.produits.push(produit);
    const { marge, taux } = calculerMarge(produit.prix_achat, produit.prix_vente);

    await envoyerVersSheets("nouveau_produit", {
      nom: produit.nom,
      categorie: produit.categorie,
      prix_achat: produit.prix_achat,
      prix_vente: produit.prix_vente,
      stock: produit.stock,
      date: new Date().toLocaleString("fr-FR"),
    });

    session.etape = null;
    session.data = {};

    return sendMessage(chatId,
      `✅ *Produit ajouté !*\n\n` +
      `📦 ${produit.nom}\n` +
      `💵 Achat: ${produit.prix_achat}€ | Vente: ${produit.prix_vente}€\n` +
      `📈 Marge: *${marge}€ (${taux}%)*\n` +
      `🗃️ Stock: ${produit.stock} unités`,
      { reply_markup: menuPrincipal() }
    );
  }

  // == CLIENT ==
  if (session.etape === "client_nom") {
    session.data.nom = text;
    session.etape = "client_email";
    return sendMessage(chatId, `📧 *Email* (ou tapez "skip") :`, {
      reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true }
    });
  }

  if (session.etape === "client_email") {
    session.data.email = text === "skip" ? "" : text;
    session.etape = "client_tel";
    return sendMessage(chatId, `📱 *Téléphone* (ou tapez "skip") :`);
  }

  if (session.etape === "client_tel") {
    session.data.telephone = text === "skip" ? "" : text;
    session.etape = "client_note";
    return sendMessage(chatId, `📝 *Note* (ex: VIP, Grossiste... ou "skip") :`);
  }

  if (session.etape === "client_note") {
    session.data.note = text === "skip" ? "" : text;

    const client = {
      id: genId(),
      nom: session.data.nom,
      email: session.data.email,
      telephone: session.data.telephone,
      note: session.data.note,
      cree_le: new Date().toISOString(),
    };

    db.clients.push(client);

    await envoyerVersSheets("nouveau_client", {
      nom: client.nom,
      email: client.email,
      telephone: client.telephone,
      note: client.note,
      date: new Date().toLocaleString("fr-FR"),
    });

    session.etape = null;
    session.data = {};

    return sendMessage(chatId,
      `✅ *Client ajouté !*\n\n👤 ${client.nom}\n📧 ${client.email || "—"}\n📱 ${client.telephone || "—"}`,
      { reply_markup: menuPrincipal() }
    );
  }

  // == VENTE ==
  if (session.etape === "vente_produit") {
    const produit = db.produits.find(p => text.startsWith(p.nom));
    if (!produit) return sendMessage(chatId, `⚠️ Produit non trouvé. Choisissez dans la liste.`);
    if (produit.stock === 0) return sendMessage(chatId, `🔴 Stock épuisé pour ${produit.nom} !`);

    session.data.produit = produit;
    session.etape = "vente_quantite";
    return sendMessage(chatId, `🔢 *Quantité* ? (stock dispo: ${produit.stock})`, {
      reply_markup: { keyboard: [["1"], ["2"], ["3"], ["5"], ["❌ Annuler"]], resize_keyboard: true }
    });
  }

  if (session.etape === "vente_quantite") {
    const qte = parseInt(text);
    if (isNaN(qte) || qte < 1) return sendMessage(chatId, `⚠️ Quantité invalide.`);
    if (qte > session.data.produit.stock) {
      return sendMessage(chatId, `⚠️ Stock insuffisant ! Max: ${session.data.produit.stock}`);
    }

    session.data.quantite = qte;
    session.etape = "vente_client";

    const boutons = db.clients.map(c => [c.nom]);
    boutons.push(["Anonyme"]);
    boutons.push(["❌ Annuler"]);

    return sendMessage(chatId, `👤 *Client* ?`, {
      reply_markup: { keyboard: boutons, resize_keyboard: true }
    });
  }

  if (session.etape === "vente_client") {
    const client = text === "Anonyme" ? null : db.clients.find(c => c.nom === text);
    const produit = session.data.produit;
    const qte = session.data.quantite;

    const avant = produit.stock;
    produit.stock -= qte;

    const montant_total = parseFloat((produit.prix_vente * qte).toFixed(2));
    const marge_totale = parseFloat(((produit.prix_vente - produit.prix_achat) * qte).toFixed(2));

    const vente = {
      id: genId(),
      client_id: client ? client.id : null,
      client_nom: client ? client.nom : "Anonyme",
      produit_id: produit.id,
      produit_nom: produit.nom,
      prix_achat_unitaire: produit.prix_achat,
      prix_vente_unitaire: produit.prix_vente,
      quantite: qte,
      montant_total,
      marge_totale,
      date: new Date().toISOString(),
    };

    db.ventes.unshift(vente);
    db.historique_stock.unshift({
      id: genId(),
      produit_id: produit.id,
      produit_nom: produit.nom,
      operation: "remove",
      quantite: qte,
      stock_avant: avant,
      stock_apres: produit.stock,
      note: `Vente — ${vente.client_nom}`,
      date: new Date().toISOString(),
    });

    await envoyerVersSheets("nouvelle_vente", {
      client: vente.client_nom,
      produit: produit.nom,
      quantite: qte,
      prix_vente: produit.prix_vente,
      montant_total,
      marge_totale,
      date: new Date().toLocaleString("fr-FR"),
    });

    session.etape = null;
    session.data = {};

    let reponse = `✅ *Vente enregistrée !*\n\n` +
      `🛒 ${produit.nom} x${qte}\n` +
      `👤 Client: ${vente.client_nom}\n` +
      `💰 Total: *${montant_total}€*\n` +
      `📈 Marge: *${marge_totale}€*\n` +
      `📦 Stock restant: ${produit.stock}`;

    if (produit.stock <= 5) {
      reponse += `\n\n⚠️ *ALERTE : Stock bas (${produit.stock} unités) !*`;
    }

    return sendMessage(chatId, reponse, { reply_markup: menuPrincipal() });
  }

  // == CHARGE ==
  if (session.etape === "charge_label") {
    session.data.label = text;
    session.etape = "charge_montant";
    return sendMessage(chatId, `💵 *Montant* (€) :`, {
      reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true }
    });
  }

  if (session.etape === "charge_montant") {
    const val = parseFloat(text);
    if (isNaN(val)) return sendMessage(chatId, `⚠️ Entrez un nombre valide.`);
    session.data.montant = val;
    session.etape = "charge_categorie";
    return sendMessage(chatId, `🏷️ *Catégorie* :`, {
      reply_markup: {
        keyboard: [["Loyer"], ["Salaires"], ["Marketing"], ["Transport"], ["Autre"], ["❌ Annuler"]],
        resize_keyboard: true,
      }
    });
  }

  if (session.etape === "charge_categorie") {
    const charge = {
      id: genId(),
      label: session.data.label,
      montant: session.data.montant,
      categorie: text,
      date: new Date().toISOString(),
    };

    db.charges.push(charge);

    await envoyerVersSheets("nouvelle_charge", {
      label: charge.label,
      montant: charge.montant,
      categorie: charge.categorie,
      date: new Date().toLocaleString("fr-FR"),
    });

    session.etape = null;
    session.data = {};

    return sendMessage(chatId,
      `✅ *Charge enregistrée !*\n\n📊 ${charge.label}\n💵 ${charge.montant}€ (${charge.categorie})`,
      { reply_markup: menuPrincipal() }
    );
  }

  // == IA ==
  if (session.etape === "ia_question") {
    await sendMessage(chatId, `🤖 Analyse en cours...`);

    const contexte = {
      stats: getStats(),
      produits: db.produits.map(p => ({
        nom: p.nom, prix_achat: p.prix_achat, prix_vente: p.prix_vente,
        stock: p.stock, marge: calculerMarge(p.prix_achat, p.prix_vente),
      })),
      clients: db.clients.map(c => ({
        nom: c.nom,
        nb_achats: db.ventes.filter(v => v.client_id === c.id).length,
        ca_total: db.ventes.filter(v => v.client_id === c.id).reduce((s, v) => s + v.montant_total, 0),
      })),
      ventes_recentes: db.ventes.slice(0, 10),
      charges: db.charges,
      alertes: getAlertes().map(p => p.nom),
      ruptures: getRuptures().map(p => p.nom),
    };

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant commercial expert. Analyse les données de l'entreprise et donne des conseils concrets, chiffrés et actionnables. Réponds en français, de façon courte et claire (max 300 mots). Données : ${JSON.stringify(contexte)}`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 500,
        temperature: 0.4,
      });

      session.etape = null;
      return sendMessage(chatId,
        `🤖 *Analyse IA :*\n\n${completion.choices[0].message.content}`,
        { reply_markup: menuPrincipal() }
      );
    } catch (err) {
      session.etape = null;
      return sendMessage(chatId, `❌ Erreur IA : ${err.message}`, { reply_markup: menuPrincipal() });
    }
  }

  // Message non reconnu
  return sendMessage(chatId,
    `❓ Commande non reconnue. Utilisez le menu ci-dessous.`,
    { reply_markup: menuPrincipal() }
  );
});

// ─────────────────────────────────────────
// API REST (inchangée)
// ─────────────────────────────────────────
app.get("/api/produits", (req, res) => res.json(db.produits));
app.get("/api/clients", (req, res) => res.json(db.clients));
app.get("/api/ventes", (req, res) => res.json(db.ventes));
app.get("/api/charges", (req, res) => res.json(db.charges));
app.get("/api/stats", (req, res) => res.json(getStats()));
app.get("/api/alertes", (req, res) => res.json({ alertes_bas: getAlertes(), ruptures: getRuptures() }));

// ─────────────────────────────────────────
// DÉMARRAGE + ENREGISTREMENT WEBHOOK
// ─────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Serveur démarré : http://localhost:${PORT}`);
  console.log(`🤖 OpenAI connecté (GPT-4o)`);
  console.log(`📊 Google Sheets : ${GAS_URL || "non configuré"}`);

  // Enregistrer le webhook Telegram
  if (TELEGRAM_TOKEN) {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    try {
      await axios.post(`${TELEGRAM_API}/setWebhook`, {
        url: `${RENDER_URL}/webhook/${TELEGRAM_TOKEN}`,
      });
      console.log(`✅ Webhook Telegram enregistré : ${RENDER_URL}/webhook/${TELEGRAM_TOKEN}`);
    } catch (err) {
      console.error("❌ Erreur webhook Telegram :", err.message);
    }
  }
});