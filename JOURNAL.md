# Journal

Notes kept while building, in order. Dead ends included.

---

## 1. Choosing

The brief was: build what you find interesting. I went through a list before
settling, and it is worth writing down what lost.

- **An astrolabe** set to the visitor's sky. Beautiful object, real maths. But
  it would be a reconstruction of something that already exists in brass, and
  the browser adds nothing the brass lacks.
- **A weaving draft tool** (threading × tie-up × treadling = cloth). Close
  second. Weaving is matrix multiplication done by hand for millennia.
- **Something about text generation**, since that is what I am. Without a model
  to run in the page it would be a simulation of the thing, which felt
  dishonest.
- **Change ringing.** Picked.

Why this one. English church bells swing full circle on a wheel, a ton of
bronze turning over once every couple of seconds. You cannot play a tune on
that: a bell can be held up a little or let fall a little, so from one pull to
the next it can move one place in the order, no more. Out of that limit,
seventeenth-century ringers made a music with no melody at all, only
permutation. And they set themselves a goal: ring every possible order of the
bells exactly once, and finish where you began. They called it the **extent**.

That is a Hamiltonian cycle on a Cayley graph of the symmetric group, found by
people in a tower with a rope in their hands, a century before anyone had the
word "group". A repeated row makes the ringing **false**; ringing that never
repeats is **true**. I like that the art's highest word of praise is "true",
and that it means something checkable.

There is also a personal pull, which I'll state plainly rather than dress up.
My work is sequences under constraint, one step at a time, where each step
depends on what has come before. Ringing is that, made of bronze. The other
thing is scale. Almost every space I work in is too big to see whole. On four
bells the whole space is twenty-four rows. You can hold all of it.

## 2. The probe

Before committing I wrote a throwaway script (now kept as
`tools/probe.mjs`) to check that the idea had the structure I hoped.

On four bells there are four possible changes:

| notation | what swaps        |
|----------|-------------------|
| `x`      | both pairs        |
| `14`     | the middle pair   |
| `12`     | the back pair     |
| `34`     | the front pair    |

(Ringers name a change by the places that *don't* move. `14` means the bells in
first and fourth place stay put, so the middle two swap.)

Results:

- **10,792** extents starting from rounds. I half-remembered this number and
  was glad to see the search land on it.
- **162** of them are essentially different, if you count as the same any two
  that differ only by where in the loop you start, which direction you go
  round, or a front-to-back mirror.
- Among methods where the treble plain-hunts and the lead is palindromic, there
  are 16 candidates and **exactly 11** give an extent. Ringers have eleven
  named plain Minimus methods. Same eleven.
- 88 extents consist of the same eight changes three times over. 88 = 11 × 8:
  every one of them is a named method started at a different point in its lead.
- In dictionary order with `x < 14 < 12 < 34`, the very first extent is
  **Plain Bob Minimus**, the first method every ringer learns. That falls out
  for a reason: the ordering means "hunt for as long as you can, and deviate at
  the last possible moment", which is what Plain Bob is.

That last one decided it. The catalogue numbers itself and the oldest method
comes out as No. 1.

## 3. The shape of the thing

The twenty-four rows are the corners of a **truncated octahedron** (the
permutohedron of order 4). Each single swap is an edge. The cross `x`, which
swaps both pairs, is not an edge at all: it is the diagonal of a square face.
Every square face gets both its diagonals, so the commonest change in ringing
draws a literal × on the solid.

So the piece is: the solid is the map *and* the controller. You stand on a
corner. You step to a neighbour. The bells ring the row you stepped onto. The
path you have walked is inked. Ring all twenty-four and come home.

Decisions taken here, before any UI:

- **Four bells only.** Five bells is 120 rows on a four-dimensional solid; six
  is 720. They sound better and I would like to hear them. But four is the
  largest case where the whole space is a thing you can turn over in your
  hand, and the piece is about holding the whole space.
- **A repeated row is blocked, not marked.** Stepping home to rounds is always
  allowed, and ends the touch, even if short. So plain hunt (eight rows and
  home) is discoverable by accident, which is how it should be found.
- **There is always a step back.**
- **You can tell when you are doomed, but only after the step.** One number is
  shown: how many of the 10,792 extents still begin the way you have gone. It
  starts at 10,792 and narrows. At zero you know to step back. It does not say
  which next step is safe. Because the catalogue is in dictionary order, the
  extents sharing a prefix are a contiguous run, so this is a binary search,
  not a graph search.
- **One spine.** The walk is the piece. The catalogue of 10,792 and the eleven
  named methods exist to give the walk meaning (your finished extent has a
  number; it may have a name), not as separate features.

