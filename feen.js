/* Buchstabenfeen: Hier lassen sich neue Varianten als JS-Objekte ergänzen.
   Jede Variante benötigt ein Sprite-Sheet mit 6 Spalten × 3 Reihen in derselben
   Posenreihenfolge wie die vorhandenen Feen (idealerweise 1800 × 1050 px).
   Weitere Feen erscheinen automatisch im Startmenü.

   Beispiel:
     meineFee: {
       name: 'Meine Buchstabenfee',
       atlas: 'meine-buchstabenfee-atlas.webp'
     },
*/
window.GLUECKSRAD_FEEN = {
  marin: {
    name: 'Marin Gilzer',
    atlas: 'buchstabenfee/marin-atlas.webp'
  },
  sonya: {
    name: 'Sonya Kraus',
    atlas: 'buchstabenfee/sonya-atlas.webp'
  },
  pamela: {
    name: 'Pamela Anderson',
    atlas: 'buchstabenfee/pamela-atlas.webp'
  },
  pirat: {
    name: 'Pirat',
    atlas: 'buchstabenfee/pirat-atlas.webp'
  }
};
