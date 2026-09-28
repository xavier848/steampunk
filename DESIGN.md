# DAMPFSTADT: design and shot list

A real time animated short (8:21) rendered in the browser with Three.js. Painted,
stylised look in the spirit of Arcane. No dialogue: the story is told through
images, music and sound.

## Story

**Dampfstadt** runs on the *Great Heart*, a steam engine the size of a cathedral
buried under the clock tower square. Its brass core has burnt out. Every evening
the street lamps flicker a little longer; tonight, when the clock strikes seven,
the heart will stop.

**Emil**, twelve, apprentice to a clockmaker, has built what his master never
could: a new core, glowing warm in his satchel. The one person who notices him is
**Wachtmeister Brummer**, the constable of the market district, who sees a boy
with something glowing under his arm and draws the obvious conclusion.

Emil runs: through the market, over a cart, under an awning, across the tram
line (the tram cuts Brummer off), up a ladder into the golden light where no
constable can follow, over ridges, walkways, washing lines and a glass roof, and
in slow motion across an alley to the roof of the pump house with the old brass
hatch. The clock strikes seven. He jumps into the shaft and slides down the chain,
past the sewer, the pipe gallery and a mine gallery where a cart thunders past,
through the vault into the machine hall: glow river, forges, conveyors, wall
gears, workers and small brass automatons. One of them blocks the catwalk,
recognises the core and bows. Emil jumps a gap, reaches the dying heart and sets
the new core. Silence, then the heart wakes: rings spin, pistons pump, a wave of
light rolls through the hall and races up the shaft into the city. All lamps of
Dampfstadt flare up, the clock tower glows, Brummer looks up and, for the first
time that evening, smiles. Later that night Emil sits on the parapet next to the
cat from the rooftops and looks over his shining city.

Motifs: the clock tower (visible in the street shots, the hands creep toward
seven), flickering lamps (the dying heart), the red scarf (Emil against the petrol
and violet shadows), brass and glow (the core, the heart, the whole city).

## Look

* Toon lighting with four soft light bands, coloured shadows (violet, petrol),
  warm key light, a secondary key (glow river from below) and a strong rim light.
* Hand painted surfaces: a procedural brush texture array (18 layers: plaster,
  stone, brick, wood, tiles, slate, metal, cobbles, cloth, stripes, glass, iron,
  patina, planks, brush, flagstones, facades with lit windows, water); the light
  terminator follows the brush strokes.
* Ink lines from depth, normals and object ids in dark warm brown, thinner with
  distance, hidden under dense steam. A hole filling pass removes hairline cracks
  between abutting parts before the ink is drawn.
* Anisotropic Kuwahara filter (8 sectors) at half resolution, canvas weave, bloom,
  radial light shafts, complementary grade, vignette.
* Layered height fog, painted dusk sky with stepped cumulus clouds, three rings of
  painted far city silhouettes.
* Stylised hard edged smoke and steam (eroding painted puffs), additive sparks.
* Characters with bold silhouettes, big heads, painted faces (face atlas with
  expressions), a verlet simulated scarf.
* Looks: dusk (city), shaft, hall (dying), hall (awake), blue hour (epilogue),
  blended as functions of time.

## World layout (metres, y up, north = -z)

| Place | Where |
| --- | --- |
| Marktgasse (market street) | x = 0, from z = +128 (south) to z = -152, road 10 m, pavements 3.4 m |
| Kesselstrasse (tram cross street) | z = -30 |
| Iron footbridge, pipe bridge | z = -76 (y 11.6), z = +16 (y 15.2) |
| Alley of the slow motion jump | z = -100 |
| Clock tower square | z = -152 to -214, clock tower at (0, -232) |
| Domed house with clock, factory district, mooring mast | (-60, -186); x = +170 to +430; (175, -330) |
| Ladder | east facade, x = 8.4, z = -42.5 |
| Pump house roof with the brass hatch | (15.2, 15.9, -112.5) |
| Service shaft | radius 1.05 m, from the hatch down to the hall vault (y = -81) |
| Galleries crossing the shaft | sewer y = -6, pipe gallery y = -22, mine gallery y = -42 |
| Machine hall | x = -70 to 70, z = -58 to -292, floor y = -150, vault crown y = -80 |
| The Great Heart | (0, -117.7, -172), radius 8 m, catwalk from the shaft to its platform |

