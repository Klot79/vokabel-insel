# 🏝️ Vokabel-Insel

Französisch-Vokabeln lernen für die 4. Klasse (FR → Deutsch und FR → Portugiesisch).
Die Kinder segeln auf einer Weltkarte von Insel zu Insel. Jede Insel ist eine Lektion.
Die Lehrkraft sieht den Fortschritt der ganzen Klasse auf einen Blick.

Die App läuft im Browser (iPad, Handy, PC) und braucht kein App-Store-Konto.
Die Kinder brauchen kein Benutzerkonto, sie melden sich mit Klassencode, Namen und Bild-PIN an.

---

## Was die App kann

**Für die Kinder**
- **Tagesmission**: kurze Einheit (ca. 5 Minuten) mit fälligen Wiederholungen und wenigen neuen Wörtern
- **8 Übungsarten**: Entdecken (Bild + Wort + Ton), Quiz, Hören, Schreiben (mit Akzent-Tasten), Sprechen (Spracherkennung), Buchstabensalat, Memory, Blitzrunde (60 Sekunden)
- **Vorlesen**: Jedes französische Wort wird vorgesprochen
- **Weltkarte**: Inseln mit je 3 Sternen, die nächste Insel öffnet sich mit dem ersten Stern
- **Motivation**: Münzen, Avatar-Shop (Tiere, Hüte, Farben), Tage-Serie 🔥, Abzeichen, gemeinsames Klassenziel
- **Mein Fortschritt**: Lernkartei-Ansicht, Übungskalender, Sterne pro Insel
- **Keine Rangliste**: Kinder vergleichen sich nur mit sich selbst

**Für die Lehrkraft**
- **Klassenübersicht**: Wer übt wie viel, Trefferquote, Fortschritt je Lektion als Farbtabelle, Aktivität der letzten 14 Tage
- **Schwierige Wörter** der Klasse (gut für die Wiederholung im Unterricht)
- **Hinweise**, welche Kinder länger nicht geübt haben oder Hilfe brauchen könnten
- **Lektionen anlegen** in wenigen Minuten:
  - 📷 **Foto vom Vokabelblatt** (auch direkt mit der iPad-Kamera), die Texterkennung liest die Wörter aus
  - 📄 **PDF** (mit Text oder eingescannt), **Word** (.docx), **Excel** (.xlsx/.xls/.ods), **CSV/TXT** oder Text einfügen
  - 🖼 **Bilder** (JPG, PNG, WebP, GIF, SVG, HEIC in Safari): mehrere auf einmal hochladen, Zuordnung per Dateiname (z. B. `chat.jpg` → *le chat*), alternativ Emoji
- Lektionen **für alle oder nur für bestimmte Kinder** freigeben (z. B. FR→PT für portugiesischsprachige Kinder)
- **Bild-PIN-Karten** zum Ausdrucken, Sicherung als Datei

---

## Worauf das Lernkonzept beruht

| Prinzip | Studie | Umsetzung in der App |
|---|---|---|
| **Verteiltes Wiederholen** (Spacing-Effekt) | Ebbinghaus 1885; Cepeda et al. 2006 | Lernkartei mit 5 Fächern. Ein Wort kommt nach 10 Min., 1, 3, 7 und 16 Tagen wieder. |
| **Abrufen statt Wiederlesen** (Testing-Effekt) | Roediger & Karpicke 2006 | Jede Übung verlangt eine Antwort, die Tagesmission besteht vor allem aus Wiederholungen. |
| **Vom Erkennen zum freien Abrufen** | Desirable Difficulties, Bjork 1994 | Multiple Choice bringt ein Wort höchstens bis Fach 2, danach zählen nur Schreiben und Sprechen. |
| **Bild + Wort + Ton** (Doppelte Kodierung) | Paivio 1971; Mayer 2009 | Jedes Wort mit Bild/Emoji und Aussprache |
| **Laut sprechen** (Produktionseffekt) | MacLeod et al. 2010 | Sprechübung mit Spracherkennung, Nachsprechen beim Entdecken |
| **Kleine Portionen** | Arbeitsgedächtnis, Cowan 2001 | Höchstens 5–6 neue Wörter pro Einheit |
| **Sofortiges Feedback, Fehler wiederholen** | Hattie & Timperley 2007 | Richtige Lösung wird gezeigt und vorgelesen, das Wort kommt in derselben Runde nochmal |
| **Motivation durch Autonomie, Kompetenz, Zugehörigkeit** | Selbstbestimmungstheorie, Deci & Ryan | Übungsart frei wählbar, sichtbarer Fortschritt, gemeinsames Klassenziel statt Rangliste |
| **Anstrengung loben** | Dweck (Growth Mindset) | Rückmeldungen loben Üben und Dranbleiben, Fehler gelten als normal |

**Die 3 Sterne einer Insel:**
⭐ alle Wörter entdeckt · ⭐⭐ 80 % sicher abrufbar · ⭐⭐⭐ 80 % gemeistert (nur durch Wiederholen an verschiedenen Tagen erreichbar)

---

## Sofort ausprobieren (Demo-Modus)

Ohne Einrichtung startet die App im **Demo-Modus** mit einer Beispielklasse:

