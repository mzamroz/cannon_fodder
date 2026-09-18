# Tiny Front

Przeglądarkowa gra taktyczna inspirowana klasycznym Cannon Fodder, z własną proceduralną grafiką pixel art i dźwiękami. Czteroosobowy oddział z puli 360 ochotników, nieskończona kampania, permadeath, rangi, medale, Boot Camp i sterowanie pod mysz oraz ekrany dotykowe.

## Uruchomienie

Wymagany Python 3. Bez instalowania paczek:

```sh
python3 -m http.server 5173
```

Otwórz http://localhost:5173. Można też użyć `npm start`. Pliki są statyczne, więc można je udostępnić na dowolnym hostingu statycznym. Serwer HTTP jest konieczny do wczytania modułów JavaScript.

## Sterowanie

- Lewy przycisk myszy: rozkaz ruchu. Oddział idzie **wężem za dowódcą**. Kliknięcie żołnierza: on prowadzi grupę.
- Przytrzymany prawy przycisk myszy: ogień w kierunku kursora. Żołnierze też automatycznie strzelają do widocznych wrogów w zasięgu (zależnym od rangi).
- G: granat; R: rakieta. Zasięg 340 / 520. Wybuchy ranią **wszystkich** w promieniu, w tym własny oddział i cywilów. Posterunki i bramy pada **tylko** od ładunków.
- X: Split (dzieli wybraną grupę na pół). C: Merge (scala grupy w pobliżu). Tab: kolejny pododdział. Shift+przeciągnięcie: lasso.
- 1–4: wybór pojedynczego żołnierza. Q: wybór wszystkich.
- E: wsiądź / wysiądź z dżipa, czołgu, helikoptera lub wieżyczki.
- WASD / strzałki: zwiad — kamera odłącza się od oddziału. F albo przycisk **CENTRUJ**: powrót na dowódcę.
- Kliknięcie minimapy: przeniesienie kamery. **M** albo **UKRYJ** chowa mapę taktyczną; **MAPA TAKTYCZNA** w rogu albo ponowne **M** ją przywraca. Preferencja zostaje w przeglądarce.
- Spacja / P / Escape: pauza. Utrata fokusu automatycznie pauzuje grę.

### Ekran dotykowy

- **RUCH** — stuknięcie na mapie wysyła oddział w to miejsce. Stuknięcie żołnierza czyni go dowódcą grupy.
- **OGIEŃ** — przytrzymaj palec, żeby strzelać w tym kierunku. Żołnierze też sami ostrzeliwują wrogów w zasięgu.
- Przytrzymaj GRANAT / RAKIETA i przeciągnij, by zobaczyć łuk trajektorii; puszczenie palca oddaje strzał.
- **POJAZD** — wsiądź albo wysiądź z dżipa, czołgu, helikoptera lub wieżyczki. Jeśli jesteś dalej, oddział sam podejdzie do najbliższego pojazdu. Możesz też stuknąć pojazd na mapie.
- Minę albo pułapkę bambusową zestrzelisz z dystansu w trybie OGIEŃ — przy kontakcie nadal wybuchają.
- PODZIEL, SCAL, LASSO: zarządzanie pododdziałami. CENTRUJ wraca kamerę na oddział. MAPA chowa lub przywraca minimapę. Kliknięcie minimapy przenosi zwiad.

## Kampania i cele

Pula **360 ochotników**. Między misjami jest **mapa teatrów** — stąd wyruszasz, wchodzisz na *Hill of Heroes* albo do **Boot Campu**. Trening nie awansuje, ale polegli znikają na zawsze. Na misję wyrusza czterech. Ocalali awansują od szeregowego do generała i mogą dostać medale (gwiazda za 3★, krzyż za 8 zabójstw, serce za przeżycie straty). Gdy kolejka się wyczerpie, kampania kończy się definitywnie.

Kolejne misje przeplatają cztery zadania:

- **Rozpoznanie bojem:** wyeliminuj garnizon i zniszcz wszystkie posterunki.
- **Uderz i zniknij:** zniszcz posterunki i ewakuuj ocalałych; patrole można ominąć.
- **Powrót do domu:** zabezpiecz pozycję jeńca przez 3 sekundy bez wroga w pobliżu, a następnie wróć ocalałymi do ewakuacji. Odejście albo wróg w strefie cofa postęp.
- **Cisza w eterze:** przejmij dwie radiostacje. Odejście albo wróg w strefie **cofa** przejmowanie — często trzeba podzielić oddział.

