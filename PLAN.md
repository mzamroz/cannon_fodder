# Cannon Fodder v2 — plan rozbudowy Tiny Front

Stan wyjściowy: przeglądarkowy oddział 4 żołnierzy, point-and-click, granaty, 3 palety biomów, 4 typy misji, zapis. Brakuje tożsamości Cannon Fodder: spawnu z budynków, permadeath, rang, podziału drużyny, friendly fire, rakiet, pojazdów, hazardów biomów i sterowania mobilnego.

## 0. Zasady implementacji

- Branch: `cursor/wersja-2-c8a4`.
- Istniejące testy zostają zielone (ten sam seed, 4 żołnierzy na misję, ewakuacja, zapis).
- Zapis: `VERSION=2` (nowe pola kampanii, hazardów i pojazdów).
- Woda staje się przeprawą wpław (koszt ścieżki wysoki — mosty nadal preferowane), a nie ścianą.

## 1. Kampania, permadeath, wzgórze

- Pula **360** ochotników z unikalnymi imionami (JOOLS, JOPS, STOO, RJ i dalsza kolejka).
- Na misję wyrusza **4**. Polegli znikają na zawsze; luki uzupełnia kolejka.
- **Hill of Heroes** na odprawie: nagrobki + licznik rekrutów / poległych.
- Wyczerpanie puli = **Game Over** kampanii.
- Ocalali awansują (szer. → gen.): celność, cooldown, zasięg autoognia.
- Raport: tablica **Home Team vs Away Team** (zabici wrogowie vs straty własne).

## 2. Oddział i zwiad

- Grupy: **Split** (połowa), **Lasso**, **Merge All**, Tab cykluje pododdziały.
- Zwiad: przeciągnięcie mapy / WASD odłącza kamerę; przycisk **Center** (F) wraca na dowódcę.

## 3. Broń i ogień bratobójczy

- KM: nieskończona amunicja, bez FF.
- Granat + **rakietnica** (osobny zapas, skrzynki). Drag-and-release z łukiem trajektorii.
- Wybuchy i rozjechanie **ranią wszystkich** w promieniu, w tym swoich.
- Posterunki-spawnerzy: wróg wychodzi, dopóki budynek stoi (interwał ~8 s, limit żywych).

## 4. Biomy, hazardy, pojazdy

| Biom | Mechanika |
|---|---|
| Dżungla | pływanie (wolno, bez broni), bambus |
| Pustynia | ruchome piaski, jeepy |
| Śnieg | lód (poślizg), zaspy |
| Baza | ciasne korytarze, drzwi-spawner, turrety IR |

- Miny (niewidoczne z daleka), działka, dżip / czołg / helikopter / turret (E lub tap).
- Czołg na lodzie grozi zapadnięciem.

## 5. Sterowanie mobilne

- Lewy kciuk: wirtualny joystick (tam, gdzie palec) albo krótkie stuknięcie = tap-to-move.
- Prawy: twin-stick ognia z aim assist w stożku.
- Przytrzymaj granat/rakietę → przeciągnij celownik → puść.
- Swipe po mapie = zwiad. Split / Lasso / Merge / Center na HUD.

## 6. Kolejność prac

1. Silnik: tiles, koszt ścieżki, spawn, rangi, kampania, hazardy, pojazdy.
2. Zapis v2 i pętla gry (FF, grupy, zwiad, rakiety).
3. UI: wzgórze, tablica, HUD mobilny.
4. Testy nowych mechanik + regresja `npm test`.
5. Weryfikacja w przeglądarce (odprawa, walka, split, granat FF, mobile layout).
