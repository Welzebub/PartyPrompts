# Partypost

Vier Seiten, keine Abhängigkeiten (nur Node 18+):

- `/`        Eingabeseite für die Gäste (max. 280 Zeichen), mit Link zu `/extras`
- `/extras`  Gäste können Verfasser*innen, Online-Usernamen, Header und Zufalls-Kommentare hinzufügen
             und zu einem ausgewählten Beitrag (mit Suche) einen Kommentar schreiben (max. 100 Zeichen)
- `/show`    Diashow für den Bildschirm: zufällig, Dauerschleife, neue Beiträge kommen als Nächstes dran.
             Zeigt pro Beitrag optional Header, Verfasser*in, Likes und Kommentare (Gästekommentare immer fett),
             unten links den QR-Code, unten den Breaking-News-Ticker. Oben rechts umschaltbar
             zwischen Modern und Stummfilm.
- `/admin`   Moderation (Schlüssel eingeben oder `?key=DEIN_SCHLÜSSEL` anhängen): Beiträge und Gästekommentare
             bearbeiten/löschen, Anzeige-Optionen, alle vier Textlisten bearbeiten, Backup.

## Lokal testen
    ADMIN_KEY=geheim node server.js
dann http://localhost:3000 öffnen.

## Auf Render (kostenlos) veröffentlichen
1. Ordner in ein GitHub-Repo hochladen (`server.js`, `package.json`, Ordner `public` mit den HTML-Dateien).
2. render.com → New → Web Service → Repo wählen, Language **Node**, Start Command `npm start`, Instance Type Free.
3. Unter Environment die Variable `ADMIN_KEY` mit einem eigenen Passwort setzen.
4. Link 1 (Eingabe) ist die Render-URL, Link 2 dieselbe URL plus `/show`.

Im Gratis-Tarif schläft der Dienst nach Inaktivität ein. Solange `/show` offen ist, fragt die Seite
alle 4 Sekunden den Server ab, das hält ihn wach.

## Dauerhaft speichern
Im Gratis-Tarif wird der Speicher bei Neustart oder neuem Deploy geleert (Beiträge, Gästekommentare, Listen, Einstellungen).
- In `/admin` unter „Dauerhaft sichern“ das Backup herunterladen (und bei Bedarf wieder einspielen).
- Wird die Backup-Datei als `seed.json` neben `server.js` ins Repo gelegt, startet der Server immer mit diesem Stand.
- Alternativ: Render-Festplatte (kostenpflichtig) einbinden und `DATA_FILE=/pfad/data.json` setzen.
