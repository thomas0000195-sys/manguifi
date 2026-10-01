#!/usr/bin/env node
/**
 * Vérifier que toutes les variables d'environnement requises pour la production
 * sont définies et valides.
 *
 * Usage: node --import tsx scripts/check-env-production.ts
 */

import process from 'process';

interface EnvVar {
  name: string;
  required: boolean;
  validate?: (value: string) => boolean;
  description: string;
}

const requiredVars: EnvVar[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    validate: (v) => v.startsWith('postgresql://'),
    description: 'Connection string Neon.tech'
  },
  {
    name: 'AUTH_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'Secret d\'authentification (min 32 chars)'
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'Clé de chiffrement (min 32 chars)'
  },
  {
    name: 'CRON_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'Secret des tâches cron (min 32 chars)'
  },
  {
    name: 'RESEND_API_KEY',
    required: true,
    validate: (v) => v.startsWith('re_'),
    description: 'Clé API Resend pour emails'
  },
  {
    name: 'EMAIL_FROM',
    required: true,
    validate: (v) => v.includes('@'),
    description: 'Adresse email d\'expédition'
  },
  {
    name: 'APP_URL',
    required: true,
    validate: (v) => v.startsWith('http'),
    description: 'URL publique de l\'app (utilisée dans les emails)'
  },
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: true,
    validate: (v) => v.startsWith('AC'),
    description: 'Twilio Account SID'
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: true,
    validate: (v) => v.length > 20,
    description: 'Twilio Auth Token'
  },
  {
    name: 'TWILIO_VERIFY_SERVICE_SID',
    required: true,
    validate: (v) => v.startsWith('VA'),
    description: 'Twilio Verify Service SID'
  },
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    required: true,
    validate: (v) => v.startsWith('vercel_blob_'),
    description: 'Vercel Blob read/write token pour sauvegardes'
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    validate: (v) => v === '' || v.startsWith('https://'),
    description: 'Sentry DSN pour monitoring serveur (optionnel)'
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    validate: (v) => v === '' || v.startsWith('https://'),
    description: 'Sentry DSN pour monitoring client (optionnel)'
  }
];

function checkEnvironment(): {
  passed: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let allValid = true;

  console.log('\n📋 Vérification des variables d\'environnement production\n');
  console.log('━'.repeat(70));

  for (const envVar of requiredVars) {
    const value = process.env[envVar.name];
    const isDefined = value !== undefined && value !== '';

    if (!isDefined && envVar.required) {
      errors.push(`❌ ${envVar.name}: MANQUANTE (requise)\n   ${envVar.description}`);
      allValid = false;
    } else if (isDefined && envVar.validate && !envVar.validate(value)) {
      errors.push(`⚠️  ${envVar.name}: Format invalide\n   ${envVar.description}\n   Valeur: ${value.substring(0, 20)}...`);
      allValid = false;
    } else if (isDefined && envVar.required) {
      console.log(`✅ ${envVar.name.padEnd(30)} OK`);
    } else if (!isDefined && !envVar.required) {
      console.log(`⏭️  ${envVar.name.padEnd(30)} (optionnel, non défini)`);
    } else if (isDefined && !envVar.required) {
      console.log(`✅ ${envVar.name.padEnd(30)} Configuré`);
    }
  }

  console.log('\n' + '━'.repeat(70));

  if (errors.length > 0) {
    console.log('\n🚨 ERREURS:\n');
    errors.forEach((err) => console.log(err + '\n'));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  AVERTISSEMENTS:\n');
    warnings.forEach((warn) => console.log(warn + '\n'));
  }

  const summary = `
📊 Résumé:
  - Variables obligatoires: ${requiredVars.filter((v) => v.required).length}
  - Variables optionnelles: ${requiredVars.filter((v) => !v.required).length}
  - Erreurs: ${errors.length}
  - Avertissements: ${warnings.length}
`;
  console.log(summary);

  if (allValid && errors.length === 0) {
    console.log('✨ Tous les prérequis sont satisfaits. Prêt pour le déploiement!\n');
  } else {
    console.log('❌ Certaines variables manquent ou ont un format invalide.\n   Voir DEPLOIEMENT_COMPTES.md pour les détails.\n');
  }

  return { passed: allValid && errors.length === 0, errors, warnings };
}

const result = checkEnvironment();
process.exit(result.passed ? 0 : 1);
