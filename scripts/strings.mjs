// Interface strings, page titles and descriptions for each language of the site.
// English is the source and lives at the root of the site; Spanish is under /es/ and Portuguese
// (Brazil) under /pt/. The long text of each page is in src/pages/<lang>/ and src/content/<lang>/.

export const LANGS = ['en', 'es', 'pt'];
export const DEFAULT_LANG = 'en';

export const STRINGS = {
  en: {
    htmlLang: 'en',
    hreflang: 'en',
    locale: 'en-US',
    ogLocale: 'en_US',
    label: 'English',
    short: 'EN',
    skip: 'Skip to content',
    homeAria: 'InvoiceFlow home',
    navAria: 'Main',
    langAria: 'Language',
    navFeatures: 'Features',
    navPrivacy: 'Privacy',
    navTerms: 'Terms',
    navSupport: 'Support',
    footPrivacy: 'Privacy Policy',
    footTerms: 'Terms and Conditions',
    footSupport: 'Support',
    rights: 'All rights reserved.',
    brandBy: 'InvoiceFlow is a product of {brand}.',
    playLink: 'Get it on Google Play',
    playSoon: 'Coming soon to Google Play',
    titles: {
      index: 'InvoiceFlow: private invoicing that works offline',
      support: 'Support · InvoiceFlow',
      privacy: 'Privacy Policy · InvoiceFlow',
      terms: 'Terms and Conditions · InvoiceFlow',
      notfound: 'Page not found · InvoiceFlow',
    },
    descriptions: {
      index:
        'Create invoices and estimates, track payments and send them by WhatsApp or PDF. Your data stays on your device. No account needed.',
      support: 'Get help with InvoiceFlow: contact us, back up and restore your data, and common questions.',
      privacy: 'How InvoiceFlow handles your information. Your data stays on your device.',
      terms: 'The terms for using the InvoiceFlow app.',
      notfound: 'This page does not exist.',
    },
  },
  es: {
    htmlLang: 'es',
    hreflang: 'es',
    locale: 'es',
    ogLocale: 'es_ES',
    label: 'Español',
    short: 'ES',
    skip: 'Saltar al contenido',
    homeAria: 'Inicio de InvoiceFlow',
    navAria: 'Principal',
    langAria: 'Idioma',
    navFeatures: 'Funciones',
    navPrivacy: 'Privacidad',
    navTerms: 'Términos',
    navSupport: 'Soporte',
    footPrivacy: 'Política de privacidad',
    footTerms: 'Términos y condiciones',
    footSupport: 'Soporte',
    rights: 'Todos los derechos reservados.',
    brandBy: 'InvoiceFlow es un producto de {brand}.',
    playLink: 'Consíguela en Google Play',
    playSoon: 'Próximamente en Google Play',
    titles: {
      index: 'InvoiceFlow: facturación privada que funciona sin internet',
      support: 'Soporte · InvoiceFlow',
      privacy: 'Política de privacidad · InvoiceFlow',
      terms: 'Términos y condiciones · InvoiceFlow',
      notfound: 'Página no encontrada · InvoiceFlow',
    },
    descriptions: {
      index:
        'Crea facturas y presupuestos, registra pagos y envíalos por WhatsApp o PDF. Tus datos se quedan en tu dispositivo. No necesitas cuenta.',
      support:
        'Ayuda con InvoiceFlow: contáctanos, respalda y restaura tus datos, y consulta las preguntas frecuentes.',
      privacy: 'Cómo InvoiceFlow trata tu información. Tus datos se quedan en tu dispositivo.',
      terms: 'Los términos para usar la aplicación InvoiceFlow.',
      notfound: 'Esta página no existe.',
    },
  },
  pt: {
    htmlLang: 'pt-BR',
    hreflang: 'pt-BR',
    locale: 'pt-BR',
    ogLocale: 'pt_BR',
    label: 'Português',
    short: 'PT',
    skip: 'Ir para o conteúdo',
    homeAria: 'Início do InvoiceFlow',
    navAria: 'Principal',
    langAria: 'Idioma',
    navFeatures: 'Recursos',
    navPrivacy: 'Privacidade',
    navTerms: 'Termos',
    navSupport: 'Suporte',
    footPrivacy: 'Política de Privacidade',
    footTerms: 'Termos e Condições',
    footSupport: 'Suporte',
    rights: 'Todos os direitos reservados.',
    brandBy: 'O InvoiceFlow é um produto de {brand}.',
    playLink: 'Baixe no Google Play',
    playSoon: 'Em breve no Google Play',
    titles: {
      index: 'InvoiceFlow: faturamento privado que funciona sem internet',
      support: 'Suporte · InvoiceFlow',
      privacy: 'Política de Privacidade · InvoiceFlow',
      terms: 'Termos e Condições · InvoiceFlow',
      notfound: 'Página não encontrada · InvoiceFlow',
    },
    descriptions: {
      index:
        'Crie faturas e orçamentos, registre pagamentos e envie por WhatsApp ou PDF. Seus dados ficam no seu dispositivo. Sem precisar de conta.',
      support:
        'Ajuda com o InvoiceFlow: fale conosco, faça backup e restaure seus dados e veja as perguntas frequentes.',
      privacy: 'Como o InvoiceFlow trata suas informações. Seus dados ficam no seu dispositivo.',
      terms: 'Os termos para usar o aplicativo InvoiceFlow.',
      notfound: 'Esta página não existe.',
    },
  },
};

/** "/es" for Spanish, "" for the default language: the folder a language is served from. */
export const prefixOf = (lang) => (lang === DEFAULT_LANG ? '' : `/${lang}`);
