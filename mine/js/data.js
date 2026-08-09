/* data.js — alle Zahlen des Spiels an genau einer Stelle.
 * Wer das Spiel umbalancieren will, ändert nur diese Datei. */

const DATA = {
  /* Version des Spielstands. Bei jeder Änderung, die alte Stände unbrauchbar
   * macht, hochzählen und in game.js eine Migration ergänzen. */
  standVersion: 1,

  /* Eine Rasterreihe entspricht zwei Metern Tiefe. */
  meterProReihe: 2,
  spalten: 7,

  erze: {
    kupfer:   { name: 'Kupfer',   farbe: '#c8783f', haerte: 2, wert: 5,  vonM: 0,  bisM: 30,  dichte: 0.16 },
    silber:   { name: 'Silber',   farbe: '#a7b3c2', haerte: 3, wert: 18, vonM: 20, bisM: 52,  dichte: 0.10 },
    amethyst: { name: 'Amethyst', farbe: '#a171e6', haerte: 4, wert: 70, vonM: 44, bisM: 999, dichte: 0.05 },
  },

  /* Wie hart der blanke Fels ab welcher Tiefe ist. Das ist die Bremse im
   * Spiel — keine Wartezeit, sondern steigende Kosten pro Schlag.
   *
   * Ausgerechnet: mit Spitzhacke I und 60 Schlägen kostet der Weg auf 44 m
   * schon 48 Schläge — der Amethyst ist damit gerade außer Reichweite und
   * wird erst mit besserem Werkzeug lohnend. Genau daran hängt, dass sich
   * Ausbauen überhaupt anfühlt wie Fortschritt. */
  felsHaerte: [
    { abM: 0,  haerte: 1 },
    { abM: 14, haerte: 2 },
    { abM: 26, haerte: 3 },
    { abM: 40, haerte: 4 },
    { abM: 56, haerte: 5 },
    { abM: 76, haerte: 6 },
  ],

  /* Anteil leerer Hohlräume — kosten keinen Schlag und belohnen gutes Schauen. */
  hohlraumDichte: 0.07,

  /* Drei Erz ergeben einen Barren. Amethyst wird nicht geschmolzen. */
  barrenProErz: 3,
  barren: {
    kupfer: { name: 'Kupferbarren', farbe: '#c8783f' },
    silber: { name: 'Silberbarren', farbe: '#a7b3c2' },
  },

  rezepte: {
    kupferring: {
      name: 'Kupferring',
      braucht: { kupferbarren: 2 },
      wert: 60,
      farbe: '#c8783f',
      stein: null,
    },
    silberring: {
      name: 'Silberring',
      braucht: { silberbarren: 2 },
      wert: 240,
      farbe: '#a7b3c2',
      stein: null,
    },
    amethystring: {
      name: 'Amethystring',
      braucht: { silberbarren: 2, amethyst: 1 },
      wert: 800,
      farbe: '#a7b3c2',
      stein: '#a171e6',
    },
  },

  /* Ausbauten: Stufe 1 hat man von Anfang an, die Preise gelten für die
   * jeweils nächste Stufe. */
  ausbauten: {
    spitzhacke: {
      name: 'Spitzhacke',
      text: 'Jeder Block kostet einen Schlag weniger je Stufe.',
      preise: [250, 1200, 5000],
      werte: [1, 2, 3, 4],
      einheit: 'Stärke',
    },
    rucksack: {
      name: 'Rucksack',
      text: 'Wie viel Erz du pro Abstieg mitnehmen kannst.',
      preise: [200, 900, 3500],
      /* Gemessen: ein Abstieg wirft rund neun Erz ab. Der Rucksack muss
       * darunter anfangen, sonst ist die Stufe wirkungslos — und die
       * Entscheidung "billiges Kupfer mitnehmen oder Platz für Silber
       * lassen" entsteht erst dadurch. */
      werte: [8, 13, 20, 30],
      einheit: 'Plätze',
    },
    lampe: {
      name: 'Lampe',
      text: 'Sichtweite nach unten und Schläge pro Abstieg.',
      preise: [300, 1400, 6000],
      werte: [3, 4, 5, 6],
      schlaege: [60, 80, 105, 140],
      einheit: 'Reihen',
    },
  },

  /* Fünf feste Aufträge, einer nach dem anderen. Sie sind zugleich das
   * Tutorial — es gibt keinen extra Erklärbildschirm. */
  auftraege: [
    {
      id: 'a1',
      titel: 'Der erste Kunde',
      text: 'Frau Halder hätte gern einen schlichten Kupferring.',
      ziel: { art: 'ring', ring: 'kupferring', anzahl: 1 },
      lohn: 150,
    },
    {
      id: 'a2',
      titel: 'Nachschub',
      text: 'Der Markt am Samstag braucht drei Kupferringe.',
      ziel: { art: 'ring', ring: 'kupferring', anzahl: 3 },
      lohn: 500,
    },
    {
      id: 'a3',
      titel: 'Tief gegraben',
      text: 'Unten liegt das Silber. Komm auf 40 Meter.',
      ziel: { art: 'tiefe', meter: 40 },
      lohn: 800,
    },
    {
      id: 'a4',
      titel: 'Silberhochzeit',
      text: 'Zwei Silberringe, und zwar bis zum Wochenende.',
      ziel: { art: 'ring', ring: 'silberring', anzahl: 2 },
      lohn: 1200,
    },
    {
      id: 'a5',
      titel: 'Das gute Stück',
      text: 'Ein Amethystring. Das Beste, was du kannst.',
      ziel: { art: 'ring', ring: 'amethystring', anzahl: 1 },
      lohn: 3000,
    },
  ],
};

/* Härte des Felses in einer bestimmten Tiefe. */
DATA.felsHaerteBei = function (meter) {
  let h = 1;
  for (const s of DATA.felsHaerte) if (meter >= s.abM) h = s.haerte;
  return h;
};

if (typeof module !== 'undefined') module.exports = DATA;
