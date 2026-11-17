# Mesures CPU locales

Résultats bruts : `benchmarks/cpu-results.json`, générés par `scripts/benchmark_cpu.py` le 16 novembre 2026. Windows 11, Intel i5-12500H, 12 cœurs / 16 threads, 15,63 Gio de RAM. Quatre threads par modèle, concurrence 1, contexte Qwen 2048 tokens. Aucun GPU.

| Modèle | Français, temps total | Arabe, temps total | Pic RSS arbre de processus |
| --- | --- | --- | --- |
| E5, trois textes | 1 388 ms | 1 251 ms | 439,2 / 427,7 Mio |
| Laya, deux ressources | 14 569 ms | 11 973 ms | 2 362,2 / 2 378,3 Mio |
| Qwen, sélection extractive JSON | 1 878 ms | 2 178 ms | 923,5 / 907,7 Mio |

Chaque mesure démarre un worker neuf et inclut imports/chargement ; le cache disque du système peut être chaud. La mémoire est échantillonnée toutes les 50 ms et comprend les enfants du processus. Ces six essais synthétiques ne sont ni un percentile de production ni une étude de charge. Une première exécution Laya avait pris environ 36 s : les temps varient avec l'état de la machine.

Les timings internes séparent l'initialisation du fournisseur et l'appel d'inférence. Pour E5 : 1 090 / 936 ms d'initialisation et 9 / 9 ms de calcul FR/AR. Pour Laya : 13 279 / 10 493 ms d'initialisation et 234 / 352 ms de scoring. Pour Qwen, llama.cpp rapporte 391,68 / 518,51 ms de chargement, 642,30 / 823,45 ms de génération et 40,48 / 32,79 tokens/s. Ces compteurs internes ne doivent pas être additionnés au temps total ; ils n'incluent pas tous les coûts du processus.

Les vecteurs ont 384 dimensions et une norme L2 de 1 dans ces essais. La ressource liée aux objectifs a une similarité et un score Laya supérieurs à la ressource hors sujet dans les deux langues. La marge Laya est faible (environ 6,8 points en français, 2,9 en arabe) : cela justifie l'éligibilité déterministe obligatoire, une pondération prudente et l'absence de confiance clinique revendiquée.

Qwen a produit un JSON valide et l'extrait exact fourni, en français et en arabe, avec sa source. Le script vérifie cette égalité avant de marquer le modèle testé. Les réponses brutes synthétiques figurent dans le rapport. La sélection extractive contrainte remplace la reformulation libre après un ajout factuel non sourcé observé dans le premier essai Linux ; les rapports initiaux sont préservés dans `cpu-results-initial.json` et `docker-cpu-smoke-initial.json`. Une citation correcte seule n'est pas une preuve de fidélité.

Le script `scripts/benchmark_pipelines.py` mesure aussi le chemin API complet, avec retrieval, démarrage des workers, chargement et validation. Résultats dans `benchmarks/pipeline-results.json` :

| Pipeline | Français | Arabe | Résultat de l'essai |
| --- | --- | --- | --- |
| Browser documentaire local | 4 708 ms | 10 939 ms | Réponse avec une source autorisée |
| Ateliers, huit candidats éligibles | 19 213 ms | 17 535 ms | Suggestions consultatives, aucun changement du plan |

Un essai par langue et pipeline ne mesure pas un p95 ni la qualité professionnelle. Les tests Linux en conteneur figurent dans `benchmarks/docker-cpu-smoke.json` et sont rejouables avec `scripts/smoke_docker_models.py` après lancement du profil fullstack. Ils vérifient les trois runtimes CPU bilingues et l'extrait exact du SLM, sans valider une charge institutionnelle.

La gateway utilise des processus courts et une concurrence unique pour ne pas conserver simultanément Laya, E5 et Qwen en mémoire. Le reranker est reporté. Le temps bout en bout inclut plusieurs étapes et peut donc dépasser le temps d'un modèle isolé. L'autocomplétion n'utilise aucun de ces modèles.

Rejouer : `.venv\Scripts\python.exe -X utf8 scripts/benchmark_cpu.py`, puis enregistrer le manifeste avec `python -m backend.register_models`. Ne remplacer cette table qu'à partir d'une nouvelle mesure réelle.
