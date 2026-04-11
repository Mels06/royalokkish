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
const GAS_URL = process.env.GAS_URL; // URL du Google Apps Script déployé

// Envoyer des données vers Google Sheets
async function envoyerVersSheets(action, data) {
  if (!GAS_URL) return;
  try {
    await axios.post(GAS_URL, { action, ...data });
  } catch (err) {
    console.error("Erreur envoi Sheets :", err.message);
  }
}

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

// ─────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calculerMarge(achat, vente) {
  const marge = vente - achat;
  const taux = achat > 0 ? ((marge / achat) * 100).toFixed(2) : 0;
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

// ─────────────────────────────────────────
// PRODUITS
// ─────────────────────────────────────────
app.get("/api/produits", (req, res) => {
  res.json(db.produits.map((p) => ({
    ...p,
    ...calculerMarge(p.prix_achat, p.prix_vente),
    statut: p.stock === 0 ? "rupture" : p.stock <= 5 ? "stock_bas" : "disponible",
  })));
});

app.get("/api/produits/:id", (req, res) => {
  const p = db.produits.find((p) => p.id === req.params.id);
  if (!p) return res.status(404).json({ erreur: "Produit introuvable" });
  res.json({ ...p, ...calculerMarge(p.prix_achat, p.prix_vente) });
});

app.post("/api/produits", async (req, res) => {
  const { nom, prix_achat, prix_vente, stock, categorie } = req.body;
  if (!nom || prix_achat == null || prix_vente == null)
    return res.status(400).json({ erreur: "Champs requis : nom, prix_achat, prix_vente" });

  const produit = {
    id: genId(),
    nom: nom.trim(),
    prix_achat: parseFloat(prix_achat),
    prix_vente: parseFloat(prix_vente),
    stock: parseInt(stock) || 0,
    categorie: categorie?.trim() || "Général",
    cree_le: new Date().toISOString(),
  };

  db.produits.push(produit);

  // → Envoyer vers Google Sheets
  await envoyerVersSheets("nouveau_produit", {
    id: produit.id,
    nom: produit.nom,
    categorie: produit.categorie,
    prix_achat: produit.prix_achat,
    prix_vente: produit.prix_vente,
    stock: produit.stock,
    date: new Date().toLocaleString("fr-FR"),
  });

  res.status(201).json({ message: "Produit créé", produit });
});

app.put("/api/produits/:id", (req, res) => {
  const idx = db.produits.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erreur: "Produit introuvable" });
  db.produits[idx] = { ...db.produits[idx], ...req.body, id: req.params.id };
  res.json({ message: "Produit mis à jour", produit: db.produits[idx] });
});

app.delete("/api/produits/:id", (req, res) => {
  const idx = db.produits.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erreur: "Produit introuvable" });
  db.produits.splice(idx, 1);
  res.json({ message: "Produit supprimé" });
});

// ─────────────────────────────────────────
// STOCK
// ─────────────────────────────────────────
app.post("/api/stock/:id", async (req, res) => {
  const { operation, quantite, note } = req.body;
  const produit = db.produits.find((p) => p.id === req.params.id);
  if (!produit) return res.status(404).json({ erreur: "Produit introuvable" });
  if (!["add", "remove", "set"].includes(operation))
    return res.status(400).json({ erreur: "Operation invalide : add | remove | set" });

  const qte = parseInt(quantite);
  const avant = produit.stock;

  if (operation === "add") produit.stock += qte;
  else if (operation === "remove") produit.stock = Math.max(0, produit.stock - qte);
  else produit.stock = Math.max(0, qte);

  const mouvement = {
    id: genId(),
    produit_id: produit.id,
    produit_nom: produit.nom,
    operation,
    quantite: qte,
    stock_avant: avant,
    stock_apres: produit.stock,
    note: note || "",
    date: new Date().toISOString(),
  };
  db.historique_stock.unshift(mouvement);

  // → Envoyer vers Google Sheets
  await envoyerVersSheets("mouvement_stock", {
    produit: produit.nom,
    operation,
    quantite: qte,
    stock_avant: avant,
    stock_apres: produit.stock,
    note: note || "",
    date: new Date().toLocaleString("fr-FR"),
  });

  res.json({
    message: "Stock mis à jour",
    produit: produit.nom,
    stock_avant: avant,
    stock_apres: produit.stock,
    alerte_stock_bas: produit.stock <= 5,
  });
});