Wróg **wylewa się z posterunków** przez przesmyk w stronę lądowania, dopóki bunkier stoi. KM bunkra nie weźmie — tylko granat albo rakieta. Ładunków jest mniej więcej tyle, ile bunkrów; od misji 3 nie ma darmowego zrzutu w lądowaniu. Cywile błąkają się po dżungli i pustyni: zabicie to −200 i zły smak zwycięstwa.

Zielony krąg wyznacza ewakuację. Muszą wejść do niego **wszyscy żywi żołnierze**. Cele pokazują minimapa i strzałki na brzegu ekranu.

Mapy mają różne wymiary i proporcje: od polan około 30×24 pól po wąwozy około 58×24. Generator obraca i odbija układy. Kamera, minimapa i wyszukiwanie drogi używają rzeczywistych wymiarów mapy.

Cztery biomy kręcą się w kampanii:

- **Dżungla:** gęste drzewa, pływanie (wolno i bez broni), pułapki bambusowe. Miny i bambus detonują przy kontakcie; można je zestrzelić z dystansu.
- **Pustynia:** mało osłon, ruchome piaski wciągają stojących, dżipy.
- **Śnieg:** zaspy spowalniają, lód wydłuża hamowanie; ciężki czołg może się zapaść.
- **Baza:** ciasne korytarze, drzwi-spawnerzy, wieżyczki na podczerwień. Rakieta w pomieszczeniu to samobójstwo.

Trudność rośnie stopniowo przez pierwsze 13 misji: od 8 do 32 przeciwników, nieco szybszy ruch, krótsze przerwy między strzałami i większe obrażenia. Od misji 2 zwiadowcy (») obchodzą flankę; od 3 strzelcy (⌖) mają większy zasięg, ale przed strzałem pokazują linię celowania przez 0,9 sekundy; od 6 ciężcy (Ⅱ) poruszają się wolniej i strzelają częściej. Osłony przerywają celowanie. Poziom zagrożenia ma limit 13; kampania dalej zmienia mapy i cele.

Apteczki przywracają całemu oddziałowi 40 HP, skrzynki dodają 3 granaty albo 2 rakiety. W misjach 1–2, gdy zużyjesz granaty, jedna skrzynka wraca do lądowania. Później trzeba oszczędzać ładunki na bunkry i bramy.

Wynik: 100 punktów za przeciwnika, 300 za posterunek, 250 za każdego ocalałego, 500 za czas premiowy oraz 100 za nowy medal. Zabity cywil to −200. Trzy gwiazdki nagradzają wykonanie misji, powrót całej czwórki i czas premiowy. **Nie ma porażki za przekroczenie czasu.** Ponowienie misji odtwarza teren i cofa punkty zdobyte podczas tej próby; poległych z zakończonej próby nie wraca.

Link z `?seed=12345&mission=2` odtwarza początkowy układ wybranej misji (bez parametru `mission` jest to misja 1). Ikona obok ziarna kopiuje taki link. Przebieg walki jest dynamiczny i nie jest deterministyczny. Link do innej mapy otwiera jej odprawę; poprzedni zapis zostaje zastąpiony dopiero po rozpoczęciu operacji lub ręcznym zapisaniu. Odświeżenie linku zgodnego z zapisem wczytuje postęp.

## Zapis postępów

Gra automatycznie zapisuje postęp co 5 sekund rozgrywki, przy pauzie, ukryciu lub opuszczeniu strony oraz przy rozpoczęciu i zakończeniu misji. Przycisk **ZAPISZ** na górnym pasku pozwala zapisać grę w dowolnym momencie. Zapis v3 obejmuje kampanię (rekrutów, rangi, medale, groby), mapę, bramy, cywilów i pojazdy. Starsze zapisy v2 wczytują się z pustymi medalami.

Po ponownym otwarciu gry zapis wczytuje się automatycznie. Trwająca misja czeka na pauzie — kliknij **KONTYNUUJ GRĘ**. Dostępny jest jeden zapis w pamięci lokalnej tej samej przeglądarki (`localStorage`). Przycisk **Nowa kampania** zastępuje zapis po potwierdzeniu.

## Sprawdzenie

```sh
npm test
```

Testy sprawdzają generator, formację-żmiję, Boot Camp, cywilów, medale, bramy, ciasny zapas ładunków, kampanię 360 rekrutów, permadeath, rangi, split/merge, ogień bratobójczy, spawn z budynków, zapis v3 oraz dotychczasową progresję, ewakuację i walkę. Gra korzysta z Canvas 2D, ES modules i Web Audio. Zewnętrzne fonty są opcjonalne — bez sieci używane są fonty systemowe.
