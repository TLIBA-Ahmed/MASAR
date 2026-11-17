# Design System

MASAR utilise un langage ERP sobre : navigation fixe, surfaces blanches, filets légers, cartes compactes, hiérarchie de titres et données présentées avant les éléments décoratifs. Aucune photographie d’enfant n’est utilisée.

| Token      | Valeur provisoire                          |
| ---------- | ------------------------------------------ |
| Navy       | `#123E53`                                  |
| Teal       | `#419E85`                                  |
| Gold       | `#F6AD16`                                  |
| Fond       | `#F4F6F8` / variante d’interface `#F5F7F8` |
| Surface    | `#FFFFFF`                                  |
| Texte      | `#263238` / variante `#263B45`             |
| Secondaire | `#64748B` / nuances de légende             |
| Bordure    | `#DEE4E7` / nuance de surface `#E6EBEE`    |

Les propriétés de thème sont centralisées dans `styles/index.css`. Les composants supplémentaires sont dans `features.css`, l’impression dans `print.css`, les ajustements de lisibilité et de responsive dans `refinements.css`. Le thème sombre redéfinit les tokens de surface, texte et bordure. Les couleurs d’étape sont des accents du parcours, sans signification de danger ou d’état de santé.

IBM Plex Sans Arabic et Inter sont installées via Fontsource et servies localement. Les licences OFL sont conservées dans `public/licenses/`. Le logo original MASAR et les slogans sont centralisés dans `config/brand.ts`. `institutionalLogo` constitue un emplacement pour une ressource officiellement autorisée à fournir ultérieurement.

La racine HTML passe entre `lang=ar, dir=rtl` et `lang=fr, dir=ltr`. La sidebar suit automatiquement le côté de lecture ; les règles CSS utilisent les propriétés logiques `inline-start/end`. Les éléments de formulaire conservent leur état React. Les récits originaux utilisent `unicode-bidi: plaintext` et ne sont pas traduits artificiellement.

Les modales Radix gèrent le focus, Échap et le retour au déclencheur. Les boutons à icône ont un libellé et un titre ; les champs sont étiquetés ; la palette de commandes est accessible avec Ctrl/Cmd+K. Les animations sont réduites si `prefers-reduced-motion` est actif. Les tableaux et grilles larges défilent dans leur propre surface sur mobile.

La validation visuelle est effectuée avec Chrome sur desktop, mobile, arabe/français et thème sombre. Cela ne constitue pas un audit WCAG complet ; un tel audit reste prévu avant production.
