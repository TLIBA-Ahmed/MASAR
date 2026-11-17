# Géométrie locale de la Tunisie

`tunisia.json` contient uniquement les frontières publiques de la Tunisie, ses îles et la provenance du fichier. Aucune donnée MASAR n'intervient dans sa création.

Source : [Natural Earth, Admin 0 Countries, échelle 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson). Les [conditions de Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) placent ces données dans le domaine public et autorisent leur adaptation et redistribution. Le fichier JSON conserve les URL et le SHA-256 de la source téléchargée.

Extraction reproductible : `.venv\Scripts\python.exe -X utf8 scripts/prepare-tunisia-geometry.py`. Trois polygones, 186 sommets ; les attributs géographiques nécessaires sont conservés, les coordonnées sont arrondies à cinq décimales. Le navigateur charge cet asset local dans le bundle, sans requête vers un fournisseur cartographique.

Le relief est une extrusion graphique symbolique, sans prétendre représenter une altitude mesurée. Les cinq points sont fixes, définis dans `mapGeometry.ts`, et ne représentent jamais la localisation d'un enfant. La géométrie reste indépendante du sens RTL/LTR de l'interface.
