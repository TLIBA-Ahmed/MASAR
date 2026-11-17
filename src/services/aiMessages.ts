import type { Bi } from '../types';
const messages:Record<string,Bi>={
 PROFESSIONAL_OBJECTIVES_REQUIRED:{ar:'يجب تأكيد أهداف مهنية قبل طلب المقترحات.',fr:'Confirmez des objectifs professionnels avant de demander des propositions.'},
 OBJECTIVES_UNCONFIRMED_OR_UNAVAILABLE:{ar:'بعض الأهداف غير مؤكدة أو لم تعد متاحة.',fr:'Certains objectifs ne sont pas confirmés ou ne sont plus accessibles.'},
 NO_ELIGIBLE_APPROVED_RESOURCES:{ar:'لا توجد موارد تستوفي الأهداف والشروط المحددة.',fr:'Aucune ressource ne satisfait les objectifs et les conditions sélectionnés.'},
 NO_AUTHORIZED_RELIABLE_EVIDENCE:{ar:'لم يُعثر على مصادر موثوقة ضمن نطاق الوصول.',fr:'Aucune source fiable trouvée dans votre périmètre.'},
 ACCESS_CHANGED:{ar:'تغيّر الوصول أثناء الطلب. أعد المحاولة.',fr:'Les accès ont changé pendant la demande. Relancez-la.'},
 ACCESS_OR_OBJECTIVES_CHANGED:{ar:'تغيّرت الأهداف أو الصلاحيات. أعد المراجعة.',fr:'Les objectifs ou les accès ont changé. Vérifiez-les à nouveau.'},
 LOCAL_MODELS_UNAVAILABLE_NO_CLOUD_FALLBACK:{ar:'النماذج المحلية غير متاحة حالياً. لا يوجد بديل سحابي.',fr:'Les modèles locaux sont indisponibles. Aucun relais vers un service cloud.'},
 LOCAL_SLM_UNAVAILABLE:{ar:'نموذج الصياغة المحلي غير متاح.',fr:'Le modèle local de rédaction est indisponible.'},
 LOCAL_EMBEDDING_UNAVAILABLE:{ar:'نموذج البحث الدلالي المحلي غير متاح.',fr:'Le modèle local de recherche sémantique est indisponible.'},
 UNSUPPORTED_OR_UNSAFE_REQUEST:{ar:'الطلب خارج دور المساعدة في البحث. اختر سؤالاً عن المصادر.',fr:'Cette demande dépasse l’assistance à la recherche. Posez une question sur les sources.'},
 UNSUPPORTED_REQUEST:{ar:'الطلب خارج نطاق التوصيات الاستشارية.',fr:'Cette demande dépasse le périmètre des recommandations consultatives.'},
 OUTPUT_VALIDATION_FAILED:{ar:'لم يمكن التحقق من الإجابة. راجع المصادر مباشرة.',fr:'La réponse n’a pas pu être vérifiée. Consultez directement les sources.'},
 UNTRUSTED_REFERENCE_INSTRUCTION:{ar:'المصدر يحتوي على تعليمات غير موثوقة. أُوقفت الصياغة.',fr:'Une source contient des instructions non fiables. La rédaction a été interrompue.'},
 DETERMINISTIC_DEMO_NO_GENERATIVE_MODEL:{ar:'عرض حتمي للمقتطفات، دون توليد بواسطة نموذج.',fr:'Présentation déterministe des extraits, sans génération par modèle.'},
 DETERMINISTIC_DEMO_NO_MODEL_INFERENCE:{ar:'وضع تجريبي: مطابقة حتمية دون استدلال بنموذج.',fr:'Mode démo : correspondance déterministe, sans inférence de modèle.'},
 DEMO_CATALOGUE_NOT_MINISTRY_APPROVAL:{ar:'الموارد اصطناعية وليست اعتماداً رسمياً من الوزارة.',fr:'Ressources synthétiques, sans approbation officielle du ministère.'},
 SYSTEM_ONE_RESOURCE_SCORES_UNCALIBRATED:{ar:'درجات ملاءمة الموارد تجريبية وتحتاج إلى مراجعة مهنية.',fr:'Les scores de pertinence des ressources sont expérimentaux et doivent être revus.'},
 LOCAL_EXTRACTIVE_SELECTION:{ar:'يختار النموذج مقتطفاً حرفياً من المصادر المسموح بها. راجع المصدر الكامل.',fr:'Le modèle sélectionne un extrait exact d’une source autorisée. Consultez la source complète.'},
 SMALL_LOCAL_MODEL_REVIEW_SOURCES:{ar:'راجع المصادر: الصياغة بمساعدة نموذج محلي صغير.',fr:'Vérifiez les sources : rédaction assistée par un petit modèle local.'},
};
export const aiMessage=(code:string,lang:'ar'|'fr')=>messages[code]?.[lang]??(lang==='ar'?'تحقق من الشروط والمصادر قبل المتابعة.':'Vérifiez les conditions et les sources avant de poursuivre.');
