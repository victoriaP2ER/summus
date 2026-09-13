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

## Instrumente

Die akustischen Instrumente sind **echte Aufnahmen** (`public/samples/`), die
elektronischen sind synthetisiert. In der Instrumentenauswahl steht an jedem
Klang, was er ist.

Die Samples stammen aus
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) von
Nicholas Brosowsky und stehen unter
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Ursprüngliche
Quellen: [Versilian Studios Chamber Orchestra 2 Community
Edition](https://vis.versilstudios.com/vsco-community.html),
[Karoryfer Samples](https://www.karoryfer.com/karoryfer-samples),
[University of Iowa Electronic Music Studios](https://theremin.music.uiowa.edu/)
und [Freesound](https://freesound.org). Für diese App wurden sie gekürzt,
ausgeblendet und neu kodiert.

## Deployment

Die App ist ein statisches Next.js-Projekt und läuft ohne Anpassungen auf
Vercel. Mikrofonzugriff setzt HTTPS voraus — lokal reicht `localhost`.