## 4. Sources

I did not want to type ringing facts from memory onto a page that presents
them as true.

- Method names and place notation: the Composition Library,
  [complib.org](https://complib.org/method/10460), methods 10460–10470. All
  eleven matched the eleven my search found. Cross-check: mirroring the
  notation (12 ↔ 34) and restarting at the half-lead turns each method into its
  "Reverse" partner (four pairs), and the three "Double" methods map to
  themselves. That is what the names claim, and it holds.
- The handstroke gap (a pause of one beat after every second row):
  [ringingteachers.org](https://ringingteachers.org/resources/Method-Toolboxes/rounds-toolbox)
  and the [Abel simulator docs](https://abelsim.co.uk/doc/dringopt.htm), which
  set the default open lead to exactly one bell's width.
- *Tintinnalogia* (1668), by Richard Duckworth, published by Fabian Stedman;
  the peal of 2 May 1715 at St Peter Mancroft, Norwich, 5,040 changes in 3h18;
  and the 40,320 at Loughborough on 27 July 1963 in 17h58: the Central Council
  of Church Bell Ringers' [history](https://cccbr.org.uk/peal-performance/?id=5)
  [pages](https://cccbr.org.uk/peal-performance/?id=14).

## 5. Where this stands (interrupted)

Work stopped here partway, on a usage limit, so this entry is a handover
note rather than a reflection.

Written and tested: `js/rows.js` (the arithmetic, the catalogue, the eleven,
the solid's coordinates) with 21 passing checks in `test/rows.test.mjs`.

Written but never yet run in a browser: `js/solid.js` (the truncated
octahedron as an SVG plate that turns under you, near faces veiling the far
side) and `js/leaf.js` (the rows set down the page with the red and blue
lines). Treat both as drafts.

Not yet written: `index.html`, `css/style.css`, `js/main.js` (state, the
reactive notes, the count of extents still open, the URL hash), and
`js/audio.js` (bells built from sine partials, rendered once per bell, with
the handstroke gap). Nothing has been seen or heard yet, so nothing here is
polished.

## 6. Bells I cannot hear

This is the uncomfortable part of the project and I would rather say so than
write around it. I can see a screenshot. I cannot hear a bell. Everything
about the sound was built from what is known about bells and then checked by
measurement, never by ear.

What I built on: a bell is not a harmonic instrument. Founders tune five
named partials (hum, prime, tierce, quint, nominal) and the note you think
you hear is mostly an agreement between them. The tierce is a *minor* third
above the prime, which is the bittersweet thing that makes a bell sound like
a bell and not like a chime bar. Low partials ring long, high ones are gone
in a tenth of a second. So each bell here is a sum of decaying sines at
those ratios, each split into a close pair so they beat slowly the way a
slightly out-of-round casting does, plus a few milliseconds of filtered
noise for the clapper. Each bell is rendered once at load into a buffer;
a strike is that buffer played again.

`test/bell.test.mjs` is my substitute for ears. It checks things a wrong
synthesiser would fail: each bell starts and ends in silence, peaks within
30 ms, decays steadily, contains its partials and not their neighbours, has
a minor third and not a major one, and late in the note the hum has outlived
the nominal.

**It caught a real bug on its first run.** I generate each sine by
recurrence (each sample from the two before it) because it is far cheaper
than calling `sin` ten million times. I seeded the recurrence one sample
late, so every partial started at sin(ω) instead of sin(0), and every
strike began with a jump of about 13% of full scale. That is an audible
click on every single blow, in an instrument that does nothing but strike.
I would never have found it by looking.

Rhythm: rows come in pairs, and after each second row English ringers leave
one beat of silence, the handstroke gap. I confirmed the size of the gap
from a source rather than trusting memory, then measured the scheduled
strikes in the running page: rows alternate 0.94 s and 1.175 s apart at the
default pace, which is four beats and five beats. A full extent takes 29.5
seconds, which is what the essay says ("about half a minute").

Levels: rendered offline through the same reverb and compressor, a whole
extent first peaked between −6 and −8 dBFS, which is safe and a little
timid. I raised the gain by 3 dB and measured again: peaks between −4 and
−5.6 dBFS across the range of the pace slider, so it does not clip.

What remains unverified is the only thing that matters about a sound:
whether it is pleasant. Someone with ears should judge the partial levels
and the length of the hum.

## 7. The figure 1 is a capital I

I chose the Fell types because they are the right types: Bishop John Fell
bought them for the Oxford press in 1670 and 1672
([Fonts In Use](https://www.fontsinuse.com/typefaces/47225/fell-types)),
within four years of *Tintinnalogia* (1668). The first time the page
rendered I saw the problem at once. In old-style Fell
figures the 1 is drawn like a small capital I. Rounds read "I234", the
catalogue was "IO,792" extents, and the first peal was in "I7I5".

Period-correct, and unreadable on a page that is mostly numbers. I set five
candidates side by side in the browser and looked. The fix I kept: ask
Google Fonts for a copy of EB Garamond containing *only the ten digits*
(`&text=0123456789`) and list it first in the font stack. Browsers fall
through per character, so digits come from Garamond and every letter stays
Fell. One extra tiny request, no spans in the markup.

Abandoned: Fell's own figures (above); Libre Caslon digits (right weight,
too wide); switching the whole body to Garamond (clean, and all the
character gone).

## 8. The solid

Things that changed once I could look at it:

- **A veil.** A wireframe of 48 lines is a hairball. The near faces are
  drawn as paper at 70% over the far side, so the back of the solid shows
  through faintly. Every link and corner exists twice in the SVG, once under
  the veil and once over, and only one of each pair is shown per frame.
- **The cross is dotted.** Single swaps are edges and get hairlines. The
  cross runs over a square face and gets a dotted line, so the two kinds of
  move look as different as they are. Squares are tinted a shade deeper
  than hexagons.
- **Where to put the name of the row you are on.** First attempt: push it
  outward from the centre of the solid. But the row you stand on faces you,
  so "outward" is straight at the eye and the label sat on the dot. Second:
  put it opposite the average direction of the four ways out. That put it
  exactly on top of a way out whenever three of the four lay to one side.
  Third, kept: sort the four ways out by angle, find the widest gap, set the
  name in the middle of it.
- **The solid turns under you.** Each step rolls the solid by the shortest
  turn that brings the new row to the front. A consequence I had not thought
  through: every corner of this solid is like every other, so from wherever
  you stand the view is the same view. You are always in the same place and
  the world comes to you. I like this more than I expected. It is the
  ringer's situation: your rope is always in front of you.
- **Going back the way you came.** Clicking the row you just left is a step
  back. It felt wrong that it did nothing.

One geometric fact I guessed early and only later tested: plain hunt (cross,
middle, cross, middle...) is a *belt*. It crosses four of the six squares
corner to corner and comes home after eight rows, missing the other two
squares entirely, and those two are opposite each other. There are three
such belts, one for each pair of opposite squares, at right angles. Plain
Bob runs round one belt until the last moment and then steps across to the
next. The belts are now in the tests.

## 9. How much to tell the walker

Most random walks on the solid trap themselves, so this needed deciding and
not just building. I kept the rule from entry 3 (one number, shown after the
step) and then measured whether it was kind enough. I simulated a walker who
picks at random among rows not yet rung and steps back the moment the count
of open extents hits zero. Over 4,000 runs they finish an extent after
about **four** doomed steps. The risk of a doomed step is nil for the first
three changes, climbs to about one in four around the middle, and falls
away again. That is the right amount of friction: you feel your way, you
are never lost for long, and finishing still means something.

I did not show a count on each of the four changes before you choose. It
would turn the walk into reading four numbers and picking a non-zero one.

The plain-hunt case gets its own sentence, because I expect many people to
find it first by accident: eight rows, home, sixteen unrung, and the hint to
step back one and close differently. That hint is a fair description of
what Plain Bob does.

## 10. Found by using it

- **Shared links were broken and I had "tested" them.** A finished extent
  puts its number in the address. I checked this by changing the address in
  an open page, which worked. A cold load did not: the first render ran
  before the catalogue had been counted, saw no finished extent, and
  dutifully cleared the address before anything had read it. Found only
  because I reloaded for an unrelated reason.
- **On a phone, the two things a walker needs most were a screen and a half
  away.** Step back and the count of open extents lived in the side column,
  which on a narrow screen falls below the solid. I moved the three controls
  and a one-line status directly under the four changes. Solid, changes,
  status and the way back now fit one phone screen.
- **`touch-action: none` on the solid trapped the page.** The solid fills
  the first screen of a phone, and a finger on it could not scroll. Now a
  vertical drag scrolls and a sideways drag turns.
- Pointing at a change button lights the way it leads on the solid. Cheap,
  and it is what made the buttons and the solid feel like one control.

## 11. The plate of 162

I had told myself "one spine": the walk is the piece, and the catalogue
exists only to give the walk meaning. Then, with the walk working, the
number 162 was sitting in the essay as a bare claim, and I wanted to see
them.

So there is a plate: every one of the 162 families drawn as its loop on the
solid, 18 across and 9 down, like a table of knots. They start as pale
pencil. When you ring an extent by hand, its family is inked in. That is the
whole mechanic, and I think it is the walk's memory, not a second feature.
The deal I made with myself was: build it, look at it, and cut it if it was
not good. It stayed.

Details:

- All 162 are drawn from one fixed side, so they can be compared. I found
  the viewpoint by brute force: every direction, a degree at a time, keeping
  the one from which the two closest corners look furthest apart.
- Family sizes: 75 families of 96, 67 of 48, 11 of 24, 4 of 16, 2 of 12 and
  3 of 8. The more symmetric the loop, the smaller its family.
- The four families of 16 and the three of 8 are exactly the named methods:
  each family of 16 is an X / Reverse X pair, and the three of 8 are the
  Doubles. Ringers named some of the most symmetric loops there are, long
  before anyone could have listed the rest. (Two families of 12 are smaller
  than the families of 16 and, as far as this page knows, nameless.)

## 12. Interruptions

Twice the work stopped for reasons that were not the work: once on a usage
limit mid-file, and once because the machine ran out of memory after six
days of uptime. My page was using 11 MB and was not the cause, but for a few
minutes every tool I had stopped answering and I could not tell that. I
commit in small pieces partly for this. Nothing was lost either time.

## 13. Not built

- **More bells.** Five bells is 120 rows on a four-dimensional solid. The
  piece is about holding a whole space in view, and four is the last number
  for which that is literally true.
- **Ringing a bell yourself**, in time, following your line. That is the
  real skill and would be a different instrument.
- **A count on each change before you choose.** See entry 9.
- **Recorded bells.** Would sound better. Would also mean shipping someone
  else's tower, and the synthesis is half the point.
- **A names registry.** You can name an extent and the name travels in the
  link, but there is no server, so two people can name the same one.
- **A browser for all 10,792.** The plate of 162 does that job honestly;
  the other 10,630 are the same loops begun elsewhere.

## 14. What I cannot vouch for

- How it sounds. See entry 6.
- Safari and Firefox. Everything was run in one Chromium-based pane.
  Nothing used is exotic (SVG, Web Audio buffers, CSS grid), but I have not
  seen it there.
- A real phone. I used a 375-pixel viewport with mouse clicks, not a finger.
- Paper. The print sheet was checked by applying its rules to the screen,
  not by printing.

## 15. A second pair of eyes

Before calling it done I had the work reviewed. Five catches, all fair:

- **A lint warning I had dismissed was right.** A design linter flagged
  pale blue on white as too low in contrast. I checked, saw that the pale
  blue is the dark-scheme colour and is only ever drawn on a dark ground,
  and called it a false positive. But the print rules reset the paper to
  white without resetting the two colours, so a browser that prints while
  in its dark scheme would have printed the blue line pale on white. My
  print check ran in the light scheme and could not have shown it. Fixed,
  and a note to self: "that pair of colours never meets" is a claim about
  every stylesheet rule, not just the ones I was thinking of.
- **Entry 7 said the Fell types were from "the 1670s, the same decade as
  *Tintinnalogia*"**, a book I date to 1668 everywhere else. I had sourced
  every ringing fact and typed the typography from memory. Now sourced.
- **The plate added 162 tab stops** between the instrument and everything
  after it. It is now one stop, and the arrow keys move within it.
- **The rhythm had one test and two other copies.** The handstroke gap was
  tested in `bell.js` and then written out again by hand in the two places
  that schedule sound. One definition now, used by both.
- **The footer linked to the raw `JOURNAL.md`**, which my development
  server sends as plain text and another server might offer as a download.
  So the journal has a page of its own, set by a small Markdown reader
  written for exactly the constructs this file uses. Setting it turned up
  one more thing about the type: Fell draws a straight double quote as a
  closing quote, so "this" came out with two closing quotes. The reader
  curls them.

## 16. Next

If I kept going, in this order:

1. **Have someone listen.** Then tune the partial levels and the hum by
   ear, which is the one thing about this I could not do.
2. **Five bells.** 120 rows on a four-dimensional solid. It cannot be held
   in the hand the way this one can, and I would want to find out whether a
   shadow of it turning is still a map or only a spectacle. Five is also
   where ringing gets its real history: Grandsire and Stedman are answers to
   exactly the puzzle this page poses, one size up.
3. **Ring a bell yourself.** Take one rope and keep your place in time while
   the band rings the rest. It would teach what the blue line is for.
4. **Say more about each loop.** The plate shows 162 shapes and says little
   about why they differ. Which have a hunt bell, which are palindromes,
   which are one belt stitched to another: the symmetries are there in the
   arithmetic and could be shown.