app.get("/api/stock/historique", (req, res) => {
  res.json(db.historique_stock.slice(0, 100));
});

app.get("/api/alertes", (req, res) => {
  res.json({
    alertes_bas: getAlertes(),
    ruptures: getRuptures(),
    total: getAlertes().length + getRuptures().length,
  });
});

// ─────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────
app.get("/api/clients", (req, res) => {
  res.json(db.clients.map((c) => ({
    ...c,
    nb_achats: db.ventes.filter((v) => v.client_id === c.id).length,
    ca_total: parseFloat(
      db.ventes.filter((v) => v.client_id === c.id)
        .reduce((s, v) => s + v.montant_total, 0).toFixed(2)
    ),
  })));
});

app.get("/api/clients/:id", (req, res) => {
  const client = db.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ erreur: "Client introuvable" });
  const ventes_client = db.ventes.filter((v) => v.client_id === client.id);
  res.json({
    ...client,
    nb_achats: ventes_client.length,
    ca_total: parseFloat(ventes_client.reduce((s, v) => s + v.montant_total, 0).toFixed(2)),
    historique_achats: ventes_client,
  });
});

app.post("/api/clients", async (req, res) => {
  const { nom, email, telephone, adresse, note } = req.body;
  if (!nom) return res.status(400).json({ erreur: "Le nom est obligatoire" });

  const client = {
    id: genId(),
    nom: nom.trim(),
    email: email?.trim() || "",
    telephone: telephone?.trim() || "",
    adresse: adresse?.trim() || "",
    note: note?.trim() || "",
    cree_le: new Date().toISOString(),
  };

  db.clients.push(client);

  // → Envoyer vers Google Sheets
  await envoyerVersSheets("nouveau_client", {
    nom: client.nom,
    email: client.email,
    telephone: client.telephone,
    adresse: client.adresse,
    note: client.note,
    date: new Date().toLocaleString("fr-FR"),
  });

  res.status(201).json({ message: "Client créé", client });
});

app.put("/api/clients/:id", (req, res) => {
  const idx = db.clients.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erreur: "Client introuvable" });
  db.clients[idx] = { ...db.clients[idx], ...req.body, id: req.params.id };
  res.json({ message: "Client mis à jour", client: db.clients[idx] });
});

app.delete("/api/clients/:id", (req, res) => {
  const idx = db.clients.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erreur: "Client introuvable" });
  db.clients.splice(idx, 1);
  res.json({ message: "Client supprimé" });
});

// ─────────────────────────────────────────
// VENTES
// ─────────────────────────────────────────
app.get("/api/ventes", (req, res) => {
  res.json(db.ventes);
});

app.post("/api/ventes", async (req, res) => {
  const { client_id, produit_id, quantite } = req.body;
  const produit = db.produits.find((p) => p.id === produit_id);
  if (!produit) return res.status(404).json({ erreur: "Produit introuvable" });

  const qte = parseInt(quantite) || 1;
  if (produit.stock < qte)
    return res.status(400).json({ erreur: `Stock insuffisant. Disponible : ${produit.stock}` });

  const avant = produit.stock;
  produit.stock -= qte;

  const client = db.clients.find((c) => c.id === client_id);
  const montant_total = parseFloat((produit.prix_vente * qte).toFixed(2));
  const marge_totale = parseFloat(((produit.prix_vente - produit.prix_achat) * qte).toFixed(2));

  const vente = {
    id: genId(),
    client_id: client_id || null,
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
    note: `Vente — ${client ? client.nom : "Anonyme"}`,
    date: new Date().toISOString(),
  });

  // → Envoyer vers Google Sheets
  await envoyerVersSheets("nouvelle_vente", {
    client: vente.client_nom,
    produit: produit.nom,
    quantite: qte,
    prix_vente: produit.prix_vente,
    montant_total,
    marge_totale,
    date: new Date().toLocaleString("fr-FR"),
  });

  res.status(201).json({
    message: "Vente enregistrée",
    vente,
    alerte_stock_bas: produit.stock <= 5,
  });
});

