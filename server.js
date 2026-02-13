const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios'); // Musisz zainstalować: npm install axios

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8443;
const DB_FILE = 'lemoniada.json';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';

// --- TWOJE TAJNE KODY ---
const DISCOUNTS = {
    "FB10": 0.10,
    "CHAMPION": 0.15,
    "LEMON20": 0.20
};

// --- BAZA DANYCH ---
let data = { kubki: 100, zamowienia: [], zarobki: { pracownik1: 0, pracownik2: 0 } };
if (fs.existsSync(DB_FILE)) data = JSON.parse(fs.readFileSync(DB_FILE));

function saveData() {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- ENDPOINTY ---

// 1. Pobieranie stanu
app.get('/stan-magazynu', (req, res) => res.json(data));

// 2. Zamówienie
app.post('/zamow', async (req, res) => {
    const { kod, ilosc, cenaBazowa, pracownik } = req.body;
    if (data.kubki < ilosc) return res.status(400).json({ error: "Brak kubków!" });

    let znizka = DISCOUNTS[kod.toUpperCase()] || 0;
    let cenaPoZnizce = (cenaBazowa * ilosc) * (1 - znizka);

    data.kubki -= ilosc;
    const noweZamowienie = {
        data: new Date().toLocaleString(),
        ilosc,
        cena: cenaPoZnizce,
        kod: kod || "BRAK",
        pracownik: pracownik || "Nieznany"
    };

    data.zamowienia.push(noweZamowienie);
    saveData();

    // WYSYŁKA DO GOOGLE SHEETS
    try {
        await axios.post(GOOGLE_SCRIPT_URL, noweZamowienie);
    } catch (e) {
        console.log("Błąd Google Sheets (prawdopodobnie CORS w Google Script, ale dane mogły dojść)");
    }

    res.json({ success: true, cena: cenaPoZnizce, stan: data.kubki });
});

// 3. Admin - Dodaj kubki
app.post('/admin/dodaj-kubki', (req, res) => {
    data.kubki += parseInt(req.body.ilosc);
    saveData();
    res.json(data);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serwer śmiga na https://api.lemoniada.com.pl`);
});