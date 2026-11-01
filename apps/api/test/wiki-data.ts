import type { WikiData } from '../src/modules/wiki/wiki.service.js';

/** Copia mínima de la wiki para las pruebas. */
export const wikiTestData: WikiData = {
  groups: [
    { name: 'Zonas', pages: ['Sistema de pesca', 'Sistema de minería'] },
    { name: 'Eventos', pages: ['Halloween'] },
  ],
  pages: [
    {
      title: 'Halloween',
      group: 'Eventos',
      html: '<h2 id="Evento">Evento</h2><p>La luz de Halloween Town se filtra hacia Caspen.</p>',
      sections: [],
      notice: { kind: 'old', label: 'Evento antiguo', text: 'Evento antiguo.' },
      text: 'Evento La luz de Halloween Town se filtra hacia Caspen.',
    },
    {
      title: 'Página principal',
      group: null,
      html: '<div class="hro2-hero"><h1 class="hro2-title">HikariRO</h1></div>',
      sections: [],
      notice: null,
      text: 'HikariRO',
    },
    {
      title: 'Sistema de minería',
      group: 'Zonas',
      html: '<p>Extrae minerales con el <b>pico</b>.</p>',
      sections: [],
      notice: null,
      text: 'Extrae minerales con el pico.',
    },
    {
      title: 'Sistema de pesca',
      group: 'Zonas',
      html:
        '<h2 id="Primeros_pasos">Primeros pasos</h2>' +
        '<p>Consigue una caña en la <a href="/wiki/Sistema_de_miner%C3%ADa#Pico" data-wiki="article">mina</a> ' +
        'o en <a href="https://example.test/tienda" target="_blank">la tienda</a>.</p>' +
        '<img src="/wiki-img/pez.png" width="40" height="30" alt="pez" onerror="alert(1)">' +
        '<script>alert(1)</script>' +
        '<div class="hro2-card wikitable fixed hidden" style="background:linear-gradient(135deg,#123d52 0%,#28a2a0 100%);position:fixed;color:#174f68">' +
        '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0h24"/><use href="#x"/></svg></div>' +
        '<div class="wk-notice">aviso</div>',
      sections: [{ level: 2, title: 'Primeros pasos', anchor: 'Primeros_pasos' }],
      notice: { kind: 'off', label: 'Sistema antiguo', text: 'Ya no está en funcionamiento.' },
      text: 'Primeros pasos Consigue una caña en la mina o en la tienda. La pesca de HikariRO empieza al lanzar el cebo.',
    },
  ],
};
