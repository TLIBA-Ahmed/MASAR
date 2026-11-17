# Registre des modèles locaux

Les artefacts installés, empreintes, licences, révisions et statuts sont dans `infrastructure/model_artifacts/registry.json`, également enregistrés dans PostgreSQL par `python -m backend.register_models`. Les poids ne sont pas embarqués dans le frontend ni versionnés dans les sources.

| Fournisseur | Artefact épinglé | Runtime testé | Licence |
| --- | --- | --- | --- |
| SystemOneProvider | convaiinnovations/laya-multilingual @ 92d22143468d8af669dc1a5a0480a2b21b4fe56e | Laya 0.3.9 / PyTorch 2.10 CPU FP32, 322 M annoncés par l'auteur | Apache-2.0 |
| SLMProvider | unsloth/Qwen3-0.6B-GGUF @ 50968a4468ef4233ed78cd7c3de230dd1d61a56b, Q4_K_M | llama.cpp b12444 / llama-completion, CPU, 2048 tokens | Apache-2.0 |
| EmbeddingProvider | intfloat/multilingual-e5-small @ 614241f622f53c4eeff9890bdc4f31cfecc418b3 | ONNX Runtime 1.24.4, graphe INT8, CPUExecutionProvider, 384 dimensions | MIT |
| RerankerProvider | Non installé | Reporté selon mémoire disponible | À vérifier avant tout import |

Laya est discriminatif et non génératif ; ce n'est pas JEPA. Ses classifications portent seulement sur requêtes, preuves et ressources. Le checkpoint installé est multilingue. L'export ONNX anglophone cité dans certaines documentations n'a pas été substitué à ce checkpoint. Le runtime PyTorch CPU a été retenu et mesuré.

Le dépôt officiel Qwen3-0.6B-GGUF vérifié ne proposait que Q8_0 lors de l'inspection. L'artefact Q4_K_M provient donc du dépôt Unsloth, avec révision et SHA256 vérifiés, et non d'une prétendue quantification Q4 officielle. Le modèle de base est Qwen/Qwen3-0.6B. Le choix 0.6B tient à la mémoire réellement disponible.

Le prompt `grounded-extractive-v2` est partagé par la gateway et le registre PostgreSQL. Après un ajout factuel observé dans un essai, le SLM est limité à des extraits exacts et cités par une grammaire JSON ; la reformulation libre n'est pas déclarée validée. Le code, les prompts et les poids ne sont pas entraînés sur les dossiers. Les mesures Windows et les essais Linux Docker sont conservés séparément.

E5 utilise `query: ` et `passage: ` dans les deux langues, pooling moyen masqué et normalisation L2. La dimension est vérifiée avant écriture pgvector. Le nom d'export AVX512-VNNI n'est pas une affirmation que ce processeur possède AVX512 : ONNX Runtime exécute les kernels CPU compatibles, et les inférences ont été mesurées sur cet i5.

Le script d'installation ne lit aucune donnée métier. Il télécharge uniquement les révisions publiques épinglées, contrôle les SHA256 LFS quand disponibles et conserve les empreintes locales. Le correctif de compatibilité du tokenizer effectué par Laya est documenté comme configuration dérivée, avec empreinte distincte des poids. La gateway recontrôle les fichiers avant utilisation et ne télécharge rien pendant l'inférence.

`scripts/model-control.py` désactive un modèle ou restaure un manifeste local ; les poids doivent encore correspondre aux empreintes. Une réactivation exige vérification et benchmarks. Aucune mise à jour automatique de poids ni entraînement sur dossiers.

Sources primaires vérifiées : [Laya, code et licence](https://github.com/LeonaDavinci/laya-system-one), [checkpoint multilingue](https://huggingface.co/convaiinnovations/laya-multilingual), [E5](https://huggingface.co/intfloat/multilingual-e5-small), [Qwen officiel](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF), [quantification Unsloth](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF), [llama.cpp b12444](https://github.com/ggml-org/llama.cpp/releases/tag/b12444).
