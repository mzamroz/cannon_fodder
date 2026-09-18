# Tiny Front

Przeglądarkowa gra taktyczna inspirowana klasycznym Cannon Fodder, z własną proceduralną grafiką pixel art i dźwiękami. Czteroosobowy oddział z puli 360 ochotników, nieskończona kampania, permadeath, rangi, cztery biomy i sterowanie pod mysz oraz ekrany dotykowe.

## Uruchomienie

Wymagany Python 3. Bez instalowania paczek:

```sh
python3 -m http.server 5173
```

Otwórz http://localhost:5173. Można też użyć `npm start`. Pliki są statyczne, więc można je udostępnić na dowolnym hostingu statycznym. Serwer HTTP jest konieczny do wczytania modułów JavaScript.

## Sterowanie

- Lewy przycisk myszy: rozkaz ruchu. Kliknięcie żołnierza: wybór.
- Przytrzymany prawy przycisk myszy: ogień w kierunku kursora. Żołnierze też automatycznie strzelają do widocznych wrogów w zasięgu (zależnym od rangi).
- G: granat; R: rakieta. Zasięg 340 / 520. Wybuchy ranią **wszystkich** w promieniu, w tym własny oddział.
- X: Split (dzieli wybraną grupę na pół). C: Merge (scala grupy w pobliżu). Tab: kolejny pododdział. Shift+przeciągnięcie: lasso.
- 1–4: wybór pojedynczego żołnierza. Q: wybór wszystkich.
- E: wsiądź / wysiądź z dżipa, czołgu, helikoptera lub wieżyczki.
- WASD / strzałki: zwiad — kamera odłącza się od oddziału. F albo przycisk **CENTER**: powrót na dowódcę.
- Kliknięcie minimapy: przeniesienie kamery.
- Spacja / P / Escape: pauza. Utrata fokusu automatycznie pauzuje grę.

### Ekran dotykowy

- Lewa strona: wirtualny joystick (pojawia się pod palcem) albo krótkie stuknięcie = tap-to-move.
- Prawa strona: twin-stick ognia z aim assist w stożku widzenia.
- Swipe w środku mapy: zwiad. CENTER wraca na oddział.
- Przytrzymaj GRANAT / RAKIETA i przeciągnij, by zobaczyć łuk trajektorii; puszczenie palca oddaje strzał.
- SPLIT, MERGE, LASSO: zarządzanie pododdziałami.

## Kampania i cele

Pula **360 ochotników**. Na misję wyrusza czterech. Polegli znikają na zawsze — na zielonym wzgórzu (*Hill of Heroes*) w odprawie wyrasta nagrobek. Ocalali awansują od szeregowego do generała: rosną celność, zasięg i szybkość reakcji. Gdy kolejka się wyczerpie, kampania kończy się definitywnie.

Kolejne misje przeplatają cztery zadania:

- **Rozpoznanie bojem:** wyeliminuj garnizon i zniszcz wszystkie posterunki.
- **Uderz i zniknij:** zniszcz posterunki i ewakuuj ocalałych; patrole można ominąć.
- **Powrót do domu:** zabezpiecz pozycję jeńca przez 3 sekundy bez wroga w promieniu 150 jednostek, a następnie wróć ocalałymi do ewakuacji.
- **Cisza w eterze:** przejmij dwie radiostacje, utrzymując żołnierza w promieniu 72 jednostek przez 8 sekund przy każdej, i ewakuuj oddział. Wróg w promieniu 150 jednostek zatrzymuje przejmowanie, ale nie kasuje postępu.

Wróg **wylewa się z posterunków**, dopóki budynek stoi. Wysadź go granatem lub rakietą, żeby zatkać spawner. Raport po misji pokazuje wynik w stylu *Home Team vs Away Team*.

Zielony krąg wyznacza ewakuację. Muszą wejść do niego **wszyscy żywi żołnierze**. Cele pokazują minimapa i strzałki na brzegu ekranu.

