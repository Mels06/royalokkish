const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");
const cors = require("cors");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
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
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const USERS_AUTORISES = [
  process.env.TELEGRAM_USER_ID_1,
  process.env.TELEGRAM_USER_ID_2,
].filter(Boolean);

// ─────────────────────────────────────────
// NODEMAILER — Gmail
// ─────────────────────────────────────────
let transporter = null;

function initEmail() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.log("⚠️ Email non configuré (GMAIL_USER / GMAIL_PASS manquants)");
    return;
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  console.log(`📧 Email configuré : ${process.env.GMAIL_USER}`);
}

// Envoyer la carte fidélité par email
async function envoyerCarteFidelite(client) {
  if (!transporter || !client.email) return false;
  try {
    const logoBase64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH";
    const prenom = client.nom.split(' ')[0];
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #f0f0f0; padding: 30px 20px; }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .header { background: #000; border-radius: 16px 16px 0 0; padding: 36px 36px 28px; text-align: center; }
    .logo-img { width: 68px; height: 68px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto; }
    .brand { color: #C9A84C; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase; }
    .slogan-header { color: #666; font-size: 11px; letter-spacing: 3px; margin-top: 8px; font-style: italic; }
    .separateur { background: linear-gradient(90deg, transparent, #C9A84C, transparent); height: 1px; margin-top: 20px; }
    .body { background: #fff; padding: 44px 40px; }
    .salutation { font-size: 21px; color: #000; font-weight: bold; margin-bottom: 4px; }
    .sous-titre { color: #C9A84C; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-style: italic; margin-bottom: 32px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px; }
    .texte { font-size: 15px; color: #333; line-height: 2; margin-bottom: 28px; }
    .texte strong { color: #000; }
    .encadre { background: #000; border-radius: 12px; padding: 28px 32px; margin: 32px 0; text-align: center; border: 1px solid #222; }
    .encadre-titre { color: #C9A84C; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; }
    .encadre-texte { color: #ccc; font-size: 14px; line-height: 1.9; margin-bottom: 20px; }
    .btn-royal { display: inline-block; background: #C9A84C; color: #000; font-size: 12px; font-weight: bold; padding: 10px 28px; border-radius: 4px; text-decoration: none; letter-spacing: 2px; text-transform: uppercase; }
    .signature { border-top: 1px solid #eee; padding-top: 28px; font-size: 14px; color: #666; line-height: 2; margin-top: 28px; }
    .signature strong { color: #000; font-size: 15px; }
    .signature em { color: #C9A84C; font-size: 13px; }
    .footer { background: #000; border-radius: 0 0 16px 16px; padding: 24px 36px; text-align: center; border-top: 1px solid #C9A84C; }
    .footer-brand { color: #C9A84C; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 10px; }
    .footer-contact { color: #555; font-size: 12px; line-height: 2; }
    .footer-slogan { color: #333; font-size: 11px; font-style: italic; margin-top: 12px; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img class="logo-img" src="data:image/jpeg;base64,${logoBase64}" alt="Royal Tchitchi">
      <div class="brand">Royal Tchitchi</div>
      <div class="slogan-header">Une couronne pour son altesse</div>
      <div class="separateur"></div>
    </div>
    <div class="body">
      <div class="salutation">Votre Altesse, ${prenom},</div>
      <div class="sous-titre">Bienvenue dans le Royaume Royal Tchitchi</div>
      <div class="texte">
        C'est avec grand honneur que le Royaume Royal Tchitchi vous accueille parmi ses <strong>clients privilégiés</strong>.<br><br>
        En signe de notre reconnaissance, voici votre <strong>carte fidélité personnelle</strong> — un passeport vers un univers de prestige et d'élégance.
      </div>
      <div class="encadre">
        <div class="encadre-titre">👑 Votre Carte Fidélité</div>
        <div class="encadre-texte">
          <strong style="color:#C9A84C;">${client.nom}</strong><br>
          ${client.telephone ? '📱 ' + client.telephone + '<br>' : ''}
          ${client.email ? '📧 ' + client.email + '<br>' : ''}
          <br>
          <span style="color:#888; font-size:12px;">N° ${client.id.toUpperCase()} · Émise le ${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
        <div style="background:#C9A84C; color:#000; font-size:12px; font-weight:bold; padding:10px 24px; border-radius:4px; display:inline-block; letter-spacing:2px; margin-top:4px;">
          🎁 -10% DÈS LE 2ÈME ACHAT
        </div>
      </div>
      <div class="texte">
        Dès votre <strong>2ème achat</strong>, bénéficiez automatiquement de <strong>-10%</strong> sur toutes vos commandes — sans rien demander. Un privilège réservé à nos membres les plus fidèles.
      </div>
      <div class="signature">
        Avec toute notre considération royale,<br><br>
        <strong>L'équipe Royal Tchitchi</strong><br>
        <em>Une couronne pour son altesse</em>
      </div>
    </div>
    <div class="footer">
      <div class="footer-brand">Royal Tchitchi</div>
      <div class="footer-contact">
        📱 +229 0197249171<br>
        📧 royaltchitchi@gmail.com
      </div>
      <div class="footer-slogan">— Une couronne pour son altesse —</div>
    </div>
  </div>
</body>
</html>\`;
    await transporter.sendMail({
      from: \`"Royal Tchitchi 👑" <\${process.env.GMAIL_USER}>\`,
      to: client.email,
      subject: \`👑 Bienvenue dans le Royaume, \${prenom} — Votre carte fidélité\`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Erreur envoi carte fidélité :", err.message);
    return false;
  }
}

// ─────────────────────────────────────────
// EMAIL DE RELANCE CLIENT
// ─────────────────────────────────────────
async function envoyerEmailRelance(client) {
  if (!transporter || !client.email) return false;
  try {
    const logoBase64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH";
    const prenom = client.nom.split(' ')[0];
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #f0f0f0; padding: 30px 20px; }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .header { background: #000; border-radius: 16px 16px 0 0; padding: 36px 36px 28px; text-align: center; }
    .logo-img { width: 68px; height: 68px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto; }
    .brand { color: #C9A84C; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase; }
    .slogan-header { color: #666; font-size: 11px; letter-spacing: 3px; margin-top: 8px; font-style: italic; }
    .separateur { background: linear-gradient(90deg, transparent, #C9A84C, transparent); height: 1px; margin-top: 20px; }
    .body { background: #fff; padding: 44px 40px; }
    .salutation { font-size: 21px; color: #000; font-weight: bold; margin-bottom: 4px; }
    .sous-titre { color: #C9A84C; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-style: italic; margin-bottom: 32px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px; }
    .texte { font-size: 15px; color: #333; line-height: 2; margin-bottom: 28px; }
    .texte strong { color: #000; }
    .encadre { background: #000; border-radius: 12px; padding: 28px 32px; margin: 32px 0; text-align: center; border: 1px solid #222; }
    .encadre-titre { color: #C9A84C; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; }
    .encadre-texte { color: #ccc; font-size: 14px; line-height: 1.9; margin-bottom: 20px; }
    .signature { border-top: 1px solid #eee; padding-top: 28px; font-size: 14px; color: #666; line-height: 2; margin-top: 28px; }
    .signature strong { color: #000; font-size: 15px; }
    .signature em { color: #C9A84C; font-size: 13px; }
    .footer { background: #000; border-radius: 0 0 16px 16px; padding: 24px 36px; text-align: center; border-top: 1px solid #C9A84C; }
    .footer-brand { color: #C9A84C; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 10px; }
    .footer-contact { color: #555; font-size: 12px; line-height: 2; }
    .footer-slogan { color: #333; font-size: 11px; font-style: italic; margin-top: 12px; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img class="logo-img" src="data:image/jpeg;base64,${logoBase64}" alt="Royal Tchitchi">
      <div class="brand">Royal Tchitchi</div>
      <div class="slogan-header">Une couronne pour son altesse</div>
      <div class="separateur"></div>
    </div>
    <div class="body">
      <div class="salutation">Votre Altesse, ${prenom},</div>
      <div class="sous-titre">Message du Royaume Royal Tchitchi</div>
      <div class="texte">
        Le Royaume Royal Tchitchi a l'honneur de vous informer que notre écrin de prestige
        vient de s'enrichir d'une <strong>nouvelle collection exclusive</strong>.<br><br>
        Des créations soigneusement sélectionnées, dignes des regards les plus raffinés —
        car chez Royal Tchitchi, chaque paire de lunettes est bien plus qu'un accessoire :
        <strong><em>c'est une couronne que l'on pose sur son visage</em></strong>.
      </div>
      <div class="encadre">
        <div class="encadre-titre">✨ Nouvelle Collection</div>
        <div class="encadre-texte">
          Montures tendance, lunettes de soleil de prestige,<br>
          étuis sur mesure — tout pour sublimer votre regard royal.
        </div>
        <a href="https://photos.app.goo.gl/5F9nje2GwMZpujTw7"
           style="display:inline-block; background:#C9A84C; color:#000; font-size:12px; font-weight:bold; padding:10px 28px; border-radius:4px; text-decoration:none; letter-spacing:2px; text-transform:uppercase;">
          👑 Découvrir la collection
        </a>
      </div>
      <div class="texte">
        Nous serions ravis de vous accueillir à nouveau et de vous faire découvrir
        nos dernières acquisitions. <strong>Votre satisfaction reste notre priorité absolue.</strong>
      </div>
      <div class="signature">
        Avec toute notre considération royale,<br><br>
        <strong>L'équipe Royal Tchitchi</strong><br>
        <em>Une couronne pour son altesse</em>
      </div>
    </div>    <div class="footer">
      <div class="footer-brand">Royal Tchitchi</div>
      <div class="footer-contact">📱 +229 0197249171<br>📧 royaltchitchi@gmail.com</div>
      <div class="footer-slogan">— Une couronne pour son altesse —</div>
    </div>  </div>
</body>
</html>\`;
    await transporter.sendMail({
      from: \`"Royal Tchitchi 👑" <\${process.env.GMAIL_USER}>\`,
      to: client.email,
      subject: \`👑 \${prenom}, le Royaume Royal Tchitchi vous convie\`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Erreur email relance :", err.message);
    return false;
  }
}

// Envoyer notification de réduction appliquée
async function envoyerEmailReduction(client, vente, montantAvant, reduction) {
  if (!transporter || !client.email) return;
  try {
    const logoBase64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH";
    const prenom = client.nom.split(' ')[0];
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #f0f0f0; padding: 30px 20px; }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .header { background: #000; border-radius: 16px 16px 0 0; padding: 36px 36px 28px; text-align: center; }
    .logo-img { width: 68px; height: 68px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto; }
    .brand { color: #C9A84C; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase; }
    .slogan-header { color: #666; font-size: 11px; letter-spacing: 3px; margin-top: 8px; font-style: italic; }
    .separateur { background: linear-gradient(90deg, transparent, #C9A84C, transparent); height: 1px; margin-top: 20px; }
    .body { background: #fff; padding: 44px 40px; }
    .salutation { font-size: 21px; color: #000; font-weight: bold; margin-bottom: 4px; }
    .sous-titre { color: #C9A84C; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-style: italic; margin-bottom: 32px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px; }
    .texte { font-size: 15px; color: #333; line-height: 2; margin-bottom: 28px; }
    .texte strong { color: #000; }
    .encadre { background: #000; border-radius: 12px; padding: 28px 32px; margin: 32px 0; text-align: center; border: 1px solid #222; }
    .encadre-titre { color: #C9A84C; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; }
    .encadre-texte { color: #ccc; font-size: 14px; line-height: 1.9; margin-bottom: 20px; }
    .signature { border-top: 1px solid #eee; padding-top: 28px; font-size: 14px; color: #666; line-height: 2; margin-top: 28px; }
    .signature strong { color: #000; font-size: 15px; }
    .signature em { color: #C9A84C; font-size: 13px; }
    .footer { background: #000; border-radius: 0 0 16px 16px; padding: 24px 36px; text-align: center; border-top: 1px solid #C9A84C; }
    .footer-brand { color: #C9A84C; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 10px; }
    .footer-contact { color: #555; font-size: 12px; line-height: 2; }
    .footer-slogan { color: #333; font-size: 11px; font-style: italic; margin-top: 12px; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img class="logo-img" src="data:image/jpeg;base64,${logoBase64}" alt="Royal Tchitchi">
      <div class="brand">Royal Tchitchi</div>
      <div class="slogan-header">Une couronne pour son altesse</div>
      <div class="separateur"></div>
    </div>
    <div class="body">
      <div class="salutation">Votre Altesse, ${prenom},</div>
      <div class="sous-titre">Votre réduction fidélité a été appliquée</div>
      <div class="texte">
        Le Royaume Royal Tchitchi vous remercie pour votre fidélité. En tant que membre privilégié, votre <strong>réduction de 10%</strong> a été appliquée automatiquement sur votre dernier achat.
      </div>
      <div class="encadre">
        <div class="encadre-titre">🎁 Récapitulatif de votre achat</div>
        <div class="encadre-texte">
          <span style="text-decoration:line-through; color:#666; font-size:13px;">Prix initial : ${montantAvant} FCFA</span><br>
          <span style="color:#C9A84C; font-size:26px; font-weight:bold;">${vente.montant_total} FCFA</span><br>
          <span style="color:#fff; font-size:13px; margin-top:4px; display:block;">Vous avez économisé : <strong style="color:#C9A84C;">${reduction} FCFA</strong></span>
        </div>
        <div style="background:#111; border-radius:8px; padding:12px 20px; margin-top:8px; font-size:13px; color:#aaa; text-align:left; line-height:2;">
          • Produit : <span style="color:#fff;">${vente.produit_nom}</span><br>
          • Quantité : <span style="color:#fff;">${vente.quantite}</span><br>
          • Prix unitaire : <span style="color:#fff;">${vente.prix_vente_unitaire} FCFA</span><br>
          • Date : <span style="color:#fff;">${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <div class="texte">
        Cette réduction est un privilège exclusif réservé à nos membres fidèles. Nous vous remercions de faire confiance au Royaume Royal Tchitchi.
      </div>
      <div class="signature">
        Avec toute notre considération royale,<br><br>
        <strong>L'équipe Royal Tchitchi</strong><br>
        <em>Une couronne pour son altesse</em>
      </div>
    </div>    <div class="footer">
      <div class="footer-brand">Royal Tchitchi</div>
      <div class="footer-contact">📱 +229 0197249171<br>📧 royaltchitchi@gmail.com</div>
      <div class="footer-slogan">— Une couronne pour son altesse —</div>
    </div>  </div>
</body>
</html>\`;
    await transporter.sendMail({
      from: \`"Royal Tchitchi 👑" <\${process.env.GMAIL_USER}>\`,
      to: client.email,
      subject: \`🎁 Votre réduction fidélité -10% appliquée, \${prenom} !\`,
      html,
    });
  } catch (err) {
    console.error("Erreur email réduction :", err.message);
  }
}

// ─────────────────────────────────────────
// GOOGLE CALENDAR
// ─────────────────────────────────────────
let calendar = null;

function initGoogleCalendar() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/calendar"] });
    calendar = google.calendar({ version: "v3", auth });
    console.log("📅 Google Calendar connecté !");
  } catch (err) {
    console.error("❌ Google Calendar :", err.message);
  }
}

async function creerEventGoogleCalendar(titre, dateISO) {
  console.log("📅 Tentative ajout agenda : " + titre + " — " + dateISO);
  console.log("📅 calendar initialisé : " + !!calendar + " | CALENDAR_ID : " + (CALENDAR_ID || "MANQUANT"));
  if (!calendar || !CALENDAR_ID) {
    console.error("❌ Calendar non prêt — calendar: " + !!calendar + " | CALENDAR_ID: " + CALENDAR_ID);
    return null;
  }
  try {
    const dateDebut = new Date(dateISO);
    const dateFin = new Date(dateDebut.getTime() + 60 * 60 * 1000);
    console.log("📅 Début : " + dateDebut.toISOString() + " | Fin : " + dateFin.toISOString());
    const event = {
      summary: titre,
      start: { dateTime: dateDebut.toISOString(), timeZone: "Africa/Porto-Novo" },
      end: { dateTime: dateFin.toISOString(), timeZone: "Africa/Porto-Novo" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }, { method: "popup", minutes: 60 }, { method: "popup", minutes: 30 }, { method: "email", minutes: 24 * 60 }] },
    };
    const response = await calendar.events.insert({ calendarId: CALENDAR_ID, resource: event });
    console.log("✅ Événement Google Calendar créé : " + response.data.id);
    return response.data;
  } catch (err) {
    console.error("❌ Erreur Calendar : " + err.message);
    if (err.response) console.error("❌ Réponse API : " + JSON.stringify(err.response.data));
    return null;
  }
}

async function supprimerEventGoogleCalendar(googleEventId) {
  if (!calendar || !CALENDAR_ID || !googleEventId) return;
  try { await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: googleEventId }); }
  catch (err) { console.error("Erreur suppression Calendar :", err.message); }
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
  agenda: [],
  relances: [],   // { id, client_nom, client_tel, note, date, chatId, rappels_envoyes, statut }
  livraisons: [], // { id, client_nom, client_tel, produit, note, date, chatId, rappels_envoyes, statut }
};

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
  return { marge: parseFloat(marge.toFixed(0)), taux: parseFloat(taux) };
}

function getAlertes() { return db.produits.filter(p => p.stock <= 5 && p.stock > 0); }
function getRuptures() { return db.produits.filter(p => p.stock === 0); }

function getStats() {
  const ca = db.ventes.reduce((s, v) => s + v.montant_total, 0);
  const cout_achats = db.ventes.reduce((s, v) => s + v.prix_achat_unitaire * v.quantite, 0);
  const total_charges = db.charges.reduce((s, c) => s + c.montant, 0);
  return {
    ca: parseFloat(ca.toFixed(0)),
    cout_achats: parseFloat(cout_achats.toFixed(0)),
    benefice_brut: parseFloat((ca - cout_achats).toFixed(0)),
    benefice_net: parseFloat((ca - cout_achats - total_charges).toFixed(0)),
    total_charges: parseFloat(total_charges.toFixed(0)),
    nb_produits: db.produits.length,
    nb_clients: db.clients.length,
    nb_ventes: db.ventes.length,
    alertes_stock: getAlertes().length,
    ruptures: getRuptures().length,
  };
}

async function envoyerVersSheets(action, data) {
  if (!GAS_URL) return;
  try { await axios.post(GAS_URL, { action, ...data }); }
  catch (err) { console.error("Erreur Sheets :", err.message); }
}

// ─────────────────────────────────────────
// CHARGER LES DONNÉES DEPUIS GOOGLE SHEETS AU DÉMARRAGE
// ─────────────────────────────────────────
async function chargerDepuisSheets() {
  if (!GAS_URL) { console.log("⚠️ GAS_URL non configuré — démarrage à vide"); return; }
  try {
    console.log("📊 Chargement des données depuis Google Sheets...");
    const resp = await axios.get(GAS_URL + "?action=lire_tout");
    const { status, data } = resp.data;

    if (status !== "ok" || !data) {
      console.log("⚠️ Sheets vide ou erreur — démarrage à vide");
      return;
    }

    // Charger produits
    if (data.produits && data.produits.length > 0) {
      db.produits = data.produits;
      console.log(`✅ ${db.produits.length} produit(s) chargé(s)`);
    }

    // Charger clients
    if (data.clients && data.clients.length > 0) {
      db.clients = data.clients;
      console.log(`✅ ${db.clients.length} client(s) chargé(s)`);
    }

    // Charger ventes
    if (data.ventes && data.ventes.length > 0) {
      db.ventes = data.ventes;
      console.log(`✅ ${db.ventes.length} vente(s) chargée(s)`);
    }

    // Charger charges
    if (data.charges && data.charges.length > 0) {
      db.charges = data.charges;
      console.log(`✅ ${db.charges.length} charge(s) chargée(s)`);
    }

    // Charger agenda
    if (data.agenda && data.agenda.length > 0) {
      // Récupérer le chatId depuis les événements existants en mémoire si possible
      // Sinon on met le chatId des utilisateurs autorisés
      db.agenda = data.agenda.map(e => ({
        ...e,
        chatId: e.chatId || USERS_AUTORISES[0] || null,
        rappels_envoyes: e.rappels_envoyes || [],
        googleEventId: e.googleEventId || null,
      }));
      console.log(`✅ ${db.agenda.length} événement(s) chargé(s)`);
    }

    if (data.relances && data.relances.length > 0) {
      db.relances = data.relances.map(r => ({ ...r, chatId: r.chatId || USERS_AUTORISES[0] || null, rappels_envoyes: [] }));
      console.log(`✅ ${db.relances.length} relance(s) chargée(s)`);
    }

    if (data.livraisons && data.livraisons.length > 0) {
      db.livraisons = data.livraisons.map(l => ({ ...l, chatId: l.chatId || USERS_AUTORISES[0] || null, rappels_envoyes: [] }));
      console.log(`✅ ${db.livraisons.length} livraison(s) chargée(s)`);
    }

    console.log("✅ Données rechargées depuis Google Sheets !");
  } catch (err) {
    console.error("❌ Erreur chargement Sheets :", err.message);
    console.log("⚠️ Démarrage à vide");
  }
}

// ─────────────────────────────────────────
// FIDÉLITÉ — Paliers progressifs
// ─────────────────────────────────────────
// 1er achat → plein
// 2ème achat → -5%
// 3ème achat → -8%
// 4ème achat → -10%
// 5ème+ achat → -10% permanent

function getTauxReduction(nb_achats) {
  if (nb_achats === 1) return 0.05; // 2ème achat
  if (nb_achats === 2) return 0.08; // 3ème achat
  if (nb_achats >= 3) return 0.10;  // 4ème achat et +
  return 0; // 1er achat = plein tarif
}

function getLabelReduction(nb_achats) {
  if (nb_achats === 1) return "-5%";
  if (nb_achats === 2) return "-8%";
  if (nb_achats >= 3) return "-10%";
  return null;
}

function clientEligibleReduction(client) {
  return client.nb_achats >= 1; // Éligible dès le 2ème achat
}

function appliquerReduction(prix, nb_achats) {
  const taux = getTauxReduction(nb_achats);
  return parseFloat((prix * (1 - taux)).toFixed(0));
}

// Compat ancienne signature
const ACHAT_REDUCTION = 1;
const TAUX_REDUCTION = 0.10;

// Trouver ou créer un client (avec fidélité)
function trouverOuCreerClient(info) {
  if (!info) return null;
  const recherche = info.toLowerCase().trim();
  let client = db.clients.find(c =>
    c.nom.toLowerCase().includes(recherche) ||
    (c.telephone && c.telephone.includes(recherche)) ||
    (c.email && c.email.toLowerCase().includes(recherche))
  );
  if (!client) {
    client = {
      id: genId(), nom: info.trim(), email: "", telephone: "",
      note: "Créé via vente", nb_achats: 0, ca_total: 0,
      carte_envoyee: false, cree_le: new Date().toISOString(),
    };
    db.clients.push(client);
    envoyerVersSheets("nouveau_client", { nom: client.nom, email: "", telephone: "", note: client.note, date: new Date().toLocaleString("fr-FR") });
  }
  return client;
}

// Enregistrer une vente avec gestion fidélité
// Vérifie si un produit est une paire de lunettes
function estDesLunettes(nomProduit) {
  const mots = ["lunette", "lunettes", "monture", "solaire", "solaires", "optique", "vue"];
  return mots.some(m => nomProduit.toLowerCase().includes(m));
}

// Trouver l'étui dans le stock
function trouverEtui() {
  return db.produits.find(p =>
    p.nom.toLowerCase().includes("etui") ||
    p.nom.toLowerCase().includes("étui") ||
    p.nom.toLowerCase().includes("housse") ||
    p.nom.toLowerCase().includes("case")
  );
}

// Offrir l'étui automatiquement (déduire du stock sans facturer)
function offrirEtui(qte, clientNom) {
  const etui = trouverEtui();
  if (!etui) return null;
  if (etui.stock < qte) return { nom: etui.nom, erreur: "stock insuffisant", stock: etui.stock };

  const avant = etui.stock;
  etui.stock -= qte;

  db.historique_stock.unshift({
    id: genId(), produit_id: etui.id, produit_nom: etui.nom,
    operation: "remove", quantite: qte, stock_avant: avant, stock_apres: etui.stock,
    note: "Étui offert avec lunettes — " + clientNom,
    date: new Date().toISOString(),
  });

  envoyerVersSheets("mouvement_stock", {
    produit: etui.nom, operation: "remove", quantite: qte,
    stock_avant: avant, stock_apres: etui.stock,
    note: "Offert avec lunettes — " + clientNom,
    date: new Date().toLocaleString("fr-FR"),
  });

  return { nom: etui.nom, stock_restant: etui.stock, alerte: etui.stock <= 5 };
}

async function enregistrerVenteComplete(produitNom, qte, clientInfo, prixVenteOverride = null) {
  const produit = db.produits.find(p => p.nom.toLowerCase().includes(produitNom.toLowerCase()));
  if (!produit) return { erreur: `Produit "${produitNom}" introuvable` };
  if (produit.stock < qte) return { erreur: `Stock insuffisant pour ${produit.nom} (dispo: ${produit.stock})` };

  const client = clientInfo ? trouverOuCreerClient(clientInfo) : null;

  // Appliquer réduction fidélité si éligible
  let prixVente = prixVenteOverride || produit.prix_vente;
  let reductionAppliquee = false;
  let montantAvant = 0;
  let montantReduction = 0;

  if (client && clientEligibleReduction(client)) {
    montantAvant = parseFloat((prixVente * qte).toFixed(0));
    prixVente = appliquerReduction(prixVente, client.nb_achats);
    reductionAppliquee = true;
    montantReduction = montantAvant - parseFloat((prixVente * qte).toFixed(0));
  }

  const avant = produit.stock;
  produit.stock -= qte;

  const montant_total = parseFloat((prixVente * qte).toFixed(0));
  const marge_totale = parseFloat(((prixVente - produit.prix_achat) * qte).toFixed(0));

  const vente = {
    id: genId(),
    client_id: client ? client.id : null,
    client_nom: client ? client.nom : "Anonyme",
    produit_id: produit.id,
    produit_nom: produit.nom,
    prix_achat_unitaire: produit.prix_achat,
    prix_vente_unitaire: prixVente,
    quantite: qte,
    montant_total,
    marge_totale,
    reduction_appliquee: reductionAppliquee,
    date: new Date().toISOString(),
  };

  db.ventes.unshift(vente);

  db.historique_stock.unshift({
    id: genId(), produit_id: produit.id, produit_nom: produit.nom,
    operation: "remove", quantite: qte, stock_avant: avant, stock_apres: produit.stock,
    note: `Vente — ${vente.client_nom}`, date: new Date().toISOString(),
  });

  // Mettre à jour compteur fidélité client
  if (client) {
    client.nb_achats += 1;
    client.ca_total += montant_total;
    client.derniere_visite = new Date().toISOString();

    // Envoyer email notification réduction
    if (reductionAppliquee && client.email) {
      await envoyerEmailReduction(client, vente, montantAvant, montantReduction);
    }
  }

  envoyerVersSheets("nouvelle_vente", {
    client: vente.client_nom, produit: produit.nom, quantite: qte,
    prix_vente: prixVente, montant_total, marge_totale,
    reduction: reductionAppliquee ? "Oui -10%" : "Non",
    date: new Date().toLocaleString("fr-FR"),
  });

  // Offrir étui automatiquement si c'est une vente de lunettes
  let etuiOffert = null;
  if (estDesLunettes(produit.nom)) {
    etuiOffert = offrirEtui(qte, client ? client.nom : "Anonyme");
  }

  const labelReduction = reductionAppliquee && client ? getLabelReduction(client.nb_achats - 1) : null;
  return { vente, produit, client, alerte: produit.stock <= 5, reductionAppliquee, montantReduction, etuiOffert, labelReduction };
}

// ─────────────────────────────────────────
// FINALISER UNE VENTE (partagé entre vente_client et nouveau_client)
// ─────────────────────────────────────────
async function finaliserVente(chatId, session, clientNom) {
  const result = await enregistrerVenteComplete(session.data.produit.nom, session.data.quantite, clientNom);
  session.etape = null; session.data = {};
  if (result.erreur) return sendMessage(chatId, `❌ ${result.erreur}`, { reply_markup: menuVentes() });
  let rep = `✅ *Vente enregistrée !*\n🛒 ${result.vente.produit_nom} x${result.vente.quantite}\n👤 ${result.vente.client_nom}\n💰 *${result.vente.montant_total} FCFA*\n📈 Marge: ${result.vente.marge_totale} FCFA\n📦 Restant: ${result.produit.stock}`;
  if (result.reductionAppliquee) rep += `\n\n🎁 *Réduction fidélité ${result.labelReduction || ''} appliquée !*\n💸 Économie : ${result.montantReduction} FCFA`;
  if (result.etuiOffert) {
    if (result.etuiOffert.erreur) {
      rep += `\n\n⚠️ *Étui non inclus* — stock insuffisant (${result.etuiOffert.stock} dispo)`;
    } else {
      rep += `\n\n🕶️ *Étui offert !* — ${result.etuiOffert.nom} déduit du stock`;
      if (result.etuiOffert.alerte) rep += `\n⚠️ Stock étuis bas (${result.etuiOffert.stock_restant} restant(s))`;
    }
  }
  if (result.alerte) rep += `\n\n⚠️ *Stock lunettes bas !*`;
  return sendMessage(chatId, rep, { reply_markup: menuVentes() });
}

// ─────────────────────────────────────────
// AGENDA
// ─────────────────────────────────────────
async function parserDateNaturelle(texte) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: `Aujourd'hui : ${new Date().toISOString()} (fuseau horaire : Bénin UTC+1, Africa/Porto-Novo)\nExtrait le titre et la date/heure de cet événement : "${texte}"\nRéponds UNIQUEMENT avec ce JSON : {"titre":"nom de l'événement","date":"2025-01-15T10:00:00"}\nRègles : utilise le fuseau Bénin (UTC+1). Si date impossible, mets "date":null.` }],
      max_tokens: 100, temperature: 0,
    });
    return JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

function formatDateFR(isoDate) {
  const d = new Date(isoDate);
  const jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const mois = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} à ${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
}

function calculerRappels(dateEvent) {
  const d = new Date(dateEvent);
  const matin = new Date(d);
  matin.setHours(8, 0, 0, 0);
  if (matin >= d) matin.setDate(matin.getDate() - 1);
  return [
    { type: "1j",    time: new Date(d.getTime() - 24 * 60 * 60 * 1000), label: "⏰ Rappel J-1 — demain !" },
    { type: "matin", time: matin,                                         label: "🌅 Rappel matin" },
    { type: "1h",    time: new Date(d.getTime() - 60 * 60 * 1000),       label: "⏱️ Rappel dans 1h" },
    { type: "30min", time: new Date(d.getTime() - 30 * 60 * 1000),       label: "🔔 Dans 30 min !" },
    { type: "heure", time: new Date(d.getTime()),                         label: "🚨 C'est maintenant !" },
  ];
}

function demarrerRappels() {
  // Vérification rappels toutes les 30 secondes
  setInterval(async () => {
    const maintenant = new Date();
    for (const event of db.agenda) {
      if (new Date(event.date) < maintenant) continue;
      const rappels = calculerRappels(event.date);
      for (const rappel of rappels) {
        if (event.rappels_envoyes.includes(rappel.type)) continue;
        const diff = rappel.time.getTime() - maintenant.getTime();
        // Fenêtre élargie à 90 secondes pour ne rien rater
        if (diff >= -90000 && diff <= 90000) {
          console.log(`🔔 Envoi rappel "${rappel.label}" pour "${event.titre}"`);
          await sendMessage(event.chatId, `${rappel.label}\n\n📅 *${event.titre}*\n🕐 ${formatDateFR(event.date)}`);
          event.rappels_envoyes.push(rappel.type);
        }
      }
    }
    // Nettoyer les événements passés depuis plus de 24h
    db.agenda = db.agenda.filter(e => new Date(e.date).getTime() > Date.now() - 24 * 60 * 60 * 1000);

    // Rappels relances
    for (const relance of db.relances) {
      if (relance.statut === "✅ Fait" || new Date(relance.date) < maintenant) continue;
      const rappels = calculerRappels(relance.date);
      for (const rappel of rappels) {
        if (relance.rappels_envoyes.includes(rappel.type)) continue;
        const diff = rappel.time.getTime() - maintenant.getTime();
        if (diff >= -90000 && diff <= 90000) {
          await sendMessage(relance.chatId, `${rappel.label} — Relance client\n\n📞 *${relance.client_nom}*${relance.client_tel ? "\n📱 " + relance.client_tel : ""}${relance.note ? "\n📝 " + relance.note : ""}\n🕐 ${formatDateFR(relance.date)}`);
          relance.rappels_envoyes.push(rappel.type);
        }
      }
    }

    // Rappels livraisons
    for (const livraison of db.livraisons) {
      if (livraison.statut === "✅ Livré" || new Date(livraison.date) < maintenant) continue;
      const rappels = calculerRappels(livraison.date);
      for (const rappel of rappels) {
        if (livraison.rappels_envoyes.includes(rappel.type)) continue;
        const diff = rappel.time.getTime() - maintenant.getTime();
        if (diff >= -90000 && diff <= 90000) {
          await sendMessage(livraison.chatId, `${rappel.label} — Livraison\n\n🚚 *${livraison.client_nom}*${livraison.client_tel ? "\n📱 " + livraison.client_tel : ""}${livraison.produit ? "\n🛒 " + livraison.produit : ""}${livraison.note ? "\n📝 " + livraison.note : ""}\n🕐 ${formatDateFR(livraison.date)}`);
          livraison.rappels_envoyes.push(rappel.type);
        }
      }
    }
  }, 30000);

  // Auto-ping toutes les 10 minutes pour garder Render éveillé
  setInterval(async () => {
    try {
      await axios.get(RENDER_URL + "/ping");
      console.log("🏓 Ping Render OK");
    } catch (err) {
      console.log("🏓 Ping Render :", err.message);
    }
  }, 10 * 60 * 1000);

  console.log("🔔 Rappels démarrés (intervalle 30s) + auto-ping 10min");
}

// ─────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────
async function sendMessage(chatId, text, options = {}) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text, parse_mode: "Markdown", ...options });
  } catch (err) { console.error("Erreur sendMessage :", err.message); }
}

function menuPrincipal() {
  return { keyboard: [["📦 Produits", "👥 Clients"], ["💰 Ventes", "📊 Charges"], ["📈 Stats", "🚨 Alertes"], ["📅 Agenda", "🎁 Fidélité"], ["🤖 IA"]], resize_keyboard: true };
}
function menuProduits() { return { keyboard: [["➕ Ajouter produit"], ["📋 Voir stock", "🔄 Restock"], ["🏠 Menu"]], resize_keyboard: true }; }
function menuClients() { return { keyboard: [["➕ Ajouter client", "🔍 Rechercher client"], ["📋 Voir clients"], ["📞 Clients à relancer", "🚚 Commandes à livrer"], ["🏠 Menu"]], resize_keyboard: true }; }
function menuVentes() { return { keyboard: [["➕ Vente rapide", "📝 Vente texte"], ["📋 Voir ventes"], ["🏠 Menu"]], resize_keyboard: true }; }
function menuAgenda() { return { keyboard: [["➕ Ajouter événement"], ["📋 Voir agenda", "🗑️ Supprimer événement"], ["🏠 Menu"]], resize_keyboard: true }; }
function menuFidelite() { return { keyboard: [["📋 Voir membres fidélité"], ["🏆 Top clients"], ["🔄 Clients récurrents", "😴 Clients inactifs"], ["📧 Renvoyer carte fidélité"], ["🏠 Menu"]], resize_keyboard: true }; }
function menuIA() { return { keyboard: [["📊 Analyse rentabilité"], ["🚨 Produits à restock"], ["💡 Conseils CA"], ["❓ Question libre"], ["🏠 Menu"]], resize_keyboard: true }; }

// ─────────────────────────────────────────
// WEBHOOK TELEGRAM
// ─────────────────────────────────────────
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id.toString();
  const userId = msg.from.id.toString();
  const text = msg.text || "";
  const photo = msg.photo;

  if (USERS_AUTORISES.length > 0 && !USERS_AUTORISES.includes(userId))
    return sendMessage(chatId, "⛔ Accès non autorisé.");

  if (!sessions[chatId]) sessions[chatId] = { etape: null, data: {} };
  const session = sessions[chatId];

  if (text === "❌ Annuler" || text === "🏠 Menu") {
    session.etape = null; session.data = {};
    return sendMessage(chatId, `🏠 *Menu principal*`, { reply_markup: menuPrincipal() });
  }

  if (text === "/start") {
    session.etape = null; session.data = {};
    return sendMessage(chatId, `👋 Bonjour ! Je suis votre *Bot Commercial Royal Tchitchi* 🛍️\n\nChoisissez une option :`, { reply_markup: menuPrincipal() });
  }

  // ══ PRODUITS ══
  if (text === "📦 Produits") return sendMessage(chatId, `📦 *PRODUITS*`, { reply_markup: menuProduits() });

  if (text === "📋 Voir stock") {
    if (db.produits.length === 0) return sendMessage(chatId, `📦 Aucun produit.`, { reply_markup: menuProduits() });
    let m = `📦 *STOCK ACTUEL*\n\n`;
    db.produits.forEach(p => { const s = p.stock === 0 ? "🔴" : p.stock <= 5 ? "🟡" : "🟢"; m += `${s} *${p.nom}* — ${p.stock} unités\n   Achat: ${p.prix_achat} FCFA | Vente: ${p.prix_vente} FCFA\n`; });
    return sendMessage(chatId, m, { reply_markup: menuProduits() });
  }

  if (text === "🔄 Restock") {
    if (db.produits.length === 0) return sendMessage(chatId, `📦 Aucun produit.`, { reply_markup: menuProduits() });
    session.etape = "restock_produit"; session.data = {};
    const b = db.produits.map(p => [`${p.nom} (stock: ${p.stock})`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `🔄 Choisissez le produit :`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  if (text === "➕ Ajouter produit") {
    session.etape = "produit_nom"; session.data = {};
    return sendMessage(chatId, `📦 *Nouveau produit*\n\nNom :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }

  // ══ CLIENTS ══
  if (text === "👥 Clients") return sendMessage(chatId, `👥 *CLIENTS*`, { reply_markup: menuClients() });

  if (text === "📋 Voir clients") {
    if (db.clients.length === 0) return sendMessage(chatId, `👥 Aucun client.`, { reply_markup: menuClients() });
    let m = `👥 *CLIENTS (${db.clients.length})*\n\n`;
    db.clients.forEach(c => {
      const badge = c.nb_achats >= ACHAT_REDUCTION ? "⭐" : "🆕";
      m += `${badge} *${c.nom}*${c.telephone ? ` | 📱 ${c.telephone}` : ""}\n`;
      m += `   🛒 ${c.nb_achats} achat(s) — ${c.ca_total} FCFA`;
      m += c.nb_achats >= ACHAT_REDUCTION ? ` | 🎁 -10%\n\n` : `\n\n`;
    });
    return sendMessage(chatId, m, { reply_markup: menuClients() });
  }

  if (text === "➕ Ajouter client") {
    session.etape = "client_nom"; session.data = {};
    return sendMessage(chatId, `👥 *Nouveau client*\n\nNom complet :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }

  if (text === "🔍 Rechercher client") {
    session.etape = "recherche_client";
    return sendMessage(chatId, `🔍 Nom, prénom ou téléphone :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }

  // ══ RELANCES ══
  if (text === "📞 Clients à relancer") {
    if (db.relances.length === 0) {
      session.etape = "relance_client_nom"; session.data = { type: "relance" };
      return sendMessage(chatId, `📞 *Aucune relance programmée*

Ajouter un client à relancer ?

Nom du client :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
    }
    const futures = db.relances.filter(r => r.statut !== "✅ Fait").sort((a,b) => new Date(a.date) - new Date(b.date));
    let m = `📞 *CLIENTS À RELANCER (${futures.length})*

`;
    futures.forEach((r, i) => {
      m += `${i+1}. 👤 *${r.client_nom}*
`;
      if (r.client_tel) m += `   📱 ${r.client_tel}
`;
      m += `   📅 ${formatDateFR(r.date)}
`;
      if (r.note) m += `   📝 ${r.note}
`;
      m += "
";
    });
    return sendMessage(chatId, m, { reply_markup: { keyboard: [["➕ Ajouter relance"], ["🗑️ Marquer fait (relance)"], ["🏠 Menu"]], resize_keyboard: true } });
  }

  if (text === "➕ Ajouter relance") {
    session.etape = "relance_client_nom"; session.data = { type: "relance" };
    return sendMessage(chatId, `📞 *Nouvelle relance*

Nom du client :`, { reply_markup: { keyboard: db.clients.map(c => [c.nom]).concat([["❌ Annuler"]]), resize_keyboard: true } });
  }

  if (text === "🗑️ Marquer fait (relance)") {
    const futures = db.relances.filter(r => r.statut !== "✅ Fait");
    if (futures.length === 0) return sendMessage(chatId, `📞 Aucune relance en attente.`, { reply_markup: menuClients() });
    session.etape = "relance_marquer_fait";
    const b = futures.map((r,i) => [`${i+1}. ${r.client_nom} — ${formatDateFR(r.date)}`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `✅ Quelle relance marquer comme faite ?`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  // ══ LIVRAISONS ══
  if (text === "🚚 Commandes à livrer") {
    if (db.livraisons.length === 0) {
      session.etape = "livraison_client_nom"; session.data = { type: "livraison" };
      return sendMessage(chatId, `🚚 *Aucune livraison programmée*

Ajouter une commande à livrer ?

Nom du client :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
    }
    const futures = db.livraisons.filter(l => l.statut !== "✅ Livré").sort((a,b) => new Date(a.date) - new Date(b.date));
    let m = `🚚 *COMMANDES À LIVRER (${futures.length})*

`;
    futures.forEach((l, i) => {
      m += `${i+1}. 👤 *${l.client_nom}*
`;
      if (l.client_tel) m += `   📱 ${l.client_tel}
`;
      if (l.produit) m += `   🛒 ${l.produit}
`;
      m += `   📅 ${formatDateFR(l.date)}
`;
      if (l.note) m += `   📝 ${l.note}
`;
      m += "
";
    });
    return sendMessage(chatId, m, { reply_markup: { keyboard: [["➕ Ajouter livraison"], ["🗑️ Marquer livré"], ["🏠 Menu"]], resize_keyboard: true } });
  }

  if (text === "➕ Ajouter livraison") {
    session.etape = "livraison_client_nom"; session.data = { type: "livraison" };
    return sendMessage(chatId, `🚚 *Nouvelle livraison*

Nom du client :`, { reply_markup: { keyboard: db.clients.map(c => [c.nom]).concat([["❌ Annuler"]]), resize_keyboard: true } });
  }

  if (text === "🗑️ Marquer livré") {
    const futures = db.livraisons.filter(l => l.statut !== "✅ Livré");
    if (futures.length === 0) return sendMessage(chatId, `🚚 Aucune livraison en attente.`, { reply_markup: menuClients() });
    session.etape = "livraison_marquer_fait";
    const b = futures.map((l,i) => [`${i+1}. ${l.client_nom} — ${formatDateFR(l.date)}`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `✅ Quelle livraison marquer comme livrée ?`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  // ══ VENTES ══
  if (text === "💰 Ventes") return sendMessage(chatId, `💰 *VENTES*`, { reply_markup: menuVentes() });

  if (text === "📋 Voir ventes") {
    if (db.ventes.length === 0) return sendMessage(chatId, `💰 Aucune vente.`, { reply_markup: menuVentes() });
    const s = getStats(); let m = `💰 *VENTES (${db.ventes.length})*\nCA: *${s.ca} FCFA*\n\n`;
    db.ventes.slice(0, 8).forEach(v => { m += `🛒 *${v.produit_nom}* x${v.quantite} — ${v.montant_total} FCFA${v.reduction_appliquee ? " 🎁-10%" : ""}\n   👤 ${v.client_nom} | Marge: ${v.marge_totale} FCFA\n`; });
    return sendMessage(chatId, m, { reply_markup: menuVentes() });
  }

  if (text === "➕ Vente rapide") {
    if (db.produits.length === 0) return sendMessage(chatId, `⚠️ Ajoutez d'abord un produit !`, { reply_markup: menuVentes() });
    session.etape = "vente_produit"; session.data = {};
    const b = db.produits.filter(p => p.stock > 0).map(p => [`${p.nom} (${p.stock} dispo)`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `🛒 Choisissez le produit :`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  if (text === "📝 Vente texte") {
    session.etape = "vente_texte";
    return sendMessage(chatId, `📝 *Vente texte*\n\nUne vente par ligne : \`produit quantité client\`\n\nEx:\n\`\`\`\nT-shirt 3 Karim\nHoodie 1 Sophie\n\`\`\`\nOu envoyez une *photo* !`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }

  // ══ CHARGES ══
  if (text === "📊 Charges") {
    if (db.charges.length === 0) { session.etape = "charge_label"; session.data = {}; return sendMessage(chatId, `📊 Aucune charge.\n\nLibellé :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } }); }
    const total = db.charges.reduce((s, c) => s + c.montant, 0); let m = `📊 *CHARGES (${total} FCFA)*\n\n`;
    db.charges.forEach(c => m += `• *${c.label}* — ${c.montant} FCFA (${c.categorie})\n`);
    return sendMessage(chatId, m, { reply_markup: { keyboard: [["➕ Ajouter charge"], ["🏠 Menu"]], resize_keyboard: true } });
  }

  if (text === "➕ Ajouter charge") { session.etape = "charge_label"; session.data = {}; return sendMessage(chatId, `📊 *Nouvelle charge*\n\nLibellé :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } }); }

  // ══ STATS & ALERTES ══
  if (text === "📈 Stats") {
    const s = getStats();
    return sendMessage(chatId, `📈 *TABLEAU DE BORD*\n\n💰 CA : *${s.ca} FCFA*\n✅ Bénéfice brut : *${s.benefice_brut} FCFA*\n📊 Charges : ${s.total_charges} FCFA\n🏆 Bénéfice net : *${s.benefice_net} FCFA*\n\n🛍️ Produits : ${s.nb_produits} | 👥 Clients : ${s.nb_clients}\n🛒 Ventes : ${s.nb_ventes} | 🚨 Alertes : ${s.alertes_stock}`, { reply_markup: menuPrincipal() });
  }

  if (text === "🚨 Alertes") {
    const alertes = getAlertes(); const ruptures = getRuptures();
    if (alertes.length === 0 && ruptures.length === 0) return sendMessage(chatId, `✅ Stock OK !`, { reply_markup: menuPrincipal() });
    let m = `🚨 *ALERTES STOCK*\n\n`;
    if (ruptures.length > 0) { m += `🔴 *Ruptures :*\n`; ruptures.forEach(p => m += `• ${p.nom}\n`); m += "\n"; }
    if (alertes.length > 0) { m += `🟡 *Stock bas :*\n`; alertes.forEach(p => m += `• ${p.nom} — ${p.stock} unité(s)\n`); }
    return sendMessage(chatId, m, { reply_markup: menuPrincipal() });
  }

  // ══ AGENDA ══
  if (text === "📅 Agenda") return sendMessage(chatId, `📅 *AGENDA*`, { reply_markup: menuAgenda() });

  if (text === "📋 Voir agenda") {
    const events = db.agenda.filter(e => new Date(e.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (events.length === 0) return sendMessage(chatId, `📅 Aucun événement.`, { reply_markup: menuAgenda() });
    let m = `📅 *AGENDA*\n\n`;
    events.forEach((e, i) => { m += `${i + 1}. *${e.titre}*\n🕐 ${formatDateFR(e.date)}\n${e.googleEventId ? "📆 Google ✅" : "📆 Google ❌"} | 🔔 ${e.rappels_envoyes.length}/4 rappels\n\n`; });
    return sendMessage(chatId, m, { reply_markup: menuAgenda() });
  }

  if (text === "➕ Ajouter événement") {
    session.etape = "agenda_texte"; session.data = {};
    return sendMessage(chatId, `📅 *Nouvel événement*\n\nÉcrivez en langage naturel :\n• Sport demain 10h\n• Réunion vendredi 14h\n• Livraison lundi 9h30`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }

  if (text === "🗑️ Supprimer événement") {
    const events = db.agenda.filter(e => new Date(e.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (events.length === 0) return sendMessage(chatId, `📅 Aucun événement.`, { reply_markup: menuAgenda() });
    session.etape = "agenda_supprimer"; session.data.events = events;
    const b = events.map((e, i) => [`${i + 1}. ${e.titre} — ${formatDateFR(e.date)}`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `🗑️ Quel événement supprimer ?`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  // ══ FIDÉLITÉ ══
  if (text === "🎁 Fidélité") {
    const membres = db.clients.filter(c => c.nb_achats >= ACHAT_REDUCTION);
    const nouveaux = db.clients.filter(c => c.nb_achats < ACHAT_REDUCTION);
    return sendMessage(chatId,
      `🎁 *PROGRAMME FIDÉLITÉ*\n\n` +
      `⭐ Membres actifs : *${membres.length}*\n` +
      `🆕 Nouveaux clients (1er achat) : *${nouveaux.length}*\n\n` +
      `📌 *Paliers de réduction :*\n` +
      `   1er achat → Tarif plein\n` +
      `   2ème achat → *-5%*\n` +
      `   3ème achat → *-8%*\n` +
      `   4ème achat → *-10%* permanent\n\n` +
      `📧 La carte fidélité est envoyée par email à l'inscription.`,
      { reply_markup: menuFidelite() }
    );
  }

  if (text === "📋 Voir membres fidélité") {
    const membres = db.clients.filter(c => c.nb_achats >= ACHAT_REDUCTION);
    if (membres.length === 0) return sendMessage(chatId, `🎁 Aucun membre éligible à la réduction pour l'instant.`, { reply_markup: menuFidelite() });
    let m = `⭐ *MEMBRES FIDÈLES (${membres.length})*\n\n`;
    membres.sort((a, b) => b.ca_total - a.ca_total).forEach(c => {
      const label = getLabelReduction(c.nb_achats);
      m += `👤 *${c.nom}* — ${c.nb_achats} achats — *${c.ca_total} FCFA*\n`;
      m += `   🎁 Prochain achat à ${label}\n\n`;
    });
    return sendMessage(chatId, m, { reply_markup: menuFidelite() });
  }

  if (text === "🏆 Top clients") {
    if (db.clients.length === 0) return sendMessage(chatId, `👥 Aucun client.`, { reply_markup: menuFidelite() });
    const top = [...db.clients].sort((a, b) => b.ca_total - a.ca_total).slice(0, 5);
    let m = `🏆 *TOP 5 CLIENTS*\n\n`;
    top.forEach((c, i) => {
      const medailles = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
      const badge = c.nb_achats >= ACHAT_REDUCTION ? " ⭐" : "";
      m += `${medailles[i]} *${c.nom}*${badge}\n   ${c.nb_achats} achat(s) — *${c.ca_total} FCFA*\n\n`;
    });
    return sendMessage(chatId, m, { reply_markup: menuFidelite() });
  }

  if (text === "🔄 Clients récurrents") {
    // Récurrents = 2+ achats dans les 30 derniers jours ou 3+ achats total
    const maintenant = new Date();
    const il_y_a_30j = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recurrents = db.clients.filter(c => {
      const dernVisite = new Date(c.derniere_visite || c.cree_le);
      return c.nb_achats >= 2 && dernVisite >= il_y_a_30j;
    }).sort((a, b) => b.nb_achats - a.nb_achats);

    if (recurrents.length === 0)
      return sendMessage(chatId, `🔄 Aucun client récurrent ce mois.\n\nUn client récurrent = 2+ achats dans les 30 derniers jours.`, { reply_markup: menuFidelite() });

    let m = `🔄 *CLIENTS RÉCURRENTS (${recurrents.length})*\n_2+ achats ce mois_\n\n`;
    recurrents.forEach((c, i) => {
      const badge = c.nb_achats >= ACHAT_REDUCTION ? "⭐" : "🆕";
      const jours = Math.floor((maintenant - new Date(c.derniere_visite || c.cree_le)) / (1000 * 60 * 60 * 24));
      m += `${badge} *${c.nom}*\n`;
      m += `   🛒 ${c.nb_achats} achats | 💰 ${c.ca_total} FCFA\n`;
      m += `   📅 Dernier achat : il y a ${jours === 0 ? "aujourd\'hui" : jours + " jour(s)"}\n\n`;
    });
    return sendMessage(chatId, m, { reply_markup: menuFidelite() });
  }

  if (text === "😴 Clients inactifs") {
    // Inactifs = aucun achat depuis 30+ jours
    const maintenant = new Date();
    const il_y_a_30j = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inactifs = db.clients.filter(c => {
      const dernVisite = new Date(c.derniere_visite || c.cree_le);
      return dernVisite < il_y_a_30j;
    }).sort((a, b) => new Date(a.derniere_visite || a.cree_le) - new Date(b.derniere_visite || b.cree_le));

    if (inactifs.length === 0)
      return sendMessage(chatId, `😴 Aucun client inactif !\nTous vos clients ont acheté dans les 30 derniers jours. 🎉`, { reply_markup: menuFidelite() });

    let m = `😴 *CLIENTS INACTIFS (${inactifs.length})*\n_Aucun achat depuis 30+ jours_\n\n`;
    inactifs.forEach(c => {
      const jours = Math.floor((maintenant - new Date(c.derniere_visite || c.cree_le)) / (1000 * 60 * 60 * 24));
      const badge = c.nb_achats >= ACHAT_REDUCTION ? "⭐" : "🆕";
      m += `${badge} *${c.nom}*\n`;
      if (c.telephone) m += `   📱 ${c.telephone}\n`;
      if (c.email) m += `   📧 ${c.email}\n`;
      m += `   🛒 ${c.nb_achats} achat(s) | 💰 ${c.ca_total} FCFA\n`;
      m += `   ⏳ Inactif depuis *${jours} jour(s)*\n\n`;
    });
    m += `💡 _Pensez à les relancer par message ou email !_`;

    // Proposer relance groupée si des clients ont un email
    const avecEmail = inactifs.filter(c => c.email);
    if (avecEmail.length > 0) {
      m += `\n\n📧 *${avecEmail.length} client(s) avec email* — relance possible`;
      session.data.inactifs_avec_email = avecEmail;
      return sendMessage(chatId, m, { reply_markup: { keyboard: [["📧 Relancer tous par email"], ["📧 Choisir un client à relancer"], ["🏠 Menu"]], resize_keyboard: true } });
    }
    return sendMessage(chatId, m, { reply_markup: menuFidelite() });
  }

  // ── RELANCE EMAIL GROUPÉE ──
  if (text === "📧 Relancer tous par email") {
    const inactifs = session.data.inactifs_avec_email || [];
    session.data = {};
    if (inactifs.length === 0) return sendMessage(chatId, `❌ Aucun client avec email.`, { reply_markup: menuFidelite() });
    await sendMessage(chatId, `⏳ Envoi en cours à ${inactifs.length} client(s)...`);
    let ok = 0, ko = 0;
    for (const c of inactifs) {
      const envoye = await envoyerEmailRelance(c);
      if (envoye) ok++; else ko++;
    }
    return sendMessage(chatId, `✅ *Relance envoyée !*\n📧 ${ok} email(s) envoyé(s)${ko > 0 ? `\n❌ ${ko} échec(s)` : ""}`, { reply_markup: menuFidelite() });
  }

  // ── RELANCE EMAIL INDIVIDUELLE ──
  if (text === "📧 Choisir un client à relancer") {
    const inactifs = session.data.inactifs_avec_email || [];
    if (inactifs.length === 0) return sendMessage(chatId, `❌ Aucun client avec email.`, { reply_markup: menuFidelite() });
    session.etape = "relance_choisir_client";
    session.data.inactifs_avec_email = inactifs;
    const b = inactifs.map(c => [`${c.nom} — ${c.email}`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `📧 Choisissez le client à relancer :`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  if (text === "📧 Renvoyer carte fidélité") {
    const avecEmail = db.clients.filter(c => c.email);
    if (avecEmail.length === 0) return sendMessage(chatId, `❌ Aucun client avec un email enregistré.`, { reply_markup: menuFidelite() });
    session.etape = "renvoyer_carte";
    const b = avecEmail.map(c => [`${c.nom} — ${c.email}`]); b.push(["❌ Annuler"]);
    return sendMessage(chatId, `📧 Choisissez le client :`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }

  // ══ IA ══
  if (text === "🤖 IA") return sendMessage(chatId, `🤖 *Assistant IA*`, { reply_markup: menuIA() });

  // ══ PHOTOS ══
  if (photo) {
    await sendMessage(chatId, `📸 Analyse en cours...`);
    try {
      const fileId = photo[photo.length - 1].file_id;
      const fileResp = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const filePath = fileResp.data.result.file_path;
      const imageResp = await axios.get(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`, { responseType: "arraybuffer" });
      const base64 = Buffer.from(imageResp.data).toString("base64");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [
          { type: "text", text: `Extrait toutes les informations de ventes visibles sur cette image pour une boutique de lunettes au Bénin.
Réponds UNIQUEMENT avec ce JSON :
[{"produit":"nom du produit","quantite":1,"client":"nom ou null","telephone":"numéro ou null","email":"email ou null","prix":0}]
Si prix non visible mets 0. Si plusieurs ventes, plusieurs objets.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
        ]}],
        max_tokens: 500,
      });
      let ventes_data;
      try { ventes_data = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, "").trim()); }
      catch { return sendMessage(chatId, `❌ Image illisible.`, { reply_markup: menuVentes() }); }
      let resultMsg = `✅ *${ventes_data.length} vente(s) :*\n\n`; let totalCA = 0;
      for (const v of ventes_data) {
        // Créer la fiche client si nouveau et infos disponibles
        if (v.client && (v.telephone || v.email)) {
          const existe = db.clients.find(c => c.nom.toLowerCase().includes(v.client.toLowerCase()));
          if (!existe) {
            const nc = {
              id: genId(), nom: v.client.trim(), email: v.email || "", telephone: v.telephone || "",
              note: "Créé via photo vente", nb_achats: 0, ca_total: 0,
              carte_envoyee: false, derniere_visite: new Date().toISOString(), cree_le: new Date().toISOString(),
            };
            db.clients.push(nc);
            await envoyerVersSheets("nouveau_client", { nom: nc.nom, email: nc.email, telephone: nc.telephone, note: nc.note, date: new Date().toLocaleString("fr-FR") });
            if (nc.email) { const envoye = await envoyerCarteFidelite(nc); nc.carte_envoyee = envoye; }
          } else {
            if (v.telephone && !existe.telephone) existe.telephone = v.telephone;
            if (v.email && !existe.email) existe.email = v.email;
          }
        }
        const result = await enregistrerVenteComplete(v.produit, v.quantite || 1, v.client || null, v.prix || null);
        if (result.erreur) { resultMsg += `❌ ${result.erreur}\n`; }
        else {
          resultMsg += `✅ *${result.vente.produit_nom}* x${result.vente.quantite} — ${result.vente.montant_total} FCFA`;
          if (result.reductionAppliquee) resultMsg += ` 🎁${result.labelReduction || '-10%'}`;
          if (result.etuiOffert && !result.etuiOffert.erreur) resultMsg += ` 🕶️étui offert`;
          if (result.etuiOffert && result.etuiOffert.erreur) resultMsg += ` ⚠️étui indispo`;
          if (result.alerte) resultMsg += ` ⚠️`;
          resultMsg += "\n";
          totalCA += result.vente.montant_total;
        }
      }
      resultMsg += `\n💰 *Total : ${totalCA} FCFA*`;
      return sendMessage(chatId, resultMsg, { reply_markup: menuVentes() });
    } catch (err) { return sendMessage(chatId, `❌ Erreur : ${err.message}`, { reply_markup: menuVentes() }); }
  }

  // ════════════════════════════════════════
  // GESTION DES ÉTAPES
  // ════════════════════════════════════════

  // ── AGENDA ──
  if (session.etape === "agenda_texte") {
    await sendMessage(chatId, `⏳ Analyse...`);
    const parsed = await parserDateNaturelle(text);
    if (!parsed || !parsed.date) return sendMessage(chatId, `❌ Date non comprise. Ex: *Sport demain 10h*`, { reply_markup: menuAgenda() });
    if (new Date(parsed.date) < new Date()) return sendMessage(chatId, `❌ Date déjà passée.`, { reply_markup: menuAgenda() });
    const event = { id: genId(), titre: parsed.titre, date: parsed.date, chatId, googleEventId: null, rappels_envoyes: [] };
    const googleEvent = await creerEventGoogleCalendar(parsed.titre, parsed.date);
    if (googleEvent) event.googleEventId = googleEvent.id;
    db.agenda.push(event);
    const rappels = calculerRappels(parsed.date);
    session.etape = null; session.data = {};
    await envoyerVersSheets("nouvel_evenement", { titre: event.titre, date: formatDateFR(event.date), date_iso: event.date, chat_id: chatId });
    let rep = `✅ *Événement ajouté !*\n\n📅 *${event.titre}*\n🕐 ${formatDateFR(event.date)}\n\n`;
    rep += googleEvent ? `📆 Google Agenda ✅\n` : `📆 Google Agenda ⚠️\n`;
    rep += `🔔 *4 rappels Telegram :*\n`;
    rappels.forEach(r => rep += `• ${r.label}\n`);
    return sendMessage(chatId, rep, { reply_markup: menuAgenda() });
  }

  if (session.etape === "agenda_supprimer") {
    const events = session.data.events;
    const num = parseInt(text.split(".")[0]) - 1;
    if (isNaN(num) || num < 0 || num >= events.length) return sendMessage(chatId, `⚠️ Invalide.`, { reply_markup: menuAgenda() });
    const event = events[num];
    await supprimerEventGoogleCalendar(event.googleEventId);
    db.agenda = db.agenda.filter(e => e.id !== event.id);
    session.etape = null; session.data = {};
    return sendMessage(chatId, `🗑️ *"${event.titre}"* supprimé ✅`, { reply_markup: menuAgenda() });
  }

  // ── RELANCE EMAIL INDIVIDUELLE ──
  if (session.etape === "relance_choisir_client") {
    const nomClient = text.split(" — ")[0].trim();
    const client = db.clients.find(c => c.nom === nomClient);
    session.etape = null; session.data = {};
    if (!client) return sendMessage(chatId, `❌ Client non trouvé.`, { reply_markup: menuFidelite() });
    await sendMessage(chatId, `⏳ Envoi en cours...`);
    const envoye = await envoyerEmailRelance(client);
    return sendMessage(chatId,
      envoye
        ? `✅ Email de relance envoyé à *${client.nom}* (${client.email}) 👑`
        : `❌ Erreur envoi email.`,
      { reply_markup: menuFidelite() }
    );
  }

  // ── FIDÉLITÉ — Renvoyer carte ──
  if (session.etape === "renvoyer_carte") {
    const nomClient = text.split(" — ")[0].trim();
    const client = db.clients.find(c => c.nom === nomClient);
    session.etape = null; session.data = {};
    if (!client) return sendMessage(chatId, `❌ Client non trouvé.`, { reply_markup: menuFidelite() });
    const envoye = await envoyerCarteFidelite(client);
    return sendMessage(chatId,
      envoye ? `✅ Carte fidélité renvoyée à *${client.nom}* (${client.email})` : `❌ Erreur envoi email.`,
      { reply_markup: menuFidelite() }
    );
  }

  // ── RECHERCHE CLIENT ──
  if (session.etape === "recherche_client") {
    const r = text.toLowerCase().trim();
    const res = db.clients.filter(c => c.nom.toLowerCase().includes(r) || (c.telephone && c.telephone.includes(r)) || (c.email && c.email.toLowerCase().includes(r)));
    session.etape = null;
    if (res.length === 0) return sendMessage(chatId, `🔍 Aucun résultat.`, { reply_markup: menuClients() });
    let m = `🔍 *${res.length} résultat(s) :*\n\n`;
    res.forEach(c => {
      const badge = c.nb_achats >= ACHAT_REDUCTION ? "⭐ Membre fidèle" : "🆕 Nouveau";
      m += `👤 *${c.nom}* — ${badge}\n${c.telephone ? `   📱 ${c.telephone}\n` : ""}${c.email ? `   📧 ${c.email}\n` : ""}   🛒 ${c.nb_achats} achat(s) — *${c.ca_total} FCFA*\n\n`;
    });
    return sendMessage(chatId, m, { reply_markup: menuClients() });
  }

  // ── RELANCE — saisie ──
  if (session.etape === "relance_client_nom") {
    session.data.client_nom = text.trim();
    // Chercher le téléphone dans la DB
    const cl = db.clients.find(c => c.nom.toLowerCase().includes(text.toLowerCase()));
    session.data.client_tel = cl ? cl.telephone : "";
    session.etape = "relance_note";
    return sendMessage(chatId, `📝 Note / motif (ou "skip") :`, { reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "relance_note") {
    session.data.note = text === "skip" ? "" : text.trim();
    session.etape = "relance_date";
    return sendMessage(chatId, `📅 Date et heure de relance :
Ex: demain 10h, vendredi 14h30`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "relance_date") {
    await sendMessage(chatId, `⏳ Analyse...`);
    const parsed = await parserDateNaturelle(`Relance client ${session.data.client_nom} ${text}`);
    if (!parsed || !parsed.date) return sendMessage(chatId, `❌ Date non comprise. Ex: demain 10h`, { reply_markup: menuClients() });
    if (new Date(parsed.date) < new Date()) return sendMessage(chatId, `❌ Date déjà passée.`, { reply_markup: menuClients() });

    const relance = {
      id: genId(),
      client_nom: session.data.client_nom,
      client_tel: session.data.client_tel,
      note: session.data.note,
      date: parsed.date,
      chatId,
      rappels_envoyes: [],
      statut: "⏳ En attente",
    };
    db.relances.push(relance);

    // Ajouter dans Google Agenda
    const googleEvent = await creerEventGoogleCalendar(
      `📞 Relance — ${relance.client_nom}${relance.note ? " : " + relance.note : ""}`,
      parsed.date
    );

    // Envoyer vers Sheets
    await envoyerVersSheets("nouvelle_relance", {
      client_nom: relance.client_nom,
      client_tel: relance.client_tel || "",
      note: relance.note || "",
      date: formatDateFR(parsed.date),
      date_iso: parsed.date,
      chat_id: chatId,
    });

    session.etape = null; session.data = {};
    return sendMessage(chatId,
      `✅ *Relance programmée !*
👤 ${relance.client_nom}${relance.client_tel ? "
📱 " + relance.client_tel : ""}
📅 ${formatDateFR(parsed.date)}${relance.note ? "
📝 " + relance.note : ""}
${googleEvent ? "
📆 Google Agenda ✅" : "
📆 Google Agenda ⚠️"}
🔔 5 rappels Telegram programmés`,
      { reply_markup: menuClients() }
    );
  }

  if (session.etape === "relance_marquer_fait") {
    const futures = db.relances.filter(r => r.statut !== "✅ Fait");
    const num = parseInt(text.split(".")[0]) - 1;
    if (isNaN(num) || num < 0 || num >= futures.length) return sendMessage(chatId, `⚠️ Invalide.`, { reply_markup: menuClients() });
    futures[num].statut = "✅ Fait";
    session.etape = null;
    return sendMessage(chatId, `✅ Relance *${futures[num].client_nom}* marquée comme faite !`, { reply_markup: menuClients() });
  }

  // ── LIVRAISON — saisie ──
  if (session.etape === "livraison_client_nom") {
    session.data.client_nom = text.trim();
    const cl = db.clients.find(c => c.nom.toLowerCase().includes(text.toLowerCase()));
    session.data.client_tel = cl ? cl.telephone : "";
    session.etape = "livraison_produit";
    return sendMessage(chatId, `🛒 Produit commandé (ou "skip") :`, { reply_markup: { keyboard: db.produits.map(p => [p.nom]).concat([["skip"], ["❌ Annuler"]]), resize_keyboard: true } });
  }
  if (session.etape === "livraison_produit") {
    session.data.produit = text === "skip" ? "" : text.trim();
    session.etape = "livraison_note";
    return sendMessage(chatId, `📝 Note / adresse (ou "skip") :`, { reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "livraison_note") {
    session.data.note = text === "skip" ? "" : text.trim();
    session.etape = "livraison_date";
    return sendMessage(chatId, `📅 Date et heure de livraison :
Ex: demain 15h, lundi 9h`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "livraison_date") {
    await sendMessage(chatId, `⏳ Analyse...`);
    const parsed = await parserDateNaturelle(`Livraison ${session.data.produit || ""} client ${session.data.client_nom} ${text}`);
    if (!parsed || !parsed.date) return sendMessage(chatId, `❌ Date non comprise. Ex: demain 15h`, { reply_markup: menuClients() });
    if (new Date(parsed.date) < new Date()) return sendMessage(chatId, `❌ Date déjà passée.`, { reply_markup: menuClients() });

    const livraison = {
      id: genId(),
      client_nom: session.data.client_nom,
      client_tel: session.data.client_tel,
      produit: session.data.produit,
      note: session.data.note,
      date: parsed.date,
      chatId,
      rappels_envoyes: [],
      statut: "⏳ En attente",
    };
    db.livraisons.push(livraison);

    // Ajouter dans Google Agenda
    const googleEvent = await creerEventGoogleCalendar(
      `🚚 Livraison — ${livraison.client_nom}${livraison.produit ? " : " + livraison.produit : ""}`,
      parsed.date
    );

    // Envoyer vers Sheets
    await envoyerVersSheets("nouvelle_livraison", {
      client_nom: livraison.client_nom,
      client_tel: livraison.client_tel || "",
      produit: livraison.produit || "",
      note: livraison.note || "",
      date: formatDateFR(parsed.date),
      date_iso: parsed.date,
      chat_id: chatId,
    });

    session.etape = null; session.data = {};
    return sendMessage(chatId,
      `✅ *Livraison programmée !*
👤 ${livraison.client_nom}${livraison.client_tel ? "
📱 " + livraison.client_tel : ""}${livraison.produit ? "
🛒 " + livraison.produit : ""}
📅 ${formatDateFR(parsed.date)}${livraison.note ? "
📝 " + livraison.note : ""}
${googleEvent ? "
📆 Google Agenda ✅" : "
📆 Google Agenda ⚠️"}
🔔 5 rappels Telegram programmés`,
      { reply_markup: menuClients() }
    );
  }

  if (session.etape === "livraison_marquer_fait") {
    const futures = db.livraisons.filter(l => l.statut !== "✅ Livré");
    const num = parseInt(text.split(".")[0]) - 1;
    if (isNaN(num) || num < 0 || num >= futures.length) return sendMessage(chatId, `⚠️ Invalide.`, { reply_markup: menuClients() });
    futures[num].statut = "✅ Livré";
    session.etape = null;
    return sendMessage(chatId, `✅ Livraison *${futures[num].client_nom}* marquée comme livrée ! 🚚`, { reply_markup: menuClients() });
  }

  // ── RESTOCK ──
  if (session.etape === "restock_produit") {
    const p = db.produits.find(p => text.startsWith(p.nom)); if (!p) return sendMessage(chatId, `⚠️ Non trouvé.`);
    session.data.produit = p; session.etape = "restock_quantite";
    return sendMessage(chatId, `🔄 *${p.nom}* — Stock: ${p.stock}\n\nQuantité à ajouter :`, { reply_markup: { keyboard: [["10"], ["20"], ["50"], ["100"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "restock_quantite") {
    const qte = parseInt(text); if (isNaN(qte) || qte < 1) return sendMessage(chatId, `⚠️ Invalide.`);
    const p = session.data.produit; const avant = p.stock; p.stock += qte;
    db.historique_stock.unshift({ id: genId(), produit_id: p.id, produit_nom: p.nom, operation: "add", quantite: qte, stock_avant: avant, stock_apres: p.stock, note: "Restock", date: new Date().toISOString() });
    await envoyerVersSheets("mouvement_stock", { produit: p.nom, operation: "add", quantite: qte, stock_avant: avant, stock_apres: p.stock, note: "Restock", date: new Date().toLocaleString("fr-FR") });
    session.etape = null; session.data = {};
    return sendMessage(chatId, `✅ *Restock !*\n📦 ${p.nom} : ${avant} → *${p.stock} unités*`, { reply_markup: menuProduits() });
  }

  // ── PRODUIT ──
  if (session.etape === "produit_nom") { session.data.nom = text; session.etape = "produit_achat"; return sendMessage(chatId, `💵 Prix d'achat (FCFA) :`); }
  if (session.etape === "produit_achat") { const v = parseFloat(text); if (isNaN(v)) return sendMessage(chatId, `⚠️ Invalide.`); session.data.prix_achat = v; session.etape = "produit_vente"; return sendMessage(chatId, `💰 Prix de vente (FCFA) :`); }
  if (session.etape === "produit_vente") { const v = parseFloat(text); if (isNaN(v)) return sendMessage(chatId, `⚠️ Invalide.`); session.data.prix_vente = v; session.etape = "produit_stock"; return sendMessage(chatId, `📦 Stock initial :`); }
  if (session.etape === "produit_stock") { const v = parseInt(text); if (isNaN(v)) return sendMessage(chatId, `⚠️ Entier requis.`); session.data.stock = v; session.etape = "produit_categorie"; return sendMessage(chatId, `🏷️ Catégorie :`, { reply_markup: { keyboard: [["🕶️ Lunettes"], ["🧳 Étuis"], ["✏️ Autre (préciser)"], ["❌ Annuler"]], resize_keyboard: true } }); }
  if (session.etape === "produit_categorie_preciser") {
    session.data.categorie = text;
    session.etape = "produit_categorie";
    // Forcer la suite avec la catégorie précisée
    const p = { id: genId(), nom: session.data.nom, prix_achat: session.data.prix_achat, prix_vente: session.data.prix_vente, stock: session.data.stock, categorie: session.data.categorie, cree_le: new Date().toISOString() };
    db.produits.push(p); const { marge, taux } = calculerMarge(p.prix_achat, p.prix_vente);
    await envoyerVersSheets("nouveau_produit", { nom: p.nom, categorie: p.categorie, prix_achat: p.prix_achat, prix_vente: p.prix_vente, stock: p.stock, date: new Date().toLocaleString("fr-FR") });
    session.etape = null; session.data = {};
    return sendMessage(chatId, `✅ *Produit ajouté !*\n📦 ${p.nom}\n💵 ${p.prix_achat} FCFA → ${p.prix_vente} FCFA\n📈 Marge: *${marge} FCFA (${taux}%)*\n🗃️ Stock: ${p.stock}\n🏷️ Catégorie: ${p.categorie}`, { reply_markup: menuProduits() });
  }

  if (session.etape === "produit_categorie") {
    // Si "Autre (préciser)" → demander la précision
    if (text === "✏️ Autre (préciser)") {
      session.etape = "produit_categorie_preciser";
      return sendMessage(chatId, `✏️ Précisez la catégorie :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
    }
    // Nettoyer les emojis pour la catégorie
    const categorie = text.replace("🕶️ ", "").replace("🧳 ", "").replace("✏️ ", "").trim();
    const p = { id: genId(), nom: session.data.nom, prix_achat: session.data.prix_achat, prix_vente: session.data.prix_vente, stock: session.data.stock, categorie, cree_le: new Date().toISOString() };
    db.produits.push(p); const { marge, taux } = calculerMarge(p.prix_achat, p.prix_vente);
    await envoyerVersSheets("nouveau_produit", { nom: p.nom, categorie: p.categorie, prix_achat: p.prix_achat, prix_vente: p.prix_vente, stock: p.stock, date: new Date().toLocaleString("fr-FR") });
    session.etape = null; session.data = {};
    return sendMessage(chatId, `✅ *Produit ajouté !*\n📦 ${p.nom}\n💵 ${p.prix_achat} FCFA → ${p.prix_vente} FCFA\n📈 Marge: *${marge} FCFA (${taux}%)*\n🗃️ Stock: ${p.stock}`, { reply_markup: menuProduits() });
  }

  // ── CLIENT (avec envoi carte fidélité) ──
  if (session.etape === "client_nom") { session.data.nom = text; session.etape = "client_email"; return sendMessage(chatId, `📧 Email (ou "skip") :`, { reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true } }); }
  if (session.etape === "client_email") { session.data.email = text === "skip" ? "" : text; session.etape = "client_tel"; return sendMessage(chatId, `📱 Téléphone (ou "skip") :`); }
  if (session.etape === "client_tel") { session.data.telephone = text === "skip" ? "" : text; session.etape = "client_note"; return sendMessage(chatId, `📝 Note (ou "skip") :`); }
  if (session.etape === "client_note") {
    const client = {
      id: genId(), nom: session.data.nom, email: session.data.email,
      telephone: session.data.telephone, note: text === "skip" ? "" : text,
      nb_achats: 0, ca_total: 0, carte_envoyee: false,
      derniere_visite: new Date().toISOString(), cree_le: new Date().toISOString(),
    };
    db.clients.push(client);
    await envoyerVersSheets("nouveau_client", { nom: client.nom, email: client.email, telephone: client.telephone, note: client.note, date: new Date().toLocaleString("fr-FR") });

    // Envoyer carte fidélité par email si email renseigné
    let carteMsg = "";
    if (client.email) {
      const envoye = await envoyerCarteFidelite(client);
      client.carte_envoyee = envoye;
      carteMsg = envoye ? `\n📧 Carte fidélité envoyée à ${client.email} ✅` : `\n📧 Erreur envoi carte ⚠️`;
    } else {
      carteMsg = `\n📧 Pas d'email — carte non envoyée`;
    }

    session.etape = null; session.data = {};
    return sendMessage(chatId,
      `✅ *Client ajouté !*\n👤 ${client.nom}\n📱 ${client.telephone || "—"}\n📧 ${client.email || "—"}${carteMsg}`,
      { reply_markup: menuClients() }
    );
  }

  // ── VENTE RAPIDE ──
  if (session.etape === "vente_produit") {
    const p = db.produits.find(p => text.startsWith(p.nom)); if (!p) return sendMessage(chatId, `⚠️ Non trouvé.`);
    if (p.stock === 0) return sendMessage(chatId, `🔴 Stock épuisé !`);
    session.data.produit = p; session.etape = "vente_quantite";
    return sendMessage(chatId, `🔢 Quantité ? (dispo: ${p.stock})`, { reply_markup: { keyboard: [["1"], ["2"], ["3"], ["5"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "vente_quantite") {
    const qte = parseInt(text); if (isNaN(qte) || qte < 1) return sendMessage(chatId, `⚠️ Invalide.`);
    if (qte > session.data.produit.stock) return sendMessage(chatId, `⚠️ Max: ${session.data.produit.stock}`);
    session.data.quantite = qte; session.etape = "vente_client";
    const b = db.clients.map(c => [c.nb_achats >= ACHAT_REDUCTION ? `⭐ ${c.nom}` : c.nom]);
    b.push(["➕ Nouveau client"], ["Anonyme"], ["❌ Annuler"]);
    return sendMessage(chatId, `👤 Client ?\n⭐ = réduction -10% | ➕ = nouveau client`, { reply_markup: { keyboard: b, resize_keyboard: true } });
  }
  if (session.etape === "vente_client") {
    const clientNom = text.replace("⭐ ", "").trim();

    // Nouveau client → collecter les infos
    if (clientNom === "➕ Nouveau client") {
      session.etape = "vente_nouveau_client_nom";
      return sendMessage(chatId, `👤 *Nouveau client*\n\nNom complet :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } });
    }

    // Afficher statut fidélité AVANT d'enregistrer
    if (clientNom !== "Anonyme") {
      const clientCheck = db.clients.find(c =>
        c.nom.toLowerCase().includes(clientNom.toLowerCase())
      );
      if (clientCheck) {
        const eligible = clientEligibleReduction(clientCheck);
        const restant = ACHAT_REDUCTION - clientCheck.nb_achats;
        const jours = clientCheck.derniere_visite
          ? Math.floor((new Date() - new Date(clientCheck.derniere_visite)) / (1000 * 60 * 60 * 24))
          : null;
        let statutMsg = `👤 *${clientCheck.nom}*\n`;
        statutMsg += `🛒 ${clientCheck.nb_achats} achat(s) | 💰 ${clientCheck.ca_total} FCFA\n`;
        if (jours !== null) statutMsg += `📅 Dernier achat : ${jours === 0 ? "aujourd\'hui" : `il y a ${jours} jour(s)`}\n`;
        if (eligible) {
          const label = getLabelReduction(clientCheck.nb_achats);
          statutMsg += `\n🎁 *Réduction ${label} ACTIVE* — sera appliquée automatiquement sur cette vente`;
        } else {
          statutMsg += `\nℹ️ Pas encore de réduction (1er achat — prochain achat à -5%)`;
        }
        await sendMessage(chatId, statutMsg);
      }
    }

    await finaliserVente(chatId, session, clientNom === "Anonyme" ? null : clientNom);
    return;
  }

  // ── NOUVEAU CLIENT PENDANT UNE VENTE ──
  if (session.etape === "vente_nouveau_client_nom") {
    session.data.nouveau_client = { nom: text.trim() };
    session.etape = "vente_nouveau_client_tel";
    return sendMessage(chatId, `📱 Téléphone (ou "skip") :`, { reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "vente_nouveau_client_tel") {
    session.data.nouveau_client.telephone = text === "skip" ? "" : text.trim();
    session.etape = "vente_nouveau_client_email";
    return sendMessage(chatId, `📧 Email (ou "skip") :`, { reply_markup: { keyboard: [["skip"], ["❌ Annuler"]], resize_keyboard: true } });
  }
  if (session.etape === "vente_nouveau_client_email") {
    session.data.nouveau_client.email = text === "skip" ? "" : text.trim();

    // Créer le client
    const nc = session.data.nouveau_client;
    const client = {
      id: genId(), nom: nc.nom, email: nc.email, telephone: nc.telephone,
      note: "Créé via vente", nb_achats: 0, ca_total: 0,
      carte_envoyee: false, derniere_visite: new Date().toISOString(), cree_le: new Date().toISOString(),
    };
    db.clients.push(client);
    await envoyerVersSheets("nouveau_client", { nom: client.nom, email: client.email, telephone: client.telephone, note: client.note, date: new Date().toLocaleString("fr-FR") });

    // Envoyer carte fidélité si email
    if (client.email) {
      const envoye = await envoyerCarteFidelite(client);
      client.carte_envoyee = envoye;
    }

    await sendMessage(chatId, `✅ Client *${client.nom}* créé !${client.email ? "\n📧 Carte fidélité envoyée" : ""}`);
    await finaliserVente(chatId, session, client.nom);
    return;
  }

  // ── VENTE TEXTE — IA extrait les infos dans n'importe quel ordre ──
  if (session.etape === "vente_texte") {
    await sendMessage(chatId, `⏳ Analyse des ventes en cours...`);

    // Utiliser GPT-4o pour extraire les ventes dans n'importe quel format
    const produitsDispo = db.produits.map(p => p.nom).join(", ");
    const clientsDispo = db.clients.map(c => c.nom).join(", ");

    let ventesExtraites;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Tu es un assistant commercial qui extrait des informations de ventes pour une boutique de lunettes au Bénin.
Produits disponibles : ${produitsDispo || "aucun"}
Clients connus : ${clientsDispo || "aucun"}

Extrait toutes les ventes de ce texte : "${text}"

Règles :
- Trouve le produit (cherche le nom le plus proche dans la liste des produits)
- Trouve la quantité (nombre, défaut = 1)
- Trouve le nom du client si mentionné
- Trouve le téléphone du client si mentionné (numéro)
- Trouve l'email du client si mentionné
- Le format peut être dans n'importe quel ordre et en langage naturel

Réponds UNIQUEMENT avec ce JSON (rien d'autre) :
[{"produit":"nom exact du produit","quantite":1,"client":"nom ou null","telephone":"numéro ou null","email":"email ou null"}]
Si plusieurs ventes, mets plusieurs objets dans le tableau.`
        }],
        max_tokens: 300,
        temperature: 0,
      });

      const raw = completion.choices[0].message.content.replace(/\`\`\`json|\`\`\`/g, "").trim();
      ventesExtraites = JSON.parse(raw);
    } catch (err) {
      session.etape = null; session.data = {};
      return sendMessage(chatId, `❌ Je n'ai pas compris le texte. Réessayez avec un format plus clair.\nEx: \`Lunettes 1 Karim\``, { reply_markup: menuVentes() });
    }

    let resultMsg = "", totalCA = 0, nbOk = 0;
    for (const v of ventesExtraites) {
      if (!v.produit || !v.quantite) continue;

      // Si client avec tel/email fournis et pas encore dans la DB → créer la fiche
      if (v.client && (v.telephone || v.email)) {
        const existe = db.clients.find(c => c.nom.toLowerCase().includes(v.client.toLowerCase()));
        if (!existe) {
          const nc = {
            id: genId(), nom: v.client.trim(), email: v.email || "", telephone: v.telephone || "",
            note: "Créé via vente texte", nb_achats: 0, ca_total: 0,
            carte_envoyee: false, derniere_visite: new Date().toISOString(), cree_le: new Date().toISOString(),
          };
          db.clients.push(nc);
          await envoyerVersSheets("nouveau_client", { nom: nc.nom, email: nc.email, telephone: nc.telephone, note: nc.note, date: new Date().toLocaleString("fr-FR") });
          if (nc.email) { const envoye = await envoyerCarteFidelite(nc); nc.carte_envoyee = envoye; }
        } else {
          // Mettre à jour tel/email si manquants
          if (v.telephone && !existe.telephone) existe.telephone = v.telephone;
          if (v.email && !existe.email) existe.email = v.email;
        }
      }

      const result = await enregistrerVenteComplete(v.produit, v.quantite, v.client || null);
      if (result.erreur) { resultMsg += `❌ ${result.erreur}\n`; }
      else {
        resultMsg += `✅ *${result.vente.produit_nom}* x${result.vente.quantite} — ${result.vente.montant_total} FCFA`;
        if (result.reductionAppliquee) resultMsg += ` 🎁${result.labelReduction || '-10%'}`;
        if (result.etuiOffert && !result.etuiOffert.erreur) resultMsg += ` 🕶️étui offert`;
        if (result.etuiOffert && result.etuiOffert.erreur) resultMsg += ` ⚠️étui indispo`;
        if (result.alerte) resultMsg += ` ⚠️`;
        resultMsg += "\n";
        totalCA += result.vente.montant_total; nbOk++;
      }
    }

    session.etape = null; session.data = {};
    if (nbOk === 0) return sendMessage(chatId, `❌ Aucune vente reconnue. Réessayez.\nEx: \`Lunettes 1 Karim\` ou \`Karim a acheté 1 lunette\``, { reply_markup: menuVentes() });
    return sendMessage(chatId, resultMsg + `\n💰 *Total : ${totalCA} FCFA* (${nbOk} vente(s))`, { reply_markup: menuVentes() });
  }

  // ── CHARGE ──
  if (session.etape === "charge_label") { session.data.label = text; session.etape = "charge_montant"; return sendMessage(chatId, `💵 Montant (FCFA) :`); }
  if (session.etape === "charge_montant") { const v = parseFloat(text); if (isNaN(v)) return sendMessage(chatId, `⚠️ Invalide.`); session.data.montant = v; session.etape = "charge_categorie"; return sendMessage(chatId, `🏷️ Catégorie :`, { reply_markup: { keyboard: [["Loyer"], ["Salaires"], ["Marketing"], ["Transport"], ["Autre"], ["❌ Annuler"]], resize_keyboard: true } }); }
  if (session.etape === "charge_categorie") {
    const c = { id: genId(), label: session.data.label, montant: session.data.montant, categorie: text, date: new Date().toISOString() };
    db.charges.push(c); await envoyerVersSheets("nouvelle_charge", { label: c.label, montant: c.montant, categorie: c.categorie, date: new Date().toLocaleString("fr-FR") });
    session.etape = null; session.data = {};
    return sendMessage(chatId, `✅ *Charge !*\n📊 ${c.label} — ${c.montant} FCFA (${c.categorie})`, { reply_markup: menuPrincipal() });
  }

  // ── IA ──
  const questionsIA = { "📊 Analyse rentabilité": "Analyse ma rentabilité en 5 lignes max. Direct et chiffré.", "🚨 Produits à restock": "Quels produits restock en urgence ? Liste uniquement ceux concernés.", "💡 Conseils CA": "3 conseils concrets et chiffrés pour augmenter mon CA." };
  if (text in questionsIA) { await sendMessage(chatId, `🤖 Analyse...`); return await repondreIA(chatId, questionsIA[text]); }
  if (text === "❓ Question libre") { session.etape = "ia_question"; return sendMessage(chatId, `🤖 Posez votre question :`, { reply_markup: { keyboard: [["❌ Annuler"]], resize_keyboard: true } }); }
  if (session.etape === "ia_question") { await sendMessage(chatId, `🤖 Analyse...`); session.etape = null; return await repondreIA(chatId, text); }

  return sendMessage(chatId, `❓ Utilisez le menu.`, { reply_markup: menuPrincipal() });
});

// ─────────────────────────────────────────
// IA
// ─────────────────────────────────────────
async function repondreIA(chatId, question) {
  const contexte = {
    stats: getStats(),
    produits: db.produits.map(p => ({ nom: p.nom, achat: p.prix_achat, vente: p.prix_vente, stock: p.stock, marge: calculerMarge(p.prix_achat, p.prix_vente) })),
    clients: db.clients.map(c => ({ nom: c.nom, achats: c.nb_achats, ca: c.ca_total, fidelite: c.nb_achats >= ACHAT_REDUCTION })),
    ventes: db.ventes.slice(0, 10), charges: db.charges,
    alertes: getAlertes().map(p => p.nom), ruptures: getRuptures().map(p => p.nom),
    membres_fidelite: db.clients.filter(c => c.nb_achats >= ACHAT_REDUCTION).length,
  };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `Assistant commercial. Français. MAX 8 lignes. Direct, chiffré, sans intro. Données : ${JSON.stringify(contexte)}` },
        { role: "user", content: question },
      ],
      max_tokens: 300, temperature: 0.3,
    });
    return sendMessage(chatId, `🤖 ${completion.choices[0].message.content}`, { reply_markup: menuIA() });
  } catch (err) { return sendMessage(chatId, `❌ Erreur IA : ${err.message}`, { reply_markup: menuPrincipal() }); }
}

// ─────────────────────────────────────────
// API REST
// ─────────────────────────────────────────
// Route ping pour garder Render éveillé
app.get("/ping", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.get("/api/stats", (req, res) => res.json(getStats()));
app.get("/api/produits", (req, res) => res.json(db.produits));
app.get("/api/clients", (req, res) => res.json(db.clients));
app.get("/api/ventes", (req, res) => res.json(db.ventes));
app.get("/api/agenda", (req, res) => res.json(db.agenda));
app.get("/api/fidelite", (req, res) => res.json({ membres: db.clients.filter(c => c.nb_achats >= ACHAT_REDUCTION), nouveaux: db.clients.filter(c => c.nb_achats < ACHAT_REDUCTION) }));
app.get("/api/alertes", (req, res) => res.json({ alertes_bas: getAlertes(), ruptures: getRuptures() }));

// ─────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Serveur : http://localhost:${PORT}`);
  console.log(`🤖 OpenAI (GPT-4o) connecté`);
  console.log(`📊 Google Sheets : ${GAS_URL || "non configuré"}`);

  initEmail();
  initGoogleCalendar();

  // Charger les données depuis Google Sheets
  await chargerDepuisSheets();

  demarrerRappels();
  console.log(`📅 Rappels Telegram démarrés`);

  if (TELEGRAM_TOKEN) {
    try {
      await axios.post(`${TELEGRAM_API}/setWebhook`, { url: `${RENDER_URL}/webhook/${TELEGRAM_TOKEN}` });
      console.log(`✅ Webhook Telegram : ${RENDER_URL}/webhook/${TELEGRAM_TOKEN}`);
    } catch (err) { console.error(`❌ Webhook :`, err.message); }
  } else { console.log(`⚠️ TELEGRAM_BOT_TOKEN manquant`); }
});