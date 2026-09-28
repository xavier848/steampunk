# DAMPFSTADT: design and shot list

A real time animated short (9:00) rendered in the browser with Three.js.
Painted, stylised look in the spirit of Arcane. No dialogue: the story is told
through images, music and sound.

## Story

**Dampfstadt** runs on the *Great Heart*, a steam engine the size of a cathedral
buried under the clock tower square. Its brass core is worn out. Every evening
the street lamps flicker a little longer; tonight, when the clock strikes seven,
the heart will stop.

**Emil**, twelve, apprentice to a clockmaker, has finished what his master never
could: a new core, forged from brass and glowing warm in his satchel. Nobody
listens to a child, and the one person who notices him is **Wachtmeister
Brummer**, the constable of the market district, who sees a boy with something
glowing under his arm and draws the obvious conclusion.

Emil runs. Through the market, over a cart, under an awning, across the tram
line, up a ladder and over the rooftops, where no constable can follow, to an
old maintenance hatch on the roof of the pump house. He slides down the chain of
the service shaft into the machine hall, runs across the catwalk to the dying
heart and sets the new core. The rings spin up, the pistons wake, a wave of
light rolls through the hall and up into the city: all lamps of Dampfstadt burn
at once. Down in the market street, Brummer looks up at the shining clock tower
and, for the first time that evening, smiles.

Motifs: the clock tower (always visible in the street shots, the hands creep
toward seven), flickering lamps (the dying heart), the red scarf (Emil's colour
against the petrol and violet shadows), brass and glow (the core, then the
heart, then the whole city).

## Look

* Toon lighting with four soft light bands, coloured shadows (violet, petrol),
  warm key light (orange, gold) and a strong rim light.
* Hand painted surfaces: procedural brush textures (texture array, 16 layers),
  the shading terminator follows the brush strokes.
* Ink lines from depth and normals in dark warm brown, thinner with distance.
* Anisotropic Kuwahara filter (painterly), canvas weave, bloom, light shafts,
  complementary grade (warm highlights, cool shadows), vignette.
* Layered haze into depth, painted dusk sky with stepped cumulus clouds.
* Characters with bold silhouettes, exaggerated proportions, painted faces.

## World layout (metres, y up, north = -z)

| Place | Where |
| --- | --- |
| Marktgasse (market street) | x = 0, from z = +120 (south) to z = -150, road 10 m, pavements 3.4 m, tram line in the middle |
| Kesselstrasse (tram cross street) | z = -30, east to west |
| Schmiedegasse (alley of the slow motion jump) | z = -100, 6 m wide |
| Uhrturmplatz (clock tower square) | z = -150 to -210, clock tower at z = -215 |
| Kuppelhaus (domed building with clock) | west side of the square |
| Fabrikviertel (factory district) | east, x = +160 to +420 |
| Ankermast (airship mooring mast) | north east, x = +150, z = -300 |
| Cathedral spires | far north west (painted distance) |
| Ladder | east facade, z = -40 |
| Pump house with the brass hatch | east block roof, z = -118 |
| Service shaft | from the hatch (y = +22) down to the hall ceiling (y = -80) |
| Maschinenhalle (machine hall) | under the square, floor y = -150, 240 x 160 m |
| The Great Heart | hall centre (0, -150, -160) |

## Time

Everything is a function of the film time T. Story time S(T) runs at speed 1
except in slow motion (cart jump, alley jump), so scrubbing, stills and the video
export are deterministic.

## Chapters and shot list

(T = film time in seconds; FG / MG / BG = foreground, middle ground, background.)

### 1 Flug über Dampfstadt (0:00 to 1:10)
| # | T | Shot | FG / MG / BG |
| --- | --- | --- | --- |
| 1.1 | 0 to 12 | Fade in inside clouds, camera glides out over the city | cloud wisps / rooftops, steam columns / clock tower, sun |
| 1.2 | 12 to 26 | Flight along a big airship with a ship hull, bird flock crosses | airship hull and propellers / flock / city |
| 1.3 | 26 to 38 | Title DAMPFSTADT, camera banks over the factory district | chimney tops / white steam columns / mooring mast with airship |
| 1.4 | 38 to 52 | Low flight over roofs toward the clock tower square | chimneys, roofs / domes / clock tower 6:57 |
| 1.5 | 52 to 70 | Glide over the market street, lamps flicker | roof edges / market street crowd / clock tower |

### 2 Die Marktgasse (1:10 to 1:50)
| 2.1 | 70 to 80 | Dive between the roofs into the street, pigeons scatter | eaves / crowd / clock tower |
| 2.2 | 80 to 88 | Camera lands behind Emil walking north | Emil, shoulder / market stalls / clock tower |
| 2.3 | 88 to 94 | Close up: Emil, the core glows, a lamp flickers | Emil's face / lamp / street |
| 2.4 | 94 to 100 | The constable at the kiosk frowns | kiosk / Brummer / crowd |
| 2.5 | 100 to 110 | Eyes meet, the whistle, pigeons fly, Emil runs | Brummer / pigeons / Emil |