## Time

Everything is a function of the film time T. Story time S(T) runs at speed 1
except in five slow motion moments (cart jump, alley jump, the mine cart, the gap
on the catwalk, the heart waking). The map is piecewise linear in speed, so S(T)
is an exact piecewise quadratic and scrubbing, stills and the video export are
deterministic. The flight over the city runs 12 s ahead of story time.

## Rendering and performance

* Merged geometry per 80 m chunk (compact vertex format), LOD for distant chunks,
  instanced gears, lamps, crowd, pigeons and chain links. About 700 k triangles in
  the city; the crowd (314 people, 5 archetypes, vertex shader gaits) is culled to
  the view every frame and only people near Emil are drawn into the shadow map.
* Shadows: a static 4096 map baked per region and a dynamic 2048 map around the
  action. Up to eight banded point lights (nearest lamps).
* Adaptive pixel ratio in the browser (target 60 fps).
* Headless rendering: Chromium through Playwright. With `--gl llvmpipe` (under
  `xvfb-run`) WebGL runs on Mesa llvmpipe, about seven times faster than
  SwiftShader: roughly 0.6 to 1.4 s per 1920x1080 frame on four CPU cores.

## Chapters and shot list

T = film time (m:ss). FG / MG / BG = foreground, middle ground, background.

### 1 Flug über Dampfstadt (0:00 to 1:17)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 1.1 Aus den Wolken | 0:00 to 0:15 | 15.5 s | Out of the clouds, the camera sinks toward the city at sunset | cloud banks / roof carpet, steam columns / clock tower, sun |
| 1.2 Das Luftschiff | 0:15 to 0:32 | 16.5 s | Alongside the big airship with its ship hull, a flock crosses | airship hull, propellers / city / horizon |
| 1.3 DAMPFSTADT | 0:32 to 0:47 | 15.5 s | Title DAMPFSTADT over the factory district | title / chimneys, white steam columns / mooring mast |
| 1.4 Über die Dächer zum Uhrturm | 0:47 to 1:02 | 15.0 s | Low over the roofs toward the clock tower (6:5x) | chimneys / domes / clock tower |
| 1.5 Über der Marktgasse | 1:02 to 1:17 | 15.0 s | Over the market street, lamps flicker | roof edges / street crowd / clock tower |

### 2 Die Marktgasse (1:17 to 1:52)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 2.1 Sturzflug in die Marktgasse | 1:17 to 1:18 | 1.0 s | Dive between the roofs down into the market street | eaves, signs / crowd / Emil at the brass stall |
| 2.2 Am Messingstand | 1:18 to 1:24 | 5.9 s | Emil at the brass stall turning a small gear | goods / Emil / street |
| 2.3 Emil geht los | 1:24 to 1:31 | 7.5 s | Emil strolls north, the clock tower ahead | Emil / crowd / clock tower |
| 2.4 Der Kern pulsiert | 1:31 to 1:38 | 6.7 s | The core in his satchel pulses, a lamp flickers | satchel glow / Emil / lamp |
| 2.5 Der Schutzmann am Kiosk | 1:38 to 1:46 | 7.7 s | The constable reads at the kiosk | passers-by / Brummer, kiosk / street |
| 2.6 Der Glanz in der Tasche | 1:46 to 1:49 | 2.8 s | Brummer notices the glow under the boy's arm | Brummer's shoulder / Emil / stalls |
| 2.7 Halt! | 1:49 to 1:50 | 1.3 s | Halt! Emil turns, surprised | Emil's face / crowd / kiosk |
| 2.8 Die Pfeife | 1:50 to 1:52 | 2.5 s | The whistle, pigeons explode into the air | Brummer / pigeons / street |

