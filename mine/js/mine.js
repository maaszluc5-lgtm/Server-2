/* mine.js — der Berg und der Abstieg.
 *
 * Der Berg wird nicht gespeichert, sondern aus einem Startwert berechnet:
 * jedes Feld ergibt sich allein aus (startwert, spalte, reihe). Das hält den
 * Spielstand winzig und erlaubt später, dieselbe Mine auf dem Server
 * nachzurechnen, ohne dem Gerät zu glauben. */

const MINE = (() => {
  /* Streuwert für ein Feld, immer zwischen 0 und 1. */
  function zufall(startwert, spalte, reihe, salz) {
    let x = (startwert ^ (spalte * 374761393) ^ (reihe * 668265263) ^ (salz * 2246822519)) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  /* Was liegt in Spalte/Reihe? Reihe 0 ist die Oberfläche und immer frei. */
  function feld(startwert, spalte, reihe) {
    if (reihe <= 0) return { art: 'hohl' };
    const meter = reihe * DATA.meterProReihe;

    if (zufall(startwert, spalte, reihe, 1) < DATA.hohlraumDichte) return { art: 'hohl' };

    /* Seltenstes Erz zuerst prüfen, damit es nicht von häufigem verdrängt wird. */
    const erze = Object.entries(DATA.erze).sort((a, b) => a[1].dichte - b[1].dichte);
    let salz = 10;
    for (const [schluessel, erz] of erze) {
      salz++;
      if (meter < erz.vonM || meter > erz.bisM) continue;
      if (zufall(startwert, spalte, reihe, salz) < erz.dichte) {
        return { art: 'erz', erz: schluessel, haerte: erz.haerte };
      }
    }
    return { art: 'fels', haerte: DATA.felsHaerteBei(meter) };
  }

  /* Was ein Feld an Schlägen kostet — die Spitzhacke zieht ab, aber ein
   * Schlag bleibt immer nötig. */
  function kosten(f, staerke) {
    if (f.art === 'hohl') return 0;
    return Math.max(1, f.haerte - (staerke - 1));
  }

  /* Ein neuer Abstieg. Alles darin gilt nur bis zum Auftauchen. */
  function neuerAbstieg(spieler) {
    const lampe = DATA.ausbauten.lampe;
    return {
      startwert: (Math.random() * 2147483647) | 0,
      spalte: Math.floor(DATA.spalten / 2),
      reihe: 0,
      schlaege: lampe.schlaege[spieler.stufen.lampe],
      schlaegeMax: lampe.schlaege[spieler.stufen.lampe],
      sicht: lampe.werte[spieler.stufen.lampe],
      platz: DATA.ausbauten.rucksack.werte[spieler.stufen.rucksack],
      ladung: {},
      geladen: 0,
      abgebaut: new Set(['0,' + Math.floor(DATA.spalten / 2)]),
      tiefsteReihe: 0,
      ende: null,
    };
  }

  const schluessel = (reihe, spalte) => reihe + ',' + spalte;

  /* Erreichbar ist, was direkt daneben oder direkt darunter liegt. Nach oben
   * geht es nicht zurück — dadurch zählt jede Entscheidung. */
  function erreichbar(a, spalte, reihe) {
    const dr = reihe - a.reihe;
    const ds = Math.abs(spalte - a.spalte);
    if (spalte < 0 || spalte >= DATA.spalten) return false;
    if (dr === 0) return ds === 1;
    if (dr === 1) return ds <= 1;
    return false;
  }

  function abgebaut(a, spalte, reihe) {
    return a.abgebaut.has(schluessel(reihe, spalte));
  }

  /* Ist irgendein Nachbarfeld noch bezahlbar? Sonst steckt man fest, ohne
   * dass die Schläge auf null stehen — und der Abstieg endet von selbst. */
  function kannWeiter(a, spieler) {
    const staerke = DATA.ausbauten.spitzhacke.werte[spieler.stufen.spitzhacke];
    const voll = a.geladen >= a.platz;
    for (const [ds, dr] of [[-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const spalte = a.spalte + ds;
      const reihe = a.reihe + dr;
      if (spalte < 0 || spalte >= DATA.spalten) continue;
      const f = abgebaut(a, spalte, reihe) ? { art: 'hohl' } : feld(a.startwert, spalte, reihe);
      if (voll && f.art === 'erz') continue;
      if (kosten(f, staerke) <= a.schlaege) return true;
    }
    return false;
  }

  /* Ein Schlag. Gibt zurück, was passiert ist, damit die Oberfläche es
   * anzeigen kann. */
  function graben(a, spieler, spalte, reihe) {
    if (a.ende) return { ok: false, grund: 'Der Abstieg ist vorbei.' };
    if (!erreichbar(a, spalte, reihe)) return { ok: false, grund: 'Da kommst du nicht hin.' };

    const schonWeg = abgebaut(a, spalte, reihe);
    const f = schonWeg ? { art: 'hohl' } : feld(a.startwert, spalte, reihe);
    const preis = kosten(f, DATA.ausbauten.spitzhacke.werte[spieler.stufen.spitzhacke]);

    if (preis > a.schlaege) return { ok: false, grund: 'Dafür reicht deine Kraft nicht mehr.' };
    if (f.art === 'erz' && a.geladen >= a.platz) {
      return { ok: false, grund: 'Rucksack voll — du musst auftauchen.' };
    }

    a.schlaege -= preis;
    a.abgebaut.add(schluessel(reihe, spalte));
    a.spalte = spalte;
    a.reihe = reihe;
    if (reihe > a.tiefsteReihe) a.tiefsteReihe = reihe;

    let fund = null;
    if (f.art === 'erz') {
      a.ladung[f.erz] = (a.ladung[f.erz] || 0) + 1;
      a.geladen++;
      fund = f.erz;
    }

    if (a.geladen >= a.platz) a.ende = 'rucksack';
    else if (!kannWeiter(a, spieler)) a.ende = 'kraft';

    return { ok: true, fund, preis, tiefe: a.reihe * DATA.meterProReihe };
  }

  function tiefe(a) {
    return a.tiefsteReihe * DATA.meterProReihe;
  }

  return { feld, kosten, neuerAbstieg, graben, erreichbar, abgebaut, tiefe, zufall };
})();
