# Tiny Front

Przeglądarkowa gra taktyczna inspirowana klasycznym Cannon Fodder, z własną proceduralną grafiką pixel art i dźwiękami. Czteroosobowy oddział, nieskończona kampania i losowo generowany teren: las, pustynia oraz śnieg.

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

Cele: wyeliminuj wszystkich przeciwników i zniszcz wszystkie posterunki. Apteczki przywracają całemu oddziałowi 40 HP, skrzynki dodają 3 granaty. Gdy zużyjesz wszystkie dostępne granaty, zaopatrzenie pojawi się w strefie lądowania. Następna misja uzupełnia oddział i zwiększa liczbę przeciwników (do 32).

Link z `?seed=12345&mission=2` odtwarza początkowy układ wybranej misji (bez parametru `mission` jest to misja 1). Ikona obok ziarna kopiuje taki link. Przebieg walki jest dynamiczny i nie jest deterministyczny. Postęp kampanii trwa do zamknięcia lub odświeżenia strony.

## Sprawdzenie

```sh
npm test
```

Testy sprawdzają deterministyczność i różnorodność generatora, dostępność celów i zapasów, przeprawy przez rzekę oraz omijanie przeszkód. Gra korzysta z Canvas 2D, ES modules i Web Audio. Zewnętrzne fonty są opcjonalne — bez sieci używane są fonty systemowe.
