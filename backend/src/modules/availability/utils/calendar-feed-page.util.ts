/**
 * Pagine HTML della sottoscrizione a un calendario.
 *
 * Sono servite dal backend e non dall'app Angular perché chi le apre non è
 * autenticato: arriva da un link in una mail o in un messaggio, spesso da un
 * telefono che non ha mai visto il gestionale.
 *
 * Il markup sta qui e non nei controller perché le usano in due — l'agenda
 * dell'operatore e il calendario del paziente — e contiene istruzioni
 * verificate sul campo che nessuno ha voglia di riscoprire due volte (in
 * particolare: perché `cid=` vuole `webcal://`, e perché su Android serve la
 * modalità desktop).
 */

/** Escape HTML minimo: questi valori finiscono dentro attributi e testo. */
export function escapeHtml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Guscio comune: una card centrata, niente dipendenze esterne. */
export function wrapFeedPageHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — Curandis</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; }
  .card { max-width: 460px; margin: 0 auto; background: white; border: 1px solid #e2e8f0;
          border-radius: 12px; padding: 22px; }
  h1 { font-size: 1.15rem; margin: 0 0 12px; }
  p { font-size: 0.92rem; line-height: 1.5; margin: 0 0 14px; }
  .btn { display: block; text-align: center; padding: 13px 16px; border-radius: 8px;
         border: 1px solid #cbd5e1; background: white; color: #1e293b; font-size: 0.95rem;
         text-decoration: none; margin-bottom: 10px; cursor: pointer; width: 100%;
         box-sizing: border-box; font-family: inherit; }
  .btn-primary { background: #1976d2; border-color: #1976d2; color: white; font-weight: 600; }
  .btn-danger { background: #b91c1c; border-color: #b91c1c; color: white; font-weight: 600; }
  .btn-small { padding: 8px 12px; font-size: 0.82rem; width: auto; display: inline-block; }
  code { display: block; word-break: break-all; font-size: 0.72rem; background: #f1f5f9;
         padding: 8px; border-radius: 6px; margin-bottom: 10px; }
  details { margin-top: 6px; }
  summary { font-size: 0.85rem; cursor: pointer; color: #475569; margin-bottom: 8px; }
  .hint { font-size: 0.8rem; color: #64748b; }
  .steps { font-size: 0.88rem; line-height: 1.5; margin: 0 0 14px; padding-left: 20px; }
  .steps li { margin-bottom: 10px; }
  .nb { display: block; font-size: 0.78rem; color: #92400e; margin-top: 3px; }
  .warn { color: #92400e; background: #fffbeb; border: 1px solid #fde68a;
          border-radius: 6px; padding: 8px 10px; margin-top: 16px; }
  .foot { font-size: 0.78rem; color: #64748b; margin-top: 18px; padding-top: 14px;
          border-top: 1px solid #e2e8f0; }
  .foot a { color: #64748b; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;
}

/**
 * I pulsanti di sottoscrizione, con le istruzioni giuste per il dispositivo.
 *
 * La pagina si adatta al dispositivo perché le tre strade sono davvero
 * diverse, non per gusto estetico:
 *  - iPhone: `webcal://` apre il Calendario e funziona subito;
 *  - Android: Google Calendar NON sa aggiungere un calendario da URL
 *    dall'app, e `calendar.google.com/r?cid=` da mobile viene dirottato sulla
 *    pagina "scarica l'app" perdendo il parametro. Va fatto da computer.
 *    Mostrare lì un pulsante che non conclude è peggio che non mostrarlo;
 *  - computer: il pulsante Google funziona.
 *
 * @param feedUrl indirizzo `https://` del `.ics`
 * @param intro paragrafo iniziale, diverso fra operatore e paziente
 * @param footer HTML in fondo alla card (per esempio la disiscrizione)
 */
export function subscribePageHtml(params: {
  title: string;
  intro: string;
  feedUrl: string;
  privacyNote: string;
  footer?: string;
}): string {
  const { title, intro, feedUrl, privacyNote, footer } = params;

  const webcal = feedUrl.replace(/^https?:\/\//, 'webcal://');
  // `cid` DEVE contenere lo schema `webcal://`, non `https://`.
  //
  // Verificato sul campo il 20/08/2026: con `webcal://` la sottoscrizione da
  // computer va a buon fine (Google chiede conferma, mostra la schermata di
  // scelta e poi il calendario compare); con `https://` risponde "impossibile
  // aggiungere al calendario, controlla l'URL", perché interpreta il parametro
  // come identificativo di calendario invece che come indirizzo a cui
  // iscriversi.
  //
  // Non cambiarlo senza una prova contraria: è già stato ritirato una volta
  // per un fraintendimento e ha smesso di funzionare.
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  return wrapFeedPageHtml(
    title,
    `${intro}

     <div id="ios" hidden>
       <a class="btn btn-primary" href="${escapeHtml(webcal)}">Aggiungi al Calendario</a>
       <p class="hint">Si apre il Calendario di iPhone e ti chiede di confermare.</p>
     </div>

     <div id="android" hidden>
       <a class="btn btn-primary" href="${escapeHtml(google)}" target="_blank" rel="noopener">
         Aggiungi a Google Calendar
       </a>
       <ol class="steps">
         <li>
           Tocca il pulsante qui sopra.
           <span class="nb">Se Google ti mostra la pagina che propone di
           scaricare l'app, attiva la <strong>modalità desktop</strong> —
           tre puntini in alto a destra → spunta <em>Sito desktop</em> — e
           ricarica la pagina. Senza, il tasto di conferma non compare.</span>
         </li>
         <li>Conferma il riquadro <strong>"Aggiungi questo calendario"</strong>.</li>
         <li>
           Apri l'<strong>app Google Calendar</strong> → menù ☰ →
           Impostazioni → tocca il nome del nuovo calendario → attiva
           <strong>Sincronizza</strong>.
           <span class="nb">Ultimo passaggio necessario: senza, il calendario
           resta collegato all'account ma non compare sul telefono. Se non lo
           vedi nell'elenco, tocca "Mostra altri".</span>
         </li>
       </ol>

       <details>
         <summary>Se il pulsante non funziona</summary>
         <ol class="steps">
           <li>
             <strong>Copia l'indirizzo</strong> qui sotto col pulsante.
             <span class="nb">Non toccare il link: il telefono scaricherebbe
             il file o lo aprirebbe con un'altra app di calendario, invece di
             sincronizzarlo.</span>
           </li>
           <li>Chrome → <strong>calendar.google.com</strong>, in modalità desktop.</li>
           <li>
             <strong>Altri calendari</strong> → <em>+</em> →
             <strong>Da URL</strong> → incolla → Aggiungi calendario.
           </li>
           <li>Poi il passaggio 3 qui sopra, nell'app.</li>
         </ol>
       </details>
     </div>

     <div id="desktop" hidden>
       <a class="btn btn-primary" href="${escapeHtml(google)}" target="_blank" rel="noopener">
         Aggiungi a Google Calendar
       </a>
       <a class="btn" href="${escapeHtml(webcal)}">Aggiungi ad Apple Calendario o Outlook</a>
       <p class="hint">
         Se un pulsante non conclude, incolla l'indirizzo qui sotto in
         <strong>calendar.google.com</strong> → Altri calendari → <em>+</em> → Da URL.
       </p>
     </div>

     <div id="copia">
       <p class="hint">Indirizzo del calendario, se ti serve incollarlo altrove:</p>
       <code id="u">${escapeHtml(feedUrl)}</code>
       <button class="btn btn-small" type="button" onclick="copia(this)">Copia indirizzo</button>
     </div>

     <details>
       <summary>Altre app di calendario</summary>
       <p class="hint">Cerca "sottoscrivi calendario da URL" (o "Subscribe from URL")
          e incolla l'indirizzo qui sopra. Non usare "importa": importare copia
          gli appuntamenti una volta sola e non li aggiorna più.</p>
     </details>

     <p class="hint warn">${privacyNote}</p>
     ${footer ?? ''}

     <script>
       (function () {
         var ua = navigator.userAgent || '';
         var isIOS = /iPhone|iPad|iPod/i.test(ua)
           || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
         var isAndroid = /Android/i.test(ua);
         var id = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
         document.getElementById(id).hidden = false;
         // L'indirizzo resta visibile ovunque: è la via che funziona sempre,
         // anche quando i pulsanti non concludono. Toglierlo lascerebbe
         // l'utente senza alternative proprio nel caso in cui servono.
         document.getElementById('copia').hidden = false;
       })();
       function copia(btn) {
         navigator.clipboard.writeText(document.getElementById('u').textContent)
           .then(function () { btn.textContent = 'Copiato'; })
           .catch(function () { btn.textContent = 'Selezionalo a mano'; });
       }
     </script>`,
  );
}