### 3 Die Verfolgung (1:50 to 3:05)
| 3.1 | 110 to 122 | Frontal tracking (handheld), crowd parts | passers-by / Emil / Brummer pushing through |
| 3.2 | 122 to 130 | Side tracking through the stalls | stall posts, goods / Emil / facades |
| 3.3 | 130 to 136 | A top hat falls and rolls | rolling hat / Emil's feet / crowd |
| 3.4 | 136 to 144 | Jump over the apple cart (slow motion) | cart / Emil airborne / crowd |
| 3.5 | 144 to 152 | Low under the awning | awning fringe / Emil sliding / stall |
| 3.6 | 152 to 158 | Brummer barges through | crates / Brummer / crowd |
| 3.7 | 158 to 172 | The tram crosses right behind Emil and cuts off Brummer | tram / Emil / Brummer |
| 3.8 | 172 to 185 | Emil looks back, grins, runs on toward the crates | Emil / crowd / crates and ladder |

### 4 Die Leiter (3:05 to 3:50)
| 4.1 | 185 to 193 | Onto the crates | crates / Emil / facade |
| 4.2 | 193 to 212 | Crane shot up the facade, from shadow into golden light | ladder rungs / Emil / roofs, sunset |
| 4.3 | 212 to 224 | Brummer stops at the ladder, whistles, shakes his fist | ladder / Brummer / street |
| 4.4 | 224 to 230 | Emil climbs over the parapet, silhouette against the sun | parapet / Emil / sky |

### 5 Über die Dächer (3:50 to 5:05)
| 5.1 | 230 to 242 | Side tracking across flat roofs, pigeons | chimneys / Emil / roofscape |
| 5.2 | 242 to 250 | The cat watches from a chimney | cat / Emil passing / clock tower |
| 5.3 | 250 to 262 | Along a tiled gable, under the washing lines | laundry / Emil / roofs |
| 5.4 | 262 to 272 | Over the wooden walkway, an airship shadow sweeps by | walkway / Emil / airship |
| 5.5 | 272 to 290 | Alley jump in slow motion, camera orbits | Emil airborne / alley depth / sun |
| 5.6 | 290 to 305 | Landing roll, the clock tower is close | roof / Emil / clock tower 6:59 |

### 6 Die Luke (5:05 to 5:40)
| 6.1 | 305 to 314 | The brass hatch: wheel, gauges | wheel, hands / Emil / pump house |
| 6.2 | 314 to 320 | Steam burst | steam / Emil shielding / roofs |
| 6.3 | 320 to 330 | Vertigo zoom down the shaft | hatch rim / shaft rings / glow |
| 6.4 | 330 to 340 | The bell strikes seven, Emil jumps | Emil / hatch / clock tower |

### 7 Der Schacht (5:40 to 6:20)
| 7.1 | 340 to 352 | Chain slide from above, sparks at the hands | chain / Emil / shaft rings |
| 7.2 | 352 to 360 | Through a grating: pipe gallery, a mine cart | grating / Emil / cart |
| 7.3 | 360 to 368 | Hands and sparks, face lit from below | sparks / Emil |
| 7.4 | 368 to 380 | Descent speeds up, light grows | rings / Emil / glow |

### 8 Die Maschinenhalle (6:20 to 7:10)
| 8.1 | 380 to 388 | Breakthrough, close on Emil | chain / Emil / hall glow |
| 8.2 | 388 to 400 | The wide shot shows the scale | crane / tiny Emil / heart, magma |
| 8.3 | 400 to 412 | Workers look up, the dying heart flickers | workers / automatons / heart |
| 8.4 | 412 to 430 | Swing and drop onto the gantry | gantry / Emil / hall |

### 9 Das Herz (7:10 to 9:00)
| 9.1 | 430 to 450 | Run along the catwalk | railing / Emil / heart |
| 9.2 | 450 to 462 | Up to the socket, the old core is dark | socket / Emil / hall |
| 9.3 | 462 to 474 | The new core goes in | hands, core / Emil / heart |
| 9.4 | 474 to 492 | The heart wakes, light rolls through the hall | rings / pistons / lamps |
| 9.5 | 492 to 505 | Crane to the wide shot | catwalk / heart / hall |
| 9.6 | 505 to 520 | The city lights up, Brummer smiles | lamps / Brummer / clock tower |
| 9.7 | 520 to 525 | Final wide shot, fade out | roofs / city / sky |
| 9.8 | 525 to 540 | End titles | |