### 3 Die Verfolgung (1:52 to 2:58)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 3.1 Verfolgung frontal | 1:52 to 2:00 | 7.2 s | Frontal handheld tracking, the crowd parts | passers-by / Emil / Brummer |
| 3.2 Der Hut fällt | 2:00 to 2:03 | 3.4 s | A top hat is knocked off and rolls | hat / Emil / crowd |
| 3.3 Auf den Karren zu | 2:03 to 2:16 | 13.1 s | Toward the apple cart | crowd / Emil / cart |
| 3.4 Sprung über den Karren | 2:16 to 2:21 | 4.6 s | Jump over the cart in slow motion | cart / Emil in the air / facades |
| 3.5 Durch die Stände | 2:21 to 2:25 | 4.2 s | Through the stalls | stall posts / Emil / facades |
| 3.6 Unter der Markise | 2:25 to 2:27 | 2.5 s | Slide under the awning valance | awning fringe / Emil / stall |
| 3.7 Über die Straße | 2:27 to 2:32 | 4.7 s | Across the street toward the barrels | cobbles / Emil / cross street |
| 3.8 Brummer drängt durch | 2:32 to 2:36 | 3.6 s | Brummer barges through the crowd | shoppers / Brummer / street |
| 3.9 Versteck | 2:36 to 2:41 | 4.8 s | Emil hides behind barrels | barrels / Emil / street |
| 3.10 Brummer sucht | 2:41 to 2:44 | 3.8 s | Brummer searches, looking left and right | barrels / Brummer / crowd |
| 3.11 Emil späht | 2:44 to 2:46 | 1.5 s | Emil peeks out | barrel edge / Emil / Brummer out of focus |
| 3.12 Der Kern verrät ihn | 2:46 to 2:47 | 1.2 s | The core flares and gives him away | core glow / Emil / barrels |
| 3.13 Da ist er! | 2:47 to 2:48 | 1.3 s | There he is! Brummer points | Brummer / crowd / Emil |
| 3.14 Emil flitzt los | 2:48 to 2:51 | 2.8 s | Emil bolts toward the tram line | crowd / Emil / Kesselstrasse |
| 3.15 Die Straßenbahn | 2:51 to 2:54 | 3.3 s | The tram thunders through right behind him | tram / Emil / Brummer |
| 3.16 Emil grinst | 2:54 to 2:56 | 1.4 s | Emil grins on the far side | Emil / tram / facades |
| 3.17 Brummer hinter der Bahn | 2:56 to 2:58 | 1.9 s | Brummer is stuck behind the tram and whistles | tram / Brummer / street |

### 4 Die Leiter (2:58 to 3:26)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 4.1 Auf die Kisten | 2:58 to 3:03 | 5.6 s | Onto the crates below the ladder | crates / Emil / facade |
| 4.2 Kranfahrt an der Fassade | 3:03 to 3:10 | 6.8 s | Crane shot up the facade, from shade into golden light | ladder rungs / Emil / roofs, sun |
| 4.3 Brummer an der Leiter | 3:10 to 3:15 | 5.0 s | Brummer reaches the ladder: creak, whistle, fist | ladder / Brummer / street |
| 4.4 Ins goldene Licht | 3:15 to 3:18 | 3.1 s | Emil climbs into the golden light | parapet / Emil / sky |
| 4.5 Über die Brüstung | 3:18 to 3:21 | 2.3 s | Over the parapet onto the first roof | roof / Emil / chimneys |
| 4.6 Blick hinab | 3:21 to 3:23 | 2.8 s | Looking down: Brummer small at the foot of the ladder | parapet / facade / Brummer |
| 4.7 Emil oben | 3:23 to 3:26 | 2.2 s | Emil on the roof, catching his breath, delighted | Emil / roofs / clock tower |

