/* game.js — Spielstand, Regeln, Sicherung.
 *
 * Grundsatz beim Speichern: während des Spielens ist das Gerät die Wahrheit.
 * Der Server bekommt nur Schnappschüsse. Fällt das Netz aus, läuft alles
 * weiter, und der Stand geht später raus. */

const SPIEL = (() => {
  const SCHLUESSEL = 'mine.stand';
  const KONTO = 'mine.konto';

  let s = null;            // aktueller Spielstand
  let abstieg = null;      // läuft gerade ein Abstieg?
  let sicherungLaeuft = false;
  let letzteSicherung = 0;

  function leererStand() {
    return {
      version: DATA.standVersion,
      name: 'Bergmann',
      geld: 0,
      gesamtVerdient: 0,
      wocheVerdient: 0,
      wocheStart: wochenStart(),
      maxTiefe: 0,
      erz: {},        // rohes Erz
      barren: {},     // geschmolzen
      ringe: {},      // hergestellt, noch nicht verkauft
      ringeGesamt: {},// je hergestellt (für Aufträge)
      stufen: { spitzhacke: 0, rucksack: 0, lampe: 0 },
      auftragNr: 0,
      abstiege: 0,
    };
  }

  /* Alte Spielstände hochziehen. Kostet heute nichts und rettet später
   * alle echten Stände, sobald an den Zahlen gedreht wird. */
  function migriere(alt) {
    let st = alt;
    if (!st || typeof st !== 'object') return leererStand();
    if (st.version === undefined) st.version = 0;

    // if (st.version < 2) { ...umbauen...; st.version = 2; }

    if (st.version !== DATA.standVersion) st.version = DATA.standVersion;
    const frisch = leererStand();
    for (const k of Object.keys(frisch)) if (st[k] === undefined) st[k] = frisch[k];
    return st;
  }

  /* Montag 00:00 der laufenden Woche als Textmarke. */
  function wochenStart(d = new Date()) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const tag = (t.getDay() + 6) % 7; // Montag = 0
    t.setDate(t.getDate() - tag);
    return t.toISOString().slice(0, 10);
  }

  function wochePruefen() {
    const jetzt = wochenStart();
    if (s.wocheStart !== jetzt) {
      s.wocheStart = jetzt;
      s.wocheVerdient = 0;
    }
  }

  function verdiene(betrag) {
    wochePruefen();
    s.geld += betrag;
    s.gesamtVerdient += betrag;
    s.wocheVerdient += betrag;
  }

  /* ---------- Abstieg ---------- */

  function abstiegStarten() {
    abstieg = MINE.neuerAbstieg(s);
    return abstieg;
  }

  function abstiegBeenden() {
    if (!abstieg) return null;
    const ladung = abstieg.ladung;
    for (const [erz, n] of Object.entries(ladung)) s.erz[erz] = (s.erz[erz] || 0) + n;

    const tiefe = MINE.tiefe(abstieg);
    if (tiefe > s.maxTiefe) s.maxTiefe = tiefe;
    s.abstiege++;

    const ergebnis = { ladung, tiefe, geladen: abstieg.geladen };
    abstieg = null;
    sichern();
    return ergebnis;
  }

  /* ---------- Zuhause ---------- */

  function kannSchmelzen(erz) {
    return (s.erz[erz] || 0) >= DATA.barrenProErz && DATA.barren[erz];
  }

  function schmelzen(erz, alles) {
    if (!kannSchmelzen(erz)) return 0;
    const moeglich = Math.floor((s.erz[erz] || 0) / DATA.barrenProErz);
    const n = alles ? moeglich : 1;
    s.erz[erz] -= n * DATA.barrenProErz;
    const b = erz + 'barren';
    s.barren[b] = (s.barren[b] || 0) + n;
    sichern();
    return n;
  }

  function vorrat(schluessel) {
    if (schluessel.endsWith('barren')) return s.barren[schluessel] || 0;
    return s.erz[schluessel] || 0;
  }

  function kannHerstellen(id) {
    const r = DATA.rezepte[id];
    return Object.entries(r.braucht).every(([k, n]) => vorrat(k) >= n);
  }

  function herstellen(id) {
    if (!kannHerstellen(id)) return false;
    const r = DATA.rezepte[id];
    for (const [k, n] of Object.entries(r.braucht)) {
      if (k.endsWith('barren')) s.barren[k] -= n;
      else s.erz[k] -= n;
    }
    s.ringe[id] = (s.ringe[id] || 0) + 1;
    s.ringeGesamt[id] = (s.ringeGesamt[id] || 0) + 1;
    sichern();
    return true;
  }

  function verkaufen(id, alles) {
    const da = s.ringe[id] || 0;
    if (da <= 0) return 0;
    const n = alles ? da : 1;
    s.ringe[id] -= n;
    verdiene(DATA.rezepte[id].wert * n);
    sichern();
    return n;
  }

  function erzVerkaufen(erz) {
    const da = s.erz[erz] || 0;
    if (da <= 0) return 0;
    s.erz[erz] = 0;
    verdiene(DATA.erze[erz].wert * da);
    sichern();
    return da;
  }

  /* ---------- Ausbauten ---------- */

  function ausbauPreis(id) {
    const a = DATA.ausbauten[id];
    const stufe = s.stufen[id];
    if (stufe >= a.preise.length) return null; // höchste Stufe erreicht
    return a.preise[stufe];
  }

  function ausbauen(id) {
    const preis = ausbauPreis(id);
    if (preis === null || s.geld < preis) return false;
    s.geld -= preis;
    s.stufen[id]++;
    sichern();
    return true;
  }

  /* ---------- Aufträge ---------- */

  function aktuellerAuftrag() {
    return DATA.auftraege[s.auftragNr] || null;
  }

  function auftragFortschritt() {
    const a = aktuellerAuftrag();
    if (!a) return { fertig: false, ist: 0, soll: 0 };
    if (a.ziel.art === 'ring') {
      return { fertig: (s.ringe[a.ziel.ring] || 0) >= a.ziel.anzahl, ist: s.ringe[a.ziel.ring] || 0, soll: a.ziel.anzahl };
    }
    return { fertig: s.maxTiefe >= a.ziel.meter, ist: Math.round(s.maxTiefe), soll: a.ziel.meter };
  }

  function auftragAbgeben() {
    const a = aktuellerAuftrag();
    if (!a) return false;
    const f = auftragFortschritt();
    if (!f.fertig) return false;
    if (a.ziel.art === 'ring') s.ringe[a.ziel.ring] -= a.ziel.anzahl;
    verdiene(a.lohn);
    s.auftragNr++;
    sichern();
    return true;
  }

  /* ---------- Sichern ---------- */

  function konto() {
    try { return JSON.parse(localStorage.getItem(KONTO) || 'null'); } catch (e) { return null; }
  }

  function kontoSetzen(k) {
    localStorage.setItem(KONTO, JSON.stringify(k));
  }

  function lokalSichern() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); } catch (e) {}
  }

  function sichern(sofort) {
    lokalSichern();
    const jetzt = Date.now();
    if (!sofort && jetzt - letzteSicherung < 20000) return;
    zumServer();
  }

  async function zumServer() {
    const k = konto();
    if (!k || !k.code || sicherungLaeuft) return;
    sicherungLaeuft = true;
    letzteSicherung = Date.now();
    try {
      wochePruefen();
      await fetch('/api/sichern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: k.code,
          name: s.name,
          stand: s,
          wocheStart: s.wocheStart,
          wocheVerdient: Math.round(s.wocheVerdient),
          gesamtVerdient: Math.round(s.gesamtVerdient),
        }),
      });
    } catch (e) {
      /* Kein Netz: nicht schlimm, lokal ist die Wahrheit. */
    } finally {
      sicherungLaeuft = false;
    }
  }

  async function vomServer() {
    const k = konto();
    if (!k || !k.code) return null;
    try {
      const r = await fetch('/api/laden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: k.code }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.stand || null;
    } catch (e) {
      return null;
    }
  }

  /* Beim Start: lokalen und Server-Stand vergleichen. Es gewinnt der weiter
   * fortgeschrittene, der andere bleibt als Sicherung liegen. */
  async function laden() {
    let lokal = null;
    try { lokal = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); } catch (e) {}
    const fern = await vomServer();

    let gewaehlt = lokal;
    if (fern && (!lokal || (fern.gesamtVerdient || 0) > (lokal.gesamtVerdient || 0))) {
      if (lokal) localStorage.setItem(SCHLUESSEL + '.sicherung', JSON.stringify(lokal));
      gewaehlt = fern;
    }

    s = migriere(gewaehlt);
    wochePruefen();
    lokalSichern();
    return s;
  }

  async function kontoAnlegen(name) {
    const r = await fetch('/api/neu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error('Der Server hat kein Konto angelegt.');
    const d = await r.json();
    kontoSetzen({ code: d.code, name });
    s.name = name;
    await zumServer();
    return d.code;
  }

  async function kontoVerbinden(code) {
    const r = await fetch('/api/laden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
    if (!r.ok) throw new Error('Diesen Code kennt der Server nicht.');
    const d = await r.json();
    kontoSetzen({ code: code.trim().toUpperCase(), name: d.name });
    if (d.stand) {
      localStorage.setItem(SCHLUESSEL + '.sicherung', JSON.stringify(s));
      s = migriere(d.stand);
      wochePruefen();
      lokalSichern();
    }
    return d.name;
  }

  async function liste() {
    try {
      const r = await fetch('/api/liste');
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  return {
    get stand() { return s; },
    get abstieg() { return abstieg; },
    laden, sichern, zumServer,
    abstiegStarten, abstiegBeenden,
    schmelzen, kannSchmelzen, herstellen, kannHerstellen, verkaufen, erzVerkaufen,
    ausbauPreis, ausbauen,
    aktuellerAuftrag, auftragFortschritt, auftragAbgeben,
    konto, kontoAnlegen, kontoVerbinden, liste,
    wochenStart,
  };
})();
