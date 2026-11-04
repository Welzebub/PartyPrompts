# Partypost

Zwei Seiten, keine Abhängigkeiten (nur Node 18+):

- `/`      Eingabeseite für die Gäste (max. 280 Zeichen)
- `/show`  Diashow für den Bildschirm (zufällig, Dauerschleife, neue Beiträge kommen als Nächstes dran),
           unten mit Breaking-News-Ticker; oben rechts umschaltbar auf Stummfilm-Modus
- `/admin`  Beiträge bearbeiten und löschen (Schlüssel eingeben oder `?key=DEIN_SCHLÜSSEL` anhängen)

## Lokal testen
    ADMIN_KEY=geheim node server.js
dann http://localhost:3000 öffnen.

## Auf Render (kostenlos) veröffentlichen
1. Ordner in ein neues GitHub-Repo hochladen.
2. render.com → New → Web Service → Repo wählen.
3. Build Command leer lassen (oder `npm install`), Start Command: `npm start`, Instance Type: Free.
4. Unter Environment eine Variable `ADMIN_KEY` mit einem eigenen Passwort setzen.
5. Die URL, die Render dir gibt, ist Link 1 (Eingabe). Link 2 ist dieselbe URL plus `/show`.

Hinweis: Im Gratis-Tarif schläft der Dienst nach Inaktivität ein (erster Aufruf dauert ~1 Minute)
und der Speicher wird bei Neustarts geleert. Für eine Party passt das, öffne die Seite
einfach kurz vorher, damit sie wach ist. Solange die /show-Seite offen ist, fragt sie alle 4 Sekunden
neue Beiträge ab; das zählt für Render als Aktivität und hält den Dienst wach.