### 5 Über die Dächer (3:26 to 4:08)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 5.1 Über das erste Dach | 3:26 to 3:28 | 2.8 s | Over the first roof, airships in the sky | chimney / Emil / roofscape |
| 5.2 Auf dem First | 3:28 to 3:32 | 3.2 s | Balancing along the ridge, pigeons flutter up | tiles / Emil / sky |
| 5.3 Über den Steg | 3:32 to 3:33 | 1.7 s | Over the plank walkway above the light well | walkway / Emil / roofs |
| 5.4 Die Katze | 3:33 to 3:36 | 2.5 s | The cat on a chimney watches him pass | cat / Emil / roofs |
| 5.5 Unter der Wäsche | 3:36 to 3:37 | 1.5 s | Ducking under the washing lines | laundry / Emil / glass roof |
| 5.6 Das Glasdach | 3:37 to 3:41 | 3.4 s | Along the glass roof | glass panes / Emil / firewall |
| 5.7 Die Brandmauer | 3:41 to 3:46 | 5.1 s | Up the ladder on the firewall | parapet / Emil / rooftops |
| 5.8 Sieben Minuten vor Sieben | 3:46 to 3:51 | 5.2 s | Seven minutes to seven: the clock tower | Emil / roofs / clock tower |
| 5.9 Anlauf | 3:51 to 3:53 | 2.5 s | The run up to the alley | roof / Emil / alley gap |
| 5.10 Sprung über die Gasse | 3:53 to 4:06 | 12.2 s | Alley jump in slow motion, the camera orbits | Emil in the air / alley depth / city |
| 5.11 Landung | 4:06 to 4:08 | 2.7 s | Landing on the far roof | parapet / Emil / pump house |

### 6 Die Luke (4:08 to 4:38)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 6.1 Zur Luke | 4:08 to 4:13 | 4.8 s | To the brass hatch | roof / Emil / hatch, pump house |
| 6.2 Das Handrad | 4:13 to 4:18 | 4.7 s | Heaving the handwheel round | wheel / Emil / roofs |
| 6.3 Dampfstoß | 4:18 to 4:22 | 3.8 s | The lid bursts open, a column of steam | hatch / steam / Emil shielding |
| 6.4 Blick in die Tiefe | 4:22 to 4:30 | 8.2 s | Vertigo: dolly zoom down the shaft | hatch rim / chain, rings / depth |
| 6.5 Sieben Uhr | 4:30 to 4:33 | 3.1 s | The clock tower strikes seven | roofs / clock tower / sky |
| 6.6 Entschlossen | 4:33 to 4:36 | 2.8 s | Emil decides | Emil's face / hatch / roofs |
| 6.7 Der Sprung in den Schacht | 4:36 to 4:38 | 2.3 s | The jump into the shaft | hatch / Emil / pump house |

### 7 Der Schacht (4:38 to 5:04)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 7.1 Die Kette | 4:38 to 4:42 | 3.6 s | The chain: from above, Emil drops away into the depth | chain / Emil / shaft rings |
| 7.2 Funkenflug | 4:42 to 4:45 | 3.3 s | Sparks fly at the hook, daylight far above | chain / Emil / hatch opening |
| 7.3 Das Grubengleis | 4:45 to 4:51 | 6.5 s | The mine gallery: a cart rushes past (slow motion) | timber props / Emil / cart |
| 7.4 Weiter hinab | 4:51 to 4:55 | 3.8 s | Down and down, lamps rush past his face | Emil / rings / lamps |
| 7.5 Durchbruch | 4:55 to 4:58 | 2.5 s | Breakthrough into the vault of the machine hall | vault ribs / Emil / heart |
| 7.6 Die Halle | 4:58 to 5:02 | 4.3 s | The hall: glow river, wall gears, the heart | gears / Emil on the chain / heart |
| 7.7 Absprung | 5:02 to 5:04 | 2.2 s | Drop onto the catwalk | catwalk / Emil / hall |