- Klassencode **DEMO**
- Kinder-PIN **🐶 🍎 ⭐** (für alle Demo-Kinder)
- Lehrer-PIN **1234**

Im Demo-Modus bleiben alle Daten **nur auf diesem Gerät**.

---

## Einrichtung für die Klasse (ca. 20 Minuten, einmalig, kostenlos)

### Schritt 1: Auf GitHub veröffentlichen (GitHub Pages)

1. Auf [github.com](https://github.com) anmelden (oder kostenloses Konto anlegen).
2. Oben rechts **＋ → New repository**. Name z. B. `vokabel-insel`, **Public** auswählen, **Create repository**.
3. Auf der neuen Seite **„uploading an existing file“** anklicken.
4. Den **Inhalt** des Ordners `vokabel-insel` (also `index.html`, `README.md` und die Ordner `css`, `js`, `supabase`) ins Fenster ziehen, dann **Commit changes**.
5. **Settings → Pages**: bei *Branch* `main` und `/ (root)` wählen, **Save**.
6. Nach 1–2 Minuten ist die App erreichbar unter
   `https://DEIN-NAME.github.io/vokabel-insel/`

Jetzt läuft die App, aber noch im Demo-Modus. Für die Klassenübersicht folgt Schritt 2.

### Schritt 2: Gemeinsame Datenbank (Supabase, kostenlos)

1. Auf [supabase.com](https://supabase.com) kostenloses Konto anlegen und **New project** anlegen (Region: *Central EU (Frankfurt)*).
2. Links **SQL Editor** öffnen, den kompletten Inhalt der Datei `supabase/setup.sql` einfügen und **Run** klicken.
3. Links **Project Settings → API** öffnen. Dort stehen **Project URL** und der **anon public**-Schlüssel.
4. Auf GitHub die Datei `js/config.js` öffnen, auf ✏️ (Bearbeiten) klicken und die beiden Werte eintragen:
   ```js
   window.VOKABEL_CONFIG = {
     SUPABASE_URL: "https://abcdxyz.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
   };
   ```
   Dann **Commit changes**. Der *anon*-Schlüssel darf öffentlich sein, er ist dafür gedacht.
5. Nach ca. 1 Minute die App neu laden. Der gelbe „Demo-Modus“-Hinweis ist dann weg.

> Hinweis: Kostenlose Supabase-Projekte werden nach 7 Tagen **ohne jede Nutzung** pausiert (z. B. in den Ferien). Dann im Supabase-Dashboard auf **Restore** klicken; die Daten bleiben erhalten.

### Schritt 3: Klasse anlegen

1. App öffnen → **Lehrkraft** → **Neue Klasse anlegen** (Name, Klassencode, Lehrer-PIN).
2. Tab **Kinder**: Vornamen eintragen (einer pro Zeile) → **PIN-Karten drucken** und verteilen.
3. Tab **Lektionen**: **Neue Lektion** → Foto vom Vokabelblatt aufnehmen → prüfen → **Speichern**.
4. Tab **Einstellungen**: den **Link für die Kinder** kopieren. Damit ist der Klassencode schon eingetragen.
   Auf dem iPad in Safari öffnen → Teilen → **Zum Home-Bildschirm**. So sieht die App wie eine echte App aus.

---

## Tipps für iPads

- **Spracherkennung** nutzt die Diktierfunktion von iOS. Sie muss eingeschaltet sein: *Einstellungen → Allgemein → Tastatur → Diktierfunktion aktivieren*. Beim ersten Mal fragt Safari nach dem Mikrofon → **Erlauben**.
- **Französische Stimme** für das Vorlesen: *Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Französisch* (z. B. „Audrey (Premium)“ laden, klingt viel natürlicher).
- Ohne Spracherkennung (z. B. Firefox) zeigt die App beim Sprechen die Lösung, und das Kind bewertet sich selbst.

## Datenschutz

- Gespeichert werden nur **Vornamen**, Bild-PIN und Lernfortschritt. Keine E-Mail, kein Foto der Kinder.
- Die Datenbank liegt bei Supabase in der EU-Region, die du in Schritt 2 wählst.
- Ohne den Klassencode kann niemand die Daten der Klasse sehen. Den Klassencode deshalb nicht öffentlich posten.
- Die Bild-PIN ist kindgerecht einfach. Sie verhindert Verwechslungen, ist aber kein starker Schutz.
- Bitte die Vorgaben eurer Schule bzw. des Ministeriums zum Einsatz von Online-Diensten beachten.

## Dateien

```
index.html            Startseite
css/style.css         Gestaltung
js/config.js          ← hier die Supabase-Daten eintragen
js/app.js             Start & Klassencode
js/student.js         Kinderbereich: Karte, Übungen, Spiele, Shop
js/teacher.js         Lehrerbereich: Übersicht, Lektionen, Kinder, Einstellungen
js/srs.js             Lernlogik (Lernkartei, Sterne, Abzeichen)
js/import.js          Import: Foto/PDF-Texterkennung, Word, Excel, CSV, Bilder
js/speech.js          Vorlesen & Spracherkennung
js/store.js           Speicher (Supabase oder Gerät)
js/demo.js            Beispielklasse DEMO
supabase/setup.sql    Datenbank einrichten
```
