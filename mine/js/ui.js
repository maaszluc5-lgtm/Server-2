/* ui.js — Bildschirme zeichnen und auf Tippen reagieren. */

(() => {
  const $ = (id) => document.getElementById(id);
  const s = () => SPIEL.stand;

  /* ---------- Meldungen ---------- */
  let melderUhr = null;
  function melde(text) {
    const m = $('melder');
    m.textContent = text;
    m.classList.add('zeig');
    clearTimeout(melderUhr);
    melderUhr = setTimeout(() => m.classList.remove('zeig'), 1900);
  }

  const zahl = (n) => Math.round(n).toLocaleString('de-DE');

  /* ---------- Kopfzeile und Reiter ---------- */
  function kopfZeichnen() {
    $('anzeige-geld').textContent = zahl(s().geld);
    $('anzeige-tiefe').textContent = Math.round(s().maxTiefe) + ' m';
  }

  function zeige(zielId) {
    document.querySelectorAll('.screen').forEach((e) => e.classList.toggle('aktiv', e.id === zielId));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('aktiv', t.dataset.ziel === zielId));
    if (zielId === 's-heim') heimZeichnen();
    if (zielId === 's-auftrag') auftragZeichnen();
    if (zielId === 's-liste') listeZeichnen();
    if (zielId === 's-mine') mineZeichnen();
  }

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => zeige(t.dataset.ziel));
  });

  /* ---------- Mine ---------- */
  function mineZeichnen() {
    const a = SPIEL.abstieg;
    $('mine-vorbereitung').hidden = !!a;
    $('mine-lauf').hidden = !a;
    if (a) rasterZeichnen();
    else vorbereitungZeichnen();
  }

  function vorbereitungZeichnen() {
    const st = s().stufen;
    $('vor-schlaege').textContent = DATA.ausbauten.lampe.schlaege[st.lampe];
    $('vor-platz').textContent = DATA.ausbauten.rucksack.werte[st.rucksack];
    $('vor-sicht').textContent = DATA.ausbauten.lampe.werte[st.lampe];
  }

  function rasterZeichnen() {
    const a = SPIEL.abstieg;
    const staerke = DATA.ausbauten.spitzhacke.werte[s().stufen.spitzhacke];
    const r = $('raster');
    r.innerHTML = '';

    const von = Math.max(0, a.reihe - 2);
    const bis = a.reihe + a.sicht;

    for (let reihe = von; reihe <= bis; reihe++) {
      for (let spalte = 0; spalte < DATA.spalten; spalte++) {
        const b = document.createElement('button');
        b.className = 'feld';
        b.type = 'button';

        const hier = reihe === a.reihe && spalte === a.spalte;
        const weg = MINE.abgebaut(a, spalte, reihe);
        const sichtbar = reihe <= a.reihe + a.sicht;

        if (hier) {
          b.classList.add('spieler');
          b.setAttribute('aria-label', 'Du bist hier');
        } else if (weg) {
          b.classList.add('leer');
        } else if (!sichtbar) {
          b.classList.add('dunkel');
        } else {
          const f = MINE.feld(a.startwert, spalte, reihe);
          const preis = MINE.kosten(f, staerke);
          if (f.art === 'erz') {
            b.classList.add('erz');
            const erz = DATA.erze[f.erz];
            b.style.background = 'linear-gradient(160deg,#2b303b,#222732)';
            const p = document.createElement('span');
            p.className = 'punkt';
            p.style.background = erz.farbe;
            b.appendChild(p);
            /* Auch beim Erz muss der Preis dranstehen — daran hängt die
             * Entscheidung, ob sich der Umweg lohnt. */
            const z = document.createElement('span');
            z.className = 'preis';
            z.textContent = preis;
            b.appendChild(z);
            b.title = erz.name;
            b.setAttribute('aria-label', erz.name + ', ' + preis + ' Schläge');
          } else if (f.art === 'hohl') {
            b.classList.add('leer');
          } else {
            b.classList.add('fels');
            b.textContent = preis;
            b.setAttribute('aria-label', 'Fels, ' + preis + ' Schläge');
          }

          if (MINE.erreichbar(a, spalte, reihe)) {
            b.classList.add(preis > a.schlaege ? 'zuteuer' : 'erreichbar');
            b.addEventListener('click', () => graben(spalte, reihe));
          }
        }
        r.appendChild(b);
      }
    }

    const anteil = Math.max(0, a.schlaege / a.schlaegeMax) * 100;
    $('balken-schlaege').style.width = anteil + '%';
    $('lauf-schlaege').textContent = a.schlaege;
    $('lauf-ladung').textContent = a.geladen + '/' + a.platz;
    $('lauf-tiefe').textContent = a.reihe * DATA.meterProReihe + ' m';
    /* Oben mitlaufen lassen — sonst steht dort 0 m, während man schon
     * zwölf Meter tief hängt. */
    $('anzeige-tiefe').textContent = Math.round(Math.max(s().maxTiefe, MINE.tiefe(a))) + ' m';
  }

  function graben(spalte, reihe) {
    const a = SPIEL.abstieg;
    const e = MINE.graben(a, s(), spalte, reihe);
    const h = $('hinweis');
    if (!e.ok) {
      h.textContent = e.grund;
      h.classList.remove('gut');
      return;
    }
    if (e.fund) {
      h.textContent = DATA.erze[e.fund].name + ' gefunden.';
      h.classList.add('gut');
    } else {
      h.textContent = '';
      h.classList.remove('gut');
    }
    rasterZeichnen();
    if (a.ende) {
      const grund = a.ende === 'kraft' ? 'Deine Kraft ist am Ende.' : 'Der Rucksack ist voll.';
      setTimeout(() => { auftauchen(grund); }, 350);
    }
  }

  function auftauchen(grund) {
    const e = SPIEL.abstiegBeenden();
    if (!e) return;
    const teile = Object.entries(e.ladung).map(([k, n]) => n + '× ' + DATA.erze[k].name);
    const kasten = $('letzter-fund');
    kasten.hidden = false;
    $('letzter-fund-inhalt').innerHTML =
      '<p class="klein">' + (grund ? grund + ' ' : '') + 'Du warst ' + Math.round(e.tiefe) + ' m tief.</p>' +
      (teile.length
        ? teile.map((t) => '<div class="zeile"><span class="name">' + t + '</span></div>').join('')
        : '<div class="leerhinweis">Diesmal ohne Erz. Nächstes Mal seitwärts graben.</div>');
    melde(e.geladen > 0 ? e.geladen + ' Erz nach Hause gebracht' : 'Ohne Ausbeute zurück');
    kopfZeichnen();
    mineZeichnen();
  }

  $('knopf-abstieg').addEventListener('click', () => {
    SPIEL.abstiegStarten();
    $('hinweis').textContent = '';
    $('letzter-fund').hidden = true;
    mineZeichnen();
  });

  $('knopf-auftauchen').addEventListener('click', () => auftauchen(''));

  /* ---------- Zuhause ---------- */
  function heimZeichnen() {
    stubeZeichnen();
    ofenZeichnen();
    werkbankZeichnen();
    lagerZeichnen();
    ausbautenZeichnen();
    kopfZeichnen();
  }

  /* Die Stube ist ein Bild, kein Formular: sie verändert sich sichtbar,
   * sobald ausgebaut oder etwas hergestellt wird. */
  function stubeZeichnen() {
    const st = s().stufen;
    const erzDa = Object.values(s().erz).some((n) => n > 0);
    const ringe = Object.entries(s().ringe).flatMap(([id, n]) =>
      Array(Math.min(n, 10)).fill(DATA.rezepte[id])
    );

    const feuer = erzDa
      ? '<circle cx="47" cy="99" r="11" fill="#e07a2a" opacity=".85"/>' +
        '<circle cx="47" cy="102" r="6" fill="#f5c451"/>'
      : '<circle cx="47" cy="101" r="5" fill="#3a2f26"/>';

    const lampe = st.lampe > 0
      ? '<circle cx="160" cy="26" r="16" fill="#e3b23c" opacity=".13"/>' +
        '<circle cx="160" cy="26" r="5" fill="#e3b23c"/>' +
        '<rect x="159" y="6" width="2" height="14" fill="#3a4150"/>'
      : '<rect x="159" y="6" width="2" height="16" fill="#2a3040"/>' +
        '<circle cx="160" cy="24" r="4" fill="#2a3040"/>';

    let hacken = '';
    for (let i = 0; i <= st.spitzhacke; i++) {
      const x = 232 + i * 17;
      hacken +=
        '<rect x="' + x + '" y="30" width="3" height="24" rx="1" fill="#6b5540"/>' +
        '<rect x="' + (x - 5) + '" y="27" width="13" height="4" rx="2" fill="#9aa6b4"/>';
    }

    const sackH = 16 + st.rucksack * 5;
    const sack =
      '<rect x="196" y="' + (112 - sackH) + '" width="22" height="' + sackH + '" rx="5" fill="#4a3b2c"/>' +
      '<rect x="201" y="' + (112 - sackH - 3) + '" width="12" height="5" rx="2" fill="#6b5540"/>';

    let regal = '<rect x="228" y="66" width="76" height="46" rx="4" fill="#20242e" stroke="#2e3440"/>' +
                '<line x1="228" y1="89" x2="304" y2="89" stroke="#2e3440"/>';
    ringe.slice(0, 10).forEach((r, i) => {
      const x = 238 + (i % 5) * 14;
      const y = i < 5 ? 79 : 102;
      regal += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="none" stroke="' + r.farbe + '" stroke-width="2.5"/>';
      if (r.stein) regal += '<circle cx="' + x + '" cy="' + (y - 5) + '" r="2.2" fill="' + r.stein + '"/>';
    });

    $('stube').innerHTML =
      '<svg viewBox="0 0 320 150" role="img" aria-label="Deine Werkstatt">' +
      '<rect width="320" height="150" fill="#161a22"/>' +
      '<rect y="118" width="320" height="32" fill="#0f1218"/>' +
      lampe +
      /* Ofen */
      '<rect x="18" y="60" width="60" height="58" rx="6" fill="#2b3040"/>' +
      '<rect x="32" y="86" width="30" height="32" rx="4" fill="#0b0d12"/>' +
      feuer +
      '<rect x="34" y="44" width="12" height="18" rx="3" fill="#232833"/>' +
      /* Werkbank */
      '<rect x="96" y="92" width="86" height="8" rx="3" fill="#6b5540"/>' +
      '<rect x="101" y="100" width="7" height="18" fill="#4a3b2c"/>' +
      '<rect x="170" y="100" width="7" height="18" fill="#4a3b2c"/>' +
      '<rect x="112" y="84" width="26" height="8" rx="2" fill="#3a4150"/>' +
      hacken + sack + regal +
      '</svg>';
  }

  function ofenZeichnen() {
    const ziel = $('ofen');
    ziel.innerHTML = '';
    let etwas = false;
    for (const [schluessel, erz] of Object.entries(DATA.erze)) {
      const menge = s().erz[schluessel] || 0;
      if (!DATA.barren[schluessel]) continue;
      etwas = true;
      const moeglich = Math.floor(menge / DATA.barrenProErz);
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="perle" style="background:' + erz.farbe + '"></span>' +
        '<span class="name">' + erz.name + '<small>' + menge + ' Erz · ergibt ' + moeglich + ' Barren</small></span>';
      const b = document.createElement('button');
      b.className = 'knopf klein';
      b.textContent = 'Einschmelzen';
      b.disabled = moeglich < 1;
      b.addEventListener('click', () => {
        const n = SPIEL.schmelzen(schluessel, true);
        melde(n + '× ' + DATA.barren[schluessel].name + ' gegossen');
        heimZeichnen();
      });
      z.appendChild(b);
      ziel.appendChild(z);
    }
    if (!etwas) ziel.innerHTML = '<div class="leerhinweis">Noch kein Erz im Haus.</div>';
  }

  function werkbankZeichnen() {
    const ziel = $('werkbank');
    ziel.innerHTML = '';
    for (const [id, r] of Object.entries(DATA.rezepte)) {
      const braucht = Object.entries(r.braucht)
        .map(([k, n]) => n + '× ' + (DATA.barren[k.replace('barren', '')] ? DATA.barren[k.replace('barren', '')].name : DATA.erze[k].name))
        .join(', ');
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="perle" style="background:' + (r.stein || r.farbe) + '"></span>' +
        '<span class="name">' + r.name + '<small>' + braucht + ' · Verkauf ' + zahl(r.wert) + '</small></span>' +
        '<span class="zahl">' + (s().ringe[id] || 0) + '</span>';
      const b = document.createElement('button');
      b.className = 'knopf klein';
      b.textContent = 'Schmieden';
      b.disabled = !SPIEL.kannHerstellen(id);
      b.addEventListener('click', () => {
        if (SPIEL.herstellen(id)) { melde(r.name + ' geschmiedet'); heimZeichnen(); }
      });
      z.appendChild(b);
      ziel.appendChild(z);
    }
  }

  function lagerZeichnen() {
    const ziel = $('lager');
    ziel.innerHTML = '';
    let leer = true;

    for (const [id, r] of Object.entries(DATA.rezepte)) {
      const n = s().ringe[id] || 0;
      if (n <= 0) continue;
      leer = false;
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="perle" style="background:' + r.farbe + '"></span>' +
        '<span class="name">' + r.name + '<small>je ' + zahl(r.wert) + '</small></span>' +
        '<span class="zahl">' + n + '</span>';
      const b = document.createElement('button');
      b.className = 'knopf klein';
      b.textContent = 'Verkaufen';
      b.addEventListener('click', () => {
        const k = SPIEL.verkaufen(id, true);
        melde(k + '× ' + r.name + ' verkauft');
        heimZeichnen();
      });
      z.appendChild(b);
      ziel.appendChild(z);
    }

    for (const [schluessel, erz] of Object.entries(DATA.erze)) {
      const n = s().erz[schluessel] || 0;
      if (n <= 0) continue;
      leer = false;
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="perle" style="background:' + erz.farbe + '"></span>' +
        '<span class="name">' + erz.name + ' (roh)<small>je ' + zahl(erz.wert) + ' — verarbeitet lohnt mehr</small></span>' +
        '<span class="zahl">' + n + '</span>';
      const b = document.createElement('button');
      b.className = 'knopf klein';
      b.textContent = 'Verkaufen';
      b.addEventListener('click', () => {
        const k = SPIEL.erzVerkaufen(schluessel);
        melde(k + '× ' + erz.name + ' verkauft');
        heimZeichnen();
      });
      z.appendChild(b);
      ziel.appendChild(z);
    }

    for (const [k, b] of Object.entries(DATA.barren)) {
      const n = s().barren[k + 'barren'] || 0;
      if (n <= 0) continue;
      leer = false;
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="perle" style="background:' + b.farbe + '"></span>' +
        '<span class="name">' + b.name + '</span>' +
        '<span class="zahl">' + n + '</span>';
      ziel.appendChild(z);
    }

    if (leer) ziel.innerHTML = '<div class="leerhinweis">Das Lager ist leer. Ab in den Berg.</div>';
  }

  function ausbautenZeichnen() {
    const ziel = $('ausbauten');
    ziel.innerHTML = '';
    for (const [id, a] of Object.entries(DATA.ausbauten)) {
      const stufe = s().stufen[id];
      const preis = SPIEL.ausbauPreis(id);
      const jetzt = a.werte[stufe];
      const naechst = a.werte[stufe + 1];

      /* Überschrift ist die Stufe, die man kaufen würde — nicht die, die man
       * schon hat. Sonst steht neben "Spitzhacke II" ein Preis, obwohl man
       * die zweite Stufe längst besitzt. */
      const titel = a.name + ' ' + römisch(naechst !== undefined ? stufe + 2 : stufe + 1);
      const z = document.createElement('div');
      z.className = 'zeile';
      z.innerHTML =
        '<span class="name">' + titel +
        '<small>' + a.text + (naechst !== undefined ? ' Du hast ' + römisch(stufe + 1) + '.' : '') + '</small></span>' +
        '<span class="zahl">' + jetzt + (naechst !== undefined ? ' → ' + naechst : '') + '</span>';

      const b = document.createElement('button');
      b.className = 'knopf klein';
      if (preis === null) {
        b.textContent = 'Höchste Stufe';
        b.disabled = true;
      } else {
        b.textContent = zahl(preis);
        b.disabled = s().geld < preis;
        b.addEventListener('click', () => {
          if (SPIEL.ausbauen(id)) { melde(a.name + ' ausgebaut'); heimZeichnen(); }
        });
      }
      z.appendChild(b);
      ziel.appendChild(z);
    }
  }

  const römisch = (n) => ['0', 'I', 'II', 'III', 'IV', 'V'][n] || String(n);

  /* ---------- Aufträge ---------- */
  function auftragZeichnen() {
    const ziel = $('auftrag');
    const a = SPIEL.aktuellerAuftrag();
    if (!a) {
      ziel.innerHTML =
        '<div class="karte"><h3>Alle erledigt</h3>' +
        '<p class="klein">Du hast alle fünf Aufträge dieser Fassung geschafft. Jetzt zählt nur noch, wie viel du in der Woche verdienst.</p></div>';
      return;
    }
    const f = SPIEL.auftragFortschritt();
    const anteil = Math.min(100, (f.ist / f.soll) * 100);

    ziel.innerHTML =
      '<div class="karte">' +
      '<h3>Auftrag ' + (s().auftragNr + 1) + ' von ' + DATA.auftraege.length + '</h3>' +
      '<p class="auftragskopf">' + a.titel + '</p>' +
      '<p class="klein">' + a.text + '</p>' +
      '<div class="fortschritt"><span style="width:' + anteil + '%"></span></div>' +
      '<p class="klein">' + f.ist + ' von ' + f.soll + (a.ziel.art === 'tiefe' ? ' Metern' : ' Stück') +
      ' · Lohn <span class="lohn">' + zahl(a.lohn) + '</span></p>' +
      '<button class="knopf" id="knopf-abgeben"' + (f.fertig ? '' : ' disabled') + '>Abgeben</button>' +
      '</div>';

    const b = $('knopf-abgeben');
    if (b) b.addEventListener('click', () => {
      if (SPIEL.auftragAbgeben()) {
        melde('Auftrag erledigt: +' + zahl(a.lohn));
        kopfZeichnen();
        auftragZeichnen();
      }
    });
  }

  /* ---------- Bestenliste und Konto ---------- */
  function kontoZeichnen() {
    const k = SPIEL.konto();
    const ziel = $('konto-karte');

    if (k && k.code) {
      ziel.innerHTML =
        '<h3>Dein Konto</h3>' +
        '<p class="klein">Angemeldet als <b>' + entschaerfe(k.name || s().name) + '</b>. Mit diesem Code holst du deinen Stand auf ein anderes Gerät. Schreib ihn dir auf — ohne ihn ist der Stand weg.</p>' +
        '<code class="code">' + k.code + '</code>';
      return;
    }

    ziel.innerHTML =
      '<h3>Mitspielen</h3>' +
      '<p class="klein">Du spielst gerade nur auf diesem Gerät. Für die Bestenliste brauchst du ein Konto — kein Passwort, nur ein Code zum Aufheben.</p>' +
      '<input type="text" id="feld-name" placeholder="Dein Name" maxlength="18" value="' + entschaerfe(s().name) + '">' +
      '<button class="knopf" id="knopf-konto">Konto anlegen</button>' +
      '<p class="klein" style="margin-top:14px">Schon einen Code?</p>' +
      '<input type="text" id="feld-code" placeholder="MINE-XXXX-XXXX" maxlength="16">' +
      '<button class="knopf" id="knopf-verbinden">Stand holen</button>';

    $('knopf-konto').addEventListener('click', async () => {
      const name = ($('feld-name').value || '').trim() || 'Bergmann';
      try {
        await SPIEL.kontoAnlegen(name);
        melde('Konto angelegt');
        listeZeichnen();
      } catch (e) {
        melde('Der Server ist nicht erreichbar.');
      }
    });

    $('knopf-verbinden').addEventListener('click', async () => {
      const code = ($('feld-code').value || '').trim();
      if (!code) return;
      try {
        await SPIEL.kontoVerbinden(code);
        melde('Stand geholt');
        kopfZeichnen();
        listeZeichnen();
      } catch (e) {
        melde('Diesen Code kennt der Server nicht.');
      }
    });
  }

  function entschaerfe(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function listeZeichnen() {
    kontoZeichnen();
    const ziel = $('liste');
    ziel.innerHTML = '<div class="leerhinweis">Wird geladen …</div>';
    const d = await SPIEL.liste();
    if (!d || !d.plaetze) {
      ziel.innerHTML = '<div class="leerhinweis">Keine Verbindung zum Server. Deine Woche: ' + zahl(s().wocheVerdient) + '.</div>';
      return;
    }
    if (!d.plaetze.length) {
      ziel.innerHTML = '<div class="leerhinweis">Diese Woche hat noch niemand etwas verdient. Sei der Erste.</div>';
      return;
    }
    const meiner = (SPIEL.konto() || {}).code;
    ziel.innerHTML = d.plaetze
      .map((p, i) =>
        '<div class="platz' + (p.ich || p.code === meiner ? ' ich' : '') + '">' +
        '<span class="nr">' + (i + 1) + '</span>' +
        '<span class="wer">' + entschaerfe(p.name) + '</span>' +
        '<span class="betrag">' + zahl(p.wocheVerdient) + '</span>' +
        '</div>')
      .join('');
  }

  /* ---------- Start ---------- */
  (async function start() {
    await SPIEL.laden();
    kopfZeichnen();
    mineZeichnen();
    zeige('s-mine');

    /* Alle 20 Sekunden ein Schnappschuss zum Server, falls ein Konto da ist. */
    setInterval(() => SPIEL.sichern(), 20000);
    window.addEventListener('beforeunload', () => SPIEL.sichern(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') SPIEL.sichern(true);
    });
  })();
})();