// ─────────────────────────────────────────
// CHARGES
// ─────────────────────────────────────────
app.get("/api/charges", (req, res) => {
  res.json(db.charges);
});

app.post("/api/charges", async (req, res) => {
  const { label, montant, categorie } = req.body;
  if (!label || montant == null)
    return res.status(400).json({ erreur: "Champs requis : label, montant" });

  const charge = {
    id: genId(),
    label: label.trim(),
    montant: parseFloat(montant),
    categorie: categorie?.trim() || "Autre",
    date: new Date().toISOString(),
  };

  db.charges.push(charge);

  // → Envoyer vers Google Sheets
  await envoyerVersSheets("nouvelle_charge", {
    label: charge.label,
    montant: charge.montant,
    categorie: charge.categorie,
    date: new Date().toLocaleString("fr-FR"),
  });

  res.status(201).json({ message: "Charge enregistrée", charge });
});

app.delete("/api/charges/:id", (req, res) => {
  const idx = db.charges.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erreur: "Charge introuvable" });
  db.charges.splice(idx, 1);
  res.json({ message: "Charge supprimée" });
});

// ─────────────────────────────────────────
// STATS
// ─────────────────────────────────────────
app.get("/api/stats", (req, res) => {
  res.json(getStats());
});

// ─────────────────────────────────────────
// IA — Chat OpenAI
// ─────────────────────────────────────────
app.post("/api/ia/chat", async (req, res) => {
  const { message, historique_conversation } = req.body;
  if (!message) return res.status(400).json({ erreur: "Message requis" });

  const contexte = {
    stats: getStats(),
    produits: db.produits.map((p) => ({
      nom: p.nom,
      categorie: p.categorie,
      prix_achat: p.prix_achat,
      prix_vente: p.prix_vente,
      stock: p.stock,
      marge: calculerMarge(p.prix_achat, p.prix_vente),
    })),
    clients: db.clients.map((c) => ({
      nom: c.nom,
      nb_achats: db.ventes.filter((v) => v.client_id === c.id).length,
      ca_total: db.ventes.filter((v) => v.client_id === c.id).reduce((s, v) => s + v.montant_total, 0),
    })),
    ventes_recentes: db.ventes.slice(0, 10),
    charges: db.charges,
    alertes_stock: getAlertes().map((p) => p.nom),
    ruptures: getRuptures().map((p) => p.nom),
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant commercial expert. Tu analyses les données réelles de l'entreprise et donnes des conseils concrets, chiffrés et actionnables.

Données actuelles :
${JSON.stringify(contexte, null, 2)}

Réponds en français, de façon claire et structurée. Utilise les chiffres exacts des données.`,
        },
        ...(historique_conversation || []),
        { role: "user", content: message },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    });

    res.json({
      reponse: completion.choices[0].message.content,
      tokens_utilises: completion.usage?.total_tokens || 0,
    });
  } catch (err) {
    console.error("Erreur OpenAI :", err.message);
    res.status(500).json({ erreur: "Erreur IA", detail: err.message });
  }
});

// ─────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur démarré : http://localhost:${PORT}`);
  console.log(`🤖 OpenAI connecté (GPT-4o)`);
  console.log(`📊 Google Sheets URL : ${GAS_URL || "non configuré"}\n`);
});