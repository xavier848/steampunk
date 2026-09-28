# DAMPFSTADT

Ein animierter Kurzfilm (8:21), der in Echtzeit im Browser entsteht. Gemalter,
stilisierter Look, eine Steampunk Stadt bei Sonnenuntergang, ein Junge mit einem
leuchtenden Messingkern, ein Schutzmann mit Trillerpfeife und ein Herz aus
Messing tief unter dem Uhrturm.

Alles ist prozedural: Häuser, Figuren, Gesichter, Pinselstriche, Rauch, Musik und
Geräusche. Es gibt keine Modelle, keine Fototexturen und keine Samples. Die
einzige externe Abhängigkeit ist three.js (r180, per Importmap vom CDN).

## Starten

```sh
python3 -m http.server
```

Dann im Browser <http://localhost:8000> öffnen und auf **Start** klicken (der Klick
erlaubt dem Browser den Ton). Empfohlen: ein aktueller Chrome, Edge, Firefox oder
Safari mit WebGL 2. Auf einem MacBook Air M3 läuft der Film flüssig; die
Auflösung passt sich automatisch an, damit 60 Bilder pro Sekunde erreicht werden.

`?t=Sekunden` springt direkt an eine Stelle, zum Beispiel
<http://localhost:8000/?t=300>.

## Bedienung

| Taste oder Knopf | Wirkung |
| --- | --- |
| Start, Pause, Leertaste | abspielen oder anhalten |
| Zeitleiste | spulen; die Marken sind die Kapitel |
| Kapitel | direkt zu einem Kapitel springen |
| Freie Kamera, K | frei durch die Szene fliegen (Maus ziehen, Mausrad, W A S D, Q E) |
| Ton, M | Ton an oder aus |
| Vollbild, F | Vollbild |
| Video speichern | nimmt den Film ab der aktuellen Stelle mit Ton als WebM auf |
| Pfeiltasten | 5 Sekunden vor oder zurück |

## Die Geschichte

1. **Flug über Dampfstadt**: aus den Wolken über die Stadt, an einem Luftschiff
   vorbei, der Titel über dem Fabrikviertel.
2. **Die Marktgasse**: Emil am Messingstand, der Kern in seiner Tasche pulsiert,
   Wachtmeister Brummer bemerkt das Leuchten und pfeift.
3. **Die Verfolgung**: durch die Menge, über den Karren, unter der Markise durch,
   ein Versteck hinter Fässern, knapp vor der Straßenbahn über die Schienen.
4. **Die Leiter**: auf die Kisten, die Leiter hinauf ins goldene Licht; Brummer
   bleibt unten.
5. **Über die Dächer**: First, Steg, Wäscheleinen, Katze, Glasdach, der Sprung
   über die Gasse in Zeitlupe.
6. **Die Luke**: das Handrad, ein Dampfstoß, der Blick in die Tiefe; die Uhr
   schlägt sieben, Emil springt.
7. **Der Schacht**: an der Kette hinab, Funken, ein Grubenwagen rast vorbei, der
   Durchbruch in die Halle.
8. **Die Maschinenhalle**: Glutfluss, Schmieden, Arbeiter, ein Messingautomat,
   eine Lücke im Steg.
9. **Das Herz**: der neue Kern, Stille, das Herz erwacht, eine Lichtwelle läuft
   durch die Halle und hinauf in die Stadt. Alle Lampen leuchten, Brummer lächelt,
   Emil sitzt mit der Katze auf dem Dach.

Ausführlich (auf Englisch) mit Drehbuch, Welt und Einstellungsliste: [DESIGN.md](DESIGN.md).

## Technik in Kürze

* **Licht**: Toon Shading mit vier weichen Stufen, farbige Schatten (Violett,
  Petrol), warmes Führungslicht, starkes Randlicht, bis zu acht Laternen als
  Punktlichter, statische und dynamische Schattenkarten.
* **Malerei**: prozedurale Pinseltexturen (Texture Array), Tuschelinien aus Tiefe,
  Normalen und Objektkennung (dünner mit der Entfernung), anisotroper Kuwahara
  Filter, Leinwandstruktur, Bloom, Lichtstrahlen, Farbkorrektur.
* **Stadt**: Häuserblöcke mit Fachwerk, Erkern, Läden, Schildern, Balkonen,
  Wäscheleinen, Zahnrädern, Schornsteinen, Laternen, Uhrturm, Kuppelhaus,
  Fabriken, Ankermast; zusammengefasste Geometrie pro Kachel und Detailstufen.
* **Leben**: 314 instanzierte Stadtleute mit Gangarten im Vertex Shader und
  Reaktionen (ausweichen, erschrecken, hinterherschauen), Straßenbahnen,
  Luftschiffe, Tauben, Mauersegler, eine Katze, Arbeiter und Automaten in der
  Halle.
* **Zeit**: alles ist eine Funktion der Filmzeit. Die Zeitlupe ist eine exakte
  Zeitabbildung, deshalb sind Standbilder und der Videoexport reproduzierbar.
* **Ton**: Musik, Geräusche und Atmosphären werden mit der Web Audio API aus den
  Ereignissen der Geschichte erzeugt; für den Export wird derselbe Ton offline und
  deterministisch gerendert.

## Projektstruktur

```
index.html           Seite mit Importmap
css/dampf.css        Layout und Bedienoberfläche
js/main.js           Start, Renderschleife, window.dampf (show, snap, renderFrames, renderAudio)
js/film.js           baut die Welt und bewegt alles in Abhängigkeit von der Filmzeit
js/time.js           Filmzeit und Geschichtszeit (Zeitlupe), Kapitel
js/engine/           Renderer, Materialien, Pinseltexturen, Nachbearbeitung, Himmel, Looks
js/city/             Stadt, Häuser, Straßen, Markt, Dächer, Wahrzeichen, Unterwelt
js/actors/           Emil, Brummer, Stadtleute, Automaten, Tiere, Verkehr, Posen, Gesichter
js/story/            Geschichte, Kamera, Einstellungen, Stadtleben
js/fx/               Rauch, Dampf, Funken, Titel und Abspann
js/audio/sound.js    prozeduraler Ton
js/ui/ui.js          Bedienoberfläche
tools/render.mjs     Standbilder, Bildfolgen, Video und Ton ohne Bildschirm
tools/contact.py     Kontaktabzüge
stills/              ein Standbild pro Einstellung
render/              der fertige Film als MP4
```

## Standbilder und Video rendern

Voraussetzungen: Node.js mit Playwright (`npm i playwright`), Chromium, ffmpeg.
Mit Mesa llvmpipe (Linux, unter `xvfb-run`) ist das Rendern etwa sieben Mal
schneller als mit SwiftShader.

```sh
# Standbild bei 2:30 in 1920x1080
node tools/render.mjs --times 150 --w 1920 --h 1080 --out stills

# ein Bild aus der Mitte jeder Einstellung
node tools/render.mjs --shots all --w 1920 --h 1080 --out stills

# Video (Bildfolge direkt an ffmpeg), schneller mit llvmpipe
xvfb-run -a node tools/render.mjs --gl llvmpipe --range 0,501.1 --fps 30 --pipe film.mp4

# Ton als WAV
node tools/render.mjs --audio 0,501.1 --wav ton.wav
```

`window.dampf` im Browser: `show(t)`, `snap(t)`, `renderFrames(t0, t1, fps)`,
`renderAudio(t0, t1)`.
