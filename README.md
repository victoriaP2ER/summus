# summus — summen wird Musik

Eine Web-App, mit der man Musik macht, indem man summt. Die App hört zu, erkennt
Tonhöhen und Rhythmus und überträgt beides auf echte Instrumente. Aus kurzen
Schnipseln wird Spur für Spur ein ganzer Song — ohne Noten, ohne Instrument,
ohne Vorkenntnisse.

Alles läuft im Browser. Es gibt keinen Server und keine Datenbank: Aufnahmen
verlassen das Gerät nicht, Songs liegen in IndexedDB, und geteilt wird über
Links, die den Song selbst enthalten.

## Was die App kann

- **Summen → Melodie.** Eine gesummte Melodie wird per Tonhöhenerkennung zu
  Noten und landet auf einem Instrument deiner Wahl.
- **Beatboxen → Schlagzeug.** „Bum – Tss" wird in Kick, Snare und Hi-Hat
  zerlegt und aufs Raster gelegt.
- **Singen → Autotune.** Gesungene Silben werden auf Zielnoten gezogen und
  rhythmisch aufs Raster geschoben.
- **Song-Skizze.** Eine einzige längere Aufnahme wird automatisch in Lead,
  Bass, Fläche und Drums aufgeteilt.
- **Band dazu.** Aus der gesummten Melodie wird ein ganzer Song: Bass, Akkorde
  und Schlagzeug folgen der Harmonie, die die Melodie vorgibt — im Groove der
  gewählten Stilrichtung.
- **19 Stilrichtungen** von Orchester über Punk und Trap bis Videospiel-Epos,
  jede mit drei Grooves und einer eigenen Instrumentenauswahl.
- **Ohne eigene Melodie anfangen.** Groove aussuchen, laufen lassen,
  drübersingen — inklusive eines Melodievorschlags, der bei jedem Klick neu
  generiert wird.
- **Tempo aus der Aufnahme.** Klopf den Takt mit — die App liest das Tempo
  daraus ab und stellt das Metronom danach.
- **Overdub.** Beim Aufnehmen läuft das bereits Vorhandene mit.
- **MIDI-Keyboard** als Eingabe, alternativ die Computertastatur.
- **Export** als MP3 oder WAV, **Teilen** als Link ohne Backend.

## Entwicklung

Node 22 oder neuer (siehe `.nvmrc`).

```bash
npm install
npm run dev
```

`npm run build` erzeugt den Produktions-Build.

## Wie es funktioniert

| Bereich | Datei | Verfahren |
| --- | --- | --- |
| Tonhöhe | `lib/audio/pitch.ts` | YIN mit Oktav-Korrektur, auf 24 kHz heruntergerechnet |
| Noten | `lib/audio/analyze.ts` | Median-Glättung, Segmentierung, Zusammenführen gleicher Töne |
| Schlagzeug | `lib/audio/onset.ts` | Spectral Flux mit adaptiver Schwelle, Klassifikation über Bandenergie und Abklingverhalten |
| Tempo | `lib/audio/tempo.ts` | Autokorrelation der Onset-Hüllkurve plus Phasensuche |
| Autotune | `lib/audio/autotune.ts` | Granulares Pitch- und Time-Shifting per Overlap-Add |
| Klang | `lib/audio/instruments.ts` | Tone.js — echte Aufnahmen über `Tone.Sampler`, Synthesizer für elektronische Klänge |
| Begleitung | `lib/audio/accompany.ts` | Taktweise Grundtöne aus der Melodie, Rhythmus aus dem Groove der Stilrichtung |
| Melodien | `lib/audio/melody.ts` | Generiert über die Akkordtöne des Grooves, mit Rhythmuszellen und festem Seed |

## Instrumente

37 Instrumente sind **echte Aufnahmen** — inklusive eines echten Schlagzeugs
(Bass Drum, Snare, Hi-Hat, Tom, Clap statt synthetischer Nachbauten) — (`public/samples/`, rund 9 MB, pro
Instrument einzeln nachgeladen): Streicher, Holz- und Blechbläser, Blockflöten,
Okarina, Mundharmonika, Flügel, Cembalo, Orgel, Harmonium, Gitarren, Harfen,
Đàn tranh, Vibraphon, Marimba, Balafon, Glockenspiel, Röhrenglocken, Kalimba
und mehr. Die elektronischen Klänge sind synthetisiert. In der
Instrumentenauswahl steht an jedem Klang, was er ist — „echt" oder „Synth".

Herkunft der Samples:

- [Versilian Community Sample Library](https://github.com/sgossner/VCSL)
  (Versilian Studios) — [CC0](https://creativecommons.org/publicdomain/zero/1.0/),
  gemeinfrei.
- [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) von
  Nicholas Brosowsky — [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
  Ursprünglich aus [VSCO 2 Community
  Edition](https://vis.versilstudios.com/vsco-community.html),
  [Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples),
  [University of Iowa Electronic Music Studios](https://theremin.music.uiowa.edu/)
  und [Freesound](https://freesound.org).

Für diese App wurden die Aufnahmen gekürzt, ausgeblendet, normalisiert und als
MP3 neu kodiert.

## Beispielmelodien

Zum Anhören der Instrumente spielt die App kurze Ausschnitte. Verwendet werden
nur gemeinfreie Stücke — Beethovens *Ode an die Freude* und *Für Elise*, Griegs
*In der Halle des Bergkönigs* und *Morgenstimmung*, Pachelbels *Kanon in D*,
*Greensleeves*, *When the Saints Go Marching In* und *Alle meine Entchen* —
sowie eigens für summus geschriebene Riffs für die elektronischen Stile.

## Deployment

Die App ist ein statisches Next.js-Projekt und läuft ohne Anpassungen auf
Vercel. Mikrofonzugriff setzt HTTPS voraus — lokal reicht `localhost`.
