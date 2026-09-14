# Tiny Front

Przeglądarkowa gra taktyczna inspirowana klasycznym Cannon Fodder, z własną proceduralną grafiką pixel art i dźwiękami. Czteroosobowy oddział, nieskończona kampania, cztery rodzaje operacji i sześć rodzin losowych map w lesie, na pustyni oraz na śniegu.

## Uruchomienie

Wymagany Python 3. Bez instalowania paczek:

```sh
python3 -m http.server 5173
```

Otwórz http://localhost:5173. Można też użyć `npm start`. Pliki są statyczne, więc można je udostępnić na dowolnym hostingu statycznym. Serwer HTTP jest konieczny do wczytania modułów JavaScript.

## Sterowanie

- Lewy przycisk myszy: rozkaz ruchu. Kliknięcie żołnierza: wybór.
- Przytrzymany prawy przycisk myszy: ogień w kierunku kursora.
- Żołnierze również automatycznie strzelają do widocznych wrogów w zasięgu.
- G: granat w kierunku kursora; zasięg 340 jednostek. Granaty niszczą posterunki i nie ranią własnego oddziału.
- 1–4: wybór pojedynczego żołnierza. Q: wybór wszystkich.
- WASD / strzałki: przesuwanie kamery. F: śledzenie oddziału.
- Kliknięcie minimapy: przeniesienie kamery.
- Spacja / P / Escape: pauza. Utrata fokusu automatycznie pauzuje grę.
- Na ekranie dotykowym: dotknij pola, aby się poruszyć, albo przełącz tryb na ogień; przycisk granatu rzuca w ostatnio wskazane miejsce.

## Kampania i cele

Kolejne misje przeplatają cztery zadania:

- **Rozpoznanie bojem:** wyeliminuj garnizon i zniszcz wszystkie posterunki.
- **Uderz i zniknij:** zniszcz posterunki i ewakuuj ocalałych; patrole można ominąć.
- **Powrót do domu:** zabezpiecz pozycję jeńca przez 3 sekundy bez wroga w promieniu 150 jednostek, a następnie wróć ocalałymi do ewakuacji.
- **Cisza w eterze:** przejmij dwie radiostacje, utrzymując żołnierza w promieniu 72 jednostek przez 8 sekund przy każdej, i ewakuuj oddział. Wróg w promieniu 150 jednostek zatrzymuje przejmowanie, ale nie kasuje postępu.

Zielony krąg wyznacza ewakuację. Muszą wejść do niego **wszyscy żywi żołnierze**. Cele pokazują minimapa i strzałki na brzegu ekranu. Każda kolejna misja zaczyna się odprawą z właściwymi instrukcjami.

Mapy mają różne wymiary i proporcje: od polan około 30×24 pól po wąwozy około 58×24. Generator obraca i odbija układy, zmienia pozycje celów oraz rozmiary. Polany mają rozgałęzione ścieżki, rzeki dwie przeprawy, archipelagi groble, wąwozy korytarze z bocznymi przejściami, jeziora drogi po obu brzegach, a umocnienia kolejne linie osłon. Kamera, minimapa i wyszukiwanie drogi używają rzeczywistych wymiarów mapy.

Trudność rośnie stopniowo przez pierwsze 13 misji: od 8 do 32 przeciwników, nieco szybszy ruch, krótsze przerwy między strzałami i większe obrażenia. Od misji 2 zwiadowcy (») obchodzą flankę; od 3 strzelcy (⌖) mają większy zasięg, ale przed strzałem pokazują linię celowania przez 0,9 sekundy; od 6 ciężcy (Ⅱ) poruszają się wolniej i strzelają częściej. Osłony przerywają celowanie. Poziom zagrożenia ma limit 13; kampania dalej zmienia mapy i cele.

Apteczki przywracają całemu oddziałowi 40 HP, skrzynki dodają 3 granaty. W pierwszych trzech misjach jest dodatkowa apteczka. Gdy zużyjesz wszystkie dostępne granaty, zaopatrzenie pojawi się w strefie lądowania, jeśli zostały posterunki. Następna misja uzupełnia oddział i zapasy.

Wynik: 100 punktów za przeciwnika, 300 za posterunek, 250 za każdego ocalałego oraz 500 za wykonanie zadania w czasie premiowym podanym w odprawie. Trzy gwiazdki nagradzają wykonanie misji, powrót całej czwórki i czas premiowy. **Nie ma porażki za przekroczenie czasu.** Ponowienie misji odtwarza teren i cofa punkty zdobyte podczas tej próby.

Link z `?seed=12345&mission=2` odtwarza początkowy układ wybranej misji (bez parametru `mission` jest to misja 1). Ikona obok ziarna kopiuje taki link. Przebieg walki jest dynamiczny i nie jest deterministyczny. Link do innej mapy otwiera jej odprawę; poprzedni zapis zostaje zastąpiony dopiero po rozpoczęciu operacji lub ręcznym zapisaniu. Odświeżenie linku zgodnego z zapisem wczytuje postęp.

## Zapis postępów

Gra automatycznie zapisuje postęp co 5 sekund rozgrywki, przy pauzie, ukryciu lub opuszczeniu strony oraz przy rozpoczęciu i zakończeniu misji. Przycisk **ZAPISZ** na górnym pasku pozwala zapisać grę w dowolnej chwili.

Po ponownym otwarciu gry zapis wczytuje się automatycznie. Trwająca misja czeka na pauzie — kliknij **KONTYNUUJ GRĘ**. Zachowywane są numer misji, teren, wynik, czas, zdrowie i pozycje oddziału, rozkazy ruchu, przeciwnicy, cele, zapasy oraz pociski i granaty w locie. Zapisany raport po zwycięstwie pozwala przejść do następnej misji, a po porażce ponowić tę samą mapę bez zachowania punktów z nieudanej próby.

Dostępny jest jeden zapis w pamięci lokalnej tej samej przeglądarki i adresu strony (`localStorage`). Wyczyszczenie danych strony usuwa zapis; zapis nie przenosi się między urządzeniami, przeglądarkami ani adresami lub portami serwera. Przycisk **Nowa kampania** na ekranie odprawy, pauzy i raportu zastępuje zapis po potwierdzeniu. Gra informuje o błędzie zapisu, jeśli pamięć przeglądarki jest niedostępna lub pełna. Przy nagłym zamknięciu można stracić ostatnie kilka sekund od autozapisu.

## Sprawdzenie

```sh
npm test
```

Testy sprawdzają deterministyczność i różnorodność generatora, dostępność celów i zapasów na 60 mapach, zmienne wymiary, progresję trudności, przejmowanie stref, ewakuację, celowanie strzelców, walkę, ponowienia misji renderowanie i proporcje minimapy, a także zapis i odtwarzanie walki, raportów i kolejnych misji, autozapis, linki do map oraz obsługę uszkodzonych danych i błędów pamięci przeglądarki. Gra korzysta z Canvas 2D, ES modules i Web Audio. Zewnętrzne fonty są opcjonalne — bez sieci używane są fonty systemowe.