Mapy mają różne wymiary i proporcje: od polan około 30×24 pól po wąwozy około 58×24. Generator obraca i odbija układy. Kamera, minimapa i wyszukiwanie drogi używają rzeczywistych wymiarów mapy.

Cztery biomy kręcą się w kampanii:

- **Dżungla:** gęste drzewa, pływanie (wolno i bez broni), pułapki bambusowe.
- **Pustynia:** mało osłon, ruchome piaski wciągają stojących, dżipy.
- **Śnieg:** zaspy spowalniają, lód wydłuża hamowanie; ciężki czołg może się zapaść.
- **Baza:** ciasne korytarze, drzwi-spawnerzy, wieżyczki na podczerwień. Rakieta w pomieszczeniu to samobójstwo.

Trudność rośnie stopniowo przez pierwsze 13 misji: od 8 do 32 przeciwników, nieco szybszy ruch, krótsze przerwy między strzałami i większe obrażenia. Od misji 2 zwiadowcy (») obchodzą flankę; od 3 strzelcy (⌖) mają większy zasięg, ale przed strzałem pokazują linię celowania przez 0,9 sekundy; od 6 ciężcy (Ⅱ) poruszają się wolniej i strzelają częściej. Osłony przerywają celowanie. Poziom zagrożenia ma limit 13; kampania dalej zmienia mapy i cele.

Apteczki przywracają całemu oddziałowi 40 HP, skrzynki dodają 3 granaty albo 2 rakiety. W pierwszych trzech misjach jest dodatkowa apteczka. Gdy zużyjesz wszystkie dostępne granaty, zaopatrzenie pojawi się w strefie lądowania, jeśli zostały posterunki.

Wynik: 100 punktów za przeciwnika, 300 za posterunek, 250 za każdego ocalałego oraz 500 za wykonanie zadania w czasie premiowym podanym w odprawie. Trzy gwiazdki nagradzają wykonanie misji, powrót całej czwórki i czas premiowy. **Nie ma porażki za przekroczenie czasu.** Ponowienie misji odtwarza teren i cofa punkty zdobyte podczas tej próby; poległych z zakończonej próby nie wraca.

Link z `?seed=12345&mission=2` odtwarza początkowy układ wybranej misji (bez parametru `mission` jest to misja 1). Ikona obok ziarna kopiuje taki link. Przebieg walki jest dynamiczny i nie jest deterministyczny. Link do innej mapy otwiera jej odprawę; poprzedni zapis zostaje zastąpiony dopiero po rozpoczęciu operacji lub ręcznym zapisaniu. Odświeżenie linku zgodnego z zapisem wczytuje postęp.

## Zapis postępów

Gra automatycznie zapisuje postęp co 5 sekund rozgrywki, przy pauzie, ukryciu lub opuszczeniu strony oraz przy rozpoczęciu i zakończeniu misji. Przycisk **ZAPISZ** na górnym pasku pozwala zapisać grę w dowolnym momencie. Zapis v2 obejmuje kampanię (rekrutów, rangi, groby), rakiety, spawnerzy, miny i pojazdy.

Po ponownym otwarciu gry zapis wczytuje się automatycznie. Trwająca misja czeka na pauzie — kliknij **KONTYNUUJ GRĘ**. Dostępny jest jeden zapis w pamięci lokalnej tej samej przeglądarki (`localStorage`). Przycisk **Nowa kampania** zastępuje zapis po potwierdzeniu.

## Sprawdzenie

```sh
npm test
```

Testy sprawdzają generator, pływanie i mosty, kampanię 360 rekrutów, permadeath, rangi, split/merge, ogień bratobójczy, spawn z budynków, rakiety, Game Over puli, zapis v2 oraz dotychczasową progresję, ewakuację i walkę. Gra korzysta z Canvas 2D, ES modules i Web Audio. Zewnętrzne fonty są opcjonalne — bez sieci używane są fonty systemowe.