### 8 Die Maschinenhalle (5:04 to 5:50)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 8.1 Staunen | 5:04 to 5:08 | 3.7 s | Awe | Emil's face / catwalk / hall |
| 8.2 Die große Halle | 5:08 to 5:15 | 7.0 s | Crane up and out: the scale of the hall | Emil / catwalk / heart, glow river |
| 8.3 Am Glutfluss | 5:15 to 5:17 | 2.3 s | Workers at the glow river | rim / workers / wall |
| 8.4 Über den Steg | 5:17 to 5:20 | 3.1 s | Along the catwalk | railing / Emil / hall |
| 8.5 Das Ventil | 5:20 to 5:24 | 3.2 s | A valve bursts, steam across the catwalk | valve / steam / Emil |
| 8.6 Der Automat | 5:24 to 5:29 | 5.9 s | A brass automaton blocks the way | automaton / Emil / hall |
| 8.7 Das goldene Auge | 5:29 to 5:32 | 2.5 s | Its eye turns golden | automaton / eye / heart |
| 8.8 Die Verbeugung | 5:32 to 5:36 | 3.9 s | It bows and steps aside | automaton / Emil / gears |
| 8.9 Die Lücke | 5:36 to 5:43 | 7.2 s | The gap in the catwalk: a jump | pipe / Emil / hall depth |
| 8.10 Das Herz | 5:43 to 5:50 | 7.4 s | The heart in front of him, dim and flickering | Emil / platform / heart |

### 9 Das Herz (5:50 to 8:21)

| Shot | Film time | Length | Action | FG / MG / BG |
| --- | --- | --- | --- | --- |
| 9.1 Zum Sockel | 5:50 to 5:56 | 5.5 s | To the socket | heart / Emil / hall |
| 9.2 Der alte Kern | 5:56 to 5:58 | 2.4 s | The old core, burnt out | old core / platform / heart |
| 9.3 Der müde Herzschlag | 5:58 to 6:02 | 3.2 s | The tired heartbeat | pistons / column / heart |
| 9.4 Der Kern | 6:02 to 6:08 | 6.8 s | The new core in his hands, light on his face | core / Emil / catwalk |
| 9.5 Einsetzen | 6:08 to 6:12 | 3.3 s | The core goes into the socket | Emil / hands / socket |
| 9.6 Stille | 6:12 to 6:15 | 3.4 s | Silence | hands / socket / heart |
| 9.7 Das Herz erwacht | 6:15 to 6:19 | 4.2 s | The heart wakes: rings spin, pistons pump | catwalk / heart / hall |
| 9.8 Die Lichtwelle | 6:19 to 6:22 | 3.0 s | The wave of light rolls through the hall | hall floor / steam / heart |
| 9.9 Jubel | 6:22 to 6:26 | 3.6 s | Joy | Emil / steam / hall |
| 9.10 Die Halle lebt | 6:26 to 6:29 | 3.1 s | The hall lives: crane up | Emil / heart / hall |
| 9.11 Licht im Schacht | 6:29 to 6:32 | 3.0 s | The light races up the shaft | ladder / rings / hatch far above |
| 9.12 Die Luke glüht | 6:32 to 6:37 | 5.0 s | A golden steam column out of the hatch | roof / hatch column / sky |
| 9.13 Die Marktgasse erwacht | 6:37 to 6:44 | 7.0 s | The market street lights up | people / lamps, shops / clock tower |
| 9.14 Wachtmeister Brummer | 6:44 to 6:51 | 7.0 s | Brummer looks up and smiles | Brummer / street / sunset |
| 9.15 Der Uhrturm | 6:51 to 6:57 | 6.0 s | The clock tower glows | roofs / clock tower / sky |
| 9.16 Das Luftschiff | 6:57 to 7:03 | 6.0 s | The airship with all its lights | airship / city / horizon |
| 9.17 Emil auf dem Dach | 7:03 to 7:12 | 9.0 s | Later: Emil on the parapet, the cat beside him | roof / Emil, cat / city |
| 9.18 Emil und die Katze | 7:12 to 7:18 | 6.0 s | Emil and the cat | Emil / cat / roofs |
| 9.19 Dampfstadt bei Nacht | 7:18 to 7:31 | 13.0 s | Dampfstadt at night, the camera rises, fade out | Emil / roofs / city, sky |
| Abspann | 7:31 to 8:19 | 48.0 s | End credits |  |
